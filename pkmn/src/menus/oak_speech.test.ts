import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { OakSpeech } from './oak_speech';
import { MenuInput } from './menu_input';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { isHeld, isPassPressed, readJoypad, syncJoypadRead } from '../input';
import { playSFX } from '../audio';
import { fillRect } from '../renderer';
import { setPlayerName, setRivalName } from '../core/player_state';
import type { GameButton } from '../core';

vi.mock('../input', () => ({ isHeld: vi.fn(), isPassPressed: vi.fn(), readJoypad: vi.fn(), syncJoypadRead: vi.fn(), isPressed: () => false }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({ clear: vi.fn(), fillRect: vi.fn(), drawTile: vi.fn(), drawFadeOverlay: vi.fn(),
  setActivePalette: vi.fn(), getScale: () => 1, getCtx: () => ({ drawImage() {}, save() {}, restore() {}, translate() {}, scale() {} }),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 56, height: 56 }) }));
vi.mock('./menu_render', () => ({ drawText: vi.fn(), drawChar: vi.fn(), drawBox: vi.fn() }));

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { vi.clearAllMocks(); setTextSpeed('fast'); setPlayerName('YELLOW'); setRivalName('BLUE'); });
const boxOf = (speech: OakSpeech) => Reflect.get(speech, 'textBox') as TextBox;
const screenOf = (box: TextBox) => Reflect.get(box, 'screen') as { buffer: string[]; waiting: boolean } | null;
const phaseOf = (speech: OakSpeech) => Reflect.get(speech, 'phase') as string;
const menuOf = (speech: OakSpeech) => Reflect.get(speech, 'nameMenu') as MenuInput;

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
    if (phaseOf(speech).endsWith('_menu')) return step(menuOf(speech).item === 0 ? ['down'] : ['a']);
    return step(box.isWaitingForInput && !box.isComplete && frame % 2 === 0 ? [button] : []);
  }
  function until(predicate: () => boolean, button: 'a' | 'b' = 'b') {
    for (let i = 0; !predicate() && i < 12000; i++) auto(button);
    expect(predicate()).toBe(true);
  }
  return { speech, box, prints, cues, seen, step, auto, until, get frame() { return frame; } };
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
    const r = await scene(); r.until(() => phaseOf(r.speech) === 'fadeout2');
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
    for (const phase of ['fadeout1', 'fadeout2', 'fadeout3', 'fadeout4']) {
      r.until(() => phaseOf(r.speech) === phase);
      const transfer = vi.spyOn(r.box, 'updateDisplay');
      for (let i = 1; i < 8; i++) { r.step(); expect(r.box.active).toBe(true); }
      r.step(); expect(r.box.active).toBe(false); expect(transfer).toHaveBeenCalledTimes(8); transfer.mockRestore();
    }
  });

  it.each(['player', 'rival'])('%s preset keeps the prompt through the slide back', async target => {
    const r = await scene(); r.until(() => phaseOf(r.speech) === `${target}_slide_back`);
    expect(r.box.active).toBe(true);
    const content = screenOf(r.box)!.buffer.join('');
    while (phaseOf(r.speech) === `${target}_slide_back`) {
      expect(r.box.active).toBe(true); expect(screenOf(r.box)!.buffer.join('')).toBe(content); r.step();
    }
    expect(r.box.active).toBe(true); expect(r.prints[r.prints.length - 1].program).toBe(target === 'player' ? 'YourNameIsText' : 'HisNameIsText');
  });

  it.each(['player', 'rival'])('%s custom name: blank at return, box at +6, glyph at +9', async target => {
    const r = await scene(); r.until(() => phaseOf(r.speech) === `${target}_menu`);
    r.step(); r.step(); expect(r.step(['a'])).toEqual({ type: 'openNamingScreen', target });
    r.speech.continueAfterNaming(target === 'player' ? 'RED' : 'GREEN'); const returned = r.frame;
    expect(r.box.active).toBe(false); expect(Reflect.get(r.speech, 'currentPic')).toBeNull();
    for (let i = 1; i < 6; i++) { r.step(); expect(r.box.active).toBe(false); expect(Reflect.get(r.speech, 'currentPic')).toBeNull(); }
    r.step(); expect(r.box.active).toBe(true); expect(Reflect.get(r.speech, 'currentPic')).not.toBeNull();
    expect(r.prints[r.prints.length - 1].frame - returned).toBe(6);
    r.step(); r.step(); r.step(); expect(r.prints[r.prints.length - 1].firstGlyph - returned).toBe(9);
  });

  it('Text3 goes into shrink on its return tick without a press or beep; the box lasts to ClearScreen', async () => {
    const r = await scene(); r.until(() => phaseOf(r.speech) === 'final_text');
    r.until(() => screenOf(r.box)!.buffer.join('').includes("awaits! Let's go!"));
    const sounds = vi.mocked(playSFX).mock.calls.length;
    for (let i = 0; phaseOf(r.speech) === 'final_text' && i < 3; i++) r.step();
    expect(r.box.isTextComplete).toBe(true); expect(r.box.isComplete).toBe(true); expect(phaseOf(r.speech)).toBe('shrink');
    expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds); expect(r.box.active).toBe(true);
    while (phaseOf(r.speech) === 'shrink') { expect(r.box.active).toBe(true); r.step(); }
    expect(r.box.active).toBe(true); r.speech.clearScreen(); expect(r.box.active).toBe(false);
  });

  it('name menu waits three frames, ignores B silently, does not wrap, and A beeps once', async () => {
    const r = await scene(); r.until(() => phaseOf(r.speech) === 'player_menu');
    const reads = vi.mocked(readJoypad).mock.calls.length, sounds = vi.mocked(playSFX).mock.calls.length;
    r.step(['up']); r.step(['up']); expect(vi.mocked(readJoypad).mock.calls.length).toBe(reads);
    r.step(['up']); expect(menuOf(r.speech).item).toBe(0);
    r.step(); r.step(); r.step(['b']);
    expect(phaseOf(r.speech)).toBe('player_menu'); expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds);
    r.step(); r.step(); expect(vi.mocked(readJoypad).mock.calls.length).toBe(reads + 2);
    for (let i = 0; i < 4; i++) { r.step(['down']); r.step(); r.step(); r.step(); }
    expect(menuOf(r.speech).item).toBe(3); expect(menuOf(r.speech).cursor).toEqual({ x: 1, y: 8 });
    r.step(['a']); expect(phaseOf(r.speech)).toBe('player_slide_back'); expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds + 1);
  });

  it('A held from the prompt is still held at the first name-menu read, requiring release and a new press', async () => {
    const r = await scene(); r.until(() => phaseOf(r.speech) === 'player_menu', 'a');
    const sounds = vi.mocked(playSFX).mock.calls.length;
    r.step(['a']); r.step(['a']); expect(r.step(['a'])).toBeNull(); expect(phaseOf(r.speech)).toBe('player_menu');
    r.step(); expect(r.step(['a'])).toEqual({ type: 'openNamingScreen', target: 'player' });
    expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds + 1);
  });

  it('the main idle-read guard leaves oak_speech reads to the standalone box and menu', () => {
    const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const guard = source.split('\n').find(line => line.includes('if (!inPassState') && line.includes('syncJoypadRead();'));
    expect(guard).toContain("state !== 'oak_speech'");
  });
});
