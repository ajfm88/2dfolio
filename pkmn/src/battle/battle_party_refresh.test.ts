import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { A, BattleState, battleContext } from './battle_state';
import { decodePartyMon, encodePartyMon, pokemonToPartyRecord, partyRecordToPokemon, refreshPartyMon, refreshPartyMirror } from './battle_party_codec';
import { createPokemon, loadBattleData } from './data';
import { decrementPP, incrementMovePP, readPlayerMonCurHPAndStatus } from './battle_loaders';
import { loadBattleMoveData } from './battle_move_data';
import { restorePartyMovePP } from './battle_item_pp';
import { itemUseMedicine, type MedicineItemEnvironment } from './battle_item_medicine';
import { createMedicineItemEnvironment, displayUseItemPartyMenu } from './battle_item_medicine_env';
import type { BattleItemHost } from './battle_items';
import { choosePartyForSendOut, bindStateBattlePartyMenu, bindPlayerSwitch } from './battle_send_out';
import { type BattlePartyHost } from './battle_party_menu';
import { ScreenTiles } from '../menus/screen_tiles';
import { MenuInput } from '../menus/menu_input';
import { wakeUpEntireParty } from './battle_item_flute';
import { checkDefrost } from './battle_effects_status';
import type { StatusEffectEnvironment } from './battle_effects_status';
import { I } from './battle_item_state';
import { D } from './battle_end_state';
import { learnMove } from './learn_move';
import { gainExperience } from './battle_experience';
import { addPartyMon } from './battle_add_mon';
import * as twoOption from './battle_two_option';
import { battleLedger } from '../test/battle_ledger_rig';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadStatEffectData } from './battle_effects_stats';
import { textBgTransfer } from '../text/bg_transfer';
import { resetListStateForEmptySlot } from '../list_state';
import type { Program } from './battle_menu_context';
import type { BattlePokemon } from './types';

beforeAll(async () => { await loadBattleData(); await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); await loadStatEffectData(); });
beforeEach(() => { vi.restoreAllMocks(); resetListStateForEmptySlot(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => vi.restoreAllMocks());
function seed(s = new BattleState(), count = 2) {
  s.mem[A.wPartyCount] = count;
  for (let i = 0; i < count; i++) {
    const r = pokemonToPartyRecord(createPokemon('PIDGEY', 20, 'BIRD', {atk:8,def:8,spd:8,spc:8})!);
    r.moves = [33,0,0,0]; r.pp = [5,0,0,0];
    encodePartyMon(s,i,r);s.mem[A.wPartySpecies+i]=0x24;
  }
  s.mem[A.wPartySpecies+count]=255;refreshPartyMirror(s);return s;
}
function equal(s: BattleState, slot = 0) { expect(s.partyMons[slot]).toEqual(partyRecordToPokemon(decodePartyMon(s,slot))); }
function drain<T>(p: Program<T>): T { for(let n=0;n<10000;n++){ const r=p.next();if(r.done)return r.value; }throw new Error('program did not finish'); }
function harness() { const r=battleLedger({reserves:1});seed(r.s);return r; }
function presentation(r: ReturnType<typeof harness>) { return {screen:r.screen,video:r.video,partyView:r.party,readJoypad:()=>{},pressSound:()=>{}}; }
function partyHost(r: ReturnType<typeof harness>): BattlePartyHost {
  return {...r.host,partyView:r.party,statusView:null,loadEnemyPicVariant:function*(){},switchPlayerMon:function*(){}};
}
it('refresh preserves array and object identity, writes only changed HP, and changes no memory or RNG',()=>{
  const s=seed(),array=s.partyMons,held=s.partyMons[0]!;
  const original=held.originalStats;held.originalStats={special:original.special,speed:original.speed,defense:original.defense,attack:original.attack};
  const draw=vi.spyOn(Math,'random').mockImplementation(()=>{throw new Error('unexpected draw');});
  const random=vi.spyOn(s,'random').mockImplementation(()=>{throw new Error('unexpected battle draw');});
  const writes:string[]=[];
  for(const key of Object.keys(held) as (keyof BattlePokemon)[]) {
    let value:unknown=held[key];Object.defineProperty(held,key,{enumerable:true,configurable:true,get:()=>value,set:v=>{writes.push(key);value=v;}});
  }
  s.writeBE(A.wPartyMons+1,12);const mem=s.mem.slice();
  expect(refreshPartyMon(s,0)).toBe(held);expect(s.partyMons).toBe(array);expect(held.currentHp).toBe(12);
  expect(writes).toEqual(['currentHp']);expect(s.mem).toEqual(mem);expect(draw).not.toHaveBeenCalled();expect(random).not.toHaveBeenCalled();equal(s);
});
it('refresh creates null slots, visits the last counted slot, and leaves slots at or beyond count untouched',()=>{
  const s=seed();s.partyMons[0]=null;const later=createPokemon('PIKACHU',5)!;s.partyMons[2]=later;
  s.writeBE(A.wPartyMons+44+1,3);const list=refreshPartyMirror(s);
  expect(list).toHaveLength(2);expect(list[0]!.species.id).toBe(16);expect(list[1]!.currentHp).toBe(3);expect(s.partyMons[2]).toBe(later);equal(s);equal(s,1);
});
it('refresh propagates MissingNo and NULL-name errors without writing bytes',()=>{
  const s=seed();s.mem[A.wPartyMons]=0;expect(()=>refreshPartyMon(s,0)).toThrow();
  s.mem[A.wPartyMons]=0x24;s.mem[A.wPartyMonNicks]=0;expect(()=>refreshPartyMon(s,0)).toThrow(/NULL/);
});
it('codec imports stay within the seven allowed low-level modules; party addresses are pinned',()=>{
  const source=readFileSync('src/battle/battle_party_codec.ts','utf8');
  const imports=[...source.matchAll(/(?:import|export)[\s\S]*?from ['"]([^'"]+)['"]/g)].map(m=>m[1]);
  expect([...new Set(imports)].sort()).toEqual(['./battle_state','./battle_text_codec','./battle_move_data','./data','./battle_loaders','../rom/constants','./types'].sort());
  expect([A.wPartyCount,A.wPartySpecies,D.wPartyCount,D.wPartySpecies]).toEqual([0xd162,0xd163,0xd162,0xd163]);
});
it('decrementPP, incrementMovePP and HP/status write-back refresh the whole cached record',()=>{
  const s=seed();s.wPlayerMonNumber=0;s.wPlayerMoveListIndex=0;s.mem[A.wBattleMonPP]=5;
  s.writeBE(A.wPartyMons+36,123);decrementPP(s,33);expect(s.partyMons[0]!.moves[0].pp).toBe(4);equal(s);
  s.writeBE(A.wPartyMons+38,124);incrementMovePP(s);expect(s.partyMons[0]!.moves[0].pp).toBe(5);equal(s);
  s.wBattleMonHP=9;s.wBattleMonStatus=3;readPlayerMonCurHPAndStatus(s);expect(s.partyMons[0]!.sleepTurns).toBe(3);equal(s);
});
it('Ether refreshes all fields after the packed PP write',()=>{
  const s=seed();s.wWhichPokemon=0;s.wCurrentMenuItem=0;s.mem[I.wCurItem]=0x50;s.writeBE(A.wPartyMons+36,222);
  expect(restorePartyMovePP(s)).toBe(true);expect(s.partyMons[0]!.moves[0].pp).toBe(15);equal(s);
});
for(const [name,id,hp,status] of [['heal',0x14,5,0],['cure',0x0b,10,8],['revive',0x35,0,0]] as const) it(`medicine ${name} refreshes the completed party record`,()=>{
  const r=harness(),s=r.s;s.wWhichPokemon=0;s.mem[I.wCurItem]=id;s.setBag([{id,quantity:2}]);
  s.writeBE(A.wPartyMons+1,hp);s.mem[A.wPartyMons+4]=status;s.writeBE(A.wPartyMons+36,321);
  // Ensure cure must change the existing object's status as well as its unrelated stale stat.
  if(status)s.partyMons[0]!.status='PSN';
  const host:BattleItemHost={...r.host,audio:r.bridge,sounds:new Map(),printText:function*(){},waitForSound:function*(){yield 'serviced';}};
  const env:MedicineItemEnvironment={displayPartyMenu:function*(){return 0;},animateHpBar:function*(){},clearScreen:function*(){},redrawPartyMenu:function*(){},gbPalWhiteOut(){},runDefaultPaletteCommand:function*(){}};
  const p=itemUseMedicine(s,host,env);p.next();equal(s);expect(s.partyMons[0]!.attack).toBe(321);
  expect(s.partyMons[0]!.currentHp).toBe(name==='heal'?25:name==='revive'?Math.floor(s.readBE(A.wPartyMons+34)/2):10);
  if(name==='cure')expect(s.partyMons[0]!.status).toBe(null);
});
it('learnMove refreshes the learned move and unrelated stale data',()=>{
  const r=harness(),s=r.s;s.wWhichPokemon=0;s.mem[D.wMoveNum]=45;s.mem[D.wStringBuffer]=0x50;s.writeBE(A.wPartyMons+36,234);
  const host={...r.host,printText:function*(){}};drain(learnMove(s,host));
  expect(s.partyMons[0]!.moves[1]?.id).toBe('GROWL');equal(s);
});
it('EXP level-up refreshes level, stats, stat experience and EXP from bytes',()=>{
  const r=harness(),s=r.s;s.mem[A.wPartyCount]=1;s.mem[A.wPartySpecies+1]=255;s.writeBE(A.wPartyMons+15,9260);
  s.mem[D.wPartyGainExpFlags]=1;s.wEnemyMonBaseExp=255;s.wEnemyMonLevel=50;
  const host={...r.host,printText:function*(){},readScrollJoypad:()=>1,learnMove:function*(){return {b:0};}};
  drain(gainExperience(s,host));expect(s.partyMons[0]!.level).toBeGreaterThan(20);equal(s);
});
it('catch creates the new slot through the full codec',()=>{
  const r=harness(),s=r.s;s.wCurPartySpecies=0x24;s.wCurEnemyLevel=5;s.partyMons[2]=null;
  vi.spyOn(twoOption,'displayTwoOptionMenu').mockImplementation(function*(){s.mem[D.wMenuExitMethod]=2;s.wCurrentMenuItem=1;return {carry:false};});
  const host:BattleItemHost={...r.host,audio:r.bridge,sounds:new Map(),printText:function*(){},waitForSound:function*(){yield 'serviced';}};
  drain(addPartyMon(s,{state:s,host,menu:r.host,video:r.video,displayNamingScreen:function*(){}}));
  expect(s.mem[A.wPartyCount]).toBe(3);expect(s.partyMons[2]).not.toBeNull();equal(s,2);
});
it('send-out chooser opens with fresh objects after a direct byte change',()=>{
  const r=harness();r.s.writeBE(A.wPartyMons+1,7);const open=vi.spyOn(r.party,'openBattleChoice');
  choosePartyForSendOut(r.s,r.host,true).next();expect(open.mock.calls[0][0][0].currentHp).toBe(7);equal(r.s);
});
for(const wrapper of [false,true])it(`use-item opening ${wrapper?'environment':'direct'} refreshes stale reserve status`,()=>{
  const r=harness();r.s.partyMons[1]!.status='SLP';r.s.partyMons[1]!.sleepTurns=3;r.s.mem[A.wPartyMons+44+4]=3;
  wakeUpEntireParty(r.s,A.wPartyMons+4);expect(r.s.partyMons[1]!.status).toBe('SLP');
  const show=vi.spyOn(r.party,'showForItem');const host=presentation(r);
  (wrapper?createMedicineItemEnvironment(r.s,host).displayPartyMenu():displayUseItemPartyMenu(r.s,host)).next();
  expect(show.mock.calls[0][0][1].status).toBeNull();equal(r.s,1);
});
it('defrost changes bytes alone, then the party binder refreshes the lead before opening',()=>{
  const r=harness(),s=r.s;s.partyMons[0]!.status='FRZ';s.mem[A.wPartyMons+4]=32;s.wBattleMonStatus=32;s.hWhoseTurn=1;s.wEnemyMoveType=20;
  drain(checkDefrost(s,{host:{...r.host,printText:function*(){}},animation:function*(){}} satisfies StatusEffectEnvironment));
  expect(s.partyMons[0]!.status).toBe('FRZ');const host=partyHost(r),open=vi.spyOn(r.party,'openBattleChoice');
  bindStateBattlePartyMenu(s,host);host.partyMenu(battleContext(s)).next();
  expect(open.mock.calls[0][0][0].status).toBeNull();equal(s);
});
for(const path of ['SWITCH','STATS','AlreadyOut','NoWill'] as const)it(`Pidgey ${path} writes internal24 to both species cells`,()=>{
  const r=harness(),s=r.s,host=partyHost(r);s.wPlayerMonNumber=path==='AlreadyOut'?1:0;
  s.writeBE(A.wPartyMons+44+1,path==='NoWill'?0:17);
  vi.spyOn(r.party,'frameBattleChoice').mockReturnValue({kind:'chosen',slot:1});
  vi.spyOn(MenuInput.prototype,'update').mockImplementation(function(this:MenuInput){this.item=path==='STATS'?1:0;return ['a'];});
  const status=vi.fn((mon:BattlePokemon,options:{syncRead:boolean})=>{void mon;void options;return {frame:()=> 'done' as const,render(){},paletteWhite:false,tiles:new ScreenTiles()};});host.createStatusScreen=status;
  const print=vi.spyOn(r.party,'printBattleChoiceText').mockImplementation(function*(){});
  const switched=vi.spyOn(host,'switchPlayerMon');bindStateBattlePartyMenu(s,host);const p=host.partyMenu(battleContext(s));
  p.next();p.next();p.next();
  expect([s.wCurPartySpecies,s.wBattleMonSpecies2]).toEqual([0x24,0x24]);equal(s,1);
  if(path==='STATS'){expect(status).toHaveBeenCalledWith(s.partyMons[1],{syncRead:false});expect(status.mock.calls[0][0]!.currentHp).toBe(17);}
  if(path==='AlreadyOut')expect(print).toHaveBeenCalledWith('AlreadyOutText',expect.anything());
  if(path==='NoWill')expect(print).toHaveBeenCalledWith('NoWillText');
  if(path==='SWITCH'){for(let i=0;i<20;i++){if(p.next().done)break;}expect(switched).toHaveBeenCalled();}
});
it('SWITCH loads Pidgey header without repairing the selected internal species cell',()=>{
  const r=harness(),host=partyHost(r),s=r.s;s.wWhichPokemon=1;s.wCurPartySpecies=s.wBattleMonSpecies2=0x24;
  const species=s.species;s.species=id=>{expect(id).toBe(0x24);return species!(id);};
  bindPlayerSwitch(s,host,{...r.host,printText:function*(){},waitForSound:function*(){},animation:function*(){}});drain(host.switchPlayerMon(battleContext(s)));expect(s.wBattleMonSpecies).toBe(0x24);
});
