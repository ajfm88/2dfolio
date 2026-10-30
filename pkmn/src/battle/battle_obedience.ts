import { decodeBattleText } from './battle_text_codec';
// Unused CheckForDisobedience. pret e89ead15 core.asm:4001–4179; note68 §11.15 answer3.
import { A, LINK_STATE_BATTLING, PARTYMON_STRUCT_LENGTH, STRUGGLE, type BattleState } from './battle_state';
import { BattleUnsupportedState, getCurrentMove } from './battle_move_data';
import { handleSelfConfusionDamage, type StatusPorts } from './battle_turn_status';
import type { BattleTurnTextHost } from './battle_turn_text';
import type { Program } from './battle_menu_context';

export type ObedienceResult = 'canUseMove' | 'cannotUseMove';
const swap = (byte: number): number => ((byte << 4) | (byte >> 4)) & 255;

/** Each retry loop allows 256 actual draws, including a successful 256th; never take a 257th. */
function retry(choose: () => number | undefined): number {
  for (let draws = 0; draws < 256; draws++) {
    const value = choose();
    if (value !== undefined) return value;
  }
  throw new BattleUnsupportedState('obedience retry exceeded 256 draws');
}

function* ignore(state: BattleState, host: BattleTurnTextHost): Program<ObedienceResult> {
  const texts = ['LoafingAroundText', 'WontObeyText', 'TurnedAwayText', 'IgnoredOrdersText'];
  yield* obedienceText(state, host, texts[state.random() & 3]);
  return 'cannotUseMove';
}

/** Disobedience roots use text_ram wBattleMonNick, not the <USER> control. */
function* obedienceText(state: BattleState, host: BattleTurnTextHost, label: string): Program {
  yield* host.printText(label, { get battleMonNick() { return decodeBattleText(state.mem, A.wBattleMonNick); } });
}

export function* checkForDisobedience(
  state: BattleState, host: BattleTurnTextHost, ports: StatusPorts,
): Program<ObedienceResult> {
  state.wMonIsDisobedient = 0;
  if (state.wLinkState === LINK_STATE_BATTLING) return 'canUseMove';
  const ot = A.wPartyMon1OTID + state.wPlayerMonNumber * PARTYMON_STRUCT_LENGTH;
  if (state.readBE(ot) === state.readBE(A.wPlayerID)) return 'canUseMove';
  const badges = state.wObtainedBadges;
  const cap = badges & 0x80 ? 101 : badges & 0x20 ? 70 : badges & 8 ? 50 : badges & 2 ? 30 : 10;
  const level = state.wBattleMonLevel, bound = Math.min(255, level + cap);
  if (level <= cap) return 'canUseMove';
  const first = retry(() => { const r = swap(state.random()); return r < bound ? r : undefined; });
  if (first < cap) return 'canUseMove';
  const second = retry(() => { const r = state.random(); return r < bound ? r : undefined; });
  if (second >= cap) {
    const diff = level - cap, roll = swap(state.random());
    if (roll < diff) {
      const sleep = retry(() => { const n = swap((state.random() * 2) & 255) & 7; return n !== 0 ? n : undefined; });
      state.wBattleMonStatus = sleep; yield* obedienceText(state, host, 'BeganToNapText'); return 'cannotUseMove';
    }
    if (((roll - diff) & 255) >= diff) return yield* ignore(state, host);
    yield* obedienceText(state, host, 'WontObeyText');
    yield* handleSelfConfusionDamage(state, host, ports, 0);
    return 'cannotUseMove';
  }
  // Alternate move eligibility, before any alternate-slot RNG (core.asm:4104–4142).
  if (state.mem[A.wBattleMonMoves + 1] === 0) return yield* ignore(state, host);
  if (state.wPlayerDisabledMoveNumber !== 0) return yield* ignore(state, host);
  if (state.wPlayerSelectedMove === STRUGGLE) return yield* ignore(state, host);
  let pp = 0;
  for (let i = 0; i < 4; i++) pp = (pp + (state.mem[A.wBattleMonPP + i] & 63)) & 255;
  if (pp === (state.mem[A.wBattleMonPP + state.wCurrentMenuItem] & 63)) return yield* ignore(state, host);
  state.wMonIsDisobedient = 1;
  const max = state.wMaxMenuItem, original = state.wCurrentMenuItem;
  const slot = retry(() => {
    const i = state.random() & 3;
    if (i >= max || i === original) return undefined;
    state.wCurrentMenuItem = i; // Also written on the empty-PP retry; original C stays unchanged.
    if (state.mem[A.wBattleMonPP + i] === 0) return undefined; // Deliberately unmasked PP-Up-only byte.
    return i;
  });
  state.wPlayerSelectedMove = state.mem[A.wBattleMonMoves + slot];
  getCurrentMove(state); // wPlayerMoveListIndex deliberately remains the player's original PP slot.
  return 'canUseMove';
}
