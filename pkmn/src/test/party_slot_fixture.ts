// Test fixture writers (note 72 ?10.9 ruling; 11f). Not the cartridge's codec: the 58 ledgers were recorded against
// this byte layout ($00 after the @, where battle_party_codec pads with $50). Production writes through the codec.
import type { BattlePokemon, StatExperience } from '../battle/types';
import { getMove } from '../battle/data';
import { TYPE_NAMES } from '../rom/constants';
import { decodeBattleText } from '../battle/battle_text_codec';
import { statusByte } from '../battle/battle_loaders';
import {
  A, encodeText, NAME_LENGTH, NUM_MOVES, NUM_STATS, PARTYMON_STRUCT_LENGTH,
  POKEDEX_ORDER, writeBytes, type BattleState,
} from '../battle/battle_state';

const MON_PP = 29;

export interface PartySlot {
  species: number;
  hp: number;
  boxLevel: number;
  status: number;
  type1: number;
  type2: number;
  catchRate: number;
  moves: readonly number[];
  dvs: readonly [number, number];
  pp: readonly number[];
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  special: number;
  nickname: string;
  otId: number;
  otName: string;
  exp: number;
  statExp: StatExperience;
}

function partyTypeByte(type: string): number {
  const key = type === 'PSYCHIC' ? 'PSYCHIC_TYPE' : type;
  const entry = Object.entries(TYPE_NAMES).find(([, name]) => name === key);
  if (!entry) throw new Error(`unknown party type: ${type}`);
  return Number(entry[0]);
}

/** BattlePokemon has no box-level byte or packed PP Up bits (pp/maxPp are separate).
 * The slot uses level for box level and copies current PP without PP Up bits. */
export function partySlotFromPokemon(mon: BattlePokemon): PartySlot {
  return {
    species: POKEDEX_ORDER.indexOf(mon.species.id) + 1,
    hp: mon.currentHp,
    boxLevel: mon.level,
    status: statusByte(mon),
    type1: partyTypeByte(mon.species.type1),
    type2: partyTypeByte(mon.species.type2),
    catchRate: mon.species.catchRate,
    moves: Array.from({ length: NUM_MOVES }, (_, i) => {
      const move = mon.moves[i];
      if (!move) return 0;
      const data = getMove(move.id);
      if (!data) throw new Error(`unknown party move: ${move.id}`);
      return data.id;
    }),
    dvs: [((mon.atkDV & 0xf) << 4) | (mon.defDV & 0xf), ((mon.spdDV & 0xf) << 4) | (mon.spcDV & 0xf)],
    pp: mon.moves.slice(0, 4).map(move => move.pp & 0x3f),
    level: mon.level,
    maxHp: mon.maxHp,
    attack: mon.attack,
    defense: mon.defense,
    speed: mon.speed,
    special: mon.special,
    nickname: mon.nickname,
    otId: mon.otId,
    otName: mon.otName,
    exp: mon.exp,
    statExp: [...mon.statExp],
  };
}

export function writePartySlot(state: BattleState, side: 'player' | 'enemy', slot: number, mon: PartySlot): void {
  const base = (side === 'player' ? A.wPartyMons : A.wEnemyMons) + slot * PARTYMON_STRUCT_LENGTH;
  const nick = (side === 'player' ? A.wPartyMonNicks : A.wEnemyMonNicks) + slot * NAME_LENGTH;
  const ot = (side === 'player' ? A.wPartyMonOT : A.wEnemyMonOT) + slot * NAME_LENGTH;
  state.mem[base] = mon.species & 0xff;
  state.writeBE(base + 1, mon.hp);
  state.mem[base + 3] = mon.boxLevel & 0xff;
  state.mem[base + 4] = mon.status & 0xff;
  state.mem[base + 5] = mon.type1 & 0xff;
  state.mem[base + 6] = mon.type2 & 0xff;
  state.mem[base + 7] = mon.catchRate & 0xff;
  writeBytes(state.mem, base + 8, mon.moves, NUM_MOVES);
  // macros/ram.asm:17–23; pokemon_data_constants.asm:38–44. These are not battle-struct bytes.
  state.writeBE(base + 12, mon.otId);
  state.mem[base + 14] = (mon.exp >>> 16) & 0xff;
  state.writeBE(base + 15, mon.exp);
  for (let stat = 0; stat < NUM_STATS; stat++) state.writeBE(base + 17 + stat * 2, mon.statExp[stat]);
  writeBytes(state.mem, ot, encodeText(`${mon.otName}@`), NAME_LENGTH);
  state.mem[base + 27] = mon.dvs[0] & 0xff;
  state.mem[base + 28] = mon.dvs[1] & 0xff;
  writeBytes(state.mem, base + MON_PP, mon.pp, NUM_MOVES);
  state.mem[base + 33] = mon.level & 0xff;
  state.writeBE(base + 34, mon.maxHp);
  state.writeBE(base + 36, mon.attack);
  state.writeBE(base + 38, mon.defense);
  state.writeBE(base + 40, mon.speed);
  state.writeBE(base + 42, mon.special);
  writeBytes(state.mem, nick, encodeText(`${mon.nickname}@`), NAME_LENGTH);
  if (side === 'player') mirrorPartyProgress(state, slot);
}

/** experience.asm:24–55,93–142 and macros/ram.asm:17–23: mirror only after the byte writes. */
export function mirrorPartyProgress(state: BattleState, slot: number): void {
  const mon = state.partyMons[slot];
  if (!mon) return;
  const base = A.wPartyMons + slot * PARTYMON_STRUCT_LENGTH;
  mon.otId = state.readBE(base + 12);
  mon.otName = decodeBattleText(state.mem, A.wPartyMonOT + slot * NAME_LENGTH);
  mon.exp = state.mem[base + 14] * 0x10000 + state.readBE(base + 15);
  mon.statExp = [state.readBE(base + 17), state.readBE(base + 19), state.readBE(base + 21),
    state.readBE(base + 23), state.readBE(base + 25)];
}

