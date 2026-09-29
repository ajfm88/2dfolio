// Extract trainer data from ROM → same format as data/trainers.json
// trainers.json format: { [className: string]: TrainerClass }

import { BinaryReader } from '../binary_reader';
import {
  TRAINER_DATA_PTRS, TRAINER_NAMES, TRAINER_PIC_MONEY,
  TRAINER_MOVE_CHOICES, TRAINER_SPECIAL_MOVES, TRAINER_DATA_END,
  TRAINER_DATA_BANK, NUM_TRAINERS,
} from '../rom_offsets';
// Name lookup tables passed as parameters (read from ROM, not hardcoded)
import { decodeText } from './text';

export interface TrainerPartyMember {
  species: string;
  level: number;
  moveOverrides?: Record<string, string>;
}

export interface TrainerClass {
  id: number;
  displayName: string;
  baseMoney: number;
  aiModifiers: number[];
  parties: TrainerPartyMember[][];
}

/** Parse BCD3 (3-byte big-endian BCD) to integer.
 *  Each nibble is a decimal digit: 0x00 0x15 0x00 → 1500. */
function parseBcd3(b0: number, b1: number, b2: number): number {
  return (
    (b0 >> 4) * 100000 + (b0 & 0xf) * 10000 +
    (b1 >> 4) * 1000 + (b1 & 0xf) * 100 +
    (b2 >> 4) * 10 + (b2 & 0xf)
  );
}

/** Read all trainer display names (0x50-terminated variable-length strings) */
function readTrainerNames(rom: BinaryReader): string[] {
  const names: string[] = [];
  let offset = TRAINER_NAMES;
  for (let i = 0; i < NUM_TRAINERS; i++) {
    const name = decodeText(rom, offset);
    names.push(name);
    // Advance past the 0x50 terminator
    let len = 0;
    while (rom.readByte(offset + len) !== 0x50) len++;
    offset += len + 1;
  }
  return names;
}

/** Read base money for each trainer class from pic_money table.
 *  Format: 2 bytes pic pointer + 3 bytes BCD money = 5 bytes per entry.
 *  Effective baseMoney = floor(bcdValue / 100) (only first 2 BCD bytes are used in-game). */
function readBaseMoney(rom: BinaryReader): number[] {
  const result: number[] = [];
  for (let i = 0; i < NUM_TRAINERS; i++) {
    const offset = TRAINER_PIC_MONEY + i * 5;
    // Skip 2-byte pic pointer
    const bcd0 = rom.readByte(offset + 2);
    const bcd1 = rom.readByte(offset + 3);
    const bcd2 = rom.readByte(offset + 4);
    const bcdValue = parseBcd3(bcd0, bcd1, bcd2);
    result.push(Math.floor(bcdValue / 100));
  }
  return result;
}

/** Read AI move choice modifiers for each trainer class.
 *  Each entry is a 0-terminated list of modifier bytes. */
function readMoveChoices(rom: BinaryReader): number[][] {
  const result: number[][] = [];
  let offset = TRAINER_MOVE_CHOICES;
  for (let i = 0; i < NUM_TRAINERS; i++) {
    const mods: number[] = [];
    while (rom.readByte(offset) !== 0) {
      mods.push(rom.readByte(offset));
      offset++;
    }
    offset++; // skip 0 terminator
    result.push(mods);
  }
  return result;
}

/** Parse all trainer party data from ROM.
 *  Returns an array (indexed by class 0-46) of party arrays. */
function readParties(rom: BinaryReader, pokemonNames: Record<number, string>): TrainerPartyMember[][][] {
  const result: TrainerPartyMember[][][] = [];

  // Read all data pointers first
  const dataOffsets: number[] = [];
  for (let i = 0; i < NUM_TRAINERS; i++) {
    dataOffsets.push(rom.readPointer(TRAINER_DATA_PTRS + i * 2, TRAINER_DATA_BANK));
  }

  for (let classIdx = 0; classIdx < NUM_TRAINERS; classIdx++) {
    let offset = dataOffsets[classIdx];

    const parties: TrainerPartyMember[][] = [];

    // If this class shares its pointer with a later class, it has 0 parties.
    // (e.g., UNUSED_JUGGLER shares with FISHER, CHIEF shares with SCIENTIST)
    let shared = false;
    for (let j = classIdx + 1; j < NUM_TRAINERS; j++) {
      if (dataOffsets[j] === offset) {
        shared = true;
        break;
      }
    }
    if (shared) {
      result.push(parties);
      continue;
    }

    // Find the end boundary: the smallest pointer that is strictly greater
    // than this class's pointer.
    // For the last class, use the known end of trainer data region.
    let endOffset = TRAINER_DATA_END;
    for (let j = 0; j < NUM_TRAINERS; j++) {
      if (dataOffsets[j] > offset && dataOffsets[j] < endOffset) {
        endOffset = dataOffsets[j];
      }
    }

    while (offset < endOffset) {
      const firstByte = rom.readByte(offset);

      if (firstByte === 0xFF) {
        // Variable level format: 0xFF, level1, species1, level2, species2, ..., 0
        offset++; // skip 0xFF
        const members: TrainerPartyMember[] = [];
        while (rom.readByte(offset) !== 0) {
          const level = rom.readByte(offset);
          const speciesId = rom.readByte(offset + 1);
          const species = pokemonNames[speciesId] || `MON_${speciesId}`;
          members.push({ species, level });
          offset += 2;
        }
        offset++; // skip 0 terminator
        if (members.length > 0) {
          parties.push(members);
        }
      } else {
        // Same level format: level, species1, species2, ..., 0
        const level = firstByte;
        offset++;
        const members: TrainerPartyMember[] = [];
        while (rom.readByte(offset) !== 0) {
          const speciesId = rom.readByte(offset);
          const species = pokemonNames[speciesId] || `MON_${speciesId}`;
          members.push({ species, level });
          offset++;
        }
        offset++; // skip 0 terminator
        if (members.length > 0) {
          parties.push(members);
        }
      }
    }

    result.push(parties);
  }

  return result;
}

/** Special move override entry from ROM */
interface SpecialMoveEntry {
  classId: number;
  trainerId: number;  // 1-based party index
  overrides: { pokemonIndex: number; moveSlot: number; moveId: number }[];
}

/** Read special trainer move overrides (Yellow-specific).
 *  Format: db classId, trainerId, then (monIdx, moveSlot, moveId)... 0, terminated by 0xFF. */
function readSpecialMoves(rom: BinaryReader): SpecialMoveEntry[] {
  const result: SpecialMoveEntry[] = [];
  let offset = TRAINER_SPECIAL_MOVES;

  while (rom.readByte(offset) !== 0xFF) {
    const classId = rom.readByte(offset);
    offset++;
    const trainerId = rom.readByte(offset);
    offset++;

    const overrides: { pokemonIndex: number; moveSlot: number; moveId: number }[] = [];
    while (rom.readByte(offset) !== 0) {
      const pokemonIndex = rom.readByte(offset);
      offset++;
      const moveSlot = rom.readByte(offset);
      offset++;
      const moveId = rom.readByte(offset);
      offset++;
      overrides.push({ pokemonIndex, moveSlot, moveId });
    }
    offset++; // skip 0 terminator

    result.push({ classId, trainerId, overrides });
  }

  return result;
}

/** Apply special move overrides to party data */
function applySpecialMoves(
  parties: TrainerPartyMember[][][],
  specials: SpecialMoveEntry[],
  moveNames: string[],
): void {
  for (const entry of specials) {
    const classIdx = entry.classId - 1; // class IDs are 1-based
    if (classIdx < 0 || classIdx >= parties.length) continue;

    const partyIdx = entry.trainerId - 1; // trainer IDs are 1-based
    if (partyIdx < 0 || partyIdx >= parties[classIdx].length) continue;

    const party = parties[classIdx][partyIdx];
    for (const ov of entry.overrides) {
      const monIdx = ov.pokemonIndex - 1; // 1-based
      if (monIdx < 0 || monIdx >= party.length) continue;

      const moveName = moveNames[ov.moveId] || `MOVE_${ov.moveId}`;
      const member = party[monIdx];
      if (!member.moveOverrides) {
        member.moveOverrides = {};
      }
      member.moveOverrides[String(ov.moveSlot)] = moveName;
    }
  }
}

export function extractTrainers(
  rom: BinaryReader,
  pokemonNames: Record<number, string>,
  moveNames: string[],
  trainerClassNames: string[],
): Record<string, TrainerClass> {
  const displayNames = readTrainerNames(rom);
  const baseMoney = readBaseMoney(rom);
  const aiModifiers = readMoveChoices(rom);
  const parties = readParties(rom, pokemonNames);
  const specials = readSpecialMoves(rom);

  // Apply special moves to parties before building output
  applySpecialMoves(parties, specials, moveNames);

  const result: Record<string, TrainerClass> = {};

  for (let i = 0; i < NUM_TRAINERS; i++) {
    const classId = i + 1; // IDs are 1-based (NOBODY=0 is excluded)
    const className = trainerClassNames[classId];

    result[className] = {
      id: classId,
      displayName: displayNames[i],
      baseMoney: baseMoney[i],
      aiModifiers: aiModifiers[i],
      parties: parties[i],
    };
  }

  return result;
}
