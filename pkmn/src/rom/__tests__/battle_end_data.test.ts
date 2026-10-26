// A5c3d checkpoint-03: data only. Independent source macro encoding -> ROM bytes -> extracted commands.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractSfx, SFX_HEADERS, type AudioCommand } from '../extractors/audio';
import { extractTextPrograms, type TextProgramsFile } from '../extractors/text_programs';
import { TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';

const ROM_PATH = process.env.ROM_PATH;
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const sounds = [
  { name: 'level_up', label: 'SFX_Level_Up', header: 0x4192, id: 0x86, channels: [[5, 0x71e8], [6, 0x7203], [7, 0x721b]] },
  { name: 'faint_fall', label: 'SFX_Faint_Fall', header: 0x41da, id: 0x9e, channels: [[5, 0x445e]] },
  { name: 'faint_thud', label: 'SFX_Faint_Thud', header: 0x41bf, id: 0x95, channels: [[5, 0x43ea], [8, 0x43f1]] },
];
const offset = (bank: number, address: number) => bank ? bank * 0x4000 + (address & 0x3fff) : address;
let rom: Buffer, reader: BinaryReader, symbols: string, text: TextProgramsFile;
beforeAll(() => {
  if (!ROM_PATH) return;
  rom = readFileSync(ROM_PATH); reader = new BinaryReader(Uint8Array.from(rom).buffer);
  symbols = execFileSync('git', ['-C', REFS, 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8' });
  text = extractTextPrograms(reader);
});
function symbol(label: string): [number, number] {
  const match = symbols.split('\n').map(line => /^(\w+):(\w+) (\S+)\s*$/.exec(line))
    .find(match => match?.[3] === label);
  if (!match) throw new Error(`missing pinned symbol ${label}`);
  return [parseInt(match[1], 16), parseInt(match[2], 16)];
}
function body(file: string, label: string): string[] {
  const lines = readFileSync(resolve(REFS, file), 'utf8').split('\n')
    .map(line => line.replace(/;.*/, '').trim()).filter(Boolean);
  const start = lines.findIndex(line => line === `${label}:` || line === `${label}::`);
  if (start < 0) throw new Error(`missing source ${label}`);
  const next = lines.findIndex((line, i) => i > start && /^\w+::?$/.test(line));
  return lines.slice(start + 1, next < 0 ? undefined : next);
}

// The subset used by the six channel bodies, encoded from macros/scripts/audio.asm.
// Unknown macros fail: no production decoder, JSON or engine supplies these expected bytes/operands.
function sourceChannel(lines: string[]): { bytes: number[]; commands: AudioCommand[] } {
  const bytes: number[] = [], commands: AudioCommand[] = [];
  const pitches: Record<string, number> = { C_: 0, 'D#': 3, E_: 4, F_: 5, G_: 7, A_: 9, 'A#': 10 };
  const magnitude = (n: number) => n < 0 ? 8 | -n : n;
  for (const line of lines) {
    const [macro, ...tail] = line.split(/\s+/), args = tail.join('').split(',');
    const [a, b, c, d] = args.map(Number);
    switch (macro) {
      case 'execute_music': bytes.push(0xf8); commands.push({ cmd: macro }); break;
      case 'tempo': bytes.push(0xed, a >> 8, a & 255); commands.push({ cmd: macro, value: a }); break;
      case 'volume': bytes.push(0xf0, a << 4 | b); commands.push({ cmd: macro, left: a, right: b }); break;
      case 'duty_cycle': bytes.push(0xec, a); commands.push({ cmd: macro, value: a }); break;
      case 'toggle_perfect_pitch': bytes.push(0xe8); commands.push({ cmd: macro }); break;
      case 'note_type': bytes.push(0xd0 | a, b << 4 | magnitude(c)); commands.push({ cmd: macro, speed: a, volume: b, fade: c }); break;
      case 'octave': bytes.push(0xe0 | (8 - a)); commands.push({ cmd: macro, value: a }); break;
      case 'note': {
        const pitch = pitches[args[0]];
        if (pitch === undefined) throw new Error(`unsupported source pitch ${args[0]}`);
        bytes.push(pitch << 4 | (b - 1)); commands.push({ cmd: macro, pitch, length: b }); break;
      }
      case 'rest': bytes.push(0xc0 | (a - 1)); commands.push({ cmd: macro, length: a }); break;
      case 'vibrato': bytes.push(0xea, a, b << 4 | c); commands.push({ cmd: macro, delay: a, depth: b, rate: c }); break;
      case 'pitch_sweep': bytes.push(0x10, a << 4 | magnitude(b)); commands.push({ cmd: macro, length: a, shift: b }); break;
      case 'square_note': bytes.push(0x20 | a, b << 4 | magnitude(c), d & 255, d >> 8);
        commands.push({ cmd: macro, length: a, volume: b, fade: magnitude(c), frequency: d }); break;
      case 'noise_note': bytes.push(0x20 | a, b << 4 | magnitude(c), d);
        commands.push({ cmd: macro, length: a, volume: b, fade: magnitude(c), param: d }); break;
      case 'sound_ret': bytes.push(0xff); commands.push({ cmd: macro }); break;
      default: throw new Error(`unsupported source macro ${line}`);
    }
  }
  expect(lines[lines.length - 1]).toBe('sound_ret');
  return { bytes, commands };
}

describe.skipIf(!ROM_PATH)('checkpoint-03 battle SFX data', () => {
  it.each(sounds)('$name pins Audio 2 header, ID, count and every channel pointer to symbols and source', sound => {
    expect(SFX_HEADERS[sound.name]).toEqual({ bank: 8, addr: sound.header });
    expect(symbol(sound.label)).toEqual([8, sound.header]);
    expect((sound.header - 0x4000) / 3).toBe(sound.id);
    expect(body('audio/headers/sfxheaders2.asm', sound.label)).toEqual([
      `channel_count ${sound.channels.length}`, ...sound.channels.map(([id]) => `channel ${id}, ${sound.label}_Ch${id}`),
    ]);
    const header = sound.channels.flatMap(([id, address], i) => {
      expect(symbol(`${sound.label}_Ch${id}`)).toEqual([8, address]);
      return [(i === 0 ? (sound.channels.length - 1) << 6 : 0) | (id - 1), address & 255, address >> 8];
    });
    const at = offset(8, sound.header);
    expect([...rom.subarray(at, at + header.length)]).toEqual(header);
    expect(extractSfx(reader, sound.name)!.channels.map(channel => channel.id)).toEqual(sound.channels.map(([id]) => id));
  });

  it.each(sounds)('$name matches every source command, encoded ROM byte, JSON and static mirror', sound => {
    const expected = { channels: sound.channels.map(([id, address]) => {
      const source = sourceChannel(body(`audio/sfx/${sound.name}.asm`, `${sound.label}_Ch${id}`));
      const at = offset(8, address);
      expect([...rom.subarray(at, at + source.bytes.length)]).toEqual(source.bytes);
      return { id, commands: source.commands };
    }) };
    expect(extractSfx(reader, sound.name)).toEqual(expected);
    const path = `audio/sfx/${sound.name}.json`, data = readFileSync(resolve(DATA, path), 'utf8');
    expect(data).toBe(JSON.stringify(expected, null, 2) + '\n');
    expect(readFileSync(resolve(STATIC, path), 'utf8')).toBe(data);
  });
});

describe.skipIf(!ROM_PATH)('checkpoint-03 end-battle text data', () => {
  it('TrainerEndBattleText pins home-bank FAR bytes and stops at the existing ASM hand-off', () => {
    expect(symbol('TrainerEndBattleText')).toEqual([0, 0x336b]);
    expect(TEXT_PROGRAM_SYMBOLS.find(([name]) => name === 'TrainerEndBattleText')).toEqual(['TrainerEndBattleText', 0, 0x336b, true]);
    expect(body('home/trainers.asm', 'TrainerEndBattleText')).toEqual([
      'text_far _TrainerNameText', 'text_asm', 'call GetSavedEndBattleTextPointer', 'call TextCommandProcessor', 'jp TextScriptEnd',
    ]);
    expect([...rom.subarray(0x336b, 0x3370)]).toEqual([0x17, 0x45, 0x40, 0x26, 0x08]);
    expect(text.programs.TrainerEndBattleText).toEqual([{ op: 'far', program: '_TrainerNameText' }, { op: 'asm' }]);
  });

  it('_TrainerNameText pins the nameBuffer operand, punctuation and both terminators', () => {
    expect(symbol('_TrainerNameText')).toEqual([0x26, 0x4045]);
    expect(symbol('wNameBuffer')).toEqual([0, 0xcd6d]);
    expect(TEXT_PROGRAM_SYMBOLS.find(([name]) => name === '_TrainerNameText')).toEqual(['_TrainerNameText', 0x26, 0x4045, false]);
    expect(body('data/text/text_1.asm', '_TrainerNameText')).toEqual(['text_ram wNameBuffer', 'text ": @"', 'text_end']);
    const at = offset(0x26, 0x4045);
    expect([...rom.subarray(at, at + 8)]).toEqual([0x01, 0x6d, 0xcd, 0x00, 0x9c, 0x7f, 0x50, 0x50]);
    expect(text.programs._TrainerNameText).toEqual([{ op: 'ram', binding: 'nameBuffer' }, { op: 'text', text: ': ' }]);
  });

  it('commits both programs through setup and the static mirror without changing existing programs or map calls', () => {
    const data = readFileSync(resolve(DATA, 'text_programs.json'), 'utf8');
    expect(JSON.parse(data)).toEqual(text);
    expect(readFileSync(resolve(STATIC, 'text_programs.json'), 'utf8')).toBe(data);
    const previous = JSON.parse(execFileSync('git', ['show', 'cd2c5a2:game/data/text_programs.json'], { encoding: 'utf8' })) as TextProgramsFile;
    expect(text.textPointers).toEqual(previous.textPointers);
    const existing = { ...text.programs }; delete existing.TrainerEndBattleText; delete existing._TrainerNameText;
    // A5c3e checkpoint-02's four keys, proven against a20cfa8 in battle_item_data.test.ts.
    for (const label of ['DoYouWantToNicknameText', '_DoYouWantToNicknameText', 'DontHavePokemonText', '_DontHavePokemonText']) delete existing[label];
    expect(existing).toEqual(previous.programs);
  });
});
