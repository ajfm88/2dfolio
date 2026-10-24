import { D } from './battle_end_state';
import type { BattleState } from './battle_state';
import { BattleUnsupportedState } from './battle_move_data';

/** pret pikachu_status.asm:75-115. Five bytes, including terminators; no HP requirement here. */
function starter(state: BattleState, mon: number, ot: number): boolean {
  if (state.mem[mon] !== 0x54 || state.readBE(mon + 12) !== state.readBE(D.wPlayerID)) return false;
  for (let i = 0; i < 5; i++) if (state.mem[ot + i] !== state.mem[D.wPlayerName + i]) return false;
  return true;
}
/** pret pikachu_status.asm:75-80,81-115. */
export function isThisPartyMonStarterPikachu(state: BattleState): boolean {
  return starter(state, D.wPartyMons + 44 * state.wWhichPokemon, D.wPartyMonOT + 11 * state.wWhichPokemon);
}
/** pret pikachu_status.asm:68-73,81-115. Box stride33; OT stride11. */
export function isThisBoxMonStarterPikachu(state: BattleState): boolean {
  return starter(state, D.wBoxMons + 33 * state.wWhichPokemon, D.wBoxMonOT + 11 * state.wWhichPokemon);
}
/** pret pikachu_status.asm:1-66. Species-list sentinel, and first matching identity's HP decides immediately. */
export function isStarterPikachuAliveInOurParty(state: BattleState): boolean {
  for (let slot = 0; slot < 256; slot++) {
    const species = state.mem[D.wPartySpecies + slot];
    if (species === 255) return false;
    if (species === 0x54 && starterIdentity(state, slot)) {
      const at = D.wPartyMons + 44 * slot + 1;
      return (state.mem[at] | state.mem[at + 1]) !== 0;
    }
  }
  throw new BattleUnsupportedState('unterminated party species');
}
// The list search checks list species, not the struct's species byte (pikachu_status.asm:8-26).
function starterIdentity(state: BattleState, slot: number): boolean {
  const at = D.wPartyMons + 44 * slot;
  if (state.readBE(at + 12) !== state.readBE(D.wPlayerID)) return false;
  for (let i = 0; i < 5; i++) if (state.mem[D.wPartyMonOT + 11 * slot + i] !== state.mem[D.wPlayerName + i]) return false;
  return true;
}

// pret engine/events/pikachu_happiness.asm:90-118. Event IDs1..11, happiness bands <100/<200/otherwise.
export const HAPPINESS_CHANGES = [[5, 3, 2], [5, 3, 2], [1, 1, 0], [3, 2, 1], [1, 1, 0], [2, 1, 1],
  [-3, -3, -5], [-1, -1, -1], [-5, -5, -10], [-5, -5, -10], [-10, -10, -20]] as const;
export const PIKACHU_MOODS = [0x8a, 0x83, 0x80, 0x80, 0x94, 0x80, 0x62, 0x6c, 0x62, 0x6c, 0] as const;

/** pret pikachu_happiness.asm:1-88. GYMLEADER4/WALKING6 use the living-anywhere gate. */
export function modifyPikachuHappiness(state: BattleState, event: number): void {
  if (event < 1 || event > 11) throw new BattleUnsupportedState('Pikachu happiness event');
  if (!(event === 4 || event === 6 ? isStarterPikachuAliveInOurParty(state) : isThisPartyMonStarterPikachu(state))) return;
  const happiness = state.mem[D.wPikachuHappiness], band = happiness < 100 ? 0 : happiness < 200 ? 1 : 2;
  state.mem[D.wPikachuHappiness] = Math.max(0, Math.min(255, happiness + HAPPINESS_CHANGES[event - 1][band]));
  const target = PIKACHU_MOODS[event - 1], mood = state.mem[D.wPikachuMood];
  if (target === 128) return;
  if (target > 128 ? mood < target && state.mem[D.wPikachuEmotionModifier] === 0 : mood >= target) {
    state.mem[D.wPikachuMood] = target;
  }
}
/** pret pikachu_status.asm:117-140. Preserve both D branches, though EndOfBattle always supplies $82. */
export function updatePikachuMoodAfterBattle(state: BattleState, d: number): void {
  if (!isStarterPikachuAliveInOurParty(state)) return;
  const target = d & 255, mood = state.mem[D.wPikachuMood];
  if (target >= 128 ? mood < target : mood >= target) state.mem[D.wPikachuMood] = target;
}
