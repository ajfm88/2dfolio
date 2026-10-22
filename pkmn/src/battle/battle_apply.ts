// Unused application / Substitute / texts. pret e89ead15 core.asm:3889–3997,4783–5082.
import { A, type BattleState } from './battle_state';
import { battleRandom } from './battle_random';
import { readHpBarWord, writeHpBarWord, updateHPBar2 } from './battle_hp';
import { drawHuds } from './battle_hud_state';
import type { BattleScreen } from './battle_screen';
import { delayFrames, type Program } from './battle_menu_context';
import type { BattleTurnTextHost } from './battle_turn_text';
import { BattleUnsupportedState } from './battle_move_data';

export interface ApplyPorts {
  substituteBreak(state: BattleState): Program;
  shake(state: BattleState, b: number): Program;
}

export function* attackSubstitute(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts,
): Program {
  yield* host.printText('SubstituteTookDamageText');
  const player = state.hWhoseTurn === 0;
  const hp = player ? A.wEnemySubstituteHP : A.wPlayerSubstituteHP;
  const status = player ? A.wEnemyBattleStatus2 : A.wPlayerBattleStatus2;
  if ((state.wDamage & 0xff00) === 0) {
    const next = state.mem[hp] - (state.wDamage & 0xff);
    state.mem[hp] = next;
    if (next >= 0) return; // Exact zero stays up, with no HUD redraw.
  }
  state.mem[status] &= ~0x10;
  yield* host.printText('SubstituteBrokeText');
  state.hWhoseTurn ^= 1;
  yield* ports.substituteBreak(state); // Func_79929, with the target as actor.
  state.hWhoseTurn ^= 1;
  if (state.hWhoseTurn === 0) state.wPlayerMoveEffect = 0;
  else state.wEnemyMoveEffect = 0;
  yield* drawHuds(state, screen);
}

function* applyDamage(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts, enemy: boolean,
): Program {
  if (state.wDamage !== 0) {
    const status = enemy ? state.wEnemyBattleStatus2 : state.wPlayerBattleStatus2;
    if ((status & 0x10) !== 0) { yield* attackSubstitute(state, screen, host, ports); return; }
    const hp = enemy ? A.wEnemyMonHP : A.wBattleMonHP;
    const old = state.readBE(hp);
    const damage = state.wDamage;
    // Preserve the ASM's byte write order, including the player's intermediate LE new-HP word.
    state.mem[A.wHPBarOldHP] = state.mem[hp + 1];
    const low = state.mem[hp + 1] - (damage & 0xff);
    state.mem[hp + 1] = low;
    if (!enemy) state.mem[A.wHPBarNewHP] = low;
    state.mem[A.wHPBarOldHP + 1] = state.mem[hp];
    const high = state.mem[hp] - (damage >> 8) - (low < 0 ? 1 : 0);
    state.mem[hp] = high;
    if (!enemy) state.mem[A.wHPBarNewHP + 1] = high;
    if (high < 0) {
      state.wDamage = old;
      state.writeBE(hp, 0);
      if (!enemy) writeHpBarWord(state, A.wHPBarNewHP, 0);
    }
    const max = state.readBE(enemy ? A.wEnemyMonMaxHP : A.wBattleMonMaxHP);
    writeHpBarWord(state, A.wHPBarMaxHP, max);
    if (enemy) writeHpBarWord(state, A.wHPBarNewHP, state.readBE(hp));
    state.wHPBarType = enemy ? 0 : 1;
    yield* updateHPBar2(state, screen, enemy ? 2 : 10, enemy ? 2 : 9, enemy ? 0 : 1,
      readHpBarWord(state, A.wHPBarOldHP), readHpBarWord(state, A.wHPBarNewHP), max);
  }
  yield* drawHuds(state, screen);
}

export function* applyDamageToEnemyPokemon(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts,
): Program { yield* applyDamage(state, screen, host, ports, true); }

export function* applyDamageToPlayerPokemon(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts,
): Program { yield* applyDamage(state, screen, host, ports, false); }

function* applyAttack(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts, enemy: boolean,
): Program {
  const effect = enemy ? state.wPlayerMoveEffect : state.wEnemyMoveEffect;
  if (effect === 0x28) {
    const hp = enemy ? state.wEnemyMonHP : state.wBattleMonHP;
    state.wDamage = Math.max(1, hp >> 1);
  } else if (effect === 0x29) {
    const level = enemy ? state.wBattleMonLevel : state.wEnemyMonLevel;
    const move = enemy ? state.wPlayerMoveNum : state.wEnemyMoveNum;
    let damage: number;
    if (move === 69 || move === 101) damage = level;
    else if (move === 49) damage = 20;
    else if (move === 82) damage = 40;
    else {
      const b = (level + (level >> 1)) & 0xff;
      if (enemy ? b <= 1 : b === 0) { for (;;) yield 'serviced'; }
      for (;;) {
        damage = battleRandom(state);
        if (enemy && damage === 0) continue;
        if (damage >= b) continue;
        break;
      }
    }
    state.wDamage = damage;
  } else if (effect !== 0x26 && (enemy ? state.wPlayerMovePower : state.wEnemyMovePower) === 0) {
    yield* drawHuds(state, screen);
    return;
  }
  yield* applyDamage(state, screen, host, ports, enemy);
}

export function* applyAttackToEnemyPokemon(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts,
): Program { yield* applyAttack(state, screen, host, ports, true); }

export function* applyAttackToPlayerPokemon(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts,
): Program { yield* applyAttack(state, screen, host, ports, false); }

export function* printMoveFailureText(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ApplyPorts,
): Program {
  const effectAddress = state.hWhoseTurn === 0 ? A.wPlayerMoveEffect : A.wEnemyMoveEffect;
  yield* host.printText((state.wDamageMultipliers & 0x7f) === 0 ? 'DoesntAffectMonText'
    : state.wCriticalHitOrOHKO === 0xff ? 'UnaffectedText' : 'AttackMissedText');
  state.wCriticalHitOrOHKO = 0;
  if (state.mem[effectAddress] !== 0x2d) return;
  state.wDamage = Math.max(1, state.wDamage >> 3);
  yield* host.printText('KeptGoingAndCrashedText');
  yield* ports.shake(state, 4);
  if (state.hWhoseTurn === 0) yield* applyDamageToPlayerPokemon(state, screen, host, ports);
  else yield* applyDamageToEnemyPokemon(state, screen, host, ports);
}

export function* printDoesntAffectText(host: BattleTurnTextHost): Program {
  yield* host.printText('DoesntAffectMonText');
}

export function* printCriticalOHKOText(state: BattleState, host: BattleTurnTextHost): Program {
  const critical = state.wCriticalHitOrOHKO;
  if (critical !== 0) {
    if (critical !== 1 && critical !== 2) throw new BattleUnsupportedState(`critical text pointer ${critical}`);
    yield* host.printText(critical === 1 ? 'CriticalHitText' : 'OHKOText');
    state.wCriticalHitOrOHKO = 0;
  }
  yield* delayFrames(20);
}

/** display_effectiveness.asm:1–18: last matching row, not the combined type multiplier. */
export function* displayEffectiveness(state: BattleState, host: BattleTurnTextHost): Program {
  const multiplier = state.wDamageMultipliers & 0x7f;
  if (multiplier === 0x0a) return;
  yield* host.printText(multiplier < 0x0a ? 'NotVeryEffectiveText' : 'SuperEffectiveText');
}
