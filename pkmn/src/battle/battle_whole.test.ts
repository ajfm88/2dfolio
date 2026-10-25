import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
vi.mock('../input',()=>({isHeld:vi.fn(()=>false),isPassPressed:vi.fn(()=>false),syncJoypadRead:vi.fn()}));
vi.mock('../audio',()=>({playSFX:vi.fn(),isSoundFinished:vi.fn(()=>true)}));
vi.mock('../renderer',()=>({drawTile:vi.fn(),fillRect:vi.fn(),loadFont:async()=>({width:128}),loadTileset:async()=>({width:128})}));
import { battleLedger } from '../test/battle_ledger_rig';
import { loadBattleData } from './data';
import { loadBattleMoveData } from './battle_move_data';
import { loadStatEffectData } from './battle_effects_stats';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem,setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { resetListStateForEmptySlot,setBattleAndStartSavedMenuItem,setPartyAndBillsSavedMenuItem,
  setBagSavedMenuItem,setListScrollOffset,getPartyAndBillsSavedMenuItem,getBagSavedMenuItem,getBattleAndStartSavedMenuItem,getListScrollOffset } from '../list_state';
import { setLowHealthAlarm,setLowHealthAlarmDisabled,setLowHealthChannel5,lowHealthAlarm,isLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { D } from './battle_end_state';
import { readBattleBcd } from './battle_faint';
import { gainExperience } from './battle_experience';

beforeAll(async()=>{await loadBattleData();await loadBattleMoveData();await loadTextPrograms();await loadStatEffectData();await initTextSystem();});
beforeEach(()=>{
  vi.clearAllMocks();resetListStateForEmptySlot();setBattleAndStartSavedMenuItem(0);setPartyAndBillsSavedMenuItem(0);
  setTextSpeed('fast');textBgTransfer.enabled=true;textBgTransfer.resetPortion();
  setLowHealthAlarm(0);setLowHealthAlarmDisabled(false);setLowHealthChannel5(0);
});
afterEach(()=>vi.restoreAllMocks());

describe('checkpoint-08b whole-battle ledgers',()=>{
  it('wild win executes a damaging turn, awards EXP, then performs the separate EndOfBattle',()=>{
    const r=battleLedger();expect(r.runBattle()).toBe('end');
    expect(r.s.partyMons[0]!.exp).toBe(8200);expect(r.s.mem[D.wDestinationWarpID]).toBe(255);
    expect(r.events.filter(e=>e.name==='rng').map(e=>e.data)).toEqual([['select',0,0],['crit',0,8],['range',0,179],['hit',0,0]]);
    expect(r.events.filter(e=>e.name==='loopReturned').map(e=>e.data)).toEqual([['end',0]]);
    expect(r.ledger()).toMatchSnapshot();
  },20000);
  it('trainer win accepts SHIFT, sends the enemy before the player, and awards money after end text',()=>{
    const r=battleLedger({trainer:true,reserves:1,enemies:2});r.s.mem[0xd72c]=0x80;
    r.s.mem[D.wAmountMoneyWon+2]=0x50;
    const print=r.host.printText;
    r.host.printText=function* (label,bindings,options){
      if(label==='MoneyForWinningText')expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(0);
      yield* print(label,bindings,options);
      if(label==='MoneyForWinningText')expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(0);
    };
    expect(r.runBattle()).toBe('end');expect(r.s.wPlayerMonNumber).toBe(1);
    expect(r.s.readBE(D.wEnemyMons+1)).toBe(0);expect(r.s.readBE(D.wEnemyMons+45)).toBe(0);
    expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(50);
    expect(r.events.filter(e=>e.name==='sendCue').map(e=>(e.data as number[]).slice(1))).toEqual([[15,6],[4,11]]);
    expect(r.events.findIndex(e=>e.name==='endTextHandOff')).toBeLessThan(r.events.findIndex(e=>e.name==='text:MoneyForWinningText'));
    const pic=r.events.find(e=>e.name==='trainerPic')!,endText=r.events.find(e=>e.name==='endTextHandOff')!;
    expect(endText.at-pic.at).toBe(5+7+24+40);
    const fall=r.events.find(e=>e.name==='sfx'&&(e.data as number[])[0]===0x9e)!;
    const thud=r.events.find(e=>e.name==='sfx'&&(e.data as number[])[0]===0x95)!;
    expect(thud.at-fall.at).toBe(9);
    expect(r.events.find(e=>e.name==='text:EnemyMonFaintedText')!.at-thud.at).toBe(31);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('player faint chooses a reserve and resumes real turns before the wild win',()=>{
    const r=battleLedger({reserves:1,enemyMove:33,enemyHp:1,hp:1,playerFirst:false});
    // Only the lead is fragile; a reserve survives the next enemy attack.
    r.s.writeBE(D.wPartyMons+45,60);r.s.partyMons[1]!.currentHp=60;
    expect(r.runBattle()).toBe('end');expect(r.s.wPlayerMonNumber).toBe(1);
    expect(r.s.partyMons[0]!.currentHp).toBe(0);expect(r.s.partyMons[1]!.exp).toBe(8200);
    expect(r.events.filter(e=>e.name==='text:PlayerMonFaintedText')).toHaveLength(1);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('ordinary blackout follows an actual enemy KO and skips evolution',()=>{
    const r=battleLedger({enemyMove:33,enemyHp:60,hp:1,playerFirst:false});
    expect(r.runBattle()).toBe('blackout');expect(r.s.wBattleResult).toBe(1);
    expect(r.events.some(e=>e.name==='evolutionHandOff')).toBe(false);
    expect(r.events.filter(e=>e.name==='text:PlayerBlackedOutText2')).toHaveLength(1);
    expect(r.ledger()).toMatchSnapshot();
  });
  it.each(['enemy','player'] as const)('%s-first Explode double faint retains source EXP and blackout order',first=>{
    const r=battleLedger(first==='enemy'?{playerMove:153,hp:60,enemyHp:1}:{enemyMove:153,hp:1,enemyHp:60,playerFirst:false});
    expect(r.runBattle()).toBe('blackout');expect(r.s.wBattleMonHP).toBe(0);expect(r.s.wEnemyMonHP).toBe(0);
    expect(r.s.partyMons[0]!.exp).toBe(8000);
    expect(r.events.filter(e=>e.name==='text:EnemyMonFaintedText')).toHaveLength(0);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('RIVAL1 loss in Oaks Lab scrolls the trainer and returns without blackout',()=>{
    const r=battleLedger({trainer:true,enemyMove:33,hp:1,enemyHp:60,playerFirst:false});
    r.s.wCurOpponent=0xe1;r.s.wCurMap=0x28;
    expect(r.runBattle()).toBe('end');expect(r.s.wBattleResult).toBe(1);
    expect(r.events.filter(e=>e.name==='text:Rival1WinText')).toHaveLength(1);
    expect(r.events.some(e=>e.name==='text:PlayerBlackedOutText2')).toBe(false);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('level then RUN keeps result2 and skips evolution despite CanEvolve',()=>{
    const r=battleLedger({action:()=> 'run'});
    // An earlier award enters through the real GainExperience, never a synthetic level/flag write.
    // Wild faint itself always returns; it cannot legally continue to a second wild enemy.
    r.s.mem[D.wPartyMons+33]=19;r.s.mem[D.wPartyMons+14]=0;r.s.writeBE(D.wPartyMons+15,7999);
    r.s.wBattleMonLevel=19;
    expect(r.runBattle(gainExperience(r.s,r.host))).toBe('end');
    expect(r.s.partyMons[0]!.level).toBe(20);expect(r.s.mem[D.wCanEvolveFlags]&1).toBe(1);
    expect(r.s.wBattleResult).toBe(2);expect(r.events.some(e=>e.name==='evolutionHandOff')).toBe(false);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('failed refusal to use a next mon consumes the force flag when choosing a reserve',()=>{
    const r=battleLedger({reserves:1,hp:1,enemyHp:1,enemyMove:33,playerFirst:false,refuseNext:true});
    r.s.writeBE(D.wPartyMons+40,1);r.s.writeBE(D.wPartyMons+45,60);r.s.partyMons[1]!.currentHp=60;
    expect(r.runBattle()).toBe('end');expect(r.s.wPlayerMonNumber).toBe(1);
    expect(r.events.filter(e=>e.name==='runOdds').map(e=>e.data)).toEqual([[1,100,1]]);
    expect(r.events.filter(e=>e.name==='text:CantEscapeText')).toHaveLength(1);
    expect(r.s.wForcePlayerToChooseMon).toBe(0);expect(r.s.wBattleResult).toBe(0);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('EXP.ALL makes both real award passes and mirrors independently divided stat experience',()=>{
    const r=battleLedger({reserves:1});r.s.setBag([{id:0x4b,quantity:1}]);
    expect(r.runBattle()).toBe('end');
    expect(r.s.partyMons.slice(0,2).map(m=>m!.exp)).toEqual([8148,8048]);
    expect(r.s.partyMons[0]!.statExp).toEqual([7,15,22,30,37]);
    expect(r.s.partyMons[1]!.statExp).toEqual([2,5,7,10,12]);
    expect(r.events.filter(e=>e.name==='text:GainedText').map(e=>e.data)).toEqual([
      {nameBuffer:'LEAD',expAmountGained:100},{nameBuffer:'LEAD',expAmountGained:48},{nameBuffer:'RESERVE',expAmountGained:48}]);
    expect(r.ledger()).toMatchSnapshot();
  });
  it.each(['enemy','player'] as const)('%s-first wild double faint with a reserve awards only the living participant',first=>{
    const r=battleLedger(first==='enemy'?{reserves:1,playerMove:153,enemyHp:1}:{reserves:1,enemyMove:153,hp:1,enemyHp:60,playerFirst:false});
    r.s.mem[D.wPartyGainExpFlags]=3;
    expect(r.runBattle()).toBe('end');expect(r.s.wBattleResult).toBe(0);
    expect(r.s.partyMons[0]!.exp).toBe(8000);expect(r.s.partyMons[1]!.exp).toBe(8200);
    expect(r.events.filter(e=>e.name==='text:PlayerMonFaintedText')).toHaveLength(first==='player'?1:0);
    expect(r.ledger()).toMatchSnapshot();
  });
  it.each(['enemy','player'] as const)('%s-first trainer double faint chooses before replacement and can prompt SHIFT again',first=>{
    const r=battleLedger(first==='enemy'?{trainer:true,reserves:1,enemies:2,playerMove:153,enemyHp:1}
      :{trainer:true,reserves:1,enemies:2,enemyMove:153,hp:1,enemyHp:60,playerFirst:false});
    // Both lead attacks explode; the reserve uses Tackle and the next enemy uses Splash.
    // The replacement's header provider is fixture data, consumed by the real loader.
    const species=r.s.species;r.s.species=id=>({...species(id),moves:[150,0,0,0]});
    r.s.mem[D.wPartyMons+44+8]=33;r.s.writeBE(D.wPartyMons+45,60);r.s.partyMons[1]!.currentHp=60;
    // Keep the replacement fragile so the resumed Tackle finishes it.
    r.s.writeBE(D.wEnemyMons+45,1);
    // The trainer model follows the loaded enemy move bytes at each real selection.
    expect(r.runBattle()).toBe('end');expect(r.s.wBattleResult).toBe(0);expect(r.s.wPlayerMonNumber).toBe(1);
    expect(r.events.filter(e=>e.name==='yesNo').length).toBeGreaterThanOrEqual(1);
    expect(r.ledger()).toMatchSnapshot();
  },20000);
  it.each([36,164])('move%i reaches player faint after recoil or exact-cost Substitute, then chooses and wins',move=>{
    const r=battleLedger({playerMove:move,reserves:1,hp:move===164?15:1,enemyHp:60});
    r.s.writeBE(D.wPartyMons+45,60);r.s.partyMons[1]!.currentHp=60;r.s.mem[D.wPartyMons+44+8]=33;
    expect(r.runBattle()).toBe('end');expect(r.s.partyMons[0]!.currentHp).toBe(0);
    expect(r.s.wPlayerMonNumber).toBe(1);expect(r.s.wBattleResult).toBe(0);
    expect(r.ledger()).toMatchSnapshot();
  },20000);
  it.each(['run','catch','move'] as const)('Pay Day then %s keeps the source result history and collection gate',exit=>{
    const r=battleLedger({playerMove:6,enemyHp:60,action:entry=>entry===1?'fight':exit==='catch'?'catch':exit==='run'?'run':'fight'});
    r.s.setBag([{id:4,quantity:1}]);r.ctx.bag=[{id:'POKE_BALL',count:1}];
    if(exit==='move'){
      // Select Teleport on the second real move-menu entry, using its existing move-slot byte.
      r.s.mem[D.wBattleMonMoves+1]=100;r.s.mem[D.wBattleMonPP+1]=20;
    }
    if(exit==='move') {
      // Re-enter the move menu at slot1 after Pay Day; this is input state, not an escape write.
      const action=(entry:number)=>{if(entry===2)r.s.wPlayerMoveListIndex=1;return 'fight' as const;};
      // The scenario callback is mutable configuration owned by the test, just like keyboard input.
      r.setAction(action);
    }
    expect(r.runBattle()).toBe('end');
    expect(readBattleBcd(r.s,D.wTotalPayDayMoney)).toBe(40);
    expect(r.s.wBattleResult).toBe(exit==='move'?0:2);
    expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(exit==='move'?40:0);
    expect(r.events.filter(e=>e.name==='evolutionHandOff')).toHaveLength(exit==='move'?1:0);
    expect(r.ledger()).toMatchSnapshot();
  },20000);
  it('zero EXP still adds stat experience and prints zero without a minimum-one award',()=>{
    const r=battleLedger();r.s.wEnemyMonBaseExp=0;
    expect(r.runBattle()).toBe('end');expect(r.s.partyMons[0]!.exp).toBe(8000);
    expect(r.s.partyMons[0]!.statExp).toEqual([10,20,30,40,50]);
    expect(r.events.find(e=>e.name==='text:GainedText')?.data).toEqual({nameBuffer:'LEAD',expAmountGained:0});
    expect(r.s.mem[D.wCanEvolveFlags]).toBe(0);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('trainer end text keeps the source prefix cursor through its selected program',()=>{
    const r=battleLedger({trainer:true,endText:'ViridianForestCooltrainerFEndBattleText'});r.s.mem[0xd72c]=0x80;
    expect(r.runBattle()).toBe('end');
    expect(r.events.find(e=>e.name==='endTextCursor')?.data).toEqual({label:'TrainerEndBattleText',column:6,row:14});
    expect(r.events.find(e=>e.name==='textEnd:TrainerEndBattleText')?.data).toEqual(['ACE: Oh no,','really?']);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('end-text flag is consumed even for an empty source and does not replay on the next call',()=>{
    const r=battleLedger({trainer:true});r.s.mem[0xd72c]=0x81;
    expect(r.runBattle()).toBe('end');expect(r.s.mem[0xd72c]).toBe(1);
    const again=r.host.printEndBattleText(r.s);expect(again.next().done).toBe(true);
    expect(r.events.filter(e=>e.name==='text:TrainerEndBattleText')).toHaveLength(1);
    expect(r.events.filter(e=>e.name==='endTextHandOff').map(e=>e.data)).toEqual([[true,0],[false,0]]);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('a real win resets every seeded end cell and menu owner while preserving adjacent sentinels and party writes',()=>{
    const r=battleLedger();let party:Uint8Array;
    const reset=[D.wIsInBattle,D.wBattleType,D.wMoveMissed,D.wCurOpponent,D.wForcePlayerToChooseMon,D.wNumRunAttempts,D.wEscapedFromBattle];
    expect(r.runBattle(undefined,()=>{
      // Seed only after the real turn/faint return. EndOfBattle must perform every reset itself.
      for(const at of reset)r.s.mem[at]=0xa5;
      r.s.mem.fill(0xa5,D.wPartyAndBillsPCSavedMenuItem,D.wPartyAndBillsPCSavedMenuItem+4);
      r.s.mem[D.wListScrollOffset]=0xa5;r.s.mem.fill(0xa5,D.wBattleStatusData,D.wBattleStatusDataEnd);
      // Immediate neighbours are MoveMissed/EscapedFromBattle and are separately reset.
      r.s.mem[D.wBattleStatusData-2]=0x73;r.s.mem[D.wBattleStatusDataEnd+1]=0x91;
      r.s.mem[D.wStatusFlags2]=0x40;
      setPartyAndBillsSavedMenuItem(2);setBagSavedMenuItem(3);setBattleAndStartSavedMenuItem(1);setListScrollOffset(4);
      setLowHealthAlarm(0x80);setLowHealthChannel5(0x44);setLowHealthAlarmDisabled(true);
      party=r.s.mem.slice(D.wPartyMons,D.wPartyMons+44);
    })).toBe('end');
    expect(reset.map(at=>r.s.mem[at])).toEqual(Array(7).fill(0));
    expect([...r.s.mem.slice(D.wPartyAndBillsPCSavedMenuItem,D.wPartyAndBillsPCSavedMenuItem+4)]).toEqual([0,0,0,0]);
    expect([getPartyAndBillsSavedMenuItem(),getBagSavedMenuItem(),getBattleAndStartSavedMenuItem(),getListScrollOffset()]).toEqual([0,0,0,0]);
    expect([...r.s.mem.slice(D.wBattleStatusData,D.wBattleStatusDataEnd)]).toEqual(Array(24).fill(0));
    expect([r.s.mem[D.wBattleStatusData-2],r.s.mem[D.wBattleStatusDataEnd+1]]).toEqual([0x73,0x91]);
    expect(r.s.mem[D.wStatusFlags2]).toBe(0x41);expect(r.s.mem.slice(D.wPartyMons,D.wPartyMons+44)).toEqual(party!);
    expect(lowHealthAlarm()).toBe(0);expect(r.bridge.channelId(5)).toBe(0);expect(isLowHealthAlarmDisabled()).toBe(true);
    expect([r.screen.bgp,r.screen.obp0,r.screen.obp1,r.s.mem[D.wDestinationWarpID]]).toEqual([0,0,0,255]);
    expect(r.ledger()).toMatchSnapshot();
  });
  it.each(['faint','end'] as const)('unsupported link %s branch rejects without invented completion or resets',where=>{
    const r=battleLedger({enemyMove:33,hp:1,playerFirst:false});
    if(where==='faint'){
      // MainInBattleLoop checks HP before link selection; use its real entry-faint label.
      r.s.wBattleMonHP=0;r.s.wLinkState=4;
      expect(()=>r.runBattle()).toThrow('link');expect(r.s.wIsInBattle).toBe(1);
      expect(r.events.some(e=>e.name==='endReturned')).toBe(false);
    }else{
      r.setAction(()=> 'run');r.s.wBattleMonSpeed=200;
      expect(()=>r.runBattle(undefined,()=>{r.s.wLinkState=4;})).toThrow('link');
      expect(r.s.wIsInBattle).toBe(1);expect(r.s.mem[D.wDestinationWarpID]).not.toBe(255);
      expect(r.events.some(e=>e.name==='loopReturned')).toBe(true);
    }
    expect(r.ledger()).toMatchSnapshot();
  });
  it('Pay Day then player faint and reserve Teleport preserves result1 and loses the scattered money',()=>{
    const r=battleLedger({playerMove:6,enemyMove:33,reserves:1,hp:1,enemyHp:60});
    r.s.mem[D.wPartyMons+44+8]=100;r.s.writeBE(D.wPartyMons+45,60);r.s.partyMons[1]!.currentHp=60;
    expect(r.runBattle()).toBe('end');expect(r.s.wBattleResult).toBe(1);
    expect(r.s.wPlayerMonNumber).toBe(1);expect(readBattleBcd(r.s,D.wTotalPayDayMoney)).toBe(40);
    expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(0);
    expect(r.events.filter(e=>e.name==='text:RanFromBattleText')).toHaveLength(1);
    expect(r.events.some(e=>e.name==='evolutionHandOff')).toBe(false);
    expect(r.ledger()).toMatchSnapshot();
  });
});
