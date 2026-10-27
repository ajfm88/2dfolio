// Unused port of pret e89ead15 engine/items/item_effects.asm:1900-1977.
import type { BattleState } from './battle_state';
import { I } from './battle_item_state';
import { registerBattleItemBody, type BattleItemHost } from './battle_items';
import { playBattleFlute } from './battle_flute_audio';
import type { SfxData, SfxEngine } from '../audio/sfx_engine';
import type { Program } from './battle_menu_context';
import { lowHealthAlarm } from '../audio/low_health_alarm';

export interface FluteItemEnvironment {
  sfx: SfxEngine;
  streams: SfxData;
  loadScreenTilesFromBuffer2(): void;
}

/** WakeUpEntireParty: six raw slots, regardless of party count or species. */
export function wakeUpEntireParty(state: BattleState, firstStatus: number): void {
  for (let slot = 0; slot < 6; slot++) {
    const at = firstStatus + slot * 44; // PARTYMON_STRUCT_LENGTH.
    if (state.mem[at] & 7) state.mem[I.wWereAnyMonsAsleep] = 1;
    state.mem[at] &= 0xf8;
  }
}

/** ItemUsePokeFlute.inBattle through FluteWokeUpText. Result1 is set by UseItem. */
export function* itemUsePokeFlute(state: BattleState, host: BattleItemHost, env: FluteItemEnvironment): Program {
  state.mem[I.wWereAnyMonsAsleep] = 0;
  wakeUpEntireParty(state, I.wPartyMons + 4);
  if (state.wIsInBattle !== 1) wakeUpEntireParty(state, I.wEnemyMons + 4);
  // The active player's sleep is cleared WITHOUT contributing to the flag.
  state.wBattleMonStatus &= 0xf8;
  if (state.wEnemyMonStatus & 7) state.mem[I.wWereAnyMonsAsleep] = 1;
  state.wEnemyMonStatus &= 0xf8;
  env.loadScreenTilesFromBuffer2();
  if (!state.mem[I.wWereAnyMonsAsleep]) {
    yield* host.printText('PlayedFluteNoEffectText');
    return;
  }
  yield* host.printText('PlayedFluteHadEffectText');
  if (!(lowHealthAlarm() & 0x80)) {
    yield* host.waitForSound();
    yield* playBattleFlute(host, env.sfx, env.streams);
    // The ordinary sound waiter excludes CHAN7; the flute polls its ID itself.
    while (host.audio.channelId(7) !== 0) yield 'serviced';
  }
  yield* host.printText('FluteWokeUpText');
}

/** Explicit unused composition beside registerShortBattleItemBodies. No field flute. */
export function registerFluteBattleItemBody(env: FluteItemEnvironment): () => void {
  return registerBattleItemBody('ItemUsePokeFlute', (state, host) => itemUsePokeFlute(state, host, env));
}
