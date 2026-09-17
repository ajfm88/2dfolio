import { WalkerEnemy } from './walker-enemy.js';

/**
 * Crabby — the sentry.
 *
 * Drawn face-on with a claw on each side: `attack` frame 0 throws both claws to
 * opposite edges of the 72x32 canvas at once, and the 118x24 `attack-effect` is
 * a single frame holding an outward chevron at each end. So Crabby has no facing
 * and no safe side — but the strike is horizontal, at body height, so its top is
 * never part of it. Jump over it, or stomp it.
 */
export class Crabby extends WalkerEnemy {
  /** Claws are out on frames 0-1 of the 4-frame clip — 0.2 s of 0.4 s. */
  static ACTIVE_FRAMES = 2;

  /**
   * @param {import('./walker-enemy.js').WorldHandle} world
   * @param {import('../../types.js').EntityRecord} rec
   * @param {import('./walker-enemy.js').WalkerEntry} entry
   */
  constructor(world, rec, entry) {
    super(world, rec, entry);
    this.effectClip = world.atlas.get(`${entry.clips}/attack-effect`);
    // Persistent: the widened damageBox during the active frames.
    /** @type {import('../../core/rect.js').Rect} */
    this.strike = { x: 0, y: 0, w: entry.strikeW ?? entry.hitboxW, h: entry.hitboxH };
  }

  /** @returns {boolean} */
  shouldAttack() {
    return this.playerNear(this.entry.senseRange);
  }

  onAttackStart() {
    // One symmetric frame covering both chevrons, so it needs no flip.
    const clip = this.effectClip;
    this.world.spawnFx(
      clip,
      this.hitbox.x + this.hitbox.w / 2 - clip.fw / 2,
      this.hitbox.y + this.hitbox.h / 2 - clip.fh / 2,
    );
  }

  /**
   * @param {number} _dt
   */
  onAttackStep(_dt) {
    if (this.frameIndex < Crabby.ACTIVE_FRAMES) {
      this.strike.x = this.hitbox.x + this.hitbox.w / 2 - this.strike.w / 2;
      this.strike.y = this.hitbox.y;
      this.damageBox = this.strike;
    } else {
      this.damageBox = this.hitbox;
    }
  }
}
