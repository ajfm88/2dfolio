import { describe, it, expect } from 'vitest';
import {
  EnemyProjectile,
  ProjectileState,
} from '../../../src/objects/projectiles/enemy-projectile.js';
import { ProjectileType, canShieldBlock } from '../../../src/objects/player/shield.js';
import { checkEnemyProjectileCollisions } from '../../../src/objects/enemies/enemy-collision.js';
import { DAMAGE_TABLE } from '../../../src/core/damage-tables.js';
import { Direction, type Rect } from '../../../src/core/types.js';

// G5 projectile roster/system audit. Every shot type an enemy can fire must:
//   1. have a damage-table entry (never silently 0),
//   2. obey the shield-block rules (wood vs magic vs unblockable),
//   3. collide with Link identically regardless of which loop drives it.

const ALL_TYPES: ProjectileType[] = [
  ProjectileType.Rock,
  ProjectileType.RockVariant,
  ProjectileType.Fireball,
  ProjectileType.Fireball2Unblockable,
  ProjectileType.SwordShot,
  ProjectileType.MagicShot,
  ProjectileType.MagicShot2,
  ProjectileType.UnblockableShot,
  ProjectileType.Arrow,
  ProjectileType.EnemyBoomerang,
];

describe('projectile damage-table coverage', () => {
  it('every projectile type has a non-zero damage entry', () => {
    for (const t of ALL_TYPES) {
      expect(DAMAGE_TABLE[t], `type 0x${t.toString(16)}`).toBeGreaterThan(0);
    }
  });
});

describe('shield-block rules', () => {
  // Link faces Right; a shot travelling Left is coming head-on.
  const facing = Direction.Right;
  const incoming = Direction.Left;

  it('wooden shield blocks rocks/arrows/boomerangs when idle + facing', () => {
    for (const t of [ProjectileType.Rock, ProjectileType.Arrow, ProjectileType.EnemyBoomerang]) {
      expect(canShieldBlock(facing, incoming, t, false, true)).toBe(true);
    }
  });

  it('wooden shield does NOT block magic-range shots (fireball/magic/sword)', () => {
    for (const t of [ProjectileType.Fireball, ProjectileType.MagicShot, ProjectileType.SwordShot]) {
      expect(canShieldBlock(facing, incoming, t, false, true)).toBe(false);
    }
  });

  it('magic shield blocks the magic-range shots', () => {
    for (const t of [ProjectileType.Fireball, ProjectileType.MagicShot, ProjectileType.MagicShot2]) {
      expect(canShieldBlock(facing, incoming, t, true, true)).toBe(true);
    }
  });

  it('unblockable shots are never blocked, even with the magic shield', () => {
    for (const t of [ProjectileType.Fireball2Unblockable, ProjectileType.UnblockableShot]) {
      expect(canShieldBlock(facing, incoming, t, true, true)).toBe(false);
    }
  });

  it('nothing blocks while Link is not idle, or when facing the wrong way', () => {
    expect(canShieldBlock(facing, incoming, ProjectileType.Rock, true, false)).toBe(false);
    expect(canShieldBlock(Direction.Up, incoming, ProjectileType.Rock, true, true)).toBe(false);
  });
});

describe('checkEnemyProjectileCollisions parity', () => {
  const linkRect: Rect = { x: 100, y: 100, width: 8, height: 8 };

  it('deflects a blockable shot when Link is idle + facing it', () => {
    const rock = new EnemyProjectile(100, 100, Direction.Left, ProjectileType.Rock);
    const hit = checkEnemyProjectileCollisions([rock], linkRect, Direction.Right, true, false);
    expect(hit?.blocked).toBe(true);
    expect(rock.state).toBe(ProjectileState.Deflected);
  });

  it('lands a magic shot when Link lacks the magic shield', () => {
    const magic = new EnemyProjectile(100, 100, Direction.Left, ProjectileType.MagicShot);
    const hit = checkEnemyProjectileCollisions([magic], linkRect, Direction.Right, true, false);
    expect(hit?.blocked).toBe(false);
  });

  it('blocks that same magic shot once Link has the magic shield', () => {
    const magic = new EnemyProjectile(100, 100, Direction.Left, ProjectileType.MagicShot);
    const hit = checkEnemyProjectileCollisions([magic], linkRect, Direction.Right, true, true);
    expect(hit?.blocked).toBe(true);
  });

  it('bounces a deflected shot back toward the shooter, not into Link', () => {
    // Shot is to Link's right, travelling Left into him; Link faces Right to block.
    const rock = new EnemyProjectile(100, 100, Direction.Left, ProjectileType.Rock);
    checkEnemyProjectileCollisions([rock], linkRect, Direction.Right, true, false);
    const startX = rock.x;
    for (let i = 0; i < 4; i++) rock.update();
    // Must travel Right (away from Link, back toward the enemy), i.e. x increases.
    expect(rock.x).toBeGreaterThan(startX);
  });

  it('reports no hit when the projectile misses Link', () => {
    const rock = new EnemyProjectile(10, 10, Direction.Left, ProjectileType.Rock);
    const hit = checkEnemyProjectileCollisions([rock], linkRect, Direction.Right, true, false);
    expect(hit).toBeNull();
  });
});

describe('EnemyProjectile movement', () => {
  it('travels in its cardinal direction and dies off-screen', () => {
    const p = new EnemyProjectile(120, 80, Direction.Up, ProjectileType.Fireball);
    const startY = p.y;
    p.update();
    expect(p.y).toBeLessThan(startY);
    for (let i = 0; i < 200 && p.isActive(); i++) p.update();
    expect(p.isActive()).toBe(false);
  });

  it('applies vertical drift for a fanning shot (Aquamentus fan primitive)', () => {
    // Two shots from the same spot, drifting down (+1) and up (-1), plus one with
    // no drift (default) — after flight the drifters separate, the default stays level.
    const down = new EnemyProjectile(120, 80, Direction.Left, ProjectileType.Fireball, 1);
    const up = new EnemyProjectile(120, 80, Direction.Left, ProjectileType.Fireball, -1);
    const level = new EnemyProjectile(120, 80, Direction.Left, ProjectileType.Fireball);
    for (let i = 0; i < 20; i++) { down.update(); up.update(); level.update(); }
    expect(down.y).toBeGreaterThan(80);
    expect(up.y).toBeLessThan(80);
    expect(level.y).toBe(80); // default drift 0 — regression guard
    // All still travelled left.
    for (const s of [down, up, level]) expect(s.x).toBeLessThan(120);
  });
});
