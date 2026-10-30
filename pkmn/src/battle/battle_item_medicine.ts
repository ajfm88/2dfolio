import { refreshPartyMon } from './battle_party_codec';
// Unused ItemUseMedicine battle port, pret e89ead15 engine/items/item_effects.asm:903–1377.
import { I } from './battle_item_state';
import { SHORT_ITEM_CONSTANTS } from './battle_item_bodies';
import { PARTYMON_STRUCT_LENGTH, type BattleState } from './battle_state';
import { func_e4bf, itemUseNoEffect, playSoundWaitForCurrent, registerBattleItemBody, removeUsedItem,
  type BattleItemHost } from './battle_items';
import { doubleOrHalveSelectedStats } from './battle_math';
import { isThisPartyMonStarterPikachu, modifyPikachuHappiness } from './battle_pikachu';
import { flagAction } from './battle_end_helpers';
import { writeHpBarWord } from './battle_hp';
import { waitForTextScrollButtonPress } from './battle_experience';
import { delayFrames, type Program } from './battle_menu_context';
import { resetLowHealthAlarm as resetBattleAlarm } from '../audio/low_health_alarm';
import { setPikachuSpawnState } from '../pikachu/pikachu_spawn';
import { textBgTransfer } from '../text/bg_transfer';

export interface MedicineItemEnvironment {
  /** USE_ITEM_PARTY_MENU selection also writes WhichPokemon/CurPartySpecies/BattleMonSpecies2. */
  displayPartyMenu(): Program<number | null>;
  animateHpBar(x: number, y: number): Program;
  clearScreen(): Program;
  redrawPartyMenu(messageId: number): Program;
  gbPalWhiteOut(): void;
  runDefaultPaletteCommand(): Program;
}

// constants/{item_constants,menu_constants}.asm. The status path clears the WHOLE byte.
const FULL_RESTORE = 0x10, FULL_HEAL = 0x34, REVIVE = 0x35, MAX_REVIVE = 0x36;
const CURES: Readonly<Record<number, readonly [number, number]>> = {
  0x0b: [0x08, 0xf0], 0x0c: [0x10, 0xf1], 0x0d: [0x20, 0xf2],
  0x0e: [0x07, 0xf3], 0x0f: [0x40, 0xf4], [FULL_HEAL]: [0xff, 0xf6],
};

/** Clear the raw status before refreshing the presentation cache. */
function clearPartyStatus(state: BattleState, slot: number): void {
  state.mem[I.wPartyMons + slot * PARTYMON_STRUCT_LENGTH + 4] = 0;
  if (state.partyMons[slot]) refreshPartyMon(state, slot);
}

/** item_effects.asm:955–1011. Copy max HP through Special; keep inherited hWhoseTurn. */
function cureStatus(state: BattleState, slot: number): boolean {
  const base = I.wPartyMons + slot * PARTYMON_STRUCT_LENGTH;
  const [mask, message] = CURES[state.mem[I.wCurItem]];
  if (!(state.mem[base + 4] & mask)) return false;
  clearPartyStatus(state, slot);
  state.mem[I.wPartyMenuTypeOrMessageID] = message;
  if (slot === state.wPlayerMonNumber) {
    state.wBattleMonStatus = 0;
    state.wPlayerBattleStatus3 &= ~1; // BADLY_POISONED; toxic counter and stages stay untouched.
    state.mem.set(state.mem.slice(base + 34, base + 44), I.wBattleMonMaxHP);
    doubleOrHalveSelectedStats(state);
  }
  return true;
}

/** item_effects.asm:1014–1301. Includes byte carry/wrap, revive flags and Full Restore's two paths. */
function healHp(state: BattleState, slot: number): boolean {
  const base = I.wPartyMons + slot * PARTYMON_STRUCT_LENGTH;
  const item = state.mem[I.wCurItem], oldHp = state.readBE(base + 1), maxHp = state.readBE(base + 34);
  const revive = item === REVIVE || item === MAX_REVIVE;
  writeHpBarWord(state, I.wHPBarOldHP, oldHp);
  if (oldHp === 0) {
    if (!revive) return false;
    const bagSlot = state.wWhichPokemon;
    state.wWhichPokemon = slot;
    // RespawnOverworldPikachu (engine/pikachu/respawn_overworld_pikachu.asm:1–6).
    if (isThisPartyMonStarterPikachu(state)) setPikachuSpawnState(3);
    state.wWhichPokemon = bagSlot;
    if (flagAction(state, I.wPartyFoughtCurrentEnemyFlags, 2, slot)) {
      flagAction(state, I.wPartyGainExpFlags, 1, slot);
    }
  } else if (revive) return false;
  if (oldHp === maxHp) {
    if (item !== FULL_RESTORE || state.mem[base + 4] === 0) return false;
    state.mem[I.wCurItem] = FULL_HEAL;
    return cureStatus(state, slot);
  }
  // Any target, including reserves. This preserves the alarm's separate disabled flag.
  resetBattleAlarm();
  writeHpBarWord(state, I.wHPBarMaxHP, maxHp);
  const amount = item === 0x3d ? 60 : item >= 0x3d ? 80 : item === 0x3c ? 50 :
    item < 0x13 ? 200 : item === 0x13 ? 50 : 20;
  // ADD low byte, then INC high byte on carry; overflow wraps before the comparison.
  const low = state.mem[base + 2] + amount;
  state.mem[base + 2] = low;
  state.mem[I.wHPBarNewHP] = low;
  state.mem[I.wHPBarNewHP + 1] = state.mem[base + 1];
  if (low > 255) state.mem[base + 1]++;
  state.mem[I.wHPBarNewHP + 1] = state.mem[base + 1];
  let hp = state.readBE(base + 1);
  if (item === REVIVE) hp = maxHp >> 1;
  else if (hp >= maxHp || item < 0x12 || item === MAX_REVIVE) hp = maxHp;
  state.writeBE(base + 1, hp);
  writeHpBarWord(state, I.wHPBarNewHP, hp);
  if (state.partyMons[slot]) refreshPartyMon(state, slot);
  if (item === FULL_RESTORE) clearPartyStatus(state, slot);
  if (slot === state.wPlayerMonNumber) {
    state.wBattleMonHP = hp;
    if (item === FULL_RESTORE) state.wBattleMonStatus = 0;
    // No stat copy or BADLY_POISONED clear on Full Restore's HP-heal path.
  }
  return true;
}

/** item_effects.asm:1317–1357. Spend before pre-wait/sound, then presentation,50 frames and button. */
function* medicineSuccess(state: BattleState, host: BattleItemHost, env: MedicineItemEnvironment, slot: number): Program {
  removeUsedItem(state, host);
  const item = state.mem[I.wCurItem];
  if (item < FULL_RESTORE || item === FULL_HEAL) yield* playSoundWaitForCurrent(host, 0x8e);
  else {
    yield* playSoundWaitForCurrent(host, 0x8d);
    state.mem[I.hUILayoutFlags] |= 1;
    state.wHPBarType = 2;
    yield* env.animateHpBar(4, 1 + 2 * slot);
    state.mem[I.hUILayoutFlags] &= ~1;
    state.mem[I.wPartyMenuTypeOrMessageID] = item === REVIVE || item === MAX_REVIVE ? 0xf7 : 0xf5;
  }
  state.mem[I.hAutoBGTransferEnabled] = 0; textBgTransfer.enabled = false;
  yield* env.clearScreen();
  state.mem[I.wUpdateSpritesEnabled] = 0xff;
  yield* env.redrawPartyMenu(state.mem[I.wPartyMenuTypeOrMessageID]);
  state.mem[I.hAutoBGTransferEnabled] = 1; textBgTransfer.enabled = true;
  yield* delayFrames(50);
  yield* waitForTextScrollButtonPress(state, host);
}

/** item_effects.asm:903–954,1313–1315,1360–1377. Battle only; no Softboiled/vitamins/map reload. */
export function* itemUseMedicine(state: BattleState, host: BattleItemHost, env: MedicineItemEnvironment): Program {
  if (state.mem[I.wPartyCount] === 0) { yield* func_e4bf(state, host); return; }
  const bagSlot = state.wWhichPokemon, item = state.mem[I.wCurItem];
  state.mem[I.wPartyMenuTypeOrMessageID] = 1; // USE_ITEM_PARTY_MENU.
  state.mem[I.wUpdateSpritesEnabled] = 0xff;
  const slot = yield* env.displayPartyMenu();
  if (slot === null) state.wActionResultOrTookBattleTurn = 0; // No restoration on cancel.
  else {
    state.mem[I.wUsedItemOnWhichPokemon] = slot;
    state.wCurSpecies = state.wCurPartySpecies;
    if (item <= 0x27) modifyPikachuHappiness(state, SHORT_ITEM_CONSTANTS.PIKAHAPPY_USEDITEM); // CALCIUM; before any check.
    state.mem[I.wCurItem] = item; state.wWhichPokemon = bagSlot;
    const effect = CURES[item] ? cureStatus(state, slot) : healHp(state, slot);
    if (effect) yield* medicineSuccess(state, host, env, slot);
    else yield* itemUseNoEffect(state, host);
  }
  env.gbPalWhiteOut();
  // GBPalWhiteOut's XOR leaves Z set; the CGB helpers preserve AF (§11.1). Always call.
  yield* env.runDefaultPaletteCommand();
}

/** item_effects.asm:903–1377. Explicit unused composition beside the short-body registration. */
export function registerMedicineBattleItemBody(env: MedicineItemEnvironment): () => void {
  return registerBattleItemBody('ItemUseMedicine', (state, host) => itemUseMedicine(state, host, env));
}
