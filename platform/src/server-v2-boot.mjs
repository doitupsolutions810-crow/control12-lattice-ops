/**
 * Unified v2 boot helpers — federation, jacobian tune, cockpit actions.
 */

import { FederationHub } from './federation/digest-exchange.mjs';
import { JacobianTune } from './audio/jacobian-tune.mjs';
import { runCockpitAction } from './cockpit/actions.mjs';
import { seedBeliefField } from './graph/seed-belief-field.mjs';

export function bootV2({ config }) {
  const federation = new FederationHub({
    file: config.federationFile,
    label: process.env.CONTROL12_FEDERATION_LABEL || 'local'
  });
  const jacobianTune = new JacobianTune(config.jacobianTuneFile);
  return { federation, jacobianTune };
}

export function enhanceCodingQuorumOptions(opts, config) {
  return {
    ...opts,
    attestationDir: config.attestationDir
  };
}

export async function handleV2Routes(req, res, url, ctx) {
  const {
    readJson,
    requireAuth,
    sendJson,
    config,
    federation,
    jacobianTune,
    beliefGraph,
    resonant,
    buildSecurityStatus,
    accessLogPath,
    chatOpen,
    requireQuorum,
    tlsHandle,
    codingQuorum
  } = ctx;

  if (req.method === 'GET' && url.pathname === '/api/v1/federation/snapshot') {
    return sendJson(res, 200, await federation.snapshot());
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/jacobian/weights') {
    return sendJson(res, 200, await jacobianTune.getWeights());
  }

  // Mutating v2 routes expect requireAuth already applied by caller for POST,
  // except we enforce here for clarity when invoked before global POST auth.
  if (req.method === 'POST' && url.pathname === '/api/v1/federation/publish') {
    requireAuth(req, config.apiToken);
    const beliefSnapshot = beliefGraph.snapshot();
    const spectrum = resonant.getSpectrum();
    const security = await buildSecurityStatus({
      accessLogPath,
      chatOpen,
      requireQuorum,
      apiTokenConfigured: Boolean(config.apiToken)
    });
    const digest = FederationHub.buildDigest({
      beliefSnapshot,
      spectrum,
      securitySeverity: security.severity
    });
    return sendJson(res, 200, await federation.publish(digest));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/federation/ingest') {
    requireAuth(req, config.apiToken);
    const b = await readJson(req, config.maxBodyBytes);
    return sendJson(res, 200, await federation.ingestPeer(b.peerId, b.digest));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/jacobian/outcome') {
    requireAuth(req, config.apiToken);
    const b = await readJson(req, config.maxBodyBytes);
    return sendJson(res, 200, await jacobianTune.recordOutcome(b));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/cockpit/action') {
    requireAuth(req, config.apiToken);
    const b = await readJson(req, config.maxBodyBytes);
    const result = await runCockpitAction(b.action, b, {
      tlsHandle: tlsHandle?.current,
      beliefGraph,
      codingQuorum,
      federation,
      jacobianTune,
      resonant,
      buildSecurityStatus,
      accessLogPath,
      chatOpen,
      requireQuorum,
      apiTokenConfigured: Boolean(config.apiToken),
      seedBeliefField
    });
    return sendJson(res, 200, { action: b.action, result });
  }

  return false;
}
