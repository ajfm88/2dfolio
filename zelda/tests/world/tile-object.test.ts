import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/core/types.js';
import { OVERWORLD_COLS, OVERWORLD_ROWS } from '../../src/core/constants.js';
import { TileObjectManager } from '../../src/world/tile-object.js';
import { RoomFlags } from '../../src/world/room-flags.js';
import { Bomb, BombState } from '../../src/objects/weapons/bomb.js';
import { CandleFire, FireState } from '../../src/objects/weapons/candle-fire.js';
import type { OverworldScreen } from '../../src/data/overworld-types.js';
import type { SecretsData } from '../../src/data/secret-types.js';
import {
  SQUARE_INDEX_CAVE_ENTRANCE,
  SQUARE_INDEX_STAIRS,
} from '../../src/data/secret-types.js';

function makeSecretsData(): SecretsData {
  return {
    questSecretByScreen: Array.from({ length: 128 }, () => 0),
    shortcutPositionIndexByScreen: Array.from({ length: 128 }, () => 0),
    shortcutPositions: [
      { x: 80, y: 112 },
      { x: 64, y: 144 },
      { x: 144, y: 144 },
      { x: 96, y: 144 },
    ],
  };
}

function makeScreen(id: number, tileOverride?: { row: number; col: number; value: number }): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  if (tileOverride) {
    tiles[tileOverride.row]![tileOverride.col] = tileOverride.value;
  }
  return {
    id,
    row: Math.floor(id / OVERWORLD_COLS),
    col: id % OVERWORLD_COLS,
    uniqueRoomId: id & 0x3f,
    tiles,
  };
}

function makeLinkInfo(overrides: Partial<{
  posX: number;
  posY: number;
  facing: Direction;
  isMoving: boolean;
  hasBracelet: boolean;
}> = {}) {
  return {
    posX: overrides.posX ?? 120,
    posY: overrides.posY ?? 80,
    facing: overrides.facing ?? Direction.Down,
    isMoving: overrides.isMoving ?? false,
    hasBracelet: overrides.hasBracelet ?? false,
  };
}

describe('TileObjectManager', () => {
  describe('tile object detection', () => {
    it('detects rock (square index 38) in tile grid', () => {
      const mgr = new TileObjectManager();
      const screen = makeScreen(10, { row: 5, col: 8, value: 38 });
      mgr.initForScreen(screen, new RoomFlags(), makeSecretsData());
      expect(mgr.tileObject).not.toBeNull();
      expect(mgr.tileObject!.type).toBe(0x62);
      expect(mgr.tileObject!.col).toBe(8);
      expect(mgr.tileObject!.row).toBe(5);
    });

    it('detects rock wall (square index 39)', () => {
      const mgr = new TileObjectManager();
      const screen = makeScreen(10, { row: 3, col: 4, value: 39 });
      mgr.initForScreen(screen, new RoomFlags(), makeSecretsData());
      expect(mgr.tileObject).not.toBeNull();
      expect(mgr.tileObject!.type).toBe(0x63);
    });

    it('detects tree (square index 40)', () => {
      const mgr = new TileObjectManager();
      const screen = makeScreen(10, { row: 6, col: 10, value: 40 });
      mgr.initForScreen(screen, new RoomFlags(), makeSecretsData());
      expect(mgr.tileObject).not.toBeNull();
      expect(mgr.tileObject!.type).toBe(0x64);
    });

    it('detects gravestone (square index 41)', () => {
      const mgr = new TileObjectManager();
      const screen = makeScreen(10, { row: 4, col: 7, value: 41 });
      mgr.initForScreen(screen, new RoomFlags(), makeSecretsData());
      expect(mgr.tileObject).not.toBeNull();
      expect(mgr.tileObject!.type).toBe(0x65);
    });

    it('skips Armos types (square indices 42-43)', () => {
      const mgr = new TileObjectManager();
      const screen = makeScreen(10, { row: 5, col: 8, value: 42 });
      mgr.initForScreen(screen, new RoomFlags(), makeSecretsData());
      expect(mgr.tileObject).toBeNull();
    });

    it('detects no tile object on a screen with no special squares', () => {
      const mgr = new TileObjectManager();
      const screen = makeScreen(10);
      mgr.initForScreen(screen, new RoomFlags(), makeSecretsData());
      expect(mgr.tileObject).toBeNull();
    });

    it('only detects the first tile object per screen', () => {
      const mgr = new TileObjectManager();
      const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
      tiles[3]![5] = 38; // rock
      tiles[7]![10] = 40; // tree
      const screen: OverworldScreen = {
        id: 10, row: 0, col: 10, uniqueRoomId: 10, tiles,
      };
      mgr.initForScreen(screen, new RoomFlags(), makeSecretsData());
      expect(mgr.tileObject!.type).toBe(0x62); // first one found
      expect(mgr.tileObject!.row).toBe(3);
      expect(mgr.tileObject!.col).toBe(5);
    });
  });

  describe('quest secret mismatch', () => {
    it('skips Q2-only secrets in Q1', () => {
      const mgr = new TileObjectManager();
      const secrets = makeSecretsData();
      (secrets.questSecretByScreen as number[])[10] = 2; // Q2-only
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, new RoomFlags(), secrets);
      expect(mgr.tileObject).toBeNull();
    });

    it('allows Q1-only secrets in Q1', () => {
      const mgr = new TileObjectManager();
      const secrets = makeSecretsData();
      (secrets.questSecretByScreen as number[])[10] = 1; // Q1-only
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, new RoomFlags(), secrets);
      expect(mgr.tileObject).not.toBeNull();
    });

    it('allows both-quest secrets', () => {
      const mgr = new TileObjectManager();
      const secrets = makeSecretsData();
      (secrets.questSecretByScreen as number[])[10] = 0;
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, new RoomFlags(), secrets);
      expect(mgr.tileObject).not.toBeNull();
    });
  });

  describe('pre-revealed secrets', () => {
    it('pre-reveals cave entrance if room flag already set for rock wall', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      flags.setSecretFound(10);
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, flags, makeSecretsData());
      expect(mgr.secretRevealed).toBe(true);
      const gridIdx = 5 * 16 + 8;
      expect(mgr.tileOverrides.get(gridIdx)).toBe(SQUARE_INDEX_CAVE_ENTRANCE);
    });

    it('pre-reveals stairs if room flag already set for tree', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      flags.setSecretFound(10);
      const screen = makeScreen(10, { row: 5, col: 8, value: 40 });
      mgr.initForScreen(screen, flags, makeSecretsData());
      expect(mgr.secretRevealed).toBe(true);
      // Stairs appear at the shortcut position, not the tile object position
      const pos = makeSecretsData().shortcutPositions[0]!;
      const stairsGridIdx = Math.floor(pos.y / 16) * 16 + Math.floor(pos.x / 16);
      expect(mgr.tileOverrides.get(stairsGridIdx)).toBe(SQUARE_INDEX_STAIRS);
    });
  });

  describe('bombable rock wall', () => {
    it('reveals cave entrance when bomb detonates near rock wall', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, flags, makeSecretsData());

      // Create a bomb at the tile object position and advance to detonating state
      const bomb = new Bomb(8 * 16, 5 * 16);
      // Advance bomb to detonating state
      for (let i = 0; i < 0x30 + 0x18 + 1; i++) bomb.update();
      expect(bomb.isDetonating).toBe(true);

      mgr.update(screen, makeLinkInfo(), [bomb], [], flags, makeSecretsData());
      expect(mgr.secretRevealed).toBe(true);
      expect(flags.isSecretFound(10)).toBe(true);

      const reveal = mgr.consumePendingReveal();
      expect(reveal).not.toBeNull();
      expect(reveal!.revealedSquareIndex).toBe(SQUARE_INDEX_CAVE_ENTRANCE);
    });

    it('does not reveal when bomb is too far', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, flags, makeSecretsData());

      // Bomb 50px away — beyond 16px threshold
      const bomb = new Bomb(8 * 16 + 50, 5 * 16);
      for (let i = 0; i < 0x30 + 0x18 + 1; i++) bomb.update();

      mgr.update(screen, makeLinkInfo(), [bomb], [], flags, makeSecretsData());
      expect(mgr.secretRevealed).toBe(false);
    });

    it('does not reveal when bomb is not detonating', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, flags, makeSecretsData());

      const bomb = new Bomb(8 * 16, 5 * 16);
      // Don't advance to detonating
      expect(bomb.isDetonating).toBe(false);

      mgr.update(screen, makeLinkInfo(), [bomb], [], flags, makeSecretsData());
      expect(mgr.secretRevealed).toBe(false);
    });
  });

  describe('burnable tree', () => {
    it('reveals stairs when standing fire is near tree', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 40 });
      mgr.initForScreen(screen, flags, makeSecretsData());

      // Start fire 16px above tile object so it walks DOWN to land on it
      const fire = new CandleFire(8 * 16, 5 * 16 - 16, Direction.Down);
      for (let i = 0; i < 16; i++) fire.update(); // walk 16px to tile object position
      expect(fire.isStanding).toBe(true);
      expect(fire.y).toBe(5 * 16); // now at tile object Y

      mgr.update(screen, makeLinkInfo(), [], [fire], flags, makeSecretsData());
      expect(mgr.secretRevealed).toBe(true);
      expect(flags.isSecretFound(10)).toBe(true);

      const reveal = mgr.consumePendingReveal();
      expect(reveal).not.toBeNull();
      expect(reveal!.revealedSquareIndex).toBe(SQUARE_INDEX_STAIRS);
    });

    it('does not reveal when fire is still walking', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 40 });
      mgr.initForScreen(screen, flags, makeSecretsData());

      const fire = new CandleFire(8 * 16, 5 * 16, Direction.Down);
      // Only advance 5 frames — still walking
      for (let i = 0; i < 5; i++) fire.update();
      expect(fire.isStanding).toBe(false);

      mgr.update(screen, makeLinkInfo(), [], [fire], flags, makeSecretsData());
      expect(mgr.secretRevealed).toBe(false);
    });
  });

  describe('pushable rock/gravestone', () => {
    it('gravestone does not require bracelet', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 41 }); // gravestone
      mgr.initForScreen(screen, flags, makeSecretsData());

      const link = makeLinkInfo({
        posX: 8 * 16,
        posY: 5 * 16 + 10, // below the gravestone (dy=13 < 17)
        facing: Direction.Up,
        isMoving: true,
        hasBracelet: false,
      });

      // Hold for push timer threshold (16 frames)
      for (let i = 0; i < 16; i++) {
        mgr.update(screen, link, [], [], flags, makeSecretsData());
      }

      // Now it should be sliding
      expect(mgr.tileObject).not.toBeNull();
    });

    it('rock requires bracelet', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 38 }); // rock
      mgr.initForScreen(screen, flags, makeSecretsData());

      const link = makeLinkInfo({
        posX: 8 * 16,
        posY: 5 * 16 + 10,
        facing: Direction.Up,
        isMoving: true,
        hasBracelet: false, // no bracelet
      });

      for (let i = 0; i < 20; i++) {
        mgr.update(screen, link, [], [], flags, makeSecretsData());
      }

      // Should not have started pushing without bracelet
      expect(mgr.secretRevealed).toBe(false);
    });

    it('rock pushes when bracelet is equipped', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 38 }); // rock
      mgr.initForScreen(screen, flags, makeSecretsData());

      // Link below the rock at exactly the right distance
      // Tile object at y=80, Link at y=90 → linkAdjY=93, dy=93-80=13 < 17 ✓
      const link = makeLinkInfo({
        posX: 8 * 16,
        posY: 5 * 16 + 10,
        facing: Direction.Up,
        isMoving: true,
        hasBracelet: true,
      });

      // Push timer (16 frames) + slide (16 frames) = 32 frames total
      for (let i = 0; i < 32; i++) {
        mgr.update(screen, link, [], [], flags, makeSecretsData());
      }

      expect(mgr.secretRevealed).toBe(true);
      expect(flags.isSecretFound(10)).toBe(true);
    });

    it('does not push horizontally', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 41 }); // gravestone
      mgr.initForScreen(screen, flags, makeSecretsData());

      const link = makeLinkInfo({
        posX: 8 * 16 - 14,
        posY: 5 * 16, // same Y, beside the gravestone
        facing: Direction.Right,
        isMoving: true,
      });

      for (let i = 0; i < 20; i++) {
        mgr.update(screen, link, [], [], flags, makeSecretsData());
      }

      expect(mgr.secretRevealed).toBe(false);
    });

    it('requires X positions to match exactly', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 41 });
      mgr.initForScreen(screen, flags, makeSecretsData());

      const link = makeLinkInfo({
        posX: 8 * 16 + 1, // off by 1
        posY: 5 * 16 + 10,
        facing: Direction.Up,
        isMoving: true,
      });

      for (let i = 0; i < 20; i++) {
        mgr.update(screen, link, [], [], flags, makeSecretsData());
      }

      expect(mgr.secretRevealed).toBe(false);
    });
  });

  describe('consumePendingReveal', () => {
    it('returns null when no reveal has occurred', () => {
      const mgr = new TileObjectManager();
      expect(mgr.consumePendingReveal()).toBeNull();
    });

    it('returns null after consuming once', () => {
      const mgr = new TileObjectManager();
      const flags = new RoomFlags();
      const screen = makeScreen(10, { row: 5, col: 8, value: 39 });
      mgr.initForScreen(screen, flags, makeSecretsData());

      const bomb = new Bomb(8 * 16, 5 * 16);
      for (let i = 0; i < 0x30 + 0x18 + 1; i++) bomb.update();

      mgr.update(screen, makeLinkInfo(), [bomb], [], flags, makeSecretsData());
      expect(mgr.consumePendingReveal()).not.toBeNull();
      expect(mgr.consumePendingReveal()).toBeNull();
    });
  });
});
