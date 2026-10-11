import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Boulder, BoulderSet } from '../../../src/objects/enemies/boulder.js';
import { EnemyState, type EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { checkEnemyLinkCollisions, checkWeaponEnemyCollisions, type WeaponSet } from '../../../src/objects/enemies/enemy-collision.js';
import { Direction } from '../../../src/core/types.js';
import { DAMAGE_TABLE } from '../../../src/core/damage-tables.js';
import { DropEngine } from '../../../src/objects/enemies/drop-engine.js';
import type { Renderer } from '../../../src/render/renderer.js';

const context = (linkX = 120): EnemyUpdateContext => ({ linkX, linkY: 112 } as EnemyUpdateContext);
function startJump(b: Boulder): void { for (let i = 0; i < 4; i++) b.update(context()); }

beforeEach(() => { Boulder.resetActiveCount(); vi.spyOn(Math, 'random').mockReturnValue(0); });
afterEach(() => { vi.restoreAllMocks(); Boulder.resetActiveCount(); });

describe('BoulderSet', () => {
  it('is invisible, active immediately, invulnerable, harmless and unstunnable', () => {
    const s = new BoulderSet();
    expect(s.state).toBe(EnemyState.Active);
    expect(s.vulnerable).toBe(false);
    expect(s.touchesLink).toBe(false);
    const draw = vi.fn();
    s.render({ ctx: {}, drawImage: draw, fillRect: draw } as unknown as Renderer);
    expect(draw).not.toHaveBeenCalled();
    s.stun(); s.debugKill();
    expect(s.state).toBe(EnemyState.Active);
  });
  it.each([64, 128, 200])('requests an instant boulder at the top in Link x=%i half', (x) => {
    const s = new BoulderSet();
    for (let i = 0; i < 4; i++) s.update(context(x));
    const [spec] = s.collectChildSpawns();
    expect(spec).toMatchObject({ objectType: 0x20, y: 0, spawnCloudFrames: 0 });
    expect(spec!.x < 128).toBe(x < 128);
  });
  it('caps at three live boulders and retries after one leaves', () => {
    new Boulder(60); new Boulder(70);
    const last = new Boulder(80, 176);
    const s = new BoulderSet();
    for (let i = 0; i < 40; i++) s.update(context());
    expect(s.collectChildSpawns()).toHaveLength(0);
    last.update(context());
    expect(Boulder.activeCount).toBe(2);
    s.update(context());
    expect(s.collectChildSpawns()).toHaveLength(1);
  });
  it('requires a free monster slot and does not rearm when slots are full', () => {
    const s = new BoulderSet();
    for (let i = 0; i < 4; i++) s.update({ ...context(), freeMonsterSlots: 0 });
    expect(s.collectChildSpawns()).toHaveLength(0);
    expect(s.timer).toBe(0);
    s.update({ ...context(), freeMonsterSlots: 1 });
    expect(s.collectChildSpawns()).toHaveLength(1);
    expect(s.timer).toBe(8);
  });
});

describe('Boulder', () => {
  it('waits dir×4 frames, starts with -2 vertical speed and a downward heading', () => {
    const b = new Boulder(64);
    expect(b.state).toBe(EnemyState.Active);
    expect(b.timer).toBe(4);
    for (let i = 0; i < 3; i++) b.update(context());
    expect(b.jumping).toBe(false);
    b.update(context());
    expect(b.jumping).toBe(true);
    expect(b.speedWholeY).toBe(-2);
    expect(b.targetY).toBe(32);
    expect(b.dir8 & 4).toBe(4);
    const x = b.x;
    b.update(context());
    expect(b.x).toBe(x + 1);
    expect(b.y).toBe(-2);
  });
  it('ignores tiles, lands within 2px of +32 and starts another hop immediately', () => {
    const b = new Boulder(64);
    startJump(b);
    let frames = 0;
    while (b.jumping && frames++ < 100) {
      const x = b.x;
      b.update(context()); // No collision map at all: tiles are never consulted.
      expect(Math.abs(b.x - x)).toBe(1);
      expect(b.dir8 & 4).toBe(4);
    }
    expect(frames).toBeLessThan(100);
    expect(Math.abs(b.y - 32)).toBeLessThan(3);
    expect(b.timer).toBe(0);
    const y = b.y;
    b.update(context());
    expect(b.jumping).toBe(true);
    expect(b.speedWholeY).toBe(-2);
    expect(b.targetY).toBe(y + 32);
  });
  it.each([0, 224])('reverses outward horizontal heading at x=%i, without moving that frame', (x) => {
    const b = new Boulder(x);
    startJump(b);
    if (x === 0) (b as unknown as { _dir8: number })._dir8 = 6;
    const dir = b.dir8;
    b.update(context());
    expect(b.x).toBe(x);
    expect(b.y).toBe(0);
    expect(b.dir8 & 3).not.toBe(dir & 3);
    expect(b.dir8 & 4).toBe(4);
    expect(b.reversalCount).toBe(1);
    expect(b.speedWholeY).toBe(-2);
  });
  it('flips horizontal direction again after two consecutive reversals', () => {
    const b = new Boulder(224);
    startJump(b);
    (b as unknown as { _reversalCount: number })._reversalCount = 1;
    b.update(context());
    expect(b.dir8 & 3).toBe(1);
    expect(b.reversalCount).toBe(0);
  });
  it('animates under Clock without moving, then resumes its jump', () => {
    const b = new Boulder(64);
    startJump(b);
    for (let i = 0; i < 20; i++) b.update({ ...context(), clockActive: true });
    expect([b.x, b.y]).toEqual([64, 0]);
    b.update(context());
    expect([b.x, b.y]).toEqual([65, -2]);
  });
  it('leaves at local y>=176 directly, decrements once, never makes a death puff', () => {
    const b = new Boulder(64, 176);
    expect(Boulder.activeCount).toBe(1);
    b.update(context());
    expect(b.state).toBe(EnemyState.Dead);
    expect(b.deathTimer).toBe(0);
    expect(Boulder.activeCount).toBe(0);
    b.update(context());
    expect(Boulder.activeCount).toBe(0);
  });
  it('cannot be hit or stunned; no killed hit reaches DropEngine', () => {
    const b = new Boulder(64);
    const drop = vi.spyOn(new DropEngine(), 'rollDrop');
    const weapons: WeaponSet = {
      swordHitbox: b.getHitbox(), swordDirection: Direction.Right,
      swordBeam: { isActive: () => true, getHitbox: () => b.getHitbox(), direction: Direction.Right, deactivate: vi.fn() },
      boomerang: null, bombs: [], arrow: null, fires: [], magicRod: null, magicShot: null,
      linkX: 64, linkY: 0, swordLevel: 3, hasMagicBoomerang: true,
    };
    const hits = checkWeaponEnemyCollisions([b], weapons);
    expect(hits).toEqual([]);
    for (const hit of hits) if (hit.killed) drop(hit.enemy.objectType, []);
    expect(drop).not.toHaveBeenCalled();
    expect(weapons.swordBeam!.deactivate).not.toHaveBeenCalled();
    expect(b.takeDamage(0xff, Direction.Right)).toBe(false);
    b.stun(); b.debugKill();
    expect(b.state).toBe(EnemyState.Active);
  });
  it('still collides with Link and deals $80 contact damage', () => {
    const b = new Boulder(64);
    expect(checkEnemyLinkCollisions([b], b.getHitbox())).toBe(b);
    expect(DAMAGE_TABLE[b.objectType]).toBe(0x80);
  });
});
