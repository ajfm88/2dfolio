// data/maps/toggleable_objects.asm: ToggleableObjectStates (03:4892) and ToggleableObjectMapPointers (03:469b).
// V5c checkpoint-01 (note 93): data only, unused at runtime until checkpoint-02.
import { BinaryReader } from '../binary_reader';
import { TOGGLEABLE_OBJECT_MAP_POINTERS, TOGGLEABLE_OBJECT_STATES, NO_TOGGLE_DATA } from '../rom_offsets';
import { EXTRACTABLE_MAPS } from './maps';

/** constants/toggle_constants.asm: OFF EQU $11, ON EQU $15. */
const OFF = 0x11;
const ON = 0x15;
/** wToggleableObjectFlags is `flag_array $100` (ram/wram.asm): no more rows can exist. */
const MAX_ROWS = 0x100;

export interface ToggleableObjectState {
  /** Map id (constants/map_constants.asm). */
  map: number;
  /** The object's 1-based number in the map's object_event list (its sprite slot). */
  object: number;
  /** The initial state InitializeToggleableObjectsFlags reads: false (OFF) sets the "hidden" flag. */
  on: boolean;
}

export interface ToggleableObjectsData {
  /** ToggleableObjectStates in ROM order. The array index is the global toggle index (TOGGLE_*), the bit in
   *  wToggleableObjectFlags. The `db -1, 1, ON` terminator is not included. */
  states: ToggleableObjectState[];
  /** ToggleableObjectMapPointers for each extracted map: its first global index, or null for NoToggleData. */
  mapFirst: Record<string, number | null>;
}

export function extractToggleableObjects(rom: BinaryReader): ToggleableObjectsData {
  const states: ToggleableObjectState[] = [];
  for (let row = 0; ; row++) {
    if (row > MAX_ROWS) throw new Error('ToggleableObjectStates: missing terminator');
    const at = TOGGLEABLE_OBJECT_STATES + row * 3;
    const map = rom.readByte(at);
    if (map === 0xff) break;
    const object = rom.readByte(at + 1), state = rom.readByte(at + 2);
    if (state !== OFF && state !== ON) throw new Error(`ToggleableObjectStates row ${row}: state $${state.toString(16)}`);
    if (object < 1 || object > 16) throw new Error(`ToggleableObjectStates row ${row}: object ${object}`);
    states.push({ map, object, on: state === ON });
  }
  if (states.length > MAX_ROWS) throw new Error(`ToggleableObjectStates: ${states.length} rows exceed wToggleableObjectFlags`);
  const mapFirst: Record<string, number | null> = {};
  for (const [name, id] of Object.entries(EXTRACTABLE_MAPS)) {
    const pointer = rom.readWord(TOGGLEABLE_OBJECT_MAP_POINTERS + id * 2);
    const offset = 0x03 * 0x4000 + (pointer & 0x3fff);
    if (offset === NO_TOGGLE_DATA) { mapFirst[name] = null; continue; }
    const delta = offset - TOGGLEABLE_OBJECT_STATES;
    if (delta < 0 || delta % 3 !== 0 || delta / 3 >= states.length)
      throw new Error(`ToggleableObjectMapPointers ${name}: $${pointer.toString(16)} is not a row`);
    const first = delta / 3;
    if (states[first].map !== id) throw new Error(`ToggleableObjectMapPointers ${name}: row ${first} is map ${states[first].map}`);
    mapFirst[name] = first;
  }
  return { states, mapFirst };
}
