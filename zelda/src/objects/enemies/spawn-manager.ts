// SpawnManager — reads enemy-spawns.json, places enemies on screen entry, manages lifecycle
// Z_05.asm:1413 SpawnPosList + Z_07.asm:5493 InitObject

import {
  MAX_ENEMY_SLOTS,
  SPAWN_CLOUD_FRAMES,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { EnemySpawnData } from '../../data/enemy-spawn-types.js';
import type { OverworldScreen } from '../../data/overworld-types.js';
import type { TileCollisionMap } from '../../world/collision.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import type { EnemyProjectile } from '../projectiles/enemy-projectile.js';
import { Enemy, type EnemyUpdateContext, getEnemyHp } from './enemy.js';
import { createOctorok } from './octorok.js';
import { createMoblin } from './moblin.js';
import { createLynel } from './lynel.js';
import { Tektite } from './tektite.js';
import { Leever } from './leever.js';
import { Zora } from './zora.js';
import { Peahat } from './peahat.js';
import { Ghini, FlyingGhini } from './ghini.js';
import { Armos } from './armos.js';
import { createStalfos } from './stalfos.js';
import { Rope } from './rope.js';
import { Goriya } from './goriya.js';
import { Zol } from './zol.js';
import { Gel } from './gel.js';
import { Keese } from './keese.js';
import { createGibdo } from './gibdo.js';
import { Darknut } from './darknut.js';
import { Vire } from './vire.js';
import { PolsVoice } from './pols-voice.js';
import { Bubble } from './bubble.js';
import { BlueWizzrobe, RedWizzrobe } from './wizzrobe.js';
import { LikeLike } from './like-like.js';
import { Wallmaster } from './wallmaster.js';
import { Lanmola } from './lanmola.js';

export class SpawnManager {
  private _enemies: Enemy[] = [];
  private _projectiles: EnemyProjectile[] = [];
  private readonly _spawnData: EnemySpawnData;
  private readonly _hpPairs: readonly number[];
  private _frozen = false;
  private _frozenTimer = 0;

  constructor(spawnData: EnemySpawnData, hpPairs: readonly number[]) {
    this._spawnData = spawnData;
    this._hpPairs = hpPairs;
  }

  get enemies(): readonly Enemy[] {
    return this._enemies;
  }

  get activeEnemies(): Enemy[] {
    return this._enemies.filter(e => !e.isDead);
  }

  get projectiles(): readonly EnemyProjectile[] {
    return this._projectiles;
  }

  get frozen(): boolean {
    return this._frozen;
  }

  freezeAll(frames: number): void {
    this._frozen = true;
    this._frozenTimer = frames;
  }

  spawnForScreen(screen: OverworldScreen, entryDirection: Direction): void {
    this._enemies = [];
    this._projectiles = [];
    this._frozen = false;
    this._frozenTimer = 0;
    Leever.resetRedCount();

    const screenId = screen.id;
    const spawnEntry = this._spawnData.overworldSpawns[screenId];
    if (!spawnEntry) return;

    const monsterListId = spawnEntry.monsterListId;
    if (monsterListId === 0) return;

    const enemyTypes = this.resolveEnemyTypes(monsterListId);
    if (enemyTypes.length === 0) return;

    const foeCountIndex = spawnEntry.monsterCountIndex;
    const foeCounts = this._spawnData.overworldFoeCounts;
    const maxCount = foeCounts[foeCountIndex] ?? 4;

    const posListIndex = directionToSpawnList(entryDirection);
    const positions = this._spawnData.spawnPositions[posListIndex];
    if (!positions) return;

    const count = Math.min(maxCount, positions.length, MAX_ENEMY_SLOTS);

    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      if (pos === undefined) continue;

      const col = pos & 0x0F;
      const row = (pos >> 4) & 0x0F;
      const x = col * 16;
      const y = row * 16 - 3;

      const enemyType = enemyTypes[i % enemyTypes.length]!;
      if (enemyType === 0) continue;

      const hp = getEnemyHp(enemyType, this._hpPairs);
      const spawnDelay = SPAWN_CLOUD_FRAMES + i;
      const enemy = createEnemyByType(x, y, enemyType, hp, spawnDelay);
      this._enemies.push(enemy);
    }

    // Wire Ghini siblings (main Ghini needs ref to all flying Ghini)
    const mainGhini = this._enemies.find(e => e instanceof Ghini && e.objectType === 33);
    if (mainGhini instanceof Ghini) {
      mainGhini.setSiblings(this._enemies);
    }
  }

  spawnForDungeonRoom(
    monsterListId: number,
    maxCount: number,
    entryDirection: Direction,
  ): void {
    this._enemies = [];
    this._projectiles = [];
    this._frozen = false;
    this._frozenTimer = 0;
    Leever.resetRedCount();

    if (monsterListId === 0) return;

    const enemyTypes = this.resolveEnemyTypes(monsterListId);
    if (enemyTypes.length === 0) return;

    const posListIndex = directionToSpawnList(entryDirection);
    const positions = this._spawnData.spawnPositions[posListIndex];
    if (!positions) return;

    const count = Math.min(maxCount, positions.length, MAX_ENEMY_SLOTS);

    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      if (pos === undefined) continue;

      const col = pos & 0x0F;
      const row = (pos >> 4) & 0x0F;
      const x = col * 16;
      const y = row * 16 - 3;

      const enemyType = enemyTypes[i % enemyTypes.length]!;
      if (enemyType === 0) continue;

      const hp = getEnemyHp(enemyType, this._hpPairs);
      const spawnDelay = SPAWN_CLOUD_FRAMES + i;
      const enemy = createEnemyByType(x, y, enemyType, hp, spawnDelay);
      this._enemies.push(enemy);
    }

    const mainGhini = this._enemies.find(e => e instanceof Ghini && e.objectType === 33);
    if (mainGhini instanceof Ghini) {
      mainGhini.setSiblings(this._enemies);
    }
  }

  private resolveEnemyTypes(monsterListId: number): number[] {
    if (monsterListId >= 0x62) {
      const listIndex = monsterListId - 0x62;
      const list = this._spawnData.objectLists[listIndex];
      return list ? [...list] : [];
    }
    return [monsterListId];
  }

  update(collision: TileCollisionMap, screen: OverworldScreen, linkX = 0, linkY = 0): void {
    if (this._frozen) {
      this._frozenTimer--;
      if (this._frozenTimer <= 0) {
        this._frozen = false;
      }
      // Still update projectiles during freeze
      this.updateProjectiles();
      return;
    }

    // Drain child spawns requested last frame (e.g. Zol → 2 Gels) before updating.
    this.drainChildSpawns();

    const ctx: EnemyUpdateContext = { collision, screen, linkX, linkY };
    for (const enemy of this._enemies) {
      enemy.update(ctx);
      // Collect any projectiles spawned this frame
      const proj = enemy.consumeProjectile();
      if (proj) {
        this._projectiles.push(proj);
      }
    }

    this._enemies = this._enemies.filter(e => !e.isDead);
    this.updateProjectiles();
  }

  // Create monsters that existing enemies requested (Zol split → child Gels).
  private drainChildSpawns(): void {
    const newborns: Enemy[] = [];
    for (const enemy of this._enemies) {
      for (const spec of enemy.collectChildSpawns()) {
        if (newborns.length + this._enemies.length >= MAX_ENEMY_SLOTS) break;
        const hp = getEnemyHp(spec.objectType, this._hpPairs);
        newborns.push(createEnemyByType(spec.x, spec.y, spec.objectType, hp, SPAWN_CLOUD_FRAMES));
      }
    }
    if (newborns.length > 0) {
      this._enemies.push(...newborns);
    }
  }

  private updateProjectiles(): void {
    for (const proj of this._projectiles) {
      proj.update();
    }
    this._projectiles = this._projectiles.filter(p => p.isActive());
  }

  render(renderer: Renderer, enemySheet?: SpriteSheet): void {
    for (const enemy of this._enemies) {
      enemy.render(renderer, enemySheet);
    }
    for (const proj of this._projectiles) {
      proj.render(renderer);
    }
  }

  clear(): void {
    this._enemies = [];
    this._projectiles = [];
    this._frozen = false;
    this._frozenTimer = 0;
    Leever.resetRedCount();
  }
}

function createEnemyByType(
  x: number, y: number,
  objectType: number, hp: number, spawnDelay: number,
): Enemy {
  switch (objectType) {
    // Octoroks
    case 7: case 8: case 9: case 10:
      return createOctorok(x, y, objectType, hp, spawnDelay);
    // Moblins
    case 3: case 4:
      return createMoblin(x, y, objectType, hp, spawnDelay);
    // Lynels
    case 1: case 2:
      return createLynel(x, y, objectType, hp, spawnDelay);
    // Tektites
    case 13: case 14:
      return new Tektite(x, y, objectType, hp, spawnDelay);
    // Leevers
    case 15: case 16:
      return new Leever(x, y, objectType, hp, spawnDelay);
    // Zora
    case 17:
      return new Zora(x, y, objectType, hp, spawnDelay);
    // Peahat
    case 26:
      return new Peahat(x, y, objectType, hp, spawnDelay);
    // Ghini (main)
    case 33:
      return new Ghini(x, y, objectType, hp, spawnDelay);
    // Flying Ghini
    case 34:
      return new FlyingGhini(x, y, objectType, hp, spawnDelay);
    // Armos
    case 30:
      return new Armos(x, y, objectType, hp, spawnDelay);
    // --- Dungeon tier-1 enemies (G3) ---
    // Goriya (blue/red) — throws returning boomerang
    case 0x05: case 0x06:
      return new Goriya(x, y, objectType, hp, spawnDelay);
    // Zol — splits into 2 Gels
    case 0x13:
      return new Zol(x, y, objectType, hp, spawnDelay);
    // Gel (normal / Zol child)
    case 0x14: case 0x15:
      return new Gel(x, y, objectType, hp, spawnDelay);
    // Keese (blue/red/black)
    case 0x1b: case 0x1c: case 0x1d:
      return new Keese(x, y, objectType, hp, spawnDelay);
    // Rope
    case 0x28:
      return new Rope(x, y, objectType, hp, spawnDelay);
    // Stalfos
    case 0x2a:
      return createStalfos(x, y, objectType, hp, spawnDelay);
    // --- Dungeon tier-2 enemies (G4a) ---
    // Gibdo
    case 0x30:
      return createGibdo(x, y, objectType, hp, spawnDelay);
    // Darknut (red/blue) — directional parry
    case 0x0b: case 0x0c:
      return new Darknut(x, y, objectType, hp, spawnDelay);
    // Vire — splits into 2 Red Keese
    case 0x12:
      return new Vire(x, y, objectType, hp, spawnDelay);
    // Pols Voice — hopper
    case 0x16:
      return new PolsVoice(x, y, objectType, hp, spawnDelay);
    // Bubble (flash/blue/red) — invulnerable, sword-jinx on touch
    case 0x2b: case 0x2c: case 0x2d:
      return new Bubble(x, y, objectType, hp, spawnDelay);
    // --- Dungeon tier-2 enemies (G4b) ---
    // Blue Wizzrobe — walk/teleport + magic shot
    case 0x23:
      return new BlueWizzrobe(x, y, objectType, hp, spawnDelay);
    // Red Wizzrobe — stationary phaser + magic shot
    case 0x24:
      return new RedWizzrobe(x, y, objectType, hp, spawnDelay);
    // Like-Like — captures Link + eats Magic Shield
    case 0x17:
      return new LikeLike(x, y, objectType, hp, spawnDelay);
    // Wallmaster — wall-emerge crawl + grab-to-entrance
    case 0x27:
      return new Wallmaster(x, y, objectType, hp, spawnDelay);
    // Lanmola (red/blue) — segmented worm, head-only vulnerable
    case 0x3a: case 0x3b:
      return new Lanmola(x, y, objectType, hp, spawnDelay);
    // Default fallback (uses base Enemy generic walker)
    default:
      return new Enemy(x, y, objectType, hp, spawnDelay);
  }
}

function directionToSpawnList(entryDirection: Direction): number {
  switch (entryDirection) {
    case Direction.Right: return 0;
    case Direction.Left: return 1;
    case Direction.Down: return 2;
    case Direction.Up: return 3;
  }
}
