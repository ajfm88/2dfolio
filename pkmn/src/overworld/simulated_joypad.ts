// home/map_objects.asm DecodeRLEList, home/overworld.asm GetSimulatedInput,
// engine/events/pewter_guys.asm. Byte streams remain in their stored order.
import type { Direction } from '../core';

export interface SimulatedJoypadState { entries: readonly number[]; index: number }
export interface DecodedRle { entries: number[]; count: number }

/** Includes the $ff sentinel in the returned count, as DecodeRLEList does. */
export function decodeRle(list: readonly number[]): DecodedRle {
  const entries: number[] = [];
  for (let i = 0; i < list.length; i += 2) {
    const value = list[i];
    if (value === 0xff) return { entries: [...entries, 0xff], count: (entries.length + 1) & 0xff };
    const count = list[i + 1];
    if (!Number.isInteger(count) || count < 1 || count > 255) throw new Error('invalid RLE count');
    entries.push(...Array<number>(count).fill(value));
  }
  throw new Error('RLE list has no $ff sentinel');
}

// engine/overworld/auto_movement.asm:195,202,252,261 (pokeyellow e89ead15).
export const PEWTER_MUSEUM_PLAYER = [0, 1, 0x40, 3, 0x20, 13, 0x40, 6, 0xff] as const;
export const PEWTER_MUSEUM_GUIDE = [0x40, 6, 0x80, 13, 0x40, 3, 0x80, 1, 0xff] as const;
export const PEWTER_GYM_PLAYER = [0, 1, 0x10, 2, 0x80, 5, 0x20, 11, 0x40, 5, 0x20, 15, 0xff] as const;
export const PEWTER_GYM_GUIDE = [0, 2, 0x80, 15, 0x40, 5, 0x80, 11, 0, 5, 0xc0, 3, 0xff] as const;

export interface PewterStart { x: number; y: number; prefix: readonly number[] }
// engine/events/pewter_guys.asm:58,81 stores (Y,X,pointer), then these prefixes.
export const PEWTER_MUSEUM_COORDS: readonly PewterStart[] = [
  { x: 27, y: 18, prefix: [0x40, 0x40, 0xff] },
  { x: 27, y: 16, prefix: [0x10, 0x20, 0xff] },
  { x: 26, y: 17, prefix: [0x40, 0x10, 0xff] },
  { x: 28, y: 17, prefix: [0x40, 0x20, 0xff] },
];
export const PEWTER_GYM_COORDS: readonly PewterStart[] = [
  { x: 34, y: 16, prefix: [0x20, 0x80, 0x80, 0x10, 0xff] },
  { x: 35, y: 17, prefix: [0x20, 0x80, 0x10, 0x20, 0xff] },
  { x: 37, y: 18, prefix: [0x20, 0x20, 0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0xff] },
  { x: 37, y: 19, prefix: [0x20, 0x20, 0x40, 0x20, 0xff] },
  { x: 36, y: 17, prefix: [0x20, 0x80, 0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0xff] },
];

/** The caller already did dec a on DecodeRLEList's count. PewterGuys decrements again. */
export function pewterGuys(entries: readonly number[], index: number, which: 'museum' | 'gym', x: number, y: number): SimulatedJoypadState {
  const start = (which === 'museum' ? PEWTER_MUSEUM_COORDS : PEWTER_GYM_COORDS).find(c => c.x === x && c.y === y);
  if (!start) throw new Error(`PewterGuys (${x},${y}): unreachable before V3; unterminated coordinate table`);
  const buffer = [...entries];
  index--;
  for (const value of start.prefix) {
    if (value === 0xff) break;
    buffer[index++] = value;
  }
  return { entries: buffer, index };
}

export class SimulatedJoypad {
  private readonly entries: readonly number[];
  index: number;
  constructor(state: SimulatedJoypadState) { this.entries = [...state.entries]; this.index = state.index; }
  get done(): boolean { return this.index === 0; }
  next(): { entry: Direction | null; collide: boolean } | null {
    if (this.done) return null;
    const value = this.entries[--this.index];
    const entry = value === 0 ? null : value === 0x40 ? 'up' : value === 0x80 ? 'down'
      : value === 0x20 ? 'left' : value === 0x10 ? 'right' : undefined;
    if (entry === undefined) throw new Error(`unsupported simulated joypad byte ${value}`);
    return { entry, collide: this.index === 0 };
  }
}

/** DoScriptedNPCMovement's different direction encoding. The sentinel is not a step. */
export function npcDirections(entries: readonly number[]): Direction[] {
  const result: Direction[] = [];
  for (const value of entries) {
    if (value === 0xff) return result;
    const dir = value === 0 ? 'down' : value === 0x40 ? 'up' : value === 0x80 ? 'left' : value === 0xc0 ? 'right' : undefined;
    if (!dir) throw new Error(`unsupported in-step NPC byte ${value}`);
    result.push(dir);
  }
  throw new Error('NPC direction list has no $ff sentinel');
}
