// checkpoint-08b test-only composition. No production caller or alternate frame owner.
import { expect, vi } from 'vitest';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isHeld, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { rig as audioRig, sfxData, musicData } from './audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { lowHealthAlarm, setLowHealthAlarm } from '../audio/low_health_alarm';
import { PartyMenu } from '../menus/party_menu';
import { getPartyAndBillsSavedMenuItem } from '../list_state';
import type { GameButton } from '../core';
import { BattleState, battleContext, encodeText, decodeNick } from '../battle/battle_state';
import { ENEMY_SEND_CELLS } from '../battle/battle_enemy_send_out';
import { D } from '../battle/battle_end_state';
import { BattleHost } from '../battle/battle_host';
import { BattleAudio } from '../battle/battle_audio';
import { createPokemon, getMove, getAllLoadedMoveIds } from '../battle/data';
import { partySlotFromPokemon, writePartySlot, loadBattleMonFromParty } from '../battle/battle_loaders';
import { bindLearnMove, type LearnMoveHost } from '../battle/learn_move';
import { battleLoop, type BattleLoopHost } from '../battle/battle_loop';
import { endOfBattle, type BattleEndHost } from '../battle/battle_end';
import { composedJumpMoveEffect, type MoveEffectEnvironment } from '../battle/battle_effects_registry';
import { statModifierUpEffect } from '../battle/battle_effects_stats';
import type { Program, Frame } from '../battle/battle_menu_context';
import type { TurnPorts } from '../battle/battle_turn';
import * as menu from '../battle/battle_menu';
import * as moves from '../battle/move_selection_menu';
import * as twoOption from '../battle/battle_two_option';
import * as selection from '../battle/battle_math';
import * as damage from '../battle/battle_damage_asm';
import * as hit from '../battle/battle_hit';
import * as faint from '../battle/battle_faint';
import * as random from '../battle/battle_random';
import type { TrainerMoveSelection } from '../battle/battle_math';
import type { TextBox } from '../text/textbox';

export interface History {
  trainer?: boolean; reserves?: number; enemies?: number;
  playerMove?: number; enemyMove?: number; hp?: number; enemyHp?: number;
  playerFirst?: boolean; refuseNext?: boolean;
  endText?: string;
  // Called only at a real DisplayBattleMenu entry, before any menu reads.
  action?: (entry: number, state: BattleState) => 'fight' | 'run' | 'catch';
}
export interface LedgerEvent { at: number; name: string; data: unknown }

export function battleLedger(o: History = {}) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost<string>(s, undefined, audio.update), video = driver.video, screen = video.screen;
  const party = new PartyMenu(), ctx = battleContext(s);
  const events: LedgerEvent[] = [], writes: string[] = [], frames: Frame[] = [];
  let time = 0, phase = 'idle', rngPhase = 'unexpected', entry = 0, target = 0;
  let action: 'fight' | 'run' | 'catch' = 'fight';
  const mark = (name: string, data: unknown = null) => events.push({ at: time, name, data });
  const setKeys = (keys: GameButton[]) => {
    vi.mocked(isHeld).mockImplementation(k => keys.includes(k));
    vi.mocked(isPassPressed).mockImplementation(k => keys.includes(k));
  };
  s.species = id => ({ name: id === 0x24 ? 'PIDGEY' : 'PIKACHU', base: [40,45,40,56,35],
    type1: 0, type2: 0, catchRate: 255, baseExp: 60,
    moves: [o.enemyMove ?? 150,0,0,0], learnset: [], growthRate: 0 });
  s.movePP = () => 35;
  const count = 1 + (o.reserves ?? 0);
  s.mem[D.wPartyCount] = count;
  for (let i = 0; i < count; i++) {
    const mon = createPokemon('PIDGEY', 20, ['LEAD','RESERVE','THIRD'][i],{atk:8,def:8,spd:8,spc:8})!;
    s.partyMons[i] = mon;
    const slot = partySlotFromPokemon(mon);
    slot.hp = o.hp ?? 60; slot.maxHp = 60; slot.speed = o.playerFirst === false ? 50 : 150;
    slot.moves = [o.playerMove ?? 33,0,0,0]; slot.pp = [35,0,0,0];
    slot.exp = 8000; slot.otId = 0x1234; slot.otName = 'ASH'; writePartySlot(s,'player',i,slot);
    s.mem[D.wPartySpecies+i] = 0x24;
  }
  s.mem[D.wPartySpecies+count] = 255;
  s.writeBE(D.wPlayerID,0x1234); s.setBytes(D.wPlayerName,encodeText('ASH@'),11);
  s.wWhichPokemon = s.wPlayerMonNumber = 0; s.wBattleMonSpecies2 = 0x24; loadBattleMonFromParty(s);
  s.wIsInBattle = o.trainer ? 2 : 1; s.wCurOpponent = o.trainer ? 201 : 0x24;
  s.mem[D.wTrainerClass] = 1; s.setBytes(D.wTrainerName,encodeText('ACE@'),11);
  s.wEnemyMonSpecies = s.wEnemyMonSpecies2 = 0x24;
  s.setBytes(D.wEnemyMonNick,encodeText('FOE@'),11);
  s.wEnemyMonHP = o.enemyHp ?? 1; s.wEnemyMonMaxHP = 60;
  s.wEnemyMonLevel = s.wCurEnemyLevel = 20;
  s.wEnemyMonAttack = s.wEnemyMonDefense = s.wEnemyMonSpecial = 20; s.wEnemyMonSpeed = 100;
  s.wBattleMonAttack = s.wBattleMonDefense = s.wBattleMonSpecial = 20;
  s.wBattleMonType1 = s.wBattleMonType2 = s.wEnemyMonType1 = s.wEnemyMonType2 = 0;
  s.setBytes(D.wEnemyMonMoves,[o.enemyMove ?? 150,0,0,0],4); s.setBytes(D.wEnemyMonPP,[35,0,0,0],4);
  s.mem[D.wPartyGainExpFlags] = s.mem[D.wPartyFoughtCurrentEnemyFlags] = 1;
  s.mem.fill(7,D.wPlayerMonStatMods,D.wPlayerMonStatMods+8); s.mem.fill(7,D.wEnemyMonStatMods,D.wEnemyMonStatMods+8);
  const enemies = o.enemies ?? 1; s.mem[D.wEnemyPartyCount] = enemies;
  for (let i=0;i<enemies;i++) {
    const slot = partySlotFromPokemon(createPokemon('PIDGEY',20,'FOE',{atk:8,def:8,spd:8,spc:8})!);
    slot.hp = o.enemyHp ?? 1; slot.maxHp = 60; slot.moves=[o.enemyMove ?? 150,0,0,0]; slot.pp=[35,0,0,0];
    writePartySlot(s,'enemy',i,slot); s.mem[ENEMY_SEND_CELLS.wEnemyPartySpecies+i]=0x24;
  }
  s.mem[ENEMY_SEND_CELLS.wEnemyPartySpecies+enemies]=255; s.wEnemyMonPartyPos=0;
  // Source enemy header's seven in-place EXP bytes; overwritten by actual replacement/header loads.
  s.setBytes(D.wEnemyMonBaseStats,[10,20,30,40,50,60,70],7);
  s.setBag([]); video.saveScreenTilesToBuffer1();
  let divSecond=false, nextRoll=0;
  s.readDIV=()=>{
    if (!divSecond) { divSecond=true; return (nextRoll-s.hRandomAdd-1)&255; }
    divSecond=false; return 0;
  };
  // Drive real BattleRandom through DIV, recording its actor, phase and byte. Unexpected draws fail.
  const rng=random.battleRandom;
  vi.spyOn(random,'battleRandom').mockImplementation(state=>{
    const values:Record<string,number>={select:0,crit:8,range:179,hit:0,run:255};
    expect(values[rngPhase],`unplanned RNG ${rngPhase}`).toBeDefined(); nextRoll=values[rngPhase];
    const value=rng(state); mark('rng',[rngPhase,s.hWhoseTurn,value]); return value;
  });
  s.random=()=>random.battleRandom(s);
  const choose=selection.selectEnemyMove;
  vi.spyOn(selection,'selectEnemyMove').mockImplementation((state,trainer)=>{
    if(trainer) trainer.enemy={...trainer.enemy,moves:Array.from({length:4},(_,i)=>s.mem[D.wEnemyMonMoves+i])
      .filter(id=>id!==0).map(id=>({id:getAllLoadedMoveIds().find(k=>getMove(k)!.id===id)!,pp:35,maxPp:35}))};
    rngPhase='select'; choose(state,trainer); rngPhase='unexpected';
  });
  const crit=damage.criticalHitTest, range=damage.randomizeDamage, accuracy=hit.moveHitTest;
  vi.spyOn(damage,'criticalHitTest').mockImplementation(state=>{rngPhase='crit';crit(state);rngPhase='unexpected';});
  vi.spyOn(damage,'randomizeDamage').mockImplementation(state=>{rngPhase='range';range(state);rngPhase='unexpected';});
  vi.spyOn(hit,'moveHitTest').mockImplementation(state=>{rngPhase='hit';const r=accuracy(state);rngPhase='unexpected';return r;});
  const display=menu.displayBattleMenu;
  vi.spyOn(menu,'displayBattleMenu').mockImplementation(function* (...args){
    const prior=phase; phase='battle'; entry++; if(entry>20)throw new Error('history exceeded 20 turns');
    action=o.action?.(entry,s)??'fight'; mark('menu',[entry,action]);
    const result=yield* display(...args); phase=prior; return result;
  });
  const move=moves.moveSelectionMenu;
  vi.spyOn(moves,'moveSelectionMenu').mockImplementation(function* (...args){
    const prior=phase;phase='move';const result=yield* move(...args);phase=prior;return result;
  });
  const bag=menu.bagWasSelected;
  vi.spyOn(menu,'bagWasSelected').mockImplementation(function* (...args){
    const prior=phase;phase='bag';const result=yield* bag(...args);phase=prior;return result;
  });
  const two=twoOption.displayTwoOptionMenu;
  vi.spyOn(twoOption,'displayTwoOptionMenu').mockImplementation(function* (...args){
    const prior=phase;phase='yesNo';mark('yesNo',[s.wEnemyMonHP,s.wPlayerMonNumber]);
    const result=yield* two(...args);phase=prior;return result;
  });
    // Observe PartyMenu's real input owner instead of replacing chooseParty.
  const partyFrame=party.frameBattleChoice.bind(party);
  vi.spyOn(party,'frameBattleChoice').mockImplementation((read,sound)=>{
    const prior=phase;phase='party';target=1;const result=partyFrame(read,sound);phase=prior;return result;
  });
  const fall=sfxData('faint_fall'), thud=sfxData('faint_thud'), run=sfxData('run');
  const host:BattleLoopHost & LearnMoveHost & BattleEndHost = {
    screen,tiles:video.tiles,audio:bridge,partyView:party,
    renderTiles:{sprites:{width:128,height:128,data:new Uint8ClampedArray(128*128*4)}},
    pokeballTiles:PNG.sync.read(readFileSync(resolve(__dirname,'../../static/gfx/battle/balls.png'))),
    faintFall:{id:0x9e,data:fall},faintThud:{id:0x95,data:thud},runSound:{id:0x97,data:run},swapSound:{id:0xae,data:sfxData('swap')},
    printText:function* (label,bindings,options){
      // Snapshot eager bindings at their source print, never retain mutable WRAM getter objects.
      const eager=bindings?Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(bindings))
        .filter(([,d])=>'value' in d).map(([key,d])=>[key,d.value as unknown])):null;
      mark(`text:${label}`,eager);yield* driver.printText(label,bindings,options);
      mark(`textEnd:${label}`,Array.from({length:2},(_,y)=>Array.from({length:18},(_,x)=>String(screen.at(x+1,14+2*y)??' ')).join('').trimEnd()));
    },
    saveScreenTilesToBuffer1(){mark('save1');video.saveScreenTilesToBuffer1();},
    loadScreenTilesFromBuffer1(){mark('load1');video.loadScreenTilesFromBuffer1();},
    saveScreenTilesToBuffer2(){mark('save2');video.saveScreenTilesToBuffer2();},
    loadScreenTilesFromBuffer2(){mark('load2');video.loadScreenTilesFromBuffer2();},
    getMove(id){const key=getAllLoadedMoveIds().find(key=>getMove(key)!.id===id)!;return {...getMove(key)!,name:key};},
    readJoypad(){
      let keys:GameButton[]=['a'];
      if(phase==='battle'&&ctx.joy7!==1) {
        const wanted=action==='fight'?0:action==='run'?3:1, right=ctx.cursor.topX===15;
        if(right!==(wanted>=2)) keys=[right?'left':'right'];
        else if(ctx.currentMenuItem!==(wanted%2)) keys=['down'];
      } else if(phase==='party') {
        const cursor=(party as unknown as {cursor:number}).cursor;
        keys=[cursor===target?'a':'down'];
      } else if(phase==='yesNo' && ((o.refuseNext && s.wIsInBattle===1)||(s.wIsInBattle===2&&s.wPlayerMonNumber===1))) keys=['b'];
      setKeys(keys);mark('input',[phase,keys,getPartyAndBillsSavedMenuItem()]);
    },
    pressSound(){mark('press');bridge.play({id:0x90,data:sfxData('press_ab')});},
    waitForSound:function*(){mark('wait');while(!soundFinished(audio.sfx,audio.music,0))yield 'serviced';},
    playSound(name){mark('sound',name);bridge.play({id:0x97,data:sfxData(name)});},
    runOdds(player,enemy,attempts){
      mark('runOdds',[player,enemy,attempts]); if(player>=enemy)return true;
      const divisor=(enemy>>>2)&255;if(!divisor)return true;
      const chance=Math.floor(((player*32)&65535)/divisor)+30*((attempts||256)-1);
      rngPhase='run';const result=chance>255||chance>=s.random();rngPhase='unexpected';return result;
    },
    updateSprites(){mark('sprites');},
    backPicture(state){mark('back',state.wBattleMonSpecies2);return 'back';},
    frontPicture(state){mark('front',state.wEnemyMonSpecies2);return 'front';},
    trainerPicture(){mark('trainerPic');return 'trainer';},
    sendingOutMon(state,x,y){mark('sendCue',[state.hWhoseTurn,x,y]);},
    pikachuEntrance(){mark('pikaEntrance');},slidePlayerOff(){mark('pikaRetreat');},
    animation:function* (state){mark('animationCue',[state.wAnimationID,state.hWhoseTurn]);},
    voice:{getAlarm:lowHealthAlarm,setAlarm:setLowHealthAlarm,cry(id){mark('cryCue',id);},clip(id){mark('pcmCue',id);}},
    stopAllMusic(){mark('stopMusic');audio.fade.requests.stopAllMusic();},
    playVictoryMusic(name,bank){mark('music',[name,bank]);bridge.audioBank=bridge.savedAudioBank=bank;audio.music.play(musicData(name));},
    printEndBattleText:function* (state){
      // Approved injected map hand-off (home/trainers.asm:334-379); retained text, not interpolated pages.
      const print=(state.mem[0xd72c]&0x80)!==0; state.mem[0xd72c]&=~0x80;
      mark('endTextHandOff',[print,state.wBattleResult]); if(!print)return;
      yield* host.printText('TrainerEndBattleText',{nameBuffer:decodeNick(state.mem,D.wTrainerName)},
        {asm:{TrainerEndBattleText:state=>{mark('endTextCursor',state);return o.endText??'PrintEmptyString.emptyString';}}});
      yield* host.waitForSound();
    },
    enemySlideOff(){mark('enemySlideCue');},
    readScrollJoypad(){mark('scrollRead');return isPassPressed('a')?1:0;},
    learnMove:function*(){throw new Error('unbound LearnMove');},
    useItem:function* (context){
      // Catch body belongs to A5c3e. Exercise the real bag return/result2 boundary only.
      mark('catchHandOff',context.curItem); context.actionResultOrTookBattleTurn=1;context.capturedMonSpecies=s.wEnemyMonSpecies;
    },
    partyMenu:function*(){throw new Error('unexpected voluntary party menu');},
    evolutionAfterBattle:function* (state){mark('evolutionHandOff',[state.mem[D.wCanEvolveFlags],state.mem[D.wForceEvolution]]);},
  };
  bindLearnMove(host,host);
  vi.mocked(playSFX).mockImplementation(async name=>{
    const resolved=bridge.resolveTextSound(name);mark('textSound',resolved);
    bridge.play({id:name==='get_item1'?0x86:0x90,data:sfxData(resolved)});
  });
  vi.mocked(isSoundFinished).mockImplementation(()=>soundFinished(audio.sfx,audio.music,0));
  const play=bridge.play.bind(bridge);vi.spyOn(bridge,'play').mockImplementation(sound=>{mark('sfx',[sound.id,bridge.audioBank]);return play(sound);});
  const presentation={animation:host.animation,
    hideSubstitute:function*(){mark('hideSubstituteCue');},reshowSubstitute:function*(){mark('reshowSubstituteCue');}};
  const env:MoveEffectEnvironment={...presentation,host,screen,
    animationSubstitute:function*(){mark('substituteCue');},animationTransformMon:function*(){mark('transformCue');},moveMenu:{ctx,host}};
  const ports:TurnPorts={...presentation,jumpMoveEffect:composedJumpMoveEffect(env),
    statModifierUpEffect:state=>statModifierUpEffect(state,env),
    substituteBreak:function*(){mark('substituteBreakCue');},shake:function*(){mark('shakeCue');},
    trainerAI:function*(){mark('trainerAIHandOff');return {carry:false};},
    switchEnemyMon:function*(){throw new Error('unsupported link switch hand-off');}};
  const trainers=():TrainerMoveSelection=>({enemy:{...s.partyMons[0]!,moves:[{id:getAllLoadedMoveIds().find(k=>getMove(k)!.id===(o.enemyMove??150))!,pp:35,maxPp:35}]},
    player:s.partyMons[0]!,aiModifiers:[]});
  // All WRAM changes and object mirrors recorded after every CPU resume, including completion.
  const raw=Buffer.from(s.mem.buffer,s.mem.byteOffset,s.mem.byteLength),previous=Buffer.from(s.mem);
  let mirror='';
  function capture(){
    const delta:string[]=[];
    // Most text/copy frames leave WRAM untouched; native comparison avoids scanning 64K in JS then.
    if(!raw.equals(previous)){
      for(let i=0;i<s.mem.length;i++)if(s.mem[i]!==previous[i])delta.push(`${i.toString(16)}:${previous[i].toString(16)}>${s.mem[i].toString(16)}`);
      previous.set(s.mem);
    }
    const next=JSON.stringify(s.partyMons.slice(0,count).map(mon=>mon&&({hp:mon.currentHp,level:mon.level,exp:mon.exp,statExp:mon.statExp,
      moves:mon.moves.map(m=>[m.id,m.pp]),stats:[mon.maxHp,mon.attack,mon.defense,mon.speed,mon.special]})));
    if(delta.length)writes.push(`${time} ${delta.join(' ')}`);
    if(next!==mirror){mark('mirror',JSON.parse(next));mirror=next;}
  }
  function runBattle(prelude?:Program,beforeEnd?:()=>void){
    const trainer=o.trainer?trainers():undefined;
    driver.start((function*():Program<string>{
      if(prelude){mark('priorAward');yield* prelude;mark('priorAwardReturned');}
      const exit=yield* battleLoop(s,ctx,host,ports,trainer); mark('loopReturned',[exit,s.wBattleResult]);
      beforeEnd?.();
      yield* endOfBattle(s,host);mark('endReturned',[exit,s.wBattleResult]);return exit;
    })());capture();
    for(let i=0;!driver.done&&i<6000;i++){
      time++;
      const partyText=(party as unknown as {openingTextBox:TextBox}).openingTextBox;
      setKeys(time%2===0?(video.textBox.isWaitingForInput||partyText.isWaitingForInput?['b']:['a']):[]);
      const pending=(driver as unknown as {pending:IteratorResult<Frame,string>}).pending;
      if(!pending.done&&pending.value==='session')audio.update();
      // The pending frame completes before CPU resume, even when that resume rejects link.
      if(!pending.done)frames.push(pending.value);
      try{driver.step();}finally{capture();}
    }
    expect(driver.done,JSON.stringify(events.slice(-12))).toBe(true);
    expect(audio.synth.update).toBe(frames.filter(f=>f!=='held').length);
    return driver.result;
  }
  function ledger(){
    const runs:{kind:Frame;count:number}[]=[];
    for(const kind of frames){const last=runs[runs.length-1];if(last?.kind===kind)last.count++;else runs.push({kind,count:1});}
    return {frames:runs,events,writes,audio:audio.synth.log.map(w=>`${w.u}:${w.m}(${w.a.join(',')})`),
      final:{result:s.wBattleResult,money:faint.readBattleBcd(s,D.wPlayerMoney),party:[...s.mem.slice(D.wPartyMons,D.wPartyMons+44*count)]}};
  }
  return {s,ctx,host,ports,driver,screen,video,party,audio,bridge,events,frames,writes,mark,runBattle,ledger,
    setAction(fn:NonNullable<History['action']>){o.action=fn;}};
}
