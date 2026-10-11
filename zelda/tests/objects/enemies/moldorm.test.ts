import { describe, it, expect } from 'vitest';
import { type EnemyUpdateContext, EnemyState } from '../../../src/objects/enemies/enemy.js';
import {
  createMoldorm,
  dir8Index,
  DIRECTIONS8,
  MOLDORM,
  MOLDORM_START_X,
  MOLDORM_START_Y,
  MoldormSegment,
  turnRandomly8,
  turnTowardsTarget8,
} from '../../../src/objects/enemies/moldorm.js';
import { Direction } from '../../../src/core/types.js';

const R = 0x01, L = 0x02, D = 0x04, U = 0x08;

function mockCtx(linkX = 40, linkY = 120): EnemyUpdateContext {
  return {
    collision: { isRectWalkable: () => true } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
    screen: { id: 0, tiles: [] } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
    linkX,
    linkY,
  };
}

function tick(segs: MoldormSegment[], frames: number, ctx = mockCtx()): void {
  for (let f = 0; f < frames; f++) for (const s of segs) s.update(ctx);
}

describe('Moldorm direction helpers (Z_04.asm flyer code)', () => {
  it('Directions8 order and index lookup', () => {
    expect([...DIRECTIONS8]).toEqual([U, U | R, R, D | R, D, D | L, L, U | L]);
    expect(dir8Index(D | L)).toBe(5);
    expect(dir8Index(0)).toBe(0); // not found → index 0
  });

  it('TurnTowardsPlayer8 keeps course when the target is within one step', () => {
    expect(turnTowardsTarget8(R, R)).toBe(R);
    expect(turnTowardsTarget8(R, D | R)).toBe(R);
    expect(turnTowardsTarget8(R, U | R)).toBe(R);
  });

  it('turns one step toward a shared component', () => {
    // Heading Up, target Down|Right: Up|Right shares R but (9|5) >= 7 fails,
    // so it falls back to turning right of Up.
    expect(turnTowardsTarget8(U, D | R)).toBe(U | R);
    // Heading Left, target Down: Down|Left shares D and (6|4)=6 < 7 → take it.
    expect(turnTowardsTarget8(L, D)).toBe(D | L);
  });

  it('never steers toward a target with an Up component unless already close (ROM quirk)', () => {
    // Heading Down, target Up|Left: no candidate passes (x | 0x0A) < 7.
    expect(turnTowardsTarget8(D, U | L)).toBe(D | L); // the default right-turn
  });

  it('TurnRandomlyDir8 thresholds', () => {
    expect(turnRandomly8(R, 0xa0)).toBe(R);
    expect(turnRandomly8(R, 0x50)).toBe(D | R);
    expect(turnRandomly8(R, 0x4f)).toBe(U | R);
  });
});

describe('createMoldorm (InitMoldorm)', () => {
  it('makes two five-segment worms at ($80, $70)', () => {
    const segs = createMoldorm(0x20, 0);
    expect(segs).toHaveLength(10);
    expect(segs.every((s) => s.objectType === MOLDORM)).toBe(true);
    expect(segs.every((s) => s.x === MOLDORM_START_X && s.y === MOLDORM_START_Y)).toBe(true);
    expect(segs.filter((s) => s.isHead).map((s) => segs.indexOf(s))).toEqual([4, 9]);
  });

  it('only the heads start with a direction; the body is hidden and intangible', () => {
    const segs = createMoldorm(0x20, 0);
    for (const s of segs) {
      if (s.isHead) {
        expect(DIRECTIONS8).toContain(s.dir8);
        expect(s.vulnerable).toBe(true);
      } else {
        expect(s.dir8).toBe(0);
        expect(s.vulnerable).toBe(false);
        expect(s.touchesLink).toBe(false);
      }
    }
  });
});

describe('Moldorm flight', () => {
  it('moves 1px every other frame along each axis of its direction', () => {
    const segs = createMoldorm(0x20, 0);
    const head = segs[4]!;
    head.dir8 = D | R;
    head.oldDir = D | R;
    tick([head], 1); // spawn → active
    const x0 = head.x, y0 = head.y;
    tick([head], 10);
    expect(Math.abs(head.x - x0)).toBeGreaterThanOrEqual(4);
    expect(Math.abs(head.x - x0)).toBeLessThanOrEqual(6);
  });

  it('the body takes the head\'s old direction one $10 interval at a time', () => {
    const segs = createMoldorm(0x20, 0).slice(0, 5);
    const head = segs[4]!;
    const start = head.dir8;
    tick(segs, 1);
    // First flight-state change re-arms $10 but skips propagation (segment below has no dir).
    expect(segs[3]!.dir8).toBe(0);
    tick(segs, 17);
    expect(segs[3]!.dir8).toBe(start);
    expect(segs[2]!.dir8).toBe(0);
    tick(segs, 16);
    expect(segs[2]!.dir8).toBe(start);
  });

  it('body segments trail the head 8px apart once moving', () => {
    const segs = createMoldorm(0x20, 0).slice(0, 5);
    tick(segs, 1 + 17 + 16 * 4);
    for (let i = 0; i < 4; i++) {
      const a = segs[i]!, b = segs[i + 1]!;
      expect(a.dir8).not.toBe(0);
      expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThanOrEqual(9);
    }
  });

  it('a head crossing the room bounds reverses only at the next propagation (DeferBounce)', () => {
    const segs = createMoldorm(0x20, 0).slice(0, 5);
    const head = segs[4]!;
    tick(segs, 1);
    head.dir8 = L;
    head.oldDir = L;
    head.moveTo(0x22, 80);
    tick(segs, 4); // crosses x < $21 but keeps flying left
    expect(head.dir8 & L).toBe(L);
    tick(segs, 20); // the next $10 re-arm applies the bounce
    expect(head.dir8 & R).toBe(R);
  });
});

describe('Moldorm damage (UpdateMoldorm death swap)', () => {
  function activeWorm(): MoldormSegment[] {
    const segs = createMoldorm(0x20, 0).slice(0, 5);
    tick(segs, 1 + 17 + 16 * 4);
    return segs;
  }

  it('is not knocked back or stunned by hits', () => {
    const segs = activeWorm();
    const head = segs[4]!;
    head.takeDamage(0x10, Direction.Left);
    expect(head.state).toBe(EnemyState.Active);
    head.stun();
    expect(head.state).toBe(EnemyState.Active);
    expect(head.hp).toBe(0x10);
  });

  it('a lethal hit kills the tail at the struck segment\'s spot and revives the struck one', () => {
    const segs = activeWorm();
    const struck = segs[2]!;
    const sx = struck.x, sy = struck.y;
    expect(struck.takeDamage(0x40, Direction.Up)).toBe(true);
    expect(segs[0]!.state).toBe(EnemyState.Dying);
    expect(segs[0]!.x).toBe(sx);
    expect(segs[0]!.y).toBe(sy);
    expect(struck.isActive).toBe(true);
    expect(struck.hp).toBe(0x20);
  });

  it('the head dies only when it is the last segment', () => {
    const segs = activeWorm();
    const head = segs[4]!;
    for (let i = 0; i < 4; i++) {
      head.revive(0x20);
      (head as unknown as { _invincibilityTimer: number })._invincibilityTimer = 0;
      head.takeDamage(0x40, Direction.Up);
      expect(head.isActive).toBe(true);
    }
    expect(segs.slice(0, 4).every((s) => !s.isActive)).toBe(true);
    (head as unknown as { _invincibilityTimer: number })._invincibilityTimer = 0;
    expect(head.takeDamage(0x40, Direction.Up)).toBe(true);
    expect(head.state).toBe(EnemyState.Dying);
  });
});
