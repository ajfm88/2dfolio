import { beforeEach,describe,expect,it,vi } from 'vitest';
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
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { setKey,updateInput } from '../input';
import type { GameButton } from '../core';
import { restorePokedex } from '../pokedex_state';
import { PokedexMenu } from './pokedex';

const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
let lastFrame:unknown[][]=[];
const fetchData=vi.fn(async(url:RequestInfo|URL)=>({json:async()=>JSON.parse(readFileSync('static/'+String(url),'utf8'))} as Response));
beforeEach(()=>{
 keys.forEach(k=>setKey(k,false));updateInput();restorePokedex([],[]);output.log.length=0;lastFrame=[];
 fetchData.mockClear();vi.stubGlobal('fetch',fetchData);
});
async function frame(p:PokedexMenu,pressed:GameButton[]=[]){
 const at=output.log.length;output.log.push(['input',...pressed]);keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();
 const result=p.update();await Promise.resolve();output.log.push(['result',result]);p.render();output.log.push(['end']);lastFrame=output.log.slice(at);return result;
}
async function press(p:PokedexMenu,key:GameButton){const result=await frame(p,[key]);await frame(p);return result;}
const text=(label:string,x:number,y:number)=>expect(lastFrame).toContainEqual(['text',label,x,y]);
const traceKeys:GameButton[]=['down','down','down','a','a','a','a','b','a','a','b','down','a','b','b','up','up','up','a','a','a','b','b'];

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
 it('keeps seen-only DATA, side-menu wrapping, QUIT, AREA and B exits',async()=>{
  restorePokedex([1],[]);const p=new PokedexMenu();await p.show('ViridianCity');
  await press(p,'a');text('▶',120,64);text('▷',0,24);
  await press(p,'a');text('BULBASAUR',72,16);text('?',104,48);text('??',120,48);text('WT   ???lb',72,64);
  expect(lastFrame.some(r=>r[0]==='text'&&r[2]===8&&Number(r[3])>=88)).toBe(false);
  expect(await press(p,'b')).toBe('open');text('▶',120,64);
  await press(p,'up');text('▶',120,96);await press(p,'a');text('▶',0,24);
  await press(p,'a');await press(p,'down');text('▶',120,80);await press(p,'a');
  text('BULBASAUR’s NEST',8,0);text('AREA UNKNOWN',32,72);
  expect(await press(p,'b')).toBe('open');text('▶',120,80);
  expect(await press(p,'b')).toBe('open');text('▶',0,24);expect(await press(p,'b')).toBe('closed');
  expect(output.log.filter(r=>r[0]==='sfx')).toEqual(Array.from({length:9},()=>['sfx','press_ab']));
 });
 it('keeps owned height, weight, descriptions, page two and return to the side menu',async()=>{
  restorePokedex([4],[4]);const p=new PokedexMenu();await p.show();for(let i=0;i<3;i++)await press(p,'down');
  await press(p,'a');await press(p,'a');text('CHARMANDER',72,16);text('2',104,48);text('00',120,48);
  text('WT  19.0lb',72,64);text('The flame at the',8,88);text('▼',144,128);
  expect(await press(p,'a')).toBe('open');text('it burns. You can',8,88);
  expect(await press(p,'b')).toBe('open');text('▶',120,64);
  expect(await press(p,'b')).toBe('open');expect(await press(p,'b')).toBe('closed');
 });
 it('keeps the full list/DATA/AREA/QUIT trace SHA256',async()=>{
  restorePokedex([25,1,4],[25,4]);const p=new PokedexMenu();await p.show('ViridianCity');output.log.push(['show','ViridianCity']);
  for(const key of traceKeys)await press(p,key);
  const bytes=JSON.stringify(output.log),sha256=createHash('sha256').update(bytes).digest('hex');
  if(process.env.PKMN_RECORD_OLD_SCREENS){writeFileSync('../notes/72-a5c3f-checkpoint-08e/pre-edit-pokedex-trace.json',bytes+'\n');console.log(JSON.stringify({type:'pokedex',sha256,calls:output.log.length}));}
  expect(sha256).toBe('a57ab9a3db98d426e2d5b3a2bcedb4f94e9b5f97e9173c0023c079e672e5f9bf');
 });
});

// Complete file authored before either screen module changes. Default runs include the new API.
type DataPort=PokedexMenu&{load():Promise<void>;showData(dex:number,options:{owned:boolean;pressSound?:()=>void}):void};
const dataMenu=()=>new PokedexMenu() as DataPort;
describe.skipIf(process.env.PKMN_SCREEN_BASELINE==='1')('single-species stand-in entry',()=>{
 it('requires loading; load and show reuse tables and tiles',async()=>{
  const p=dataMenu();expect(()=>p.showData(7,{owned:true})).toThrow(/not loaded/);
  await p.load();expect(fetchData).toHaveBeenCalledTimes(3);await p.load();expect(fetchData).toHaveBeenCalledTimes(3);
  restorePokedex([1],[]);await p.show();expect(fetchData).toHaveBeenCalledTimes(3);await frame(p);text('CONTENTS',8,8);text('BULBASAUR',32,24);
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
