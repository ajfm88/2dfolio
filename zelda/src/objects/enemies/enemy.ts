// Enemy base class — G1/G2: state machine, spawn/despawn, damage, rendering
// Z_07.asm UpdateObject + InitObject + Obj_Shove + UpdateMetaObject

import {
  ENEMY_INVINCIBILITY_FRAMES,
  ENEMY_KNOCKBACK_DISTANCE,
  ENEMY_KNOCKBACK_SPEED,
  ENEMY_STUN_FRAMES,
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import type { TileCollisionMap } from '../../world/collision.js';
import type { OverworldScreen } from '../../data/overworld-types.js';
import type { EnemyProjectile } from '../projectiles/enemy-projectile.js';

export enum EnemyState {
  Spawning,
  Active,
  Stunned,
  Knockback,
  Dying,
  Dead,
}

// Z_04.asm:11002 ExtractHitPointValue — decode packed HP from ObjectTypeToHpPairs
export function getEnemyHp(objectType: number, hpPairs: readonly number[]): number {
  const byteIndex = Math.floor(objectType / 2);
  const raw = hpPairs[byteIndex];
  if (raw === undefined) return 0x10;
  if (objectType % 2 === 0) {
    return raw & 0xF0;
  }
  return (raw & 0x0F) << 4;
}

// A bomb an enemy can react to. Structural (no import of the Bomb class) so that
// enemy.ts stays free of weapon dependencies. Dodongo eats un-exploded bombs and
// is stunned by the blast; see dodongo.ts.
export interface BombLike {
  readonly x: number;
  readonly y: number;
  readonly isDetonating: boolean;
  readonly state: number;
  getExplosionHitbox(): Rect | null;
}

export interface EnemyUpdateContext {
  readonly collision: TileCollisionMap;
  readonly screen: OverworldScreen;
  readonly linkX: number;
  readonly linkY: number;
  // Active bombs on screen (only Dodongo reads these); omitted for most updates.
  readonly bombs?: readonly BombLike[];
  // True while the Recorder/Flute tune is playing (Digdogger reacts to this).
  readonly fluteActive?: boolean;
}

// A monster this enemy wants the SpawnManager to create (e.g. Zol → 2 Gels).
export interface ChildSpawn {
  readonly x: number;
  readonly y: number;
  readonly objectType: number;
}

export class Enemy {
  protected _x: number;
  protected _y: number;
  protected _direction: Direction;
  protected _hp: number;
  protected _state = EnemyState.Spawning;
  protected _objectType: number;
  protected _spawnTimer: number;
  protected _invincibilityTimer = 0;
  protected _knockbackDir: Direction = Direction.Down;
  protected _knockbackRemaining = 0;
  protected _stunTimer = 0;
  protected _deathTimer = 0;
  protected _walkAnimFrame = 0;
  protected _walkAnimCounter = 0;
  protected _pendingProjectile: EnemyProjectile | null = null;
  // Bosses can emit more than one shot per frame (e.g. Aquamentus' 3-way fan);
  // drained by SpawnManager alongside the single-slot _pendingProjectile.
  protected _pendingProjectiles: EnemyProjectile[] = [];
  // Weapons this enemy is immune to (Z_04 InitXxx ObjInvincibilityMask). Bit set =
  // immune. Default 0 = hurt by everything. See DamageTypeBit in constants.
  protected _invincibilityMask = 0;
  // Monsters this enemy wants spawned (drained by SpawnManager) — e.g. Zol split.
  protected _childSpawns: ChildSpawn[] = [];
  // Whether this enemy can be damaged by weapons (overridden by Peahat/Armos etc.)
  protected _vulnerable = true;

  constructor(
    x: number,
    y: number,
    objectType: number,
    hp: number,
    spawnCloudFrames: number,
  ) {
    this._x = x;
    this._y = y;
    this._objectType = objectType;
    this._hp = hp;
    this._spawnTimer = spawnCloudFrames;
    this._direction = randomDirection();
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get direction(): Direction { return this._direction; }
  get objectType(): number { return this._objectType; }
  get state(): EnemyState { return this._state; }
  get hp(): number { return this._hp; }
  get isDead(): boolean { return this._state === EnemyState.Dead; }
  get isActive(): boolean {
    return this._state !== EnemyState.Dead && this._state !== EnemyState.Dying;
  }
  get isSpawning(): boolean { return this._state === EnemyState.Spawning; }
  get isDying(): boolean { return this._state === EnemyState.Dying; }
  get isStunned(): boolean { return this._state === EnemyState.Stunned; }
  get deathTimer(): number { return this._deathTimer; }
  get vulnerable(): boolean { return this._vulnerable; }

  consumeProjectile(): EnemyProjectile | null {
    const p = this._pendingProjectile;
    this._pendingProjectile = null;
    return p;
  }

  // Drained by SpawnManager each frame; returns extra projectiles a boss emitted
  // this frame (beyond the single _pendingProjectile slot).
  consumeProjectiles(): EnemyProjectile[] {
    if (this._pendingProjectiles.length === 0) return [];
    const ps = this._pendingProjectiles;
    this._pendingProjectiles = [];
    return ps;
  }

  // True if this enemy is immune to the given weapon (DamageTypeBit).
  isImmuneToDamageType(damageBit: number): boolean {
    return (this._invincibilityMask & damageBit) !== 0;
  }

  // Drained by SpawnManager each frame; returns monsters to create (e.g. Zol → Gels).
  collectChildSpawns(): ChildSpawn[] {
    if (this._childSpawns.length === 0) return [];
    const spawns = this._childSpawns;
    this._childSpawns = [];
    return spawns;
  }

  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 16, height: 16 };
  }

  getCollisionCenter(): { cx: number; cy: number } {
    return { cx: this._x + 8, cy: this._y + 8 };
  }

  update(ctx: EnemyUpdateContext): void {
    if (this._state === EnemyState.Dead) return;

    if (this._invincibilityTimer > 0) {
      this._invincibilityTimer--;
    }

    switch (this._state) {
      case EnemyState.Spawning:
        this._spawnTimer--;
        if (this._spawnTimer <= 0) {
          this._state = EnemyState.Active;
        }
        break;
      case EnemyState.Active:
        this.updateAI(ctx);
        break;
      case EnemyState.Stunned:
        this._stunTimer--;
        if (this._stunTimer <= 0) {
          this._state = EnemyState.Active;
        }
        break;
      case EnemyState.Knockback:
        this.updateKnockback(ctx.collision, ctx.screen);
        break;
      case EnemyState.Dying:
        this._deathTimer--;
        if (this._deathTimer <= 0) {
          this._state = EnemyState.Dead;
        }
        break;
    }
  }

  // Override in subclasses for specific AI
  protected updateAI(_ctx: EnemyUpdateContext): void {
    // Default: generic random walker (G1 fallback)
    this._walkAnimCounter++;
    if (this._walkAnimCounter >= 8) {
      this._walkAnimCounter = 0;
      this._walkAnimFrame = this._walkAnimFrame === 0 ? 1 : 0;
    }
  }

  protected updateKnockback(collision: TileCollisionMap, screen: OverworldScreen): void {
    const dx = this._knockbackDir === Direction.Left ? -1 : this._knockbackDir === Direction.Right ? 1 : 0;
    const dy = this._knockbackDir === Direction.Up ? -1 : this._knockbackDir === Direction.Down ? 1 : 0;

    for (let i = 0; i < ENEMY_KNOCKBACK_SPEED; i++) {
      if (this._knockbackRemaining <= 0) break;
      const nx = this._x + dx;
      const ny = this._y + dy;
      if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT ||
          ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
        this._knockbackRemaining = 0;
        break;
      }
      if (!collision.isRectWalkable(screen, nx, ny, 16, 16)) {
        this._knockbackRemaining = 0;
        break;
      }
      this._x = nx;
      this._y = ny;
      this._knockbackRemaining--;
    }

    if (this._knockbackRemaining <= 0) {
      this._state = EnemyState.Active;
    }
  }

  takeDamage(damage: number, fromDirection: Direction, _hitContext?: { x: number; y: number; dir: Direction }): boolean {
    if (this._invincibilityTimer > 0) return false;
    if (!this._vulnerable) return false;
    if (this._state === EnemyState.Spawning || this._state === EnemyState.Dying || this._state === EnemyState.Dead) return false;

    if (damage >= this._hp) {
      this._hp = 0;
      this._state = EnemyState.Dying;
      this._deathTimer = 12;
      this.onDeath();
      return true;
    }

    this._hp -= damage;
    this._state = EnemyState.Knockback;
    this._knockbackDir = fromDirection;
    this._knockbackRemaining = ENEMY_KNOCKBACK_DISTANCE;
    this._invincibilityTimer = ENEMY_INVINCIBILITY_FRAMES;
    return false;
  }

  // Override for special death behavior (e.g., Ghini kills flying Ghini)
  protected onDeath(): void {}

  // Darknut parry: a melee/beam hit whose direction this enemy "faces off" against
  // is blocked. Default: nothing is blocked. weaponDirection is where the weapon
  // is travelling (the direction of the swing/beam).
  blocksAttackFrom(_weaponDirection: Direction): boolean {
    return false;
  }

  stun(): void {
    if (this._state === EnemyState.Spawning || this._state === EnemyState.Dying || this._state === EnemyState.Dead) return;
    this._state = EnemyState.Stunned;
    this._stunTimer = ENEMY_STUN_FRAMES;
  }

  render(renderer: Renderer, enemySheet?: SpriteSheet): void {
    if (this._state === EnemyState.Dead) return;
    if (this._invincibilityTimer > 0 && (this._invincibilityTimer & 0x02) === 0) return;

    const ctx = renderer.ctx;

    if (this._state === EnemyState.Spawning) {
      const alpha = 1 - (this._spawnTimer / 7);
      ctx.save();
      ctx.globalAlpha = Math.max(0.3, alpha);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this._x + 2, this._y + 2, 12, 12);
      ctx.fillStyle = '#aaaaff';
      ctx.fillRect(this._x + 4, this._y + 4, 8, 8);
      ctx.restore();
      return;
    }

    if (this._state === EnemyState.Dying) {
      const flash = this._deathTimer & 0x02;
      ctx.fillStyle = flash ? '#ff0000' : '#ffff00';
      ctx.fillRect(this._x + 2, this._y + 2, 12, 12);
      ctx.fillStyle = flash ? '#ffff00' : '#ffffff';
      ctx.fillRect(this._x + 4, this._y + 4, 8, 8);
      return;
    }

    this.renderEnemy(renderer, enemySheet);

    if (this._state === EnemyState.Stunned) {
      ctx.fillStyle = 'rgba(255,255,0,0.3)';
      ctx.fillRect(this._x, this._y, 16, 16);
    }
  }

  // Override in subclasses for sprite rendering
  protected renderEnemy(renderer: Renderer, _enemySheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    const color = getEnemyColor(this._objectType);
    ctx.fillStyle = color;
    ctx.fillRect(this._x, this._y, 16, 16);
    ctx.fillStyle = '#000000';
    switch (this._direction) {
      case Direction.Down: ctx.fillRect(this._x + 6, this._y + 12, 4, 3); break;
      case Direction.Up: ctx.fillRect(this._x + 6, this._y + 1, 4, 3); break;
      case Direction.Left: ctx.fillRect(this._x + 1, this._y + 6, 3, 4); break;
      case Direction.Right: ctx.fillRect(this._x + 12, this._y + 6, 3, 4); break;
    }
    if (this._walkAnimFrame === 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(this._x, this._y, 16, 16);
    }
  }

  // Helpers for subclasses
  protected moveQSpeed(
    qSpeedFrac: number,
    subPixelRef: { value: number },
    collision: TileCollisionMap,
    screen: OverworldScreen,
    checkTiles = true,
  ): boolean {
    let moved = false;
    for (let i = 0; i < 4; i++) {
      subPixelRef.value += qSpeedFrac;
      if (subPixelRef.value >= 256) {
        subPixelRef.value -= 256;
        if (this.moveOnePixel(collision, screen, checkTiles)) {
          moved = true;
        } else {
          return moved;
        }
      }
    }
    return moved;
  }

  protected moveOnePixel(collision: TileCollisionMap, screen: OverworldScreen, checkTiles = true): boolean {
    const dx = this._direction === Direction.Left ? -1 : this._direction === Direction.Right ? 1 : 0;
    const dy = this._direction === Direction.Up ? -1 : this._direction === Direction.Down ? 1 : 0;
    const nx = this._x + dx;
    const ny = this._y + dy;

    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT ||
        ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      return false;
    }
    if (checkTiles && !collision.isRectWalkable(screen, nx, ny, 16, 16)) {
      return false;
    }
    this._x = nx;
    this._y = ny;
    return true;
  }

  protected tickWalkAnimation(counterReset = 6): void {
    this._walkAnimCounter++;
    if (this._walkAnimCounter >= counterReset) {
      this._walkAnimCounter = 0;
      this._walkAnimFrame = this._walkAnimFrame === 0 ? 1 : 0;
    }
  }

  // NES direction toward Link
  protected directionTowardLink(linkX: number, linkY: number): Direction {
    const dx = linkX - this._x;
    const dy = linkY - this._y;
    const absDx = Math.abs(dx);
    if (absDx >= 9) {
      return dx > 0 ? Direction.Right : Direction.Left;
    }
    return dy > 0 ? Direction.Down : Direction.Up;
  }
}

export function randomDirection(): Direction {
  return [Direction.Down, Direction.Left, Direction.Up, Direction.Right][
    Math.floor(Math.random() * 4)
  ] as Direction;
}

function getEnemyColor(objectType: number): string {
  switch (objectType) {
    case 7: case 8: return '#d82800';
    case 9: case 10: return '#0058f0';
    case 3: return '#0058f0';
    case 4: return '#d82800';
    case 1: return '#0058f0';
    case 2: return '#d82800';
    case 13: return '#0058f0';
    case 14: return '#d82800';
    case 26: return '#00a800';
    case 17: return '#0058f0';
    case 15: return '#0058f0';
    case 16: return '#d82800';
    case 30: return '#888888';
    case 33: case 34: return '#cccccc';
    case 42: return '#cccccc';
    // Dungeon tier-1 enemies (G3)
    case 0x05: return '#0058f0'; // Blue Goriya
    case 0x06: return '#d82800'; // Red Goriya
    case 0x13: return '#c07830'; // Zol
    case 0x14: case 0x15: return '#48b8b8'; // Gel
    case 0x1b: return '#5878f0'; // Blue Keese
    case 0x1c: return '#d82800'; // Red Keese
    case 0x1d: return '#484848'; // Black Keese
    case 0x28: return '#d0a040'; // Rope
    case 0x2a: return '#e0d8c0'; // Stalfos
    // Dungeon tier-2 enemies (G4a)
    case 0x0b: return '#d82800'; // Red Darknut
    case 0x0c: return '#0058f0'; // Blue Darknut
    case 0x12: return '#a800a8'; // Vire
    case 0x30: return '#f0d8a8'; // Gibdo
    // Dungeon tier-2 enemies (G4b)
    case 0x23: return '#3858f0'; // Blue Wizzrobe
    case 0x24: return '#d82800'; // Red Wizzrobe
    case 0x17: return '#c86818'; // Like-Like
    case 0x27: return '#48b0c8'; // Wallmaster
    case 0x3a: return '#f0a048'; // Red Lanmola
    case 0x3b: return '#48b8f0'; // Blue Lanmola
    default: return '#ff6600';
  }
}
