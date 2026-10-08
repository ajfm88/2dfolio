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

describe('A1c tripwires', () => {
  it('(a) no OVERWORLD map has a trainer with sight: the hop-midpoint RunMapScript is not built', () => {
    // HandleLedges runs only on OVERWORLD. A trainer there could spot the player at a hop's
    // midpoint (pass 9), which strands them on the ledge tile (plan §1.8). When this fails
    // (V4's Route 3), port the midpoint hook and that aftermath, or prove the map can't
    // reach it and narrow this check.
    const offending = maps.filter(m => m.tileset === 'OVERWORLD')
      .flatMap(m => m.npcs.filter(n => (n.sightRange ?? 0) > 0).map(n => `${m.name}:${n.id}`));
    expect(offending).toEqual([]);
  });

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
