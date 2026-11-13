// V5c checkpoint-02 (note 93): every extracted map NPC carries its 1-based place in pret's object_event list
// (`objectId`: its sprite slot and the toggle table's object id). Data only; nothing reads it until checkpoint-03.
import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MapData } from '../extractors/maps';
import type { ToggleableObjectsData } from '../extractors/toggleable_objects';

const DATA = resolve(__dirname, '../../../data');
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const maps: MapData[] = readdirSync(resolve(DATA, 'maps')).map(file => JSON.parse(readFileSync(resolve(DATA, 'maps', file), 'utf8')));
const toggles: ToggleableObjectsData = JSON.parse(readFileSync(resolve(DATA, 'toggleable_objects.json'), 'utf8'));

/** pret's object_event list: [x, y, sprite constant]. Sprite names differ (the engine's names), so position, the
 *  one-per-map rule and the pinned orders below identify each object; Viridian's (18,9) pair is pinned there. */
function pretObjects(name: string): [number, number, string][] {
  const asm = readFileSync(resolve(REFS, `data/maps/objects/${name}.asm`), 'utf8');
  return [...asm.matchAll(/^\s*object_event\s+(\d+),\s*(\d+),\s*(\w+)/gm)].map(m => [Number(m[1]), Number(m[2]), m[3]]);
}

it('every NPC of all 30 maps has the objectId of its pret object_event, once per map', () => {
  expect(maps).toHaveLength(30);
  let npcs = 0;
  for (const map of maps) {
    const objects = pretObjects(map.name);
    const seen = new Set<number>();
    for (const npc of map.npcs) {
      npcs++;
      const id = npc.objectId;
      expect([map.name, npc.id, Number.isInteger(id) && id >= 1 && id <= objects.length]).toEqual([map.name, npc.id, true]);
      const [x, y] = objects[id - 1];
      expect([map.name, npc.id, npc.x, npc.y]).toEqual([map.name, npc.id, x, y]);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  }
  expect(npcs).toBe(102);
});

it('pins the three reordered or filtered maps and the objects they still lack', () => {
  const ids = (name: string) => maps.find(m => m.name === name)!.npcs.map(npc => [npc.id, npc.objectId]);
  expect(ids('OaksLab')).toEqual([['prof', 3], ['rival', 1], ['item_ball', 2], ['pokedex1', 4], ['pokedex2', 5],
    ['girl', 7], ['scientist1', 8], ['scientist2', 9]]);
  expect(ids('ViridianCity')).toEqual([['youngster1', 1], ['gambler1', 2], ['youngster2', 3], ['girl1', 4],
    ['fisher1', 6], ['oldman1', 7], ['oldman_blocking', 5], ['oldman2', 8]]);
  expect(ids('BluesHouse')).toEqual([['daisy', 1], ['town_map', 3]]);
  expect(ids('Route22')).toEqual([]);
});

it("each of today's toggle rows finds its NPC by objectId, except the objects the port still drops", () => {
  const ids: Record<string, number> = Object.fromEntries(maps.map(m => [m.name, -1]));
  const mapIdOf = (name: string): number => {
    const first = toggles.mapFirst[name];
    return first === null || first === undefined ? -1 : toggles.states[first].map;
  };
  for (const name of Object.keys(ids)) ids[name] = mapIdOf(name);
  const found: string[] = [], missing: string[] = [];
  for (const map of maps) {
    if (ids[map.name] < 0) continue;
    for (let i = toggles.mapFirst[map.name]!; i < toggles.states.length && toggles.states[i].map === ids[map.name]; i++) {
      const npc = map.npcs.find(n => n.objectId === toggles.states[i].object);
      (npc ? found : missing).push(`${map.name}:${toggles.states[i].object}${npc ? `=${npc.id}` : ''}`);
    }
  }
  // OAK2, walking Daisy and the Route 22 rivals arrive in checkpoint-04 (note 93 §4).
  expect(missing.sort()).toEqual(['BluesHouse:2', 'OaksLab:6', 'Route22:1', 'Route22:2']);
  expect(found.sort()).toEqual(['BluesHouse:1=daisy', 'BluesHouse:3=town_map', 'Museum1F:5=old_amber', 'OaksLab:1=rival',
    'OaksLab:2=item_ball', 'OaksLab:3=prof', 'OaksLab:4=pokedex1', 'OaksLab:5=pokedex2', 'PalletTown:1=prof',
    'PewterCity:3=super_nerd1', 'PewterCity:5=youngster', 'Route2:1=moon_stone', 'Route2:2=hp_up',
    'ViridianCity:5=oldman_blocking', 'ViridianCity:7=oldman1', 'ViridianCity:8=oldman2', 'ViridianForest:7=potion1',
    'ViridianForest:8=potion2', 'ViridianForest:9=poke_ball']);
});
