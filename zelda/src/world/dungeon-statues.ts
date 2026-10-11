// Dungeon statue fireballs — Z_04.asm UpdateStatues (1593).
//
// Certain dungeon rooms have wall statues that periodically lob fireballs aimed
// at Link. These are NOT enemies: no HP, invulnerable, not in the monster list —
// they belong to the room layout. Their fireballs ride the existing
// EnemyProjectile pipeline (SpawnManager tracks/updates/renders them and
// checkEnemyProjectileCollisions applies damage + magic-shield deflection), so
// no new collision code is needed.
//
// Behavior is keyed off the room's unique-room id:
//   layout $24 → pattern 0 (4 statues)
//   layout $23 → pattern 1 (2 statues)
// Pattern 2 is the two bonfires flanking a dungeon person or Grumble: hitting the
// person sets PersonFireballsEnabled, which UpdateStatues checks first, so the
// fires start shooting for the rest of the visit (see enablePersonFireballs).
//
// Simplification (documented): the NES fireball tracks Link with fractional X/Y
// speeds (diagonal). Our EnemyProjectile is cardinal-only, so we aim each shot
// in the cardinal direction toward Link. Firing cadence, count, and statue
// positions stay faithful.

import { Direction } from '../core/types.js';
import { HUD_HEIGHT } from '../core/constants.js';
import { EnemyProjectile } from '../objects/projectiles/enemy-projectile.js';
import { ProjectileType } from '../objects/player/shield.js';

// Unique-room ids that host fireball statues, indexed by pattern number.
const STATUE_ROOM_LAYOUTS = [0x24, 0x23] as const;
// Fireballs per pattern, expressed as count-minus-1 (NES StatueFireballCounts).
const FIREBALL_COUNTS = [3, 1, 1] as const;
// Reload delays chosen at random when a statue fires (NES StatueFireballStartTimes).
const START_TIMES = [0x50, 0x80, 0xf0, 0x60] as const;
// Base index into the position lists for each pattern.
const PATTERN_BASE = [0x00, 0x04, 0x06] as const;
// Statue positions (raw NES screen coords), divided into sets per pattern.
const STATUE_XS = [0x24, 0xc8, 0x24, 0xc8, 0x64, 0x88, 0x48, 0xa8] as const;
const STATUE_YS = [0xc0, 0xbc, 0x64, 0x5c, 0x94, 0x8c, 0x82, 0x86] as const;

const PERSON_FIREBALL_PATTERN = 2;

export class DungeonStatues {
  private _pattern: number;
  private _base = 0;
  private _count = 0;
  private _timers: number[] = [];

  constructor(uniqueRoomId: number) {
    this._pattern = STATUE_ROOM_LAYOUTS.indexOf(uniqueRoomId as (typeof STATUE_ROOM_LAYOUTS)[number]);
    if (this._pattern >= 0) this.usePattern(this._pattern);
  }

  get pattern(): number {
    return this._pattern;
  }

  /**
   * Z_04.asm:1593 UpdateStatues — PersonFireballsEnabled is tested before the
   * room layout, so once a person is struck the bonfires at ($48,$82)/($A8,$86)
   * shoot instead of any layout statues.
   */
  enablePersonFireballs(): void {
    if (this._pattern === PERSON_FIREBALL_PATTERN) return;
    this.usePattern(PERSON_FIREBALL_PATTERN);
  }

  private usePattern(pattern: number): void {
    this._pattern = pattern;
    this._base = PATTERN_BASE[pattern]!;
    this._count = FIREBALL_COUNTS[pattern]! + 1;
    // Stagger initial reloads so all statues don't fire on the same frame.
    this._timers = Array.from({ length: this._count }, (_, i) => START_TIMES[i % START_TIMES.length]!);
  }

  get active(): boolean {
    return this._count > 0;
  }

  // Advance one frame; return any fireballs launched this frame.
  update(linkX: number, linkY: number): EnemyProjectile[] {
    const shots: EnemyProjectile[] = [];
    for (let i = 0; i < this._count; i++) {
      if (this._timers[i]! > 0) {
        this._timers[i]!--;
        continue;
      }
      // Timer elapsed — 15/16 chance to fire, else wait another ~256 frames.
      if (Math.floor(Math.random() * 256) < 0xf0) {
        this._timers[i] = START_TIMES[Math.floor(Math.random() * 4)]!;
        shots.push(this.makeFireball(this._base + i, linkX, linkY));
      } else {
        this._timers[i] = 0xff;
      }
    }
    return shots;
  }

  private makeFireball(posIndex: number, linkX: number, linkY: number): EnemyProjectile {
    const sx = STATUE_XS[posIndex]!;
    const sy = STATUE_YS[posIndex]! - HUD_HEIGHT; // NES raw Y → play-area-local
    const dir = cardinalToward(sx, sy, linkX, linkY);
    return new EnemyProjectile(sx, sy, dir, ProjectileType.Fireball);
  }
}

function cardinalToward(sx: number, sy: number, linkX: number, linkY: number): Direction {
  const dx = linkX - sx;
  const dy = linkY - sy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? Direction.Right : Direction.Left;
  }
  return dy >= 0 ? Direction.Down : Direction.Up;
}
