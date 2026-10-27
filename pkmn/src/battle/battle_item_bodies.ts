// Unused A5c3e short item bodies. pret e89ead15 engine/items/item_effects.asm.
import type { BattleState } from './battle_state';
import { I } from './battle_item_state';
import { itemUseNotTime, printItemUseTextAndRemoveItem, registerBattleItemBody,
  type BattleItemBody, type BattleItemHost, type BattleItemLabel } from './battle_items';
import { statModifierUpEffect, type StatEffectEnvironment } from './battle_effects_stats';
import { modifyPikachuHappiness } from './battle_pikachu';
import { delayFrames, type Program } from './battle_menu_context';
import { random } from './battle_random';

export interface ShortItemEnvironment extends Pick<StatEffectEnvironment, 'animation' | 'hideSubstitute' | 'reshowSubstitute'> {
  loadScreenTilesFromBuffer1(): void;
}
// constants/{move_constants,pikachu_emotion_constants,move_effect_constants}.asm.
export const SHORT_ITEM_CONSTANTS = { XSTATITEM_ANIM: 0xae, ROCK_ANIM: 0xc9, BAIT_ANIM: 0xca,
  PIKAHAPPY_USEDITEM: 2, USEDXITEM: 3, ATTACK_UP1_EFFECT: 0x0a, X_ATTACK: 0x41 } as const;

/** item_effects.asm:1768-1775,1793-1800,1831-1838. Save/restore the bag's absolute slot. */
function activeHappiness(state: BattleState): void {
  const slot = state.wWhichPokemon;
  state.wWhichPokemon = state.wPlayerMonNumber;
  modifyPikachuHappiness(state, SHORT_ITEM_CONSTANTS.USEDXITEM);
  state.wWhichPokemon = slot;
}

/** item_effects.asm:1688-1696. X Accuracy intentionally uses the bag index for the starter gate. */
export function* itemUseXAccuracy(state: BattleState, host: BattleItemHost): Program {
  if (!state.wIsInBattle) { yield* itemUseNotTime(state, host); return; }
  state.wPlayerBattleStatus2 |= 1;
  modifyPikachuHappiness(state, SHORT_ITEM_CONSTANTS.USEDXITEM);
  yield* printItemUseTextAndRemoveItem(state, host);
}

/** item_effects.asm:1763-1781. Repeated Guard Spec is still consumed. */
export function* itemUseGuardSpec(state: BattleState, host: BattleItemHost): Program {
  if (!state.wIsInBattle) { yield* itemUseNotTime(state, host); return; }
  activeHappiness(state);
  state.wPlayerBattleStatus2 |= 2;
  yield* printItemUseTextAndRemoveItem(state, host);
}

/** item_effects.asm:1788-1803. The downstream crit owner preserves Focus Energy's bug. */
export function* itemUseDireHit(state: BattleState, host: BattleItemHost): Program {
  if (!state.wIsInBattle) { yield* itemUseNotTime(state, host); return; }
  activeHappiness(state);
  state.wPlayerBattleStatus2 |= 4;
  yield* printItemUseTextAndRemoveItem(state, host);
}

/** item_effects.asm:1805-1846. Spend/print first, even at +6 or999; reuse the whole stat owner. */
export function* itemUseXStat(state: BattleState, host: BattleItemHost, env: ShortItemEnvironment): Program {
  if (!state.wIsInBattle) {
    yield* itemUseNotTime(state, host); state.wActionResultOrTookBattleTurn = 2; return;
  }
  const num = state.wPlayerMoveNum, effect = state.wPlayerMoveEffect;
  state.wPlayerMoveEffect = state.mem[I.wCurItem] - (SHORT_ITEM_CONSTANTS.X_ATTACK - SHORT_ITEM_CONSTANTS.ATTACK_UP1_EFFECT);
  yield* printItemUseTextAndRemoveItem(state, host);
  state.wPlayerMoveNum = SHORT_ITEM_CONSTANTS.XSTATITEM_ANIM;
  env.loadScreenTilesFromBuffer1();
  yield* delayFrames(3);
  state.hWhoseTurn = 0;
  yield* statModifierUpEffect(state, { ...env, host });
  activeHappiness(state);
  state.wPlayerMoveEffect = effect; state.wPlayerMoveNum = num;
}

/** item_effects.asm:1755-1761. No ghost/Marowak/Scope check. */
export function* itemUsePokeDoll(state: BattleState, host: BattleItemHost): Program {
  if (state.wIsInBattle !== 1) { yield* itemUseNotTime(state, host); return; }
  state.wEscapedFromBattle = 1;
  yield* printItemUseTextAndRemoveItem(state, host);
}

/** item_effects.asm:1598-1619. CPU-only random loop, then named animation and exactly70 frames. */
function* baitRockCommon(state: BattleState, env: ShortItemEnvironment, bait: boolean): Program {
  state.wAnimationID = bait ? SHORT_ITEM_CONSTANTS.BAIT_ANIM : SHORT_ITEM_CONSTANTS.ROCK_ANIM;
  state.wAnimationType = 0; state.hWhoseTurn = 0;
  const chosen = bait ? I.wSafariBaitFactor : I.wSafariEscapeFactor;
  state.mem[bait ? I.wSafariEscapeFactor : I.wSafariBaitFactor] = 0;
  let draw: number;
  // XOR and every rejected CP5 leave carry0 at Random entry (no BattleRandom CP/link path).
  do { draw = random(state, 0) & 7; } while (draw >= 5);
  state.mem[chosen] = Math.min(255, state.mem[chosen] + draw + 1);
  yield* env.animation(state);
  yield* delayFrames(70);
}

/** item_effects.asm:1571-1581. No battle guard; BOULDERBADGE is the Safari dummy item. */
export function* itemUseBait(state: BattleState, host: BattleItemHost, env: ShortItemEnvironment): Program {
  yield* host.printText('ThrewBaitText');
  state.wEnemyMonActualCatchRate >>= 1;
  yield* baitRockCommon(state, env, true);
}

/** item_effects.asm:1584-1596. Saturate the catch-rate double independently of the factor. */
export function* itemUseRock(state: BattleState, host: BattleItemHost, env: ShortItemEnvironment): Program {
  yield* host.printText('ThrewRockText');
  state.wEnemyMonActualCatchRate = Math.min(255, state.wEnemyMonActualCatchRate * 2);
  yield* baitRockCommon(state, env, false);
}

/** Explicit unused composition; no top-level registrations or flute/medicine/PP/ball body. */
export function registerShortBattleItemBodies(env: ShortItemEnvironment): () => void {
  const bodies: [BattleItemLabel, BattleItemBody][] = [
    ['ItemUseXAccuracy', itemUseXAccuracy], ['ItemUseGuardSpec', itemUseGuardSpec], ['ItemUseDireHit', itemUseDireHit],
    ['ItemUseXStat', (state, host) => itemUseXStat(state, host, env)], ['ItemUsePokeDoll', itemUsePokeDoll],
    ['ItemUseBait', (state, host) => itemUseBait(state, host, env)], ['ItemUseRock', (state, host) => itemUseRock(state, host, env)],
  ];
  const dispose: (() => void)[] = [];
  try { for (const [label, body] of bodies) dispose.push(registerBattleItemBody(label, body)); }
  catch (error) { dispose.reverse().forEach(remove => remove()); throw error; }
  return () => dispose.forEach(remove => remove());
}
