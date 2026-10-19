import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initScript, updateScript } from './script_controller';
import type { ScriptDeps } from './script_controller';
import type { ScriptCommand } from './types';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { GameMap } from '../overworld/map';
import { PassClock } from '../overworld/walk_pace';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { TextBox } from '../text/textbox';
import { Bag } from '../items';
import { updateSprites } from '../overworld/sprites';
import { decodeRle, pewterGuys, npcDirections, PEWTER_MUSEUM_PLAYER, PEWTER_MUSEUM_GUIDE,
  PEWTER_GYM_PLAYER, PEWTER_GYM_GUIDE, PEWTER_MUSEUM_COORDS, PEWTER_GYM_COORDS } from '../overworld/simulated_joypad';
import { hideObject, isObjectHidden, getAllHiddenObjects, restoreHiddenObjects } from '../events';
import { readJoypad, syncJoypadRead } from '../input';
import { playMusic, playSFX, isSoundFinished } from '../audio';
import { drawSprite } from '../renderer';
import { openOverworldUi, setOpeningSpriteUpdates } from '../overworld/ui_entry';
import { joyIgnore, setJoyIgnore } from '../input/joy_ignore';
import { uiTiles } from '../renderer/ui_tiles';

vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false, isPassPressed: () => false,
  readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../audio', () => ({ playMusic: vi.fn(), playSFX: vi.fn(), isSfxPlaying: () => false,
  isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ loadSprite: async () => ({ width: 16, height: 96 }), drawSprite: vi.fn(),
  fillRect: vi.fn(), drawTile: vi.fn(), drawShadowUnderSprites: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); restoreHiddenObjects([]); setJoyIgnore('none'); uiTiles.clear();
  vi.mocked(isSoundFinished).mockReturnValue(true); vi.spyOn(Math, 'random').mockReturnValue(0.5); });
afterEach(() => { initScript([]); vi.restoreAllMocks(); });

function scene(x = 10, y = 10, gx = 10, gy = 9): ScriptDeps {
  const player = new Player(); player.x = x * 16; player.y = y * 16;
  const gameMap = new GameMap();
  gameMap.mapData = { name: 'TestEscort', width: 30, height: 30, tileset: 'OVERWORLD', connections: [],
    blocks: Array<number>(900).fill(0), borderBlock: 0, warps: [], signs: [], npcs: [] };
  gameMap.blockset = [Array<number>(16).fill(0x2c)]; gameMap.collisionTiles = new Set([0x2c]);
  const npc = new Npc({ id: 'guide', sprite: 'youngster', x: gx, y: gy, movement: 'stay', direction: 'down', dialogue: '' });
  const deps: ScriptDeps = { player, gameMap, npcs: [npc], playerParty: [], playerBag: new Bag(),
    textBox: new TextBox({ closeFrames: () => 23, updateSprites: () => updateSprites(deps.npcs, gameMap, player, deps.pikachuFollower) }),
    restoreMapMusic: vi.fn(), resetPassClock: vi.fn() };
  return deps;
}

describe('RunNPCMovementScript on a synthetic test map', () => {
  const variants = [...PEWTER_MUSEUM_COORDS.map(c => ({ ...c, which: 'museum' as const })),
    ...PEWTER_GYM_COORDS.map(c => ({ ...c, which: 'gym' as const }))];
  it.each(variants)('$which ($x,$y): function 0 runs this pass; Done runs after the last input', v => {
    const museum = v.which === 'museum', count = museum ? 185 : 329;
    const deps = scene(v.x, v.y, museum ? 27 : 35, museum ? 17 : 16), npc = deps.npcs[0];
    Reflect.set(npc.movement, 'status', 'resting'); Reflect.set(npc.movement, 'delay', 29);
    const decoded = decodeRle(museum ? PEWTER_MUSEUM_PLAYER : PEWTER_GYM_PLAYER);
    let pass = 0; const done: number[] = [], calls: number[] = [];
    vi.spyOn(npc, 'update').mockImplementation(function (this: Npc, ctx) { calls.push(pass); Npc.prototype.update.call(this, ctx); });
    initScript([{ type: 'npcMovementScript', npcId: 'guide',
      guidePath: npcDirections(decodeRle(museum ? PEWTER_MUSEUM_GUIDE : PEWTER_GYM_GUIDE).entries),
      joypad: pewterGuys(decoded.entries, decoded.count - 1, v.which, v.x, v.y), music: 'museumguy' },
      { type: 'callback', fn: () => done.push(pass) }]);
    updateScript(deps, false); expect(playMusic).not.toHaveBeenCalled(); expect(calls).toHaveLength(0);
    for (pass = 1; pass <= count; pass++) {
      updateScript(deps, true);
      expect(done).toEqual([]);
      expect([npc.mapStepX, npc.mapStepY]).toEqual(museum ? [27, 17] : [35, 16]);
      if (pass === 1) { expect([npc.x / 16, npc.y / 16]).toEqual(museum ? [27, 17] : [35, 16]); expect(calls).toEqual([1]); }
      const pixels = [deps.player.x, deps.player.y, npc.x, npc.y];
      updateScript(deps, false); expect([deps.player.x, deps.player.y, npc.x, npc.y]).toEqual(pixels);
    }
    expect(playMusic).toHaveBeenCalledExactlyOnceWith('museumguy');
    expect([deps.player.x / 16, deps.player.y / 16]).toEqual(museum ? [14, 8] : [11, 18]);
    expect([npc.x / 16, npc.y / 16]).toEqual(museum ? [13, 8] : [12, 18]);
    expect(deps.player.stepWasSimulated).toBe(true);
    updateScript(deps, true); // loop variable is now count+1
    expect(done).toEqual([count + 1]); expect(calls).toHaveLength(count);
    expect(npc.movement).toMatchObject({ status: 'resting', delay: 29, movement1: 'stay', movement2: 'down' });
    expect(npc.movement.inStepAnimation).toBe(false);
  });
  it('NO_INPUT advances the guide while retaining Pikachu’s single queued seed', () => {
    const deps = scene(), npc = deps.npcs[0], pik = new PikachuFollower(); deps.pikachuFollower = pik;
    pik.visible = true; pik.spawnAtState(160, 176, 'up', 0); pik.refreshFollow({ x: 10, y: 10 });
    initScript([{ type: 'npcMovementScript', npcId: 'guide', guidePath: ['down'], joypad: { entries: Array<number>(9).fill(0), index: 9 } }]);
    for (let p = 1; p <= 9; p++) {
      updateScript(deps, true);
      expect(npc.y).toBe(144 + (p - 1) * 2); expect(deps.player.y).toBe(160);
      expect(pik.followBufferLength).toBe(1);
    }
    expect(readJoypad).toHaveBeenCalledTimes(9);
  });
  it('simulated reversals cross Pikachu and append after its update, without reseeding', () => {
    const deps = scene(37, 18, 35, 16), pik = new PikachuFollower(); deps.pikachuFollower = pik;
    pik.visible = true; pik.spawnAtState(36 * 16, 18 * 16, 'right', 0); pik.refreshFollow({ x: 37, y: 18 });
    const decoded = decodeRle(PEWTER_GYM_PLAYER);
    initScript([{ type: 'npcMovementScript', npcId: 'guide', guidePath: npcDirections(decodeRle(PEWTER_GYM_GUIDE).entries),
      joypad: pewterGuys(decoded.entries, decoded.count - 1, 'gym', 37, 18) }]);
    for (let p = 1; p <= 18; p++) {
      updateScript(deps, true);
      if (p === 8) expect([pik.x / 16, pik.followBufferLength]).toEqual([36, 1]);
      if (p === 9) expect([pik.x / 16, pik.followBufferLength, pik.followCommand]).toEqual([36, 2, 3]);
      if (p === 10) expect([pik.x / 16, pik.mapStepX]).toEqual([36.125, 37]);
      if (p === 16) expect([deps.player.x / 16, pik.x / 16]).toEqual([36, 36.875]);
      if (p === 18) expect([pik.x / 16, pik.mapStepX, pik.followBufferLength]).toEqual([36.875, 36, 1]);
    }
  });
  it('museum-above reversals preserve the queued LEFT before following RIGHT', () => {
    const deps = scene(27, 16, 27, 17), pik = new PikachuFollower(); deps.pikachuFollower = pik;
    pik.visible = true; pik.spawnAtState(28 * 16, 16 * 16, 'left', 0); pik.refreshFollow({ x: 27, y: 16 });
    const decoded = decodeRle(PEWTER_MUSEUM_PLAYER);
    initScript([{ type: 'npcMovementScript', npcId: 'guide', guidePath: npcDirections(decodeRle(PEWTER_MUSEUM_GUIDE).entries),
      joypad: pewterGuys(decoded.entries, decoded.count - 1, 'museum', 27, 16) }]);
    for (let p = 1; p <= 18; p++) {
      updateScript(deps, true);
      if (p === 1) expect([deps.player.x / 16, pik.x / 16, pik.followBufferLength]).toEqual([26.875, 28, 2]);
      if (p === 8) expect([deps.player.x / 16, pik.x / 16]).toEqual([26, 27.125]);
      if (p === 9) expect([pik.x / 16, pik.followBufferLength, pik.followCommand]).toEqual([27, 2, 4]);
      if (p === 10) expect([pik.x / 16, pik.mapStepX]).toEqual([26.875, 26]);
      if (p === 16) expect([deps.player.x / 16, pik.x / 16]).toEqual([27, 26.125]);
      if (p === 18) expect([pik.x / 16, pik.mapStepX]).toEqual([26.125, 27]);
    }
  });
  it('gym (36,17) retains the seed during eight idle passes and then queues DOWN after LEFT', () => {
    const deps = scene(36, 17, 35, 16), pik = new PikachuFollower(); deps.pikachuFollower = pik;
    pik.visible = true; pik.spawnAtState(35 * 16, 17 * 16, 'right', 0); pik.refreshFollow({ x: 36, y: 17 });
    const decoded = decodeRle(PEWTER_GYM_PLAYER);
    initScript([{ type: 'npcMovementScript', npcId: 'guide', guidePath: npcDirections(decodeRle(PEWTER_GYM_GUIDE).entries),
      joypad: pewterGuys(decoded.entries, decoded.count - 1, 'gym', 36, 17) }]);
    for (let p = 1; p <= 26; p++) {
      updateScript(deps, true);
      if (p === 8) expect([pik.x / 16, pik.followBufferLength]).toEqual([35, 1]);
      if (p === 10) expect([pik.x / 16, pik.mapStepX]).toEqual([35.125, 36]);
      if (p === 16) expect([deps.player.x / 16, pik.x / 16]).toEqual([35, 35.875]);
      if (p === 18) expect([pik.x / 16, pik.mapStepX]).toEqual([35.875, 35]);
      if (p === 25) expect([pik.x / 16, pik.y / 16, pik.followCommand]).toEqual([35, 17, 3]);
      if (p === 26) expect([pik.x / 16, pik.y / 16, pik.mapStepY]).toEqual([35, 17.125, 18]);
    }
  });
  it.each([false, true])('OverworldLoop waits two frames across either old parity, with east-return update=%s', extra => {
    const deps = scene(), clock = new PassClock(), npc = deps.npcs[0], done = vi.fn();
    const updates = vi.spyOn(npc, 'update');
    deps.resetPassClock = () => clock.reset();
    clock.tick(); // the old pair is deliberately one frame in
    initScript([{ type: 'overworldLoop', updateSprites: extra },
      { type: 'npcMovementScript', npcId: 'guide', guidePath: ['down'], joypad: { entries: [0], index: 1 } },
      { type: 'callback', fn: done }]);
    updateScript(deps, false); expect(updates).toHaveBeenCalledTimes(extra ? 1 : 0);
    updateScript(deps, clock.tick()); expect(updates).toHaveBeenCalledTimes(extra ? 1 : 0);
    updateScript(deps, clock.tick()); expect(updates).toHaveBeenCalledTimes(extra ? 2 : 1);
    expect(done).not.toHaveBeenCalled();
    updateScript(deps, clock.tick()); expect(done).not.toHaveBeenCalled();
    updateScript(deps, clock.tick()); expect(done).toHaveBeenCalledOnce();
  });
  it('ShowObject clears only its saved toggle, unhides the live NPC, and really updates every slot now', () => {
    const deps = scene(), npc = deps.npcs[0]; npc.hidden = true;
    hideObject('TestEscort', 'guide'); hideObject('OtherMap', 'ball');
    const saved = getAllHiddenObjects(); restoreHiddenObjects(saved); // same save/load representation
    const update = vi.spyOn(npc, 'update'), collision = vi.spyOn(deps.player, 'detectSpriteCollisions'), done = vi.fn();
    initScript([{ type: 'showObject', map: 'TestEscort', npcId: 'guide' }, { type: 'callback', fn: done }]);
    updateScript(deps, false);
    expect(npc.hidden).toBe(false); expect(isObjectHidden('TestEscort', 'guide')).toBe(false);
    expect(isObjectHidden('OtherMap', 'ball')).toBe(true);
    expect(update).toHaveBeenCalledOnce(); expect(collision).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledOnce();
    restoreHiddenObjects(getAllHiddenObjects()); expect(isObjectHidden('TestEscort', 'guide')).toBe(false);
  });
  it('wait-only music restore freezes input/world, plays no SFX and resumes in the ready tick', () => {
    const deps = scene(), updates = vi.spyOn(deps.npcs[0], 'update'), done = vi.fn();
    vi.mocked(isSoundFinished).mockReturnValue(false);
    initScript([{ type: 'restoreMapMusic', waitForCurrent: true }, { type: 'callback', fn: done }]);
    for (let i = 0; i < 4; i++) updateScript(deps, true);
    expect(updates).not.toHaveBeenCalled(); expect(readJoypad).not.toHaveBeenCalled(); expect(syncJoypadRead).not.toHaveBeenCalled();
    expect(playSFX).not.toHaveBeenCalled(); expect(deps.restoreMapMusic).not.toHaveBeenCalled();
    vi.mocked(isSoundFinished).mockReturnValue(true); updateScript(deps, false);
    expect(deps.restoreMapMusic).toHaveBeenCalledOnce(); expect(done).toHaveBeenCalledOnce();
  });
  it('live UP precedes the six frozen frames; only the following image write repaints it', async () => {
    const deps = scene(), npc = deps.npcs[0]; await npc.load(); npc.showStandingImage('left');
    initScript([{ type: 'overworldLoop' }, { type: 'faceNpc', npcId: 'guide', direction: 'up', write: 'live' },
      { type: 'wait', frames: 6 }, { type: 'faceNpc', npcId: 'guide', direction: 'up', write: 'image' }]);
    for (let t = 0; t <= 8; t++) {
      updateScript(deps, false); npc.render(0, 0);
      expect(drawSprite).toHaveBeenLastCalledWith(expect.anything(), 0, t < 8 ? 32 : 16, 160, 140, false);
      if (t >= 2) expect(npc.direction).toBe('up');
    }
    expect(readJoypad).not.toHaveBeenCalled(); expect(syncJoypadRead).not.toHaveBeenCalled();
  });
  it('image LEFT is retained during the display while live RIGHT is saved/restored at close', async () => {
    const deps = scene(), npc = deps.npcs[0]; await npc.load(); npc.setLiveFacing('right');
    initScript([{ type: 'overworldLoop' },
      { type: 'faceNpc', npcId: 'guide', direction: 'left', write: 'image', restoreAtClose: true },
      { type: 'displayOpen', spriteUpdate: false }, { type: 'displayClose', outerWait: false }]);
    for (let t = 0; t < 22; t++) updateScript(deps, false);
    expect(npc.direction).toBe('right'); npc.render(0, 0);
    expect(drawSprite).toHaveBeenLastCalledWith(expect.anything(), 0, 32, 160, 140, false);
    npc.setLiveFacing('up'); // a live-byte disturbance must not change the saved RIGHT
    updateScript(deps, false); expect(npc.direction).toBe('right');
  });
  it('the suppressed opening update is consumed once, even with no visible follower', () => {
    const deps = scene(), pik = new PikachuFollower(); pik.visible = true;
    const hook = vi.spyOn(pik, 'fontLoadedUpdate').mockImplementation(() => {}), capture = vi.fn();
    setOpeningSpriteUpdates(false); openOverworldUi('script', deps.player, deps.gameMap, pik, capture);
    expect(hook).not.toHaveBeenCalled(); expect(capture).toHaveBeenCalledOnce();
    openOverworldUi('pikachu_emotion', deps.player, deps.gameMap, pik, capture); expect(hook).toHaveBeenCalledOnce();
    setOpeningSpriteUpdates(false); pik.visible = false;
    openOverworldUi('script', deps.player, deps.gameMap, pik, capture);
    pik.visible = true; openOverworldUi('pikachu_emotion', deps.player, deps.gameMap, pik, capture);
    expect(hook).toHaveBeenCalledTimes(2);
  });
  it.each([['ready', false], ['resting', false], ['ready', true], ['resting', true]] as const)(
    'native walk-off counts from the return tick, including HIDE/RESET updates (status=%s, museum=%s)', (status, museum) => {
    const deps = museum ? scene(14, 8, 27, 17) : scene(11, 18, 35, 16), npc = deps.npcs[0], clock = new PassClock(), markers: [string, number][] = [];
    Reflect.set(npc.movement, 'status', status); Reflect.set(npc.movement, 'delay', 13);
    let frame = 0; deps.resetPassClock = () => clock.reset();
    const updates: number[] = [];
    vi.spyOn(npc, 'update').mockImplementation(function (this: Npc, ctx) { updates.push(frame); Npc.prototype.update.call(this, ctx); });
    const commands: ScriptCommand[] = [
      { type: 'setSpritePosition1', npcId: 'guide', mapStep: museum ? { x: 13, y: 8 } : { x: 12, y: 18 }, screenDx: museum ? 0 : -16 },
      { type: 'joyIgnore', mask: 'all' },
      { type: 'moveNpc', npcId: 'guide', path: Array(museum ? 4 : 5).fill(museum ? 'down' : 'right'), options: { keepStatus: true, bytesToFF: true }, inPass: true },
      { type: 'callback', fn: () => markers.push(['hide', frame]) },
      { type: 'hideObject', map: 'TestEscort', npcId: 'guide' }, { type: 'updateSprites', fontLoaded: false },
      { type: 'overworldLoop', updateSprites: true },
      { type: 'restoreSpritePosition2', npcId: 'guide', saved: museum ? { x: 27, y: 17 } : { x: 35, y: 16 } },
      { type: 'showObject', map: 'TestEscort', npcId: 'guide' }, { type: 'joyIgnore', mask: 'none' },
      { type: 'callback', fn: () => markers.push(['reset', frame]) },
      { type: 'overworldLoop', resumeInput: true },
    ];
    initScript(commands); updateScript(deps, true); // C, no need for story/display wiring
    for (frame = 1; frame <= 178; frame++) {
      const action = updateScript(deps, clock.tick());
      if (action?.type === 'scriptEnded' && action.resumePass) {
        // Main's ordinary JoypadOverworld continuation, with no real buttons in this fixture.
        readJoypad(); deps.player.update(deps.gameMap, deps.npcs, null,
          () => updateSprites(deps.npcs, deps.gameMap, deps.player, deps.pikachuFollower));
      }
    }
    const hide = (museum ? 138 : 172) + (status === 'resting' ? 2 : 0);
    expect(markers).toEqual([['hide', hide], ['reset', hide + 2]]);
    expect(updates.filter(t => t === hide)).toHaveLength(2);
    expect(updates.filter(t => t === hide + 2)).toHaveLength(2);
    expect(joyIgnore()).toBe('none'); expect(npc.hidden).toBe(false);
    expect([npc.mapStepX, npc.mapStepY]).toEqual(museum ? [27, 17] : [35, 16]);
  });
});
