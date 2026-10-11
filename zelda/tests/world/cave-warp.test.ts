// Cave / stairs entry against the real overworld data — Z_05.asm:7246 CheckWarps.
import { describe, it, expect, vi } from 'vitest';
import { InputManager, type EventTarget as InputEventTarget } from '../../src/core/input.js';
import { OverworldManager } from '../../src/world/overworld-manager.js';
import { TileCollisionMap, isWarpTile } from '../../src/world/collision.js';
import { TileRenderer } from '../../src/render/tile-renderer.js';
import { Link } from '../../src/objects/player/link.js';
import { getScreenCaveIndex } from '../../src/data/cave-data.js';
import type { OverworldData } from '../../src/data/overworld-types.js';
import type { SecretsData } from '../../src/data/secret-types.js';
import overworldJson from '../../src/data/overworld.json';
import secretsJson from '../../src/data/secrets.json';

const overworld = overworldJson as OverworldData;

function createInput(): { input: InputManager; press(code: string): void } {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const target: InputEventTarget = {
    addEventListener(type: string, handler: (e: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
    removeEventListener(type: string, handler: (e: unknown) => void) {
      listeners.get(type)?.delete(handler);
    },
  };
  const input = new InputManager();
  input.attach(target);
  return {
    input,
    press(code: string) {
      for (const fn of listeners.get('keydown') ?? []) fn({ code, preventDefault: vi.fn() });
    },
  };
}

function managerAt(screenId: number): OverworldManager {
  return new OverworldManager(
    overworld, new TileRenderer(), screenId >> 4, screenId & 0x0F, secretsJson as SecretsData,
  );
}

/** Hold Up for up to 60 frames, returning the frame Link first stands on a warp tile. */
function walkUpUntilWarp(mgr: OverworldManager, link: Link): number | null {
  const { input, press } = createInput();
  press('ArrowUp');
  for (let frame = 0; frame < 60; frame++) {
    input.update();
    link.update(input, mgr.collisionMap, mgr.currentScreen);
    if (mgr.isOnWarpTile(link)) return frame;
  }
  return null;
}

describe('isWarpTile (Z_05.asm:7345 HandleWarpOW)', () => {
  it('accepts the cave opening, waterfall cave and stairs tiles', () => {
    for (const t of [0x24, 0x88, 0x70, 0x71, 0x72, 0x73]) expect(isWarpTile(t)).toBe(true);
  });

  it('rejects floor, rock and the tile just past the stairs', () => {
    for (const t of [0x26, 0xF3, 0x74, 0x6F]) expect(isWarpTile(t)).toBe(false);
  });
});

describe('OW square collision is per 8×8 tile (Z_07.asm GetCollidableTile)', () => {
  const map = new TileCollisionMap(
    overworld.squareTable.primary, undefined, overworld.squareTable.secondary,
  );
  const screen100 = overworld.screens[100]!;

  it('cave mouth (square 12) is solid rock on top and walkable underneath', () => {
    // Screen 100's cave is at row 1, col 7 → pixels x 112-127, y 16-31.
    expect(screen100.tiles[1]![7]).toBe(12);
    expect(map.isPositionWalkable(screen100, 112, 16)).toBe(false);
    expect(map.isPositionWalkable(screen100, 120, 23)).toBe(false);
    expect(map.isPositionWalkable(screen100, 112, 24)).toBe(true);
    expect(map.isPositionWalkable(screen100, 127, 31)).toBe(true);
  });

  it('whole-tile squares are unchanged (tree blocks, ground walks)', () => {
    expect(map.isPositionWalkable(screen100, 8, 8)).toBe(false); // square 27, tree
    expect(map.isPositionWalkable(screen100, 120, 40)).toBe(true); // square 14, ground
  });
});

describe('OverworldManager.isOnWarpTile', () => {
  it('screen 100: walking up from below the cave reaches it (user-reported bug)', () => {
    const mgr = managerAt(100);
    const link = new Link();
    link.setPosition(112, 64);
    expect(walkUpUntilWarp(mgr, link)).not.toBeNull();
    expect(link.posY).toBe(16);
    expect(getScreenCaveIndex(100)).toBe(10);
  });

  it('screen 119 sword cave is still reachable', () => {
    const mgr = managerAt(119);
    const link = new Link();
    link.setPosition(64, 64);
    expect(walkUpUntilWarp(mgr, link)).not.toBeNull();
  });

  it('screen 26 waterfall cave (square 15, $88 tiles) is enterable', () => {
    const mgr = managerAt(26);
    const link = new Link();
    link.setPosition(96, 96);
    expect(walkUpUntilWarp(mgr, link)).not.toBeNull();
    expect(link.posY).toBe(64);
    expect(getScreenCaveIndex(26)).toBe(11);
  });

  it('the waterfall above that cave blocks (OW first unwalkable tile is $89)', () => {
    const mgr = managerAt(26);
    const link = new Link();
    link.setPosition(96, 64);
    const { input, press } = createInput();
    press('ArrowUp');
    for (let frame = 0; frame < 30; frame++) {
      input.update();
      link.update(input, mgr.collisionMap, mgr.currentScreen);
    }
    expect(link.posY).toBe(64);
  });

  it('needs X on a 16-px column outside room $22', () => {
    const mgr = managerAt(100);
    const link = new Link();
    link.setPosition(120, 16);
    expect(mgr.isOnWarpTile(link)).toBe(false);
  });

  it('room $22 (Level 6 entrance) accepts an 8-px column', () => {
    const mgr = managerAt(0x22);
    const link = new Link();
    link.setPosition(120, 64);
    expect(mgr.isOnWarpTile(link)).toBe(true);
  });

  it('stays disarmed after coming back out until Link steps a whole tile', () => {
    const mgr = managerAt(100);
    const link = new Link();
    link.setPosition(112, 16);
    mgr.disarmWarpsUntilMoved(link);
    expect(mgr.isOnWarpTile(link)).toBe(false);
    link.setPosition(112, 24);
    expect(mgr.isOnWarpTile(link)).toBe(false); // off the warp, but now re-armed
    link.setPosition(112, 16);
    expect(mgr.isOnWarpTile(link)).toBe(true);
  });
});
