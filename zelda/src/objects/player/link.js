import {
  LINK_ATTACK_FRAME_ROW,
  LINK_HITBOX_HEIGHT,
  LINK_HITBOX_OFFSET_X,
  LINK_HITBOX_OFFSET_Y,
  LINK_HITBOX_WIDTH,
  LINK_GRID_SIZE,
  LINK_INVINCIBILITY_FLASH_MASK,
  LINK_INVINCIBILITY_TICKS,
  LINK_KNOCKBACK_DISTANCE,
  LINK_KNOCKBACK_SPEED,
  LINK_SHEET_COLUMNS,
  LINK_SPEED_QFRAC,
  LINK_START_X,
  LINK_START_Y,
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP
} from '../../core/constants.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import { calculateDamage } from '../../core/damage-tables.js';
import { Action } from '../../core/input.js';
import { Direction } from '../../core/types.js';

import {

  WalkAnimationController,
  directionToSpriteCol
} from '../../render/sprite-renderer.js';

import { Inventory } from './inventory.js';
import { SwordSwing } from './sword.js';
import { SwordBeam } from './sword-beam.js';

export const LinkState = Object.freeze({
  Normal: 0,
  Knockback: 1,
  Invincible: 2
});

const NO_EDGE = { screenEdge: null };

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export class Link {
   _x;
   _y;
   subPixel = 0;
   _direction = Direction.Down;
   _moving = false;
    walkAnim = new WalkAnimationController();
    sword = new SwordSwing();
   _swordBeam = null;
   _health = 6;
   _maxHealth = 6;
   _rupees = 0;
   _keys = 0;
   _bombs = 0;
   _maxBombs = 8;

   inventory = new Inventory();

  // D4: damage system state
   _state = LinkState.Normal;
   _knockbackDir = Direction.Down;
   _knockbackRemaining = 0;
   _invincibilityTimer = 0; // ticks (decrements every 2 frames)
   _invincibilityFrameCount = 0;
   _isDead = false;

  // External flag: rod swing blocks sword (they share NES animation slot)
  blockSwordAttack = false;

  // Bubble sword-jinx — Z_04.asm UpdateBubble (SwordBlocked / SwordBlockedLongTimer)
   _swordJinxTimer = 0;      // temporary block (frames); 0 = none
   _swordJinxPermanent = false; // held until a blue Bubble restores it

  // External halt flag — NES ObjState $40. Blocks all input/movement while visible.
   _halted = false;

  // Debug cheat (__zelda.godMode) — short-circuits takeDamage. Never set in play.
   _godMode = false;

  constructor(x = LINK_START_X, y = LINK_START_Y) {
    this._x = x;
    this._y = y;
  }

  get posX() {
    return this._x;
  }

  get posY() {
    return this._y;
  }

  get facing() {
    return this._direction;
  }

  get isMoving() {
    return this._moving;
  }

  get animStep() {
    return this.walkAnim.currentStep;
  }

  get isSwordActive() {
    return this.sword.isActive();
  }

  get isIdle() {
    return this._state === LinkState.Normal && !this.sword.isActive();
  }

  get hasSword() {
    return this.inventory.sword > 0;
  }

  get hasShield() {
    return true; // small shield always available
  }

  get hasMagicShield() {
    return this.inventory.magicShield;
  }

  get hasBracelet() {
    return this.inventory.bracelet;
  }

  get activeSwordBeam() {
    return this._swordBeam;
  }

  get health() {
    return this._health;
  }

  get maxHealth() {
    return this._maxHealth;
  }

  get state() {
    return this._state;
  }

  get isInvincible() {
    return this._invincibilityTimer > 0;
  }

  // Z_01.asm Anim_WriteSpritePair: palette cycles via bottom 2 bits of timer
  // We toggle visibility — visible when (timer & 0x03) >= 2
  get isVisible() {
    if (this._invincibilityTimer <= 0) return true;
    return (this._invincibilityTimer & LINK_INVINCIBILITY_FLASH_MASK) >= 2;
  }

  get isDead() {
    return this._isDead;
  }

  get ringLevel() {
    return this.inventory.ring;
  }

  get halted() {
    return this._halted;
  }

  set halted(value) {
    this._halted = value;
  }

  // Bubble jinx: no `frames` = permanent (until a blue Bubble), else temporary.
  disableSword(frames) {
    if (frames === undefined) {
      this._swordJinxPermanent = true;
    } else {
      this._swordJinxTimer = Math.max(this._swordJinxTimer, frames);
    }
  }

  enableSword() {
    this._swordJinxTimer = 0;
    this._swordJinxPermanent = false;
  }

  get swordDisabled() {
    return this._swordJinxPermanent || this._swordJinxTimer > 0;
  }

  setHealth(health, maxHealth) {
    this._health = health;
    this._maxHealth = maxHealth;
  }

  setHasSword(has) {
    if (has && this.inventory.sword === 0) {
      this.inventory.sword = 1;
    }
  }

  setSwordLevel(level) {
    this.inventory.sword = Math.max(this.inventory.sword, level);
  }

  setShield(_has) {
    // small shield always available — no-op for backward compat
  }

  setMagicShield(has) {
    this.inventory.magicShield = has;
  }

  setBracelet(has) {
    this.inventory.bracelet = has;
  }

  setRingLevel(level) {
    this.inventory.ring = Math.max(this.inventory.ring, level);
  }

  get rupees() {
    return this._rupees;
  }

  get keys() {
    return this._keys;
  }

  get bombs() {
    return this._bombs;
  }

  addRupees(amount) {
    this._rupees = Math.min(999, Math.max(0, this._rupees + amount));
  }

  spendRupees(amount) {
    if (this._rupees < amount) return false;
    this._rupees -= amount;
    return true;
  }

  addKeys(amount) {
    this._keys = Math.min(255, Math.max(0, this._keys + amount));
  }

  addBombs(amount) {
    this._bombs = Math.min(this._maxBombs, Math.max(0, this._bombs + amount));
    if (this._bombs > 0) this.inventory.hasBombs = true;
  }

  setMaxBombs(max) {
    this._maxBombs = max;
  }

  addHeartContainer() {
    this._maxHealth = Math.min(32, this._maxHealth + 2); // +1 container = +2 half-hearts
    this._health = this._maxHealth;
  }

  heal(halfHearts) {
    this._health = Math.min(this._maxHealth, this._health + halfHearts);
  }

  get godMode() {
    return this._godMode;
  }

  /** Debug cheat toggle. Returns the new state so the console prints something useful. */
  toggleGodMode() {
    this._godMode = !this._godMode;
    return this._godMode;
  }

  /**
   * Counters the save file persists (L1). Current health is deliberately absent —
   * loading a file always restarts Link on 3 hearts (Z_07.asm:1442 InitMode3_Sub1),
   * so only the *max* carries over.
   */
  snapshotStats() {
    return {
      maxHealth: this._maxHealth,
      rupees: this._rupees,
      keys: this._keys,
      bombs: this._bombs,
      maxBombs: this._maxBombs
    };
  }

  /** Apply a saved snapshot. Clamped the same way the add* mutators are. */
  restoreStats(stats) {
    this._maxHealth = clamp(stats.maxHealth, 2, 32);
    this._maxBombs = clamp(stats.maxBombs, 0, 99);
    this._rupees = clamp(stats.rupees, 0, 999);
    this._keys = clamp(stats.keys, 0, 255);
    this._bombs = clamp(stats.bombs, 0, this._maxBombs);
    if (this._health > this._maxHealth) this._health = this._maxHealth;
  }

  setPosition(x, y) {
    this._x = x;
    this._y = y;
  }

  setDirection(dir) {
    this._direction = dir;
  }

  reset(x, y, direction, health) {
    this._x = x;
    this._y = y;
    this._direction = direction;
    this._health = health;
    this._isDead = false;
    this._state = LinkState.Normal;
    this._knockbackDir = Direction.Down;
    this._knockbackRemaining = 0;
    this._invincibilityTimer = 0;
    this._invincibilityFrameCount = 0;
    this._moving = false;
    this.walkAnim.reset();
    this.subPixel = 0;
    if (this.sword.isActive()) {
      this.sword.cancel();
    }
    this._swordBeam = null;
    this._halted = false;
    this._swordJinxTimer = 0;
    this._swordJinxPermanent = false;
  }

  // Z_01.asm HarmLink + BeginShove
  takeDamage(damageRaw, sourceDirection) {
    if (this._godMode) return; // debug cheat — no damage, no knockback
    if (this._invincibilityTimer > 0) return;
    if (this._isDead) return;

    const halfHearts = calculateDamage(damageRaw, this.inventory.ring);
    this._health = Math.max(0, this._health - halfHearts);

    if (this._health <= 0) {
      this._isDead = true;
    }

    this._state = LinkState.Knockback;
    this._knockbackDir = getOppositeDirection(sourceDirection);
    this._knockbackRemaining = LINK_KNOCKBACK_DISTANCE;
    this._invincibilityTimer = LINK_INVINCIBILITY_TICKS;
    this._invincibilityFrameCount = 0;

    if (this.sword.isActive()) {
      this.sword.cancel();
    }
    this._swordBeam = null;
    this._moving = false;
    this.walkAnim.reset();
    this.subPixel = 0;
  }

  update(
    input,
    collision,
    screen,
  ) {
    // Update sword beam independently
    if (this._swordBeam) {
      this._swordBeam.update(collision, screen);
      if (!this._swordBeam.isActive()) {
        this._swordBeam = null;
      }
    }

    // Z_07.asm DecrementInvincibilityTimer: decrement every 2 frames
    if (this._invincibilityTimer > 0) {
      this._invincibilityFrameCount++;
      if (this._invincibilityFrameCount >= 2) {
        this._invincibilityFrameCount = 0;
        this._invincibilityTimer--;
      }
    }

    if (this._swordJinxTimer > 0) this._swordJinxTimer--;

    // NES ObjState $40 — external halt blocks all input/movement
    if (this._halted) return NO_EDGE;

    // Knockback state: move in knockback direction, block all input
    if (this._state === LinkState.Knockback) {
      this.updateKnockback(collision, screen);
      return NO_EDGE;
    }

    // Invincible state: check if timer expired
    if (this._state === LinkState.Invincible) {
      if (this._invincibilityTimer <= 0) {
        this._state = LinkState.Normal;
      }
      // Fall through to normal input handling
    }

    if (this._isDead) return NO_EDGE;

    // Handle sword swing
    if (this.sword.isActive()) {
      this._moving = false;
      const result = this.sword.update();
      if (result.shouldFireBeam && this._health >= this._maxHealth && !this._swordBeam) {
        const swordPos = this.sword.getSwordPosition(this._x, this._y);
        if (swordPos) {
          this._swordBeam = new SwordBeam(swordPos.x, swordPos.y, this._direction);
        }
      }
      return NO_EDGE;
    }

    // Start sword swing on attack input
    if (this.hasSword && input.isJustPressed(Action.Attack) && !this.sword.isActive() && !this.blockSwordAttack && !this.swordDisabled) {
      this.sword.start(this._direction);
      this._moving = false;
      this.walkAnim.reset();
      this.subPixel = 0;
      return NO_EDGE;
    }

    // Normal movement
    const dir = readInputDirection(input);
    if (dir === null) {
      this._moving = false;
      this.walkAnim.reset();
      this.subPixel = 0;
      return NO_EDGE;
    }

    this._direction = dir;
    this._moving = true;

    const pixels = this.computeQSpeedPixels();
    const delta = directionDelta(dir);

    for (let i = 0; i < pixels; i++) {
      const nx = this._x + delta.dx;
      const ny = this._y + delta.dy;

      const edge = checkScreenEdge(nx, ny);
      if (edge !== null) {
        this._x = nx;
        this._y = ny;
        return { screenEdge: edge };
      }

      if (!canMoveToPosition(nx, ny, collision, screen)) {
        this._moving = false;
        break;
      }

      this._x = nx;
      this._y = ny;
    }

    if (this._moving) {
      this.snapPerpendicularAxis(collision, screen);
      this.walkAnim.tick();
    } else {
      this.walkAnim.reset();
      this.subPixel = 0;
    }

    return NO_EDGE;
  }

  // Z_07.asm Obj_Shove / ShoveMoveMin: 4 pixels per frame, collision-checked
   updateKnockback(collision, screen) {
    const delta = directionDelta(this._knockbackDir);
    let moved = 0;

    for (let i = 0; i < LINK_KNOCKBACK_SPEED; i++) {
      if (this._knockbackRemaining <= 0) break;

      const nx = this._x + delta.dx;
      const ny = this._y + delta.dy;

      // Stop on screen boundary
      if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT ||
          ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
        this._knockbackRemaining = 0;
        break;
      }

      // Stop on blocked tile
      if (!canMoveToPosition(nx, ny, collision, screen)) {
        this._knockbackRemaining = 0;
        break;
      }

      this._x = nx;
      this._y = ny;
      this._knockbackRemaining--;
      moved++;
    }

    if (this._knockbackRemaining <= 0) {
      this._state = this._invincibilityTimer > 0
        ? LinkState.Invincible
        : LinkState.Normal;
    }
  }

  walkForward() {
    const pixels = this.computeQSpeedPixels();
    const delta = directionDelta(this._direction);
    this._x += delta.dx * pixels;
    this._y += delta.dy * pixels;
    this.walkAnim.tick();
  }

  tickAnimation() {
    this.walkAnim.tick();
  }

  render(
    renderer,
    spriteSheet,
    offsetX = 0,
    offsetY = 0,
  ) {
    if (!this.isVisible) return;

    const col = directionToSpriteCol(this._direction);
    let frameIndex;

    if (this.sword.isActive()) {
      frameIndex = LINK_ATTACK_FRAME_ROW * LINK_SHEET_COLUMNS + col;
    } else {
      frameIndex = this.walkAnim.currentStep * LINK_SHEET_COLUMNS + col;
    }

    const swordActive = this.sword.isActive();
    if (swordActive && this._direction === Direction.Up) {
      this.sword.render(renderer, spriteSheet, this._x + offsetX, this._y + offsetY);
    }

    spriteSheet.drawFrame(renderer, frameIndex, this._x + offsetX, this._y + offsetY);

    if (swordActive && this._direction !== Direction.Up) {
      this.sword.render(renderer, spriteSheet, this._x + offsetX, this._y + offsetY);
    }

    if (this._swordBeam) {
      this._swordBeam.render(renderer, spriteSheet);
    }
  }

  getCollisionRect() {
    return {
      x: this._x + LINK_HITBOX_OFFSET_X,
      y: this._y + LINK_HITBOX_OFFSET_Y,
      width: LINK_HITBOX_WIDTH,
      height: LINK_HITBOX_HEIGHT
    };
  }

  getSwordHitbox() {
    if (!this.sword.isActive()) return null;
    return this.sword.getHitbox(this._x, this._y);
  }

  get swordDirection() {
    return this.sword.direction;
  }

  // NES QSpeed accumulator: apply QSpeedFrac 4 times, count carry-outs
   computeQSpeedPixels() {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      this.subPixel += LINK_SPEED_QFRAC;
      if (this.subPixel >= 256) {
        this.subPixel -= 256;
        pixels++;
      }
    }
    return pixels;
  }

   snapPerpendicularAxis(
    collision,
    screen,
  ) {
    const isHoriz =
      this._direction === Direction.Left ||
      this._direction === Direction.Right;
    const pos = isHoriz ? this._y : this._x;
    const gridMod = ((pos % LINK_GRID_SIZE) + LINK_GRID_SIZE) % LINK_GRID_SIZE;

    if (gridMod === 0) return;

    const SNAP_THRESHOLD = 3;

    if (gridMod <= SNAP_THRESHOLD) {
      const tx = isHoriz ? this._x : this._x - 1;
      const ty = isHoriz ? this._y - 1 : this._y;
      if (canMoveToPosition(tx, ty, collision, screen)) {
        if (isHoriz) this._y--;
        else this._x--;
      }
    } else if (gridMod >= LINK_GRID_SIZE - SNAP_THRESHOLD) {
      const tx = isHoriz ? this._x : this._x + 1;
      const ty = isHoriz ? this._y + 1 : this._y;
      if (canMoveToPosition(tx, ty, collision, screen)) {
        if (isHoriz) this._y++;
        else this._x++;
      }
    }
  }
}

function readInputDirection(input) {
  if (input.isHeld(Action.Up)) return Direction.Up;
  if (input.isHeld(Action.Down)) return Direction.Down;
  if (input.isHeld(Action.Left)) return Direction.Left;
  if (input.isHeld(Action.Right)) return Direction.Right;
  return null;
}

function directionDelta(dir) {
  switch (dir) {
    case Direction.Up:
      return { dx: 0, dy: -1 };
    case Direction.Down:
      return { dx: 0, dy: 1 };
    case Direction.Left:
      return { dx: -1, dy: 0 };
    case Direction.Right:
      return { dx: 1, dy: 0 };
  }
}

function checkScreenEdge(x, y) {
  if (x < SCREEN_EDGE_LEFT) return Direction.Left;
  if (x > SCREEN_EDGE_RIGHT) return Direction.Right;
  if (y < SCREEN_EDGE_TOP) return Direction.Up;
  if (y > SCREEN_EDGE_BOTTOM) return Direction.Down;
  return null;
}

function canMoveToPosition(
  x,
  y,
  collision,
  screen,
) {
  return collision.isRectWalkable(
    screen,
    x + LINK_HITBOX_OFFSET_X,
    y + LINK_HITBOX_OFFSET_Y,
    LINK_HITBOX_WIDTH,
    LINK_HITBOX_HEIGHT,
  );
}
