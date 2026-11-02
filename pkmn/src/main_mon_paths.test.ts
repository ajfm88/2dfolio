import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {host,loadMainBattleRig,resetMainBattleRig,world,mon,until,row,frameNow} from './test/main_battle_rig';
import {pokemonToBoxed} from './pokemon_storage';
import {boxedPokemonToRecord,readBattleOutputs} from './battle/battle_bridge';

beforeAll(()=>loadMainBattleRig());
beforeEach(resetMainBattleRig);
afterEach(()=>{host.reset();vi.restoreAllMocks();});
function catchMon(species:number,level:number){
  host.bag.items=[{id:'MASTER_BALL',count:1}];host.startBattle(mon(species,level));until(()=>host.state==='battle');
  const session=host.session!;
  until(()=>host.state!=='battle',()=>{
    if(frameNow()%4)return [];
    if(session.foreground==='pokedex')return ['b'];
    if(row(8).includes('YES'))return ['b'];
    if(row(14).includes('FIGHT')&&!session.video.textBox.active)return row(16).includes('\u25b6')?['a']:['down'];
    return ['a'];
  });
  return readBattleOutputs(session.state).box;
}
it('two real full-party catches insert at the front in live order and the next battle box bytes',async()=>{
  await world('Route1',5,5,Array.from({length:6},()=>mon()));
  const old=pokemonToBoxed(mon(1,10));host.boxes[0].push(old);
  const firstBytes=catchMon(19,3),first=host.boxes[0][0];
  expect(first.speciesName).toBe('Rattata');expect(host.boxes[0][1]).toBe(old);
  expect(host.boxes[0].map(boxedPokemonToRecord)).toEqual(firstBytes);
  await host.finishFade();
  const secondBytes=catchMon(16,4),second=host.boxes[0][0];
  expect(second.speciesName).toBe('Pidgey');expect(host.boxes[0][1]).toBe(first);expect(host.boxes[0][2]).toBe(old);
  expect(host.boxes[0].map(boxedPokemonToRecord)).toEqual(secondBytes);
  await host.finishFade();host.startBattle(mon(19,3));
  expect(readBattleOutputs(host.session!.state).box).toEqual(secondBytes);
});
it('version-1 main box restore supplies migration sleep1 for SLP and zero for healthy entries',async()=>{
  const p=mon(),sleeping=pokemonToBoxed(mon(19,10)),healthy=pokemonToBoxed(mon(16,10));sleeping.status='SLP';
  const {sleepTurns:_s,...oldSleeping}=sleeping,{sleepTurns:_h,...oldHealthy}=healthy;
  const preserved={...sleeping,sleepTurns:5};
  const saved={version:1,mapName:'Route1',playerX:80,playerY:80,playerDirection:'down',
    party:[pokemonToBoxed(p)],bag:[],money:3000,defeatedTrainers:[],pcBoxes:[[oldSleeping,oldHealthy,preserved]],currentPcBox:0,
    eventFlags:['GOT_STARTER','GOT_POKEDEX','FOLLOWED_OAK_INTO_LAB','BATTLED_RIVAL_IN_OAKS_LAB'],pokedexSeen:[25],pokedexOwned:[25]};
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(saved),setItem:vi.fn()});
  await (host as typeof host&{loadSavedGame():Promise<void>}).loadSavedGame();
  expect(host.boxes[0].map(p=>p.sleepTurns)).toEqual([1,0,5]);
  expect(host.boxes[0].map(p=>boxedPokemonToRecord(p).status)).toEqual([1,0,5]);
  expect(oldSleeping).not.toHaveProperty('sleepTurns');expect(oldHealthy).not.toHaveProperty('sleepTurns');
});
