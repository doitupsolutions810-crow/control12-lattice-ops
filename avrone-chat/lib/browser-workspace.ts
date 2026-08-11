export type WorkspaceFile = { path: string; content: string };
export type WorkspaceRevision = {
  id: string;
  parent: string | null;
  path: string;
  contentDigest: string;
  recordHash: string;
  observedAt: string;
};

export type BrowserWorkspace = {
  schema: 'control12.browser-workspace/v1';
  files: WorkspaceFile[];
  revisions: WorkspaceRevision[];
};

export const DEFAULT_WORKSPACE: BrowserWorkspace = {
  schema: 'control12.browser-workspace/v1',
  files: [
    {
      path: 'src/lattice.ts',
      content: `export type MeshCounts = { A: number; B: number; C: number };\n\nexport const snapshot = { A: 218, B: 158, C: 80 } as const;\n\nexport function meshBRatio(counts: MeshCounts) {\n  return counts.B / counts.A;\n}\n\nexport function insideTargetBand(ratio: number) {\n  return ratio >= 0.65 && ratio <= 0.75;\n}\n`
    },
    {
      path: 'README.md',
      content: '# Browser-local workspace\n\nFiles stay in this browser. Saving emits a hash-linked revision. No code is executed and no production authority is available.\n'
    }
  ],
  revisions: []
};

const encoder = new TextEncoder();

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return `sha256:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function isSafeWorkspacePath(path: string) {
  return (
    path.length > 0 &&
    path.length <= 240 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').includes('..') &&
    !path.includes('\0')
  );
}

export async function saveWorkspaceFile(
  workspace: BrowserWorkspace,
  path: string,
  content: string,
  observedAt = new Date().toISOString()
): Promise<BrowserWorkspace> {
  if (!isSafeWorkspacePath(path)) throw new Error('workspace path denied');
  if (content.length > 200_000) throw new Error('workspace file too large');
  const contentDigest = await sha256(content);
  const parent = workspace.revisions.at(-1)?.recordHash || null;
  const recordMaterial = JSON.stringify({ parent, path, contentDigest, observedAt });
  const recordHash = await sha256(recordMaterial);
  const revision: WorkspaceRevision = {
    id: crypto.randomUUID(),
    parent,
    path,
    contentDigest,
    recordHash,
    observedAt
  };
  const files = workspace.files.some(file => file.path === path)
    ? workspace.files.map(file => (file.path === path ? { path, content } : file))
    : [...workspace.files, { path, content }];
  return { ...workspace, files, revisions: [...workspace.revisions, revision] };
}
