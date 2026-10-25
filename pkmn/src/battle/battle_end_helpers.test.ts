import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false), isHeld: vi.fn(() => false), syncJoypadRead() {} }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width:128 }), loadTileset: async () => ({ width:128 }) }));
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { A, BattleState, encodeText } from './battle_state';
import { D, endCells } from './battle_end_state';
import { anyPartyAlive, anyEnemyPokemonAliveCheck, hasMonFainted, flagAction } from './battle_end_helpers';
import { HAPPINESS_CHANGES, PIKACHU_MOODS, isThisPartyMonStarterPikachu, isThisBoxMonStarterPikachu,
  isStarterPikachuAliveInOurParty, modifyPikachuHappiness, updatePikachuMoodAfterBattle } from './battle_pikachu';
import { playCryCue, playPikachuClipCue } from './battle_voice_cues';
import { finish } from '../test/battle_hp_rig';
import { BattleMenuScreen } from './battle_menu_screen';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { isHeld } from '../input';
import { lowHealthAlarm, setLowHealthAlarm } from '../audio/low_health_alarm';

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); vi.mocked(isHeld).mockReturnValue(false); });
function starter(slot = 1): BattleState {
  const s = new BattleState(); s.random = () => { throw new Error('unexpected RNG'); };
  s.mem[D.wPartyCount] = 2; s.setBytes(D.wPartySpecies, [3, 0x54, 255], 3);
  s.wWhichPokemon = slot; s.writeBE(D.wPlayerID, 0x1234);
  s.setBytes(D.wPlayerName, encodeText('ASHXYZZ@'), 11);
  s.mem[D.wPartyMons + 44] = 0x54; s.writeBE(D.wPartyMons + 44 + 12, 0x1234);
  s.writeBE(D.wPartyMons + 44 + 1, 1); s.setBytes(D.wPartyMonOT + 11, encodeText('ASHXYAA@'), 11);
  return s;
}
describe('unused end-state address view', () => {
  it('covers every name in note70 section9.1.7, pins symbols and shares every alias byte', () => {
    const root = resolve(__dirname, '../../..');
    const note = readFileSync(resolve(root, 'notes/70-a5c3d-plan.md'), 'utf8')
      .split('#### 9.1.7 Item 7')[1].split('#### 9.1.8')[0];
    const sym = execFileSync('git', ['-C', resolve(root, 'refs/pokeyellow'), 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8' });
    const s = new BattleState(), c = endCells(s); let groups = 0;
    for (const [, hex, names] of note.matchAll(/\| `\$([0-9A-F]{4})` \| (.*?) \|/g)) {
      const address = parseInt(hex, 16); groups++;
      for (const [, name] of names.matchAll(/`(\w+)`/g)) {
        const key = name as keyof typeof D;
        expect(D[key], name).toBe(address); expect(sym).toMatch(new RegExp(`^\\w+:${hex.toLowerCase()} ${name}$`, 'm'));
        c[key] = 0x1a5; expect(s.mem[address]).toBe(0xa5); expect(c[key]).toBe(0xa5);
        s.mem[address] = 0x5a; expect(c[key]).toBe(0x5a);
      }
    }
    expect(groups).toBe(149);
    for (const [name, address] of Object.entries(A)) expect(D[name as keyof typeof A]).toBe(address);
    c.wPokedexNum = 7; expect(s.wNamedObjectIndex).toBe(7);
    c.wOutOfBattleBlackout = 1; expect(c.wChosenMenuItem).toBe(1);
    s.mem.fill(0xa5, 0xd05e, 0xd079); s.mem.fill(0, D.wBattleStatusData, D.wBattleStatusDataEnd);
    expect([...s.mem.slice(0xd05e, 0xd079)]).toEqual([0xa5, ...Array(24).fill(0), 0xa5, 0xa5]);
  });
});

describe('flags and living-party helpers', () => {
  it('FlagAction reset/set/read keeps the resulting byte or unnormalised bit mask and crosses byte/page boundaries', () => {
    const s = new BattleState(); s.mem[0xd0ff] = 0xa5; s.mem[0xd100] = 0x80;
    expect(flagAction(s, 0xd0ff, 2, 7)).toBe(0x80);
    expect(flagAction(s, 0xd0ff, 0, 0)).toBe(0xa4);
    expect(flagAction(s, 0xd0ff, 1, 9)).toBe(0x82);
    expect(flagAction(s, 0xd0ff, 9, 8)).toBe(0x83); // every nonzero action except2 sets
    expect(s.mem[0xd0ff]).toBe(0xa4); expect(s.mem[0xd100]).toBe(0x83);
  });
  it.each(['player', 'enemy'] as const)('%s ORs both bytes in every counted HP word and ignores a living uncounted member', side => {
    const s = new BattleState(), count = side === 'player' ? D.wPartyCount : D.wEnemyPartyCount;
    const base = side === 'player' ? D.wPartyMons : D.wEnemyMons;
    s.mem[count] = 3; s.writeBE(base + 1, 0x0100); s.writeBE(base + 45, 2); s.writeBE(base + 89, 0x8004);
    s.writeBE(base + 133, 0xffff); const before = s.mem.slice();
    expect(side === 'player' ? anyPartyAlive(s) : anyEnemyPokemonAliveCheck(s))
      .toEqual(side === 'player' ? { d: 0x87, zero: false } : { a: 0x87, zero: false });
    expect(Buffer.from(s.mem).equals(Buffer.from(before))).toBe(true);
    s.mem.fill(0, base + 1, base + 91);
    expect((side === 'player' ? anyPartyAlive(s) : anyEnemyPokemonAliveCheck(s)).zero).toBe(true);
  });
  it('count0 preserves the cartridge 256-iteration loop, including enemy address wrap', () => {
    const s = new BattleState(); s.mem[(D.wEnemyMons + 1 + 255 * 44) & 65535] = 0x80;
    expect(anyEnemyPokemonAliveCheck(s)).toEqual({ a: 0x80, zero: false });
  });
  it.each([0, 1])('HasMonFainted has the correct selected slot/text gate, firstMons=%i, on the real printer', first => {
    const s = new BattleState(), video = new BattleMenuScreen(); s.wWhichPokemon = 1; s.wFirstMonsNotOutYet = first;
    s.writeBE(D.wPartyMons + 1, 5); const before = s.mem.slice(), texts: string[] = [];
    const p = hasMonFainted(s, { printText: function* (name) { texts.push(name); yield* video.printText(name); } });
    let time = 0;
    const result = finish(p, frame => { expect(frame).toBe('serviced'); time++;
      vi.mocked(isHeld).mockImplementation(key => key === 'a' && time % 8 === 0); video.vblank(); });
    expect(result.result).toEqual({ zero: true }); expect(texts).toEqual(first ? [] : ['NoWillText']);
    expect(result.frames.length > 0).toBe(!first); expect(Buffer.from(s.mem).equals(Buffer.from(before))).toBe(true);
    s.writeBE(D.wPartyMons + 45, 256);
    expect(finish(hasMonFainted(s, { printText: function* () { throw new Error('unexpected text'); } })))
      .toEqual({ result: { zero: false }, frames: [] });
  });
});

describe('source-shaped Pikachu gates and happiness', () => {
  it('party and box compare species, both ID bytes and exactly five OT bytes, independent of HP', () => {
    const s = starter(); expect(isThisPartyMonStarterPikachu(s)).toBe(true);
    s.mem[D.wPartyMonOT + 11 + 4] ^= 1; expect(isThisPartyMonStarterPikachu(s)).toBe(false);
    s.mem[D.wPartyMonOT + 11 + 4] ^= 1;
    s.mem[D.wPartyMons + 44 + 13] ^= 1; expect(isThisPartyMonStarterPikachu(s)).toBe(false);
    s.mem[D.wPartyMons + 44 + 13] ^= 1; s.writeBE(D.wPartyMons + 45, 0);
    expect(isThisPartyMonStarterPikachu(s)).toBe(true); expect(isStarterPikachuAliveInOurParty(s)).toBe(false);
    s.mem.set(s.mem.slice(D.wPartyMons + 44, D.wPartyMons + 77), D.wBoxMons + 33);
    s.mem.set(s.mem.slice(D.wPartyMonOT + 11, D.wPartyMonOT + 22), D.wBoxMonOT + 11);
    expect(isThisBoxMonStarterPikachu(s)).toBe(true);
    s.mem[D.wBoxMons + 33] = 3; expect(isThisBoxMonStarterPikachu(s)).toBe(false);
  });
  it('living search uses list species, stops at sentinel and stops on the first matching fainted identity', () => {
    const s = starter(); s.mem[D.wPartyMons + 44] = 3; expect(isStarterPikachuAliveInOurParty(s)).toBe(true);
    s.mem[D.wPartySpecies] = 255; expect(isStarterPikachuAliveInOurParty(s)).toBe(false);
    s.mem[D.wPartySpecies] = 3; s.writeBE(D.wPartyMons + 45, 0);
    s.mem[D.wPartySpecies + 2] = 0x54; s.mem[D.wPartySpecies + 3] = 255;
    s.mem.set(s.mem.slice(D.wPartyMons + 44, D.wPartyMons + 88), D.wPartyMons + 88);
    s.writeBE(D.wPartyMons + 89, 10); s.mem.set(s.mem.slice(D.wPartyMonOT + 11, D.wPartyMonOT + 22), D.wPartyMonOT + 22);
    expect(isStarterPikachuAliveInOurParty(s)).toBe(false);
  });
  it('identity compares the high OT-ID byte and raw name bytes even after a terminator', () => {
    const s = starter(); s.mem[D.wPartyMons + 44 + 12] ^= 1;
    expect(isThisPartyMonStarterPikachu(s)).toBe(false); s.mem[D.wPartyMons + 44 + 12] ^= 1;
    s.setBytes(D.wPlayerName,[0x80,0x50,1,2,3],5); s.setBytes(D.wPartyMonOT+11,[0x80,0x50,1,2,3],5);
    expect(isThisPartyMonStarterPikachu(s)).toBe(true); s.mem[D.wPartyMonOT+15] = 4;
    expect(isThisPartyMonStarterPikachu(s)).toBe(false);
  });
  it.each([0, 1, 99, 100, 199, 200, 254, 255])('all eleven events at happiness%i use source bands, saturation and exact mood targets', happiness => {
    const changes = [[5,3,2],[5,3,2],[1,1,0],[3,2,1],[1,1,0],[2,1,1],[-3,-3,-5],[-1,-1,-1],[-5,-5,-10],[-5,-5,-10],[-10,-10,-20]];
    const moods = [138,131,128,128,148,128,98,108,98,108,0];
    for (let event = 1; event <= 11; event++) for (const mood of [0, 97, 108, 128, 255]) for (const modifier of [0, 5]) {
      const s = starter(); s.mem[D.wPikachuHappiness] = happiness; s.mem[D.wPikachuMood] = mood; s.mem[D.wPikachuEmotionModifier] = modifier;
      const before = s.mem.slice(); modifyPikachuHappiness(s, event);
      const target = moods[event - 1], expectedMood = target === 128 ? mood : target < 128 ? Math.min(mood, target) : modifier ? mood : Math.max(mood, target);
      const result = Math.max(0, Math.min(255, happiness + changes[event - 1][happiness < 100 ? 0 : happiness < 200 ? 1 : 2]));
      expect([s.mem[D.wPikachuHappiness], s.mem[D.wPikachuMood]]).toEqual([result, expectedMood]);
      before[D.wPikachuHappiness] = result; before[D.wPikachuMood] = expectedMood;
      expect(Buffer.from(s.mem).equals(Buffer.from(before))).toBe(true);
    }
    expect(HAPPINESS_CHANGES).toEqual(changes); expect(PIKACHU_MOODS).toEqual(moods);
  });
  it('GYMLEADER/WALKING gate anywhere living; selected events gate identity even when fainted', () => {
    const s = starter(0); s.mem[D.wPikachuHappiness] = 100;
    modifyPikachuHappiness(s, 1); expect(s.mem[D.wPikachuHappiness]).toBe(100);
    modifyPikachuHappiness(s, 4); expect(s.mem[D.wPikachuHappiness]).toBe(102);
    modifyPikachuHappiness(s, 6); expect(s.mem[D.wPikachuHappiness]).toBe(103);
    s.writeBE(D.wPartyMons + 45, 0); modifyPikachuHappiness(s, 4); expect(s.mem[D.wPikachuHappiness]).toBe(103);
    s.wWhichPokemon = 1; modifyPikachuHappiness(s, 8); expect(s.mem[D.wPikachuHappiness]).toBe(102);
  });
  it.each([0, 127, 128, 130, 255])('post-battle mood clamp preserves both D branches, target%i and living gate', target => {
    for (const mood of [0, 127, 128, 130, 255]) {
      const s = starter(); s.mem[D.wPikachuMood] = mood; updatePikachuMoodAfterBattle(s, target);
      expect(s.mem[D.wPikachuMood]).toBe(target >= 128 ? Math.max(mood, target) : Math.min(mood, target));
      s.writeBE(D.wPartyMons + 45, 0); s.mem[D.wPikachuMood] = mood; updatePikachuMoodAfterBattle(s, target);
      expect(s.mem[D.wPikachuMood]).toBe(mood);
    }
  });
});

it('voice cue ledger: cry brackets the owner alarm at0 frames; clip waits3 then clears SFX IDs without touching alarm', () => {
  let frame = 0; setLowHealthAlarm(0x9e); const log: unknown[] = [];
  const host = { getAlarm: lowHealthAlarm, setAlarm: (v: number) => { setLowHealthAlarm(v); log.push([frame, 'alarm', v]); },
    cry: (id: number) => { log.push([frame, 'cry', id, lowHealthAlarm()]); }, clip: (id: number) => { log.push([frame, 'clip', id, lowHealthAlarm()]); },
    clearSfxIds: () => { log.push([frame, 'clearSfxIds', lowHealthAlarm()]); } };
  playCryCue(host, 84);
  const result = finish(playPikachuClipCue(host, 37), kind => { frame++; log.push([frame, kind]); });
  expect(result.frames).toEqual(['serviced', 'serviced', 'serviced']);
  expect(log).toEqual([[0,'alarm',0],[0,'cry',84,0],[0,'alarm',158],[1,'serviced'],[2,'serviced'],[3,'serviced'],[3,'clip',37,158],[3,'clearSfxIds',158]]);
  expect(lowHealthAlarm()).toBe(158); setLowHealthAlarm(0);
});
