// Unused A5c3e throw. pret e89ead15 engine/items/item_effects.asm:104-654,2566-2588.
import { battleContext, decodeNick, isGhostBattle, indexToPokedex, RESTLESS_SOUL, type BattleState } from './battle_state';
import { I } from './battle_item_state';
import { random } from './battle_random';
import { multiply, divide } from './battle_arithmetic';
import { loadEnemyMonData } from './battle_loaders';
import { flagAction } from './battle_end_helpers';
import { itemUseFailed, itemUseNotTime, registerBattleItemBody, removeUsedItem, type BattleItemHost } from './battle_items';
import { delayFrames, type Program } from './battle_menu_context';
import type { ExecutePresentation } from './battle_execute_helpers';
import type { BattleMenuScreen } from './battle_menu_screen';
import { bindEntryBattleScreen } from './battle_screen_binding';

export interface BallItemEnvironment extends Pick<ExecutePresentation, 'animation'> {
  video: BattleMenuScreen;
  addPartyMon(): Program;
  sendNewMonToBox(): Program;
  showPokedexData(): Program;
}
// ram/wram.asm and constants/{event,battle,move,pokemon}_constants.asm.
// Event checks address their own byte, rather than FlagAction's eight-bit C index.
export const BALL = { eventFlags: 0xd746, initialCatchTraining: 0x2f, metBill: 0x550,
  OLD_MAN: 1, SAFARI: 2, PIKACHU: 4, TOSS_ANIM: 0xc7, DITTO: 0x4c } as const;

/** item_effects.asm:196-435; home/math.asm:8-32. All math uses the actual HRAM union. */
export function calculateBallAnimation(state: BattleState): number {
  const item = state.mem[I.wCurItem], h = state.mem.subarray(I.hProduct, I.hProduct + 10);
  let rand1: number;
  do { rand1 = random(state, 0); }
  while (item !== 1 && item !== 4 && (rand1 > 200 || (item !== 3 && rand1 > 150)));
  if (item === 1) return 0x43; // Master still consumes Rand1.
  const status = state.wEnemyMonStatus;
  if (status) {
    rand1 -= (status & 0x27) ? 25 : 12;
    if (rand1 < 0) return 0x43;
  }
  h[1] = 0; h[2] = state.mem[I.wEnemyMonMaxHP]; h[3] = state.mem[I.wEnemyMonMaxHP + 1];
  h[4] = 255; multiply(h);
  h[4] = item === 3 ? 8 : 12; divide(h, 4);
  h[4] = ((state.wEnemyMonHP >>> 2) & 255) || 1; divide(h, 4);
  if (h[2]) h[3] = 255;
  if (state.wEnemyMonActualCatchRate >= rand1) {
    if (h[2]) return 0x43;
    if (h[3] >= random(state, 0)) return 0x43;
  }
  state.mem[I.wPokeBallCaptureCalcTemp] = h[3];
  h[1] = h[2] = 0; h[3] = state.wEnemyMonActualCatchRate; h[4] = 100; multiply(h);
  h[4] = item === 4 ? 255 : item === 3 ? 200 : 150; divide(h, 4);
  if (h[2]) return 0x63; // Unreachable for normal catch rates, retained from the cartridge.
  h[4] = state.mem[I.wPokeBallCaptureCalcTemp]; multiply(h);
  h[4] = 255; divide(h, 4);
  if (status) h[3] += (status & 0x27) ? 10 : 5;
  return h[3] < 10 ? 0x20 : h[3] < 30 ? 0x61 : h[3] < 70 ? 0x62 : 0x63;
}

/** item_effects.asm:104-608; core.asm:3480-3495,6174-6332. No live caller. */
export function* itemUseBall(state: BattleState, host: BattleItemHost, env: BallItemEnvironment): Program {
  if (!state.wIsInBattle) { yield* itemUseNotTime(state, host); return; }
  const { video } = env, screen = video.screen;
  bindEntryBattleScreen(state, screen);
  /** home/palettes.asm:45-51; battle default is SET_PAL_BATTLE. */
  function* palette(): Program {
    const ctx = battleContext(state);
    yield* screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
      playerBar: state.wPlayerHPBarColor as 0 | 1 | 2, enemyBar: state.wEnemyHPBarColor as 0 | 1 | 2 });
  }
  /** home/clear_sprites.asm:1-9, through the retained OAM owner. */
  function clearSprites(): void {
    for (let i = 0; i < 40; i++) screen.setOam(i, { x: 0, y: 0, tile: 0, attributes: 0 });
  }
  /** item_effects.asm:174-178,583-588, CheckEvent byte/bit checks. */
  function event(bit: number): boolean {
    return (state.mem[BALL.eventFlags + (bit >>> 3)] & (1 << (bit & 7))) !== 0;
  }
  if (state.wIsInBattle !== 1) {
    // ThrowBallAtTrainerMon, item_effects.asm:2569-2579: no wild zeroing or20-frame wait.
    yield* palette(); video.loadScreenTilesFromBuffer1(); yield* delayFrames(3);
    state.wAnimationID = BALL.TOSS_ANIM; yield* env.animation(state);
    yield* host.printText('ThrowBallAtTrainerMonText1');
    yield* host.printText('ThrowBallAtTrainerMonText2');
    removeUsedItem(state, host); return;
  }
  const demo = state.wBattleType === BALL.OLD_MAN || state.wBattleType === BALL.PIKACHU;
  if (!demo && state.mem[I.wPartyCount] === 6 && state.mem[I.wBoxCount] === 20) {
    yield* itemUseFailed(state, host, 'BoxFullCannotThrowBallText'); return;
  }
  state.wCapturedMonSpecies = 0;
  if (state.wBattleType === BALL.SAFARI) state.wNumSafariBalls--;
  yield* palette(); state.mem[I.wPokeBallAnimData] = 0x43;
  video.loadScreenTilesFromBuffer1();
  yield* host.printText('ItemUseText00', { stringBuffer: decodeNick(state.mem, I.wStringBuffer) });
  if (isGhostBattle(state)) state.mem[I.wPokeBallAnimData] = 0x10;
  else if (demo) {
    state.mem.set(state.mem.slice(I.wPlayerName, I.wPlayerName + 11), I.wGrassRate);
    if (state.wBattleType === BALL.OLD_MAN) {
      state.wCapturedMonSpecies = 1;
      if (event(BALL.initialCatchTraining)) state.mem[I.wPokeBallAnimData] = 0x63;
    }
  } else if (state.wCurMap === 0x93 && state.wEnemyMonSpecies2 === RESTLESS_SOUL) {
    state.mem[I.wPokeBallAnimData] = 0x10;
  } else state.mem[I.wPokeBallAnimData] = calculateBallAnimation(state);
  yield* delayFrames(20);
  state.wAnimationID = BALL.TOSS_ANIM;
  state.hWhoseTurn = state.wAnimationType = state.wDamageMultipliers = 0;
  const slot = state.wWhichPokemon, item = state.mem[I.wCurItem];
  yield* env.animation(state);
  state.mem[I.wCurItem] = item; state.wWhichPokemon = slot;
  const miss: Record<number, string> = { 0x10: '00', 0x20: '01', 0x61: '02', 0x62: '03', 0x63: '04' };
  const failed = miss[state.mem[I.wPokeBallAnimData]];
  if (failed) { yield* host.printText(`ItemUseBallText${failed}`); clearSprites(); }
  else {
    const hp = state.wEnemyMonHP, status = state.wEnemyMonStatus;
    if (state.wEnemyBattleStatus3 & 8) state.wEnemyMonSpecies2 = BALL.DITTO;
    else {
      state.wEnemyBattleStatus3 |= 8;
      state.mem.set(state.mem.slice(I.wEnemyMonDVs, I.wEnemyMonDVs + 2), I.wTransformedEnemyMonOriginalDVs);
    }
    const species = state.wCurPartySpecies;
    state.wCurPartySpecies = state.wEnemyMonSpecies2; state.wCurEnemyLevel = state.wEnemyMonLevel;
    loadEnemyMonData(state); state.wCurPartySpecies = species;
    state.wEnemyMonHP = hp; state.wEnemyMonStatus = status;
    state.wCapturedMonSpecies = state.wCurPartySpecies = state.wPokedexNum = state.wEnemyMonSpecies;
    yield* host.printText('ItemUseBallText05', { enemyMonNick: decodeNick(state.mem, I.wEnemyMonNick) });
    if (demo) clearSprites();
    else {
      indexToPokedex(state);
      const bit = (state.wPokedexNum - 1) & 255;
      const owned = flagAction(state, I.wPokedexOwned, 2, bit);
      flagAction(state, I.wPokedexOwned, 1, bit);
      if (!owned) {
        yield* host.printText('ItemUseBallText06', { enemyMonNick: decodeNick(state.mem, I.wEnemyMonNick) }); clearSprites();
        state.wPokedexNum = state.wEnemyMonSpecies; yield* env.showPokedexData();
      }
      state.mem[I.wPikachuEmotionModifier] = 1; state.mem[I.wPikachuMood] = 0x85;
      if (state.mem[I.wPartyCount] !== 6) {
        state.wMonDataLocation = 0; clearSprites();
        yield* host.printText('ItemUseBall.emptyString'); yield* env.addPartyMon();
      } else {
        clearSprites(); yield* env.sendNewMonToBox();
        yield* host.printText(event(BALL.metBill) ? 'ItemUseBallText07' : 'ItemUseBallText08',
          { caughtMonNick: decodeNick(state.mem, I.wBoxMonNicks) });
      }
    }
  }
  if (state.wBattleType !== 0) return;
  removeUsedItem(state, host);
}

/** item_effects.asm:18-25,104. Explicit unused registration; storage ports arrive in07b. */
export function registerBallBattleItemBody(env: BallItemEnvironment): () => void {
  return registerBattleItemBody('ItemUseBall', (state, host) => itemUseBall(state, host, env));
}
