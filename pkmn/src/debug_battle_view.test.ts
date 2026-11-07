import { beforeAll, expect, it } from 'vitest';
import { A, BattleState, PARTYMON_STRUCT_LENGTH } from './battle/battle_state';
import { loadBattleData } from './battle/data';
import { debugBattleMon, debugBattleInfo, debugEnemyMoves } from './debug_battle_view';
import { readFileSync } from 'node:fs';

beforeAll(loadBattleData);
it('debug has no old Battle import, including erased type imports',()=>{
  const source=readFileSync(new URL('./debug.ts',import.meta.url),'utf8');
  expect(source).not.toMatch(/from\s+['"]\.\/battle\/battle['"]/);
});
function fixture() {
  const s=new BattleState();
  s.mem.fill(0x55);s.mem[A.wPlayerMonNumber]=1;
  s.writeBE(A.wBattleMonMaxHP,500);s.writeBE(A.wEnemyMonMaxHP,700);
  return s;
}
function poke(s:BattleState,action:()=>void,writes:Record<number,number>) {
  const expected=s.mem.slice();Object.entries(writes).forEach(([a,v])=>expected[Number(a)]=v);
  action();expect(Buffer.from(s.mem).equals(Buffer.from(expected))).toBe(true);
}
it.each([false,true])('HP controls write only the clamped big-endian word, enemy=%s',enemy=>{
  const s=fixture(),m=debugBattleMon(s,enemy),a=enemy?A.wEnemyMonHP:A.wBattleMonHP,max=enemy?700:500;
  poke(s,()=>{m.currentHp=300;},{[a]:1,[a+1]:44});expect(m.currentHp).toBe(300);
  poke(s,()=>{m.currentHp=9999;},{[a]:max>>>8,[a+1]:max&255});
  poke(s,()=>{m.currentHp=-2;},{[a]:0,[a+1]:0});
});
it.each([false,true])('status controls poke only one byte, SLP=3; no stat side effects, enemy=%s',enemy=>{
  const s=fixture(),m=debugBattleMon(s,enemy),a=enemy?A.wEnemyMonStatus:A.wBattleMonStatus;
  for(const [status,byte] of [[null,0],['SLP',3],['PSN',8],['BRN',16],['FRZ',32],['PAR',64]] as const){
    poke(s,()=>{m.status=status;},{[a]:byte});expect(m.status).toBe(status);
  }
});
it.each([false,true])('every stage maps -6..+6 to 1..13 in exactly its cell, enemy=%s',enemy=>{
  const s=fixture(),m=debugBattleMon(s,enemy),base=enemy?A.wEnemyMonStatMods:A.wPlayerMonStatMods;
  (['attack','defense','speed','special','accuracy','evasion'] as const).forEach((stat,i)=>{
    for(let stage=-6;stage<=6;stage++){
      poke(s,()=>{m.statStages[stat]=stage;},{[base+i]:stage+7});expect(m.statStages[stat]).toBe(stage);
    }
  });
});
it('EXP follows wPlayerMonNumber after a switch and enemy controls cannot write it',()=>{
  const s=fixture(),m=debugBattleMon(s);
  for(const slot of [1,3]){
    s.mem[A.wPlayerMonNumber]=slot;const a=A.wPartyMons+slot*PARTYMON_STRUCT_LENGTH+14;
    poke(s,()=>{m.exp=0x123456;},{[a]:0x12,[a+1]:0x34,[a+2]:0x56});expect(m.exp).toBe(0x123456);
  }
  poke(s,()=>{debugBattleMon(s,true).exp=3;},{});
});
it('info line reads foreground, speed words, selected party EXP and enemy header cells',()=>{
  const s=fixture();s.writeBE(A.wBattleMonSpeed,301);s.writeBE(A.wEnemyMonSpeed,511);
  debugBattleMon(s).exp=0x123456;s.mem[A.wEnemyMonActualCatchRate]=45;s.mem[A.wEnemyMonBaseExp]=99;
  expect(debugBattleInfo(s,'partyItem')).toEqual({foreground:'partyItem',playerSpeed:301,enemySpeed:511,
    exp:0x123456,catchRate:45,baseExp:99});
});

it('enemy move setup replaces exactly four move and PP bytes and clears unused slots', () => {
  const s=fixture(),moves=[{id:'SUBSTITUTE',pp:1,maxPp:1},{id:'MINIMIZE',pp:1,maxPp:1}];
  poke(s,()=>{debugEnemyMoves(s,moves);},{[A.wEnemyMonMoves]:164,[A.wEnemyMonMoves+1]:107,
    [A.wEnemyMonMoves+2]:0,[A.wEnemyMonMoves+3]:0,[A.wEnemyMonPP]:10,[A.wEnemyMonPP+1]:20,
    [A.wEnemyMonPP+2]:0,[A.wEnemyMonPP+3]:0});
  expect(debugEnemyMoves(s)).toEqual([{id:'SUBSTITUTE',pp:10,maxPp:10},{id:'MINIMIZE',pp:20,maxPp:20}]);
});
it('invalid enemy move setup is rejected atomically', () => {
  const s=fixture(),before=s.mem.slice();
  for(const moves of [[],[{id:'TACKLE',pp:1,maxPp:1},{id:'BAD',pp:1,maxPp:1}],Array(5).fill({id:'TACKLE',pp:1,maxPp:1})])
    expect(()=>debugEnemyMoves(s,moves)).toThrow('invalid debug enemy moves');
  expect(s.mem).toEqual(before);
});
