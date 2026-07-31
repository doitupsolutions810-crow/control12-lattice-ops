/**
 * CodingQuorum – full loop: plan → engineer → code → terminal → verify
 *
 * Uses AgentSDK roles where available; coder path is local (CodingAgent).
 * Verifier step records evidence keys from terminal/write results only.
 */

export class CodingQuorum {
  constructor({ agents, coding, bus = null }) {
    this.agents = agents;
    this.coding = coding;
    this.bus = bus;
  }

  /**
   * @param {{
   *   goal: string,
   *   path?: string,
   *   content?: string,
   *   command?: string|null,
   *   skipRemoteAgents?: boolean
   * }}
   */
  async run({ goal, path = null, content = null, command = null, skipRemoteAgents = false }) {
    if (!goal || typeof goal !== 'string') {
      throw Object.assign(new Error('goal is required'), { statusCode: 400 });
    }

    const startedAt = new Date().toISOString();
    const results = [];
    const evidence = [];

    if (this.bus) {
      await this.bus.publish('coding-quorum.started', { goal: goal.slice(0, 200) });
    }

    // 1. Planner
    let plan = null;
    if (!skipRemoteAgents && this.agents) {
      try {
        plan = await this.agents.invoke('planner', goal, { includeEvidence: false, timeoutMs: 120000 });
        results.push({ role: 'planner', status: 'ok', result: plan });
        evidence.push({ key: 'planner.response', present: Boolean(plan) });
      } catch (error) {
        results.push({ role: 'planner', status: 'failed', error: error.message });
        evidence.push({ key: 'planner.response', present: false, error: error.message });
      }
    } else {
      plan = { status: 'skipped', note: 'remote planner skipped' };
      results.push({ role: 'planner', status: 'skipped' });
    }

    // 2. Engineer
    let engineer = null;
    if (!skipRemoteAgents && this.agents) {
      try {
        const msg = plan?.content
          ? `Goal: ${goal}\nPlan context: ${String(plan.content).slice(0, 1500)}`
          : goal;
        engineer = await this.agents.invoke('engineer', msg, { includeEvidence: false, timeoutMs: 120000 });
        results.push({ role: 'engineer', status: 'ok', result: engineer });
        evidence.push({ key: 'engineer.response', present: Boolean(engineer) });
      } catch (error) {
        results.push({ role: 'engineer', status: 'failed', error: error.message });
        evidence.push({ key: 'engineer.response', present: false, error: error.message });
      }
    } else {
      results.push({ role: 'engineer', status: 'skipped' });
    }

    // 3. Coder write / produce
    let codeResult = null;
    if (path != null && content != null) {
      try {
        if (command) {
          codeResult = await this.coding.produceAndRun({ path, content, command });
        } else {
          const written = await this.coding.writeFile(path, content);
          codeResult = { written, execution: null };
        }
        results.push({ role: 'coder', status: 'ok', result: codeResult });
        evidence.push({
          key: 'coder.write',
          present: true,
          path,
          bytes: codeResult.written?.bytes ?? null
        });
        if (codeResult.execution) {
          evidence.push({
            key: 'coder.terminal',
            present: true,
            exitCode: codeResult.execution.code ?? null
          });
        }
      } catch (error) {
        results.push({ role: 'coder', status: 'failed', error: error.message });
        evidence.push({ key: 'coder.write', present: false, error: error.message });
      }
    } else if (command) {
      try {
        const execution = await this.coding.execute(command);
        codeResult = { written: null, execution };
        results.push({ role: 'coder', status: 'ok', result: codeResult });
        evidence.push({
          key: 'coder.terminal',
          present: true,
          exitCode: execution.code ?? null
        });
      } catch (error) {
        results.push({ role: 'coder', status: 'failed', error: error.message });
        evidence.push({ key: 'coder.terminal', present: false, error: error.message });
      }
    } else {
      results.push({
        role: 'coder',
        status: 'skipped',
        note: 'provide path+content and/or command to exercise coder'
      });
    }

    // 4. Verifier (evidence-grounded summary; remote if available)
    const evidenceText = JSON.stringify(evidence);
    let verification = null;
    if (!skipRemoteAgents && this.agents) {
      try {
        const vmsg =
          `Verify coding quorum for goal: ${goal}\n` +
          `Use only this EVIDENCE JSON. Reject unsupported success claims.\n` +
          evidenceText;
        verification = await this.agents.invoke('verifier', vmsg, {
          includeEvidence: false,
          timeoutMs: 120000
        });
        results.push({ role: 'verifier', status: 'ok', result: verification });
      } catch (error) {
        results.push({ role: 'verifier', status: 'failed', error: error.message });
      }
    } else {
      // Local structural verification only
      const failed = evidence.filter(e => e.present === false);
      const terminalFail =
        codeResult?.execution &&
        codeResult.execution.code != null &&
        codeResult.execution.code !== 0;
      verification = {
        decision: failed.length || terminalFail ? 'NOT_READY' : codeResult ? 'READY' : 'UNKNOWN',
        evidence,
        failedGates: failed.map(e => e.key)
      };
      results.push({ role: 'verifier', status: 'local', result: verification });
    }

    const completedAt = new Date().toISOString();
    const summary = {
      status: 'CODING_QUORUM_COMPLETE',
      startedAt,
      completedAt,
      goal,
      evidence,
      results,
      verification
    };

    if (this.bus) {
      await this.bus.publish('coding-quorum.completed', {
        goal: goal.slice(0, 200),
        decision: verification?.decision || verification?.status || null
      });
    }

    return summary;
  }
}

export default CodingQuorum;
