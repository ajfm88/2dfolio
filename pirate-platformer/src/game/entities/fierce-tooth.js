import { WalkerEnemy } from './walker-enemy.js';

/**
 * Fierce Tooth — the charger.
 *
 * The only one of the three drawn in profile: its opaque centroid sits at +0.5
 * while running but swings to -1.1 during `attack`, because the lunging head
 * carries the mass forward. `anticipation` opens the mouth over 3 frames, then
 * it commits. Afterwards it is stationary for a full second — that is the window
 * to stomp it.
 */
export class FierceTooth extends WalkerEnemy {
  /** @returns {boolean} */
  shouldAttack() {
    return this.playerNear(this.entry.senseRange) && this.playerInFront();
  }

  /** @returns {number} */
  attackVx() {
    return this.dir * (this.entry.lungeSpeed ?? this.entry.speed);
  }

  /**
   * The lunge is committed but it does not run off a ledge — "never walks off
   * the level" has to hold in every state, not just patrol.
   * @param {number} _dt
   */
  onAttackStep(_dt) {
    if (this.blockedAhead()) this.stateTimer = 0;
  }
}
