// Opening checkpoint-10: independent ASM, PNG and ROM witnesses for the movie's data.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { BinaryReader } from '../binary_reader';
import { installNodeImageData } from '../node_image_data';
import { extractRom } from '../index';
import { extractYellowIntro, type YellowIntroData } from '../extractors/yellow_intro';
import * as offsets from '../rom_offsets';

const GAME = resolve(__dirname, '../../..');
const REFS = resolve(GAME, '../refs/pokeyellow');
const read = (name: string): string => readFileSync(resolve(REFS, name), 'utf8');
const data: YellowIntroData = JSON.parse(readFileSync(resolve(GAME, 'data/yellow_intro.json'), 'utf8'));
const intro = read('engine/movie/intro_yellow.asm');
const constants = read('constants/sprite_anim_constants.asm');
const names = new Map<string, number>([['OAM_XFLIP', 0x20], ['OAM_PAL1', 0x10]]);
for (const prefix of ['INTRO_FRAMESET_', 'INTRO_OAMSET_']) {
  const entries = [...constants.matchAll(new RegExp(`^\\s*const (${prefix}\\w+)`, 'gm'))];
  entries.forEach((match, i) => names.set(match[1], i));
}
function value(source: string): number {
  return source.trim().split('|').reduce((a, part) => {
    const token = part.trim();
    const n = names.get(token) ?? (token.startsWith('$') ? parseInt(token.slice(1), 16) : Number(token));
    if (!Number.isFinite(n)) throw new Error(`Unknown ASM token: ${token}`);
    return a | n;
  }, 0) & 0xff;
}
function db(source: string): number[] {
  return [...source.matchAll(/^\s*db\s+([^;\n]+)/gm)].flatMap(m => m[1].split(',').map(value));
}
function block(source: string, label: string): string {
  const start = source.indexOf(`${label}:`);
  if (start < 0) throw new Error(`Missing ASM label: ${label}`);
  return source.slice(start + label.length + 1).split(/\n[.\w][\w.]*:/)[0];
}

describe('Yellow intro committed data: ASM witnesses', () => {
  it('has identical data/static bytes and the exact public schema', () => {
    expect(readFileSync(resolve(GAME, 'static/yellow_intro.json'), 'utf8'))
      .toBe(readFileSync(resolve(GAME, 'data/yellow_intro.json'), 'utf8'));
    expect(Object.keys(data)).toEqual(['spawnStates', 'framesets', 'oamSets', 'speedBars', 'seaWave',
      'sineWave', 'thunderboltPalettes', 'fadePalettes']);
  });
  it('preserves all eleven spawn triples, including the unused third byte', () => {
    expect(data.spawnStates).toHaveLength(11);
    expect(data.spawnStates.flat()).toEqual(db(block(intro, 'YellowIntro_AnimatedObjectSpawnStateData')));
  });
  const frames = read('data/sprite_anims/intro_frames.asm');
  const frameLabels = [...frames.matchAll(/^\s*dw \.(\w+)/gm)].map(m => m[1]);
  for (const [i, label] of frameLabels.entries()) {
    it(`frameset ${i}: every pair and its single-byte terminal from ${label}`, () => {
      const source = block(frames, `.${label}`);
      const expected = [...source.matchAll(/^\s*frame\s+([^,]+),\s*(\d+)/gm)]
        .flatMap(m => [value(m[1]), Number(m[2])]);
      expected.push(source.includes('dorestart') ? 0xfe : 0xff);
      expect(data.framesets).toHaveLength(11);
      expect(data.framesets[i]).toEqual(expected);
    });
  }
  const oam = read('data/sprite_anims/intro_oam.asm');
  const oamRows = [...oam.matchAll(/^\s*dbw\s+(\$[0-9a-f]+),\s*\.(\w+)/gm)];
  for (const [i, match] of oamRows.entries()) {
    it(`OAM set ${i}: tile base, count and every raw coordinate/tile/attribute byte`, () => {
      const expected = db(block(oam, `.${match[2]}`));
      expect(data.oamSets).toHaveLength(20);
      expect(data.oamSets[i].tileOffset).toBe(value(match[1]));
      expect(data.oamSets[i].entries).toHaveLength(expected[0]);
      expect(data.oamSets[i].entries.flat()).toEqual(expected.slice(1));
    });
  }
  for (const [key, label] of [
    ['speedBars', 'YellowIntroFlyingSpeedBarData'],
    ['thunderboltPalettes', 'YellowIntroThunderboltPalSequence'],
    ['fadePalettes', 'YellowIntroFadeToWhitePalSequence'],
  ] as const) {
    it(`${key}: exact literal bytes, including terminators`, () => {
      expect(data[key].flat()).toEqual(db(block(intro, label)));
    });
  }
  it('retains the signed sea wave as raw bytes and the 8.8 sine half-wave as words', () => {
    const section = intro.slice(intro.indexOf('YellowIntro_Copy8BitSineWave:'));
    expect(data.seaWave).toEqual(db(block(section, '.SineWave')));
    expect(data.sineWave).toEqual(Array.from({ length: 32 }, (_, i) => Math.round(256 * Math.sin(Math.PI * i / 32))));
    expect(read('macros/data.asm')).toContain('dw sin(x * 0.5 / (\\1))');
  });
  for (const name of ['yellow_intro_1', 'yellow_intro_2', 'clouds']) {
    it(`${name}.png: every decoded pixel equals pret's source sheet`, () => {
      const actual = PNG.sync.read(readFileSync(resolve(GAME, `static/gfx/intro/${name}.png`)));
      const expected = PNG.sync.read(readFileSync(resolve(REFS, `gfx/intro/${name}.png`)));
      expect([actual.width, actual.height]).toEqual([expected.width, expected.height]);
      expect(actual.data).toEqual(expected.data);
    });
  }
  for (const [name, size] of [['clouds', 120], ['cloud_pair', 12], ['small_cloud', 4]] as const) {
    it(`${name}.tilemap: exact ROM-layout bytes and dimensions`, () => {
      const actual = readFileSync(resolve(GAME, `static/gfx/intro/${name}.tilemap`));
      expect(actual.length).toBe(size);
      expect(actual).toEqual(readFileSync(resolve(REFS, `gfx/intro/${name}.tilemap`)));
    });
  }
});

describe.skipIf(!process.env.ROM_PATH)('Yellow intro ROM extraction', () => {
  const buffer = process.env.ROM_PATH ? readFileSync(process.env.ROM_PATH) : Buffer.alloc(0);
  const rom = new BinaryReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  it('extracts every committed JSON byte through both entry points', async () => {
    expect(extractYellowIntro(rom)).toEqual(data);
    installNodeImageData();
    const result = await extractRom(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    expect(result.jsonData['yellow_intro.json']).toEqual(data);
  });
  it('binds every new offset to pret symbols independently', () => {
    const symbols = execFileSync('git', ['-C', REFS, 'show', 'origin/symbols:pokeyellow.sym'], { encoding: 'utf8' });
    for (const [key, label] of [
      ['YELLOW_INTRO_GRAPHICS_1', 'YellowIntroGraphics1'], ['YELLOW_INTRO_GRAPHICS_2', 'YellowIntroGraphics2'],
      ['YELLOW_INTRO_CLOUD_GFX', 'YellowIntroCloudGFX'], ['YELLOW_INTRO_SPAWN_STATES', 'YellowIntro_AnimatedObjectSpawnStateData'],
      ['YELLOW_INTRO_FRAMESETS', 'YellowIntro_AnimatedObjectFramesData'], ['YELLOW_INTRO_OAM_SETS', 'YellowIntro_AnimatedObjectOAMData'],
      ['YELLOW_INTRO_SPEED_BARS', 'YellowIntroFlyingSpeedBarData'], ['YELLOW_INTRO_SEA_WAVE', 'YellowIntro_Copy8BitSineWave.SineWave'],
      ['YELLOW_INTRO_SINE_WAVE', 'Intro_Sine.SineWave'], ['YELLOW_INTRO_THUNDER_PALS', 'YellowIntroThunderboltPalSequence'],
      ['YELLOW_INTRO_FADE_PALS', 'YellowIntroFadeToWhitePalSequence'],
    ] as const) {
      const line = symbols.split('\n').find(s => s.trim().endsWith(` ${label}`))!;
      const [bank, address] = line.split(' ')[0].split(':').map(n => parseInt(n, 16));
      expect(offsets[key]).toBe(bank * 0x4000 + (address & 0x3fff));
    }
    expect(offsets.YELLOW_INTRO_CLOUD_MAPS).toEqual([0x5b6e, 0x5be6, 0x5bf2].map(a => 0x3e * 0x4000 + (a & 0x3fff)));
  });
  for (const [kind, offset, replacement] of [
    ['frameset pointer', offsets.YELLOW_INTRO_FRAMESETS, 0x3fff],
    ['OAM pointer', offsets.YELLOW_INTRO_OAM_SETS + 1, 0x7fff],
    ['OAM count', 0x3e * 0x4000 + 0x2179, 41],
  ] as const) {
    it(`rejects a corrupt ${kind}`, () => {
      const copy = Buffer.from(buffer);
      if (kind === 'OAM count') copy[offset] = replacement;
      else copy.writeUInt16LE(replacement, offset);
      expect(() => extractYellowIntro(new BinaryReader(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength))))
        .toThrow(/Yellow intro:/);
    });
  }
});
