import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { itemBallScript, hiddenItemScript, potionSampleScript } from './item_pickup';
import { Player } from './player';
import { GameMap } from './map';
import { Npc } from './npc';
import { updateSprites, spriteTable } from './sprites';
import { createOverworldState, updateOverworld } from './overworld_controller';
import { applyStoryNpcState } from './story_state';
import { Bag, initItemNames } from '../items';
import { TextBox, setTextSpeed } from '../text/textbox';
import { loadGameText, getText } from '../text/game_text';
import { initScript, updateScript, getActiveScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { isHeld, isPressed, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { restoreFlags, hasFlag, setFlag, getAllFlags, getAllHiddenObjects, restoreHiddenObjects } from '../events';
import { saveGame, loadGame } from '../save';
import { setPlayerName, substituteNames } from '../core/player_state';
import type { MapData } from '../core';
import type { ScriptCommand } from '../script/types';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { rig, sfxData } from '../test/audio_rig';
import type { Rig } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: vi.fn(() => false),
  isPassPressed: vi.fn(() => false), readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(), isSfxPlaying: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../renderer', () => ({ drawSprite: vi.fn(), loadSprite: vi.fn(async () => ({ height: 96 })) }));

const DATA = resolve(__dirname, '../../data');
const ASM = resolve(__dirname, '../../../refs/pokeyellow');
const flag = 'HIDDEN_ITEM_VIRIDIAN_FOREST_POTION';
let audio: Rig;

beforeAll(async () => {
  await loadGameText();
  initItemNames(JSON.parse(readFileSync(resolve(DATA, 'item_names.json'), 'utf8')) as Record<string, string>);
});
beforeEach(() => {
  vi.clearAllMocks(); restoreFlags([]); restoreHiddenObjects([]); setPlayerName('YELLOW'); setTextSpeed('fast');
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPressed).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false);
  audio = rig();
  vi.mocked(playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});

function scene(mapName = 'ViridianForest'): ScriptDeps {
  const gameMap = new GameMap();
  gameMap.mapData = JSON.parse(readFileSync(resolve(DATA, `maps/${mapName}.json`), 'utf8')) as MapData;
  vi.spyOn(gameMap, 'isWalkable').mockReturnValue(true);
  vi.spyOn(gameMap, 'isGrassTile').mockReturnValue(false);
  const player = new Player(); player.x = 25 * 16; player.y = 12 * 16; player.direction = 'up';
  const npcs = gameMap.mapData.npcs.map(data => new Npc({ ...data }));
  updateSprites(npcs, gameMap, player);
  return { player, gameMap, npcs, textBox: new TextBox(), playerBag: new Bag(), playerParty: [] };
}

function tick(deps: ScriptDeps): ReturnType<typeof updateScript> {
  audio.update(); return updateScript(deps, audio.synth.update % 2 === 0);
}
function until(deps: ScriptDeps, condition: () => boolean): void {
  for (let i = 0; i < 1200; i++) { if (condition()) return; tick(deps); }
  throw new Error('Script did not reach the expected state');
}
function fill(bag: Bag): void {
  bag.items = [{ id: 'POTION', count: 99 }, ...Array.from({ length: 19 }, (_, i) => ({ id: `ITEM_${i}`, count: 1 }))];
}
function interaction(deps: ScriptDeps) {
  vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
  return updateOverworld({ ...deps, currentMapName: deps.gameMap.mapData!.name,
    pikachuFollower: new PikachuFollower(), findNpc: id => deps.npcs.find(npc => npc.data.id === id) }, createOverworldState());
}

/** Read the literal macros for these known strings, including their dynamic item name. */
function asmText(path: string, label: string): string {
  const source = readFileSync(resolve(ASM, path), 'utf8').split(`${label}::`)[1].split(/\n\w[^\n]*::/)[0];
  let text = '';
  for (const line of source.split('\n')) {
    const match = line.match(/^\s*(text|line|cont|para) "(.*)"/);
    if (match) text += (match[1] === 'para' ? '\f' : match[1] === 'line' || match[1] === 'cont' ? '\n' : '') + match[2].replace(/@/g, '').replace(/#/g, 'POKé');
    if (/text_ram/.test(line)) text += 'POTION';
  }
  return substituteNames(text);
}

describe('pickup command builders and cartridge strings', () => {
  it('item balls give before hiding, then jingle and automatic close; failures wait silently', () => {
    const commands = itemBallScript('ViridianForest', 'potion1', 'POTION');
    expect(commands).toEqual([{ type: 'giveItem', itemId: 'POTION',
      successCommands: [{ type: 'hideObject', map: 'ViridianForest', npcId: 'potion1' },
        { type: 'text', message: 'YELLOW found\nPOTION!', end: 'none' }, { type: 'sound', name: 'get_item1' }, { type: 'closeText' }],
      failCommands: [{ type: 'text', message: 'No more room for\nitems!', end: 'none' }, { type: 'textButtonWait' }, { type: 'closeText' }] }]);
  });
  it('hidden items print first, wait for current sound on success, and have two failure waits', () => {
    const commands = hiddenItemScript(flag, 'POTION');
    expect(commands[0]).toEqual({ type: 'text', message: 'YELLOW found\nPOTION!', end: 'none' });
    const give = commands[1]; if (give.type !== 'giveItem') throw new Error('Expected GiveItem');
    expect(give.successCommands).toEqual([{ type: 'setFlag', flag }, { type: 'sound', name: 'get_item2', waitForCurrent: true }, { type: 'closeText' }]);
    expect(give.failCommands).toEqual([{ type: 'textButtonWait' },
      { type: 'text', message: 'But, YELLOW has\nno more room for\nother items!', end: 'none' }, { type: 'textButtonWait' }, { type: 'closeText' }]);
  });
  it('Route 1 sets the flag first, uses prompt, and waits silently after its jingle', () => {
    const commands = potionSampleScript();
    expect(commands.slice(0, 2)).toEqual([{ type: 'setFlag', flag: 'GOT_POTION_SAMPLE' }, { type: 'text', message: getText('ROUTE1_MART_SAMPLE'), end: 'prompt' }]);
    const give = commands[2]; if (give.type !== 'giveItem') throw new Error('Expected GiveItem');
    expect(give.successCommands).toEqual([{ type: 'text', message: 'YELLOW got\nPOTION!', end: 'none' }, { type: 'sound', name: 'get_item1' }, { type: 'textButtonWait' }, { type: 'closeText' }]);
  });
  it.skipIf(!existsSync(ASM))('every new string matches the ASM macros and runtime name', () => {
    setPlayerName('ASH');
    const ball = itemBallScript('ViridianForest', 'potion1', 'POTION')[0];
    const hidden = hiddenItemScript(flag, 'POTION'); const sample = potionSampleScript()[2];
    if (ball.type !== 'giveItem' || hidden[1].type !== 'giveItem' || sample.type !== 'giveItem') throw new Error('Expected GiveItem');
    const checks: [ScriptCommand | undefined, string, string][] = [
      [ball.successCommands?.[1], 'data/text/text_1.asm', '_FoundItemText'],
      [ball.failCommands?.[0], 'data/text/text_1.asm', '_NoMoreRoomForItemText'],
      [hidden[0], 'data/text/text_2.asm', '_FoundHiddenItemText'],
      [hidden[1].failCommands?.[1], 'data/text/text_2.asm', '_HiddenItemBagFullText'],
      [potionSampleScript()[1], 'text/Route1.asm', '_Route1Youngster1MartSampleText'],
      [sample.successCommands?.[0], 'text/Route1.asm', '_Route1Youngster1GotPotionText'],
      [sample.failCommands?.[0], 'text/Route1.asm', '_Route1Youngster1NoRoomText'],
    ];
    for (const [command, path, label] of checks) {
      if (command?.type !== 'text') throw new Error('Expected text');
      expect(command.message).toBe(asmText(path, label));
    }
  });
});

describe('pickup integration with the real jingle interpreter', () => {
  it.each([['ball', 73], ['hidden', 181]] as const)('%s closes exactly %i audio updates after text completes, with a frozen world', (kind, duration) => {
    const deps = scene();
    const commands = kind === 'ball' ? itemBallScript('ViridianForest', 'potion1', 'POTION') : hiddenItemScript(flag, 'POTION');
    const npcUpdates = deps.npcs.map(npc => vi.spyOn(npc, 'update'));
    initScript(commands); until(deps, () => deps.textBox.isComplete);
    const completed = audio.synth.update;
    expect(deps.playerBag.getCount('POTION')).toBe(1);
    until(deps, () => !deps.textBox.active);
    expect(audio.synth.update - completed).toBe(duration);
    expect(vi.mocked(playSFX).mock.calls).toEqual([[kind === 'ball' ? 'get_item1' : 'get_item2']]);
    for (const update of npcUpdates) expect(update).not.toHaveBeenCalled();
  });
  it('controller pickup hides the ball at box opening, persists it and frees its tile', () => {
    const deps = scene(); const action = interaction(deps);
    expect(action?.type).toBe('script'); if (action?.type !== 'script') throw new Error('Expected script');
    const ball = deps.npcs.find(npc => npc.data.id === 'potion1')!;
    expect(spriteTable(deps.player, deps.npcs).find(sprite => sprite.slot === deps.npcs.indexOf(ball) + 1)?.available).toBe(true);
    initScript(action.commands); until(deps, () => deps.textBox.active);
    expect(ball.hidden).toBe(true); expect(getAllHiddenObjects()).toEqual(['ViridianForest:potion1']);
    expect(deps.playerBag.getCount('POTION')).toBe(1);
    until(deps, () => !getActiveScript());
    saveGame('ViridianForest', deps.player.x, deps.player.y, 'up', [], deps.playerBag, 3000, new Set(),
      getAllFlags(), [], 0, 90, 128, [], 0, [], [], 'YELLOW', 'BLUE', undefined, undefined, {}, getAllHiddenObjects());
    const saved = loadGame()!; expect(saved.hiddenObjects).toEqual(['ViridianForest:potion1']);
    restoreHiddenObjects(saved.hiddenObjects ?? []);
    const reload = scene(); applyStoryNpcState('ViridianForest', reload.npcs);
    expect(reload.npcs.find(npc => npc.data.id === 'potion1')!.hidden).toBe(true);
    expect(interaction(reload)).toBeNull();
    reload.player.update(reload.gameMap, reload.npcs, 'up');
    expect(reload.player.justStartedStep).toBe(true);
    restoreHiddenObjects([]); const fresh = scene(); applyStoryNpcState('ViridianForest', fresh.npcs);
    expect(fresh.npcs.find(npc => npc.data.id === 'potion1')!.hidden).toBe(false);
  });
  it('full-bag ball waits silently, keeps the object and records nothing', () => {
    const deps = scene(); fill(deps.playerBag); const before = structuredClone(deps.playerBag.items);
    initScript(itemBallScript('ViridianForest', 'potion1', 'POTION'));
    until(deps, () => deps.textBox.isComplete); tick(deps);
    expect(deps.textBox.active).toBe(true); expect(playSFX).not.toHaveBeenCalled();
    vi.mocked(isPressed).mockImplementation(key => key === 'b'); tick(deps);
    expect(deps.textBox.active).toBe(false); expect(getAllHiddenObjects()).toEqual([]);
    expect(deps.npcs.find(npc => npc.data.id === 'potion1')!.hidden).toBe(false);
    expect(deps.playerBag.items).toEqual(before);
  });
  it('holding A keeps the successful ball box up beyond the jingle', () => {
    const deps = scene(); vi.mocked(isHeld).mockImplementation(key => key === 'a');
    initScript(itemBallScript('ViridianForest', 'potion1', 'POTION'));
    until(deps, () => deps.textBox.isComplete);
    for (let i = 0; i < 80; i++) tick(deps);
    expect(deps.textBox.active).toBe(true);
    vi.mocked(isHeld).mockReturnValue(false); tick(deps); expect(deps.textBox.active).toBe(false);
  });
  it('hidden text precedes the give, success sets the flag, and repeated interaction falls through', () => {
    const deps = scene(); deps.player.x = 16; deps.player.y = 19 * 16;
    const action = interaction(deps); if (action?.type !== 'script') throw new Error('Expected hidden script');
    initScript(action.commands); tick(deps); expect(deps.playerBag.items).toEqual([]);
    until(deps, () => !getActiveScript()); expect(hasFlag(flag)).toBe(true);
    expect(interaction(deps)).toBeNull();
    deps.gameMap.mapData!.signs.push({ x: 1, y: 18, text: 'A sign.' });
    expect(interaction(deps)).toEqual({ type: 'textbox', text: 'A sign.', pendingTownMap: undefined });
  });
  it('full-bag hidden item has found/wait/new-box/cont-beep/silent-wait flow and stays obtainable', () => {
    const deps = scene(); fill(deps.playerBag); initScript(hiddenItemScript(flag, 'POTION'));
    until(deps, () => deps.textBox.isComplete); expect(hasFlag(flag)).toBe(false); expect(playSFX).not.toHaveBeenCalled();
    vi.mocked(isPressed).mockImplementation(key => key === 'b'); tick(deps);
    vi.mocked(isPressed).mockReturnValue(false); until(deps, () => deps.textBox.isWaitingForInput);
    expect(deps.textBox.hasMorePages).toBe(true);
    vi.mocked(isHeld).mockImplementation(key => key === 'a');
    for (let frame = 0; frame < 3; frame++) tick(deps);
    vi.mocked(isHeld).mockReturnValue(false); until(deps, () => deps.textBox.isComplete);
    expect(deps.textBox.active).toBe(true); expect(vi.mocked(playSFX).mock.calls).toEqual([['press_ab']]);
    vi.mocked(isPressed).mockImplementation(key => key === 'b'); tick(deps);
    expect(deps.textBox.active).toBe(false); expect(hasFlag(flag)).toBe(false);
    deps.playerBag.items.pop(); initScript(hiddenItemScript(flag, 'POTION'));
    vi.mocked(isPressed).mockReturnValue(false); until(deps, () => !getActiveScript()); expect(hasFlag(flag)).toBe(true);
  });
  it.each([false, true])('Route 1 sample sets its flag before giving (full bag=%s)', full => {
    const deps = scene('Route1'); if (full) fill(deps.playerBag);
    initScript(potionSampleScript()); tick(deps); expect(hasFlag('GOT_POTION_SAMPLE')).toBe(true);
    expect(deps.playerBag.getCount('POTION')).toBe(full ? 99 : 0);
    // Read the sample's paragraphs, including the protected final prompt.
    for (let i = 0; i < 600; i++) {
      vi.mocked(isPressed).mockImplementation(key => key === 'b' && deps.textBox.isWaitingForInput); tick(deps);
      vi.mocked(isHeld).mockImplementation(key => key === 'b' && deps.textBox.isWaitingForInput);
      if (getActiveScript()?.commands[getActiveScript()!.index]?.type === 'textButtonWait') break;
    }
    vi.mocked(isPressed).mockReturnValue(false); vi.mocked(isHeld).mockReturnValue(false); tick(deps);
    expect(deps.textBox.active).toBe(true);
    expect(deps.playerBag.getCount('POTION')).toBe(full ? 99 : 1);
    expect(vi.mocked(playSFX).mock.calls.some(call => call[0] === 'get_item1')).toBe(!full);
    applyStoryNpcState('Route1', deps.npcs);
    expect(deps.npcs.find(npc => npc.data.id === 'youngster1')!.data.dialogue).toBe(getText('ROUTE1_POTION_FOLLOWUP'));
  });
});

describe('ASM interaction priority', () => {
  it('hidden event beats bookshelf, sign and NPC; a found item skips the bookshelf', () => {
    const deps = scene(); const map = deps.gameMap.mapData!;
    map.hiddenEvents = [{ x: 25, y: 11, item: 'POTION', flag }]; map.signs = [{ x: 25, y: 11, text: 'Sign' }];
    const shelf = vi.spyOn(deps.gameMap, 'getBookshelfText').mockReturnValue('Bookshelf');
    vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
    expect(deps.player.checkInteraction(deps.gameMap, deps.npcs, hasFlag)).toEqual({ item: 'POTION', flag });
    setFlag(flag); expect(deps.player.checkInteraction(deps.gameMap, deps.npcs, hasFlag)).toEqual({ text: 'Sign' });
    expect(shelf).not.toHaveBeenCalled(); map.signs = [];
    expect(deps.player.checkInteraction(deps.gameMap, deps.npcs, hasFlag)).toEqual({ npc: deps.npcs.find(npc => npc.data.id === 'potion1') });
  });
  it('bookshelf precedes signs, and signs precede NPCs without turning them', () => {
    const deps = scene(); deps.gameMap.mapData!.signs = [{ x: 25, y: 11, text: 'Sign' }];
    const shelf = vi.spyOn(deps.gameMap, 'getBookshelfText').mockReturnValue('Bookshelf');
    const face = vi.spyOn(deps.npcs.find(npc => npc.data.id === 'potion1')!, 'faceDirection');
    vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
    expect(deps.player.checkInteraction(deps.gameMap, deps.npcs, hasFlag)).toEqual({ text: 'Bookshelf', preDialogue: true });
    shelf.mockReturnValue(null); expect(deps.player.checkInteraction(deps.gameMap, deps.npcs, hasFlag)).toEqual({ text: 'Sign' });
    expect(face).not.toHaveBeenCalled();
  });
  it('today’s 19 maps have no overlapping hidden events, signs and NPCs', () => {
    const files = readdirSync(resolve(DATA, 'maps')); expect(files).toHaveLength(19);
    for (const file of files) {
      const map = JSON.parse(readFileSync(resolve(DATA, 'maps', file), 'utf8')) as MapData;
      const groups = [map.hiddenEvents ?? [], map.signs, map.npcs];
      for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        for (const a of groups[i]) for (const b of groups[j]) expect([map.name, a.x, a.y]).not.toEqual([map.name, b.x, b.y]);
      }
    }
  });
});
