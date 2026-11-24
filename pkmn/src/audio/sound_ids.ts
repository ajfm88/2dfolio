// constants/music_constants.asm: (header address - SFX_Headers_1) / 3.
// All 49 music headers; PokeFluteInBattle is a direct channel-pointer routine, not a sound ID.
import type { SoundIdentity } from './play_sound';
import { CRY_SFX_START, isCry } from './sfx_modifiers';

export const MUSIC_IDS = {
  pallettown: { id: 0xba, bank: 0x02 },
  pokecenter: { id: 0xbd, bank: 0x02 },
  gym: { id: 0xc0, bank: 0x02 },
  cities1: { id: 0xc3, bank: 0x02 },
  cities2: { id: 0xc7, bank: 0x02 },
  celadon: { id: 0xca, bank: 0x02 },
  cinnabar: { id: 0xcd, bank: 0x02 },
  vermilion: { id: 0xd0, bank: 0x02 },
  lavender: { id: 0xd4, bank: 0x02 },
  ssanne: { id: 0xd8, bank: 0x02 },
  meetprofoak: { id: 0xdb, bank: 0x02 },
  meetrival: { id: 0xde, bank: 0x02 },
  museumguy: { id: 0xe1, bank: 0x02 },
  safarizone: { id: 0xe5, bank: 0x02 },
  pkmnhealed: { id: 0xe8, bank: 0x02 },
  routes1: { id: 0xeb, bank: 0x02 },
  routes2: { id: 0xef, bank: 0x02 },
  routes3: { id: 0xf3, bank: 0x02 },
  routes4: { id: 0xf7, bank: 0x02 },
  indigoplateau: { id: 0xfb, bank: 0x02 },
  gymleaderbattle: { id: 0xea, bank: 0x08 },
  trainerbattle: { id: 0xed, bank: 0x08 },
  wildbattle: { id: 0xf0, bank: 0x08 },
  finalbattle: { id: 0xf3, bank: 0x08 },
  defeatedtrainer: { id: 0xf6, bank: 0x08 },
  defeatedwildmon: { id: 0xf9, bank: 0x08 },
  defeatedgymleader: { id: 0xfc, bank: 0x08 },
  titlescreen: { id: 0xc3, bank: 0x1f },
  credits: { id: 0xc7, bank: 0x1f },
  halloffame: { id: 0xca, bank: 0x1f },
  oakslab: { id: 0xcd, bank: 0x1f },
  jigglypuffsong: { id: 0xd0, bank: 0x1f },
  bikeriding: { id: 0xd2, bank: 0x1f },
  surfing: { id: 0xd6, bank: 0x1f },
  gamecorner: { id: 0xd9, bank: 0x1f },
  yellowintro: { id: 0xdc, bank: 0x1f },
  dungeon1: { id: 0xdf, bank: 0x1f },
  dungeon2: { id: 0xe3, bank: 0x1f },
  dungeon3: { id: 0xe7, bank: 0x1f },
  cinnabarmansion: { id: 0xeb, bank: 0x1f },
  pokemontower: { id: 0xef, bank: 0x1f },
  silphco: { id: 0xf2, bank: 0x1f },
  meeteviltrainer: { id: 0xf5, bank: 0x1f },
  meetfemaletrainer: { id: 0xf8, bank: 0x1f },
  meetmaletrainer: { id: 0xfb, bank: 0x1f },
  surfingpikachu: { id: 0x99, bank: 0x20 },
  meetjessiejames: { id: 0x9c, bank: 0x20 },
  yellowunusedsong: { id: 0x9f, bank: 0x20 },
  gbprinter: { id: 0xa3, bank: 0x20 },
} as const satisfies Record<string, SoundIdentity>;

// Extracted SFX IDs (bank $02 except battle-bank-only RUN). Playback variants remain V5.
export const SFX_IDS = {
  press_ab: 0x90,
  start_menu: 0x8f,
  heal_hp: 0x8d,
  heal_ailment: 0x8e,
  healing_machine: 0x9e,
  collision: 0xb4,
  go_inside: 0xad,
  go_outside: 0xb5,
  save: 0xb6,
  purchase: 0xb2,
  swap: 0xae,
  withdraw_deposit: 0xab,
  cut: 0xac,
  get_item1: 0x86,
  get_item2: 0x89,
  get_key_item: 0x94,
  turn_on_pc: 0x99,
  turn_off_pc: 0x9a,
  enter_pc: 0x9b,
  shrink: 0x9c,
  run: 0x97, // SFX_Run, bank $08 only; the battle's RUN plays it.
  // V5g3 checkpoint-03 (note 108): the ledge hop (ledges.asm:53) and the Town Map's input (town_map.asm:76).
  ledge: 0xa2,
  tink: 0x8c,
  // Opening checkpoint-05 (note 114): the title's bounce (title.asm:90) and its whoosh (title.asm:139). Audio 3
  // only (sfxheaders3.asm); the title selects bank $1f first (PrepareTitleScreen).
  intro_crash: 0xbc,
  intro_whoosh: 0xbd,
  // Opening checkpoint-09 (note 120): AnimateShootingStar's sound (splash.asm:31), Audio 3 only; Init selects bank $1f.
  shooting_star: 0xc2,
} as const;

export function musicIdentity(name: string): SoundIdentity | undefined {
  return Object.prototype.hasOwnProperty.call(MUSIC_IDS, name) ? MUSIC_IDS[name as keyof typeof MUSIC_IDS] : undefined;
}

export function musicNameForSound(id: number, bank: number): string | undefined {
  return Object.entries(MUSIC_IDS).find(([, sound]) => sound.id === id && sound.bank === bank)?.[0];
}

/**
 * TextCommandSounds (home/text.asm:552–559): the SFX each text `sound` command requests. The cries and the unused
 * Pokédex rating are not here. The same id plays a different body per bank: SFX_GET_ITEM_1 is SFX_Level_Up while
 * the battle engine (bank $08) is loaded. V5g1 checkpoint-03 (note 104).
 */
export const TEXT_SOUND_IDS = {
  get_item1: 0x86, caught_mon: 0x9a, get_item2: 0x89, get_key_item: 0x94, dex_page_added: 0x98,
} as const satisfies Record<string, number>;

export function textSoundId(name: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(TEXT_SOUND_IDS, name) ? TEXT_SOUND_IDS[name as keyof typeof TEXT_SOUND_IDS] : undefined;
}

/**
 * V5g1 checkpoint-02 (note 103): the file PlaySound plays for an SFX id in each audio bank, for every id in
 * SFX_IDS or TEXT_SOUND_IDS. Each engine reads its own SFX_Headers_N (home/audio.asm DetermineAudioFunction;
 * audio/engine_1.asm:1386–1398). A value is the committed file whose body is that bank's entry; an id with no
 * such file is absent. extraction.test.ts recomputes this table from the ROM.
 */
export const SFX_FILES: Readonly<Record<0x02 | 0x08 | 0x1f | 0x20, Readonly<Record<number, string>>>> = {
  0x02: {
    0x86: 'get_item1', 0x89: 'get_item2', 0x8c: 'tink', 0x8d: 'heal_hp', 0x8e: 'heal_ailment', 0x8f: 'start_menu', 0x90: 'press_ab',
    0x94: 'get_key_item', 0x99: 'turn_on_pc', 0x9a: 'turn_off_pc', 0x9b: 'enter_pc', 0x9c: 'shrink',
    0x9e: 'healing_machine', 0xab: 'withdraw_deposit', 0xac: 'cut', 0xad: 'go_inside', 0xae: 'swap',
    0xa2: 'ledge', 0xb2: 'purchase', 0xb4: 'collision', 0xb5: 'go_outside', 0xb6: 'save',
  },
  0x08: {
    0x86: 'level_up', 0x89: 'get_item2', 0x8c: 'tink', 0x8d: 'heal_hp', 0x8e: 'heal_ailment', 0x8f: 'start_menu', 0x90: 'press_ab',
    0x97: 'run', 0x98: 'dex_page_added', 0x9a: 'caught_mon', 0x9e: 'faint_fall',
  },
  0x1f: {
    0x86: 'get_item1', 0x89: 'get_item2', 0x8c: 'tink', 0x8d: 'heal_hp', 0x8e: 'heal_ailment', 0x8f: 'start_menu', 0x90: 'press_ab',
    0x94: 'get_key_item', 0x99: 'turn_on_pc_3', 0x9a: 'turn_off_pc', 0x9b: 'enter_pc_3', 0x9c: 'shrink',
    0x9e: 'healing_machine', 0xab: 'withdraw_deposit', 0xac: 'cut', 0xad: 'go_inside', 0xae: 'swap',
    0xa2: 'ledge', 0xb2: 'purchase', 0xb4: 'collision', 0xb5: 'go_outside', 0xb6: 'save_3',
    0xbc: 'intro_crash', 0xbd: 'intro_whoosh', 0xc2: 'shooting_star',
  },
  0x20: { 0x86: 'get_item1', 0x89: 'get_item2', 0x8c: 'tink', 0x8d: 'heal_hp', 0x8e: 'heal_ailment', 0x8f: 'start_menu', 0x90: 'press_ab' },
};

/** DetermineAudioFunction: banks $02, $08 and $1f pick their engines; any other bank falls to Audio 4. */
export function sfxNameForSound(id: number, bank: number): string | undefined {
  if (isCry(id) && (id - CRY_SFX_START) % 3 === 0) {
    const base = (id - CRY_SFX_START) / 3;
    return `cry${base.toString(16).padStart(2, '0')}`;
  }
  const table = bank === 0x02 || bank === 0x08 || bank === 0x1f ? SFX_FILES[bank] : SFX_FILES[0x20];
  return table[id];
}

