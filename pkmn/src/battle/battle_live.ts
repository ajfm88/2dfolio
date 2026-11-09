// Live since A5c3f checkpoint-09b. The live owners are supplied; no main.ts dependency.
// EndOfBattle / Evolution_PartyMonLoop / SendNewMonToBox (pret e89ead15).
import { getSpecies, getSpeciesById, getAllLoadedMoveIds, getMove } from './data';
import { BattleState, POKEDEX_ORDER } from './battle_state';
import { getTrainerSpeciesData, monsterName } from './battle_trainer_data';
import { installTrainerSpecies } from './battle_trainer_party';
import { BattleUnsupportedState } from './battle_move_data';
import { boxedPokemonToRecord, encodeBoxMon, type BattleWorld, type BattleOutcome } from './battle_bridge';
import { partyRecordToPokemon, nameBytes, decodeBattleText, partyMaxPP, type BoxMonRecord } from './battle_party_codec';
import { getMonHeader } from './battle_loaders';
import { calcStat } from './battle_calc_stats';
import { D } from './battle_end_state';
import type { EvolutionCandidate } from './evolution';
import type { BattlePokemon } from './types';
import type { BoxedPokemon } from '../pokemon_storage';
import type { Bag } from '../items';

export interface LiveBattleSources extends Omit<BattleWorld,
  'opponent' | 'enemyLevel' | 'partyIndex' | 'gymLeaderNo' | 'endBattleText'> {}
export type LiveBattleEncounter = { kind: 'wild'; species: string | number; level: number }
  /** ViridianCity.asm:97-106 (BATTLE_TYPE_OLD_MAN) and PalletTown.asm:138-148 (BATTLE_TYPE_PIKACHU). */
  | { kind: 'demo'; battleType: 1 | 4; species: string | number; level: number }
  | { kind: 'trainer'; trainerClass: string; partyIndex: number; endBattleText?: BattleWorld['endBattleText']; gymLeaderNo: number };

export function liveBattleWorld(sources: LiveBattleSources, encounter: LiveBattleEncounter): BattleWorld {
  if (encounter.kind === 'wild' || encounter.kind === 'demo') {
    const species = typeof encounter.species === 'number' ? getSpeciesById(encounter.species) : getSpecies(encounter.species);
    const opponent = species ? POKEDEX_ORDER.indexOf(species.id)+1 : 0;
    if (!opponent) throw new BattleUnsupportedState(`live ${encounter.kind} species ${encounter.species}`);
    const world = { ...sources, opponent, enemyLevel:encounter.level, partyIndex:0, gymLeaderNo:0 };
    return encounter.kind === 'demo' ? { ...world, battleType:encounter.battleType } : world;
  }
  const trainer = getTrainerSpeciesData().trainers[encounter.trainerClass];
  if (!trainer) throw new BattleUnsupportedState(`live trainer class ${encounter.trainerClass}`);
  return { ...sources, opponent:trainer.id+200, partyIndex:encounter.partyIndex,
    enemyLevel:0, gymLeaderNo:encounter.gymLeaderNo, endBattleText:encounter.endBattleText };
}

export interface LiveBattleOwners {
  party: BattlePokemon[];
  boxes: BoxedPokemon[][];
  bag: Pick<Bag,'items'>;
  setMoney(value: number): void;
  restorePokedex(seen: number[], owned: number[]): void;
  restorePikachuHappiness(happiness: number, mood: number): void;
  setPikachuEmotionModifier(value: number): void;
  setLastBattleWon(won: boolean): void;
}
export interface LiveBattleInput {
  world: BattleWorld;
  encounter: LiveBattleEncounter;
  blackoutCarry: boolean;
}
export interface LiveBattlePlan {
  lost: boolean;
  blackout: boolean;
  trainerDefeated: boolean;
  evolutions: EvolutionCandidate[];
  battleResult: number;
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string,unknown>, y = b as Record<string,unknown>;
  return Object.keys(x).length === Object.keys(y).length
    && Object.keys(x).every(k => Object.prototype.hasOwnProperty.call(y,k) && equal(x[k],y[k]));
}
export function liveNickname(r: BoxMonRecord, speciesName: string): string {
  return equal(r.nickname,nameBytes(monsterName(r.species))) ? speciesName : decodeBattleText(r.nickname,0);
}

/** Convert the actual box prefix directly, never synthesize a PartyMonRecord stat tail.
 * BoxedPokemon's required maxHp cache is calculated from these prefix bytes; other
 * stored stats do not exist here. Checkpoint-10 owns withdrawal/persistence changes. */
export function boxRecordToPokemon(r: BoxMonRecord): BoxedPokemon {
  const species = getSpeciesById(POKEDEX_ORDER[r.species-1]);
  if (!species) throw new BattleUnsupportedState(`live boxed species ${r.species}`);
  const scratch = new BattleState(); installTrainerSpecies(scratch);
  encodeBoxMon(scratch,0,r); getMonHeader(scratch,r.species); scratch.wCurEnemyLevel = r.boxLevel;
  const maxHp = calcStat(scratch,1,1,D.wBoxMons+16);
  return { speciesName:species.name, nickname:liveNickname(r,species.name), level:r.boxLevel,
    currentHp:r.hp, maxHp, status:r.status&64 ? 'PAR' : r.status&32 ? 'FRZ' : r.status&16 ? 'BRN' : r.status&8 ? 'PSN' : r.status&7 ? 'SLP' : null,
    sleepTurns:r.status&7,
    atkDV:r.dvs[0]>>4, defDV:r.dvs[0]&15, spdDV:r.dvs[1]>>4, spcDV:r.dvs[1]&15,
    exp:r.exp, statExp:[...r.statExp], otName:decodeBattleText(r.otName,0), otId:r.otId,
    moves:r.moves.flatMap((id,i) => {
      if (!id) return [];
      const key = getAllLoadedMoveIds().find(name => getMove(name)!.id === id);
      if (!key) throw new BattleUnsupportedState(`live boxed move ${id}`);
      return [{id:key,pp:r.pp[i]&63,maxPp:partyMaxPP(getMove(key)!.pp,r.pp[i]>>6)}];
    }) };
}

/** All decoding, invariant checks and evolution lookup finish before touching an owner.
 * Owner setters are the existing synchronous absolute-value APIs. */
export function applyBattleOutcome(outcome: BattleOutcome, live: LiveBattleOwners, input: LiveBattleInput): LiveBattlePlan {
  const {world,encounter,blackoutCarry} = input;
  const original = world.party.length;
  if (live.party.length !== original || world.party.some((mon,i) => mon !== live.party[i])
    || !live.boxes[world.currentPcBox]) throw new BattleUnsupportedState('live owners changed during battle');
  if (outcome.party.length < original || outcome.party.length > original+1 || outcome.party.length > 6)
    throw new BattleUnsupportedState('live party count');
  const party = outcome.party.map((r,i) => {
    if (i < original && POKEDEX_ORDER[r.species-1] !== world.party[i].species.id)
      throw new BattleUnsupportedState('live party species changed');
    const mon = partyRecordToPokemon(r); mon.nickname = liveNickname(r,mon.species.name); return mon;
  });
  const oldBox = world.pcBoxes[world.currentPcBox];
  if (!oldBox || outcome.box.length < oldBox.length || outcome.box.length > oldBox.length+1 || outcome.box.length > 20)
    throw new BattleUnsupportedState('live box count');
  const added = outcome.box.length-oldBox.length;
  oldBox.forEach((mon,i) => {
    if (!equal(boxedPokemonToRecord(mon),outcome.box[i+added])) throw new BattleUnsupportedState('live old box slot changed');
  });
  const caught = added ? boxRecordToPokemon(outcome.box[0]) : undefined;
  const bag = outcome.bag.map(item => ({...item})), seen = [...outcome.seen], owned = [...outcome.owned];
  const lost = outcome.battleResult === 1;
  const evolutions: EvolutionCandidate[] = [];
  if (outcome.battleResult === 0) party.forEach((mon,i) => {
    if (!(outcome.canEvolveFlags & (1<<i))) return;
    const entry = mon.species.evolutions.find(e => e.method === 'level' && mon.level >= e.param);
    if (!entry) return;
    const targetSpecies = getSpecies(entry.to);
    if (!targetSpecies) throw new BattleUnsupportedState(`live evolution target ${entry.to}`);
    evolutions.push({pokemon:live.party[i] ?? mon,partyIndex:i,targetSpecies});
  });
  // Commit only after the last possible decoding/validation error.
  party.forEach((mon,i) => { if (i < original) Object.assign(live.party[i],mon); else live.party.push(mon); });
  if (caught) live.boxes[world.currentPcBox].unshift(caught);
  live.bag.items = bag;
  live.setMoney(outcome.money); live.restorePokedex(seen,owned);
  live.restorePikachuHappiness(outcome.pikachuHappiness,outcome.pikachuMood);
  live.setLastBattleWon(outcome.battleResult === 0); live.setPikachuEmotionModifier(outcome.pikachuEmotionModifier);
  return {lost,blackout:blackoutCarry,trainerDefeated:encounter.kind === 'trainer' && !lost,evolutions,battleResult:outcome.battleResult};
}
