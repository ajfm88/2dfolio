// Opening checkpoint-11 (note 122): animated_objects.asm and Yellow's callbacks, pure and unused.
// The caller owns tables, shadow OAM, scene number, and resetting the OAM offset before each run.
import type { YellowIntroData } from '../rom/extractors/yellow_intro';

export const INTRO_OBJECT_COUNT = 10;
export const INTRO_OBJECT_SIZE = 16;
export const OBJECT_FIELD = {
  index: 0, frameset: 1, callback: 2, tile: 3, x: 4, y: 5, xOffset: 6, yOffset: 7,
  duration: 8, durationOffset: 9, frameIndex: 10, fieldB: 11, fieldC: 12, fieldD: 13, fieldE: 14, fieldF: 15,
} as const;
// Semantic bytes of wAnimatedObjectsData after the structs; pointer/reserved bytes have no TS counterpart.
export const OBJECT_REGISTER = {
  loaded: 0, oamOffset: 1, attributes: 2, tile: 3, x: 4, y: 5, xOffset: 6, yOffset: 7, globalY: 8, globalX: 9,
} as const;
export type IntroObjectTables = Pick<YellowIntroData, 'spawnStates' | 'framesets' | 'oamSets' | 'sineWave'>;
/** A completed shadow-OAM byte store. The caller may pause before the next store. */
export interface IntroObjectWrite { readonly offset: number; readonly value: number }
const F = OBJECT_FIELD, R = OBJECT_REGISTER;

/** Intro_Sine: unsigned return byte, high byte of the fixed-point product, negative on the second half-cycle. */
export function introSine(phase: number, amplitude: number, wave: readonly number[]): number {
  const position = phase & 0x3f;
  const high = (((amplitude & 0xff) * wave[position & 0x1f]) & 0xffff) >>> 8;
  return (position < 0x20 ? high : -high) & 0xff;
}

export class IntroObjectEngine {
  readonly objects = new Uint8Array(INTRO_OBJECT_COUNT * INTRO_OBJECT_SIZE);
  readonly registers = new Uint8Array(10);

  constructor(private readonly tables: IntroObjectTables) {}

  /** ClearObjectAnimationBuffers does not clear shadow OAM. Table bindings remain supplied by the owner. */
  clear(): void { this.objects.fill(0); this.registers.fill(0); }

  /** SpawnAnimatedObject: first free slot, or null for carry set. Coordinates are the raw OAM-space bytes. */
  spawn(id: number, x: number, y: number): number | null {
    const b = this.objects;
    for (let slot = 0; slot < INTRO_OBJECT_COUNT; slot++) {
      const at = slot * INTRO_OBJECT_SIZE;
      if (b[at + F.index] !== 0) continue;
      const row = this.tables.spawnStates[id];
      this.registers[R.loaded]++;
      b.fill(0, at, at + INTRO_OBJECT_SIZE);
      b[at + F.index] = this.registers[R.loaded];
      b[at + F.frameset] = row[0]; b[at + F.callback] = row[1];
      // The third spawn byte is skipped; the tile byte is explicitly zeroed.
      b[at + F.x] = x; b[at + F.y] = y; b[at + F.frameIndex] = 0xff;
      return slot;
    }
    return null;
  }

  mask(slot: number): void { this.objects[slot * INTRO_OBJECT_SIZE + F.index] = 0; }
  maskAll(): void { for (let slot = 0; slot < INTRO_OBJECT_COUNT; slot++) this.mask(slot); }

  /** SetCurrentAnimatedObjectCallbackAndResetFrameStateRegisters writes frameset byte 1, NOT callback byte 2. */
  setFrameset(slot: number, id: number): void {
    const at = slot * INTRO_OBJECT_SIZE, b = this.objects;
    b[at + F.frameset] = id; b[at + F.duration] = 0; b[at + F.durationOffset] = 0; b[at + F.frameIndex] = 0xff;
  }

  /** RunObjectAnimations: return true for OAM-full carry, leaving later objects unprocessed. */
  run(oam: Uint8Array, scene: number): boolean {
    const program = this.runWrites(oam, scene);
    let step = program.next();
    while (!step.done) step = program.next();
    return step.value;
  }

  /** Same update, yielding immediately after each actual store, including unused-tail zeroes. This is not a frame
   *  or cycle clock. Resume the same iterator to finish the update; do not interleave another update or mutate
   *  object state while it is suspended. Constructing the iterator does no work. */
  *runWrites(oam: Uint8Array, scene: number): Generator<IntroObjectWrite, boolean> {
    for (let slot = 0; slot < INTRO_OBJECT_COUNT; slot++) {
      const at = slot * INTRO_OBJECT_SIZE;
      if (this.objects[at + F.index] === 0) continue;
      this.callback(at);
      if (yield* this.frameWrites(at, oam, scene)) return true;
    }
    // The cartridge clears every unused byte, not just sprite Y coordinates.
    for (let p = this.registers[R.oamOffset]; p < 160; p++) {
      oam[p] = 0;
      yield { offset: p, value: oam[p] };
    }
    return false;
  }

  private callback(at: number): void {
    const b = this.objects;
    switch (b[at + F.callback]) {
      case 0: case 1: return;
      case 2:
        if (b[at + F.x] !== 0x58) b[at + F.x] -= 4;
        return;
      case 3: {
        let a = b[at + F.x];
        if (a !== 0x58) { a = (a + 4) & 0xff; b[at + F.x] = a; }
        // MoveRightAndDown retains A from X: it never loads the old Y byte.
        if (a !== 0x58) b[at + F.y] = a + 1;
        return;
      }
      case 4:
        if (b[at + F.fieldB] === 0) {
          if (b[at + F.y] !== 0x58) { b[at + F.y] -= 2; return; }
          b[at + F.fieldB]++;
        }
        b[at + F.yOffset] = introSine(b[at + F.fieldC]++, 8, this.tables.sineWave);
        return;
      case 5:
        b[at + F.x] += b[at + F.fieldB];
        return;
    }
  }

  private nextFrame(at: number): number {
    const b = this.objects, r = this.registers;
    const script = this.tables.framesets[b[at + F.frameset]];
    for (;;) {
      const waiting = b[at + F.duration] !== 0;
      if (waiting) b[at + F.duration]--;
      else b[at + F.frameIndex]++;
      const p = b[at + F.frameIndex] * 2, command = script[p];
      if (!waiting && command === 0xfe) {
        b[at + F.duration] = 0; b[at + F.frameIndex] = 0xff;
        continue;
      }
      if (!waiting && command === 0xff) {
        b[at + F.duration] = 0; b[at + F.frameIndex] -= 2;
        continue;
      }
      const flags = script[p + 1];
      if (!waiting) b[at + F.duration] = (flags & 0x3f) + b[at + F.durationOffset];
      r[R.attributes] = (flags & 0xc0) >>> 1;
      return command;
    }
  }

  private *frameWrites(at: number, oam: Uint8Array, scene: number): Generator<IntroObjectWrite, boolean> {
    const b = this.objects, r = this.registers;
    r[R.attributes] = 0;
    r[R.tile] = b[at + F.tile]; r[R.x] = b[at + F.x]; r[R.y] = b[at + F.y];
    r[R.xOffset] = b[at + F.xOffset]; r[R.yOffset] = b[at + F.yOffset];
    const command = this.nextFrame(at);
    if (command === 0xfd) return false;
    if (command === 0xfc) { b[at + F.index] = 0; return false; }
    const set = this.tables.oamSets[command];
    r[R.tile] += set.tileOffset;
    for (const [y, x, tile, attr] of set.entries) {
      let p = r[R.oamOffset];
      const dy = r[R.attributes] & 0x40 ? -(y + 8) : y;
      const dx = r[R.attributes] & 0x20 ? -(x + 8) : x;
      oam[p] = r[R.y] + r[R.yOffset] + r[R.globalY] + dy;
      yield { offset: p, value: oam[p++] };
      oam[p] = r[R.x] + r[R.xOffset] + r[R.globalX] + dx;
      yield { offset: p, value: oam[p++] };
      oam[p] = r[R.tile] + tile;
      yield { offset: p, value: oam[p++] };
      let attributes = ((attr ^ r[R.attributes]) & 0xe0) | (attr & 0x10);
      if (attributes & 0x10) attributes |= 4;
      if (scene !== 7) {
        oam[p] = attributes;
        yield { offset: p, value: oam[p] };
      }
      r[R.oamOffset] = p + 1;
      if (r[R.oamOffset] >= 160) return true;
    }
    return false;
  }
}
