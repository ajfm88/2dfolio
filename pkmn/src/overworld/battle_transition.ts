// engine/battle/battle_transitions.asm, literal cell-pointer operations. Prime at tick 0;
// each later frame runs screen.vblank(), THEN resumes the CPU generator. Rendering never ticks.
import { textBgTransfer } from '../text/bg_transfer';
import { TransitionScreen, TRANSITION_BLACK as FF } from './transition_screen';
import { CIRCLE_DATA, FLASH_SCREEN_PALETTES, HALF_CIRCLE_1, HALF_CIRCLE_2 } from './battle_transition_tables';
import type { HalfCircleEntry } from './battle_transition_tables';
import type { BattleTransitionKind } from './battle_transition_choice';

function* delayFrames(frames: number): Generator<void> { for (let i = 0; i < frames; i++) yield; }
export function* transferDelay3(): Generator<void> {
  textBgTransfer.enabled = true;
  yield* delayFrames(3);
  textBgTransfer.enabled = false;
}
/** CopyVideoData/Double: preserve the enable byte, never reset the inherited portion. */
function* copyVideoData(frames: number): Generator<void> {
  const enabled = textBgTransfer.enabled;
  textBgTransfer.enabled = false;
  yield* delayFrames(frames);
  textBgTransfer.enabled = enabled;
}
export function* transitionPrologue(screen: TransitionScreen): Generator<void> {
  textBgTransfer.enabled = true;
  yield* delayFrames(3);
  screen.wy = 0;
  screen.spriteUpdatesEnabled = false;
  yield;
  screen.clearOamExceptSurvivors();
  yield* delayFrames(3);
  yield* copyVideoData(1);
  screen.transitionTileLoaded = true;
}
export function* transitionTail(screen: TransitionScreen): Generator<void> {
  yield* copyVideoData(4); screen.hpBarTilesLoaded = true;
  yield* copyVideoData(1); screen.hud1Loaded = true;
  yield* copyVideoData(1); screen.hud2Loaded = true;
  textBgTransfer.enabled = true;
  screen.spriteUpdatesEnabled = false;
  screen.clearSprites();
  screen.clearScreen();
  yield* delayFrames(3);
  textBgTransfer.enabled = false;
  screen.wy = screen.windowY = 0;
  screen.tileAnimationsEnabled = false;
}
export function* blackScreen(screen: TransitionScreen): Generator<void> {
  screen.bgp = screen.obp0 = screen.obp1 = 0xff;
  screen.black = true;
}
export function* flashScreen(screen: TransitionScreen, cycles = 3): Generator<void> {
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const palette of FLASH_SCREEN_PALETTES) {
      if (palette === 1) break;
      screen.bgp = palette;
      yield* delayFrames(2);
    }
  }
  textBgTransfer.enabled = false;
}

/** Circle_Sub2/3: table runs, row step, then shift AGAINST the run's direction. */
export function circleSub3(screen: TransitionScreen, quadrantY: number, entry: HalfCircleEntry): void {
  const [quadrantX, dataIndex, x, y] = entry;
  const data = CIRCLE_DATA[dataIndex];
  let p = y * 20 + x, dataPointer = 0;
  while (true) {
    const start = p, count = data[dataPointer++];
    for (let c = 0; c < count; c++) { screen.write(p); p += quadrantX ? 1 : -1; }
    p = start + (quadrantY ? -20 : 20);
    const shift = data[dataPointer++];
    if (shift === 255) return;
    for (let c = 0; c < shift; c++) p += quadrantX ? -1 : 1;
  }
}
export function* doubleCircle(screen: TransitionScreen): Generator<void> {
  yield* flashScreen(screen);
  for (let i = 0; i < 10; i++) {
    circleSub3(screen, 0, HALF_CIRCLE_1[i]);
    circleSub3(screen, 1, HALF_CIRCLE_2[i]);
    yield* transferDelay3();
  }
  yield* blackScreen(screen);
}
export function* circle(screen: TransitionScreen): Generator<void> {
  yield* flashScreen(screen);
  for (const [y, half] of [HALF_CIRCLE_1, HALF_CIRCLE_2].entries()) {
    for (const entry of half) { circleSub3(screen, y, entry); yield* transferDelay3(); }
  }
  yield* blackScreen(screen);
}
export function* horizontalStripes(screen: TransitionScreen): Generator<void> {
  textBgTransfer.enabled = false;
  let hl = 0, de = 39;
  for (let c = 20; c !== 0; c--) {
    for (const start of [hl, de]) for (let row = 0; row < 9; row++) screen.write(start + row * 40);
    yield* transferDelay3();
    hl++; de--;
  }
  yield* blackScreen(screen);
}
export function* verticalStripes(screen: TransitionScreen): Generator<void> {
  textBgTransfer.enabled = false;
  let hl = 0, de = 341;
  for (let c = 18; c !== 0; c--) {
    for (const start of [hl, de]) for (let col = 0; col < 10; col++) screen.write(start + col * 2);
    yield* transferDelay3();
    hl += 20; de -= 20;
  }
  yield* blackScreen(screen);
}
/** CopyData is a forward byte copy, not a slice/memmove; POP HL / POP DE swaps the pointers. */
export function copyTiles1(screen: TransitionScreen, hl: number, de: number, offset: number): void {
  for (let row = 0; row < 8; row++) {
    for (let cell = 0; cell < 20; cell++) screen.write(de + cell, screen.read(hl + cell));
    [hl, de] = [de + offset, hl];
  }
  for (let cell = 0; cell < 20; cell++) screen.write(de + cell);
}
export function copyTiles2(screen: TransitionScreen, hl: number, de: number, offset: number): void {
  for (let column = 0; column < 9; column++) {
    for (let row = 0; row < 18; row++) screen.write(de + row * 20, screen.read(hl + row * 20));
    [hl, de] = [de + offset, hl];
  }
  for (let row = 0; row < 18; row++) screen.write(de + row * 20);
}
export function* shrink(screen: TransitionScreen): Generator<void> {
  for (let c = 9; c !== 0; c--) {
    textBgTransfer.enabled = false;
    copyTiles1(screen, 140, 160, -40);
    copyTiles1(screen, 200, 180, 40);
    copyTiles2(screen, 8, 9, -2);
    copyTiles2(screen, 11, 10, 2);
    textBgTransfer.enabled = true;
    yield* delayFrames(6);
  }
  yield* blackScreen(screen);
  yield* delayFrames(10);
}
export function* split(screen: TransitionScreen): Generator<void> {
  textBgTransfer.enabled = false;
  for (let c = 9; c !== 0; c--) {
    copyTiles1(screen, 320, 340, -40);
    copyTiles1(screen, 20, 0, 40);
    copyTiles2(screen, 18, 19, -2);
    copyTiles2(screen, 1, 0, 2);
    yield* transferDelay3();
    yield* delayFrames(3);
  }
  yield* blackScreen(screen);
  yield* delayFrames(10);
}
export function* inwardSpiral(screen: TransitionScreen): Generator<void> {
  let counter = 7, hl = 0;
  function* run(de: number, count: number): Generator<void> {
    for (let c = count; c !== 0; c--) {
      screen.write(hl); hl += de;
      if (--counter === 0) { yield* transferDelay3(); counter = 7; }
    }
  }
  let c = 17;
  yield* run(20, c);
  c++;
  let first = true;
  do {
    if (!first) yield* run(20, c);
    first = false;
    yield* run(1, ++c);
    c -= 2; yield* run(-20, c);
    yield* run(-1, ++c);
    c -= 2;
  } while (c !== 0);
}
/** OutwardSpiral_: probe the next turn first; only continue straight when it is already FF. */
export function outwardSpiralStep(screen: TransitionScreen, pointer: number, direction: number): { pointer: number; direction: number } {
  const probe = pointer + [-1, 20, 1, -20][direction];
  if (screen.read(probe) !== FF) {
    screen.write(probe);
    return { pointer: probe, direction: (direction + 1) & 3 };
  }
  const next = pointer + [-20, -1, 20, 1][direction];
  screen.write(next);
  return { pointer: next, direction };
}
export function* outwardSpiral(screen: TransitionScreen): Generator<void> {
  let state = { pointer: 210, direction: 3 };
  for (let b = 120; b !== 0; b--) {
    for (let c = 3; c !== 0; c--) state = outwardSpiralStep(screen, state.pointer, state.direction);
    yield;
  }
}
export function* spiral(screen: TransitionScreen, direction: 0 | 1): Generator<void> {
  if (direction) yield* inwardSpiral(screen); else yield* outwardSpiral(screen);
  yield* blackScreen(screen);
}
export function* battleTransition(
  screen: TransitionScreen, choice: { kind: BattleTransitionKind; spiralDirection: 0 | 1 },
): Generator<void> {
  yield* transitionPrologue(screen);
  switch (choice.kind) {
    case 'doubleCircle': yield* doubleCircle(screen); break;
    case 'circle': yield* circle(screen); break;
    case 'horizontalStripes': yield* horizontalStripes(screen); break;
    case 'verticalStripes': yield* verticalStripes(screen); break;
    case 'shrink': yield* shrink(screen); break;
    case 'split': yield* split(screen); break;
    case 'spiral': yield* spiral(screen, choice.spiralDirection); break;
  }
  yield* transitionTail(screen);
}
