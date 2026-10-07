import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { Player } from './player';
import { Npc } from './npc';
import type { NpcUpdateContext } from './npc';
import { GameMap } from './map';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import { createOverworldState, runMapScript, updateOverworld, handleStepComplete, buildNurseScript } from './overworld_controller';
import type { OverworldDeps } from './overworld_controller';
import { isHeld, isPassPressed } from '../input';
import { loadBattleData, loadWildEncounters, createPokemon } from '../battle';
import { loadGameText, getText } from '../text/game_text';
import { loadPikachuMovementData } from '../pikachu/pikachu_movement_data';
import { restoreFlags, restoreMapScripts, setFlag } from '../events';
import { getPikachuMood, restorePikachuHappiness } from '../pikachu/pikachu_happiness';
import { drawSprite } from '../renderer';
import { uiTiles } from '../renderer/ui_tiles';
import { UiEntry, overworldUiOpen, fontLoadedUpdateSprites } from './ui_entry';
import { initScript, updateScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import type { ScriptCommand } from '../script';
import { TextBox } from '../text/textbox';
import type { Direction } from '../core';
import { createHash } from 'node:crypto';
import { PassClock } from './walk_pace';
import { recordStepForPikachu, updateSprites } from './sprites';
import { readJoypad } from '../input';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: vi.fn(() => false), readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => false }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSfxPlaying: () => false }));
vi.mock('../renderer', () => ({ loadSprite: vi.fn(async () => ({ height: 96 })), drawSprite: vi.fn(), drawExclamationBubble: vi.fn(), drawShadowUnderSprites: vi.fn() }));

beforeAll(async () => { await loadBattleData(); await loadGameText(); await loadWildEncounters('Route1'); await loadPikachuMovementData(); });
beforeEach(() => {
  restoreFlags([]);
  restoreMapScripts({});
  restorePikachuHappiness(90, 200);
  uiTiles.clear();
  vi.mocked(isHeld).mockReturnValue(false);
  vi.mocked(isPassPressed).mockReturnValue(false);
  vi.mocked(drawSprite).mockClear();
});
afterEach(() => vi.restoreAllMocks());

/** One UpdateSprites for a lone NPC, with the player standing at tile (px, py). */
function npcCtx(px = 16, py = 16, over: Partial<NpcUpdateContext> = {}): NpcUpdateContext {
  return {
    isWalkable: () => true, playerWalking: false, playerMapStep: { x: px / 2, y: py / 2 },
    playerX: px * 8, playerY: py * 8, slot: 1, sprites: () => [], ...over,
  };
}

function world(name = 'Route1'): OverworldDeps {
  const player = new Player();
  player.setTilePosition(16, 16);
  const gameMap = new GameMap();
  gameMap.mapData = { name, width: 20, height: 20, tileset: 'OVERWORLD', blocks: [], borderBlock: 0, connections: [], warps: [], signs: [], npcs: [] };
  vi.spyOn(gameMap, 'isWalkable').mockReturnValue(true);
  vi.spyOn(gameMap, 'getTileAt').mockReturnValue(0x52);
  const pikachu = createPokemon('PIKACHU', 5)!;
  return { player, gameMap, npcs: [], pikachuFollower: new PikachuFollower(), playerBag: new Bag(), playerParty: [pikachu], currentMapName: name, findNpc: () => undefined };
}

describe('standing map-script hook', () => {
  it.each(['up', 'down', 'left', 'right'] as const)('Pallet triggers while stationary facing %s, even with a starter', facing => {
    const deps = world('PalletTown');
    deps.player.setTilePosition(20, 0);
    deps.player.direction = facing;
    setFlag('GOT_STARTER');
    expect(deps.player.justFinishedStep).toBe(false);
    expect(runMapScript(deps, createOverworldState())?.type).toBe('script');
    setFlag('FOLLOWED_OAK_INTO_LAB');
    expect(runMapScript(deps, createOverworldState())).toBeNull();
  });

  it('Pallet requires y exactly zero', () => {
    const deps = world('PalletTown');
    deps.player.setTilePosition(20, -2);
    expect(runMapScript(deps, createOverworldState())).toBeNull();
  });

  it('Viridian triggers after text/battle/warp without needing another step', () => {
    const deps = world('ViridianCity');
    deps.player.setTilePosition(38, 18);
    expect(runMapScript(deps, createOverworldState())?.type).toBe('script');
  });

  it('the lab rival triggers at y=6, rather than anywhere past it', () => {
    const deps = world('OaksLab');
    deps.npcs.push(new Npc({ id: 'rival', sprite: 'blue', x: 4, y: 3, movement: 'stay', dialogue: '' }));
    setFlag('GOT_STARTER');
    deps.player.setTilePosition(8, 14);
    expect(runMapScript(deps, createOverworldState())).toBeNull();
    deps.player.setTilePosition(8, 12);
    expect(runMapScript(deps, createOverworldState())?.type).toBe('script');
  });

  it('a held key completes the step first; the next standing hook starts the script', () => {
    const deps = world('PalletTown');
    const ow = createOverworldState();
    deps.player.setTilePosition(20, 2);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.mocked(isHeld).mockImplementation(button => button === 'up');
    expect(updateOverworld(deps, ow)).toBeNull(); // turn
    for (let i = 0; i < 8; i++) {
      expect(runMapScript(deps, ow)).toBeNull();
      expect(updateOverworld(deps, ow)).toBeNull();
    }
    expect(deps.player.y).toBe(0);
    expect(runMapScript(deps, ow)?.type).toBe('script');
    expect(deps.player.y).toBe(0);
  });
});

describe('encounter and step integration', () => {
  it('turning rolls without counting a step or changing walking mood', () => {
    const deps = world();
    const ow = createOverworldState();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.mocked(isHeld).mockImplementation(button => button === 'up');
    expect(updateOverworld(deps, ow)?.type).toBe('startBattle');
    expect(ow.stepCounter).toBe(0);
    expect(getPikachuMood()).toBe(200);
    expect(deps.player.y).toBe(128);
  });

  it('turning preserves an active cooldown; the third walking step can roll', () => {
    const deps = world();
    const ow = createOverworldState();
    ow.encounterCooldown = 3;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.mocked(isHeld).mockImplementation(button => button === 'down');
    expect(updateOverworld(deps, ow)).toBeNull();
    expect(ow.encounterCooldown).toBe(3);
    for (let step = 1; step <= 3; step++) {
      for (let pass = 1; pass <= 8; pass++) {
        const action = updateOverworld(deps, ow);
        expect(action?.type ?? null).toBe(step === 3 && pass === 8 ? 'startBattle' : null);
      }
      expect(ow.encounterCooldown).toBe(3 - step);
    }
    expect(ow.stepCounter).toBe(253);
    expect(getPikachuMood()).toBe(197);
  });

  it('a hop checks both halves without counting steps, mood or cooldown', () => {
    const deps = world();
    const ow = createOverworldState();
    ow.encounterCooldown = 3;
    vi.mocked(isHeld).mockImplementation(button => button === 'down');
    vi.mocked(deps.gameMap.isWalkable).mockReturnValue(false);
    vi.spyOn(deps.gameMap, 'isLedge').mockReturnValue(true);
    const warps = vi.spyOn(deps.gameMap, 'getWarpAt');
    updateOverworld(deps, ow); // turn
    updateOverworld(deps, ow); // arm hop
    for (let i = 0; i < 16; i++) expect(updateOverworld(deps, ow)).toBeNull();
    expect(warps.mock.calls).toEqual([[16, 18], [16, 20]]);
    expect(ow.stepCounter).toBe(0);
    expect(ow.encounterCooldown).toBe(3);
    expect(getPikachuMood()).toBe(200);
  });

  it('the step outside the map cannot roll and its connection preserves counters', () => {
    const deps = world();
    const ow = createOverworldState();
    deps.player.setTilePosition(16, 80);
    deps.gameMap.mapData!.connections.push({ direction: 'south', mapName: 'ViridianCity', offset: 0 });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(handleStepComplete(deps, ow)?.type).toBe('connectToMap');
    expect(ow.stepCounter).toBe(255);
  });

  it('the automatic door exit is simulated, so it does not count or consume cooldown', () => {
    const deps = world();
    const ow = createOverworldState();
    ow.doorExitStep = true;
    ow.justWarped = true;
    ow.encounterCooldown = 3;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    for (let i = 0; i < 8; i++) expect(updateOverworld(deps, ow)).toBeNull();
    expect(deps.player.y).toBe(144);
    expect(ow.doorExitStep).toBe(false);
    expect(ow.justWarped).toBe(false);
    expect(ow.stepCounter).toBe(0);
    expect(ow.encounterCooldown).toBe(3);
    expect(getPikachuMood()).toBe(200);
  });

  it('door/warp tiles suppress encounters before performing the warp', () => {
    const deps = world();
    const ow = createOverworldState();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.spyOn(deps.gameMap, 'isInstantWarpTile').mockReturnValue(true);
    vi.spyOn(deps.gameMap, 'getWarpAt').mockReturnValue({ x: 8, y: 8, destMap: 'ViridianMart', destWarpId: 0 });
    expect(handleStepComplete(deps, ow)?.type).toBe('warp');
    expect(ow.stepCounter).toBe(255);
    expect(getPikachuMood()).toBe(199);
  });

  it('the map classifier uses FIRST_INDOOR_MAP, including FOREST maps', () => {
    const deps = world();
    for (const name of ['PalletTown', 'IndigoPlateau', 'SaffronCity', 'Route1', 'Route25']) {
      deps.gameMap.mapData!.name = name;
      expect(deps.gameMap.isIndoor).toBe(false);
    }
    for (const name of ['ViridianForest', 'DiglettsCave', 'ViridianMart', 'Route2Gate']) {
      deps.gameMap.mapData!.name = name;
      expect(deps.gameMap.isIndoor).toBe(true);
    }
  });
});

describe('NPC images', () => {
  const npcData = { id: 'customer', sprite: 'gentleman', x: 14, y: 8, movement: 'stay' as const, dialogue: '' };

  it('does not slide in while pixels scroll; appears after the player completes the step', async () => {
    const deps = world();
    const npc = new Npc(npcData);
    await npc.load();
    deps.npcs.push(npc);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.mocked(isHeld).mockImplementation(button => button === 'right');
    updateOverworld(deps, createOverworldState()); // turn
    for (let i = 0; i < 8; i++) {
      updateOverworld(deps, createOverworldState());
      npc.render(deps.player.getCameraX(), deps.player.getCameraY());
      expect(drawSprite).not.toHaveBeenCalled();
    }
    expect(deps.player.mapStepX).toBe(9);
    updateOverworld(deps, createOverworldState());
    npc.render(deps.player.getCameraX(), deps.player.getCameraY());
    expect(drawSprite).toHaveBeenCalledOnce();
  });

  it('a scripted sprite moves outside the normal window', async () => {
    const npc = new Npc({ ...npcData, x: 20 });
    await npc.load();
    npc.startScriptedMove(['left']);
    for (let i = 0; i < 3; i++) npc.update(npcCtx());
    expect(npc.x).toBe(319);
    npc.render(64, 68);
    expect(drawSprite).toHaveBeenCalledOnce();
  });

  it('a sprite partially under a menu is not drawn at all', async () => {
    const npc = new Npc({ ...npcData, x: 8 });
    await npc.load();
    npc.update(npcCtx());
    uiTiles.cover(80, 0, 80, 128);
    npc.render(56, 68); // screen x=72, straddling menu edge
    expect(drawSprite).not.toHaveBeenCalled();
    uiTiles.clear();
    npc.render(56, 68);
    expect(drawSprite).toHaveBeenCalledOnce();
  });

  it.each([
    { menuHeight: 128, stepsBelow: 4, drawn: true },
    { menuHeight: 128, stepsBelow: 3, drawn: false },
    { menuHeight: 112, stepsBelow: 3, drawn: true },
    { menuHeight: 112, stepsBelow: 2, drawn: false },
  ])('START height $menuHeight, NPC $stepsBelow steps below: drawn=$drawn', async ({ menuHeight, stepsBelow, drawn }) => {
    const deps = world();
    const npc = new Npc({ ...npcData, x: 9, y: 8 + stepsBelow });
    await npc.load();
    npc.update(npcCtx(deps.player.tileX, deps.player.tileY));
    uiTiles.cover(80, 0, 80, menuHeight);
    npc.render(deps.player.getCameraX(), deps.player.getCameraY());
    expect(drawSprite).toHaveBeenCalledTimes(drawn ? 1 : 0);
  });

  it('in-step scripted animation still advances while the player is walking', async () => {
    const npc = new Npc({ ...npcData, x: 8 });
    await npc.load();
    npc.startInStepMove(['down', 'down']);
    for (let i = 0; i < 4; i++) npc.update(npcCtx(16, 16, { playerWalking: true }));
    npc.render(64, 68);
    expect(vi.mocked(drawSprite).mock.calls[0][2]).toBe(48); // walking down, not frozen standing
  });
});

describe('walking into Pikachu (CollisionCheckOnLand, wPikachuCollisionCounter)', () => {
  /** The player facing down with Pikachu one step behind (above), holding UP. */
  function behind(): { deps: OverworldDeps; ow: ReturnType<typeof createOverworldState> } {
    const deps = world();
    deps.player.direction = 'down';
    deps.pikachuFollower.visible = true;
    deps.pikachuFollower.spawn(deps.player.x, deps.player.y, 'down');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    return { deps, ow: createOverworldState() };
  }

  it('a turn arms 8: seven blocked checks after the turning pass, the eighth walks', () => {
    const { deps, ow } = behind();
    vi.mocked(isHeld).mockImplementation(button => button === 'up');
    updateOverworld(deps, ow);
    expect(deps.player.justTurned).toBe(true);
    expect(deps.player.pikachuCollisionCounter).toBe(8);
    for (let i = 0; i < 7; i++) {
      updateOverworld(deps, ow);
      expect(deps.player.justCollided).toBe(true);
      expect(deps.player.y).toBe(128);
    }
    updateOverworld(deps, ow);
    expect(deps.player.justStartedStep).toBe(true);
  });

  it('holding B walks straight through on the first check', () => {
    const { deps, ow } = behind();
    vi.mocked(isHeld).mockImplementation(button => button === 'up' || button === 'b');
    updateOverworld(deps, ow); // turn
    updateOverworld(deps, ow);
    expect(deps.player.justStartedStep).toBe(true);
    expect(deps.player.pikachuCollisionCounter).toBe(0);
  });

  it('releasing clears the counter; pressing again without a turn walks at once', () => {
    const { deps, ow } = behind();
    vi.mocked(isHeld).mockImplementation(button => button === 'up');
    updateOverworld(deps, ow); // turn
    updateOverworld(deps, ow); // blocked: 7
    vi.mocked(isHeld).mockReturnValue(false);
    updateOverworld(deps, ow);
    expect(deps.player.pikachuCollisionCounter).toBe(0);
    vi.mocked(isHeld).mockImplementation(button => button === 'up');
    updateOverworld(deps, ow);
    expect(deps.player.justTurned).toBe(false);
    expect(deps.player.justStartedStep).toBe(true);
  });

  it('a bouncing Pikachu is off the exact front pixels, so it does not obstruct', () => {
    const { deps, ow } = behind();
    const pika = deps.pikachuFollower;
    pika.clearBuffer();
    pika.appendFollowCommand(5);
    vi.spyOn(Math, 'random').mockReturnValue(0); // the antic byte: bounce
    for (let i = 0; i < 257; i++) updateOverworld(deps, ow); // 256 idle updates, then index 15
    expect(pika.antic).toBe('bounce');
    expect(pika.screenOffset).toEqual({ x: -1, y: -2 });
    vi.mocked(isHeld).mockImplementation(button => button === 'up');
    updateOverworld(deps, ow); // turn: arms 8, no sprite update
    updateOverworld(deps, ow);
    expect(deps.player.justStartedStep).toBe(true);
  });

  it('an NPC in front blocks even with B held, and never spends the counter', () => {
    const deps = world();
    deps.player.direction = 'down';
    const npc = new Npc({ id: 'man', sprite: 'gentleman', x: 8, y: 7, movement: 'stay', direction: 'down', dialogue: '' });
    deps.npcs.push(npc);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ow = createOverworldState();
    updateOverworld(deps, ow); // the NPC becomes visible
    vi.mocked(isHeld).mockImplementation(button => button === 'up' || button === 'b');
    updateOverworld(deps, ow); // turn
    for (let i = 0; i < 10; i++) {
      updateOverworld(deps, ow);
      expect(deps.player.justCollided).toBe(true);
    }
    expect(deps.player.pikachuCollisionCounter).toBe(8);
  });

  it('the wired follower is drawn after its first UpdateSprites', async () => {
    const { deps, ow } = behind();
    await deps.pikachuFollower.loadSprite();
    deps.pikachuFollower.render(deps.player.getCameraX(), deps.player.getCameraY());
    expect(drawSprite).not.toHaveBeenCalled();
    updateOverworld(deps, ow);
    deps.pikachuFollower.render(deps.player.getCameraX(), deps.player.getCameraY());
    expect(drawSprite).toHaveBeenCalledOnce();
  });
});

describe('NPC sprite collisions in slot order (UpdateSprites)', () => {
  const walker = (id: string, y: number, direction: 'up' | 'down') =>
    new Npc({ id, sprite: 'youngster', x: 8, y, movement: 'walk', direction, dialogue: '' });

  it.each([['down first', 0], ['up first', 1]] as const)(
    'two NPCs aiming at one tile: the earlier slot moves, the later one sees its vector (%s)', (_, order) => {
      const deps = world();
      deps.player.setTilePosition(16, 18); // step (8, 9): out of their way
      const a = walker('a', 5, 'down');
      const b = walker('b', 7, 'up');
      deps.npcs.push(...(order === 0 ? [a, b] : [b, a]));
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      updateOverworld(deps, createOverworldState());
      const [first, second] = deps.npcs;
      expect(first.mapStepY).toBe(6);
      expect(second.mapStepY).toBe(order === 0 ? 7 : 5);
      expect(second.movement.status).toBe('resting');
    });

  it("a pressed direction is in the player's vector before UpdateSprites: the NPC yields", () => {
    const deps = world();
    const npc = walker('a', 6, 'down');
    deps.npcs.push(npc);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.mocked(isHeld).mockImplementation(button => button === 'up');
    const ow = createOverworldState();
    updateOverworld(deps, ow); // a new game's first press turns
    expect(deps.player.justTurned).toBe(true);
    updateOverworld(deps, ow);
    expect(deps.player.isMoving).toBe(true);
    expect(npc.mapStepY).toBe(6);
  });

  it('an NPC never steps into Pikachu', () => {
    const deps = world();
    deps.pikachuFollower.visible = true;
    deps.pikachuFollower.spawn(deps.player.x, deps.player.y, 'down'); // Pikachu at step (8, 7)
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ow = createOverworldState();
    // Right after a spawn Pikachu's image is $ff until its own update: invisible to slot 1
    updateOverworld(deps, ow);
    const npc = walker('a', 6, 'down');
    deps.npcs.push(npc);
    for (let i = 0; i < 600; i++) updateOverworld(deps, ow);
    expect(npc.mapStepY).toBe(6);
  });
});

describe("a beaten trainer's turning (SetEnemyTrainerToStayAndFaceAnyDirection)", () => {
  const bugCatcher = () => ({
    id: 'youngster2', sprite: 'youngster', x: 8, y: 6, movement: 'stay' as const, direction: 'left' as const,
    dialogue: 'hi', trainerClass: 'BUG_CATCHER', trainerParty: 0,
  });

  it('the live sprite becomes STAY/NONE, keeping its facing, status and delay', () => {
    const npc = new Npc(bugCatcher());
    const before = { facing: npc.direction, status: npc.movement.status, delay: npc.movement.delay };
    npc.stayAndFaceAnyDirection('ViridianForest');
    expect([npc.movement.movement1, npc.movement.movement2]).toEqual(['stay', 'none']);
    expect({ facing: npc.direction, status: npc.movement.status, delay: npc.movement.delay }).toEqual(before);
  });

  it('then turns at random rather than back to its fixed facing', () => {
    const npc = new Npc(bugCatcher());
    npc.stayAndFaceAnyDirection('ViridianForest');
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // byte $cc: right
    npc.update(npcCtx(16, 16));
    expect(npc.direction).toBe('right');
  });

  it.each([['RIVAL1', 'OaksLab'], ['RIVAL2', 'Route22'], ['RIVAL3', 'ChampionsRoom'], ['ROCKET', 'PokemonTower7F']])(
    '%s on %s keeps its movement', (trainerClass, map) => {
      const npc = new Npc({ ...bugCatcher(), trainerClass });
      npc.stayAndFaceAnyDirection(map);
      expect(npc.movement.movement2).toBe('left');
    });

  it('a map load recreates the original bytes; only the defeated flag persists', () => {
    const data: ReturnType<typeof bugCatcher> & { defeated?: boolean } = bugCatcher();
    new Npc(data).stayAndFaceAnyDirection('ViridianForest');
    data.defeated = true;
    const reloaded = new Npc(data);
    expect([reloaded.movement.movement1, reloaded.movement.movement2]).toEqual(['stay', 'left']);
  });

  it('talking to a beaten trainer gives the after text and leaves the movement alone', () => {
    const deps = world();
    const npc = new Npc({ ...bugCatcher(), defeated: true, afterBattleText: 'after' });
    deps.npcs.push(npc);
    deps.player.direction = 'up';
    deps.player.setTilePosition(16, 14);
    vi.mocked(isPassPressed).mockImplementation(button => button === 'a');
    const action = updateOverworld(deps, createOverworldState());
    vi.mocked(isPassPressed).mockReturnValue(false);
    expect(action).toEqual({ type: 'textbox', text: 'after' });
    expect(npc.movement.movement2).toBe('left');
  });
});

describe('text and the nurse over a bouncing Pikachu (A6c review R-2)', () => {
  /** Pikachu one step above the player at step (8, 8), mid-bounce (index 14). */
  function bouncingAbove(): OverworldDeps {
    const deps = world();
    const pika = deps.pikachuFollower;
    pika.visible = true;
    pika.spawn(deps.player.x, deps.player.y, 'down');
    pika.clearBuffer();
    pika.appendFollowCommand(5);
    const ctx = { playerWalking: false, playerMapStep: { x: 8, y: 8 }, playerFacing: 'down' as const, random: () => 0 };
    for (let i = 0; i < 258; i++) pika.updateSprite(ctx);
    expect(pika.screenOffset).toEqual({ x: -2, y: -4 });
    return deps;
  }

  /** main.ts checkUiEntry after the tick, with the bottom text box's tiles. */
  function afterTick(deps: OverworldDeps, entry: UiEntry, state: string): void {
    if (!entry.opened(overworldUiOpen(state, state === 'textbox'))) return;
    uiTiles.clear();
    uiTiles.cover(0, 96, 160, 48);
    fontLoadedUpdateSprites(deps.player, deps.gameMap, uiTiles.tileAt, deps.pikachuFollower);
  }

  it('talking to an NPC: the interaction pass moves nothing, then the box resets Pikachu', () => {
    const deps = bouncingAbove();
    deps.npcs.push(new Npc({ id: 'man', sprite: 'gentleman', x: 8, y: 9, movement: 'stay', direction: 'up', dialogue: 'hello' }));
    deps.player.direction = 'down';
    const entry = new UiEntry();
    afterTick(deps, entry, 'overworld');
    vi.mocked(isPassPressed).mockImplementation(button => button === 'a');
    const action = updateOverworld(deps, createOverworldState());
    vi.mocked(isPassPressed).mockReturnValue(false);
    expect(action).toEqual({ type: 'textbox', text: 'hello' });
    expect(deps.pikachuFollower.screenOffset).toEqual({ x: -2, y: -4 }); // no extra pass
    afterTick(deps, entry, 'textbox');
    expect(deps.pikachuFollower.antic).toBeNull();
    expect(deps.pikachuFollower.screenOffset).toEqual({ x: 0, y: 0 });
    expect(deps.pikachuFollower.followCommand).toBe(1);
    // Text frames run no ordinary updates and don't fire again
    afterTick(deps, entry, 'textbox');
    expect(deps.pikachuFollower.followCommand).toBe(1);
  });

  it('talking to Pikachu sets bit 7; the next on-screen pass serves it, even an ordinary one', () => {
    const deps = world();
    const pika = deps.pikachuFollower;
    pika.visible = true;
    pika.spawn(deps.player.x, deps.player.y, 'left'); // Pikachu to the right
    pika.updateSprite({ playerWalking: false, playerMapStep: { x: 8, y: 8 }, playerFacing: 'left' });
    pika.direction = 'up';
    deps.player.direction = 'right';
    vi.mocked(isPassPressed).mockImplementation(button => button === 'a');
    expect(updateOverworld(deps, createOverworldState())).toEqual({ type: 'pikachuEmotion' });
    vi.mocked(isPassPressed).mockReturnValue(false);
    expect(pika.direction).toBe('up'); // nothing turned at the interaction pass
    updateOverworld(deps, createOverworldState()); // an ordinary pass (no portrait here)
    expect(pika.direction).toBe('left');
    expect(pika.followCommand).toBe(3); // Func_fc745 keeps the buffer
    // Served once: a later text opening leaves the facing alone
    deps.player.direction = 'up';
    afterTick(deps, new UiEntry(), 'textbox');
    expect(pika.direction).toBe('left');
  });

  it("the nurse with Pikachu already above: the UpdateSprites ends the bounce; no call", () => {
    const deps = bouncingAbove();
    const scriptDeps = { ...deps, textBox: new TextBox(), npcs: [] };
    initScript([{ type: 'updateSprites' }, { type: 'pikachuToNurse' }]);
    updateScript(scriptDeps, true);
    expect(deps.pikachuFollower.antic).toBeNull();
    expect(deps.pikachuFollower.screenOffset).toEqual({ x: 0, y: 0 });
    updateScript(scriptDeps, true);
    expect(deps.pikachuFollower.movementActive).toBe(false);
    expect(updateScript(scriptDeps, true)).toEqual({ type: 'scriptEnded' });
  });
});


describe('A6d ledge follow through the controller', () => {
  async function ledgeWorld() {
    const deps = world();
    const ow = createOverworldState();
    const p = deps.pikachuFollower;
    p.visible = true;
    p.spawn(deps.player.x, deps.player.y, 'down');
    await p.loadSprite();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.mocked(deps.gameMap.isWalkable).mockImplementation((_x, y) => y !== 18);
    vi.spyOn(deps.gameMap, 'isLedge').mockImplementation((_x, y, dir) => y === 16 && dir === 'down');
    vi.mocked(isHeld).mockImplementation(b => b === 'down');
    updateOverworld(deps, ow); // turn
    updateOverworld(deps, ow); // armed
    expect(deps.player.ledgeHopFlag).toBe(true);
    return { deps, ow, p };
  }
  function land(s: Awaited<ReturnType<typeof ledgeWorld>>) {
    const starts: number[] = [];
    for (let pass = 1; pass <= 16; pass++) {
      updateOverworld(s.deps, s.ow);
      if (s.deps.player.startedFollowStep) starts.push(pass);
      if (pass >= 9) expect(s.p.y).toBe(128);
    }
    expect(starts).toEqual([1, 9]);
    expect(s.deps.player.isLanding).toBe(true);
    vi.mocked(isHeld).mockReturnValue(false);
    updateOverworld(s.deps, s.ow); // landing
    expect(s.deps.player.takeFrameDelay()).toBe(1);
    expect(s.deps.player.ledgeHopFlag).toBe(true);
    updateOverworld(s.deps, s.ow); // continuation
    expect(s.deps.player.ledgeHopFlag).toBe(false);
    expect([s.p.y, s.p.followCommand]).toEqual([128, 5]);
  }
  it('waits at takeoff and crosses in eight flat 4px updates on the next step', async () => {
    const s = await ledgeWorld();
    land(s);
    for (let i = 0; i < 8; i++) updateOverworld(s.deps, s.ow);
    expect([s.p.y, s.p.followCommand]).toEqual([128, 5]);
    vi.mocked(isHeld).mockImplementation(b => b === 'down');
    updateOverworld(s.deps, s.ow); // append next step, after UpdateSprites
    expect(s.p.y).toBe(128);
    for (let i = 1; i <= 8; i++) {
      updateOverworld(s.deps, s.ow);
      expect(s.p.y).toBe(128 + 4 * i);
      s.p.render(0, 0);
      const calls = vi.mocked(drawSprite).mock.calls;
      expect(calls[calls.length - 1][4]).toBe(s.p.y - 4); // no arc
    }
    expect(s.p.mapStepY).toBe(s.deps.player.mapStepY - 1);
  });
  it('hops first when the next step turns sideways, then follows the side step', async () => {
    const s = await ledgeWorld();
    land(s);
    vi.mocked(isHeld).mockImplementation(b => b === 'right');
    updateOverworld(s.deps, s.ow); // turning pass
    updateOverworld(s.deps, s.ow); // starts side step
    for (let i = 0; i < 8; i++) updateOverworld(s.deps, s.ow);
    expect([s.p.x, s.p.y]).toEqual([128, 160]);
    for (let i = 0; i < 8; i++) updateOverworld(s.deps, s.ow);
    expect([s.p.x, s.p.y]).toEqual([144, 160]);
  });
  it('START refresh retains the two-step seed and the next step still hops', async () => {
    const s = await ledgeWorld();
    land(s);
    fontLoadedUpdateSprites(s.deps.player, s.deps.gameMap, () => 0, s.p);
    expect(s.p.followCommand).toBe(5);
    vi.mocked(isHeld).mockImplementation(b => b === 'down');
    updateOverworld(s.deps, s.ow);
    for (let i = 0; i < 8; i++) updateOverworld(s.deps, s.ow);
    expect(s.p.y).toBe(160);
  });
  it('two consecutive ledges retain exactly one hop after each landing', async () => {
    const s = await ledgeWorld();
    vi.mocked(s.deps.gameMap.isWalkable).mockImplementation((_x, y) => y !== 18 && y !== 22);
    vi.mocked(s.deps.gameMap.isLedge).mockImplementation((_x, y, dir) => (y === 16 || y === 20) && dir === 'down');
    land(s);
    vi.mocked(isHeld).mockImplementation(b => b === 'down');
    updateOverworld(s.deps, s.ow); // arm second
    for (let i = 0; i < 16; i++) updateOverworld(s.deps, s.ow);
    expect([s.p.y, s.deps.player.y, s.p.followCommand, s.p.followBufferLength]).toEqual([160, 192, 5, 1]);
    updateOverworld(s.deps, s.ow); // landing
    updateOverworld(s.deps, s.ow); // starts next step
    for (let i = 0; i < 8; i++) updateOverworld(s.deps, s.ow);
    expect(s.p.y).toBe(192);
  });
  it('landing blocks A interaction and held input, updates sprites at +34 then +37', async () => {
    const s = await ledgeWorld();
    const clock = new PassClock();
    const frames: number[] = [];
    const follow = vi.spyOn(s.p, 'updateSprite');
    const mapScript = vi.fn();
    for (let frame = 1; frame <= 39; frame++) {
      if (!clock.tick()) continue;
      s.deps.player.finishLanding();
      if (!s.deps.player.isMoving && !s.deps.player.isLanding) mapScript(frame);
      const calls = follow.mock.calls.length;
      if (frame === 34) {
        vi.mocked(isHeld).mockImplementation(b => b === 'right');
        vi.mocked(isPassPressed).mockImplementation(b => b === 'a');
        const input = vi.mocked(isHeld).mock.calls.length;
        expect(updateOverworld(s.deps, s.ow)).toBeNull();
        expect(vi.mocked(isHeld).mock.calls.length).toBe(input);
      } else updateOverworld(s.deps, s.ow);
      if (follow.mock.calls.length > calls) frames.push(frame);
      clock.delay(s.deps.player.takeFrameDelay());
      if (frame === 34 || frame === 35 || frame === 36) expect(s.deps.player.ledgeHopFlag).toBe(true);
    }
    vi.mocked(isPassPressed).mockReturnValue(false);
    expect(frames).toEqual([...Array.from({ length: 17 }, (_, i) => (i + 1) * 2), 37, 39]);
    expect(mapScript.mock.calls.map(c => c[0])).toEqual([2, 37]); // a+2 is the first simulated press
    expect(s.deps.player.ledgeHopFlag).toBe(false);
  });
});

describe('A6d ordinary following regression', () => {
  it('matches the committed upstream pixel trace on a 30-step path with turns', () => {
    const deps = world();
    const player = deps.player;
    const p = deps.pikachuFollower;
    p.visible = true;
    p.spawn(player.x, player.y, 'down');
    const path: Direction[] = ['down', 'right', 'right', 'up', 'left', 'up', 'left', 'down', 'down', 'right'];
    const trace: number[][] = [];
    for (let step = 0; step < 30; step++) {
      const prev = { x: player.x, y: player.y };
      for (let pass = 0; pass < 8; pass++) {
        player.forceStep(path[step % path.length], () => updateSprites([], deps.gameMap, player, p));
        recordStepForPikachu(player, p);
        trace.push([p.x, p.y]);
      }
      expect([p.mapStepX, p.mapStepY]).toEqual([prev.x / 16, prev.y / 16]);
    }
    // Captured from HEAD's original position-buffer follower in a temporary test.
    expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex'))
      .toBe('3d29d4e59b91a7a6e3442f9222b0e08c9522ee96fceaeece35a9ea79e5eb63c4');
  });
  it('a 200-step seeded random walk keeps at most two buffer entries', () => {
    const deps = world();
    const p = deps.pikachuFollower;
    p.visible = true;
    p.spawn(deps.player.x, deps.player.y, 'down');
    let seed = 42;
    const dirs: Direction[] = ['down', 'up', 'left', 'right'];
    for (let step = 0; step < 200; step++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const dir = dirs[seed >>> 30];
      for (let i = 0; i < 8; i++) {
        deps.player.forceStep(dir, () => updateSprites([], deps.gameMap, deps.player, p));
        recordStepForPikachu(deps.player, p);
        expect(p.followBufferLength).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('A6e: Pikachu\'s scripted movement through the script controller', () => {
  /** Run the script to its end, one call per frame with alternating pass parity, from
   *  `firstPass`. Returns the frames from the first call to the end (0 = ended at once). */
  function runToEnd(scriptDeps: ScriptDeps, firstPass = true, each?: (frame: number) => void): number {
    let frame = 0;
    while (updateScript(scriptDeps, frame % 2 === 0 ? firstPass : !firstPass)?.type !== 'scriptEnded') {
      each?.(frame);
      if (++frame > 2000) throw new Error('script never ended');
    }
    return frame;
  }

  function out(facing: Direction): OverworldDeps {
    const deps = world();
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB');
    deps.pikachuFollower.visible = true;
    deps.pikachuFollower.spawn(deps.player.x, deps.player.y, facing); // behind the player
    return deps;
  }

  it.each([true, false])('Viridian: Pikachu on the right steps aside in 37 frames, then refreshes (first pass %s)', async firstPass => {
    const deps = out('left'); // Pikachu at the player's right
    const p = deps.pikachuFollower;
    await p.loadSprite();
    const before = { x: deps.player.x, y: deps.player.y };
    initScript([{ type: 'tryPikachuMovement', caller: 'viridianStepAside' }]);
    const scriptDeps = { ...deps, textBox: new TextBox() };
    expect(runToEnd(scriptDeps, firstPass)).toBe(37);
    // down, then left: directly below the player; looks right while its image faces left
    expect([p.x, p.y, p.mapStepX, p.mapStepY]).toEqual([128, 144, 8, 9]);
    expect(p.direction).toBe('right');
    p.render(0, 0);
    const calls = vi.mocked(drawSprite).mock.calls;
    const [, , frameY, , , flip] = calls[calls.length - 1];
    expect([frameY, flip]).toEqual([32, false]); // standing left
    // the world stood still; RefreshPikachuFollow seeds "up" (Pikachu below)
    expect({ x: deps.player.x, y: deps.player.y }).toEqual(before);
    expect([p.followCommand, p.followBufferLength]).toEqual([2, 1]);
  });

  it('a guard that fails takes no interpreter frames and refreshes nothing', () => {
    const deps = out('up'); // Pikachu below: Viridian expects RIGHT
    const p = deps.pikachuFollower;
    p.appendFollowCommand(4);
    initScript([{ type: 'tryPikachuMovement', caller: 'viridianStepAside' }]);
    expect(runToEnd({ ...deps, textBox: new TextBox() })).toBe(1);
    expect([p.y, p.followCommand, p.followBufferLength]).toEqual([144, 4, 2]);
  });

  it('the guard: the starter must be out; any distance on the right side counts', () => {
    const deps = out('left');
    restoreFlags([]); // before the lab battle: no starter following
    initScript([{ type: 'tryPikachuMovement', caller: 'viridianStepAside' }]);
    expect(runToEnd({ ...deps, textBox: new TextBox() })).toBe(1);
    const far = out('left');
    far.pikachuFollower.spawnAtState(far.player.x + 32, far.player.y, 'down', 1); // 2 to the right
    initScript([{ type: 'tryPikachuMovement', caller: 'viridianStepAside' }]);
    expect(runToEnd({ ...far, textBox: new TextBox() })).toBe(37);
  });

  it('Oak\'s Lab picks its program by the player\'s Y when it runs', () => {
    const below = out('up');
    below.player.setTilePosition(8, 8); // Y = 4: MovementData1 needs Pikachu below
    below.pikachuFollower.spawn(below.player.x, below.player.y, 'up');
    initScript([{ type: 'tryPikachuMovement', caller: 'oaksLab' }]);
    expect(runToEnd({ ...below, textBox: new TextBox() })).toBe(37);
    // left, then up: beside the player's left; looks right
    expect([below.pikachuFollower.mapStepX, below.pikachuFollower.mapStepY]).toEqual([3, 4]);
    const left = out('right');
    left.player.setTilePosition(8, 6); // Y = 3: MovementData2 needs Pikachu on the left
    left.pikachuFollower.spawn(left.player.x, left.player.y, 'right');
    initScript([{ type: 'tryPikachuMovement', caller: 'oaksLab' }]);
    expect(runToEnd({ ...left, textBox: new TextBox() })).toBe(37);
    expect([left.pikachuFollower.mapStepX, left.pikachuFollower.mapStepY]).toEqual([4, 4]);
    expect(left.pikachuFollower.direction).toBe('up');
  });

  it.each([
    ['below', 'up', 69, [128, 112]],
    ['left', 'right', 37, [128, 112]],
    ['right', 'left', 37, [128, 112]],
  ] as const)('the nurse walk with Pikachu %s: %i frames, no refresh after it', (_where, facing, frames, end) => {
    const deps = out(facing);
    const p = deps.pikachuFollower;
    const buffer = [p.followCommand, p.followBufferLength];
    initScript([{ type: 'pikachuToNurse' }]);
    expect(runToEnd({ ...deps, textBox: new TextBox() }, false)).toBe(frames);
    expect([p.x, p.y]).toEqual(end);
    expect([p.followCommand, p.followBufferLength]).toEqual(buffer);
  });

  it('nothing else moves during a call: NPCs, the player and their counters wait', () => {
    const deps = out('left');
    const npc = new Npc({ id: 'w', sprite: 'youngster', x: 12, y: 12, movement: 'walk', dialogue: '' });
    deps.npcs.push(npc);
    const npcAt = [npc.x, npc.y];
    vi.mocked(isHeld).mockReturnValue(true);
    initScript([{ type: 'tryPikachuMovement', caller: 'viridianStepAside' }]);
    const scriptDeps = { ...deps, textBox: new TextBox() };
    vi.mocked(readJoypad).mockClear();
    runToEnd(scriptDeps, true, () => {
      expect([npc.x, npc.y]).toEqual(npcAt);
      expect(deps.player.isMoving).toBe(false);
    });
    expect(readJoypad).not.toHaveBeenCalled();
  });

  it('a replaced script releases a call left running', () => {
    const deps = out('left');
    initScript([{ type: 'tryPikachuMovement', caller: 'viridianStepAside' }]);
    const scriptDeps = { ...deps, textBox: new TextBox() };
    updateScript(scriptDeps, true);
    expect(deps.pikachuFollower.movementActive).toBe(true);
    initScript([{ type: 'wait', frames: 1 }]);
    updateScript(scriptDeps, true);
    expect(deps.pikachuFollower.movementActive).toBe(false);
  });
});

describe('A6e: the Pokécenter\'s Pikachu calls (DisplayPokemonCenterDialogue_)', () => {
  /** A text box that closes on the frame after it opens, recording when each opens. */
  function quickText(opened: { message: string; frame: number }[], frameOf: () => number): TextBox {
    let active = false;
    return {
      get active() { return active; },
      get isWaitingForInput() { return active; },
      get hasMorePages() { return false; },
      show(message: string) { active = true; opened.push({ message, frame: frameOf() }); },
      update() { active = false; },
      dismiss() { active = false; },
    } as unknown as TextBox;
  }

  /** The yes branch and the shared tail of the nurse's script (the yes/no menu itself is
   *  covered elsewhere). */
  function healScript(): ScriptCommand[] {
    const all = buildNurseScript(() => undefined);
    const ask = all.findIndex(c => c.type === 'yesNo');
    const yesNo = all[ask];
    if (yesNo.type !== 'yesNo') throw new Error('no yes/no');
    return [...all.slice(0, ask), ...yesNo.yesBranch, ...all.slice(ask + 1)];
  }

  it('traces the healthy starter: walk, hidden through the heal, its image written before the bow', () => {
    const deps = world();
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB');
    const p = deps.pikachuFollower;
    p.visible = true;
    p.spawn(deps.player.x, deps.player.y, 'up'); // below the player, facing up
    let frame = 0;
    const opened: { message: string; frame: number }[] = [];
    const scriptDeps = { ...deps, textBox: quickText(opened, () => frame) };
    const trace: { frame: number; visible: boolean; image: boolean; walking: boolean; y: number }[] = [];
    initScript(healScript());
    while (updateScript(scriptDeps, frame % 2 === 0)?.type !== 'scriptEnded' && frame < 3000) {
      trace.push({ frame, visible: p.visible, image: p.imageVisible, walking: p.movementActive, y: p.y });
      frame++;
    }
    const textAt = (key: string): number => opened.find(o => o.message === getText(key))!.frame;
    const walk = trace.filter(t => t.walking);
    // PikachuWalksToNurseJoy (69 frames) runs before NeedYourPokemon, ending on the counter
    expect(walk.length).toBe(69);
    expect(walk[walk.length - 1].frame).toBeLessThan(textAt('POKECENTER_NEED_MON'));
    // DisablePikachuOverworldSpriteDrawing after NeedYourPokemon; still not drawn while
    // the fighting-fit text shows (EnablePikachuOverworldSpriteDrawing draws nothing)
    const fit = textAt('POKECENTER_FIGHTING_FIT');
    expect(trace.find(t => t.frame === fit)!.image).toBe(false);
    // Func_6ebb(15, 0) writes its image: drawn again within the bow's first frames
    const shown = trace.find(t => t.frame > fit && t.image)!;
    const farewell = opened.find(o => o.message.startsWith('We hope'))!.frame;
    expect(shown.frame).toBeLessThan(farewell - 40);
    expect(shown.y).toBe(deps.player.y - 16);
    // CloseTextDisplay restores the facing saved at the start; following refreshed (down)
    expect(p.direction).toBe('up');
    expect([p.followCommand, p.followBufferLength]).toEqual([1, 1]);
  });

  it.each(['up', 'left', 'right'] as const)(
    'a fainted starter (slot facing %s) appears above the player, then turns back to that facing', async facing => {
      const deps = world();
      setFlag('BATTLED_RIVAL_IN_OAKS_LAB');
      deps.playerParty[0].currentHp = 0;
      const p = deps.pikachuFollower;
      await p.loadSprite();
      p.visible = false;
      p.direction = facing; // the hidden slot still has a facing (DisplayTextIDInit saves it)
      let frame = 0;
      const scriptDeps = { ...deps, textBox: quickText([], () => frame) };
      initScript(healScript());
      while (updateScript(scriptDeps, frame % 2 === 0)?.type !== 'scriptEnded' && frame < 3000) frame++;
      expect(deps.playerParty[0].currentHp).toBeGreaterThan(0);
      // spawn state 5 placed it facing down; CloseTextDisplay restored the saved facing
      expect([p.visible, p.imageVisible, p.x, p.y, p.direction]).toEqual([true, true, deps.player.x, deps.player.y - 16, facing]);
      // the next ordinary UpdateSprites redraws the image from that facing
      updateSprites([], deps.gameMap, deps.player, p);
      vi.mocked(drawSprite).mockClear();
      p.render(0, 0);
      const [, , frameY, , , flip] = vi.mocked(drawSprite).mock.calls[0];
      expect([frameY, flip]).toEqual(facing === 'up' ? [16, false] : [32, facing === 'right']);
    });

  it('no starter in the party: nothing of Pikachu runs, and the heal still ends', () => {
    const deps = world();
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB');
    deps.playerParty.length = 0;
    deps.playerParty.push(createPokemon('RATTATA', 3)!);
    let frame = 0;
    const scriptDeps = { ...deps, textBox: quickText([], () => frame) };
    initScript(healScript());
    while (updateScript(scriptDeps, frame % 2 === 0)?.type !== 'scriptEnded' && frame < 3000) frame++;
    expect(frame).toBeLessThan(3000);
    expect(deps.pikachuFollower.visible).toBe(false);
  });
});

describe('A6d pushed hop', () => {
  it('a pushed hop includes the landing pass, skips input there and clears before text', () => {
    const deps = world();
    vi.mocked(deps.gameMap.isWalkable).mockReturnValue(false);
    vi.spyOn(deps.gameMap, 'isLedge').mockReturnValue(true);
    initScript([{ type: 'pushPlayer', direction: 'down' }, { type: 'text', message: 'Landed.' }]);
    const scriptDeps = { ...deps, textBox: new TextBox() };
    updateScript(scriptDeps, true); // initializes push
    for (let i = 0; i < 17; i++) updateScript(scriptDeps, true); // arm + move
    expect(deps.player.isLanding).toBe(true);
    vi.mocked(readJoypad).mockClear();
    updateScript(scriptDeps, true); // landing
    expect(readJoypad).not.toHaveBeenCalled();
    expect(deps.player.takeFrameDelay()).toBe(1);
    expect(deps.player.ledgeHopFlag).toBe(true);
    updateScript(scriptDeps, true); // completion
    expect(deps.player.ledgeHopFlag).toBe(false);
    updateScript(scriptDeps, true); // text
    expect(scriptDeps.textBox.active).toBe(true);
  });
});
