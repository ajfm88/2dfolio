import {beforeAll,expect,it,vi} from 'vitest';
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
import {createPokemon,loadBattleData,getSpecies} from './battle/data';
import {loadTrainerSpeciesData} from './battle/battle_trainer_data';
import {loadBattleBridgeData,worldPartyRecord,boxedPokemonToRecord,encodeBoxMon} from './battle/battle_bridge';
import {boxRecordToPokemon,applyBattleOutcome} from './battle/battle_live';
import {A,BattleState} from './battle/battle_state';
import {D} from './battle/battle_end_state';
import {depositMon,withdrawMon,boxStatsMon} from './pokemon_transfers';
import {pokemonToBoxed} from './pokemon_storage';
import {applyEvolution} from './battle/evolution';
import {liveFixture} from './test/battle_live_fixture';
import type {BattlePokemon} from './battle/types';

beforeAll(async()=>{await loadBattleData();await loadTrainerSpeciesData();await loadBattleBridgeData();});
const mon=(id=19,level=10)=>createPokemon(id,level,'SLEEPY',{atk:9,def:8,spd:7,spc:6})!;
const stats=(m:BattlePokemon)=>[m.maxHp,m.attack,m.defense,m.speed,m.special];
function syntheticBox(){
  const p=mon();p.currentHp=7;p.status='SLP';p.sleepTurns=5;p.exp=1735;
  p.statExp=[65535,2000,256,63002,0];p.otId=0x1234;p.otName='RED';
  p.moves=[{id:'TACKLE',pp:1,maxPp:35},{id:'GROWL',pp:2,maxPp:47},
    {id:'TAIL_WHIP',pp:3,maxPp:42},{id:'QUICK_ATTACK',pp:4,maxPp:48}];
  return pokemonToBoxed(p);
}
function boxBytes(box:ReturnType<typeof pokemonToBoxed>){
  const s=new BattleState();encodeBoxMon(s,0,boxedPokemonToRecord(box));
  return [...s.mem.slice(D.wBoxMons,D.wBoxMons+33),...boxedPokemonToRecord(box).otName,...boxedPokemonToRecord(box).nickname];
}
it('withdrawal derives level from exact EXP and keeps HP, sleep5 and PP Ups 0..3',()=>{
  const boxed=syntheticBox(),before=boxBytes(boxed),p=withdrawMon(boxed);
  // home/move_mon.asm:54–231: ceil-sqrt capped255, then >>2 gives bonuses
  // [63,11,4,62,0]. Rattata bases [30,56,35,72,25], DVs [HP10,9,8,7,6].
  // L12: floor([143,141,90,220,62]*12/100)+[22,5,5,5,5].
  expect(p.level).toBe(12);expect(stats(p)).toEqual([39,21,15,31,12]);
  expect(p.currentHp).toBe(7);expect(p.exp).toBe(1735);expect(p.sleepTurns).toBe(5);expect(p.status).toBe('SLP');
  expect(worldPartyRecord(p).pp).toEqual([1,0x42,0x83,0xc4]);
  expect(worldPartyRecord(p).status).toBe(5);expect(p.otId).toBe(0x1234);expect(p.otName).toBe('RED');
  expect(p.nickname).toBe('SLEEPY');expect(boxBytes(boxed)).toEqual(before);
});
it('box STATS uses BoxLevel10 with b=1 and raw EXP, without changing any box byte',()=>{
  const boxed=syntheticBox(),before=boxBytes(boxed),object=structuredClone(boxed),p=boxStatsMon(boxed);
  // Same ASM operands at L10: floor([143,141,90,220,62]*10/100)+[20,5,5,5,5].
  expect(p.level).toBe(10);expect(stats(p)).toEqual([34,19,14,27,11]);expect(p.exp).toBe(1735);
  expect(boxBytes(boxed)).toEqual(before);expect(boxed).toEqual(object);
});
it('deposit copies the party prefix with BoxLevel=level and retains sleep5, names and PP Ups',()=>{
  const p=withdrawMon(syntheticBox());p.level=10;
  const {level,maxHp:_hp,attack:_atk,defense:_def,speed:_spd,special:_spc,...prefix}=worldPartyRecord(p);
  const boxed=depositMon(p);
  expect(boxedPokemonToRecord(boxed)).toEqual({...prefix,boxLevel:level});
  expect(boxed.level).toBe(10);expect(boxed.sleepTurns).toBe(5);expect(boxed.status).toBe('SLP');
  expect(boxed.exp).toBe(1735);expect(boxed.currentHp).toBe(7);
});
it('the box trick refreshes stale stored stats from stat EXP 2000 on withdrawal',()=>{
  const p=mon();p.statExp=[2000,2000,2000,2000,2000];p.exp=1000;p.currentHp=7;
  const stale=stats(p),out=withdrawMon(depositMon(p));
  // ceil(sqrt(2000))=45; >>2=11. At L10, HP floor(91*.1)+20=29.
  expect(stale).toEqual([28,18,13,20,11]);expect(stats(out)).toEqual([29,19,14,21,12]);
  expect(out.currentHp).toBe(7);expect(out.exp).toBe(1000);
});
it('evolution uses b=1 stats and the exact HP difference',()=>{
  const p=mon(16,18);p.statExp=[2000,2000,2000,2000,2000];p.currentHp=7;
  const old=p.maxHp;applyEvolution(p,getSpecies('PIDGEOTTO')!);
  // Pidgeotto bases [63,60,55,71,50]; DV [10,9,8,7,6], bonus11, L18.
  expect(stats(p)).toEqual([56,31,29,35,27]);expect(old).toBe(46);expect(p.currentHp).toBe(17);
});
it('a flagged fainted mon evolves through the outcome plan and returns with exactly the max-HP difference',()=>{
  const p=mon(16,18);p.statExp=[2000,2000,2000,2000,2000];const f=liveFixture({party:[p]});
  const out=f.outcome();out.party[0].hp=0;
  const plan=applyBattleOutcome({...out,canEvolveFlags:1},f.live,f.input());
  expect(plan.evolutions).toHaveLength(1);expect(p.currentHp).toBe(0);
  const old=p.maxHp;applyEvolution(plan.evolutions[0].pokemon,plan.evolutions[0].targetSpecies);
  expect(p.currentHp).toBe(10);expect(p.currentHp).toBe(p.maxHp-old);
});
it('zero HP and a zero max-HP delta remain zero after a legitimate flagged evolution',()=>{
  const p=createPokemon(10,7,undefined,{atk:0,def:1,spd:1,spc:0})!;
  // HP DV6: Caterpie floor(102*7/100)+17=24, Metapod floor(112*7/100)+17=24.
  const f=liveFixture({party:[p]}),out=f.outcome();out.party[0].hp=0;
  const plan=applyBattleOutcome({...out,canEvolveFlags:1},f.live,f.input());
  expect(plan.evolutions).toHaveLength(1);applyEvolution(p,plan.evolutions[0].targetSpecies);
  expect(p.maxHp).toBe(24);expect(p.currentHp).toBe(0);
});
it('evolution HP subtraction/addition wraps to 16 bits without a max clamp',()=>{
  const p=mon(16,18);p.statExp=[2000,2000,2000,2000,2000];p.maxHp=100;p.currentHp=1;
  applyEvolution(p,getSpecies('PIDGEOTTO')!);expect(p.maxHp).toBe(56);expect(p.currentHp).toBe(65493);
});
it('boxed sleep5 survives decode and re-encode in the real codec',()=>{
  const r=boxedPokemonToRecord(syntheticBox());expect(r.status).toBe(5);
  expect(boxedPokemonToRecord(boxRecordToPokemon(r))).toEqual(r);
  const s=new BattleState();encodeBoxMon(s,0,r);expect(s.mem[D.wBoxMons+4]).toBe(5);
  expect(s.mem[A.wLoadedMon]).toBe(0);
});
