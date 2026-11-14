// V5c checkpoint-04 (note 93 §19): every extracted map NPC is its pret object_event, in that order.
// objectId is the 1-based sprite slot and the toggle table's object id. Facing comes from the movement bytes.
import { beforeAll, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NpcData } from '../../core/types';
import type { MapData, MapNpc } from '../extractors/maps';
import { objectFacing } from '../extractors/maps';
import type { ToggleableObjectsData } from '../extractors/toggleable_objects';
import { Npc } from '../../overworld/npc';
import { applyStoryNpcState } from '../../overworld/story_state';
import {
  TOGGLE, getToggleableObjectFlags, initializeToggleableObjectFlags, isObjectHidden,
  loadToggleableObjects, restoreToggleableObjectFlags,
} from '../../overworld/toggleable_objects';

beforeAll(async () => { await loadToggleableObjects(); });

const DATA = resolve(__dirname, '../../../data');
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const maps: MapData[] = readdirSync(resolve(DATA, 'maps')).map(file => JSON.parse(readFileSync(resolve(DATA, 'maps', file), 'utf8')));
const toggles: ToggleableObjectsData = JSON.parse(readFileSync(resolve(DATA, 'toggleable_objects.json'), 'utf8'));

interface PretObject {
  x: number;
  y: number;
  sprite: string;
  movement: 'WALK' | 'STAY';
  range: string;
}

/** pret's object_event list, in order. Sprite constant names differ from the engine's asset names. */
function pretObjects(name: string): PretObject[] {
  const asm = readFileSync(resolve(REFS, `data/maps/objects/${name}.asm`), 'utf8');
  return [...asm.matchAll(/^\s*object_event\s+(\d+),\s*(\d+),\s*(\w+),\s*(WALK|STAY),\s*(\w+)/gm)].map(m => ({
    x: Number(m[1]), y: Number(m[2]), sprite: m[3], movement: m[4] as 'WALK' | 'STAY', range: m[5],
  }));
}

function expectFacing(npc: MapNpc, object: PretObject): void {
  const fixed = ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(object.range) ? object.range.toLowerCase() : undefined;
  const axis = object.range === 'UP_DOWN' || object.range === 'LEFT_RIGHT' ? object.range.toLowerCase() : undefined;
  expect([npc.movement, npc.direction, npc.walkDir]).toEqual([
    object.movement === 'WALK' ? 'walk' : 'stay',
    object.movement === 'STAY' ? fixed : undefined,
    object.movement === 'WALK' ? axis : undefined,
  ]);
}

it('every NPC of all 30 maps is its pret object_event, once, in ROM order', () => {
  expect(maps).toHaveLength(30);
  let npcs = 0;
  for (const map of maps) {
    const objects = pretObjects(map.name);
    expect(map.npcs.map(npc => npc.objectId), map.name).toEqual(objects.map((_, i) => i + 1));
    map.npcs.forEach((npc, i) => {
      npcs++;
      const object = objects[i];
      expect([map.name, npc.id, npc.x, npc.y]).toEqual([map.name, npc.id, object.x, object.y]);
      expectFacing(npc, object);
    });
  }
  expect(npcs).toBe(106);
});

it('pins Oak\'s Lab, Viridian, Blue\'s House and Route 22, including the four objects that arrived hidden', () => {
  const ids = (name: string) => maps.find(m => m.name === name)!.npcs.map(npc => [npc.id, npc.objectId]);
  expect(ids('OaksLab')).toEqual([['rival', 1], ['item_ball', 2], ['prof', 3], ['pokedex1', 4], ['pokedex2', 5],
    ['prof2', 6], ['girl', 7], ['scientist1', 8], ['scientist2', 9]]);
  expect(ids('ViridianCity')).toEqual([['youngster1', 1], ['gambler1', 2], ['youngster2', 3], ['girl1', 4],
    ['oldman_blocking', 5], ['fisher1', 6], ['oldman1', 7], ['oldman2', 8]]);
  expect(ids('BluesHouse')).toEqual([['daisy', 1], ['daisy_walking', 2], ['town_map', 3]]);
  expect(ids('Route22')).toEqual([['rival1', 1], ['rival2', 2]]);

  const lab = maps.find(m => m.name === 'OaksLab')!.npcs;
  expect(lab.find(n => n.id === 'prof2')).toMatchObject({ sprite: 'prof', x: 5, y: 10, movement: 'stay', direction: 'up', objectId: 6 });
  const house = maps.find(m => m.name === 'BluesHouse')!.npcs;
  expect(house.find(n => n.id === 'daisy_walking')).toMatchObject({ sprite: 'daisy', x: 6, y: 4, movement: 'walk', walkDir: 'up_down', objectId: 2 });
  const route = maps.find(m => m.name === 'Route22')!.npcs;
  expect(route.map(n => ({ id: n.id, sprite: n.sprite, x: n.x, y: n.y, movement: n.movement, direction: n.direction, objectId: n.objectId })))
    .toEqual([
      { id: 'rival1', sprite: 'blue', x: 25, y: 5, movement: 'stay', direction: undefined, objectId: 1 },
      { id: 'rival2', sprite: 'blue', x: 25, y: 5, movement: 'stay', direction: undefined, objectId: 2 },
    ]);
});

it('each of today\'s 23 toggle rows finds its NPC by objectId', () => {
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
  expect(missing).toEqual([]);
  expect(found.sort()).toEqual([
    'BluesHouse:1=daisy', 'BluesHouse:2=daisy_walking', 'BluesHouse:3=town_map', 'Museum1F:5=old_amber',
    'OaksLab:1=rival', 'OaksLab:2=item_ball', 'OaksLab:3=prof', 'OaksLab:4=pokedex1', 'OaksLab:5=pokedex2',
    'OaksLab:6=prof2', 'PalletTown:1=prof', 'PewterCity:3=super_nerd1', 'PewterCity:5=youngster',
    'Route22:1=rival1', 'Route22:2=rival2', 'Route2:1=moon_stone', 'Route2:2=hp_up',
    'ViridianCity:5=oldman_blocking', 'ViridianCity:7=oldman1', 'ViridianCity:8=oldman2',
    'ViridianForest:7=potion1', 'ViridianForest:8=potion2', 'ViridianForest:9=poke_ball',
  ].sort());
});

function live(data: MapNpc): Npc {
  if (data.movement !== 'stay' && data.movement !== 'walk') throw new Error(`${data.id}: movement ${data.movement}`);
  return new Npc({ ...data, movement: data.movement } as NpcData);
}

it('a fixed facing starts there, and STAY NONE keeps the random-turn bytes', () => {
  const npc = (map: string, id: string): Npc => live(maps.find(m => m.name === map)!.npcs.find(n => n.id === id)!);
  // Route 1's two constrained walkers, the Pokécenter gentleman, Viridian's two STAY NONE men, the Lab and the house.
  expect(npc('Route1', 'youngster1').movement.wanders).toBe(true);
  expect(npc('Route1', 'youngster1').data.walkDir).toBe('up_down');
  expect(npc('Route1', 'youngster2').data.walkDir).toBe('left_right');
  expect(npc('ViridianPokecenter', 'gentleman1').data.walkDir).toBe('up_down');
  for (const id of ['oldman_blocking', 'oldman2']) {
    const man = npc('ViridianCity', id);
    expect(man.movement.fixedFacing).toBeNull();
    expect(man.movement.wanders).toBe(false);
    expect(man.direction).toBe('down');
  }
  expect(npc('OaksLab', 'prof').direction).toBe('down');
  expect(npc('OaksLab', 'prof2').direction).toBe('up');
  for (const id of ['item_ball', 'pokedex1', 'pokedex2', 'rival']) expect(npc('OaksLab', id).movement.fixedFacing).toBeNull();
  expect(npc('BluesHouse', 'daisy').direction).toBe('right');
  expect(npc('BluesHouse', 'daisy_walking').data.walkDir).toBe('up_down');
  expect(npc('BluesHouse', 'town_map').movement.fixedFacing).toBeNull();
  expect(npc('Route22', 'rival1').movement.fixedFacing).toBeNull();
});

it('New Game and a reloaded save hide OAK2, walking Daisy and both Route 22 rivals', () => {
  initializeToggleableObjectFlags();
  const enter = (name: string): Npc[] => {
    const npcs = maps.find(m => m.name === name)!.npcs.map(data => live(data));
    applyStoryNpcState(name, npcs);
    return npcs;
  };
  const hiddenOf = (name: string, id: string, list = enter(name)): boolean => list.find(n => n.data.id === id)!.hidden;
  expect(hiddenOf('OaksLab', 'prof2')).toBe(true);
  expect(hiddenOf('BluesHouse', 'daisy_walking')).toBe(true);
  expect(hiddenOf('Route22', 'rival1')).toBe(true);
  expect(hiddenOf('Route22', 'rival2')).toBe(true);
  // No toggle row: they stay present. Oak 1 is OFF at New Game; the girl is not.
  const lab = enter('OaksLab');
  expect(lab.find(n => n.data.id === 'girl')!.hidden).toBe(false);
  expect(lab.find(n => n.data.id === 'scientist1')!.hidden).toBe(false);
  expect(lab.find(n => n.data.id === 'prof')!.hidden).toBe(true);
  expect(lab.map(n => n.data.objectId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(isObjectHidden('OaksLab', 6)).toBe(true);
  expect(isObjectHidden('BluesHouse', 2)).toBe(true);
  expect([TOGGLE.OAKS_LAB_OAK_2, TOGGLE.DAISY_WALKING, TOGGLE.ROUTE_22_RIVAL_1, TOGGLE.ROUTE_22_RIVAL_2])
    .toEqual([0x30, 0x29, 0x23, 0x24]);

  // A save that already has the flags, then a map reload (debug warp and CONTINUE both call applyStoryNpcState).
  const saved = getToggleableObjectFlags();
  initializeToggleableObjectFlags();
  restoreToggleableObjectFlags(saved);
  const again = enter('OaksLab');
  expect(again.find(n => n.data.id === 'prof2')!.hidden).toBe(true);
  expect(again.find(n => n.data.id === 'rival')!.data.objectId).toBe(1);
  expect(enter('BluesHouse').find(n => n.data.id === 'daisy_walking')!.hidden).toBe(true);
  expect(enter('Route22').every(n => n.hidden)).toBe(true);
  expect(enter('ViridianCity').find(n => n.data.id === 'oldman2')!.data.objectId).toBe(8);
});

it('rejects a movement byte that is not WALK or STAY, and a range the byte does not allow', () => {
  expect(objectFacing('Route1', 1, 0xfe, 0x01)).toEqual({ movement: 'walk', walkDir: 'up_down' });
  expect(objectFacing('OaksLab', 6, 0xff, 0xd1)).toEqual({ movement: 'stay', direction: 'up' });
  expect(objectFacing('Route22', 1, 0xff, 0xff)).toEqual({ movement: 'stay' });
  expect(() => objectFacing('Route1', 2, 0xfe, 0xd0)).toThrow('Route1 object 2: WALK range $d0');
  expect(() => objectFacing('ViridianCity', 5, 0xff, 0x01)).toThrow('ViridianCity object 5: STAY direction $1');
  expect(() => objectFacing('OaksLab', 3, 0x10, 0x00)).toThrow('OaksLab object 3: movement $10 is not WALK or STAY');
});
