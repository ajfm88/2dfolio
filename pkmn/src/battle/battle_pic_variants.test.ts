// A5e checkpoint-08b (note 83): the unused picture variants on the real host, screen, renderer and committed data.
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { A, BattleState, POKEDEX_ORDER, W_SPRITE_FLIPPED } from './battle_state';
import { BattleHost } from './battle_host';
import { loadBattleData } from './data';
import { loadBattleRenderTiles } from './battle_pictures';
import { renderBattleScreen, type BattleRenderTiles, type RawImage } from './battle_screen_render';
import { textBgTransfer } from '../text/bg_transfer';
import { D } from './battle_end_state';
import { installTrainerSpecies } from './battle_trainer_party';
import { loadTrainerSpeciesData } from './battle_trainer_data';
import type { Program } from './battle_menu_context';
import type { BattleAnimationData } from '../rom/extractors/battle_animations';
import {
  PIC_VARIANT, animateSubstituteBreaking, animationFlashMonPic, animationHideMonPic, animationMinimizeMon,
  animationSlideMonDown, animationSubstitute, animationTransformMon, hideSubstituteShowMonAnim, reshowSubstituteAnim,
  tempPicImage, type PicVariantHost,
} from './battle_pic_variants';

const ROOT = resolve(__dirname, '../..');
const png = (file: string): RawImage => PNG.sync.read(readFileSync(resolve(ROOT, 'static', file)));
const animations: BattleAnimationData = JSON.parse(readFileSync(resolve(ROOT, 'data/battle_animations.json'), 'utf8'));
const monster = png('gfx/sprites/monster.png');
const PIKACHU = 0x54, PIDGEY = 0x24, MISSINGNO = 0x1f, FLY = 0x13, DIG = 0x5b;
const SHADES = [255, 170, 85, 0];
let shared: BattleRenderTiles;
beforeAll(async () => {
  await loadBattleData(); await loadTrainerSpeciesData();
  shared = await loadBattleRenderTiles(async file => png(file));
});

interface Rig { s: BattleState; driver: BattleHost; host: PicVariantHost & { renderTiles: BattleRenderTiles } }
function rig(turn: 0 | 1): Rig {
  const s = new BattleState(), driver = new BattleHost(s), screen = driver.video.screen;
  installTrainerSpecies(s);
  s.hWhoseTurn = turn;
  s.wBattleMonSpecies = s.wBattleMonSpecies2 = PIKACHU;
  s.wEnemyMonSpecies = s.wEnemyMonSpecies2 = PIDGEY;
  s.wPlayerMonNumber = 0; s.mem[A.wPartyMons] = PIKACHU;
  s.mem.fill(0xa5, PIC_VARIANT.wTempPic, PIC_VARIANT.wTempPic + 784); // stale wOverworldMap bytes
  textBgTransfer.enabled = true;
  const renderTiles: BattleRenderTiles = { ...shared, pictures: new Map(shared.pictures) };
  return { s, driver, host: {
    screen, renderTiles, monsterSprite: monster, minimizedMonSprite: animations.minimizedMonSprite,
    frontPicture: st => `front/${POKEDEX_ORDER[st.wCurPartySpecies - 1]}`,
    backPicture: st => `back/${POKEDEX_ORDER[st.wBattleMonSpecies2 - 1]}`,
  } };
}
/** Run to completion; `frames` is the step at which the routine returned (held frames count). */
function run(r: Rig, program: Program, each?: (frame: number) => void): { frames: number; kinds: string[] } {
  let frames = 0, returned = -1; const kinds: string[] = [];
  r.driver.start((function* () { yield* program; returned = frames; yield 'serviced'; })());
  while (!r.driver.done && frames < 500) { each?.(frames); frames++; kinds.push(String(r.driver.step())); }
  expect(r.driver.done).toBe(true);
  return { frames: returned, kinds: kinds.slice(0, returned) };
}
const screen = (r: Rig) => r.host.screen;
const area = (r: Rig, player: boolean) => Array.from({ length: 49 }, (_, i) =>
  screen(r).at((player ? 1 : 12) + (i % 7), (player ? 5 : 0) + Math.floor(i / 7)));
const placed = (base: number) => Array.from({ length: 49 }, (_, i) => base + Math.floor(i / 7) + 7 * (i % 7));
const tile = (r: Rig, t: number) => [...r.s.mem.subarray(PIC_VARIANT.wTempPic + t * 16, PIC_VARIANT.wTempPic + t * 16 + 16)];
/** MonsterSprite tile n as 2bpp bytes, from the PNG. */
function monsterTile(n: number): number[] {
  const out: number[] = [];
  for (let row = 0; row < 8; row++) {
    let lo = 0, hi = 0;
    for (let col = 0; col < 8; col++) {
      const index = SHADES.indexOf(monster.data[(((n >> 1) * 8 + row) * monster.width + (n & 1) * 8 + col) * 4]);
      lo |= (index & 1) << (7 - col); hi |= (index >> 1) << (7 - col);
    }
    out.push(lo, hi);
  }
  return out;
}
const slotNames = (r: Rig, player: boolean) => [...new Set(Array.from({ length: 49 }, (_, i) =>
  (player ? screen(r).backSlot(0x31 + i) : screen(r).frontSlot(i))?.picture))];

describe('wTempPic composition', () => {
  it.each([[1, 'enemy', [[0, 2, 4], [1, 3, 4], [2, 2, 5], [3, 3, 5]]], [0, 'player', [[4, 3, 4], [5, 4, 4], [6, 3, 5], [7, 4, 5]]]] as const)(
    'AnimationSubstitute on the %s turn (%s): zeroed buffer, four doll tiles, 7 copy frames + Delay3', (turn, _, tiles) => {
      const r = rig(turn), player = turn === 0;
      expect(run(r, animationSubstitute(r.s, r.host)).frames).toBe(10);
      const doll = new Map(tiles.map(([n, x, y]) => [x * 7 + y, n]));
      for (let t = 0; t < 49; t++) expect(tile(r, t), `tile ${t}`).toEqual(doll.has(t) ? monsterTile(doll.get(t)!) : Array(16).fill(0));
      const [key] = slotNames(r, player);
      expect(slotNames(r, player)).toEqual([key]); expect(key).toMatch(/^wTempPic#\d+$/);
      expect(area(r, player)).toEqual(placed(player ? 0x31 : 0));
      expect([r.s.mem[PIC_VARIANT.hBaseTileID], textBgTransfer.enabled]).toEqual([player ? 0x31 : 0, true]);
    });

  it('AnimationMinimizeMon: the five rows at $194, each to both bitplanes; 7 + Delay3 + Delay3 = 13 frames', () => {
    const r = rig(1);
    expect(run(r, animationMinimizeMon(r.s, r.host)).frames).toBe(13);
    const blob = Array(16).fill(0);
    animations.minimizedMonSprite.forEach((row, i) => { blob[4 + i * 2] = blob[5 + i * 2] = row; });
    for (let t = 0; t < 49; t++) expect(tile(r, t)).toEqual(t === 25 ? blob : Array(16).fill(0));
    expect(blob.slice(4, 14)).toEqual([0x18, 0x18, 0x3c, 0x3c, 0x7e, 0x7e, 0x3c, 0x3c, 0x24, 0x24]);
  });

  it('every composition is a new, never-mutated picture, decoded from wTempPic', () => {
    const r = rig(1), initial = r.host.renderTiles.pictures;
    run(r, animationSubstitute(r.s, r.host));
    const [first] = slotNames(r, false), image = r.host.renderTiles.pictures.get(first!)!, copy = new Uint8ClampedArray(image.data);
    expect([r.host.renderTiles.pictures === initial, initial.has(first!)]).toEqual([false, false]); // a new map each time
    expect(image).toEqual(tempPicImage(r.s));
    run(r, animationMinimizeMon(r.s, r.host));
    const [second] = slotNames(r, false);
    expect(second).not.toBe(first);
    expect(r.host.renderTiles.pictures.get(first!)).toBe(image); expect(image.data).toEqual(copy);
    expect(shared.pictures.has(first!)).toBe(false); // the shared map is replaced, never mutated
  });

  it('the renderer draws the doll from the composed picture', () => {
    const r = rig(1);
    const before = renderBattleScreen(screen(r), r.host.renderTiles);
    run(r, animationSubstitute(r.s, r.host));
    const after = renderBattleScreen(screen(r), r.host.renderTiles);
    const changed = (x0: number, y0: number) => {
      for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) if (before[(y * 160 + x) * 4] !== after[(y * 160 + x) * 4]) return true;
      return false;
    };
    // Enemy picture at (12,0): the doll's tiles are columns 2-3, rows 4-5; column 0 row 0 stays blank.
    expect([changed((12 + 2) * 8, 4 * 8), changed((12 + 3) * 8, 5 * 8), changed(12 * 8, 0)]).toEqual([true, true, false]);
  });
});

describe('tilemap helpers', () => {
  it('AnimationSlideMonDown: seven Delay3 steps, each one row lower, cleared after each; 21 frames', () => {
    const r = rig(0), steps: (number | string | null)[][] = [];
    for (let i = 0; i < 49; i++) screen(r).put(1 + (i % 7), 5 + Math.floor(i / 7), 0x31 + Math.floor(i / 7) + 7 * (i % 7));
    const out = run(r, animationSlideMonDown(r.s, screen(r)), frame => { if (frame % 3 === 1) steps.push(area(r, true)); });
    expect(out.frames).toBe(21);
    steps.forEach((cells, step) => expect(cells, `step ${step}`).toEqual(Array.from({ length: 49 }, (_, i) => {
      const row = Math.floor(i / 7) - step;
      return row < 0 ? ' ' : 0x31 + row + 7 * (i % 7);
    })));
    expect(area(r, true)).toEqual(Array(49).fill(' '));
  });

  it('AnimationHideMonPic clears only the actor side', () => {
    const r = rig(1);
    for (let i = 0; i < 49; i++) { screen(r).put(12 + (i % 7), Math.floor(i / 7), 'A'); screen(r).put(1 + (i % 7), 5 + Math.floor(i / 7), 'B'); }
    animationHideMonPic(r.s, screen(r));
    expect([area(r, false), area(r, true)]).toEqual([Array(49).fill(' '), Array(49).fill('B')]);
  });
});

describe('ChangeMonPic', () => {
  it('Transform on the player turn: the enemy species as the back picture, wBattleMonSpecies2 restored, SET_PAL_BATTLE', () => {
    const r = rig(0), out = run(r, animationTransformMon(r.s, r.host));
    expect(out.frames).toBe(19); // LoadMonBackPic 14, then SET_PAL_BATTLE's 2 held + Delay3
    expect(out.kinds.slice(14)).toEqual(['held', 'held', 'serviced', 'serviced', 'serviced']);
    expect([r.s.mem[PIC_VARIANT.wChangeMonPicPlayerTurnSpecies], r.s.mem[PIC_VARIANT.wChangeMonPicEnemyTurnSpecies]]).toEqual([PIDGEY, PIKACHU]);
    expect([r.s.wBattleMonSpecies2, r.s.wCurSpecies, r.s.wCurPartySpecies]).toEqual([PIKACHU, PIDGEY, PIDGEY]);
    expect(slotNames(r, true)).toEqual(['back/16']);
    expect(area(r, true)).toEqual(placed(0x31));
    expect(screen(r).paletteName(2)).toBe('YELLOWMON'); // SET_PAL_BATTLE reads the party slot: Pikachu's palette stays
  });

  it('Transform on the enemy turn: the player species as the front picture, unflipped, hStartTileID 0', () => {
    const r = rig(1); r.s.mem[W_SPRITE_FLIPPED] = 1;
    expect(run(r, animationTransformMon(r.s, r.host)).frames).toBe(12); // 7 + 5
    expect([r.s.wCurPartySpecies, r.s.wCurSpecies, r.s.mem[W_SPRITE_FLIPPED], r.s.mem[D.hStartTileID]]).toEqual([PIKACHU, PIKACHU, 0, 0]);
    expect(slotNames(r, false)).toEqual(['front/25']);
    expect(area(r, false)).toEqual(placed(0));
  });

  it("the Rhydon trap: an invalid dex number sets RHYDON and loads nothing, but the palette still runs", () => {
    // The port has no MissingNo header (getMonHeader throws, a recorded departure), so give $1F a synthetic one.
    const r = rig(1), real = r.s.species.bind(r.s);
    r.s.species = id => real((id & 0xff) === MISSINGNO ? PIDGEY : id);
    r.s.mem[PIC_VARIANT.wChangeMonPicEnemyTurnSpecies] = MISSINGNO; r.s.wBattleMonSpecies = MISSINGNO;
    const before = area(r, false);
    expect(run(r, animationTransformMon(r.s, r.host)).frames).toBe(5);
    expect([r.s.wCurPartySpecies, slotNames(r, false), area(r, false)]).toEqual([0x01, [undefined], before]);
  });

  it("AnimationFlashMonPic reloads the actor's own picture", () => {
    const r = rig(0); expect(run(r, animationFlashMonPic(r.s, r.host)).frames).toBe(19);
    expect(slotNames(r, true)).toEqual(['back/25']);
  });
});

describe('HideSubstituteShowMonAnim, ReshowSubstituteAnim, AnimateSubstituteBreaking', () => {
  const sub = (r: Rig, up: boolean) => { if (r.s.hWhoseTurn) r.s.wEnemyBattleStatus2 = up ? 0x10 : 0; else r.s.wPlayerBattleStatus2 = up ? 0x10 : 0; };
  it('substitute still up: SlideMonOff (24), then FlashMonPic (19) and ShowMonPic (3)', () => {
    const r = rig(0); sub(r, true);
    expect(run(r, hideSubstituteShowMonAnim(r.s, r.host)).frames).toBe(46);
    expect([slotNames(r, true), area(r, true)]).toEqual([['back/25'], placed(0x31)]);
  });
  it('substitute broke: SlideMonDown (21) instead', () => {
    const r = rig(0); sub(r, false);
    expect(run(r, hideSubstituteShowMonAnim(r.s, r.host)).frames).toBe(43);
  });
  it('minimized: AnimationMinimizeMon after the slide', () => {
    const r = rig(1); sub(r, true); r.s.wEnemyMonMinimized = 1;
    expect(run(r, hideSubstituteShowMonAnim(r.s, r.host)).frames).toBe(24 + 13);
    expect(tile(r, 25).slice(4, 6)).toEqual([0x18, 0x18]);
  });
  it('Fly, not yet INVULNERABLE: the back picture is reloaded but never placed', () => {
    const r = rig(0); sub(r, true); r.s.wPlayerMoveNum = FLY;
    expect(run(r, hideSubstituteShowMonAnim(r.s, r.host)).frames).toBe(24 + 14);
    expect([slotNames(r, true), r.s.wCurSpecies]).toEqual([['back/25'], PIKACHU]);
    expect(area(r, true).every(cell => cell === ' ' || typeof cell === 'number')).toBe(true);
    expect(area(r, true)).not.toEqual(placed(0x31));
  });
  it('Fly while INVULNERABLE takes the ordinary path (the ASM checks the bit first)', () => {
    const r = rig(0); sub(r, true); r.s.wPlayerMoveNum = FLY; r.s.wPlayerBattleStatus1 = 0x40;
    expect(run(r, hideSubstituteShowMonAnim(r.s, r.host)).frames).toBe(46);
  });
  it('Dig while minimized: the blob is copied with no ShowMonPic', () => {
    const r = rig(1); sub(r, true); r.s.wEnemyMoveNum = DIG; r.s.wEnemyMonMinimized = 1;
    expect(run(r, hideSubstituteShowMonAnim(r.s, r.host)).frames).toBe(24 + 7);
  });
  it('enemy Dig: LoadMonFrontSprite only (7)', () => {
    const r = rig(1); sub(r, true); r.s.wEnemyMoveNum = DIG;
    expect(run(r, hideSubstituteShowMonAnim(r.s, r.host)).frames).toBe(24 + 7);
    expect([slotNames(r, false), r.s.wCurPartySpecies]).toEqual([['front/16'], PIDGEY]);
  });
  it('ReshowSubstituteAnim: SlideMonOff, AnimationSubstitute, ShowMonPic again (24 + 10 + 3)', () => {
    const r = rig(1);
    expect(run(r, reshowSubstituteAnim(r.s, r.host)).frames).toBe(37);
    expect(slotNames(r, false)[0]).toMatch(/^wTempPic#/);
    expect(area(r, false)).toEqual(placed(0));
  });
  it.each([[1, 13], [0, 15]])('AnimateSubstituteBreaking (enemy) with minimized = %i is %i frames', (minimized, frames) => {
    const r = rig(1); r.s.wEnemyMonMinimized = minimized;
    expect(run(r, animateSubstituteBreaking(r.s, r.host)).frames).toBe(frames);
  });
});
