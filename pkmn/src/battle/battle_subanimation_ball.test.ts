// A5f checkpoint-02 (note 87): DoBallTossSpecialEffects and DoBallShakeSpecialEffects on the committed data, unused.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BattleState } from './battle_state';
import { BattleScreen } from './battle_screen';
import type { BattleSfx } from './battle_audio';
import type { RawImage } from './battle_screen_render';
import { BattleUnsupportedState } from './battle_move_data';
import { MOVE_ANIM } from './battle_move_anim';
import { I } from './battle_item_state';
import type { BattleAnimationData } from '../rom/extractors/battle_animations';
import { SPECIAL_EFFECT_IDS, playAnimation, type SubanimationHost } from './battle_subanimation';

const ROOT = resolve(__dirname, '../..');
const REFS = resolve(ROOT, '../refs/pokeyellow');
const data: BattleAnimationData = JSON.parse(readFileSync(resolve(ROOT, 'data/battle_animations.json'), 'utf8'));
const sfx = (name: string, id: number): BattleSfx =>
  ({ id, data: JSON.parse(readFileSync(resolve(ROOT, `data/audio/sfx/${name}.json`), 'utf8')) });
const ballPoof = sfx('ball_poof', 0x93), ballToss = sfx('ball_toss', 0x91), tink = sfx('tink', 0x8c);
const moveTiles: RawImage = PNG.sync.read(readFileSync(resolve(ROOT, 'static/gfx/battle/move_anim_0.png')));
const ID = { TOSS: 0xc1, SHAKE: 0xc2, POOF: 0xc3, BLOCKBALL: 0xc4, GREATTOSS: 0xc5, ULTRATOSS: 0xc6 } as const;
const BALL = { MASTER: 1, ULTRA: 2, GREAT: 3, POKE: 4 } as const;
/** LoadMoveAnimationTiles: 79 tiles, floor(79/8) + 1 serviced frames. */
const TILE_COPY = 10;

interface Rig { state: BattleState; screen: BattleScreen; host: SubanimationHost; plays: [number, number][]; frames: number;
  obp0: number[] }
function rig(id: number, setup: Partial<{ item: number; battle: number; animData: number; shakes: number; ball: boolean }> = {}): Rig {
  const state = new BattleState(), screen = new BattleScreen(), plays: [number, number][] = [];
  const r: Rig = { state, screen, plays, frames: 0, obp0: [], host: {
    screen, audio: { play: sound => { plays.push([sound.id, r.frames]); return true; } },
    renderTiles: { sprites: { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4).fill(255) } },
    moveAnimationTiles: moveTiles, ballPoof, animations: data,
    ...(setup.ball === false ? {} : { ball: { toss: ballToss, tink } }),
  } };
  state.wAnimationID = id;
  state.hWhoseTurn = 0; // ItemUseBall clears hWhoseTurn before MoveAnimation (item_effects.asm:437-441)
  state.wIsInBattle = setup.battle ?? 1;
  state.mem[I.wCurItem] = setup.item ?? BALL.POKE;
  state.mem[I.wPokeBallAnimData] = setup.animData ?? 0x43;
  state.mem[I.wNumShakes] = setup.shakes ?? 3;
  state.mem[MOVE_ANIM.wAnimPalette] = 0xe4;
  screen.obp0 = 0xe4;
  return r;
}
function run(r: Rig): number {
  for (const frame of playAnimation(r.state, r.host)) {
    expect(frame).toBe('serviced');
    r.screen.vblank(); r.frames++; r.obp0.push(r.screen.obp0);
  }
  return r.frames;
}

/** A constant's value: its position among the `const` lines after the file's first const_def. */
function constValue(path: string, name: string): number {
  const lines = readFileSync(resolve(REFS, path), 'utf8').split('\n').map(l => l.replace(/;.*/, '').trim()).filter(Boolean);
  let value = -1;
  for (let i = lines.indexOf('const_def') + 1; i < lines.length && lines[i] !== 'const_def'; i++) {
    if (!lines[i].startsWith('const ')) continue;
    value++;
    if (lines[i].slice(6).trim() === name) return value;
  }
  throw new Error(`${name} not in ${path}`);
}

describe('DoSpecialEffectByAnimationId (A5f checkpoint-02)', () => {
  it("SPECIAL_EFFECT_IDS is AnimationIdSpecialEffects' ID column, from pret's source", () => {
    const rows = readFileSync(resolve(REFS, 'data/battle_anims/special_effects.asm'), 'utf8').split('\n')
      .map(line => /^\s*anim_special_effect (\w+),/.exec(line)?.[1]).filter((name): name is string => !!name);
    expect(rows).toHaveLength(24);
    expect(SPECIAL_EFFECT_IDS).toEqual(rows.map(name => constValue('constants/move_constants.asm', name)));
    expect(SPECIAL_EFFECT_IDS).not.toContain(ID.BLOCKBALL);
  });

  it('a listed ID whose routine is not ported still throws (#94)', () => {
    const r = rig(0x05); // MEGA_PUNCH, given the toss's data so it reaches the table
    r.host.animations = { ...data, animations: [{ ...data.animations.find(a => a.id === ID.TOSS)!, id: 0x05, name: 'MEGA_PUNCH' }] };
    expect(() => run(r)).toThrow(new BattleUnsupportedState('special effects for $5 are #94'));
  });
});

describe('DoBallTossSpecialEffects (animations.asm:724-777)', () => {
  it.each([[ID.TOSS, BALL.POKE, 3], [ID.GREATTOSS, BALL.GREAT, 3], [ID.ULTRATOSS, BALL.ULTRA, 2]] as const)(
    'toss $%s: 11 frame blocks at %s+1 frames each after the tile copy, SFX_BALL_TOSS once at the first block',
    (id, item, delay) => {
      const r = rig(id, { item });
      expect(run(r)).toBe(TILE_COPY + 11 * (delay + 1));
      expect(r.plays).toEqual([[0x91, TILE_COPY + delay + 1]]);
      expect(r.screen.shadowOam(0)).toEqual({ y: 0, x: 0, tile: 0, attributes: 0 });
    });

  it('a Poké or Great Ball keeps OBP0; a Master or Ultra Ball complements colours 1 and 2 at every frame block', () => {
    const poke = rig(ID.TOSS, { item: BALL.POKE }); run(poke);
    expect(new Set(poke.obp0)).toEqual(new Set([0xe4]));
    const great = rig(ID.GREATTOSS, { item: BALL.GREAT }); run(great);
    expect(new Set(great.obp0)).toEqual(new Set([0xe4]));
    const master = rig(ID.ULTRATOSS, { item: BALL.MASTER }); run(master);
    // Block k is drawn, waits 2 + 1 frames, then flashes: block 0's frames see $E4, block 1's $D8, and so on.
    const perBlock = Array.from({ length: 11 }, (_, k) => master.obp0[TILE_COPY + k * 3]);
    expect(perBlock).toEqual(Array.from({ length: 11 }, (_, k) => k % 2 ? 0xe4 ^ 0x3c : 0xe4));
    // PlayAnimation pops rOBP0 after PlaySubanimation, though 11 flashes leave it complemented.
    expect(master.screen.obp0).toBe(0xe4);
  });

  it('a trainer battle draws one frame block fewer (the counter drops from 3 to 2)', () => {
    const r = rig(ID.TOSS, { battle: 2 });
    expect(run(r)).toBe(TILE_COPY + 10 * 4);
    expect(r.plays).toEqual([[0x91, TILE_COPY + 4]]);
  });

  it("a ghost's toss throws where the Marowak dodge would start: the ninth block, counter 3", () => {
    const r = rig(ID.TOSS, { animData: 0x10 });
    expect(() => run(r)).toThrow(BattleUnsupportedState);
    expect(r.frames).toBe(TILE_COPY + 9 * 4); // counters 11..3 are nine blocks; the effect runs after each clean frame
  });

  it('without the ball sounds bound the toss throws before any sound', () => {
    const r = rig(ID.TOSS, { ball: false });
    expect(() => run(r)).toThrow(new BattleUnsupportedState('the ball sub-animation sounds are not bound'));
    expect(r.plays).toEqual([]);
  });
});

describe('DoBallShakeSpecialEffects (animations.asm:779-811)', () => {
  it.each([1, 2, 3])('%i shake(s): four mode-4 blocks of 4 frames and a 40-frame tink at each start', shakes => {
    const r = rig(ID.SHAKE, { shakes });
    expect(run(r)).toBe(TILE_COPY + shakes * (4 * 4 + 40));
    expect(r.plays).toEqual(Array.from({ length: shakes }, (_, k) => [0x8c, TILE_COPY + k * 56 + 4]));
    expect(r.state.mem[I.wNumShakes]).toBe(0);
  });

  it('mode 4 never cleans: the last block stays in shadow OAM', () => {
    const r = rig(ID.SHAKE, { shakes: 1 });
    run(r);
    expect(r.screen.shadowOam(0)).not.toEqual({ y: 0, x: 0, tile: 0, attributes: 0 });
  });
});

describe('BLOCKBALL_ANIM and the catch poof', () => {
  it('the trainer block has no special effect: four blocks of 3 + 1 frames, no sound', () => {
    const r = rig(ID.BLOCKBALL, { battle: 2, ball: false });
    let frames = 0;
    expect(() => { frames = run(r); }).not.toThrow(); // IsInArray misses $C4: no routine, so no #94 throw either
    expect(frames).toBe(TILE_COPY + 4 * 4);
    expect(r.plays).toEqual([]);
  });

  it("the catch's poof (hWhoseTurn 0) plays SFX_BALL_POOF after its second block, as the send-out's does", () => {
    const r = rig(ID.POOF, { ball: false });
    expect(run(r)).toBe(TILE_COPY + 6 * 5);
    expect(r.plays).toEqual([[0x93, TILE_COPY + 2 * 5]]);
  });
});
