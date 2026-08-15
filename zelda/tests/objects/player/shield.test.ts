import { describe, it, expect } from 'vitest';
import { canShieldBlock, ProjectileType } from '../../../src/objects/player/shield.js';
import { Direction } from '../../../src/core/types.js';

describe('canShieldBlock', () => {
  // Helper: default args for a blockable scenario
  const block = (overrides: {
    linkDir?: Direction;
    projDir?: Direction;
    projType?: ProjectileType;
    hasMagicShield?: boolean;
    linkIsIdle?: boolean;
  } = {}) =>
    canShieldBlock(
      overrides.linkDir ?? Direction.Right,
      overrides.projDir ?? Direction.Left,
      overrides.projType ?? ProjectileType.Rock,
      overrides.hasMagicShield ?? false,
      overrides.linkIsIdle ?? true,
    );

  describe('direction check', () => {
    it('blocks when Link faces opposite to projectile direction', () => {
      expect(block({ linkDir: Direction.Right, projDir: Direction.Left })).toBe(true);
      expect(block({ linkDir: Direction.Left, projDir: Direction.Right })).toBe(true);
      expect(block({ linkDir: Direction.Up, projDir: Direction.Down })).toBe(true);
      expect(block({ linkDir: Direction.Down, projDir: Direction.Up })).toBe(true);
    });

    it('does not block when Link faces same direction as projectile', () => {
      expect(block({ linkDir: Direction.Right, projDir: Direction.Right })).toBe(false);
      expect(block({ linkDir: Direction.Left, projDir: Direction.Left })).toBe(false);
    });

    it('does not block when Link faces perpendicular to projectile', () => {
      expect(block({ linkDir: Direction.Up, projDir: Direction.Left })).toBe(false);
      expect(block({ linkDir: Direction.Down, projDir: Direction.Right })).toBe(false);
    });
  });

  describe('idle check', () => {
    it('blocks when Link is idle', () => {
      expect(block({ linkIsIdle: true })).toBe(true);
    });

    it('does not block when Link is not idle (sword active)', () => {
      expect(block({ linkIsIdle: false })).toBe(false);
    });
  });

  describe('small shield (no magic shield)', () => {
    it('blocks Rock (0x53)', () => {
      expect(block({ projType: ProjectileType.Rock })).toBe(true);
    });

    it('blocks RockVariant (0x54)', () => {
      expect(block({ projType: ProjectileType.RockVariant })).toBe(true);
    });

    it('blocks Arrow (0x5B)', () => {
      expect(block({ projType: ProjectileType.Arrow })).toBe(true);
    });

    it('blocks EnemyBoomerang (0x5C)', () => {
      expect(block({ projType: ProjectileType.EnemyBoomerang })).toBe(true);
    });

    it('does NOT block Fireball (0x55) — requires magic shield', () => {
      expect(block({ projType: ProjectileType.Fireball })).toBe(false);
    });

    it('does NOT block SwordShot (0x57) — requires magic shield', () => {
      expect(block({ projType: ProjectileType.SwordShot })).toBe(false);
    });

    it('does NOT block MagicShot (0x58) — requires magic shield', () => {
      expect(block({ projType: ProjectileType.MagicShot })).toBe(false);
    });

    it('does NOT block MagicShot2 (0x59) — requires magic shield', () => {
      expect(block({ projType: ProjectileType.MagicShot2 })).toBe(false);
    });
  });

  describe('magic shield', () => {
    it('blocks Fireball (0x55)', () => {
      expect(block({ projType: ProjectileType.Fireball, hasMagicShield: true })).toBe(true);
    });

    it('blocks SwordShot (0x57)', () => {
      expect(block({ projType: ProjectileType.SwordShot, hasMagicShield: true })).toBe(true);
    });

    it('blocks MagicShot (0x58)', () => {
      expect(block({ projType: ProjectileType.MagicShot, hasMagicShield: true })).toBe(true);
    });

    it('blocks MagicShot2 (0x59)', () => {
      expect(block({ projType: ProjectileType.MagicShot2, hasMagicShield: true })).toBe(true);
    });

    it('still blocks Rock with magic shield', () => {
      expect(block({ projType: ProjectileType.Rock, hasMagicShield: true })).toBe(true);
    });
  });

  describe('unblockable projectiles', () => {
    it('Fireball2Unblockable (0x56) is never blocked', () => {
      expect(block({ projType: ProjectileType.Fireball2Unblockable, hasMagicShield: true })).toBe(false);
    });

    it('UnblockableShot (0x5A) is never blocked', () => {
      expect(block({ projType: ProjectileType.UnblockableShot, hasMagicShield: true })).toBe(false);
    });
  });
});
