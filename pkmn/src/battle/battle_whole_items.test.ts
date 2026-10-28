// checkpoint-10: player items through the real loop, item bodies and EndOfBattle.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
vi.mock('../input',()=>({isHeld:vi.fn(()=>false),isPassPressed:vi.fn(()=>false),syncJoypadRead:vi.fn()}));
vi.mock('../audio',()=>({playSFX:vi.fn(),isSoundFinished:vi.fn(()=>true)}));
vi.mock('../renderer',()=>({drawTile:vi.fn(),fillRect:vi.fn(),drawFadeOverlay:vi.fn(),drawSprite:vi.fn(),
  getScale:()=>1,getCtx:()=>({drawImage(){},save(){},translate(){},scale(){},restore(){}}),
  loadSprite:async()=>({width:128}),loadFont:async()=>({width:128}),loadTileset:async()=>({width:128})}));
import { battleLedger, type History } from '../test/battle_ledger_rig';
import { loadBattleItemSounds, type BattleItemHost } from './battle_items';
import { loadBattleFluteStreams } from './battle_flute_audio';
import * as flute from './battle_flute_audio';
import { loadTrainerAIItemNames } from './battle_trainer_ai';
import type { SfxData } from '../audio/sfx_engine';
import { loadBattleMoveData } from './battle_move_data';
import { loadStatEffectData } from './battle_effects_stats';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem,setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { loadPartyTiles } from '../menus/party_tiles';
import { loadPartyIcons } from '../menus/party_icons';
import { enablePikachuFollowing } from '../pikachu/pikachu_following';
import { initItemNames } from '../items';
import { resetListStateForEmptySlot,setBattleAndStartSavedMenuItem,setPartyAndBillsSavedMenuItem } from '../list_state';
import { setLowHealthAlarm,setLowHealthAlarmDisabled,setLowHealthChannel5 } from '../audio/low_health_alarm';
import { I } from './battle_item_state';
import { D } from './battle_end_state';
import { encodeText,decodeNick } from './battle_state';
import { loadBattleMonFromParty } from './battle_loaders';
import * as loaders from './battle_loaders';
import * as stats from './battle_effects_stats';
import { getSpeciesById } from './data';
import { readBoxSlot } from './battle_add_mon';
import { BALL } from './battle_item_ball';

let sounds: BattleItemHost['sounds'], streams: SfxData;
type Rig = ReturnType<typeof battleLedger>;
const active: Rig[]=[];
beforeAll(async()=>{
  await loadBattleMoveData();await loadTextPrograms();await loadStatEffectData();await initTextSystem();
  await loadPartyTiles();await loadPartyIcons();await loadTrainerAIItemNames();
  sounds=await loadBattleItemSounds();streams=await loadBattleFluteStreams();
  initItemNames(await (await fetch('item_names.json')).json());
});
beforeEach(()=>{
  vi.clearAllMocks();resetListStateForEmptySlot();setBattleAndStartSavedMenuItem(0);setPartyAndBillsSavedMenuItem(0);
  setTextSpeed('fast');textBgTransfer.enabled=true;textBgTransfer.resetPortion();enablePikachuFollowing();
  setLowHealthAlarm(0);setLowHealthAlarmDisabled(false);setLowHealthChannel5(0);
});
afterEach(()=>{active.splice(0).forEach(r=>r.dispose());vi.restoreAllMocks();});

function rig(options: History = {}): Rig {
  const r=battleLedger({real:true,sounds,streams,enemyMove:33,action:n=>n===1?'catch':'fight',...options});
  active.push(r);return r;
}
function bag(r: Rig, id: number, name: string, index=0){
  r.s.setBag(index?[{id:0x14,quantity:2},{id,quantity:1}]:[{id,quantity:1}]);
  r.ctx.bag=index?[{id:'POTION',count:2},{id:name,count:1}]:[{id:name,count:1}];
  expect(r.itemState().mirror).toEqual(index?[{id:'POTION',count:2},{id:name,count:1}]:[{id:name,count:1}]);
}
const events=(r:Rig,name:string)=>r.events.filter(e=>e.name===name);
const labels=(r:Rig)=>r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name.slice(5));
const draws=(r:Rig)=>events(r,'rng').map(e=>e.data);
function returned(r:Rig){return events(r,'itemReturned')[0].data as {
  result:number;captured:number;escaped:number;hp:number;status:number;stats:number[];pp:number[];alarm:number;chan5:number;
  items:ReturnType<Rig['itemState']>;
};}
function snapshot(r:Rig){expect(r.ledger()).toMatchSnapshot();}
const EMPTY='PrintEmptyString.emptyString';
const WIN=['UsedMoveText','EnemyMonFaintedText',EMPTY,'GainedText'];
const ENEMY_THEN_WIN=['UsedMoveText',EMPTY,...WIN];
const TRAINER_WIN=['TrainerDefeatedText','MoneyForWinningText'];
// core.asm:347–348,450–475: select at the inherited turn, then enemy crit/range/hit;
// the next menu selects again and the player's KO prevents another enemy turn.
function turnDraws(firstActor=1){return [
  ['BattleRandom','select',firstActor,0],['BattleRandom','crit',1,8],['BattleRandom','range',1,179],['BattleRandom','hit',1,0],
  ['BattleRandom','select',0,0],['BattleRandom','crit',0,8],['BattleRandom','range',0,179],['BattleRandom','hit',0,0],
];}
const winningDraws=[['BattleRandom','select',0,0],['BattleRandom','crit',0,8],['BattleRandom','range',0,179],['BattleRandom','hit',0,0]];
function enemyActed(r:Rig,expected:boolean){
  const enemy=events(r,'animationCue').filter(e=>(e.data as number[])[0]===33&&(e.data as number[])[1]===1);
  expect(enemy).toHaveLength(expected?1:0);
  if(expected)expect(enemy[0].at).toBeGreaterThan(events(r,'itemReturned')[0].at);
}
function seedAskNameHud(r:Rig){
  // naming_screen.asm:1–9: sentinel tiles model the incoming saved HUD, before the real clear.
  const save=vi.mocked(r.video.saveScreenTilesToBuffer1).getMockImplementation()!;
  vi.mocked(r.video.saveScreenTilesToBuffer1).mockImplementation(()=>{
    if(r.s.wCapturedMonSpecies&&r.s.mem[I.wNamingScreenType]===2){
      for(let y=0;y<4;y++)for(let x=0;x<11;x++)r.screen.put(x,y,'D');
      r.screen.put(11,0,'E');r.screen.put(0,4,'E');
    }
    save();
  });
  const print=r.host.printText;
  r.host.printText=function* (label,bindings,options){
    if(label==='DoYouWantToNicknameText'){
      expect([[0,0],[10,0],[0,3],[10,3]].map(([x,y])=>r.screen.at(x,y))).toEqual([' ',' ',' ',' ']);
      expect([r.screen.at(11,0),r.screen.at(0,4)]).toEqual(['E','E']);
      r.mark('askNameHudChecked');
    }
    yield* print(label,bindings,options);
  };
}
function finish(r:Rig,result=0){
  expect(r.runBattle()).toBe('end');expect(r.s.wBattleResult).toBe(result);
  expect(events(r,'loopReturned').map(e=>e.data)).toEqual([['end',result]]);
  expect(r.s.mem[D.wDestinationWarpID]).toBe(255);expect(r.s.wIsInBattle).toBe(0);
  expect(r.s.wEscapedFromBattle).toBe(0);
  expect([r.s.wBattleType,r.s.wCurOpponent,r.s.wMoveMissed,r.s.wNumRunAttempts,r.s.wForcePlayerToChooseMon]).toEqual([0,0,0,0,0]);
  expect([r.screen.bgp,r.screen.obp0,r.screen.obp1]).toEqual([0,0,0]);
  // home/window.asm PrintText: the source Delay3 precedes even an empty program in every history.
  expect(events(r,'textEnd:'+EMPTY)[0].at-events(r,'text:'+EMPTY)[0].at).toBe(3);
}

describe('checkpoint-10 player-item whole-battle histories',()=>{
  // item_effects.asm:189–434: Poké factor12/factor2=255. W=floor(floor(100*255/12)/(H>>2)).
  // M=H100: W=X85; R3 gives Y1,Z0; R100 gives Y39,Z13; R255 gives Y100,Z33.
  // H20,R200: W425,X255,Y78,Z78. Rate failures draw only Rand1; others fail Rand2=255.
  it.each([
    [0x20,100,3,[200],'01'],[0x61,100,100,[40,255],'02'],
    [0x62,100,255,[100,255],'03'],[0x63,20,200,[255],'04'],
  ] as const)('H1 failed throw animation byte %i uses the turn', (anim,hp,rate,ball,text)=>{
    const r=rig({enemyHp:hp,draws:{ball:[...ball]}});bag(r,4,'POKE_BALL');
    expect(r.itemState().bag).toEqual([1,4,1,255]);
    r.s.wEnemyMonMaxHP=100;r.s.wEnemyMonActualCatchRate=rate;r.s.wBattleMonAttack=500;
    finish(r);
    expect(returned(r).result).toBe(1);expect(returned(r).items.bag).toEqual([0,255]);
    expect(returned(r).items.mirror).toEqual([]);
    expect(labels(r)).toEqual([EMPTY,'ItemUseText00',`ItemUseBallText${text}`,...ENEMY_THEN_WIN]);
    expect(events(r,'text:ItemUseText00')[0].data).toEqual({stringBuffer:'POKé BALL'});
    expect(draws(r)).toEqual([...ball.map(value=>['Random','ball',1,value]),...turnDraws(0)]);enemyActed(r,true);
    const toss=events(r,'animationCue').find(e=>(e.data as number[])[0]===BALL.TOSS_ANIM)!;
    expect(toss.at-events(r,'rng').filter(e=>(e.data as string[])[0]==='Random').slice(-1)[0].at).toBe(20);
    expect(events(r,'text:ItemUseBallText'+text)[0].at).toBe(toss.at);
    // The alias is overwritten later by palette work; pin the actual byte at the toss.
    expect(r.events.find(e=>e.name==='ballAnimData')?.data).toBe(anim);
    snapshot(r);
  },20000);

  // item_effects.asm:237–247 (sleep borrow),485–606; add_mon.asm:1–252; naming_screen.asm:1–49.
  it.each([false,true])('H2/H3 capture, already owned=%s',owned=>{
    const r=rig({nickname:owned?undefined:'BIRDY',draws:{ball:[0]}});bag(r,4,'POKE_BALL');
    seedAskNameHud(r);
    r.s.wEnemyMonHP=13;r.s.wEnemyMonStatus=3;r.s.setBytes(I.wEnemyMonDVs,[0x98,0x76],2);
    const bit=15;r.s.mem[I.wPokedexOwned+(bit>>3)]=owned?1<<(bit&7):0;
    const before=r.itemState();expect(before.bag).toEqual([1,4,1,255]);
    finish(r,2);
    expect(returned(r).result).toBe(1);expect(returned(r).captured).toBe(0x24);
    expect(r.s.mem[I.wPartyCount]).toBe(2);expect([...r.s.mem.slice(I.wPartySpecies,I.wPartySpecies+3)]).toEqual([0x24,0x24,255]);
    expect(decodeNick(r.s.mem,I.wPartyMonNicks+11)).toBe(owned?'PIDGEY':'BIRDY');
    expect(decodeNick(r.s.mem,I.wPartyMonOT+11)).toBe('ASH');expect(r.s.partyMons[1]!.species).toBe(getSpeciesById(16));
    expect(r.s.partyMons[1]!.currentHp).toBe(13);expect(r.s.partyMons[1]!.status).toBe('SLP');
    // add_mon.asm:146–252: medium-fast EXP=20^3=8000; HP DV10; fresh stats50/26/24/30/21.
    expect([...r.s.mem.slice(I.wPartyMons+44,I.wPartyMons+88)]).toEqual([
      0x24,0,13,0,3,0,0,255,33,0,0,0,0x12,0x34,0,31,64,
      0,0,0,0,0,0,0,0,0,0,0x98,0x76,35,0,0,0,20,0,50,0,26,0,24,0,30,0,21,
    ]);
    expect(r.itemState().bag).toEqual([0,255]);expect(r.ctx.bag).toEqual([]);
    expect(events(r,'dexPageHandOff')).toHaveLength(owned?0:1);expect(events(r,'namingHandOff')).toHaveLength(owned?0:1);
    expect(labels(r)).toEqual([EMPTY,'ItemUseText00','ItemUseBallText05',...(owned?[]:['ItemUseBallText06']),
      'ItemUseBall.emptyString','DoYouWantToNicknameText']);enemyActed(r,false);
    expect(r.s.mem[I.wPokedexOwned+1]&0x80).toBe(0x80);
    if(!owned)expect((events(r,'dexPageHandOff')[0].data as [number,number[]])[1][1]&0x80).toBe(0x80);
    const caughtSound=events(r,'sfx').find(e=>(e.data as number[])[0]===0x9a)!;
    expect(events(r,'textEnd:ItemUseBallText05')[0].at-caughtSound.at).toBe(145+2);
    if(!owned){
      const dexSound=events(r,'sfx').find(e=>(e.data as number[])[0]===0x98)!;
      expect(events(r,'dexPageHandOff')[0].at-dexSound.at).toBe(33+2);
      expect(events(r,'dexPageHandOff')[0].at).toBeLessThan(events(r,'askNameHudChecked')[0].at);
      expect(events(r,'namingHandOff')[0].data).toEqual([0x24,2,I.wPartyMonNicks+11]);
    }
    expect([r.s.mem[I.wPikachuMood],r.s.mem[I.wPikachuEmotionModifier]]).toEqual([0x85,1]);
    expect(events(r,'evolutionHandOff')).toHaveLength(0);expect(draws(r)).toEqual([['Random','ball',1,0]]);
    expect(events(r,'yesNoReturned')[0].at-events(r,'yesNo')[0].at).toBe(3+15);
    snapshot(r);
  },20000);

  // item_effects.asm:568–587,2932–3113: front insertion on all four lists, MET_BILL changes only text.
  it.each([false,true])('H4 capture into the box, Bill met=%s',bill=>{
    const r=rig({reserves:5,draws:{ball:[0]}});bag(r,4,'POKE_BALL');
    seedAskNameHud(r);expect(r.itemState().bag).toEqual([1,4,1,255]);
    r.s.wEnemyMonStatus=3;r.s.mem[I.wBoxCount]=1;r.s.setBytes(I.wBoxSpecies,[0x54,255],2);
    r.s.mem.fill(0x31,I.wBoxMons,I.wBoxMons+33);r.s.setBytes(I.wBoxMonOT,encodeText('OLDOT@'),11);
    r.s.setBytes(I.wBoxMonNicks,encodeText('OLDMON@'),11);const old=readBoxSlot(r.s,0);
    if(bill)r.s.mem[BALL.eventFlags+(BALL.metBill>>3)]|=1<<(BALL.metBill&7);
    const party=r.s.mem.slice(I.wPartyMons,I.wPartyMons+6*44);finish(r,2);
    expect(r.s.mem[I.wBoxCount]).toBe(2);expect(readBoxSlot(r.s,1)).toEqual(old);
    expect(readBoxSlot(r.s,0).species).toBe(0x24);expect(r.s.mem.slice(I.wPartyMons,I.wPartyMons+6*44)).toEqual(party);
    expect(readBoxSlot(r.s,0).bytes).toEqual([0x24,0,1,20,3,0,0,255,33,0,0,0,0x12,0x34,0,31,64,
      0,0,0,0,0,0,0,0,0,0,0,0,35,0,0,0]);
    expect(decodeNick(r.s.mem,I.wBoxMonNicks)).toBe('PIDGEY');expect(decodeNick(r.s.mem,I.wBoxMonOT)).toBe('ASH');
    expect([...r.s.mem.slice(I.wBoxSpecies,I.wBoxSpecies+3)]).toEqual([0x24,0x54,255]);
    expect(labels(r)).toEqual([EMPTY,'ItemUseText00','ItemUseBallText05','ItemUseBallText06',
      'DoYouWantToNicknameText',bill?'ItemUseBallText07':'ItemUseBallText08']);enemyActed(r,false);
    expect([r.s.mem[I.wPartyCount],r.itemState().mood,r.itemState().emotion,r.s.mem[I.wPokedexOwned+1]&128]).toEqual([6,0x85,1,128]);
    expect(returned(r).items.bag).toEqual([0,255]);expect(returned(r).items.mirror).toEqual([]);expect(returned(r).result).toBe(1);
    expect(draws(r)).toEqual([['Random','ball',1,0]]);
    expect(events(r,'animationCue')[0].at-events(r,'rng')[0].at).toBe(20);
    snapshot(r);
  },20000);

  // item_effects.asm:2569–2580: palette, Buffer1, Delay3, toss, two texts, consume/result1.
  it('H5 trainer ball is consumed and the enemy acts',()=>{
    const r=rig({trainer:true});bag(r,4,'POKE_BALL');expect(r.itemState().bag).toEqual([1,4,1,255]);finish(r);
    expect(returned(r).result).toBe(1);expect(returned(r).items.bag).toEqual([0,255]);expect(returned(r).items.mirror).toEqual([]);
    expect(labels(r)).toEqual([EMPTY,'ThrowBallAtTrainerMonText1','ThrowBallAtTrainerMonText2',...ENEMY_THEN_WIN,...TRAINER_WIN]);
    expect(draws(r)).toEqual(turnDraws());enemyActed(r,true);
    const toss=events(r,'animationCue').find(e=>(e.data as number[])[0]===BALL.TOSS_ANIM)!;
    expect(toss.at-r.events.filter(e=>e.name==='videoLoad1'&&e.at<=toss.at).slice(-1)[0].at).toBe(3);
    const pal=events(r,'palette').find(e=>e.at>=events(r,'itemEntry')[0].at)!;
    expect(events(r,'paletteEnd').find(e=>e.at>pal.at)!.at-pal.at).toBe(2+3);
    expect(draws(r).some(d=>(d as string[])[0]==='Random')).toBe(false);expect(events(r,'trainerAIEntry').map(e=>e.data)).toEqual([0]);
    snapshot(r);
  },20000);

  // item_effects.asm:656–659,1755–1758,2593–2596; core.asm:2361–2363.
  it.each([[false,5,'TOWN_MAP'],[true,0x33,'POKE_DOLL']] as const)('H6 refusal trainer=%s', (trainer,id,name)=>{
    const r=rig({trainer});bag(r,id,name);const before=r.itemState();finish(r);
    expect(returned(r).result).toBe(0);expect(returned(r).items.bag).toEqual(before.bag);expect(returned(r).items.mirror).toEqual(before.mirror);
    expect(before.bag).toEqual([1,id,1,255]);expect(labels(r)).toEqual([EMPTY,'ItemUseNotTimeText',EMPTY,...WIN,...(trainer?TRAINER_WIN:[])]);
    // PrintText's source prefix is Delay3, independent of letter pacing.
    expect(events(r,'textEnd:PrintEmptyString.emptyString')[0].at-events(r,'text:'+EMPTY)[0].at).toBe(3);
    expect(draws(r)).toEqual(winningDraws);enemyActed(r,false);expect(events(r,'itemEntry')).toHaveLength(1);
    expect(events(r,'input').some(e=>(e.data as [string,string[]])[1].includes('b')&&e.at>events(r,'itemReturned')[0].at)).toBe(true);
    expect(draws(r).some(d=>(d as string[])[0]==='Random')).toBe(false);
    if(trainer)expect(events(r,'trainerAIEntry')).toEqual([]); // the following player's KO precedes TrainerAI.
    snapshot(r);
  },20000);

  // item_effects.asm:1108–1111,1287–1291,1311–1376; hp_bar.asm:48–283 (type2).
  it('H7 Potion heals the active lead and clears the low-health alarm',()=>{
    const r=rig({hp:5});bag(r,0x14,'POTION');setLowHealthAlarm(0x80);setLowHealthChannel5(0x44);
    expect([r.s.partyMons[0]!.currentHp,r.s.partyMons[0]!.maxHp]).toEqual([5,60]);
    expect(r.itemState().bag).toEqual([1,0x14,1,255]);
    finish(r);expect(returned(r).hp).toBe(25);expect(returned(r).alarm).toBe(0);expect(returned(r).chan5).toBe(0);
    expect(returned(r).items.bag).toEqual([0,255]);expect(returned(r).items.mirror).toEqual([]);expect(returned(r).result).toBe(1);
    expect(labels(r)).toEqual([EMPTY,'PartyMenuItemUseText','PotionText',...ENEMY_THEN_WIN]);
    expect(events(r,'scrollRead')[0].at-events(r,'text:PotionText')[0].at).toBe(3+3+50);
    expect(events(r,'input').find(e=>(e.data as string[])[0]==='itemParty')!.at-events(r,'itemEntry')[0].at).toBe(24);
    expect(draws(r)).toEqual(turnDraws());enemyActed(r,true);snapshot(r);
  },20000);

  // item_effects.asm:992–1011 overwrites ten stat bytes; core.asm loader badge boost is deliberately lost.
  it('H8 Paralyze Heal restores party stats over the badge boost without changing stages',()=>{
    const r=rig();bag(r,0x0f,'PARALYZE_HEAL');r.s.mem[I.wPartyMons+4]=0x40;r.s.partyMons[0]!.status='PAR';
    expect(r.itemState().bag).toEqual([1,0x0f,1,255]);
    r.s.wObtainedBadges=1;loadBattleMonFromParty(r.s);const attack=r.s.readBE(I.wPartyMons+36),speed=r.s.readBE(I.wPartyMons+40);
    expect(r.s.wBattleMonAttack).toBe(attack+(attack>>3));expect(r.s.wBattleMonSpeed).toBe(speed>>2);
    const stages=[...r.s.mem.slice(D.wPlayerMonStatMods,D.wPlayerMonStatMods+8)];
    finish(r);expect(returned(r).status).toBe(0);expect(r.s.mem[I.wPartyMons+4]).toBe(0);
    expect(returned(r).stats.slice(1)).toEqual([attack,r.s.readBE(I.wPartyMons+38),speed,r.s.readBE(I.wPartyMons+42)]);
    expect([...r.s.mem.slice(D.wPlayerMonStatMods,D.wPlayerMonStatMods+8)]).toEqual(stages);
    expect(returned(r).items.bag).toEqual([0,255]);expect(returned(r).items.mirror).toEqual([]);expect(returned(r).result).toBe(1);
    expect(labels(r)).toEqual([EMPTY,'PartyMenuItemUseText','ParlyzHealText',...ENEMY_THEN_WIN]);
    expect(events(r,'scrollRead')[0].at-events(r,'text:ParlyzHealText')[0].at).toBe(3+3+50);
    expect(draws(r)).toEqual(turnDraws());enemyActed(r,true);
    snapshot(r);
  },20000);

  // item_effects.asm:1824–1831 spends before StatModifierUpEffect; effects.asm's +6 failure skips animation/badges.
  it('H9 X ATTACK at +6 is consumed from bag slot 1 before the failed effect',()=>{
    const r=rig({bagTarget:1});bag(r,0x41,'X_ATTACK',1);r.s.mem[D.wPlayerMonStatMods]=13;const attack=r.s.wBattleMonAttack;
    expect(r.itemState().bag).toEqual([2,0x14,2,0x41,1,255]);
    const effect=stats.statModifierUpEffect,boost=vi.spyOn(loaders,'applyBadgeStatBoosts');
    vi.spyOn(stats,'statModifierUpEffect').mockImplementation(function* (...args){
      expect(r.itemState().bag).toEqual([1,0x14,2,255]);r.mark('statEffectEntry');return yield* effect(...args);
    });
    finish(r);expect(returned(r).items.bag).toEqual([1,0x14,2,255]);expect(returned(r).items.mirror).toEqual([{id:'POTION',count:2}]);
    expect(returned(r).result).toBe(1);expect(returned(r).stats[1]).toBe(attack);expect(boost).not.toHaveBeenCalled();
    expect(r.s.mem[D.wPlayerMonStatMods]).toBe(13);
    expect(labels(r)).toEqual([EMPTY,'ItemUseText00','NothingHappenedText',...ENEMY_THEN_WIN]);
    expect(events(r,'statEffectEntry')[0].at-events(r,'scrollRead').slice(-1)[0].at).toBe(3);
    expect(events(r,'sfx').some(e=>(e.data as number[])[0]===0x8e)).toBe(true);
    expect(draws(r)).toEqual(turnDraws(0));enemyActed(r,true);
    expect(events(r,'animationCue').some(e=>(e.data as number[])[0]===0xae)).toBe(false);snapshot(r);
  },20000);

  // item_effects.asm:1755–1761,2538–2549 removes doll; core.asm:316–318 returns without writing result2.
  it('H10 wild POKe DOLL escapes with battle result0',()=>{
    const r=rig();bag(r,0x33,'POKE_DOLL');expect(r.itemState().bag).toEqual([1,0x33,1,255]);finish(r);
    expect(returned(r).escaped).toBe(1);expect(returned(r).result).toBe(1);expect(returned(r).items.bag).toEqual([0,255]);
    expect(returned(r).items.mirror).toEqual([]);expect(draws(r)).toEqual([]);enemyActed(r,false);
    expect(labels(r)).toEqual([EMPTY,'ItemUseText00']);
    expect(events(r,'textEnd:'+EMPTY)[0].at-events(r,'text:'+EMPTY)[0].at).toBe(3);snapshot(r);
  },20000);

  // item_effects.asm:1900–1973: six player raw slots, both actives, alarm7 gate and CHAN7 poll.
  it.each([false,true])('H11 flute, alarm bit7=%s',alarm=>{
    const r=rig();bag(r,0x49,'POKE_FLUTE');
    const playFlute=vi.spyOn(flute,'playBattleFlute');
    expect(r.itemState().bag).toEqual([1,0x49,1,255]);
    for(let i=0;i<6;i++)r.s.mem[I.wPartyMons+44*i+4]=3;
    r.s.wBattleMonStatus=3;r.s.wEnemyMonStatus=3;
    // DrawPlayerHud re-evaluates the alarm before the bag. Seed the requested precondition at UseItem entry.
    const use=r.host.useItem;r.host.useItem=function* (ctx){setLowHealthAlarm(alarm?0x80:0);yield* use(ctx);};
    finish(r);expect(Array.from({length:6},(_,i)=>r.s.mem[I.wPartyMons+44*i+4]&7)).toEqual([0,0,0,0,0,0]);
    expect(r.s.wBattleMonStatus&7).toBe(0);expect(r.s.wEnemyMonStatus&7).toBe(0);
    expect(returned(r).items.bag).toEqual([1,0x49,1,255]);expect(returned(r).items.mirror).toEqual([{id:'POKE_FLUTE',count:1}]);
    expect(returned(r).result).toBe(1);expect(labels(r)).toEqual([EMPTY,'PlayedFluteHadEffectText','FluteWokeUpText',...ENEMY_THEN_WIN]);
    const caught=events(r,'sfx').filter(e=>(e.data as number[])[0]===0x9a);
    expect(caught).toHaveLength(alarm?0:1);
    const woke=events(r,'text:FluteWokeUpText')[0];
    if(alarm){
      expect(woke.at-events(r,'textEnd:PlayedFluteHadEffectText')[0].at).toBe(0);expect(playFlute).not.toHaveBeenCalled();
      expect(events(r,'wait').filter(e=>e.at>=events(r,'textEnd:PlayedFluteHadEffectText')[0].at&&e.at<=woke.at)).toEqual([]);
    }
    else {
      expect(playFlute).toHaveBeenCalledTimes(1);
      expect(playFlute.mock.calls[0][1]).toBe(r.audio.sfx);expect(playFlute.mock.calls[0][2]).toBe(streams);
      expect(streams.channels.map(c=>c.id)).toEqual([5,6,7]);
      expect(events(r,'channelIds').find(e=>e.at===caught[0].at)?.data).toEqual([0x9a,0x9a,0x9a]);
      expect(woke.at-caught[0].at).toBe(257);
      expect(events(r,'channelIds').find(e=>e.at===woke.at)?.data).toEqual([0,0,0]);
    }
    expect(draws(r)).toEqual(turnDraws());enemyActed(r,true);
    snapshot(r);
  },20000);

  // item_effects.asm:2180–2230 (real menus),2263–2279,2303–2319 (+10, preserve PP-Up bits).
  it('H12 Ether restores move slot1 and copies all four battle PP bytes',()=>{
    const r=rig({moveTarget:1});bag(r,0x50,'ETHER');
    expect(r.itemState().bag).toEqual([1,0x50,1,255]);
    r.s.setBytes(I.wPartyMons+8,[33,16,0,0],4);r.s.setBytes(I.wBattleMonMoves,[33,16,0,0],4);
    r.s.setBytes(I.wPartyMons+29,[35,0xc1,0,0],4);r.s.setBytes(I.wBattleMonPP,[35,2,0,0],4);
    r.s.partyMons[0]!.moves.push({id:'GUST',pp:1,maxPp:56});
    finish(r);expect(returned(r).pp).toEqual([35,0xcb,0,0]);expect(r.s.mem[I.wPartyMons+30]).toBe(0xcb);
    expect(r.s.partyMons[0]!.moves[1]).toEqual({id:'GUST',pp:11,maxPp:56});
    expect(returned(r).items.bag).toEqual([0,255]);expect(returned(r).items.mirror).toEqual([]);expect(returned(r).result).toBe(1);
    expect(labels(r)).toEqual([EMPTY,'PartyMenuItemUseText','RestorePPWhichTechniqueText','PPRestoredText',...ENEMY_THEN_WIN]);
    expect(events(r,'itemReturned')[0].at-events(r,'textEnd:PPRestoredText')[0].at).toBe(5);
    expect(events(r,'input').find(e=>(e.data as string[])[0]==='itemParty')!.at-events(r,'itemEntry')[0].at).toBe(24);
    expect(draws(r)).toEqual(turnDraws());enemyActed(r,true);snapshot(r);
  },20000);
});
