// Unused ItemUsePPRestore. pret e89ead15 engine/items/item_effects.asm:2174–2384.
import { I } from './battle_item_state';
import { battleContext, type BattleState } from './battle_state';
import { itemUseNoEffect, itemUseNotTime, playBattleItemSound, registerBattleItemBody, removeUsedItem,
  type BattleItemHost } from './battle_items';
import { displayUseItemPartyMenu, createMedicineItemEnvironment, type MedicinePresentationHost } from './battle_item_medicine_env';
import { addBonusPP, moveSelectionMenu } from './move_selection_menu';
import { copyMoveNameToStringBuffer, getMoveName, getMoveRecord } from './battle_move_data';
import type { MoveMenuHost, Program } from './battle_menu_context';

export interface PPItemEnvironment extends MedicinePresentationHost { moveMenu: MoveMenuHost }
const MAX_ETHER = 0x51, ELIXER = 0x52;

/** item_effects.asm:2804–2815. GetSelectedMoveOffset, player-party source only. */
export function selectedPartyMoveOffset(state: BattleState): number {
  return I.wPartyMons + 44 * state.wWhichPokemon + 8 + state.wCurrentMenuItem;
}

/** item_effects.asm:2748–2802,2699–2733. Real six-byte record and retained AddBonusPP owner. */
export function getPartyMoveMaxPP(state: BattleState): number {
  const at = selectedPartyMoveOffset(state);
  state.setBytes(I.wMoveData, getMoveRecord(state.mem[at]), 6);
  const base = state.mem[I.wMoveData + 5], packed = state.mem[at + 21];
  state.wPPUpCountAndMaxPP = (packed & 0xc0) | base;
  state.wUsingPPUp = 0;
  state.wPPUpCountAndMaxPP = addBonusPP(base, state.wPPUpCountAndMaxPP, state.wUsingPPUp);
  state.wMaxPP = state.wPPUpCountAndMaxPP & 63; // Same $D11D cell as the earlier UsingPPUp0.
  return state.wMaxPP;
}

/** item_effects.asm:2291–2334. Max Ether deliberately compares the unmasked byte. */
export function restorePartyMovePP(state: BattleState): boolean {
  state.wMonDataLocation = 0;
  const max = getPartyMoveMaxPP(state), at = selectedPartyMoveOffset(state) + 21;
  const packed = state.mem[at], full = state.mem[I.wPPRestoreItem] === MAX_ETHER;
  if ((full ? packed : packed & 63) === max) return false;
  const pp = full ? max : Math.min(max, (packed & 63) + 10);
  state.mem[at] = (packed & 0xc0) + pp;
  const move = state.partyMons[state.wWhichPokemon]?.moves[state.wCurrentMenuItem];
  if (move) move.pp = state.mem[at] & 63;
  return state.mem[at] !== 0; // NZ from the final ADD, as the caller tests it.
}

/** item_effects.asm:2174–2384. Battle only; no PP-Up or field return branch. */
export function* itemUsePPRestore(state: BattleState, host: BattleItemHost, env: PPItemEnvironment): Program {
  const bagSlot = state.wWhichPokemon, item = state.mem[I.wCurItem];
  state.mem[I.wPPRestoreItem] = item;
  const palettes = createMedicineItemEnvironment(state, env);
  for (;;) {
    state.mem[I.wUpdateSpritesEnabled] = 0;
    state.mem[I.wPartyMenuTypeOrMessageID] = 1; // USE_ITEM_PARTY_MENU.
    const chosen = yield* displayUseItemPartyMenu(state, env);
    if (chosen === null) break;
    if (chosen === state.wPlayerMonNumber && (state.wPlayerBattleStatus3 & 8)) {
      yield* itemUseNotTime(state, host); break;
    }
    let restored: boolean;
    if (state.mem[I.wPPRestoreItem] < ELIXER) {
      state.wMoveMenuType = 2;
      yield* host.printText('RestorePPWhichTechniqueText');
      state.wPlayerMoveListIndex = 0;
      const flags = yield* moveSelectionMenu(battleContext(state), env.moveMenu);
      state.wPlayerMoveListIndex = 0; // LD0 does not clobber the returned Z flag.
      if (!flags.zero) continue; // Back to the FULL party opening, not the move menu.
      state.wNamedObjectIndex = state.mem[selectedPartyMoveOffset(state)];
      getMoveName(state); copyMoveNameToStringBuffer(state);
      restored = restorePartyMovePP(state);
    } else {
      state.mem[I.wPPRestoreItem] = (state.mem[I.wPPRestoreItem] - 2) & 255;
      state.wCurrentMenuItem = 0; state.mem[I.wTileBehindCursor] = 0; // Adjacent $CC26/$CC27.
      for (; state.wCurrentMenuItem < 4; state.wCurrentMenuItem++) {
        if (state.mem[selectedPartyMoveOffset(state)] === 0) continue;
        if (restorePartyMovePP(state)) state.mem[I.wTileBehindCursor]++;
      }
      restored = state.mem[I.wTileBehindCursor] !== 0;
    }
    if (!restored) { yield* itemUseNoEffect(state, host); break; }
    if (chosen === state.wPlayerMonNumber) {
      const at = I.wPartyMons + 44 * chosen + 29;
      state.mem.set(state.mem.slice(at, at + 4), I.wBattleMonPP);
    }
    playBattleItemSound(host, 0x8e); // PlaySound, with NO old-sound/completion wait.
    yield* host.printText('PPRestoredText');
    state.wWhichPokemon = bagSlot;
    palettes.gbPalWhiteOut(); yield* palettes.runDefaultPaletteCommand();
    removeUsedItem(state, host);
    return;
  }
  palettes.gbPalWhiteOut(); yield* palettes.runDefaultPaletteCommand();
  state.wActionResultOrTookBattleTurn = 0; // Pop the saved bag slot WITHOUT storing it.
}

/** item_effects.asm:2174–2384. Explicit unused registration beside medicine. */
export function registerPPBattleItemBody(env: PPItemEnvironment): () => void {
  return registerBattleItemBody('ItemUsePPRestore', (state, host) => itemUsePPRestore(state, host, env));
}
