// Unused EndOfBattle. pret e89ead15 engine/battle/end_of_battle.asm:1–79.
import { LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { readBattleBcd, writeBattleBcd, type FaintHost } from './battle_faint';
import { addBcd } from '../menus/screen_tiles';
import { resetLowHealthAlarm as resetBattleAlarm } from '../audio/low_health_alarm';
import { updatePikachuMoodAfterBattle } from './battle_pikachu';
import { BattleUnsupportedState } from './battle_move_data';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { setPartyAndBillsSavedMenuItem, setBagSavedMenuItem, setBattleAndStartSavedMenuItem, setListScrollOffset } from '../list_state';
import type { Program } from './battle_menu_context';

export interface BattleEndHost extends Pick<FaintHost, 'screen' | 'printText' | 'waitForSound'> {
  /** Approved evolution hand-off: source party bytes, CanEvolve flags and existing evolution owner. */
  evolutionAfterBattle(state: BattleState): Program;
}

/** StartBattle's caller invokes this after every normal battleLoop return, including blackout. */
export function* endOfBattle(state: BattleState, host: BattleEndHost): Program {
  bindEntryBattleScreen(state, host.screen);
  if (state.wLinkState === LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  if (state.wBattleResult === 0) {
    if (state.mem[D.wTotalPayDayMoney] | state.mem[D.wTotalPayDayMoney + 1] | state.mem[D.wTotalPayDayMoney + 2]) {
      writeBattleBcd(state, D.wPlayerMoney, addBcd(readBattleBcd(state, D.wPlayerMoney), readBattleBcd(state, D.wTotalPayDayMoney)));
      yield* host.printText('PickUpPayDayMoneyText', { totalPayDayMoney: readBattleBcd(state, D.wTotalPayDayMoney) });
    }
    state.mem[D.wForceEvolution] = 0;
    yield* host.evolutionAfterBattle(state);
    updatePikachuMoodAfterBattle(state, 0x82);
  }
  // CPU ID clear only. Keep the alarm-disabled flag and other channels; the real wait follows.
  resetBattleAlarm();
  state.wIsInBattle = state.wBattleType = state.wMoveMissed = state.wCurOpponent = 0;
  state.wForcePlayerToChooseMon = state.wNumRunAttempts = state.wEscapedFromBattle = 0;
  state.mem.fill(0, D.wPartyAndBillsPCSavedMenuItem, D.wPartyAndBillsPCSavedMenuItem + 4);
  setPartyAndBillsSavedMenuItem(0); setBagSavedMenuItem(0); setBattleAndStartSavedMenuItem(0);
  state.mem[D.wListScrollOffset] = 0; setListScrollOffset(0);
  state.mem.fill(0, D.wBattleStatusData, D.wBattleStatusDataEnd);
  state.mem[D.wStatusFlags2] |= 1;
  yield* host.waitForSound();
  host.screen.bgp = host.screen.obp0 = host.screen.obp1 = 0;
  state.mem[D.wDestinationWarpID] = 0xff;
}
