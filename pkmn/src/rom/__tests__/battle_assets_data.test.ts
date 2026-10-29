// A5c3f checkpoint-02: bank-$08 hit/trainer sounds, GhostPic, and the 47 trainer pics.
// Source macros and pointer rows are encoded here. The extractor's JSON is the thing compared.
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BinaryReader } from '../binary_reader';
import { extractSfx, SFX_HEADERS, type AudioCommand } from '../extractors/audio';
import { extractGhostPic } from '../extractors/graphics';
import { extractTrainers, JESSIE_JAMES_PIC } from '../extractors/trainers';
import { readMoveNames, readPokemonInternalNames, readTrainerClassNames } from '../extractors/text';
import { GHOST_PIC } from '../rom_offsets';
import { installNodeImageData } from '../node_image_data';
import { encodePng } from '../static_export';

const ROM_PATH = process.env.ROM_PATH;
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const offset = (bank: number, address: number) => bank ? bank * 0x4000 + (address & 0x3fff) : address;
const sounds = [
  { name: 'damage', label: 'SFX_Damage', header: 0x41f2, id: 0xa6, channel: 8, at: 0x44a4 },
  { name: 'not_very_effective', label: 'SFX_Not_Very_Effective', header: 0x41f5, id: 0xa7, channel: 8, at: 0x44ae },
  { name: 'super_effective', label: 'SFX_Super_Effective', header: 0x4210, id: 0xb0, channel: 8, at: 0x4524 },
  { name: 'trainer_appeared', label: 'SFX_Trainer_Appeared', header: 0x42bb, id: 0xe9, channel: 5, at: 0x43b0 },
];
// home/trainers2.asm IsFightingJessieJames, assembled from the symbols below.
// Both pic loads are JessieJamesPic. .dummy is the shared store.
const JESSIE_JAMES_ROUTINE = [
  0xfa, 0x30, 0xd0, 0xfe, 0x1e, 0xc0, 0xfa, 0x5c, 0xd0, 0xfe, 0x2a, 0xd8,
  0x11, 0x81, 0x7c, 0xfe, 0x2e, 0x38, 0x03, 0x11, 0x81, 0x7c,
  0x21, 0x32, 0xd0, 0x7b, 0x22, 0x72, 0xc9,
];

let rom: Buffer, reader: BinaryReader, symbols: Map<string, [number, number]>;

function source(file: string): string[] {
  return readFileSync(resolve(REFS, file), 'utf8').split('\n')
    .map(line => line.replace(/;.*/, '').trim()).filter(Boolean);
}
function body(file: string, label: string): string[] {
  const lines = source(file);
  const start = lines.findIndex(line => line === `${label}:` || line === `${label}::`);
  if (start < 0) throw new Error(`missing source ${label}`);
  const next = lines.findIndex((line, i) => i > start && /^\w+::?$/.test(line));
  return lines.slice(start + 1, next < 0 ? undefined : next);
}
function sourceChannel(lines: string[]): { bytes: number[]; commands: AudioCommand[] } {
  const bytes: number[] = [], commands: AudioCommand[] = [];
  const magnitude = (n: number) => n < 0 ? 8 | -n : n;
  for (const line of lines) {
    const [macro, ...tail] = line.split(/\s+/), args = tail.join('').split(',');
    const [a, b, c, d] = args.map(Number);
    switch (macro) {
      case 'duty_cycle':
        bytes.push(0xec, a); commands.push({ cmd: macro, value: a }); break;
      case 'square_note':
        bytes.push(0x20 | a, b << 4 | magnitude(c), d & 255, d >> 8);
        commands.push({ cmd: macro, length: a, volume: b, fade: magnitude(c), frequency: d }); break;
      case 'noise_note':
        bytes.push(0x20 | a, b << 4 | magnitude(c), d);
        commands.push({ cmd: macro, length: a, volume: b, fade: magnitude(c), param: d }); break;
      case 'sound_ret':
        bytes.push(0xff); commands.push({ cmd: macro }); break;
      default: throw new Error(`unsupported source macro ${line}`);
    }
  }
  expect(lines[lines.length - 1]).toBe('sound_ret');
  return { bytes, commands };
}
function trainerPicFiles(): Map<string, string> {
  const files = new Map<string, string>();
  const pending: string[] = [];
  for (const line of source('gfx/pics.asm')) {
    const label = /^(\w+)::/.exec(line);
    const trainer = /INCBIN "gfx\/trainers\/([^"]+)\.pic"/.exec(line);
    if (label && trainer) {
      for (const name of pending) files.set(name, `${trainer[1]}.png`);
      pending.length = 0;
      files.set(label[1], `${trainer[1]}.png`);
      continue;
    }
    if (label) { pending.push(label[1]); continue; }
    if (line.startsWith('INCBIN') || line.startsWith('SECTION')) pending.length = 0;
  }
  return files;
}

describe.skipIf(!ROM_PATH)('A5c3f checkpoint-02 data', () => {
  beforeAll(() => {
    installNodeImageData();
    rom = readFileSync(ROM_PATH!);
    reader = new BinaryReader(Uint8Array.from(rom).buffer);
    const sym = execFileSync('git', ['-C', REFS, 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8', windowsHide: true });
    symbols = new Map([...sym.matchAll(/^([\da-f]+):([\da-f]+) (\S+)$/gmi)]
      .map(match => [match[3], [parseInt(match[1], 16), parseInt(match[2], 16)]]));
  });

  it.each(sounds)('$name pins bank $08, header, id and its one channel', sound => {
    expect(SFX_HEADERS[sound.name]).toEqual({ bank: 8, addr: sound.header });
    expect(symbols.get(sound.label)).toEqual([8, sound.header]);
    expect(symbols.get(`${sound.label}_Ch${sound.channel}`)).toEqual([8, sound.at]);
    expect((sound.header - 0x4000) / 3).toBe(sound.id);
    expect(body('audio/headers/sfxheaders2.asm', sound.label)).toEqual([
      'channel_count 1', `channel ${sound.channel}, ${sound.label}_Ch${sound.channel}`,
    ]);
    const at = offset(8, sound.header);
    expect([...rom.subarray(at, at + 3)]).toEqual([sound.channel - 1, sound.at & 255, sound.at >> 8]);
    expect(extractSfx(reader, sound.name)!.channels.map(channel => channel.id)).toEqual([sound.channel]);
  });

  it.each(sounds)('$name matches every source command, ROM byte, JSON and static mirror', sound => {
    const encoded = sourceChannel(body(`audio/sfx/${sound.name}.asm`, `${sound.label}_Ch${sound.channel}`));
    const at = offset(8, sound.at);
    expect([...rom.subarray(at, at + encoded.bytes.length)]).toEqual(encoded.bytes);
    const expected = { channels: [{ id: sound.channel, commands: encoded.commands }] };
    expect(extractSfx(reader, sound.name)).toEqual(expected);
    const path = `audio/sfx/${sound.name}.json`;
    const data = readFileSync(resolve(DATA, path), 'utf8');
    expect(data).toBe(JSON.stringify(expected, null, 2) + '\n');
    expect(readFileSync(resolve(STATIC, path), 'utf8')).toBe(data);
  });

  it('GhostPic is $66, 48×48, and the committed PNG is those decoded bytes', () => {
    expect(symbols.get('GhostPic')).toEqual([0x0d, 0x6920]);
    expect(GHOST_PIC).toBe(offset(0x0d, 0x6920));
    expect(rom[GHOST_PIC]).toBe(0x66);
    const image = extractGhostPic(reader);
    expect(image.width).toBe(48);
    expect(image.height).toBe(48);
    const png = readFileSync(resolve(STATIC, 'gfx/battle/ghost.png'));
    expect(png.equals(encodePng(image))).toBe(true);
    const decoded = PNG.sync.read(png);
    expect(decoded.width).toBe(48);
    expect(decoded.height).toBe(48);
    expect(Buffer.from(decoded.data).equals(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength))).toBe(true);
    expect(existsSync(resolve(STATIC, 'gfx/trainers/chief.png'))).toBe(false);
  });

  it('pins all 47 class pics against TrainerPicAndMoneyPointers, with CHIEF on scientist.png', () => {
    const rows = source('data/trainers/pic_pointers_money.asm').flatMap(line => {
      const match = /^pic_money\s+(\w+),\s+(\d+)$/.exec(line);
      return match ? [{ label: match[1], money: Number(match[2]) }] : [];
    });
    const files = trainerPicFiles();
    const names = readTrainerClassNames(reader);
    const extracted = extractTrainers(reader, readPokemonInternalNames(reader), readMoveNames(reader), names);
    expect(rows).toHaveLength(47);
    expect(symbols.get('TrainerPicAndMoneyPointers')).toEqual([0x0e, 0x5893]);
    expect(symbols.get('ChiefPic')).toEqual(symbols.get('ScientistPic'));
    expect(symbols.get('ChiefPic')).toEqual([0x13, 0x6258]);
    rows.forEach((row, index) => {
      const symbol = symbols.get(row.label);
      expect(symbol?.[0], row.label).toBe(0x13);
      const pointer = reader.readWord(offset(0x0e, 0x5893) + index * 5);
      expect(pointer, row.label).toBe(symbol![1]);
      const bcd = [...rom.subarray(offset(0x0e, 0x5893) + index * 5 + 2, offset(0x0e, 0x5893) + index * 5 + 5)];
      const decimal = bcd.reduce((total, byte) => total * 100 + ((byte >> 4) * 10 + (byte & 0xf)), 0);
      expect(decimal, row.label).toBe(row.money);
      const cls = extracted[names[index + 1]];
      expect(cls.pic, names[index + 1]).toBe(files.get(row.label));
      expect(cls.baseMoney, names[index + 1]).toBe(Math.floor(row.money / 100));
      expect(existsSync(resolve(STATIC, `gfx/trainers/${cls.pic}`)), cls.pic).toBe(true);
    });
    expect(extracted.CHIEF.pic).toBe('scientist.png');
    expect(extracted.SCIENTIST.pic).toBe('scientist.png');
    expect(extracted.CHIEF.baseMoney).toBe(30);
    expect(extracted.SCIENTIST.baseMoney).toBe(50);
    expect(extracted.CHIEF.baseMoney).not.toBe(extracted.SCIENTIST.baseMoney);
    expect(files.get('JessieJamesPic')).toBe('jessiejames.png');
    expect(symbols.get('JessieJamesPic')).toEqual([0x13, 0x7c81]);
    expect(rows.map(row => symbols.get(row.label)![1])).not.toContain(0x7c81);
    expect(extracted.ROCKET.picOverride).toEqual(JESSIE_JAMES_PIC);
    expect(Object.values(extracted).filter(cls => cls.picOverride).length).toBe(1);
    expect(symbols.get('IsFightingJessieJames')).toEqual([0, 0x359e]);
    expect(symbols.get('IsFightingJessieJames.dummy')).toEqual([0, 0x35b4]);
    expect([...rom.subarray(0x359e, 0x359e + JESSIE_JAMES_ROUTINE.length)]).toEqual(JESSIE_JAMES_ROUTINE);
    const saved = readFileSync(resolve(DATA, 'trainers.json'), 'utf8');
    expect(saved).toBe(JSON.stringify(extracted, null, 2) + '\n');
    expect(readFileSync(resolve(STATIC, 'trainers.json'), 'utf8')).toBe(saved);
  });
});
