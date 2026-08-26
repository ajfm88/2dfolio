import { describe, it, expect, vi } from 'vitest';
import { DeathAnimation, DeathPhase } from '../../src/death/death-animation.js';
import { GameOverScreen, GameOverOption } from '../../src/death/game-over-screen.js';
import { computeRespawnParams } from '../../src/death/respawn.js';
import { Link, LinkState } from '../../src/objects/player/link.js';
import { Direction } from '../../src/core/types.js';
import { InputManager, type EventTarget as InputEventTarget } from '../../src/core/input.js';
import {
  DEATH_FLASH_FRAMES,
  DEATH_SPIN_FRAMES_PER_DIR,
  DEATH_SPIN_ROTATIONS,
  DEATH_SPIN_TOTAL_FRAMES,
  DEATH_FADE_STEPS,
  DEATH_FADE_FRAMES_PER_STEP,
  DEATH_GREY_PAUSE_FRAMES,
  DEATH_SPARK_SMALL_FRAMES,
  DEATH_SPARK_BIG_FRAMES,
  DEATH_BLANK_PAUSE_FRAMES,
  DEATH_GAME_OVER_TEXT_FRAMES,
  GAME_OVER_CONFIRM_FLASH_FRAMES,
  LINK_START_Y,
  RESPAWN_SCREEN_ROW,
  RESPAWN_SCREEN_COL,
  RESPAWN_LINK_X,
  RESPAWN_HEALTH,
} from '../../src/core/constants.js';

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

function createInput(): { input: InputManager; target: MockEventTarget } {
  const target = createMockEventTarget();
  const input = new InputManager();
  input.attach(target);
  return { input, target };
}

function advanceFrames(anim: DeathAnimation, n: number): void {
  for (let i = 0; i < n; i++) anim.update();
}

// --- DeathAnimation tests ---

describe('DeathAnimation', () => {
  describe('phase transitions', () => {
    it('starts in Flash phase', () => {
      const anim = new DeathAnimation(100, 80);
      expect(anim.phase).toBe(DeathPhase.Flash);
      expect(anim.isDone).toBe(false);
    });

    it('transitions from Flash to Spin after 33 frames', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES - 1);
      expect(anim.phase).toBe(DeathPhase.Flash);
      anim.update();
      expect(anim.phase).toBe(DeathPhase.Spin);
    });

    it('transitions from Spin to PaletteFade after 80 frames', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES);
      expect(anim.phase).toBe(DeathPhase.Spin);
      advanceFrames(anim, DEATH_SPIN_TOTAL_FRAMES - 1);
      expect(anim.phase).toBe(DeathPhase.Spin);
      anim.update();
      expect(anim.phase).toBe(DeathPhase.PaletteFade);
    });

    it('transitions from PaletteFade to GreyPause after 40 frames', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES + DEATH_SPIN_TOTAL_FRAMES);
      expect(anim.phase).toBe(DeathPhase.PaletteFade);
      advanceFrames(anim, DEATH_FADE_STEPS * DEATH_FADE_FRAMES_PER_STEP);
      expect(anim.phase).toBe(DeathPhase.GreyPause);
    });

    it('transitions from GreyPause to Spark after 24 frames', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES + DEATH_SPIN_TOTAL_FRAMES +
        DEATH_FADE_STEPS * DEATH_FADE_FRAMES_PER_STEP);
      expect(anim.phase).toBe(DeathPhase.GreyPause);
      advanceFrames(anim, DEATH_GREY_PAUSE_FRAMES);
      expect(anim.phase).toBe(DeathPhase.Spark);
    });

    it('transitions from Spark to BlankPause after 15 frames', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES + DEATH_SPIN_TOTAL_FRAMES +
        DEATH_FADE_STEPS * DEATH_FADE_FRAMES_PER_STEP +
        DEATH_GREY_PAUSE_FRAMES);
      expect(anim.phase).toBe(DeathPhase.Spark);
      advanceFrames(anim, DEATH_SPARK_SMALL_FRAMES + DEATH_SPARK_BIG_FRAMES);
      expect(anim.phase).toBe(DeathPhase.BlankPause);
    });

    it('transitions from BlankPause to GameOverText after 46 frames', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES + DEATH_SPIN_TOTAL_FRAMES +
        DEATH_FADE_STEPS * DEATH_FADE_FRAMES_PER_STEP +
        DEATH_GREY_PAUSE_FRAMES +
        DEATH_SPARK_SMALL_FRAMES + DEATH_SPARK_BIG_FRAMES);
      expect(anim.phase).toBe(DeathPhase.BlankPause);
      advanceFrames(anim, DEATH_BLANK_PAUSE_FRAMES);
      expect(anim.phase).toBe(DeathPhase.GameOverText);
    });

    it('transitions from GameOverText to Done after 96 frames', () => {
      const anim = new DeathAnimation(100, 80);
      const totalBeforeText = DEATH_FLASH_FRAMES + DEATH_SPIN_TOTAL_FRAMES +
        DEATH_FADE_STEPS * DEATH_FADE_FRAMES_PER_STEP +
        DEATH_GREY_PAUSE_FRAMES +
        DEATH_SPARK_SMALL_FRAMES + DEATH_SPARK_BIG_FRAMES +
        DEATH_BLANK_PAUSE_FRAMES;
      advanceFrames(anim, totalBeforeText);
      expect(anim.phase).toBe(DeathPhase.GameOverText);
      advanceFrames(anim, DEATH_GAME_OVER_TEXT_FRAMES);
      expect(anim.phase).toBe(DeathPhase.Done);
      expect(anim.isDone).toBe(true);
    });

    it('total animation is about 334 frames', () => {
      const expected = DEATH_FLASH_FRAMES + DEATH_SPIN_TOTAL_FRAMES +
        DEATH_FADE_STEPS * DEATH_FADE_FRAMES_PER_STEP +
        DEATH_GREY_PAUSE_FRAMES +
        DEATH_SPARK_SMALL_FRAMES + DEATH_SPARK_BIG_FRAMES +
        DEATH_BLANK_PAUSE_FRAMES +
        DEATH_GAME_OVER_TEXT_FRAMES;
      expect(expected).toBe(334);

      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, expected);
      expect(anim.isDone).toBe(true);
    });
  });

  describe('spin behavior', () => {
    it('follows direction sequence Down→Right→Up→Left', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES);
      expect(anim.phase).toBe(DeathPhase.Spin);

      expect(anim.currentDirection).toBe(Direction.Down);
      advanceFrames(anim, DEATH_SPIN_FRAMES_PER_DIR);
      expect(anim.currentDirection).toBe(Direction.Right);
      advanceFrames(anim, DEATH_SPIN_FRAMES_PER_DIR);
      expect(anim.currentDirection).toBe(Direction.Up);
      advanceFrames(anim, DEATH_SPIN_FRAMES_PER_DIR);
      expect(anim.currentDirection).toBe(Direction.Left);
    });

    it('holds each direction for 5 frames', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES);

      for (let i = 0; i < DEATH_SPIN_FRAMES_PER_DIR - 1; i++) {
        expect(anim.currentDirection).toBe(Direction.Down);
        anim.update();
      }
      expect(anim.currentDirection).toBe(Direction.Down);
      anim.update();
      expect(anim.currentDirection).toBe(Direction.Right);
    });

    it('completes 4 full rotations', () => {
      const anim = new DeathAnimation(100, 80);
      advanceFrames(anim, DEATH_FLASH_FRAMES);

      const framesPerRotation = DEATH_SPIN_FRAMES_PER_DIR * 4;
      for (let r = 0; r < DEATH_SPIN_ROTATIONS - 1; r++) {
        advanceFrames(anim, framesPerRotation);
        expect(anim.phase).toBe(DeathPhase.Spin);
      }
      advanceFrames(anim, framesPerRotation);
      expect(anim.phase).toBe(DeathPhase.PaletteFade);
    });

    it('total spin is 80 frames', () => {
      expect(DEATH_SPIN_TOTAL_FRAMES).toBe(80);
    });
  });
});

// --- GameOverScreen tests ---

describe('GameOverScreen', () => {
  describe('cursor navigation', () => {
    it('starts with Continue selected', () => {
      const screen = new GameOverScreen();
      expect(screen.selectedOption).toBe(GameOverOption.Continue);
      expect(screen.done).toBe(false);
    });

    it('Select cycles through options', () => {
      const { input, target } = createInput();
      const screen = new GameOverScreen();

      target.dispatchKeyDown('ShiftLeft');
      input.update();
      screen.update(input);
      expect(screen.selectedOption).toBe(GameOverOption.Save);

      target.dispatchKeyUp('ShiftLeft');
      input.update();
      target.dispatchKeyDown('ShiftLeft');
      input.update();
      screen.update(input);
      expect(screen.selectedOption).toBe(GameOverOption.Retry);
    });

    it('Select wraps from Retry back to Continue', () => {
      const { input, target } = createInput();
      const screen = new GameOverScreen();

      // Cycle to Retry
      target.dispatchKeyDown('ShiftLeft');
      input.update();
      screen.update(input);
      target.dispatchKeyUp('ShiftLeft');
      input.update();
      target.dispatchKeyDown('ShiftLeft');
      input.update();
      screen.update(input);
      expect(screen.selectedOption).toBe(GameOverOption.Retry);

      // Wrap to Continue
      target.dispatchKeyUp('ShiftLeft');
      input.update();
      target.dispatchKeyDown('ShiftLeft');
      input.update();
      screen.update(input);
      expect(screen.selectedOption).toBe(GameOverOption.Continue);
    });
  });

  describe('confirmation', () => {
    it('Start begins confirm flash', () => {
      const { input, target } = createInput();
      const screen = new GameOverScreen();

      target.dispatchKeyDown('Enter');
      input.update();
      screen.update(input);
      expect(screen.isConfirmed).toBe(true);
      expect(screen.done).toBe(false);
    });

    it('is not done during flash', () => {
      const { input, target } = createInput();
      const screen = new GameOverScreen();

      target.dispatchKeyDown('Enter');
      input.update();
      screen.update(input);

      target.dispatchKeyUp('Enter');
      for (let i = 0; i < GAME_OVER_CONFIRM_FLASH_FRAMES - 2; i++) {
        input.update();
        screen.update(input);
      }
      expect(screen.done).toBe(false);
    });

    it('is done after 64 flash frames', () => {
      const { input, target } = createInput();
      const screen = new GameOverScreen();

      // Press Start → _confirmed = true, _flashTimer = 0 (no increment this frame)
      target.dispatchKeyDown('Enter');
      input.update();
      screen.update(input);
      target.dispatchKeyUp('Enter');

      // 64 more updates: each increments flashTimer (1..64)
      for (let i = 0; i < GAME_OVER_CONFIRM_FLASH_FRAMES - 1; i++) {
        input.update();
        screen.update(input);
        expect(screen.done).toBe(false);
      }
      input.update();
      screen.update(input);
      expect(screen.done).toBe(true);
    });

    it('result reflects selected option', () => {
      const { input, target } = createInput();
      const screen = new GameOverScreen();

      // Select Save
      target.dispatchKeyDown('ShiftLeft');
      input.update();
      screen.update(input);
      target.dispatchKeyUp('ShiftLeft');

      // Confirm
      target.dispatchKeyDown('Enter');
      input.update();
      screen.update(input);

      expect(screen.selectedOption).toBe(GameOverOption.Save);
    });

    it('ignores Select during confirm flash', () => {
      const { input, target } = createInput();
      const screen = new GameOverScreen();

      target.dispatchKeyDown('Enter');
      input.update();
      screen.update(input);
      target.dispatchKeyUp('Enter');

      target.dispatchKeyDown('ShiftLeft');
      input.update();
      screen.update(input);

      expect(screen.selectedOption).toBe(GameOverOption.Continue);
    });
  });
});

// --- Respawn tests ---

describe('computeRespawnParams', () => {
  it('returns screen (7,7) for overworld', () => {
    const params = computeRespawnParams(0);
    expect(params.screenRow).toBe(RESPAWN_SCREEN_ROW);
    expect(params.screenCol).toBe(RESPAWN_SCREEN_COL);
    expect(params.screenRow).toBe(7);
    expect(params.screenCol).toBe(7);
  });

  it('returns X=120, Y=LINK_START_Y for overworld', () => {
    const params = computeRespawnParams(0);
    expect(params.linkX).toBe(RESPAWN_LINK_X);
    expect(params.linkX).toBe(120);
    expect(params.linkY).toBe(LINK_START_Y);
  });

  it('returns Direction.Up', () => {
    const params = computeRespawnParams(0);
    expect(params.linkDirection).toBe(Direction.Up);
  });

  it('returns 6 half-hearts of health (3 full hearts)', () => {
    const params = computeRespawnParams(0);
    expect(params.health).toBe(RESPAWN_HEALTH);
    expect(params.health).toBe(6);
  });

  it('returns dungeon respawn params for dungeon level', () => {
    const params = computeRespawnParams(3);
    expect(params.isDungeon).toBe(true);
    expect(params.health).toBe(RESPAWN_HEALTH);
  });
});

// --- Link.reset tests ---

describe('Link.reset', () => {
  it('sets position, direction, and health', () => {
    const link = new Link(50, 50);
    link.reset(120, 80, Direction.Up, 6);
    expect(link.posX).toBe(120);
    expect(link.posY).toBe(80);
    expect(link.facing).toBe(Direction.Up);
    expect(link.health).toBe(6);
  });

  it('clears isDead flag', () => {
    const link = new Link();
    link.takeDamage(0xFF, Direction.Left);
    expect(link.isDead).toBe(true);
    link.reset(120, 80, Direction.Up, 6);
    expect(link.isDead).toBe(false);
  });

  it('sets state to Normal', () => {
    const link = new Link();
    link.takeDamage(0x10, Direction.Left);
    expect(link.state).not.toBe(LinkState.Normal);
    link.reset(120, 80, Direction.Up, 6);
    expect(link.state).toBe(LinkState.Normal);
  });

  it('clears invincibility', () => {
    const link = new Link();
    link.takeDamage(0x10, Direction.Left);
    expect(link.isInvincible).toBe(true);
    link.reset(120, 80, Direction.Up, 6);
    expect(link.isInvincible).toBe(false);
  });

  it('clears sword beam', () => {
    const link = new Link();
    link.reset(120, 80, Direction.Up, 6);
    expect(link.activeSwordBeam).toBeNull();
  });
});

// --- Death trigger tests ---

describe('death trigger', () => {
  it('Link.isDead is true when health reaches 0', () => {
    const link = new Link();
    expect(link.isDead).toBe(false);
    link.takeDamage(0xFF, Direction.Left);
    expect(link.isDead).toBe(true);
    expect(link.health).toBe(0);
  });

  it('Link.isDead persists across update calls', () => {
    const link = new Link();
    link.takeDamage(0xFF, Direction.Left);
    expect(link.isDead).toBe(true);

    const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
    const screen = { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
    const { input } = createInput();

    for (let i = 0; i < 100; i++) {
      input.update();
      link.update(input, { isPositionWalkable: () => true, isRectWalkable: () => true } as unknown as import('../../src/world/collision.js').TileCollisionMap, screen);
    }
    expect(link.isDead).toBe(true);
  });
});
