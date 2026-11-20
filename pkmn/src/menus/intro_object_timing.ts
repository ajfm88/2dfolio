// Opening checkpoint-12b2a: CPU work of RunObjectAnimations, without interrupts or a frame clock.
// Costs are SM83 machine cycles (four T-cycles), from the pinned animated_objects.asm / intro_yellow.asm.
import type { IntroObjectTables } from './intro_objects';
import { OBJECT_FIELD as F } from './intro_objects';

export interface IntroObjectTimingResult { readonly cycles: number; readonly full: boolean }

/** Predict completed-store times for ONE update, independently of the byte writer. The caller can get the next
 *  time before resuming runWrites; planning never mutates the supplied objects or OAM. Entry excludes the caller's
 *  CALL (6 cycles); completion includes RET. Interrupts, dispatch, DMA and stalls belong to the future owner.
 *  Snapshot inputs on first next(), finish both iterators before changing tables/objects or starting another run. */
export function* introObjectWriteTimes(
  objects: Uint8Array, initialOffset: number, tables: IntroObjectTables, scene: number,
): Generator<number, IntroObjectTimingResult> {
  const b = objects.slice();
  let cycles = 5, cursor = initialOffset; // ld hl, structs; ld e, 10
  for (let slot = 0; slot < 10; slot++) {
    const at = slot * 16;
    if (b[at + F.index] === 0) cycles += 6; // ld a,[hl]; and a; jr z (taken)
    else {
      cycles += 5 + 16 + callbackCycles(b, at); // active test, save/dispatch CALL, callback through RET
      cycles += 6 + 46; // CALL frame; scratch copies; CALL duration helper
      let frame = b[at + F.frameIndex], command: number, flags: number;
      const script = tables.framesets[b[at + F.frameset]];
      if (b[at + F.duration] !== 0) {
        cycles += 10 + 3 + 6 + 46 + 2 + 4 + 3; // waiting branch through jr .finish
        command = script[frame * 2]; flags = script[frame * 2 + 1];
      } else {
        for (;;) {
          cycles += 11 + 8 + 6 + 46 + 2; // zero duration, increment index, script pointer, load command
          frame = (frame + 1) & 255; command = script[frame * 2];
          if (command === 0xfe) { cycles += 2 + 3 + 19; frame = 255; continue; }
          cycles += 2 + 2;
          if (command === 0xff) { cycles += 2 + 3 + 22; frame = (frame - 2) & 255; continue; }
          cycles += 2 + 2 + 4 + 2 + 4 + 2 + 3 + 2 + 2 + 3 + 2 + 2 + 3;
          flags = script[frame * 2 + 1]; break;
        }
      }
      cycles += 2 + 2 + 2 + 4 + 3 + 4; // .finish: flags, srl, scratch store, pop af, ret
      cycles += 2;
      if (command === 0xfd) cycles += 3 + 1 + 4; // cp fd; taken .finish; and a; ret
      else {
        cycles += 2 + 2;
        if (command === 0xfc) cycles += 3 + 6 + 3 + 2 + 3 + 4 + 1 + 4; // mask CALL and finish
        else {
          cycles += 2 + 6 + 23 + 4 + 2 + 4 + 2 + 2 + 2 + 1 + 4 + 4 + 1 + 2 + 2 + 1;
          const set = tables.oamSets[command];
          for (let entry = 0; entry < set.entries.length; entry++) {
            const attributes = set.entries[entry][3];
            cycles += 4 + 1 + 4 + 1 + 1 + 4 + 1 + 1 + 6 + 22 + ((flags & 0x80) ? 4 : 0) + 1 + 2;
            yield cycles; // Y store completed
            cycles += 2 + 2 + 4 + 1 + 4 + 1 + 1 + 4 + 1 + 1 + 6 + 22 + ((flags & 0x40) ? 4 : 0) + 1 + 2;
            yield cycles; // X
            cycles += 2 + 2 + 4 + 2 + 2;
            yield cycles; // tile
            cycles += 2 + 2 + 6 + 23 + ((attributes & 0x10) ? 3 : 0) + 1 + 4 + 2 + 1;
            if (scene !== 7) { cycles += 2 + 2; yield cycles; }
            else cycles += 3; // no attribute store
            cursor += 4;
            cycles += 2 + 2 + 1 + 4 + 2;
            if (cursor >= 160) {
              cycles += 3 + 3 + 1 + 4 + 3 + 3 + 3 + 4; // full exit, restore caller, quit RET
              return { cycles, full: true };
            }
            cycles += 2 + 1 + (entry + 1 < set.entries.length ? 3 : 2);
          }
          cycles += 3 + 3 + 1 + 4; // pop bc; jr .finish; and a; ret
        }
      }
      cycles += 3 + 3 + 2; // pop de; pop hl; jr c not taken
    }
    cycles += 3 + 2 + 1 + (slot < 9 ? 3 : 2); // .next
  }
  cycles += 4 + 1 + 2; // initial unused-tail pointer
  for (let offset = cursor; offset < 160; offset++) {
    cycles += 1 + 2 + 2 + 1 + 2; // ld a,l; cp end; jr nc untaken; xor a; ld [hli],a
    yield cycles;
    cycles += 3; // jr loop
  }
  cycles += 1 + 2 + 3 + 4; // final tail test, quit RET
  return { cycles, full: false };
}

function callbackCycles(b: Uint8Array, at: number): number {
  const dispatch = 29;
  switch (b[at + F.callback]) {
    case 0: case 1: return dispatch + 4;
    case 2: return dispatch + (b[at + F.x] === 0x58 ? 14 : 19);
    case 3: {
      const x = b[at + F.x], moved = x === 0x58 ? x : (x + 4) & 255;
      return dispatch + 3 + 2 + 2 + 2 + (x === 0x58 ? 3 : 2 + 2 + 2)
        + 3 + 2 + 2 + (moved === 0x58 ? 5 : 2 + 2 + 2 + 4);
    }
    case 4: {
      let cost = dispatch + 3 + 2 + 2 + 2 + 3 + 2 + 2 + 2 + 2 + 1 + 1;
      if (b[at + F.fieldB] === 0) {
        cost += 3 + 2 + 2 + 2;
        if (b[at + F.y] !== 0x58) return cost + 2 + 2 + 2 + 4;
        cost += 3 + 3 + 2 + 3;
      }
      // Bob amplitude is fixed at eight: four multiply-loop iterations, one add. Phase selects sign only.
      return cost + 3 + 2 + 2 + 3 + 2 + 6 + 93 + ((b[at + F.fieldC] & 63) >= 32 ? 6 : 0)
        + 3 + 2 + 2 + 4;
    }
    case 5: return dispatch + 3 + 2 + 2 + 3 + 2 + 2 + 2 + 4;
    default: throw new Error('Invalid intro object callback');
  }
}
