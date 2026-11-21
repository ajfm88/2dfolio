// Checkpoint-12b2b: native object-work instruction boundaries; no interrupt or frame clock.
import type { IntroObjectTables } from './intro_objects';
import { OBJECT_FIELD as F } from './intro_objects';

/** One native instruction's machine cycles (four T-cycles), and whether it completes a shadow-OAM store.
 * Timing arithmetic over semantic inputs: no opcode/address/register execution. */
export interface IntroObjectCpuStep { readonly cycles: number; readonly store: boolean }
function* steps(...costs: number[]): Generator<IntroObjectCpuStep> {
  for (const cycles of costs) yield { cycles, store: false };
}
function* store(): Generator<IntroObjectCpuStep> { yield { cycles: 2, store: true }; }

/** Predict one complete RunObjectAnimations instruction-cost stream. Snapshot on first next(), before the
 * writer starts; do not interleave updates or mutate tables while suspended. Includes internal CALL/RET and
 * final RET, excludes the incoming CALL, interrupts, dispatch, DMA and stalls. A future owner completes each
 * instruction (and its marked store) before accepting interrupts. Returns OAM-full carry. Never mutates
 * objects, scratch, OAM or tables. This unused helper does not select interrupt costs or wall/PPU phase. */
export function* introObjectCpuSteps(
  objects: Uint8Array, initialOffset: number, tables: IntroObjectTables, scene: number,
): Generator<IntroObjectCpuStep, boolean> {
  const b = objects.slice();
  let cursor = initialOffset;
  yield* steps(3, 2); // ld hl, structs; ld e, 10
  for (let slot = 0; slot < 10; slot++) {
    const at = slot * 16;
    yield* steps(2, 1); // active test
    if (b[at + F.index] === 0) yield* steps(3);
    else {
      yield* steps(2, 1, 1, 4, 4, 6); // branch, save, CALL callback
      yield* callbackSteps(b, at);
      yield* steps(6); // CALL UpdateCurrentAnimatedObjectFrame
      yield* steps(1, 4, 3, 2, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 6); // scratch copies, CALL duration
      let frame = b[at + F.frameIndex], command: number, flags: number;
      const script = tables.framesets[b[at + F.frameset]];
      for (;;) {
        yield* steps(3, 2, 2, 1);
        if (b[at + F.duration] !== 0) {
          yield* steps(2, 3, 6); // waiting: dec [hl]; CALL frame pointer
          yield* framePointerSteps();
          yield* steps(2, 4, 3);
          command = script[frame * 2]; flags = script[frame * 2 + 1]; break;
        }
        yield* steps(3, 3, 2, 3, 6); // next frame
        frame = (frame + 1) & 255;
        yield* framePointerSteps();
        yield* steps(2, 2); // command, cp fe
        command = script[frame * 2];
        if (command === 0xfe) {
          yield* steps(3, 1, 3, 2, 2, 1, 3, 2, 2, 3); // restart
          frame = 255; continue;
        }
        yield* steps(2, 2); // not fe; cp ff
        if (command === 0xff) {
          yield* steps(3, 1, 3, 2, 2, 3, 2, 3, 3, 3); // hold
          frame = (frame - 2) & 255; continue;
        }
        yield* steps(2, 4, 2, 4, 2, 3, 2, 2, 3, 2, 2, 3); // duration store, pop hl
        flags = script[frame * 2 + 1]; break;
      }
      yield* steps(2, 2, 2, 4, 3, 4); // flags, srl, scratch store, pop af, RET
      yield* steps(2); // cp fd
      if (command === 0xfd) yield* steps(3, 1, 4);
      else {
        yield* steps(2, 2);
        if (command === 0xfc) yield* steps(3, 6, 3, 2, 3, 4, 1, 4);
        else {
          yield* steps(2, 6); // CALL OAM pointer
          yield* steps(1, 2, 4, 1, 4, 1, 2, 2, 2, 4);
          yield* steps(4, 2, 4, 2, 2, 2, 1, 4, 4, 1, 2, 2, 1);
          const set = tables.oamSets[command];
          for (let entry = 0; entry < set.entries.length; entry++) {
            const attributes = set.entries[entry][3];
            yield* steps(4, 1, 4, 1, 1, 4, 1, 1, 6);
            yield* coordinateSteps((flags & 0x80) !== 0);
            yield* steps(1); yield* store(); // Y
            yield* steps(2, 2, 4, 1, 4, 1, 1, 4, 1, 1, 6);
            yield* coordinateSteps((flags & 0x40) !== 0);
            yield* steps(1); yield* store(); // X
            yield* steps(2, 2, 4, 2); yield* store(); // tile
            yield* steps(2, 2, 6); // CALL attributes
            yield* steps(4, 1, 2, 1, 2, 1, 2, 2, 1, 2);
            if (attributes & 0x10) yield* steps(2, 2, 4);
            else yield* steps(5); // conditional RET taken
            yield* steps(1, 4, 2, 1);
            if (scene !== 7) { yield* steps(2); yield* store(); }
            else yield* steps(3);
            cursor += 4;
            yield* steps(2, 2, 1, 4, 2);
            if (cursor >= 160) {
              yield* steps(3, 3, 1, 4, 3, 3, 3, 4); // full frame return, caller restore, quit RET
              return true;
            }
            yield* steps(2, 1, entry + 1 < set.entries.length ? 3 : 2);
          }
          yield* steps(3, 3, 1, 4);
        }
      }
      yield* steps(3, 3, 2);
    }
    yield* steps(3, 2, 1, slot < 9 ? 3 : 2);
  }
  yield* steps(4, 1, 2);
  for (let offset = cursor; offset < 160; offset++) {
    yield* steps(1, 2, 2, 1); yield* store();
    yield* steps(3);
  }
  yield* steps(1, 2, 3, 4); // final test, quit RET
  return false;
}
function* framePointerSteps(): Generator<IntroObjectCpuStep> {
  yield* steps(3, 2, 2, 2, 4, 1, 4, 1, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 4);
}
function* coordinateSteps(flip: boolean): Generator<IntroObjectCpuStep> {
  yield* steps(4, 2, 3, 3, flip ? 2 : 3);
  if (flip) yield* steps(2, 2, 1);
  yield* steps(3, 4);
}
function* callbackSteps(b: Uint8Array, at: number): Generator<IntroObjectCpuStep> {
  yield* steps(3, 2, 2, 2, 4, 1, 4, 1, 2, 2, 2, 2, 1, 1); // dispatch
  switch (b[at + F.callback]) {
    case 0: case 1: yield* steps(4); return;
    case 2:
      yield* steps(3, 2, 2, 2);
      if (b[at + F.x] === 0x58) yield* steps(5);
      else yield* steps(2, 2, 2, 4);
      return;
    case 3: {
      const x = b[at + F.x], moved = x === 0x58 ? x : (x + 4) & 255;
      yield* steps(3, 2, 2, 2);
      if (x === 0x58) yield* steps(3);
      else yield* steps(2, 2, 2);
      yield* steps(3, 2, 2);
      if (moved === 0x58) yield* steps(5);
      else yield* steps(2, 2, 2, 4);
      return;
    }
    case 4:
      yield* steps(3, 2, 2, 2, 3, 2, 2, 2, 2, 1, 1);
      if (b[at + F.fieldB] === 0) {
        yield* steps(3, 2, 2, 2);
        if (b[at + F.y] !== 0x58) { yield* steps(2, 2, 2, 4); return; }
        yield* steps(3, 3, 2, 3);
      }
      yield* steps(3, 2, 2, 3, 2, 6); // bob, CALL Intro_Sine
      yield* steps(2, 2);
      if ((b[at + F.fieldC] & 63) >= 32) yield* steps(3, 2, 6);
      else yield* steps(2, 6);
      yield* steps(1, 1, 2, 3, 2, 2, 2, 2, 2, 3); // GetSine setup
      for (let bit = 0; bit < 4; bit++) { // amplitude eight, fourth iteration adds
        yield* steps(2, bit === 3 ? 2 : 3);
        if (bit === 3) yield* steps(2);
        yield* steps(2, 2, 1, bit < 3 ? 3 : 2);
      }
      yield* steps(4, 1);
      if ((b[at + F.fieldC] & 63) >= 32) yield* steps(2, 1);
      yield* steps(4, 3, 2, 2, 4);
      return;
    case 5: yield* steps(3, 2, 2, 3, 2, 2, 2, 4); return;
    default: throw new Error('Invalid intro object callback');
  }
}
