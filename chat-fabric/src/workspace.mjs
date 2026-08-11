import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.env.CONTROL12_WORKSPACE_ROOT || path.join(process.env.HOME || "/tmp", ".control12", "workspaces"));
const WRITABLE_AREAS = new Set(["source", "generated"]);
const mutationQueues = new Map();

function safeSegment(value, label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value || "") || value === "." || value === "..") {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

function digest(data) {
  return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`;
}

function workspaceRoot(tenant, workspaceId) {
  return path.join(ROOT, safeSegment(tenant, "tenant"), safeSegment(workspaceId, "workspaceId"));
}

function safeWorkspacePath(root, relativePath) {
  const supplied = String(relativePath || "");
  if (!supplied || path.isAbsolute(supplied) || supplied.includes("\\") || supplied.includes("\0")) {
    throw new Error("workspace path escape denied");
  }
  const segments = supplied.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("workspace path escape denied");
  }
  const clean = segments.join(path.sep);
  const resolved = path.resolve(root, clean);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("workspace path escape denied");
  return resolved;
}

function writableWorkspacePath(root, relativePath) {
  const target = safeWorkspacePath(root, relativePath);
  const [area] = path.relative(root, target).split(path.sep);
  if (!WRITABLE_AREAS.has(area)) throw new Error("workspace internal path write denied");
  return target;
}

async function withWorkspaceMutation(root, operation) {
  const prior = mutationQueues.get(root) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const queued = prior.then(() => current);
  mutationQueues.set(root, queued);
  await prior;
  try {
    return await operation();
  } finally {
    release();
    if (mutationQueues.get(root) === queued) mutationQueues.delete(root);
  }
}

async function syncDirectory(directory) {
  const handle = await fs.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicWriteFile(target, bytes) {
  const directory = path.dirname(target);
  const temporary = path.join(directory, `.${path.basename(target)}.${crypto.randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, target);
    await syncDirectory(directory);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temporary).catch(unlinkError => {
      if (unlinkError.code !== "ENOENT") throw unlinkError;
    });
    throw error;
  }
}

async function assertNoSymlinkTraversal(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    if (target !== root) throw new Error("workspace path escape denied");
    return;
  }
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error("workspace symlink traversal denied");
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
  }
}

async function appendJsonl(file, record) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const handle = await fs.open(file, "a", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(path.dirname(file));
}

async function readJsonlSafe(file) {
  try {
    return (await fs.readFile(file, "utf8")).split("\n").filter(Boolean).map(JSON.parse);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function ensureWorkspace(tenant, workspaceId) {
  const root = workspaceRoot(tenant, workspaceId);
  for (const dir of ["source", "generated", "artifacts", "attestations", "execution", "logs", "memory"]) {
    await fs.mkdir(path.join(root, dir), { recursive: true, mode: 0o700 });
  }
  const manifestPath = path.join(root, "workspace.manifest.json");
  try {
    const stat = await fs.lstat(manifestPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("workspace manifest must be a regular non-symlink file");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const manifest = { schema: "control12.workspace/v1", tenant, workspaceId, createdAt: new Date().toISOString(), revision: 0 };
    try {
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600, flag: "wx" });
    } catch (writeError) {
      if (writeError.code !== "EEXIST") throw writeError;
    }
    const stat = await fs.lstat(manifestPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("workspace manifest must be a regular non-symlink file");
  }
  return root;
}

export async function writeWorkspaceFile({ tenant, workspaceId, relativePath, content, actor = "chat-user" }) {
  const root = await ensureWorkspace(tenant, workspaceId);
  const target = writableWorkspacePath(root, relativePath);
  return withWorkspaceMutation(root, async () => {
    await assertNoSymlinkTraversal(root, target);
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await assertNoSymlinkTraversal(root, target);

    const bytes = Buffer.from(String(content), "utf8");
    const revisionFile = path.join(root, "execution", "revisions.jsonl");
    const prior = await readJsonlSafe(revisionFile);
    const previous = prior.at(-1) || null;
    const unsignedRecord = {
      schema: "control12.workspace-revision/v1",
      id: crypto.randomUUID(),
      parent: previous?.id || null,
      parentHash: previous?.recordHash || null,
      actor,
      operation: "write",
      path: path.relative(root, target),
      contentDigest: digest(bytes),
      observedAt: new Date().toISOString()
    };
    const record = { ...unsignedRecord, recordHash: digest(Buffer.from(JSON.stringify(unsignedRecord))) };

    await atomicWriteFile(target, bytes);
    await appendJsonl(revisionFile, record);
    return record;
  });
}

export async function readWorkspaceFile({ tenant, workspaceId, relativePath }) {
  const root = await ensureWorkspace(tenant, workspaceId);
  const target = safeWorkspacePath(root, relativePath);
  await assertNoSymlinkTraversal(root, target);
  const content = await fs.readFile(target, "utf8");
  return { path: path.relative(root, target), content, contentDigest: digest(Buffer.from(content)) };
}

export async function appendMemory({ tenant, workspaceId, scope = "workspace", kind = "message", content, metadata = {} }) {
  const root = await ensureWorkspace(tenant, workspaceId);
  const record = { schema: "control12.memory/v1", id: crypto.randomUUID(), scope, kind, content, metadata, observedAt: new Date().toISOString() };
  await appendJsonl(path.join(root, "memory", `${safeSegment(scope, "memory scope")}.jsonl`), record);
  return record;
}

export async function readMemory({ tenant, workspaceId, scope = "workspace", limit = 50 }) {
  const root = await ensureWorkspace(tenant, workspaceId);
  const file = path.join(root, "memory", `${safeSegment(scope, "memory scope")}.jsonl`);
  const records = await readJsonlSafe(file);
  return records.slice(-Math.min(Math.max(Number(limit) || 50, 1), 500));
}

export async function workspaceStatus(tenant, workspaceId) {
  const root = await ensureWorkspace(tenant, workspaceId);
  const revisions = await readJsonlSafe(path.join(root, "execution", "revisions.jsonl"));
  return { schema: "control12.workspace-status/v1", tenant, workspaceId, root, revisions: revisions.length, lastRevision: revisions.at(-1) || null };
}
