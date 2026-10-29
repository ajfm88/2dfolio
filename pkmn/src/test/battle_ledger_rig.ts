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
import { getPartyAndBillsSavedMenuItem, getListScrollOffset } from '../list_state';
import type { GameButton } from '../core';
import { BattleState, battleContext, encodeText, decodeNick } from '../battle/battle_state';
import { ENEMY_SEND_CELLS } from '../battle/battle_enemy_send_out';
import { D } from '../battle/battle_end_state';
import { BattleHost } from '../battle/battle_host';
import { BattleAudio } from '../battle/battle_audio';
import { createPokemon, getMove, getAllLoadedMoveIds } from '../battle/data';
import { partySlotFromPokemon, writePartySlot, loadBattleMonFromParty, loadEnemyMonFromParty } from '../battle/battle_loaders';
import { A } from '../battle/battle_state';
import * as aiMoves from '../battle/battle_ai_moves';
import * as stats from '../battle/battle_effects_stats';
import * as hpBar from '../battle/battle_hp';
import * as sendOut from '../battle/battle_enemy_send_out';
import { getMoveRecord } from '../battle/battle_move_data';
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
import { I } from '../battle/battle_item_state';
import { bindBattleItems, type BattleItemHost } from '../battle/battle_items';
import { registerShortBattleItemBodies } from '../battle/battle_item_bodies';
import { registerFluteBattleItemBody } from '../battle/battle_item_flute';
import { registerMedicineBattleItemBody } from '../battle/battle_item_medicine';
import { createMedicineItemEnvironment } from '../battle/battle_item_medicine_env';
import { registerPPBattleItemBody } from '../battle/battle_item_pp';
import { registerBallBattleItemBody } from '../battle/battle_item_ball';
import { ballHomes, readBoxSlot, battlePokemonFromPartyBytes, type CaughtMonEnvironment } from '../battle/battle_add_mon';
import { trainerAIBuilder } from '../battle/battle_trainer_ai';
import type { SfxData } from '../audio/sfx_engine';

export interface History {
  real?: true;
  // checkpoint-10b: fixture/header controls and observations are opt-in on real ports only.
  trainerTrace?: true; trainerClass?: number; aiCount?: number;
  enemyMoves?: number[]; enemySpecies?: number; enemyStatus?: number;
  enemyMaxHp?: number; playerAttack?: number; playerSpeed?: number; encouragement?: number;
  types?: Record<number, [number, number]>;
  sounds?: BattleItemHost['sounds']; streams?: SfxData;
  draws?: Partial<Record<string, number[]>>;
  bagTarget?: number; partyTarget?: number; moveTarget?: number; nickname?: string;
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
  let itemUses = 0, refused = false, printing = false;
  const queues = Object.fromEntries(Object.entries(o.draws ?? {}).map(([key, values]) => [key, [...values!]]));
  const disposers: (() => void)[] = [];
  const dispose = () => disposers.splice(0).reverse().forEach(remove => remove());
  const mark = (name: string, data: unknown = null) => events.push({ at: time, name, data });
  const setKeys = (keys: GameButton[]) => {
    vi.mocked(isHeld).mockImplementation(k => keys.includes(k));
    vi.mocked(isPassPressed).mockImplementation(k => keys.includes(k));
  };
  s.species = id => ({ name: id === 0x24 ? 'PIDGEY' : 'PIKACHU', base: [40,45,40,56,35],
    type1: o.real ? o.types?.[id]?.[0] ?? 0 : 0, type2: o.real ? o.types?.[id]?.[1] ?? 0 : 0, catchRate: 255, baseExp: 60,
    moves: [o.enemyMove ?? 150,0,0,0], learnset: [], growthRate: 0 });
  s.movePP = id => o.real&&o.trainerTrace ? getMoveRecord(id)[5] : 35;
  const count = 1 + (o.reserves ?? 0);
  s.mem[D.wPartyCount] = count;
  for (let i = 0; i < count; i++) {
    const mon = createPokemon('PIDGEY', 20, ['LEAD','RESERVE','THIRD','FOURTH','FIFTH','SIXTH'][i],{atk:8,def:8,spd:8,spc:8})!;
    s.partyMons[i] = mon;
    const slot = partySlotFromPokemon(mon);
    slot.hp = o.hp ?? 60; slot.maxHp = 60; slot.speed = o.playerFirst === false ? 50 : 150;
    if(o.real&&o.playerSpeed!==undefined)slot.speed=o.playerSpeed;
    if(o.real && o.types){slot.type1=s.species(0x24).type1;slot.type2=s.species(0x24).type2;}
    slot.moves = [o.playerMove ?? 33,0,0,0]; slot.pp = [35,0,0,0];
    if(o.real&&o.trainerTrace)slot.pp=[getMoveRecord(slot.moves[0])[5],0,0,0];
    slot.exp = 8000; slot.otId = 0x1234; slot.otName = 'ASH'; writePartySlot(s,'player',i,slot);
    s.mem[D.wPartySpecies+i] = 0x24;
    // The old fixture intentionally overrides bytes without synchronizing presentation objects.
    // Real item menus must see those same HP/stat/move bytes, through the existing mirror adapter.
    if(o.real)s.partyMons[i]=battlePokemonFromPartyBytes(s,i);
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
  if(!(o.real&&o.types))s.wBattleMonType1 = s.wBattleMonType2 = s.wEnemyMonType1 = s.wEnemyMonType2 = 0;
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
  if (o.real) { s.mem[I.wBoxCount] = 0; s.mem[I.wBoxSpecies] = 255; }
  if(o.real){
    if(o.trainerClass!==undefined)s.mem[D.wTrainerClass]=o.trainerClass;
    // init_battle.asm:45 initializes FF; absent retains the old fixture's zero.
    if(o.aiCount!==undefined)s.mem[D.wAICount]=o.aiCount;
    if(o.encouragement!==undefined)s.wAILayer2Encouragement=o.encouragement; // core.asm:925,5656
    if(o.enemyMoves && o.enemyMoves.length>4)throw new Error('enemyMoves exceeds four slots');
    if(o.trainerTrace || o.enemyMoves || o.enemySpecies!==undefined || o.enemyStatus!==undefined || o.types || o.enemyMaxHp!==undefined){
      const species=o.enemySpecies??0x24, header=s.species(species);
      const ids=Array.from({length:4},(_,i)=>o.enemyMoves?.[i]??(i===0?o.enemyMove??150:0));
      const pp=ids.map(id=>id?getMoveRecord(id)[5]:0);
      // core.asm LoadEnemyMonFromParty: seed the roster, then the real loader copies status/types
      // and applies the paralysis penalty (6463–6509). No active type byte is patched afterwards.
      for(let i=0;i<enemies;i++){
        const at=D.wEnemyMons+44*i;s.mem[at]=species;
        s.mem[at+4]=o.enemyStatus??0;s.mem[at+5]=header.type1;s.mem[at+6]=header.type2;
        s.setBytes(at+8,ids,4);s.setBytes(at+29,pp,4);
        s.writeBE(at+34,o.enemyMaxHp??60);
        for(const offset of [36,38,42])s.writeBE(at+offset,20);
        s.writeBE(at+40,100);s.mem[ENEMY_SEND_CELLS.wEnemyPartySpecies+i]=species;
      }
      s.wEnemyMonSpecies2=species;s.wWhichPokemon=0;loadEnemyMonFromParty(s);
      s.wEnemyMonPartyPos=0;
    }
    if(o.playerAttack!==undefined){s.wBattleMonAttack=o.playerAttack;s.writeBE(A.wPlayerMonUnmodifiedLevel+3,o.playerAttack);}
  }
  const trace=!!(o.real&&o.trainerTrace);
  const record=()=>[...s.mem.slice(A.wEnemyMoveNum,A.wEnemyMoveNum+6)];
  const aiState=()=>({count:s.mem[D.wAICount],hp:s.wEnemyMonHP,status:s.wEnemyMonStatus,
    rosterStatus:s.mem[D.wEnemyMon1Status+44*s.wEnemyMonPartyPos],speed:s.wEnemyMonSpeed,
    status3:s.wEnemyBattleStatus3,first:s.wFirstMonsNotOutYet,record:record(),
    defense:s.wEnemyMonDefense,stage:s.mem[D.wEnemyMonStatMods+1],damage:s.wDamage});
  let listAddress:number|undefined;
  if(trace){
    const chooseAI=aiMoves.AIEnemyTrainerChooseMoves;
    vi.spyOn(aiMoves,'AIEnemyTrainerChooseMoves').mockImplementation(state=>{listAddress=chooseAI(state);return listAddress;});
    const bar=hpBar.updateHPBar2;
    vi.spyOn(hpBar,'updateHPBar2').mockImplementation(function* (...args){
      if(rngPhase==='ai')mark('trainerHpBar',args.slice(2));yield* bar(...args);
    });
    const stat=stats.statModifierUpEffect;
    vi.spyOn(stats,'statModifierUpEffect').mockImplementation(function* (...args){mark('trainerStatEntry',record());yield* stat(...args);});
    const send=sendOut.enemySendOut;
    vi.spyOn(sendOut,'enemySendOut').mockImplementation(function* (...args){
      mark('trainerSendEntry',{...aiState(),roster:[...s.mem.slice(D.wEnemyMon1HP,D.wEnemyMon1HP+4)]});
      const result=yield* send(...args);mark('trainerSendReturn',aiState());return result;
    });
    const counter=hit.handleCounterMove;
    vi.spyOn(hit,'handleCounterMove').mockImplementation(state=>{
      if(state.hWhoseTurn!==0||state.wPlayerSelectedMove!==68)return counter(state);
      mark('counterEntry',{record:record(),selected:s.wEnemySelectedMove,damage:s.wDamage,hp:s.wEnemyMonHP});
      const prior=rngPhase;rngPhase='hit';const result=counter(state);rngPhase=prior;
      mark('counterReturn',{...result,damage:s.wDamage});return result;
    });
  }
  let divSecond=false, nextRoll=0, carry: 0 | 1 = 1;
  s.readDIV=()=>{
    if (!divSecond) { divSecond=true; return (nextRoll-s.hRandomAdd-carry)&255; }
    divSecond=false; return 0;
  };
  // Drive real BattleRandom through DIV, recording its actor, phase and byte. Unexpected draws fail.
  const rng=random.battleRandom;
  function planned(): number {
    const values:Record<string,number>={select:0,crit:trace?255:8,range:179,hit:0,run:255,...(trace?{effect:255}:{})};
    const value = queues[rngPhase] ? queues[rngPhase].shift() : values[rngPhase];
    expect(value,`unplanned RNG ${rngPhase}`).toBeDefined();
    return value!;
  }
  vi.spyOn(random,'battleRandom').mockImplementation(state=>{
    if(trace&&rngPhase==='select')mark('selectDrawState',{scores:[...s.mem.slice(A.wBuffer,A.wBuffer+4)],record:record(),encouragement:s.wAILayer2Encouragement});
    nextRoll=planned(); carry=state.wLinkState<4?1:0;
    const value=rng(state); mark('rng',o.real?['BattleRandom',rngPhase,s.hWhoseTurn,value]:[rngPhase,s.hWhoseTurn,value]); return value;
  });
  if (o.real) {
    const rawRandom = random.random;
    vi.spyOn(random,'random').mockImplementation((state, carryIn) => {
      carry=carryIn; nextRoll=planned();
      const value=rawRandom(state,carryIn);
      mark('rng',['Random',rngPhase,s.hWhoseTurn,value]); return value;
    });
  }
  s.random=()=>random.battleRandom(s);
  const choose=selection.selectEnemyMove;
  vi.spyOn(selection,'selectEnemyMove').mockImplementation((state,trainer)=>{
    if(trainer) trainer.enemy={...trainer.enemy,moves:Array.from({length:4},(_,i)=>s.mem[D.wEnemyMonMoves+i])
      .filter(id=>id!==0).map(id=>({id:getAllLoadedMoveIds().find(k=>getMove(k)!.id===id)!,pp:35,maxPp:35}))};
    listAddress=undefined;rngPhase='select'; choose(state,trainer); rngPhase='unexpected';
    if(trace)mark('selectReturn',{scores:[...s.mem.slice(A.wBuffer,A.wBuffer+4)],listAddress,
      list:listAddress===undefined?[]:[...s.mem.slice(listAddress,listAddress+4)],record:record(),
      effectiveness:s.wTypeEffectiveness,encouragement:s.wAILayer2Encouragement,selected:s.wEnemySelectedMove});
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
    const result=yield* two(...args);if(o.real)mark('yesNoReturned',result);phase=prior;return result;
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
      mark(`text:${label}`,eager);
      if(trace)mark('textEntryState',{label,channels:[5,6,7].map(ch=>bridge.channelId(ch)),...aiState()});
      const was=printing;printing=true;yield* driver.printText(label,bindings,options);printing=was;
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
        else if(ctx.currentMenuItem!==(wanted%2)) keys=[o.real&&ctx.currentMenuItem>(wanted%2)?'up':'down'];
      } else if(o.real && (phase==='bag'||phase==='battle'&&ctx.joy7===1)) {
        keys=refused?['b']:[ctx.currentMenuItem + getListScrollOffset() === (o.bagTarget??0)?'a':'down'];
      } else if(o.real && phase==='itemParty') {
        const cursor=(party as unknown as {cursor:number}).cursor;
        keys=[cursor===(o.partyTarget??0)?'a':'down'];
      } else if(o.real && phase==='move' && s.wMoveMenuType===2) {
        keys=[ctx.currentMenuItem===(o.moveTarget??0)+1?'a':ctx.currentMenuItem>(o.moveTarget??0)+1?'up':'down'];
      } else if(o.real && phase==='nickname') {
        keys=o.nickname===undefined?['b']:['a'];
      } else if(phase==='party') {
        const cursor=(party as unknown as {cursor:number}).cursor;
        keys=[cursor===target?'a':'down'];
      } else if(phase==='yesNo' && ((o.refuseNext && s.wIsInBattle===1)||(s.wIsInBattle===2&&s.wPlayerMonNumber===1))) keys=['b'];
      setKeys(keys);mark('input',[o.real&&phase==='battle'&&ctx.joy7===1?'bag':phase,keys,getPartyAndBillsSavedMenuItem()]);
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
    animation:function* (state){mark('animationCue',[state.wAnimationID,state.hWhoseTurn]);
      if(o.real&&state.wAnimationID===0xc1)mark('ballAnimData',state.mem[I.wPokeBallAnimData]);},
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
    bridge.play({id:o.real&&name==='caught_mon'?0x9a:o.real&&name==='dex_page_added'?0x98:name==='get_item1'?0x86:0x90,data:sfxData(resolved)});
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
  if(trace){
    const jump=ports.jumpMoveEffect;
    ports.jumpMoveEffect=function* (...args){const prior=rngPhase;rngPhase='effect';const result=yield* jump(...args);rngPhase=prior;return result;};
  }
  if (o.real) {
    if (!o.sounds || !o.streams) throw new Error('real ledger requires preloaded item sounds and flute streams');
    const standalone=video.textBox.printStandalone.bind(video.textBox);
    vi.spyOn(video.textBox,'printStandalone').mockImplementation((source,options)=>{
      if(!printing && typeof source==='object' && 'program' in source)mark(`text:${source.program}`);
      return standalone(source,options);
    });
    const load1=video.loadScreenTilesFromBuffer1.bind(video),save1=video.saveScreenTilesToBuffer1.bind(video);
    vi.spyOn(video,'loadScreenTilesFromBuffer1').mockImplementation(()=>{mark('videoLoad1');load1();});
    vi.spyOn(video,'saveScreenTilesToBuffer1').mockImplementation(()=>{mark('videoSave1');save1();});
    const palette=screen.setPalBattle.bind(screen);
    vi.spyOn(screen,'setPalBattle').mockImplementation(function* (...args){mark('palette');yield* palette(...args);mark('paletteEnd');});
    const itemHost: BattleItemHost={tiles:host.tiles,printText:(...args)=>host.printText(...args),
      readScrollJoypad:()=>host.readScrollJoypad(),audio:bridge,sounds:o.sounds,waitForSound:()=>host.waitForSound()};
    const itemPresentation={screen,video,partyView:party,pressSound:()=>host.pressSound(),
      readJoypad(){const prior=phase;phase='itemParty';host.readJoypad();phase=prior;}};
    const caught: CaughtMonEnvironment={state:s,host:itemHost,video,
      menu:{...host,readJoypad(){const prior=phase;phase='nickname';host.readJoypad();phase=prior;}},
      displayNamingScreen:function* (species,type,destination){
        mark('namingHandOff',[species,type,destination]);
        if(o.nickname!==undefined){
          const bytes=encodeText(`${o.nickname}@`);s.setBytes(I.wStringBuffer,bytes,11);s.setBytes(destination,bytes,11);
        }
      }};
    try {
      disposers.push(registerShortBattleItemBodies({...presentation,loadScreenTilesFromBuffer1:()=>host.loadScreenTilesFromBuffer1()}));
      disposers.push(registerFluteBattleItemBody({sfx:audio.sfx,streams:o.streams,loadScreenTilesFromBuffer2:()=>host.loadScreenTilesFromBuffer2()}));
      disposers.push(registerMedicineBattleItemBody(createMedicineItemEnvironment(s,itemPresentation)));
      disposers.push(registerPPBattleItemBody({...itemPresentation,moveMenu:host}));
      disposers.push(registerBallBattleItemBody({video,animation:host.animation,...ballHomes(caught),
        showPokedexData:function*(){mark('dexPageHandOff',[s.wEnemyMonSpecies,[...s.mem.slice(I.wPokedexOwned,I.wPokedexOwned+19)]]);}}));
    } catch(error) { dispose(); throw error; }
    const use=bindBattleItems(s,itemHost);
    host.useItem=function* (context){
      itemUses++;const prior=phase;phase='item';rngPhase='ball';mark('itemEntry',[itemUses,context.curItem,context.itemIndex]);
      yield* use(context);rngPhase='unexpected';
      mark('itemReturned',{result:s.wActionResultOrTookBattleTurn,captured:s.wCapturedMonSpecies,escaped:s.wEscapedFromBattle,
        hp:s.wBattleMonHP,status:s.wBattleMonStatus,stats:[s.wBattleMonMaxHP,s.wBattleMonAttack,s.wBattleMonDefense,s.wBattleMonSpeed,s.wBattleMonSpecial],
        pp:[...s.mem.slice(I.wBattleMonPP,I.wBattleMonPP+4)],alarm:lowHealthAlarm(),chan5:bridge.channelId(5),items:itemState()});
      refused=s.wActionResultOrTookBattleTurn===0;if(refused)action='fight';phase=prior;
    };
    const ai=trainerAIBuilder({screen,items:itemHost,text:host,sendOut:host,...presentation});
    ports.trainerAI=function* (state){rngPhase='ai';mark('trainerAIEntry',s.mem[D.wAICount]);
      if(trace)mark('trainerBefore',aiState());const r=yield* ai(state);
      if(trace)mark('trainerAfter',{...aiState(),carry:r.carry});rngPhase='unexpected';return r;};
  }
  const trainers=():TrainerMoveSelection=>({enemy:{...s.partyMons[0]!,moves:[{id:getAllLoadedMoveIds().find(k=>getMove(k)!.id===(o.enemyMove??150))!,pp:35,maxPp:35}]},
    player:s.partyMons[0]!,aiModifiers:[]});
  // All WRAM changes and object mirrors recorded after every CPU resume, including completion.
  const raw=Buffer.from(s.mem.buffer,s.mem.byteOffset,s.mem.byteLength),previous=Buffer.from(s.mem);
  let mirror='', channelIds='';
  function capture(){
    const delta:string[]=[];
    // Most text/copy frames leave WRAM untouched; native comparison avoids scanning 64K in JS then.
    if(!raw.equals(previous)){
      for(let i=0;i<s.mem.length;i++)if(s.mem[i]!==previous[i])delta.push(`${i.toString(16)}:${previous[i].toString(16)}>${s.mem[i].toString(16)}`);
      previous.set(s.mem);
    }
    const next=JSON.stringify(s.partyMons.slice(0,o.real?s.mem[D.wPartyCount]:count).map(mon=>mon&&({hp:mon.currentHp,level:mon.level,exp:mon.exp,statExp:mon.statExp,
      moves:mon.moves.map(m=>[m.id,m.pp]),stats:[mon.maxHp,mon.attack,mon.defense,mon.speed,mon.special]})));
    if(delta.length)writes.push(`${time} ${delta.join(' ')}`);
    if(next!==mirror){mark('mirror',JSON.parse(next));mirror=next;}
    if(o.real){
      const ids=[5,6,7].map(id=>bridge.channelId(id)),nextIds=JSON.stringify(ids);
      if(nextIds!==channelIds){mark('channelIds',ids);channelIds=nextIds;}
    }
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
    if(o.real)for(const [name,queue] of Object.entries(queues))expect(queue,`unused RNG ${name}`).toEqual([]);
    return driver.result;
  }
  function itemState(){
    return {bag:[...s.mem.slice(I.wNumBagItems,I.wNumBagItems+2*s.mem[I.wNumBagItems]+2)],
      mirror:ctx.bag.map(item=>({...item})),partyCount:s.mem[I.wPartyCount],
      species:[...s.mem.slice(I.wPartySpecies,I.wPartySpecies+s.mem[I.wPartyCount]+1)],
      boxCount:s.mem[I.wBoxCount],box:[readBoxSlot(s,0),readBoxSlot(s,1)],owned:[...s.mem.slice(I.wPokedexOwned,I.wPokedexOwned+19)],
      mood:s.mem[I.wPikachuMood],emotion:s.mem[I.wPikachuEmotionModifier],
      result:s.wActionResultOrTookBattleTurn,captured:s.wCapturedMonSpecies,escaped:s.wEscapedFromBattle};
  }
  function ledger(){
    const runs:{kind:Frame;count:number}[]=[];
    for(const kind of frames){const last=runs[runs.length-1];if(last?.kind===kind)last.count++;else runs.push({kind,count:1});}
    return {frames:runs,events,writes,audio:audio.synth.log.map(w=>`${w.u}:${w.m}(${w.a.join(',')})`),
      final:{result:s.wBattleResult,money:faint.readBattleBcd(s,D.wPlayerMoney),party:[...s.mem.slice(D.wPartyMons,D.wPartyMons+44*(o.real?s.mem[D.wPartyCount]:count))]},
      ...(o.real?{items:itemState()}: {})};
  }
  return {s,ctx,host,ports,driver,screen,video,party,audio,bridge,events,frames,writes,mark,runBattle,ledger,itemState,dispose,
    setAction(fn:NonNullable<History['action']>){o.action=fn;}};
}
