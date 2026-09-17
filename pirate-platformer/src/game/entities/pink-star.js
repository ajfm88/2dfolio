import { WalkerEnemy } from './walker-enemy.js';

/**
 * Pink Star — the anti-air turret.
 *
 * Its `attack` is four frames of the arms curled into a spinning pinwheel, so it
 * is the one enemy you should not be able to land on. It is also the only one
 * whose trigger is vertical: it spins up when the player is above it, and is
 * un-stompable for the whole spin. The counterplay is the 0.3 s `anticipation`
 * (long enough to steer away with full air control), stomping during `recover`,
 * or simply walking past it on the ground, which never sets it off.
 */
export class PinkStar extends WalkerEnemy {
  /** @returns {boolean} */
  shouldAttack() {
    const p = this.world.player.hitbox;
    const hb = this.hitbox;
    const range = this.entry.senseRange;

    if (Math.abs(p.x + p.w / 2 - (hb.x + hb.w / 2)) > range) return false;

    const gap = hb.y - (p.y + p.h);
    return gap >= 0 && gap <= range;
  }

  onAttackStart() {
    // The spin outlasts its clip, which simply wraps — a spin should loop.
    this.attackTime = this.entry.spinTime ?? this.attackTime;
    this.stompable = false;
  }

  onAttackEnd() {
    this.stompable = true;
  }
}
