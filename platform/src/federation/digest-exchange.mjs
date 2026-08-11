/**
 * Federated lattice digests — exchange belief/spectrum summaries only (no workspace).
 */

import crypto from 'node:crypto';
import { JsonStore } from '../lib/json-store.mjs';

export class FederationHub {
  constructor({ file, label = 'local' }) {
    this.label = label;
    this.store = new JsonStore(file, {
      schema: 'control12.federation/v1',
      peers: {},
      lastPublished: null
    });
  }

  /**
   * Build a shareable digest from local lattice snapshots.
   */
  static buildDigest({ beliefSnapshot, spectrum, securitySeverity }) {
    const payload = {
      v: 1,
      at: new Date().toISOString(),
      meanBelief: beliefSnapshot?.meanBelief ?? null,
      nodeCount: beliefSnapshot?.nodes?.length ?? 0,
      nodes: (beliefSnapshot?.nodes || []).slice(0, 12).map(n => ({
        id: n.id,
        belief: Number(n.belief?.toFixed?.(4) ?? n.belief)
      })),
      spectrumTop: (spectrum?.partials || spectrum?.bins || []).slice?.(0, 6) || null,
      securitySeverity: securitySeverity || null
    };
    const body = JSON.stringify(payload);
    const digest = crypto.createHash('sha256').update(body).digest('hex');
    return { ...payload, digest };
  }

  async publish(localDigest) {
    return this.store.update(s => {
      s.lastPublished = { ...localDigest, label: this.label };
      return s;
    }).then(s => s.lastPublished);
  }

  async ingestPeer(peerId, remoteDigest) {
    if (!peerId || !remoteDigest?.digest) {
      throw Object.assign(new Error('peerId and digest required'), { statusCode: 400 });
    }
    return this.store.update(s => {
      s.peers[peerId] = {
        ...remoteDigest,
        ingestedAt: new Date().toISOString()
      };
      return s;
    }).then(s => s.peers[peerId]);
  }

  async snapshot() {
    return this.store.read();
  }
}

export default FederationHub;
