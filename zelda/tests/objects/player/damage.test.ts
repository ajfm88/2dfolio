import { describe, it, expect, vi } from 'vitest';
import { Link, LinkState } from '../../../src/objects/player/link.js';
import { TileCollisionMap } from '../../../src/world/collision.js';
import { InputManager, type EventTarget as InputEventTarget } from '../../../src/core/input.js';
import { Direction } from '../../../src/core/types.js';
import type { OverworldScreen } from '../../../src/data/overworld-types.js';
import {
  LINK_KNOCKBACK_DISTANCE,
  LINK_KNOCKBACK_SPEED,
  LINK_INVINCIBILITY_TICKS,
  LINK_START_X,
  LINK_START_Y,
} from '../../../src/core/constants.js';
import {
  DAMAGE_TABLE,
  decodeDamage,
  calculateDamage,
} from '../../../src/core/damage-tables.js';

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

function allWalkableScreen(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

function screenWithWall(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  for (let r = 0; r < 11; r++) {
    tiles[r]![10] = 1; // block column 10
  }
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

const ALL_WALKABLE_METATILES = [36, 38];
const MIXED_METATILES = [36, 200];

function createInput(): { input: InputManager; target: MockEventTarget } {
  const target = createMockEventTarget();
  const input = new InputManager();
  input.attach(target);
  return { input, target };
}

function createCollisionMap(metatiles: number[]): TileCollisionMap {
  return new TileCollisionMap(metatiles);
}

function tickFrames(
  link: Link,
  input: InputManager,
  collision: TileCollisionMap,
  screen: OverworldScreen,
  frames: number,
): void {
  for (let i = 0; i < frames; i++) {
    input.update();
    link.update(input, collision, screen);
  }
}

// --- decodeDamage ---

describe('decodeDamage', () => {
  it('decodes $80 as 0 full hearts + $80 partial', () => {
    const d = decodeDamage(0x80);
    expect(d.fullHearts).toBe(0);
    expect(d.partialHeart).toBe(0x80);
  });

  it('decodes $01 as 1 full heart + $00 partial', () => {
    const d = decodeDamage(0x01);
    expect(d.fullHearts).toBe(1);
    expect(d.partialHeart).toBe(0x00);
  });

  it('decodes $02 as 2 full hearts + $00 partial', () => {
    const d = decodeDamage(0x02);
    expect(d.fullHearts).toBe(2);
    expect(d.partialHeart).toBe(0x00);
  });

  it('decodes $04 as 4 full hearts + $00 partial', () => {
    const d = decodeDamage(0x04);
    expect(d.fullHearts).toBe(4);
    expect(d.partialHeart).toBe(0x00);
  });

  it('decodes $00 as 0 full hearts + $00 partial', () => {
    const d = decodeDamage(0x00);
    expect(d.fullHearts).toBe(0);
    expect(d.partialHeart).toBe(0x00);
  });
});

// --- calculateDamage ---

describe('calculateDamage', () => {
  it('$80 no ring = 1 half-heart', () => {
    expect(calculateDamage(0x80, 0)).toBe(1);
  });

  it('$01 no ring = 2 half-hearts', () => {
    expect(calculateDamage(0x01, 0)).toBe(2);
  });

  it('$02 no ring = 4 half-hearts', () => {
    expect(calculateDamage(0x02, 0)).toBe(4);
  });

  it('$04 no ring = 8 half-hearts', () => {
    expect(calculateDamage(0x04, 0)).toBe(8);
  });

  it('$80 blue ring = 1 half-heart (minimum 1)', () => {
    // $80 >> 1 = $40, which is < $80 → 0 half-hearts, but min is 1
    expect(calculateDamage(0x80, 1)).toBe(1);
  });

  it('$01 blue ring = 1 half-heart', () => {
    // fullHearts=1 >> 1 = 0, carry bit → partial=$80 → 1 half-heart
    expect(calculateDamage(0x01, 1)).toBe(1);
  });

  it('$02 blue ring = 2 half-hearts', () => {
    // fullHearts=2 >> 1 = 1 → 2 half-hearts
    expect(calculateDamage(0x02, 1)).toBe(2);
  });

  it('$02 red ring = 1 half-heart', () => {
    // fullHearts=2 >> 2 = 0, carry on first shift → partial=$80
    // second shift: partial=$80 >> 1 = $40 → 0 half-hearts, min 1
    expect(calculateDamage(0x02, 2)).toBe(1);
  });

  it('$04 blue ring = 4 half-hearts', () => {
    // fullHearts=4 >> 1 = 2 → 4 half-hearts
    expect(calculateDamage(0x04, 1)).toBe(4);
  });

  it('$04 red ring = 2 half-hearts', () => {
    // fullHearts=4 >> 2 = 1 → 2 half-hearts
    expect(calculateDamage(0x04, 2)).toBe(2);
  });

  it('$00 = 0 half-hearts (0 damage)', () => {
    expect(calculateDamage(0x00, 0)).toBe(0);
  });
});

// --- DAMAGE_TABLE ---

describe('DAMAGE_TABLE', () => {
  it('has entries for all projectile types $53-$5C', () => {
    for (let t = 0x53; t <= 0x5c; t++) {
      expect(DAMAGE_TABLE[t]).toBeDefined();
    }
  });

  it('Rock ($53) = $80 (1 half-heart)', () => {
    expect(DAMAGE_TABLE[0x53]).toBe(0x80);
  });

  it('Ganon ($3E) = $04 (8 half-hearts)', () => {
    expect(DAMAGE_TABLE[0x3e]).toBe(0x04);
  });

  it('Bubble ($2B) = $00 (no damage)', () => {
    expect(DAMAGE_TABLE[0x2b]).toBe(0x00);
  });
});

// --- Link.takeDamage ---

describe('Link.takeDamage', () => {
  it('reduces health by correct amount', () => {
    const link = new Link(80, 80);
    link.takeDamage(0x80, Direction.Left); // 1 half-heart
    expect(link.health).toBe(5);
  });

  it('sets state to Knockback', () => {
    const link = new Link(80, 80);
    link.takeDamage(0x80, Direction.Left);
    expect(link.state).toBe(LinkState.Knockback);
  });

  it('sets invincibility', () => {
    const link = new Link(80, 80);
    link.takeDamage(0x80, Direction.Left);
    expect(link.isInvincible).toBe(true);
  });

  it('prevents double-hit during invincibility', () => {
    const link = new Link(80, 80);
    link.takeDamage(0x80, Direction.Left); // health → 5
    link.takeDamage(0x80, Direction.Left); // should be no-op
    expect(link.health).toBe(5);
  });

  it('clamps health to 0', () => {
    const link = new Link(80, 80);
    link.takeDamage(0x04, Direction.Left); // 8 half-hearts vs 6 health
    expect(link.health).toBe(0);
    expect(link.isDead).toBe(true);
  });

  it('cancels active sword swing', () => {
    const link = new Link(80, 80);
    link.setHasSword(true);
    const { input, target } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    // Start attack
    target.dispatchKeyDown('KeyX');
    input.update();
    link.update(input, collision, screen);
    expect(link.isSwordActive).toBe(true);

    // Take damage should cancel sword
    link.takeDamage(0x80, Direction.Left);
    expect(link.isSwordActive).toBe(false);
    expect(link.state).toBe(LinkState.Knockback);
  });

  it('applies ring damage reduction (blue ring)', () => {
    const link = new Link(80, 80);
    link.setRingLevel(1);
    link.takeDamage(0x02, Direction.Left); // 4 → 2 half-hearts with blue ring
    expect(link.health).toBe(4);
  });

  it('applies ring damage reduction (red ring)', () => {
    const link = new Link(80, 80);
    link.setRingLevel(2);
    link.takeDamage(0x02, Direction.Left); // 4 → 1 half-heart with red ring
    expect(link.health).toBe(5);
  });

  it('does not apply damage when already dead', () => {
    const link = new Link(80, 80);
    link.setHealth(0, 6);
    link.takeDamage(0x80, Direction.Left);
    // Should not crash or change state since _isDead is not set by setHealth
    // but takeDamage should still work and set isDead
    expect(link.health).toBe(0);
  });
});

// --- Knockback movement ---

describe('knockback movement', () => {
  it('moves Link away from source at 4px/frame on walkable tiles', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left); // knockback to the right
    const startX = link.posX;

    input.update();
    link.update(input, collision, screen);

    expect(link.posX).toBe(startX + LINK_KNOCKBACK_SPEED);
  });

  it('completes knockback in 8 frames (32px / 4px per frame)', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);
    const startX = link.posX;

    const expectedFrames = LINK_KNOCKBACK_DISTANCE / LINK_KNOCKBACK_SPEED; // 8
    tickFrames(link, input, collision, screen, expectedFrames);

    expect(link.posX).toBe(startX + LINK_KNOCKBACK_DISTANCE);
    expect(link.state).not.toBe(LinkState.Knockback);
  });

  it('transitions to Invincible after knockback ends', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);

    const knockbackFrames = LINK_KNOCKBACK_DISTANCE / LINK_KNOCKBACK_SPEED;
    tickFrames(link, input, collision, screen, knockbackFrames);

    expect(link.state).toBe(LinkState.Invincible);
    expect(link.isInvincible).toBe(true);
  });

  it('stops knockback at wall tiles', () => {
    const link = new Link(144, 80); // close to wall at column 10 (pixel 160)
    const { input } = createInput();
    const collision = createCollisionMap(MIXED_METATILES);
    const screen = screenWithWall();

    link.takeDamage(0x80, Direction.Left); // knockback right toward wall

    tickFrames(link, input, collision, screen, 20);

    // Should have stopped before reaching the wall, not at start+32
    expect(link.posX).toBeLessThan(144 + LINK_KNOCKBACK_DISTANCE);
    expect(link.state).not.toBe(LinkState.Knockback);
  });

  it('stops knockback at screen boundary', () => {
    const link = new Link(232, 80); // near right edge (SCREEN_EDGE_RIGHT = 240)
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left); // knockback right

    tickFrames(link, input, collision, screen, 20);

    expect(link.posX).toBeLessThanOrEqual(240);
    expect(link.state).not.toBe(LinkState.Knockback);
  });

  it('blocks input during knockback', () => {
    const link = new Link(80, 80);
    const { input, target } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);
    const afterDamageX = link.posX;

    // Try to move left during knockback
    target.dispatchKeyDown('ArrowLeft');
    input.update();
    link.update(input, collision, screen);

    // Link should have moved right (knockback), not left
    expect(link.posX).toBeGreaterThan(afterDamageX);
  });
});

// --- Invincibility ---

describe('invincibility', () => {
  it('timer decrements every 2 frames', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);

    // Run past knockback
    const knockbackFrames = LINK_KNOCKBACK_DISTANCE / LINK_KNOCKBACK_SPEED;
    tickFrames(link, input, collision, screen, knockbackFrames);
    expect(link.state).toBe(LinkState.Invincible);

    // Remaining ticks = INVINCIBILITY_TICKS - ticks consumed during knockback
    // Each tick = 2 frames. knockbackFrames = 8 → 4 ticks consumed
    // Remaining ticks = 24 - 4 = 20. Need 20 * 2 = 40 more frames
    const remainingFrames = (LINK_INVINCIBILITY_TICKS - Math.floor(knockbackFrames / 2)) * 2;
    tickFrames(link, input, collision, screen, remainingFrames);

    expect(link.isInvincible).toBe(false);
    expect(link.state).toBe(LinkState.Normal);
  });

  it('isVisible toggles during invincibility', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);

    // Run past knockback
    const knockbackFrames = LINK_KNOCKBACK_DISTANCE / LINK_KNOCKBACK_SPEED;
    tickFrames(link, input, collision, screen, knockbackFrames);

    // During invincibility, isVisible should vary based on timer
    let sawVisible = false;
    let sawInvisible = false;
    for (let i = 0; i < 16; i++) {
      if (link.isVisible) sawVisible = true;
      else sawInvisible = true;
      input.update();
      link.update(input, collision, screen);
    }
    expect(sawVisible).toBe(true);
    expect(sawInvisible).toBe(true);
  });

  it('allows input during Invincible state (after knockback)', () => {
    const link = new Link(80, 80);
    const { input, target } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);

    // Complete knockback
    const knockbackFrames = LINK_KNOCKBACK_DISTANCE / LINK_KNOCKBACK_SPEED;
    tickFrames(link, input, collision, screen, knockbackFrames);
    expect(link.state).toBe(LinkState.Invincible);

    const posBeforeInput = link.posX;
    // Hold left for a few frames
    target.dispatchKeyDown('ArrowLeft');
    tickFrames(link, input, collision, screen, 4);

    // Link should have moved left (input works during invincibility)
    expect(link.posX).toBeLessThan(posBeforeInput);
  });

  it('returns to Normal after full invincibility duration', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);

    // Total invincibility = TICKS * 2 frames/tick = 48 frames
    // Some consumed during knockback (8 frames of knockback)
    tickFrames(link, input, collision, screen, LINK_INVINCIBILITY_TICKS * 2);

    expect(link.isInvincible).toBe(false);
    expect(link.state).toBe(LinkState.Normal);
  });
});

// --- isIdle integration ---

describe('isIdle with damage states', () => {
  it('returns false during Knockback', () => {
    const link = new Link(80, 80);
    link.takeDamage(0x80, Direction.Left);
    expect(link.isIdle).toBe(false);
  });

  it('returns false during Invincible state (even without sword)', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);

    const knockbackFrames = LINK_KNOCKBACK_DISTANCE / LINK_KNOCKBACK_SPEED;
    tickFrames(link, input, collision, screen, knockbackFrames);

    expect(link.state).toBe(LinkState.Invincible);
    expect(link.isIdle).toBe(false);
  });

  it('returns true after invincibility expires', () => {
    const link = new Link(80, 80);
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    link.takeDamage(0x80, Direction.Left);
    tickFrames(link, input, collision, screen, LINK_INVINCIBILITY_TICKS * 2);

    expect(link.isIdle).toBe(true);
  });
});

// --- isVisible ---

describe('isVisible', () => {
  it('returns true when not invincible', () => {
    const link = new Link(80, 80);
    expect(link.isVisible).toBe(true);
  });

  it('toggles based on invincibility timer', () => {
    const link = new Link(80, 80);
    link.takeDamage(0x80, Direction.Left);

    // Timer starts at 24. (24 & 0x03) = 0 → visible is (0 >= 2) = false
    // But we should see both states across several ticks
    const visibilityStates: boolean[] = [];
    const { input } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    for (let i = 0; i < 8; i++) {
      visibilityStates.push(link.isVisible);
      input.update();
      link.update(input, collision, screen);
    }

    expect(visibilityStates.includes(true)).toBe(true);
    expect(visibilityStates.includes(false)).toBe(true);
  });
});

// --- SwordSwing.cancel ---

describe('SwordSwing.cancel', () => {
  it('is tested through Link.takeDamage cancelling active sword', () => {
    const link = new Link(80, 80);
    link.setHasSword(true);
    const { input, target } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    target.dispatchKeyDown('KeyX');
    input.update();
    link.update(input, collision, screen);
    expect(link.isSwordActive).toBe(true);

    link.takeDamage(0x80, Direction.Left);
    expect(link.isSwordActive).toBe(false);
  });
});

// --- Sword beam health gate ---

describe('sword beam health interaction', () => {
  it('sword beam does not fire when health is not full', () => {
    const link = new Link(80, 80);
    link.setHasSword(true);
    const { input, target } = createInput();
    const collision = createCollisionMap(ALL_WALKABLE_METATILES);
    const screen = allWalkableScreen();

    // Take damage first to reduce health
    link.takeDamage(0x80, Direction.Left); // health → 5

    // Run through invincibility
    tickFrames(link, input, collision, screen, LINK_INVINCIBILITY_TICKS * 2);

    // Now try to swing sword
    target.dispatchKeyDown('KeyX');
    input.update();
    link.update(input, collision, screen);
    expect(link.isSwordActive).toBe(true);

    // Run through full sword swing (5 windup + 8 extended = 13 frames for beam check)
    target.dispatchKeyUp('KeyX');
    for (let i = 0; i < 13; i++) {
      input.update();
      link.update(input, collision, screen);
    }

    // No beam should have fired since health < maxHealth
    expect(link.activeSwordBeam).toBeNull();
  });
});
