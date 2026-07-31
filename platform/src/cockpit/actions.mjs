/**
 * Cockpit actions — single entry for operator UI / Avrone (path 2).
 */

export async function runCockpitAction(action, body, ctx) {
  const {
    tlsHandle,
    beliefGraph,
    codingQuorum,
    federation,
    jacobianTune,
    resonant,
    buildSecurityStatus,
    accessLogPath,
    chatOpen,
    requireQuorum,
    apiTokenConfigured,
    seedBeliefField
  } = ctx;

  switch (action) {
    case 'tls_reload': {
      if (!tlsHandle?.setSecureContextFromDisk) {
        throw Object.assign(new Error('TLS not enabled'), { statusCode: 400 });
      }
      return tlsHandle.setSecureContextFromDisk();
    }
    case 'mesh_seed': {
      if (seedBeliefField) return seedBeliefField(beliefGraph);
      beliefGraph.upsertNode('avrone', { belief: 0.55 });
      beliefGraph.upsertNode('operator', { belief: 0.5 });
      beliefGraph.link('avrone', 'operator', 1.5);
      return beliefGraph.tickAll();
    }
    case 'belief_tick':
      return beliefGraph.tickAll();
    case 'federation_publish': {
      const beliefSnapshot = beliefGraph.snapshot();
      const spectrum = resonant?.getSpectrum?.() || null;
      const security = await buildSecurityStatus({
        accessLogPath,
        chatOpen,
        requireQuorum,
        apiTokenConfigured
      });
      const digest = federation.constructor.buildDigest({
        beliefSnapshot,
        spectrum,
        securitySeverity: security.severity
      });
      return federation.publish(digest);
    }
    case 'quorum': {
      return codingQuorum.run({
        goal: body.goal || 'cockpit quorum',
        path: body.path ?? null,
        content: body.content ?? null,
        command: body.command ?? null,
        skipRemoteAgents: body.skipRemoteAgents !== false
      });
    }
    case 'jacobian_outcome': {
      return jacobianTune.recordOutcome({
        accepted: Boolean(body.accepted),
        tension: body.tension,
        belief: body.belief
      });
    }
    case 'security_status':
      return buildSecurityStatus({
        accessLogPath,
        chatOpen,
        requireQuorum,
        apiTokenConfigured
      });
    default:
      throw Object.assign(new Error(`unknown action: ${action}`), { statusCode: 400 });
  }
}

export default runCockpitAction;
