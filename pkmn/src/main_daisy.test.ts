// V5c checkpoint-05 (note 93 §22): walking Daisy through the real main — BluesHouse_Script's entry event,
// PalletTownDaisyScript on the arrival pass, the house afterwards, the save, and a save from before 05.
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, tick, world } from './test/main_battle_rig';
import { hasFlag, restoreFlags, setFlag } from './events';
import { TOGGLE, initializeToggleableObjectFlags, hideObject, isToggledOff } from './overworld/toggleable_objects';
import { stageTogglesFromEvents, toggleChanges } from './test/toggle_state';
import { runMapScript } from './overworld/overworld_controller';
import { mapTextCall } from './text/map_text_calls';
import { Npc } from './overworld/npc';

const main = host as typeof host & { writeSave(): void; loadSavedGame(): Promise<void> };
const BASE = ['GOT_STARTER', 'GOT_POKEDEX', 'FOLLOWED_OAK_INTO_LAB', 'BATTLED_RIVAL_IN_OAKS_LAB'];
const npc = (id: string) => host.overworldDeps().npcs.find(n => n.data.id === id)!;
const daisies = (): boolean[] => [isToggledOff(TOGGLE.DAISY_SITTING), isToggledOff(TOGGLE.DAISY_WALKING)];
/** Arrive from a door warp as the game does: the fade's end leaves the overworld on the arrival pass. */
async function arrive(map: string, warp: number): Promise<void> {
  await host.handleWarpLoad(map, warp); await host.finishFade(); host.state = 'overworld';
}
let store: Map<string, string>;

beforeAll(() => loadMainBattleRig());
beforeEach(() => {
  resetMainBattleRig(); store = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
});
afterEach(() => { host.reset(); initializeToggleableObjectFlags(); vi.restoreAllMocks(); });

it("BluesHouse_Script sets EVENT_ENTERED_BLUES_HOUSE on the first pass inside, and nowhere else", async () => {
  await world('PalletTown', 5, 5);
  tick(); tick();
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(false);
  await arrive('BluesHouse', 0);
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(false); // set by the map script, not by the load
  tick(); tick();
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(true);
  expect([npc('daisy').hidden, npc('daisy_walking').hidden, npc('town_map').hidden]).toEqual([false, true, false]);
  expect(toggleChanges()).toEqual(expect.objectContaining({ shown: [TOGGLE.OLD_MAN_2, TOGGLE.OAKS_LAB_OAK_1] }));
  expect(daisies()).toEqual([false, true]); // the house itself never swaps them
});

it('the map scripts run on a zero-counter pass even while a door step is pending, and not on a moving pass', async () => {
  await world('BluesHouse', 2, 4);
  const deps = host.overworldDeps();
  const boundary = vi.spyOn(host.player, 'mapScriptBoundary', 'get');
  boundary.mockReturnValue(false);
  expect(runMapScript(deps, { ...host.ow, doorExitStep: false })).toBeNull();
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(false);
  boundary.mockReturnValue(true);
  expect(runMapScript(deps, { ...host.ow, doorExitStep: true })).toBeNull();
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(true);
});

it('leaving with the Town Map: Pallet swaps the Daisies on the arrival pass, with two extra UpdateSprites', async () => {
  await world('BluesHouse', 2, 4);
  tick(); tick();
  setFlag('GOT_TOWN_MAP'); hideObject(TOGGLE.TOWN_MAP); // Daisy's gift (small_text_handlers.test.ts drives it)
  await arrive('PalletTown', 1);
  expect(host.ow.doorExitStep).toBe(true);
  const door = { x: host.player.x, y: host.player.y };
  const updates = vi.spyOn(Npc.prototype, 'update');
  const girl = (): number => updates.mock.contexts.filter(self => (self as Npc).data.id === 'girl').length;
  let ticks = 0;
  while (!hasFlag('DAISY_WALKING') && ticks < 4) { tick(); ticks++; }
  expect(hasFlag('DAISY_WALKING')).toBe(true);
  // RunMapScript precedes PlayerStepOutFromDoor: the player has moved at most this pass's 2 px
  expect(host.player.x).toBe(door.x);
  expect(host.player.y - door.y).toBeLessThanOrEqual(2);
  expect(daisies()).toEqual([true, false]);
  // HideObject's and ShowObject's UpdateSprites, then the pass's own
  expect(girl()).toBe(3);
  const before = girl();
  tick(); tick();
  expect(girl() - before).toBe(1); // the next pass is an ordinary one
  expect(host.state).toBe('overworld');
});

it('before the Town Map, leaving the house changes nothing', async () => {
  await world('BluesHouse', 2, 4);
  tick(); tick();
  await arrive('PalletTown', 1);
  for (let i = 0; i < 40; i++) tick();
  expect(hasFlag('DAISY_WALKING')).toBe(false);
  expect(daisies()).toEqual([false, true]);
});

it('only Pallet Town swaps them: passes inside the house and on Route 1 with the Town Map change nothing', async () => {
  // PalletTownDaisyScript is PalletTown_Script's; Daisy stays seated for the rest of the visit (review R1)
  await world('BluesHouse', 2, 4);
  setFlag('GOT_TOWN_MAP'); hideObject(TOGGLE.TOWN_MAP);
  for (let i = 0; i < 40; i++) tick();
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(true);
  expect(hasFlag('DAISY_WALKING')).toBe(false);
  expect(daisies()).toEqual([false, true]);
  expect([npc('daisy').hidden, npc('daisy_walking').hidden]).toEqual([false, true]);
  await world('Route1', 5, 5, []);
  for (let i = 0; i < 40; i++) tick();
  expect(hasFlag('DAISY_WALKING')).toBe(false);
  expect(daisies()).toEqual([false, true]);
});

it('afterwards the house holds walking Daisy at (6,4), WALK UP_DOWN, with her own text, and no sitting Daisy', async () => {
  restoreFlags([...BASE, 'GOT_TOWN_MAP', 'ENTERED_BLUES_HOUSE']); stageTogglesFromEvents();
  await world('PalletTown', 5, 5);
  tick(); tick();
  expect(daisies()).toEqual([true, false]);
  await arrive('BluesHouse', 0);
  expect([npc('daisy').hidden, npc('daisy_walking').hidden, npc('town_map').hidden]).toEqual([true, false, true]);
  const walking = npc('daisy_walking');
  expect([walking.x, walking.y, walking.data.movement, walking.data.walkDir, walking.data.objectId, walking.data.textId])
    .toEqual([6 * 16, 4 * 16, 'walk', 'up_down', 2, 2]);
  expect(mapTextCall('BluesHouse', 2)).toEqual({ call: 'text', program: 'BluesHouseDaisyWalkingText' });
  // she stays through further visits to Pallet and back
  await arrive('PalletTown', 1);
  for (let i = 0; i < 40; i++) tick();
  await arrive('BluesHouse', 0);
  expect([npc('daisy').hidden, npc('daisy_walking').hidden]).toEqual([true, false]);
});

it('the save keeps the event and both toggles; CONTINUE in the house shows walking Daisy', async () => {
  restoreFlags([...BASE, 'GOT_TOWN_MAP', 'ENTERED_BLUES_HOUSE']); stageTogglesFromEvents();
  await world('PalletTown', 5, 5);
  tick(); tick();
  await world('BluesHouse', 2, 4, []);
  main.writeSave();
  restoreFlags([]); initializeToggleableObjectFlags();
  await main.loadSavedGame();
  expect(['DAISY_WALKING', 'ENTERED_BLUES_HOUSE', 'GOT_TOWN_MAP'].map(hasFlag)).toEqual([true, true, true]);
  expect(daisies()).toEqual([true, false]);
  expect([npc('daisy').hidden, npc('daisy_walking').hidden]).toEqual([true, false]);
});

it('a save from before checkpoint-05 that holds the Town Map gains ENTERED_BLUES_HOUSE, and Pallet then swaps', async () => {
  await world('PalletTown', 5, 5);
  main.writeSave();
  const old = JSON.parse(store.get('p151-s')!) as { eventFlags: string[] };
  old.eventFlags = [...BASE, 'GOT_TOWN_MAP'];
  store.set('p151-s', JSON.stringify(old));
  await main.loadSavedGame();
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(true);
  expect(hasFlag('DAISY_WALKING')).toBe(false);
  host.state = 'overworld';
  tick(); tick();
  expect(hasFlag('DAISY_WALKING')).toBe(true);
  expect(daisies()).toEqual([true, false]);
  // a save without the map gains nothing
  old.eventFlags = [...BASE];
  store.set('p151-s', JSON.stringify(old));
  await main.loadSavedGame();
  expect(hasFlag('ENTERED_BLUES_HOUSE')).toBe(false);
});
