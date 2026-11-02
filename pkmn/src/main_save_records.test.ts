import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {host,loadMainBattleRig,resetMainBattleRig,world,tick,mon} from './test/main_battle_rig';
import {loadGame,type SaveDataV2} from './save';
import {trainedSaveMon,frontSaveBox,legacySave} from './test/save_fixture';
import {worldPartyRecord,boxedPokemonToRecord,encodePartyMon,encodeBoxMon} from './battle/battle_bridge';
import {A,BattleState} from './battle/battle_state';
import {D} from './battle/battle_end_state';
import {I} from './battle/battle_item_state';
import {getTextSpeed} from './text/textbox';
import {getPikachuEmotionModifier,setPikachuEmotionModifier,restorePikachuHappiness,
  getPikachuHappiness,getPikachuMood} from './pikachu/pikachu_happiness';
const main=host as typeof host&{writeSave():void;startNewGame():Promise<void>};
const fast={textSpeed:'FAST',animation:'OFF',battleStyle:'SET'} as const;
const defaults={textSpeed:'MID',animation:'ON',battleStyle:'SHIFT'} as const;
let store:Map<string,string>;
beforeAll(()=>loadMainBattleRig());
beforeEach(()=>{
  resetMainBattleRig();setPikachuEmotionModifier(0);store=new Map();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)});
});
afterEach(()=>{host.reset();vi.restoreAllMocks();});
function titleMenu(){
  host.state='title_screen';tick();tick(['start']);expect(host.state).toBe('main_menu');tick();
}
async function saveThenReload(){
  await world('Route1',5,5,[trainedSaveMon(),mon(122,15)]);host.boxes[0].push(...frontSaveBox());
  host.optionMenu.restore(fast);setPikachuEmotionModifier(5);restorePikachuHappiness(150,210);
  main.writeSave();const saved=loadGame() as SaveDataV2;
  expect(saved.version).toBe(2);expect(saved.options).toBe(0xc1);expect(saved.pikachuEmotionModifier).toBe(5);
  resetMainBattleRig();setPikachuEmotionModifier(0);restorePikachuHappiness(90,128);
  host.optionMenu.restore({textSpeed:'SLOW',animation:'ON',battleStyle:'SHIFT'});titleMenu();
  expect(host.optionMenu.options).toEqual(fast);expect(getTextSpeed()).toBe('fast');
  expect(getPikachuEmotionModifier()).toBe(5);return saved;
}
it('real main saves, reloads settings before CONTINUE and supplies identical next-battle record bytes',async()=>{
  const saved=await saveThenReload();tick(['a']);expect(host.state).toBe('transition');await host.finishFade();
  for(let n=0;n<30&&host.state!=='overworld';n++)await new Promise<void>(resolve=>setImmediate(resolve));
  expect(host.state).toBe('overworld');expect(host.optionMenu.options).toEqual(fast);expect(getTextSpeed()).toBe('fast');
  expect(getPikachuEmotionModifier()).toBe(5);
  host.playerParty.forEach((p,index)=>{
    const s=new BattleState();encodePartyMon(s,0,worldPartyRecord(p));
    expect([...s.mem.slice(A.wPartyMons,A.wPartyMons+44)]).toEqual(saved.party[index].mon);
  });
  host.startBattle(mon(19,3));const state=host.session!.state;
  saved.party.forEach((record,index)=>{
    expect([...state.mem.slice(A.wPartyMons+index*44,A.wPartyMons+(index+1)*44)]).toEqual(record.mon);
    expect([...state.mem.slice(A.wPartyMonOT+index*11,A.wPartyMonOT+(index+1)*11)]).toEqual(record.ot);
    expect([...state.mem.slice(A.wPartyMonNicks+index*11,A.wPartyMonNicks+(index+1)*11)]).toEqual(record.nick);
  });
  saved.pcBoxes[0].forEach((record,index)=>{
    expect([...state.mem.slice(D.wBoxMons+index*33,D.wBoxMons+(index+1)*33)]).toEqual(record.mon);
    expect([...state.mem.slice(D.wBoxMonOT+index*11,D.wBoxMonOT+(index+1)*11)]).toEqual(record.ot);
    expect([...state.mem.slice(I.wBoxMonNicks+index*11,I.wBoxMonNicks+(index+1)*11)]).toEqual(record.nick);
    const scratch=new BattleState();encodeBoxMon(scratch,0,boxedPokemonToRecord(host.boxes[0][index]));
    expect([...scratch.mem.slice(D.wBoxMons,D.wBoxMons+33)]).toEqual(record.mon);
  });
  expect(state.wOptions).toBe(saved.options);expect(state.mem[D.wPikachuEmotionModifier]).toBe(saved.pikachuEmotionModifier);
});
it('NEW GAME from the same restored main menu retains settings/modifier while happiness and mood reset',async()=>{
  await saveThenReload();expect(host.state).toBe('main_menu');await main.startNewGame();
  expect(host.optionMenu.options).toEqual(fast);expect(getTextSpeed()).toBe('fast');expect(getPikachuEmotionModifier()).toBe(5);
  expect([getPikachuHappiness(),getPikachuMood()]).toEqual([90,128]);
});
it('version1 main-menu entry uses defaults and modifier0 before CONTINUE',()=>{
  store.set('p151-s',JSON.stringify(legacySave()));host.optionMenu.restore(fast);setPikachuEmotionModifier(5);titleMenu();
  expect(host.optionMenu.options).toEqual(defaults);expect(getTextSpeed()).toBe('medium');expect(getPikachuEmotionModifier()).toBe(0);
});
it('every no-save main-menu entry restores defaults over changed options',()=>{
  for(const options of [fast,{textSpeed:'SLOW',animation:'OFF',battleStyle:'SET'} as const]){
    host.optionMenu.restore(options);titleMenu();
    expect(host.optionMenu.options).toEqual(defaults);expect(getTextSpeed()).toBe('medium');
  }
});
