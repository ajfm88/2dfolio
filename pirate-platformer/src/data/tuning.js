const gravity = 650;

/**
 * Physics and gameplay constants.
 * SPW values halved — our art is 32 px tiles vs their 64 px.
 * Timer durations in seconds (fixed timestep counts in seconds).
 *
 * Source: context/2-architecture.md § Physics Model,
 * ported from reference/super-pirate-world/code_complete/player.py.
 */
export const tuning = {
  runSpeed: 100,
  gravity,
  jumpVelocity: 450,
  maxFallSpeed: 400,
  wallSlideGravity: gravity / 10,
  coyoteTime: 0.09,
  jumpBuffer: 0.12,
  wallJumpLock: 0.4,
  wallSlideBlock: 0.25,
  dropThrough: 0.15,
  stompBounce: 300,
  hitInvuln: 0.7,
  invulnFlicker: 0.05,
  startHealth: 5,
  hazardDamage: 1,
  coinSilver: 1,
  coinGold: 5,
  coinDiamond: 20,
  coinSkull: 50,
  potionHeal: 1,
  coinExtraLife: 100,
};
