// checkpoint-10b: trainer items, switching, scoring and stale Counter through the real loop.
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
import { D } from './battle_end_state';
import { A } from './battle_state';
import { getMoveRecord } from './battle_move_data';
import { halveAttackDueToBurn } from './battle_loaders';

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

function rig(options:History={}):Rig{
  const r=battleLedger({real:true,trainerTrace:true,sounds,streams,trainer:true,trainerClass:42,
    aiCount:255,playerFirst:false,playerSpeed:10,playerAttack:40,enemyMove:33,...options});active.push(r);return r;
}
const events=(r:Rig,name:string)=>r.events.filter(e=>e.name===name);
const values=<T>(r:Rig,name:string)=>events(r,name).map(e=>e.data as T);
const labels=(r:Rig)=>r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name.slice(5));
const draws=(r:Rig)=>values<(string|number)[]>(r,'rng');
interface AI {count:number;hp:number;status:number;rosterStatus:number;speed:number;status3:number;
  first:number;record:number[];defense:number;stage:number;damage:number;carry:boolean}
interface Selection {scores:number[];listAddress?:number;list:number[];record:number[];effectiveness:number;encouragement:number;selected:number}
const before=(r:Rig)=>values<AI>(r,'trainerBefore'),after=(r:Rig)=>values<AI>(r,'trainerAfter');
const selected=(r:Rig)=>values<Selection>(r,'selectReturn');
const EMPTY='PrintEmptyString.emptyString';
function snapshot(r:Rig){if(!process.env.PKMN_SKIP_SNAPSHOTS)expect(r.ledger()).toMatchSnapshot();}
function finish(r:Rig){
  expect(r.runBattle()).toBe('end');expect(r.s.wBattleResult).toBe(0);
  expect(values(r,'loopReturned')).toEqual([['end',0]]);
  expect([r.s.wIsInBattle,r.s.wCurOpponent,r.s.wBattleType,r.s.wMoveMissed,r.s.wEscapedFromBattle,
    r.s.wNumRunAttempts,r.s.wForcePlayerToChooseMon]).toEqual([0,0,0,0,0,0,0]);
  expect(r.s.mem[D.wDestinationWarpID]).toBe(255);
  expect([r.screen.bgp,r.screen.obp0,r.screen.obp1]).toEqual([0,0,0]);
  // home/window.asm PrintText: even the empty program follows the real Delay3.
  expect(events(r,'textEnd:'+EMPTY)[0].at-events(r,'text:'+EMPTY)[0].at).toBe(3);
}
const used='UsedMoveText',item='AIBattleUseItemText';
const WIN=['EnemyMonFaintedText',EMPTY,'GainedText','TrainerDefeatedText','MoneyForWinningText'];
const br=(phase:string,actor:number,value:number)=>['BattleRandom',phase,actor,value];
const sel=(value=0)=>br('select',0,value),ai=(value:number)=>['Random','ai',1,value];
// core.asm CriticalHitTest rotates255 to255 (not critical); RandomizeDamage RRCA179=217.
// Hit0 < every positive accuracy; effect255 avoids Ember's <26 burn and passes stat-down's >=64 gate.
const attack=(actor:number)=>[br('crit',actor,255),br('range',actor,179),br('hit',actor,0)];
const counter=(hit:boolean)=>[br('crit',0,255),...(hit?[br('hit',0,0)]:[])];
function check(r:Rig,texts:string[],rng:(string|number)[][],counts:number[][],enemyCues:number[]){
  expect(labels(r)).toEqual(texts);expect(draws(r)).toEqual(rng);
  expect(before(r).map(s=>s.count)).toEqual(counts[0]);expect(after(r).map(s=>s.count)).toEqual(counts[1]);
  expect(values<number[]>(r,'animationCue').filter(c=>c[1]===1).map(c=>c[0])).toEqual(enemyCues);
  expect(after(r).map(s=>s.carry)).toEqual(counts[2].map(Boolean));
}
function noTrainerItem(r:Rig){expect(events(r,'text:'+item)).toEqual([]);expect(events(r,'trainerHpBar')).toEqual([]);}
function silentAI(r:Rig){
  const start=r.events.findIndex(e=>e.name==='trainerBefore'),end=r.events.findIndex(e=>e.name==='trainerAfter');
  // Real printer A/B acknowledgement has its own press sound; Potion requests no item SFX.
  expect(r.events.slice(start,end).filter(e=>e.name==='sfx'&&(e.data as number[])[0]!==0x90)).toEqual([]);
}

describe('checkpoint-10b trainer whole-battle histories',()=>{
  // trainer_ai.asm Rival2: 31 < 32, HP1 < floor(60/5)=12; heal21. Tackle at L20,
  // A40/D20: base16, STAB24, RRCA179=217 ->20. HP1 survives to the count-zero turn.
  it('T1 RIVAL2 Potion then count zero permits the next enemy move',()=>{
    const r=rig({draws:{ai:[31]}});finish(r);
    check(r,[EMPTY,item,used,EMPTY,used,used,...WIN],
      [sel(),ai(31),...attack(0),sel(),...attack(1),...attack(0)],[[255,0],[0,0],[1,0]],[33]);
    expect(after(r)[0].hp).toBe(21);expect(before(r)[1].hp).toBe(1);silentAI(r);
    expect(values(r,'trainerHpBar')).toEqual([[2,2,0,1,21,60]]);
    expect(values<{nameBuffer:string}>(r,'text:'+item)[0].nameBuffer).toBe('POTION');snapshot(r);
  });
  // HP1 < floor(12/5)=2; +20 exceeds max12, which is clamped before the bar.
  it('T1 Potion caps at max HP',()=>{
    const r=rig({enemyMaxHp:12,draws:{ai:[31]}});finish(r);
    check(r,[EMPTY,item,used,...WIN],[sel(),ai(31),...attack(0)],[[255],[0],[1]],[]);
    expect(after(r)[0].hp).toBe(12);expect(values(r,'trainerHpBar')).toEqual([[2,2,0,1,12,12]]);silentAI(r);snapshot(r);
  });
  it('T1 roll 32 refuses Potion',()=>{
    const r=rig({draws:{ai:[32]}});finish(r);
    check(r,[EMPTY,used,used,...WIN],[sel(),ai(32),...attack(1),...attack(0)],[[255],[1],[0]],[33]);
    expect(after(r)[0].hp).toBe(1);noTrainerItem(r);snapshot(r);
  });
  it('T1 equality at max divided by five refuses Potion',()=>{
    const r=rig({enemyHp:12,draws:{ai:[31]}});finish(r);
    check(r,[EMPTY,used,used,...WIN],[sel(),ai(31),...attack(1),...attack(0)],[[255],[1],[0]],[33]);
    expect(after(r)[0].hp).toBe(12);noTrainerItem(r);snapshot(r);
  });
  // core.asm:6463–6509 loader: PAR quarters100 to25. Full Heal has no stat restore.
  it('T2 BROCK Full Heal starts before text with no post-wait and retains quartered speed',()=>{
    const r=rig({trainerClass:34,enemyStatus:0x40,draws:{ai:[255]}});
    // ToxicEffect writes BADLY_POISONED (effects.asm); cure clears it independently of PAR.
    r.s.wEnemyBattleStatus3|=1;finish(r);
    check(r,[EMPTY,item,used,...WIN],[sel(),ai(255),...attack(0)],[[255],[4],[1]],[]);
    expect([before(r)[0].speed,before(r)[0].status,before(r)[0].rosterStatus]).toEqual([25,64,64]);
    expect([after(r)[0].speed,after(r)[0].status,after(r)[0].rosterStatus,after(r)[0].status3]).toEqual([25,0,0,0]);
    const sound=events(r,'sfx').find(e=>(e.data as number[])[0]===0x8e)!;
    expect(sound).toBeDefined();
    const print=events(r,'text:'+item)[0];expect(sound.at).toBeLessThanOrEqual(print.at);
    const entry=values<{label:string;channels:number[]}>(r,'textEntryState').find(e=>e.label===item)!;
    expect(entry.channels).toContain(0x8e); // text begins before this sound completes: mutation8b.
    expect(values<{nameBuffer:string}>(r,'text:'+item)[0].nameBuffer).toBe('FULL HEAL');snapshot(r);
  });
  it('T2 BROCK draws but does not heal an enemy without status',()=>{
    const r=rig({trainerClass:34,draws:{ai:[0]}});finish(r);
    check(r,[EMPTY,used,used,...WIN],[sel(),ai(0),...attack(1),...attack(0)],[[255],[5],[0]],[33]);
    expect(after(r)[0].status).toBe(0);noTrainerItem(r);snapshot(r);
  });
  // trainer_ai.asm:563–622: roll63 <64, two living slots. New send-out resets countFF;
  // the next AI loads3 then roll64 refuses. HP10 is below each player Tackle here.
  it('T3 JUGGLER switches with four-byte writeback and reloads FF on the following turn',()=>{
    const r=rig({trainerClass:21,enemies:2,reserves:1,enemyHp:10,draws:{ai:[63,64]}});
    // effects.asm: burn writes the active status and halves attack; roster waits for switch copy.
    r.s.wEnemyMonStatus=0x10;r.s.hWhoseTurn=0;halveAttackDueToBurn(r.s);
    finish(r);
    check(r,[EMPTY,'AIBattleWithdrawText',EMPTY,'TrainerSentOutText',used,...WIN.slice(0,3),EMPTY,
      'TrainerAboutToUseText','TrainerSentOutText','PlayerMon2Text','GetmText',EMPTY,EMPTY,used,'HurtByBurnText',used,...WIN],
      [sel(),ai(63),...attack(0),sel(),ai(64),...attack(1),...attack(0)],[[255,255],[255,3],[1,0]],[0xc3,33,0xba]);
    const send=values<AI&{roster:number[]}>(r,'trainerSendEntry')[0];
    expect(send.roster).toEqual([0,10,0,16]);expect(send.first).toBe(1);
    expect(values<AI>(r,'trainerSendReturn')[0].count).toBe(255);
    expect(after(r)[0].first).toBe(0);
    const from=r.events.findIndex(e=>e.name==='trainerSendEntry'),to=r.events.findIndex(e=>e.name==='trainerSendReturn');
    // SHIFT is enabled and there are two player mons. The AI send-out suppresses it;
    // the later ordinary replacement after a KO legitimately offers SHIFT.
    expect(r.events.slice(from,to).filter(e=>e.name==='yesNo'||e.name==='text:TrainerAboutToUseText')).toEqual([]);
    noTrainerItem(r);snapshot(r);
  });
  it('T3 JUGGLER cannot switch with only one living enemy',()=>{
    const r=rig({trainerClass:21,draws:{ai:[0]}});finish(r);
    check(r,[EMPTY,used,used,...WIN],[sel(),ai(0),...attack(1),...attack(0)],[[255],[3],[0]],[33]);
    expect(events(r,'trainerSendEntry')).toEqual([]);noTrainerItem(r);snapshot(r);
  });
  it('T4 MISTY X Defend raises the real stage and restores both move bytes',()=>{
    const r=rig({trainerClass:35,draws:{ai:[63]}});finish(r);
    check(r,[EMPTY,item,'MonsStatsRoseText',used,...WIN],[sel(),ai(63),...attack(0)],[[255],[0],[1]],[0xaf]);
    expect(values<number[]>(r,'trainerStatEntry')[0].slice(0,2)).toEqual([0xaf,0x0b]);
    expect([after(r)[0].stage,after(r)[0].defense]).toEqual([8,30]);
    expect(after(r)[0].record).toEqual(before(r)[0].record);expect(after(r)[0].record.slice(0,2)).toEqual([33,0]);snapshot(r);
  });
  // ThrashPetalDanceEffect writes status1 bit1 and duration2/3; model the next locked turn
  // with selected THRASH37 and two attacks left (effects.asm, core CheckEnemyStatusConditions).
  it('T5 thrashing gates both selector and TrainerAI before count loading or draws',()=>{
    const r=rig({enemyMove:37,draws:{ai:[],select:[]}});
    r.s.wEnemyBattleStatus1|=2;r.s.wEnemySelectedMove=37;r.s.mem[A.wEnemyNumAttacksLeft]=2;
    // GetCurrentMove on the preceding THRASH turn already installed this record (core.asm).
    r.s.setBytes(A.wEnemyMoveNum,getMoveRecord(37),6);
    finish(r);
    check(r,[EMPTY,'ThrashingAboutText',used,...WIN],[...attack(1),...attack(0)],[[255],[255],[0]],[37]);
    expect(selected(r)[0].listAddress).toBeUndefined();expect(selected(r)[0].record).toEqual([...getMoveRecord(37)]);
    noTrainerItem(r);snapshot(r);
  });
  // core.asm:5363–5406: FIRE vs GRASS has a row20; Growl/Tackle NORMAL have none.
  // Rolls101 and102 straddle $66. Mod2 sees0 first,1 next; Growl effect12 gets -1 only
  // then. Player GRASS has no Tackle STAB: base9*217/255=7, after Growl base6 ->5.
  // Enemy HP9 survives turn1 at2 and faints to5 on turn2; both bands use slot1=63 later.
  it.each([101,102])('T6 LORELEI Dewgong row roll %i precedes selection and encouragement changes scoring',roll=>{
    const r=rig({trainerClass:44,enemySpecies:0x78,enemyMoves:[52,45,33],enemyHp:9,playerAttack:20,
      types:{0x24:[22,22],0x78:[20,20]},draws:{select:[roll,0,roll,63],ai:[255,255]}});
    finish(r);
    check(r,[EMPTY,used,'SuperEffectiveText',used,EMPTY,used,'MonsStatsFellText',used,...WIN],
      [sel(roll),sel(),ai(255),...attack(1),br('effect',1,255),...attack(0),sel(roll),sel(63),ai(255),
        br('effect',1,255),br('hit',1,0),...attack(0)],[[255,2],[2,2],[0,0]],[52,45]);
    const lists=roll===101?[[52,45,33,0],[0,45,0,0]]:[[52,0,0,0],[52,45,0,0]];
    expect(selected(r)).toEqual(lists.map((list,i)=>({scores:list,listAddress:A.wBuffer,list,
      record:[...getMoveRecord(33)],effectiveness:16,encouragement:i,selected:i===0?52:45})));
    const raw=values<{scores:number[];encouragement:number}>(r,'selectDrawState');
    // At the Dewgong lookup, mod2 has run and filtering has not: this observes raw scores.
    expect([raw[0].scores,raw[2].scores]).toEqual([[10,10,10,10],[10,9,10,10]]);
    expect([raw[0].encouragement,raw[2].encouragement]).toEqual([0,1]);noTrainerItem(r);snapshot(r);
  });
  // core.asm:390–438,4718–4779: Counter forces enemy first. FIRE enemy: Ember base10,
  // STAB15*217/255=12; Tackle has no STAB, base9*217/255=7. Player NORMAL is neutral.
  // a: HP5+20=25 -> stale Counter24 leaves1; turn3 real Tackle7/Counter14 ends it.
  // b: HP19 -> real Counter14 leaves5; Potion25, stale FIRE fails; two later Counter14s end it.
  it.each([false,true])('T7 Counter stale record control %s crosses a trainer Potion turn',control=>{
    const r=rig({playerMove:68,playerAttack:20,enemySpecies:0x54,enemyMoves:control?[33,52]:[52,33],
      enemyHp:control?19:5,enemyMaxHp:control?100:60,types:{0x24:[0,0],0x54:[20,20]},
      draws:{select:control?[0,0,0,0]:[0,0,63],ai:[32,31]}});
    finish(r);
    const ending=[sel(),...attack(1),...counter(true)];
    check(r,control?[EMPTY,used,used,EMPTY,item,used,'AttackMissedText',EMPTY,used,used,EMPTY,used,used,...WIN]:
      [EMPTY,used,used,'AttackMissedText',EMPTY,item,used,EMPTY,used,used,...WIN],
      [sel(),ai(32),...attack(1),...(control?[]:[br('effect',1,255)]),...counter(control),sel(),ai(31),
        ...counter(!control),...(control?ending:[sel(63),...attack(1),...counter(true)]),...(control?ending:[])],
      control?[[255,1,0,0],[1,0,0,0],[0,1,0,0]]:[[255,1,0],[1,0,0],[0,1,0]],control?[33,33,33]:[52,33]);
    const entries=values<{record:number[];selected:number;damage:number;hp:number}>(r,'counterEntry');
    const returns=values<{damage:number}>(r,'counterReturn');
    expect(entries[0]).toEqual({record:[...getMoveRecord(control?33:52)],selected:control?33:52,damage:control?7:12,hp:control?19:5});
    expect(entries[1]).toEqual({record:[...getMoveRecord(control?52:33)],selected:control?33:52,damage:control?14:12,hp:25});
    expect(returns.map(e=>e.damage)).toEqual(control?[14,14,14,14]:[12,24,14]);
    expect(before(r)[2].hp).toBe(control?25:1);expect(after(r)[1].hp).toBe(25);
    expect(after(r)[1].record).toEqual(selected(r)[1].record);
    expect(values(r,'trainerHpBar')).toEqual([[2,2,0,5,25,control?100:60]]);snapshot(r);
  });
});

