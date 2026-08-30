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
import { Enemy, type EnemyUpdateContext, type BombLike, getEnemyHp } from './enemy.js';
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
import { Aquamentus } from './aquamentus.js';
import { Dodongo } from './dodongo.js';
import { createManhandla, MANHANDLA } from './manhandla.js';
import { Gohma, GOHMA_BLUE, GOHMA_RED } from './gohma.js';
import { Digdogger, LittleDigdogger, DIGDOGGER1, DIGDOGGER2, LITTLE_DIGDOGGER } from './digdogger.js';
import { createGleeok, GleeokFlyingHead, GLEEOK2, GLEEOK4B, GLEEOK_HEAD } from './gleeok.js';

// Dungeon rooms have a 2-tile wall border; the walkable inner area is grid rows
// 2-8 and cols 2-13 (see DungeonCollisionMap). Enemy spawn positions are clamped
// into this box so nothing spawns inside a wall.
const DUNGEON_INNER_MIN_ROW = 2;
const DUNGEON_INNER_MAX_ROW = 8;
const DUNGEON_INNER_MIN_COL = 2;
const DUNGEON_INNER_MAX_COL = 13;

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

  // Feed an externally-sourced enemy projectile into the shared pipeline
  // (e.g. dungeon statue fireballs, which have no owning Enemy object).
  addProjectile(proj: EnemyProjectile): void {
    this._projectiles.push(proj);
  }

  // Debug-only: drop a single enemy of the given object type at a position.
  // Used by the __zelda console helpers to inspect a specific enemy on demand.
  debugSpawn(objectType: number, x: number, y: number): void {
    if (this._enemies.length >= MAX_ENEMY_SLOTS) return;
    const hp = getEnemyHp(objectType, this._hpPairs);
    this.pushEnemyOrGroup(objectType, x, y, hp, SPAWN_CLOUD_FRAMES);
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
    const maxCount = this.clampBossCount(monsterListId, foeCounts[foeCountIndex] ?? 4);

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
      this.pushEnemyOrGroup(enemyType, x, y, hp, spawnDelay);
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

    const clampedMax = this.clampBossCount(monsterListId, maxCount);

    const posListIndex = directionToSpawnList(entryDirection);
    const positions = this._spawnData.spawnPositions[posListIndex];
    if (!positions) return;

    const count = Math.min(clampedMax, positions.length, MAX_ENEMY_SLOTS);

    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      if (pos === undefined) continue;

      // The overworld spawn-position lists reach rows 9-11 / edge cols, which in a
      // dungeon are the wall border (walkable inner area is rows 2-8, cols 2-13).
      // Clamp into that area so enemies never spawn embedded in a wall — otherwise
      // they're unreachable and a shutter/kill-all room can never be cleared.
      const col = Math.min(DUNGEON_INNER_MAX_COL, Math.max(DUNGEON_INNER_MIN_COL, pos & 0x0F));
      const row = Math.min(DUNGEON_INNER_MAX_ROW, Math.max(DUNGEON_INNER_MIN_ROW, (pos >> 4) & 0x0F));
      const x = col * 16;
      const y = row * 16 - 3;

      const enemyType = enemyTypes[i % enemyTypes.length]!;
      if (enemyType === 0) continue;

      const hp = getEnemyHp(enemyType, this._hpPairs);
      const spawnDelay = SPAWN_CLOUD_FRAMES + i;
      this.pushEnemyOrGroup(enemyType, x, y, hp, spawnDelay);
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

  // NES Z_05.asm:1723 — "make the count 1 if the object list ID >= $32 and < $62".
  // Bosses and other non-recurring objects spawn exactly once regardless of the
  // room's foe-count nibble (else a boss room would spawn 3 Aquamentus).
  private clampBossCount(monsterListId: number, count: number): number {
    if (monsterListId >= 0x32 && monsterListId < 0x62) return 1;
    return count;
  }

  // Most enemies are a single object; Manhandla ($3C) is a cluster of 5 (1 center +
  // 4 hands) that spawns from one boss slot. The center is clamped so all four ±16
  // hands start inside the play area.
  private pushEnemyOrGroup(
    enemyType: number, x: number, y: number, hp: number, spawnDelay: number,
  ): void {
    if (enemyType === MANHANDLA) {
      const cx = Math.min(224, Math.max(16, x));
      const cy = Math.min(144, Math.max(16, y));
      const { center, hands } = createManhandla(cx, cy, hp, spawnDelay);
      this._enemies.push(center, ...hands);
      return;
    }
    if (enemyType >= GLEEOK2 && enemyType <= GLEEOK4B) {
      const cx = Math.min(224, Math.max(16, x));
      const { body, heads } = createGleeok(cx, 0, enemyType, hp, spawnDelay);
      this._enemies.push(body, ...heads);
      return;
    }
    this._enemies.push(createEnemyByType(x, y, enemyType, hp, spawnDelay));
  }

  update(
    collision: TileCollisionMap,
    screen: OverworldScreen,
    linkX = 0,
    linkY = 0,
    bombs: readonly BombLike[] = [],
    fluteActive = false,
  ): void {
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

    const ctx: EnemyUpdateContext = { collision, screen, linkX, linkY, bombs, fluteActive };
    for (const enemy of this._enemies) {
      enemy.update(ctx);
      // Collect any projectiles spawned this frame
      const proj = enemy.consumeProjectile();
      if (proj) {
        this._projectiles.push(proj);
      }
      // Bosses may emit several shots at once (Aquamentus' 3-way fan).
      for (const extra of enemy.consumeProjectiles()) {
        this._projectiles.push(extra);
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
    // --- Bosses (Phase I) ---
    // Aquamentus — Level 1 dragon: horizontal wobble + 3-way fireball fan
    case 0x3d:
      return new Aquamentus(x, y, objectType, hp, spawnDelay);
    // Dodongo — Level 2 dino: immune to all weapons; bomb-feed / stun-and-sword
    case 0x32:
      return new Dodongo(x, y, objectType, hp, spawnDelay);
    // Gohma — Level 6 crab: arrow-only when eye half-open
    case GOHMA_BLUE: case GOHMA_RED:
      return new Gohma(x, y, objectType, hp, spawnDelay);
    // Digdogger — Level 5: invulnerable, flute splits into children
    case DIGDOGGER1: case DIGDOGGER2:
      return new Digdogger(x, y, objectType, hp, spawnDelay);
    // LittleDigdogger — Digdogger child, fast and killable
    case LITTLE_DIGDOGGER:
      return new LittleDigdogger(x, y, objectType, hp, spawnDelay);
    // GleeokFlyingHead — invulnerable flying detached head
    case GLEEOK_HEAD:
      return new GleeokFlyingHead(x, y, objectType, hp, spawnDelay);
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
