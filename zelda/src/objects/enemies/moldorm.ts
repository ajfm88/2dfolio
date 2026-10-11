// Moldorm ($41) — the segmented worm of Levels 2 and 7.
// Z_04.asm: InitMoldorm (4771), UpdateMoldorm (4913), ControlMoldormFlight (5004),
//           Moldorm_Chase / Moldorm_Wander / Moldorm_PropagateDirs (5014-5134),
//           Flyer_MoldormDecideState (5136); shared flyer code MoveFlyer (11560),
//           BoundFlyer / DeferBounce (11619), Flyer_Chase (11674), Flyer_Wander (11813).
//
// One spawn makes TWO worms of five segments (object slots 1-5 and 6-10, heads in
// slots 5 and $A). Every segment is its own monster with its own HP and flies over
// walls in one of 8 directions at a fixed 1px every other frame. Only the head
// steers; every $10 frames each segment takes the direction the segment ahead of
// it had $10 frames earlier, so the body traces the head's path 8px apart.
//
// Killing a segment shortens the worm from the TAIL: the tail dies at the struck
// segment's position and the struck segment comes back with $20 HP. The head only
// dies once it is the last segment left.

import { ENEMY_INVINCIBILITY_FRAMES } from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawDungeonEnemySprite, MOLDORM_SPRITE } from '../../render/enemy-sprite-data.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';
import { DIRECTIONS8, dir8At, dir8Index, turnTowardsTarget8, turnRandomly8 } from './dir8.js';

export const MOLDORM = 0x41;

export const MOLDORM_SEGMENTS_PER_WORM = 5;

// NES coords → play-area-local: objects subtract the $40 status bar (same as
// dungeon-statues.ts); Link's posY is NES ObjY - $3D.
const NES_OBJ_Y_OFFSET = 0x40;
const NES_LINK_Y_OFFSET = 0x3d;

// InitMoldorm: every segment starts at ($80, $70).
export const MOLDORM_START_X = 0x80;
export const MOLDORM_START_Y = 0x70 - NES_OBJ_Y_OFFSET;

// Z_05.asm:6442 ObjectRoomBoundsUW — left, right, up, down for objects.
const BOUND_LEFT = 0x21;
const BOUND_RIGHT = 0xd0;
const BOUND_UP = 0x5e - NES_OBJ_Y_OFFSET;
const BOUND_DOWN = 0xbd - NES_OBJ_Y_OFFSET;

// InitMoldorm: Flyer_ObjSpeed $80; MoveFlyer adds (speed & $E0) to a fraction.
const FLY_SPEED = 0x80;
const TURN_DELAY = 0x10;
const TURNS_PER_STATE = 8;
// UpdateMoldorm: the struck segment's slot is refilled with $20 HP.
const REVIVE_HP = 0x20;

const FLY_CHASE = 2;
const FLY_WANDER = 3;

// Keep the original exports for existing callers/tests; implementations are shared.
export { DIRECTIONS8, dir8Index, turnTowardsTarget8, turnRandomly8 } from './dir8.js';
const DIR_RIGHT = 0x01;
const DIR_LEFT = 0x02;
const DIR_DOWN = 0x04;
const DIR_UP = 0x08;

function random8(): number {
  return Math.floor(Math.random() * 256);
}

function toCardinal(dir: number): Direction {
  if (dir & DIR_LEFT) return Direction.Left;
  if (dir & DIR_RIGHT) return Direction.Right;
  if (dir & DIR_UP) return Direction.Up;
  return Direction.Down;
}

/** One worm: five fixed slots, index 0 = tail … 4 = head, like NES slots 1-5. */
export class MoldormChain {
  readonly slots: MoldormSegment[] = [];

  get head(): MoldormSegment {
    return this.slots[MOLDORM_SEGMENTS_PER_WORM - 1]!;
  }

  get liveCount(): number {
    return this.slots.filter((s) => s.isActive).length;
  }

  /**
   * Moldorm_PropagateDirs, after the head re-armed its timer: each segment takes
   * the old direction of the one above it (dead slots included, as on the NES),
   * then the head remembers its current direction for next time.
   */
  propagate(): void {
    for (let i = 0; i < MOLDORM_SEGMENTS_PER_WORM - 1; i++) {
      const below = this.slots[i]!;
      below.oldDir = this.slots[i + 1]!.oldDir;
      below.dir8 = below.oldDir;
    }
    this.head.oldDir = this.head.dir8;
  }

  /**
   * UpdateMoldorm death swap: the lowest live slot (the tail) dies where the
   * struck segment was, and the struck one is revived. If the tail found is the
   * head, it was the last segment — it simply dies.
   */
  onSegmentKilled(struck: MoldormSegment): void {
    const tail = this.slots.find((s) => s.isActive);
    if (!tail || tail === this.head) {
      struck.die();
      return;
    }
    tail.moveTo(struck.x, struck.y);
    tail.die();
    if (tail !== struck) struck.revive(REVIVE_HP);
  }
}

export class MoldormSegment extends Enemy {
  /** NES 8-way direction bits; 0 = not yet moving (hidden, intangible). */
  dir8 = 0;
  /** Moldorm_ObjOldDir — the direction handed down on the next propagation. */
  oldDir = 0;
  private readonly _chain: MoldormChain;
  private readonly _isHead: boolean;
  private _speedFrac = 0;
  // Head-only flyer state.
  private _flyingState = FLY_CHASE;
  private _turns = 0;
  private _timer = 0;
  private _bounceDir = 0;

  constructor(
    x: number, y: number, hp: number, spawnCloudFrames: number,
    chain: MoldormChain, isHead: boolean,
  ) {
    super(x, y, MOLDORM, hp, spawnCloudFrames);
    this._chain = chain;
    this._isHead = isHead;
    if (isHead) {
      // InitMoldorm: random 8-way heading, 1 turn so the first flight-control call
      // ends its state immediately and picks a fresh one with a $10 timer.
      this.dir8 = DIRECTIONS8[Math.floor(Math.random() * 8)]!;
      this.oldDir = this.dir8;
      this._turns = 1;
    }
    this._direction = toCardinal(this.dir8);
  }

  get isHead(): boolean { return this._isHead; }
  get flyingState(): number { return this._flyingState; }
  get timer(): number { return this._timer; }

  // A segment with no direction is skipped entirely by UpdateMoldorm: not drawn,
  // not collision-checked.
  override get vulnerable(): boolean { return this.dir8 !== 0 && this._vulnerable; }
  override get touchesLink(): boolean { return this.dir8 !== 0; }

  override getHitbox(): Rect {
    return { x: this._x, y: this._y + 3, width: MOLDORM_SPRITE.sw, height: MOLDORM_SPRITE.sh };
  }

  moveTo(x: number, y: number): void {
    this._x = x;
    this._y = y;
  }

  die(): void {
    if (this._state === EnemyState.Dying || this._state === EnemyState.Dead) return;
    this._hp = 0;
    this._state = EnemyState.Dying;
    this._deathTimer = 12;
  }

  revive(hp: number): void {
    this._hp = hp;
    this._invincibilityTimer = ENEMY_INVINCIBILITY_FRAMES;
  }

  /**
   * UpdateMoldorm runs CheckMonsterCollisions but restores the direction and
   * timer afterwards, so hits never knock a segment back.
   */
  override takeDamage(damage: number, _fromDirection: Direction): boolean {
    if (!this.vulnerable || this._invincibilityTimer > 0) return false;
    if (this._state !== EnemyState.Active && this._state !== EnemyState.Stunned) return false;
    if (damage < this._hp) {
      this._hp -= damage;
      this._invincibilityTimer = ENEMY_INVINCIBILITY_FRAMES;
      return false;
    }
    this._chain.onSegmentKilled(this);
    return true;
  }

  // The boomerang stuns most monsters; Moldorm's collision check restores its
  // movement state, so it keeps flying.
  override stun(): void {}

  protected override updateAI(ctx: EnemyUpdateContext): void {
    if (this.dir8 === 0) return;
    if (this._isHead) this.controlFlight(ctx);
    this.moveFlyer();
    this._direction = toCardinal(this.dir8);
  }

  // ControlMoldormFlight: states 0-2 → Moldorm_Chase, 3 → Moldorm_Wander.
  private controlFlight(ctx: EnemyUpdateContext): void {
    if (this._timer > 0) this._timer--;
    if (this._flyingState === FLY_WANDER) {
      this.flyerWander();
      if (this._timer === 0) this.changeFlyingState();
      else this.propagateIfRearmed();
      return;
    }
    this.flyerChase(ctx);
    if (this._timer !== 0) this.propagateIfRearmed();
    else this.changeFlyingState();
  }

  // Flyer_Chase: wait out the timer, then spend a turn steering toward Link.
  private flyerChase(ctx: EnemyUpdateContext): void {
    if (this._timer !== 0) return;
    this._turns = (this._turns - 1) & 0xff;
    if (this._turns === 0) {
      this._flyingState = 1;
      return;
    }
    this._timer = TURN_DELAY;
    this.dir8 = turnTowardsTarget8(this.dir8, this.targetDirection(ctx));
  }

  // Flyer_Wander: same cadence, random turns.
  private flyerWander(): void {
    if (this._timer !== 0) return;
    this._turns = (this._turns - 1) & 0xff;
    if (this._turns === 0) {
      this._flyingState = 1;
      return;
    }
    this._timer = TURN_DELAY;
    this.dir8 = turnRandomly8(this.dir8, random8());
  }

  // Moldorm_ChangeFlyingState: Flyer_MoldormDecideState (Random >= $40 → chase),
  // 8 turns, re-arm $10. The body only starts following once the segment below
  // the head has a direction — the first propagation is delayed one interval.
  private changeFlyingState(): void {
    this._flyingState = random8() >= 0x40 ? FLY_CHASE : FLY_WANDER;
    this._turns = TURNS_PER_STATE;
    this._timer = TURN_DELAY;
    const below = this._chain.slots[MOLDORM_SEGMENTS_PER_WORM - 2];
    if (below && below.dir8 !== 0) this.propagateIfRearmed();
  }

  // Moldorm_PropagateDirs: only on the frame the timer was set to $10. A deferred
  // wall bounce takes effect here, then the directions shift down the worm.
  private propagateIfRearmed(): void {
    if (this._timer !== TURN_DELAY) return;
    if (this._bounceDir !== 0) {
      this.dir8 = this._bounceDir;
      this._bounceDir = 0;
    }
    this._chain.propagate();
  }

  // TurnTowardsPlayer8's target: horizontal and vertical components toward Link,
  // compared in NES coordinates (Link and objects use different local offsets).
  private targetDirection(ctx: EnemyUpdateContext): number {
    const objNesY = this._y + NES_OBJ_Y_OFFSET;
    const linkNesY = ctx.linkY + NES_LINK_Y_OFFSET;
    let target = 0;
    if (ctx.linkX !== this._x) target |= ctx.linkX > this._x ? DIR_RIGHT : DIR_LEFT;
    if (linkNesY !== objNesY) target |= linkNesY > objNesY ? DIR_DOWN : DIR_UP;
    return target;
  }

  // MoveFlyer: (speed & $E0) into the fraction; on carry, 1px along each set bit.
  private moveFlyer(): void {
    this._speedFrac += FLY_SPEED & 0xe0;
    if (this._speedFrac < 0x100) return;
    this._speedFrac -= 0x100;
    if (this.dir8 & DIR_RIGHT) this._x++;
    if (this.dir8 & DIR_LEFT) this._x--;
    if (this.dir8 & DIR_DOWN) this._y++;
    if (this.dir8 & DIR_UP) this._y--;
    this.boundFlyer();
  }

  // BoundFlyer → ReverseObjDir8 → DeferBounce: a head that crosses the room bounds
  // queues the opposite direction for the next propagation; body segments ignore
  // the bounds and keep following.
  private boundFlyer(): void {
    let blocked = false;
    if (this._x < BOUND_LEFT) blocked = (this.dir8 & DIR_LEFT) !== 0;
    else if (this._x >= BOUND_RIGHT) blocked = (this.dir8 & DIR_RIGHT) !== 0;
    if (this._y < BOUND_UP) blocked ||= (this.dir8 & DIR_UP) !== 0;
    else if (this._y >= BOUND_DOWN) blocked ||= (this.dir8 & DIR_DOWN) !== 0;
    if (!blocked || !this._isHead) return;
    this._bounceDir = dir8At(dir8Index(this.dir8) + 4);
  }

  override render(renderer: Renderer, enemySheet?: SpriteSheet): void {
    if (this.dir8 === 0 && this._state !== EnemyState.Dying) return;
    super.render(renderer, enemySheet);
  }

  protected override renderEnemy(renderer: Renderer): void {
    drawDungeonEnemySprite(renderer, MOLDORM_SPRITE, this._x, this._y + 3);
  }
}

/** InitMoldorm: two five-segment worms, tail→head, all at ($80, $70). */
export function createMoldorm(hp: number, spawnCloudFrames: number): MoldormSegment[] {
  const segments: MoldormSegment[] = [];
  for (let worm = 0; worm < 2; worm++) {
    const chain = new MoldormChain();
    for (let i = 0; i < MOLDORM_SEGMENTS_PER_WORM; i++) {
      const isHead = i === MOLDORM_SEGMENTS_PER_WORM - 1;
      const seg = new MoldormSegment(
        MOLDORM_START_X, MOLDORM_START_Y, hp, spawnCloudFrames, chain, isHead,
      );
      chain.slots.push(seg);
      segments.push(seg);
    }
  }
  return segments;
}
