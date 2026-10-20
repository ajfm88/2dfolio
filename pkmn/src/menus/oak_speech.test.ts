import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { OakSpeech } from './oak_speech';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { isHeld, isPassPressed, readJoypad, syncJoypadRead } from '../input';
import { playSFX } from '../audio';
import { fillRect, drawSprite, loadTileset, loadSpriteMapped, setActivePalette } from '../renderer';
import { getBorderCanvas } from '../text';
import { textBgTransfer } from '../text/bg_transfer';
import { rig, musicData, sfxData } from '../test/audio_rig';
import { stopMusic, playMusic, fadeOutAndStopMusic } from '../audio';
import { setPlayerName, setRivalName } from '../core/player_state';
import type { GameButton } from '../core';

vi.mock('../input', () => ({ isHeld: vi.fn(), isPassPressed: vi.fn(), readJoypad: vi.fn(), syncJoypadRead: vi.fn(), isPressed: () => false }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true, stopMusic: vi.fn(), playMusic: vi.fn(), fadeOutAndStopMusic: vi.fn() }));
vi.mock('../renderer', () => ({ clear: vi.fn(), fillRect: vi.fn(), drawTile: vi.fn(), drawFadeOverlay: vi.fn(),
  setActivePalette: vi.fn(), getScale: () => 1, getCtx: () => ({ drawImage() {}, save() {}, restore() {}, translate() {}, scale() {} }),
  loadSpriteMapped: vi.fn(async (_url: string, mapping: readonly number[], palette: string) => ({ mapping, palette })),
  obpMapping: (reg: number) => [0, 1, 2, 3].map(c => (reg >> (2 * c)) & 3), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: vi.fn(async (url: string, palette?: string) => ({ width: 56, height: 56, url, palette })) }));
vi.mock('./intro_screen_render', () => ({ introPictureCanvas: (source: unknown) => source, renderIntroScreen: (_s: unknown, _p: unknown, draw: () => void) => draw() }));
vi.mock('./menu_render', () => ({ drawText: vi.fn(), drawChar: vi.fn(), drawBox: vi.fn() }));

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { vi.clearAllMocks(); setTextSpeed('fast'); setPlayerName('YELLOW'); setRivalName('BLUE'); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
const lastOf = <T>(items: readonly T[]): T => items[items.length - 1];
const boxOf = (speech: OakSpeech) => Reflect.get(speech, 'textBox') as TextBox;
const screenOf = (box: TextBox) => Reflect.get(box, 'screen') as { buffer: string[]; waiting: boolean } | null;
const stageOf = (speech: OakSpeech) => speech.inspection.stage;
const menuOf = (speech: OakSpeech) => speech.inspection.menu!;

/** Drive the public sequence with button levels; each real read computes its own edge. */
async function scene() {
  let held: GameButton[] = [], last: GameButton[] = [], pressed: GameButton[] = [], frame = 0;
  vi.mocked(isHeld).mockImplementation(k => held.includes(k));
  vi.mocked(isPassPressed).mockImplementation(k => pressed.includes(k));
  vi.mocked(readJoypad).mockImplementation(() => { pressed = held.filter(k => !last.includes(k)); last = [...held]; });
  vi.mocked(syncJoypadRead).mockImplementation(() => { last = [...held]; pressed = []; });
  const cues: { species: string; text: string }[] = [];
  const speech = new OakSpeech(species => cues.push({ species, text: screenOf(boxOf(speech))!.buffer.join('') }));
  await speech.load(); speech.start();
  const box = boxOf(speech);
  const prints: { program: string; frame: number; firstGlyph: number; firstRead: number; readBase: number }[] = [];
  const print = box.printStandalone.bind(box);
  vi.spyOn(box, 'printStandalone').mockImplementation((source, opts) => {
    if ('program' in source) prints.push({ program: source.program, frame, firstGlyph: -1, firstRead: -1, readBase: vi.mocked(syncJoypadRead).mock.calls.length });
    print(source, opts);
  });
  const seen = new Set<string>();
  function step(keys: GameButton[] = []) {
    frame++; held = keys;
    const action = speech.update();
    const entry = prints[prints.length - 1], screen = screenOf(box);
    if (screen) seen.add(screen.buffer.join(''));
    if (entry && screen) {
      if (entry.firstGlyph < 0 && screen.buffer[41] !== ' ') entry.firstGlyph = frame;
      if (entry.firstRead < 0 && vi.mocked(syncJoypadRead).mock.calls.length > entry.readBase) entry.firstRead = frame;
    }
    return action;
  }
  function auto(button: 'a' | 'b' = 'b') {
    if (stageOf(speech).endsWith(':menu')) return step(menuOf(speech).item === 0 ? ['down'] : ['a']);
    return step(box.isWaitingForInput && !box.isComplete && frame % 2 === 0 ? [button] : []);
  }
  function until(predicate: () => boolean, button: 'a' | 'b' = 'b') {
    for (let i = 0; !predicate() && i < 12000; i++) auto(button);
    expect(predicate()).toBe(true);
  }
  function namingWait(frames: number) { for (let i = 0; i < frames; i++) { frame++; textBgTransfer.tick(); } }
  return { speech, box, prints, cues, seen, step, auto, until, namingWait, get frame() { return frame; } };
}

describe('Oak speech on standalone PrintText (A5b6 CP4)', () => {
  it.each(['OakSpeechText1', 'OakSpeechText2', 'IntroducePlayerText', 'YourNameIsText',
    'IntroduceRivalText', 'HisNameIsText', 'OakSpeechText3'])('%s: border at T, first glyph and first read at +3', async program => {
    const r = await scene(); r.until(() => r.prints.some(p => p.program === program));
    const entry = r.prints[r.prints.length - 1];
    expect(r.box.active).toBe(true); expect(r.box.displaySession).toBe(false);
    vi.mocked(fillRect).mockClear(); r.box.render(); expect(fillRect).toHaveBeenCalled();
    expect(screenOf(r.box)!.buffer[41]).toBe(' ');
    r.step(); r.step(); expect(screenOf(r.box)!.buffer[41]).toBe(' '); expect(entry.firstRead).toBe(-1);
    r.step(); expect(entry.firstGlyph - entry.frame).toBe(3); expect(entry.firstRead - entry.frame).toBe(3);
  });

  it('Pikachu prints 2A, declares one cry, then reaches all of 2B and its para/prompt arrows', async () => {
    const r = await scene(); r.until(() => r.prints.some(p => p.program === 'OakSpeechText2') && stageOf(r.speech) === 'fade:out');
    expect(r.cues).toHaveLength(1); expect(r.cues[0].species).toBe('PIKACHU');
    expect(r.cues[0].text).toContain('creatures called');
    expect(r.cues[0].text).toContain('POKéMON!');
    expect([...r.seen].some(s => s.includes('For some people,'))).toBe(true);
    expect([...r.seen].some(s => s.includes('Myself...'))).toBe(true);
    expect([...r.seen].some(s => s.includes('as a profession.'))).toBe(true);
    expect([...r.seen].some(s => s.includes('creatures called') && s.includes('POKéMON!') && s[98] === '▼')).toBe(true);
    expect([...r.seen].some(s => s.includes('as a profession.') && s[98] === '▼')).toBe(true);
  });

  it('all four fades keep the box until ClearScreen, with one BG transfer per retained tick', async () => {
    const r = await scene();
    for (const program of ['OakSpeechText1', 'OakSpeechText2', 'YourNameIsText', 'HisNameIsText']) {
      r.until(() => lastOf(r.prints)?.program === program && stageOf(r.speech) === 'fade:out');
      const transfer = vi.spyOn(r.box, 'updateDisplay');
      for (let i = 1; i < 24; i++) { r.step(); expect(r.box.active).toBe(true); }
      r.step(); expect(r.box.active).toBe(false); expect(transfer).toHaveBeenCalledTimes(24); transfer.mockRestore();
    }
  });

  it.each(['player', 'rival'])('%s preset keeps the prompt through the slide back', async target => {
    const r = await scene(); r.until(() => stageOf(r.speech) === `${target}:back`);
    expect(r.box.active).toBe(true);
    const content = screenOf(r.box)!.buffer.join('');
    while (stageOf(r.speech) === `${target}:back`) {
      expect(r.box.active).toBe(true); expect(screenOf(r.box)!.buffer.join('')).toBe(content); r.step();
    }
    expect(r.box.active).toBe(true); expect(r.prints[r.prints.length - 1].program).toBe(target === 'player' ? 'YourNameIsText' : 'HisNameIsText');
  });

  it.each(['player', 'rival'])('%s custom name: blank at return, box at +13, glyph at +16', async target => {
    const r = await scene(); r.until(() => stageOf(r.speech) === `${target}:menu`);
    r.step(); r.step(); expect(r.step(['a'])).toEqual({ type: 'openNamingScreen', target });
    r.speech.continueAfterNaming(target === 'player' ? 'RED' : 'GREEN'); const returned = r.frame;
    expect(r.box.active).toBe(false); expect(r.speech.inspection.cells.some(c => typeof c === 'number')).toBe(false);
    for (let i = 1; i < 13; i++) { r.step(); expect(r.box.active).toBe(false); expect(r.speech.inspection.cells.some(c => typeof c === 'number')).toBe(false); }
    r.step(); expect(r.box.active).toBe(true); expect(r.speech.inspection.cells.some(c => typeof c === 'number')).toBe(true);
    expect(r.prints[r.prints.length - 1].frame - returned).toBe(13);
    r.step(); r.step(); r.step(); expect(r.prints[r.prints.length - 1].firstGlyph - returned).toBe(16);
  });

  it('Text3 goes into shrink on its return tick without a press or beep; the box lasts to ClearScreen', async () => {
    const r = await scene(); r.until(() => stageOf(r.speech) === 'text:OakSpeechText3');
    r.until(() => screenOf(r.box)!.buffer.join('').includes("awaits! Let's go!"));
    const sounds = vi.mocked(playSFX).mock.calls.length;
    for (let i = 0; stageOf(r.speech) === 'text:OakSpeechText3' && i < 3; i++) r.step();
    expect(r.box.isTextComplete).toBe(true); expect(r.box.isComplete).toBe(true); expect(stageOf(r.speech)).toBe('shrink');
    expect(vi.mocked(playSFX).mock.calls.slice(sounds)).toEqual([['shrink']]); expect(r.box.active).toBe(true);
    const returned = r.frame;
    while (r.frame - returned < 122) { r.step(); expect(r.box.active).toBe(true); }
    r.step(); expect(r.box.active).toBe(false);
    r.step(); r.step(); expect(r.step()).toEqual({ type: 'done' });
  });

  it('name menu waits three frames, ignores B silently, does not wrap, and A beeps once', async () => {
    const r = await scene(); r.until(() => stageOf(r.speech) === 'player:menu');
    const reads = vi.mocked(readJoypad).mock.calls.length, sounds = vi.mocked(playSFX).mock.calls.length;
    r.step(['up']); r.step(['up']); expect(vi.mocked(readJoypad).mock.calls.length).toBe(reads);
    r.step(['up']); expect(menuOf(r.speech).item).toBe(0);
    r.step(); r.step(); r.step(['b']);
    expect(stageOf(r.speech)).toBe('player:menu'); expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds);
    r.step(); r.step(); expect(vi.mocked(readJoypad).mock.calls.length).toBe(reads + 2);
    for (let i = 0; i < 4; i++) { r.step(['down']); r.step(); r.step(); r.step(); }
    expect(menuOf(r.speech).item).toBe(3); expect(menuOf(r.speech).cursor).toEqual({ x: 1, y: 8 });
    r.step(['a']); expect(stageOf(r.speech)).toBe('player:back'); expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds + 1);
  });

  it('A held from the prompt is still held at the first name-menu read, requiring release and a new press', async () => {
    const r = await scene(); r.until(() => stageOf(r.speech) === 'player:menu', 'a');
    const sounds = vi.mocked(playSFX).mock.calls.length;
    r.step(['a']); r.step(['a']); expect(r.step(['a'])).toBeNull(); expect(stageOf(r.speech)).toBe('player:menu');
    r.step(); expect(r.step(['a'])).toEqual({ type: 'openNamingScreen', target: 'player' });
    expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds + 1);
  });

  it('the main idle-read guard leaves oak_speech reads to the standalone box and menu', () => {
    const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const guard = source.split('\n').find(line => line.includes('if (!inPassState') && line.includes('syncJoypadRead();'));
    expect(guard).toContain("state !== 'oak_speech'");
  });
});

describe('Intro CP4: CP1 frame table, VBlank before CPU', () => {
  it.each([false, true])('whole %s custom-name path: registers, thirds, slots, slides, text and OAM', async custom => {
    const r = await scene();
    type Snapshot = OakSpeech['inspection'];
    const frames = new Map<number, Snapshot>([[0, r.speech.inspection]]);
    const starts = new Map<string, number>();
    const ends = new Map<string, number>();
    const menus: { open: number; chosen: number; returned: number }[] = [];
    const reads: number[] = [];
    const audio = rig(musicData('routes2')); audio.update();
    let shrink = -1, done = -1, audioReturn = -1;
    vi.mocked(playSFX).mockImplementation(async name => {
      if (name === 'shrink') { shrink = r.frame; audioReturn = audio.synth.update; audio.sfx.play(sfxData('shrink')); }
    });
    vi.mocked(fadeOutAndStopMusic).mockImplementation(control => audio.fade.fadeOutAndStopMusic(control));
    const existingRead = vi.mocked(readJoypad).getMockImplementation()!;
    vi.mocked(readJoypad).mockImplementation(() => { reads.push(r.frame); existingRead(); });
    for (let i = 0; i < 15000 && done < 0; i++) {
      const before = r.speech.inspection;
      audio.update();
      const action = before.menu
        ? r.step(custom || before.menu.item > 0 ? ['a'] : ['down'])
        : r.step(r.box.isWaitingForInput && !r.box.isComplete && r.frame % 2 === 0 ? ['b'] : []);
      const after = r.speech.inspection;
      frames.set(r.frame, after);
      const latest = lastOf(r.prints);
      if (latest && !starts.has(latest.program)) starts.set(latest.program, latest.frame);
      if (before.stage.startsWith('text:') && after.stage !== before.stage) ends.set(before.stage.slice(5), r.frame);
      if (after.menu && !before.menu) menus.push({ open: r.frame, chosen: -1, returned: -1 });
      if (before.menu && !after.menu) lastOf(menus)!.chosen = r.frame;
      if (action?.type === 'openNamingScreen') {
        // Opaque naming owns its own clock; exercise two different nonzero durations.
        r.namingWait(menus.length === 1 ? 17 : 23);
        lastOf(menus)!.returned = r.frame;
        r.speech.continueAfterNaming(action.target === 'player' ? 'RED' : 'GREEN');
        frames.set(r.frame, r.speech.inspection);
      }
      if (action?.type === 'done') done = r.frame;
    }
    expect(done).toBeGreaterThan(0); expect(menus).toHaveLength(2);
    const at = (frame: number) => { const value = frames.get(frame); expect(value, `missing F${frame}`).toBeDefined(); return value!; };
    expect(vi.mocked(stopMusic)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(playMusic).mock.calls).toEqual([['routes2']]);
    expect(at(0).audioRequests).toEqual([{ frame: 0, kind: 'stop', value: 0 }, { frame: 0, kind: 'music', value: 'routes2' }]);

    // CP1 T table: D includes each real source program's three opening waits.
    const names = ['OakSpeechText1', 'OakSpeechText2', 'IntroducePlayerText', 'YourNameIsText',
      'IntroduceRivalText', 'HisNameIsText', 'OakSpeechText3'];
    const t = names.map(name => starts.get(name)!);
    const d = names.map((name, i) => ends.get(name)! - t[i]);
    const mp = menus[0].chosen - menus[0].open, mr = menus[1].chosen - menus[1].open;
    const sum = (n: number) => d.slice(0, n).reduce((a, b) => a + b, 0);
    const np = custom ? 17 : 0, nr = custom ? 23 : 0;
    expect(t).toEqual(custom
      ? [75, 125 + sum(1), 175 + sum(2), 206 + sum(3) + mp + np,
        300 + sum(4) + mp + np, 331 + sum(5) + mp + mr + np + nr, 389 + sum(6) + mp + mr + np + nr]
      : [75, 125 + sum(1), 175 + sum(2), 224 + sum(3) + mp,
        318 + sum(4) + mp, 367 + sum(5) + mp + mr, 425 + sum(6) + mp + mr]);
    for (const print of r.prints) {
      expect(print.firstGlyph - print.frame).toBe(3); expect(print.firstRead - print.frame).toBe(3);
      expect(at(print.frame).cells[240]).toBe('┌');
      const p = at(print.frame).nextPortion;
      const delta = 1 + (2 - p + 3) % 3;
      expect(at(print.frame + delta).visibleCells[240]).toBe('┌');
      expect(at(print.frame + 3 + delta).visibleCells[281]).toBe(at(print.frame + 3).cells[281]);
    }
    // One global phase; each enabled tick advances once, disabled waits leave it frozen.
    for (const [frame, current] of frames) {
      const prev = frames.get(frame - 1); if (!prev) continue;
      expect(current.third, `F${frame} transfer`).toBe(prev.transferEnabled ? prev.nextPortion : null);
    }
    for (let f = 1; f <= 8; f++) expect(at(f).third).toBe(f <= 3 ? (f - 1) % 3 : null);
    for (let f = 9; f <= 15; f++) {
      expect(at(f).third).toBeNull();
      expect(at(f).slots.filter(slot => slot?.picture === 'oak')).toHaveLength(Math.min(49, (f - 8) * 8));
    }
    const silhouette = (start: number, obp0: number) => {
      for (let offset = 0; offset < 60; offset++) {
        expect([at(start + offset).bgp, at(start + offset).obp0, at(start + offset).wx])
          .toEqual([[0x54, 0xa8, 0xfc, 0xf8, 0xf4, 0xe4][Math.floor(offset / 10)], obp0, 7]);
      }
    };
    silhouette(15, 0xd0); silhouette(t[4] - 60, 0);
    for (const name of ['OakSpeechText1', 'OakSpeechText2', 'YourNameIsText', 'HisNameIsText']) {
      const end = ends.get(name)!;
      for (let o = 0; o < 24; o++) {
        expect([at(end + o).bgp, at(end + o).obp0]).toEqual([[0x90, 0x80], [0x40, 0x40], [0, 0]][Math.floor(o / 8)]);
        expect(at(end + o).cells[240]).toBe('┌');
      }
      expect(at(end + 24).cells.every(cell => cell === ' ')).toBe(true);
      expect(at(end + 27).visibleCells.every(cell => cell === ' ')).toBe(true);
      const picture = name === 'OakSpeechText1' ? 'pikachu' : name === 'YourNameIsText' ? 'rival' : 'red';
      for (let batch = 1; batch <= 7; batch++) {
        const snap = at(end + 27 + batch);
        expect(snap.third).toBeNull();
        expect(snap.slots.map(slot => slot?.picture).filter(pic => pic === picture)).toHaveLength(Math.min(49, batch * 8));
      }
    }
    for (const text of [t[1], t[2]]) {
      const a = text - 16;
      for (let o = 0; o <= 16; o++) {
        expect(at(a + o).wx).toBe(o < 2 ? 119 : Math.max(7, 119 - (o - 1) * 8));
        expect(at(a + o).bgp).toBe(o === 0 ? 0 : 0xe4);
        expect(at(a + o).obp0).toBe(0);
      }
    }
    for (let col = 0; col < 7; col++) for (let row = 0; row < 7; row++)
      expect(at(t[1]).cells[(4 + row) * 20 + 6 + col]).toBe((6 - col) * 7 + row);
    // Independent literal memory-copy oracle; all eighteen transfer frames, including each torn top third.
    function slide(start: number, right: boolean) {
      const logical = [...at(start - 1).cells], visible = [...at(start - 1).visibleCells];
      let base = right ? 210 : 92;
      for (let step = 0; step < 6; step++) {
        for (let byte = 0; byte < 125; byte++) {
          const src = right ? base - byte : base + byte;
          logical[src + (right ? 1 : -1)] = logical[src];
        }
        if (!right) logical[base + 124] = 0;
        for (let third = 0; third < 3; third++) {
          for (let index = third * 120; index < (third + 1) * 120; index++) visible[index] = logical[index];
          const snap = at(start + step * 3 + third + 1);
          expect(snap.third).toBe(third); expect(snap.visibleCells.slice(0, 240)).toEqual(visible.slice(0, 240));
          // The last wait resumes into the next step (or writes the menu/text), so inspect scanout here.
        }
        base += right ? 1 : -1;
      }
    }
    menus.forEach((menu, i) => {
      slide(menu.open - 18, true);
      if (!custom) {
        expect(t[i === 0 ? 3 : 5] - menu.chosen).toBe(31);
        for (let row = 0; row < 12; row++) for (let col = 0; col < 11; col++)
          expect(at(menu.chosen).cells[row * 20 + col]).toBe(' ');
        slide(menu.chosen + 13, false);
      }
      else {
        expect(t[i === 0 ? 3 : 5] - menu.returned).toBe(13);
        for (let offset = 0; offset < 13; offset++) expect(at(menu.returned + offset).cells.some(cell => typeof cell === 'number')).toBe(false);
      }
    });
    for (let o = 0; o < 24; o++) expect([at(t[6] - 24 + o).bgp, at(t[6] - 24 + o).obp0])
      .toEqual([[0x40, 0x40], [0x90, 0x80], [0xe4, 0xd0]][Math.floor(o / 8)]);

    const returned = ends.get('OakSpeechText3')!;
    expect(shrink).toBe(returned); expect(done - returned).toBe(126);
    expect(vi.mocked(playSFX).mock.calls.filter(([name]) => name === 'shrink')).toHaveLength(1);
    expect(vi.mocked(fadeOutAndStopMusic).mock.calls).toEqual([[10]]);
    for (let o = 0; o <= 126; o++) {
      const snap = at(returned + o);
      expect(snap.spriteVisible, `R+${o} DMA`).toBe(o >= 51);
      expect(snap.shadowVisible).toBe(o >= 50);
      if (o < 123) expect(snap.cells[240]).toBe('┌');
      const disabled = (o >= 5 && o <= 13) || (o >= 18 && o <= 24) || (o >= 45 && o <= 49);
      if (o > 0) expect(snap.third === null, `R+${o} copy`).toBe(disabled);
      const first = Math.max(0, Math.min(49, (o - 6) * 8));
      const second = Math.max(0, Math.min(49, (o - 17) * 8));
      expect(snap.slots.map(slot => slot?.picture)).toEqual(Array.from({ length: 49 }, (_, tile) =>
        tile < second ? 'shrink2' : tile < first ? 'shrink1' : 'red'));
      if (o >= 99) expect([snap.bgp, snap.obp0]).toEqual(o < 107 ? [0x90, 0x80] : o < 115 ? [0x40, 0x40] : [0, 0]);
    }
    expect(lastOf(at(returned + 24).audioRequests)).toMatchObject({ kind: 'fade', value: 10 });
    expect(at(returned + 51).sprite).toEqual({ x: 64, y: 60, image: 0, direction: 'down' });
    const q = (at(returned).nextPortion + 28) % 3;
    for (let col = 6; col < 13; col++) {
      expect(typeof at(returned + 44).cells[4 * 20 + col]).toBe('number');
      for (let row = 5; row < 12; row++) expect(at(returned + 44).cells[row * 20 + col]).toBe(' ');
    }
    for (let o = 50; o <= 52; o++) {
      const snap = at(returned + o); expect(snap.third).toBe((q + o - 50) % 3);
      for (let row = 5; row < 12; row++) for (let col = 6; col < 13; col++) {
        const third = Math.floor(row / 6), elapsed = (third - q + 3) % 3;
        if (elapsed <= o - 50) expect(snap.visibleCells[row * 20 + col]).toBe(' ');
      }
    }
    expect(at(done).visibleCells.every(cell => cell === ' ')).toBe(true);
    // Real interpreter: control10 decrements at 35,46,...101; stops/restores at R112.
    const fadeWrites = audio.synth.log.filter(w => w.m === 'master' && w.u > 1);
    const last = fadeWrites.slice(-8);
    expect(last.map(w => w.a)).toEqual([[6, 6], [5, 5], [4, 4], [3, 3], [2, 2], [1, 1], [0, 0], [7, 7]]);
    expect(last.map(w => w.u - audioReturn)).toEqual([35, 46, 57, 68, 79, 90, 101, 112]);
    expect(audio.music.isPlaying()).toBe(false);
    expect(reads.length).toBeGreaterThan(0);
  });

  it.each([0, 1, 2])('custom return at inherited portion %i separates CPU +13/+16 from scanout', async portion => {
    const r = await scene(); r.until(() => r.speech.inspection.menu?.target === 'player');
    r.step(); r.step(); expect(r.step(['a'])).toEqual({ type: 'openNamingScreen', target: 'player' });
    const slots = r.speech.inspection.slots;
    textBgTransfer.resetPortion(); for (let i = 0; i < portion; i++) textBgTransfer.tick();
    r.speech.continueAfterNaming('RED'); const returned = r.frame;
    expect(r.speech.inspection.slots).toEqual(slots);
    expect(r.speech.inspection.nextPortion).toBe(portion);
    expect(r.speech.inspection.visibleCells.every(cell => cell === ' ')).toBe(true);
    const snapshots = [r.speech.inspection];
    for (let i = 1; i <= 19; i++) { r.step(); snapshots.push(r.speech.inspection); }
    expect(lastOf(r.prints).frame - returned).toBe(13); expect(lastOf(r.prints).firstGlyph - returned).toBe(16);
    const firstBorder = 13 + 1 + (2 - portion + 3) % 3;
    const firstGlyph = 16 + 1 + (2 - portion + 3) % 3;
    expect(snapshots[firstBorder - 1].visibleCells[240]).toBe(' ');
    expect(snapshots[firstBorder].visibleCells[240]).toBe('┌');
    expect(snapshots[firstGlyph - 1].visibleCells[281]).toBe(' ');
    expect(snapshots[firstGlyph].visibleCells[281]).toBe(snapshots[16].cells[281]);
    for (const [third, cell] of [[0, 86], [1, 126]]) {
      const first = 13 + 1 + (third - portion + 3) % 3;
      expect(snapshots[first - 1].visibleCells[cell]).toBe(' ');
      expect(typeof snapshots[first].visibleCells[cell]).toBe('number');
    }
  });

  it('preloads MEWMON pictures and every OBJ palette, selects cached borders, renders without advancing, and resets OAM', async () => {
    const r = await scene();
    expect(vi.mocked(loadTileset).mock.calls).toHaveLength(7);
    expect(vi.mocked(loadTileset).mock.calls.every(([, palette]) => palette === 'MEWMON')).toBe(true);
    expect(vi.mocked(loadSpriteMapped).mock.calls).toEqual([0xd0, 0x80, 0x40, 0].map(reg =>
      ['/gfx/sprites/red.png', [0, 1, 2, 3].map(c => (reg >> (2 * c)) & 3), 'MEWMON']));
    expect(setActivePalette).toHaveBeenCalledWith('MEWMON');
    expect(getBorderCanvas()).toMatchObject({ url: '/gfx/font/font_extra.png', palette: 'MEWMON' });
    r.until(() => r.speech.inspection.spriteVisible);
    for (const reg of [0xd0, 0x80, 0x40, 0]) {
      r.until(() => r.speech.inspection.obp0 === reg);
      const before = r.speech.inspection;
      r.speech.render(); r.speech.render(); expect(r.speech.inspection).toEqual(before);
      const call = lastOf(vi.mocked(drawSprite).mock.calls);
      expect(call.slice(1)).toEqual([0, 0, 64, 60]);
      expect(call[0]).toMatchObject({ mapping: [0, 1, 2, 3].map(c => (reg >> (2 * c)) & 3), palette: 'MEWMON' });
    }
    r.speech.start(); expect(r.speech.inspection.spriteVisible).toBe(false); expect(r.speech.inspection.shadowVisible).toBe(false);
    expect(r.speech.inspection.slots.every(slot => slot === null)).toBe(true);
    const snapshot = r.speech.inspection; Reflect.set(snapshot.cells, 0, 'X'); Reflect.set(snapshot.audioRequests[0], 'value', 'changed');
    expect(r.speech.inspection.cells[0]).toBe(' '); expect(r.speech.inspection.audioRequests[0].value).toBe(0);
  });
});
