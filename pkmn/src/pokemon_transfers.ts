// pret e89ead15 add_mon.asm:347–515 and status_screen.asm:64–77.
import { A, BattleState } from './battle/battle_state';
import { worldPartyRecord, boxedPokemonToRecord, encodeBoxMon, type BoxMonRecord } from './battle/battle_bridge';
import { partyRecordToPokemon } from './battle/battle_party_codec';
import { boxRecordToPokemon, liveNickname } from './battle/battle_live';
import { installTrainerSpecies } from './battle/battle_trainer_party';
import { getMonHeader } from './battle/battle_loaders';
import { calcStats } from './battle/battle_calc_stats';
import { calcLevelFromExperience } from './battle/battle_calc_experience';
import { D } from './battle/battle_end_state';
import type { BattlePokemon } from './battle/types';
import type { BoxedPokemon } from './pokemon_storage';

/** PARTY_TO_BOX copies the prefix, then replaces BoxLevel with the party level. */
export function depositMon(mon: BattlePokemon): BoxedPokemon {
  const { level, maxHp: _hp, attack: _atk, defense: _def, speed: _spd, special: _spc, ...prefix } = worldPartyRecord(mon);
  return boxRecordToPokemon({ ...prefix, boxLevel: level });
}

function fromBox(r: BoxMonRecord, expLevel: boolean): BattlePokemon {
  const state = new BattleState(); installTrainerSpecies(state);
  encodeBoxMon(state,0,r);
  // LoadMonData's box prefix at wLoadedMon, including the exact three EXP bytes.
  state.mem.set(state.mem.slice(D.wBoxMons,D.wBoxMons+33),A.wLoadedMon);
  const level = expLevel ? calcLevelFromExperience(state) : r.boxLevel;
  getMonHeader(state,r.species); state.wCurEnemyLevel = level;
  // MON_HP_EXP-1=$10, MON_STATS=$22; CalcStats writes five BE words.
  calcStats(state,1,A.wLoadedMon+16,A.wLoadedMon+34);
  const mon = partyRecordToPokemon({ ...r, level,
    maxHp:state.readBE(A.wLoadedMon+34),attack:state.readBE(A.wLoadedMon+36),
    defense:state.readBE(A.wLoadedMon+38),speed:state.readBE(A.wLoadedMon+40),special:state.readBE(A.wLoadedMon+42) });
  mon.nickname = liveNickname(r,mon.species.name);
  return mon;
}

/** BOX_TO_PARTY: EXP determines level; the prefix's HP/status/PP/EXP are untouched. */
export function withdrawMon(boxed: BoxedPokemon): BattlePokemon {
  return fromBox(boxedPokemonToRecord(boxed),true);
}

/** BOX_DATA's STATS page uses BoxLevel, leaving the actual box entry untouched. */
export function boxStatsMon(boxed: BoxedPokemon): BattlePokemon {
  return fromBox(boxedPokemonToRecord(boxed),false);
}
