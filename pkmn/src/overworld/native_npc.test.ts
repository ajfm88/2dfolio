import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Npc } from './npc';
import type { NpcUpdateContext } from './npc';
import { NpcWalk } from './walk_pace';
import { drawSprite } from '../renderer';
import { uiTiles } from '../renderer/ui_tiles';
vi.mock('../renderer', () => ({ loadSprite: async () => ({ width: 16, height: 96 }), drawSprite: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); uiTiles.clear(); });
const ctx = (x = 10, y = 10, playerWalking = false): NpcUpdateContext => ({
  isWalkable: () => true, playerWalking, playerMapStep: { x, y }, playerX: x * 16, playerY: y * 16,
  slot: 1, sprites: () => [], random: () => 128,
});
const guy = (x = 10, y = 10) => new Npc({ id: 'guide', sprite: 'youngster', x, y, movement: 'stay', direction: 'down', dialogue: '' });

describe('native in-step NPC map and movement state', () => {
  it.each(['ready', 'resting'] as const)('endInStep retains %s status, delay, bytes and the frozen map position', status => {
    const npc = guy(); Reflect.set(npc.movement, 'status', status); Reflect.set(npc.movement, 'delay', 23);
    npc.startInStepMove(['down', 'down']);
    for (let p = 1; p <= 17; p++) {
      npc.update(ctx());
      expect([npc.mapStepX, npc.mapStepY]).toEqual([10, 10]);
      expect(npc.y).toBe(160 + Math.max(0, p - 1) * 2);
    }
    npc.endInStep();
    npc.update(ctx(30, 30)); // native close: normal availability sees the old, off-window MAPX/MAPY
    expect(npc.movement).toMatchObject({ status, delay: 23, movement1: 'stay', movement2: 'down' });
    expect(npc.collisionSprite(480, 480, 1).available).toBe(false);
    expect([npc.mapStepX, npc.mapStepY]).toEqual([10, 10]);
  });
  it('endInStep also releases the held route after its own terminator', () => {
    const npc = guy(); npc.startInStepMove(['down']);
    for (let p = 0; p < 10; p++) npc.update(ctx());
    expect(npc.scriptedMoveDone).toBe(true);
    npc.endInStep(); npc.update(ctx());
    expect(npc.movement.status).toBe('resting'); // ready ordinary STAY try, rather than heldAfterInStep
    expect(npc.y).toBe(160); // InitializeSpriteScreenPosition uses frozen MAPY
  });
  it.each(['ready', 'resting'] as const)('MoveSprite opts into STAY/NONE without resetting %s or its old delay', status => {
    const walk = new NpcWalk('right', 'stay', 'down'); walk.initialize(); walk.status = status; walk.delay = 17;
    walk.startScript([{ dir: 'right', mode: 'normal' }], { keepStatus: true, bytesToFF: true });
    expect(walk).toMatchObject({ status, delay: 17, movement1: 'stay', movement2: 'none' });
    walk.pass({ playerWalking: false, canWalk: () => false, random: () => 0 });
    if (status === 'resting') expect(walk).toMatchObject({ status: 'ready', delay: 0 });
    else expect(walk.status).toBe('moving');
    while (!walk.scriptDone) walk.pass({ playerWalking: false, canWalk: () => false, random: () => 0 });
    expect(walk).toMatchObject({ status: 'ready', movement1: 'stay', movement2: 'none' });
    walk.pass({ playerWalking: false, canWalk: () => false, random: () => 128 });
    expect(walk.facing).toBe('left');
    expect(guy().movement.movement2).toBe('down'); // reload reconstructs object bytes
  });
  it.each(['ready', 'resting'] as const)('screen X 0x40 placement has %s timing in actual NPC rendering', async status => {
    const npc = guy(35, 16); await npc.load();
    Reflect.set(npc.movement, 'status', status); Reflect.set(npc.movement, 'delay', 19);
    npc.setLiveFacing('right'); npc.showStandingImage('left');
    npc.setSpritePosition1({ x: 12, y: 18 }, -16);
    npc.startScriptedMove(['right'], undefined, { keepStatus: true, bytesToFF: true });
    npc.update(ctx(11, 18)); npc.render(11 * 16 - 64, 18 * 16 - 60);
    expect(drawSprite).toHaveBeenLastCalledWith(expect.anything(), 0, 32, status === 'resting' ? 64 : 80, 56, true);
    expect(npc.x).toBe(status === 'resting' ? 176 : 192);
    expect(npc.mapStepX).toBe(status === 'resting' ? 12 : 13);
    npc.update(ctx(11, 18));
    expect(npc.x).toBe(status === 'resting' ? 192 : 193);
    expect(npc.mapStepX).toBe(13);
  });
  it('ready recompute waits until the player stands; resting updates do not recompute', () => {
    const npc = guy(); npc.setSpritePosition1({ x: 12, y: 10 }, -16);
    npc.update(ctx(11, 10, true)); expect(npc.x).toBe(176);
    Reflect.set(npc.movement, 'status', 'resting'); Reflect.set(npc.movement, 'delay', 2);
    npc.update(ctx(11, 10)); expect(npc.x).toBe(176);
    npc.update(ctx(11, 10)); expect(npc.x).toBe(176);
    npc.update(ctx(11, 10)); expect(npc.x).toBe(192);
  });
  it('live/image-only writes stay distinct until a real update; RESET restores map-derived pixels', async () => {
    const npc = guy(); await npc.load(); npc.showStandingImage('left'); npc.setLiveFacing('up');
    npc.render(0, 0);
    expect(drawSprite).toHaveBeenLastCalledWith(expect.anything(), 0, 32, 160, 156, false);
    expect(npc.direction).toBe('up');
    npc.restoreSpritePosition2({ x: 35, y: 16 });
    expect([npc.x, npc.y, npc.mapStepX, npc.mapStepY]).toEqual([560, 256, 35, 16]);
  });
});
