import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { loadBattleData, createPokemon } from './data';
import { loadTextPrograms } from '../text/program_data';
import { battleWorld } from '../test/battle_world_fixture';
import { rig, musicData, sfxData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity, musicNameForSound } from '../audio/sound_ids';
import { setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5, lowHealthChannel5 } from '../audio/low_health_alarm';
import { setPlayerName } from '../core/player_state';
import { resetListStateForEmptySlot } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { setKey, updateInput, syncJoypadRead, readJoypad, isPassPressed } from '../input';
import { loadBattleSessionData, createBattleSession, createSessionRandom, battleTextSoundOwner, BATTLE_TEXT_SOUND_IDS } from './battle_session';
import { BattleAudio } from './battle_audio';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleHost } from './battle_host';
import { BattleState, A } from './battle_state';
import { INIT } from './battle_init';
import { D } from './battle_end_state';
import { TRAINER_AI_POINTERS } from './battle_trainer_ai';
import { MOVE_ANIM } from './battle_move_anim';
import { BattleRandomState } from './battle_random_state';
import { getTextSpeed } from '../text/textbox';
import { decodePartyMon, partyRecordToPokemon } from './battle_party_codec';
import type { BattleWorld } from './battle_bridge';
import type { GameButton } from '../core';
import type { BattleSfx } from './battle_audio';
const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
const decode=async(file:string)=>{const p=PNG.sync.read(readFileSync('static/'+file));return {width:p.width,height:p.height,data:p.data};};
const firstFetches = new Map<string, number>(), firstDecodes = new Map<string, number>();
beforeAll(async()=>{
 await loadBattleData();await loadTextPrograms();
 const fetchData=globalThis.fetch;
 const count=vi.spyOn(globalThis,'fetch').mockImplementation((url,init)=>{
  const name=String(url);firstFetches.set(name,(firstFetches.get(name)??0)+1);return fetchData(url,init);
 });
 try {
  const load=loadBattleSessionData(async file=>{firstDecodes.set(file,(firstDecodes.get(file)??0)+1);return decode(file);});
  expect(loadBattleSessionData(decode)).toBe(load);await load;
 } finally { count.mockRestore(); }
});
beforeEach(()=>{keys.forEach(k=>setKey(k,false));updateInput();syncJoypadRead();resetListStateForEmptySlot();setPlayerName('ASH');
  textBgTransfer.enabled=true;textBgTransfer.resetPortion();setLowHealthAlarm(0);setLowHealthAlarmDisabled(false);setLowHealthChannel5(0);});
afterEach(()=>vi.restoreAllMocks());
function hash(data:ArrayLike<unknown>){return createHash('sha256').update(JSON.stringify(Array.from(data))).digest('hex').slice(0,12);}
function setup(options:{world?:Partial<BattleWorld>;frames?:()=>number;random?:ReturnType<typeof createSessionRandom>;scrollB?:boolean}={}){
 const r=rig();let time=0;
 const musicRequests:string[]=[];
 const banks=new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank)=>{
   const name=musicNameForSound(id,bank);if(!name)throw new Error(`unexpected music ${id}:${bank}`);
   musicRequests.push(name);if(name==='defeatedwildmon')expect(r.music.isPlaying(),'victory must stop the previous music first').toBe(false);
   r.music.play(musicData(name));
 },undefined,()=>musicRequests.push('stop')));
 const framesNow=options.frames??(()=>time);
 const random=options.random??createSessionRandom(framesNow);
 const mon=createPokemon(25,20,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;mon.moves=[{id:'TACKLE',pp:35,maxPp:35}];
 const world=battleWorld({party:[mon],...options.world});
 const prior={done:r.sfx.onSfxChannelDone,enabled:r.sfx.channelEnabled,note:r.sfx.beforeNextNote,cleared:r.sfx.onSoundIdsCleared,control:r.music.audioControl};
 const session=createBattleSession(world,{random,audio:()=>({sfx:r.sfx,music:r.music,banks})});
 const initial=snapshotRam(session.state.mem);
 const start=()=>{banks.playMusic(musicIdentity('wildbattle')!);session.start();};
 const deltas:{at:number;cells:string[]}[]=[],frames:string[]=[],states:{at:number;id:number;hp:number;turn:number;type:number}[]=[];
 const observations:{at:number;id5:number;bank:number;grewComplete:boolean|undefined;audio:typeof r.synth.log}[]=[];
 let previous=Buffer.from(session.state.mem);
 const tick=(pressed:GameButton[]=[])=>{
   time++;keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();const audioStart=r.synth.log.length;r.update();
   const clock=r.synth.update;
   const frame=session.tick();expect(r.synth.update,'session must not own audio ticks').toBe(clock);
   frames.push(`${time}:${frame}:${hash(session.screen.cells)}:${hash(session.screen.visibleCells)}`);
   const changed:string[]=[];for(let i=0;i<65536;i++)if(previous[i]!==session.state.mem[i])changed.push(`${i.toString(16)}:${session.state.mem[i].toString(16)}`);
   if(changed.length)deltas.push({at:time,cells:changed});previous=Buffer.from(session.state.mem);
   states.push({at:time,id:session.state.wAnimationID,hp:session.state.wEnemyMonHP,turn:session.state.hWhoseTurn,type:session.state.wAnimationType});
   observations.push({at:time,id5:lowHealthChannel5(),bank:banks.audioBank,
     grewComplete:session.textLog.find(t=>t.label==='GrewLevelText')?.complete,audio:r.synth.log.slice(audioStart)});
   return frame;
 };
 const drive=(action:'fight'|'run'='fight',limit=6000)=>{
   start();
   for(let n=0;!session.done&&n<limit;n++){
     let pressed:GameButton[]=[];
     if(time%2===0){
       const screen=session.screen;
       const menu=!session.video.textBox.active && screen.at(10,14)==='F';
       if(action==='run'&&menu){
         pressed=screen.at(9,14)==='▶'||screen.at(9,16)==='▶'?['right']:screen.at(15,14)==='▶'?['down']:['a'];
       } else pressed=options.scrollB&&session.screen.at(11,3)==='A'?['b']:session.video.textBox.isWaitingForInput?['b']:['a'];
     }
     tick(pressed);
   }
   expect(session.done,JSON.stringify({time,text:session.textLog.slice(-6),state:states.slice(-2)})).toBe(true);
   const result=session.finish();
   expect(session.trainerAILog).toHaveLength(session.state.wAILayer2Encouragement);
   expect(session.trainerAILog.every(call=>call.frames===0&&call.carry===false)).toBe(true);
   expect(session.handoffs).toEqual({trainerEnvironment:0,other:0});return result;
 };
 return {r,banks,random,session,world,initial,prior,start,tick,drive,frames,deltas,states,observations,musicRequests,get time(){return time;}};
}
function snapshotRam(mem:Uint8Array){return Array.from(mem.entries()).filter(([,v])=>v).map(([a,v])=>`${a.toString(16)}:${v.toString(16)}`);}
it('Route1 wild win uses the production session, real input, 123-frame first Tackle and final absolute values',()=>{
 const h=setup();expect(h.session.state.partyMons[0]).toEqual(partyRecordToPokemon(decodePartyMon(h.session.state,0)));
 expect([...h.session.state.mem.slice(A.wEnemyMonPP,A.wEnemyMonPP+4)]).toEqual([35,30,0,0]);
 expect([h.session.state.mem[INIT.wMapPalOffset],h.session.state.mem[INIT.wLetterPrintingDelayFlags],h.session.state.mem[INIT.wSavedTileAnimations]]).toEqual([0,1,2]);
 const result=h.drive();expect(result.exit).toBe('end');expect(result.outcome.party[0].exp).toBe(8024);
 expect([result.outcome.party[0].hp,result.outcome.party[0].pp[0]]).toEqual([44,33]);
 expect(result.outcome.seen).toEqual([19,25]);expect(result.outcome.money).toBe(3000);expect(result.outcome.battleResult).toBe(0);
 expect([h.session.state.mem[INIT.wMapPalOffset],h.session.state.mem[INIT.wLetterPrintingDelayFlags],h.session.state.mem[INIT.hTileAnimations]]).toEqual([0,1,2]);
 expect(h.musicRequests.slice(0,3)).toEqual(['wildbattle','stop','defeatedwildmon']);
 const first=h.states.find(s=>s.id===33&&s.turn===0)!;
 const applied=h.states.find(s=>s.at>first.at&&s.hp<first.hp)!;
 expect(applied.at-first.at).toBe(123);
 expect(h.session.textLog.every(t=>t.complete)).toBe(true);
 const ledger={initial:h.initial,frames:h.frames,writes:h.deltas,texts:h.session.textLog,audio:h.r.synth.log,result};
 if(process.env.PKMN_SESSION_AUDIT)writeFileSync(process.env.PKMN_SESSION_AUDIT,JSON.stringify(ledger));
 if(!process.env.PKMN_SESSION_SKIP_SNAPSHOT)expect(ledger).toMatchSnapshot();
});
it('a wild battle with a fixed frame4 clock completes with the cycle-counted DIV',()=>{
 // Bounded old-clock control: run the real battle, but stop a frozen retry after1024 DIV reads.
 let reads=0,caught:unknown;
 const old=setup({random:new BattleRandomState(()=>{
  if(++reads>1024)throw new Error('frozen DIV read bound');return Math.floor(4*70224/256)&255;
 })});
 try{old.drive('fight',1800);}catch(error){caught=error;}
 expect(caught).toBeInstanceOf(Error);expect((caught as Error).message).toBe('frozen DIV read bound');
 expect((caught as Error).stack).toContain('randomizeDamage');expect(old.session.state.hRandomAdd&1).toBe(0);
 const h=setup({frames:()=>4});const result=h.drive('fight',1800);
 expect(result.exit).toBe('end');expect(result.outcome.battleResult).toBe(0);
});
it('item0: B alone ends the real level-up stats scroll wait',()=>{
 const mon=createPokemon(25,20,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;
 mon.exp=9250;mon.moves=[{id:'TACKLE',pp:35,maxPp:35}];
 const h=setup({world:{party:[mon]},scrollB:true});const result=h.drive('fight',1800);
 expect(result.outcome.party[0].level).toBe(21);expect(h.session.state.mem[D.hJoy5]).toBe(2);
});
it('item0: FAST MID SLOW reach the private printer with increasing character delays',()=>{
 const durations:number[]=[];
 for(const [textSpeed,name] of [['FAST','fast'],['MID','medium'],['SLOW','slow']] as const){
  const h=setup({world:{options:{textSpeed,animation:'OFF',battleStyle:'SET'}}});h.start();expect(getTextSpeed()).toBe(name);
  const box=h.session.video.textBox;box.printStandalone({text:'AB'});let frames=0;
  while(!box.isTextComplete&&frames<100){box.update();frames++;}expect(box.isTextComplete).toBe(true);durations.push(frames);
 }
 expect(durations[0]).toBeLessThan(durations[1]);expect(durations[1]).toBeLessThan(durations[2]);
});
it('item0: the bound host sound wait spans the real text sound and returns only after its engines finish',()=>{
 const h=setup();h.banks.audioBank=8;
 const box=h.session.video.textBox;box.printStandalone({program:'GrewLevelText'},{bindings:{nameBuffer:'BIRD',curEnemyLevel:21}});
 for(let n=0;lowHealthChannel5()!==0x86&&n<300;n++)box.update();expect(lowHealthChannel5()).toBe(0x86);
 h.session.state.wAnimationID=0;const waiting=h.session.animation(h.session.state);
 let next=waiting.next(),frames=0;expect(next.done).toBe(false);
 while(h.r.sfx.isPlaying()&&frames<500){expect(next.done).toBe(false);expect(next.value).toBe('serviced');h.r.update();frames++;next=waiting.next();}
 expect(frames).toBeGreaterThan(5);expect(h.r.sfx.isPlaying()).toBe(false);expect(next.done).toBe(true);
});
it('Route1 blackout returns carry, result1 and the weak party member at HP0',()=>{
 const mon=createPokemon(19,2,'WEAK',{atk:0,def:0,spd:0,spc:0})!;mon.currentHp=1;mon.moves=[{id:'TACKLE',pp:35,maxPp:35}];
 const h=setup({world:{party:[mon],enemyLevel:20}});const result=h.drive();
 expect(result.exit).toBe('blackout');expect(result.blackoutCarry).toBe(true);expect(result.outcome.battleResult).toBe(1);expect(result.outcome.party[0].hp).toBe(0);
 expect(h.session.trainerAILog.length).toBeGreaterThan(0);
});
it('the bound animation port runs the real108-frame Tackle body and its applying sound',()=>{
 const h=setup(),s=h.session.state;s.wAnimationID=33;s.wAnimationType=4;s.wDamageMultipliers=10;
 const animation=h.session.animation(s);let next=animation.next(),frames=0;
 while(!next.done&&frames<300){expect(next.value).toBe('serviced');h.r.update();h.session.video.vblank();frames++;next=animation.next();}
 expect(next.done).toBe(true);expect(frames).toBe(108);expect(s.mem[MOVE_ANIM.wAnimPalette]).toBe(0xe4);
 expect(h.r.synth.log.some(w=>w.m==='noise')).toBe(true);expect(h.session.handoffs).toEqual({trainerEnvironment:0,other:0});
});
it('RUN succeeds through the real menu, requests SFX_RUN, preserves the party, money and bag, and only adds seen',()=>{
 const h=setup();const before=decodePartyMon(h.session.state,0);const result=h.drive('run',1000);
 expect(result.exit).toBe('end');expect(result.outcome.battleResult).toBe(2);expect(result.outcome.party[0]).toEqual(before);
 expect(result.outcome.money).toBe(3000);expect(result.outcome.bag).toEqual(h.world.bag);expect(result.outcome.seen).toEqual([19,25]);
 expect(h.session.textLog.map(t=>t.label)).toContain('GotAwayText');
 expect(h.r.synth.log.some(w=>w.m==='noise')).toBe(true);
});
it('setup draws DVs before frames and shared HRAM carries across two sessions, then detaches',()=>{
 let clock=1;const random=createSessionRandom(()=>clock);
 const first=setup({random});const dv1=[...first.session.state.mem.slice(A.wEnemyMonDVs,A.wEnemyMonDVs+2)];
 expect(first.time).toBe(0);expect(first.r.synth.update).toBe(0);expect(random.hRandomAdd).toBe(0);
 const finish=first.drive('run');expect(finish.exit).toBe('end');
 expect([random.hRandomAdd,random.hRandomSub]).toEqual([first.session.state.hRandomAdd,first.session.state.hRandomSub]);
 clock=2;const second=setup({random});const fresh=setup({frames:()=>2});
 const dv2=[...second.session.state.mem.slice(A.wEnemyMonDVs,A.wEnemyMonDVs+2)];
 expect(dv2).not.toEqual([...fresh.session.state.mem.slice(A.wEnemyMonDVs,A.wEnemyMonDVs+2)]);expect(dv2).not.toEqual(dv1);
 second.drive('run');fresh.drive('run');
});
it('the bound trainer port reaches the real AI and its throwing08b environment for a trainer',()=>{
 const h=setup({frames:()=>0}),s=h.session.state;s.wIsInBattle=2;
 s.mem[D.wTrainerClass]=TRAINER_AI_POINTERS.findIndex(row=>row.className==='BLACKBELT')+1;
 s.mem[D.wAICount]=0xff;s.hRandomAdd=0;
 expect(()=>h.session.trainerAI(s).next()).toThrow(/08b/);
 expect(h.session.handoffs).toEqual({trainerEnvironment:1,other:0});
});
it('a session step leaves the externally clocked engine channel cursors and delays alone',()=>{
 const h=setup();h.start();
 // The pending startup Delay3 lets us count one VBlank without intervening CPU resets.
 textBgTransfer.enabled=true;
 const channels=()=>[1,2,3,4].map(id=>{const ch=h.r.music.getChannel(id);return ch&&[ch.pc,ch.noteDelayCounter];});
 for(let n=0;n<3;n++){
  h.r.update();const before=channels(),writes=h.r.synth.log.length;
  expect(h.session.tick()).toBe('serviced');expect(channels()).toEqual(before);
  if(n===0)expect(textBgTransfer.nextPortion).toBe(1);
  expect(h.r.synth.log.length).toBe(writes);
 }
});
it('a level-up in the real session owns audible bank08 text sounds and waits before completing the text',()=>{
 const mon=createPokemon(25,20,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;
 mon.exp=9250;mon.moves=[{id:'TACKLE',pp:35,maxPp:35}];
 const h=setup({world:{party:[mon]}});expect(h.banks.audioBank).not.toBe(8);
 const result=h.drive();expect(result.outcome.party[0].level).toBe(21);
 const playing=h.observations.filter(o=>o.id5===0x86);
 expect(playing.length).toBeGreaterThan(5);expect(playing.every(o=>o.bank===8&&o.grewComplete===false)).toBe(true);
 expect(h.session.textLog.find(t=>t.label==='GrewLevelText')?.complete).toBe(true);
 const firstNote=playing.slice(1).find(o=>o.audio.some(w=>w.m==='freq0'));
 expect(firstNote).toBeDefined();
 const control=rig();new BattleAudio(control.sfx,control.music).play({id:0x86,data:sfxData('level_up')});control.update();
 expect(firstNote!.audio.filter(w=>w.m==='freq0').map(w=>w.a)).toEqual(control.synth.log.filter(w=>w.m==='freq0').map(w=>w.a));
 expect(h.observations.some(o=>o.id5===0x90&&o.audio.some(w=>w.m==='freq0'))).toBe(true);
});
it('finish is forbidden before start or completion',()=>{
 const h=setup();expect(()=>h.session.finish()).toThrow(/not ready/);h.start();expect(()=>h.session.finish()).toThrow(/not ready/);
 for(let n=0;!h.session.done&&n<5000;n++)h.tick(n%2?[]:['a']);expect(h.session.done).toBe(true);h.session.finish();
});
it('the previous sound-done owner chains during battle, and all five hooks are restored exactly at finish',()=>{
 const r=rig();const done=()=>{count++;};let count=0;
 r.sfx.onSfxChannelDone=done;r.sfx.channelEnabled=()=>true;r.sfx.beforeNextNote=()=>false;r.sfx.onSoundIdsCleared=()=>{};
 const control={getMute:()=>0,setMute:()=>{}};r.music.audioControl=control;
 const prior=[r.sfx.onSfxChannelDone,r.sfx.channelEnabled,r.sfx.beforeNextNote,r.sfx.onSoundIdsCleared,r.music.audioControl];
 const banks=new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank)=>r.music.play(musicData(musicNameForSound(id,bank)!))));
 const session=createBattleSession(battleWorld(),{random:createSessionRandom(()=>1),audio:()=>({sfx:r.sfx,music:r.music,banks})});
 banks.playMusic(musicIdentity('wildbattle')!);session.start();
 for(let n=0;!session.done&&n<6000;n++){keys.forEach(k=>setKey(k,k==='a'&&n%2===0||k==='b'&&n%2===0&&session.video.textBox.isWaitingForInput));updateInput();r.update();session.tick();}
 expect(session.done).toBe(true);session.finish();expect(count).toBeGreaterThan(0);
 [r.sfx.onSfxChannelDone,r.sfx.channelEnabled,r.sfx.beforeNextNote,r.sfx.onSoundIdsCleared,r.music.audioControl].forEach((owner,i)=>expect(owner).toBe(prior[i]));
 expect(session.trainerAILog).toHaveLength(session.state.wAILayer2Encouragement);
 expect(session.trainerAILog.every(call=>call.frames===0&&call.carry===false)).toBe(true);
 expect(session.handoffs).toEqual({trainerEnvironment:0,other:0});
});
it('syncJoypadRead outside a session eats the same fresh edge its menu reader needs',()=>{
 setKey('a',true);updateInput();readJoypad();expect(isPassPressed('a')).toBe(true);
 setKey('a',false);readJoypad();setKey('a',true);updateInput();syncJoypadRead();readJoypad();expect(isPassPressed('a')).toBe(false);
});
it('the session loader is once-only and the second call decodes and fetches nothing',async()=>{
 const expected=['battle_transitions.json','move_names.json','stat_mod_text.json','item_names.json','trainers.json',
  ...Object.keys(import.meta.glob('../../data/maps/*.json')).map(path=>'maps/'+path.split('/').pop()),
  ...['trainer_appeared','faint_fall','faint_thud','run','swap','press_ab','damage','super_effective','not_very_effective',
  'level_up','get_item1','caught_mon','dex_page_added','heal_hp','heal_ailment'].map(name=>`audio/sfx/${name}.json`)];
 expect([...firstFetches.keys()].sort()).toEqual(expected.sort());
 expect([...firstFetches.values()]).toEqual(expected.map(()=>1));
 expect(firstDecodes.size).toBe(358);expect([...firstDecodes.values()]).toEqual(Array(358).fill(1));
 expect(firstDecodes.get('gfx/battle/balls.png')).toBe(1);
 for(let dex=1;dex<=151;dex++)for(const side of ['front','back'])expect(firstDecodes.get(`gfx/sprites/${side}/${dex}.png`)).toBe(1);
 const decodeAgain=vi.fn(decode);const fetchAgain=vi.spyOn(globalThis,'fetch');await loadBattleSessionData(decodeAgain);
 expect(decodeAgain).not.toHaveBeenCalled();expect(fetchAgain).not.toHaveBeenCalled();
});
it('the bank08 text owner plays ID86 with level-up data, waits on those engines, and rejects excluded field names',()=>{
 const r=rig(),banks=r.fade.requests;banks.audioBank=8;const audio=new BattleAudio(r.sfx,r.music,banks);
 const sounds=new Map<string,BattleSfx>(['level_up','get_item1','press_ab','caught_mon','dex_page_added'].map(name=>[name,{id:0,data:sfxData(name)}]));
 const owner=battleTextSoundOwner(audio,{sfx:r.sfx,music:r.music,banks},sounds);
 expect(BATTLE_TEXT_SOUND_IDS.caught_mon).toBe(0x9a);expect(BATTLE_TEXT_SOUND_IDS.dex_page_added).toBe(0x98);
 owner.play('get_item1');expect(audio.channelId(5)).toBe(0x86);expect(owner.finished()).toBe(false);
 r.update();expect(r.synth.log.some(w=>w.m==='freq0')).toBe(true);
 const levelUpControl=rig();new BattleAudio(levelUpControl.sfx,levelUpControl.music).play({id:0x86,data:sfxData('level_up')});levelUpControl.update();
 expect(r.synth.log).toEqual(levelUpControl.synth.log);
 for(let n=0;!owner.finished()&&n<500;n++)r.update();expect(owner.finished()).toBe(true);
 owner.beep();expect(audio.channelId(5)).toBe(0x90);expect(owner.finished()).toBe(false);
 expect(()=>owner.play('get_item2')).toThrow(/get_item2/);expect(()=>owner.play('get_key_item')).toThrow(/get_key_item/);audio.dispose();
});
it('the private BattleHost TextBox uses the owner for sound commands, waits and acknowledgement beep',()=>{
 const r=rig(),audio=new BattleAudio(r.sfx,r.music,r.fade.requests);r.fade.requests.audioBank=8;
 const sounds=new Map<string,BattleSfx>(['level_up','get_item1','press_ab'].map(name=>[name,{id:0,data:sfxData(name)}]));
 const video=new BattleMenuScreen(undefined,{closeFrames:()=>7,updateSprites(){},sound:battleTextSoundOwner(audio,{sfx:r.sfx,music:r.music,banks:r.fade.requests},sounds)});
 const s=new BattleState();const driver=new BattleHost(s,video);
 driver.start(driver.printText('GrewLevelText',{nameBuffer:'BIRD',curEnemyLevel:21}));
 let sawSound=false,heldAtSound=0;
 for(let n=0;!driver.done&&n<1000;n++){
  keys.forEach(k=>setKey(k,k==='a'&&n%2===0));updateInput();r.update();driver.step();
  if(audio.channelId(5)===0x86){sawSound=true;heldAtSound++;expect(driver.done).toBe(false);}
 }
 expect(driver.done).toBe(true);expect(sawSound).toBe(true);expect(heldAtSound).toBeGreaterThan(5);expect(r.synth.log.some(w=>w.m==='freq0')).toBe(true);
 audio.dispose();
});
