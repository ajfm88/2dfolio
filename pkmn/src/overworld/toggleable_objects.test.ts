// V5c checkpoint-03a/03b (note 93 §12, §16): the cartridge's toggleable-object model. Live since 03b.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ToggleableObjectsData } from '../rom/extractors/toggleable_objects';
import { hasFlag, restoreFlags } from '../events';
import {
  TOGGLE, TOGGLEABLE_OBJECT_FLAG_BYTES, LEGACY_HIDDEN_OBJECT_TOGGLES, loadToggleableObjects,
  initializeToggleableObjectFlags, toggleableObjectList, toggleableObjectIndex, isObjectHidden, isToggledOff,
  hideObject, showObject, getToggleableObjectFlags, restoreToggleableObjectFlags, legacyToggleableObjectFlags,
} from './toggleable_objects';

const DATA = resolve(__dirname, '../../data');
const REFS = resolve(__dirname, '../../../refs/pokeyellow');
const file: ToggleableObjectsData = JSON.parse(readFileSync(resolve(DATA, 'toggleable_objects.json'), 'utf8'));
interface JsonNpc { id: string; objectId: number }
const mapNpcs = (map: string): JsonNpc[] => JSON.parse(readFileSync(resolve(DATA, `maps/${map}.json`), 'utf8')).npcs ?? [];
const hex = (bytes: readonly number[]): string => bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
/** InitializeToggleableObjectsFlags' result on this cartridge: the 40 OFF rows of the 239. */
const NEW_GAME = '4d01fc0218220100161000000c600800c018000000000000000000409e270000';
const noFlags = (): boolean => false;

beforeAll(async () => { await loadToggleableObjects(); });
beforeEach(() => { initializeToggleableObjectFlags(); restoreFlags([]); });

describe('TOGGLE constants', () => {
  it("equal pret's toggle_constants.asm and name the rows of today's maps", () => {
    const pret: Record<string, number> = {};
    let value = 0;
    for (const line of readFileSync(resolve(REFS, 'constants/toggle_constants.asm'), 'utf8').split('\n')) {
      const match = /^\s*const\s+TOGGLE_(\w+)/.exec(line);
      if (match) pret[match[1]] = value++;
    }
    expect(value).toBe(239); // NUM_TOGGLEABLE_OBJECTS
    for (const [name, index] of Object.entries(TOGGLE)) expect([name, index]).toEqual([name, pret[name]]);
    // data/maps/toggleable_objects.asm: each constant's (map, object_event place)
    const rows: Record<keyof typeof TOGGLE, [string, number]> = {
      PALLET_TOWN_OAK: ['PalletTown', 1], LYING_OLD_MAN: ['ViridianCity', 5], OLD_MAN_1: ['ViridianCity', 7],
      OLD_MAN_2: ['ViridianCity', 8], MUSEUM_GUY: ['PewterCity', 3], GYM_GUY: ['PewterCity', 5],
      ROUTE_22_RIVAL_1: ['Route22', 1], ROUTE_22_RIVAL_2: ['Route22', 2], DAISY_SITTING: ['BluesHouse', 1],
      DAISY_WALKING: ['BluesHouse', 2], TOWN_MAP: ['BluesHouse', 3], OAKS_LAB_RIVAL: ['OaksLab', 1],
      STARTER_BALL_1: ['OaksLab', 2], OAKS_LAB_OAK_1: ['OaksLab', 3], POKEDEX_1: ['OaksLab', 4],
      POKEDEX_2: ['OaksLab', 5], OAKS_LAB_OAK_2: ['OaksLab', 6], OLD_AMBER: ['Museum1F', 5],
    };
    for (const [name, [map, object]] of Object.entries(rows)) {
      expect([name, toggleableObjectIndex(map, object)]).toEqual([name, TOGGLE[name as keyof typeof TOGGLE]]);
    }
  });
});

describe('wToggleableObjectFlags', () => {
  it('New Game clears every flag and sets exactly the OFF rows', () => {
    restoreToggleableObjectFlags(new Array<number>(TOGGLEABLE_OBJECT_FLAG_BYTES).fill(0xff));
    initializeToggleableObjectFlags();
    expect(hex(getToggleableObjectFlags())).toBe(NEW_GAME);
    file.states.forEach((row, index) => expect([index, isToggledOff(index)]).toEqual([index, !row.on]));
    for (let index = file.states.length; index < 0x100; index++) expect(isToggledOff(index)).toBe(false);
    expect(file.states.filter(row => !row.on)).toHaveLength(40);
  });

  it('HideObject sets and ShowObject resets one bit: byte index >> 3, mask 1 << (index & 7)', () => {
    restoreToggleableObjectFlags(new Array<number>(TOGGLEABLE_OBJECT_FLAG_BYTES).fill(0));
    hideObject(TOGGLE.OAKS_LAB_RIVAL); // $2b: byte 5, bit 3
    expect(getToggleableObjectFlags()[5]).toBe(0x08);
    hideObject(0xff); hideObject(0); hideObject(TOGGLE.OAKS_LAB_RIVAL);
    expect(hex(getToggleableObjectFlags())).toBe('0100000000080000000000000000000000000000000000000000000000000080');
    expect([isToggledOff(0), isToggledOff(1), isToggledOff(0x2b), isToggledOff(0xff)]).toEqual([true, false, true, true]);
    showObject(TOGGLE.OAKS_LAB_RIVAL); showObject(1);
    expect(hex(getToggleableObjectFlags())).toBe('0100000000000000000000000000000000000000000000000000000000000080');
    for (const bad of [-1, 0x100, 1.5, Number.NaN]) {
      expect(() => hideObject(bad)).toThrow('toggle index');
      expect(() => showObject(bad)).toThrow('toggle index');
      expect(() => isToggledOff(bad)).toThrow('toggle index');
    }
  });

  it('round-trips through the save bytes, hands out copies and refuses malformed bytes', () => {
    hideObject(TOGGLE.OLD_AMBER);
    const saved = getToggleableObjectFlags();
    expect(saved).toHaveLength(32);
    saved[0] = 0xff; // a copy: the live flags are unchanged
    expect(isToggledOff(1)).toBe(false);
    const again = getToggleableObjectFlags();
    initializeToggleableObjectFlags();
    expect(isToggledOff(TOGGLE.OLD_AMBER)).toBe(false);
    restoreToggleableObjectFlags(again);
    expect(isToggledOff(TOGGLE.OLD_AMBER)).toBe(true);
    again[3] = 0x55; // restore copied the bytes
    expect(getToggleableObjectFlags()[3]).toBe(0x02);
    const before = hex(getToggleableObjectFlags());
    for (const bad of [again.slice(1), [...again, 0], again.map((b, i) => i === 7 ? 256 : b), again.map((b, i) => i === 7 ? -1 : b),
      again.map((b, i) => i === 7 ? 0.5 : b), 'x'.repeat(32) as unknown as number[]]) {
      expect(() => restoreToggleableObjectFlags(bad)).toThrow('saved toggleable-object flags');
    }
    expect(hex(getToggleableObjectFlags())).toBe(before);
  });
});

describe('wToggleableObjectList and IsObjectHidden', () => {
  it("lists a map's rows from its pointer until the map changes", () => {
    expect(toggleableObjectList('OaksLab')).toEqual([{ object: 1, index: 0x2b }, { object: 2, index: 0x2c },
      { object: 3, index: 0x2d }, { object: 4, index: 0x2e }, { object: 5, index: 0x2f }, { object: 6, index: 0x30 }]);
    // Blue's House stops at $2a; the unused routine's copies ($ec–$ee) are never listed
    expect(toggleableObjectList('BluesHouse')).toEqual([{ object: 1, index: 0x28 }, { object: 2, index: 0x29 }, { object: 3, index: 0x2a }]);
    expect(toggleableObjectList('PalletTown')).toEqual([{ object: 1, index: 0 }]);
    expect(toggleableObjectList('ViridianForest')).toEqual([{ object: 7, index: 0x64 }, { object: 8, index: 0x65 }, { object: 9, index: 0x66 }]);
    expect(toggleableObjectList('Route1')).toEqual([]); // NoToggleData
    const owners = Object.keys(file.mapFirst).filter(map => toggleableObjectList(map).length > 0).sort();
    expect(owners).toEqual(['BluesHouse', 'Museum1F', 'OaksLab', 'PalletTown', 'PewterCity', 'Route2', 'Route22', 'ViridianCity', 'ViridianForest']);
    expect(owners.reduce((total, map) => total + toggleableObjectList(map).length, 0)).toBe(23);
    expect(() => toggleableObjectList('CeruleanCity')).toThrow('CeruleanCity is not an extracted map');
  });

  it('finds an object by its place, and an object without an entry is never hidden', () => {
    expect(toggleableObjectIndex('ViridianForest', 7)).toBe(0x64);
    expect(toggleableObjectIndex('ViridianForest', 1)).toBeNull();
    expect(toggleableObjectIndex('Route1', 1)).toBeNull();
    // New Game: Oak 1 (object 3) and Oak 2 (6) are OFF, the rival (1) and the ball (2) are ON
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(object => isObjectHidden('OaksLab', object))).toEqual([false, false, true, false, false, true, false, false]);
    restoreToggleableObjectFlags(new Array<number>(TOGGLEABLE_OBJECT_FLAG_BYTES).fill(0xff));
    expect(isObjectHidden('OaksLab', 7)).toBe(false); // the girl has no row
    expect(isObjectHidden('Route1', 1)).toBe(false);
    expect(isObjectHidden('ViridianCity', 5)).toBe(true);
    showObject(TOGGLE.LYING_OLD_MAN);
    expect([5, 7, 8].map(object => isObjectHidden('ViridianCity', object))).toEqual([false, true, true]);
  });

  it("throws before the data is loaded, and loading starts the flags as New Game's", async () => {
    vi.resetModules();
    const fresh = await import('./toggleable_objects');
    expect(hex(fresh.getToggleableObjectFlags())).toBe('00'.repeat(32));
    expect(() => fresh.toggleableObjectList('OaksLab')).toThrow('toggleable objects not loaded');
    expect(() => fresh.initializeToggleableObjectFlags()).toThrow('toggleable objects not loaded');
    expect(() => fresh.legacyToggleableObjectFlags([], noFlags)).toThrow('toggleable objects not loaded');
    await fresh.loadToggleableObjects();
    expect(hex(fresh.getToggleableObjectFlags())).toBe(NEW_GAME);
  });
});

describe('older saves (migration)', () => {
  const STORY_FLAGS = ['GOT_POKEDEX', 'BATTLED_RIVAL_IN_OAKS_LAB', 'GOT_STARTER', 'OAK_ASKED_TO_CHOOSE_MON',
    'COMPLETED_CATCH_TRAINING', 'SPAWNED_OLD_MAN_1', 'GOT_TOWN_MAP'];
  const owners = Object.keys(file.mapFirst).filter(map => file.mapFirst[map] !== null);
  const npcsOf = Object.fromEntries(owners.map(map => [map, mapNpcs(map)]));
  /** overworld/story_state.ts's visibility rules as they stood before checkpoint-03b (commit 5742f34), with
   *  story/viridian_city.ts's viridianOldMenVisible. Frozen here as the migration's oracle; 03a ran this case
   *  against the live rules. A saved `Map:npcId` key hid its object before any rule ran. */
  function hiddenBefore03b(map: string, id: string, keys: readonly string[], flag: (name: string) => boolean): boolean {
    // Checkpoint-04's four objects did not exist in a pre-03b save. The cartridge starts them OFF,
    // and no story rule showed them, so migration's initial() leaves them hidden.
    if ((map === 'OaksLab' && id === 'prof2') || (map === 'BluesHouse' && id === 'daisy_walking')
      || (map === 'Route22' && (id === 'rival1' || id === 'rival2'))) return true;
    if (keys.includes(`${map}:${id}`)) return true;
    let hidden = false;
    if (map === 'PalletTown' && id === 'prof') hidden = true;
    if (map === 'OaksLab' && id === 'prof' && !flag('GOT_STARTER')) hidden = true;
    if (map === 'ViridianCity') {
      if (id === 'oldman_blocking') hidden = flag('GOT_POKEDEX');
      if (id === 'oldman2') hidden = !(flag('GOT_POKEDEX') && !flag('COMPLETED_CATCH_TRAINING'));
      if (id === 'oldman1') hidden = !flag('SPAWNED_OLD_MAN_1');
    }
    if (map === 'OaksLab') {
      if (flag('GOT_POKEDEX')) {
        if (id === 'prof') hidden = false;
        if (id === 'item_ball' || id === 'rival' || id === 'pokedex1' || id === 'pokedex2') hidden = true;
      } else if (flag('BATTLED_RIVAL_IN_OAKS_LAB')) {
        if (id === 'prof') hidden = false;
        if (id === 'item_ball' || id === 'rival') hidden = true;
      } else if (flag('GOT_STARTER')) {
        if (id === 'prof') hidden = false;
        if (id === 'item_ball') hidden = true;
      } else if (flag('OAK_ASKED_TO_CHOOSE_MON')) {
        if (id === 'prof') hidden = false;
      } else if (id === 'prof') hidden = true;
    }
    if (map === 'BluesHouse' && id === 'town_map' && flag('GOT_TOWN_MAP')) hidden = true;
    return hidden;
  }
  function today(keys: string[], flags: string[]): string[] {
    const out: string[] = [];
    for (const map of owners) for (const npc of npcsOf[map]) {
      if (toggleableObjectIndex(map, npc.objectId) !== null) {
        out.push(`${map}:${npc.id}=${hiddenBefore03b(map, npc.id, keys, name => flags.includes(name)) ? 'off' : 'on'}`);
      }
    }
    return out;
  }
  function migrated(keys: string[], flags: string[]): string[] {
    restoreFlags(flags);
    restoreToggleableObjectFlags(legacyToggleableObjectFlags(keys, hasFlag));
    const out: string[] = [];
    for (const map of owners) for (const npc of npcsOf[map]) {
      if (toggleableObjectIndex(map, npc.objectId) !== null) out.push(`${map}:${npc.id}=${isObjectHidden(map, npc.objectId) ? 'off' : 'on'}`);
    }
    return out;
  }
  const subsets = Array.from({ length: 1 << STORY_FLAGS.length }, (_, bits) => STORY_FLAGS.filter((_flag, i) => bits & (1 << i)));

  it('the key table is every map NPC with a toggle row, plus the Route 22 rival the Gym hides', () => {
    const expected: Record<string, number> = { 'Route22:rival1': 0x23 };
    for (const map of owners) for (const npc of npcsOf[map]) {
      const index = toggleableObjectIndex(map, npc.objectId);
      if (index !== null) expected[`${map}:${npc.id}`] = index;
    }
    // prof2, walking Daisy and Route 22's second rival were never a saved hiddenObjects key.
    const arrived = ['BluesHouse:daisy_walking', 'OaksLab:prof2', 'Route22:rival2'];
    for (const key of arrived) expect(LEGACY_HIDDEN_OBJECT_TOGGLES[key], key).toBeUndefined();
    const legacy = { ...expected };
    for (const key of arrived) delete legacy[key];
    expect(Object.keys(legacy)).toHaveLength(20);
    expect(LEGACY_HIDDEN_OBJECT_TOGGLES).toEqual(legacy);
    expect(expected['OaksLab:prof2']).toBe(TOGGLE.OAKS_LAB_OAK_2);
    expect(expected['BluesHouse:daisy_walking']).toBe(TOGGLE.DAISY_WALKING);
    expect(expected['Route22:rival2']).toBe(TOGGLE.ROUTE_22_RIVAL_2);
  });

  it('a save with no events and no keys is New Game; the function leaves the live flags alone', () => {
    hideObject(0xff);
    const live = hex(getToggleableObjectFlags());
    expect(hex(legacyToggleableObjectFlags([], noFlags))).toBe(NEW_GAME);
    expect(hex(legacyToggleableObjectFlags(['ViridianForest:potion1'], () => true))).not.toBe(NEW_GAME);
    expect(hex(getToggleableObjectFlags())).toBe(live);
  });

  it("gives every toggled NPC the visibility story_state.ts gave it before 03b, for all 128 event combinations", () => {
    expect(subsets).toHaveLength(128);
    for (const flags of subsets) expect([flags.join(), migrated([], flags)]).toEqual([flags.join(), today([], flags)]);
    // the resting states the story passes through
    const state = (flags: string[]) => migrated([], flags).filter(row => /^(OaksLab|ViridianCity|BluesHouse|PalletTown):/.test(row)).sort();
    expect(state([])).toEqual(['BluesHouse:daisy=on', 'BluesHouse:daisy_walking=off', 'BluesHouse:town_map=on',
      'OaksLab:item_ball=on', 'OaksLab:pokedex1=on', 'OaksLab:pokedex2=on', 'OaksLab:prof2=off', 'OaksLab:prof=off',
      'OaksLab:rival=on', 'PalletTown:prof=off', 'ViridianCity:oldman1=off', 'ViridianCity:oldman2=off',
      'ViridianCity:oldman_blocking=on']);
    expect(state(['OAK_ASKED_TO_CHOOSE_MON'])).toContain('OaksLab:prof=on');
    expect(state(['OAK_ASKED_TO_CHOOSE_MON', 'GOT_STARTER', 'BATTLED_RIVAL_IN_OAKS_LAB', 'GOT_POKEDEX', 'GOT_TOWN_MAP'])).toEqual([
      'BluesHouse:daisy=on', 'BluesHouse:daisy_walking=off', 'BluesHouse:town_map=off', 'OaksLab:item_ball=off',
      'OaksLab:pokedex1=off', 'OaksLab:pokedex2=off', 'OaksLab:prof2=off', 'OaksLab:prof=on', 'OaksLab:rival=off',
      'PalletTown:prof=off', 'ViridianCity:oldman1=off',
      'ViridianCity:oldman2=on', 'ViridianCity:oldman_blocking=off']);
    expect(state(['GOT_POKEDEX', 'COMPLETED_CATCH_TRAINING', 'SPAWNED_OLD_MAN_1']).filter(row => row.startsWith('Viridian'))).toEqual([
      'ViridianCity:oldman1=on', 'ViridianCity:oldman2=off', 'ViridianCity:oldman_blocking=off']);
  });

  it('a saved key hides its object whatever the events say, as it did before', () => {
    for (const key of Object.keys(LEGACY_HIDDEN_OBJECT_TOGGLES).filter(key => key !== 'Route22:rival1')) {
      for (const flags of [subsets[0], subsets[127], subsets[0b0000101], subsets[0b0101001]]) {
        expect([key, flags.join(), migrated([key], flags)]).toEqual([key, flags.join(), today([key], flags)]);
      }
      expect(migrated([key], [])).toContain(`${key}=off`);
    }
    // the item balls, the Old Amber and both of the Gym's hides, as a real save holds them
    const keys = ['ViridianForest:potion1', 'Route2:hp_up', 'Museum1F:old_amber', 'PewterCity:youngster', 'Route22:rival1'];
    restoreToggleableObjectFlags(legacyToggleableObjectFlags(keys, noFlags));
    const off = Array.from({ length: 0x100 }, (_, index) => index).filter(isToggledOff);
    const newGame = file.states.map((row, index) => row.on ? -1 : index).filter(index => index >= 0);
    expect(off).toEqual([...new Set([...newGame, 0x64, 0x1b, TOGGLE.OLD_AMBER, TOGGLE.GYM_GUY, TOGGLE.ROUTE_22_RIVAL_1])].sort((a, b) => a - b));
    expect(() => legacyToggleableObjectFlags(['OaksLab:nobody'], noFlags)).toThrow('legacy hidden object OaksLab:nobody has no toggle');
  });
});
