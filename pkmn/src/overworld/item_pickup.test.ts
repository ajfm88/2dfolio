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
import { loadGameText } from '../text/game_text';
import { initScript, updateScript, getActiveScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { isHeld, isPressed, isPassPressed, syncJoypadRead } from '../input';
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
import { mapCloseFrames } from './sprite_sets';
import type { MapSpriteSetsFile } from '../rom/extractors/map_sprite_sets';
import { loadTextPrograms, getTextProgramData } from '../text/program_data';

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
  await loadTextPrograms();
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
  const sets = JSON.parse(readFileSync(resolve(DATA, 'map_sprite_sets.json'), 'utf8')) as MapSpriteSetsFile;
  const textBox = new TextBox({ closeFrames: () => mapCloseFrames(sets, mapName, { x: player.mapStepX, y: player.mapStepY }),
    updateSprites: () => updateSprites(npcs, gameMap, player) });
  return { player, gameMap, npcs, textBox, playerBag: new Bag(), playerParty: [] };
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

/** Inspect the programs/bindings the builders pass; do not re-spell pickup strings. */
function commandText(command: ScriptCommand | undefined): string {
  if (command?.type === 'text') return command.message;
  if (command?.type !== 'printText') throw new Error('Expected text or PrintText');
  const programs = getTextProgramData().programs;
  const flatten = (label: string): string => programs[label].map(op => {
    if (op.op === 'far') return flatten(op.program);
    if (op.op === 'text') return op.text.replace(/<(DONE|PROMPT)>/g, '');
    if (op.op === 'ram') return command.bindings?.[op.binding] ?? '';
    return '';
  }).join('');
  return substituteNames(flatten(command.program));
}

describe('pickup command builders and cartridge strings', () => {
  it('item balls give before hiding, then jingle and automatic close; failures wait silently', () => {
    const commands = itemBallScript('ViridianForest', 'potion1', 'POTION');
    expect(commands).toEqual([{ type: 'displayOpen' }, { type: 'giveItem', itemId: 'POTION',
      successCommands: [{ type: 'hideObject', map: 'ViridianForest', npcId: 'potion1' },
        { type: 'printText', program: 'FoundItemText', bindings: { stringBuffer: 'POTION' } }, { type: 'displayClose', outerWait: false }],
      failCommands: [{ type: 'printText', program: 'NoMoreRoomForItemText' }, { type: 'displayClose', outerWait: true }] }]);
  });
  it('hidden items print first, wait for current sound on success, and have two failure waits', () => {
    const commands = hiddenItemScript(flag, 'POTION');
    expect(commands.slice(0, 2)).toEqual([{ type: 'displayOpen' },
      { type: 'printText', program: 'FoundHiddenItemText', box: 'keep', bindings: { nameBuffer: 'POTION' } }]);
    const give = commands[2]; if (give.type !== 'giveItem') throw new Error('Expected GiveItem');
    expect(give.successCommands).toEqual([{ type: 'setFlag', flag }, { type: 'sound', name: 'get_item2', waitForCurrent: true }, { type: 'displayClose', outerWait: false }]);
    expect(give.failCommands).toEqual([{ type: 'textButtonWait' },
      { type: 'printText', program: 'HiddenItemBagFullText' }, { type: 'displayClose', outerWait: true }]);
  });
  it('Route 1 opens, sets its flag first, and uses program-owned prompt/jingle plus outer wait', () => {
    const commands = potionSampleScript(false);
    expect(commands.slice(0, 3)).toEqual([{ type: 'displayOpen', autoBox: true },
      { type: 'setFlag', flag: 'GOT_POTION_SAMPLE' },
      { type: 'printText', program: 'Route1PrintYoungster1Text.MartSampleText' }]);
    const give = commands[3]; if (give.type !== 'giveItem') throw new Error('Expected GiveItem');
    expect(give.successCommands).toEqual([{ type: 'printText', program: 'Route1PrintYoungster1Text.GotPotionText', bindings: { stringBuffer: 'POTION' } }]);
    expect(give.failCommands).toEqual([{ type: 'printText', program: 'Route1PrintYoungster1Text.NoRoomText' }]);
    expect(commands[commands.length - 1]).toEqual({ type: 'displayClose', outerWait: true });
  });
  it.skipIf(!existsSync(ASM))('every new string matches the ASM macros and runtime name', () => {
    setPlayerName('ASH');
    const ball = itemBallScript('ViridianForest', 'potion1', 'POTION')[1];
    const hidden = hiddenItemScript(flag, 'POTION'); const sample = potionSampleScript(false)[3];
    if (ball.type !== 'giveItem' || hidden[2].type !== 'giveItem' || sample.type !== 'giveItem') throw new Error('Expected GiveItem');
    const checks: [ScriptCommand | undefined, string, string][] = [
      [ball.successCommands?.[1], 'data/text/text_1.asm', '_FoundItemText'],
      [ball.failCommands?.[0], 'data/text/text_1.asm', '_NoMoreRoomForItemText'],
      [hidden[1], 'data/text/text_2.asm', '_FoundHiddenItemText'],
      [hidden[2].failCommands?.[1], 'data/text/text_2.asm', '_HiddenItemBagFullText'],
      [potionSampleScript(false)[2], 'text/Route1.asm', '_Route1Youngster1MartSampleText'],
      [sample.successCommands?.[0], 'text/Route1.asm', '_Route1Youngster1GotPotionText'],
      [sample.failCommands?.[0], 'text/Route1.asm', '_Route1Youngster1NoRoomText'],
    ];
    for (const [command, path, label] of checks) {
      expect(commandText(command)).toBe(asmText(path, label));
    }
  });
});

describe('pickup integration with the real jingle interpreter', () => {
  it.each([['ball', false, 23], ['ball', true, 23], ['hidden', false, 20]] as const)(
    '%s (full=%s) first writes/reads at T+%i, with no reads during DisplayTextIDInit', (kind, full, first) => {
      const deps = scene(); if (full) fill(deps.playerBag);
      initScript(kind === 'ball' ? itemBallScript('ViridianForest', 'potion1', 'POTION') : hiddenItemScript(flag, 'POTION'));
      tick(deps); const start = audio.synth.update;
      for (let frame = 1; frame < first; frame++) { tick(deps); expect(syncJoypadRead).not.toHaveBeenCalled(); }
      tick(deps);
      expect(audio.synth.update - start).toBe(first);
      expect(syncJoypadRead).toHaveBeenCalledTimes(1); // PlaceString writes its glyph, then PrintLetterDelay reads
    });
  it.each([['ball', 73], ['hidden', 181]] as const)('%s waits its %i-update jingle plus Forest reload, then one sprite update', (kind, duration) => {
    const deps = scene();
    const commands = kind === 'ball' ? itemBallScript('ViridianForest', 'potion1', 'POTION') : hiddenItemScript(flag, 'POTION');
    const npcUpdates = deps.npcs.map(npc => vi.spyOn(npc, 'update'));
    initScript(commands); until(deps, () => vi.mocked(playSFX).mock.calls.some(([name]) => name === (kind === 'ball' ? 'get_item1' : 'get_item2')));
    const completed = audio.synth.update;
    expect(deps.playerBag.getCount('POTION')).toBe(1);
    until(deps, () => !deps.textBox.active);
    expect(audio.synth.update - completed).toBe(duration + 11); // Forest W=3, full CloseTextDisplay
    expect(vi.mocked(playSFX).mock.calls).toEqual([[kind === 'ball' ? 'get_item1' : 'get_item2']]);
    for (const update of npcUpdates) expect(update).toHaveBeenCalledTimes(1); // trailing UpdateSprites only
  });
  it('controller pickup hides the ball after the 20-frame opening, persists it and frees its tile', () => {
    const deps = scene(); const action = interaction(deps);
    expect(action?.type).toBe('script'); if (action?.type !== 'script') throw new Error('Expected script');
    const ball = deps.npcs.find(npc => npc.data.id === 'potion1')!;
    expect(spriteTable(deps.player, deps.npcs).find(sprite => sprite.slot === deps.npcs.indexOf(ball) + 1)?.available).toBe(true);
    initScript(action.commands); until(deps, () => deps.textBox.active);
    expect(ball.hidden).toBe(false); expect(deps.playerBag.items).toEqual([]);
    for (let frame = 1; frame < 20; frame++) { tick(deps); expect(ball.hidden).toBe(false); }
    tick(deps);
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
    until(deps, () => deps.textBox.isWaitingForInput && !deps.textBox.hasMorePages);
    expect(deps.textBox.active).toBe(true); expect(playSFX).not.toHaveBeenCalled();
    vi.mocked(isHeld).mockImplementation(key => key === 'b'); tick(deps);
    until(deps, () => !deps.textBox.active);
    expect(deps.textBox.active).toBe(false); expect(getAllHiddenObjects()).toEqual([]);
    expect(deps.npcs.find(npc => npc.data.id === 'potion1')!.hidden).toBe(false);
    expect(deps.playerBag.items).toEqual(before);
  });
  it('holding A keeps the successful ball box up beyond the jingle', () => {
    const deps = scene(); vi.mocked(isHeld).mockImplementation(key => key === 'a');
    initScript(itemBallScript('ViridianForest', 'potion1', 'POTION'));
    until(deps, () => vi.mocked(playSFX).mock.calls.length > 0);
    for (let i = 0; i < 80; i++) tick(deps);
    expect(deps.textBox.active).toBe(true);
    vi.mocked(isHeld).mockReturnValue(false); tick(deps);
    expect(deps.textBox.closing).toBe(true);
    for (let i = 0; i < 11; i++) tick(deps);
    expect(deps.textBox.active).toBe(false);
  });
  it('hidden text precedes the give, success sets the flag, and repeated interaction falls through', () => {
    const deps = scene(); deps.player.x = 16; deps.player.y = 19 * 16;
    const action = interaction(deps); if (action?.type !== 'script') throw new Error('Expected hidden script');
    initScript(action.commands); tick(deps); expect(deps.playerBag.items).toEqual([]);
    until(deps, () => !getActiveScript()); expect(hasFlag(flag)).toBe(true);
    expect(interaction(deps)).toBeNull();
    deps.gameMap.mapData!.signs.push({ x: 1, y: 18, text: 'A sign.' });
    expect(interaction(deps)).toEqual({ type: 'textbox', text: 'A sign.' });
  });
  it('full-bag hidden item has found/wait/new-box/cont-beep/silent-wait flow and stays obtainable', () => {
    const deps = scene(); fill(deps.playerBag); initScript(hiddenItemScript(flag, 'POTION'));
    until(deps, () => deps.textBox.isWaitingForInput); expect(hasFlag(flag)).toBe(false); expect(playSFX).not.toHaveBeenCalled();
    vi.mocked(isHeld).mockImplementation(key => key === 'b'); tick(deps);
    vi.mocked(isHeld).mockReturnValue(false); until(deps, () => deps.textBox.isWaitingForInput);
    expect(deps.textBox.hasMorePages).toBe(true);
    vi.mocked(isHeld).mockImplementation(key => key === 'a');
    for (let frame = 0; frame < 3; frame++) tick(deps);
    vi.mocked(isHeld).mockReturnValue(false); until(deps, () => deps.textBox.phase === 'waiting' && !deps.textBox.hasMorePages);
    expect(deps.textBox.active).toBe(true); expect(vi.mocked(playSFX).mock.calls).toEqual([['press_ab']]);
    vi.mocked(isHeld).mockImplementation(key => key === 'b'); tick(deps);
    until(deps, () => !deps.textBox.active);
    expect(deps.textBox.active).toBe(false); expect(hasFlag(flag)).toBe(false);
    deps.playerBag.items.pop(); initScript(hiddenItemScript(flag, 'POTION'));
    vi.mocked(isHeld).mockReturnValue(false); until(deps, () => !getActiveScript()); expect(hasFlag(flag)).toBe(true);
  });
  it.each([false, true])('Route 1 sample sets its flag before giving (full bag=%s)', full => {
    const deps = scene('Route1'); if (full) fill(deps.playerBag);
    const original = deps.npcs.find(npc => npc.data.id === 'youngster1')!.data.dialogue;
    initScript(potionSampleScript(false)); tick(deps); expect(hasFlag('GOT_POTION_SAMPLE')).toBe(false);
    for (let i = 0; i < 20; i++) tick(deps);
    expect(hasFlag('GOT_POTION_SAMPLE')).toBe(true);
    expect(deps.playerBag.getCount('POTION')).toBe(full ? 99 : 0);
    // Keep its protected prompt, embedded jingle, and final outer silent wait.
    for (let i = 0; i < 1600 && getActiveScript(); i++) {
      vi.mocked(isHeld).mockImplementation(key => key === 'b' && i % 2 === 0 && deps.textBox.isWaitingForInput);
      tick(deps);
    }
    expect(getActiveScript()).toBeNull();
    expect(deps.playerBag.getCount('POTION')).toBe(full ? 99 : 1);
    expect(vi.mocked(playSFX).mock.calls.some(call => call[0] === 'get_item1')).toBe(!full);
    applyStoryNpcState('Route1', deps.npcs);
    expect(deps.npcs.find(npc => npc.data.id === 'youngster1')!.data.dialogue).toBe(original);
    expect(potionSampleScript()[1]).toEqual({ type: 'printText', program: 'Route1PrintYoungster1Text.AlsoGotPokeballsText' });
  });
});

describe('plain NPC/sign call contracts through the controller (A5b4)', () => {
  it.each([['PalletTown', 3, 'text'], ['Route1', 2, 'printText'], ['ViridianCity', 6, undefined]] as const)(
    '%s text ID %i carries only its supported call kind %s', (mapName, id, call) => {
      const deps = scene(mapName);
      deps.npcs = deps.npcs.filter(npc => npc.data.textId === id);
      expect(deps.npcs).toHaveLength(1);
      const npc = deps.npcs[0];
      deps.player.x = npc.x; deps.player.y = npc.y + 16; deps.player.direction = 'up';
      const action = interaction(deps);
      expect(action?.type).toBe('textbox');
      if (action?.type !== 'textbox') throw new Error('Expected plain dialogue');
      expect(action.call).toBe(call);
      if (call === undefined) expect('call' in action).toBe(false); // handler stays on its old string path
    });

  it.each([[9, 'printText'], [12, 'text']] as const)('Viridian sign ID %i keeps its %s call', (textId, call) => {
    const deps = scene('ViridianCity'); deps.npcs = [];
    deps.gameMap.mapData!.signs = [{ x: 25, y: 11, text: 'A sign.', textId }];
    expect(interaction(deps)).toEqual({ type: 'textbox', text: 'A sign.', call });
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
