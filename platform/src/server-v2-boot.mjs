/**
 * Unified v2 boot helpers — federation, jacobian tune, coding quorum seals.
 */

import path from 'node:path';
import { FederationHub } from './federation/digest-exchange.mjs';
import { JacobianTune } from './audio/jacobian-tune.mjs';
import { runCockpitAction } from './cockpit/actions.mjs';
import { seedBeliefField } from './graph/seed-belief-field.mjs';

export function bootV2({ config, bus }) {
  const federation = new FederationHub({
    file: config.federationFile,
    label: process.env.CONTROL12_FEDERATION_LABEL || 'local'
  });
  const jacobianTune = new JacobianTune(config.jacobianTuneFile);
  return { federation, jacobianTune, runCockpitAction, seedBeliefField };
}

export function enhanceCodingQuorumOptions(opts, config) {
  return {
    ...opts,
    attestationDir: config.attestationDir
  };
}

export async function handleV2Routes(req, res, url, body, ctx) {
  const { readJson, requireAuth, sendJson, config, maxBodyBytes } = ctx;

  if (req.method === 'GET' && url.pathname === '/api/v1/federation/snapshot') {
    return sendJson(res, 200, await ctx.federation.snapshot());
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/jacobian/weights') {
    return sendJson(res, 200, await ctx.jacobianTune.getWeights());
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/federation/publish') {
    requireAuth(req, config.apiToken);
    const beliefSnapshot = ctx.beliefGraph.snapshot();
    const spectrum = ctx.resonant.getSpectrum();
    const security = await ctx.buildSecurityStatus({
      accessLogPath: ctx.accessLogPath,
      chatOpen: ctx.chatOpen,
      requireQuorum: ctx.requireQuorum,
      apiTokenConfigured: Boolean(config.apiToken)
    });
    const digest = FederationHub.buildDigest({
      beliefSnapshot,
      spectrum,
      securitySeverity: security.severity
    });
    return sendJson(res, 200, await ctx.federation.publish(digest));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/federation/ingest') {
    requireAuth(req, config.apiToken);
    const b = body || (await readJson(req, maxBodyBytes));
    return sendJson(res, 200, await ctx.federation.ingestPeer(b.peerId, b.digest));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/jacobian/outcome') {
    requireAuth(req, config.apiToken);
    const b = body || (await readJson(req, maxBodyBytes));
    return sendJson(res, 200, await ctx.jacobianTune.recordOutcome(b));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/cockpit/action') {
    requireAuth(req, config.apiToken);
    const b = body || (await readJson(req, maxBodyBytes));
    const result = await runCockpitAction(b.action, b, {
      tlsHandle: ctx.tlsHandle?.current,
      beliefGraph: ctx.beliefGraph,
      codingQuorum: ctx.codingQuorum,
      federation: ctx.federation,
      jacobianTune: ctx.jacobianTune,
      resonant: ctx.resonant,
      buildSecurityStatus: ctx.buildSecurityStatus,
      accessLogPath: ctx.accessLogPath,
      chatOpen: ctx.chatOpen,
      requireQuorum: ctx.requireQuorum,
      apiTokenConfigured: Boolean(config.apiToken),
      seedBeliefField
    });
    return sendJson(res, 200, { action: b.action, result });
  }

  return null;
}

import { FederationHub } from './federation/digest-exchange.mjs';
