// A5b7g2 CP2 (notes/54-a5b7g-plan.md §5.3): plain predefs at +20, books and statues at +23,
// the right poster's owned-count branch, and PrintBookshelfText's facing-up one-tile gate.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Player } from '../overworld/player';
import { GameMap } from '../overworld/map';
import { Npc } from '../overworld/npc';
import { createOverworldState, updateOverworld } from '../overworld/overworld_controller';
import { Bag } from '../items';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { initScript, updateScript, getActiveScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import type { ScriptCommand } from '../script/types';
import { isHeld, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { restoreFlags, setFlag } from '../events';
import { restorePokedex } from '../pokedex_state';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { rig, sfxData } from '../test/audio_rig';
import type { Rig } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { interactionDisplay } from './hidden_events';
import type { BookshelfContext } from './hidden_events';
import type { TextHandlerContext } from './text_handlers';
import { buildOaksLabAwaitBallScript } from './oaks_lab';
import type { Direction, MapData } from '../core';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: () => false,
  isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn(), readJoypad: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), stopMusic: vi.fn(),
  playMusic: vi.fn(async () => {}), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(), drawExclamationBubble: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));

const DATA = resolve(__dirname, '../../data');
const shelf: BookshelfContext = { tileset: 'LAB', tileTwoAbove: 0 };
let audio: Rig;

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => {
  vi.clearAllMocks(); restoreFlags([]); restorePokedex([], []); setTextSpeed('fast');
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false);
  audio = rig();
  vi.mocked(playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
});

function ctx(ownedCount = 0, stepX = 4): TextHandlerContext {
  return { hasFlag: () => false, bag: new Bag(), ownedCount, facing: 'up', step: { x: stepX, y: 3 }, party: [] };
}
function scene(mapName = 'OaksLab'): ScriptDeps {
  const gameMap = new GameMap();
  gameMap.mapData = JSON.parse(readFileSync(resolve(DATA, `maps/${mapName}.json`), 'utf8')) as MapData;
  const blockset = { DOJO: 'blockset_gym.json', HOUSE: 'blockset_house.json' }[gameMap.mapData.tileset];
  if (blockset) gameMap.blockset = JSON.parse(readFileSync(resolve(DATA, blockset), 'utf8'));
  const player = new Player(); player.setTilePosition(8, 8); player.direction = 'up';
  const follower = new PikachuFollower();
  return { gameMap, player, npcs: gameMap.mapData.npcs.map(n => new Npc({ ...n })), playerBag: new Bag(),
    playerParty: [], pikachuFollower: follower, textBox: new TextBox({ closeFrames: () => 15, updateSprites: vi.fn() }) };
}
function bare(): ScriptDeps {
  const deps = scene();
  deps.gameMap.mapData = { ...deps.gameMap.mapData!, name: 'Shelf', npcs: [], signs: [], hiddenEvents: [], warps: [] };
  deps.npcs = [];
  deps.player.setTilePosition(8, 8);
  return deps;
}
function pressA(): void {
  vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
}
function programs(commands: ScriptCommand[]): string[] {
  return commands.filter(c => c.type === 'printText').map(c => c.program);
}
function firstGlyph(deps: ScriptDeps, commands: ScriptCommand[]): number {
  initScript(commands); updateScript(deps, false);
  for (let t = 1; t <= 40; t++) {
    updateScript(deps, false);
    if (deps.textBox.saveScreen().buffer[41] !== ' ') return t;
  }
  return -1;
}

const PLAIN = ['PokemonStuffText', 'ElevatorText', 'BookcaseText', 'PushStartText', 'SaveOptionText',
  'StrengthsAndWeaknessesText', 'OakLabEmailText', 'RedBedroomSNESText', 'ViridianCityPokecenterBenchGuyText'];

describe('plain predefs and bookshelf text_asm (A5b7g2 CP2)', () => {
  it.each(PLAIN)('%s keeps the box: first glyph at +20', program => {
    expect(firstGlyph(scene(), interactionDisplay({ program }, ctx(), shelf)!)).toBe(20);
  });

  it('BookOrSculptureText prints PokemonBooksText into a new box at +23', () => {
    const commands = interactionDisplay({ scriptId: 'BOOK_OR_SCULPTURE' }, ctx(), shelf)!;
    expect(commands.filter(c => c.type === 'printText')).toEqual([
      { type: 'printText', program: 'PokemonBooksText', box: 'new' }]);
    expect(firstGlyph(scene(), commands)).toBe(23);
  });

  it('a mansion tile $38 two above the player prints the Diglett sculpture', () => {
    const diglett = interactionDisplay({ scriptId: 'BOOK_OR_SCULPTURE' }, ctx(), { tileset: 'MANSION', tileTwoAbove: 0x38 })!;
    const books = interactionDisplay({ scriptId: 'BOOK_OR_SCULPTURE' }, ctx(), { tileset: 'MANSION', tileTwoAbove: 0x32 })!;
    const other = interactionDisplay({ scriptId: 'BOOK_OR_SCULPTURE' }, ctx(), { tileset: 'LAB', tileTwoAbove: 0x38 })!;
    expect(programs(diglett)).toEqual(['DiglettSculptureText']);
    expect(programs(books)).toEqual(['PokemonBooksText']);
    expect(programs(other)).toEqual(['PokemonBooksText']);
    expect(firstGlyph(scene(), diglett)).toBe(23);
  });

  it.each([[1, 'IndigoPlateauStatuesText2'], [2, 'IndigoPlateauStatuesText3']] as const)(
    'step %i prints IndigoPlateauStatuesText1 then %s', (stepX, second) => {
      const commands = interactionDisplay({ scriptId: 'INDIGO_PLATEAU_STATUES' }, ctx(0, stepX), shelf)!;
      expect(commands.filter(c => c.type === 'printText')).toEqual([
        { type: 'printText', program: 'IndigoPlateauStatuesText1', box: 'new' },
        { type: 'printText', program: second, box: 'new' },
      ]);
      expect(firstGlyph(scene(), commands)).toBe(23);
    });

  it('a plain predef and a book both close for the stubbed 15 frames after an outer wait', () => {
    for (const commands of [
      interactionDisplay({ program: 'ElevatorText' }, ctx(), shelf)!,
      interactionDisplay({ scriptId: 'BOOK_OR_SCULPTURE' }, ctx(), shelf)!,
    ]) {
      const deps = scene();
      const finish = vi.spyOn(deps.textBox, 'finish');
      initScript(commands); updateScript(deps, false);
      let closeStart = -1, closeEnd = -1;
      for (let t = 1; t < 4000 && deps.textBox.active; t++) {
        vi.mocked(isHeld).mockImplementation(b => b === 'b' && t % 2 === 0 && deps.textBox.isWaitingForInput);
        audio.update(); updateScript(deps, false);
        if (closeStart < 0 && deps.textBox.closing) closeStart = t;
        if (closeStart >= 0 && !deps.textBox.active) closeEnd = t;
      }
      expect(finish).toHaveBeenCalledWith({ outerWait: true });
      expect(closeEnd - closeStart).toBe(15);
    }
  });
});

describe('right poster owned count', () => {
  function poster(owned: number[]): string[] {
    restorePokedex([], owned);
    const deps = scene();
    deps.player.setTilePosition(10, 2); deps.player.direction = 'up';
    pressA();
    const follower = deps.pikachuFollower!;
    const action = updateOverworld({ ...deps, currentMapName: 'OaksLab', pikachuFollower: follower,
      findNpc: () => undefined }, createOverworldState());
    expect(action?.type).toBe('script');
    if (action?.type !== 'script') throw new Error('expected a script');
    return programs(action.commands);
  }
  it('one owned species keeps SaveOptionText', () => {
    expect(programs(interactionDisplay({ scriptId: 'OAKS_LAB_RIGHT_POSTER' }, ctx(1), shelf)!)).toEqual(['SaveOptionText']);
    expect(poster([25])).toEqual(['SaveOptionText']);
  });
  it('two owned species print StrengthsAndWeaknessesText', () => {
    expect(programs(interactionDisplay({ scriptId: 'OAKS_LAB_RIGHT_POSTER' }, ctx(2), shelf)!)).toEqual(['StrengthsAndWeaknessesText']);
    expect(poster([25, 1])).toEqual(['StrengthsAndWeaknessesText']);
  });
});

describe('PrintBookshelfText gate', () => {
  function at(direction: Direction, tiles: [number, number][]): ReturnType<Player['checkInteraction']> {
    const deps = bare();
    deps.player.direction = direction;
    vi.spyOn(deps.gameMap, 'getBookshelfPredef').mockImplementation((tx, ty) =>
      tiles.some(([x, y]) => x === tx && y === ty) ? 'BookOrSculptureText' : null);
    pressA();
    return deps.player.checkInteraction(deps.gameMap, []);
  }
  it('faces up onto the one tile above the player', () => {
    expect(at('up', [[8, 7]])).toEqual({ scriptId: 'BOOK_OR_SCULPTURE' });
  });
  it.each(['left', 'right', 'down'] as const)('does nothing facing %s when only that side tile is a shelf', direction => {
    const tile: Record<typeof direction, [number, number]> = { left: [7, 8], right: [9, 8], down: [8, 9] };
    expect(at(direction, [tile[direction]])).toBeNull();
  });
  it('does nothing on the second tile up', () => {
    expect(at('up', [[8, 6]])).toBeNull();
  });
  it('the Blues House Town Map works facing up only', () => {
    const deps = scene('BluesHouse');
    deps.player.setTilePosition(6, 2);
    pressA();
    deps.player.direction = 'up';
    expect(deps.player.checkInteraction(deps.gameMap, [])).toEqual({ scriptId: 'TOWN_MAP_TEXT' });
    for (const direction of ['left', 'right', 'down'] as const) {
      deps.player.direction = direction;
      const found = deps.player.checkInteraction(deps.gameMap, []);
      expect(found && 'scriptId' in found ? found.scriptId : undefined).not.toBe('TOWN_MAP_TEXT');
    }
  });
  it('a hidden event wins over a shelf on the same step', () => {
    const deps = bare();
    deps.gameMap.mapData!.hiddenEvents = [{ x: 4, y: 3, program: 'OakLabEmailText', text: 'mail' }];
    const shelfSpy = vi.spyOn(deps.gameMap, 'getBookshelfPredef').mockReturnValue('PokemonStuffText');
    pressA();
    expect(deps.player.checkInteraction(deps.gameMap, [])).toEqual({ program: 'OakLabEmailText', preDialogue: true });
    expect(shelfSpy).not.toHaveBeenCalled();
  });
});

describe('Lab free movement nests the poster, the e-mail and a shelf', () => {
  function talk(x: number, y: number): ScriptCommand[] {
    const deps = scene();
    setFlag('OAK_ASKED_TO_CHOOSE_MON');
    deps.player.setTilePosition(x, y); deps.player.direction = 'up';
    initScript(buildOaksLabAwaitBallScript()); updateScript(deps, false);
    pressA(); updateScript(deps, true); vi.mocked(isPassPressed).mockReturnValue(false);
    const script = getActiveScript()!;
    expect(script.commands.find(c => c.type === 'displayOpen')).toEqual({ type: 'displayOpen', autoBox: true });
    expect(deps.textBox.phase).toBe('opening');
    for (let t = 1; t < 4000 && deps.textBox.active; t++) {
      vi.mocked(isHeld).mockImplementation(b => b === 'b' && t % 2 === 0 && deps.textBox.isWaitingForInput);
      audio.update(); updateScript(deps, false);
    }
    expect(deps.textBox.active).toBe(false);
    expect(getActiveScript()!.commands[getActiveScript()!.index].type).toBe('awaitInteraction');
    return script.commands;
  }
  it('the right poster dispatches SaveOptionText and returns to the await', () => {
    expect(programs(talk(10, 2))).toContain('SaveOptionText');
  });
  it('the e-mail and a real Lab shelf do the same', () => {
    expect(programs(talk(0, 4))).toContain('OakLabEmailText');
    expect(programs(talk(12, 4))).toContain('PokemonBooksText');
  });
});
