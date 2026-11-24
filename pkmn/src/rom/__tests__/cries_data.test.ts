// Cries checkpoint-01 (note 140): data only. CryData and the 38 base cries.
// Commands are encoded from macros/scripts/audio.asm and checked against the ROM
// and the disassembly. Nothing here plays a cry.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractSfx, extractSfxAt, SFX_HEADERS, type AudioCommand } from '../extractors/audio';
import { extractCries, type CryRow } from '../extractors/cries';
import { CRY_DATA } from '../rom_offsets';

const ROM_PATH = process.env.ROM_PATH;
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const CRY_SFX_START = 0x14;
const BANKS = [
  { bank: 0x02, suffix: '1' },
  { bank: 0x08, suffix: '2' },
  { bank: 0x1f, suffix: '3' },
  { bank: 0x20, suffix: '4' },
] as const;
const CHANNELS = [5, 6, 8] as const;

const offset = (bank: number, address: number) => bank * 0x4000 + (address & 0x3fff);
const cryName = (base: number) => `cry${base.toString(16).padStart(2, '0')}`;
const cryLabel = (base: number, suffix: string, channel?: number) =>
  `SFX_Cry${base.toString(16).padStart(2, '0').toUpperCase()}_${suffix}${channel === undefined ? '' : `_Ch${channel}`}`;

let rom: Buffer;
let reader: BinaryReader;
let symbols: Map<string, [number, number]>;

beforeAll(() => {
  if (!ROM_PATH) return;
  rom = readFileSync(ROM_PATH);
  reader = new BinaryReader(Uint8Array.from(rom).buffer);
  const text = execFileSync('git', ['-C', REFS, 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8', windowsHide: true });
  symbols = new Map();
  for (const line of text.split('\n')) {
    const match = /^(\w+):(\w+) (\S+)\s*$/.exec(line);
    if (match) symbols.set(match[3], [parseInt(match[1], 16), parseInt(match[2], 16)]);
  }
});

function symbol(label: string): [number, number] {
  const found = symbols.get(label);
  if (!found) throw new Error(`missing pinned symbol ${label}`);
  return found;
}

function magnitude(n: number): number {
  return n < 0 ? 8 | -n : n;
}

/** One channel body, from its label through the line before the next label. */
function channelLines(file: string, label: string): string[] {
  const lines = readFileSync(resolve(REFS, file), 'utf8').split('\n')
    .map(line => line.replace(/;.*/, '').trim()).filter(Boolean);
  const start = lines.findIndex(line => line === `${label}:` || line === `${label}::`);
  if (start < 0) throw new Error(`missing source ${label}`);
  const next = lines.findIndex((line, i) => i > start && /^\w+::?$/.test(line));
  return lines.slice(start + 1, next < 0 ? undefined : next);
}

/** Encode the cry macros the 38 bank-$02 bodies use. Unknown macros fail. */
function sourceChannel(lines: string[], loopLabel: string): { bytes: number[]; commands: AudioCommand[] } {
  const bytes: number[] = [];
  const commands: AudioCommand[] = [];
  for (const line of lines) {
    const [macro, ...tail] = line.split(/\s+/);
    const args = tail.join('').split(',').map(part => part.trim()).filter(Boolean);
    const num = (i: number) => Number(args[i]);
    switch (macro) {
      case 'duty_cycle':
        bytes.push(0xec, num(0));
        commands.push({ cmd: macro, value: num(0) });
        break;
      case 'duty_cycle_pattern': {
        const [d0, d1, d2, d3] = [num(0), num(1), num(2), num(3)];
        bytes.push(0xfc, (d0 << 6) | (d1 << 4) | (d2 << 2) | d3);
        commands.push({ cmd: macro, d0, d1, d2, d3 });
        break;
      }
      case 'square_note': {
        const fade = magnitude(num(2));
        bytes.push(0x20 | num(0), (num(1) << 4) | fade, num(3) & 255, num(3) >> 8);
        commands.push({ cmd: macro, length: num(0), volume: num(1), fade, frequency: num(3) });
        break;
      }
      case 'noise_note': {
        const fade = magnitude(num(2));
        bytes.push(0x20 | num(0), (num(1) << 4) | fade, num(3));
        commands.push({ cmd: macro, length: num(0), volume: num(1), fade, param: num(3) });
        break;
      }
      case 'sound_loop': {
        // Backward loop. The only one is cry0d channel 5, to its own first command.
        const [, address] = symbol(args[1]);
        bytes.push(0xfe, num(0), address & 255, address >> 8);
        if (args[1] !== loopLabel) throw new Error(`sound_loop leaves ${loopLabel}: ${line}`);
        commands.push({ cmd: macro, count: num(0), target: 0 });
        break;
      }
      case 'sound_ret':
        bytes.push(0xff);
        commands.push({ cmd: macro });
        break;
      default:
        throw new Error(`unsupported source macro ${line}`);
    }
  }
  if (lines.length === 0) throw new Error(`empty channel ${loopLabel}`);
  return { bytes, commands };
}

function asmRows(): (CryRow & { name: string })[] {
  const rows: (CryRow & { name: string })[] = [];
  for (const raw of readFileSync(resolve(REFS, 'data/pokemon/cries.asm'), 'utf8').split('\n')) {
    const match = /mon_cry SFX_CRY_([0-9A-F]+), \$([0-9A-F]+), \$([0-9A-F]+)\s*;\s*(.*)/.exec(raw.trim());
    if (!match) continue;
    rows.push({
      index: rows.length + 1,
      base: parseInt(match[1], 16),
      pitch: parseInt(match[2], 16),
      length: parseInt(match[3], 16),
      name: match[4].trim(),
    });
  }
  return rows;
}

function committed(path: string): string {
  const data = readFileSync(resolve(DATA, path), 'utf8');
  expect(readFileSync(resolve(STATIC, path), 'utf8')).toBe(data);
  return data;
}

describe.skipIf(!ROM_PATH)('cries checkpoint-01 data', () => {
  it('pins CRY_SFX_START and CRY_SFX_END to the constants the engine already uses', () => {
    const modifiers = readFileSync(resolve(__dirname, '../../audio/sfx_modifiers.ts'), 'utf8');
    const alarm = readFileSync(resolve(__dirname, '../../audio/low_health_alarm.ts'), 'utf8');
    expect(modifiers).toMatch(/const CRY_SFX_START = 0x14;/);
    expect(alarm).toMatch(/export const CRY_SFX_END = 0x86;/);
    expect(CRY_SFX_START + 3 * 0x25 + 3).toBe(0x86);
  });

  it('CryData is 190 rows, each matching cries.asm, the ROM bytes and cries.json', () => {
    expect(symbol('CryData')).toEqual([0x0e, 0x5462]);
    expect(CRY_DATA).toBe(offset(0x0e, 0x5462));
    const rows = asmRows();
    expect(rows).toHaveLength(190);
    expect(rows.map(row => ({ index: row.index, base: row.base, pitch: row.pitch, length: row.length }))).toEqual(extractCries(reader).rows);
    for (const row of rows) {
      const at = CRY_DATA + (row.index - 1) * 3;
      expect([...rom.subarray(at, at + 3)], row.name).toEqual([row.base, row.pitch, row.length]);
      expect(row.base).toBeGreaterThanOrEqual(0);
      expect(row.base).toBeLessThanOrEqual(0x25);
    }
    const named = (name: string) => rows.find(row => row.name === name);
    expect(named('Rhydon')).toEqual({ index: 1, base: 0x11, pitch: 0x00, length: 0x80, name: 'Rhydon' });
    expect(named('Nidoran♂')).toMatchObject({ base: 0x00, pitch: 0x00, length: 0x80 });
    expect(named('Clefairy')).toMatchObject({ base: 0x19, pitch: 0xcc, length: 0x01 });
    expect(named('Gengar')).toMatchObject({ base: 0x07, pitch: 0x00, length: 0xff });
    expect(named('Mew')).toMatchObject({ base: 0x1e, pitch: 0xee, length: 0xff });
    expect(named('Pikachu')).toMatchObject({ base: 0x0f, pitch: 0xee, length: 0x01 });
    const extracted = extractCries(reader);
    expect(committed('cries.json')).toBe(JSON.stringify(extracted, null, 2) + '\n');
  });

  it('cry00–cry25 are bank $02 at pret\'s symbols, and each id is CRY_SFX_START + 3 × base', () => {
    const names = Array.from({ length: 38 }, (_, base) => cryName(base));
    expect(Object.keys(SFX_HEADERS).filter(name => name.startsWith('cry')).sort()).toEqual([...names].sort());
    for (let base = 0; base < 38; base++) {
      const addr = 0x403c + base * 9;
      expect(SFX_HEADERS[cryName(base)]).toEqual({ bank: 0x02, addr });
      expect(symbol(cryLabel(base, '1'))).toEqual([0x02, addr]);
      expect((addr - 0x4000) / 3).toBe(CRY_SFX_START + 3 * base);
      for (const { bank, suffix } of BANKS) {
        expect(symbol(cryLabel(base, suffix))).toEqual([bank, addr]);
      }
    }
  });

  it('each bank-$02 cry matches its .asm commands, the ROM bytes, and the committed JSON', () => {
    for (let base = 0; base < 38; base++) {
      const name = cryName(base);
      const header = SFX_HEADERS[name].addr;
      const at = offset(0x02, header);
      expect([...rom.subarray(at, at + 9)], name).toEqual([
        (3 - 1) << 6 | (5 - 1), ...word(symbol(cryLabel(base, '1', 5))[1]),
        6 - 1, ...word(symbol(cryLabel(base, '1', 6))[1]),
        8 - 1, ...word(symbol(cryLabel(base, '1', 8))[1]),
      ]);
      const channels = CHANNELS.map((id, index) => {
        const label = cryLabel(base, '1', id);
        const source = sourceChannel(channelLines(`audio/sfx/${name}_1.asm`, label), label);
        const pointer = symbol(label);
        expect(pointer[0], label).toBe(0x02);
        // cry02/05/0c/19/21 channel 6 and cry06 channel 5 have no sound_ret of their own.
        // They fall into the next label, whose whole body is sound_ret, and that byte is shared.
        const last = source.commands[source.commands.length - 1];
        if (last?.cmd !== 'sound_ret') {
          const nextId = CHANNELS[index + 1];
          const nextLabel = cryLabel(base, '1', nextId);
          const next = symbol(nextLabel);
          expect(channelLines(`audio/sfx/${name}_1.asm`, nextLabel), label).toEqual(['sound_ret']);
          expect(next, label).toEqual([0x02, pointer[1] + source.bytes.length]);
          source.bytes.push(0xff);
          source.commands.push({ cmd: 'sound_ret' });
        }
        const start = offset(0x02, pointer[1]);
        expect([...rom.subarray(start, start + source.bytes.length)], label).toEqual(source.bytes);
        return { id, commands: source.commands };
      });
      const extracted = { channels };
      expect(extractSfx(reader, name)).toEqual(extracted);
      expect(committed(`audio/sfx/${name}.json`)).toBe(JSON.stringify(extracted, null, 2) + '\n');
    }
  });

  it('banks $08, $1f and $20 match bank $02; only cry0d\'s sound_loop address differs', () => {
    for (let base = 0; base < 38; base++) {
      const name = cryName(base);
      const header = SFX_HEADERS[name].addr;
      const bank2 = extractSfx(reader, name)!;
      const stripped2 = stripBank(readFileSync(resolve(REFS, `audio/sfx/${name}_1.asm`), 'utf8'), '1');
      for (const { bank, suffix } of BANKS.slice(1)) {
        expect(stripBank(readFileSync(resolve(REFS, `audio/sfx/${name}_${suffix}.asm`), 'utf8'), suffix), name).toBe(stripped2);
        expect(extractSfxAt(reader, bank, header), `${name} $${bank.toString(16)}`).toEqual(bank2);
        const at = offset(bank, header);
        expect([rom[at], rom[at + 3], rom[at + 6]], name).toEqual([0x84, 5, 7]);
        CHANNELS.forEach((id, index) => {
          const label = cryLabel(base, suffix, id);
          const pointer = symbol(label);
          expect(pointer).toEqual([bank, rom[at + 1 + index * 3] | (rom[at + 2 + index * 3] << 8)]);
          const from2 = channelBytes(0x02, symbol(cryLabel(base, '1', id))[1], id === 8);
          const here = channelBytes(bank, pointer[1], id === 8);
          const loops = from2.flatMap((byte, i) => byte === 0xfe ? [i] : []);
          if (base === 0x0d && id === 5) {
            expect(loops).toEqual([26]);
            expect(here, label).toHaveLength(from2.length);
            const differences = here.flatMap((byte, i) => byte !== from2[i] ? [i] : []);
            expect(differences, label).toEqual([loops[0] + 2, loops[0] + 3]);
            expect(here[loops[0]]).toBe(0xfe);
            expect(here[loops[0] + 1]).toBe(from2[loops[0] + 1]);
            const target = here[loops[0] + 2] | (here[loops[0] + 3] << 8);
            expect(target).toBe(symbol(cryLabel(base, suffix, 5))[1]);
            expect(target).not.toBe(symbol(cryLabel(base, '1', 5))[1]);
          } else {
            expect(loops, label).toEqual([]);
            expect(here, label).toEqual(from2);
          }
        });
      }
    }
  });
});

function word(address: number): [number, number] {
  return [address & 255, address >> 8];
}

/** Drop the audio-bank suffix so the four source files can be compared as text. */
function stripBank(source: string, suffix: string): string {
  return source.replace(new RegExp(`_${suffix}(?=_|\\b)`, 'g'), '');
}

/** Channel command bytes through the terminating sound_ret. sound_loop is included. */
function channelBytes(bank: number, address: number, noise: boolean): number[] {
  let pos = offset(bank, address);
  const bytes: number[] = [];
  for (;;) {
    const byte = rom[pos];
    if (byte === 0xff) { bytes.push(byte); return bytes; }
    if (byte === 0xfe) { bytes.push(byte, rom[pos + 1], rom[pos + 2], rom[pos + 3]); pos += 4; continue; }
    if (byte === 0xfc || byte === 0xec) { bytes.push(byte, rom[pos + 1]); pos += 2; continue; }
    if (byte >= 0x20 && byte <= 0x2f) {
      const length = noise ? 3 : 4;
      for (let i = 0; i < length; i++) bytes.push(rom[pos + i]);
      pos += length;
      continue;
    }
    throw new Error(`unhandled $${byte.toString(16)} at $${pos.toString(16)}`);
  }
}
