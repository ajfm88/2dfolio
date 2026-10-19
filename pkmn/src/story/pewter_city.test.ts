import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
vi.mock('../audio', () => ({ playMusic: vi.fn(), playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), isSfxPlaying: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }),
  loadTilesetTransparent: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }) }));
import { pewterMuseumText, pewterYoungsterText, pewterCityScript, pewterCityScriptState, PewterScript } from './pewter_city';
import { getTextHandler } from './text_handlers';
import type { TextHandlerContext } from './text_handlers';
import type { ScriptCommand } from '../script/types';
import { initScript, updateScript, getActiveScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { PassClock } from '../overworld/walk_pace';
import { updateSprites } from '../overworld/sprites';
import { openOverworldUi } from '../overworld/ui_entry';
import { createOverworldState, runMapScript, updateOverworld, handleStepComplete } from '../overworld/overworld_controller';
import type { OverworldDeps } from '../overworld/overworld_controller';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import * as events from '../events';
import * as input from '../input';
import { joyIgnore, setJoyIgnore } from '../input/joy_ignore';
import { playMusic, isSoundFinished } from '../audio';
import { drawSprite } from '../renderer';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { loadGameText } from '../text/game_text';
import { uiTiles } from '../renderer/ui_tiles';
import type { Direction } from '../core';

const ctx = (x = 27, y = 18): TextHandlerContext => ({ hasFlag: events.hasFlag, bag: new Bag(), ownedCount: 0,
  facing: 'up', step: { x, y }, party: [] });
const flatten = (commands: ScriptCommand[]): ScriptCommand[] => commands.flatMap(c => [c,
  ...(c.type === 'yesNoChoice' ? [...flatten(c.yes), ...flatten(c.no)] : [])]);
const last = <T>(items: T[]): T | undefined => items[items.length - 1];
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadGameText(); });
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); events.restoreFlags([]); events.restoreMapScripts({}); events.restoreHiddenObjects([]);
  setJoyIgnore('none'); setTextSpeed('fast'); uiTiles.clear();
  for (const button of ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'] as const) input.setKey(button, false);
  input.updateInput(); input.syncJoypadRead(); vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.mocked(isSoundFinished).mockReturnValue(true);
});
afterEach(() => { initScript([]); vi.restoreAllMocks(); });

describe('Pewter default and registered source handlers', () => {
  it('DEFAULT clears the museum ticket and script every pass without inventing saved zero entries', () => {
    events.setFlag('BOUGHT_MUSEUM_TICKET'); events.setFlag('OTHER'); events.setMapScript('Museum1F', 3);
    events.setMapScript('ViridianCity', 2);
    expect(pewterCityScript(ctx())).toBeNull(); expect(events.hasFlag('BOUGHT_MUSEUM_TICKET')).toBe(false);
    expect(events.getAllMapScripts()).toEqual({ ViridianCity: 2 }); expect(events.hasFlag('OTHER')).toBe(true);
    events.setFlag('BOUGHT_MUSEUM_TICKET'); expect(pewterCityScript(ctx())).toBeNull();
    expect(events.hasFlag('BOUGHT_MUSEUM_TICKET')).toBe(false);
    const write = vi.spyOn(events, 'setMapScript'); pewterCityScript(ctx()); expect(write).not.toHaveBeenCalled();
    expect(events.getAllMapScripts()).not.toHaveProperty('PewterCity');
  });
  it.each([[35, 17], [36, 17], [37, 18], [37, 19]])('east (%i,%i) uses the same handler under SELECT|START|D-pad, with no face/update prefix', (x, y) => {
    const script = pewterCityScript(ctx(x, y)); expect(script?.[0]).toEqual({ type: 'displayOpen', autoBox: true });
    expect(script?.[1]).toEqual({ type: 'printText', program: 'PewterCityYoungsterText.YoureATrainerFollowMeText' });
    expect(joyIgnore()).toBe('controls'); expect(pewterCityScriptState()).toBe(PewterScript.DEFAULT);
    expect(script?.find(c => c.type === 'overworldLoop')).toEqual({ type: 'overworldLoop', updateSprites: true });
    events.setFlag('BEAT_BROCK'); events.setFlag('BOUGHT_MUSEUM_TICKET'); setJoyIgnore('none');
    expect(pewterCityScript(ctx(x, y))).toBeNull(); expect(joyIgnore()).toBe('none');
    expect(events.hasFlag('BOUGHT_MUSEUM_TICKET')).toBe(false); // reset precedes the Brock test
  });
  it.each([[34, 17], [35, 16], [36, 18], [37, 17], [38, 18], [37, 20]])('nearby (%i,%i) does not trigger', (x, y) => {
    expect(pewterCityScript(ctx(x, y))).toBeNull(); expect(joyIgnore()).toBe('none');
  });
  it('museum YES only praises fossils; NO arms the museum escort after YouHaveToGo', () => {
    expect(getTextHandler('PewterCity', 3)).toBe(pewterMuseumText);
    const flow = pewterMuseumText(ctx()), choice = flow.find(c => c.type === 'yesNoChoice');
    expect(choice?.type).toBe('yesNoChoice'); if (choice?.type !== 'yesNoChoice') throw new Error('choice');
    expect(flow[1]).toEqual({ type: 'printText', program: 'PewterCitySuperNerd1Text.DidYouCheckOutMuseumText' });
    expect(choice.yes).toEqual([{ type: 'printText', program: 'PewterCitySuperNerd1Text.WerentThoseFossilsAmazingText' }, { type: 'displayClose', outerWait: true }]);
    expect(choice.no[0]).toEqual({ type: 'printText', program: 'PewterCitySuperNerd1Text.YouHaveToGoText' });
    expect(choice.no.slice(1, 4).map(c => c.type)).toEqual(['callback', 'displayClose', 'overworldLoop']);
    expect(choice.no[3]).toEqual({ type: 'overworldLoop', updateSprites: false });
    for (const c of flatten(flow)) if (c.type === 'printText') expect(getTextPrograms()[c.program], c.program).toBeDefined();
  });
  it('Youngster talk uses YoureATrainer, with no east-only update or six-frame museum wait', () => {
    expect(getTextHandler('PewterCity', 5)).toBe(pewterYoungsterText);
    const flow = pewterYoungsterText(ctx(34, 16));
    expect(flow[1]).toEqual({ type: 'printText', program: 'PewterCityYoungsterText.YoureATrainerFollowMeText' });
    expect(flow.find(c => c.type === 'overworldLoop')).toEqual({ type: 'overworldLoop', updateSprites: false });
    expect(flow.filter(c => c.type === 'wait')).toEqual([]);
    expect(flow.find(c => c.type === 'faceNpc')).toEqual({ type: 'faceNpc', npcId: 'youngster', direction: 'left', write: 'image', restoreAtClose: true });
  });
  it('the handler and direct-display labels match pret’s text_far targets', () => {
    const path = resolve(__dirname, '../../../refs/pokeyellow/scripts/PewterCity.asm'); if (!existsSync(path)) return;
    const asm = readFileSync(path, 'utf8');
    for (const label of ['DidYouCheckOutMuseumText', 'WerentThoseFossilsAmazingText', 'YouHaveToGoText', 'YoureATrainerFollowMeText'])
      expect(asm).toContain(`.${label}:\n\ttext_far _PewterCity${label === 'YoureATrainerFollowMeText' ? 'Youngster' : 'SuperNerd1'}${label}`);
    expect(asm).toContain('PewterCitySuperNerd1ItsRightHereText:\n\ttext_far _PewterCitySuperNerd1ItsRightHereText');
    expect(asm).toContain('PewterCityYoungsterGoTakeOnBrockText:\n\ttext_far _PewterCityYoungsterGoTakeOnBrockText');
  });
});

async function scene(x: number, y: number, facing: Direction, follower = true) {
  const gameMap = new GameMap(); await gameMap.load('PewterCity');
  const npcs = gameMap.mapData!.npcs.map(n => new Npc({ ...n })); await Promise.all(npcs.map(n => n.load()));
  const player = new Player(); player.x = x * 16; player.y = y * 16; player.direction = facing;
  const pikachuFollower = new PikachuFollower(); pikachuFollower.visible = follower;
  const clock = new PassClock(), close = vi.fn();
  const deps: ScriptDeps = { gameMap, npcs, player, playerParty: [], playerBag: new Bag(), pikachuFollower,
    textBox: new TextBox({ closeFrames: () => 23, updateSprites: () => { uiTiles.clear(); updateSprites(npcs, gameMap, player, pikachuFollower); close(); } }),
    restoreMapMusic: () => { void playMusic('cities1'); }, resetPassClock: () => clock.reset() };
  const ow = createOverworldState();
  const owDeps: OverworldDeps = { ...deps, pikachuFollower, currentMapName: 'PewterCity', findNpc: id => npcs.find(n => n.data.id === id) };
  const context = (): TextHandlerContext => ({ ...ctx(player.mapStepX, player.mapStepY), facing: player.direction, findNpc: owDeps.findNpc });
  return { deps, owDeps, ow, clock, close, context };
}

const variants: { x: number; y: number; facing: Direction; museum: boolean; east: boolean }[] = [
  { x: 27, y: 18, facing: 'up', museum: true, east: false },
  { x: 27, y: 16, facing: 'down', museum: true, east: false },
  { x: 26, y: 17, facing: 'right', museum: true, east: false },
  { x: 28, y: 17, facing: 'left', museum: true, east: false },
  { x: 34, y: 16, facing: 'right', museum: false, east: false },
  { x: 35, y: 17, facing: 'up', museum: false, east: true },
  { x: 37, y: 18, facing: 'left', museum: false, east: true },
  { x: 37, y: 19, facing: 'left', museum: false, east: true },
  { x: 36, y: 17, facing: 'left', museum: false, east: true },
];

async function run(v: typeof variants[number], answer: 'yes' | 'no' = 'no', follower = true, lateSound = false) {
  const s = await scene(v.x, v.y, v.facing, follower), { deps } = s, npcId = v.museum ? 'super_nerd1' : 'youngster';
  const npc = s.owDeps.findNpc(npcId)!;
  // Mix ready/resting before the initial close; the observed function-0 state is the exit's source status.
  Reflect.set(npc.movement, 'status', !v.museum && !v.east ? 'resting' : v.x % 2 ? 'resting' : 'ready');
  Reflect.set(npc.movement, 'delay', 1);
  const pika = deps.pikachuFollower!;
  const back = v.facing === 'up' ? [0, 1] : v.facing === 'down' ? [1, 0] : v.facing === 'right' ? [-1, 0] : [-1, 0];
  pika.spawnAtState((v.x + back[0]) * 16, (v.y + back[1]) * 16, v.facing, 0); pika.refreshFollow({ x: v.x, y: v.y });
  const font = vi.spyOn(pika, 'fontLoadedUpdate'), pixels: number[] = [], updates: number[] = [];
  let frame = 0, start = -1, done = -1, terminator = -1, startStatus = '', revision = 0;
  let actorsAtDone: (number | string)[] = [], placementAtClose: number[] = [];
  const displayImages: unknown[][] = [];
  const readFrames: number[] = [], liveAtOpening: Direction[] = [];
  const sync = input.syncJoypadRead;
  vi.spyOn(input, 'syncJoypadRead').mockImplementation(() => { readFrames.push(frame); sync(); });
  const music: [string, number][] = [], openings: [number, boolean | undefined][] = [], prints: [string, number][] = [];
  const closes: { frame: number; available: boolean }[] = [], toggles: [string, number][] = [], states: [number, number][] = [];
  const startMove = npc.startInStepMove.bind(npc);
  vi.spyOn(npc, 'startInStepMove').mockImplementation(path => { start = frame; startStatus = npc.movement.status; startMove(path); });
  const endMove = npc.endInStep.bind(npc);
  vi.spyOn(npc, 'endInStep').mockImplementation(() => {
    done = frame; actorsAtDone = [deps.player.x / 16, deps.player.y / 16, deps.player.direction,
      npc.x / 16, npc.y / 16, npc.direction, npc.mapStepX, npc.mapStepY]; endMove();
    if (lateSound) vi.mocked(isSoundFinished).mockImplementation(() => frame >= done + 10);
  });
  const simulated = deps.player.simulatedPass.bind(deps.player);
  vi.spyOn(deps.player, 'simulatedPass').mockImplementation((...args) => {
    if (getActiveScript()?.commands[getActiveScript()!.index]?.type === 'npcMovementScript') pixels.push(frame);
    simulated(...args);
  });
  const update = npc.update.bind(npc); vi.spyOn(npc, 'update').mockImplementation(c => { updates.push(frame); update(c); });
  const close = s.close.getMockImplementation(); s.close.mockImplementation(() => { close?.(); closes.push({ frame, available: npc.collisionSprite(deps.player.x, deps.player.y, 1).available }); });
  const open = deps.textBox.open.bind(deps.textBox);
  vi.spyOn(deps.textBox, 'open').mockImplementation(opts => { openings.push([frame, opts?.spriteUpdate]); open(opts); });
  const print = deps.textBox.print.bind(deps.textBox);
  vi.spyOn(deps.textBox, 'print').mockImplementation((source, opts) => { if ('program' in source) prints.push([source.program, frame]); print(source, opts); });
  vi.mocked(playMusic).mockImplementation(name => { music.push([name, frame]); return Promise.resolve(); });
  const hide = events.hideObject, show = events.showObject;
  vi.spyOn(events, 'hideObject').mockImplementation((map, id) => { toggles.push(['hide', frame]); hide(map, id); });
  vi.spyOn(events, 'showObject').mockImplementation((map, id) => { toggles.push(['show', frame]); show(map, id); });
  let action;
  if (v.east) action = runMapScript(s.owDeps, s.ow);
  else { input.setKey('a', true); input.readJoypad(); action = updateOverworld(s.owDeps, s.ow); input.setKey('a', false); }
  expect(action?.type).toBe('script'); if (action?.type !== 'script') throw new Error('Pewter dispatch');
  initScript(action.commands); updateScript(deps, false); // main primes the opening in its dispatch tick
  const capture = () => {
    if (deps.textBox.active && deps.textBox.displayRevision !== revision) {
      revision = deps.textBox.displayRevision;
      openOverworldUi('script', deps.player, deps.gameMap, pika, () => { uiTiles.clear(); uiTiles.cover(0, 96, 160, 48); });
      if (revision === 2) {
        npc.render(deps.player.x - 64, deps.player.y - 60);
        displayImages.push([...(last(vi.mocked(drawSprite).mock.calls) ?? [])]);
        liveAtOpening.push(npc.direction);
      }
    }
  };
  capture();
  for (frame = 1; frame < 4000 && getActiveScript(); frame++) {
    const cmd = getActiveScript()?.commands[getActiveScript()!.index];
    const choice = cmd?.type === 'yesNoChoice', tap = frame % 2 === 0;
    input.setKey('a', choice && answer === 'yes' && tap);
    input.setKey('b', tap && ((choice && answer === 'no') || (!choice && deps.textBox.isWaitingForInput)));
    input.updateInput();
    const result = updateScript(deps, s.clock.tick());
    if (result?.type === 'overworldStep') expect(handleStepComplete(s.owDeps, s.ow, true)).toBeNull();
    if (result?.type === 'scriptEnded' && result.resumePass) { input.readJoypad(); updateOverworld(s.owDeps, s.ow); }
    capture();
    if (closes.length === 2 && closes[1].frame === frame) placementAtClose = [npc.x, npc.y];
    const state = pewterCityScriptState(); if (last(states)?.[0] !== state) states.push([state, frame]);
    if ((state === PewterScript.HIDE_MUSEUM || state === PewterScript.HIDE_GYM) && npc.scriptedMoveDone && terminator < 0) terminator = frame;
  }
  expect(getActiveScript()).toBeNull();
  return { ...s, npc, start, done, terminator, actorsAtDone, displayImages, liveAtOpening, placementAtClose, readFrames,
    startStatus, music, openings, prints, closes, toggles, states, pixels, updates, font };
}

describe('Pewter source handlers through the real controller and committed map', () => {
  it.each(variants)('($x,$y), museum=$museum, east=$east: initial close → escort → display → exit → hide/reset', async v => {
    const r = await run(v), count = v.museum ? 185 : 329, close = r.closes[1].frame;
    expect(r.start - r.closes[0].frame).toBe(2);
    expect(r.updates.filter(t => t === r.closes[0].frame)).toHaveLength(v.east ? 2 : 1);
    expect(r.pixels).toEqual(Array.from({ length: count }, (_, i) => r.start + 2 * i));
    expect(r.done).toBe(r.start + 2 * count);
    expect(r.actorsAtDone).toEqual(v.museum ? [14, 8, 'up', 13, 8, 'left', 27, 17] : [11, 18, 'right', 12, 18, 'right', 35, 16]);
    expect([r.deps.player.mapStepX, r.deps.player.mapStepY, r.deps.player.direction]).toEqual(v.museum ? [14, 8, 'up'] : [11, 18, 'right']);
    const opening = r.done + (v.museum ? 6 : 0);
    expect(r.music).toEqual([['museumguy', r.start], ['cities1', opening]]);
    expect(r.openings).toEqual([[0, undefined], [opening, false]]);
    expect(r.displayImages[0].slice(1)).toEqual(v.museum ? [0, 16, 48, 56, false] : [0, 32, 80, 56, false]);
    expect(r.liveAtOpening).toEqual([v.museum ? 'up' : 'right']);
    expect(last(r.prints)).toEqual([v.museum ? 'PewterCitySuperNerd1ItsRightHereText' : 'PewterCityYoungsterGoTakeOnBrockText', opening + 20]);
    expect(r.readFrames.find(t => t >= opening)).toBe(opening + 20); // direct first glyph, no nested Delay3
    expect(r.placementAtClose).toEqual(v.museum ? [208, 128] : [r.startStatus === 'resting' ? 176 : 192, 288]);
    expect(r.closes[1].available).toBe(false); // frozen talk-time MAPX/MAPY are off-window at the end display close
    const hide = close + (v.museum ? 138 : 172) + (r.startStatus === 'resting' ? 2 : 0);
    expect(r.terminator).toBe(hide - 2);
    expect(r.toggles).toEqual([['hide', hide], ['show', hide + 2]]);
    expect(r.updates.filter(t => t === hide)).toHaveLength(2); expect(r.updates.filter(t => t === hide + 2)).toHaveLength(2);
    expect(r.npc.movement).toMatchObject({ movement1: 'stay', movement2: 'none', status: 'ready' });
    expect(r.npc.hidden).toBe(false); expect(events.getAllHiddenObjects()).toEqual([]); expect(joyIgnore()).toBe('none');
    expect([r.npc.mapStepX, r.npc.mapStepY]).toEqual(v.museum ? [27, 17] : [35, 16]);
    // RESET's stale screen bytes are never visible; restoring map-derived pixels is sufficient.
    expect(r.npc.collisionSprite(r.deps.player.x, r.deps.player.y, 1).available).toBe(false);
    expect(r.states.map(([state]) => state)).toEqual(v.museum ? [0, 1, 2, 3, 0] : [0, 4, 5, 6, 0]);
    expect(r.font).toHaveBeenCalledOnce(); expect(events.getAllMapScripts()).not.toHaveProperty('PewterCity');
    const reloaded = new Npc(r.npc.data); expect(reloaded.movement.movement2).toBe(v.museum ? 'none' : 'down');
    // Bring the live sprite back into view: STAY/NONE can turn, while a new map's Youngster is STAY/DOWN.
    r.deps.player.x = r.npc.mapStepX * 16; r.deps.player.y = (r.npc.mapStepY + 1) * 16;
    r.deps.player.simulatedPass(null, false, () => updateSprites(r.deps.npcs, r.deps.gameMap, r.deps.player), r.deps.gameMap, r.deps.npcs);
    expect(r.npc.direction).toBe('left');
  });
  it('museum YES closes with no escort, music or persistent state', async () => {
    const r = await run(variants[0], 'yes', false);
    expect(r.prints.map(([label]) => label)).toEqual(['PewterCitySuperNerd1Text.DidYouCheckOutMuseumText', 'PewterCitySuperNerd1Text.WerentThoseFossilsAmazingText']);
    expect(r.start).toBe(-1); expect(r.music).toEqual([]); expect(r.toggles).toEqual([]); expect(pewterCityScriptState()).toBe(0);
  });
  it.each([0, 4])('end display waits for a late SFX before restoring cities1 (variant %i)', async index => {
    const r = await run(variants[index], 'no', true, true);
    expect(r.music).toEqual([['museumguy', r.start], ['cities1', r.done + 10]]);
    expect(r.openings[1]).toEqual([r.done + 10, false]);
  });
  it('runMapScript gates busy/door passes and leaves east-triggered facing untouched before the display', async () => {
    const s = await scene(35, 17, 'up', false), npc = s.owDeps.findNpc('youngster')!;
    npc.setLiveFacing('right'); npc.showStandingImage('right');
    const update = vi.spyOn(npc, 'update');
    s.ow.doorExitStep = true; events.setFlag('BOUGHT_MUSEUM_TICKET'); expect(runMapScript(s.owDeps, s.ow)).toBeNull();
    expect(events.hasFlag('BOUGHT_MUSEUM_TICKET')).toBe(true); s.ow.doorExitStep = false;
    s.deps.player.forceStep('right'); expect(runMapScript(s.owDeps, s.ow)).toBeNull(); s.deps.player.cancelMovement();
    s.deps.player.x = 35 * 16;
    const action = runMapScript(s.owDeps, s.ow); expect(action?.type).toBe('script');
    expect(update).not.toHaveBeenCalled(); expect(npc.direction).toBe('right'); npc.render(0, 0);
    expect(drawSprite).toHaveBeenLastCalledWith(expect.anything(), 0, 32, 560, 252, true);
    expect(events.hasFlag('BOUGHT_MUSEUM_TICKET')).toBe(false);
  });
});
