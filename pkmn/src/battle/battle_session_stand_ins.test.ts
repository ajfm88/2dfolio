import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../renderer', async orig => ({ ...(await orig() as object), fillRect:vi.fn(), drawFadeOverlay:vi.fn(), drawTile:vi.fn(),
  getCtx:()=>({drawImage(){}}),getScale:()=>1,getMonsterPalette:()=>'MEWMON',loadFont:async()=>({width:128}),
  loadTileset:async()=>({width:128}),loadBattleSprite:vi.fn(async()=>({width:40,height:40})) }));
vi.mock('../menus/party_icons',()=>({loadPartyIcons:vi.fn(),drawPartyIcon:vi.fn()}));
vi.mock('../menus/menu_render',()=>({drawText:vi.fn(),drawBox:vi.fn(),drawScreenTile:vi.fn()}));
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { loadBattleData,createPokemon } from './data';
import { loadTextPrograms } from '../text/program_data';
import { battleWorld } from '../test/battle_world_fixture';
import { rig,musicData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity,musicNameForSound } from '../audio/sound_ids';
import { setLowHealthAlarm,setLowHealthAlarmDisabled,setLowHealthChannel5 } from '../audio/low_health_alarm';
import { setPlayerName,setRivalName } from '../core/player_state';
import { enablePikachuFollowing } from '../pikachu/pikachu_following';
import { resetListStateForEmptySlot } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { setKey,updateInput,syncJoypadRead } from '../input';
import { bagBackedContext,loadBattleSessionData,createBattleSession,createSessionRandom } from './battle_session';
import { A,BattleState,battleContext } from './battle_state';
import type { GameButton } from '../core';

const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
beforeAll(async()=>{
 await loadBattleData();await loadTextPrograms();await loadBattleSessionData(async file=>{
  const p=PNG.sync.read(readFileSync('static/'+file));return {width:p.width,height:p.height,data:p.data};
 });
});
beforeEach(()=>{
 keys.forEach(k=>setKey(k,false));updateInput();syncJoypadRead();resetListStateForEmptySlot();enablePikachuFollowing();
 textBgTransfer.enabled=true;textBgTransfer.resetPortion();setLowHealthAlarm(0);setLowHealthAlarmDisabled(false);setLowHealthChannel5(0);
});
it('item0: abort mid-item permits attaching the retained random owner to a different state',()=>{
 const audio=rig();let time=0;
 const banks=new PlaySound(engineHost(audio.synth,audio.music,audio.sfx,(id,bank)=>audio.music.play(musicData(musicNameForSound(id,bank)!))));
 const mon=createPokemon(25,20,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;mon.currentHp=20;mon.moves=[{id:'TACKLE',pp:35,maxPp:35}];
 const world=battleWorld({party:[mon],bag:[{id:'POTION',count:1}],options:{textSpeed:'FAST',animation:'OFF',battleStyle:'SET'}});
 setPlayerName(world.playerName);setRivalName(world.rivalName);
 const random=createSessionRandom(()=>time);
 const session=createBattleSession(world,{random,audio:()=>({sfx:audio.sfx,music:audio.music,banks})});
 const row=(y:number)=>Array.from({length:20},(_,x)=>session.screen.at(x,y)).join('');
 banks.playMusic(musicIdentity('wildbattle')!);session.start();let held:GameButton[]=[];
 expect(()=>{
  for(;time<4000&&session.foreground!=='partyItem';){
   if(time%4===0){
    if(session.state.mem[A.hJoy7]===1)held=['a'];
    else if(row(14).includes('FIGHT')&&!session.video.textBox.active)held=row(16).includes('▶')?['a']:['down'];
    else held=session.video.textBox.isWaitingForInput?['b']:['a'];
   }
   const pressed=time%4<2?held:[];time++;keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();audio.update();session.tick();
  }
 }).not.toThrow();
 expect(session.foreground).toBe('partyItem');session.abort();
 const probe=new BattleState();expect(()=>random.attach(probe)).not.toThrow();random.detach(probe);
 expect(()=>session.tick()).toThrow(/aborted/);
});
it('item0: bagBackedContext decodes later bytes, rejects bag writes and forwards all other keys',()=>{
 const state=new BattleState(),raw=battleContext(state),ctx=bagBackedContext(raw,state);
 state.setBag([{id:0x14,quantity:1}]);expect(ctx.bag).toEqual([{id:'POTION',count:1}]);
 state.setBag([{id:0x0b,quantity:2}]);expect(ctx.bag).toEqual([{id:'ANTIDOTE',count:2}]);
 ctx.bag[0].count=99;expect(ctx.bag[0].count).toBe(2);
 expect(()=>{ctx.bag=[];}).toThrow(/read-only/);
 raw.currentMenuItem=2;expect(ctx.currentMenuItem).toBe(2);
 ctx.currentMenuItem=4;expect(raw.currentMenuItem).toBe(4);expect(state.wCurrentMenuItem).toBe(4);
 expect(ctx.cursor).toBe(raw.cursor);
});
