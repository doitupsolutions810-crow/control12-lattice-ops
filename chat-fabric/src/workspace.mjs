import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.env.CONTROL12_WORKSPACE_ROOT || path.join(process.env.HOME || "/tmp", ".control12", "workspaces"));

function safeSegment(value, label) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(value || "")) throw new Error(`invalid ${label}`);
  return value;
}

function digest(data) {
  return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`;
}

function workspaceRoot(tenant, workspaceId) {
  return path.join(ROOT, safeSegment(tenant, "tenant"), safeSegment(workspaceId, "workspaceId"));
}

function safeWorkspacePath(root, relativePath) {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  const resolved = path.resolve(root, clean);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("workspace path escape denied");
  return resolved;
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
  await fs.appendFile(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
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
    if (stat.isSymbolicLink()) throw new Error("workspace manifest symlink denied");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const manifest = { schema: "control12.workspace/v1", tenant, workspaceId, createdAt: new Date().toISOString(), revision: 0 };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600, flag: "wx" });
  }
  return root;
}

export async function writeWorkspaceFile({ tenant, workspaceId, relativePath, content, actor = "chat-user" }) {
  const root = await ensureWorkspace(tenant, workspaceId);
  const target = safeWorkspacePath(root, relativePath);
  await assertNoSymlinkTraversal(root, target);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await assertNoSymlinkTraversal(root, target);

  const bytes = Buffer.from(String(content), "utf8");
  await fs.writeFile(target, bytes, { mode: 0o600 });

  const revisionFile = path.join(root, "execution", "revisions.jsonl");
  const prior = await readJsonlSafe(revisionFile);
  const parent = prior.at(-1)?.id || null;
  const record = {
    schema: "control12.workspace-revision/v1",
    id: crypto.randomUUID(),
    parent,
    actor,
    operation: "write",
    path: path.relative(root, target),
    contentDigest: digest(bytes),
    observedAt: new Date().toISOString()
  };
  await appendJsonl(revisionFile, record);
  return record;
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
