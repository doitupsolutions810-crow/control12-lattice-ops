/**
 * CodingAgent – write / edit code and execute via local-agent terminal
 *
 * Safety model (provisional, not absolute):
 * - File writes confined to a workspace root
 * - Terminal execution delegated to local-agent (bounded timeout + output)
 * - No arbitrary path escape outside workspace
 *
 * Always Believe. Never Know.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export class CodingAgent {
  /**
   * @param {{ workspaceRoot: string, localAgentUrl: string, bus?: { publish: Function } }}
   */
  constructor({ workspaceRoot, localAgentUrl, bus = null }) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.localAgentUrl = localAgentUrl.replace(/\/$/, '');
    this.bus = bus;
  }

  /** Resolve and enforce path stays under workspaceRoot. */
  resolveSafe(relPath) {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      throw Object.assign(new Error('path is required'), { statusCode: 400 });
    }
    const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolute = path.resolve(this.workspaceRoot, normalized);
    if (!absolute.startsWith(this.workspaceRoot)) {
      throw Object.assign(new Error('path escapes workspace'), { statusCode: 400 });
    }
    return absolute;
  }

  async writeFile(relPath, content) {
    const absolute = this.resolveSafe(relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
    if (this.bus) await this.bus.publish('code.written', { path: relPath, bytes: Buffer.byteLength(content) });
    return { ok: true, path: relPath, absolute, bytes: Buffer.byteLength(content) };
  }

  async readFile(relPath) {
    const absolute = this.resolveSafe(relPath);
    const content = await fs.readFile(absolute, 'utf8');
    return { ok: true, path: relPath, content };
  }

  async editFile(relPath, oldString, newString, { replaceAll = false } = {}) {
    const absolute = this.resolveSafe(relPath);
    let content = await fs.readFile(absolute, 'utf8');
    if (!content.includes(oldString)) {
      throw Object.assign(new Error('oldString not found in file'), { statusCode: 400 });
    }
    content = replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString);
    await fs.writeFile(absolute, content, 'utf8');
    if (this.bus) await this.bus.publish('code.edited', { path: relPath });
    return { ok: true, path: relPath };
  }

  async listFiles(relDir = '.') {
    const absolute = this.resolveSafe(relDir);
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    return {
      ok: true,
      path: relDir,
      entries: entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file'
      }))
    };
  }

  /**
   * Execute a command via local-agent bounded terminal.
   * cwd defaults to workspace root.
   */
  async execute(command, { cwd = null, timeoutMs = 120000 } = {}) {
    if (typeof command !== 'string' || !command.trim()) {
      throw Object.assign(new Error('command is required'), { statusCode: 400 });
    }

    const resolvedCwd = cwd ? this.resolveSafe(cwd) : this.workspaceRoot;

    if (this.bus) await this.bus.publish('terminal.started', { command, cwd: resolvedCwd });

    const response = await fetch(`${this.localAgentUrl}/api/tools/terminal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command, cwd: resolvedCwd }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    if (!response.ok) {
      throw Object.assign(
        new Error(`terminal failed: HTTP ${response.status}: ${text.slice(0, 400)}`),
        { statusCode: response.status }
      );
    }

    if (this.bus) await this.bus.publish('terminal.completed', { command, code: result.code });
    return { ok: true, command, cwd: resolvedCwd, ...result };
  }

  /**
   * High-level: write a file then optionally run a command.
   */
  async produceAndRun({ path: relPath, content, command = null }) {
    const written = await this.writeFile(relPath, content);
    if (!command) return { written, execution: null };
    const execution = await this.execute(command);
    return { written, execution };
  }
}

export default CodingAgent;
