// Unused A5c3f checkpoint-04b. pret e89ead15, core.asm:135-260 and init_battle.asm:130-139.
import { A, decodeNick, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { I } from './battle_item_state';
import { delayFrames, type BattleActionContext, type Program } from './battle_menu_context';
import { anyPartyAlive, flagAction, hasMonFainted } from './battle_end_helpers';
import { enemySendOutFirstMon } from './battle_enemy_send_out';
import { sendOutMon } from './battle_send_out';
import { slideTrainerPicOffScreen } from './battle_slides';
import { getMonHeader, loadBattleMonFromParty } from './battle_loaders';
import { handlePlayerBlackOut, enemyRan } from './battle_faint';
import { displayBattleMenu } from './battle_menu';
import { random } from './battle_random';
import { battleLoop, type BattleLoopExit, type BattleLoopHost } from './battle_loop';
import { endOfBattle, type BattleEndHost } from './battle_end';
import { INIT, initBattleAfterTransition, type BattleInitHost, type BattleInitSaved } from './battle_init';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { BattleUnsupportedState } from './battle_move_data';
import type { TurnPorts } from './battle_turn';

// Modelling boundary, not a cartridge rule: note72 §11.9. Stack/echo RAM are not modelled;
// the resulting serial byte is observable only in the unsupported link branch.
export const ENEMY_SCAN_MODELLED_END = 0xe000;

export type BattleStartHost = BattleInitHost & BattleLoopHost & BattleEndHost;
// Entry only forwards this argument; the loop owns its checked trainer-model contract.
type BattleLoopTrainer = Parameters<typeof battleLoop>[4];
export interface BattleStartExit { exit: BattleLoopExit; /** HandlePlayerBlackOut's carry, when that path returns. */ blackoutCarry?: boolean }
export interface BattleCommonExit extends BattleStartExit { carry: true }

/** pret core.asm:142-155; note72 §11.9 replaces the unmodelled stack/echo tail.
 * Return the stopping pair's address for diagnostics; D is stored before returning either way. */
export function scanFirstAliveEnemyMon(state: BattleState): number {
  let hl: number = D.wEnemyMon1HP, d = 3;
  for (;;) {
    d = (d + 1) & 255;
    if (hl >= ENEMY_SCAN_MODELLED_END || (state.mem[hl] | state.mem[(hl + 1) & 65535])) {
      state.wSerialExchangeNybbleReceiveData = d;
      return hl;
    }
    hl = (hl + 44) & 65535;
  }
}

/** pret engine/battle/safari_zone.asm:1-28. Bait has priority; expired anger still prints after reloading catch rate. */
export function* printSafariZoneBattleText(state: BattleState, host: BattleStartHost): Program {
  let program: string;
  if (state.mem[I.wSafariBaitFactor] !== 0) {
    state.mem[I.wSafariBaitFactor]--;
    program = 'SafariZoneEatingText';
  } else {
    if (state.mem[I.wSafariEscapeFactor] === 0) return;
    state.mem[I.wSafariEscapeFactor]--;
    program = 'SafariZoneAngryText';
    if (state.mem[I.wSafariEscapeFactor] === 0) {
      state.wCurSpecies = state.wEnemyMonSpecies;
      getMonHeader(state, state.wCurSpecies);
      state.wEnemyMonActualCatchRate = state.mem[A.wMonHCatchRate];
    }
  }
  host.loadScreenTilesFromBuffer1();
  yield* host.printText(program, { enemyMonNick: decodeNick(state.mem, D.wEnemyMonNick) });
}

/** pret core.asm:135-260. Compose existing send-out/menu/turn/faint owners; no frame clock here. */
export function* startBattle(state: BattleState, ctx: BattleActionContext, host: BattleStartHost,
  ports: TurnPorts, trainer?: BattleLoopTrainer): Program<BattleStartExit> {
  bindEntryBattleScreen(state, host.screen);
  if (state.wLinkState === LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  state.mem[D.wPartyGainExpFlags] = state.mem[D.wPartyFoughtCurrentEnemyFlags] = state.wActionResultOrTookBattleTurn = 0;
  state.wFirstMonsNotOutYet = 1;
  scanFirstAliveEnemyMon(state);
  if (state.wIsInBattle !== 1) yield* enemySendOutFirstMon(state, host);
  yield* delayFrames(40);
  host.saveScreenTilesToBuffer1();
  for (;;) {
    if (state.wBattleType !== 3 && state.wBattleType !== 4 && anyPartyAlive(state).zero) {
      const result = yield* handlePlayerBlackOut(state, host);
      return { exit: result.carry ? 'blackout' : 'end', blackoutCarry: result.carry };
    }
    host.loadScreenTilesFromBuffer1();
    if (state.wBattleType === 0) {
      state.wWhichPokemon = 0;
      while ((yield* hasMonFainted(state, host)).zero) state.wWhichPokemon++;
      state.wPlayerMonNumber = state.wWhichPokemon;
      state.wCurPartySpecies = state.wBattleMonSpecies2 = state.mem[D.wPartySpecies + state.wWhichPokemon];
      host.loadScreenTilesFromBuffer1();
      yield* slideTrainerPicOffScreen(state, host.screen, 1, 5, 9);
      host.saveScreenTilesToBuffer1();
      flagAction(state, D.wPartyGainExpFlags, 1, state.wWhichPokemon);
      flagAction(state, D.wPartyFoughtCurrentEnemyFlags, 1, state.wWhichPokemon);
      loadBattleMonFromParty(state);
      host.loadScreenTilesFromBuffer1();
      yield* sendOutMon(state, host);
      return { exit: yield* battleLoop(state, ctx, host, ports, trainer) };
    }
    // .displaySafariZoneBattleMenu: failed actions repeat this menu without AnyPartyAlive/Buffer1's outer return.
    do {
      if ((yield* displayBattleMenu(ctx, host)).carry) return { exit: 'end' };
    } while (state.wActionResultOrTookBattleTurn === 0);
    if (state.wNumSafariBalls === 0) {
      host.loadScreenTilesFromBuffer1();
      yield* host.printText('StartBattle.outOfSafariBallsText');
      return { exit: 'end' };
    }
    yield* printSafariZoneBattleText(state, host);
    let b = state.mem[A.wEnemyMonSpeed + 1] * 2;
    if (b > 255) { yield* enemyRan(state, host); return { exit: 'end' }; }
    if (state.mem[I.wSafariBaitFactor] !== 0) b >>>= 2;
    // The escape-factor AND clears any carry from the bait SRLs; only SLA's overflow survives into Random.
    let carryIn: 0 | 1 = 0;
    if (state.mem[I.wSafariEscapeFactor] !== 0) {
      b *= 2;
      if (b > 255) { b = 255; carryIn = 1; }
    }
    if (random(state, carryIn) < b) { yield* enemyRan(state, host); return { exit: 'end' }; }
    // CP B / JR NC tail-jumps back to .checkAnyPartyAlive, including Buffer1's reload.
  }
}

/** pret init_battle.asm:109-139. After every StartBattle return, EndOfBattle, ordered stack restores, SCF. */
export function* initBattleCommon(state: BattleState, saved: BattleInitSaved, ctx: BattleActionContext,
  host: BattleStartHost, ports: TurnPorts, trainer?: BattleLoopTrainer): Program<BattleCommonExit> {
  yield* initBattleAfterTransition(state, host);
  const result = yield* startBattle(state, ctx, host, ports, trainer);
  yield* endOfBattle(state, host);
  state.mem[INIT.wLetterPrintingDelayFlags] = saved.letterPrintingDelayFlags;
  state.mem[INIT.wMapPalOffset] = saved.mapPalOffset;
  state.mem[INIT.hTileAnimations] = state.mem[INIT.wSavedTileAnimations];
  return { ...result, carry: true };
}
