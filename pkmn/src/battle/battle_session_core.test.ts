import { beforeAll, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import ts from 'typescript';
import { BattleState } from './battle_state';
import { battleRandom, random } from './battle_random';
import { RANDOM_CYCLES } from './battle_random_cycles';
import { randomizeDamage } from './battle_damage_asm';
import { createSessionRandom, loadBattleSessionData, mapTileAnimations, tilesetAnimations, createBattleSession, TILESET_ANIMATIONS } from './battle_session';
import { battleWorld } from '../test/battle_world_fixture';
import { rig } from '../test/audio_rig';
import { INIT } from './battle_init';

const coldFetches=new Map<string,number>();
beforeAll(async()=>{
 const io=globalThis.fetch;
 const spy=vi.spyOn(globalThis,'fetch').mockImplementation((url,init)=>{const name=String(url);coldFetches.set(name,(coldFetches.get(name)??0)+1);return io(url,init);});
 try{await loadBattleSessionData(async file=>{
  const image=PNG.sync.read(readFileSync('static/'+file));return {width:image.width,height:image.height,data:image.data};
 });}finally{spy.mockRestore();}
});

it('cold session startup fetches main and session tables once even without main preloading them',()=>{
 expect(coldFetches.size).toBe(47);
 for(const [name,count] of coldFetches)expect(count,name).toBe(1);
});

it('DIV samples the two Random_ reads at220 and264 T-cycles on the non-link path',()=>{
 const rng=createSessionRandom(()=>0),s=new BattleState();rng.attach(s);
 expect(battleRandom(s)).toBe(1);expect(s.hRandomSub).toBe(255);
 expect(RANDOM_CYCLES).toEqual({frame:70224,battlePrefix:40,beforeFirst:180,read:12,betweenReads:32,afterSecond:172});
 // First DIV=0, second DIV=1; then the full return has reached448.
 expect(rng.readDIV()).toBe(1);rng.detach(s);
 const home=createSessionRandom(()=>0),other=new BattleState();home.attach(other);
 random(other,0);expect([other.hRandomAdd,other.hRandomSub]).toEqual([0,0]);
 // Direct Random has no40-cycle BattleRandom prefix and returns at408.
 expect(home.readDIV()).toBe(1);home.detach(other);
});
it('DIV advances inside a frame and resets t on every new frame, whose increments are274 or275',()=>{
 let frame=0;const rng=createSessionRandom(()=>frame),s=new BattleState();rng.attach(s);
 expect(Array.from({length:24},()=>rng.readDIV())).toEqual([...Array(22).fill(0),1,1]);
 for(let n=0;n<10;n++)battleRandom(s);
 const actual:number[]=[];
 for(frame=1;frame<=5;frame++)actual.push(rng.readDIV());
 expect(actual).toEqual([18,36,54,73,91]);rng.detach(s);
});
it('the even-step frozen DIV damage loop is rejected within a bound and the real cycle model terminates it',()=>{
 const frame=4,div=Math.floor(frame*70224/256)&255;expect(div).toBe(73);
 let add=0,accepted=false;
 for(let n=0;n<1024;n++){
  add=(add+div+1)&255;const rotated=(add>>>1)|((add&1)<<7);
  if(rotated>=217){accepted=true;break;}
 }
 expect(accepted).toBe(false);expect(add&1).toBe(0);
 const rng=createSessionRandom(()=>frame),s=new BattleState();rng.attach(s);s.wDamage=100;
 randomizeDamage(s);expect(s.wDamage).toBeGreaterThanOrEqual(85);expect(s.wDamage).toBeLessThanOrEqual(100);rng.detach(s);
});
it('identical frame sequences replay identical rolls and HRAM, including both random entry paths',()=>{
 const replay=()=>{let frame=0;const rng=createSessionRandom(()=>frame),s=new BattleState();rng.attach(s);s.hRandomAdd=17;s.hRandomSub=91;
  const rolls=[0,0,1,1,99,99,100].map((f,i)=>{frame=f;const value=i%2?random(s,0):battleRandom(s);return [value,s.hRandomSub];});
  rng.detach(s);return {rolls,add:rng.hRandomAdd,sub:rng.hRandomSub};};
 expect(replay()).toEqual(replay());
});
it('the species and session sources import no node module',()=>{
 for(const name of ['battle_trainer_party','battle_trainer_data','battle_session']){
  const source=ts.createSourceFile(name,readFileSync(`src/battle/${name}.ts`,'utf8'),ts.ScriptTarget.Latest,true);
  const imports:string[]=[];
  const visit=(node:ts.Node)=>{
   if(ts.isStringLiteral(node)&&node.text.startsWith('node:'))imports.push(node.text);
   ts.forEachChild(node,visit);
  };visit(source);expect(imports,name).toEqual([]);
 }
});
it('every committed map uses its tileset header animation, including Forest1, Dojo2 and Gym2',()=>{
 const files=readdirSync('data/maps').filter(name=>name.endsWith('.json'));expect(files).toHaveLength(24);
 for(const file of files){
  const map=JSON.parse(readFileSync('data/maps/'+file,'utf8')) as {name:string;tileset:string};
  const expected=['OVERWORLD','DOJO','GYM'].includes(map.tileset)?2:['FOREST','CAVERN','SHIP','SHIP_PORT','FACILITY','PLATEAU'].includes(map.tileset)?1:0;
  const engines=rig();const session=createBattleSession(battleWorld({mapName:map.name}),{random:createSessionRandom(()=>0),audio:()=>({sfx:engines.sfx,music:engines.music,banks:engines.fade.requests})});
  expect(mapTileAnimations(map.name),map.name).toBe(expected);
  expect(session.state.mem[INIT.wSavedTileAnimations],map.name).toBe(expected);
 }
 expect(mapTileAnimations('ViridianForest')).toBe(1);expect(tilesetAnimations('GYM')).toBe(2);expect(tilesetAnimations('DOJO')).toBe(2);
 expect(Object.keys(TILESET_ANIMATIONS)).toHaveLength(25);
});
it('unknown maps and tilesets throw instead of silently choosing no animation',()=>{
 expect(()=>tilesetAnimations('UNRECOGNIZED')).toThrow(/unknown tileset/);
 expect(()=>tilesetAnimations('toString')).toThrow(/unknown tileset/);
 expect(()=>mapTileAnimations('UNRECOGNIZED')).toThrow(/unknown battle map/);
});
