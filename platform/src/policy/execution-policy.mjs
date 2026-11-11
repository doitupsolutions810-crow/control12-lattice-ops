/**
 * Execution Policy – safety bounds for coding agent + terminal
 *
 * These bounds reduce accidental harm. They are not a security boundary against
 * a determined adversary.
 *
 * Layers:
 * 1. Path confinement (workspace root)
 * 2. Content size / extension limits
 * 3. Command length + blocked pattern list
 * 4. Optional command allowlist (strict mode)
 * 5. Concurrent + rate limits
 */

import path from 'node:path';

/** Default blocked substrings / patterns (case-insensitive). */
export const DEFAULT_BLOCKED_PATTERNS = Object.freeze([
  // Destructive filesystem
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/\b/,
  /\brm\s+-rf\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bshred\b/,
  /\b:(){:|:&};:/, // classic fork bomb form
  // Privilege / identity
  /\bsudo\b/,
  /\bdoas\b/,
  /\bpasswd\b/,
  /\bchmod\s+777\b/,
  /\bchown\b/,
  // Remote code fetch-and-run
  /\bcurl\b.*\|\s*(ba)?sh\b/,
  /\bwget\b.*\|\s*(ba)?sh\b/,
  /\bcurl\b.*\|\s*python/,
  // Network pivot / reverse shells (common shapes)
  /\bnc\s+-[el]/,
  /\bncat\b.*-e/,
  /\bbash\s+-i\s+>&\s*\/dev\/tcp/,
  /\/dev\/tcp\//,
  // Kernel / firmware
  /\binsmod\b/,
  /\brmmod\b/,
  /\bkexec\b/,
  // Credential / secret paths
  /\/\.ssh\//,
  /\/\.aws\//,
  /\/etc\/shadow\b/,
  /\/etc\/passwd\b/
]);

/** Commands allowed when strict allowlist mode is on (first token). */
export const DEFAULT_ALLOWLIST = Object.freeze([
  'node',
  'npm',
  'npx',
  'python',
  'python3',
  'pip',
  'pip3',
  'git',
  'ls',
  'cat',
  'head',
  'tail',
  'echo',
  'pwd',
  'which',
  'test',
  'true',
  'false',
  'printf',
  'wc',
  'diff',
  'mkdir',
  'touch',
  'cp',
  'mv',
  'rg',
  'grep',
  'find',
  'jq',
  'node',
  'tsc',
  'eslint',
  'prettier'
]);

export const DEFAULT_DENIED_WRITE_EXTENSIONS = Object.freeze([
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.pem', '.key', '.p12', '.pfx'
]);

export function createExecutionPolicy(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const maxWriteBytes = Number(options.maxWriteBytes ?? 512_000); // 512 KiB
  const maxCommandChars = Number(options.maxCommandChars ?? 2_000);
  const maxConcurrent = Number(options.maxConcurrent ?? 2);
  const rateLimitWindowMs = Number(options.rateLimitWindowMs ?? 60_000);
  const rateLimitMax = Number(options.rateLimitMax ?? 20);
  const strictAllowlist = Boolean(options.strictAllowlist ?? false);
  const blockedPatterns = options.blockedPatterns ?? DEFAULT_BLOCKED_PATTERNS;
  const allowlist = options.allowlist ?? DEFAULT_ALLOWLIST;
  const deniedExtensions = new Set(
    (options.deniedWriteExtensions ?? DEFAULT_DENIED_WRITE_EXTENSIONS).map(e => e.toLowerCase())
  );
  const maxTimeoutMs = Number(options.maxTimeoutMs ?? 120_000);
  const minTimeoutMs = Number(options.minTimeoutMs ?? 1_000);

  let inFlight = 0;
  const recentTimestamps = [];

  function deny(message, code = 400) {
    throw Object.assign(new Error(message), { statusCode: code, code: 'EXECUTION_POLICY' });
  }

  /**
   * Resolve relative path under workspace. Rejects .. escape and absolute paths outside root.
   */
  function resolveSafe(relPath) {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      deny('path is required');
    }
    if (path.isAbsolute(relPath)) {
      deny('absolute paths are not allowed; use workspace-relative paths');
    }
    // Leading '..' segments were previously stripped (so '../outside' silently became
    // '<root>/outside'); any '..' that survives normalisation is now rejected instead.
    const cleaned = path.normalize(relPath);
    if (cleaned.split(path.sep).includes('..')) {
      deny('path escapes workspace');
    }
    const absolute = path.resolve(workspaceRoot, cleaned);
    const relative = path.relative(workspaceRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      deny('path escapes workspace');
    }
    return absolute;
  }

  function assertWriteAllowed(relPath, content) {
    const absolute = resolveSafe(relPath);
    const ext = path.extname(absolute).toLowerCase();
    if (deniedExtensions.has(ext)) {
      deny(`write denied for extension: ${ext}`);
    }
    const bytes = typeof content === 'string'
      ? Buffer.byteLength(content, 'utf8')
      : Buffer.isBuffer(content)
        ? content.length
        : 0;
    if (bytes > maxWriteBytes) {
      deny(`content exceeds maxWriteBytes (${maxWriteBytes})`);
    }
    return { absolute, bytes };
  }

  function firstToken(command) {
    const trimmed = command.trim();
    const withoutEnv = trimmed.replace(/^([A-Za-z_][A-Za-z0-9_]*=\S+\s+)*/,'');
    const match = withoutEnv.match(/^([a-zA-Z0-9._+/-]+)/);
    return match ? match[1] : '';
  }

  function assertCommandAllowed(command) {
    if (typeof command !== 'string' || !command.trim()) {
      deny('command is required');
    }
    if (command.length > maxCommandChars) {
      deny(`command exceeds maxCommandChars (${maxCommandChars})`);
    }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(command)) {
      deny('command contains control characters');
    }

    const lower = command.toLowerCase();
    for (const pattern of blockedPatterns) {
      if (pattern.test(lower) || pattern.test(command)) {
        deny(`command blocked by policy: matches ${pattern}`);
      }
    }

    if (strictAllowlist) {
      const token = firstToken(command);
      const base = path.basename(token);
      if (!allowlist.includes(base) && !allowlist.includes(token)) {
        deny(`command not on allowlist: ${base || '(empty)'}`);
      }
    }

    return true;
  }

  function clampTimeout(timeoutMs) {
    const n = Number(timeoutMs);
    if (!Number.isFinite(n)) return maxTimeoutMs;
    return Math.min(maxTimeoutMs, Math.max(minTimeoutMs, Math.trunc(n)));
  }

  function beginExecution() {
    const now = Date.now();
    while (recentTimestamps.length && now - recentTimestamps[0] > rateLimitWindowMs) {
      recentTimestamps.shift();
    }
    if (recentTimestamps.length >= rateLimitMax) {
      deny(`rate limit exceeded (${rateLimitMax} per ${rateLimitWindowMs}ms)`, 429);
    }
    if (inFlight >= maxConcurrent) {
      deny(`too many concurrent executions (max ${maxConcurrent})`, 429);
    }
    inFlight += 1;
    recentTimestamps.push(now);
    return () => {
      inFlight = Math.max(0, inFlight - 1);
    };
  }

  function snapshot() {
    return {
      workspaceRoot,
      maxWriteBytes,
      maxCommandChars,
      maxConcurrent,
      rateLimitWindowMs,
      rateLimitMax,
      strictAllowlist,
      maxTimeoutMs,
      deniedExtensions: [...deniedExtensions],
      allowlistSize: allowlist.length,
      blockedPatternCount: blockedPatterns.length,
      inFlight,
      recentCount: recentTimestamps.length
    };
  }

  return {
    workspaceRoot,
    resolveSafe,
    assertWriteAllowed,
    assertCommandAllowed,
    clampTimeout,
    beginExecution,
    snapshot,
    deny
  };
}

export default { createExecutionPolicy, DEFAULT_BLOCKED_PATTERNS, DEFAULT_ALLOWLIST };
