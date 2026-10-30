import { beforeAll, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { BattleState } from './battle_state';
import { D } from './battle_end_state';
import { I } from './battle_item_state';
import { loadBattleData, createPokemon } from './data';
import { loadBattleBridgeData, packOptions, unpackOptions, writeBattleInputs, readBattleOutputs,
  decodeBoxMon, encodeBoxMon, boxedPokemonToRecord, pokemonToPartyRecord } from './battle_bridge';
import { battleWorld } from '../test/battle_world_fixture';
import { pokemonToBoxed } from '../pokemon_storage';
import { modifyPikachuHappiness } from './battle_pikachu';
import { BattleMenuScreen } from './battle_menu_screen';
import { itemUseBall, type BallItemEnvironment } from './battle_item_ball';
import type { BattleItemHost } from './battle_items';
import { endOfBattle, type BattleEndHost } from './battle_end';
import { writeBattleBcd } from './battle_faint';
import { BattleAudio } from './battle_audio';
import { rig as audioRig } from '../test/audio_rig';
beforeAll(async () => { await loadBattleData(); await loadBattleBridgeData(); });

for (const textSpeed of ['FAST','MID','SLOW'] as const) for (const animation of ['ON','OFF'] as const)
  for (const battleStyle of ['SHIFT','SET'] as const) it(`options ${textSpeed}/${animation}/${battleStyle}`, () => {
    const options={textSpeed,animation,battleStyle};
    const byte={FAST:1,MID:3,SLOW:5}[textSpeed]+(animation==='OFF'?128:0)+(battleStyle==='SET'?64:0);
    expect(packOptions(options)).toBe(byte); expect(packOptions(options)&0x30).toBe(0);
    expect(unpackOptions(byte)).toEqual(options);
  });
it.each([[0,[0,0,0]],[3000,[0,0x30,0]],[999999,[0x99,0x99,0x99]],[12345,[1,0x23,0x45]]] as const)
  ('money %i has exact big-endian BCD bytes', (money, bytes) => {
    const s=new BattleState(); writeBattleInputs(s,battleWorld({money}));
    expect([...s.mem.slice(0xd346,0xd349)]).toEqual(bytes); expect(readBattleOutputs(s).money).toBe(money);
  });
it('encodes every census row at its address and returns detached absolute outputs', () => {
  const boxed=pokemonToBoxed(createPokemon(1,12,'BULBA',{atk:1,def:2,spd:3,spc:4})!);
  boxed.exp=0x123456; boxed.otName='RED'; boxed.otId=0xabcd;
  const w=battleWorld({options:{textSpeed:'SLOW',animation:'OFF',battleStyle:'SET'},badges:['BADGE_1','BADGE_8'],
    eventFlags:['MET_BILL','INITIAL_CATCH_TRAINING','USED_POKECENTER'],pikachuHappiness:123,pikachuMood:145,pikachuEmotionModifier:5,
    partyIndex:3,gymLeaderNo:7,opponent:202,enemyLevel:9,money:123456,seen:[1,76,151],owned:[1,151],
    bag:[{id:'POTION',count:17},{id:'PARALYZE_HEAL',count:3},{id:'TM01',count:1}],pcBoxes:[[boxed],[]],currentPcBox:0});
  const before=JSON.stringify(w),s=new BattleState(); s.mem[0xd72d]=0xa4;
  writeBattleInputs(s,w);
  expect(JSON.stringify(w)).toBe(before);
  expect([...s.mem.slice(0xd354,0xd35f)]).toEqual([0xc5,0x81,0,0,0,0,0,0,0,0x0c,0]);
  expect([...s.mem.slice(0xd349,0xd354)]).toEqual([0x86,0x80,0x91,0x98,0x50,0x50,0x50,0x50,0x50,0x50,0x50]);
  expect([...s.mem.slice(0xd358,0xd35a)]).toEqual([0,0]);
  expect(s.mem[0xd74b]).toBe(0x80); expect(s.mem[0xd7f0]).toBe(1); expect(s.mem[0xd72d]).toBe(0xa4);
  expect([...s.mem.slice(0xd058,0xd05d)]).toEqual([202,0,0,7,4]); expect(s.mem[0xd126]).toBe(9);
  expect([s.mem[0xd46f],s.mem[0xd470],s.mem[0xd49b]]).toEqual([123,145,5]);
  expect([s.mem[0xda46],s.mem[0xcce8],s.mem[0xcce9]]).toEqual([0,0,0]);
  expect([...s.mem.slice(0xd31c,0xd324)]).toEqual([3,0x14,17,0x0f,3,0xc9,1,255]);
  expect([...s.mem.slice(0xd162,0xd165)]).toEqual([1,0x54,255]);
  expect([...s.mem.slice(0xda7f,0xda82)]).toEqual([1,0x99,255]);
  expect([...s.mem.slice(0xd309,0xd31c)]).toEqual([1,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,0x40]);
  expect([...s.mem.slice(0xd2f6,0xd309)]).toEqual([1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0x40]);
  s.wBattleResult=1; s.mem[0xccd3]=0x25;
  const out=readBattleOutputs(s);
  expect(out).toEqual({party:w.party.map(pokemonToPartyRecord),box:[boxedPokemonToRecord(boxed)],money:123456,
    seen:[1,76,151],owned:[1,151],bag:w.bag,pikachuHappiness:123,pikachuMood:145,pikachuEmotionModifier:5,battleResult:1,canEvolveFlags:0x25});
  s.mem[0xd16a]=0; expect(out.party[0].species).toBe(0x54); expect('eventFlags' in out).toBe(false);
});
it('encodes each badge in its cartridge bit, Boulder first', () => {
  for(let bit=0;bit<8;bit++){const s=new BattleState();writeBattleInputs(s,battleWorld({badges:[`BADGE_${bit+1}`]}));expect(s.mem[0xd355]).toBe(1<<bit);}
});
it('uses the committed map id table, including map id zero', () => {
  const s=new BattleState();writeBattleInputs(s,battleWorld({mapName:'PalletTown'}));expect(s.mem[0xd35d]).toBe(0);
  expect(()=>writeBattleInputs(s,battleWorld({mapName:'MissingMap'}))).toThrow('battle map');
});
it('writes and clears only the two event masks; ignores USED_POKECENTER everywhere', () => {
  for(const name of ['INITIAL_CATCH_TRAINING','MET_BILL'])for(const enabled of [false,true]){
    const s=new BattleState();s.mem.fill(0,0xd746,0xd886);
    writeBattleInputs(s,battleWorld({eventFlags:enabled?[name]:[]}));
    const expected=new Uint8Array(320); if(enabled)expected[name==='MET_BILL'?0xaa:5]=name==='MET_BILL'?1:128;
    expect(s.mem.slice(0xd746,0xd886)).toEqual(expected);
    writeBattleInputs(s,battleWorld());expect(s.mem.slice(0xd746,0xd886)).toEqual(new Uint8Array(320));
  }
  const a=new BattleState(),b=new BattleState();writeBattleInputs(a,battleWorld());
  writeBattleInputs(b,battleWorld({eventFlags:['USED_POKECENTER']}));expect(b.mem).toEqual(a.mem);
});
it('current box only: no other pcBox enters battle WRAM and the box prefix is lossless at all20 slots', () => {
  const boxed=pokemonToBoxed(createPokemon(1,12,'BULBA',{atk:1,def:2,spd:3,spc:4})!);
  const s=new BattleState();writeBattleInputs(s,battleWorld({pcBoxes:[[boxed],[]],currentPcBox:1}));
  expect(s.mem[0xda7f]).toBe(0);expect(s.mem[0xda80]).toBe(255);expect(readBattleOutputs(s).box).toEqual([]);
  for(let value=0;value<256;value++){
    const a=new BattleState(),b=new BattleState(); b.mem.fill(0x69);
    a.mem.fill(value,0xda95,0xda95+33);a.mem.fill(255-value,0xdd29,0xdd29+11);a.mem.fill(value,0xde05,0xde05+11);
    const record=decodeBoxMon(a,0);encodeBoxMon(b,0,record);expect(decodeBoxMon(b,0)).toEqual(record);
    expect([...b.mem.slice(0xda95,0xda95+33)]).toEqual([...a.mem.slice(0xda95,0xda95+33)]);
    expect(b.mem[0xda95+33]).toBe(0x69);expect(b.mem[0xdd29+11]).toBe(0x69);expect(b.mem[0xde05+11]).toBe(0x69);
  }
  const r=boxedPokemonToRecord(boxed);r.exp=0xffffff;r.statExp=[0x1234,0xabcd,65535,1,0x8000];r.boxLevel=99;r.status=255;r.dvs=[0x98,0x76];r.pp=[0x3f,0x7e,0xbd,0xfc];
  for(let slot=0;slot<20;slot++){encodeBoxMon(s,slot,r);expect(decodeBoxMon(s,slot)).toEqual(r);}
  expect([...s.mem.slice(0xda95+14,0xda95+29)]).toEqual([255,255,255,0x12,0x34,0xab,0xcd,255,255,0,1,0x80,0,0x98,0x76]);
});
it('rejects bag overflow instead of truncating; preserves capacity20 order, duplicates and FF', () => {
  const bag=Array.from({length:20},(_,i)=>({id:'POTION',count:i+1})),s=new BattleState();
  writeBattleInputs(s,battleWorld({bag}));expect(readBattleOutputs(s).bag).toEqual(bag);expect(s.mem[0xd31d+40]).toBe(255);
  const before=s.mem.slice();expect(()=>writeBattleInputs(s,battleWorld({bag:[...bag,{id:'POTION',count:1}]}))).toThrow('capacity20');expect(s.mem).toEqual(before);
});
it('modifier5 survives the real battle happiness reader and blocks its mood increase', () => {
  for(const modifier of [0,5]){
    const s=new BattleState();writeBattleInputs(s,battleWorld({pikachuEmotionModifier:modifier}));s.wWhichPokemon=0;
    modifyPikachuHappiness(s,1);const out=readBattleOutputs(s);
    expect(out.pikachuEmotionModifier).toBe(modifier);expect(out.pikachuHappiness).toBe(95);expect(out.pikachuMood).toBe(modifier?128:0x8a);
  }
});
it('the real ball path reads the encoded catch-training bit', () => {
  for(const enabled of [false,true]){
    const s=new BattleState();writeBattleInputs(s,battleWorld({eventFlags:enabled?['INITIAL_CATCH_TRAINING']:[]}));
    s.wIsInBattle=1;s.wBattleType=1;s.mem[I.wCurItem]=4;
    const video=new BattleMenuScreen(),audio=audioRig();
    const host:BattleItemHost={tiles:video.tiles,audio:new BattleAudio(audio.sfx,audio.music),sounds:new Map(),
      printText:function*(){},waitForSound:function*(){},readScrollJoypad:()=>0};
    let animation:number|undefined;
    const env:BallItemEnvironment={video,animation:function*(){animation=s.mem[I.wPokeBallAnimData];yield 'held';},
      addPartyMon:function*(){},sendNewMonToBox:function*(){},showPokedexData:function*(){}};
    const program=itemUseBall(s,host,env);
    for(let i=0;i<100&&animation===undefined;i++)program.next();
    expect(animation).toBe(enabled?0x63:0x43);
  }
});
it('reads post-EndOfBattle money including Pay Day, never a cached input amount', () => {
  const s=new BattleState();writeBattleInputs(s,battleWorld());s.wBattleResult=0;writeBattleBcd(s,D.wTotalPayDayMoney,123);
  expect(readBattleOutputs(s).money).toBe(3000);
  const host:BattleEndHost={screen:new BattleMenuScreen().screen,printText:function*(){},waitForSound:function*(){},evolutionAfterBattle:function*(){}};
  const program=endOfBattle(s,host);for(let i=0;i<100;i++)if(program.next().done)break;
  expect(readBattleOutputs(s).money).toBe(3123);
});

it('seen and owned independently cover first, middle and final dex bits', () => {
  const s=new BattleState();writeBattleInputs(s,battleWorld({seen:[1,76,151],owned:[1,76,151]}));
  for(const base of [0xd309,0xd2f6])expect([s.mem[base],s.mem[base+9],s.mem[base+18]]).toEqual([1,8,64]);
  expect(readBattleOutputs(s).seen).toEqual([1,76,151]);expect(readBattleOutputs(s).owned).toEqual([1,76,151]);
});
it('outcome reads current bag quantities and counts instead of retaining the entry bag', () => {
  const s=new BattleState();writeBattleInputs(s,battleWorld({bag:[{id:'POTION',count:5},{id:'POKE_BALL',count:3}]}));
  s.setBag([{id:4,quantity:2}]);expect(readBattleOutputs(s).bag).toEqual([{id:'POKE_BALL',count:2}]);
});
