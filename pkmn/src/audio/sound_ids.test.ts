import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MUSIC_IDS, SFX_FILES, SFX_IDS, TEXT_SOUND_IDS, musicIdentity, musicNameForSound, sfxNameForSound, textSoundId } from './sound_ids';

const refs = resolve(__dirname, '../../../refs/pokeyellow');
const read = (path: string) => readFileSync(resolve(refs, path), 'utf8');
const normalize = (name: string) => name.replace(/_/g, '').toLowerCase();

describe('numeric sound identity from cartridge header layout', () => {
  // A5c2 CP2: RUN adds one ID and has no bank-1-suffixed symbol.
  it.skipIf(!existsSync(refs))('all 49 music identities and 32 SFX IDs match independent ASM header counts and banks', () => {
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
    // The title's two sounds and the star's exist only in Audio 3 (opening checkpoints 05, 09): no engine suffix.
    const audio3Only = ['intro_crash', 'intro_whoosh', 'shooting_star'];
    for (const [name, id] of Object.entries(SFX_IDS))
      expect(id, name).toBe(symbols.get(name === 'run' ? 'sfxrun' : `sfx${normalize(name)}${audio3Only.includes(name) ? '' : '1'}`));
    expect(SFX_IDS.run).toBe(0x97);
    expect([SFX_IDS.intro_crash, SFX_IDS.intro_whoosh, SFX_IDS.shooting_star]).toEqual([0xbc, 0xbd, 0xc2]);
    expect(Object.keys(SFX_IDS)).toHaveLength(32);
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
    expect(sfxNameForSound(0x99, 2)).toBe('turn_on_pc');
    expect(sfxNameForSound(0, 2)).toBeUndefined();
  });

  it('resolves shrink as SFX $9c independently of bank-$20 meetjessiejames music', () => {
    expect(SFX_IDS.shrink).toBe(0x9c);
    expect(sfxNameForSound(0x9c, 2)).toBe('shrink');
    expect(musicIdentity('meetjessiejames')).toEqual({ id: 0x9c, bank: 0x20 });
    expect(musicNameForSound(0x9c, 0x20)).toBe('meetjessiejames');
    expect(musicNameForSound(0x9c, 0x02)).toBeUndefined();
    // SFX_Poisoned and SFX_Run are both id $97; the bank table picks the body.
    expect(SFX_IDS.poisoned).toBe(SFX_IDS.run);
    expect(new Set(Object.values(SFX_IDS)).size).toBe(Object.keys(SFX_IDS).length - 1);
  });
});

describe('the SFX an id plays in each audio bank (V5g1 checkpoint-02, note 103)', () => {
  it('Audio 3 plays its own save, turn_on_pc and enter_pc and the title sounds; other field ids share Audio 1 files', () => {
    expect(sfxNameForSound(SFX_IDS.save, 0x1f)).toBe('save_3');
    expect(sfxNameForSound(SFX_IDS.turn_on_pc, 0x1f)).toBe('turn_on_pc_3');
    expect(sfxNameForSound(SFX_IDS.enter_pc, 0x1f)).toBe('enter_pc_3');
    // Opening checkpoints 05 and 09: SFX_INTRO_CRASH, SFX_INTRO_WHOOSH and SFX_SHOOTING_STAR are Audio 3's alone.
    for (const name of ['intro_crash', 'intro_whoosh', 'shooting_star'] as const) {
      expect(sfxNameForSound(SFX_IDS[name], 0x1f), name).toBe(name);
      for (const bank of [0x02, 0x08, 0x20]) expect(sfxNameForSound(SFX_IDS[name], bank), `${name} in ${bank}`).toBeUndefined();
    }
    const field = Object.entries(SFX_IDS).filter(([name]) => !['run', 'intro_crash', 'intro_whoosh', 'shooting_star'].includes(name));
    for (const [name, id] of field) expect(sfxNameForSound(id, 0x02), name).toBe(name);
    const shared = field.filter(([name]) => !['save', 'turn_on_pc', 'enter_pc'].includes(name));
    expect(shared).toHaveLength(25);
    for (const [name, id] of shared) expect(sfxNameForSound(id, 0x1f), name).toBe(name);
  });

  it('Audio 2 and Audio 4 hold only the ids whose bodies a committed file has', () => {
    expect(sfxNameForSound(SFX_IDS.press_ab, 0x08)).toBe('press_ab');
    expect(sfxNameForSound(SFX_IDS.run, 0x08)).toBe('run');
    expect(sfxNameForSound(SFX_IDS.poisoned, 0x02)).toBe('poisoned');
    expect(sfxNameForSound(SFX_IDS.poisoned, 0x1f)).toBe('poisoned');
    expect(sfxNameForSound(SFX_IDS.poisoned, 0x08)).toBe('run');
    expect(sfxNameForSound(SFX_IDS.run, 0x02)).toBe('poisoned');
    expect(sfxNameForSound(SFX_IDS.get_item1, 0x08)).toBe('level_up'); // the Rare Candy comment in party_menu.asm
    expect(sfxNameForSound(SFX_IDS.collision, 0x08)).toBeUndefined();
    expect(sfxNameForSound(SFX_IDS.save, 0x08)).toBeUndefined();
    expect(sfxNameForSound(SFX_IDS.press_ab, 0x20)).toBe('press_ab');
    expect(sfxNameForSound(SFX_IDS.save, 0x20)).toBeUndefined();
  });

  it('any other bank reads Audio 4\'s table, as DetermineAudioFunction defaults', () => {
    for (const bank of [0x00, 0x01, 0x03, 0x47, 0xff]) {
      expect(sfxNameForSound(SFX_IDS.press_ab, bank)).toBe('press_ab');
      expect(sfxNameForSound(SFX_IDS.save, bank)).toBeUndefined();
    }
  });

  it('every file the table names is committed, and every bank row covers only SFX_IDS and TEXT_SOUND_IDS ids', () => {
    const files = new Set(readdirSync(resolve(__dirname, '../../data/audio/sfx')).map(f => f.replace(/\.json$/, '')));
    const ids = new Set<number>([...Object.values(SFX_IDS), ...Object.values(TEXT_SOUND_IDS)]);
    expect(Object.keys(SFX_FILES).map(Number).sort((a, b) => a - b)).toEqual([0x02, 0x08, 0x1f, 0x20]);
    for (const [bank, row] of Object.entries(SFX_FILES)) for (const [id, file] of Object.entries(row)) {
      expect(ids.has(Number(id)), `${bank}:${id}`).toBe(true);
      expect(files.has(file), file).toBe(true);
    }
  });
});

describe('TextCommandSounds (V5g1 checkpoint-03, note 104)', () => {
  it.skipIf(!existsSync(refs))('TEXT_SOUND_IDS are the SFX ids home/text.asm plays for each sound command', () => {
    const slot = new Map<string, number>();
    for (let engine = 1; engine <= 4; engine++) {
      let slots = 0;
      for (const raw of read(`audio/headers/sfxheaders${engine}.asm`).split('\n')) {
        const line = raw.split(';')[0].trim(); if (!line) continue;
        const label = line.match(/^(\w+)::$/);
        if (label) slot.set(label[1], slots); else if (/^channel \d,/.test(line) || line.startsWith('db ')) slots++;
      }
    }
    const label = new Map([...read('constants/music_constants.asm').matchAll(/music_const\s+(SFX_\w+),\s+(SFX_\w+)/g)].map(m => [m[1], m[2]]));
    const text = read('home/text.asm'), table = text.slice(text.indexOf('TextCommandSounds::'), text.indexOf('TextCommand_DOTS::'));
    const rows = [...table.matchAll(/db (TX_SOUND_\w+),\s+(SFX_\w+)/g)].map(m => [m[1], slot.get(label.get(m[2])!)] as const);
    const name = (command: string) => command.replace('TX_SOUND_', '').toLowerCase().replace(/_(\d)$/, '$1');
    const expected = Object.fromEntries(rows.filter(([command]) => !/POKEDEX_RATING|DUPLICATE/.test(command)).map(([command, id]) => [name(command), id]));
    expect(TEXT_SOUND_IDS).toEqual(expected);
    expect(rows.find(([command]) => command === 'TX_SOUND_GET_ITEM_1_DUPLICATE')?.[1]).toBe(TEXT_SOUND_IDS.get_item1);
  });

  it('textSoundId reads only its own keys; SFX_GET_ITEM_1 is SFX_Level_Up in bank $08 and $98 has a file only there', () => {
    expect(textSoundId('get_item1')).toBe(0x86);
    expect(textSoundId('toString')).toBeUndefined(); expect(textSoundId('press_ab')).toBeUndefined();
    expect(sfxNameForSound(TEXT_SOUND_IDS.get_item1, 0x08)).toBe('level_up');
    expect(sfxNameForSound(TEXT_SOUND_IDS.dex_page_added, 0x08)).toBe('dex_page_added');
    for (const bank of [0x02, 0x1f, 0x20]) expect(sfxNameForSound(TEXT_SOUND_IDS.dex_page_added, bank)).toBeUndefined();
  });
});

describe('ledge and tink in the bank table (V5g3 checkpoint-03, note 108)', () => {
  it('tink ($8C) is the same file in all four banks; ledge ($A2) only in $02 and $1f', () => {
    for (const bank of [0x02, 0x08, 0x1f, 0x20]) expect(sfxNameForSound(SFX_IDS.tink, bank)).toBe('tink');
    expect(sfxNameForSound(SFX_IDS.ledge, 0x02)).toBe('ledge');
    expect(sfxNameForSound(SFX_IDS.ledge, 0x1f)).toBe('ledge');
    expect(sfxNameForSound(SFX_IDS.ledge, 0x08)).toBeUndefined();
    expect(sfxNameForSound(SFX_IDS.ledge, 0x20)).toBeUndefined();
  });
});
