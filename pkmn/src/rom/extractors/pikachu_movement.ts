// Pikachu's scripted-movement data (A6e): engine/pikachu/pikachu_movement.asm.
//   PikachuMovementDatabase  63 records of [func1, param1, func2, param2]; a param of $80
//                            reads the next program byte instead
//   SineWave_3f              32 little-endian words (`sine_table 32`)
//   The byte programs that today's callers run (rom_offsets.ts PIKACHU_MOVEMENT_PROGRAMS)
// Output: pikachu_movement.json. The interpreter is pikachu/pikachu_movement.ts.

import { BinaryReader } from '../binary_reader';
import {
  PIKACHU_MOVEMENT_DATABASE, PIKACHU_MOVEMENT_SINE, PIKACHU_MOVEMENT_PROGRAMS,
} from '../rom_offsets';
import { decodePikachuMovementProgram } from '../../pikachu/pikachu_movement';

export interface PikachuMovementRecord {
  func1: number;
  param1: number;
  func2: number;
  param2: number;
}

export type PikachuMovementProgramId = keyof typeof PIKACHU_MOVEMENT_PROGRAMS;

export interface PikachuMovementData {
  /** Indexed by opcode, $00–$3e. */
  commands: PikachuMovementRecord[];
  /** SineWave_3f */
  sine: number[];
  /** Raw program bytes, ending in $3f. */
  programs: Record<PikachuMovementProgramId, number[]>;
}

export const PIKACHU_MOVEMENT_RECORDS = 63;
export const PIKACHU_MOVEMENT_SINE_WORDS = 32;

export function extractPikachuMovement(rom: BinaryReader): PikachuMovementData {
  const commands: PikachuMovementRecord[] = [];
  for (let i = 0; i < PIKACHU_MOVEMENT_RECORDS; i++) {
    const at = PIKACHU_MOVEMENT_DATABASE + i * 4;
    commands.push({
      func1: rom.readByte(at),
      param1: rom.readByte(at + 1),
      func2: rom.readByte(at + 2),
      param2: rom.readByte(at + 3),
    });
  }
  const sine: number[] = [];
  for (let i = 0; i < PIKACHU_MOVEMENT_SINE_WORDS; i++) sine.push(rom.readWord(PIKACHU_MOVEMENT_SINE + i * 2));

  const programs = {} as Record<PikachuMovementProgramId, number[]>;
  for (const [id, { offset, length }] of Object.entries(PIKACHU_MOVEMENT_PROGRAMS)) {
    programs[id as PikachuMovementProgramId] = Array.from(rom.readBytes(offset, length));
  }

  const data: PikachuMovementData = { commands, sine, programs };
  // Every program must decode to whole commands and end exactly at its $3f
  for (const bytes of Object.values(programs)) decodePikachuMovementProgram(data.commands, bytes);
  return data;
}
