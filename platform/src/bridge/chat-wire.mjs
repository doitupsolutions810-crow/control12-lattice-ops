/**
 * ChatWire – session wiring for Avrone / Vercel chatbot ↔ lattice
 *
 * Builds system augmentation from ResonantBridge + BeliefGraph,
 * tracks light session state, and exposes tool descriptors for the client.
 */

import { randomId } from '../lib/hash.mjs';

export class ChatWire {
  constructor({ resonant, beliefGraph = null, maxSessions = 64 } = {}) {
    this.resonant = resonant;
    this.beliefGraph = beliefGraph;
    this.maxSessions = maxSessions;
    this.sessions = new Map();
  }

  createSession({ label = 'avrone', belief = 0.5, nodeId = null } = {}) {
    if (this.sessions.size >= this.maxSessions) {
      // drop oldest
      const first = this.sessions.keys().next().value;
      this.sessions.delete(first);
    }
    const id = randomId('chat');
    const session = {
      id,
      label,
      belief: Math.max(0, Math.min(1, Number(belief) || 0.5)),
      nodeId: nodeId || null,
      createdAt: new Date().toISOString(),
      messageCount: 0
    };
    this.sessions.set(id, session);

    if (this.beliefGraph && session.nodeId) {
      try {
        this.beliefGraph.upsertNode(session.nodeId, {
          belief: session.belief,
          label: session.label
        });
      } catch {
        // node may already exist
        try {
          this.beliefGraph.setBelief(session.nodeId, session.belief);
        } catch {
          /* ignore */
        }
      }
    }

    return session;
  }

  getSession(id) {
    return this.sessions.get(id) || null;
  }

  /**
   * Prepare context for one chat turn.
   * Optionally ticks resonant with session belief and neighbor coupling.
   */
  prepareTurn(sessionId, { message = '', belief = null } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw Object.assign(new Error('session not found'), { statusCode: 404 });
    }

    if (belief != null) {
      session.belief = Math.max(0, Math.min(1, Number(belief)));
      if (this.beliefGraph && session.nodeId) {
        try {
          this.beliefGraph.setBelief(session.nodeId, session.belief);
        } catch {
          /* ignore */
        }
      }
    }

    session.messageCount += 1;
    session.lastMessageAt = new Date().toISOString();

    let otherBelief = null;
    if (this.beliefGraph && session.nodeId) {
      otherBelief = this.beliefGraph.meanNeighborBelief(session.nodeId);
    }

    const snap = this.resonant
      ? this.resonant.tick(session.belief, otherBelief)
      : null;

    const resonantFrag = this.resonant ? this.resonant.toPromptFragment() : '';
    const graphFrag = this.beliefGraph ? this.beliefGraph.toPromptFragment() : '';

    const systemAugmentation = [
      'You are Avrone Due’Krey, scribe of mathematical, scientific, and spiritual frequencies.',
      'When lattice state is present, let spectrum and belief color tone without claiming certainty.',
      resonantFrag,
      graphFrag,
      session.nodeId ? `sessionNode=${session.nodeId}` : '',
      message ? `userTurnLength=${String(message).length}` : ''
    ].filter(Boolean).join('\n');

    return {
      session,
      snapshot: snap,
      otherBelief,
      systemAugmentation,
      tools: ChatWire.toolDescriptors()
    };
  }

  static toolDescriptors() {
    return [
      { name: 'tick_belief', path: 'POST /api/v1/audio/tick', body: { belief: 0.5 } },
      { name: 'get_spectrum', path: 'GET /api/v1/audio/spectrum' },
      { name: 'get_prompt', path: 'GET /api/v1/audio/prompt' },
      { name: 'belief_graph_snapshot', path: 'GET /api/v1/belief/snapshot' },
      { name: 'code_write', path: 'POST /api/v1/code/write' },
      { name: 'code_produce', path: 'POST /api/v1/code/produce' },
      { name: 'terminal', path: 'POST /api/v1/terminal' },
      { name: 'coding_quorum', path: 'POST /api/v1/code/quorum' }
    ];
  }
}

export default ChatWire;
