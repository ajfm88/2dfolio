// Unused port of pret e89ead15 audio/poke_flute.asm, Music_PokeFluteInBattle.
import type { SfxData, SfxEngine } from '../audio/sfx_engine';
import { playSoundWaitForCurrent, type BattleItemHost } from './battle_items';
import type { Program } from './battle_menu_context';

// ROM 08:59CF's instructions, not a sound header or additional asset schema.
export const BATTLE_FLUTE_AUDIO = {
  bank: 0x08,
  caughtMon: 0x9a, // SFX_CAUGHT_MON; retains caught_mon's IDs and priority.
  commandPointers: 0xc00e, // wChannelCommandPointers + CHAN5 * 2.
  streams: [{ id: 5, address: 0x59eb }, { id: 6, address: 0x59ee }, { id: 7, address: 0x444b }],
} as const;

export async function loadBattleFluteStreams(): Promise<SfxData> {
  const response = await fetch('audio/sfx/pokeflute_in_battle.json');
  if (!response.ok) throw new Error('battle flute streams');
  return await response.json() as SfxData;
}

export function* playBattleFlute(host: BattleItemHost, sfx: SfxEngine, streams: SfxData): Program {
  yield* playSoundWaitForCurrent(host, BATTLE_FLUTE_AUDIO.caughtMon);
  // No update between request and overwrite: only a VBlank in this tiny ASM window
  // could intervene on hardware, and the port does not model that window.
  for (const { id } of BATTLE_FLUTE_AUDIO.streams) {
    const channel = streams.channels.find(channel => channel.id === id);
    if (!channel) throw new Error(`missing battle flute channel ${id}`);
    // Keep the original array: CH5 visits tempo THEN execute_music mid-stream.
    sfx.replacePendingMusicSfxStream(id, channel.commands);
  }
}
