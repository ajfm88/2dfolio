import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MUSIC_IDS, SFX_IDS, musicIdentity, musicNameForSound, sfxNameForSound } from './sound_ids';

const refs = resolve(__dirname, '../../../refs/pokeyellow');
const read = (path: string) => readFileSync(resolve(refs, path), 'utf8');
const normalize = (name: string) => name.replace(/_/g, '').toLowerCase();

describe('numeric sound identity from cartridge header layout', () => {
  // A5c2 CP2: RUN adds one ID and has no bank-1-suffixed symbol.
  it.skipIf(!existsSync(refs))('all 49 music identities and 21 SFX IDs match independent ASM header counts and banks', () => {
    const layout = new Map<number, number>(); let bank = 0;
    for (const raw of read('layout.link').split('\n')) {
      const line = raw.split(';')[0].trim();
      const b = line.match(/^ROMX \$([\da-f]+)$/i); if (b) bank = parseInt(b[1], 16);
      const section = line.match(/^"Music Headers (\d)"$/); if (section) layout.set(Number(section[1]), bank);
    }
    const expectedMusic: Record<string, { id: number; bank: number }> = {};
    const symbols = new Map<string, number>();
    for (let engine = 1; engine <= 4; engine++) {
      let slots = 0;
      for (const kind of ['sfx', 'music']) {
        for (const raw of read(`audio/headers/${kind}headers${engine}.asm`).split('\n')) {
          const line = raw.split(';')[0].trim(); if (!line) continue;
          const label = line.match(/^(\w+)::$/);
          if (label) {
            symbols.set(normalize(label[1]), slots);
            if (kind === 'music') expectedMusic[normalize(label[1].slice('Music_'.length))] = { id: slots, bank: layout.get(engine)! };
          } else if (/^channel \d,/.test(line)) slots++;
          else if (line.startsWith('db ')) { expect(line).toBe('db $ff, $ff, $ff'); slots++; }
          else expect(line).toMatch(/^channel_count \d$/);
        }
      }
    }
    // Constants must refer to exactly these headers, using the source's three-byte-slot formula.
    const constants = [...read('constants/music_constants.asm').matchAll(/music_const\s+MUSIC_\w+,\s+(Music_\w+)/g)];
    expect(constants).toHaveLength(49);
    expect(constants.map(m => normalize(m[1].slice(6))).sort()).toEqual(Object.keys(expectedMusic).sort());
    expect(read('constants/music_constants.asm')).toContain('((\\2 - SFX_Headers_1) / 3)');
    expect(MUSIC_IDS).toEqual(expectedMusic);
    for (const [name, id] of Object.entries(SFX_IDS))
      expect(id, name).toBe(symbols.get(name === 'run' ? 'sfxrun' : `sfx${normalize(name)}1`));
    expect(SFX_IDS.run).toBe(0x97);
    expect(Object.keys(SFX_IDS)).toHaveLength(21);
  });

  it('covers committed header-backed music and keeps the direct Flute routine separate', () => {
    const tracks = readdirSync(resolve(__dirname, '../../data/audio/music')).map(n => n.replace('.json', ''));
    for (const name of tracks.filter(n => n !== 'pokefluteinbattle')) expect(musicIdentity(name), name).toBeDefined();
    expect(musicIdentity('pokefluteinbattle')).toBeUndefined();
    expect(musicIdentity('missing')).toBeUndefined();
    expect(musicIdentity('toString')).toBeUndefined();
  });

  it('resolves aliased numeric IDs using the current bank, including bank-$20 music overlapping SFX IDs', () => {
    expect(MUSIC_IDS.cities1.id).toBe(MUSIC_IDS.titlescreen.id);
    expect(musicNameForSound(0xc3, 2)).toBe('cities1');
    expect(musicNameForSound(0xc3, 0x1f)).toBe('titlescreen');
    expect(musicNameForSound(0xc3, 8)).toBeUndefined();
    expect(musicNameForSound(0x99, 0x20)).toBe('surfingpikachu');
    expect(sfxNameForSound(0x99)).toBe('turn_on_pc');
    expect(sfxNameForSound(0)).toBeUndefined();
  });

  it('resolves shrink as SFX $9c independently of bank-$20 meetjessiejames music', () => {
    expect(SFX_IDS.shrink).toBe(0x9c);
    expect(sfxNameForSound(0x9c)).toBe('shrink');
    expect(musicIdentity('meetjessiejames')).toEqual({ id: 0x9c, bank: 0x20 });
    expect(musicNameForSound(0x9c, 0x20)).toBe('meetjessiejames');
    expect(musicNameForSound(0x9c, 0x02)).toBeUndefined();
    expect(new Set(Object.values(SFX_IDS)).size).toBe(Object.keys(SFX_IDS).length);
  });
});
