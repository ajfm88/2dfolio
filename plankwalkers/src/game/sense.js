/**
 * Pure proximity tests shared by every hazard that reacts to the player.
 *
 * These are SPW enemies.py Shell.state_management's `near` / `front` / `level`
 * triple, extracted from WalkerEnemy now that the shooters are a second consumer.
 * Kept free of tuning and world references so both callers pass their own numbers
 * and the module is trivially testable.
 */

/** @typedef {import('../core/rect.js').Rect} Rect */

/**
 * @param {Rect} hitbox the sensing entity's hitbox
 * @param {Rect} playerHitbox
 * @param {number} range px, horizontal centre to centre
 * @param {number} height px, vertical centre to centre
 * @returns {boolean} within `range` horizontally and `height` vertically
 */
export function playerNear(hitbox, playerHitbox, range, height) {
  const dx = playerHitbox.x + playerHitbox.w / 2 - (hitbox.x + hitbox.w / 2);
  const dy = playerHitbox.y + playerHitbox.h / 2 - (hitbox.y + hitbox.h / 2);
  return Math.abs(dx) <= range && Math.abs(dy) <= height;
}

/**
 * @param {Rect} hitbox the sensing entity's hitbox
 * @param {Rect} playerHitbox
 * @param {number} dir the side the entity faces (1 right, -1 left)
 * @returns {boolean} the player is on the `dir` side
 */
export function playerInFront(hitbox, playerHitbox, dir) {
  return (playerHitbox.x + playerHitbox.w / 2 - (hitbox.x + hitbox.w / 2)) * dir > 0;
}
