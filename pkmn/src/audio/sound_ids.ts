// constants/music_constants.asm: (header address - SFX_Headers_1) / 3.
// All 49 music headers; PokeFluteInBattle is a direct channel-pointer routine, not a sound ID.
import type { SoundIdentity } from './play_sound';

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

// The extracted bank-$02 SFX IDs. Playback data variants remain V5; request IDs do not change.
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
} as const;

export function musicIdentity(name: string): SoundIdentity | undefined {
  return Object.prototype.hasOwnProperty.call(MUSIC_IDS, name) ? MUSIC_IDS[name as keyof typeof MUSIC_IDS] : undefined;
}

export function musicNameForSound(id: number, bank: number): string | undefined {
  return Object.entries(MUSIC_IDS).find(([, sound]) => sound.id === id && sound.bank === bank)?.[0];
}

export function sfxNameForSound(id: number): string | undefined {
  return Object.entries(SFX_IDS).find(([, soundId]) => soundId === id)?.[0];
}

