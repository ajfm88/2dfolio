// Unused WRAM-to-A5c2 HUD composition. core.asm:1886–2049, palettes.asm:28–41,297–313.
import { A, battleContext, decodeNick, type BattleState } from './battle_state';
import { drawEnemyHudProgram, drawPlayerHudProgram, drawHudsAndHpBars, type HudContext } from './battle_menu';
import type { BattleHudMon } from './battle_hud';
import type { BattleScreen } from './battle_screen';
import type { Program } from './battle_menu_context';

/** Fresh raw-mon views each draw; bar colour writes land in the stored WRAM byte. */
export function hudContext(state: BattleState): HudContext {
  const mon = (enemy: boolean): BattleHudMon => ({
    nickname: decodeNick(state.mem, enemy ? A.wEnemyMonNick : A.wBattleMonNick),
    level: enemy ? state.wEnemyMonLevel : state.wBattleMonLevel,
    status: enemy ? state.wEnemyMonStatus : state.wBattleMonStatus,
    hp: enemy ? state.wEnemyMonHP : state.wBattleMonHP,
    maxHp: enemy ? state.wEnemyMonMaxHP : state.wBattleMonMaxHP,
    get barColor() { return enemy ? state.wEnemyHPBarColor : state.wPlayerHPBarColor; },
    set barColor(value: number) { if (enemy) state.wEnemyHPBarColor = value; else state.wPlayerHPBarColor = value; },
  });
  const ctx = battleContext(state);
  // Preserve the live colour accessor; spreading the base record would sever its setter.
  // drawPlayerHudProgram overwrites alarm from the audio module. These cells stay unread.
  ctx.playerHud = Object.assign(mon(false), { alarm: 0, alarmDisabled: false });
  ctx.enemyHud = mon(true);
  return ctx;
}

export function* drawPlayerHud(state: BattleState, screen: BattleScreen): Program {
  yield* drawPlayerHudProgram(hudContext(state), { screen });
}
export function* drawEnemyHud(state: BattleState, screen: BattleScreen): Program {
  yield* drawEnemyHudProgram(hudContext(state), { screen });
}
export function* drawHuds(state: BattleState, screen: BattleScreen): Program {
  yield* drawHudsAndHpBars(hudContext(state), { screen });
}
