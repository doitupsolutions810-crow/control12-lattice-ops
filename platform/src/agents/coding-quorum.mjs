import { buildEvidenceRecord, assertEvidenceReady } from '../policy/evidence.mjs';
import { sealEvent } from '../attestation/seal.mjs';

export class CodingQuorum {
  constructor({ agents, coding, bus = null, attestationDir = null }) {
    this.agents = agents;
    this.coding = coding;
    this.bus = bus;
    this.attestationDir = attestationDir;
  }

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
      results.push({ role: 'planner', status: 'skipped' });
    }

    if (!skipRemoteAgents && this.agents) {
      try {
        const msg = plan?.content
          ? `Goal: ${goal}\nPlan context: ${String(plan.content).slice(0, 1500)}`
          : goal;
        const engineer = await this.agents.invoke('engineer', msg, { includeEvidence: false, timeoutMs: 120000 });
        results.push({ role: 'engineer', status: 'ok', result: engineer });
        evidence.push({ key: 'engineer.response', present: Boolean(engineer) });
      } catch (error) {
        results.push({ role: 'engineer', status: 'failed', error: error.message });
        evidence.push({ key: 'engineer.response', present: false, error: error.message });
      }
    } else {
      results.push({ role: 'engineer', status: 'skipped' });
    }

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
      results.push({ role: 'coder', status: 'skipped' });
    }

    let verification = null;
    if (!skipRemoteAgents && this.agents) {
      try {
        const vmsg =
          `Verify coding quorum for goal: ${goal}\n` +
          `Use only this EVIDENCE JSON. Reject unsupported success claims.\n` +
          JSON.stringify(evidence);
        verification = await this.agents.invoke('verifier', vmsg, {
          includeEvidence: false,
          timeoutMs: 120000
        });
        results.push({ role: 'verifier', status: 'ok', result: verification });
      } catch (error) {
        results.push({ role: 'verifier', status: 'failed', error: error.message });
      }
    } else {
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

    const evidenceRecord = buildEvidenceRecord({
      kind: 'coding-quorum',
      subject: goal.slice(0, 200),
      policyDecision: {
        requireQuorum: process.env.CONTROL12_CODE_REQUIRE_QUORUM === '1',
        decision: verification?.decision || null
      },
      tests: codeResult?.execution
        ? { exitCode: codeResult.execution.code ?? null, present: true }
        : null,
      digests: {
        writePath: path,
        evidenceKeys: evidence.map(e => e.key)
      },
      extra: { startedAt, verification }
    });

    const readiness = assertEvidenceReady(evidenceRecord, {
      requirePolicy: true,
      requireTests: Boolean(command)
    });

    let attestation = null;
    try {
      attestation = await sealEvent({
        kind: 'coding-quorum',
        payload: {
          goal: goal.slice(0, 200),
          decision: verification?.decision,
          evidenceDigest: evidenceRecord.recordDigest,
          readiness
        },
        outDir: this.attestationDir
      });
    } catch {
      /* non-fatal */
    }

    const summary = {
      status: 'CODING_QUORUM_COMPLETE',
      startedAt,
      completedAt: new Date().toISOString(),
      goal,
      evidence,
      results,
      verification,
      evidenceRecord,
      readiness,
      attestation
    };

    if (this.bus) {
      await this.bus.publish('coding-quorum.completed', {
        goal: goal.slice(0, 200),
        decision: verification?.decision || null,
        evidenceDigest: evidenceRecord.recordDigest
      });
    }

    return summary;
  }
}

export default CodingQuorum;
