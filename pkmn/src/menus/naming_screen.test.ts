import { beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
const output=vi.hoisted(()=>({log:[] as unknown[][]}));
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
vi.mock('../renderer',async orig=>({...await orig() as object,
 fillRect:(...a:unknown[])=>output.log.push(['fill',...a]),
 drawTile:(canvas:{asset:string},...a:unknown[])=>output.log.push(['tile',canvas.asset,...a]),
 loadFont:async(asset:string)=>({asset,width:8,height:8}),loadTileset:async(asset:string)=>({asset,width:24,height:8})}));
vi.mock('./menu_render',()=>({drawText:(...a:unknown[])=>output.log.push(['text',...a]),drawChar:(...a:unknown[])=>output.log.push(['char',...a])}));
vi.mock('../text',async orig=>({...await orig() as object,drawTileBorder:(...a:unknown[])=>output.log.push(['border',...a]),getFontCanvas:()=>({asset:'font'})}));
vi.mock('./party_icons',()=>({drawPartyIcon:(...a:unknown[])=>output.log.push(['icon',...a])}));
vi.mock('../audio',async orig=>({...await orig() as object,playSFX:(...a:unknown[])=>output.log.push(['sfx',...a])}));
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setKey,updateInput } from '../input';
import type { GameButton } from '../core';
import { NamingScreen,loadEdTile } from './naming_screen';

const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
let lastFrame:unknown[][]=[];
beforeAll(async()=>{await loadEdTile();});
beforeEach(()=>{keys.forEach(k=>setKey(k,false));updateInput();output.log.length=0;lastFrame=[];});
function frame(n:Pick<NamingScreen,'update'|'render'>,pressed:GameButton[]=[]){
 const at=output.log.length;output.log.push(['input',...pressed]);
 keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();const result=n.update();
 output.log.push(['result',result]);n.render();output.log.push(['end']);lastFrame=output.log.slice(at);return result;
}
function press(n:Pick<NamingScreen,'update'|'render'>,key:GameButton){const result=frame(n,[key]);frame(n);return result;}
const cursor=(x:number,y:number)=>expect(lastFrame).toContainEqual(['char','▶',x,y]);
const underscores=()=>lastFrame.filter(row=>row[0]==='tile'&&row[1]==='/gfx/font/font_battle_extra.png');
const hashes={player:'df8f8b766d33ff3ec75d0df876eca63f12996a5f7d6cc2f889bdb7f611b325cb',rival:'218b174036d79cc64730dd66e863598fdefdaf2ac320f538b783ae1fd86a693a'};
const traceKeys:GameButton[]=['start','a','right','a','down','down','down','down','down','a','up','left','left','a','b','b','select',
 'a','a','a','a','a','a','a','a','a','a','start'];

describe('pre-edit player and rival behavior',()=>{
 it.each(['player','rival'] as const)('%s label, empty START, seven letters, B, ED and sounds',type=>{
  const n=new NamingScreen();n.show(type);frame(n);
  expect(lastFrame).toContainEqual(['text',type==='player'?'YOUR NAME?':"RIVAL's NAME?",8,8]);
  expect(press(n,'start')).toBeNull();expect(n.active).toBe(true);expect(n.result).toBeNull();
  for(let i=0;i<7;i++)expect(press(n,'a')).toBeNull();
  expect(lastFrame).toContainEqual(['text','Aaaaaaa',80,16]);cursor(136,104);
  expect(underscores()).toHaveLength(7);expect(underscores().every(row=>row[2]===20)).toBe(true);
  press(n,'b');expect(lastFrame).toContainEqual(['text','Aaaaaa',80,16]);
  expect(underscores()).toContainEqual(['tile','/gfx/font/font_battle_extra.png',21,128,24]);
  expect(press(n,'a')).toBe('done');expect(n.result).toBe('Aaaaaa');expect(n.active).toBe(false);
  expect(output.log.filter(row=>row[0]==='sfx')).toEqual(Array.from({length:9},()=>['sfx','press_ab']));
 });
 it.each(['player','rival'] as const)('%s SELECT, case row and directional wraps retain their current behavior',type=>{
  const n=new NamingScreen();n.show(type);frame(n);cursor(8,40);
  press(n,'left');cursor(136,40);press(n,'right');cursor(8,40);
  press(n,'up');cursor(8,120);press(n,'down');cursor(8,40);
  press(n,'select');expect(lastFrame).toContainEqual(['text','UPPER CASE',16,120]);
  press(n,'up');press(n,'a');expect(lastFrame).toContainEqual(['text','lower case',16,120]);
  press(n,'down');for(let i=0;i<5;i++)press(n,'down');cursor(8,120);
  press(n,'up');cursor(8,104);press(n,'left');cursor(136,104);
  expect(output.log.filter(row=>row[0]==='sfx')).toEqual([['sfx','press_ab']]);
 });
 it.each(['player','rival'] as const)('%s full trace retains its pre-edit SHA256',type=>{
  const n=new NamingScreen();n.show(type);output.log.push(['show',type]);
  for(const key of traceKeys)press(n,key);output.log.push(['final',n.result,n.active]);
  expect(n.result).toBe('A,,,,,,');expect(n.active).toBe(false);
  const bytes=JSON.stringify(output.log),sha256=createHash('sha256').update(bytes).digest('hex');
  if(process.env.PKMN_RECORD_OLD_SCREENS){
   writeFileSync(`../notes/72-a5c3f-checkpoint-08e/pre-edit-${type}-trace.json`,bytes+'\n');
   console.log(JSON.stringify({type,sha256,calls:output.log.length,sounds:output.log.filter(r=>r[0]==='sfx').length}));
  }
  expect(sha256).toBe(hashes[type]);
 });
});

// Author the complete file on the old tree. Only these new-entry cases are deferred for the
// pre-edit run; ordinary runs always execute them. No test edits are needed after the module edit.
interface NicknameSubject {speciesName:string;dex:number;pressSound?:()=>void}
type NicknamePort=Omit<NamingScreen,'show'>&{show(type:'player'|'rival'|'nickname',subject?:NicknameSubject):void;readonly stringBuffer:readonly(string|null)[]};
const nickname=()=>new NamingScreen() as unknown as NicknamePort;
describe.skipIf(process.env.PKMN_SCREEN_BASELINE==='1')('nickname stand-in entry',()=>{
 it('a re-shown nickname screen starts its icon at counter one',()=>{
  const n=nickname(),subject={speciesName:'PIKACHU',dex:25};
  n.show('nickname',subject);frame(n);frame(n);frame(n);
  expect(lastFrame).toContainEqual(['icon',25,8,0,3,1]);
  n.show('nickname',subject);frame(n);
  expect(lastFrame).toContainEqual(['icon',25,8,0,1,1]);
 });
 it('requires exactly the nickname subject and accepts an empty submit',()=>{
  const n=nickname();expect(()=>n.show('nickname')).toThrow();
  expect(()=>n.show('player',{speciesName:'PIKACHU',dex:25})).toThrow();
  n.show('nickname',{speciesName:'PIKACHU',dex:25});expect(n.stringBuffer).toEqual(['@',...Array(10).fill(null)]);
  expect(press(n,'start')).toBe('done');expect(n.result).toBe('');expect(n.active).toBe(false);
 });
 it('draws the ASM header, ten underscores and full-HP icon, counting only updates',()=>{
  const n=nickname();n.show('nickname',{speciesName:'PIKACHU',dex:25});frame(n);
  expect(lastFrame).toContainEqual(['text','PIKACHU',32,8]);expect(lastFrame).toContainEqual(['text','NICKNAME?',8,24]);
  expect(lastFrame).toContainEqual(['icon',25,8,0,1,1]);expect(underscores()).toHaveLength(10);
  expect(underscores()).toContainEqual(['tile','/gfx/font/font_battle_extra.png',21,80,24]);
  const at=output.log.length;n.render();expect(output.log.slice(at)).toContainEqual(['icon',25,8,0,1,1]);
  frame(n);expect(lastFrame).toContainEqual(['icon',25,8,0,2,1]);
 });
 it('fills ten characters, moves to ED and submits on the eleventh A',()=>{
  const n=nickname();n.show('nickname',{speciesName:'PIKACHU',dex:25});
  for(let i=0;i<10;i++)expect(press(n,'a')).toBeNull();
  expect(n.active).toBe(true);cursor(136,104);expect(lastFrame).toContainEqual(['text','Aaaaaaaaaa',80,16]);
  expect(press(n,'a')).toBe('done');expect(n.result).toBe('Aaaaaaaaaa');
 });
 it('B twice writes the exact eleven string-buffer cells and the caller owns every A/B beep',()=>{
  const own=vi.fn(),n=nickname();n.show('nickname',{speciesName:'PIKACHU',dex:25,pressSound:own});
  for(let i=0;i<10;i++)press(n,'a');press(n,'b');press(n,'b');
  expect(n.stringBuffer).toEqual(['A',...Array(7).fill('a'),'@','@','@']);
  expect(press(n,'a')).toBe('done');expect(n.result).toBe('Aaaaaaaa');
  expect(own).toHaveBeenCalledTimes(13);expect(output.log.some(row=>row[0]==='sfx')).toBe(false);
 });
 it('keeps lowercase and a symbol from each row in stringBuffer, then resets to the player path',()=>{
  const n=nickname();n.show('nickname',{speciesName:'PIKACHU',dex:25});
  press(n,'a');press(n,'right');press(n,'a');for(let i=0;i<3;i++)press(n,'down');press(n,'a');press(n,'down');press(n,'a');
  expect(n.stringBuffer).toEqual(['A','b','(','?','@',...Array(6).fill(null)]);
  n.show('player');frame(n);expect(lastFrame).toContainEqual(['text','YOUR NAME?',8,8]);expect(underscores()).toHaveLength(7);
  expect(press(n,'start')).toBeNull();for(let i=0;i<7;i++)press(n,'a');cursor(136,104);
  expect(press(n,'a')).toBe('done');expect(n.result).toBe('Aaaaaaa');
 });
});
