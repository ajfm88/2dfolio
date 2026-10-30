import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isHeld, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { getBattleAndStartSavedMenuItem, setBattleAndStartSavedMenuItem, setPartyAndBillsSavedMenuItem } from '../list_state';
import { enablePikachuFollowing } from '../pikachu/pikachu_following';
import { rig as audioRig, sfxData, musicData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { lowHealthAlarm, setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5, isLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { BattleState, battleContext, decodeNick, encodeText } from './battle_state';
import { D } from './battle_end_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { PartyMenu } from '../menus/party_menu';
import { createPokemon, loadBattleData } from './data';
import { loadBattleMonFromParty, partySlotFromPokemon, writePartySlot } from './battle_loaders';
import type { Frame, Program } from './battle_menu_context';
import type { GameButton } from '../core';
import { animateRetreatingPlayerMon, chooseNextMon, doUseNextMonDialogue, DOWNSCALED_3, DOWNSCALED_5,
  isPlayerPikachuAsleepInParty, printSendOutMonMessage, retreatMon, sendOutMon, switchPlayerMon, bindPlayerSwitch, type PlayerSendOutHost } from './battle_send_out';
import * as menus from './battle_two_option';
import type { TextBox } from '../text/textbox';
import { BattleUnsupportedState } from './battle_move_data';
import { partyMenuOrRockOrRun, type BattlePartyHost } from './battle_party_menu';
import { PNG } from 'pngjs';
import { execFileSync } from 'node:child_process';
import { drawEnemyPokeballs, enemySendOut, enemySendOutFirstMon, replaceFaintedEnemyMon,
  ENEMY_SEND_CELLS, type EnemySendOutHost } from './battle_enemy_send_out';
import { boostExp, divideExpDataByNumMonsGainingExp, gainExperience, learnMoveFromLevelUp,
  loadExperienceMonData, printStatsBox, waitForTextScrollButtonPress, type ExperienceHost } from './battle_experience';
import { getMonHeader } from './battle_loaders';
import { loadBattleMoveData, moveNameBinding, getMoveName, copyMoveNameToStringBuffer } from './battle_move_data';
import { learnMove, bindLearnMove, oneTwoAndText, type LearnMoveHost } from './learn_move';
import { faintEnemyPokemon, removeFaintedPlayerMon, handleEnemyMonFainted, handlePlayerMonFainted,
  handlePlayerBlackOut, trainerBattleVictory, playBattleVictoryMusic, enemyRan, readBattleBcd, type FaintHost } from './battle_faint';
import * as playerSendOut from './battle_send_out';
import { endOfBattle, type BattleEndHost } from './battle_end';
import { battleLoop, type BattleLoopHost } from './battle_loop';
import * as turnEntry from './battle_turn';
import * as faintEntry from './battle_faint';
import { getBagSavedMenuItem, setBagSavedMenuItem, getPartyAndBillsSavedMenuItem, getListScrollOffset, setListScrollOffset,
  getCurrentMenuItem, setCurrentMenuItem, getSavedListScrollOffset, setSavedListScrollOffset } from '../list_state';
import { getAllLoadedMoveIds, getMove } from './data';

beforeAll(async () => { await loadBattleData(); await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.clearAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setPartyAndBillsSavedMenuItem(0); setBattleAndStartSavedMenuItem(0); enablePikachuFollowing();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setLowHealthChannel5(0);
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

function rig() {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost<unknown>(s, undefined, audio.update), video = driver.video, screen = video.screen;
  const party = new PartyMenu(); let time = 0; const events: { at: number; name: string; data: unknown }[] = [];
  const mark = (name: string, data: unknown = null) => events.push({ at: time, name, data });
  let keys: GameButton[] = [];
  s.species = id => ({ name: id === 0x54 ? 'PIKACHU' : 'PIDGEY', base: [40, 45, 40, 56, 35],
    type1: 0, type2: 2, catchRate: 255, baseExp: 55, moves: [33, 0, 0, 0], learnset: [] });
  s.random = () => { throw new Error('unexpected BattleRandom'); };
  s.mem[D.wPartyCount] = 3; s.setBytes(D.wPartySpecies, [0x54, 0x24, 0x54, 255], 4);
  for (let slot = 0; slot < 3; slot++) {
    const mon = createPokemon(slot === 1 ? 'PIDGEY' : 'PIKACHU', 20, ['OLD', 'NEW', 'THIRD'][slot])!;
    s.partyMons[slot] = mon;
    const packed = partySlotFromPokemon(mon); packed.hp = packed.maxHp = 60; packed.speed = 12 + slot;
    packed.otId = 0x1234; packed.otName = 'ASHXY'; writePartySlot(s, 'player', slot, packed);
  }
  s.writeBE(D.wPlayerID, 0xabcd); s.setBytes(D.wPlayerName, encodeText('ASHXY@'), 11);
  s.wWhichPokemon = s.wPlayerMonNumber = 0; s.wBattleMonSpecies2 = 0x54;
  loadBattleMonFromParty(s); s.wEnemyMonHP = s.wEnemyMonMaxHP = 100; s.wEnemyMonSpeed = 100;
  s.wEnemyMonSpecies2 = 1; s.wIsInBattle = 1;
  // §11.15: this synthetic enemy has no loaded nickname.
  s.mem[D.wEnemyMonNick] = 0x50;
  video.saveScreenTilesToBuffer1();
  const host: PlayerSendOutHost = {
    screen, tiles: video.tiles, audio: bridge, partyView: party,
    printText: function* (label, bindings, options) {
      mark(`text:${label}`, bindings); yield* driver.printText(label, bindings, options);
      mark(`textEnd:${label}`, Array.from({ length: 2 }, (_, i) => Array.from({ length: 18 }, (_, x) =>
        String(screen.at(x + 1, 14 + i * 2) ?? ' ')).join('').trimEnd()));
    },
    saveScreenTilesToBuffer1() { mark('save1'); video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer1() { mark('load1'); video.loadScreenTilesFromBuffer1(); },
    readJoypad() { mark('read', keys); }, pressSound() { mark('press'); bridge.play({ id: 0x90, data: sfxData('press_ab') }); },
    updateSprites() { mark('sprites'); },
    waitForSound: function* () { mark('wait'); while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced'; },
    playSound(name) { mark(`sound:${name}`); bridge.play({ id: 0x97, data: sfxData(name) }); },
    runOdds(player, enemy, attempts) {
      mark('odds', [player, enemy, attempts]);
      if (player >= enemy) return true;
      const divisor = (enemy >>> 2) & 255; if (!divisor) return true;
      const chance = Math.floor(((player * 32) & 65535) / divisor) + 30 * ((attempts || 256) - 1);
      return chance > 255 || chance >= s.random();
    },
    backPicture(state) { mark('back', state.wBattleMonSpecies2); return `back-${state.wBattleMonSpecies2}`; },
    animation: function* (state) { mark('animation', [state.wAnimationID, state.hWhoseTurn]); },
    sendingOutMon(state, x, y) { mark('sendCue', [state.hWhoseTurn, x, y]); },
    pikachuEntrance(state) { mark('pikaEntrance', [state.hWhoseTurn, textBgTransfer.enabled]); },
    slidePlayerOff(state) { mark('pikaRetreat', [state.hWhoseTurn, state.wWhichPokemon]); },
    voice: { getAlarm: lowHealthAlarm, setAlarm(value) { mark('alarm', value); setLowHealthAlarm(value); },
      cry(id) { mark('cry', [id, lowHealthAlarm()]); }, clip(id) { mark('clip', id); } },
  };
  vi.mocked(playSFX).mockImplementation(async name => {
    bridge.play({ id: name === 'get_item1' ? 0x86 : 0x90, data: sfxData(name) });
  });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  const frames: Frame[] = [], ledger: unknown[] = [];
  function start(p: Program<unknown>) { driver.start(p); }
  function step(pressed: GameButton[] = []) {
    keys = pressed; vi.mocked(isPassPressed).mockImplementation(key => keys.includes(key));
    vi.mocked(isHeld).mockImplementation(key => keys.includes(key)); time++;
    // Party sessions own their frame, while BattleHost services only battle frames.
    // Supply the session audio owner here (main's independent audio clock in production).
    const pending = (driver as unknown as { pending: IteratorResult<Frame, unknown> }).pending;
    if (!pending.done && pending.value === 'session') audio.update();
    const kind = driver.step(); if (kind) frames.push(kind);
    ledger.push({ time, kind, which: s.wWhichPokemon, active: s.wPlayerMonNumber, flags: s.mem.slice(D.wPartyGainExpFlags, D.wPartyGainExpFlags + 1),
      cells: screen.cells, visible: screen.visibleCells, ids: [5,6,7,8].map(ch => bridge.channelId(ch)) });
  }
  function finish(keysForFrame?: (frame: number) => GameButton[]) {
    for (let i = 0; !driver.done && i < 3000; i++) {
      const partyText = (party as unknown as { openingTextBox: TextBox }).openingTextBox;
      const waiting = video.textBox.isWaitingForInput || partyText.isWaitingForInput;
      const input = waiting ? (time % 2 ? [] : ['b'] as GameButton[]) : keysForFrame?.(time + 1) ?? [];
      step(input);
    }
    expect(driver.done).toBe(true); return driver.result;
  }
  return { s, audio, bridge, driver, video, screen, host, party, events, frames, ledger, start, step, finish,
    time: () => time, mark };
}

describe('send-out and retreat messages on one retained PrintText', () => {
  it.each([[0,'GoText'],[9,'EnemysWeakText'],[10,'GetmText'],[39,'GetmText'],[40,'DoItText'],[69,'DoItText'],[70,'GoText'],[100,'GoText']] as const)
  ('enemy HP%i selects %s with the source thresholds', (hp, label) => {
    const r = rig(); r.s.wEnemyMonHP = hp; r.s.writeBE(D.wLastSwitchInEnemyMonHP, 0x4567);
    r.start(printSendOutMonMessage(r.s,r.host)); r.finish();
    expect(r.events.filter(e => e.name.startsWith('text:')).map(e => e.name)).toEqual([`text:${label}`]);
    expect(r.s.readBE(D.wLastSwitchInEnemyMonHP)).toBe(hp || 0x4567);
    const end = r.events.find(e => e.name === `textEnd:${label}`)!;
    expect((end.data as string[]).join('')).toContain('OLD!');
  });
  it.each([[100,100,'EnoughText'],[100,99,'ComeBackText'],[100,71,'ComeBackText'],[100,70,'OKExclamationText'],
    [100,31,'OKExclamationText'],[100,30,'GoodText'],[50,100,'GoodText']] as const)
  ('retreat last%i/current%i preserves integer/wrapped selection %s', (last,hp,label) => {
    const r = rig(); r.s.writeBE(D.wLastSwitchInEnemyMonHP,last); r.s.wEnemyMonHP = hp;
    r.start(retreatMon(r.s,r.host)); r.finish();
    const output = r.events.find(e => e.name === 'textEnd:PlayerMon2Text')!.data as string[];
    const prefix: Record<string,string> = { EnoughText:'enough!',ComeBackText:'',OKExclamationText:'OK!',GoodText:'good!' };
    expect(output[0]).toBe(`OLD ${prefix[label]}`.trimEnd()); expect(output[1]).toBe('Come back!');
    expect(r.events.filter(e => e.name.startsWith('text:')).map(e => e.name)).toEqual(['text:PlayerMon2Text']);
  });
  it('uses only the low byte of maxHP/4 and the low quotient byte rather than a floating percentage', () => {
    const r = rig(); r.s.wEnemyMonMaxHP = 1200; r.s.wEnemyMonHP = 1100;
    // divisor44; floor(1100*25/44)=625 -> low byte113, so Go rather than a capped percentage.
    r.start(printSendOutMonMessage(r.s,r.host)); r.finish();
    expect(r.events[0].name).toBe('text:GoText'); expect(r.s.mem[D.hQuotient+3]).toBe(113);
  });
  it('zero divisor suspends before PrintText without RNG or invented percentages', () => {
    const r = rig(); r.s.wEnemyMonMaxHP = 1024;
    r.start(printSendOutMonMessage(r.s,r.host)); for(let i=0;i<5;i++) r.step();
    expect(r.driver.done).toBe(false); expect(r.events).toEqual([]); expect(r.frames).toEqual(Array(5).fill('serviced'));
  });
  it('retreat preserves the old high multiplicand byte rather than normalizing the HP difference', () => {
    const r=rig(); r.s.wEnemyMonMaxHP=92; r.s.wEnemyMonHP=100; r.s.writeBE(D.wLastSwitchInEnemyMonHP,100);
    r.s.mem[D.hMultiplicand]=2; r.start(retreatMon(r.s,r.host)); r.finish();
    expect(r.s.mem[D.hQuotient+3]).toBe(133);
    expect(r.events.find(e=>e.name==='textEnd:PlayerMon2Text')?.data).toEqual(['OLD good!','Come back!']);
  });
});

describe('real retreat tile writes and selected-versus-active identity', () => {
  it('pins the copied 5x5/3x3 tables against the local INCBINs', () => {
    for(const [size,table] of [['5x5',DOWNSCALED_5],['3x3',DOWNSCALED_3]] as const)
      expect([...readFileSync(resolve(__dirname,`../../../refs/pokeyellow/gfx/pokemon/downscaled_${size}.tilemap`))]).toEqual(table);
  });
  it.each([0,1,2])('retreat has the exact 4+3 holds and BG-third writes at phase%i', phase => {
    const r = rig(); r.s.wWhichPokemon=1;
    for(let i=0;i<phase;i++) r.screen.vblank();
    r.start(animateRetreatingPlayerMon(r.s,r.host));
    expect(r.s.wWhichPokemon).toBe(1); expect(r.s.mem[D.wDownscaledMonSize]).toBe(0);
    DOWNSCALED_5.forEach((tile,i)=>expect(r.screen.at(3+i%5,7+Math.floor(i/5))).toBe(tile));
    const stepAndCheckVisible=()=>{
      const expected=[...r.screen.visibleCells], before=r.screen.cells, third=textBgTransfer.nextPortion;
      expected.splice(third*120,120,...before.slice(third*120,third*120+120));
      r.step(); expect(r.screen.visibleCells).toEqual(expected);
    };
    for(let i=0;i<3;i++) stepAndCheckVisible(); expect(r.s.mem[D.wDownscaledMonSize]).toBe(0);
    stepAndCheckVisible(); expect(r.s.mem[D.wDownscaledMonSize]).toBe(1);
    DOWNSCALED_3.forEach((tile,i)=>expect(r.screen.at(4+i%3,9+Math.floor(i/3))).toBe(tile));
    for(let i=0;i<3;i++) stepAndCheckVisible();
    expect(r.driver.done).toBe(true); expect(r.time()).toBe(7); expect(r.s.wWhichPokemon).toBe(1);
    for(let y=5;y<12;y++) for(let x=1;x<8;x++) expect(r.screen.at(x,y)).toBe(' ');
  });
  it('checks the outgoing active starter, restores the incoming selection and emits the zero-frame slide cue', () => {
    const r=rig(); r.s.writeBE(D.wPlayerID,0x1234); r.s.wWhichPokemon=1;
    r.start(animateRetreatingPlayerMon(r.s,r.host)); expect(r.driver.done).toBe(true);
    expect(r.s.wWhichPokemon).toBe(1); expect(r.s.hWhoseTurn).toBe(0);
    expect(r.events).toEqual([{at:0,name:'pikaRetreat',data:[0,1]}]);
  });
});

describe('SendOutMon owner composition', () => {
  it('holds reset writes until both seven-frame back copies complete', () => {
    const r=rig(); r.s.mem[D.wBoostExpByExpAll]=0x75;
    r.start(sendOutMon(r.s,r.host));
    for(let i=0;!r.events.some(e=>e.name==='back')&&i<200;i++) r.step();
    const at=r.time(); expect(r.s.mem[D.wBoostExpByExpAll]).toBe(0x75);
    for(let i=0;i<13;i++) r.step();
    expect(r.s.mem[D.wBoostExpByExpAll]).toBe(0x75);
    r.step(); expect(r.time()-at).toBe(14); expect(r.s.mem[D.wBoostExpByExpAll]).toBe(0);
    r.finish();
  });
  it('runs the regular poof wrapper, copies14, clears exactly the source spans and releases the enemy trap', () => {
    const r=rig(); r.s.wEnemyBattleStatus1=0xff;
    setBattleAndStartSavedMenuItem(2);
    r.s.mem.fill(0xff,D.wPlayerStatsToDouble,D.wPlayerStatsToDouble+6);
    for(const at of [D.wPlayerUsedMove,D.wPlayerUsedMove+1,D.wBoostExpByExpAll,D.wPlayerDisabledMove,D.wPlayerDisabledMoveNumber,D.wPlayerMonMinimized,D.wBattleAndStartSavedMenuItem,D.wPlayerMoveListIndex]) r.s.mem[at]=0xff;
    r.start(sendOutMon(r.s,r.host)); r.finish();
    expect([...r.s.mem.slice(D.wPlayerStatsToDouble,D.wPlayerStatsToDouble+6)]).toEqual([0,0,0,0,0,0xff]);
    expect(r.s.wEnemyBattleStatus1).toBe(0xdf);
    expect(getBattleAndStartSavedMenuItem()).toBe(0);
    expect(r.events.find(e=>e.name==='animation')?.data).toEqual([0xc3,1]);
    expect(r.events.find(e=>e.name==='sendCue')?.data).toEqual([1,4,11]);
    expect(r.events.find(e=>e.name==='cry')?.data).toEqual([0x54,0]);
    expect(r.screen.backSlot(0x61)).toEqual({picture:'back-84',tile:48});
    expect(r.events.filter(e=>e.name==='save1')).toHaveLength(1);
    expect(r.frames.filter(f=>f==='held')).toHaveLength(2);
  });
  it.each([0,1])('starter clip asleep=%i retains its three prefix frames and the asleep scan slot', asleep => {
    const r=rig(); r.s.writeBE(D.wPlayerID,0x1234); r.s.mem[D.wPartyMons+4]=asleep;
    r.s.wWhichPokemon=2; r.s.wPlayerMonNumber=2; r.s.wBattleMonSpecies2=0x54;
    const clear=vi.spyOn(r.bridge,'clearClipIds');
    r.start(sendOutMon(r.s,r.host)); r.finish();
    expect(r.s.wWhichPokemon).toBe(0); expect(r.s.hWhoseTurn).toBe(0);
    expect(r.events.find(e=>e.name==='clip')?.data).toBe(asleep?37:11);
    expect(r.events.find(e=>e.name==='clip')!.at-r.events.find(e=>e.name==='pikaEntrance')!.at).toBe(3);
    expect(clear).toHaveBeenCalledOnce(); expect(r.events.some(e=>e.name==='cry'||e.name==='animation')).toBe(false);
  });
  it('skips the enemy HUD and last-switch write when enemy HP is zero', () => {
    const r=rig(); r.s.wEnemyMonHP=0; r.s.writeBE(D.wLastSwitchInEnemyMonHP,1234);
    r.start(sendOutMon(r.s,r.host)); r.finish();
    expect(r.s.readBE(D.wLastSwitchInEnemyMonHP)).toBe(1234);
    expect(r.screen.at(11,0)).toBe(' ');
  });
});

describe('DoUseNextMonDialogue', () => {
  it('trainer path returns after the empty text and Save1 without prompting', () => {
    const r=rig(); r.s.wIsInBattle=2; r.start(doUseNextMonDialogue(r.s,r.host));
    expect(r.finish()).toEqual({carry:false}); expect(r.time()).toBe(3);
    expect(r.events.map(e=>e.name)).toEqual(['text:PrintEmptyString.emptyString','textEnd:PrintEmptyString.emptyString','save1']);
  });
  it('YES returns carry clear without running', () => {
    const r=rig(); r.start(doUseNextMonDialogue(r.s,r.host)); r.finish(()=>['a']);
    expect(r.driver.result).toEqual({carry:false}); expect(r.events.some(e=>e.name==='odds')).toBe(false);
  });
  it.each([{ keys:['b'] as GameButton[] }, { keys:['a','b'] as GameButton[] }])('NO from raw $keys uses dead slot0 speed, sets the failed-run force flag', ({keys}) => {
    const r=rig(); r.s.wPlayerMonNumber=1; r.s.wBattleMonSpeed=999; r.s.writeBE(D.wPartyMons+1,0);
    r.s.writeBE(D.wPartyMons+40,1); r.s.random=()=>255;
    r.start(doUseNextMonDialogue(r.s,r.host)); expect(r.finish(()=>keys)).toEqual({carry:false});
    expect(r.events.find(e=>e.name==='odds')?.data).toEqual([1,100,1]);
    expect(r.s.wForcePlayerToChooseMon).toBe(1); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
  });
  it('successful refusal waits on the real RUN channel and returns carry with result2', () => {
    const r=rig(); r.s.writeBE(D.wPartyMons+40,100);
    r.start(doUseNextMonDialogue(r.s,r.host)); expect(r.finish(()=>['b'])).toEqual({carry:true});
    expect(r.s.wBattleResult).toBe(2); expect(soundFinished(r.audio.sfx,r.audio.music,0)).toBe(true);
    expect(r.events.filter(e=>e.name==='wait')).toHaveLength(2);
  });
  it('retains the source currentItem0 retry after an injected second answer', () => {
    const r=rig(); let visits=0;
    const real=menus.displayTwoOptionMenu;
    vi.spyOn(menus,'displayTwoOptionMenu').mockImplementation(function* (state,...args) {
      visits++; if(visits===1) { state.mem[D.wMenuExitMethod]=2; state.wCurrentMenuItem=0; return {carry:true}; }
      return yield* real(state,...args);
    });
    r.start(doUseNextMonDialogue(r.s,r.host)); expect(r.finish(()=>['a'])).toEqual({carry:false});
    expect(visits).toBe(2); expect(r.events.some(e=>e.name==='odds')).toBe(false);
  });
});

describe('ChooseNextMon and SwitchPlayerMon, real party/list/copy owners', () => {
  it('composes refused replacement, failed run, force-one-opening and successful choosing on the same owners', () => {
    const r=rig(); r.s.writeBE(D.wPartyMons+1,0); r.s.partyMons[0]!.currentHp=0;
    r.s.writeBE(D.wPartyMons+40,1); const random=vi.fn(()=>255); r.s.random=random;
    const input:GameButton[][]=[['b'],['b'],['a','b'],['down'],['a']];
    r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    const force=vi.spyOn(r.party,'openBattleChoice');
    const program=function*():Program {
      const refusal=yield* doUseNextMonDialogue(r.s,r.host); expect(refusal.carry).toBe(false);
      expect(r.s.wForcePlayerToChooseMon).toBe(1); yield* chooseNextMon(r.s,r.host);
    };
    r.start(program()); r.finish();
    expect(input).toEqual([]); expect(random).toHaveBeenCalledOnce();
    expect(force.mock.calls[0][1]).toEqual({forceChoose:true}); expect(r.s.wForcePlayerToChooseMon).toBe(0);
    expect(r.s.wPlayerMonNumber).toBe(1); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
  });
  it('forced replacement retries B and fainted selection, then loads the living mon with both EXP bits', () => {
    const r=rig(); r.s.writeBE(D.wPartyMons+1,0); r.s.partyMons[0]!.currentHp=0;
    r.s.mem[D.wPartyGainExpFlags]=0x80; r.s.mem[D.wPartyFoughtCurrentEnemyFlags]=0x40;
    const first=vi.spyOn(r.party,'openBattleChoice'), back=vi.spyOn(r.party,'goBackToChoice');
    const noWill=vi.spyOn(r.party,'printBattleChoiceText');
    const input: GameButton[][]=[['b'],['a'],['down'],['a']];
    r.host.readJoypad=()=>{
      const keys=input.shift()??[]; vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));
      r.mark('choiceRead',keys);
    };
    const partyBefore=r.s.mem.slice(D.wPartyMons,D.wPartyMons+3*44);
    r.start(chooseNextMon(r.s,r.host)); expect(r.finish()).toEqual({zero:false});
    expect(input).toEqual([]); expect(first).toHaveBeenCalledOnce(); expect(back).toHaveBeenCalledTimes(2);
    expect(noWill).toHaveBeenCalledWith('NoWillText');
    expect(r.s.wPlayerMonNumber).toBe(1); expect(r.s.wWhichPokemon).toBe(1);
    expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([0x82,0x42]);
    expect(decodeNick(r.s.mem,D.wBattleMonNick)).toBe('NEW'); expect(r.s.wBattleMonSpecies).toBe(0x24);
    expect(r.s.mem.slice(D.wPartyMons,D.wPartyMons+3*44)).toEqual(partyBefore);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(0); expect(r.screen.obp1).toBe(0);
    expect(r.frames.filter(kind=>kind==='held')).toHaveLength(4); // reload palette + SendOut palette
    expect(r.screen.hudSlot(0x62)).toBeNull(); expect(r.screen.hudSlot(0x6d)).not.toBeNull();
  });
  it('consumes failed-run force flag once: B alone cannot cancel, while A+B re-enters the list', () => {
    const r=rig(); r.s.wForcePlayerToChooseMon=1; r.s.wEnemyMonHP=0;
    const input: GameButton[][]=[['b'],['a','b'],['a']];
    r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    const back=vi.spyOn(r.party,'goBackToChoice');
    r.start(chooseNextMon(r.s,r.host)); expect(r.s.wForcePlayerToChooseMon).toBe(0);
    expect(r.s.mem[D.wMenuWatchedKeys]).toBe(1);
    expect(r.finish()).toEqual({zero:true}); expect(input).toEqual([]); expect(back).toHaveBeenCalledOnce();
    expect(r.s.mem[D.wMenuWatchedKeys]).toBe(3); expect(r.s.wPlayerMonNumber).toBe(0); // active slot is legal in this chooser
  });
  it('rejects link at the exact post-choice branch before action/active/load writes', () => {
    const r=rig(); r.s.wLinkState=4; r.s.wActionResultOrTookBattleTurn=0x77;
    r.host.readJoypad=()=>vi.mocked(isPassPressed).mockImplementation(key=>key==='a');
    r.start(chooseNextMon(r.s,r.host));
    expect(()=>r.finish()).toThrow(BattleUnsupportedState);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(0x77); expect(r.s.wPlayerMonNumber).toBe(0);
    expect(r.events.some(e=>e.name==='back')).toBe(false);
  });
  it('switches after RetreatMon+50+7, preserves old EXP bits and the party, saves twice, and returns item2', () => {
    const r=rig(); r.s.wWhichPokemon=1; r.s.writeBE(D.wLastSwitchInEnemyMonHP,100);
    r.s.mem[D.wPartyGainExpFlags]=1; r.s.mem[D.wPartyFoughtCurrentEnemyFlags]=1;
    r.s.wActionResultOrTookBattleTurn=0x55;
    const before=r.s.mem.slice(D.wPartyMons,D.wPartyMons+3*44);
    r.start(switchPlayerMon(r.s,r.host)); expect(r.finish()).toEqual({carry:false,zero:false});
    const retreatEnd=r.events.find(e=>e.name==='textEnd:PlayerMon2Text')!;
    const send=r.events.find(e=>e.name==='text:GoText')!;
    expect(send.at-retreatEnd.at).toBe(57);
    expect(r.s.wPlayerMonNumber).toBe(1); expect(r.s.wCurrentMenuItem).toBe(2);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(0x55); // caller owns action1
    expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([3,3]);
    expect(r.events.filter(e=>e.name==='save1')).toHaveLength(2);
    expect(r.s.mem.slice(D.wPartyMons,D.wPartyMons+3*44)).toEqual(before);
    expect(r.s.partyMons[0]!.nickname).toBe('OLD'); expect(r.s.partyMons[1]!.nickname).toBe('NEW');
  });
  it('outgoing starter uses the slide cue while incoming starter retains the asleep scan whichPokemon', () => {
    const r=rig(); r.s.writeBE(D.wPlayerID,0x1234); r.s.wWhichPokemon=2;
    r.s.writeBE(D.wLastSwitchInEnemyMonHP,100); r.s.mem[D.wPartyMons+4]=1;
    r.start(switchPlayerMon(r.s,r.host)); r.finish();
    const retreatEnd=r.events.find(e=>e.name==='textEnd:PlayerMon2Text')!;
    expect(r.events.find(e=>e.name==='text:GoText')!.at-retreatEnd.at).toBe(50);
    expect(r.events.find(e=>e.name==='pikaRetreat')!.data).toEqual([0,2]);
    expect(r.s.wPlayerMonNumber).toBe(2); expect(r.s.wWhichPokemon).toBe(0);
    expect(r.events.find(e=>e.name==='clip')?.data).toBe(37);
  });
  it('fills the real A5c2 switch port, including already-out retry and the raw-species hand-off', () => {
    const r=rig(); r.s.partyMons=r.s.partyMons.slice(0,3); r.s.writeBE(D.wLastSwitchInEnemyMonHP,100);
    const ctx=battleContext(r.s);
    const legacy: BattlePartyHost={...r.host,partyView:r.party,statusView:null,
      loadScreenTilesFromBuffer2:()=>r.video.loadScreenTilesFromBuffer2(),
      saveScreenTilesToBuffer2:()=>r.video.saveScreenTilesToBuffer2(),
      useItem:function*(){},partyMenu:function*(){return null;},loadEnemyPicVariant:function*(){},
      switchPlayerMon:function*(){throw new Error('unbound');}};
    bindPlayerSwitch(r.s,legacy,r.host);
    const input:GameButton[][]=[['a'],['a'],['down'],['a'],['a']];
    legacy.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    const already=vi.spyOn(r.party,'printBattleChoiceText');
    r.start(partyMenuOrRockOrRun(ctx,legacy)); expect(r.finish()).toEqual({carry:false});
    expect(input).toEqual([]); expect(already).toHaveBeenCalledWith('AlreadyOutText',{battleMonNick:'OLD'});
    expect(r.s.wActionResultOrTookBattleTurn).toBe(1); expect(r.s.wPlayerMonNumber).toBe(1);
    expect(r.s.wBattleMonSpecies).toBe(0x24); expect(r.s.wBattleMonSpecies2).toBe(0x24);
    expect(r.s.wCurrentMenuItem).toBe(2);
  });
});

describe('Pikachu asleep search side effects', () => {
  it('retains the first identity match even if a later starter is asleep', () => {
    const r=rig(); r.s.writeBE(D.wPlayerID,0x1234); r.s.mem[D.wPartyMons+4]=0;
    r.s.mem[D.wPartyMons+2*44+4]=1; r.s.wWhichPokemon=2;
    expect(isPlayerPikachuAsleepInParty(r.s)).toBe(false); expect(r.s.wWhichPokemon).toBe(0);
  });
  it('searches both identity fields and leaves whichPokemon at the list sentinel', () => {
    const r=rig(); r.s.wWhichPokemon=1;
    expect(isPlayerPikachuAsleepInParty(r.s)).toBe(false); expect(r.s.wWhichPokemon).toBe(3);
    r.s.writeBE(D.wPlayerID,0x1234); r.s.mem[D.wPartyMonOT+4]^=1;
    expect(isPlayerPikachuAsleepInParty(r.s)).toBe(false); expect(r.s.wWhichPokemon).toBe(2);
  });
});

describe('checkpoint-05b item0 regressions', () => {
  it('SendOutMon clears a nonzero player move-list index', () => {
    const r=rig(); r.s.wPlayerMoveListIndex=0xab;
    r.start(sendOutMon(r.s,r.host)); r.finish(); expect(r.s.wPlayerMoveListIndex).toBe(0);
  });
  it('a poisoned starter uses clip11 because only SLP_MASK selects clip37', () => {
    const r=rig(); r.s.writeBE(D.wPlayerID,0x1234); r.s.mem[D.wPartyMons+4]=0x08;
    r.start(sendOutMon(r.s,r.host)); r.finish();
    expect(r.events.find(e=>e.name==='clip')?.data).toBe(11);
  });
  it('ChooseNextMon restores OBP0 to $D0 after its white palette', () => {
    const r=rig(); r.screen.obp0=0xa5; r.s.wEnemyMonHP=0;
    r.host.readJoypad=()=>vi.mocked(isPassPressed).mockImplementation(key=>key==='a');
    r.start(chooseNextMon(r.s,r.host)); r.finish(); expect(r.screen.obp0).toBe(0xd0);
  });
  it('SendOutMon clears a nonzero player Minimize byte', () => {
    const r=rig(); r.s.wPlayerMonMinimized=0x79;
    r.start(sendOutMon(r.s,r.host)); r.finish(); expect(r.s.wPlayerMonMinimized).toBe(0);
  });
});

function enemyRig() {
  const r=rig(); const {s}=r;
  s.wIsInBattle=2; s.wFirstMonsNotOutYet=1; s.wEnemyMonPartyPos=0;
  s.mem[D.wEnemyPartyCount]=4;
  s.setBytes(ENEMY_SEND_CELLS.wEnemyPartySpecies,[1,0x24,0x54,0x24,255],5);
  s.setBytes(D.wTrainerName,encodeText('ACE@'),11);
  for(let slot=0;slot<4;slot++) {
    const packed=partySlotFromPokemon(createPokemon(slot===2?'PIKACHU':'PIDGEY',20)!);
    packed.boxLevel=7; packed.hp=slot<2?0:40; packed.status=slot===2?8:0;
    writePartySlot(s,'enemy',slot,packed);
  }
  s.movePP=()=>35;
  const balls=PNG.sync.read(readFileSync(resolve(__dirname,'../../static/gfx/battle/balls.png')));
  const atlas={width:128,height:128,data:new Uint8ClampedArray(128*128*4).fill(123)};
  const host:EnemySendOutHost={...r.host,renderTiles:{sprites:atlas},pokeballTiles:balls,
    frontPicture(state){r.mark('front',[state.wEnemyMonSpecies2,state.wWhichPokemon]);return `front-${state.wEnemyMonSpecies2}`;}};
  return {...r,host,atlas};
}

describe('DrawEnemyPokeballs uses the existing copy queue, sprite atlas and OAM',()=>{
  it('pins new scratch addresses to the symbols revision already used by note70',()=>{
    const sym=execFileSync('git',['-C',resolve(__dirname,'../../../refs/pokeyellow'),'show','573535d:pokeyellow.sym'],{encoding:'utf8'});
    for(const [name,address] of Object.entries(ENEMY_SEND_CELLS))
      expect(sym).toMatch(new RegExp(`^00:${address.toString(16)} ${name}$`,'m'));
  });
  it('copies all four committed ball tiles in one VBlank, retaining every other atlas tile',()=>{
    const r=enemyRig(); const before=r.atlas.data.slice(); const source=r.host.pokeballTiles;
    r.start(drawEnemyPokeballs(r.s,r.host));
    expect(r.host.renderTiles.sprites).toBe(r.atlas); expect(r.frames).toEqual([]);
    r.step(); expect(r.driver.done).toBe(true); expect(r.frames).toEqual(['serviced']);
    expect(r.host.renderTiles.sprites).not.toBe(r.atlas);
    const after=r.host.renderTiles.sprites.data;
    for(let tile=0;tile<256;tile++) for(let y=0;y<8;y++) for(let x=0;x<8;x++) for(let c=0;c<4;c++) {
      const at=((Math.floor(tile/16)*8+y)*128+(tile%16)*8+x)*4+c;
      if(tile>=0x31&&tile<=0x34) {
        const n=tile-0x31,across=source.width/8;
        const from=((Math.floor(n/across)*8+y)*source.width+(n%across)*8+x)*4+c;
        expect(after[at]).toBe(source.data[from]);
      }else expect(after[at]).toBe(before[at]);
    }
  });
  it('classifies both HP bytes and status, fills empty slots, and writes the six enemy OAM entries',()=>{
    const r=enemyRig(); r.s.mem[D.wEnemyPartyCount]=3;
    r.s.writeBE(D.wEnemyMons+1,0x100); r.s.mem[D.wEnemyMons+4]=0;
    r.s.writeBE(D.wEnemyMons+44+1,0); r.s.mem[D.wEnemyMons+44+4]=8;
    r.start(drawEnemyPokeballs(r.s,r.host)); r.finish();
    expect([...r.s.mem.slice(D.wBuffer,D.wBuffer+6)]).toEqual([0x31,0x33,0x32,0x34,0x34,0x34]);
    r.screen.vblank();
    for(let i=0;i<6;i++) expect(r.screen.oam(6+i)).toEqual({y:0x20,x:0x48-i*8,tile:r.s.mem[D.wBuffer+i],attributes:1});
    expect([r.s.mem[ENEMY_SEND_CELLS.wBaseCoordX],r.s.mem[ENEMY_SEND_CELLS.wBaseCoordY],r.s.mem[ENEMY_SEND_CELLS.wHUDPokeballGfxOffsetX],r.s.mem[ENEMY_SEND_CELLS.wdef4]])
      .toEqual([0x18,0x20,0xf8,1]);
    expect(r.screen.at(1,2)).toBe(0x73); expect(r.screen.at(1,3)).toBe(0x74); expect(r.screen.at(10,3)).toBe(0x78);
  });
  it('LCD-off pattern copying costs no frames',()=>{
    const r=enemyRig(); r.screen.lcdOn=false; r.start(drawEnemyPokeballs(r.s,r.host));
    expect(r.driver.done).toBe(true); expect(r.frames).toEqual([]); expect(r.host.renderTiles.sprites).not.toBe(r.atlas);
  });
});

describe('EnemySendOut and FirstMon',()=>{
  it.each([0,1,2])('retains the exact rightward16-frame trainer slide and BG thirds at phase%i',phase=>{
    const r=enemyRig();
    for(let y=0;y<7;y++) for(let x=0;x<20;x++) r.screen.put(x,y,40+y*20+x);
    for(let i=0;i<phase;i++) r.screen.vblank();
    const model=[...r.screen.cells];
    r.start(enemySendOutFirstMon(r.s,r.host));
    for(let frame=0;frame<16;frame++) {
      if(frame%2===0) for(let row=0;row<7;row++) for(let col=0;col<8;col++) {
        const at=18-col+row*20; model[at+1]=model[at];
      }
      expect(r.screen.cells.slice(0,140)).toEqual(model.slice(0,140));
      const visible=[...r.screen.visibleCells],third=textBgTransfer.nextPortion;
      visible.splice(third*120,120,...r.screen.cells.slice(third*120,third*120+120));
      r.step(); expect(r.screen.visibleCells).toEqual(visible);
    }
    expect(r.events.find(e=>e.name==='text:PrintEmptyString.emptyString')!.at).toBe(16); r.finish();
  });
  it('FirstMon preserves participation bytes while clearing exactly the enemy reset spans before its slide',()=>{
    const r=enemyRig(); r.s.mem[D.wPartyGainExpFlags]=0x81; r.s.mem[D.wPartyFoughtCurrentEnemyFlags]=0x42;
    r.s.mem.fill(0xab,D.wEnemyStatsToDouble,D.wEnemyStatsToDouble+6);
    r.s.wEnemyDisabledMove=r.s.wEnemyDisabledMoveNumber=r.s.wEnemyMonMinimized=0x79;
    r.s.mem[D.wPlayerUsedMove]=r.s.mem[D.wPlayerUsedMove+1]=0x75; r.s.wPlayerBattleStatus1=0xff;
    r.start(enemySendOutFirstMon(r.s,r.host));
    expect([...r.s.mem.slice(D.wEnemyStatsToDouble,D.wEnemyStatsToDouble+6)]).toEqual([0,0,0,0,0,0xab]);
    expect([r.s.wEnemyDisabledMove,r.s.wEnemyDisabledMoveNumber,r.s.wEnemyMonMinimized]).toEqual([0,0,0]);
    expect([r.s.mem[D.wPlayerUsedMove],r.s.mem[D.wPlayerUsedMove+1],r.s.mem[D.wAICount],r.s.wPlayerBattleStatus1]).toEqual([0,0,0xff,0xdf]);
    r.finish(); expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([0x81,0x42]);
  });
  it('EnemySendOut resets both participation bytes to the current active player bit',()=>{
    const r=enemyRig(); r.s.wPlayerMonNumber=2;
    r.s.mem[D.wPartyGainExpFlags]=0xff; r.s.mem[D.wPartyFoughtCurrentEnemyFlags]=0xff;
    r.start(enemySendOut(r.s,r.host));
    expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([4,4]);
    r.finish(); expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([4,4]);
  });
  it('skips the current enemy even if alive, skips fainted slots, and reads the selected list/level/HP/status',()=>{
    const r=enemyRig(); r.s.writeBE(D.wEnemyMons+1,60);
    const party=r.s.mem.slice(D.wEnemyMons,D.wEnemyMons+4*44);
    r.start(enemySendOutFirstMon(r.s,r.host)); r.finish();
    expect(r.s.wEnemyMonPartyPos).toBe(2); expect(r.s.wWhichPokemon).toBe(2);
    expect(r.s.wEnemyMonSpecies2).toBe(0x54); expect(r.s.wCurEnemyLevel).toBe(20);
    expect(r.s.wEnemyMonHP).toBe(40); expect(r.s.wEnemyMonStatus).toBe(8); // box level is7
    expect(r.s.readBE(D.wLastSwitchInEnemyMonHP)).toBe(40);
    expect([...r.s.mem.slice(D.wEnemyMonDVs,D.wEnemyMonDVs+2)]).toEqual([0x98,0x88]);
    expect(r.s.mem.slice(D.wEnemyMons,D.wEnemyMons+4*44)).toEqual(party);
  });
  it('first-mon entry can select party slot0 when the prior enemy position is $FF',()=>{
    const r=enemyRig(); r.s.wEnemyMonPartyPos=0xff; r.s.writeBE(D.wEnemyMons+1,40);
    r.start(enemySendOutFirstMon(r.s,r.host)); r.finish(); expect(r.s.wEnemyMonPartyPos).toBe(0);
  });
  it('treats a high-byte-only HP as alive while scanning enemy slots',()=>{
    const r=enemyRig(); r.s.writeBE(D.wEnemyMons+44+1,0x100); r.s.mem[D.wEnemyMon1Level+44]=100;
    const species=r.s.species; r.s.species=id=>({...species(id),base:[200,200,200,200,200]});
    r.start(enemySendOutFirstMon(r.s,r.host)); r.finish();
    expect(r.s.wEnemyMonPartyPos).toBe(1); expect(r.s.wEnemyMonHP).toBe(0x100);
    expect(r.s.wCurEnemyLevel).toBe(100); expect(r.s.readBE(D.wLastSwitchInEnemyMonHP)).toBe(0x100);
  });
  it('holds the source16-frame slide and seven-frame front copy before the send cue',()=>{
    const r=enemyRig(); r.start(enemySendOutFirstMon(r.s,r.host)); r.finish();
    expect(r.events.find(e=>e.name==='text:PrintEmptyString.emptyString')!.at).toBe(16);
    const front=r.events.find(e=>e.name==='front')!,cue=r.events.find(e=>e.name==='sendCue')!;
    expect(cue.at-front.at).toBe(7); expect(cue.data).toEqual([1,15,6]);
    expect(r.s.mem[D.hStartTileID]).toBe(0xcf); expect(r.screen.frontSlot(48)).toEqual({picture:'front-84',tile:48});
    expect(r.events.find(e=>e.name==='cry')?.data).toEqual([0x54,0]);
    expect(r.s.wCurrentMenuItem).toBe(1); expect(r.screen.obp0).toBe(0xd0);
  });
  it('throws at FirstMon link selection after slide/empty/Save1, before loading an enemy',()=>{
    const r=enemyRig(); r.s.wLinkState=4; r.s.wWhichPokemon=5;
    const old=r.s.wEnemyMonPartyPos;
    r.start(enemySendOutFirstMon(r.s,r.host)); expect(()=>r.finish()).toThrow(BattleUnsupportedState);
    expect(r.time()).toBe(19); expect(r.s.wWhichPokemon).toBe(5); expect(r.s.wEnemyMonPartyPos).toBe(old);
    expect(r.events.filter(e=>e.name==='save1')).toHaveLength(1);
    expect(r.events.some(e=>e.name==='front'||e.name==='text:TrainerSentOutText')).toBe(false);
  });
});

describe('SHIFT prompt on the same party and battle owners',()=>{
  it.each([{first:1,count:3,options:0},{first:0,count:1,options:0},{first:0,count:3,options:0x40}])
  ('skips the prompt with gate $first/$count/$options',({first,count,options})=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=first; r.s.mem[D.wPartyCount]=count; r.s.mem[D.wOptions]=options;
    r.start(enemySendOut(r.s,r.host)); r.finish();
    expect(r.events.some(e=>e.name==='text:TrainerAboutToUseText')).toBe(false);
    expect(r.events.some(e=>e.name==='text:TrainerSentOutText')).toBe(true);
  });
  it.each([{keys:['b'] as GameButton[]},{keys:['a','b'] as GameButton[]}])('NO via raw $keys sends the enemy without opening a party list',({keys})=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0;
    r.host.readJoypad=()=>vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));
    const opened=vi.spyOn(r.party,'openBattleChoice');
    r.start(enemySendOut(r.s,r.host)); r.finish(); expect(opened).not.toHaveBeenCalled();
    expect(r.s.wCurrentMenuItem).toBe(1); expect(r.s.wPlayerMonNumber).toBe(0);
  });
  it('YES then B cancels with item1, restores through HUD-only2, and does not retreat the player',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0;
    const input:GameButton[][]=[['a'],['b']];
    r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    const open=vi.spyOn(r.party,'openBattleChoice');
    r.start(enemySendOut(r.s,r.host)); r.finish();
    expect(input).toEqual([]); expect(open).toHaveBeenCalledOnce(); expect(r.s.wCurrentMenuItem).toBe(1);
    expect(r.events.filter(e=>e.name==='load1')).toHaveLength(1);
    expect(r.screen.hudSlot(0x62)).toBeNull(); expect(r.screen.hudSlot(0x6d)).not.toBeNull();
    expect(r.events.some(e=>e.name==='text:PlayerMon2Text')).toBe(false);
  });
  it('retains the selected player slot after already-out retry then cancel, without reloading the enemy from it',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0;
    const input:GameButton[][]=[['a'],['a'],['b']];
    r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    r.start(enemySendOut(r.s,r.host)); r.finish();
    expect(input).toEqual([]); expect(r.s.wWhichPokemon).toBe(0); expect(r.s.wEnemyMonPartyPos).toBe(2);
    expect(r.s.wEnemyMonSpecies2).toBe(0x54); expect(r.s.wPlayerMonNumber).toBe(0); expect(r.s.wCurrentMenuItem).toBe(1);
    expect(r.events.find(e=>e.name==='front')?.data).toEqual([0x54,0]);
    expect(r.events.some(e=>e.name==='text:PlayerMon2Text')).toBe(false);
  });
  it('retries already-out and fainted slots before accepting; enemy arrives before player retreat and flags rebuild',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0;
    r.s.writeBE(D.wPartyMons+44+1,0); r.s.partyMons[1]!.currentHp=0;
    const input:GameButton[][]=[['a'],['a'],['down'],['a'],['down'],['a']];
    r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    const text=vi.spyOn(r.party,'printBattleChoiceText'),back=vi.spyOn(r.party,'goBackToChoice');
    r.start(enemySendOut(r.s,r.host)); r.finish();
    expect(input).toEqual([]); expect(back).toHaveBeenCalledTimes(2);
    expect(text).toHaveBeenCalledWith('AlreadyOutText',{battleMonNick:'OLD'}); expect(text).toHaveBeenCalledWith('NoWillText');
    expect(r.s.wPlayerMonNumber).toBe(2); expect(r.s.wEnemyMonPartyPos).toBe(2);
    expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([4,4]);
    const enemy=r.events.find(e=>e.name==='text:TrainerSentOutText')!,retreat=r.events.find(e=>e.name==='text:PlayerMon2Text')!;
    expect(enemy.at).toBeLessThan(retreat.at); expect(r.events.find(e=>e.name==='front')!.at).toBeLessThan(retreat.at);
    expect(r.s.wCurrentMenuItem).toBe(2);
  });
  it('a double-faint history may prompt again because only firstMons==1 suppresses SHIFT',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0; r.s.wBattleMonHP=0;
    r.host.readJoypad=()=>vi.mocked(isPassPressed).mockImplementation(key=>key==='b');
    r.start(enemySendOut(r.s,r.host)); r.finish();
    expect(r.events.filter(e=>e.name==='text:TrainerAboutToUseText')).toHaveLength(1);
  });
  it('firstMons=2 and unrelated options bits still allow SHIFT; the gate is equality and bit6',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=2; r.s.mem[D.wOptions]=0x80;
    r.host.readJoypad=()=>vi.mocked(isPassPressed).mockImplementation(key=>key==='b');
    r.start(enemySendOut(r.s,r.host)); r.finish();
    expect(r.events.filter(e=>e.name==='text:TrainerAboutToUseText')).toHaveLength(1);
  });
});

describe('checkpoint-06 item0 regressions',()=>{
  it('clears exactly the 4 by 11 enemy HUD before the sent-out text',()=>{
    const r=enemyRig(); const save=r.host.saveScreenTilesToBuffer1;
    r.host.saveScreenTilesToBuffer1=()=>{
      save(); for(let y=0;y<5;y++) for(let x=0;x<12;x++) r.screen.put(x,y,100+y*12+x);
    };
    const print=r.host.printText; let checked=false;
    r.host.printText=function* (label,bindings,options) {
      if(label==='TrainerSentOutText') {
        checked=true;
        for(let y=0;y<4;y++) for(let x=0;x<11;x++) expect(r.screen.at(x,y)).toBe(' ');
        for(let y=0;y<4;y++) expect(r.screen.at(11,y)).toBe(111+y*12);
        for(let x=0;x<12;x++) expect(r.screen.at(x,4)).toBe(148+x);
      }
      yield* print(label,bindings,options);
    };
    r.start(enemySendOutFirstMon(r.s,r.host)); r.finish(); expect(checked).toBe(true);
  });
  it('draws the SHIFT YES/NO border at (0,7) before the first menu read',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0; let checked=false;
    r.host.readJoypad=()=>{
      checked=true; expect(r.screen.at(0,7)).toBe('┌'); expect(r.screen.at(5,7)).toBe('┐');
      expect(r.screen.at(0,11)).toBe('└'); expect(r.screen.at(5,11)).toBe('┘');
      expect([2,3,4].map(x=>r.screen.at(x,8)).join('')).toBe('YES');
      expect([2,3].map(x=>r.screen.at(x,10)).join('')).toBe('NO');
      vi.mocked(isPassPressed).mockImplementation(key=>key==='b');
    };
    r.start(enemySendOut(r.s,r.host)); r.finish(); expect(checked).toBe(true);
  });
  it('whites all three palettes before the SHIFT HUD-only copy starts',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0;
    const input:GameButton[][]=[['a'],['b']];
    r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    r.start(enemySendOut(r.s,r.host)); let checked=false;
    r.finish(()=>{
      if(!textBgTransfer.enabled && input.length===0 && !r.events.some(e=>e.name==='front')) {
        checked=true; expect([r.screen.bgp,r.screen.obp0,r.screen.obp1]).toEqual([0,0,0]);
      }
      return [];
    });
    expect(checked).toBe(true); expect(input).toEqual([]);
  });
});

describe('ReplaceFaintedEnemyMon',()=>{
  it('keeps its action/AI bytes through an accepted SHIFT and clears them only on final return',()=>{
    const r=enemyRig(); r.s.wFirstMonsNotOutYet=0; r.s.wEnemyHPBarColor=0;
    r.s.wActionResultOrTookBattleTurn=1; r.s.wEnemyMoveNum=0x51; r.s.wAILayer2Encouragement=0x52;
    const input:GameButton[][]=[['a'],['down'],['a']];
    r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    const sending=r.host.sendingOutMon; let cues=0;
    r.host.sendingOutMon=(state,x,y)=>{
      cues++; expect([state.wActionResultOrTookBattleTurn,state.wEnemyMoveNum,state.wAILayer2Encouragement]).toEqual([1,0x51,0x52]);
      sending(state,x,y);
    };
    r.start(replaceFaintedEnemyMon(r.s,r.host)); r.finish();
    expect(input).toEqual([]); expect(cues).toBe(2); expect(r.s.wPlayerMonNumber).toBe(1);
    expect([r.s.wActionResultOrTookBattleTurn,r.s.wEnemyMoveNum,r.s.wAILayer2Encouragement]).toEqual([0,0,0]);
    expect(r.driver.result).toEqual({zero:false});
  });
  it('sets full-green colour and both OBJ registers, copies balls, then resets only its three AI/action bytes',()=>{
    const r=enemyRig(); r.s.wEnemyHPBarColor=2;
    r.s.wEnemyMoveNum=0x51; r.s.wActionResultOrTookBattleTurn=0x52; r.s.wAILayer2Encouragement=0x53;
    r.s.wEnemySelectedMove=0x79;
    r.start(replaceFaintedEnemyMon(r.s,r.host));
    expect(r.s.wEnemyHPBarColor).toBe(0); // palette changes before the ball-copy frame
    r.finish(); expect(r.driver.result).toEqual({zero:false});
    expect([r.s.wEnemyMoveNum,r.s.wActionResultOrTookBattleTurn,r.s.wAILayer2Encouragement]).toEqual([0,0,0]);
    expect(r.s.wEnemySelectedMove).toBe(0x79); expect(r.screen.obp1).toBe(0xe4); expect(r.screen.obp0).toBe(0xd0);
    expect(r.frames.filter(frame=>frame==='held')).toHaveLength(4);
  });
  it('link rejection occurs after one real ball-copy frame and before EnemySendOut resets participation',()=>{
    const r=enemyRig(); r.s.wLinkState=4; r.s.wEnemyHPBarColor=0;
    r.s.mem[D.wPartyGainExpFlags]=0x81; r.s.mem[D.wPartyFoughtCurrentEnemyFlags]=0x42;
    r.s.wActionResultOrTookBattleTurn=0x77;
    r.start(replaceFaintedEnemyMon(r.s,r.host)); expect(r.screen.obp0).toBe(0xe4); expect(r.screen.obp1).toBe(0xe4);
    expect(()=>r.finish()).toThrow(BattleUnsupportedState);
    expect(r.time()).toBe(1); expect(r.s.wActionResultOrTookBattleTurn).toBe(0x77);
    expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([0x81,0x42]);
    expect(r.host.renderTiles.sprites).not.toBe(r.atlas); expect(r.events).toEqual([]);
  });
});

describe('checkpoint-06b item0 regressions',()=>{
  it('composed level-up draws its stats box at (9,2) before scroll input',()=>{
    const r=expRig(); r.s.wEnemyMonLevel=100; let checked=false;
    r.host.readScrollJoypad=()=>{
      checked=true; expect(r.screen.at(9,2)).toBe('┌'); expect(r.screen.at(19,11)).toBe('┘');
      expect([0,1,2,3,4,5].map(i=>r.screen.at(11+i,3)).join('')).toBe('ATTACK'); return 1;
    };
    r.start(gainExperience(r.s,r.host)); r.finish(); expect(checked).toBe(true);
  });
  it('LEVELUP leaves a starter mood at $8A when no Thunder move overwrites it',()=>{
    const r=expRig(); r.s.wEnemyMonLevel=100; r.s.mem[D.wPikachuMood]=0x60;
    r.s.mem[D.wPikachuHappiness]=90;
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(r.s.mem[D.wPikachuHappiness]).toBe(95); expect(r.s.mem[D.wPikachuMood]).toBe(0x8a);
    expect(r.events.some(e=>e.name==='learn')).toBe(false);
  });
  it('resets the second blink counter to6 when the arrow reappears',()=>{
    const r=expRig(); r.screen.put(18,16,'▼'); let reads=0;
    r.host.readScrollJoypad=()=>++reads===3067?1:0;
    r.start(waitForTextScrollButtonPress(r.s,r.host));
    for(let i=0;i<3065;i++) r.step();
    expect(reads).toBe(3066); expect(r.screen.at(18,16)).toBe('▼');
    expect(r.s.mem[D.hDownArrowBlinkCount2]).toBe(6);
    r.step(); expect(r.driver.done).toBe(true);
  });
});

function expRig() {
  const r=rig(),s=r.s,base=s.species;
  s.species=id=>({...base(id),growthRate:0,learnset:[]});
  for(let slot=0;slot<3;slot++) {
    const at=D.wPartyMons+44*slot;
    s.mem[at+3]=3; s.mem[at+33]=10; s.mem[at+14]=0; s.writeBE(at+15,1000);
    s.mem.fill(0,at+17,at+27); s.writeBE(at+1,20); s.writeBE(at+34,40);
  }
  s.wWhichPokemon=s.wPlayerMonNumber=0; loadBattleMonFromParty(s);
  s.mem[D.wPartyGainExpFlags]=1; s.mem[D.wPartyFoughtCurrentEnemyFlags]=0xff;
  s.setBytes(D.wEnemyMonBaseStats,[10,20,30,40,50,60,70],7); s.wEnemyMonLevel=7; s.wCurEnemyLevel=45;
  s.writeBE(D.wPlayerID,0x1234); s.wBoostExpByExpAll=0; s.mem[D.wCanEvolveFlags]=0;
  const host:ExperienceHost={screen:r.screen,tiles:r.video.tiles,printText:r.host.printText,
    saveScreenTilesToBuffer1:r.host.saveScreenTilesToBuffer1,loadScreenTilesFromBuffer1:r.host.loadScreenTilesFromBuffer1,
    readScrollJoypad(){r.mark('scrollRead');return (isPassPressed('a')?1:0)|(isPassPressed('b')?2:0);},
    cableClubRun(){r.mark('cable');},
    learnMove:function* (state){r.mark('learn',[state.wWhichPokemon,state.wCurEnemyLevel,state.mem[D.wMoveNum]]);return {b:0};}};
  vi.mocked(playSFX).mockImplementation(async name=>{
    const resolved=r.bridge.resolveTextSound(name); r.mark('textSound',resolved);
    r.bridge.play({id:name==='get_item1'?0x86:0x90,data:sfxData(resolved)});
  });
  function finish(keysForFrame:(frame:number)=>GameButton[]=frame=>frame%2?['a']:[]) { return r.finish(keysForFrame); }
  return {...r,host,playerHost:r.host,finish};
}
const partyExp=(s:BattleState,slot:number)=>s.mem[D.wPartyMons+44*slot+14]*65536+s.readBE(D.wPartyMons+44*slot+15);

describe('checkpoint-06 EXP arithmetic and eligibility',()=>{
  it.each([0,1,2,3,0x80,0xff])('divides seven bytes in place by all flag bits (%i), touching TempByteValue only for >=2',flags=>{
    const r=expRig(); r.s.mem[D.wPartyGainExpFlags]=flags; r.s.mem[D.wTempByteValue]=0xa5;
    const values=[255,201,150,99,53,17,7]; r.s.setBytes(D.wEnemyMonBaseStats,values,7);
    r.s.mem[D.wEnemyMonBaseStats-1]=0x79; r.s.mem[D.wEnemyMonBaseExp+1]=0x81;
    divideExpDataByNumMonsGainingExp(r.s);
    const count=flags.toString(2).replace(/0/g,'').length;
    expect([...r.s.mem.slice(D.wEnemyMonBaseStats,D.wEnemyMonBaseStats+7)]).toEqual(values.map(n=>count<2?n:Math.floor(n/count)));
    expect(r.s.mem[D.wTempByteValue]).toBe(count<2?0xa5:count);
    expect([r.s.mem[D.wEnemyMonBaseStats-1],r.s.mem[D.wEnemyMonBaseExp+1]]).toEqual([0x79,0x81]);
  });
  it.each([0,1,3,255,256,0x8001,0xffff])('BoostExp floors half and wraps only the low quotient word (%i)',value=>{
    const r=expRig(); r.s.setBytes(D.hQuotient,[0x79,0x81,value>>>8,value&255],4);
    boostExp(r.s); expect(r.s.readBE(D.hQuotient+2)).toBe((value+Math.floor(value/2))&65535);
    expect([...r.s.mem.slice(D.hQuotient,D.hQuotient+2)]).toEqual([0x79,0x81]);
  });
  it('link returns before division, selection, flags, text or frames',()=>{
    const r=expRig(); r.s.wLinkState=4; r.s.wWhichPokemon=5; const before=r.s.mem.slice();
    r.start(gainExperience(r.s,r.host)); expect(r.driver.done).toBe(true); expect(r.s.mem).toEqual(before);
    expect(r.events).toEqual([]); expect(r.frames).toEqual([]);
  });
  it('skips fainted and unflagged slots but counts fainted flags when dividing, then rebuilds both flag bytes',()=>{
    const r=expRig(); r.s.mem[D.wPartyGainExpFlags]=3; r.s.writeBE(D.wPartyMons+1,0); r.s.wPlayerMonNumber=2;
    const first=r.s.mem.slice(D.wPartyMons,D.wPartyMons+44),third=r.s.mem.slice(D.wPartyMons+88,D.wPartyMons+132);
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(partyExp(r.s,1)).toBe(1035); expect(r.s.mem.slice(D.wPartyMons,D.wPartyMons+44)).toEqual(first);
    expect(r.s.mem.slice(D.wPartyMons+88,D.wPartyMons+132)).toEqual(third);
    expect(r.events.filter(e=>e.name==='text:GainedText').map(e=>e.data)).toEqual([{nameBuffer:'NEW',expAmountGained:35}]);
    expect(r.s.wWhichPokemon).toBe(2); expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([4,4]);
  });
  it('accepts HP with only its high byte set and saturates each independent stat-exp word',()=>{
    const r=expRig(); r.s.writeBE(D.wPartyMons+1,256);
    const old=[65535,65530,65505,65500,255]; old.forEach((v,i)=>r.s.writeBE(D.wPartyMons+17+2*i,v));
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect([0,1,2,3,4].map(i=>r.s.readBE(D.wPartyMons+17+2*i))).toEqual([65535,65535,65535,65535,305]);
    expect(r.s.partyMons[0]!.statExp).toEqual([65535,65535,65535,65535,305]); expect(partyExp(r.s,0)).toBe(1070);
  });
  it('with no gain flags preserves every party byte and emits no text, then restores active participation',()=>{
    const r=expRig(); r.s.mem[D.wPartyGainExpFlags]=0; r.s.wPlayerMonNumber=1;
    const before=r.s.mem.slice(D.wPartyMons,D.wPartyMonOT);
    r.start(gainExperience(r.s,r.host)); expect(r.driver.done).toBe(true);
    expect(r.s.mem.slice(D.wPartyMons,D.wPartyMonOT)).toEqual(before); expect(r.events).toEqual([]);
    expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([2,2]);
  });
  it('trade boost depends on both OT-ID bytes and ignores OT-name differences',()=>{
    const r=expRig(); r.s.setBytes(D.wPartyMonOT,encodeText('OTHER@'),11); r.s.wEnemyMonBaseExp=5;
    r.start(gainExperience(r.s,r.host)); r.finish(); expect(partyExp(r.s,0)).toBe(1005);
    r.s.writeBE(D.wPartyMons+12,0x1334); r.start(gainExperience(r.s,r.host)); r.finish();
    expect(partyExp(r.s,0)).toBe(1012); expect(r.s.wGainBoostedExp).toBe(1);
  });
  it.each([{traded:false,trainer:false,gained:5},{traded:true,trainer:false,gained:7},
    {traded:false,trainer:true,gained:7},{traded:true,trainer:true,gained:10}])
  ('applies sequential integer boosts $traded/$trainer with printed gain $gained',({traded,trainer,gained})=>{
    const r=expRig(); r.s.wEnemyMonBaseExp=5; r.s.wIsInBattle=trainer?2:1;
    if(traded) r.s.writeBE(D.wPartyMons+12,0x1235);
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(partyExp(r.s,0)).toBe(1000+gained); expect(r.s.wGainBoostedExp).toBe(traded?1:0);
    expect(r.events.find(e=>e.name==='text:GainedText')?.data).toEqual({nameBuffer:'OLD',expAmountGained:gained});
    const lines=r.events.find(e=>e.name==='textEnd:GainedText')!.data as string[];
    expect(lines.join(' ')).toContain(traded?'boosted':'EXP. Points!');
  });
  it('EXP.ALL continuation wins over traded text and both divide passes mutate the already divided bytes',()=>{
    const r=expRig(); r.s.mem[D.wPartyGainExpFlags]=3; r.s.wBoostExpByExpAll=1;
    r.s.writeBE(D.wPlayerID,0xabcd); r.start(gainExperience(r.s,r.host)); r.finish();
    const first=(r.events.find(e=>e.name==='textEnd:GainedText')!.data as string[]).join(' ');
    expect(first).toContain('EXP.ALL'); expect(first).not.toContain('boosted');
    expect([...r.s.mem.slice(D.wEnemyMonBaseStats,D.wEnemyMonBaseStats+7)]).toEqual([5,10,15,20,25,30,35]);
    r.s.mem[D.wPartyGainExpFlags]=7; r.start(gainExperience(r.s,r.host)); r.finish();
    expect([...r.s.mem.slice(D.wEnemyMonBaseStats,D.wEnemyMonBaseStats+7)]).toEqual([1,3,5,6,8,10,11]);
  });
  it('carries EXP through all three bytes before the level100 cap',()=>{
    const r=expRig(); r.s.mem[D.wPartyCount]=1; r.s.mem[D.wPartyMons+14]=0; r.s.writeBE(D.wPartyMons+15,0xfffe);
    r.s.mem[D.wPartyMons+33]=40; r.s.wEnemyMonBaseExp=5;
    r.start(gainExperience(r.s,r.host)); r.finish(); expect(partyExp(r.s,0)).toBe(0x10003);
  });
  it.each([0,1,2,3,4,5])('loads growth byte %i and caps EXP at the matching level100 polynomial',rate=>{
    const r=expRig(),species=r.s.species; r.s.species=id=>({...species(id),growthRate:rate});
    r.s.wMonHGrowthRate=0xa5; getMonHeader(r.s,0x54); expect(r.s.wMonHGrowthRate).toBe(rate);
    r.s.mem[D.wPartyMons+14]=0x20; r.s.mem[D.wPartyMons+33]=100;
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(partyExp(r.s,0)).toBe([1000000,849970,949930,1059860,800000,1250000][rate]);
    expect(r.events.some(e=>e.name==='text:GrewLevelText')).toBe(false);
  });
  it('rejects a missing growth rate instead of using a stale header byte',()=>{
    const r=expRig(),species=r.s.species;
    r.s.species=id=>({...species(id),growthRate:undefined}); r.s.wMonHGrowthRate=0;
    expect(()=>r.start(gainExperience(r.s,r.host))).toThrow('missing growth rate');
  });
});

describe('checkpoint-06 level-up composition',()=>{
  it('loads exactly44 raw bytes and the selected list species/header without changing the party',()=>{
    const r=expRig(); r.s.wWhichPokemon=1; r.s.wMonDataLocation=0;
    r.s.mem.fill(0x79,D.wLoadedMon-1,D.wLoadedMon+45);
    const before=r.s.mem.slice(D.wPartyMons+44,D.wPartyMons+88);
    loadExperienceMonData(r.s);
    expect(r.s.mem.slice(D.wLoadedMon,D.wLoadedMon+44)).toEqual(before);
    expect([r.s.mem[D.wLoadedMon-1],r.s.mem[D.wLoadedMon+44]]).toEqual([0x79,0x79]);
    expect(r.s.wCurSpecies).toBe(0x24); expect(r.s.wCurPartySpecies).toBe(0x24);
    expect(r.s.mem.slice(D.wPartyMons+44,D.wPartyMons+88)).toEqual(before);
  });
  it('unchanged level updates EXP/stat-exp only, without any level-up text, stats wait or evolution bit',()=>{
    const r=expRig(); const battle=r.s.mem.slice(D.wBattleMon,D.wBattleMon+44);
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name)).toEqual(['text:GainedText']);
    expect(r.events.some(e=>e.name==='scrollRead'||e.name==='save1'||e.name==='learn')).toBe(false);
    expect(r.s.mem[D.wCanEvolveFlags]).toBe(0); expect(r.s.mem.slice(D.wBattleMon,D.wBattleMon+44)).toEqual(battle);
  });
  it('levels a reserve once at the final level, preserves box level/active data and restores curEnemyLevel',()=>{
    const r=expRig(); r.s.mem[D.wPartyGainExpFlags]=2; r.s.wEnemyMonLevel=100;
    const species=r.s.species; r.s.species=id=>({...species(id),learnset:[{level:11,move:45},{level:22,move:85}]});
    const battle=r.s.mem.slice(D.wBattleMon,D.wBattleMon+44),unmodified=r.s.mem.slice(D.wPlayerMonUnmodifiedLevel,D.wPlayerMonUnmodifiedLevel+11);
    r.start(gainExperience(r.s,r.host)); r.finish();
    const at=D.wPartyMons+44; expect(partyExp(r.s,1)).toBe(2000); expect(r.s.mem[at+33]).toBe(12);
    expect(r.s.mem[at+3]).toBe(3); expect(r.s.wCurEnemyLevel).toBe(45);
    expect(r.s.readBE(at+1)-20).toBe(r.s.readBE(at+34)-40);
    expect(r.s.mem.slice(D.wBattleMon,D.wBattleMon+44)).toEqual(battle);
    expect(r.s.mem.slice(D.wPlayerMonUnmodifiedLevel,D.wPlayerMonUnmodifiedLevel+11)).toEqual(unmodified);
    expect(r.events.filter(e=>e.name==='text:GrewLevelText').map(e=>e.data)).toEqual([{nameBuffer:'NEW',curEnemyLevel:12}]);
    expect(r.events.some(e=>e.name==='learn'||e.name==='save1'||e.name==='text:PrintEmptyString.emptyString')).toBe(false);
    expect(r.events.filter(e=>e.name==='load1')).toHaveLength(1); expect(r.s.mem[D.wCanEvolveFlags]).toBe(2);
    expect(r.s.partyMons[1]!.level).toBe(12); expect(r.s.partyMons[1]!.exp).toBe(2000);
  });
  it.each([false,true])('active level-up recalculates modifications, penalties and badges; transformed=$0',transformed=>{
    const r=expRig(); r.s.mem[D.wPartyMons+33]=9; // legal EXP is now at10: one final-level block
    r.s.wBattleMonStatus=0x50; r.s.wObtainedBadges=0x11; r.s.mem[D.wPlayerMonStatMods]=8;
    r.s.wPlayerBattleStatus3=transformed?8:0;
    const original=r.s.mem.slice(D.wPlayerMonUnmodifiedLevel,D.wPlayerMonUnmodifiedLevel+11);
    const at=D.wPartyMons;
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(r.s.wBattleMonHP).toBe(r.s.readBE(at+1)); expect(r.s.wBattleMonMaxHP).toBe(r.s.readBE(at+34));
    const originals=transformed?original:r.s.mem.slice(at+33,at+44);
    expect(r.s.mem.slice(D.wPlayerMonUnmodifiedLevel,D.wPlayerMonUnmodifiedLevel+11)).toEqual(originals);
    const atk=Math.floor(Math.floor((originals[3]*256+originals[4])*1.5)/2);
    const speed=Math.floor((originals[7]*256+originals[8])/4);
    expect(r.s.wBattleMonAttack).toBe(atk+Math.floor(atk/8)); expect(r.s.wBattleMonSpeed).toBe(speed+Math.floor(speed/8));
    expect(r.s.hWhoseTurn).toBe(1); expect(r.s.mem[D.wCanEvolveFlags]).toBe(1);
    expect(r.events.filter(e=>e.name==='text:PrintEmptyString.emptyString')).toHaveLength(1);
    expect(r.events.filter(e=>e.name==='save1')).toHaveLength(1);
    const save=r.events.find(e=>e.name==='save1')!,grew=r.events.find(e=>e.name==='text:GrewLevelText')!;
    expect(save.at).toBeLessThanOrEqual(grew.at);
  });
  it('LEVELUP happiness occurs once for a starter jumping multiple levels, then the accepted Thunder move mood wins',()=>{
    const r=expRig(); r.s.wEnemyMonLevel=100; r.s.mem[D.wPikachuHappiness]=90;
    const species=r.s.species; r.s.species=id=>({...species(id),learnset:[{level:11,move:45},{level:12,move:85}]});
    r.host.learnMove=function* (state){r.mark('learn',[state.wCurEnemyLevel,state.mem[D.wMoveNum]]);return {b:1};};
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(r.s.mem[D.wPikachuHappiness]).toBe(95); expect(r.events.filter(e=>e.name==='learn').map(e=>e.data)).toEqual([[12,85]]);
    expect([r.s.mem[D.wPikachuMood],r.s.mem[D.wPikachuEmotionModifier]]).toEqual([0x85,5]);
  });
  it('independently calculates all five party stats and applies the max-HP difference with a 16-bit wrap',()=>{
    const r=expRig(); r.s.mem[D.wPartyMons+33]=9;
    r.s.setBytes(D.wPartyMons+27,[0x98,0x88],2); r.s.writeBE(D.wPartyMons+1,1); r.s.writeBE(D.wPartyMons+34,500);
    r.start(gainExperience(r.s,r.host)); r.finish();
    // Base stats 40/45/40/56/35, IVs8/9/8/8/8; ceil-sqrt(stat exp)>>2.
    expect([0,1,2,3,4].map(i=>r.s.readBE(D.wPartyMons+34+2*i))).toEqual([29,15,14,17,13]);
    expect(r.s.readBE(D.wPartyMons+1)).toBe((1+29-500)&65535); expect(r.s.wBattleMonHP).toBe((1+29-500)&65535);
    expect(r.s.mem[D.wPartyMons+3]).toBe(3); expect(r.s.wCurEnemyLevel).toBe(45);
  });
  it('level-up passes b=1 to CalcStats and includes the capped stat-exp root in all five stats',()=>{
    const r=expRig(); r.s.wEnemyMonLevel=100; r.s.setBytes(D.wPartyMons+27,[0x98,0x88],2);
    for(let i=0;i<5;i++) r.s.writeBE(D.wPartyMons+17+2*i,65535);
    r.start(gainExperience(r.s,r.host)); r.finish();
    // Final level12, IVs8/9/8/8/8, root255>>2=63 in each stat.
    expect([0,1,2,3,4].map(i=>r.s.readBE(D.wPartyMons+34+2*i))).toEqual([41,25,24,27,22]);
    expect(r.s.wBattleMonHP).toBe(21); expect(r.s.wBattleMonLevel).toBe(12);
  });
  it('GrewLevelText uses the retained bank08 level-up sound and finishes it before the stats wait',()=>{
    const r=expRig(); r.s.mem[D.wPartyMons+33]=9; let reads=0;
    r.host.readScrollJoypad=()=>{reads++; expect(soundFinished(r.audio.sfx,r.audio.music,0)).toBe(true); return 1;};
    r.start(gainExperience(r.s,r.host)); r.finish();
    expect(reads).toBe(1); expect(r.events.filter(e=>e.name==='textSound').map(e=>e.data)).toContain('level_up');
    const grew=r.events.find(e=>e.name==='textEnd:GrewLevelText')!.data as string[];
    expect(grew.join(' ')).toContain('OLD grew'); expect(grew.join(' ')).toContain('10!');
  });
});

describe('checkpoint-06 stats box and scroll wait',()=>{
  it.each([0,1])('PrintStatsBox kind%i writes its source border, labels and two-byte right-aligned stats without frames',kind=>{
    const r=expRig(); [7,123,256,999].forEach((v,i)=>r.s.writeBE(D.wLoadedMonAttack+2*i,v));
    printStatsBox(r.s,r.host.tiles,kind);
    const x=kind?9:0,y=kind?2:8,w=kind?9:8;
    expect(r.screen.at(x,y)).toBe('┌'); expect(r.screen.at(x+w+1,y+9)).toBe('┘');
    expect([0,1,2,3,4,5].map(i=>r.screen.at(x+(kind?2:1)+i,y+1)).join('')).toBe('ATTACK');
    expect([0,1,2,3].map(i=>[0,1,2].map(j=>r.screen.at((kind?15:6)+j,y+2+2*i)).join(''))).toEqual(['  7','123','256','999']);
    expect(r.frames).toEqual([]);
  });
  it('scroll wait preserves blink bytes, ignores directions, accepts raw A+B, and plays no press sound',()=>{
    const r=expRig(); r.s.mem[D.hDownArrowBlinkCount1]=0x79; r.s.mem[D.hDownArrowBlinkCount2]=0x81;
    r.screen.put(18,16,'▼'); const inputs=[0x10,0,3]; let read=0;
    r.host.readScrollJoypad=()=>{read++; return inputs.shift()!;};
    r.start(waitForTextScrollButtonPress(r.s,r.host));
    expect([r.s.mem[D.hDownArrowBlinkCount1],r.s.mem[D.hDownArrowBlinkCount2]]).toEqual([255,6]);
    r.finish(); expect(read).toBe(3); expect(r.frames).toEqual(['serviced','serviced']);
    expect([r.s.mem[D.hDownArrowBlinkCount1],r.s.mem[D.hDownArrowBlinkCount2],r.s.mem[D.hJoy5]]).toEqual([0x79,0x81,3]);
    expect(playSFX).not.toHaveBeenCalled(); expect(r.events.filter(e=>e.name==='cable')).toHaveLength(3);
  });
  it('blank arrow with count1=0 stays blank and B alone exits on its first read',()=>{
    const r=expRig(); r.screen.put(18,16,' '); r.host.readScrollJoypad=()=>2;
    r.start(waitForTextScrollButtonPress(r.s,r.host)); r.finish();
    expect(r.frames).toEqual([]); expect(r.screen.at(18,16)).toBe(' ');
  });
  it('arrow countdown wraps through $FF and toggles only after its six byte cycles',()=>{
    const r=expRig(); r.screen.put(18,16,'▼'); let read=0;
    r.host.readScrollJoypad=()=>++read===1536?1:0;
    r.start(waitForTextScrollButtonPress(r.s,r.host));
    for(let i=0;i<1535;i++) {expect(r.screen.at(18,16)).toBe('▼');r.step();}
    expect(r.screen.at(18,16)).toBe(' '); expect(r.driver.done).toBe(true);
  });
  it('runs the flagged town-map and cable-club owners in order around each input read',()=>{
    const r=expRig(); r.s.mem[D.wTownMapSpriteBlinkingEnabled]=1; const calls:string[]=[];
    r.host.townMapSpriteBlinking=()=>{calls.push('town');};
    r.host.readScrollJoypad=()=>{calls.push('read');return 1;}; r.host.cableClubRun=()=>{calls.push('cable');};
    r.start(waitForTextScrollButtonPress(r.s,r.host)); r.finish(); expect(calls).toEqual(['town','read','cable']);
  });
});

describe('checkpoint-06 first level-up move and deferred LearnMove seam',()=>{
  it.each([0,1,2,3])('a first matching move already in move slot%i ends the whole same-level scan',slot=>{
    const r=expRig(),species=r.s.species; r.s.species=id=>({...species(id),learnset:[{level:12,move:85},{level:12,move:87}]});
    r.s.mem.fill(0,D.wPartyMons+8,D.wPartyMons+12); r.s.mem[D.wPartyMons+8+slot]=85;
    r.s.wCurEnemyLevel=12; r.s.wPokedexNum=0x54; r.s.wMonDataLocation=0;
    r.start(learnMoveFromLevelUp(r.s,r.host)); r.finish(); expect(r.events).toEqual([]);
    expect(r.s.wPokedexNum).toBe(0x54);
  });
  it.each([{known:true,level:12,entries:[{level:12,move:33},{level:12,move:85}],expected:0},
    {known:false,level:12,entries:[{level:11,move:45},{level:12,move:85},{level:12,move:87}],expected:85},
    {known:false,level:13,entries:[{level:12,move:85},{level:14,move:87}],expected:0}])
  ('considers only the first exact-level entry ($known/$level)',({known,level,entries,expected})=>{
    const r=expRig(),species=r.s.species; r.s.species=id=>({...species(id),learnset:entries});
    r.s.wCurEnemyLevel=level; r.s.wPokedexNum=0x54; r.s.wMonDataLocation=0;
    if(known) r.s.mem[D.wPartyMons+8]=33;
    const learn=r.host.learnMove;
    r.host.learnMove=function* (state){expect(state.wNamedObjectIndex).toBe(expected);return yield* learn(state);};
    r.start(learnMoveFromLevelUp(r.s,r.host)); r.finish();
    expect(r.events.filter(e=>e.name==='learn').map(e=>(e.data as number[])[2])).toEqual(expected?[expected]:[]);
    if(expected) expect(moveNameBinding(r.s)).toBe('THUNDERBOLT');
    expect(r.s.wPokedexNum).toBe(0x54);
  });
  it.each([{move:85,b:1,starter:true,mood:0x85},{move:87,b:1,starter:true,mood:0x85},
    {move:85,b:0,starter:true,mood:0x60},{move:85,b:1,starter:false,mood:0x60},{move:45,b:1,starter:true,mood:0x60}])
  ('applies Thunder mood only for successful starter learning ($move/$b/$starter)',({move,b,starter,mood})=>{
    const r=expRig(),species=r.s.species; r.s.species=id=>({...species(id),learnset:[{level:12,move}]});
    r.s.mem.fill(0,D.wPartyMons+8,D.wPartyMons+12); r.s.wPokedexNum=0x54; r.s.wCurEnemyLevel=12;
    r.s.wMonDataLocation=0; r.s.mem[D.wPikachuMood]=0x60; if(!starter)r.s.mem[D.wPartyMonOT+4]^=1;
    const before=r.s.mem.slice(D.wPartyMons,D.wPartyMons+44);
    r.host.learnMove=function* () {yield 'serviced';return {b};};
    r.start(learnMoveFromLevelUp(r.s,r.host)); r.finish();
    expect(r.s.mem[D.wPikachuMood]).toBe(mood); expect(r.s.mem[D.wPikachuEmotionModifier]).toBe(mood===0x85?5:0);
    expect(r.s.mem.slice(D.wPartyMons,D.wPartyMons+44)).toEqual(before); // shared LearnMove writes belong to06b
    expect(r.s.wPokedexNum).toBe(0x54);
  });
});

describe('checkpoint-07 item0 regression',()=>{
  it('redraws the forget cursor one row down at (5,9) after one Down press',()=>{
    const r=learnRig();let read=0;
    r.host.readJoypad=()=>{
      read++;
      if(read===3){expect(r.screen.at(5,9)).toBe('▶');expect(r.screen.at(5,10)).not.toBe('▶');expect(r.screen.at(5,8)).not.toBe('▶');}
      const key=read===2?'down':'a';vi.mocked(isPassPressed).mockImplementation(button=>button===key);
    };
    r.start(learnMove(r.s,r.host));r.finish();expect(read).toBe(3);expect(r.s.mem[r.at+9]).toBe(85);
  });
});

function learnRig(moves=[33,45,39,98],mode=1,which=0,move=85) {
  const r=expRig(),at=D.wPartyMons+44*which;
  r.s.wWhichPokemon=which; r.s.wIsInBattle=mode; r.bridge.audioBank=r.bridge.savedAudioBank=mode?8:2;
  r.s.setBytes(at+8,moves,4); r.s.setBytes(at+29,[0xc1,0x82,0x43,4],4);
  r.s.mem[D.wMoveNum]=r.s.wNamedObjectIndex=move; getMoveName(r.s); copyMoveNameToStringBuffer(r.s);
  const host:LearnMoveHost & ExperienceHost={...r.host,readJoypad:r.playerHost.readJoypad,pressSound:r.playerHost.pressSound,
    updateSprites:r.playerHost.updateSprites,audio:r.bridge,swapSound:{id:0xae,data:sfxData('swap')}};
  let input:GameButton[][]=[];
  host.readJoypad=()=>{const keys=input.shift()??[];r.mark('learnRead',keys);vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
  function keys(values:GameButton[][]){input=values;}
  const original=r.bridge.playSwap.bind(r.bridge);
  vi.spyOn(r.bridge,'playSwap').mockImplementation(function* (sound){
    r.mark('swapStart',[r.bridge.audioBank,r.bridge.savedAudioBank]);
    const result=yield* original(sound);
    r.mark('swapEnd',[r.bridge.audioBank,r.bridge.savedAudioBank]); return result;
  });
  return {...r,host,at,keys,remaining:()=>input};
}

describe('checkpoint-06b shared LearnMove',()=>{
  it.each([0,1,2,3])('uses the first empty slot%i without asking, resets its PP Ups and copies the exact six-byte record',slot=>{
    const r=learnRig([33,45,39,98].map((id,i)=>i===slot?0:id));
    r.s.mem[D.wBuffer+6]=0xa5; const before=r.s.mem.slice(r.at,r.at+44);
    r.start(learnMove(r.s,r.host)); r.finish(); expect(r.driver.result).toEqual({b:1});
    expect(r.s.mem[r.at+8+slot]).toBe(85); expect(r.s.mem[r.at+29+slot]).toBe(15);
    const expected=before.slice();expected[8+slot]=85;expected[29+slot]=15;
    expect(r.s.mem.slice(r.at,r.at+44)).toEqual(expected);
    expect([...r.s.mem.slice(D.wBuffer,D.wBuffer+7)]).toEqual([85,6,95,23,255,15,0xa5]);
    expect(r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name)).toEqual(['text:LearnedMove1Text']);
    expect(r.events.filter(e=>e.name==='save1')).toHaveLength(1); expect(r.remaining()).toEqual([]);
    expect(r.s.partyMons[0]!.moves[slot]).toEqual({id:'THUNDERBOLT',pp:15,maxPp:15});
    expect(r.events.some(e=>e.name==='swapStart')).toBe(false);
  });
  it.each([{mode:0,which:0},{mode:1,which:1},{mode:2,which:0}])
  ('field/reserve/active copies are gated by mode $mode and which $which',({mode,which})=>{
    const r=learnRig([33,0,39,98],mode,which); r.s.wPlayerBattleStatus3=8;
    r.s.setBytes(D.wBattleMonMoves,[1,2,3,4],4); r.s.setBytes(D.wBattleMonPP,[5,6,7,8],4);
    r.start(learnMove(r.s,r.host)); r.finish();
    expect([...r.s.mem.slice(D.wBattleMonMoves,D.wBattleMonMoves+4)]).toEqual(mode&&which===0?[33,85,39,98]:[1,2,3,4]);
    expect([...r.s.mem.slice(D.wBattleMonPP,D.wBattleMonPP+4)]).toEqual(mode&&which===0?[0xc1,15,0x43,4]:[5,6,7,8]);
    expect(r.events.filter(e=>e.name==='textSound').map(e=>e.data)).toContain(mode?'level_up':'get_item1');
  });
  it.each([0,1,2,3])('accepts replacement slot%i with old-name text and one retained swap/Poof continuation',slot=>{
    const r=learnRig(); r.keys([['a'],...Array.from({length:slot},()=>['down'] as GameButton[]),['a']]);
    r.start(learnMove(r.s,r.host)); r.finish();
    expect(r.driver.result).toEqual({b:1}); expect(r.remaining()).toEqual([]);
    expect(r.s.mem[r.at+8+slot]).toBe(85); expect(r.s.mem[r.at+29+slot]).toBe(15);
    const prints=r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name);
    expect(prints).toEqual(['text:TryingToLearnText','text:WhichMoveToForgetText','text:OneTwoAndText','text:LearnedMove1Text']);
    const old=['TACKLE','GROWL','TAIL WHIP','QUICK ATTACK'][slot];
    expect((r.events.find(e=>e.name==='text:OneTwoAndText')!.data as {nameBuffer:string}).nameBuffer).toBe(old);
    expect((r.events.find(e=>e.name==='text:LearnedMove1Text')!.data as {stringBuffer:string}).stringBuffer).toBe('THUNDERBOLT');
    expect(r.events.filter(e=>e.name==='swapStart')).toHaveLength(1); expect(r.events.filter(e=>e.name==='load1')).toHaveLength(1);
    expect(r.bridge.audioBank).toBe(8); expect(r.bridge.savedAudioBank).toBe(8); expect(r.bridge.muteAudioAndPauseMusic).toBe(0);
    expect(r.s.mem[D.hUILayoutFlags]&6).toBe(0); expect(r.s.wCurrentMenuItem).toBe(slot);
  });
  it.each([{keys:['b'] as GameButton[]},{keys:['a','b'] as GameButton[]}])
  ('TryingToLearn NO via raw $keys can abandon without move/PP writes',({keys})=>{
    const r=learnRig(); r.keys([keys,['a']]); const before=r.s.mem.slice(r.at,r.at+44);
    r.start(learnMove(r.s,r.host)); r.finish();
    expect(r.driver.result).toEqual({b:0}); expect(r.remaining()).toEqual([]); expect(r.s.mem.slice(r.at,r.at+44)).toEqual(before);
    expect(r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name)).toEqual(['text:TryingToLearnText','text:AbandonLearningText','text:DidNotLearnText']);
    expect(r.events.some(e=>e.name==='swapStart'||e.name==='load1')).toBe(false);
  });
  it.each([{keys:['b'] as GameButton[]},{keys:['a','b'] as GameButton[]}])
  ('forget-menu raw $keys restores Buffer1 before cancelling and asking to abandon',({keys})=>{
    const r=learnRig(); r.keys([['a'],keys,['a']]); const before=r.s.mem.slice(r.at,r.at+44);
    r.start(learnMove(r.s,r.host)); r.finish(); expect(r.driver.result).toEqual({b:0});
    expect(r.s.mem.slice(r.at,r.at+44)).toEqual(before);
    const load=r.events.findIndex(e=>e.name==='load1'),abandon=r.events.findIndex(e=>e.name==='text:AbandonLearningText');
    expect(load).toBeGreaterThan(-1); expect(load).toBeLessThan(abandon); expect(r.events.some(e=>e.name==='swapStart')).toBe(false);
  });
  it('NO to abandonment restarts the full DontAbandonLearning scan/question and saves Buffer1 only once',()=>{
    const r=learnRig();r.keys([['b'],['b'],['a'],['down'],['a']]);
    r.start(learnMove(r.s,r.host));r.finish(); expect(r.driver.result).toEqual({b:1}); expect(r.remaining()).toEqual([]);
    expect(r.events.filter(e=>e.name==='text:TryingToLearnText')).toHaveLength(2);
    expect(r.events.filter(e=>e.name==='save1')).toHaveLength(1); expect(r.s.mem[r.at+9]).toBe(85);
    expect(r.events.some(e=>e.name==='text:DidNotLearnText')).toBe(false);
  });
  it.each([15,19,57,70,148])('refuses HM%i and restarts WhichMoveToForget with cursor0, then permits an ordinary move',hm=>{
    const r=learnRig([hm,45,39,98]); r.keys([['a'],['a'],['down'],['a']]);
    r.start(learnMove(r.s,r.host)); r.finish(); expect(r.driver.result).toEqual({b:1}); expect(r.remaining()).toEqual([]);
    expect(r.s.mem[r.at+8]).toBe(hm); expect(r.s.mem[r.at+9]).toBe(85);
    expect(r.events.filter(e=>e.name==='text:HMCantDeleteText')).toHaveLength(1);
    expect(r.events.filter(e=>e.name==='text:WhichMoveToForgetText')).toHaveLength(2);
    expect(r.events.filter(e=>e.name==='load1')).toHaveLength(2);
  });
  it('draws exact YES/NO and single-spaced forget menus with source flags, raw moves and name bytes',()=>{
    const r=learnRig(); let reads=0; r.s.mem[D.hUILayoutFlags]=0x80;
    r.host.readJoypad=()=>{
      reads++;
      if(reads===1){expect(r.screen.at(14,7)).toBe('┌');expect(r.screen.at(19,11)).toBe('┘');}
      else {
        expect(r.screen.at(4,7)).toBe('┌');expect(r.screen.at(19,12)).toBe('┘');expect(r.screen.at(5,8)).toBe('▶');
        expect(r.s.mem[D.hUILayoutFlags]).toBe(0x82);
        expect([r.s.mem[D.wTopMenuItemY],r.s.mem[D.wTopMenuItemX],r.s.wMaxMenuItem,r.s.mem[D.wMenuWatchedKeys]]).toEqual([8,5,3,3]);
        expect([...r.s.mem.slice(D.wMoves,D.wMoves+4)]).toEqual([33,45,39,98]);
        expect([...r.s.mem.slice(D.wMovesString,D.wMovesString+7)]).toEqual([...encodeText('TACKLE'),0x4e]);
        expect([0,1,2,3,4].map(i=>r.screen.at(6+i,9)).join('')).toBe('GROWL');
      }
      vi.mocked(isPassPressed).mockImplementation(key=>key==='a');
    };
    const put=vi.spyOn(r.host.tiles,'put'); let single=false;
    put.mockImplementation((x,y,value)=>{if(x===6&&y===8&&value==='T'){single=true;expect(r.s.mem[D.hUILayoutFlags]).toBe(0x84);}r.screen.put(x,y,value??' ');});
    r.start(learnMove(r.s,r.host));r.finish();expect(reads).toBe(2);expect(single).toBe(true);expect(r.s.mem[D.hUILayoutFlags]).toBe(0x80);
  });
  it('copies the selected nickname as exactly11 bytes and keeps it while GetName overwrites the name buffer',()=>{
    const r=learnRig([33,0,39,98],0,1); r.s.mem.fill(0xab,D.wLearnMoveMonName,D.wLearnMoveMonName+11); r.s.mem[D.wLearnMoveMonName+11]=0x79;
    const nick=r.s.mem.slice(D.wPartyMonNicks+11,D.wPartyMonNicks+22);
    r.start(learnMove(r.s,r.host));r.finish();
    expect(r.s.mem.slice(D.wLearnMoveMonName,D.wLearnMoveMonName+11)).toEqual(nick);expect(r.s.mem[D.wLearnMoveMonName+11]).toBe(0x79);
    expect(r.events.find(e=>e.name==='text:LearnedMove1Text')!.data).toMatchObject({learnMoveMonName:'NEW',stringBuffer:'THUNDERBOLT'});
  });
  it('fills the EXP seam and learns the final-level move through the real shared flow',()=>{
    const r=learnRig([33,0,39,98]); const species=r.s.species;
    r.s.species=id=>({...species(id),learnset:[{level:12,move:85}]});r.s.wEnemyMonLevel=100;
    bindLearnMove(r.host,r.host);
    r.start(gainExperience(r.s,r.host));r.finish();
    expect(r.s.mem[r.at+9]).toBe(85);expect(r.s.mem[r.at+30]).toBe(15);expect(r.s.mem[D.wCanEvolveFlags]).toBe(1);
    expect(r.s.wCurEnemyLevel).toBe(45);expect(r.s.wPokedexNum).toBe(0x54);
    expect([r.s.mem[D.wPikachuEmotionModifier],r.s.mem[D.wPikachuMood]]).toEqual([5,0x85]);
    expect(r.events.filter(e=>e.name==='text:LearnedMove1Text')).toHaveLength(1);
  });
  it.each([0,1])('OneTwoAndText retains its text cursor through the real swap, restoring field/battle bank (mode%i)',mode=>{
    const r=learnRig(undefined,mode);r.audio.music.play(musicData('routes3'));
    r.s.wNamedObjectIndex=33;getMoveName(r.s);
    const snapshots:{bank:number;saved:number;mute:number;id:number;pc:number}[]=[];
    const text=r.video.textBox as unknown as {screen:{bc():{column:number;row:number}}};
    let before:unknown,after:unknown,start=0,end=0,preceding=false;
    vi.mocked(r.bridge.playSwap).mockImplementation(function* (sound){
      before={...text.screen.bc()};start=r.time();
      expect(Array.from({length:18},(_,i)=>r.screen.at(i+1,14)).join('')).toContain('1, 2 and...');
      r.bridge.play({id:0x90,data:sfxData('press_ab')});
      const program=BattleAudio.prototype.playSwap.call(r.bridge,sound);
      for(const frame of program) {
        snapshots.push({bank:r.bridge.audioBank,saved:r.bridge.savedAudioBank,mute:r.bridge.muteAudioAndPauseMusic,
          id:r.bridge.channelId(5),pc:r.audio.music.getChannel(1)!.pc});
        if(r.bridge.audioBank===2&&r.bridge.channelId(5)===0x90)preceding=true;
        yield frame;
      }
      after={...text.screen.bc()};end=r.time();return true;
    });
    r.start(r.host.printText('OneTwoAndText',{learnMoveMonName:'OLD',stringBuffer:'THUNDERBOLT',nameBuffer:'TACKLE'},
      {asmContinuations:{OneTwoAndText:oneTwoAndText(r.host)}}));
    r.finish(()=>[]);
    expect(after).toEqual(before);expect(start).toBeGreaterThanOrEqual(30);expect(end).toBeGreaterThan(start+1);
    expect(snapshots[0]).toMatchObject({bank:mode?8:2,saved:mode?8:2,mute:1});
    expect(preceding).toBe(true);expect(snapshots.slice(1).every(s=>s.bank===2&&s.saved===2)).toBe(true);
    const swap=snapshots.filter(s=>s.id===0xae);expect(swap.length).toBeGreaterThan(0);
    expect(new Set(snapshots.slice(1).map(s=>s.pc)).size).toBe(1);
    expect([r.bridge.audioBank,r.bridge.savedAudioBank,r.bridge.muteAudioAndPauseMusic]).toEqual([mode?8:2,mode?8:2,0]);
    expect(r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name)).toEqual(['text:OneTwoAndText']);
    const cells=(r.ledger as {cells:(number|string)[]}[]).map(entry=>entry.cells.join(''));
    expect(cells.some(s=>s.includes('Poof!'))).toBe(true);expect(cells.some(s=>s.includes('TACKLE!'))).toBe(true);
  });
  it('forget input retains Delay3 on each menu entry and uses single-row movement, never SELECT swaps',()=>{
    const r=learnRig();r.keys([['a'],['select'],['down'],['a']]);
    r.start(learnMove(r.s,r.host));r.finish();
    const reads=r.events.filter(e=>e.name==='learnRead');expect(reads).toHaveLength(4);
    expect(reads[2].at-reads[1].at).toBe(3);expect(reads[3].at-reads[2].at).toBe(3);
    expect(r.s.mem[r.at+8]).toBe(33);expect(r.s.mem[r.at+9]).toBe(85);expect(r.s.wCurrentMenuItem).toBe(1);
  });
  it('runs full replacement in the field, retaining bank02 and the battle bytes while playing the item jingle',()=>{
    const r=learnRig(undefined,0,1);r.keys([['a'],['down'],['down'],['a']]);
    const battle=r.s.mem.slice(D.wBattleMon,D.wBattleMon+29);
    r.start(learnMove(r.s,r.host));r.finish();
    expect(r.driver.result).toEqual({b:1});expect(r.s.mem[r.at+10]).toBe(85);expect(r.s.mem[r.at+31]).toBe(15);
    expect(r.s.mem.slice(D.wBattleMon,D.wBattleMon+29)).toEqual(battle);
    expect(r.events.filter(e=>e.name==='textSound').map(e=>e.data)).toContain('get_item1');
    expect(r.events.find(e=>e.name==='swapStart')?.data).toEqual([2,2]);
    expect(r.events.find(e=>e.name==='swapEnd')?.data).toEqual([2,2]);
    expect(r.s.partyMons[1]!.moves[2]).toEqual({id:'THUNDERBOLT',pp:15,maxPp:15});
  });
  it.each([false,true])('composed EXP handles a full moveset with abandonment=$0 and still sets evolution eligibility',abandon=>{
    const r=learnRig();const species=r.s.species;r.s.species=id=>({...species(id),learnset:[{level:12,move:85}]});
    r.s.wEnemyMonLevel=100;r.s.mem[D.wPikachuMood]=0x60;
    r.keys(abandon?[['b'],['a']]:[['a'],['down'],['a']]);bindLearnMove(r.host,r.host);
    r.start(gainExperience(r.s,r.host));r.finish();expect(r.remaining()).toEqual([]);
    expect(r.s.mem[D.wCanEvolveFlags]).toBe(1);expect(r.s.wCurEnemyLevel).toBe(45);expect(r.s.wPokedexNum).toBe(0x54);
    expect(r.s.mem[r.at+9]).toBe(abandon?45:85);expect(r.s.mem[D.wPikachuMood]).toBe(abandon?0x8a:0x85);
    expect(r.events.filter(e=>e.name==='text:LearnedMove1Text')).toHaveLength(abandon?0:1);
    expect(r.events.filter(e=>e.name==='text:DidNotLearnText')).toHaveLength(abandon?1:0);
  });
});

describe('checkpoint-08 item0 regressions',()=>{
  it('blackout holds the cleared full screen for exactly3 serviced frames before returning',()=>{
    const r=faintRig();let clearedAt=-1;
    const put=r.screen.put.bind(r.screen);
    vi.spyOn(r.screen,'put').mockImplementation((x,y,value)=>{put(x,y,value);if(x===19&&y===17&&value===' '&&r.events.some(e=>e.name==='textEnd:PlayerBlackedOutText2'))clearedAt=r.time();});
    r.start(handlePlayerBlackOut(r.s,r.host));r.finish();
    expect(clearedAt).toBeGreaterThanOrEqual(0);expect(r.time()-clearedAt).toBe(3);
    expect(r.frames.slice(-3)).toEqual(['serviced','serviced','serviced']);expect(r.screen.visibleCells.every(c=>c===' ')).toBe(true);
  });
  it('enemy faint prints the empty string before saving Buffer1',()=>{
    const r=faintRig(1);r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    const names=r.events.map(e=>e.name),save=names.indexOf('save1');
    expect(names.slice(save-2,save)).toEqual(['text:PrintEmptyString.emptyString','textEnd:PrintEmptyString.emptyString']);
    expect(r.events[save].at-r.events[save-2].at).toBe(3);
  });
  it('clears stale EXP.ALL boost1 before the fought pass',()=>{
    const r=faintRig(1);r.s.wBoostExpByExpAll=1;r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    const pages=r.events.filter(e=>e.name==='textEnd:GainedText').map(e=>(e.data as string[]).join(' '));
    expect(pages).toHaveLength(1);expect(pages[0]).not.toContain('EXP.ALL');expect(r.s.wBoostExpByExpAll).toBe(0);
  });
  it('enemy-first trainer double faint leaves the player HUD cleared until next-mon dialogue',()=>{
    const r=faintRig();r.s.wBattleMonHP=0;r.s.mem[D.wPartyGainExpFlags]=3;r.s.wFirstMonsNotOutYet=1;let checked=false;
    const dialogue=playerSendOut.doUseNextMonDialogue;
    vi.spyOn(playerSendOut,'doUseNextMonDialogue').mockImplementation(function* (state,host){
      checked=true;for(let y=7;y<12;y++)for(let x=9;x<20;x++)expect(r.screen.at(x,y)).toBe(' ');
      return yield* dialogue(state,host);
    });
    const input:GameButton[][]=[['down'],['a']];r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    r.start(handleEnemyMonFainted(r.s,r.host));r.finish();expect(checked).toBe(true);expect(r.driver.result).toBe('loop');
  });
  it('enemy-first trainer double faint runs the next-mon empty text and Buffer1 before opening the party',()=>{
    const r=faintRig();r.s.wBattleMonHP=0;r.s.mem[D.wPartyGainExpFlags]=3;r.s.wFirstMonsNotOutYet=1;
    const open=r.party.openBattleChoice.bind(r.party);let checked=false;
    vi.spyOn(r.party,'openBattleChoice').mockImplementation((...args)=>{
      checked=true;expect(r.events.slice(-3).map(e=>e.name)).toEqual(['text:PrintEmptyString.emptyString','textEnd:PrintEmptyString.emptyString','save1']);
      expect(r.events.filter(e=>e.name==='text:PrintEmptyString.emptyString')).toHaveLength(2);
      expect(r.events.filter(e=>e.name==='save1')).toHaveLength(2);return open(...args);
    });
    const input:GameButton[][]=[['down'],['a']];r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    r.start(handleEnemyMonFainted(r.s,r.host));r.finish();expect(checked).toBe(true);expect(r.driver.result).toBe('loop');
  });
});

function faintRig(mode=2) {
  const r=enemyRig(),s=r.s,base=s.species;s.species=id=>({...base(id),growthRate:0});
  s.wIsInBattle=mode;s.wEnemyMonHP=0;s.wEnemyMonLevel=10;s.wCurEnemyLevel=20;s.wEnemyMonPartyPos=0;
  s.mem[D.wEnemyPartyCount]=2;s.writeBE(D.wEnemyMons+44+1,30);
  for(let i=0;i<3;i++){s.mem[D.wPartyMons+44*i+14]=0;s.writeBE(D.wPartyMons+44*i+15,8000);}
  s.mem[D.wPartyGainExpFlags]=1;s.setBag([]);s.mem[D.wTrainerClass]=1;s.setBytes(D.wEnemyMonNick,encodeText('FOE@'),11);
  s.setBytes(D.wEnemyMonBaseStats,[10,20,30,40,50,60,70],7);
  const host:FaintHost & LearnMoveHost={...r.host,swapSound:{id:0xae,data:sfxData('swap')},
    faintFall:{id:0x9e,data:sfxData('faint_fall')},faintThud:{id:0x95,data:sfxData('faint_thud')},runSound:{id:0x97,data:sfxData('run')},
    readScrollJoypad:()=>1,learnMove:function*(){throw new Error('unbound learning');},
    stopAllMusic(){r.mark('stopMusic');r.audio.fade.requests.stopAllMusic();},
    playVictoryMusic(name,bank){r.mark('victoryMusic',[name,bank]);r.bridge.audioBank=r.bridge.savedAudioBank=bank;r.audio.music.play(musicData(name));},
    trainerPicture(){r.mark('trainerPicture');return 'trainer';},
    printEndBattleText:function*(){r.mark('endTextHandOff');},
    enemySlideOff(state){r.mark('enemySlide',[state.hWhoseTurn,r.bridge.channelId(8)]);},
  };bindLearnMove(host,host);
  const play=r.bridge.play.bind(r.bridge);vi.spyOn(r.bridge,'play').mockImplementation(sound=>{r.mark('sfx',[sound.id,r.bridge.frequencyModifier,r.bridge.tempoModifier]);return play(sound);});
  return {...r,host};
}
function deadParty(r:{s:BattleState}){r.s.wBattleMonHP=0;for(let i=0;i<3;i++)r.s.writeBE(D.wPartyMons+44*i+1,0);}
function setBcd(s:BattleState,at:number,value:number){const digits=String(value).padStart(6,'0');for(let i=0;i<3;i++)s.mem[at+i]=parseInt(digits.slice(i*2,i*2+2),16);}

function endRig(result=1){
  const r=faintRig();r.s.wBattleResult=result;r.s.mem[D.wDestinationWarpID]=7;
  const host:BattleEndHost={...r.host,evolutionAfterBattle:function* (state){r.mark('evolution',[state.mem[D.wForceEvolution],state.mem[D.wCanEvolveFlags]]);}};
  return {...r,host};
}

describe('checkpoint-08 EndOfBattle',()=>{
  it.each([0,1,2,255])('result%i gates Pay Day, evolution and mood while retaining the result byte',result=>{
    const r=endRig(result);r.s.writeBE(D.wPlayerID,0x1234);r.s.mem[D.wPikachuMood]=0x60;
    r.s.mem[D.wForceEvolution]=0xa5;r.s.mem[D.wCanEvolveFlags]=3;setBcd(r.s,D.wPlayerMoney,123);setBcd(r.s,D.wTotalPayDayMoney,456);
    r.start(endOfBattle(r.s,r.host));r.finish();expect(r.s.wBattleResult).toBe(result);
    expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(result===0?579:123);expect(readBattleBcd(r.s,D.wTotalPayDayMoney)).toBe(456);
    expect(r.events.filter(e=>e.name==='evolution').map(e=>e.data)).toEqual(result===0?[[0,3]]:[]);
    expect(r.events.filter(e=>e.name==='text:PickUpPayDayMoneyText')).toHaveLength(result===0?1:0);
    expect(r.s.mem[D.wForceEvolution]).toBe(result===0?0:0xa5);expect(r.s.mem[D.wPikachuMood]).toBe(result===0?0x82:0x60);
    expect([r.s.wIsInBattle,r.s.wBattleType,r.s.wMoveMissed,r.s.wCurOpponent,r.s.wForcePlayerToChooseMon,r.s.wNumRunAttempts,r.s.wEscapedFromBattle]).toEqual([0,0,0,0,0,0,0]);
  });
  it.each([0,1,999,999999])('Pay Day amount%i adds before its numeric text, saturates, and leaves the source bytes',award=>{
    const r=endRig(0);setBcd(r.s,D.wPlayerMoney,999998);setBcd(r.s,D.wTotalPayDayMoney,award);
    const print=r.host.printText;r.host.printText=function* (label,bindings,options){
      if(label==='PickUpPayDayMoneyText'){expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(Math.min(999999,999998+award));expect(bindings).toEqual({totalPayDayMoney:award});}
      yield* print(label,bindings,options);
    };
    r.start(endOfBattle(r.s,r.host));r.finish();
    expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(Math.min(999999,999998+award));expect(readBattleBcd(r.s,D.wTotalPayDayMoney)).toBe(award);
    expect(r.events.filter(e=>e.name==='text:PickUpPayDayMoneyText')).toHaveLength(award?1:0);expect(r.events.filter(e=>e.name==='evolution')).toHaveLength(1);
    if(award)expect(r.events.findIndex(e=>e.name==='textEnd:PickUpPayDayMoneyText')).toBeLessThan(r.events.findIndex(e=>e.name==='evolution'));
  });
  it('evolution hand-off yields before mood/reset and sees cleared ForceEvolution with the source CanEvolve flags',()=>{
    const r=endRig(0);r.s.writeBE(D.wPlayerID,0x1234);r.s.mem[D.wPikachuMood]=0x60;r.s.mem[D.wForceEvolution]=0xa5;r.s.mem[D.wCanEvolveFlags]=5;
    r.host.evolutionAfterBattle=function* (state){
      expect([state.wIsInBattle,state.mem[D.wForceEvolution],state.mem[D.wCanEvolveFlags],state.mem[D.wPikachuMood]]).toEqual([2,0,5,0x60]);
      yield 'serviced';state.mem[D.wPikachuMood]=0x70;
    };
    r.start(endOfBattle(r.s,r.host));expect(r.driver.done).toBe(false);expect(r.s.wIsInBattle).toBe(2);
    r.finish();expect(r.frames).toEqual(['serviced']);expect(r.s.mem[D.wPikachuMood]).toBe(0x82);expect(r.s.wIsInBattle).toBe(0);
  });
  it.each([{mood:0x60,alive:true,identity:true,expected:0x82},{mood:0x99,alive:true,identity:true,expected:0x99},
    {mood:0x60,alive:false,identity:true,expected:0x60},{mood:0x60,alive:true,identity:false,expected:0x60}])
  ('mood floor reads post-evolution party state ($mood/$alive/$identity)',({mood,alive,identity,expected})=>{
    const r=endRig(0);r.s.writeBE(D.wPlayerID,0x1234);r.s.mem[D.wPikachuMood]=mood;
    r.s.mem[D.wPartyCount]=1;r.s.mem[D.wPartySpecies+1]=255; // one starter in the source identity scan
    r.host.evolutionAfterBattle=function* (state){if(!alive)state.writeBE(D.wPartyMons+1,0);if(!identity)state.mem[D.wPartyMonOT+4]^=1;};
    r.start(endOfBattle(r.s,r.host));r.finish();expect(r.s.mem[D.wPikachuMood]).toBe(expected);
  });
  it('resets exactly the source cells and menu owners before waiting, preserving unrelated scratch and party data',()=>{
    const r=endRig();r.s.wIsInBattle=r.s.wBattleType=r.s.wMoveMissed=r.s.wCurOpponent=0x79;
    r.s.wForcePlayerToChooseMon=r.s.wNumRunAttempts=r.s.wEscapedFromBattle=0x79;
    r.s.mem.fill(0xab,D.wBattleStatusData,D.wBattleStatusDataEnd);r.s.mem[D.wBattleStatusData-2]=0x79;r.s.mem[D.wBattleStatusDataEnd+1]=0x81;
    r.s.mem.fill(0xab,D.wPartyAndBillsPCSavedMenuItem,D.wPartyAndBillsPCSavedMenuItem+4);r.s.mem[D.wListScrollOffset]=7;
    setPartyAndBillsSavedMenuItem(7);setBagSavedMenuItem(7);setBattleAndStartSavedMenuItem(7);setListScrollOffset(7);
    setCurrentMenuItem(9);setSavedListScrollOffset(11);r.s.wCurrentMenuItem=9;r.s.wWhichPokemon=2;
    r.s.mem[D.wStatusFlags2]=0x80;r.s.mem[D.wForceEvolution]=0xa5;r.s.mem[D.wCanEvolveFlags]=0x81;
    r.s.wBattleMonStatus=0x40;r.s.wPlayerMonMinimized=0x79;setLowHealthAlarm(0x85);setLowHealthAlarmDisabled(true);
    const party=r.s.mem.slice(D.wPartyMons,D.wPartyMonOT),battleHp=r.s.wBattleMonHP;
    r.bridge.play({id:0x95,data:sfxData('faint_thud')});
    // End host is intentionally smaller than the faint host; use the real CHAN8 wait.
    r.start(endOfBattle(r.s,r.host));
    expect(r.driver.done).toBe(false);expect(r.s.mem.slice(D.wBattleStatusData,D.wBattleStatusDataEnd)).toEqual(new Uint8Array(24));
    expect([r.s.wIsInBattle,r.s.wBattleType,r.s.wMoveMissed,r.s.wCurOpponent,r.s.wForcePlayerToChooseMon,r.s.wNumRunAttempts,r.s.wEscapedFromBattle]).toEqual([0,0,0,0,0,0,0]);
    expect([r.s.mem[D.wBattleStatusData-2],r.s.mem[D.wBattleStatusDataEnd+1]]).toEqual([0x79,0x81]);
    expect([...r.s.mem.slice(D.wPartyAndBillsPCSavedMenuItem,D.wPartyAndBillsPCSavedMenuItem+4)]).toEqual([0,0,0,0]);
    expect([getPartyAndBillsSavedMenuItem(),getBagSavedMenuItem(),getBattleAndStartSavedMenuItem(),getListScrollOffset(),r.s.mem[D.wListScrollOffset]]).toEqual([0,0,0,0,0]);
    expect([getCurrentMenuItem(),getSavedListScrollOffset(),r.s.wCurrentMenuItem,r.s.wWhichPokemon]).toEqual([9,11,9,2]);
    expect([r.s.wBattleResult,r.s.mem[D.wForceEvolution],r.s.mem[D.wCanEvolveFlags],r.s.mem[D.wStatusFlags2],r.s.mem[D.wDestinationWarpID]]).toEqual([1,0xa5,0x81,0x81,7]);
    expect(r.s.mem.slice(D.wPartyMons,D.wPartyMonOT)).toEqual(party);expect(r.s.wBattleMonHP).toBe(battleHp);expect(r.s.wBattleMonStatus).toBe(0x40);expect(r.s.wPlayerMonMinimized).toBe(0x79);
    expect(lowHealthAlarm()).toBe(0);expect(r.bridge.channelId(5)).toBe(0);expect(r.bridge.channelId(8)).toBe(0x95);expect(isLowHealthAlarmDisabled()).toBe(true);
    r.finish();expect(r.time()).toBe(31);expect([r.screen.bgp,r.screen.obp0,r.screen.obp1,r.s.mem[D.wDestinationWarpID]]).toEqual([0,0,0,255]);
  });
  it('the CHAN5 reset clears software ID without a sound_ret hardware mute or extra frame',()=>{
    const r=endRig();r.bridge.play({id:0x9e,data:sfxData('faint_fall')});r.audio.run(1);
    const before=r.audio.synth.log.slice();expect(r.audio.synth.channelOutputEnabled(0)).toBe(true);
    r.start(endOfBattle(r.s,r.host));expect(r.driver.done).toBe(true);expect(r.bridge.channelId(5)).toBe(0);
    expect(r.audio.synth.log).toEqual(before);expect(r.audio.synth.channelOutputEnabled(0)).toBe(true);expect(r.frames).toEqual([]);
  });
  it.each([6,7,8])('keeps other channel%i IDs and waits on6/8 but skips7 before white-out/warp',channel=>{
    const r=endRig();r.screen.bgp=0xe4;r.screen.obp0=0xd0;r.screen.obp1=0xe4;
    r.bridge.play({id:0x96,data:{channels:[{id:channel,commands:[{cmd:channel===8?'noise_note':'square_note',length:1,volume:1,fade:0,frequency:512,param:1},{cmd:'sound_ret'}]}]}});
    r.start(endOfBattle(r.s,r.host));
    if(channel!==7){expect(r.driver.done).toBe(false);expect([r.screen.bgp,r.screen.obp0,r.screen.obp1,r.s.mem[D.wDestinationWarpID]]).toEqual([0xe4,0xd0,0xe4,7]);}
    r.finish();expect(r.time()).toBe(channel===7?0:3);expect([r.screen.bgp,r.screen.obp0,r.screen.obp1,r.s.mem[D.wDestinationWarpID]]).toEqual([0,0,0,255]);
    if(channel===7)expect(r.bridge.channelId(7)).toBe(0x96);
  });
  it('link rejects before Pay Day, evolution or resets',()=>{
    const r=endRig(0);r.s.wLinkState=4;setBcd(r.s,D.wTotalPayDayMoney,123);const before=r.s.mem.slice();
    expect(()=>r.start(endOfBattle(r.s,r.host))).toThrow('link');expect(r.s.mem).toEqual(before);expect(r.events).toEqual([]);
  });
});

function loopRig(){
  const r=faintRig();function* unexpected():Program<never>{throw new Error('unexpected turn port in router unit test');}
  const host:BattleLoopHost={...r.host,
    getMove(id){const key=getAllLoadedMoveIds().find(key=>getMove(key)!.id===id)!;return {...getMove(key)!,name:key};},
    saveScreenTilesToBuffer2:()=>r.video.saveScreenTilesToBuffer2(),loadScreenTilesFromBuffer2:()=>r.video.loadScreenTilesFromBuffer2(),
    useItem:unexpected,partyMenu:unexpected,
  };
  const ports:turnEntry.TurnPorts={animation:unexpected,hideSubstitute:unexpected,reshowSubstitute:unexpected,
    substituteBreak:unexpected,shake:unexpected,statModifierUpEffect:unexpected,jumpMoveEffect:unexpected,trainerAI:unexpected,switchEnemyMon:unexpected};
  return {...r,host,ports,ctx:battleContext(r.s)};
}

describe('checkpoint-08 battleLoop entry and dispatch',()=>{
  it.each([0,1,2].flatMap(result=>[{result,exit:'ran' as const},{result,exit:'escaped' as const}]))
  ('$exit retains existing result$result and leaves EndOfBattle to the caller',({result,exit})=>{
    const r=loopRig();r.s.wBattleResult=result;
    const trainer={enemy:r.s.partyMons[1]!,player:r.s.partyMons[0]!,aiModifiers:[1,2]};
    const main=vi.spyOn(turnEntry,'mainInBattleLoop').mockImplementation(function* (state,ctx,host,ports,actualTrainer){
      expect([state,ctx,host,ports]).toEqual([r.s,r.ctx,r.host,r.ports]);expect(actualTrainer).toBe(trainer);yield 'serviced';return exit;
    });
    r.start(battleLoop(r.s,r.ctx,r.host,r.ports,trainer));r.finish();expect(r.driver.result).toBe('end');expect(main).toHaveBeenCalledOnce();
    expect(r.s.wBattleResult).toBe(result);expect(r.s.wIsInBattle).toBe(2);expect(r.events.some(e=>e.name==='evolution')).toBe(false);
  });
  it.each((['enemy','player'] as const).flatMap(side=>(['loop','end','blackout'] as const).map(next=>({side,next}))))
  ('$side faint dispatch consumes $next and restarts only on loop',({side,next})=>{
    const r=loopRig();let calls=0;
    vi.spyOn(turnEntry,'mainInBattleLoop').mockImplementation(function* (){return ++calls===1?(side==='enemy'?'enemyFainted':'playerFainted'):'ran';});
    const handler=vi.spyOn(faintEntry,side==='enemy'?'handleEnemyMonFainted':'handlePlayerMonFainted').mockImplementation(function* (state,host){
      expect(state).toBe(r.s);expect(host).toBe(r.host);state.wNumRunAttempts=7;return next;
    });
    r.start(battleLoop(r.s,r.ctx,r.host,r.ports));r.finish();expect(calls).toBe(next==='loop'?2:1);expect(handler).toHaveBeenCalledOnce();
    expect(r.driver.result).toBe(next==='blackout'?'blackout':'end');expect(r.s.wNumRunAttempts).toBe(7);
  });
  it('runs a thousand tail-jump cycles at constant generator depth without doing end resets',()=>{
    const r=loopRig();let calls=0;const depths:number[]=[];
    const errorType=Error as ErrorConstructor & {stackTraceLimit:number},oldLimit=errorType.stackTraceLimit;errorType.stackTraceLimit=100;
    try {
      vi.spyOn(turnEntry,'mainInBattleLoop').mockImplementation(function* (){
        calls++;if([1,500,1000].includes(calls))depths.push(new Error().stack!.split('\n').length);
        return calls<=1000?'enemyFainted':'escaped';
      });
      const faint=vi.spyOn(faintEntry,'handleEnemyMonFainted').mockImplementation(function* (){return 'loop';});
      r.start(battleLoop(r.s,r.ctx,r.host,r.ports));expect(r.driver.done).toBe(true);expect(calls).toBe(1001);expect(faint).toHaveBeenCalledTimes(1000);
      expect(new Set(depths).size).toBe(1);expect(r.driver.result).toBe('end');expect(r.s.wIsInBattle).toBe(2);
    } finally {errorType.stackTraceLimit=oldLimit;}
  });
  it('dispatches enemyRan to the real text/RUN/cue path and preserves result1',()=>{
    const r=loopRig();r.s.wIsInBattle=1;r.s.wBattleResult=1;
    vi.spyOn(turnEntry,'mainInBattleLoop').mockImplementation(function* (){return 'enemyRan';});
    r.start(battleLoop(r.s,r.ctx,r.host,r.ports));r.finish();expect(r.driver.result).toBe('end');expect(r.s.wBattleResult).toBe(1);
    expect(r.events.find(e=>e.name==='enemySlide')?.data).toEqual([0,0x97]);
  });
  it.each(['end','loop'])('$0 entry rejects a different screen before state writes',entry=>{
    const r=loopRig(),other=faintRig(),before=r.s.mem.slice();const wrong={...r.host,screen:other.screen,evolutionAfterBattle:function*(){}};
    expect(()=>r.start(entry==='end'?endOfBattle(r.s,wrong):battleLoop(r.s,r.ctx,wrong,r.ports))).toThrow('different battle screen');expect(r.s.mem).toEqual(before);
  });
  it.each(['win','loss'])('real MainInBattleLoop $0 entry exits through its faint handler, then caller runs EndOfBattle',kind=>{
    const r=loopRig();r.s.wIsInBattle=1;
    if(kind==='loss'){deadParty(r);r.s.wEnemyMonHP=30;}else r.s.wEnemyMonHP=0;
    const endHost:BattleEndHost={...r.host,evolutionAfterBattle:function*(){r.mark('evolution');}};
    r.start((function* ():Program<string>{
      const exit=yield* battleLoop(r.s,r.ctx,r.host,r.ports);
      expect(exit).toBe(kind==='win'?'end':'blackout');expect(r.s.wIsInBattle).toBe(1);r.mark('loopReturned');
      yield* endOfBattle(r.s,endHost);return exit;
    })());r.finish();
    expect(r.driver.result).toBe(kind==='win'?'end':'blackout');expect(r.s.wIsInBattle).toBe(0);expect(r.s.mem[D.wDestinationWarpID]).toBe(255);
    expect(r.events.filter(e=>e.name==='evolution')).toHaveLength(kind==='win'?1:0);
  });
});

describe('checkpoint-07 FaintEnemyPokemon',()=>{
  it('syncs player data, zeroes trainer party HP and exact reset spans, preserving the low Bide byte',()=>{
    const r=faintRig();r.s.writeBE(D.wEnemyMons+1,99);r.s.wPlayerBattleStatus1=0xff;
    r.s.writeBE(D.wPlayerBideAccumulatedDamage,0x1234);r.s.mem.fill(0xab,D.wEnemyStatsToDouble,D.wEnemyStatsToDouble+6);
    r.s.wEnemyDisabledMove=r.s.wEnemyDisabledMoveNumber=r.s.wEnemyMonMinimized=0xab;
    r.s.mem[D.wPlayerUsedMove]=r.s.mem[D.wPlayerUsedMove+1]=0xab;r.s.wBattleMonStatus=0x40;
    r.start(faintEnemyPokemon(r.s,r.host));
    expect(r.s.readBE(D.wEnemyMons+1)).toBe(0);expect(r.s.wPlayerBattleStatus1).toBe(0xfb);
    expect(r.s.readBE(D.wPlayerBideAccumulatedDamage)).toBe(0x34);
    expect([...r.s.mem.slice(D.wEnemyStatsToDouble,D.wEnemyStatsToDouble+6)]).toEqual([0,0,0,0,0,0xab]);
    expect([r.s.wEnemyDisabledMove,r.s.wEnemyDisabledMoveNumber,r.s.wEnemyMonMinimized,r.s.mem[D.wPlayerUsedMove],r.s.mem[D.wPlayerUsedMove+1]]).toEqual([0,0,0,0,0]);
    expect(r.s.mem.slice(D.wPartyMons+1,D.wPartyMons+5)).toEqual(r.s.mem.slice(D.wBattleMonHP,D.wBattleMonHP+4));r.finish();
  });
  it('slides14 frames, then traces Audio1 byte counters for zero-modifier fall9 and thud31',()=>{
    const r=faintRig();r.bridge.frequencyModifier=0x79;r.bridge.tempoModifier=0x81;
    const trace:{at:number;ids:number[];counters:number[];fractions:number[]}[]=[];const tick=r.audio.sfx.tick.bind(r.audio.sfx);
    vi.spyOn(r.audio.sfx,'tick').mockImplementation(()=>{
      tick();const channels=(r.audio.sfx as unknown as {channels:{id:number;noteDelayCounter:number;noteDelayFractional:number}[]}).channels;
      trace.push({at:r.time(),ids:[r.bridge.channelId(5),r.bridge.channelId(8)],
        counters:[5,8].map(id=>channels.find(ch=>ch.id===id)?.noteDelayCounter??0),
        fractions:[5,8].map(id=>channels.find(ch=>ch.id===id)?.noteDelayFractional??0)});
    });
    r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    const sounds=r.events.filter(e=>e.name==='sfx'&&[0x9e,0x95].includes((e.data as number[])[0]));expect(sounds.map(e=>e.data)).toEqual([[0x9e,0,0],[0x95,0,0]]);
    expect(sounds[0].at).toBe(14);expect(sounds[1].at-sounds[0].at).toBe(9);
    expect(r.events.find(e=>e.name==='text:EnemyMonFaintedText')!.at-sounds[1].at).toBe(31);
    // square_note15: (15+1)*$0080 => counter8/fraction0, then ret on U9.
    expect(trace.filter(t=>t.at>=15&&t.at<=22).map(t=>t.counters[0])).toEqual([8,7,6,5,4,3,2,1]);
    expect(trace.find(t=>t.at===15)?.fractions[0]).toBe(0);expect(trace.find(t=>t.at===23)?.ids[0]).toBe(0);
    // Thud ID$95 is below BATTLE_SFX_START$9D: pulse16 at tempo$100, ret U17.
    // Noise is unscaled5,9,16 and returns on U31.
    expect(trace.find(t=>t.at===24)?.counters).toEqual([16,5]);expect(trace.find(t=>t.at===40)?.ids).toEqual([0,0x95]);
    expect(trace.find(t=>t.at===29)?.counters[1]).toBe(9);expect(trace.find(t=>t.at===38)?.counters[1]).toBe(16);
    expect(trace.find(t=>t.at===54)?.ids).toEqual([0,0]);
    expect(r.s.wBattleResult).toBe(0);expect(r.events.filter(e=>e.name==='save1')).toHaveLength(1);
  });
  it('polls only CHAN5 for the fall even while CHAN8 is still occupied',()=>{
    const r=faintRig(),play=(sound:Parameters<BattleAudio['play']>[0])=>BattleAudio.prototype.play.call(r.bridge,sound);
    vi.mocked(r.bridge.play).mockImplementation(sound=>{
      if(sound.id===0x95)r.mark('thudNoise',r.bridge.channelId(8));
      const result=play(sound);
      if(sound.id===0x9e)play({id:0x9f,data:{channels:[{id:8,commands:[...Array.from({length:8},()=>({cmd:'noise_note',length:15,volume:1,fade:0,param:1})),{cmd:'sound_ret'}]}]}});
      return result;
    });
    r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    const noise=r.events.find(e=>e.name==='thudNoise')!;expect(noise.at).toBe(23);expect(noise.data).toBe(0x9f);
  });
  it('waits for a preceding sound before requesting the fall, with no input reads in that wait',()=>{
    const r=faintRig();r.bridge.play({id:0x90,data:{channels:[{id:5,commands:[...Array.from({length:8},()=>({cmd:'square_note',length:15,volume:1,fade:0,frequency:512})),{cmd:'sound_ret'}]}]}});
    r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    expect(r.events.find(e=>e.name==='sfx'&&(e.data as number[])[0]===0x9e)!.at).toBe(8*16+1);
    expect(r.events.some(e=>e.name==='read')).toBe(false);
  });
  it('active alarm can reject fall/thud, so the CHAN5 ID poll advances immediately without installing them',()=>{
    const r=faintRig();setLowHealthAlarm(0x80);setLowHealthChannel5(0x86);
    r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    const sounds=r.events.filter(e=>e.name==='sfx'&&[0x9e,0x95].includes((e.data as number[])[0]));
    expect(sounds.map(e=>e.at)).toEqual([14,14]);expect(r.bridge.channelId(5)).toBe(0x86);expect(isLowHealthAlarmDisabled()).toBe(false);
  });
  it('clears the enemy HUD4 by11 after sliding, keeping column11 and row4 intact',()=>{
    const r=faintRig();for(let y=0;y<5;y++)for(let x=0;x<12;x++)r.screen.put(x,y,100+y*12+x);
    const play=(sound:Parameters<BattleAudio['play']>[0])=>BattleAudio.prototype.play.call(r.bridge,sound);let checked=false;
    vi.mocked(r.bridge.play).mockImplementation(sound=>{
      if(sound.id===0x9e){checked=true;for(let y=0;y<4;y++){for(let x=0;x<11;x++)expect(r.screen.at(x,y)).toBe(' ');expect(r.screen.at(11,y)).toBe(111+y*12);}
        for(let x=0;x<12;x++)expect(r.screen.at(x,4)).toBe(148+x);}
      return play(sound);
    });r.start(faintEnemyPokemon(r.s,r.host));r.finish();expect(checked).toBe(true);
  });
  it('wild entry leaves enemy party bytes alone, ends the alarm, and starts the victory fanfare before faint text',()=>{
    const r=faintRig(1);r.s.writeBE(D.wEnemyMons+1,99);setLowHealthAlarm(0x85);setLowHealthChannel5(0x86);
    r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    expect(r.s.readBE(D.wEnemyMons+1)).toBe(99);expect(r.events.filter(e=>e.name==='sfx'&&[0x9e,0x95].includes((e.data as number[])[0]))).toEqual([]);
    expect(r.events.find(e=>e.name==='victoryMusic')).toMatchObject({at:14,data:['defeatedwildmon',8]});
    expect(r.events.find(e=>e.name==='text:EnemyMonFaintedText')!.at).toBe(17);
    expect(lowHealthAlarm()).toBe(0);expect(isLowHealthAlarmDisabled()).toBe(true);
  });
  it('with no surviving player returns before result0, faint text, Buffer1 or EXP, after the wild fanfare',()=>{
    const r=faintRig(1);deadParty(r);r.s.wBattleResult=0x79;r.s.mem[D.wInHandlePlayerMonFainted]=1;
    r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    expect(r.s.wBattleResult).toBe(0x79);expect(r.events.some(e=>e.name==='victoryMusic')).toBe(true);
    expect(r.events.some(e=>e.name.startsWith('text:')||e.name==='save1')).toBe(false);
  });
  it('EXP.ALL halves seven bytes, runs fought then full-party passes over the same mutated bytes and preserves bag decision',()=>{
    const r=faintRig(1);r.s.writeBE(D.wPlayerID,0x1234);r.s.wEnemyMonLevel=7;r.s.setBag([{id:0x4b,quantity:1}]);r.s.mem[D.wPartyGainExpFlags]=3;
    const print=r.host.printText;let gained=0;
    r.host.printText=function* (label,bindings,options){if(label==='GainedText'&&++gained===1)r.s.setBag([]);yield* print(label,bindings,options);};
    r.start(faintEnemyPokemon(r.s,r.host));r.finish();
    expect(r.events.filter(e=>e.name==='text:GainedText').map(e=>(e.data as {expAmountGained:number}).expAmountGained)).toEqual([17,17,5,5,5]);
    expect([...r.s.mem.slice(D.wEnemyMonBaseStats,D.wEnemyMonBaseStats+7)]).toEqual([0,1,2,3,4,5,5]);
    expect(r.s.wBoostExpByExpAll).toBe(1);expect([r.s.mem[D.wPartyGainExpFlags],r.s.mem[D.wPartyFoughtCurrentEnemyFlags]]).toEqual([1,1]);
    const pages=r.events.filter(e=>e.name==='textEnd:GainedText').map(e=>(e.data as string[]).join(' '));
    expect(pages.slice(0,2).every(s=>!s.includes('EXP.ALL'))).toBe(true);expect(pages.slice(2).every(s=>s.includes('EXP.ALL'))).toBe(true);
  });
});

describe('checkpoint-07 RemoveFaintedPlayerMon',()=>{
  it('clears exactly the player HUD rectangle at (9,7),5 by11 before the first slide hold',()=>{
    const r=faintRig();for(let y=7;y<13;y++)for(let x=8;x<20;x++)r.screen.put(x,y,100+y*20+x);
    r.s.mem[D.wInHandlePlayerMonFainted]=0;r.start(removeFaintedPlayerMon(r.s,r.host));
    for(let y=7;y<12;y++){expect(r.screen.at(8,y)).toBe(108+y*20);for(let x=9;x<20;x++)expect(r.screen.at(x,y)).toBe(' ');}
    for(let x=8;x<20;x++)expect(r.screen.at(x,12)).toBe(340+x);r.finish();
  });
  it.each([false,true])('clears flags/status and both enemy Bide bytes, syncs party and slides14, with alarm=$0',alarm=>{
    const r=faintRig();r.s.wBattleMonHP=0;r.s.wBattleMonStatus=0x40;r.s.mem[D.wPartyGainExpFlags]=7;r.s.wEnemyBattleStatus1=0xff;
    r.s.writeBE(D.wEnemyBideAccumulatedDamage,0x1234);r.s.mem[D.wInHandlePlayerMonFainted]=0;
    if(alarm){setLowHealthAlarm(0x80);setLowHealthChannel5(0x86);}
    r.start(removeFaintedPlayerMon(r.s,r.host));
    expect(r.s.mem[D.wPartyGainExpFlags]).toBe(6);expect(r.s.wEnemyBattleStatus1).toBe(0xfb);
    expect(r.s.readBE(D.wEnemyBideAccumulatedDamage)).toBe(0);expect(r.s.wBattleMonStatus).toBe(0);
    expect(r.s.readBE(D.wPartyMons+1)).toBe(0);expect(r.s.mem[D.wPartyMons+4]).toBe(0);
    expect(lowHealthAlarm()).toBe(alarm?255:0);expect(r.events.filter(e=>e.name==='wait')).toHaveLength(alarm?1:0);
    r.finish();expect(r.time()).toBe(14);expect(r.s.wBattleResult).toBe(1);
    expect(lowHealthAlarm()).toBe(0);expect(r.events.some(e=>e.name.startsWith('text:')||e.name==='cry'||e.name==='clip')).toBe(false);
  });
  it('retains the non-alarm byte on the source no-XOR path',()=>{
    const r=faintRig();setLowHealthAlarm(1);r.s.wBattleMonHP=0;r.s.mem[D.wInHandlePlayerMonFainted]=0;
    r.start(removeFaintedPlayerMon(r.s,r.host));expect(r.s.readBE(D.wEnemyBideAccumulatedDamage)).toBe(0x101);expect(r.s.wBattleMonStatus).toBe(1);r.finish();
  });
  it('ordinary faint uses battle struct species, then faint text, without starter mood changes',()=>{
    const r=faintRig();r.s.wBattleMonHP=0;r.s.mem[D.wInHandlePlayerMonFainted]=1;r.s.wBattleMonSpecies=0x24;
    r.s.mem[D.wPikachuHappiness]=100;r.start(removeFaintedPlayerMon(r.s,r.host));r.finish();
    expect(r.events.find(e=>e.name==='cry')).toMatchObject({at:14,data:[0x24,0]});
    expect(r.events.filter(e=>e.name==='text:PlayerMonFaintedText')).toHaveLength(1);expect(r.s.mem[D.wPikachuHappiness]).toBe(100);
  });
  it.each([{enemy:19,loss:1},{enemy:49,loss:1},{enemy:50,loss:5},{enemy:255,loss:5}])
  ('starter faint at enemy level$enemy chooses FAINTED or CARELESSTRAINER',({enemy,loss})=>{
    const r=faintRig();r.s.writeBE(D.wPlayerID,0x1234);r.s.wBattleMonHP=0;r.s.wEnemyMonLevel=enemy;
    r.s.mem[D.wInHandlePlayerMonFainted]=1;r.s.mem[D.wPikachuHappiness]=90;r.s.mem[D.wPikachuMood]=0x8a;
    r.start(removeFaintedPlayerMon(r.s,r.host));r.finish();
    expect(r.events.find(e=>e.name==='clip')).toMatchObject({at:17,data:4});expect(r.s.mem[D.wPikachuHappiness]).toBe(90-loss);
    expect(r.s.mem[D.wPikachuMood]).toBe(0x6c);expect(r.s.wWhichPokemon).toBe(0);expect(r.events.some(e=>e.name==='cry')).toBe(false);
  });
});

describe('checkpoint-07 victory, blackout and EnemyRan',()=>{
  it('PlayBattleVictoryMusic stops then starts in bank08 and returns after3, while the fanfare still plays',()=>{
    const r=faintRig();r.start(playBattleVictoryMusic(r.host,'defeatedtrainer'));r.finish();
    expect(r.events.slice(0,2).map(e=>e.name)).toEqual(['stopMusic','victoryMusic']);expect(r.time()).toBe(3);
    expect(r.audio.music.getChannel(1)!.pc).toBeGreaterThan(0);
  });
  it.each([{trainer:1,gym:0,track:'defeatedtrainer'},{trainer:1,gym:1,track:'defeatedgymleader'},
    {trainer:0x2b,gym:0,track:'defeatedgymleader'}])('rehosts trainer victory for $trainer/$gym',({trainer,gym,track})=>{
    const r=faintRig();r.s.mem[D.wTrainerClass]=trainer;r.s.mem[D.wGymLeaderNo]=gym;r.s.mem[D.wStatusFlags7]=0x80;
    setLowHealthAlarm(0x80);r.s.setBytes(D.wAmountMoneyWon,[0,1,0x23],3);setBcd(r.s,D.wPlayerMoney,456);
    const print=r.host.printText;r.host.printText=function* (label,bindings,options){if(label==='MoneyForWinningText')expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(456);yield* print(label,bindings,options);};
    r.start(trainerBattleVictory(r.s,r.host));r.finish();
    expect(r.events.find(e=>e.name==='victoryMusic')?.data).toEqual([track,8]);expect(isLowHealthAlarmDisabled()).toBe(true);
    expect(r.s.mem[D.wStatusFlags7]).toBe(trainer===0x2b?0x82:0x80);expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(579);
    expect(r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name)).toEqual(['text:TrainerDefeatedText','text:MoneyForWinningText']);
    const pic=r.events.find(e=>e.name==='trainerPicture')!,end=r.events.find(e=>e.name==='endTextHandOff')!;
    expect(end.at-pic.at).toBe(5+7+24+40);expect(r.frames.filter(f=>f==='held')).toHaveLength(2);
    expect(r.screen.frontSlot(48)).toEqual({picture:'trainer',tile:48});expect(r.s.wEnemyMonSpecies2).toBe(0);
  });
  it.each([[999,1,1000],[999900,999,999999],[0,999999,999999]])('BCD money %i + %i saturates to %i',(money,award,total)=>{
    const r=faintRig();setBcd(r.s,D.wPlayerMoney,money);setBcd(r.s,D.wAmountMoneyWon,award);
    r.s.mem[D.wPlayerMoney-1]=0x79;r.s.mem[D.wPlayerMoney+3]=0x81;
    r.start(trainerBattleVictory(r.s,r.host));r.finish();expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(total);
    expect([r.s.mem[D.wPlayerMoney-1],r.s.mem[D.wPlayerMoney+3]]).toEqual([0x79,0x81]);expect(readBattleBcd(r.s,D.wAmountMoneyWon)).toBe(award);
  });
  it('ordinary blackout uses black palette, text, clears only bike bit and then all logical cells, returning carry',()=>{
    const r=faintRig();r.s.mem[D.wStatusFlags6]=0xff;
    r.start(handlePlayerBlackOut(r.s,r.host));r.finish();expect(r.driver.result).toEqual({carry:true});
    expect(r.s.mem[D.wStatusFlags6]).toBe(0xdf);expect(r.screen.cells.every(c=>c===' ')).toBe(true);
    expect(r.screen.paletteName(0)).toBe('PAL_BLACK');expect(r.events.filter(e=>e.name.startsWith('text:')).map(e=>e.name)).toEqual(['text:PlayerBlackedOutText2']);
    expect(r.frames.filter(f=>f==='held')).toHaveLength(2);
  });
  it.each([{map:0x28,carry:false},{map:0x21,carry:true}])('Rival1 special prefix on map$map returns carry$carry',({map,carry})=>{
    const r=faintRig();r.s.wCurOpponent=0xe1;r.s.wCurMap=map;r.s.mem[D.wStatusFlags6]=0xff;
    for(let i=0;i<180;i++)r.screen.put(i%20,Math.floor(i/20),i+100);
    const picture=r.host.trainerPicture;r.host.trainerPicture=state=>{expect(r.screen.at(0,8)).toBe(' ');expect(r.screen.at(1,8)).toBe(261);return picture(state);};
    r.start(handlePlayerBlackOut(r.s,r.host));r.finish();expect(r.driver.result).toEqual({carry});
    expect(r.events.find(e=>e.name==='text:Rival1WinText')!.at).toBe(5+7+24+40);
    expect(r.events.some(e=>e.name==='text:PlayerBlackedOutText2')).toBe(carry);
    expect(r.s.mem[D.wStatusFlags6]).toBe(carry?0xdf:0xff);
  });
  it.each(['victory','blackout','ran'])('rejects unsupported link at the $0 branch',kind=>{
    const r=faintRig();r.s.wLinkState=4;r.s.wBattleResult=0x79;
    expect(()=>r.start(kind==='victory'?trainerBattleVictory(r.s,r.host):kind==='blackout'?handlePlayerBlackOut(r.s,r.host):enemyRan(r.s,r.host))).toThrow('link');
    expect(r.s.wBattleResult).toBe(0x79);expect(r.events.filter(e=>e.name==='load1')).toHaveLength(kind==='ran'?1:0);
    expect(r.events.some(e=>e.name.startsWith('text:')||e.name==='victoryMusic')).toBe(false);
  });
  it('EnemyRan restores Buffer1, waits before RUN, retains result and invokes the enemy cue without waiting after RUN',()=>{
    const r=faintRig(1);r.s.wBattleResult=1;r.s.hWhoseTurn=1;r.bridge.play({id:0x90,data:sfxData('press_ab')});
    r.start(enemyRan(r.s,r.host));r.finish();expect(r.s.wBattleResult).toBe(1);expect(r.s.hWhoseTurn).toBe(0);
    expect(r.events.find(e=>e.name==='enemySlide')!.data).toEqual([0,0x97]);expect(r.bridge.channelId(8)).toBe(0x97);
    expect(r.events.filter(e=>e.name==='wait')).toHaveLength(1);expect(r.events.find(e=>e.name==='text:WildRanText')).toBeDefined();
  });
});

describe('checkpoint-07 composed faint handlers',()=>{
  it.each([0,1,2].flatMap(phase=>[{phase,side:'enemy'},{phase,side:'player'}]))
  ('$side slide preserves source coordinates, two-frame steps and BG-third tearing at phase$phase',({phase,side})=>{
    const r=faintRig();r.s.mem[D.wInHandlePlayerMonFainted]=0;
    for(let i=0;i<360;i++)r.screen.put(i%20,Math.floor(i/20),i+100);
    for(let i=0;i<3+phase;i++)r.screen.vblank();
    const model=[...r.screen.cells],shown=[...r.screen.visibleCells],x=side==='enemy'?12:1,bottom=side==='enemy'?5:10;
    r.start(side==='enemy'?faintEnemyPokemon(r.s,r.host):removeFaintedPlayerMon(r.s,r.host));
    for(let frame=0;frame<14;frame++){
      if(frame%2===0){for(let row=bottom;row>bottom-6;row--)for(let col=0;col<7;col++)model[(row+1)*20+x+col]=model[row*20+x+col];
        for(let col=0;col<7;col++)model[(bottom-5)*20+x+col]=' ';}
      for(let row=bottom-5;row<=bottom+1;row++)for(let col=0;col<7;col++)expect(r.screen.at(x+col,row)).toBe(model[row*20+x+col]);
      const third=(phase+frame)%3,offset=third*120;shown.splice(offset,120,...r.screen.cells.slice(offset,offset+120));
      r.step();expect(r.screen.visibleCells).toEqual(shown);
    }
    expect(r.frames.slice(0,14)).toEqual(Array(14).fill('serviced'));r.finish();
  });
  it.each(['enemy','player'])('$0-first trainer double faint without a reserve only faints the enemy on the enemy-first path',first=>{
    const r=faintRig();deadParty(r);r.s.wEnemyDisabledMove=0x79;
    r.start(first==='enemy'?handleEnemyMonFainted(r.s,r.host):handlePlayerMonFainted(r.s,r.host));r.finish();
    expect(r.driver.result).toBe('blackout');expect(r.s.wEnemyDisabledMove).toBe(first==='enemy'?0:0x79);
    expect(r.events.some(e=>e.name==='sfx'&&(e.data as number[])[0]===0x9e)).toBe(first==='enemy');
    expect(r.events.some(e=>e.name==='victoryMusic')).toBe(false);
  });
  it.each(['enemy','player'])('$0-first double faint with no reserve respects source work order before blackout',first=>{
    const r=faintRig(1);deadParty(r);r.s.wEnemyMonHP=0;r.s.mem[D.wInHandlePlayerMonFainted]=0x79;
    r.start(first==='enemy'?handleEnemyMonFainted(r.s,r.host):handlePlayerMonFainted(r.s,r.host));r.finish();
    expect(r.driver.result).toBe('blackout');expect(r.s.wBattleResult).toBe(1);
    expect(r.events.some(e=>e.name==='victoryMusic')).toBe(first==='enemy');
    expect(r.events.some(e=>e.name==='text:PlayerMonFaintedText')).toBe(first==='player');
    expect(r.events.some(e=>e.name==='text:EnemyMonFaintedText'||e.name==='text:GainedText')).toBe(false);
    expect(r.s.mem[D.wInHandlePlayerMonFainted]).toBe(first==='enemy'?0:1);
  });
  it.each(['enemy','player'])('$0-first wild double faint with a reserve suppresses duplicate removal and still awards EXP',first=>{
    const r=faintRig(1);r.s.wBattleMonHP=0;r.s.wEnemyMonHP=0;r.s.mem[D.wPartyGainExpFlags]=3;
    r.start(first==='enemy'?handleEnemyMonFainted(r.s,r.host):handlePlayerMonFainted(r.s,r.host));r.finish();
    expect(r.driver.result).toBe('end');expect(r.s.wBattleResult).toBe(0);
    expect(r.events.filter(e=>e.name==='text:PlayerMonFaintedText')).toHaveLength(first==='player'?1:0);
    expect(r.events.filter(e=>e.name==='text:EnemyMonFaintedText')).toHaveLength(1);
    expect(r.events.filter(e=>e.name==='text:GainedText')).toHaveLength(1);
  });
  it('enemy-first trainer final faint reaches victory after EXP and adds money once',()=>{
    const r=faintRig();r.s.writeBE(D.wEnemyMons+44+1,0);setBcd(r.s,D.wAmountMoneyWon,123);
    r.start(handleEnemyMonFainted(r.s,r.host));r.finish();expect(r.driver.result).toBe('end');expect(readBattleBcd(r.s,D.wPlayerMoney)).toBe(123);
    expect(r.events.findIndex(e=>e.name==='text:GainedText')).toBeLessThan(r.events.findIndex(e=>e.name==='victoryMusic'));
  });
  it('enemy-first trainer replacement returns loop with action0 and a newly loaded living enemy',()=>{
    const r=faintRig();r.s.wFirstMonsNotOutYet=1;const front=r.host.frontPicture;
    r.host.frontPicture=state=>{expect(state.wActionResultOrTookBattleTurn).toBe(1);return front(state);};
    r.start(handleEnemyMonFainted(r.s,r.host));r.finish();
    expect(r.driver.result).toBe('loop');expect(r.s.wEnemyMonPartyPos).toBe(1);expect(r.s.wEnemyMonHP).toBe(30);expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
  });
  it('player-first versus a living enemy chooses the next mon and returns directly to loop',()=>{
    const r=faintRig();r.s.wBattleMonHP=0;r.s.wEnemyMonHP=30;
    const input:GameButton[][]=[['down'],['a']];r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    r.start(handlePlayerMonFainted(r.s,r.host));r.finish();expect(input).toEqual([]);expect(r.driver.result).toBe('loop');expect(r.s.wPlayerMonNumber).toBe(1);
    expect(r.events.some(e=>e.name==='text:TrainerSentOutText'||e.name==='text:EnemyMonFaintedText')).toBe(false);
  });
  it.each(['enemy','player'])('$0-first trainer double faint with reserves chooses before replacing the enemy',first=>{
    const r=faintRig();r.s.wBattleMonHP=0;r.s.wEnemyMonHP=0;r.s.mem[D.wPartyGainExpFlags]=3;r.s.wFirstMonsNotOutYet=1;
    const input:GameButton[][]=[['down'],['a']];r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    r.start(first==='enemy'?handleEnemyMonFainted(r.s,r.host):handlePlayerMonFainted(r.s,r.host));r.finish();
    expect(input).toEqual([]);expect(r.driver.result).toBe('loop');expect(r.s.wPlayerMonNumber).toBe(1);expect(r.s.wEnemyMonPartyPos).toBe(1);
    expect(r.events.filter(e=>e.name==='text:PlayerMonFaintedText')).toHaveLength(first==='player'?1:0);
    const sent=r.events.filter(e=>e.name.startsWith('text:')&&(e.name==='text:GoText'||e.name==='text:TrainerSentOutText'));
    expect(sent.map(e=>e.name)).toEqual(['text:GoText','text:TrainerSentOutText']);expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
  });
  it('player-first wild faint can escape with run result2 instead of choosing',()=>{
    const r=faintRig(1);r.s.wBattleMonHP=0;r.s.wEnemyMonHP=30;r.s.writeBE(D.wPartyMon1Speed,200);
    const input:GameButton[][]=[['b']];r.host.readJoypad=()=>{const keys=input.shift()??[];vi.mocked(isPassPressed).mockImplementation(key=>keys.includes(key));};
    r.start(handlePlayerMonFainted(r.s,r.host));r.finish();expect(input).toEqual([]);expect(r.driver.result).toBe('end');
    expect(r.s.wBattleResult).toBe(2);expect(r.s.wPlayerMonNumber).toBe(0);expect(r.s.wNumRunAttempts).toBe(1);
    expect(r.events.some(e=>e.name==='text:GotAwayText')).toBe(true);
  });
});
