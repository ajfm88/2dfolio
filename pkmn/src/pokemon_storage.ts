// Shared storage data. The serialization contract is unchanged from BillsPcMenu.
import type { BattlePokemon } from './battle';

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
  atkDV: number;
  defDV: number;
  spdDV: number;
  spcDV: number;
  exp: number;
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
    atkDV: mon.atkDV,
    defDV: mon.defDV,
    spdDV: mon.spdDV,
    spcDV: mon.spcDV,
    exp: mon.exp,
    otName: mon.otName,
    otId: mon.otId,
  };
}

/** Species-only starter stand-in until A4 implements the OT-name/ID checks. */
export function isStarterPikachuBoxed(mon: BoxedPokemon): boolean {
  return mon.speciesName.replace(/[^a-z]/gi, '').toUpperCase() === 'PIKACHU';
}
