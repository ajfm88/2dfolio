import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/core/types.js';
import {
  LINK_ENTRY_BOTTOM,
  LINK_ENTRY_LEFT,
  LINK_ENTRY_RIGHT,
  LINK_ENTRY_TOP,
  OVERWORLD_COLS,
  OVERWORLD_ROWS,
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../src/core/constants.js';
import { OverworldManager } from '../../src/world/overworld-manager.js';
import { TileRenderer } from '../../src/render/tile-renderer.js';
import { Link } from '../../src/objects/player/link.js';
import type { OverworldData, OverworldScreen } from '../../src/data/overworld-types.js';

function makeScreen(id: number): OverworldScreen {
  return {
    id,
    row: Math.floor(id / OVERWORLD_COLS),
    col: id % OVERWORLD_COLS,
    uniqueRoomId: id & 0x3f,
    tiles: Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0)),
  };
}

function makeOverworldData(): OverworldData {
  const screens: OverworldScreen[] = [];
  for (let r = 0; r < OVERWORLD_ROWS; r++) {
    for (let c = 0; c < OVERWORLD_COLS; c++) {
      screens.push(makeScreen(r * OVERWORLD_COLS + c));
    }
  }
  const primary = Array.from({ length: 56 }, (_, i) => (i < 16 ? 0x00 : 0x90));
  return { screens, squareTable: { primary, secondary: [] } };
}

function createManager(startRow = 7, startCol = 7): OverworldManager {
  const data = makeOverworldData();
  const tileRenderer = new TileRenderer();
  return new OverworldManager(data, tileRenderer, startRow, startCol);
}

describe('OverworldManager', () => {
  describe('initialization', () => {
    it('starts at the given screen coordinates', () => {
      const mgr = createManager(7, 7);
      expect(mgr.screenRow).toBe(7);
      expect(mgr.screenCol).toBe(7);
      expect(mgr.currentScreen.id).toBe(7 * OVERWORLD_COLS + 7);
    });

    it('marks the starting screen as visited', () => {
      const mgr = createManager(7, 7);
      expect(mgr.visitedScreens.has(7 * OVERWORLD_COLS + 7)).toBe(true);
    });

    it('starts with no active transition', () => {
      const mgr = createManager();
      expect(mgr.isTransitioning).toBe(false);
    });

    it('throws if start coordinates are invalid', () => {
      const data: OverworldData = { screens: [], squareTable: { primary: [], secondary: [] } };
      const tileRenderer = new TileRenderer();
      expect(() => new OverworldManager(data, tileRenderer, 0, 0)).toThrow();
    });
  });

  describe('tryTransition', () => {
    it('starts a right transition and updates screen coords', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Right, link);
      expect(result).toBe(true);
      expect(mgr.screenRow).toBe(4);
      expect(mgr.screenCol).toBe(5);
      expect(mgr.isTransitioning).toBe(true);
    });

    it('starts a left transition', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Left, link);
      expect(result).toBe(true);
      expect(mgr.screenCol).toBe(3);
    });

    it('starts an up transition', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Up, link);
      expect(result).toBe(true);
      expect(mgr.screenRow).toBe(3);
    });

    it('starts a down transition', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Down, link);
      expect(result).toBe(true);
      expect(mgr.screenRow).toBe(5);
    });

    it('rejects transition if one is already active', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      mgr.tryTransition(Direction.Right, link);
      const result = mgr.tryTransition(Direction.Left, link);
      expect(result).toBe(false);
      expect(mgr.screenCol).toBe(5);
    });

    it('marks new screen as visited', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      const newId = 4 * OVERWORLD_COLS + 5;
      expect(mgr.visitedScreens.has(newId)).toBe(false);
      mgr.tryTransition(Direction.Right, link);
      expect(mgr.visitedScreens.has(newId)).toBe(true);
    });
  });

  describe('boundary clamping', () => {
    it('rejects upward transition from top row', () => {
      const mgr = createManager(0, 8);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Up, link);
      expect(result).toBe(false);
      expect(mgr.screenRow).toBe(0);
    });

    it('rejects downward transition from bottom row', () => {
      const mgr = createManager(OVERWORLD_ROWS - 1, 8);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Down, link);
      expect(result).toBe(false);
      expect(mgr.screenRow).toBe(OVERWORLD_ROWS - 1);
    });

    it('rejects leftward transition from leftmost column', () => {
      const mgr = createManager(4, 0);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Left, link);
      expect(result).toBe(false);
      expect(mgr.screenCol).toBe(0);
    });

    it('rejects rightward transition from rightmost column', () => {
      const mgr = createManager(4, OVERWORLD_COLS - 1);
      const link = new Link(120, 80);
      const result = mgr.tryTransition(Direction.Right, link);
      expect(result).toBe(false);
      expect(mgr.screenCol).toBe(OVERWORLD_COLS - 1);
    });

    it('allows transition from corners in valid directions', () => {
      const mgr = createManager(0, 0);
      const link = new Link(120, 80);
      expect(mgr.tryTransition(Direction.Right, link)).toBe(true);
    });
  });

  describe('Link entry positions (Z_07.asm:2831 PlayerScreenEdgeBounds)', () => {
    it('places Link at left edge when transitioning right', () => {
      const mgr = createManager(4, 4);
      const link = new Link(240, 80);
      mgr.tryTransition(Direction.Right, link);
      expect(link.posX).toBe(LINK_ENTRY_LEFT);
      expect(link.posY).toBe(80);
    });

    it('places Link at right edge when transitioning left', () => {
      const mgr = createManager(4, 4);
      const link = new Link(0, 80);
      mgr.tryTransition(Direction.Left, link);
      expect(link.posX).toBe(LINK_ENTRY_RIGHT);
      expect(link.posY).toBe(80);
    });

    it('places Link at top edge when transitioning down', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 160);
      mgr.tryTransition(Direction.Down, link);
      expect(link.posX).toBe(120);
      expect(link.posY).toBe(LINK_ENTRY_TOP);
    });

    it('places Link at bottom edge when transitioning up', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 0);
      mgr.tryTransition(Direction.Up, link);
      expect(link.posX).toBe(120);
      expect(link.posY).toBe(LINK_ENTRY_BOTTOM);
    });

    it('preserves perpendicular coordinate on horizontal transition', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 42);
      mgr.tryTransition(Direction.Right, link);
      expect(link.posY).toBe(42);
    });

    it('preserves perpendicular coordinate on vertical transition', () => {
      const mgr = createManager(4, 4);
      const link = new Link(55, 80);
      mgr.tryTransition(Direction.Down, link);
      expect(link.posX).toBe(55);
    });

    it('entry positions match SCREEN_EDGE bounds (no re-trigger)', () => {
      expect(LINK_ENTRY_LEFT).toBe(SCREEN_EDGE_LEFT);
      expect(LINK_ENTRY_RIGHT).toBe(SCREEN_EDGE_RIGHT);
      expect(LINK_ENTRY_TOP).toBe(SCREEN_EDGE_TOP);
      expect(LINK_ENTRY_BOTTOM).toBe(SCREEN_EDGE_BOTTOM);
    });

    it('entry position after up transition does not exceed SCREEN_EDGE_BOTTOM', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 0);
      mgr.tryTransition(Direction.Up, link);
      expect(link.posY).toBeLessThanOrEqual(SCREEN_EDGE_BOTTOM);
    });

    it('entry position after down transition does not go below SCREEN_EDGE_TOP', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 160);
      mgr.tryTransition(Direction.Down, link);
      expect(link.posY).toBeGreaterThanOrEqual(SCREEN_EDGE_TOP);
    });
  });

  describe('updateTransition', () => {
    it('completes a horizontal transition in 64 frames', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      mgr.tryTransition(Direction.Right, link);
      let frames = 0;
      while (mgr.isTransitioning) {
        mgr.updateTransition(link);
        frames++;
      }
      expect(frames).toBe(64);
    });

    it('completes a vertical transition in 44 frames', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      mgr.tryTransition(Direction.Down, link);
      let frames = 0;
      while (mgr.isTransitioning) {
        mgr.updateTransition(link);
        frames++;
      }
      expect(frames).toBe(44);
    });

    it('does nothing when no transition is active', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      mgr.updateTransition(link);
      expect(mgr.isTransitioning).toBe(false);
    });
  });

  describe('setScreen', () => {
    it('directly sets screen coordinates', () => {
      const mgr = createManager(4, 4);
      mgr.setScreen(2, 10);
      expect(mgr.screenRow).toBe(2);
      expect(mgr.screenCol).toBe(10);
      expect(mgr.currentScreen.id).toBe(2 * OVERWORLD_COLS + 10);
    });

    it('clears any active transition', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);
      mgr.tryTransition(Direction.Right, link);
      expect(mgr.isTransitioning).toBe(true);
      mgr.setScreen(0, 0);
      expect(mgr.isTransitioning).toBe(false);
    });

    it('marks the screen as visited', () => {
      const mgr = createManager(4, 4);
      const targetId = 2 * OVERWORLD_COLS + 10;
      expect(mgr.visitedScreens.has(targetId)).toBe(false);
      mgr.setScreen(2, 10);
      expect(mgr.visitedScreens.has(targetId)).toBe(true);
    });
  });

  describe('multi-screen navigation', () => {
    it('tracks visited screens across multiple transitions', () => {
      const mgr = createManager(4, 4);
      const link = new Link(120, 80);

      mgr.tryTransition(Direction.Right, link);
      while (mgr.isTransitioning) mgr.updateTransition(link);

      mgr.tryTransition(Direction.Right, link);
      while (mgr.isTransitioning) mgr.updateTransition(link);

      mgr.tryTransition(Direction.Down, link);
      while (mgr.isTransitioning) mgr.updateTransition(link);

      expect(mgr.visitedScreens.size).toBe(4);
      expect(mgr.visitedScreens.has(4 * OVERWORLD_COLS + 4)).toBe(true);
      expect(mgr.visitedScreens.has(4 * OVERWORLD_COLS + 5)).toBe(true);
      expect(mgr.visitedScreens.has(4 * OVERWORLD_COLS + 6)).toBe(true);
      expect(mgr.visitedScreens.has(5 * OVERWORLD_COLS + 6)).toBe(true);
    });

    it('allows navigating to all 128 screens', () => {
      const mgr = createManager(0, 0);
      const link = new Link(120, 80);
      let count = 1;

      for (let r = 0; r < OVERWORLD_ROWS; r++) {
        const goRight = r % 2 === 0;
        for (let c = 0; c < OVERWORLD_COLS - 1; c++) {
          const dir = goRight ? Direction.Right : Direction.Left;
          mgr.tryTransition(dir, link);
          while (mgr.isTransitioning) mgr.updateTransition(link);
          count++;
        }
        if (r < OVERWORLD_ROWS - 1) {
          mgr.tryTransition(Direction.Down, link);
          while (mgr.isTransitioning) mgr.updateTransition(link);
          count++;
        }
      }

      expect(mgr.visitedScreens.size).toBe(128);
      // 1 start + 15 horizontal per row × 8 rows + 7 downward = 128 screens
      expect(count).toBe(128);
    });
  });
});
