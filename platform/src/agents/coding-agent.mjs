/**
 * CodingAgent – write / edit code and execute via local-agent terminal
 *
 * Safety model:
 * - Path confinement under workspace root (relative + .. rejected)
 * - Content size + denied write extensions
 * - Command blocked patterns; optional strict allowlist
 * - Rate limit + concurrent execution cap
 * - Terminal delegated to local-agent (timeout + output bounds)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createExecutionPolicy } from '../policy/execution-policy.mjs';

export class CodingAgent {
  /**
   * @param {{
   *   workspaceRoot: string,
   *   localAgentUrl: string,
   *   bus?: { publish: Function },
   *   policyOptions?: object
   * }}
   */
  constructor({ workspaceRoot, localAgentUrl, bus = null, policyOptions = {} }) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.localAgentUrl = localAgentUrl.replace(/\/$/, '');
    this.bus = bus;
    this.policy = createExecutionPolicy({
      workspaceRoot: this.workspaceRoot,
      ...policyOptions
    });
  }

  resolveSafe(relPath) {
    return this.policy.resolveSafe(relPath);
  }

  async writeFile(relPath, content) {
    const { absolute, bytes } = this.policy.assertWriteAllowed(relPath, content ?? '');
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content ?? '', 'utf8');
    if (this.bus) {
      await this.bus.publish('code.written', { path: relPath, bytes });
    }
    return { ok: true, path: relPath, absolute, bytes };
  }

  async readFile(relPath) {
    const absolute = this.policy.resolveSafe(relPath);
    const content = await fs.readFile(absolute, 'utf8');
    return { ok: true, path: relPath, content };
  }

  async editFile(relPath, oldString, newString, { replaceAll = false } = {}) {
    if (typeof oldString !== 'string' || typeof newString !== 'string') {
      this.policy.deny('oldString and newString are required');
    }
    const absolute = this.policy.resolveSafe(relPath);
    let content = await fs.readFile(absolute, 'utf8');
    if (!content.includes(oldString)) {
      this.policy.deny('oldString not found in file');
    }
    const next = replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString);
    this.policy.assertWriteAllowed(relPath, next);
    await fs.writeFile(absolute, next, 'utf8');
    if (this.bus) await this.bus.publish('code.edited', { path: relPath });
    return { ok: true, path: relPath };
  }

  async listFiles(relDir = '.') {
    const absolute = this.policy.resolveSafe(relDir);
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

  async execute(command, { cwd = null, timeoutMs = 120000 } = {}) {
    this.policy.assertCommandAllowed(command);
    const resolvedCwd = cwd ? this.policy.resolveSafe(cwd) : this.workspaceRoot;
    const clampedTimeout = this.policy.clampTimeout(timeoutMs);
    const release = this.policy.beginExecution();

    try {
      if (this.bus) {
        await this.bus.publish('terminal.started', {
          command: command.slice(0, 200),
          cwd: resolvedCwd
        });
      }

      const response = await fetch(`${this.localAgentUrl}/api/tools/terminal`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command, cwd: resolvedCwd }),
        signal: AbortSignal.timeout(clampedTimeout)
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { raw: text.slice(0, 4000) };
      }

      if (!response.ok) {
        throw Object.assign(
          new Error(`terminal failed: HTTP ${response.status}: ${text.slice(0, 400)}`),
          { statusCode: response.status }
        );
      }

      if (this.bus) {
        await this.bus.publish('terminal.completed', {
          command: command.slice(0, 200),
          code: result.code
        });
      }

      return {
        ok: true,
        command,
        cwd: resolvedCwd,
        timeoutMs: clampedTimeout,
        policy: this.policy.snapshot(),
        ...result
      };
    } finally {
      release();
    }
  }

  async produceAndRun({ path: relPath, content, command = null }) {
    const written = await this.writeFile(relPath, content);
    if (!command) return { written, execution: null };
    const execution = await this.execute(command);
    return { written, execution };
  }

  getPolicySnapshot() {
    return this.policy.snapshot();
  }
}

export default CodingAgent;
