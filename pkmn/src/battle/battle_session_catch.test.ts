import { beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
const output=vi.hoisted(()=>({volume:[] as string[],text:[] as unknown[][],assets:[] as string[],fallback:vi.fn()}));
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
vi.mock('../renderer',async orig=>({...await orig() as object,fillRect:vi.fn(),drawFadeOverlay:vi.fn(),drawTile:vi.fn(),
 getCtx:()=>({drawImage(){},save(){},restore(){},translate(){},scale(){}}),getScale:()=>1,getMonsterPalette:()=>'MEWMON',
 loadFont:async(path:string)=>{output.assets.push('font '+path);return {width:128};},
 loadTileset:async(path:string)=>{output.assets.push('tiles '+path);return {width:128};},
 loadSprite:async(path:string)=>{output.assets.push('sprite '+path);return {width:16};},
 loadBattleSprite:vi.fn(async()=>({width:40,height:40}))}));
vi.mock('../menus/party_icons',()=>({loadPartyIcons:vi.fn(async()=>{output.assets.push('icons');}),drawPartyIcon:vi.fn()}));
vi.mock('../menus/menu_render',()=>({drawText:(...a:unknown[])=>output.text.push(a),drawBox:vi.fn(),drawScreenTile:vi.fn(),drawChar:vi.fn()}));
vi.mock('../text',async orig=>({...await orig() as object,getFontCanvas:()=>({width:128}),drawTileBorder:vi.fn()}));
vi.mock('./battle_ui',async orig=>({...await orig() as object,loadPokemonSprites:async()=>({front:{width:56,height:56}})}));
vi.mock('../audio',async orig=>({...await orig() as object,playSFX:output.fallback,
 setMasterVolume:(l:number,r:number)=>output.volume.push(`vol ${l}${r}`)}));
vi.mock('../audio/audio_flags',async orig=>{
 const real=await orig() as typeof import('../audio/audio_flags');
 return {...real,setNoAudioFadeOut:(v:boolean)=>{output.volume.push(`fade ${v}`);real.setNoAudioFadeOut(v);}};
});
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { loadBattleData,createPokemon } from './data';
import { loadTextPrograms } from '../text/program_data';
import { battleWorld } from '../test/battle_world_fixture';
import { rig,musicData,sfxData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity,musicNameForSound } from '../audio/sound_ids';
import { setLowHealthAlarm,setLowHealthAlarmDisabled,setLowHealthChannel5 } from '../audio/low_health_alarm';
import { isNoAudioFadeOut,setNoAudioFadeOut } from '../audio/audio_flags';
import { setPlayerName,setRivalName } from '../core/player_state';
import { enablePikachuFollowing } from '../pikachu/pikachu_following';
import { resetListStateForEmptySlot } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { setKey,updateInput,syncJoypadRead } from '../input';
import { loadStatusScreenAssets } from '../menus/status_screen';
import { loadBattleSessionData,loadBattleStandInData,createBattleSession,createSessionRandom,type BattleForeground } from './battle_session';
import { A,BattleState,NAME_LENGTH } from './battle_state';
import { INIT } from './battle_init';
import { D } from './battle_end_state';
import { decodeBattleText } from './battle_text_codec';
import { BattleUnsupportedState } from './battle_move_data';
import type { BattleWorld } from './battle_bridge';
import type { GameButton } from '../core';

const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
const fetched:string[]=[];
beforeAll(async()=>{
 const real=globalThis.fetch;
 globalThis.fetch=(async(url:string)=>{fetched.push(String(url));
  try{return {ok:true,json:async()=>JSON.parse(readFileSync('static/'+url,'utf8'))};}catch{return real(url);}
 }) as unknown as typeof fetch;
 await loadBattleData();await loadTextPrograms();await loadBattleSessionData(async file=>{
  const p=PNG.sync.read(readFileSync('static/'+file));return {width:p.width,height:p.height,data:p.data};
 });await loadStatusScreenAssets();
});
beforeEach(()=>{
 keys.forEach(k=>setKey(k,false));updateInput();syncJoypadRead();resetListStateForEmptySlot();enablePikachuFollowing();
 textBgTransfer.enabled=true;textBgTransfer.resetPortion();setLowHealthAlarm(0);setLowHealthAlarmDisabled(false);setLowHealthChannel5(0);
 setNoAudioFadeOut(false);output.volume.length=0;output.text.length=0;output.assets.length=0;output.fallback.mockClear();
});
const pika=(level=20)=>{const m=createPokemon(25,level,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;m.moves=[{id:'TACKLE',pp:35,maxPp:35}];return m;};
type Plan={yes?:boolean;letters?:GameButton[];mode?:'catch'|'stats'};
function setup(overrides:Partial<BattleWorld>={}){
 const r=rig();let time=0;
 const banks=new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank)=>r.music.play(musicData(musicNameForSound(id,bank)!))));
 const world=battleWorld({party:[pika()],bag:[{id:'MASTER_BALL',count:1}],options:{textSpeed:'FAST',animation:'OFF',battleStyle:'SET'},...overrides});
 setPlayerName(world.playerName);setRivalName(world.rivalName);
 const random=createSessionRandom(()=>time);
 const hooks=[r.sfx.onSfxChannelDone,r.sfx.channelEnabled,r.sfx.beforeNextNote,r.sfx.onSoundIdsCleared,r.music.audioControl];
 const session=createBattleSession(world,{random,audio:()=>({sfx:r.sfx,music:r.music,banks})});
 const mapAnimations=session.state.mem[INIT.hTileAnimations];
 const installed=vi.spyOn(r.sfx,'installBattleSfx');
 const row=(y:number)=>Array.from({length:20},(_,x)=>{const c=session.screen.at(x,y);return typeof c==='string'?c:' ';}).join('');
 const foreground:BattleForeground[]=['battle'];
 const frames:{fg:BattleForeground;anim:number;flags2:number;flags5:number;counter:number;bgp:number;obp0:number;obp1:number}[]=[];
 const sounds:{fg:BattleForeground;key:GameButton;data:unknown[]}[]=[];
 let beforeNaming:number[]=[],nameBuffer:number[]=[],promptNameBuffer:number[]=[],afterDex:number|undefined,afterNaming:number|undefined,seeded=false;
 const run=(plan:Plan={},stop?:()=>boolean)=>{
  const letters=[...(plan.letters??[])],partyKeys:GameButton[]=['a','down','a'];let held:GameButton[]=[],dexCycles=0,namingCycles=0,partyCycles=0;
  banks.playMusic(musicIdentity('wildbattle')!);session.start();
  for(let n=0;!session.done&&n<20000;n++){
   if(time%4===0){
    const f=session.foreground;
    if(f==='pokedex')held=++dexCycles>10?['b']:[];
    else if(f==='naming')held=++namingCycles>5?[letters.shift()??'start']:[];
    else if(f==='status')held=[];
    else if(f==='party')held=++partyCycles>40?[partyKeys.shift()??'b']:[];
    else if(session.state.mem[A.hJoy7]===1)held=['a'];
    else if(row(14).includes('FIGHT')&&!session.video.textBox.active){
     // Battle initialization disables map animation. Seed its saved nonzero map value
     // at the first menu to make the dex push/pop independently observable before EndOfBattle.
     if(!seeded){session.state.mem[INIT.hTileAnimations]=mapAnimations;seeded=true;}
     if(plan.mode==='stats')held=row(14).indexOf('▶')>=14?['a']:['right'];
     else held=row(16).includes('▶')?['a']:['down'];
    }else if(row(8).includes('YES')&&!session.video.textBox.isWaitingForInput)held=plan.yes===false?['b']:['a'];
    else held=session.video.textBox.isWaitingForInput?['b']:['a'];
   }
   if(row(8).includes('YES')&&promptNameBuffer.length===0)promptNameBuffer=[...session.state.mem.slice(A.wNameBuffer,A.wNameBuffer+NAME_LENGTH)];
   const pressed=time%4<2?held:[],previous=session.foreground,at=installed.mock.calls.length;
   time++;keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();r.update();session.tick();
   const f=session.foreground;
   expect(['battle','party','partyItem','status','naming','pokedex']).toContain(f);
   if(f!==foreground[foreground.length-1]){
    foreground.push(f);
    if(f==='naming'){beforeNaming=[...session.state.mem.slice(A.wStringBuffer,A.wStringBuffer+NAME_LENGTH)];nameBuffer=[...session.state.mem.slice(A.wNameBuffer,A.wNameBuffer+NAME_LENGTH)];}
    if(previous==='pokedex')afterDex=session.state.mem[INIT.hTileAnimations];
    if(previous==='naming')afterNaming=session.state.mem[D.wAnimCounter];
   }
   if((previous==='naming'||previous==='pokedex')&&time%4===1&&pressed.some(k=>k==='a'||k==='b'))
    sounds.push({fg:previous,key:pressed[0],data:installed.mock.calls.slice(at).map(c=>c[0])});
   frames.push({fg:f,anim:session.state.mem[INIT.hTileAnimations],flags2:session.state.mem[D.wStatusFlags2],flags5:session.state.mem[D.wStatusFlags5],
    counter:session.state.mem[D.wAnimCounter],bgp:session.screen.bgp,obp0:session.screen.obp0,obp1:session.screen.obp1});
   if(f==='pokedex')session.pokedex.render();if(f==='naming')session.naming.render();
   if(stop?.())return;
  }
  expect(session.done,JSON.stringify({foreground,labels:session.textLog.slice(-6)})).toBe(true);
  return session.finish();
 };
 return {session,world,r,random,hooks,run,foreground,frames,sounds,mapAnimations,
  get beforeNaming(){return beforeNaming;},get nameBuffer(){return nameBuffer;},get promptNameBuffer(){return promptNameBuffer;},get afterDex(){return afterDex;},get afterNaming(){return afterNaming;}};
}
function complete(h:ReturnType<typeof setup>,plan:Plan={}){
 let result:ReturnType<typeof h.session.finish>|undefined;
 expect(()=>{result=h.run(plan);}).not.toThrow();expect(result).toBeDefined();return result!;
}
function detached(h:ReturnType<typeof setup>){
 const probe=new BattleState();expect(()=>h.random.attach(probe)).not.toThrow();h.random.detach(probe);
 expect([h.r.sfx.onSfxChannelDone,h.r.sfx.channelEnabled,h.r.sfx.beforeNextNote,h.r.sfx.onSoundIdsCleared,h.r.music.audioControl]).toEqual(h.hooks);
 expect(()=>h.session.tick()).toThrow(/aborted/);
}

describe('before the separate stand-in loader',()=>{
 it.each([false,true])('both catch homes name the not-loaded error (already owned=%s)',owned=>{
  const h=setup(owned?{owned:[25,19],seen:[25,19]}:{});
  try{expect(()=>h.run()).toThrow(new BattleUnsupportedState('stand-in screens not loaded'));}
  finally{h.session.abort();}
  detached(h);
 });
});
it('the separate loader fetches exactly three tables once, loads ED/icons and shares one Pokédex',async()=>{
 const at=fetched.length,pending=loadBattleStandInData();expect(loadBattleStandInData()).toBe(pending);await pending;
 expect(fetched.slice(at)).toEqual(['pokedex.json','pokemon.json','town_map.json']);
 expect(output.assets.filter(x=>x.startsWith('font '))).toEqual(['font /gfx/font/ED.png']);
 expect(output.assets.filter(x=>x.startsWith('tiles '))).toEqual([
  'tiles /gfx/town_map/town_map.png','tiles /gfx/pokedex/pokedex.png','tiles /gfx/battle/balls.png',
  'tiles /gfx/pokedex/pokedex.png','tiles /gfx/font/font_battle_extra.png','tiles /gfx/font/font_battle_extra.png']);
 expect(output.assets.filter(x=>x.startsWith('sprite '))).toEqual(['sprite /gfx/town_map/mon_nest_icon.png','sprite /gfx/sprites/red.png']);
 expect(output.assets.filter(x=>x==='icons')).toHaveLength(1);
 const assets=[...output.assets];await loadBattleStandInData();expect(fetched.slice(at)).toHaveLength(3);expect(output.assets).toEqual(assets);
 const a=setup(),b=setup();expect(a.session.pokedex).toBe(b.session.pokedex);a.session.abort();b.session.abort();
});
it('new Rattata: dex then YES and Abk, exact eleven bytes, flags, palettes and session-owned presses',()=>{
 const h=setup();const out=complete(h,{letters:['a','right','a','down','a']});
 expect(h.foreground).toEqual(['battle','pokedex','battle','naming','battle']);
 expect(out.outcome.party).toHaveLength(2);expect(out.outcome.box).toEqual([]);expect(out.outcome.owned).toContain(19);expect(out.outcome.bag).toEqual([]);
 expect([...out.outcome.party[1].nickname]).toEqual([0x80,0xa1,0xaa,0x50,0x84,0x91,0x7f,0x81,0x80,0x8b,0x8b]);
 expect(h.beforeNaming).toEqual([0x50,0x80,0x92,0x93,0x84,0x91,0x7f,0x81,0x80,0x8b,0x8b]);
 expect(output.volume).toEqual(['fade true','vol 33','fade false','vol 77']);expect(isNoAudioFadeOut()).toBe(false);
 expect(h.mapAnimations).toBe(2);expect(h.afterDex).toBe(2);
 const dex=h.frames.filter(f=>f.fg==='pokedex'),name=h.frames.filter(f=>f.fg==='naming');
 expect(dex.length).toBeGreaterThan(0);expect(dex.every(f=>f.anim===0&&(f.flags2&2)!==0&&f.bgp===0xe4&&f.obp0===0xd0)).toBe(true);
 expect(name.length).toBeGreaterThan(0);expect(name.every(f=>(f.flags5&64)!==0&&f.bgp===0xe4&&f.obp0===0xd0)).toBe(true);
 const after=h.frames.slice(h.frames.map(f=>f.fg).lastIndexOf('naming')+1);
 expect(after.some(f=>f.bgp===0&&f.obp0===0&&f.obp1===0&&f.fg==='battle')).toBe(true);
 expect(h.session.state.mem[D.wStatusFlags5]&64).toBe(0);expect(h.session.state.mem[D.wStatusFlags2]&2).toBe(0);
 expect(h.session.state.mem[D.wAnimCounter]).toBe(0);expect(h.afterNaming).toBe(0);
 const species=h.session.state.species(h.world.opponent);
 expect(output.text).toContainEqual([species.name.toUpperCase(),72,16]);expect(output.text).toContainEqual([species.name,32,8]);
 const entry=JSON.parse(readFileSync('static/pokedex.json','utf8'))[19];
 expect(output.text).toContainEqual([`WT  ${entry.weight.toFixed(1)}lb`,72,64]);expect(output.text).toContainEqual([entry.description[0][0],8,88]);
 expect(h.world.owned).not.toContain(19);expect(output.fallback).not.toHaveBeenCalled();
 expect(h.sounds.map(x=>[x.fg,x.key])).toEqual([['pokedex','b'],['naming','a'],['naming','a'],['naming','a']]);
 for(const sound of h.sounds)expect(sound.data).toEqual([sfxData('press_ab')]);
 expect(h.session.textLog.map(t=>t.label)).toEqual(expect.arrayContaining(['ItemUseBallText06','DoYouWantToNicknameText']));
});
it('NO copies all eleven provider name-buffer cells into the party destination',()=>{
 const h=setup(),out=complete(h,{yes:false});
 expect([...out.outcome.party[1].nickname]).toEqual(h.promptNameBuffer);
 expect(decodeBattleText(Uint8Array.from(out.outcome.party[1].nickname),0)).toBe(h.session.state.species(h.world.opponent).name);
 expect(h.foreground).not.toContain('naming');
});
it('YES and empty START keep the provider species name, rather than an empty nickname',()=>{
 const h=setup(),out=complete(h);
 expect([...out.outcome.party[1].nickname]).toEqual(h.nameBuffer);expect(h.foreground).toContain('naming');
 expect(decodeBattleText(Uint8Array.from(out.outcome.party[1].nickname),0)).toBe(h.session.state.species(h.world.opponent).name);
});
it.each([false,true])('full party sends the catch into the box with MET_BILL=%s',met=>{
 const h=setup({party:[pika(),pika(6),pika(7),pika(8),pika(9),pika(10)],eventFlags:met?['MET_BILL']:[]}),out=complete(h);
 expect(out.outcome.party).toHaveLength(6);expect(out.outcome.box).toHaveLength(1);expect([...out.outcome.box[0].nickname]).toEqual(h.nameBuffer);
 const labels=h.session.textLog.map(t=>t.label);expect(labels).toContain(met?'ItemUseBallText07':'ItemUseBallText08');
 expect(labels).not.toContain(met?'ItemUseBallText08':'ItemUseBallText07');expect(out.outcome.bag).toEqual([]);
});
it('already owned skips the dex page and makes no volume calls',()=>{
 const h=setup({owned:[25,19],seen:[25,19]}),out=complete(h,{yes:false});
 expect(h.foreground).toEqual(['battle']);expect(output.volume).toEqual([]);expect(out.outcome.party).toHaveLength(2);
 expect(h.session.textLog.map(t=>t.label)).not.toContain('ItemUseBallText06');
});
it('abort mid-naming releases the owners, then a new session catches successfully',()=>{
 const h=setup();expect(()=>h.run({},()=>h.session.foreground==='naming')).not.toThrow();expect(h.session.foreground).toBe('naming');
 h.session.abort();detached(h);expect(isNoAudioFadeOut()).toBe(false);
 const next=setup();expect(complete(next,{letters:['a']}).outcome.party).toHaveLength(2);
});
it('abort mid-dex restores NR50 and clears both the byte and facade fade flags',()=>{
 const h=setup();expect(()=>h.run({},()=>h.session.foreground==='pokedex')).not.toThrow();expect(h.session.foreground).toBe('pokedex');
 expect(output.volume).toEqual(['fade true','vol 33']);expect(isNoAudioFadeOut()).toBe(true);expect(h.session.state.mem[D.wStatusFlags2]&2).toBe(2);
 h.session.abort();expect(output.volume).toEqual(['fade true','vol 33','fade false','vol 77']);expect(isNoAudioFadeOut()).toBe(false);
 expect(h.session.state.mem[D.wStatusFlags2]&2).toBe(0);detached(h);
});
it('abort mid-STATS restores NR50 and clears the fade flag',()=>{
 const h=setup();expect(()=>h.run({mode:'stats'},()=>h.session.foreground==='status'&&isNoAudioFadeOut())).not.toThrow();
 expect(h.session.foreground).toBe('status');expect(output.volume).toEqual(['fade true','vol 33']);
 h.session.abort();expect(output.volume).toEqual(['fade true','vol 33','fade false','vol 77']);expect(isNoAudioFadeOut()).toBe(false);detached(h);
});
