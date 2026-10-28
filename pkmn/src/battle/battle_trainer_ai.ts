// Unused trainer-AI items and switching. pret e89ead15 engine/battle/trainer_ai.asm:290–751;
// data/trainers/ai_pointers.asm; macros/data.asm:3; core.asm:405–475 (the caller sets hWhoseTurn 1).
// Move-choice modifications stay in checkpoint-09. No live caller.
import { A, encodeText, LINK_STATE_BATTLING, NAME_BUFFER_LENGTH, NAME_LENGTH,
  PARTYMON_STRUCT_LENGTH, WILD_BATTLE, type BattleState } from './battle_state';
import { decodeTextByte } from '../rom/extractors/text';
import { D } from './battle_end_state';
import { I } from './battle_item_state';
import { divide } from './battle_arithmetic';
import { random } from './battle_random';
import { playSoundWaitForCurrent, type BattleItemHost } from './battle_items';
import { readHpBarWord, updateHPBar2 } from './battle_hp';
import { statModifierUpEffect, type StatEffectEnvironment } from './battle_effects_stats';
import { enemySendOut, type EnemySendOutHost } from './battle_enemy_send_out';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { BattleUnsupportedState } from './battle_move_data';
import type { BattleScreen } from './battle_screen';
import type { Program } from './battle_menu_context';

// constants/battle_constants.asm status bits. Recharge (NEEDS_TO_RECHARGE, bit 5) is not a gate.
const STORING_ENERGY = 1 << 0;
const THRASHING_ABOUT = 1 << 1;
const CHARGING_UP = 1 << 4;
const LOCKED_STATUS1 = STORING_ENERGY | THRASHING_ABOUT | CHARGING_UP;
const USING_X_ACCURACY = 1 << 0;
const PROTECTED_BY_MIST = 1 << 1;
const GETTING_PUMPED = 1 << 2;
const USING_RAGE = 1 << 6;
const BADLY_POISONED = 1 << 0;
// constants/item_constants.asm and move_effect_constants.asm.
const FULL_RESTORE = 0x10;
const HYPER_POTION = 0x12;
const SUPER_POTION = 0x13;
const POTION = 0x14;
const X_ACCURACY = 0x2e;
const FULL_HEAL = 0x34;
const GUARD_SPEC = 0x37;
const DIRE_HIT = 0x3a;
const X_ATTACK = 0x41;
const X_DEFEND = 0x42;
const X_SPEED = 0x43;
const X_SPECIAL = 0x44;
const ATTACK_UP1 = 0x0a;
const DEFENSE_UP1 = 0x0b;
const SPEED_UP1 = 0x0c;
const SPECIAL_UP1 = 0x0d;
// move_constants.asm: STRUGGLE $a5, then SHOWPIC, STATUS, ANIM_A8, ENEMY_HUD, four TRADE balls,
// XSTATITEM_ANIM $ae, XSTATITEM_DUPLICATE_ANIM $af.
const XSTATITEM_DUPLICATE_ANIM = 0xaf;
const SFX_HEAL_AILMENT = 0x8e;
const HM01 = 0xc4;
const ITEM_NAME = 4; // list_constants.asm
const ITEM_NAMES_BANK = 0x01; // ItemNames, rom_offsets bank $01

/** macros/data.asm:3. `percent` is `* $ff / 100`, integer, left to right. */
function percent(n: number): number {
  return (n * 0xff / 100) | 0;
}

export const AI_ROLL = {
  /** `25 percent + 1` = 64 */
  percent25Plus1: percent(25) + 1,
  /** `13 percent - 1` = 32 */
  percent13Minus1: percent(13) - 1,
  /** `50 percent + 1` = 128 */
  percent50Plus1: percent(50) + 1,
  /** `8 percent` = 20 */
  percent8: percent(8),
} as const;

export interface TrainerAIRow {
  className: string;
  count: number;
  routine: string;
}

/** data/trainers/ai_pointers.asm. One row per class, id 1 in row 0. Modifications are checkpoint-09. */
export const TRAINER_AI_POINTERS: readonly TrainerAIRow[] = [
  { className: 'YOUNGSTER', count: 3, routine: 'GenericAI' },
  { className: 'BUG_CATCHER', count: 3, routine: 'GenericAI' },
  { className: 'LASS', count: 3, routine: 'GenericAI' },
  { className: 'SAILOR', count: 3, routine: 'GenericAI' },
  { className: 'JR_TRAINER_M', count: 3, routine: 'GenericAI' },
  { className: 'JR_TRAINER_F', count: 3, routine: 'GenericAI' },
  { className: 'POKEMANIAC', count: 3, routine: 'GenericAI' },
  { className: 'SUPER_NERD', count: 3, routine: 'GenericAI' },
  { className: 'HIKER', count: 3, routine: 'GenericAI' },
  { className: 'BIKER', count: 3, routine: 'GenericAI' },
  { className: 'BURGLAR', count: 3, routine: 'GenericAI' },
  { className: 'ENGINEER', count: 3, routine: 'GenericAI' },
  { className: 'UNUSED_JUGGLER', count: 3, routine: 'JugglerAI' },
  { className: 'FISHER', count: 3, routine: 'GenericAI' },
  { className: 'SWIMMER', count: 3, routine: 'GenericAI' },
  { className: 'CUE_BALL', count: 3, routine: 'GenericAI' },
  { className: 'GAMBLER', count: 3, routine: 'GenericAI' },
  { className: 'BEAUTY', count: 3, routine: 'GenericAI' },
  { className: 'PSYCHIC_TR', count: 3, routine: 'GenericAI' },
  { className: 'ROCKER', count: 3, routine: 'GenericAI' },
  { className: 'JUGGLER', count: 3, routine: 'JugglerAI' },
  { className: 'TAMER', count: 3, routine: 'GenericAI' },
  { className: 'BIRD_KEEPER', count: 3, routine: 'GenericAI' },
  { className: 'BLACKBELT', count: 2, routine: 'BlackbeltAI' },
  { className: 'RIVAL1', count: 3, routine: 'GenericAI' },
  { className: 'PROF_OAK', count: 3, routine: 'GenericAI' },
  { className: 'CHIEF', count: 1, routine: 'GenericAI' },
  { className: 'SCIENTIST', count: 3, routine: 'GenericAI' },
  { className: 'GIOVANNI', count: 1, routine: 'GiovanniAI' },
  { className: 'ROCKET', count: 3, routine: 'GenericAI' },
  { className: 'COOLTRAINER_M', count: 2, routine: 'CooltrainerMAI' },
  { className: 'COOLTRAINER_F', count: 1, routine: 'CooltrainerFAI' },
  { className: 'BRUNO', count: 2, routine: 'BrunoAI' },
  { className: 'BROCK', count: 5, routine: 'BrockAI' },
  { className: 'MISTY', count: 1, routine: 'MistyAI' },
  { className: 'LT_SURGE', count: 1, routine: 'LtSurgeAI' },
  { className: 'ERIKA', count: 1, routine: 'ErikaAI' },
  { className: 'KOGA', count: 2, routine: 'KogaAI' },
  { className: 'BLAINE', count: 2, routine: 'BlaineAI' },
  { className: 'SABRINA', count: 1, routine: 'SabrinaAI' },
  { className: 'GENTLEMAN', count: 3, routine: 'GenericAI' },
  { className: 'RIVAL2', count: 1, routine: 'Rival2AI' },
  { className: 'RIVAL3', count: 1, routine: 'Rival3AI' },
  { className: 'LORELEI', count: 2, routine: 'LoreleiAI' },
  { className: 'CHANNELER', count: 3, routine: 'GenericAI' },
  { className: 'AGATHA', count: 2, routine: 'AgathaAI' },
  { className: 'LANCE', count: 1, routine: 'LanceAI' },
];

export interface TrainerAIEnvironment extends Pick<StatEffectEnvironment, 'animation' | 'hideSubstitute' | 'reshowSubstitute'> {
  screen: BattleScreen;
  items: BattleItemHost;
  text: StatEffectEnvironment['host'];
  sendOut: EnemySendOutHost;
}

type AIRoutine = (state: BattleState, env: TrainerAIEnvironment, roll: number) => Program<{ carry: boolean }>;

let itemDisplayNames: readonly string[] | undefined;

/** Committed item_names.json, id 1 at index 0. GetName's 20-byte tail of the following names is not in that table. */
export async function loadTrainerAIItemNames(): Promise<void> {
  const response = await fetch('item_names.json');
  if (!response.ok) throw new Error(`item names: HTTP ${response.status}`);
  itemDisplayNames = Object.values(await response.json() as Record<string, string>);
}

function ramText(mem: Uint8Array, addr: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) {
    const byte = mem[addr + i];
    if (byte === 0x50 || byte === 0) break;
    text += decodeTextByte(byte, addr + i);
  }
  return text;
}

/** trainer_ai.asm:462–466. */
function decrementAICount(state: BattleState): { carry: true } {
  state.mem[D.wAICount] = (state.mem[D.wAICount] - 1) & 255;
  return { carry: true };
}

/** home/names.asm:27–49 and home/names2.asm:11–98, for an item id below HM01. */
function getItemName(state: BattleState): void {
  const id = state.wNamedObjectIndex;
  if (id >= HM01) throw new BattleUnsupportedState('machine item name');
  if (!itemDisplayNames || id === 0 || id > itemDisplayNames.length) throw new BattleUnsupportedState('item name');
  state.wNameListIndex = id;
  state.wNameListType = ITEM_NAME;
  state.wPredefBank = ITEM_NAMES_BANK;
  state.wNamedObjectIndex = state.wNameListIndex; // GetName's write
  const bytes = encodeText(`${itemDisplayNames[id - 1]}@`);
  for (let i = 0; i < bytes.length && i < NAME_BUFFER_LENGTH; i++) state.mem[A.wNameBuffer + i] = bytes[i];
}

/** trainer_ai.asm:741–747. */
function* aiPrintItemUse_(state: BattleState, env: TrainerAIEnvironment): Program {
  state.wNamedObjectIndex = state.mem[I.wAIItem]; // $D11D, shared with wPokedexNum
  getItemName(state);
  yield* env.items.printText('AIBattleUseItemText', {
    trainerName: ramText(state.mem, D.wTrainerName, NAME_LENGTH),
    nameBuffer: ramText(state.mem, A.wNameBuffer, NAME_BUFFER_LENGTH),
    enemyMonNick: ramText(state.mem, A.wEnemyMonNick, NAME_LENGTH),
  });
}

/** trainer_ai.asm:736–739. */
function* aiPrintItemUse(state: BattleState, env: TrainerAIEnvironment, item: number): Program<{ carry: boolean }> {
  state.mem[I.wAIItem] = item & 255;
  yield* aiPrintItemUse_(state, env);
  return decrementAICount(state);
}

/** trainer_ai.asm:555–561. Text, then the bar at (2, 2) type 0, then the decrement. */
function* aiPrintItemUseAndUpdateHPBar(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  yield* aiPrintItemUse_(state, env);
  const oldHp = readHpBarWord(state, A.wHPBarOldHP);
  const newHp = readHpBarWord(state, A.wHPBarNewHP);
  const maxHp = readHpBarWord(state, A.wHPBarMaxHP);
  yield* updateHPBar2(state, env.screen, 2, 2, 0, oldHp, newHp, maxHp);
  return decrementAICount(state);
}

/** trainer_ai.asm:514–553. Add b to the low byte; write the high byte back only on carry; clamp only on borrow. */
export function* aiRecoverHP(state: BattleState, env: TrainerAIEnvironment, item: number, amount: number): Program<{ carry: boolean }> {
  state.mem[I.wAIItem] = item & 255;
  const lowAddr = A.wEnemyMonHP + 1;
  const highAddr = A.wEnemyMonHP;
  const low = state.mem[lowAddr];
  state.mem[A.wHPBarOldHP] = low;
  const sum = low + amount;
  const newLow = sum & 255;
  state.mem[lowAddr] = newLow;
  state.mem[A.wHPBarNewHP] = newLow;
  let high = state.mem[highAddr];
  state.mem[A.wHPBarOldHP + 1] = high;
  state.mem[A.wHPBarNewHP + 1] = high;
  if (sum > 255) {
    high = (high + 1) & 255;
    state.mem[highAddr] = high;
    state.mem[A.wHPBarNewHP + 1] = high;
  }
  const healedLow = state.mem[lowAddr];
  const maxLow = state.mem[A.wEnemyMonMaxHP + 1];
  const maxHigh = state.mem[A.wEnemyMonMaxHP];
  state.mem[A.wHPBarMaxHP] = maxLow;
  const lowBorrow = maxLow < healedLow;
  state.mem[A.wHPBarMaxHP + 1] = maxHigh;
  const highBorrow = maxHigh - high - (lowBorrow ? 1 : 0) < 0;
  if (!highBorrow) return yield* aiPrintItemUseAndUpdateHPBar(state, env);
  state.mem[lowAddr] = maxLow;
  state.mem[A.wHPBarNewHP] = maxLow;
  state.mem[highAddr] = maxHigh;
  state.mem[A.wHPBarNewHP + 1] = maxHigh;
  return yield* aiPrintItemUseAndUpdateHPBar(state, env);
}

/** trainer_ai.asm:496–500. */
export function* aiUsePotion(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  return yield* aiRecoverHP(state, env, POTION, 20);
}
/** trainer_ai.asm:502–506. */
export function* aiUseSuperPotion(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  return yield* aiRecoverHP(state, env, SUPER_POTION, 50);
}
/** trainer_ai.asm:508–512. */
export function* aiUseHyperPotion(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  return yield* aiRecoverHP(state, env, HYPER_POTION, 200);
}

/** trainer_ai.asm:634–645. No stat restore and no toxic-counter write. */
export function aiCureStatus(state: BattleState): void {
  const at = D.wEnemyMon1Status + (state.wEnemyMonPartyPos & 255) * PARTYMON_STRUCT_LENGTH;
  state.mem[at & 0xffff] = 0;
  state.wEnemyMonStatus = 0;
  state.wEnemyBattleStatus3 &= ~BADLY_POISONED;
}

/** trainer_ai.asm:472–494. Cure with no sound, then HP = max, then the shared bar. */
export function* aiUseFullRestore(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  aiCureStatus(state);
  state.mem[I.wAIItem] = FULL_RESTORE;
  const lowAddr = A.wEnemyMonHP + 1;
  state.mem[A.wHPBarOldHP] = state.mem[lowAddr];
  state.mem[A.wHPBarOldHP + 1] = state.mem[A.wEnemyMonHP];
  const maxLow = state.mem[A.wEnemyMonMaxHP + 1];
  const maxHigh = state.mem[A.wEnemyMonMaxHP];
  state.mem[A.wHPBarNewHP] = maxLow;
  state.mem[A.wHPBarMaxHP] = maxLow;
  state.mem[lowAddr] = maxLow;
  state.mem[A.wHPBarNewHP + 1] = maxHigh;
  state.mem[A.wHPBarMaxHP + 1] = maxHigh;
  state.mem[A.wEnemyMonHP] = maxHigh;
  return yield* aiPrintItemUseAndUpdateHPBar(state, env);
}

/** trainer_ai.asm:468–470. */
function* aiPlayRestoringSFX(env: TrainerAIEnvironment): Program {
  yield* playSoundWaitForCurrent(env.items, SFX_HEAL_AILMENT);
}

/** trainer_ai.asm:628–632. */
export function* aiUseFullHeal(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  yield* aiPlayRestoringSFX(env);
  aiCureStatus(state);
  return yield* aiPrintItemUse(state, env, FULL_HEAL);
}

/** trainer_ai.asm:654–659. */
export function* aiUseGuardSpec(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  yield* aiPlayRestoringSFX(env);
  state.wEnemyBattleStatus2 |= PROTECTED_BY_MIST;
  return yield* aiPrintItemUse(state, env, GUARD_SPEC);
}

/** trainer_ai.asm:647–652. Unreferenced on the cartridge; direct call only. */
export function* aiUseXAccuracy(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  yield* aiPlayRestoringSFX(env);
  state.wEnemyBattleStatus2 |= USING_X_ACCURACY;
  return yield* aiPrintItemUse(state, env, X_ACCURACY);
}

/** trainer_ai.asm:661–666. Unreferenced on the cartridge; direct call only. */
export function* aiUseDireHit(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  yield* aiPlayRestoringSFX(env);
  state.wEnemyBattleStatus2 |= GETTING_PUMPED;
  return yield* aiPrintItemUse(state, env, DIRE_HIT);
}

/** trainer_ai.asm:668–692. Carry only when the 16-bit HP is strictly below max / divisor. */
export function aiCheckIfHPBelowFraction(state: BattleState, divisor: number): boolean {
  const h = state.mem.subarray(A.hProduct, A.hProduct + 10);
  h[4] = divisor & 255;
  h[0] = state.mem[A.wEnemyMonMaxHP];
  h[1] = state.mem[A.wEnemyMonMaxHP + 1];
  if (divide(h, 2)) throw new Error('AI HP divide froze');
  const quotientHigh = h[2];
  const quotientLow = h[3];
  const hpHigh = state.mem[A.wEnemyMonHP];
  const hpLow = state.mem[A.wEnemyMonHP + 1];
  // `sub` / `ret nz`: highs decide, and the low `sub` runs only when the highs match.
  if (hpHigh !== quotientHigh) return hpHigh < quotientHigh;
  return hpLow < quotientLow;
}

/** trainer_ai.asm:714–734. Text first; restore Num and Effect; decrement even when nothing happened. */
function* aiIncreaseStat(state: BattleState, env: TrainerAIEnvironment, item: number, effect: number): Program<{ carry: boolean }> {
  state.mem[I.wAIItem] = item & 255;
  yield* aiPrintItemUse_(state, env);
  const moveNum = state.wEnemyMoveNum;
  const moveEffect = state.wEnemyMoveEffect;
  state.wEnemyMoveNum = XSTATITEM_DUPLICATE_ANIM;
  state.wEnemyMoveEffect = effect & 255;
  bindEntryBattleScreen(state, env.screen);
  yield* statModifierUpEffect(state, {
    animation: env.animation, hideSubstitute: env.hideSubstitute, reshowSubstitute: env.reshowSubstitute, host: env.text,
  });
  state.wEnemyMoveNum = moveNum;
  state.wEnemyMoveEffect = moveEffect;
  return decrementAICount(state);
}

/** trainer_ai.asm:694–697. */
export function* aiUseXAttack(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  return yield* aiIncreaseStat(state, env, X_ATTACK, ATTACK_UP1);
}
/** trainer_ai.asm:699–702. */
export function* aiUseXDefend(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  return yield* aiIncreaseStat(state, env, X_DEFEND, DEFENSE_UP1);
}
/** trainer_ai.asm:704–707. */
export function* aiUseXSpeed(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  return yield* aiIncreaseStat(state, env, X_SPEED, SPEED_UP1);
}
/** trainer_ai.asm:709–712. */
export function* aiUseXSpecial(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  return yield* aiIncreaseStat(state, env, X_SPECIAL, SPECIAL_UP1);
}

/** trainer_ai.asm:593–622. Four bytes: HP, the party position, and status. */
export function* switchEnemyMon(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  const dest = (D.wEnemyMon1HP + (state.wEnemyMonPartyPos & 255) * PARTYMON_STRUCT_LENGTH) & 0xffff;
  for (let i = 0; i < 4; i++) state.mem[(dest + i) & 0xffff] = state.mem[A.wEnemyMonHP + i];
  yield* env.sendOut.printText('AIBattleWithdrawText', {
    trainerName: ramText(state.mem, D.wTrainerName, NAME_LENGTH),
    enemyMonNick: ramText(state.mem, A.wEnemyMonNick, NAME_LENGTH),
  });
  state.wFirstMonsNotOutYet = 1;
  yield* enemySendOut(state, env.sendOut);
  state.wFirstMonsNotOutYet = 0;
  // core.asm's EnemySendOut link path is still unsupported, so this return is not reached on a link battle.
  if (state.wLinkState === LINK_STATE_BATTLING) return { carry: false };
  return { carry: true };
}

/** trainer_ai.asm:563–591. Nonzero HP in the roster, over wEnemyPartyCount. Count 0 loops 256 times, as `dec c; jr nz`. */
export function* aiSwitchIfEnoughMons(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  let count = state.mem[D.wEnemyPartyCount];
  let living = 0;
  let hl: number = D.wEnemyMon1HP;
  do {
    if ((state.mem[hl] | state.mem[(hl + 1) & 0xffff]) !== 0) living++;
    hl = (hl + PARTYMON_STRUCT_LENGTH) & 0xffff;
    count = (count - 1) & 255;
  } while (count !== 0);
  if (living >= 2) return yield* switchEnemyMon(state, env);
  return { carry: false };
}

function below(state: BattleState, divisor: number): boolean {
  return aiCheckIfHPBelowFraction(state, divisor);
}

/** trainer_ai.asm:333–336. Class 13 and class 21. */
function* jugglerAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  return yield* aiSwitchIfEnoughMons(state, env);
}
/** trainer_ai.asm:338–341. */
function* blackbeltAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent13Minus1) return { carry: false };
  return yield* aiUseXAttack(state, env);
}
/** trainer_ai.asm:343–346. */
function* giovanniAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  return yield* aiUseGuardSpec(state, env);
}
/** trainer_ai.asm:348–351. */
function* cooltrainerMAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  return yield* aiUseXAttack(state, env);
}
/** trainer_ai.asm:353–364. The compare runs; `ret nc` is commented out. */
function* cooltrainerFAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) { /* ret nc omitted */ }
  if (below(state, 10)) return yield* aiUseHyperPotion(state, env);
  if (!below(state, 5)) return { carry: false };
  return yield* aiSwitchIfEnoughMons(state, env);
}
/** trainer_ai.asm:366–371. The roll is ignored. */
function* brockAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  void roll;
  if (state.wEnemyMonStatus === 0) return { carry: false };
  return yield* aiUseFullHeal(state, env);
}
/** trainer_ai.asm:373–376. */
function* mistyAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  return yield* aiUseXDefend(state, env);
}
/** trainer_ai.asm:378–381. */
function* ltSurgeAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  return yield* aiUseXSpeed(state, env);
}
/** trainer_ai.asm:383–389. */
function* erikaAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent50Plus1) return { carry: false };
  if (!below(state, 10)) return { carry: false };
  return yield* aiUseSuperPotion(state, env);
}
/** trainer_ai.asm:391–394. */
function* kogaAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent13Minus1) return { carry: false };
  return yield* aiUseXAttack(state, env);
}
/** trainer_ai.asm:396–402. */
function* blaineAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  if (!below(state, 10)) return { carry: false };
  return yield* aiUseSuperPotion(state, env);
}
/** trainer_ai.asm:404–407. Yellow: X Defend, same as Misty. */
function* sabrinaAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  return yield* aiUseXDefend(state, env);
}
/** trainer_ai.asm:409–415. */
function* rival2AI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent13Minus1) return { carry: false };
  if (!below(state, 5)) return { carry: false };
  return yield* aiUsePotion(state, env);
}
/** trainer_ai.asm:417–423. */
function* rival3AI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent13Minus1) return { carry: false };
  if (!below(state, 5)) return { carry: false };
  return yield* aiUseFullRestore(state, env);
}
/** trainer_ai.asm:425–431. */
function* loreleiAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent50Plus1) return { carry: false };
  if (!below(state, 5)) return { carry: false };
  return yield* aiUseSuperPotion(state, env);
}
/** trainer_ai.asm:433–436. */
function* brunoAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent25Plus1) return { carry: false };
  return yield* aiUseXDefend(state, env);
}
/** trainer_ai.asm:438–446. A failed switch does not fall through into the Super Potion. */
function* agathaAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll < AI_ROLL.percent8) return yield* aiSwitchIfEnoughMons(state, env);
  if (roll >= AI_ROLL.percent50Plus1) return { carry: false };
  if (!below(state, 4)) return { carry: false };
  return yield* aiUseSuperPotion(state, env);
}
/** trainer_ai.asm:448–454. */
function* lanceAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  if (roll >= AI_ROLL.percent50Plus1) return { carry: false };
  if (!below(state, 5)) return { carry: false };
  return yield* aiUseHyperPotion(state, env);
}
/** trainer_ai.asm:456–458. */
function* genericAI(state: BattleState, env: TrainerAIEnvironment, roll: number): Program<{ carry: boolean }> {
  void state; void env; void roll;
  return { carry: false };
}

const ROUTINES: Readonly<Record<string, AIRoutine>> = {
  GenericAI: genericAI, JugglerAI: jugglerAI, BlackbeltAI: blackbeltAI, GiovanniAI: giovanniAI,
  CooltrainerMAI: cooltrainerMAI, CooltrainerFAI: cooltrainerFAI, BrockAI: brockAI, MistyAI: mistyAI,
  LtSurgeAI: ltSurgeAI, ErikaAI: erikaAI, KogaAI: kogaAI, BlaineAI: blaineAI, SabrinaAI: sabrinaAI,
  Rival2AI: rival2AI, Rival3AI: rival3AI, LoreleiAI: loreleiAI, BrunoAI: brunoAI, AgathaAI: agathaAI,
  LanceAI: lanceAI,
};

/** trainer_ai.asm:290–329. Exactly one Random, after the gates and the count check. */
export function* trainerAI(state: BattleState, env: TrainerAIEnvironment): Program<{ carry: boolean }> {
  if (state.wIsInBattle === WILD_BATTLE) return { carry: false };
  if (state.wLinkState === LINK_STATE_BATTLING) return { carry: false };
  if ((state.wEnemyBattleStatus1 & LOCKED_STATUS1) !== 0) return { carry: false };
  if ((state.wEnemyBattleStatus2 & USING_RAGE) !== 0) return { carry: false };
  const row = TRAINER_AI_POINTERS[(state.mem[D.wTrainerClass] - 1) & 255];
  if (!row) throw new BattleUnsupportedState('trainer class');
  const count = state.mem[D.wAICount];
  if (count === 0) return { carry: false };
  if (count === 0xff) state.mem[D.wAICount] = row.count;
  const roll = random(state, 0);
  return yield* ROUTINES[row.routine](state, env, roll);
}

/** The function TurnPorts.trainerAI expects. The caller has already stored hWhoseTurn 1. */
export function trainerAIBuilder(env: TrainerAIEnvironment): (state: BattleState) => Program<{ carry: boolean }> {
  return state => trainerAI(state, env);
}
