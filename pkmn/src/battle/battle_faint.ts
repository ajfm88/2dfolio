// Unused checkpoint-07 ports. pret e89ead15 engine/battle/core.asm:263–279,708–1083,1171–1204.
import { battleContext, decodeNick, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { anyPartyAlive, anyEnemyPokemonAliveCheck, flagAction } from './battle_end_helpers';
import { readPlayerMonCurHPAndStatus } from './battle_loaders';
import { drawPlayerHud } from './battle_hud_state';
import { slideDownFaintedMonPic, scrollTrainerPicAfterBattle } from './battle_slides';
import { chooseNextMon, doUseNextMonDialogue } from './battle_send_out';
import { replaceFaintedEnemyMon, type EnemySendOutHost } from './battle_enemy_send_out';
import { gainExperience, type ExperienceHost } from './battle_experience';
import { isThisPartyMonStarterPikachu, modifyPikachuHappiness } from './battle_pikachu';
import { playCryCue, playPikachuClipCue } from './battle_voice_cues';
import { BattleUnsupportedState } from './battle_move_data';
import { delayFrames, type Program } from './battle_menu_context';
import { endLowHealthAlarm, faintedPlayerLowHealthAlarm, lowHealthAlarm } from '../audio/low_health_alarm';
import type { BattleSfx } from './battle_audio';
import { AFTER_PIC_SCROLL_DELAY, victoryMusicFor } from './trainer_flow';
import { addBcd } from '../menus/screen_tiles';

export interface FaintHost extends EnemySendOutHost, ExperienceHost {
  faintFall: BattleSfx;
  faintThud: BattleSfx;
  runSound: BattleSfx;
  /** The existing PlaySound/music owner: StopAllMusic clears IDs and stops hardware. */
  stopAllMusic(): void;
  playVictoryMusic(name: string, bank: 8): void;
  trainerPicture(state: BattleState): string;
  /** Existing map hand-off owns its flag, retained trainer-name prefix, selected text and sound wait.
   * Prefix extraction remains the approved A5c3f/data carry (note70 §9.1 item9). */
  printEndBattleText(state: BattleState): Program;
  /** Approved deferred AnimationSlideEnemyMonOff body; caller's whoseTurn is0. */
  enemySlideOff(state: BattleState): void;
}
export type FaintExit = 'loop' | 'end' | 'blackout';

function clear(host: FaintHost, x: number, y: number, height: number, width: number): void {
  // ClearScreenArea uses linear wTileMap addresses: Rival1's width21 includes (0,8).
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const at = (y + row) * 20 + x + col; host.screen.put(at % 20, Math.floor(at / 20), ' ');
  }
}
export function readBattleBcd(state: BattleState, at: number): number {
  let value = 0;
  for (let i = 0; i < 3; i++) value = value * 100 + (state.mem[at + i] >>> 4) * 10 + (state.mem[at + i] & 15);
  return value;
}
function writeBcd(state: BattleState, at: number, value: number): void {
  for (let i = 2; i >= 0; i--) {
    const pair = value % 100; state.mem[at + i] = (Math.floor(pair / 10) << 4) | pair % 10; value = Math.floor(value / 100);
  }
}
// Reuse the packed-money codec in unused EndOfBattle; the existing victory body is unchanged.
export { writeBcd as writeBattleBcd };
export function* playBattleVictoryMusic(host: FaintHost, name: string): Program {
  host.stopAllMusic(); host.playVictoryMusic(name, 8); yield* delayFrames(3);
}
function* trainerScroll(state: BattleState, host: FaintHost): Program {
  const ctx = battleContext(state);
  yield* scrollTrainerPicAfterBattle(state, host.screen, host.trainerPicture(state), {
    partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
    playerBar: state.wPlayerHPBarColor as 0 | 1 | 2, enemyBar: state.wEnemyHPBarColor as 0 | 1 | 2,
  });
}
/** Rehost V1c's victory order on real Programs/committed texts, retaining its music rule and delay. */
export function* trainerBattleVictory(state: BattleState, host: FaintHost): Program {
  endLowHealthAlarm();
  const champion = state.mem[D.wTrainerClass] === 0x2b;
  if (champion) state.mem[D.wStatusFlags7] |= 2;
  if (state.wLinkState === LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  yield* playBattleVictoryMusic(host, victoryMusicFor(champion ? 'RIVAL3' : '', state.mem[D.wGymLeaderNo] !== 0));
  yield* host.printText('TrainerDefeatedText', { trainerName: decodeNick(state.mem, D.wTrainerName) });
  yield* trainerScroll(state, host); yield* delayFrames(AFTER_PIC_SCROLL_DELAY);
  yield* host.printEndBattleText(state);
  yield* host.printText('MoneyForWinningText', { amountMoneyWon: readBattleBcd(state, D.wAmountMoneyWon) });
  writeBcd(state, D.wPlayerMoney, addBcd(readBattleBcd(state, D.wPlayerMoney), readBattleBcd(state, D.wAmountMoneyWon)));
}
export function* handlePlayerBlackOut(state: BattleState, host: FaintHost): Program<{ carry: boolean }> {
  if (state.wLinkState === LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  if (state.wCurOpponent === 0xe1) {
    clear(host, 0, 0, 8, 21); yield* trainerScroll(state, host); yield* delayFrames(AFTER_PIC_SCROLL_DELAY);
    yield* host.printText('Rival1WinText');
    if (state.wCurMap === 0x28) return { carry: false };
  }
  yield* host.screen.setPalBattleBlack(); yield* host.printText('PlayerBlackedOutText2');
  state.mem[D.wStatusFlags6] &= ~0x20; clear(host, 0, 0, 18, 20);
  yield* delayFrames(3); return { carry: true };
}
export function* enemyRan(state: BattleState, host: FaintHost): Program {
  host.loadScreenTilesFromBuffer1();
  if (state.wLinkState === LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  yield* host.printText('WildRanText', { enemyMonNick: decodeNick(state.mem, D.wEnemyMonNick) });
  yield* host.waitForSound(); host.audio.play(host.runSound);
  state.hWhoseTurn = 0; host.enemySlideOff(state); // No post-RUN wait in this root.
}

export function* removeFaintedPlayerMon(state: BattleState, host: FaintHost): Program {
  flagAction(state, D.wPartyGainExpFlags, 0, state.wPlayerMonNumber); state.wEnemyBattleStatus1 &= ~4;
  let value = lowHealthAlarm();
  if (faintedPlayerLowHealthAlarm()) { yield* host.waitForSound(); value = 0; }
  state.mem[D.wEnemyBideAccumulatedDamage] = state.mem[D.wEnemyBideAccumulatedDamage + 1] = state.wBattleMonStatus = value;
  readPlayerMonCurHPAndStatus(state); clear(host, 9, 7, 5, 11);
  yield* slideDownFaintedMonPic(state, host.screen, 1, 10); state.wBattleResult = 1;
  if (state.mem[D.wInHandlePlayerMonFainted] === 0) return;
  state.wWhichPokemon = state.wPlayerMonNumber;
  if (isThisPartyMonStarterPikachu(state)) yield* playPikachuClipCue({ ...host.voice, clearSfxIds: () => host.audio.clearClipIds() }, 4);
  else playCryCue(host.voice, state.wBattleMonSpecies);
  yield* host.printText('PlayerMonFaintedText', { battleMonNick: decodeNick(state.mem, D.wBattleMonNick) });
  state.wWhichPokemon = state.wPlayerMonNumber;
  const difference = state.wEnemyMonLevel - state.wBattleMonLevel;
  modifyPikachuHappiness(state, difference >= 30 ? 10 : 8);
}
export function* faintEnemyPokemon(state: BattleState, host: FaintHost): Program {
  readPlayerMonCurHPAndStatus(state);
  if (state.wIsInBattle !== 1) state.writeBE(D.wEnemyMons + 44 * state.wEnemyMonPartyPos + 1, 0);
  state.wPlayerBattleStatus1 &= ~4;
  state.mem[D.wPlayerBideAccumulatedDamage] = 0; // Source bug: leave the low byte stale.
  state.mem.fill(0, D.wEnemyStatsToDouble, D.wEnemyStatsToDouble + 5);
  state.wEnemyDisabledMove = state.wEnemyDisabledMoveNumber = state.wEnemyMonMinimized = 0;
  state.mem[D.wPlayerUsedMove] = state.mem[D.wPlayerUsedMove + 1] = 0;
  yield* slideDownFaintedMonPic(state, host.screen, 12, 5); clear(host, 0, 0, 4, 11);
  if (state.wIsInBattle === 1) {
    endLowHealthAlarm(); yield* playBattleVictoryMusic(host, 'defeatedwildmon');
  } else {
    host.audio.frequencyModifier = host.audio.tempoModifier = 0;
    yield* host.waitForSound(); host.audio.play(host.faintFall);
    while (host.audio.channelId(5) === host.faintFall.id) yield 'serviced';
    host.audio.play(host.faintThud); yield* host.waitForSound();
  }
  if (state.wBattleMonHP === 0 && state.mem[D.wInHandlePlayerMonFainted] === 0) yield* removeFaintedPlayerMon(state, host);
  if (anyPartyAlive(state).zero) return;
  yield* host.printText('EnemyMonFaintedText', { enemyMonNick: decodeNick(state.mem, D.wEnemyMonNick) });
  yield* host.printText('PrintEmptyString.emptyString'); host.saveScreenTilesToBuffer1(); state.wBattleResult = 0;
  const expAll = state.quantityInBag(0x4b) !== 0; // Preserve this result across the first EXP pass.
  if (expAll) for (let i = 0; i < 7; i++) state.mem[D.wEnemyMonBaseStats + i] >>>= 1;
  state.wBoostExpByExpAll = 0; yield* gainExperience(state, host);
  if (!expAll) return;
  state.wBoostExpByExpAll = 1;
  let bits = 0; for (let i = 0, count = state.mem[D.wPartyCount] || 256; i < count; i++) bits = ((bits << 1) | 1) & 255;
  state.mem[D.wPartyGainExpFlags] = bits; yield* gainExperience(state, host);
}
function* blackOutExit(state: BattleState, host: FaintHost): Program<FaintExit> {
  return (yield* handlePlayerBlackOut(state, host)).carry ? 'blackout' : 'end';
}
function* replaceEnemy(state: BattleState, host: FaintHost): Program<FaintExit> {
  state.wActionResultOrTookBattleTurn = 1;
  if ((yield* replaceFaintedEnemyMon(state, host)).zero) { yield* enemyRan(state, host); return 'end'; }
  state.wActionResultOrTookBattleTurn = 0; return 'loop';
}
export function* handleEnemyMonFainted(state: BattleState, host: FaintHost): Program<FaintExit> {
  state.mem[D.wInHandlePlayerMonFainted] = 0; yield* faintEnemyPokemon(state, host);
  if (anyPartyAlive(state).zero) return yield* blackOutExit(state, host);
  if (state.wBattleMonHP !== 0) yield* drawPlayerHud(state, host.screen);
  if (state.wIsInBattle === 1) return 'end';
  if (anyEnemyPokemonAliveCheck(state).zero) { yield* trainerBattleVictory(state, host); return 'end'; }
  if (state.wBattleMonHP === 0) {
    if ((yield* doUseNextMonDialogue(state, host)).carry) return 'end';
    yield* chooseNextMon(state, host);
  }
  return yield* replaceEnemy(state, host);
}
export function* handlePlayerMonFainted(state: BattleState, host: FaintHost): Program<FaintExit> {
  state.mem[D.wInHandlePlayerMonFainted] = 1; yield* removeFaintedPlayerMon(state, host);
  if (anyPartyAlive(state).zero) return yield* blackOutExit(state, host);
  if (state.wEnemyMonHP === 0) {
    yield* faintEnemyPokemon(state, host);
    if (state.wIsInBattle === 1) return 'end';
    if (anyEnemyPokemonAliveCheck(state).zero) { yield* trainerBattleVictory(state, host); return 'end'; }
  }
  if ((yield* doUseNextMonDialogue(state, host)).carry) return 'end';
  if (!(yield* chooseNextMon(state, host)).zero) return 'loop';
  return yield* replaceEnemy(state, host);
}
