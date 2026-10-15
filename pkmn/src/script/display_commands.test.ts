import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { initScript, updateScript, renderScriptExclamation, renderScriptYesNo } from './script_controller';
import type { ScriptDeps } from './script_controller';
import { isPassPressed, syncJoypadRead, readJoypad } from '../input';
import { playMusic, isMusicChannelActive } from '../audio';
import { fontLoadedUpdateSprites } from '../overworld/ui_entry';
import { drawExclamationBubble } from '../renderer';
import { drawBox, drawText } from '../menus/menu_render';
import { Player } from '../overworld/player';
import { GameMap } from '../overworld/map';
import { Bag } from '../items';
import { rig, musicData } from '../test/audio_rig';

vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false,
  isPassPressed: vi.fn(() => false), readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true,
  playMusic: vi.fn(async () => {}), isMusicChannelActive: vi.fn(() => false) }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../overworld/ui_entry', () => ({ fontLoadedUpdateSprites: vi.fn(), setOpeningSpriteUpdates: vi.fn() }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  drawExclamationBubble: vi.fn(), loadFont: async () => ({ width: 128 }),
  loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));
vi.mock('../menus/menu_render', () => ({ drawBox: vi.fn(), drawText: vi.fn() }));

beforeAll(initTextSystem);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(isPassPressed).mockReturnValue(false);
  vi.mocked(isMusicChannelActive).mockReturnValue(false); setTextSpeed('fast'); });
function scene(): ScriptDeps {
  return { textBox: new TextBox(), player: new Player(), gameMap: new GameMap(),
    npcs: [], playerBag: new Bag(), playerParty: [], restoreMapMusic: vi.fn() };
}
function retained(deps: ScriptDeps): void {
  deps.textBox.open(); for (let i = 0; i < 20; i++) deps.textBox.update();
  deps.textBox.print({ text: 'A' }, { box: 'keep' }); deps.textBox.update();
}
describe('retained handler commands', () => {
  it.each(['yes', 'no'] as const)('opens a message-free menu immediately and resumes %s without dismissing', answer => {
    const deps = scene(); retained(deps); const yes = vi.fn(), no = vi.fn();
    initScript([{ type: 'yesNoChoice', yes: [{ type: 'callback', fn: yes }],
      no: [{ type: 'callback', fn: no }] }, { type: 'wait', frames: 1 }]);
    updateScript(deps, false); renderScriptYesNo();
    expect(drawText).toHaveBeenCalledWith('YES', 128, 64);
    expect(deps.textBox.active).toBe(true);
    vi.mocked(isPassPressed).mockImplementation(b => b === (answer === 'yes' ? 'a' : 'b'));
    // HandleMenuInput Delay3: the first read is +3 from the opening tick.
    updateScript(deps, false); updateScript(deps, false);
    expect(readJoypad).not.toHaveBeenCalled();
    updateScript(deps, false);
    expect(readJoypad).toHaveBeenCalledTimes(1);
    expect(yes).not.toHaveBeenCalled(); expect(no).not.toHaveBeenCalled();
    for (let t = 1; t < 15; t++) {
      updateScript(deps, false); expect(yes).not.toHaveBeenCalled(); expect(no).not.toHaveBeenCalled();
    }
    updateScript(deps, false); // DelayFrames 15 returns into the selected branch.
    expect(readJoypad).toHaveBeenCalledTimes(1);
    expect(answer === 'yes' ? yes : no).toHaveBeenCalledOnce();
    expect(answer === 'yes' ? no : yes).not.toHaveBeenCalled();
    expect(deps.textBox.active).toBe(true); // enclosing display owns its ending
  });
  it('provides the cartridge HEAL/CANCEL position for the later nurse migration', () => {
    const deps = scene(); retained(deps);
    initScript([{ type: 'yesNoChoice', yes: [], no: [], pokeCenter: true }]);
    updateScript(deps, false); renderScriptYesNo();
    expect(drawBox).toHaveBeenCalledWith(88, 48, 72, 48);
    expect(drawText).toHaveBeenCalledWith('HEAL', 104, 64);
    expect(drawText).toHaveBeenCalledWith('CANCEL', 104, 80);
  });
  it('a migrated DelayFrames returns on its last tick without Joypad reads', () => {
    const deps = scene(); const done = vi.fn();
    initScript([{ type: 'displayOpen' }, { type: 'wait', frames: 2 },
      { type: 'callback', fn: done }, { type: 'wait', frames: 1 }]);
    updateScript(deps, false);
    for (let i = 0; i < 20; i++) updateScript(deps, false);
    updateScript(deps, false); expect(done).not.toHaveBeenCalled();
    updateScript(deps, false); expect(done).toHaveBeenCalledOnce();
    expect(syncJoypadRead).not.toHaveBeenCalled();
  });
  it('holds the bubble for 61 renders inside the display then updates sprites once, without reads', () => {
    const deps = scene(); retained(deps); const done = vi.fn();
    initScript([{ type: 'emotionBubble', target: 'player' }, { type: 'callback', fn: done }, { type: 'wait', frames: 1 }]);
    updateScript(deps, false); vi.mocked(syncJoypadRead).mockClear();
    for (let i = 0; i < 61; i++) {
      renderScriptExclamation(0, 0, deps.player, []);
      expect(deps.textBox.active).toBe(true);
      if (i < 60) updateScript(deps, false);
    }
    expect(drawExclamationBubble).toHaveBeenCalledTimes(61);
    expect(done).not.toHaveBeenCalled(); updateScript(deps, false);
    expect(done).toHaveBeenCalledOnce(); expect(fontLoadedUpdateSprites).toHaveBeenCalledOnce();
    expect(syncJoypadRead).not.toHaveBeenCalled(); expect(readJoypad).not.toHaveBeenCalled();
  });
  it('waits for healing music to load and finish, then restores map music in the return tick', async () => {
    const deps = scene(); retained(deps); const done = vi.fn();
    vi.mocked(syncJoypadRead).mockClear();
    let loaded!: () => void;
    vi.mocked(playMusic).mockImplementationOnce(() => new Promise<void>(r => { loaded = r; }));
    initScript([{ type: 'healJingle' }, { type: 'callback', fn: done }, { type: 'wait', frames: 1 }]);
    updateScript(deps, false); updateScript(deps, false);
    expect(playMusic).toHaveBeenCalledExactlyOnceWith('pkmnhealed'); expect(done).not.toHaveBeenCalled();
    loaded(); await Promise.resolve(); vi.mocked(isMusicChannelActive).mockReturnValue(true);
    updateScript(deps, false); expect(done).not.toHaveBeenCalled();
    vi.mocked(isMusicChannelActive).mockReturnValue(false); updateScript(deps, false);
    expect(done).toHaveBeenCalledOnce(); expect(deps.restoreMapMusic).toHaveBeenCalledOnce();
    expect(syncJoypadRead).not.toHaveBeenCalled();
  });
  it('Mom returns on healing CHAN1 sound_ret even though the engine track latch stays enabled', async () => {
    const deps = scene(); retained(deps); const done = vi.fn(); const audio = rig();
    vi.mocked(playMusic).mockImplementationOnce(async () => { audio.music.play(musicData('pkmnhealed')); });
    vi.mocked(isMusicChannelActive).mockImplementation(id => audio.music.getChannel(id)?.active ?? false);
    initScript([{ type: 'healJingle' }, { type: 'callback', fn: done }, { type: 'wait', frames: 1 }]);
    updateScript(deps, false); await Promise.resolve();
    // ASM CH1: 20 units at speed 12 / tempo 144 -> 135 ticks; initial update +1.
    for (let u = 1; u < 136; u++) { audio.update(); updateScript(deps, false); expect(done).not.toHaveBeenCalled(); }
    audio.update(); updateScript(deps, false);
    expect(done).toHaveBeenCalledOnce(); expect(deps.restoreMapMusic).toHaveBeenCalledOnce();
    expect(audio.music.isPlaying()).toBe(true); expect(audio.music.getChannel(1)?.active).toBe(false);
    expect(isMusicChannelActive).toHaveBeenCalledWith(1);
    vi.mocked(isMusicChannelActive).mockReturnValue(false);
  });
});
