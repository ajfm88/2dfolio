import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { palletOakText, buildOakGrassScript } from './pallet_town';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { initScript, updateScript, getActiveScript, renderScriptExclamation } from '../script/script_controller';
import { Player } from '../overworld/player';
import { GameMap } from '../overworld/map';
import { Bag } from '../items';
import { isHeld, syncJoypadRead } from '../input';
import { setJoyIgnore } from '../input/joy_ignore';
import { drawExclamationBubble } from '../renderer';
import { uiTiles } from '../renderer/ui_tiles';
import { playMusic } from '../audio';
import { isNoMapMusic, setNoMapMusic } from '../audio/audio_flags';
import type { ScriptCommand } from '../script/types';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: () => false,
  isPassPressed: () => false, readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true, stopMusic: vi.fn(), playMusic: vi.fn(async () => {}) }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(), drawExclamationBubble: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(isHeld).mockReturnValue(false); setTextSpeed('fast'); setJoyIgnore('none'); });

function trace(commands: ScriptCommand[], press = false) {
  const updated = vi.fn(); const player = new Player(); player.direction = 'up';
  const box = new TextBox({ closeFrames: () => 23, updateSprites: updated });
  const deps = { textBox: box, player, gameMap: new GameMap(), npcs: [], playerBag: new Bag(), playerParty: [] };
  initScript(commands); updateScript(deps, false);
  let glyph = -1, textEnd = -1, bubble = -1, close = -1, end = -1;
  for (let t = 1; t < 1200 && getActiveScript(); t++) {
    vi.mocked(isHeld).mockImplementation(b => press && b === 'b' && t % 2 === 0 && box.isWaitingForInput);
    const reads = vi.mocked(syncJoypadRead).mock.calls.length; updateScript(deps, false);
    if (glyph < 0 && vi.mocked(syncJoypadRead).mock.calls.length > reads) glyph = t;
    if (textEnd < 0 && box.isTextComplete) textEnd = t;
    const cmd = getActiveScript()?.commands[getActiveScript()!.index];
    if (bubble < 0 && cmd?.type === 'emotionBubble') { bubble = t; expect(player.direction).toBe('down'); }
    if (close < 0 && box.closing) close = t;
    if (close >= 0 && !box.active && end < 0) end = t;
    if (cmd?.type === 'emotionBubble') {
      uiTiles.clear(); box.render(); expect(uiTiles.tileAt(18, 16)).toBe(0x60);
      renderScriptExclamation(0, 0, player, []); expect(updated).not.toHaveBeenCalled();
    }
  }
  return { glyph, textEnd, bubble, close, end, updated, active: box.active };
}
describe('PalletTownOakText displays (scripts/PalletTown.asm)', () => {
  it('HEY_WAIT prints at +23, waits 10, bubbles for 61 inside the display, then Holds/closes 23 without outer wait', () => {
    const result = trace(palletOakText(0));
    expect(result.glyph).toBe(23); expect(result.bubble - result.textEnd).toBe(10);
    expect(result.close - result.bubble).toBe(61); expect(result.end - result.close).toBe(23);
    expect(drawExclamationBubble).toHaveBeenCalledTimes(61); expect(result.updated).toHaveBeenCalledOnce();
    expect(result.active).toBe(false);
  });
  it.each([1, 2] as const)('stage %i waits for the outer button and uses the outdoor close', stage => {
    const commands = palletOakText(stage);
    const stalled = trace(commands); expect(stalled.active).toBe(true); expect(stalled.close).toBe(-1);
    vi.mocked(syncJoypadRead).mockClear(); const result = trace(commands, true);
    expect(result.glyph).toBe(23); expect(result.bubble).toBe(-1);
    expect(result.end - result.close).toBe(23); expect(result.updated).toHaveBeenCalledOnce();
  });
  it('the grass scene has exactly four source displays and keeps its movement/warp paths', () => {
    const commands = buildOakGrassScript(20);
    expect(commands.filter(c => c.type === 'printText').map(c => c.program)).toEqual([
      'PalletTownOakText.HeyWaitDontGoOutText', 'PalletTownOakText.ThatWasCloseText',
      'PalletTownOakText.WhewText', 'PalletTownOakComeWithMe']);
    expect(commands.filter(c => c.type === 'displayClose').map(c => c.outerWait)).toEqual([false, true, true, true]);
    expect(commands.some(c => ['text', 'exclamation'].includes(c.type))).toBe(false);
    expect(commands.find(c => c.type === 'moveNpc')).toEqual({ type: 'moveNpc', npcId: 'prof_script', path: ['up', 'up', 'up', 'up'] });
    const parallel = commands.find(c => c.type === 'moveParallel'); expect(parallel?.npcInStep).toBe(true);
    expect(commands[commands.length - 1]).toEqual({ type: 'warp', map: 'OaksLab', warpId: 1 });
    const direct = commands.find(c => c.type === 'printText' && c.program === 'PalletTownOakComeWithMe');
    expect(direct).toEqual({ type: 'printText', program: 'PalletTownOakComeWithMe', box: 'keep' });
  });
  it('detects an in-memory bubble moved after the first close', () => {
    const wrong = palletOakText(0); const i = wrong.findIndex(c => c.type === 'emotionBubble');
    wrong.push(wrong.splice(i, 1)[0]);
    expect(() => expect(wrong.findIndex(c => c.type === 'emotionBubble')).toBeLessThan(wrong.findIndex(c => c.type === 'displayClose'))).toThrow();
  });
  it('detects an in-memory outer wait added to HEY_WAIT', () => {
    const wrong = palletOakText(0); const close = wrong.find(c => c.type === 'displayClose')!;
    if (close.type === 'displayClose') close.outerWait = true;
    const result = trace(wrong);
    expect(() => expect(result.active).toBe(false)).toThrow();
  });
  it('detects a removed PrintText Delay3 through the actual first-write trace', () => {
    const wrong = palletOakText(0); const print = wrong.find(c => c.type === 'printText')!;
    if (print.type === 'printText') print.box = 'keep';
    const result = trace(wrong); expect(() => expect(result.glyph).toBe(23)).toThrow();
  });
});

describe('Map-music CP3: the escort MuseumGuy theme (auto_movement.asm:84–119)', () => {
  it.each([10, 20])('plays MuseumGuy and sets BIT_NO_MAP_MUSIC once, after "Come with me" and before any escort move (exit x=%s)', x => {
    setNoMapMusic(false);
    const commands = buildOakGrassScript(x);
    const comeWithMe = commands.findIndex(c => c.type === 'printText' && c.program === 'PalletTownOakComeWithMe');
    const firstEscortMove = commands.findIndex((c, i) => i > comeWithMe && (c.type === 'moveNpc' || c.type === 'moveParallel'));
    const hits = commands.flatMap((c, i) => {
      if (c.type !== 'callback') return [];
      vi.mocked(playMusic).mockClear(); setNoMapMusic(false); c.fn();
      return vi.mocked(playMusic).mock.calls.some(call => call[0] === 'museumguy') && isNoMapMusic() ? [i] : [];
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toBeGreaterThan(comeWithMe); expect(hits[0]).toBeLessThan(firstEscortMove);
  });
});
