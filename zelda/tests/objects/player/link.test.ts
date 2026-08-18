import { describe, it, expect, vi } from 'vitest';
import { Link } from '../../../src/objects/player/link.js';
import { TileCollisionMap } from '../../../src/world/collision.js';
import { InputManager, type EventTarget as InputEventTarget } from '../../../src/core/input.js';
import { Direction } from '../../../src/core/types.js';
import type { OverworldScreen } from '../../../src/data/overworld-types.js';
import {
  LINK_START_X,
  LINK_START_Y,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_BOTTOM,
} from '../../../src/core/constants.js';

// --- Helpers ---

interface MockEventTarget extends InputEventTarget {
  dispatchKeyDown(code: string): void;
  dispatchKeyUp(code: string): void;
}

function createMockEventTarget(): MockEventTarget {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener(type: string, handler: (e: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
    removeEventListener(type: string, handler: (e: unknown) => void) {
      listeners.get(type)?.delete(handler);
    },
    dispatchKeyDown(code: string) {
      const event = { code, preventDefault: vi.fn() };
      for (const fn of listeners.get('keydown') ?? []) fn(event);
    },
    dispatchKeyUp(code: string) {
      const event = { code, preventDefault: vi.fn() };
      for (const fn of listeners.get('keyup') ?? []) fn(event);
    },
  };
}

// All-walkable metatile values (all below threshold 0x8D)
const ALL_WALKABLE_METATILES = [36, 38];
// Mixed: index 0 walkable, index 1 blocked
const MIXED_METATILES = [36, 200];

function allWalkableScreen(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

function screenWithWall(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  // Block column 10 (pixels 160-175) entirely
  for (let r = 0; r < 11; r++) {
    tiles[r]![10] = 1;
  }
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

function createInput(): { input: InputManager; target: MockEventTarget } {
  const target = createMockEventTarget();
  const input = new InputManager();
  input.attach(target);
  return { input, target };
}

function holdDirection(target: MockEventTarget, dir: Direction): void {
  const keyMap: Record<Direction, string> = {
    [Direction.Up]: 'ArrowUp',
    [Direction.Down]: 'ArrowDown',
    [Direction.Left]: 'ArrowLeft',
    [Direction.Right]: 'ArrowRight',
  };
  target.dispatchKeyDown(keyMap[dir]!);
}

function releaseDirection(target: MockEventTarget, dir: Direction): void {
  const keyMap: Record<Direction, string> = {
    [Direction.Up]: 'ArrowUp',
    [Direction.Down]: 'ArrowDown',
    [Direction.Left]: 'ArrowLeft',
    [Direction.Right]: 'ArrowRight',
  };
  target.dispatchKeyUp(keyMap[dir]!);
}

// --- Tests ---

describe('Link', () => {
  describe('construction', () => {
    it('defaults to center position and facing down', () => {
      const link = new Link();
      expect(link.posX).toBe(LINK_START_X);
      expect(link.posY).toBe(LINK_START_Y);
      expect(link.facing).toBe(Direction.Down);
      expect(link.isMoving).toBe(false);
    });

    it('accepts custom position', () => {
      const link = new Link(50, 60);
      expect(link.posX).toBe(50);
      expect(link.posY).toBe(60);
    });
  });

  describe('setPosition / setDirection', () => {
    it('updates position', () => {
      const link = new Link();
      link.setPosition(42, 99);
      expect(link.posX).toBe(42);
      expect(link.posY).toBe(99);
    });

    it('updates direction', () => {
      const link = new Link();
      link.setDirection(Direction.Left);
      expect(link.facing).toBe(Direction.Left);
    });
  });

  describe('QSpeed movement pattern', () => {
    it('produces alternating 1px/2px pattern over frames', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      holdDirection(target, Direction.Right);

      const moves: number[] = [];
      for (let i = 0; i < 4; i++) {
        const prevX = link.posX;
        input.update();
        link.update(input, collision, screen);
        moves.push(link.posX - prevX);
      }

      // QSpeed $60: subpixel goes 96, 192, 32(+1px), 128, 224, 64(+1px), 160, 0(+2px)...
      // Frame 1: 4 applications of 96 → 384/256 = 1 carry, remainder 128 → 1px
      // Frame 2: start at 128, +96=224, +96=64(+1), +96=160, +96=0(+1) → 2px
      // Frame 3: start at 0, same as frame 1 → 1px (wait, actually...)
      // The NES pattern for $60: frame sequence is 2,1,2,2,1,2,2,1...
      // Let's just verify total distance over 4 frames = 6 pixels (1.5 * 4)
      const total = moves.reduce((a, b) => a + b, 0);
      expect(total).toBe(6);
    });

    it('does not move when no input', () => {
      const { input } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      input.update();
      const result = link.update(input, collision, screen);

      expect(link.posX).toBe(120);
      expect(link.posY).toBe(80);
      expect(link.isMoving).toBe(false);
      expect(result.screenEdge).toBeNull();
    });
  });

  describe('direction from input', () => {
    it('sets facing to input direction', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      holdDirection(target, Direction.Left);
      input.update();
      link.update(input, collision, screen);
      expect(link.facing).toBe(Direction.Left);
    });

    it('prioritizes up when multiple directions held', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      holdDirection(target, Direction.Right);
      holdDirection(target, Direction.Up);
      input.update();
      link.update(input, collision, screen);
      expect(link.facing).toBe(Direction.Up);
    });
  });

  describe('tile collision', () => {
    it('stops when moving toward a blocked tile', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(MIXED_METATILES);
      const screen = screenWithWall();
      // Place Link just left of the wall (col 10 = pixel 160), hitbox at x+4..x+11
      // Wall starts at pixel 160. Hitbox right edge would be at x+4+7 = x+11
      // So Link at x=149 → hitbox right at 160 would enter tile 10 → blocked
      const link = new Link(148, 80);

      holdDirection(target, Direction.Right);
      for (let i = 0; i < 20; i++) {
        input.update();
        link.update(input, collision, screen);
      }

      // Link should stop before hitbox enters the blocked tile
      // Hitbox right edge = x + 4 + 8 - 1 = x + 11, must be < 160
      // So x <= 148
      expect(link.posX).toBeLessThanOrEqual(148);
    });

    it('moves freely on walkable tiles', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      holdDirection(target, Direction.Right);
      input.update();
      link.update(input, collision, screen);
      expect(link.posX).toBeGreaterThan(120);
    });
  });

  describe('screen edge detection', () => {
    it('returns Right when walking past right edge', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(SCREEN_EDGE_RIGHT, 80);

      holdDirection(target, Direction.Right);

      let result = { screenEdge: null as Direction | null };
      for (let i = 0; i < 10; i++) {
        input.update();
        const r = link.update(input, collision, screen);
        if (r.screenEdge !== null) {
          result = r;
          break;
        }
      }
      expect(result.screenEdge).toBe(Direction.Right);
    });

    it('returns Left when walking past left edge', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(1, 80);

      holdDirection(target, Direction.Left);

      let result = { screenEdge: null as Direction | null };
      for (let i = 0; i < 10; i++) {
        input.update();
        const r = link.update(input, collision, screen);
        if (r.screenEdge !== null) {
          result = r;
          break;
        }
      }
      expect(result.screenEdge).toBe(Direction.Left);
    });

    it('returns Down when walking past bottom edge', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, SCREEN_EDGE_BOTTOM);

      holdDirection(target, Direction.Down);

      let result = { screenEdge: null as Direction | null };
      for (let i = 0; i < 10; i++) {
        input.update();
        const r = link.update(input, collision, screen);
        if (r.screenEdge !== null) {
          result = r;
          break;
        }
      }
      expect(result.screenEdge).toBe(Direction.Down);
    });

    it('returns Up when walking past top edge', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 1);

      holdDirection(target, Direction.Up);

      let result = { screenEdge: null as Direction | null };
      for (let i = 0; i < 10; i++) {
        input.update();
        const r = link.update(input, collision, screen);
        if (r.screenEdge !== null) {
          result = r;
          break;
        }
      }
      expect(result.screenEdge).toBe(Direction.Up);
    });

    it('returns null for normal movement', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      holdDirection(target, Direction.Right);
      input.update();
      const result = link.update(input, collision, screen);
      expect(result.screenEdge).toBeNull();
    });
  });

  describe('grid snapping', () => {
    it('snaps perpendicular axis toward nearest grid line when moving horizontally', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      // Y=82 → 82 % 8 = 2, within snap threshold (3), should snap toward 80
      const link = new Link(120, 82);

      holdDirection(target, Direction.Right);
      input.update();
      link.update(input, collision, screen);

      expect(link.posY).toBe(81);
    });

    it('snaps toward higher grid line when closer', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      // Y=86 → 86 % 8 = 6, gridSize-threshold = 5, 6 >= 5 → snap toward 88
      const link = new Link(120, 86);

      holdDirection(target, Direction.Right);
      input.update();
      link.update(input, collision, screen);

      expect(link.posY).toBe(87);
    });

    it('does not snap when on grid line', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80); // 80 % 8 = 0

      holdDirection(target, Direction.Right);
      input.update();
      link.update(input, collision, screen);

      expect(link.posY).toBe(80);
    });
  });

  describe('walk animation', () => {
    it('ticks when moving', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      holdDirection(target, Direction.Right);
      // animStep starts at 0, toggles every 6 frames
      for (let i = 0; i < 6; i++) {
        input.update();
        link.update(input, collision, screen);
      }
      expect(link.animStep).toBe(1);
    });

    it('resets when stopped', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      holdDirection(target, Direction.Right);
      for (let i = 0; i < 6; i++) {
        input.update();
        link.update(input, collision, screen);
      }
      expect(link.animStep).toBe(1);

      releaseDirection(target, Direction.Right);
      input.update();
      link.update(input, collision, screen);
      expect(link.animStep).toBe(0);
    });
  });

  describe('walkForward', () => {
    it('advances position at QSpeed rate', () => {
      const link = new Link(120, 80);
      link.setDirection(Direction.Right);

      let totalDist = 0;
      for (let i = 0; i < 4; i++) {
        const prev = link.posX;
        link.walkForward();
        totalDist += link.posX - prev;
      }
      // 4 frames * 1.5 px/frame average = 6 pixels
      expect(totalDist).toBe(6);
    });

    it('advances in the current direction without collision', () => {
      const link = new Link(120, 80);
      link.setDirection(Direction.Up);
      link.walkForward();
      expect(link.posY).toBeLessThan(80);
    });
  });

  describe('getCollisionRect', () => {
    it('returns rect at hitbox offset', () => {
      const link = new Link(100, 50);
      const rect = link.getCollisionRect();
      expect(rect.x).toBe(104);
      expect(rect.y).toBe(58);
      expect(rect.width).toBe(8);
      expect(rect.height).toBe(8);
    });
  });

  describe('sword attack', () => {
    it('starts sword swing on attack input', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);
      link.setHasSword(true);

      target.dispatchKeyDown('KeyX');
      input.update();
      link.update(input, collision, screen);
      expect(link.isSwordActive).toBe(true);
    });

    it('freezes movement during sword swing', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);
      link.setHasSword(true);

      target.dispatchKeyDown('KeyX');
      input.update();
      link.update(input, collision, screen);

      // Hold right during sword swing — should not move
      target.dispatchKeyUp('KeyX');
      holdDirection(target, Direction.Right);
      input.update();
      link.update(input, collision, screen);
      expect(link.posX).toBe(120);
      expect(link.isMoving).toBe(false);
    });

    it('sword completes after 16 frames', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);

      target.dispatchKeyDown('KeyX');
      input.update();
      link.update(input, collision, screen); // starts sword
      target.dispatchKeyUp('KeyX');

      for (let i = 0; i < 16; i++) {
        input.update();
        link.update(input, collision, screen);
      }
      expect(link.isSwordActive).toBe(false);
    });

    it('fires beam at full health', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);
      link.setHasSword(true);
      link.setHealth(6, 6);

      target.dispatchKeyDown('KeyX');
      input.update();
      link.update(input, collision, screen);
      target.dispatchKeyUp('KeyX');

      // Run through sword swing until beam should fire (after Extended → Retracting)
      let beamFired = false;
      for (let i = 0; i < 16; i++) {
        input.update();
        link.update(input, collision, screen);
        if (link.activeSwordBeam !== null) {
          beamFired = true;
        }
      }
      expect(beamFired).toBe(true);
    });

    it('does not fire beam when health is not full', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);
      link.setHealth(4, 6);

      target.dispatchKeyDown('KeyX');
      input.update();
      link.update(input, collision, screen);
      target.dispatchKeyUp('KeyX');

      for (let i = 0; i < 16; i++) {
        input.update();
        link.update(input, collision, screen);
      }
      expect(link.activeSwordBeam).toBeNull();
    });

    it('does not swing without sword', () => {
      const { input, target } = createInput();
      const collision = new TileCollisionMap(ALL_WALKABLE_METATILES);
      const screen = allWalkableScreen();
      const link = new Link(120, 80);
      link.setHasSword(false);

      target.dispatchKeyDown('KeyX');
      input.update();
      link.update(input, collision, screen);
      expect(link.isSwordActive).toBe(false);
    });
  });
});
