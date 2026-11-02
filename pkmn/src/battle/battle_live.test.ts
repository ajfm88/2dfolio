import { getPikachuEmotionModifier } from '../pikachu/pikachu_happiness';
import { beforeAll, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis,{window:{addEventListener(){}}}));
import { loadBattleData, createPokemon } from './data';
import { loadTrainerSpeciesData } from './battle_trainer_data';
import { loadBattleBridgeData, nameBytes, decodePartyMon, worldPartyRecord, boxedPokemonToRecord } from './battle_bridge';
import { applyBattleOutcome, liveBattleWorld, boxRecordToPokemon } from './battle_live';
import { liveFixture } from '../test/battle_live_fixture';
import { pokemonToBoxed } from '../pokemon_storage';
import { BattleUnsupportedState } from './battle_move_data';

beforeAll(async () => { await loadBattleData(); await loadTrainerSpeciesData(); await loadBattleBridgeData(); });
const mon = (id=25,level=20,nickname?:string) => createPokemon(id,level,nickname,{atk:9,def:8,spd:8,spc:8})!;

it('maps encounters and passes badge spellings, script gym byte, labels and party index through', () => {
  const f=liveFixture({badges:['BADGE_1','BADGE_3']});
  expect(f.world.opponent).toBe(0xa5);expect(f.world.enemyLevel).toBe(3);expect(f.state.wObtainedBadges).toBe(5);
  const labels={win:'OaksLabRivalIPickedTheWrongPokemonText',lose:'OaksLabRivalAmIGreatOrWhatText'};
  const trainer=liveBattleWorld(f.world,{kind:'trainer',trainerClass:'RIVAL1',partyIndex:2,endBattleText:labels,gymLeaderNo:7});
  expect([trainer.opponent,trainer.enemyLevel,trainer.partyIndex,trainer.gymLeaderNo,trainer.endBattleText]).toEqual([225,0,2,7,labels]);
  expect(() => liveBattleWorld(f.world,{kind:'wild',species:'missing',level:3})).toThrow(BattleUnsupportedState);
});
it('round-trips every world owner and retains party and existing box identities', () => {
  const party=[mon(),mon(29,12)],box=pokemonToBoxed(mon(122,15));
  const f=liveFixture({party,pcBoxes:[[box]],bag:[{id:'PARALYZE_HEAL',count:2},{id:'TM01',count:1}],seen:[25,29,122],owned:[25,29],pikachuHappiness:91,pikachuMood:137});
  const before=f.snapshot(); f.values.won=true; before.values.won=true;
  const plan=applyBattleOutcome(f.outcome(),f.live,f.input());
  expect(f.snapshot()).toEqual(before);expect(f.live.party[0]).toBe(party[0]);expect(f.live.party[1]).toBe(party[1]);expect(f.live.boxes[0][0]).toBe(box);
  expect(plan).toEqual({lost:false,blackout:false,trainerDefeated:false,evolutions:[],battleResult:0});
});
it.each([[29,'NIDORAN-F','Nidoran-F'],[122,'MR. MIME','Mr. Mime']] as const)('preserves typed %s nickname %s verbatim through both boundaries', (id,typed,display) => {
  const f=liveFixture({party:[mon(id,20,typed),mon(id,20)]});
  expect(decodePartyMon(f.state,0).nickname).toEqual(nameBytes(typed));
  const result=f.outcome();applyBattleOutcome(result,f.live,f.input());
  expect(f.live.party.map(m=>m.nickname)).toEqual([typed,display]);
  const boxedTyped=boxedPokemonToRecord(pokemonToBoxed(mon(id,20,typed)));
  expect(boxedTyped.nickname).toEqual(nameBytes(typed));
  expect(boxRecordToPokemon(boxedTyped).nickname).toBe(typed);
  expect(boxRecordToPokemon(boxedPokemonToRecord(pokemonToBoxed(mon(id,20)))).nickname).toBe(display);
});
it('applies absolute outcomes, retains the page modifier and treats result2 as non-loss', () => {
  const f=liveFixture({party:[mon()],money:3000});
  const out={...f.outcome(),money:3070,pikachuHappiness:102,pikachuMood:143,pikachuEmotionModifier:19,battleResult:2,
    bag:[{id:'POTION',count:1}],seen:[19,25],owned:[19,25]};
  const plan=applyBattleOutcome(out,f.live,f.input());
  expect(f.values).toEqual({money:3070,seen:[19,25],owned:[19,25],happiness:102,mood:143,won:false});
  expect(f.live.bag.items).toEqual([{id:'POTION',count:1}]);expect(getPikachuEmotionModifier()).toBe(19);
  expect(plan.lost).toBe(false);expect(plan.evolutions).toEqual([]);expect(liveFixture().world.pikachuEmotionModifier).toBe(19);
});
it('a party catch appends a new object while retaining each old object', () => {
  const original=mon(),f=liveFixture({party:[original]}),out=f.outcome();
  applyBattleOutcome({...out,party:[...out.party,worldPartyRecord(mon(29,7))]},f.live,f.input());
  expect(f.live.party).toHaveLength(2);expect(f.live.party[0]).toBe(original);
  expect(f.live.party[1].nickname).toBe('Nidoran-F');expect(f.live.party[1].species.id).toBe(29);
});
it('chooses flagged level evolutions in party order, including fainted mons; skips unflagged and item entries', () => {
  const f=liveFixture({party:[mon(1,16),mon(4,16),mon(7,20),mon(25,30)]});
  const out=f.outcome();out.party[1].hp=0;
  const plan=applyBattleOutcome({...out,canEvolveFlags:0b1011},f.live,f.input());
  expect(plan.evolutions.map(e=>[e.partyIndex,e.targetSpecies.name])).toEqual([[0,'Ivysaur'],[1,'Charmeleon']]);
  expect(plan.evolutions[0].pokemon).toBe(f.live.party[0]);expect(plan.evolutions[1].pokemon).toBe(f.live.party[1]);
  expect(plan.evolutions[1].pokemon.currentHp).toBe(0);
  expect(applyBattleOutcome({...f.outcome(),canEvolveFlags:15,battleResult:1},f.live,f.input()).evolutions).toEqual([]);
});
it('inserts a new box object before existing ones and calculates only its required maxHp cache from the prefix', () => {
  const box=pokemonToBoxed(mon(1,10)),f=liveFixture({party:[mon()],pcBoxes:[[box]]});
  const caught=boxedPokemonToRecord(pokemonToBoxed(mon(19,20)));caught.hp=1;caught.statExp[0]=65535;caught.pp[0]=0x81;
  const decoded=boxRecordToPokemon(caught);
  // Rattata base HP30, HP DV8, stat-exp bonus63, level20: floor(139*20/100)+30=57.
  expect(decoded.maxHp).toBe(57);expect(decoded.currentHp).toBe(1);expect(decoded.statExp![0]).toBe(65535);
  expect(decoded.moves[0]).toEqual({id:'TACKLE',pp:1,maxPp:49});
  expect(caught).not.toHaveProperty('maxHp');expect(decoded).not.toHaveProperty('attack');
  applyBattleOutcome({...f.outcome(),box:[caught,...f.outcome().box]},f.live,f.input());
  expect(f.live.boxes[0][1]).toBe(box);expect(f.live.boxes[0][0]).toEqual(decoded);
});
it.each(['party shrink','party +2','party species','box +2','box old slot','late decode'] as const)('rejects %s before any live value is written', kind => {
  const f=liveFixture({party:[mon(),mon(1,10)],pcBoxes:[[pokemonToBoxed(mon(4,10))]]}),before=f.snapshot();
  const result=f.outcome(),out={...result,party:[...result.party],box:[...result.box]};
  if(kind==='party shrink')out.party.splice(1);
  if(kind==='party +2')out.party.push(worldPartyRecord(mon()),worldPartyRecord(mon()));
  if(kind==='party species')out.party[1].species=84;
  if(kind==='box +2')out.box.push({...out.box[0]},{...out.box[0]});
  if(kind==='box old slot')out.box[0].hp--;
  if(kind==='late decode')out.party[1].moves[0]=255;
  expect(()=>applyBattleOutcome({...out,money:17,pikachuHappiness:4},f.live,f.input())).toThrow(BattleUnsupportedState);
  expect(f.snapshot()).toEqual(before);
});
