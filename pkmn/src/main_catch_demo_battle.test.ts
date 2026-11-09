// A5f checkpoint-04 (note 87 §20): the catch demos run as real battles. The map scripts set wBattleType
// (ViridianCity.asm:97-106, PalletTown.asm:138-148); StartBattle's simulated menu (core.asm:2093-2112), the one-ball
// list (core.asm:2293-2314) and ItemUseBall's demo branches (item_effects.asm:115-171,527-532,586-596) run in the session.
import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {host,loadMainBattleRig,resetMainBattleRig,tick,until,world,mon} from './test/main_battle_rig';
import * as audio from './audio';
import * as sessions from './battle/battle_session';
import {restoreFlags} from './events';
import {restorePokedex,getSeenList,getOwnedList} from './pokedex_state';
import {wasLastBattleWon,setLastBattleWon} from './script/script_controller';
import type {BattlePokemon} from './battle/types';

beforeAll(()=>loadMainBattleRig());
beforeEach(()=>{
  resetMainBattleRig();
  const create=sessions.createBattleSession;
  vi.spyOn(sessions,'createBattleSession').mockImplementation((w,deps)=>
    create(w,{...deps,random:sessions.createSessionRandom(()=>4)}));
});
afterEach(()=>{host.reset();vi.restoreAllMocks();});

async function demo(battleType:'PIKACHU'|'OLD_MAN',species:string,map:string,party:BattlePokemon[]){
  await world(map,5,5,party);
  const worlds:unknown[]=[];
  const create=vi.mocked(sessions.createBattleSession).getMockImplementation()!;
  vi.mocked(sessions.createBattleSession).mockImplementation((w,deps)=>{worlds.push(w);return create(w,deps);});
  let resumed=0;
  host.startScript([{type:'catchDemo',battleType,species,level:5},{type:'callback',fn:()=>{resumed++;}}]);
  until(()=>host.state==='battle');
  const session=host.session!,liveType=session.state.wBattleType; // EndOfBattle clears it later
  until(()=>host.state!=='battle');
  // The finish hands back to the script (scriptBattlePending), whose next command runs on the following ticks.
  expect(host.state).toBe('script');
  for(let i=0;i<3;i++)tick();
  return {session,worlds,liveType,resumed:()=>resumed};
}

it('Oak\'s Pikachu demo: wBattleType 4 with an empty party, caught, nothing kept, the script resumes', async () => {
  restorePokedex([],[]);setLastBattleWon(true);host.bag.items=[{id:'POTION',count:2}];
  const fade=vi.spyOn(audio,'playDefaultMusicFadeOutCurrent');
  const {session,worlds,liveType,resumed}=await demo('PIKACHU','PIKACHU','PalletTown',[]);
  // A5f checkpoint-05 moved this from main.test.ts's retired catch_demo state: the battle's finish requests the
  // map song with the after-battle fade (PlayDefaultMusicFadeOutCurrent), once.
  expect(fade.mock.calls.filter(([,afterBattle])=>afterBattle)).toEqual([['pallettown',true]]);
  expect(liveType).toBe(4);
  expect(worlds).toHaveLength(1);expect(worlds[0]).toMatchObject({battleType:4,opponent:84,enemyLevel:5,party:[]});
  const labels=session.textLog.map(t=>t.label);
  expect(labels).toContain('ItemUseText00');expect(labels).toContain('ItemUseBallText05');
  expect(labels).not.toContain('ItemUseBallText04');expect(labels).not.toContain('ItemUseBallText06');
  expect(host.session).toBeNull();expect(host.playerParty).toEqual([]);expect(host.boxes[0]).toEqual([]);
  expect(host.bag.items).toEqual([{id:'POTION',count:2}]);
  expect(getSeenList()).toEqual([25]);expect(getOwnedList()).toEqual([]); // LoadEnemyMonData's seen flag only
  expect(wasLastBattleWon()).toBe(false); // .returnAfterCapturingMon: wBattleResult = 2
  expect(resumed()).toBe(1);
});

it.each([{flag:true,label:'ItemUseBallText04'},{flag:false,label:'ItemUseBallText05'}])(
  'the old man\'s demo, EVENT_INITIAL_CATCH_TRAINING $flag: $label, no ball used, party unchanged', async ({flag,label}) => {
  restoreFlags(['GOT_STARTER','GOT_POKEDEX',...(flag?['INITIAL_CATCH_TRAINING']:[])]);restorePokedex([25],[25]);
  host.bag.items=[{id:'POKE_BALL',count:1}];
  const lead=mon();
  const {session,worlds,liveType,resumed}=await demo('OLD_MAN','RATTATA','ViridianCity',[lead]);
  expect(liveType).toBe(1);
  expect(resumed()).toBe(1);
  expect(worlds[0]).toMatchObject({battleType:1,opponent:165,enemyLevel:5});
  const labels=session.textLog.map(t=>t.label);
  expect(labels).toContain(label);expect(labels).not.toContain(flag?'ItemUseBallText05':'ItemUseBallText04');
  expect(host.playerParty).toHaveLength(1);expect(host.playerParty[0]).toBe(lead);expect(host.boxes[0]).toEqual([]);
  expect(host.bag.items).toEqual([{id:'POKE_BALL',count:1}]);
  expect(getSeenList()).toEqual([19,25]);expect(getOwnedList()).toEqual([25]);
});
