// Tripwires for what A1c deferred (notes/20-a1c-plan.md §3.9, DECISIONS #43). They pass on
// today's maps and fail the day a map makes the deferred behavior reachable.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { TRAINER_MAPS } from './map_trainers';

interface MapJson { name: string; tileset: string; npcs: { id: string; sightRange?: number }[] }

const DATA = resolve(__dirname, '../../data/maps');
const maps: MapJson[] = readdirSync(DATA)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(resolve(DATA, f), 'utf8')) as MapJson);

// (a), the outdoor-sight tripwire, retired in V4 checkpoint-04: a trainer that spots the player at
// a ledge hop's midpoint is now ported (hop_trainer_interruption.test.ts), and Route 3's real
// placements keep their own proof in route3.test.ts.
describe('A1c tripwires', () => {
  it('(b) TRAINER_MAPS is every extracted map whose script uses CheckFightingMapTrainers', () => {
    const scripts = resolve(__dirname, '../../../refs/pokeyellow/scripts');
    if (!existsSync(scripts)) return; // refs/ not cloned
    const expected = maps
      .filter(m => {
        const asm = resolve(scripts, `${m.name}.asm`);
        return existsSync(asm) && readFileSync(asm, 'utf8').includes('CheckFightingMapTrainers');
      })
      .map(m => m.name)
      .sort();
    expect([...TRAINER_MAPS].sort()).toEqual(expected);
  });

  it('every trainer with sight is on a TRAINER_MAPS map', () => {
    const outside = maps.filter(m => !TRAINER_MAPS.has(m.name))
      .flatMap(m => m.npcs.filter(n => (n.sightRange ?? 0) > 0).map(n => `${m.name}:${n.id}`));
    expect(outside).toEqual([]);
  });
});
