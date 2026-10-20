import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Player } from './player';
import { Npc } from './npc';
import { GameMap } from './map';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import { isHeld, isPassPressed } from '../input';
import { setSpriteIndex, getSpriteIndex } from './sprite_index';
import { createOverworldState, updateOverworld, seenStartPressed } from './overworld_controller';
import type { OverworldDeps } from './overworld_controller';
import { trainerMapScript, TRAINER_SCRIPT } from './map_trainers';
import { restoreFlags, restoreMapScripts, setMapScript } from '../events';
import { initScript, updateScript } from '../script/script_controller';
import type { ScriptDeps, ScriptAction } from '../script/script_controller';
import type { ScriptCommand } from '../script/types';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { loadMapSpriteSets } from './sprite_sets';
import { loadBattleData } from '../battle/data';
import { buildOakGrassScript, palletOakText } from '../story/pallet_town';
import { buildOldMan2Script, buildOldMan1Script } from '../story/viridian_city';
import { buildOaksLabRivalBattleScript, labDisplay } from '../story/oaks_lab';
import { buildViridianMartParcelScript } from '../story/viridian_mart';
import { pewterMuseumText, pewterYoungsterText } from '../story/pewter_city';
import { buildNurseScript } from '../story/pokecenter';
import { clearPikachuEmotion, startPikachuEmotion } from '../pikachu/pikachu_emotion';
import { uiTiles } from '../renderer/ui_tiles';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: () => false,
  isPassPressed: vi.fn(() => false), readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSfxPlaying: () => false, isSoundFinished: () => true,
  playMusic: vi.fn(), stopMusic: vi.fn(), playMusicNew: vi.fn(async () => {}), preloadMusic: vi.fn(async () => {}),
  isMusicChannelActive: () => false, fadeOutAndStopMusic: vi.fn(), isAudioFadingOut: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  drawExclamationBubble: vi.fn(), drawZzzBubble: vi.fn(), drawShadowUnderSprites: vi.fn(),
  getActivePalette: () => 'PALLET', loadFont: async () => ({ width: 128 }),
  loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadMapSpriteSets(); await loadBattleData(); });
beforeEach(() => {
  clearPikachuEmotion(); setSpriteIndex(77); uiTiles.clear(); restoreFlags([]); restoreMapScripts({});
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false); setTextSpeed('fast');
});
afterEach(() => { vi.restoreAllMocks(); });

function world(name = 'Route1'): OverworldDeps & ScriptDeps {
  const player = new Player(); player.setTilePosition(16, 16);
  const gameMap = new GameMap();
  gameMap.mapData = { name, width: 20, height: 20, tileset: 'OVERWORLD', blocks: [],
    borderBlock: 0, connections: [], warps: [], signs: [], npcs: [] };
  vi.spyOn(gameMap, 'isWalkable').mockReturnValue(true);
  vi.spyOn(gameMap, 'getTileAt').mockReturnValue(0x52);
  const deps: OverworldDeps & ScriptDeps = { player, gameMap, npcs: [], pikachuFollower: new PikachuFollower(),
    playerParty: [], playerBag: new Bag(), currentMapName: name, findNpc: id => deps.npcs.find(npc => npc.data.id === id),
    textBox: new TextBox(), restoreMapMusic: vi.fn() };
  return deps;
}
function npc(id = 'rival', textId = 1): Npc {
  return new Npc({ id, textId, x: 8, y: 9, sprite: 'blue', movement: 'stay', direction: 'up', dialogue: 'Hello' });
}

it('stores one aliased byte, including overflow', () => {
  setSpriteIndex(0x103); expect(getSpriteIndex()).toBe(3);
  setSpriteIndex(-1); expect(getSpriteIndex()).toBe(255);
});

it('a turn keeps the last value; land-step entry clears it; walking does not continually clear it', () => {
  const d = world();
  vi.mocked(isHeld).mockImplementation(key => key === 'down');
  updateOverworld(d, createOverworldState());
  expect(d.player.justTurned).toBe(true); expect(getSpriteIndex()).toBe(77);
  updateOverworld(d, createOverworldState());
  expect(d.player.justStartedStep).toBe(true); expect(getSpriteIndex()).toBe(0);
  setSpriteIndex(9);
  updateOverworld(d, createOverworldState());
  expect(d.player.isMoving).toBe(true); expect(getSpriteIndex()).toBe(9);
});

it('collision mask early-return preserves the byte; exact-front fallback writes the found slot', () => {
  const d = world(); d.player.spriteCollisions = 4; // DOWN
  d.player.update(d.gameMap, [], 'down');
  expect(d.player.justCollided).toBe(true); expect(getSpriteIndex()).toBe(77);
  d.player.spriteCollisions = 0;
  d.player.update(d.gameMap, [], 'down', () => {}, () => [
    d.player.collisionSprite(), { slot: 6, available: true, x: 64, y: 76, vx: 0, vy: 0 },
  ]);
  expect(d.player.justCollided).toBe(true); expect(getSpriteIndex()).toBe(6);
});

it('forced no-collision and scripted player steps preserve a script write', () => {
  const d = world(); d.player.forceStep('down'); expect(getSpriteIndex()).toBe(77);
  d.player.cancelMovement(); d.player.startScriptedMove(['up']); d.player.updateScriptedMove();
  expect(getSpriteIndex()).toBe(77);
});

it('A on empty space zeroes the alias; signs write text IDs, including when dialogue is blocked', () => {
  const d = world(); vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
  updateOverworld(d, createOverworldState()); expect(getSpriteIndex()).toBe(0);
  d.gameMap.mapData!.signs = [{ x: 8, y: 9, text: 'Sign', textId: 14 }];
  const ow = createOverworldState(); ow.seenByTrainer = true;
  expect(updateOverworld(d, ow)).toBeNull(); expect(getSpriteIndex()).toBe(14);
});

it('A on a real NPC writes its cartridge ID despite reordered runtime NPCs; hidden events retain the prior byte', () => {
  const d = world(); d.npcs = [npc('rival', 3)];
  vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
  expect(updateOverworld(d, createOverworldState())?.type).toBe('textbox'); expect(getSpriteIndex()).toBe(3);
  setSpriteIndex(77);
  vi.spyOn(d.gameMap, 'getHiddenEventAt').mockReturnValue({ x: 8, y: 9, item: 'POTION', flag: 'FOUND_POTION' });
  expect(updateOverworld(d, createOverworldState())?.type).toBe('script'); expect(getSpriteIndex()).toBe(77);
});

it('START closes the register even when a seen trainer blocks its menu', () => {
  seenStartPressed(world()); expect(getSpriteIndex()).toBe(0);
});

it('Pikachu interaction writes slot 15, its display writes $d4, and return writes zero', () => {
  const d = world(); d.pikachuFollower.visible = true; d.pikachuFollower.spawn(128, 128, 'up');
  vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
  expect(updateOverworld(d, createOverworldState())?.type).toBe('pikachuEmotion'); expect(getSpriteIndex()).toBe(15);
  // The small DOM canvas stands in for the portrait's output surface only.
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({}) }) });
  startPikachuEmotion([]); expect(getSpriteIndex()).toBe(0xd4);
  clearPikachuEmotion(); expect(getSpriteIndex()).toBe(0);
  vi.unstubAllGlobals();
});

it('a sight trainer writes its slot when its walk finishes, before the display', () => {
  const d = world('ViridianForest'); const trainer = npc('trainer', 6); d.npcs = [trainer];
  const ow = createOverworldState(); ow.engagedNpc = trainer; ow.seenByTrainer = true;
  setMapScript('ViridianForest', TRAINER_SCRIPT.START_BATTLE);
  expect(trainerMapScript('ViridianForest', d.player, d.npcs, ow)?.type).toBe('trainerText');
  expect(getSpriteIndex()).toBe(6);
});

async function runToBattle(commands: ScriptCommand[], d: ScriptDeps): Promise<ScriptAction> {
  initScript(commands);
  for (let frame = 0; frame < 15000; frame++) {
    vi.mocked(isPassPressed).mockImplementation(key => key === 'a' && frame % 4 === 1);
    vi.mocked(isHeld).mockImplementation(key => key === 'a' && frame % 4 === 1);
    const action = updateScript(d, frame % 2 === 0);
    if (action?.type === 'catchDemo' || action?.type === 'startBattleTransition') return action;
    if (action?.type === 'scriptEnded') throw new Error('script ended before battle');
    await Promise.resolve();
  }
  throw new Error('script failed to reach battle');
}

it('the real Oak grass script leaves hTextID=1 before the Pikachu demo', async () => {
  const d = world('PalletTown'); d.player.setTilePosition(20, 0);
  const action = await runToBattle(buildOakGrassScript(20), d);
  expect(action).toMatchObject({ type: 'catchDemo', battleType: 'PIKACHU' }); expect(getSpriteIndex()).toBe(1);
});

it.each([false, true])('the real old-man initial demo, forced=%s, keeps slot 8', async forced => {
  const d = world('ViridianCity');
  expect(await runToBattle(buildOldMan2Script(forced, { x: 19, y: 9 }), d))
    .toMatchObject({ type: 'catchDemo', battleType: 'OLD_MAN' });
  expect(getSpriteIndex()).toBe(8);
});

it.each([false, true])('the real rival battle script, adjacent=%s, leaves slot 1 after text ID 11', async adjacent => {
  const d = world('OaksLab'); d.player.setTilePosition(8, 12);
  const rival = npc(); rival.x = 64; rival.y = adjacent ? 80 : 48; await rival.load(); d.npcs = [rival];
  expect(await runToBattle(buildOaksLabRivalBattleScript(4, adjacent ? 5 : 3, 4, 6), d))
    .toMatchObject({ type: 'startBattleTransition', trainerClass: 'RIVAL1' });
  expect(getSpriteIndex()).toBe(1);
});

it('executes DisplayTextID metadata immediately on the opening frame, with no extra wait', () => {
  const d = world(); initScript(palletOakText(1));
  updateScript(d, false); expect(getSpriteIndex()).toBe(1); expect(d.textBox.active).toBe(true);
});

it('pins scripted text writers to source TextPointers, including guides and parcel displays', () => {
  const refs = resolve(__dirname, '../../../refs/pokeyellow');
  if (!existsSync(refs)) return;
  const asm = readFileSync(resolve(refs, 'scripts/OaksLab.asm'), 'utf8');
  const names = [...asm.split('OaksLab_TextPointers:')[1].split('OaksLab_TextPointers2:')[0]
    .matchAll(/^\s*dw_const\s+(\w+),/gm)].map(match => match[1]);
  for (const name of names.slice(10)) {
    if (name === 'OaksLabRivalReceivedMonText' || name === 'OaksLabPlayerReceivedMonText') continue;
    expect(labDisplay(`${name}.Text`)[0].spriteIndex, name).toBe(names.indexOf(name) + 1);
  }
  expect(buildViridianMartParcelScript().filter(cmd => cmd.type === 'displayOpen').map(cmd => cmd.spriteIndex)).toEqual([4, 5]);
  const ctx = { hasFlag: () => false, bag: new Bag(), ownedCount: 0, facing: 'up' as const,
    step: { x: 27, y: 18 }, party: [] };
  const museum = pewterMuseumText(ctx); const choice = museum.find(cmd => cmd.type === 'yesNoChoice');
  expect(choice?.type).toBe('yesNoChoice');
  if (choice?.type === 'yesNoChoice') expect(choice.no.filter(cmd => cmd.type === 'displayOpen').map(cmd => cmd.spriteIndex)).toEqual([13]);
  expect(pewterYoungsterText({ ...ctx, step: { x: 35, y: 17 } }, true)
    .filter(cmd => cmd.type === 'displayOpen').map(cmd => cmd.spriteIndex)).toEqual([5, 14]);
  const repeat = buildOldMan1Script().find(cmd => cmd.type === 'yesNoChoice');
  if (repeat?.type !== 'yesNoChoice') throw new Error('missing demo choice');
  expect(repeat.yes.find(cmd => cmd.type === 'displayOpen')?.spriteIndex).toBe(16);
  const nurse = buildNurseScript(() => undefined).find(cmd => cmd.type === 'yesNoChoice');
  if (nurse?.type !== 'yesNoChoice') throw new Error('missing nurse choice');
  expect(nurse.yes.filter(cmd => cmd.type === 'faceNpc').map(cmd => cmd.spriteIndex)).toEqual([1, 1]);
});
