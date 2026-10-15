import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { caterpillarText } from './small_text_handlers';
import { buildOldMan1Script } from './viridian_city';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { initScript, updateScript, getActiveScript } from '../script/script_controller';
import { Player } from '../overworld/player';
import { GameMap } from '../overworld/map';
import { Bag } from '../items';
import { isHeld, isPassPressed, readJoypad } from '../input';
import { setJoyIgnore } from '../input/joy_ignore';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false),
  isPressed: () => false, readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true, playMusic: vi.fn(), stopMusic: vi.fn(), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { vi.clearAllMocks(); setTextSpeed('fast'); setJoyIgnore('none');
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false); });
it.each([
  ['caterpillar', 'yes', 'ViridianCityPrintYoungster2Text.CaterpieAndWeedleDescriptionText'],
  ['caterpillar', 'no', 'ViridianCityPrintYoungster2Text.OkThenText'],
  ['oldMan1', 'yes', 'ViridianCityPrintOldManText.WatchCloselyText'],
  ['oldMan1', 'no', 'ViridianCityPrintOldManText.NotGoodEnoughForYouText'],
] as const)('%s %s waits +3 for the menu read and +15 before its real branch PrintText', (flow, answer, program) => {
  const box = new TextBox(); const deps = { textBox: box, player: new Player(), gameMap: new GameMap(),
    npcs: [], playerParty: [], playerBag: new Bag() };
  const print = vi.spyOn(box, 'print'); initScript(flow === 'caterpillar' ? caterpillarText() : buildOldMan1Script());
  let menuFrame = -1;
  for (let t = 0; t < 3000; t++) {
    vi.mocked(isHeld).mockImplementation(k => k === 'b' && box.isWaitingForInput && t % 2 === 0);
    updateScript(deps, false);
    const script = getActiveScript(); if (script?.commands[script.index].type === 'yesNoChoice') { menuFrame = t; break; }
  }
  expect(menuFrame).toBeGreaterThan(0); const before = print.mock.calls.length;
  vi.mocked(isPassPressed).mockImplementation(k => k === (answer === 'yes' ? 'a' : 'b'));
  updateScript(deps, false); updateScript(deps, false); expect(readJoypad).not.toHaveBeenCalled();
  updateScript(deps, false); expect(readJoypad).toHaveBeenCalledOnce();
  for (let t = 1; t < 15; t++) { updateScript(deps, false); expect(print).toHaveBeenCalledTimes(before); }
  updateScript(deps, false); expect(print).toHaveBeenLastCalledWith({ program }, expect.anything());
  expect(readJoypad).toHaveBeenCalledOnce();
});
