import { D } from './battle_end_state';
import { PARTYMON_STRUCT_LENGTH, type BattleState } from './battle_state';
import type { Program } from './battle_menu_context';

/** pret engine/flag_action.asm:4-73. Return C (the resulting byte/mask), not a boolean. */
export function flagAction(state: BattleState, address: number, action: number, bit: number): number {
  const at = (address + ((bit & 255) >> 3)) & 65535, mask = 1 << (bit & 7);
  const value = state.mem[at];
  if ((action & 255) === 2) return value & mask;
  return state.mem[at] = (action & 255) === 0 ? value & ~mask : value | mask;
}

/** pret core.asm:1494-1509,883-900. OR all HP bytes; initial count0 still executes256 iterations. */
function alive(state: BattleState, countAddress: number, first: number): number {
  let value = 0;
  for (let i = 0, count = state.mem[countAddress] || 256; i < count; i++) {
    const at = (first + i * PARTYMON_STRUCT_LENGTH) & 65535;
    value |= state.mem[at] | state.mem[(at + 1) & 65535];
  }
  return value;
}
/** pret core.asm:1494-1509. D is the raw OR result, Z follows it. */
export function anyPartyAlive(state: BattleState): { d: number; zero: boolean } {
  const d = alive(state, D.wPartyCount, D.wPartyMons + 1); return { d, zero: d === 0 };
}
/** pret core.asm:883-900. A and Z, without short circuit or party writes. */
export function anyEnemyPokemonAliveCheck(state: BattleState): { a: number; zero: boolean } {
  const a = alive(state, D.wEnemyPartyCount, D.wEnemyMons + 1); return { a, zero: a === 0 };
}
/** pret core.asm:1512-1529. NoWillText only after first send-out; the print itself is the existing host. */
export function* hasMonFainted(state: BattleState, host: { printText(program: string): Program }): Program<{ zero: boolean }> {
  const at = D.wPartyMons + state.wWhichPokemon * PARTYMON_STRUCT_LENGTH + 1;
  if ((state.mem[at] | state.mem[at + 1]) !== 0) return { zero: false };
  if (state.wFirstMonsNotOutYet === 0) yield* host.printText('NoWillText');
  return { zero: true };
}
