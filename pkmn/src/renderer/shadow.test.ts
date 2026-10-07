// A6e review N-1: the movement shadow's composition (drawShadowUnderSprites) and the
// scene's OAM draw order, through a canvas spy.

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { initRenderer, drawShadowUnderSprites } from './renderer';
import type { SpriteDraw } from './renderer';
import { spriteDrawOrder } from '../overworld/sprites';

interface Call { op: string; args: unknown[]; composite: string }

function spyContext(log: Call[]) {
  const ctx = {
    imageSmoothingEnabled: true, fillStyle: '', globalCompositeOperation: 'source-over',
    fillRect: vi.fn(), clearRect: vi.fn(),
    save: vi.fn(() => log.push({ op: 'save', args: [], composite: ctx.globalCompositeOperation })),
    restore: vi.fn(() => log.push({ op: 'restore', args: [], composite: ctx.globalCompositeOperation })),
    translate: vi.fn((...args: unknown[]) => log.push({ op: 'translate', args, composite: ctx.globalCompositeOperation })),
    scale: vi.fn((...args: unknown[]) => log.push({ op: 'scale', args, composite: ctx.globalCompositeOperation })),
    drawImage: vi.fn((...args: unknown[]) => log.push({ op: 'drawImage', args, composite: ctx.globalCompositeOperation })),
  };
  return ctx;
}

const screenLog: Call[] = [];
const offscreenLog: Call[] = [];
let offscreen: { width: number; height: number; getContext: () => ReturnType<typeof spyContext> };

beforeAll(() => {
  const screen = { width: 0, height: 0, style: {}, getContext: () => spyContext(screenLog) };
  offscreen = { width: 0, height: 0, getContext: () => spyContext(offscreenLog) };
  vi.stubGlobal('document', { getElementById: () => screen, createElement: () => offscreen });
  vi.stubGlobal('window', { innerWidth: 160, innerHeight: 144, addEventListener: vi.fn() });
  initRenderer();
});

const sheet = (name: string) => ({ name }) as unknown as HTMLCanvasElement;
const shadow = sheet('shadow');

describe('drawShadowUnderSprites', () => {
  it('mirrors the tile, punches out each overlapping sprite frame, skips the rest, then draws', () => {
    screenLog.length = 0;
    offscreenLog.length = 0;
    const pikachu: SpriteDraw = { sheet: sheet('pikachu'), frameX: 0, frameY: 48, destX: 60, destY: 56, flipX: false };
    const npc: SpriteDraw = { sheet: sheet('npc'), frameX: 0, frameY: 32, destX: 70, destY: 64, flipX: true };
    const far: SpriteDraw = { sheet: sheet('far'), frameX: 0, frameY: 0, destX: 120, destY: 20, flipX: false };
    drawShadowUnderSprites(shadow, 64, 68, [pikachu, npc, far]);
    expect([offscreen.width, offscreen.height]).toEqual([16, 8]);
    const draws = offscreenLog.filter(c => c.op === 'drawImage');
    // the tile, then its mirror (translate 16, scale −1)
    expect(draws.slice(0, 2).map(d => [d.args[0], d.composite])).toEqual([[shadow, 'source-over'], [shadow, 'source-over']]);
    const mirror = offscreenLog.findIndex(c => c.op === 'translate');
    expect(offscreenLog.slice(mirror, mirror + 2).map(c => [c.op, ...c.args])).toEqual([['translate', 16, 0], ['scale', -1, 1]]);
    // the two overlapping frames cut out at their offsets; the NPC's frame mirrored
    expect(draws.slice(2).map(d => [d.args[0], d.composite])).toEqual([
      [pikachu.sheet, 'destination-out'], [npc.sheet, 'destination-out'],
    ]);
    expect(draws[2].args).toEqual([pikachu.sheet, 0, 48, 16, 16, -4, -12, 16, 16]);
    const npcTranslate = offscreenLog.filter(c => c.op === 'translate')[1];
    expect(npcTranslate.args).toEqual([6 + 16, -4]);
    expect(draws[3].args).toEqual([npc.sheet, 0, 32, 16, 16, 0, 0, 16, 16]);
    // the composite lands on screen at (64, 68), scaled
    const out = screenLog.filter(c => c.op === 'drawImage');
    expect(out).toHaveLength(1);
    expect(out[0].args.slice(0, 1)).toEqual([offscreen]);
  });
});

describe('the scene\'s OAM draw order', () => {
  it('ordinarily the NPCs, Pikachu, then the player on top', () => {
    expect(spriteDrawOrder(false)).toEqual(['npcs', 'pikachu', 'player']);
  });
  it('during a movement call Pikachu holds slot 0: the player first, Pikachu last', () => {
    expect(spriteDrawOrder(true)).toEqual(['player', 'npcs', 'pikachu']);
  });
});
