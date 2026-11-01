import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../renderer', async orig => ({ ...(await orig() as object), fillRect:vi.fn(), drawFadeOverlay:vi.fn(), drawTile:vi.fn(),
  getCtx:() => ({drawImage(){}}), getScale:() => 1, getMonsterPalette:() => 'MEWMON',
  loadFont:async () => ({width:128}), loadTileset:async () => ({width:128}),
  loadBattleSprite:vi.fn(async () => ({width:40,height:40})) }));
vi.mock('../menus/party_icons', () => ({loadPartyIcons:vi.fn(),drawPartyIcon:vi.fn()}));
vi.mock('../menus/menu_render', () => ({drawText:vi.fn(),drawBox:vi.fn(),drawScreenTile:vi.fn()}));
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { loadBattleData, createPokemon } from './data';
import { loadTextPrograms } from '../text/program_data';
import { battleWorld } from '../test/battle_world_fixture';
import { rig, musicData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity, musicNameForSound } from '../audio/sound_ids';
import { setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { setPlayerName, setRivalName } from '../core/player_state';
import { enablePikachuFollowing } from '../pikachu/pikachu_following';
import { resetListStateForEmptySlot } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { setKey, updateInput, syncJoypadRead } from '../input';
import { loadBattleSessionData, createBattleSession, createSessionRandom, trainerEndNameBuffer } from './battle_session';
import { A, BattleState } from './battle_state';
import { D } from './battle_end_state';
import { saveTrainerName } from './battle_trainer_party';
import type { BattleWorld } from './battle_bridge';
import type { GameButton } from '../core';
import { lowHealthChannel5 } from '../audio/low_health_alarm';
import { loadStatusScreenAssets } from '../menus/status_screen';
import type { BattleForeground } from './battle_session';
import type { Frame } from './battle_menu_context';

const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
const decode=async(file:string)=>{const p=PNG.sync.read(readFileSync('static/'+file));return {width:p.width,height:p.height,data:p.data};};
beforeAll(async()=>{await loadBattleData();await loadTextPrograms();await loadBattleSessionData(decode);await loadStatusScreenAssets();});
beforeEach(()=>{
  keys.forEach(k=>setKey(k,false));updateInput();syncJoypadRead();resetListStateForEmptySlot();enablePikachuFollowing();
  textBgTransfer.enabled=true;textBgTransfer.resetPortion();setLowHealthAlarm(0);setLowHealthAlarmDisabled(false);setLowHealthChannel5(0);
});
function pikachu(level=20,hp?:number){
  const mon=createPokemon(25,level,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;
  mon.moves=[{id:'TACKLE',pp:35,maxPp:35}];if(hp!==undefined)mon.currentHp=hp;return mon;
}
type Plan={menu:('fight'|'item'|'pkmn')[];party:GameButton[][];partyDefault?:GameButton[];bag?:('use'|'cancel')[]};
function setup(overrides:Partial<BattleWorld>={}){
  const r=rig();let time=0;
  const banks=new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank)=>{
    const name=musicNameForSound(id,bank);if(!name)throw new Error(`unexpected music ${id}:${bank}`);r.music.play(musicData(name));
  }));
  const world=battleWorld({party:[pikachu()],options:{textSpeed:'FAST',animation:'OFF',battleStyle:'SET'},...overrides});
  setPlayerName(world.playerName);setRivalName(world.rivalName);
  const random=createSessionRandom(()=>time);
  const priorHooks=[r.sfx.onSfxChannelDone,r.sfx.channelEnabled,r.sfx.beforeNextNote,r.sfx.onSoundIdsCleared,r.music.audioControl];
  const session=createBattleSession(world,{random,audio:()=>({sfx:r.sfx,music:r.music,banks})});
  const row=(y:number)=>Array.from({length:20},(_,x)=>{const c=session.screen.at(x,y);return typeof c==='string'?c:' ';}).join('');
  const partyText=()=>[14,16].map(y=>Array.from({length:20},(_,x)=>session.party.choiceOverlay.at(x,y)??' ').join('')).join(' / ');
  const foreground:BattleForeground[]=['battle'];
  const frames:{time:number;kind:Frame|null;fg:BattleForeground;hp:number;pp:number;stage:number;menu:string;bgp:number;bag:string;ai:number}[]=[];
  const bagRows:string[]=[];let bagOpenings=0,wasBag=false;
  const ack:{id:number;at:number}[]=[];
  const tick=(pressed:GameButton[]=[])=>{
    const already=partyText().includes('already out!');
    time++;keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();r.update();const kind=session.tick();
    const fg=session.foreground;if(foreground[foreground.length-1]!==fg)foreground.push(fg);
    expect(['battle','party','partyItem','status']).toContain(fg);
    if(partyText().toLowerCase().includes('sleeping'))throw new Error('STOP: sleeping starter gate reached');
    if(already&&!partyText().includes('already out!'))ack.push({id:lowHealthChannel5(),at:r.synth.log.length});
    const bag=session.state.mem[A.hJoy7]===1;
    if(bag&&!wasBag)bagOpenings++;wasBag=bag;
    if(bag&&bagRows[bagRows.length-1]!==row(4))bagRows.push(row(4));
    frames.push({time,kind,fg,hp:session.state.wBattleMonHP,pp:session.state.mem[A.wBattleMonPP],
      stage:session.state.mem[A.wPlayerMonStatMods],menu:row(14),bgp:session.screen.bgp,bag:row(4),ai:session.trainerAILog.length});
    return kind;
  };
  const start=()=>{banks.playMusic(musicIdentity(world.opponent>=200?'trainerbattle':'wildbattle')!);session.start();};
  let held:GameButton[]=[];
  const automatic=()=>{
    if(time%4===0)held=session.video.textBox.isWaitingForInput?['b']:['a'];
    return time%4<2?held:[];
  };
  const drive=()=>{start();for(let n=0;!session.done&&n<12000;n++)expect(()=>tick(automatic())).not.toThrow();expect(session.done).toBe(true);return session.finish();};
  const runMenus=(plan:Plan,stop?:()=>boolean)=>{
    let menuStep=0,partyStep=0,partyFrames=0,statusFrames=0,hold:GameButton[]=[],awaitingMenuExit=false;
    start();
    for(let n=0;!session.done&&n<12000;n++){
      const menuShown=session.foreground==='battle'&&session.state.mem[A.hJoy7]!==1&&row(14).includes('FIGHT')&&!session.video.textBox.active;
      if(awaitingMenuExit&&!menuShown){menuStep++;awaitingMenuExit=false;}
      let pressed:GameButton[]=time%4===1?hold:[];
      if(time%4===0){
        const fg=session.foreground;
        if(fg==='status'){statusFrames++;pressed=statusFrames>20?['b']:[];}
        else if(fg==='party'||fg==='partyItem'){
          partyFrames++;pressed=partyFrames>40?(plan.party[partyStep++]??plan.partyDefault??['b']):[];
        }else if(session.state.mem[A.hJoy7]===1){pressed=(plan.bag?.[bagOpenings-1]??'use')==='cancel'?['b']:['a'];}
        else if(menuShown){
          const want=plan.menu[menuStep]??'fight',idx={fight:0,item:1,pkmn:2}[want];
          const right=row(14).indexOf('▶')>=14||row(16).indexOf('▶')>=14,down=row(16).includes('▶');
          pressed=right!==(idx>=2)?[right?'left':'right']:down!==(idx===1)?[down?'up':'down']:['a'];
          if(pressed[0]==='a')awaitingMenuExit=true;
        }else pressed=session.video.textBox.isWaitingForInput?['b']:['a'];
        hold=pressed;
      }
      tick(pressed);if(stop?.())return;
    }
    expect(session.done,JSON.stringify({time,foreground,labels:session.textLog.slice(-6),frames:frames.slice(-3)})).toBe(true);
    return session.finish();
  };
  return {r,random,banks,world,session,tick,start,automatic,drive,runMenus,frames,foreground,bagRows,ack,priorHooks,get time(){return time;}};
}
function complete(h:ReturnType<typeof setup>,plan:Plan){
  let output:ReturnType<typeof h.session.finish>|undefined;
  expect(()=>{output=h.runMenus(plan);}).not.toThrow();expect(output).toBeDefined();return output!;
}
it('item0: the end-text binding helper retains the full COOLTRAINER male name beyond11 bytes',()=>{
  const s=new BattleState();s.mem[D.wTrainerClass]=31;saveTrainerName(s);
  expect(trainerEndNameBuffer(s)).toBe('COOLTRAINER♂');
});
it('item0: Misty uses the exact item and text hand-off count through the bound session',()=>{
  const h=setup({opponent:235,party:[pikachu(45)]});const result=h.drive();
  expect(result.exit).toBe('end');expect(result.outcome.battleResult).toBe(0);
  const labels=h.session.textLog.map(row=>row.label);
  expect(labels).toContain('AIBattleUseItemText');expect(labels).toContain('MonsStatsRoseText');
  expect(h.session.handoffs).toEqual({trainerEnvironment:2,other:0});
  expect(h.session.trainerAILog.filter(row=>row.carry)).toHaveLength(1);
});
it('Potion heals20 to40 on partyItem across held and serviced frames, removes its byte slot and ends the battle',()=>{
  const h=setup({party:[pikachu(20,20)],bag:[{id:'POTION',count:1}]});
  const out=complete(h,{menu:['item'],party:[['a']]});
  expect(h.frames.some(f=>f.hp===20)).toBe(true);expect(h.frames.some(f=>f.hp===40)).toBe(true);
  expect(out.outcome.bag).toEqual([]);expect(out.exit).toBe('end');
  expect(h.foreground).toEqual(['battle','partyItem','battle']);
  expect(h.frames.some(f=>f.fg==='partyItem'&&f.kind==='held')).toBe(true);
  expect(h.frames.some(f=>f.fg==='partyItem'&&f.kind==='serviced')).toBe(true);
});
it('reopening the bag reads shifted ANTIDOTE bytes after Potion and cancels',()=>{
  const h=setup({party:[pikachu(20,20)],bag:[{id:'POTION',count:1},{id:'ANTIDOTE',count:1}]});
  const out=complete(h,{menu:['item','item'],party:[['a']],bag:['use','cancel']});
  expect(h.bagRows.some(row=>row.includes('POTION'))).toBe(true);expect(h.bagRows.some(row=>row.includes('ANTIDOTE'))).toBe(true);
  expect(out.outcome.bag).toEqual([{id:'ANTIDOTE',count:1}]);expect(out.exit).toBe('end');
});
it('the first bag opening decodes bytes changed after session creation instead of a cached array',()=>{
  const h=setup({party:[pikachu(20,20)],bag:[]});
  // item_constants.asm POTION=$14; inventory is count, id/quantity pairs, FF.
  h.session.state.mem.set([1,0x14,1,0xff],A.wNumBagItems);
  const out=complete(h,{menu:['item'],party:[['a']]});
  expect(h.bagRows.some(row=>row.includes('POTION'))).toBe(true);
  expect(out.outcome.bag).toEqual([]);expect(h.foreground).toEqual(['battle','partyItem','battle']);
});
it('two item uses release registrations between uses, and two completed item sessions can follow',()=>{
  for(let i=0;i<2;i++){
    const h=setup({party:[pikachu(20,10)],bag:[{id:'POTION',count:2}]});
    const out=complete(h,{menu:['item','item'],party:[['a']],partyDefault:['a']});
    expect(out.outcome.bag).toEqual([]);expect(out.exit).toBe('end');
    expect(h.foreground).toEqual(['battle','partyItem','battle','partyItem','battle']);
  }
});
it('Ether restores10 PP through the real move list, removes one of two, and consumes the item turn',()=>{
  const mon=pikachu();mon.moves[0].pp=3;
  const h=setup({party:[mon],bag:[{id:'ETHER',count:2}]});const out=complete(h,{menu:['item'],party:[['a']],partyDefault:['a']});
  const labels=h.session.textLog.map(row=>row.label);
  expect(labels).toContain('RestorePPWhichTechniqueText');expect(labels).toContain('PPRestoredText');
  expect(h.frames.some(f=>f.pp===13&&f.fg==='partyItem')).toBe(true);
  expect(out.outcome.bag).toEqual([{id:'ETHER',count:1}]);expect(out.outcome.party[0].pp[0]).toBe(12);
});
it('X ATTACK runs the short body, raises ATTACK one stage and gives the enemy an item turn',()=>{
  const h=setup({bag:[{id:'X_ATTACK',count:1}]});const out=complete(h,{menu:['item'],party:[]});
  expect(h.frames.some(f=>f.stage===8)).toBe(true);
  expect(h.frames.some(f=>f.stage===8&&f.ai>0&&f.pp===35)).toBe(true);expect(out.outcome.bag).toEqual([]);expect(out.exit).toBe('end');
});
it('the registered flute uses its loaded stream to wake a reserve mon and retains the flute',()=>{
  const sleeping=pikachu(10);sleeping.status='SLP';sleeping.sleepTurns=2;
  const h=setup({party:[pikachu(),sleeping],bag:[{id:'POKE_FLUTE',count:1}]});
  const out=complete(h,{menu:['item'],party:[]});
  const labels=h.session.textLog.map(row=>row.label);
  expect(labels).toContain('PlayedFluteHadEffectText');expect(labels).toContain('FluteWokeUpText');
  expect(out.outcome.party[1].status).toBe(0);expect(out.outcome.bag).toEqual([{id:'POKE_FLUTE',count:1}]);
  expect(h.foreground).toEqual(['battle']);expect(out.exit).toBe('end');
});
it('PKMN voluntary switch uses the shared party and sends slot1 through PlayerMon2Text',()=>{
  const h=setup({party:[pikachu(),pikachu(21)]});const out=complete(h,{menu:['pkmn'],party:[['down'],['a'],['a']]});
  expect(h.session.textLog.map(row=>row.label)).toContain('PlayerMon2Text');expect(h.session.state.wPlayerMonNumber).toBe(1);
  expect(h.foreground).toEqual(['battle','party','battle']);expect(out.exit).toBe('end');
});
it('STATS reports status then returns to party and the Buffer2 battle layer',()=>{
  const h=setup();const out=complete(h,{menu:['pkmn'],party:[['a'],['down'],['a'],['b'],['b']]});
  expect(h.foreground).toEqual(['battle','party','status','party','battle']);expect(out.exit).toBe('end');
  const restored=h.frames.filter(f=>f.menu.includes('FIGHT')&&f.bgp===0);
  expect(restored.length).toBeGreaterThan(0);expect(restored.every(f=>f.fg==='battle')).toBe(true);
});
it('AlreadyOutText acknowledges on the own audio engine, returns to the list, then cancels',()=>{
  const h=setup({party:[pikachu(),pikachu(21)]});complete(h,{menu:['pkmn'],party:[['a'],['a']]});
  expect(h.ack).toHaveLength(1);expect(h.ack[0].id).toBe(0x90);
  expect(h.r.synth.log.slice(h.ack[0].at).some(w=>w.m==='freq0')).toBe(true);
  expect(h.foreground).toEqual(['battle','party','battle']);expect(h.session.state.wPlayerMonNumber).toBe(0);
});
it('a forced chooser after a trainer faint sends the second player mon and wins',()=>{
  const h=setup({opponent:202,mapName:'ViridianForest',party:[pikachu(5,1),pikachu()],
    endBattleText:{win:'ViridianForestYoungster2EndBattleText',lose:'ViridianForestYoungster2EndBattleText'}});
  const out=complete(h,{menu:[],party:[['down'],['a']]});
  expect(h.session.textLog.map(row=>row.label)).toContain('PlayerMonFaintedText');expect(h.session.state.wPlayerMonNumber).toBe(1);
  expect(out.exit).toBe('end');expect(out.outcome.battleResult).toBe(0);expect(h.foreground).toEqual(['battle','party','battle']);
});
it('abort mid-item releases registrations, random and all audio hooks, rejects every subsequent operation',()=>{
  const h=setup({party:[pikachu(20,20)],bag:[{id:'POTION',count:1}]});
  expect(()=>h.runMenus({menu:['item'],party:[]},()=>h.session.foreground==='partyItem')).not.toThrow();
  expect(h.session.foreground).toBe('partyItem');h.session.abort();
  expect([h.r.sfx.onSfxChannelDone,h.r.sfx.channelEnabled,h.r.sfx.beforeNextNote,h.r.sfx.onSoundIdsCleared,h.r.music.audioControl]).toEqual(h.priorHooks);
  expect(()=>h.session.start()).toThrow(/aborted/);expect(()=>h.session.tick()).toThrow(/aborted/);
  expect(()=>h.session.finish()).toThrow(/aborted/);expect(()=>h.session.abort()).toThrow(/cannot abort/);
  const randomBefore=[h.random.hRandomAdd,h.random.hRandomSub];h.session.state.hRandomAdd^=255;
  expect([h.random.hRandomAdd,h.random.hRandomSub]).toEqual(randomBefore);
  const next=setup({party:[pikachu(20,20)],bag:[{id:'POTION',count:1}]});
  expect(complete(next,{menu:['item'],party:[['a']]}).outcome.bag).toEqual([]);
});
it('abort is valid before start, and finish disallows abort',()=>{
  const h=setup();h.session.abort();expect(()=>h.session.abort()).toThrow();expect(()=>h.session.start()).toThrow(/aborted/);
  const next=setup();complete(next,{menu:[],party:[]});expect(()=>next.session.abort()).toThrow(/cannot abort/);
});
it('MASTER BALL pins the stand-in not-loaded error, aborts, and leaves the next item session usable',()=>{
  const h=setup({bag:[{id:'MASTER_BALL',count:1}]});
  expect(()=>h.runMenus({menu:['item'],party:[]})).toThrow(/stand-in screens not loaded/);expect(h.session.handoffs.other).toBe(0);h.session.abort();
  const next=setup({party:[pikachu(20,20)],bag:[{id:'POTION',count:1}]});
  expect(complete(next,{menu:['item'],party:[['a']]}).outcome.bag).toEqual([]);
});
