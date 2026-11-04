import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
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
import { resetListStateForEmptySlot } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { setKey, updateInput, syncJoypadRead } from '../input';
import { loadBattleSessionData, createBattleSession, createSessionRandom, getSavedEndBattleTextPointer } from './battle_session';
import { A, BattleState, encodeText, NAME_BUFFER_LENGTH } from './battle_state';
import { D } from './battle_end_state';
import { writeBattleInputs, W_STATUS_FLAGS3, type BattleWorld } from './battle_bridge';
import { saveTrainerName, TRAINER_NAME_POINTERS } from './battle_trainer_party';
import { decodeBattleText } from './battle_text_codec';
import type { GameButton } from '../core';

const keys: GameButton[] = ['a','b','up','down','left','right','start','select'];
const decode = async (file: string) => { const p = PNG.sync.read(readFileSync('static/' + file)); return { width:p.width, height:p.height, data:p.data }; };
beforeAll(async () => { await loadBattleData(); await loadTextPrograms(); await loadBattleSessionData(decode); });
beforeEach(() => {
  keys.forEach(k => setKey(k,false)); updateInput(); syncJoypadRead(); resetListStateForEmptySlot();
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setLowHealthChannel5(0);
});
function pikachu(level = 20) {
  const mon = createPokemon(25,level,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;
  mon.moves = [{id:'TACKLE',pp:35,maxPp:35}]; return mon;
}
const forestText = {win:'ViridianForestYoungster2EndBattleText',lose:'ViridianForestYoungster2EndBattleText'};
const rivalText = {win:'OaksLabRivalIPickedTheWrongPokemonText',lose:'OaksLabRivalAmIGreatOrWhatText'};
function setup(overrides: Partial<BattleWorld> = {}) {
  const r = rig(); let time = 0;
  const banks = new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank) => {
    const name = musicNameForSound(id,bank); if (!name) throw new Error(`unexpected music ${id}:${bank}`);
    r.music.play(musicData(name));
  }));
  const world = battleWorld({opponent:202,mapName:'ViridianForest',party:[pikachu()],
    options:{textSpeed:'FAST',animation:'OFF',battleStyle:'SET'},endBattleText:forestText,...overrides});
  setPlayerName(world.playerName); setRivalName(world.rivalName);
  const session = createBattleSession(world,{random:createSessionRandom(() => time),audio:() => ({sfx:r.sfx,music:r.music,banks})});
  const pages: string[] = [], moneySound: boolean[] = [], turns: number[] = [], sends: number[] = [];
  let moneySeen = false, previousTurn = 0, previousSend = 0;
  const start = () => { banks.playMusic(musicIdentity('trainerbattle')!); session.start(); };
  const tick = (pressed: GameButton[] = []) => {
    time++; keys.forEach(k => setKey(k,pressed.includes(k))); updateInput(); r.update(); expect(() => session.tick()).not.toThrow();
    const logs = session.textLog;
    if (!moneySeen && logs.some(row => row.label === 'MoneyForWinningText')) {
      moneySeen = true; moneySound.push(r.sfx.isPlaying());
    }
    const sent = logs.filter(row => row.label === 'TrainerSentOutText').length;
    if (sent !== previousSend) { previousSend = sent; sends.push(session.state.wEnemyMonPartyPos); }
    // wAILayer2Encouragement is reset on replacement; count its increases across the battle.
    const turn = session.state.wAILayer2Encouragement;
    if (turn > previousTurn) turns.push(turn); previousTurn = turn;
    if (session.video.textBox.active && session.video.textBox.isWaitingForInput) {
      const cells = session.screen.cells;
      const page = [14,16].map(y => cells.slice(y*20+1,y*20+19).map(c => typeof c === 'string' ? c : ' ').join('').replace(/▼/g,'').trim()).join(' / ');
      if (pages[pages.length-1] !== page) pages.push(page);
    }
  };
  const drive = () => {
    start();
    for (let n = 0; !session.done && n < 10000; n++) {
      let pressed: GameButton[] = [];
      if (time%2 === 0) {
        const yesNo = !session.video.textBox.active && session.screen.at(0,7) === '┌';
        pressed = yesNo || session.video.textBox.isWaitingForInput ? ['b'] : ['a'];
      }
      tick(pressed);
    }
    expect(session.done,JSON.stringify({time,text:session.textLog.slice(-5),pages:pages.slice(-5)})).toBe(true);
    return session.finish();
  };
  return {r,session,world,pages,moneySound,turns,sends,start,tick,drive};
}
it('Forest SET win uses both Caterpies, real trainer AI and the named end program before money', () => {
  const h = setup(), result = h.drive(), labels = h.session.textLog.map(row => row.label);
  expect(result.exit).toBe('end'); expect(result.outcome.battleResult).toBe(0); expect(result.outcome.money).toBe(3070);
  expect(h.sends).toEqual([0,1]); expect(labels).not.toContain('TrainerAboutToUseText');
  expect(h.session.trainerAILog).toHaveLength(h.turns.length); expect(h.turns.length).toBeGreaterThan(0);
  expect(h.session.trainerAILog.every(call => call.frames === 0 && call.carry === false)).toBe(true);
  expect(h.session.handoffs.other).toBe(0);
  expect(labels.indexOf('TrainerEndBattleText')).toBeGreaterThan(labels.indexOf('TrainerDefeatedText'));
  expect(labels.indexOf('MoneyForWinningText')).toBeGreaterThan(labels.indexOf('TrainerEndBattleText'));
  expect(h.pages,JSON.stringify(h.pages)).toContain('BUG CATCHER: No! / CATERPIE can\'t'); expect(h.pages).toContain('CATERPIE can\'t / cut it!');
  expect(h.session.state.mem[W_STATUS_FLAGS3]&0x80).toBe(0); expect(h.moneySound).toEqual([false]);
  expect(h.session.textLog.every(row => row.complete)).toBe(true);
});
it('PrintEndBattleText skips saved labels when the bit is clear', () => {
  const h = setup(); h.session.state.mem[W_STATUS_FLAGS3] &= ~0x80;
  const result = h.drive(); expect(result.exit).toBe('end'); expect(result.outcome.money).toBe(3070);
  expect(h.session.textLog.map(row => row.label)).not.toContain('TrainerEndBattleText');
});
it('writeBattleInputs sets only bit7 when end labels are present', () => {
  const h = setup(), s = h.session.state;
  s.mem[W_STATUS_FLAGS3] = 0x55; writeBattleInputs(s,h.world); expect(s.mem[W_STATUS_FLAGS3]).toBe(0xd5);
});
it('Forest SHIFT win with two player mons answers NO and sends the second Caterpie, paying3070', () => {
  const h = setup({party:[pikachu(),pikachu()],options:{textSpeed:'FAST',animation:'OFF',battleStyle:'SHIFT'}});
  const result = h.drive(); expect(result.exit).toBe('end'); expect(result.outcome.money).toBe(3070);
  expect(h.session.textLog.filter(row => row.label === 'TrainerAboutToUseText')).toHaveLength(1);
  expect(h.sends).toEqual([0,1]); expect(h.session.state.wPlayerMonNumber).toBe(0); expect(h.session.handoffs.other).toBe(0);
});
it('Oak lab rival loss returns without end text, carry or money loss, retaining the unconsumed bit', () => {
  const mon = pikachu(5); mon.currentHp = 1;
  const h = setup({opponent:225,mapName:'OaksLab',party:[mon],endBattleText:rivalText}), result = h.drive();
  expect(result.exit).toBe('end'); expect(result.blackoutCarry).toBe(false);
  expect(result.outcome.battleResult).toBe(1); expect(result.outcome.money).toBe(3000);
  const labels = h.session.textLog.map(row => row.label);
  expect(labels).toContain('Rival1WinText'); expect(labels).not.toContain('TrainerEndBattleText');
  expect(h.session.state.mem[W_STATUS_FLAGS3]&0x80).toBe(0x80); expect(h.session.handoffs.other).toBe(0);
});
it('a trainer world without end text clears a stale bit on input and prints no end text', () => {
  const h = setup({endBattleText:undefined}), s = h.session.state;
  s.mem[W_STATUS_FLAGS3] = 0xd5; writeBattleInputs(s,h.world); expect(s.mem[W_STATUS_FLAGS3]).toBe(0x55);
  const result = h.drive(); expect(result.exit).toBe('end'); expect(result.outcome.money).toBe(3070);
  expect(h.session.textLog.map(row => row.label)).not.toContain('TrainerEndBattleText');
  expect(s.mem[W_STATUS_FLAGS3]&0x80).toBe(0);
});
it('lab rival win prints the saved rival name and his actual win program', () => {
  const h = setup({opponent:225,mapName:'OaksLab',endBattleText:rivalText}); const result = h.drive();
  expect(result.outcome.money).toBe(3175); expect(h.pages,JSON.stringify(h.pages)).toContain('GARY: WHAT? / Unbelievable!');
  expect(h.pages).toContain('I picked the / wrong POKéMON!');
});
it('GetSavedEndBattleTextPointer selects win only for zero, retaining the otherwise unreachable lose branch', () => {
  const s = new BattleState();
  for (const result of [0,1,2,255]) { s.wBattleResult = result; expect(getSavedEndBattleTextPointer(s,rivalText)).toBe(result===0?rivalText.win:rivalText.lose); }
});
it('SaveTrainerName copies Bug Catcher and rival through @, retaining bytes after it', () => {
  const s = new BattleState(); s.mem.fill(0xab,A.wNameBuffer,A.wNameBuffer+20); s.mem[D.wTrainerClass]=2;
  saveTrainerName(s); expect([...s.mem.slice(A.wNameBuffer,A.wNameBuffer+13)]).toEqual([...encodeText('BUG CATCHER@'),0xab]);
  s.mem[D.wTrainerClass]=25; s.mem.set(encodeText('GARY@'),D.wTrainerName); saveTrainerName(s);
  expect([...s.mem.slice(A.wNameBuffer,A.wNameBuffer+6)]).toEqual([...encodeText('GARY@'),encodeText('A')[0]]);
  s.mem[D.wTrainerClass]=31; saveTrainerName(s);
  expect(decodeBattleText(s.mem,A.wNameBuffer,NAME_BUFFER_LENGTH)).toBe('COOLTRAINER♂');
});
it.skipIf(!process.env.ROM_PATH)('SaveTrainerName table matches all47 ROM rows found from the routine operand', () => {
  const rom = readFileSync(process.env.ROM_PATH!);
  const signature = Buffer.from([0xfa,0x30,0xd0,0x3d,0x4f,0x06,0x00,0x09,0x09,0x2a,0x66,0x6f,0x11,0x6d,0xcd]);
  const at = rom.indexOf(signature); expect(at).toBeGreaterThan(2); expect(rom.indexOf(signature,at+1)).toBe(-1);
  expect(rom[at-3]).toBe(0x21);
  const bank = Math.floor(at/0x4000), table = bank*0x4000+((rom[at-2]|rom[at-1]<<8)&0x3fff);
  expect(TRAINER_NAME_POINTERS).toHaveLength(47);
  for (let cls=1;cls<=47;cls++) {
    const pointer = rom[table+2*(cls-1)] | rom[table+2*(cls-1)+1]<<8;
    if (TRAINER_NAME_POINTERS[cls-1]==='wTrainerName') { expect(pointer,`class${cls}`).toBe(0xd049); continue; }
    const s = new BattleState(); s.mem[D.wTrainerClass]=cls; saveTrainerName(s);
    const start=bank*0x4000+(pointer&0x3fff), end=rom.indexOf(0x50,start)+1;
    expect([...s.mem.slice(A.wNameBuffer,A.wNameBuffer+end-start)],`class${cls}`).toEqual([...rom.subarray(start,end)]);
  }
});
