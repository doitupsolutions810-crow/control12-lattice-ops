/**
 * Named workflow definitions. Quorum-first coding is the preferred write path.
 */

/**
 * Local coding quorum (no remote LLM agents) — write + optional command + local verify.
 */
export function codingQuorumLocal({ goal, path, content, command = null }) {
  return {
    name: 'coding-quorum-local',
    context: { goal },
    steps: [
      {
        type: 'coding-quorum',
        goal,
        path,
        content,
        command,
        skipRemoteAgents: true
      }
    ]
  };
}

/**
 * Full coding quorum including planner/engineer/verifier via local-agent when available.
 */
export function codingQuorumFull({ goal, path, content, command = null }) {
  return {
    name: 'coding-quorum-full',
    context: { goal },
    steps: [
      {
        type: 'coding-quorum',
        goal,
        path,
        content,
        command,
        skipRemoteAgents: false
      }
    ]
  };
}

/**
 * Resonate → quorum → artifact seal (payload must be provided by caller for artifact).
 */
export function resonateThenQuorum({ goal, path, content, command = null, artifactName = 'quorum-result' }) {
  return {
    name: 'resonate-then-quorum',
    context: { goal },
    steps: [
      {
        type: 'emit',
        topic: 'lattice.resonate',
        payload: { goal: String(goal).slice(0, 200) }
      },
      {
        type: 'coding-quorum',
        goal,
        path,
        content,
        command,
        skipRemoteAgents: true
      },
      {
        type: 'artifact',
        input: {
          name: artifactName,
          kind: 'coding-quorum',
          payload: { goal, path }
        }
      }
    ]
  };
}

export default { codingQuorumLocal, codingQuorumFull, resonateThenQuorum };
