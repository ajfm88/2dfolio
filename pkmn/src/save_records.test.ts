import {beforeAll,beforeEach,expect,it,vi} from 'vitest';
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
import {createPokemon,loadBattleData} from './battle/data';
import {loadTrainerSpeciesData} from './battle/battle_trainer_data';
import {loadBattleBridgeData,worldPartyRecord,boxedPokemonToRecord,encodePartyMon,encodeBoxMon,nameBytes} from './battle/battle_bridge';
import {A,BattleState} from './battle/battle_state';
import {D} from './battle/battle_end_state';
import {I} from './battle/battle_item_state';
import {saveGame,loadGame,restoreParty,restoreBoxes,type SaveDataV1,type SaveDataV2} from './save';
import {depositMon} from './pokemon_transfers';
import {BattleUnsupportedState} from './battle/battle_move_data';
import {Bag} from './items';
import {trainedSaveMon,frontSaveBox,legacySave} from './test/save_fixture';
import {getPikachuEmotionModifier,setPikachuEmotionModifier,resetPikachuHappiness} from './pikachu/pikachu_happiness';

beforeAll(async()=>{await loadBattleData();await loadTrainerSpeciesData();await loadBattleBridgeData();});
let raw:string|null=null;
beforeEach(()=>{raw=null;vi.stubGlobal('localStorage',{getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}});});
function serialized(){
  const party=[trainedSaveMon(),createPokemon(122,15)!],boxes=[frontSaveBox()],bag=new Bag();bag.items=[{id:'POTION',count:2}];
  saveGame('Route1',80,80,'down',party,bag,1234,new Set(['ViridianForest:1']),['GOT_POKEDEX'],[{id:'POTION',count:1}],
    500,150,210,boxes,0,[19,122],[19,122],'ASH','GARY',{destMap:'PalletTown',destWarpId:0},1,{Route1:0},[],0xc1,5);
  return {party,boxes,saved:loadGame() as SaveDataV2};
}
it('version2 preserves party/box bytes and live stored fields, sleep5, PP Ups0-3, names and front order',()=>{
  const {party,boxes,saved}=serialized();
  expect(saved.version).toBe(2);expect(saved.options).toBe(0xc1);expect(saved.pikachuEmotionModifier).toBe(5);
  expect(saved.party[0].mon).toHaveLength(44);expect(saved.party[0].ot).toHaveLength(11);expect(saved.party[0].nick).toHaveLength(11);
  expect(saved.pcBoxes[0].map(p=>p.mon.length)).toEqual([33,33,33]);
  const restored=restoreParty(saved),restoredBoxes=restoreBoxes(saved);
  expect(restored).toEqual(party);expect(restoredBoxes).toEqual(boxes);
  expect(restored[0].maxHp).not.toBe(createPokemon(19,20,undefined,{atk:9,def:8,spd:7,spc:6})!.maxHp);
  expect(restored[0].exp).toBe(8023);expect(restored[0].sleepTurns).toBe(5);
  expect(restored[0].moves.map(m=>m.maxPp)).toEqual([35,47,42,48]);expect(restored[1].nickname).toBe('MR.MIME');
  restored.forEach((p,index)=>{
    const s=new BattleState();encodePartyMon(s,0,worldPartyRecord(p));
    expect([...s.mem.slice(A.wPartyMons,A.wPartyMons+44)]).toEqual(saved.party[index].mon);
    expect([...s.mem.slice(A.wPartyMonOT,A.wPartyMonOT+11)]).toEqual(saved.party[index].ot);
    expect([...s.mem.slice(A.wPartyMonNicks,A.wPartyMonNicks+11)]).toEqual(saved.party[index].nick);
  });
  restoredBoxes[0].forEach((p,index)=>{
    const s=new BattleState();encodeBoxMon(s,0,boxedPokemonToRecord(p));
    expect([...s.mem.slice(D.wBoxMons,D.wBoxMons+33)]).toEqual(saved.pcBoxes[0][index].mon);
    expect([...s.mem.slice(D.wBoxMonOT,D.wBoxMonOT+11)]).toEqual(saved.pcBoxes[0][index].ot);
    expect([...s.mem.slice(I.wBoxMonNicks,I.wBoxMonNicks+11)]).toEqual(saved.pcBoxes[0][index].nick);
  });
  expect(saved).toMatchObject({mapName:'Route1',money:1234,playTimeMs:500,pikachuHappiness:150,pikachuMood:210,
    playerName:'ASH',rivalName:'GARY',lastBlackoutWarp:{destMap:'PalletTown',destWarpId:0},rivalStarter:1,
    bag:[{id:'POTION',count:2}],pcItems:[{id:'POTION',count:1}],defeatedTrainers:['ViridianForest:1']});
});
it('version1 uses saved level and hand-derived b=1 stats, exact EXP and migration sleep1/healthy0',()=>{
  const saved=legacySave(),before=structuredClone(saved),party=restoreParty(saved),boxes=restoreBoxes(saved);
  // home/move_mon.asm:54-231: bonuses [63,11,4,62,0], bases [30,56,35,72,25],
  // DVs [HP10,9,8,7,6], L10 => floor([143,141,90,220,62]*10/100)+[20,5,5,5,5].
  expect(party.map(p=>[p.maxHp,p.attack,p.defense,p.speed,p.special])).toEqual([[34,19,14,27,11],[34,19,14,27,11]]);
  expect(party.map(p=>p.level)).toEqual([10,10]);expect(party.map(p=>p.exp)).toEqual([1735,1735]);
  expect(party.map(p=>p.sleepTurns)).toEqual([1,0]);expect(boxes[0].map(p=>p.sleepTurns)).toEqual([1,0]);
  expect(party[0].currentHp).toBe(7);expect(party[0].otId).toBe(0x1234);expect(saved).toEqual(before);
});
// V5e checkpoint-02 (note 96). Version-1 saves hold upstream's default nickname, pokemon.json's `name`.
it('version1 default nicknames become MonsterNames entries; every other nickname stays as saved',()=>{
  const base=legacySave(),p=base.party[0];
  const rows:[string,string,string][]=[['Nidoran-F','Nidoran-F','NIDORAN♀'],['Nidoran-M','Nidoran-M','NIDORAN♂'],
    ['Mr. Mime','Mr. Mime','MR.MIME'],['Rattata','Rattata','RATTATA'],['Rattata','SLEEPY','SLEEPY'],
    ['Rattata','rattata','rattata'],['Rattata','RATTATA','RATTATA'],['Pikachu','Rattata','Rattata'],['Nidoran-F','NIDORAN-F','NIDORAN-F']];
  const mons=rows.map(([speciesName,nickname])=>({...p,speciesName,nickname,status:null}));
  const saved:SaveDataV1={...base,party:mons.slice(0,6),pcBoxes:[mons.map(m=>({...m,maxHp:34}))]},before=structuredClone(saved);
  expect(restoreParty(saved).map(m=>m.nickname)).toEqual(rows.slice(0,6).map(r=>r[2]));
  expect(restoreBoxes(saved)[0].map(m=>m.nickname)).toEqual(rows.map(r=>r[2]));
  expect(saved).toEqual(before);
  // Saved again, each is a version-2 record holding exactly those bytes.
  saveGame('Route1',80,80,'down',restoreParty(saved),new Bag(),0,new Set(),[],[],0,0,0,restoreBoxes(saved),0,[],[],'ASH','GARY');
  const next=loadGame() as SaveDataV2;
  expect(next.party.map(m=>m.nick)).toEqual(rows.slice(0,6).map(r=>[...nameBytes(r[2])]));
  expect(next.pcBoxes[0].map(m=>m.nick)).toEqual(rows.map(r=>[...nameBytes(r[2])]));
  expect(restoreParty(next).map(m=>m.nickname)).toEqual(rows.slice(0,6).map(r=>r[2]));
  expect(restoreBoxes(next)[0].map(m=>m.nickname)).toEqual(rows.map(r=>r[2]));
});
it('version1 keeps an empty nickname empty, in the party and in the box',()=>{
  // Ruling: only a nickname equal to pokemon.json's name migrates. '' is not that name.
  const base=legacySave(),p=base.party[0];
  const blank={...p,speciesName:'Pikachu',nickname:'',status:null};
  const saved:SaveDataV1={...base,party:[blank],pcBoxes:[[{...blank,maxHp:34}]]};
  expect(restoreParty(saved).map(m=>m.nickname)).toEqual(['']);
  expect(restoreBoxes(saved)[0].map(m=>m.nickname)).toEqual(['']);
});
it('version2 holds a nickname as typed: lower case, the key spelling and every naming-screen character',()=>{
  // data/text/alphabets.asm: both letter grids and the two shared symbol rows.
  const typed=['Sparky','Pikachu','Mr. Mime','ABCDEFGHIJ','KLMNOPQRST','UVWXYZ abc','defghijklm','nopqrstuvw','xyz×():;[]',
    '\uE001\uE002-?!♂♀/.,'];
  const mons=typed.map(n=>createPokemon(25,5,n)!);
  for(const group of [mons.slice(0,6),mons.slice(4)]){
    saveGame('Route1',80,80,'down',group,new Bag(),0,new Set(),[],[],0,0,0,[group.map(depositMon)],0,[],[],'ASH','GARY');
    const saved=loadGame() as SaveDataV2,names=group.map(m=>m.nickname);
    expect(saved.party.map(m=>m.nick)).toEqual(names.map(n=>[...nameBytes(n)]));
    expect(saved.pcBoxes[0].map(m=>m.nick)).toEqual(names.map(n=>[...nameBytes(n)]));
    expect(restoreParty(saved).map(m=>m.nickname)).toEqual(names);
    expect(restoreBoxes(saved)[0].map(m=>m.nickname)).toEqual(names);
  }
  expect(typed.every(n=>[...n].length<=10)).toBe(true);
});
it('a version2 record written before checkpoint-02 loads its MonsterNames default as it is',()=>{
  // #86's write: a default nickname went into the record as MonsterNames' bytes. Those bytes are the nickname now.
  const {saved}=serialized();
  expect(saved.party[1].nick).toEqual([0x8c,0x91,0xe8,0x8c,0x88,0x8c,0x84,0x50,0x50,0x50,0x50]);
  expect(restoreParty(saved)[1].nickname).toBe('MR.MIME');
  expect(restoreBoxes(saved)[0].map(m=>m.nickname)).toEqual(['PIDGEY','RATTATA','BULBASAUR']);
});
it.each(['version3','parse'])('loadGame refuses %s without pretending it is a supported save',kind=>{
  raw=kind==='version3'?JSON.stringify({...legacySave(),version:3}):'{broken';expect(loadGame()).toBeNull();
});
it('a bad later record propagates a decode error without a partial party or input mutation',()=>{
  const {saved}=serialized();saved.party[1].mon[0]=0;const before=structuredClone(saved);
  expect(()=>restoreParty(saved)).toThrow(BattleUnsupportedState);expect(saved).toEqual(before);
});
it('happiness reset leaves the persisted modifier owner alone',()=>{
  setPikachuEmotionModifier(5);resetPikachuHappiness();expect(getPikachuEmotionModifier()).toBe(5);
});
