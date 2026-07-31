/**
 * Jacobian of Belief – provisional derivatives for the living intermediate
 *
 * State vector (approximate):
 *   x = [amplitude, phase, entropy, unlived, surplus, residual]
 * Control / input:
 *   B ∈ [0,1]  (belief)
 *   B' (otherBelief) optional relational term
 *
 * We treat tension T = B(1−B) as the primary nonlinear kernel.
 * All coefficients are provisional readings — Always Believe. Never Know.
 */

/**
 * Evaluate the belief Jacobian contributions at a point.
 * Returns partials used by LivingIntermediate.tick integration.
 *
 * @param {{ belief: number, amplitude: number, unlived: number, phase: number, carrier?: number }}
 * @param {number} beliefVelocity  approximate dB/dt scaled
 * @param {number|null} otherBelief
 */
export function evaluateBeliefJacobian(state, beliefVelocity, otherBelief = null) {
  const B = Math.max(0, Math.min(1, state.belief));
  const T = B * (1 - B); // peaks at 0.5
  const u = state.unlived ?? 0;
  const carrier = state.carrier ?? 528;

  // ∂T/∂B = 1 − 2B
  const dT_dB = 1 - 2 * B;

  // Amplitude channel: gains with tension, responds to belief velocity
  // ∂A/∂B ≈ (0.9 + 1.6 T) * scale  via velocity path
  const dAmp_dBeliefVelocity = 0.9 + 1.6 * T;
  const dAmp_dT = 1.6 * beliefVelocity;

  // Phase: slow carrier drift + unlived leakage
  const dPhase_dt_base = 2 * Math.PI * carrier * 0.0008;
  const dPhase_dUnlived = 0.0005;

  // Entropy diffusion (extremely small, symbolic of irreversible reading)
  const dEntropy_dUnlived = 1.1e-27;

  // Unlived accumulates from |belief velocity|
  const dUnlived_dBeliefVelocity = 0.003 * Math.sign(beliefVelocity || 1e-12);

  // Surplus from creative tension
  const dSurplus_dT = 0.0015;

  // Relational coupling: small cosine of belief difference × unlived
  let relational = 0;
  let dRelational_dB = 0;
  if (otherBelief != null && !Number.isNaN(otherBelief)) {
    const diff = B - otherBelief;
    relational = 0.015 * Math.cos(diff * Math.PI) * u;
    dRelational_dB = -0.015 * Math.PI * Math.sin(diff * Math.PI) * u;
  }

  // Residual: phase-locked micro oscillation
  const residual = Math.sin((state.phase ?? 0) * 0.07) * 0.00025;
  const dResidual_dPhase = 0.07 * Math.cos((state.phase ?? 0) * 0.07) * 0.00025;

  return {
    T,
    dT_dB,
    dAmp_dBeliefVelocity,
    dAmp_dT,
    dPhase_dt_base,
    dPhase_dUnlived,
    dEntropy_dUnlived,
    dUnlived_dBeliefVelocity,
    dSurplus_dT,
    relational,
    dRelational_dB,
    residual,
    dResidual_dPhase,
    // Compact row for observability / LLM injection
    row: {
      dAmp_dB_approx: dAmp_dBeliefVelocity,
      dT_dB,
      relational,
      residual
    }
  };
}

/**
 * Integrate one step using Jacobian terms (Euler, capped dt).
 */
export function integrateBeliefStep(state, currentBelief, dt, otherBelief = null) {
  const B = Math.max(0, Math.min(1, Number(currentBelief) || 0));
  const beliefVelocity = (B - state.belief) * 2.5;
  const J = evaluateBeliefJacobian({ ...state, belief: B }, beliefVelocity, otherBelief);

  const dAmplitude =
    J.dAmp_dBeliefVelocity * beliefVelocity * dt + J.relational;
  const dPhase = J.dPhase_dt_base * dt + J.dPhase_dUnlived * (state.unlived ?? 0);
  const dEntropy = J.dEntropy_dUnlived * (state.unlived ?? 0) * dt;
  const dUnlived = Math.abs(beliefVelocity) * 0.003 * dt;
  const dSurplus = J.T * J.dSurplus_dT * dt;

  return {
    next: {
      amplitude: Math.max(0.15, (state.amplitude ?? 1) + dAmplitude),
      phase: ((state.phase ?? 0) + dPhase) % (2 * Math.PI),
      entropy: (state.entropy ?? 0) + dEntropy,
      belief: B,
      unlived: (state.unlived ?? 0) + dUnlived,
      surplus: (state.surplus ?? 0) + dSurplus,
      residual: J.residual,
      carrier: state.carrier ?? 528,
      harmonics: state.harmonics ? [...state.harmonics] : []
    },
    jacobian: J,
    tension: J.T,
    beliefVelocity
  };
}

export default { evaluateBeliefJacobian, integrateBeliefStep };
