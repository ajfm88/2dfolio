// Gleeok — Z_04.asm: InitGleeok (7641), UpdateGleeok (7700), UpdateGleeokHead (8600).
//
// Multi-headed dragon boss. Type determines head count:
//   $42 = 2 heads, $43 = 3, $44 = 4, $45 = 4 (variant).
// Stationary body. Each head oscillates independently on a spring-like neck.
// Heads are the only damageable targets (mask $FE — sword only, HP $A0).
// When a head dies it spawns an invulnerable flying GleeokHead ($46).
// All heads dead → boss dies.

import {
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';
import { FlyerEnemy } from './flyer-enemy.js';
import { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

export const GLEEOK2 = 0x42;
export const GLEEOK3 = 0x43;
export const GLEEOK4 = 0x44;
export const GLEEOK4B = 0x45;
export const GLEEOK_HEAD = 0x46;

const MASK_SWORD_ONLY = 0xfe;
const HEAD_HP = 0xa0;

const BODY_W = 48;
const BODY_H = 32;
const BODY_Y = 0x57 - 0x40; // NES Y=$57, local coords

const NECK_SEGMENTS = 6;

const HEAD_H_FLIP_STEPS = 12;
const HEAD_V_FLIP_STEPS = 6;
const HEAD_STEP_INTERVAL = 4;
const HEAD_SPEED = 1;

const SHOOT_CHANCE = 0x20; // ~12.5% per round-robin tick
const FIREBALL_TYPE = ProjectileType.Fireball2Unblockable;

interface NeckSegment {
  x: number;
  y: number;
}

function headCountFromType(objectType: number): number {
  return Math.min(objectType - 0x40, 4);
}

export class GleeokBody extends Enemy {
  private readonly _headCount: number;
  private _heads: GleeokNeckHead[] = [];
  private _necks: NeckSegment[][] = [];
  private _deadMask = 0;
  private _bodyFrame = 0;
  private _writhingTimer = 0;
  private _roundRobinIdx = 0;
  private _frame = 0;

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._vulnerable = false;
    this._headCount = headCountFromType(objectType);
    this._x = x;
    this._y = BODY_Y;
  }

  override stun(): void {}

  override getHitbox(): Rect {
    return { x: this._x, y: this._y, width: BODY_W, height: BODY_H };
  }

  get headCount(): number { return this._headCount; }
  get deadHeadCount(): number {
    let count = 0;
    for (let i = 0; i < this._headCount; i++) {
      if (this._deadMask & (1 << i)) count++;
    }
    return count;
  }

  setHeads(heads: GleeokNeckHead[]): void {
    this._heads = heads;
    this._necks = [];
    const bodyCenterX = this._x + BODY_W / 2;
    for (let i = 0; i < heads.length; i++) {
      const segments: NeckSegment[] = [];
      for (let s = 0; s < NECK_SEGMENTS; s++) {
        segments.push({
          x: bodyCenterX,
          y: this._y - s * 6,
        });
      }
      this._necks.push(segments);
    }
  }

  notifyHeadDeath(headIndex: number): void {
    this._deadMask |= (1 << headIndex);
    this._writhingTimer = 6;

    const head = this._heads[headIndex];
    if (head) {
      this._childSpawns.push({
        x: head.x,
        y: head.y,
        objectType: GLEEOK_HEAD,
      });
    }

    if (this.deadHeadCount >= this._headCount) {
      this._hp = 0;
      this._state = EnemyState.Dying;
      this._deathTimer = 12;
      this.onDeath();
    }
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    this._frame++;
    if (this._writhingTimer > 0) this._writhingTimer--;

    const animSpeed = this._writhingTimer > 0 ? 2 : 8;
    if (this._frame % animSpeed === 0) this._bodyFrame = (this._bodyFrame + 1) & 3;

    for (let i = 0; i < this._headCount; i++) {
      if (this._deadMask & (1 << i)) continue;
      const head = this._heads[i]!;
      this.updateNeck(i, head);
    }

    this.updateShooting(ctx);
  }

  private updateNeck(neckIdx: number, head: GleeokNeckHead): void {
    const segments = this._necks[neckIdx]!;
    const headSeg = segments[NECK_SEGMENTS - 1]!;
    headSeg.x = head.x;
    headSeg.y = head.y;

    const bodyCenterX = this._x + BODY_W / 2;
    const bodyCenterY = this._y;
    segments[0]!.x = bodyCenterX;
    segments[0]!.y = bodyCenterY;

    for (let s = 1; s < NECK_SEGMENTS - 1; s++) {
      const prev = segments[s - 1]!;
      const next = segments[s + 1]!;
      const seg = segments[s]!;
      const targetX = (prev.x + next.x) / 2;
      const targetY = (prev.y + next.y) / 2;
      if (Math.abs(seg.x - targetX) > 4) seg.x += (targetX > seg.x ? 2 : -2);
      if (Math.abs(seg.y - targetY) > 4) seg.y += (targetY > seg.y ? 2 : -2);
    }
  }

  private updateShooting(ctx: EnemyUpdateContext): void {
    if (this._frame % 4 !== 0) return;

    for (let attempts = 0; attempts < this._headCount; attempts++) {
      this._roundRobinIdx = (this._roundRobinIdx + 1) % this._headCount;
      if (this._deadMask & (1 << this._roundRobinIdx)) continue;

      if (Math.floor(Math.random() * 256) < SHOOT_CHANCE) {
        const head = this._heads[this._roundRobinIdx]!;
        const dir = this.directionTowardLink(ctx.linkX, ctx.linkY);
        this._pendingProjectile = new EnemyProjectile(
          head.x, head.y, dir, FIREBALL_TYPE,
        );
      }
      break;
    }
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;

    ctx.fillStyle = '#58a800';
    ctx.fillRect(this._x, this._y, BODY_W, BODY_H);
    ctx.fillStyle = '#387000';
    ctx.fillRect(this._x + 4, this._y + 4, BODY_W - 8, BODY_H - 8);

    for (let i = 0; i < this._headCount; i++) {
      if (this._deadMask & (1 << i)) continue;
      const segments = this._necks[i];
      if (!segments) continue;
      ctx.fillStyle = '#58a800';
      for (let s = 0; s < NECK_SEGMENTS - 1; s++) {
        const a = segments[s]!;
        const b = segments[s + 1]!;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#58a800';
        ctx.stroke();
      }
    }
  }
}

export class GleeokNeckHead extends Enemy {
  private _hSteps = 0;
  private _vSteps = 0;
  private _hDir = 1;
  private _vDir = -1;
  private _stepTimer: number;
  private readonly _headIndex: number;
  private _body: GleeokBody | null = null;

  constructor(x: number, y: number, objectType: number, _hp: number, spawnCloudFrames: number, headIndex: number) {
    super(x, y, objectType, HEAD_HP, spawnCloudFrames);
    this._invincibilityMask = MASK_SWORD_ONLY;
    this._headIndex = headIndex;
    this._stepTimer = headIndex * 12;
    this._hDir = headIndex % 2 === 0 ? 1 : -1;
  }

  override stun(): void {}

  override getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 16, height: 16 };
  }

  get headIndex(): number { return this._headIndex; }

  setBody(body: GleeokBody): void {
    this._body = body;
  }

  override takeDamage(damage: number, fromDirection: Direction, hitContext?: { x: number; y: number; dir: Direction }): boolean {
    const result = super.takeDamage(damage, fromDirection, hitContext);
    if (this._hp <= 0 && this._body) {
      this._body.notifyHeadDeath(this._headIndex);
      this._state = EnemyState.Dead;
    }
    return result;
  }

  protected override updateAI(_ctx: EnemyUpdateContext): void {
    if (this._stepTimer > 0) {
      this._stepTimer--;
      return;
    }
    this._stepTimer = HEAD_STEP_INTERVAL - 1;

    this._hSteps++;
    if (this._hSteps >= HEAD_H_FLIP_STEPS) {
      this._hSteps = 0;
      this._hDir = -this._hDir;
    }

    this._vSteps++;
    if (this._vSteps >= HEAD_V_FLIP_STEPS) {
      this._vSteps = 0;
      this._vDir = -this._vDir;
    }

    this._x += this._hDir * HEAD_SPEED;
    this._y += this._vDir * HEAD_SPEED;

    const minY = BODY_Y - 60;
    const maxY = BODY_Y - 8;
    if (this._y < minY) { this._y = minY; this._vDir = 1; }
    if (this._y > maxY) { this._y = maxY; this._vDir = -1; }
    if (this._x < SCREEN_EDGE_LEFT + 16) { this._x = SCREEN_EDGE_LEFT + 16; this._hDir = 1; }
    if (this._x > SCREEN_EDGE_RIGHT - 16) { this._x = SCREEN_EDGE_RIGHT - 16; this._hDir = -1; }
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#58a800';
    ctx.fillRect(this._x, this._y, 16, 16);
    ctx.fillStyle = '#d82800';
    ctx.fillRect(this._x + 4, this._y + 4, 4, 4);
    ctx.fillRect(this._x + 10, this._y + 4, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(this._x + 4, this._y + 10, 8, 3);
  }
}

export class GleeokFlyingHead extends FlyerEnemy {
  private _shootFrame = 0;

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames, 0xe0 / 256, 0x10 / 256, 30, 20);
    this._vulnerable = false;
    this._invincibilityMask = 0xff;
  }

  override stun(): void {}

  override takeDamage(_damage: number, _fromDirection: Direction, _hitContext?: { x: number; y: number; dir: Direction }): boolean {
    return false;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    super.updateAI(ctx);
    this._shootFrame++;

    if (this._shootFrame % 4 === 0 && Math.floor(Math.random() * 256) < SHOOT_CHANCE) {
      const dir = this.directionTowardLink(ctx.linkX, ctx.linkY);
      this._pendingProjectile = new EnemyProjectile(
        this._x, this._y, dir, FIREBALL_TYPE,
      );
    }
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#d82800';
    ctx.fillRect(this._x, this._y, 16, 16);
    ctx.fillStyle = '#f8a060';
    ctx.fillRect(this._x + 3, this._y + 3, 4, 4);
    ctx.fillRect(this._x + 9, this._y + 3, 4, 4);
  }
}

export function createGleeok(
  cx: number, cy: number, objectType: number, hp: number, spawnDelay: number,
): { body: GleeokBody; heads: GleeokNeckHead[] } {
  const body = new GleeokBody(cx, cy, objectType, hp, spawnDelay);
  const headCount = headCountFromType(objectType);
  const heads: GleeokNeckHead[] = [];

  const bodyCenterX = cx + BODY_W / 2;
  const startY = BODY_Y - 30;

  for (let i = 0; i < headCount; i++) {
    const offsetX = (i - (headCount - 1) / 2) * 16;
    const head = new GleeokNeckHead(
      bodyCenterX + offsetX, startY, objectType, HEAD_HP, spawnDelay, i,
    );
    head.setBody(body);
    heads.push(head);
  }

  body.setHeads(heads);
  return { body, heads };
}
