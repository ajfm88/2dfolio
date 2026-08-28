import { describe, it, expect } from 'vitest';
import { DungeonStatues } from '../../src/world/dungeon-statues.js';
import { ProjectileType } from '../../src/objects/player/shield.js';

describe('DungeonStatues', () => {
  it('is inactive for a room whose layout has no statues', () => {
    const s = new DungeonStatues(0x00);
    expect(s.active).toBe(false);
    expect(s.update(120, 80)).toEqual([]);
  });

  it('activates for layout $24 (4-statue pattern) and $23 (2-statue pattern)', () => {
    expect(new DungeonStatues(0x24).active).toBe(true);
    expect(new DungeonStatues(0x23).active).toBe(true);
  });

  it('emits Fireball projectiles over time in a statue room', () => {
    const s = new DungeonStatues(0x24);
    const shots = [];
    // Timers start at >= 0x50 frames; run well past that to guarantee fire.
    for (let i = 0; i < 400; i++) shots.push(...s.update(200, 80));
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      expect(shot.type).toBe(ProjectileType.Fireball);
      // Fireballs spawn at statue positions, inside the play area.
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThan(256);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThan(176);
    }
  });

  it('does not fire on the very first frames (statues reload before firing)', () => {
    const s = new DungeonStatues(0x23);
    let earlyShots = 0;
    for (let i = 0; i < 0x50; i++) earlyShots += s.update(200, 80).length;
    expect(earlyShots).toBe(0);
  });
});
