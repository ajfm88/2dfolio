// Enemy collision — Z_01.asm:5475 CheckMonsterCollisions
// Checks all of Link's weapons against active enemies each frame.
// Also checks enemy projectiles against Link.

import {
  ARROW_DAMAGE,
  BOMB_DAMAGE,
  BOOMERANG_DAMAGE,
  DamageTypeBit,
  FIRE_DAMAGE,
  MAGIC_SHOT_DAMAGE,
  SILVER_ARROW_DAMAGE,
  SWORD_DAMAGE
} from '../../core/constants.js';
import { rectsOverlap } from '../../core/collision-utils.js';
import { Direction } from '../../core/types.js';

import { canShieldBlock } from '../player/shield.js';

export function checkWeaponEnemyCollisions(
  enemies,
  weapons,
) {
  const results = [];

  for (const enemy of enemies) {
    if (!enemy.isActive || enemy.isSpawning) continue;
    if (!enemy.vulnerable) continue;

    const enemyRect = enemy.getHitbox();

    if (weapons.swordHitbox) {
      if (rectsOverlap(enemyRect, weapons.swordHitbox)) {
        // Darknut parries a hit on the axis it faces.
        if (enemy.blocksAttackFrom(weapons.swordDirection)) {
          results.push({ enemy, killed: false });
          continue;
        }
        // Boss immune to sword (mask): a harmless clink, no damage.
        if (enemy.isImmuneToDamageType(DamageTypeBit.Sword)) {
          results.push({ enemy, killed: false });
          continue;
        }
        const damage = SWORD_DAMAGE[weapons.swordLevel] ?? 0x10;
        const killed = enemy.takeDamage(damage, weapons.swordDirection);
        results.push({ enemy, killed });
        continue;
      }
    }

    if (weapons.swordBeam && weapons.swordBeam.isActive()) {
      const beamRect = weapons.swordBeam.getHitbox();
      if (rectsOverlap(enemyRect, beamRect)) {
        if (enemy.blocksAttackFrom(weapons.swordBeam.direction)) {
          weapons.swordBeam.deactivate();
          results.push({ enemy, killed: false });
          continue;
        }
        if (enemy.isImmuneToDamageType(DamageTypeBit.Sword)) {
          weapons.swordBeam.deactivate();
          results.push({ enemy, killed: false });
          continue;
        }
        const damage = SWORD_DAMAGE[weapons.swordLevel] ?? 0x10;
        const dir = weapons.swordBeam.direction;
        const killed = enemy.takeDamage(damage, dir);
        weapons.swordBeam.deactivate();
        results.push({ enemy, killed });
        continue;
      }
    }

    if (weapons.boomerang && weapons.boomerang.isActive) {
      const boomRect = weapons.boomerang.getHitbox();
      if (rectsOverlap(enemyRect, boomRect)) {
        weapons.boomerang.forceReturn();
        // Boss immune to boomerang (mask): it bounces off, no stun or damage.
        if (enemy.isImmuneToDamageType(DamageTypeBit.Boomerang)) {
          results.push({ enemy, killed: false });
          continue;
        }
        if (weapons.hasMagicBoomerang) {
          const killed = enemy.takeDamage(BOOMERANG_DAMAGE, Direction.Down);
          results.push({ enemy, killed });
        } else {
          enemy.stun();
        }
        continue;
      }
    }

    for (const bomb of weapons.bombs) {
      const explosionRect = bomb.getExplosionHitbox();
      if (explosionRect && rectsOverlap(enemyRect, explosionRect)) {
        if (enemy.isImmuneToDamageType(DamageTypeBit.Bomb)) break;
        const killed = enemy.takeDamage(BOMB_DAMAGE, Direction.Down);
        results.push({ enemy, killed });
        break;
      }
    }
    if (enemy.isDying || enemy.isDead) continue;

    if (weapons.arrow && weapons.arrow.isActive) {
      const arrowRect = weapons.arrow.getHitbox();
      if (rectsOverlap(enemyRect, arrowRect)) {
        if (enemy.isImmuneToDamageType(DamageTypeBit.Arrow)) {
          weapons.arrow.deactivate();
          results.push({ enemy, killed: false });
          continue;
        }
        const damage = weapons.arrow.isSilver ? SILVER_ARROW_DAMAGE : ARROW_DAMAGE;
        const dir = weapons.arrow.direction;
        const hitCtx = { x: weapons.arrow.x, y: weapons.arrow.y, dir };
        const killed = enemy.takeDamage(damage, dir, hitCtx);
        weapons.arrow.deactivate();
        results.push({ enemy, killed });
        continue;
      }
    }

    if (weapons.magicRod && weapons.magicRod.isActive()) {
      const rodRect = weapons.magicRod.getHitbox(weapons.linkX, weapons.linkY);
      if (rodRect && rectsOverlap(enemyRect, rodRect)) {
        // Rod's melee stab uses the sword damage type.
        if (enemy.isImmuneToDamageType(DamageTypeBit.Sword)) {
          results.push({ enemy, killed: false });
          continue;
        }
        const killed = enemy.takeDamage(MAGIC_SHOT_DAMAGE, weapons.magicRod.direction);
        results.push({ enemy, killed });
        continue;
      }
    }

    if (weapons.magicShot && weapons.magicShot.isActive) {
      const shotRect = weapons.magicShot.getHitbox();
      if (rectsOverlap(enemyRect, shotRect)) {
        if (enemy.isImmuneToDamageType(DamageTypeBit.MagicShot)) {
          weapons.magicShot.deactivate();
          results.push({ enemy, killed: false });
          continue;
        }
        const killed = enemy.takeDamage(MAGIC_SHOT_DAMAGE, weapons.magicShot.direction);
        weapons.magicShot.deactivate();
        results.push({ enemy, killed });
        continue;
      }
    }

    for (const fire of weapons.fires) {
      if (!fire.isActive) continue;
      const fireRect = fire.getHitbox();
      if (rectsOverlap(enemyRect, fireRect)) {
        if (enemy.isImmuneToDamageType(DamageTypeBit.Fire)) break;
        const killed = enemy.takeDamage(FIRE_DAMAGE, fire.direction);
        results.push({ enemy, killed });
        break;
      }
    }
  }

  return results;
}

export function checkEnemyLinkCollisions(
  enemies,
  linkRect,
) {
  for (const enemy of enemies) {
    if (!enemy.isActive || enemy.isSpawning || enemy.isDying) continue;
    if (rectsOverlap(enemy.getHitbox(), linkRect)) {
      return enemy;
    }
  }
  return null;
}

// Check enemy projectiles against Link, handling shield deflection

export function checkEnemyProjectileCollisions(
  projectiles,
  linkRect,
  linkDirection,
  linkIsIdle,
  hasMagicShield,
) {
  for (const proj of projectiles) {
    if (!proj.isFlying()) continue;
    if (rectsOverlap(proj.getHitbox(), linkRect)) {
      if (canShieldBlock(linkDirection, proj.direction, proj.type, hasMagicShield, linkIsIdle)) {
        proj.deflect(linkDirection);
        return { projectile: proj, blocked: true };
      }
      return { projectile: proj, blocked: false };
    }
  }
  return null;
}
