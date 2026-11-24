// Shared storage data. The serialization contract is unchanged from BillsPcMenu.
import type { BattlePokemon } from './battle';
import type { StatExperience } from './battle/types';
import { getSpecies } from './battle/data';
import { encodeText } from './battle/battle_state';
import { getPlayerName } from './core/player_state';

export const NUM_BOXES = 12;
export const MONS_PER_BOX = 20;

export interface BoxedPokemon {
  speciesName: string;
  nickname: string;
  level: number;
  currentHp: number;
  maxHp: number;
  moves: { id: string; pp: number; maxPp: number }[];
  status: 'PSN' | 'BRN' | 'FRZ' | 'PAR' | 'SLP' | null;
  sleepTurns: number;
  atkDV: number;
  defDV: number;
  spdDV: number;
  spcDV: number;
  exp: number;
  statExp?: StatExperience;
  otName?: string;
  otId?: number;
}

export function pokemonToBoxed(mon: BattlePokemon): BoxedPokemon {
  return {
    speciesName: mon.species.name,
    nickname: mon.nickname,
    level: mon.level,
    currentHp: mon.currentHp,
    maxHp: mon.maxHp,
    moves: mon.moves.map(m => ({ id: m.id, pp: m.pp, maxPp: m.maxPp })),
    status: mon.status,
    sleepTurns: mon.sleepTurns,
    atkDV: mon.atkDV,
    defDV: mon.defDV,
    spdDV: mon.spdDV,
    spcDV: mon.spcDV,
    exp: mon.exp,
    statExp: [...mon.statExp],
    otName: mon.otName,
    otId: mon.otId,
  };
}

/** The field player ID is zero, as in writeBattleInputs. The cartridge compares five OT bytes. */
export function isFieldStatusStarter(mon: Pick<BattlePokemon, 'species' | 'otId' | 'otName'>): boolean {
  if (mon.species.id !== 25 || mon.otId !== 0) return false;
  const player = encodeText(getPlayerName().padEnd(5, '@').slice(0, 5));
  const ot = encodeText(mon.otName.padEnd(5, '@').slice(0, 5));
  return player.every((byte, i) => byte === ot[i]);
}

export function isStarterPikachuBoxed(mon: BoxedPokemon): boolean {
  const species = getSpecies(mon.speciesName);
  return species !== null && isFieldStatusStarter({ species, otName: mon.otName ?? '', otId: mon.otId ?? 0 });
}
