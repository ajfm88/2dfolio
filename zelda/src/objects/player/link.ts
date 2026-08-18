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
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import { calculateDamage } from '../../core/damage-tables.js';
import { Action, type InputManager } from '../../core/input.js';
import { Direction, type Rect } from '../../core/types.js';
import type { OverworldScreen } from '../../data/overworld-types.js';
import type { Renderer } from '../../render/renderer.js';
import {
  type SpriteSheet,
  WalkAnimationController,
  directionToSpriteCol,
} from '../../render/sprite-renderer.js';
import type { TileCollisionMap } from '../../world/collision.js';
import { SwordSwing } from './sword.js';
import { SwordBeam } from './sword-beam.js';

export enum LinkState {
  Normal,
  Knockback,
  Invincible,
}

export interface LinkUpdateResult {
  readonly screenEdge: Direction | null;
}

const NO_EDGE: LinkUpdateResult = { screenEdge: null };

export class Link {
  private _x: number;
  private _y: number;
  private subPixel = 0;
  private _direction: Direction = Direction.Down;
  private _moving = false;
  private readonly walkAnim = new WalkAnimationController();
  private readonly sword = new SwordSwing();
  private _swordBeam: SwordBeam | null = null;
  private _health = 6;
  private _maxHealth = 6;
  private _hasSword = false;
  private _hasShield = true;
  private _hasMagicShield = false;

  // D4: damage system state
  private _state = LinkState.Normal;
  private _knockbackDir: Direction = Direction.Down;
  private _knockbackRemaining = 0;
  private _invincibilityTimer = 0; // ticks (decrements every 2 frames)
  private _invincibilityFrameCount = 0;
  private _ringLevel = 0; // 0=none, 1=blue, 2=red
  private _isDead = false;

  constructor(x: number = LINK_START_X, y: number = LINK_START_Y) {
    this._x = x;
    this._y = y;
  }

  get posX(): number {
    return this._x;
  }

  get posY(): number {
    return this._y;
  }

  get facing(): Direction {
    return this._direction;
  }

  get isMoving(): boolean {
    return this._moving;
  }

  get animStep(): number {
    return this.walkAnim.currentStep;
  }

  get isSwordActive(): boolean {
    return this.sword.isActive();
  }

  get isIdle(): boolean {
    return this._state === LinkState.Normal && !this.sword.isActive();
  }

  get hasShield(): boolean {
    return this._hasShield;
  }

  get hasMagicShield(): boolean {
    return this._hasMagicShield;
  }

  get activeSwordBeam(): SwordBeam | null {
    return this._swordBeam;
  }

  get health(): number {
    return this._health;
  }

  get maxHealth(): number {
    return this._maxHealth;
  }

  get state(): LinkState {
    return this._state;
  }

  get isInvincible(): boolean {
    return this._invincibilityTimer > 0;
  }

  // Z_01.asm Anim_WriteSpritePair: palette cycles via bottom 2 bits of timer
  // We toggle visibility — visible when (timer & 0x03) >= 2
  get isVisible(): boolean {
    if (this._invincibilityTimer <= 0) return true;
    return (this._invincibilityTimer & LINK_INVINCIBILITY_FLASH_MASK) >= 2;
  }

  get isDead(): boolean {
    return this._isDead;
  }

  get ringLevel(): number {
    return this._ringLevel;
  }

  setHealth(health: number, maxHealth: number): void {
    this._health = health;
    this._maxHealth = maxHealth;
  }

  setHasSword(has: boolean): void {
    this._hasSword = has;
  }

  setShield(has: boolean): void {
    this._hasShield = has;
  }

  setMagicShield(has: boolean): void {
    this._hasMagicShield = has;
  }

  setRingLevel(level: number): void {
    this._ringLevel = level;
  }

  setPosition(x: number, y: number): void {
    this._x = x;
    this._y = y;
  }

  setDirection(dir: Direction): void {
    this._direction = dir;
  }

  reset(x: number, y: number, direction: Direction, health: number): void {
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
  }

  // Z_01.asm HarmLink + BeginShove
  takeDamage(damageRaw: number, sourceDirection: Direction): void {
    if (this._invincibilityTimer > 0) return;
    if (this._isDead) return;

    const halfHearts = calculateDamage(damageRaw, this._ringLevel);
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
    input: InputManager,
    collision: TileCollisionMap,
    screen: OverworldScreen,
  ): LinkUpdateResult {
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
    if (this._hasSword && input.isJustPressed(Action.Attack) && !this.sword.isActive()) {
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
  private updateKnockback(collision: TileCollisionMap, screen: OverworldScreen): void {
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

  walkForward(): void {
    const pixels = this.computeQSpeedPixels();
    const delta = directionDelta(this._direction);
    this._x += delta.dx * pixels;
    this._y += delta.dy * pixels;
    this.walkAnim.tick();
  }

  tickAnimation(): void {
    this.walkAnim.tick();
  }

  render(
    renderer: Renderer,
    spriteSheet: SpriteSheet,
    offsetX = 0,
    offsetY = 0,
  ): void {
    if (!this.isVisible) return;

    const col = directionToSpriteCol(this._direction);
    let frameIndex: number;

    if (this.sword.isActive()) {
      frameIndex = LINK_ATTACK_FRAME_ROW * LINK_SHEET_COLUMNS + col;
    } else {
      frameIndex = this.walkAnim.currentStep * LINK_SHEET_COLUMNS + col;
    }

    spriteSheet.drawFrame(renderer, frameIndex, this._x + offsetX, this._y + offsetY);

    if (this.sword.isActive()) {
      this.sword.render(renderer, spriteSheet, this._x + offsetX, this._y + offsetY);
    }

    if (this._swordBeam) {
      this._swordBeam.render(renderer, spriteSheet);
    }
  }

  getCollisionRect(): Rect {
    return {
      x: this._x + LINK_HITBOX_OFFSET_X,
      y: this._y + LINK_HITBOX_OFFSET_Y,
      width: LINK_HITBOX_WIDTH,
      height: LINK_HITBOX_HEIGHT,
    };
  }

  // NES QSpeed accumulator: apply QSpeedFrac 4 times, count carry-outs
  private computeQSpeedPixels(): number {
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

  private snapPerpendicularAxis(
    collision: TileCollisionMap,
    screen: OverworldScreen,
  ): void {
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

function readInputDirection(input: InputManager): Direction | null {
  if (input.isHeld(Action.Up)) return Direction.Up;
  if (input.isHeld(Action.Down)) return Direction.Down;
  if (input.isHeld(Action.Left)) return Direction.Left;
  if (input.isHeld(Action.Right)) return Direction.Right;
  return null;
}

function directionDelta(dir: Direction): { dx: number; dy: number } {
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

function checkScreenEdge(x: number, y: number): Direction | null {
  if (x < SCREEN_EDGE_LEFT) return Direction.Left;
  if (x > SCREEN_EDGE_RIGHT) return Direction.Right;
  if (y < SCREEN_EDGE_TOP) return Direction.Up;
  if (y > SCREEN_EDGE_BOTTOM) return Direction.Down;
  return null;
}

function canMoveToPosition(
  x: number,
  y: number,
  collision: TileCollisionMap,
  screen: OverworldScreen,
): boolean {
  return collision.isRectWalkable(
    screen,
    x + LINK_HITBOX_OFFSET_X,
    y + LINK_HITBOX_OFFSET_Y,
    LINK_HITBOX_WIDTH,
    LINK_HITBOX_HEIGHT,
  );
}
