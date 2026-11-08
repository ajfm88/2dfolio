// A5e checkpoint-06b (note 81): the unused OAM sub-animation player, driven one serviced VBlank per yield.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BattleState } from './battle_state';
import { BattleScreen, type BattleOam } from './battle_screen';
import type { BattleSfx } from './battle_audio';
import type { RawImage } from './battle_screen_render';
import { BattleUnsupportedState } from './battle_move_data';
import { MOVE_ANIM } from './battle_move_anim';
import type { BattleAnimationData, FrameBlock, Subanimation } from '../rom/extractors/battle_animations';
import {
  SUBANIM, SUBANIMTYPE, drawFrameBlock, loadSubanimation, playAnimation, type SubanimationHost,
} from './battle_subanimation';
import type { Program } from './battle_menu_context';

const ROOT = resolve(__dirname, '../..');
const data: BattleAnimationData = JSON.parse(readFileSync(resolve(ROOT, 'data/battle_animations.json'), 'utf8'));
const png = (file: string): RawImage => PNG.sync.read(readFileSync(resolve(ROOT, 'static/gfx', file)));
const moveTiles = png('battle/move_anim_0.png');
const ballPoof: BattleSfx = { id: 0x93, data: JSON.parse(readFileSync(resolve(ROOT, 'data/audio/sfx/ball_poof.json'), 'utf8')) };
const POOF = 0xc3;
const SENTINEL: BattleOam = { y: 0x50, x: 0x50, tile: 0x31, attributes: 0x01 };

function atlas(): RawImage {
  const image = { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4).fill(255) };
  return image;
}
/** One tile's 64 red-channel bytes. */
function tilePixels(image: RawImage, tile: number): number[] {
  const across = image.width >>> 3, out: number[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
    out.push(image.data[((Math.floor(tile / across) * 8 + y) * image.width + (tile % across) * 8 + x) * 4]);
  return out;
}

interface Rig { state: BattleState; screen: BattleScreen; host: SubanimationHost; plays: number[]; frames: number }
function rig(): Rig {
  const state = new BattleState(), screen = new BattleScreen(), plays: number[] = [];
  const r: Rig = { state, screen, plays, frames: 0, host: {
    screen, audio: { play: sound => { plays.push(r.frames); expect(sound).toBe(ballPoof); return true; } },
    renderTiles: { sprites: atlas() }, moveAnimationTiles: moveTiles, ballPoof, animations: data,
  } };
  state.wAnimationID = POOF;
  state.hWhoseTurn = 1;
  state.mem[MOVE_ANIM.wAnimPalette] = 0xe4;
  screen.obp0 = 0xe4;
  for (let slot = 0; slot < 40; slot++) screen.setOam(slot, SENTINEL);
  screen.vblank();
  return r;
}
/** Run a Program, servicing each yielded frame; `each` sees the shown OAM after the VBlank. */
function run(r: Rig, program: Program, each?: (frame: number) => void): number {
  for (const frame of program) {
    expect(frame).toBe('serviced');
    r.screen.vblank(); r.frames++; each?.(r.frames);
  }
  return r.frames;
}
const shown = (screen: BattleScreen, count: number) => Array.from({ length: count }, (_, i) => screen.oam(i));

/** The HFLIP formulas (note 81 §5.2), applied to a committed frame block. */
function hflip(block: FrameBlock, baseY: number, baseX: number): BattleOam[] {
  return block.tiles.map(t => {
    const x = (168 - ((baseX + t.x) & 255)) & 255;
    return { y: (baseY + t.y + 40) & 255, x, tile: (t.tile + 0x31) & 255, attributes: (x >= 88 ? 3 : 2) | (t.flags ^ 0x20) };
  });
}

describe('playAnimation(POOF_ANIM) on the player side (hWhoseTurn = 1)', () => {
  it('takes 10 copy frames, then 5 shown frames per block, and ends with shadow OAM cleared', () => {
    const r = rig(), sub = data.subanimations.find(s => s.id === 10)!, seen: BattleOam[][] = [];
    const total = run(r, playAnimation(r.state, r.host), () => seen.push(shown(r.screen, 16)));
    expect(total).toBe(40);
    for (let frame = 0; frame < 10; frame++) expect(seen[frame][0]).toEqual(SENTINEL);
    sub.entries.forEach((entry, k) => {
      const block = data.frameBlocks.find(fb => fb.id === entry.frameBlock)!;
      const base = data.baseCoords.find(bc => bc.id === entry.baseCoord)!;
      const expected = hflip(block, base.y, base.x);
      for (let frame = 10 + k * 5; frame < 15 + k * 5; frame++)
        expect(seen[frame].slice(0, expected.length)).toEqual(expected);
    });
    expect(r.screen.oam(0)).not.toEqual({ y: 0, x: 0, tile: 0, attributes: 0 });
    expect(r.screen.shadowOam(0)).toEqual({ y: 0, x: 0, tile: 0, attributes: 0 });
  });

  it("pins block 1's first tile literally: Y 88, X 48, tile $54, X-flip with palette 2", () => {
    const r = rig();
    run(r, playAnimation(r.state, r.host), frame => {
      if (frame === 11) expect(r.screen.oam(0)).toEqual({ y: 88, x: 48, tile: 0x54, attributes: 0x22 });
    });
  });

  it('keeps entries above a block until the first clear, then clears all 40', () => {
    const r = rig(), at: Record<number, BattleOam> = {};
    run(r, playAnimation(r.state, r.host), frame => { at[frame] = r.screen.oam(12); });
    expect(at[11]).toEqual(SENTINEL); // FrameBlock06 has 12 tiles; entry 12 is untouched.
    expect(at[16]).not.toEqual(SENTINEL); // FrameBlock07 (16 tiles) overwrote it after the first clear.
    expect(r.screen.oam(39)).toEqual({ y: 0, x: 0, tile: 0, attributes: 0 });
  });

  it('plays SFX_BALL_POOF once, after block 2 (counter 5), at frame 20', () => {
    const r = rig();
    run(r, playAnimation(r.state, r.host));
    expect(r.plays).toEqual([20]);
  });

  it('leaves the WRAM and HRAM bytes the cartridge leaves, aliases included', () => {
    const r = rig();
    r.state.mem[SUBANIM.hROMBankTemp] = 0x31; // hBaseTileID
    run(r, playAnimation(r.state, r.host));
    const m = r.state.mem, S = SUBANIM;
    expect([m[S.wTempTilesetNumTiles], m[S.wBaseCoordY], m[S.wBaseCoordX], m[S.wFBTileCounter], m[S.wSubAnimFrameDelay],
      m[S.wSubAnimCounter], m[S.wNumFBTiles], m[S.wSubAnimTransform]]).toEqual([79, 0x28, 0x68, 12, 4, 0, 12, 2]);
    expect([m[S.wSubAnimAddrPtr], m[S.wSubAnimAddrPtr + 1], m[S.wSubAnimSubEntryAddr], m[S.wSubAnimSubEntryAddr + 1]])
      .toEqual([0x29, 0x69, 0x52, 0x6a]);
    expect([m[S.wFBDestAddr], m[S.wFBDestAddr + 1], m[S.wFBMode], m[S.wWhichBattleAnimTileset], m[S.wBattleObjPalID]])
      .toEqual([0xc3, 0x00, 0, 0, 2]);
    expect([m[MOVE_ANIM.wAnimSoundID], m[S.hROMBankTemp]]).toEqual([0xff, 0]);
  });

  it('copies 8 move-animation tiles per VBlank to $31+, publishing each frame, and never mutates the old atlas', () => {
    const r = rig(), before = r.host.renderTiles.sprites, original = Uint8ClampedArray.from(before.data);
    const atFrame: RawImage[] = [];
    run(r, playAnimation(r.state, r.host), frame => { if (frame <= 10) atFrame[frame] = r.host.renderTiles.sprites; });
    expect(tilePixels(atFrame[1], 0x31 + 7)).toEqual(tilePixels(moveTiles, 7));
    expect(tilePixels(atFrame[1], 0x31 + 8)).toEqual(tilePixels(before, 0x31 + 8));
    for (let tile = 0; tile < 79; tile++) expect(tilePixels(atFrame[10], 0x31 + tile)).toEqual(tilePixels(moveTiles, tile));
    expect(atFrame[1]).not.toBe(before);
    expect(Uint8ClampedArray.from(before.data)).toEqual(original);
  });

  it('swaps OBP0 to wAnimPalette for the sub-animation and restores it', () => {
    const r = rig(), during = new Set<number>();
    r.state.mem[MOVE_ANIM.wAnimPalette] = 0x1b;
    run(r, playAnimation(r.state, r.host), () => during.add(r.screen.obp0));
    expect([...during]).toEqual([0x1b]);
    expect(r.screen.obp0).toBe(0xe4);
  });

  it('refuses an animation ID with no traced data before any frame', () => {
    const r = rig();
    r.state.wAnimationID = 0x01;
    expect(() => run(r, playAnimation(r.state, r.host))).toThrow(BattleUnsupportedState);
    expect(r.frames).toBe(0);
  });
});

describe('LoadSubanimation', () => {
  const sub = (type: number, count: number): Subanimation => ({ id: 1, pointer: 0x6917, address: 0x6000, type,
    entries: Array.from({ length: count }, () => ({ frameBlock: 6, baseCoord: 0x1b, mode: 0 })) });
  it.each([
    [SUBANIMTYPE.NORMAL, 0, 0], [SUBANIMTYPE.NORMAL, 1, 0], [SUBANIMTYPE.HFLIP, 0, 0], [SUBANIMTYPE.HFLIP, 1, 2],
    [SUBANIMTYPE.REVERSE, 1, 4], [SUBANIMTYPE.ENEMY, 0, 2], [SUBANIMTYPE.ENEMY, 1, 0],
  ])('type %i with hWhoseTurn %i stores transform %i', (type, turn, transform) => {
    const state = new BattleState(); state.hWhoseTurn = turn;
    state.mem[SUBANIM.wSubAnimAddrPtr] = 0x17; state.mem[SUBANIM.wSubAnimAddrPtr + 1] = 0x69;
    loadSubanimation(state, sub(type, 3));
    expect(state.mem[SUBANIM.wSubAnimTransform]).toBe(transform);
    expect(state.mem[SUBANIM.wSubAnimCounter]).toBe(3);
  });
  it.each([[3, 0x6001 + 6], [1, (0x6001 + 768) & 0xffff]])('a reversed %i-entry list starts at %i (do-while: 1 entry loops 256 times)',
    (count, start) => {
      const state = new BattleState(); state.hWhoseTurn = 1;
      state.mem[SUBANIM.wSubAnimAddrPtr] = 0x17; state.mem[SUBANIM.wSubAnimAddrPtr + 1] = 0x69;
      loadSubanimation(state, sub(SUBANIMTYPE.REVERSE, count));
      expect(state.mem[SUBANIM.wSubAnimSubEntryAddr] | state.mem[SUBANIM.wSubAnimSubEntryAddr + 1] << 8).toBe(start);
    });
});

describe('DrawFrameBlock on synthetic blocks', () => {
  const block: FrameBlock = { id: 0, tiles: [
    { y: 0, x: 0, tile: 1, flags: 0 }, { y: 8, x: 8, tile: 2, flags: 0x20 },
    { y: 0, x: 40, tile: 3, flags: 0x40 }, { y: 0, x: 0, tile: 4, flags: 0x60 },
  ] };
  function draw(transform: number, mode = 0, animation = 0xc3): { oam: BattleOam[]; frames: number; state: BattleState; screen: BattleScreen } {
    const state = new BattleState(), screen = new BattleScreen();
    state.wAnimationID = animation;
    state.mem[SUBANIM.wSubAnimTransform] = transform; state.mem[SUBANIM.wFBMode] = mode;
    state.mem[SUBANIM.wSubAnimFrameDelay] = 4; state.mem[SUBANIM.wBaseCoordY] = 0x30; state.mem[SUBANIM.wBaseCoordX] = 0x50;
    state.mem[SUBANIM.wFBDestAddr] = 0xc3; state.mem[SUBANIM.wFBDestAddr + 1] = 0x04;
    const oam: BattleOam[] = [];
    let frames = 0;
    for (const _ of drawFrameBlock(state, screen, block)) { void _; frames++; if (frames === 1) for (let i = 1; i < 5; i++) oam.push(screen.shadowOam(i)); }
    if (frames === 0) for (let i = 1; i < 5; i++) oam.push(screen.shadowOam(i));
    return { oam, frames, state, screen };
  }
  it('no transform: base + offset, flags kept, palette 3 from X >= 88', () => {
    expect(draw(0, 2).oam).toEqual([
      { y: 0x30, x: 0x50, tile: 0x32, attributes: 2 }, { y: 0x38, x: 0x58, tile: 0x33, attributes: 0x23 },
      { y: 0x30, x: 0x78, tile: 0x34, attributes: 0x43 }, { y: 0x30, x: 0x50, tile: 0x35, attributes: 0x62 },
    ]);
  });
  it('HVFLIP: 136 − and 168 − the sum, flag table (0→YX, X→Y, Y→X, YX→none)', () => {
    expect(draw(SUBANIMTYPE.HVFLIP, 2).oam).toEqual([
      { y: 0x58, x: 0x58, tile: 0x32, attributes: 0x63 }, { y: 0x50, x: 0x50, tile: 0x33, attributes: 0x42 },
      { y: 0x58, x: 0x30, tile: 0x34, attributes: 0x22 }, { y: 0x58, x: 0x58, tile: 0x35, attributes: 0x03 },
    ]);
  });
  it('HFLIP: Y + 40, 168 − X, X-flip toggled', () => {
    expect(draw(SUBANIMTYPE.HFLIP, 2).oam).toEqual([
      { y: 0x58, x: 0x58, tile: 0x32, attributes: 0x23 }, { y: 0x60, x: 0x50, tile: 0x33, attributes: 0x02 },
      { y: 0x58, x: 0x30, tile: 0x34, attributes: 0x62 }, { y: 0x58, x: 0x58, tile: 0x35, attributes: 0x43 },
    ]);
  });
  it('COORDFLIP: flipped base plus the unflipped offset, flags kept', () => {
    expect(draw(SUBANIMTYPE.COORDFLIP, 2).oam).toEqual([
      { y: 0x58, x: 0x58, tile: 0x32, attributes: 3 }, { y: 0x60, x: 0x60, tile: 0x33, attributes: 0x23 },
      { y: 0x58, x: 0x80, tile: 0x34, attributes: 0x43 }, { y: 0x58, x: 0x58, tile: 0x35, attributes: 0x63 },
    ]);
  });
  it.each([
    // mode, frames, dest after (high, low), cleared
    [0, 5, [0xc3, 0x00], true], [1, 5, [0xc3, 0x00], true], [2, 0, [0xc3, 0x14], false],
    [3, 4, [0xc3, 0x14], false], [4, 4, [0xc3, 0x04], false],
  ])('mode %i: %i frames, wFBDestAddr %j, cleared %s', (mode, frames, dest, cleared) => {
    const r = draw(0, mode);
    expect(r.frames).toBe(frames);
    expect([r.state.mem[SUBANIM.wFBDestAddr], r.state.mem[SUBANIM.wFBDestAddr + 1]]).toEqual(dest);
    expect(r.screen.shadowOam(1).tile === 0).toBe(cleared);
  });
  it('GROWL skips AnimationCleanOAM but still resets the destination', () => {
    const r = draw(0, 0, 0x2d);
    expect(r.frames).toBe(4);
    expect(r.screen.shadowOam(1).tile).toBe(0x32);
    expect([r.state.mem[SUBANIM.wFBDestAddr], r.state.mem[SUBANIM.wFBDestAddr + 1]]).toEqual([0xc3, 0x00]);
  });
});
