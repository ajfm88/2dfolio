import { beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
const output=vi.hoisted(()=>({log:[] as unknown[][]}));
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
vi.mock('../renderer',async orig=>({...await orig() as object,
 fillRect:(...a:unknown[])=>output.log.push(['fill',...a]),getScale:()=>1,
 getCtx:()=>new Proxy({}, {get:(_t,k)=>(...a:unknown[])=>output.log.push(['ctx',String(k),...a]),set:(_t,k,v)=>{output.log.push(['ctx=',String(k),v]);return true;}}),
 loadTileset:async(asset:string,palette:string)=>({asset,palette,width:24,height:8}),
 loadSprite:async(asset:string,palette:string)=>({asset,palette,width:16,height:16})}));
vi.mock('./menu_render',()=>({drawText:(...a:unknown[])=>output.log.push(['text',...a]),drawBox:(...a:unknown[])=>output.log.push(['box',...a])}));
vi.mock('../battle',()=>({loadPokemonSprites:async(name:string,dex:number)=>({front:{asset:name,dex,width:56,height:56}})}));
vi.mock('../audio',async orig=>({...await orig() as object,playSFX:(...a:unknown[])=>output.log.push(['sfx',...a])}));
import { readFileSync } from 'node:fs';
import { setKey,updateInput } from '../input';
import type { GameButton } from '../core';
import { restorePokedex } from '../pokedex_state';
import { PokedexMenu } from './pokedex';
import { loadBattleData } from '../battle/data';

const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
let lastFrame:unknown[][]=[];
const fetchData=vi.fn(async(url:RequestInfo|URL)=>({json:async()=>JSON.parse(readFileSync('static/'+String(url),'utf8'))} as Response));
beforeAll(()=>loadBattleData()); // MonsterNames, loaded at startup in the game
beforeEach(()=>{
 keys.forEach(k=>setKey(k,false));updateInput();restorePokedex([],[]);output.log.length=0;lastFrame=[];
 fetchData.mockClear();vi.stubGlobal('fetch',fetchData);
});
async function frame(p:PokedexMenu,pressed:GameButton[]=[]){
 const at=output.log.length;output.log.push(['input',...pressed]);keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();
 const result=p.update();await Promise.resolve();output.log.push(['result',result]);p.render();output.log.push(['end']);lastFrame=output.log.slice(at);return result;
}
async function press(p:PokedexMenu,key:GameButton){const result=await frame(p,[key]);for(let i=0;i<3;i++)await frame(p);return result;}
const text=(label:string,x:number,y:number)=>expect(lastFrame).toContainEqual(['text',label,x,y]);

describe('pre-edit Pokédex behavior',()=>{
 it('keeps list scrolling, paging, unseen placeholders, counts and navigation sounds',async()=>{
  restorePokedex([1,4,7,25],[4,25]);const p=new PokedexMenu();await p.show('ViridianCity');await frame(p);
  text('001',8,16);text('BULBASAUR',32,24);text('----------',32,40);text('▶',0,24);
  for(let i=0;i<6;i++)await press(p,'down');text('▶',0,120);
  await press(p,'down');text('002',8,16);await press(p,'right');text('009',8,16);
  await press(p,'left');text('002',8,16);text('▶',0,24);await press(p,'up');text('001',8,16);
  expect(output.log.some(row=>row[0]==='sfx')).toBe(false);
  await press(p,'down');expect(await press(p,'a')).toBe('open');text('▶',0,40);
  expect(await press(p,'b')).toBe('closed');
  expect(output.log.filter(r=>r[0]==='sfx')).toEqual([['sfx','press_ab'],['sfx','press_ab']]);
 });
 it('prints MonsterNames in the list and on a data page, through MEW',async()=>{ // V5e checkpoint-01
  restorePokedex([29,32,122,151],[32]);const p=new PokedexMenu();await p.show('ViridianCity');await frame(p);
  const labels=()=>output.log.filter(r=>r[0]==='text').map(r=>r[1]);
  const shown=(label:string)=>lastFrame.some(r=>r[0]==='text'&&r[1]===label);
  for(let i=0;i<31;i++)await press(p,'down');
  expect(shown('NIDORAN♀')).toBe(true);expect(shown('NIDORAN♂')).toBe(true);
  for(let i=0;i<119;i++)await press(p,'down');
  expect(labels()).toContain('MR.MIME');expect(shown('MEW')).toBe(true);
  await press(p,'a');output.log.length=0;await press(p,'a');expect(labels()).toContain('MEW');
  for(const key of ['NIDORAN-F','NIDORAN-M','MR. MIME'])expect(labels()).not.toContain(key);
 });
 it.each([[29,'NIDORAN♀'],[32,'NIDORAN♂'],[122,'MR.MIME']] as const)('dex %i prints %s on its data page and its AREA title',async(dex,name)=>{ // V5e review
  restorePokedex([dex],[]);const p=new PokedexMenu();await p.show('ViridianCity');await frame(p);
  for(let i=0;i<dex-1;i++)await press(p,'down');
  await press(p,'a');await press(p,'a');text(name,72,16);
  expect(await press(p,'b')).toBe('open');await press(p,'down');await press(p,'down');await press(p,'a');text(name+'’s NEST',8,0);
 });
 it('lays out all five items, clamps, plays CRY after the beep and re-enters after CRY and PRNT',async()=>{
  const requestCry=vi.fn((id:number)=>{output.log.push(['cry',id]);});
  restorePokedex([1],[]);const p=new PokedexMenu({*cry(){},requestCry});await p.show('ViridianCity');
  await press(p,'a');
  text('▷',0,24);
  for(const [item,row] of [['DATA',8],['CRY',10],['AREA',12],['PRNT',14],['QUIT',16]] as const) text(item,128,row*8);
  await press(p,'up');text('\u25b6',120,64);
  await press(p,'down');text('\u25b6',120,80);
  const soundStart=output.log.length;
  await frame(p,['a']);
  expect(output.log.slice(soundStart).filter(row=>['sfx','cry'].includes(String(row[0])))).toEqual([['sfx','press_ab'],['cry',0x99]]);
  text('\u25b6',120,80);
  await frame(p);await frame(p,['a']);expect(requestCry).toHaveBeenCalledOnce();
  await frame(p);await press(p,'down');await press(p,'down');text('\u25b6',120,112);
  await frame(p,['a']);text('\u25b6',120,112);expect(requestCry).toHaveBeenCalledOnce();
  await frame(p);await frame(p,['down']);text('\u25b6',120,112); // PRNT re-enters through Delay3
  await frame(p);await press(p,'down');text('\u25b6',120,128);
  await press(p,'down');text('\u25b6',120,128);
  expect(await press(p,'a')).toBe('closed');
 });
 it.each([false,true])('data page waits for the host cry before exposing the entry (owned=%s)',async owned=>{
  const cry=vi.fn(function*(_species:number){yield 'serviced' as const;yield 'serviced' as const;});
  restorePokedex([1],owned?[1]:[]);const p=new PokedexMenu({cry,requestCry:vi.fn()});await p.show('ViridianCity');
  await press(p,'a');await frame(p,['a']);
  for(let i=0;i<2;i++)await frame(p);
  expect(cry).not.toHaveBeenCalled();
  await frame(p,['b']);expect(cry).toHaveBeenCalledExactlyOnceWith(0x99);
  text('WT   ???lb',72,64);
  await frame(p);text('WT   ???lb',72,64);
  await frame(p);text(owned?'WT  15.0lb':'WT   ???lb',72,64);
  if(!owned){
   text('?',104,48);text('??',120,48);
   expect(lastFrame.some(r=>r[0]==='text'&&r[2]===8&&Number(r[3])>=88)).toBe(false);
   expect(await press(p,'b')).toBe('open');
   await press(p,'down');await press(p,'down');await press(p,'a');
   text('AREA UNKNOWN',32,72);
  }
 });
 it('keeps owned height, weight, descriptions, page two and return to the side menu',async()=>{
  restorePokedex([4],[4]);const p=new PokedexMenu();await p.show();for(let i=0;i<3;i++)await press(p,'down');
  await press(p,'a');await press(p,'a');text('CHARMANDER',72,16);text('2',104,48);text('00',120,48);
  text('WT  19.0lb',72,64);text('The flame at the',8,88);text('▼',144,128);
  expect(await press(p,'a')).toBe('open');text('it burns. You can',8,88);
  expect(await press(p,'b')).toBe('open');text('▶',120,64);
  expect(await press(p,'b')).toBe('open');expect(await press(p,'b')).toBe('closed');
 });

});

// Complete file authored before either screen module changes. Default runs include the new API.
type DataPort=PokedexMenu&{load():Promise<void>;showData(dex:number,options:{owned:boolean;pressSound?:()=>void}):void};
const dataMenu=()=>new PokedexMenu() as DataPort;
describe.skipIf(process.env.PKMN_SCREEN_BASELINE==='1')('single-species stand-in entry',()=>{
 it('requires loading; load and show reuse tables and tiles',async()=>{
  const p=dataMenu();expect(()=>p.showData(7,{owned:true})).toThrow(/not loaded/);
  await p.load();expect(fetchData).toHaveBeenCalledTimes(2);await p.load();expect(fetchData).toHaveBeenCalledTimes(2);
  restorePokedex([1],[]);await p.show();expect(fetchData).toHaveBeenCalledTimes(2);await frame(p);text('CONTENTS',8,8);text('BULBASAUR',32,24);
 });
 it.each(['a','b'] as const)('uses caller-owned state for a new catch, page two and %s exit, with caller sounds',async exit=>{
  const p=dataMenu(),own=vi.fn();await p.load();p.showData(7,{owned:true,pressSound:own});await frame(p);
  text('SQUIRTLE',72,16);text('TINYTURTLE',72,32);text('1',104,48);text('08',120,48);text('WT  20.0lb',72,64);text('. 007',16,64);
  text('Shoots water at',8,88);expect(await press(p,'a')).toBe('open');text('Withdraws into',8,88);
  expect(await press(p,exit)).toBe('closed');expect(own).toHaveBeenCalledTimes(2);expect(output.log.some(r=>r[0]==='sfx')).toBe(false);
 });
 it.each(['a','b'] as const)('caller not-owned hides description despite global ownership; %s closes immediately',async exit=>{
  restorePokedex([7],[7]);const p=dataMenu();await p.load();p.showData(7,{owned:false});await frame(p);
  text('?',104,48);text('??',120,48);text('WT   ???lb',72,64);
  expect(lastFrame.some(r=>r[0]==='text'&&r[2]===8&&Number(r[3])>=88)).toBe(false);
  expect(await press(p,exit)).toBe('closed');expect(output.log.filter(r=>r[0]==='sfx')).toEqual([['sfx','press_ab']]);
 });
 it('B on owned page one closes, and show clears the single-species state for list DATA',async()=>{
  const p=dataMenu(),own=vi.fn();await p.load();p.showData(7,{owned:true,pressSound:own});
  expect(await press(p,'b')).toBe('closed');expect(own).toHaveBeenCalledTimes(1);
  p.showData(7,{owned:true,pressSound:own});restorePokedex([1],[]);await p.show('ViridianCity');await frame(p);text('CONTENTS',8,8);
  await press(p,'a');await press(p,'a');text('WT   ???lb',72,64);
  expect(await press(p,'b')).toBe('open');text('▶',120,64);expect(own).toHaveBeenCalledTimes(1);
 });
});
