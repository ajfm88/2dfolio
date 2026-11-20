// PlayIntroScene's literal tables. Data only until opening checkpoints 11–14.
import { BinaryReader } from '../binary_reader';
import {
  YELLOW_INTRO_SPAWN_STATES, YELLOW_INTRO_FRAMESETS, YELLOW_INTRO_OAM_SETS,
  YELLOW_INTRO_GRAPHICS_1, YELLOW_INTRO_SPEED_BARS, YELLOW_INTRO_SEA_WAVE,
  YELLOW_INTRO_SINE_WAVE, YELLOW_INTRO_THUNDER_PALS, YELLOW_INTRO_FADE_PALS,
} from '../rom_offsets';

export interface YellowIntroData {
  spawnStates: [number, number, number][];
  // Raw frame/duration pairs followed by the single $fe/$ff byte. No padding.
  framesets: number[][];
  // Coordinates and attributes remain unsigned cartridge bytes.
  oamSets: { tileOffset: number; entries: [number, number, number, number][] }[];
  speedBars: [number, number, number][];
  seaWave: number[];
  sineWave: number[];
  thunderboltPalettes: number[];
  fadePalettes: number[];
}

export function extractYellowIntro(rom: BinaryReader): YellowIntroData {
  const bytes = (p: number, size: number): number[] => {
    const data = rom.readBytes(p, size);
    if (data.length !== size) throw new Error('Yellow intro: truncated table');
    return Array.from(data);
  };
  const pointer = (p: number, start: number, end: number): number => {
    const address = rom.readWord(p);
    const offset = rom.resolvePointer(0x3e, address);
    if (address < 0x4000 || address >= 0x8000 || offset < start || offset >= end)
      throw new Error('Yellow intro: table pointer outside its data region');
    return offset;
  };
  const triples = (p: number, count: number): [number, number, number][] =>
    Array.from({ length: count }, (_, i) => {
      const row = bytes(p + i * 3, 3);
      return [row[0], row[1], row[2]];
    });
  const framesets = Array.from({ length: 11 }, (_, i) => {
    let p = pointer(YELLOW_INTRO_FRAMESETS + i * 2, YELLOW_INTRO_FRAMESETS + 22, YELLOW_INTRO_OAM_SETS);
    const script: number[] = [];
    while (p < YELLOW_INTRO_OAM_SETS) {
      const command = rom.readByte(p++);
      script.push(command);
      if (command === 0xfe || command === 0xff) return script;
      if (command >= 20 || p >= YELLOW_INTRO_OAM_SETS)
        throw new Error('Yellow intro: invalid or unterminated frameset');
      script.push(rom.readByte(p++));
    }
    throw new Error('Yellow intro: unterminated frameset');
  });
  const oamSets = Array.from({ length: 20 }, (_, i) => {
    const row = YELLOW_INTRO_OAM_SETS + i * 3;
    const p = pointer(row + 1, YELLOW_INTRO_OAM_SETS + 60, YELLOW_INTRO_GRAPHICS_1);
    const count = rom.readByte(p);
    if (!count || count > 40 || p + 1 + count * 4 > YELLOW_INTRO_GRAPHICS_1)
      throw new Error('Yellow intro: invalid OAM length');
    const entries: [number, number, number, number][] = Array.from({ length: count }, (_, j) => {
      const entry = bytes(p + 1 + j * 4, 4);
      return [entry[0], entry[1], entry[2], entry[3]];
    });
    return { tileOffset: rom.readByte(row), entries };
  });
  return {
    spawnStates: triples(YELLOW_INTRO_SPAWN_STATES, 11), framesets, oamSets,
    speedBars: triples(YELLOW_INTRO_SPEED_BARS, 8), seaWave: bytes(YELLOW_INTRO_SEA_WAVE, 32),
    sineWave: Array.from({ length: 32 }, (_, i) => rom.readWord(YELLOW_INTRO_SINE_WAVE + i * 2)),
    thunderboltPalettes: bytes(YELLOW_INTRO_THUNDER_PALS, 52), fadePalettes: bytes(YELLOW_INTRO_FADE_PALS, 8),
  };
}
