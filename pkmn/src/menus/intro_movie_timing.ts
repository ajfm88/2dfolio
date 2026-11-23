// Opening checkpoint-12b2c2-2c3a (note 138): the intro movie's own foreground instruction streams, PlayIntroScene
// through scenes 0-5, the temporary scene-6 cutoff and the exit (engine/movie/intro_yellow.asm). UNUSED: nothing in
// the game imports this file; 2c3b composes it with the runner and unit 3 wires it.
//
// The same protocol as note 133's helpers (intro_helper_timing.ts): one yield per native instruction, its machine
// cycles, the pret routine on its first instruction, read/store marks at their trailing dots, and HALT/GDMA/audio
// steps from the reviewed helpers reached by yield*. Branches follow read replies, never ROM. The caller owns the
// incoming CALL of every exported stream except where a comment says otherwise. RunObjectAnimations' body comes from
// the caller (introObjectAnimationSteps adapts 2a's reviewed cost stream).
//
// Evidence: notes/138-opening-checkpoint-12b2c2-2c3, pinned SameBoy CGB-E on the user's cartridge. Stores take effect
// four dots before the instruction ends, rIF three, and rBGP/rOBP0/rOBP1 six: SameBoy's CGB-D/E palette write
// conflict writes them a machine cycle early (Core/sm83_cpu.c GB_CONFLICT_PALETTE_CGB), not visible to the CGB PPU.
// rSTAT is written twice by that core (GB_CONFLICT_STAT_CGB, one dot apart, both $08 here); the first is the store.
import {
  INTRO_CPU_STORE_TRAILING_DOTS as STORE, INTRO_IF_STORE_TRAILING_DOTS, introBankswitchSteps,
  introClearObjectAnimationBuffersSteps, introCopyVideoDataSteps, introDelayFrameSteps, introDisableLcdSteps,
  introDmgPalToCgbPalSteps, introGetCgbBasePalAddressSteps, introInitCgbPalettesSteps, introJoypadLowSensitivitySteps,
  introPlayMusicSteps, introRunPaletteCommandSteps, introTransferCurPalDataSteps, introUpdateCgbPalBgpSteps,
  introUpdateCgbPalObp0Steps, introUpdateCgbPalObp1Steps, introUpdateMusicCTimesSteps,
  type IntroCopyVideoInput, type IntroForegroundStep, type IntroHelperInsn, type IntroHelperReply,
  type IntroHelperSources,
} from './intro_helper_timing';
import type { IntroObjectEngine } from './intro_objects';

/** rBGP/rOBP0/rOBP1 stores: SameBoy's CGB-D/E palette write conflict (see the header). */
export const INTRO_DMG_PALETTE_STORE_TRAILING_DOTS = 6;
/** The scene the temporary checkpoint cutoff stops at (note 128 §8; checkpoint 13 replaces it with scene 6). */
export const INTRO_MOVIE_CUTOFF_SCENE = 6;

const FRAMESET_PIKACHU_FAR = 1;
const FRAMESET_PIKACHU_MID = 2;
const FRAMESET_PIKACHU_UNUSED = 4;
const FRAMESET_SPEED_BAR = 8;
const BG_MAP_WIDTH = 32;
const GRAPHIC_OFFSET = 6 * BG_MAP_WIDTH + 20; // hlbgcoord 20, 6
const OBJECT_SLOTS = 10;
const OBJECT_STRUCT_BYTES = 16;
const SCREEN_AREA = 360;
const CHAR_SPACE = 0x7f;
const PAD_A_B_START = 0x0b;
const PALETTE_ACTION_BANK = 0x1c;
// Linked addresses from pret b452f2ab, wram.asm and data/sgb/sgb_palettes.asm.
const OBJECT_STRUCTS_ADDRESS = 0xc51c;
const PAL_MEWMON = 0x10; // PalPacket_Generic's first palette, eight bytes per palette.

type Gen = Generator<IntroForegroundStep, void, IntroHelperReply>;
type Ret<T> = Generator<IntroForegroundStep, T, IntroHelperReply>;

/** The two ROM tables the movie's spawns copy (the extracted intro tables): 3-byte spawn states, speed-bar e/d/speed. */
export interface IntroMovieTables {
  readonly spawnStates: readonly (readonly number[])[];
  readonly speedBars: readonly (readonly number[])[];
}
export interface IntroMovieEntryInput {
  /** YellowIntroGraphics2 → vChars0 (255 tiles), then YellowIntroGraphics1 → vChars2 (128 tiles). */
  readonly copies: readonly [IntroCopyVideoInput, IntroCopyVideoInput];
}
export type IntroMovieLoopHead = 'dispatch' | 'exit' | 'cutoff';

function byte(value: IntroHelperReply, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255)
    throw new RangeError(`Intro movie ${field} read needs a byte`);
  return value;
}
function* read(cycles: number, field: string, op: string, routine?: string): Ret<number> {
  const step: IntroHelperInsn = { cycles, op, read: { field, trailingDots: STORE } };
  return byte(yield routine ? { ...step, routine } : step, field);
}
function st(cycles: number, field: string, value: number, op: string, trailing = STORE): IntroHelperInsn {
  return { cycles, op, store: { field, trailingDots: trailing, value: value & 255 } };
}
function call(op: string): IntroHelperInsn { return { cycles: 6, op: `call ${op}`, control: 'call' }; }
const RET: IntroHelperInsn = { cycles: 4, op: 'ret', control: 'ret' };
function named(step: IntroHelperInsn, routine: string): IntroHelperInsn { return { ...step, routine }; }

/** YellowIntro_FillMemory: count bytes of value from hl, six instructions a byte (10 cycles, 9 on the last). */
function* fillMemory(region: string, start: number, count: number, value: number): Gen {
  yield { cycles: 4, op: 'push de', routine: 'YellowIntro_FillMemory' };
  yield { cycles: 1, op: 'ld e,a' };
  for (let i = 0; i < count; i++) {
    yield { cycles: 1, op: 'ld a,e' };
    yield st(2, `${region}[${start + i}]`, value, 'ld [hli],a');
    yield { cycles: 2, op: 'dec bc' };
    yield { cycles: 1, op: 'ld a,c' };
    yield { cycles: 1, op: 'or b' };
    yield { cycles: i < count - 1 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
  }
  yield { cycles: 3, op: 'pop de' };
  yield RET;
}
/** The caller's `ld hl / ld bc / value / call YellowIntro_FillMemory`, then the fill. */
function* fillCall(region: string, start: number, count: number, value: number, valueOp: 'xor a' | 'ld a,n'): Gen {
  yield { cycles: 3, op: 'ld hl,n' };
  yield { cycles: 3, op: 'ld bc,n' };
  yield valueOp === 'xor a' ? { cycles: 1, op: 'xor a' } : { cycles: 2, op: `ld a,${value}` };
  yield call('YellowIntro_FillMemory');
  yield* fillMemory(region, start, count, value);
}

function* delayFrameCall(): Gen {
  yield call('DelayFrame');
  yield* introDelayFrameSteps();
}
function* cgbPaletteCalls(): Gen {
  yield call('UpdateCGBPal_BGP');
  yield* introUpdateCgbPalBgpSteps();
  yield call('UpdateCGBPal_OBP0');
  yield* introUpdateCgbPalObp0Steps();
  yield call('UpdateCGBPal_OBP1');
  yield* introUpdateCgbPalObp1Steps();
}
function* dmgPaletteStores(bgp: number, obp0: number, obp1: number): Gen {
  const t = INTRO_DMG_PALETTE_STORE_TRAILING_DOTS;
  yield st(3, 'rBGP', bgp, 'ldh [rBGP],a', t);
  yield st(3, 'rOBP0', obp0, 'ldh [rOBP0],a', t);
  if (obp1 !== obp0) yield { cycles: 2, op: `ld a,${obp1}` };
  yield st(3, 'rOBP1', obp1, 'ldh [rOBP1],a', t);
}
function* requireCgb(routine?: string): Gen {
  const on = yield* read(3, 'hOnCGB', 'ldh a,[hOnCGB]', routine);
  yield { cycles: 1, op: 'and a' };
  if (!on) throw new RangeError('The intro movie on DMG/SGB is unsupported');
  yield { cycles: 2, op: 'jr z,.dmg_sgb', control: 'jr' };
}

// ---- entry ---------------------------------------------------------------------------------------------------------

function* blankTileMap(): Gen {
  yield { cycles: 3, op: 'ld hl,wTileMap', routine: 'YellowIntro_BlankTileMap' };
  yield { cycles: 3, op: 'ld bc,SCREEN_AREA' };
  yield { cycles: 2, op: "ld a,' '" };
  yield call('YellowIntro_FillMemory');
  yield* fillMemory('wTileMap', 0, SCREEN_AREA, CHAR_SPACE);
  yield RET;
}
function* loadObjectDataPointers(): Gen {
  // YellowIntro_AnimatedObject{SpawnStateData,Jumptable,OAMData,FramesData} in pokeyellow.sym.
  const pointers = [
    ['wAnimatedObjectSpawnStateDataPointer', 0x5fda], ['wAnimatedObjectJumptablePointer', 0x5ffb],
    ['wAnimatedObjectOAMDataPointer', 0x613d], ['wAnimatedObjectFramesDataPointer', 0x60ea],
  ] as const;
  let first = true;
  for (const [field, address] of pointers) for (const [half, byte] of [['', address & 255], ['+1', address >> 8]] as const) {
    yield first ? { cycles: 2, op: 'ld a,n', routine: 'LoadYellowIntroObjectAnimationDataPointers' } : { cycles: 2, op: 'ld a,n' };
    first = false;
    yield st(4, `${field}${half}`, byte, `ld [${field}${half}],a`);
  }
  yield RET;
}
function* initGfxAndMusic(input: IntroMovieEntryInput, sources: IntroHelperSources): Gen {
  yield { cycles: 1, op: 'xor a', routine: 'InitYellowIntroGFXAndMusic' };
  yield st(3, 'hAutoBGTransferEnabled', 0, 'ldh [hAutoBGTransferEnabled],a');
  yield st(3, 'hSCX', 0, 'ldh [hSCX],a');
  yield st(3, 'hSCY', 0, 'ldh [hSCY],a');
  yield st(3, 'hAutoBGTransferDest', 0, 'ldh [hAutoBGTransferDest],a');
  yield { cycles: 2, op: 'ld a,$98' };
  yield st(3, 'hAutoBGTransferDest+1', 0x98, 'ldh [hAutoBGTransferDest+1],a');
  yield call('YellowIntro_BlankTileMap');
  yield* blankTileMap();
  yield* fillCall('wTileMap', 0, SCREEN_AREA, 1, 'ld a,n');
  yield* fillCall('wTileMap', 4 * 20, 200, 0, 'xor a');
  yield { cycles: 2, op: 'ld a,1' };
  yield st(3, 'hAutoBGTransferEnabled', 1, 'ldh [hAutoBGTransferEnabled],a');
  for (let i = 0; i < 3; i++) yield* delayFrameCall();
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'hAutoBGTransferEnabled', 0, 'ldh [hAutoBGTransferEnabled],a');
  for (const copy of input.copies) {
    yield { cycles: 3, op: 'ld de,n' };
    yield { cycles: 3, op: 'ld hl,n' };
    yield { cycles: 3, op: 'lb bc,n,n' };
    yield call('CopyVideoData');
    yield* introCopyVideoDataSteps(copy);
  }
  yield call('ClearObjectAnimationBuffers');
  yield* introClearObjectAnimationBuffersSteps();
  yield call('LoadYellowIntroObjectAnimationDataPointers');
  yield* loadObjectDataPointers();
  yield { cycles: 2, op: 'ld b,SET_PAL_GENERIC' };
  yield call('RunPaletteCommand');
  yield* introRunPaletteCommandSteps(sources, input.copies[1].source);
  yield { cycles: 1, op: 'xor a' };
  yield { cycles: 3, op: 'ld hl,wYellowIntroCurrentScene' };
  for (const field of ['wYellowIntroCurrentScene', 'wYellowIntroSceneTimer', 'wYellowIntroAnimatedObjectStructPointer'])
    yield st(2, field, 0, 'ld [hli],a');
  yield st(2, 'wYellowIntroAnimatedObjectStructPointer+1', 0, 'ld [hl],a');
  yield { cycles: 2, op: 'ld a,MUSIC_YELLOW_INTRO' };
  yield { cycles: 2, op: 'ld c,BANK(Music_YellowIntro)' };
  yield call('PlayMusic');
  yield* introPlayMusicSteps();
  yield RET;
}

/** PlayIntroScene from its first instruction to the `.loop` label: save IE, IF=0, IE=$0F, STAT=$08, graphics and
 *  music, one DelayFrame. Returns the saved IE, which the exit's `pop af` restores. */
export function* introMovieEntrySteps(input: IntroMovieEntryInput, sources: IntroHelperSources): Ret<number> {
  const savedIe = yield* read(3, 'rIE', 'ldh a,[rIE]', 'PlayIntroScene');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'rIF', 0, 'ldh [rIF],a', INTRO_IF_STORE_TRAILING_DOTS);
  yield { cycles: 2, op: 'ld a,$f' };
  yield st(3, 'rIE', 0x0f, 'ldh [rIE],a');
  yield { cycles: 2, op: 'ld a,$8' };
  yield st(3, 'rSTAT', 0x08, 'ldh [rSTAT],a');
  yield call('InitYellowIntroGFXAndMusic');
  yield* initGfxAndMusic(input, sources);
  yield* delayFrameCall();
  return savedIe;
}

// ---- the loop ------------------------------------------------------------------------------------------------------

/** `.loop` through the skip test and the dispatch CALL. `cutoff` is the note 128 checkpoint seam: at scene 6 the
 *  caller passes true and the loop goes straight to the exit with no instruction (the observer's redirect at the
 *  label). Otherwise scene bit 7 or a fresh A/B/START in hJoyPressed exits; else `call DoIntroCutscene` is yielded
 *  and the caller continues with introMovieDispatchSteps. */
export function* introMovieLoopHeadSteps(cutoff: boolean): Ret<IntroMovieLoopHead> {
  if (cutoff) return 'cutoff';
  const scene = yield* read(4, 'wYellowIntroCurrentScene', 'ld a,[wYellowIntroCurrentScene]', 'PlayIntroScene.loop');
  yield { cycles: 2, op: 'bit 7,a' };
  if (scene & 0x80) {
    yield { cycles: 3, op: 'jr nz,.go_to_title_screen', control: 'jr' };
    return 'exit';
  }
  yield { cycles: 2, op: 'jr nz,.go_to_title_screen', control: 'jr' };
  yield call('JoypadLowSensitivity');
  yield* introJoypadLowSensitivitySteps();
  const pressed = yield* read(3, 'hJoyPressed', 'ldh a,[hJoyPressed]');
  yield { cycles: 2, op: 'and PAD_A|PAD_B|PAD_START' };
  if (pressed & PAD_A_B_START) {
    yield { cycles: 3, op: 'jr nz,.go_to_title_screen', control: 'jr' };
    return 'exit';
  }
  yield { cycles: 2, op: 'jr nz,.go_to_title_screen', control: 'jr' };
  yield call('DoIntroCutscene');
  return 'dispatch';
}

/** One step of 2a's reviewed RunObjectAnimations cost stream (its IntroObjectCpuStep shape). */
export interface IntroObjectCostStep { readonly cycles: number; readonly store: boolean }
/** RunObjectAnimations' cost stream snapshots object state before the writer. The writer's scratch OAM is private,
 * so only the runner's timed store can publish a byte. The caller yields the incoming CALL. */
export function* introObjectAnimationSteps(
  steps: Generator<IntroObjectCostStep, boolean>, engine: Pick<IntroObjectEngine, 'runWrites'>, scene: number,
): Ret<boolean> {
  const writes = engine.runWrites(new Uint8Array(160), scene);
  let first = true;
  for (;;) {
    const next = steps.next();
    if (next.done) {
      const finished = writes.next();
      if (!finished.done || finished.value !== next.value) throw new RangeError('Object writer and timing stream did not finish together');
      return next.value;
    }
    let step: IntroHelperInsn = { cycles: next.value.cycles, op: 'object' };
    if (next.value.store) {
      const write = writes.next();
      if (write.done) throw new RangeError('Object writer ended before a timed store');
      const { offset, value } = write.value;
      step = { cycles: step.cycles, op: 'object store', store: { field: `shadowOam.${offset}`, trailingDots: STORE, value } };
    }
    yield first ? named(step, 'RunObjectAnimations') : step;
    first = false;
  }
}

/** After the scene returns: reset the OAM cursor, `call RunObjectAnimations` and its body from `objects`, the two
 *  palette-repair checks (scenes 7 and 11, refused here), DelayFrame, and `jr .loop`. */
export function* introMovieLoopTailSteps(objects: Ret<unknown>): Gen {
  yield { cycles: 2, op: 'ld a,$0' };
  yield st(4, 'wCurrentAnimatedObjectOAMBufferOffset', 0, 'ld [wCurrentAnimatedObjectOAMBufferOffset],a');
  yield call('RunObjectAnimations');
  yield* objects;
  const scene = yield* read(4, 'wYellowIntroCurrentScene', 'ld a,[wYellowIntroCurrentScene]');
  if (scene === 7 || scene === 11) throw new RangeError('The intro movie palette repairs (scenes 7 and 11) are outside 2c3');
  yield { cycles: 2, op: 'cp $7' };
  yield { cycles: 3, op: 'call z,AlternateSurfingPikachuSpritePalette', control: 'call' };
  yield { cycles: 2, op: 'cp $b' };
  yield { cycles: 3, op: 'call z,AlternateFlyingPikachuSpritePalette', control: 'call' };
  yield* delayFrameCall();
  yield { cycles: 3, op: 'jr .loop', control: 'jr' };
}

/** `.go_to_title_screen` through PlayIntroScene's RET. */
export function* introMovieExitSteps(savedIe: number): Gen {
  if (!Number.isInteger(savedIe) || savedIe < 0 || savedIe > 255) throw new RangeError('Invalid saved IE');
  yield call('YellowIntro_BlankPalettes');
  yield* blankPalettes();
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'hLCDCPointer', 0, 'ldh [hLCDCPointer],a');
  yield* delayFrameCall();
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'rIF', 0, 'ldh [rIF],a', INTRO_IF_STORE_TRAILING_DOTS);
  yield { cycles: 3, op: 'pop af' };
  yield st(3, 'rIE', savedIe, 'ldh [rIE],a');
  yield { cycles: 2, op: 'ld a,$90' };
  yield st(3, 'hWY', 0x90, 'ldh [hWY],a');
  yield call('ClearObjectAnimationBuffers');
  yield* introClearObjectAnimationBuffersSteps();
  yield* fillCall('wTileMap', 0, SCREEN_AREA, 0, 'xor a');
  yield call('YellowIntro_BlankOAMBuffer');
  yield { cycles: 3, op: 'ld hl,wShadowOAM', routine: 'YellowIntro_BlankOAMBuffer' };
  yield { cycles: 3, op: 'ld bc,wShadowOAMEnd-wShadowOAM' };
  yield { cycles: 1, op: 'xor a' };
  yield call('YellowIntro_FillMemory');
  yield* fillMemory('wShadowOAM', 0, 160, 0);
  yield RET;
  yield { cycles: 2, op: 'ld a,$1' };
  yield st(3, 'hAutoBGTransferEnabled', 1, 'ldh [hAutoBGTransferEnabled],a');
  for (let i = 0; i < 3; i++) yield* delayFrameCall();
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'hAutoBGTransferEnabled', 0, 'ldh [hAutoBGTransferEnabled],a');
  yield RET;
}

function* blankPalettes(): Gen {
  yield { cycles: 1, op: 'xor a', routine: 'YellowIntro_BlankPalettes' };
  yield* dmgPaletteStores(0, 0, 0);
  yield* cgbPaletteCalls();
  yield RET;
}

// ---- dispatch and scenes 0-5 ---------------------------------------------------------------------------------------

/** DoIntroCutscene (after the head's CALL), GetIntroCutsceneJumptableEntry, `jp hl`, and the scene the read selects.
 *  The scene's RET returns from DoIntroCutscene. Scenes 6 and later are refused. */
export function* introMovieDispatchSteps(tables: IntroMovieTables, sources: IntroHelperSources): Gen {
  const scene = yield* read(4, 'wYellowIntroCurrentScene', 'ld a,[wYellowIntroCurrentScene]', 'DoIntroCutscene');
  if (scene > 5) throw new RangeError(`Intro movie scene ${scene} is outside 2c3`);
  yield { cycles: 3, op: 'ld hl,IntroCutsceneJumptable' };
  yield call('GetIntroCutsceneJumptableEntry');
  yield { cycles: 1, op: 'ld e,a', routine: 'GetIntroCutsceneJumptableEntry' };
  yield { cycles: 2, op: 'ld d,$0' };
  yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 2, op: 'ld a,[hli]' };
  yield { cycles: 2, op: 'ld h,[hl]' };
  yield { cycles: 1, op: 'ld l,a' };
  yield RET;
  yield { cycles: 1, op: 'jp hl', control: 'jp' };
  switch (scene) {
    case 0: return yield* scene0(tables);
    case 1: case 5: return yield* sceneWait(scene);
    case 2: return yield* scene2(tables, sources);
    case 3: return yield* scene3();
    default: return yield* scene4(tables, sources);
  }
}

function* nextScene(scene: number): Gen {
  yield { cycles: 3, op: 'ld hl,wYellowIntroCurrentScene', routine: 'YellowIntro_NextScene' };
  yield { cycles: 3, op: 'inc [hl]', read: { field: 'wYellowIntroCurrentScene', trailingDots: STORE },
    store: { field: 'wYellowIntroCurrentScene', trailingDots: STORE, value: scene + 1 } };
  yield RET;
}
function* nextSceneCall(scene: number): Gen {
  yield call('YellowIntro_NextScene');
  yield* nextScene(scene);
}
function* setTimer128Call(): Gen {
  yield call('YellowIntro_SetTimerFor128Frames');
  yield { cycles: 2, op: 'ld a,128', routine: 'YellowIntro_SetTimerFor128Frames' };
  yield st(4, 'wYellowIntroSceneTimer', 128, 'ld [wYellowIntroSceneTimer],a');
  yield RET;
}
/** YellowIntro_CheckFrameTimerDecrement. The test is before the decrement: 1→0 is not expired; only a call that
 *  begins at zero sets carry. */
function* checkTimer(): Ret<boolean> {
  yield { cycles: 3, op: 'ld hl,wYellowIntroSceneTimer', routine: 'YellowIntro_CheckFrameTimerDecrement' };
  const timer = yield* read(2, 'wYellowIntroSceneTimer', 'ld a,[hl]');
  yield { cycles: 1, op: 'and a' };
  if (timer === 0) {
    yield { cycles: 3, op: 'jr z,.expired', control: 'jr' };
    yield { cycles: 1, op: 'scf' };
    yield RET;
    return true;
  }
  yield { cycles: 2, op: 'jr z,.expired', control: 'jr' };
  yield { cycles: 3, op: 'dec [hl]', read: { field: 'wYellowIntroSceneTimer', trailingDots: STORE },
    store: { field: 'wYellowIntroSceneTimer', trailingDots: STORE, value: timer - 1 } };
  yield { cycles: 1, op: 'and a' };
  yield RET;
  return false;
}

/** SpawnAnimatedObject after the caller's CALL, with a = frameset and de = (d, e). Scans the ten slots by their first
 *  byte and fills the first free one. Returns the slot. Refuses a full table (the cartridge returns carry). */
function* spawn(tables: IntroMovieTables, frameset: number, d: number, e: number): Ret<number> {
  yield { cycles: 4, op: 'push de', routine: 'SpawnAnimatedObject' };
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 3, op: 'ld hl,wAnimatedObjectDataStructs' };
  yield { cycles: 2, op: 'ld e,10' };
  let slot = 0;
  for (;; slot++) {
    if (slot === OBJECT_SLOTS) throw new RangeError('Intro movie spawn with every object slot in use');
    const active = yield* read(2, `wAnimatedObjectDataStructs[${slot * OBJECT_STRUCT_BYTES}]`, 'ld a,[hl]');
    yield { cycles: 1, op: 'and a' };
    if (active === 0) { yield { cycles: 3, op: 'jr z,.init', control: 'jr' }; break; }
    yield { cycles: 2, op: 'jr z,.init', control: 'jr' };
    yield { cycles: 3, op: 'ld bc,$10' };
    yield { cycles: 2, op: 'add hl,bc' };
    yield { cycles: 1, op: 'dec e' };
    yield { cycles: 3, op: 'jr nz,.loop', control: 'jr' };
  }
  const state = tables.spawnStates[frameset];
  if (!state || state.length < 2) throw new RangeError(`No intro spawn state for frameset ${frameset}`);
  const at = (i: number) => `wAnimatedObjectDataStructs[${slot * OBJECT_STRUCT_BYTES + i}]`;
  yield { cycles: 3, op: 'pop af' };
  yield { cycles: 1, op: 'ld c,l' };
  yield { cycles: 1, op: 'ld b,h' };
  yield { cycles: 3, op: 'ld hl,wNumLoadedAnimatedObjects' };
  const loaded = byte(yield { cycles: 3, op: 'inc [hl]', read: { field: 'wNumLoadedAnimatedObjects', trailingDots: 8 },
    store: { field: 'wNumLoadedAnimatedObjects', trailingDots: STORE, value: 'increment-read' } }, 'wNumLoadedAnimatedObjects');
  yield { cycles: 1, op: 'ld e,a' };
  yield { cycles: 2, op: 'ld d,$0' };
  yield* read(4, 'wAnimatedObjectSpawnStateDataPointer', 'ld a,[wAnimatedObjectSpawnStateDataPointer]');
  yield { cycles: 1, op: 'ld l,a' };
  yield* read(4, 'wAnimatedObjectSpawnStateDataPointer+1', 'ld a,[wAnimatedObjectSpawnStateDataPointer+1]');
  yield { cycles: 1, op: 'ld h,a' };
  for (let i = 0; i < 3; i++) yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 1, op: 'ld e,l' };
  yield { cycles: 1, op: 'ld d,h' };
  yield { cycles: 3, op: 'ld hl,$0' };
  yield { cycles: 2, op: 'add hl,bc' };
  yield* read(4, 'wNumLoadedAnimatedObjects', 'ld a,[wNumLoadedAnimatedObjects]');
  yield st(2, at(0), (loaded + 1) & 255, 'ld [hli],a');
  yield { cycles: 2, op: 'ld a,[de]' };
  yield st(2, at(1), state[0], 'ld [hli],a');
  yield { cycles: 2, op: 'inc de' };
  yield { cycles: 2, op: 'ld a,[de]' };
  yield st(2, at(2), state[1], 'ld [hli],a');
  yield { cycles: 2, op: 'inc de' };
  yield { cycles: 1, op: 'xor a' };
  yield st(2, at(3), 0, 'ld [hli],a');
  yield { cycles: 3, op: 'pop de' };
  yield { cycles: 3, op: 'ld hl,$4' };
  yield { cycles: 2, op: 'add hl,bc' };
  yield { cycles: 1, op: 'ld a,e' };
  yield st(2, at(4), e, 'ld [hli],a');
  yield { cycles: 1, op: 'ld a,d' };
  yield st(2, at(5), d, 'ld [hli],a');
  yield { cycles: 1, op: 'xor a' };
  yield st(2, at(6), 0, 'ld [hli],a');
  yield st(2, at(7), 0, 'ld [hli],a');
  yield { cycles: 1, op: 'xor a' };
  yield st(2, at(8), 0, 'ld [hli],a');
  yield st(2, at(9), 0, 'ld [hli],a');
  yield { cycles: 1, op: 'dec a' };
  yield st(2, at(10), 0xff, 'ld [hli],a');
  yield { cycles: 1, op: 'xor a' };
  for (let i = 11; i < 15; i++) yield st(2, at(i), 0, 'ld [hli],a');
  yield st(2, at(15), 0, 'ld [hl],a');
  yield RET;
  return slot;
}
function* spawnAndSaveCall(tables: IntroMovieTables, frameset: number): Gen {
  yield { cycles: 3, op: 'lb de,$58,$58' };
  yield { cycles: 2, op: `ld a,${frameset}` };
  yield call('YellowIntro_SpawnAnimatedObjectAndSavePointer');
  yield named(call('SpawnAnimatedObject'), 'YellowIntro_SpawnAnimatedObjectAndSavePointer');
  const slot = yield* spawn(tables, frameset, 0x58, 0x58);
  const address = OBJECT_STRUCTS_ADDRESS + slot * OBJECT_STRUCT_BYTES;
  yield { cycles: 1, op: 'ld a,c' };
  yield st(4, 'wYellowIntroAnimatedObjectStructPointer', address & 255, 'ld [wYellowIntroAnimatedObjectStructPointer],a');
  yield { cycles: 1, op: 'ld a,b' };
  yield st(4, 'wYellowIntroAnimatedObjectStructPointer+1', address >> 8, 'ld [wYellowIntroAnimatedObjectStructPointer+1],a');
  yield RET;
}
/** YellowIntro_MaskCurrentAnimatedObjectStruct: zero the first byte of the struct the saved pointer names. */
function* maskSavedCall(): Gen {
  yield call('YellowIntro_MaskCurrentAnimatedObjectStruct');
  yield* read(4, 'wYellowIntroAnimatedObjectStructPointer', 'ld a,[wYellowIntroAnimatedObjectStructPointer]',
    'YellowIntro_MaskCurrentAnimatedObjectStruct');
  yield { cycles: 1, op: 'ld c,a' };
  yield* read(4, 'wYellowIntroAnimatedObjectStructPointer+1', 'ld a,[wYellowIntroAnimatedObjectStructPointer+1]');
  yield { cycles: 1, op: 'ld b,a' };
  yield call('MaskCurrentAnimatedObjectStruct');
  yield { cycles: 3, op: 'ld hl,$0', routine: 'MaskCurrentAnimatedObjectStruct' };
  yield { cycles: 2, op: 'add hl,bc' };
  yield st(3, 'wYellowIntroAnimatedObjectStruct[0]', 0, 'ld [hl],$0');
  yield RET;
  yield RET;
}

function* scene0(tables: IntroMovieTables): Gen {
  yield { cycles: 1, op: 'xor a', routine: 'YellowIntroScene0' };
  yield st(3, 'hLCDCPointer', 0, 'ldh [hLCDCPointer],a');
  yield* spawnAndSaveCall(tables, FRAMESET_PIKACHU_FAR);
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'hSCX', 0, 'ldh [hSCX],a');
  yield st(3, 'hSCY', 0, 'ldh [hSCY],a');
  yield { cycles: 2, op: 'ld a,$90' };
  yield st(3, 'hWY', 0x90, 'ldh [hWY],a');
  yield { cycles: 2, op: 'ld a,$e4' };
  yield* dmgPaletteStores(0xe4, 0xe4, 0xc4);
  yield* cgbPaletteCalls();
  yield { cycles: 2, op: 'ld a,130' };
  yield st(4, 'wYellowIntroSceneTimer', 130, 'ld [wYellowIntroSceneTimer],a');
  yield* nextSceneCall(0);
  yield RET;
}

/** Scenes 1 and 5: wait out the timer, then mask the saved object and advance. */
function* sceneWait(scene: 1 | 5): Gen {
  yield named(call('YellowIntro_CheckFrameTimerDecrement'), `YellowIntroScene${scene}`);
  const expired = yield* checkTimer();
  if (!expired) { yield { cycles: 5, op: 'ret nc', control: 'ret' }; return; }
  yield { cycles: 2, op: 'ret nc', control: 'ret' };
  yield* maskSavedCall();
  yield* nextSceneCall(scene);
  yield RET;
}

/** YellowIntro_BlankPalsDelay2AndDisableLCD after the scene's CALL. */
function* blankPalsDelay2AndDisableLcd(sources: IntroHelperSources): Gen {
  yield { cycles: 1, op: 'xor a', routine: 'YellowIntro_BlankPalsDelay2AndDisableLCD' };
  yield* dmgPaletteStores(0, 0, 0);
  yield* cgbPaletteCalls();
  yield* delayFrameCall();
  yield* delayFrameCall();
  yield call('DisableLCD');
  yield* introDisableLcdSteps(sources);
  yield RET;
}

/** The 6×6 graphic's attribute rectangle: VBK=1, value to 36 cells, VBK=0. Scene 2 loads 1 before the loop
 *  (ld a,$1 / ldh [rVBK],a, so a is 1); scene 4 adds `xor a` after the VBK store. */
function* attributeRect(value: 0 | 1): Gen {
  yield { cycles: 3, op: 'ld hl,n' };
  yield { cycles: 3, op: 'ld de,TILEMAP_WIDTH' };
  yield { cycles: 2, op: 'ld b,6' };
  yield { cycles: 2, op: 'ld a,$1' };
  yield st(3, 'rVBK', 1, 'ldh [rVBK],a');
  if (value === 0) yield { cycles: 1, op: 'xor a' };
  for (let row = 0; row < 6; row++) {
    yield { cycles: 2, op: 'ld c,6' };
    yield { cycles: 4, op: 'push hl' };
    for (let col = 0; col < 6; col++) {
      yield st(2, `vBGMap0.attr[${GRAPHIC_OFFSET + row * BG_MAP_WIDTH + col}]`, value, 'ld [hli],a');
      yield { cycles: 1, op: 'dec c' };
      yield { cycles: col < 5 ? 3 : 2, op: 'jr nz,.attr_col', control: 'jr' };
    }
    yield { cycles: 3, op: 'pop hl' };
    yield { cycles: 2, op: 'add hl,de' };
    yield { cycles: 1, op: 'dec b' };
    yield { cycles: row < 5 ? 3 : 2, op: 'jr nz,.attr_row', control: 'jr' };
  }
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'rVBK', 0, 'ldh [rVBK],a');
}

function* placeGraphic(): Gen {
  yield { cycles: 3, op: 'ld hl,n', routine: 'YellowIntroScene2_PlaceGraphic' };
  yield { cycles: 3, op: 'ld de,TILEMAP_WIDTH' };
  yield { cycles: 2, op: 'ld b,6' };
  yield { cycles: 2, op: 'ld a,$90' };
  for (let row = 0; row < 6; row++) {
    yield { cycles: 2, op: 'ld c,6' };
    yield { cycles: 4, op: 'push af' };
    yield { cycles: 4, op: 'push hl' };
    for (let col = 0; col < 6; col++) {
      yield st(2, `vBGMap0[${GRAPHIC_OFFSET + row * BG_MAP_WIDTH + col}]`, 0x90 + 0x10 * row + col, 'ld [hli],a');
      yield { cycles: 1, op: 'inc a' };
      yield { cycles: 1, op: 'dec c' };
      yield { cycles: col < 5 ? 3 : 2, op: 'jr nz,.col', control: 'jr' };
    }
    yield { cycles: 3, op: 'pop hl' };
    yield { cycles: 2, op: 'add hl,de' };
    yield { cycles: 3, op: 'pop af' };
    yield { cycles: 2, op: 'add $10' };
    yield { cycles: 1, op: 'dec b' };
    yield { cycles: row < 5 ? 3 : 2, op: 'jr nz,.row', control: 'jr' };
  }
  yield* requireCgb();
  yield* attributeRect(1);
  yield RET;
}

/** LoadYellowIntroFlyingSpeedBars: eight SPEED_BAR spawns from the table's e, d, speed; speed becomes field $b. */
function* loadSpeedBars(tables: IntroMovieTables): Gen {
  if (tables.speedBars.length !== 8) throw new RangeError('The intro speed-bar table has eight entries');
  yield { cycles: 3, op: 'ld hl,YellowIntroFlyingSpeedBarData', routine: 'LoadYellowIntroFlyingSpeedBars' };
  yield { cycles: 2, op: 'ld a,$8' };
  for (let i = 0; i < 8; i++) {
    const [e, d, speed] = tables.speedBars[i];
    yield { cycles: 4, op: 'push af' };
    yield { cycles: 2, op: 'ld e,[hl]' };
    yield { cycles: 2, op: 'inc hl' };
    yield { cycles: 2, op: 'ld d,[hl]' };
    yield { cycles: 2, op: 'inc hl' };
    yield { cycles: 2, op: 'ld a,[hli]' };
    yield { cycles: 4, op: 'push hl' };
    yield { cycles: 4, op: 'push af' };
    yield { cycles: 2, op: 'ld a,INTRO_FRAMESET_SPEED_BAR' };
    yield call('SpawnAnimatedObject');
    const slot = yield* spawn(tables, FRAMESET_SPEED_BAR, d, e);
    yield { cycles: 3, op: 'pop af' };
    yield { cycles: 3, op: 'ld hl,$b' };
    yield { cycles: 2, op: 'add hl,bc' };
    yield st(2, `wAnimatedObjectDataStructs[${slot * OBJECT_STRUCT_BYTES + 11}]`, speed, 'ld [hl],a');
    yield { cycles: 3, op: 'pop hl' };
    yield { cycles: 3, op: 'pop af' };
    yield { cycles: 1, op: 'dec a' };
    yield { cycles: i < 7 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
  }
  yield RET;
}

/** YellowIntroPaletteAction through callfar (after `ld e,a`). Action 0 tail-jumps to InitCGBPalettes with the
 *  Generic packet; action 1 loads PikachusBeach, then BG palette 1's base from the Generic packet's first palette. */
function* paletteActionCall(action: 0 | 1): Gen {
  yield { cycles: 3, op: 'ld hl,YellowIntroPaletteAction' };
  yield { cycles: 2, op: 'ld b,BANK(YellowIntroPaletteAction)' };
  yield call('Bankswitch');
  yield* introBankswitchSteps(PALETTE_ACTION_BANK, function* paletteAction() {
    yield { cycles: 1, op: 'ld a,e', routine: 'YellowIntroPaletteAction' };
    yield { cycles: 1, op: 'and a' };
    yield { cycles: action ? 3 : 2, op: 'jr nz,.hasBlueColor', control: 'jr' };
    yield { cycles: 3, op: action ? 'ld hl,PalPacket_PikachusBeach' : 'ld hl,PalPacket_Generic' };
    const on = yield* read(3, 'hOnCGB', 'ldh a,[hOnCGB]');
    yield { cycles: 1, op: 'and a' };
    if (!on) throw new RangeError('The intro palette action on DMG/SGB is unsupported');
    yield { cycles: 3, op: 'jp z,SendSGBPacket', control: 'jp' };
    if (action === 0) {
      yield { cycles: 4, op: 'jp InitCGBPalettes', control: 'jp' };
      yield* introInitCgbPalettesSteps();
      return;
    }
    yield call('InitCGBPalettes');
    yield* introInitCgbPalettesSteps();
    yield { cycles: 3, op: 'ld hl,PalPacket_Generic' };
    yield { cycles: 2, op: 'inc hl' };
    yield { cycles: 2, op: 'ld a,[hli]' };
    yield call('GetCGBBasePalAddress');
    const address = yield* introGetCgbBasePalAddressSteps(PAL_MEWMON);
    yield { cycles: 1, op: 'ld a,e' };
    yield st(4, 'wCGBBasePalPointers+2', address & 255, 'ld [wCGBBasePalPointers+2],a');
    yield { cycles: 1, op: 'ld a,d' };
    yield st(4, 'wCGBBasePalPointers+3', address >> 8, 'ld [wCGBBasePalPointers+3],a');
    yield { cycles: 1, op: 'xor a' };
    yield call('DMGPalToCGBPal');
    yield* introDmgPalToCgbPalSteps(0);
    yield { cycles: 2, op: 'ld a,1' };
    yield call('TransferCurBGPData');
    yield* introTransferCurPalDataSteps('bg', 1);
    yield RET;
  });
}

/** YellowIntro_PrepareNextScenePalette: the palette action, scroll and window home, LCDC=$E3 (the LCD comes back
 *  on here, at this store), DMG palettes, then the three CGB updates on the first frame after enable. */
function* prepareNextScenePaletteCall(action: 0 | 1): Gen {
  if (action) yield { cycles: 2, op: 'ld a,$1' };
  else yield { cycles: 1, op: 'xor a' };
  yield call('YellowIntro_PrepareNextScenePalette');
  yield { cycles: 1, op: 'ld e,a', routine: 'YellowIntro_PrepareNextScenePalette' };
  yield* paletteActionCall(action);
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'hSCX', 0, 'ldh [hSCX],a');
  yield st(3, 'hSCY', 0, 'ldh [hSCY],a');
  yield { cycles: 2, op: 'ld a,$90' };
  yield st(3, 'hWY', 0x90, 'ldh [hWY],a');
  yield { cycles: 2, op: 'ld a,$e3' };
  yield st(3, 'rLCDC', 0xe3, 'ldh [rLCDC],a');
  yield { cycles: 2, op: 'ld a,$e4' };
  yield* dmgPaletteStores(0xe4, 0xe4, 0xe0);
  yield* cgbPaletteCalls();
  yield RET;
}

function* scene2(tables: IntroMovieTables, sources: IntroHelperSources): Gen {
  yield named(call('YellowIntro_BlankPalsDelay2AndDisableLCD'), 'YellowIntroScene2');
  yield* blankPalsDelay2AndDisableLcd(sources);
  yield { cycles: 2, op: 'ld c,$8' };
  yield call('UpdateMusicCTimes');
  yield* introUpdateMusicCTimesSteps(8, sources);
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'hLCDCPointer', 0, 'ldh [hLCDCPointer],a');
  yield* fillCall('vBGMap0', 0, 1024, 0, 'xor a');
  yield call('YellowIntroScene2_PlaceGraphic');
  yield* placeGraphic();
  yield { cycles: 3, op: 'lb de,$58,$b8' };
  yield { cycles: 2, op: `ld a,${FRAMESET_PIKACHU_UNUSED}` }; // overloaded: LoadYellowIntroFlyingSpeedBars ignores de and a
  yield call('LoadYellowIntroFlyingSpeedBars');
  yield* loadSpeedBars(tables);
  yield* prepareNextScenePaletteCall(1);
  yield* setTimer128Call();
  yield* nextSceneCall(2);
  yield RET;
}

function* scene3(): Gen {
  yield named(call('YellowIntro_CheckFrameTimerDecrement'), 'YellowIntroScene3');
  const expired = yield* checkTimer();
  if (expired) {
    yield { cycles: 3, op: 'jr c,.expired', control: 'jr' };
    yield call('MaskAllAnimatedObjectStructs');
    yield { cycles: 3, op: 'ld hl,wAnimatedObjectDataStructs', routine: 'MaskAllAnimatedObjectStructs' };
    yield { cycles: 2, op: 'ld e,10' };
    for (let slot = 0; slot < OBJECT_SLOTS; slot++) {
      yield st(3, `wAnimatedObjectDataStructs[${slot * OBJECT_STRUCT_BYTES}]`, 0, 'ld [hl],$0');
      yield { cycles: 3, op: 'ld bc,$10' };
      yield { cycles: 2, op: 'add hl,bc' };
      yield { cycles: 1, op: 'dec e' };
      yield { cycles: slot < OBJECT_SLOTS - 1 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
    }
    yield RET;
    yield* nextSceneCall(3);
    yield RET;
    return;
  }
  yield { cycles: 2, op: 'jr c,.expired', control: 'jr' };
  const scx = yield* read(3, 'hSCX', 'ldh a,[hSCX]');
  yield { cycles: 2, op: 'cp $68' };
  if (scx === 0x68) { yield { cycles: 5, op: 'ret z', control: 'ret' }; return; }
  yield { cycles: 2, op: 'ret z', control: 'ret' };
  yield { cycles: 2, op: 'add $4' };
  yield st(3, 'hSCX', (scx + 4) & 255, 'ldh [hSCX],a');
  yield RET;
}

function* letterboxCall(): Gen {
  yield call('YellowIntro_LetterboxRunningPikachu');
  const fills: [number, number, number][] = [[0, 128, 1], [128, 320, 0], [448, 128, 1]];
  let first = true;
  for (const [start, count, value] of fills) {
    yield first ? { cycles: 3, op: 'ld hl,n', routine: 'YellowIntro_LetterboxRunningPikachu' } : { cycles: 3, op: 'ld hl,n' };
    first = false;
    yield { cycles: 3, op: 'ld bc,n' };
    yield value ? { cycles: 2, op: 'ld a,$1' } : { cycles: 1, op: 'xor a' };
    yield call('YellowIntro_FillMemory');
    yield* fillMemory('vBGMap0', start, count, value);
  }
  yield RET;
}

function* scene4(tables: IntroMovieTables, sources: IntroHelperSources): Gen {
  yield named(call('YellowIntro_BlankPalsDelay2AndDisableLCD'), 'YellowIntroScene4');
  yield* blankPalsDelay2AndDisableLcd(sources);
  yield { cycles: 2, op: 'ld c,$5' };
  yield call('UpdateMusicCTimes');
  yield* introUpdateMusicCTimesSteps(5, sources);
  yield* requireCgb();
  yield* attributeRect(0);
  yield { cycles: 1, op: 'xor a' };
  yield st(3, 'hLCDCPointer', 0, 'ldh [hLCDCPointer],a');
  yield* letterboxCall();
  yield* spawnAndSaveCall(tables, FRAMESET_PIKACHU_MID);
  yield* prepareNextScenePaletteCall(0);
  yield* setTimer128Call();
  yield* nextSceneCall(4);
  yield RET;
}
