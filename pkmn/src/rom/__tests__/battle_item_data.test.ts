// A5c3e checkpoint-02: source macros -> ROM bytes -> unchanged extractor schema -> committed mirrors.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractMusic, extractSfx, extractSfxChannelsAt, SFX_HEADERS, type AudioCommand } from '../extractors/audio';
import { extractTextPrograms, type TextProgramsFile } from '../extractors/text_programs';
import { TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';

const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const ROM_PATH = process.env.ROM_PATH;
const offset = (bank: number, addr: number) => bank ? bank * 0x4000 + (addr & 0x3fff) : addr;
const sounds = [
  { name: 'caught_mon', label: 'SFX_Caught_Mon', header: 0x41ce, id: 0x9a,
    streams: [[5, 0x727e, 27], [6, 0x7299, 22], [7, 0x72af, 15]] },
  { name: 'dex_page_added', label: 'SFX_Dex_Page_Added', header: 0x41c8, id: 0x98,
    streams: [[5, 0x441d, 17], [6, 0x442e, 11]] },
];
const flutePointers = [{ id: 5, addr: 0x59eb }, { id: 6, addr: 0x59ee }, { id: 7, addr: 0x444b }];
let rom: Buffer, reader: BinaryReader, symbols: Map<string, [number, number]>, text: TextProgramsFile;

function source(file: string): string[] {
  return readFileSync(resolve(REFS, file), 'utf8').split('\n')
    .map(line => line.replace(/;.*/, '').trim()).filter(Boolean);
}
function body(file: string, label: string): string[] {
  const lines = source(file);
  const start = lines.findIndex(line => line === `${label}:` || line === `${label}::`);
  if (start < 0) throw new Error(`missing source ${label}`);
  const end = lines.findIndex((line, i) => i > start && /^\w+::?$/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

// Independent macro encoder for these eight streams, not a decoder-derived expected value.
function encode(lines: string[]): { bytes: number[]; commands: AudioCommand[] } {
  const bytes: number[] = [], commands: AudioCommand[] = [];
  const pitches: Record<string, number> = { C_: 0, 'C#': 1, 'D#': 3, E_: 4, F_: 5, 'F#': 6, G_: 7, 'G#': 8, A_: 9, B_: 11 };
  for (const line of lines) {
    const [cmd, ...tail] = line.split(/\s+/), args = tail.join('').split(',');
    const [a, b, c, d] = args.map(Number);
    switch (cmd) {
      case 'execute_music': bytes.push(0xf8); commands.push({ cmd }); break;
      case 'tempo': bytes.push(0xed, a >> 8, a & 255); commands.push({ cmd, value: a }); break;
      case 'volume': bytes.push(0xf0, a << 4 | b); commands.push({ cmd, left: a, right: b }); break;
      case 'duty_cycle': bytes.push(0xec, a); commands.push({ cmd, value: a }); break;
      case 'toggle_perfect_pitch': bytes.push(0xe8); commands.push({ cmd }); break;
      case 'note_type': bytes.push(0xd0 | a, b << 4 | c); commands.push({ cmd, speed: a, volume: b, fade: c }); break;
      case 'octave': bytes.push(0xe0 | (8 - a)); commands.push({ cmd, value: a }); break;
      case 'note': {
        const pitch = pitches[args[0]];
        if (pitch === undefined) throw new Error(`unsupported pitch: ${args[0]}`);
        bytes.push(pitch << 4 | (b - 1)); commands.push({ cmd, pitch, length: b }); break;
      }
      case 'rest': bytes.push(0xc0 | (a - 1)); commands.push({ cmd, length: a }); break;
      case 'vibrato': bytes.push(0xea, a, b << 4 | c); commands.push({ cmd, delay: a, depth: b, rate: c }); break;
      case 'pitch_sweep': bytes.push(0x10, a << 4 | b); commands.push({ cmd, length: a, shift: b }); break;
      case 'square_note': bytes.push(0x20 | a, b << 4 | c, d & 255, d >> 8);
        commands.push({ cmd, length: a, volume: b, fade: c, frequency: d }); break;
      case 'sound_ret': bytes.push(0xff); commands.push({ cmd }); break;
      default: throw new Error(`unexpected source macro ${line}`);
    }
  }
  return { bytes, commands };
}
function mirror(path: string, expected: unknown): void {
  const data = readFileSync(resolve(DATA, path), 'utf8');
  expect(data).toBe(JSON.stringify(expected, null, 2) + '\n');
  expect(readFileSync(resolve(STATIC, path), 'utf8')).toBe(data);
}
function pinStream(label: string, addr: number, length: number, lines: string[]): AudioCommand[] {
  expect(symbols.get(label)).toEqual([8, addr]);
  const expected = encode(lines);
  expect(expected.bytes).toHaveLength(length);
  expect(expected.commands[expected.commands.length - 1]).toEqual({ cmd: 'sound_ret' });
  expect([...rom.subarray(offset(8, addr), offset(8, addr) + length)]).toEqual(expected.bytes);
  return expected.commands;
}

describe.skipIf(!ROM_PATH)('A5c3e checkpoint-02 source data', () => {
  beforeAll(() => {
    rom = readFileSync(ROM_PATH!); reader = new BinaryReader(Uint8Array.from(rom).buffer);
    const sym = execFileSync('git', ['-C', REFS, 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8', windowsHide: true });
    symbols = new Map([...sym.matchAll(/^([\da-f]+):([\da-f]+) (\S+)$/gmi)]
      .map(m => [m[3], [parseInt(m[1], 16), parseInt(m[2], 16)]]));
    text = extractTextPrograms(reader);
  });

  it.each(sounds)('$name pins Audio 2 header, ID and every channel pointer', sound => {
    expect(SFX_HEADERS[sound.name]).toEqual({ bank: 8, addr: sound.header });
    expect(symbols.get(sound.label)).toEqual([8, sound.header]);
    expect((sound.header - 0x4000) / 3).toBe(sound.id);
    expect(body('audio/headers/sfxheaders2.asm', sound.label)).toEqual([
      `channel_count ${sound.streams.length}`,
      ...sound.streams.map(([id]) => `channel ${id}, ${sound.label}_Ch${id}`),
    ]);
    const header = sound.streams.flatMap(([id, addr], i) => [
      (i === 0 ? (sound.streams.length - 1) << 6 : 0) | (id - 1), addr & 255, addr >> 8,
    ]);
    expect([...rom.subarray(offset(8, sound.header), offset(8, sound.header) + header.length)]).toEqual(header);
  });

  for (const sound of sounds) for (const [id, addr, length] of sound.streams) {
    it(`${sound.name} CH${id} pins first/last commands, length and every source byte`, () => {
      const expected = pinStream(`${sound.label}_Ch${id}`, addr, length,
        body(`audio/sfx/${sound.name}.asm`, `${sound.label}_Ch${id}`));
      const actual = extractSfx(reader, sound.name)!.channels.find(channel => channel.id === id)!.commands;
      expect(actual[0]).toEqual(expected[0]);
      expect(actual[actual.length - 1]).toEqual(expected[expected.length - 1]);
      expect(actual).toEqual(expected);
      mirror(`audio/sfx/${sound.name}.json`, extractSfx(reader, sound.name));
    });
  }

  it('flute streams preserve CH5 tempo and CH6 fallthrough, CH7 notes, and the existing schema', () => {
    const ch6 = body('audio/sfx/pokeflute_ch5_ch6.asm', 'SFX_Pokeflute_Ch6');
    const lines = [
      [...body('audio/sfx/pokeflute_ch5_ch6.asm', 'SFX_Pokeflute_Ch5'), ...ch6], ch6,
      body('audio/sfx/pokeflute_ch7.asm', 'SFX_Pokeflute_Ch7'),
    ];
    const lengths = [13, 10, 15];
    const expected = { channels: flutePointers.map(({ id, addr }, i) => ({
      id, commands: pinStream(`SFX_Pokeflute_Ch${id}`, addr, lengths[i], lines[i]),
    })) };
    expect(expected.channels[0].commands[0]).toEqual({ cmd: 'tempo', value: 256 });
    expect(expected.channels[0].commands.slice(1)).toEqual(expected.channels[1].commands);
    expect(expected.channels[1].commands[0]).toEqual({ cmd: 'execute_music' });
    expect(expected.channels[2].commands.filter(cmd => cmd.cmd === 'note')).toEqual([
      { cmd: 'note', pitch: 4, length: 3 }, { cmd: 'note', pitch: 5, length: 3 },
      { cmd: 'note', pitch: 7, length: 7 }, { cmd: 'note', pitch: 9, length: 3 },
      { cmd: 'note', pitch: 7, length: 3 }, { cmd: 'note', pitch: 0, length: 13 },
    ]);
    const actual = extractSfxChannelsAt(reader, 8, flutePointers);
    expect(actual).toEqual(expected);
    expect(Object.keys(actual)).toEqual(['channels']);
    for (const channel of actual.channels) expect(Object.keys(channel)).toEqual(['id', 'commands']);
    expect(SFX_HEADERS).not.toHaveProperty('pokeflute_in_battle');
    mirror('audio/sfx/pokeflute_in_battle.json', expected);
  });

  it('pins all 28 bootstrap routine bytes, its request, channel order and fallthrough', () => {
    expect(symbols.get('Music_PokeFluteInBattle')).toEqual([8, 0x59cf]);
    expect(symbols.get('Audio2_OverwriteChannelPointer')).toEqual([8, 0x59e6]);
    expect(symbols.get('PlaySoundWaitForCurrent')).toEqual([0, 0x3736]);
    expect(symbols.get('wChannelCommandPointers')).toEqual([0, 0xc006]);
    const bytes = [...rom.subarray(offset(8, 0x59cf), offset(8, 0x59cf) + 28)];
    expect(bytes).toEqual([
      0x3e, 0x9a, 0xcd, 0x36, 0x37, 0x21, 0x0e, 0xc0,
      0x11, 0xeb, 0x59, 0xcd, 0xe6, 0x59, 0x11, 0xee, 0x59,
      0xcd, 0xe6, 0x59, 0x11, 0x4b, 0x44, 0x7b, 0x22, 0x7a, 0x22, 0xc9,
    ]);
    const word = (at: number) => bytes[at] | bytes[at + 1] << 8;
    expect(bytes[1]).toBe(0x9a); expect(word(6)).toBe(0xc00e);
    expect([word(9), word(15), word(21)]).toEqual([0x59eb, 0x59ee, 0x444b]);
    expect(0x59cf + 23).toBe(0x59e6); // CH7 ld de falls directly into the five-byte writer.
    // No audio update between request and pointer replacement; a hardware VBlank landing in
    // that few-instruction window is outside this port's frame model. Execution waits for04b.
  });

  it.each([
    ['DoYouWantToNicknameText', 1, 0x62c8, [0x17, 0x9a, 0x49, 0x28, 0x50], [{ op: 'far', program: '_DoYouWantToNicknameText' }]],
    ['DontHavePokemonText', 3, 0x6527, [0x17, 0x56, 0x6e, 0x2d, 0x50], [{ op: 'far', program: '_DontHavePokemonText' }]],
    ['ItemUseBall.emptyString', 3, 0x5696, [0x50], []],
  ] as const)('%s pins its symbol, root bytes and extracted ops', (label, bank, addr, bytes, ops) => {
    expect(symbols.get(label)).toEqual([bank, addr]);
    expect(TEXT_PROGRAM_SYMBOLS.find(([key]) => key === label)).toEqual([label, bank, addr, true]);
    expect([...rom.subarray(offset(bank, addr), offset(bank, addr) + bytes.length)]).toEqual(bytes);
    expect(text.programs[label]).toEqual(ops);
  });

  it('pins nickname and empty-party FAR children, text controls and RAM binding', () => {
    expect(TEXT_PROGRAM_SYMBOLS.find(([key]) => key === '_DoYouWantToNicknameText'))
      .toEqual(['_DoYouWantToNicknameText', 0x28, 0x499a, false]);
    expect(TEXT_PROGRAM_SYMBOLS.find(([key]) => key === '_DontHavePokemonText'))
      .toEqual(['_DontHavePokemonText', 0x2d, 0x6e56, false]);
    expect(symbols.get('_DoYouWantToNicknameText')).toEqual([0x28, 0x499a]);
    expect(symbols.get('_DontHavePokemonText')).toEqual([0x2d, 0x6e56]);
    expect(text.programs._DoYouWantToNicknameText).toEqual([
      { op: 'text', text: 'Do you want to\ngive a nickname\nto ' },
      { op: 'ram', binding: 'nameBuffer' }, { op: 'text', text: '?<DONE>' },
    ]);
    expect(text.programs._DontHavePokemonText).toEqual([{ op: 'text', text: "You don't have a \nPOKéMON!<PROMPT>" }]);
  });

  it('adds only four missing text keys, retaining the existing empty root and all prior ops/map pointers', () => {
    const previous = JSON.parse(execFileSync('git', ['show', 'a20cfa8:game/data/text_programs.json'],
      { encoding: 'utf8', windowsHide: true })) as TextProgramsFile;
    const added = ['DoYouWantToNicknameText', '_DoYouWantToNicknameText', 'DontHavePokemonText',
      '_DontHavePokemonText'];
    expect(Object.keys(text.programs).filter(key => !(key in previous.programs)).sort()).toEqual(added.sort());
    for (const [key, ops] of Object.entries(previous.programs)) expect(text.programs[key], key).toEqual(ops);
    expect(text.textPointers).toEqual(previous.textPointers);
    mirror('text_programs.json', text);
  });

  it('removes the invalid flute music identity and both stale generated copies', () => {
    expect(extractMusic(reader, 'pokefluteinbattle')).toBeNull();
    for (const base of [DATA, STATIC]) expect(existsSync(resolve(base, 'audio/music/pokefluteinbattle.json'))).toBe(false);
  });
});
