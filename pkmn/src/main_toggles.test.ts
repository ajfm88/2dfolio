// V5c checkpoint-03b (note 93 §16): wToggleableObjectFlags through the real main — New Game, the save field,
// CONTINUE, the migration of saves made before 03b, and ViridianMartScript2.
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, world } from './test/main_battle_rig';
import { loadGame } from './save';
import { hasFlag, restoreFlags, setFlag } from './events';
import {
  TOGGLE, getToggleableObjectFlags, restoreToggleableObjectFlags, initializeToggleableObjectFlags,
  legacyToggleableObjectFlags, hideObject, showObject, isToggledOff,
} from './overworld/toggleable_objects';
import { toggleChanges } from './test/toggle_state';

const main = host as typeof host & { writeSave(): void; startNewGame(): Promise<void>; loadSavedGame(): Promise<void> };
const hex = (bytes: readonly number[]): string => bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
const NEW_GAME = '4d01fc0218220100161000000c600800c018000000000000000000409e270000';
const npc = (id: string) => host.overworldDeps().npcs.find(n => n.data.id === id)!;
let store: Map<string, string>;

beforeAll(() => loadMainBattleRig());
beforeEach(() => {
  resetMainBattleRig(); store = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
});
afterEach(() => { host.reset(); initializeToggleableObjectFlags(); vi.restoreAllMocks(); });

it("main's init fetches the toggle table", async () => {
  const fetched: string[] = [];
  const real = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => { fetched.push(String(url)); return real(url, init); });
  await host.init().catch(() => undefined); // later rig-less steps of init are not this case's concern
  expect(fetched.filter(url => url === 'toggleable_objects.json')).toHaveLength(1);
});

it('NEW GAME runs InitializeToggleableObjectsFlags over whatever the last game left', async () => {
  restoreToggleableObjectFlags(new Array<number>(32).fill(0xff));
  await main.startNewGame();
  expect(hex(getToggleableObjectFlags())).toBe(NEW_GAME);
});

it('a save holds the 32 flag bytes and no hiddenObjects; CONTINUE restores them and the map shows them', async () => {
  await world('ViridianForest', 5, 5);
  hideObject(0x64); hideObject(TOGGLE.GYM_GUY); showObject(TOGGLE.OLD_MAN_1);
  const flags = getToggleableObjectFlags();
  main.writeSave();
  const saved = loadGame()!;
  expect(saved.toggleableObjectFlags).toEqual(flags);
  expect(saved.toggleableObjectFlags).toHaveLength(32);
  expect('hiddenObjects' in saved).toBe(false);
  initializeToggleableObjectFlags();
  await main.loadSavedGame();
  expect(getToggleableObjectFlags()).toEqual(flags);
  expect([npc('potion1').hidden, npc('potion2').hidden]).toEqual([true, false]);
});

it('a save from before 03b: its keys and events become the flags, and the next save is in the new form', async () => {
  await world('ViridianForest', 5, 5);
  main.writeSave();
  const old = JSON.parse(store.get('p151-s')!) as Record<string, unknown>;
  delete old.toggleableObjectFlags;
  old.hiddenObjects = ['ViridianForest:potion2', 'PewterCity:youngster', 'Route22:rival1', 'Museum1F:old_amber'];
  old.eventFlags = ['OAK_ASKED_TO_CHOOSE_MON', 'GOT_STARTER', 'BATTLED_RIVAL_IN_OAKS_LAB', 'GOT_POKEDEX', 'COMPLETED_CATCH_TRAINING', 'GOT_TOWN_MAP'];
  store.set('p151-s', JSON.stringify(old));
  restoreToggleableObjectFlags(new Array<number>(32).fill(0xff));
  await main.loadSavedGame();
  expect(toggleChanges()).toEqual({
    hidden: [TOGGLE.LYING_OLD_MAN, TOGGLE.GYM_GUY, TOGGLE.TOWN_MAP, TOGGLE.OAKS_LAB_RIVAL, TOGGLE.STARTER_BALL_1,
      TOGGLE.POKEDEX_1, TOGGLE.POKEDEX_2, TOGGLE.OLD_AMBER, 0x65],
    shown: [TOGGLE.OAKS_LAB_OAK_1],
  });
  expect(getToggleableObjectFlags()).toEqual(legacyToggleableObjectFlags(old.hiddenObjects as string[], hasFlag));
  expect([npc('potion1').hidden, npc('potion2').hidden]).toEqual([false, true]);
  main.writeSave();
  const next = JSON.parse(store.get('p151-s')!) as Record<string, unknown>;
  expect(next.toggleableObjectFlags).toEqual(getToggleableObjectFlags());
  expect('hiddenObjects' in next).toBe(false);
  // an old save with neither field is New Game's flags under its events
  delete old.hiddenObjects; old.eventFlags = [];
  store.set('p151-s', JSON.stringify(old));
  await main.loadSavedGame();
  expect(hex(getToggleableObjectFlags())).toBe(NEW_GAME);
});

it('CONTINUE refuses malformed flag bytes and an unknown old key', async () => {
  await world('ViridianForest', 5, 5);
  main.writeSave();
  const good = JSON.parse(store.get('p151-s')!) as Record<string, unknown>;
  store.set('p151-s', JSON.stringify({ ...good, toggleableObjectFlags: (good.toggleableObjectFlags as number[]).slice(1) }));
  await expect(main.loadSavedGame()).rejects.toThrow('saved toggleable-object flags');
  const old = { ...good, hiddenObjects: ['OaksLab:nobody'] } as Record<string, unknown>;
  delete old.toggleableObjectFlags;
  store.set('p151-s', JSON.stringify(old));
  await expect(main.loadSavedGame()).rejects.toThrow('legacy hidden object OaksLab:nobody has no toggle');
});

it('ViridianMartScript2: entering the Mart after the catch training hides OLD_MAN_2 and shows OLD_MAN_1, once', async () => {
  restoreFlags(['GOT_STARTER', 'GOT_POKEDEX', 'GOT_OAKS_PARCEL', 'COMPLETED_CATCH_TRAINING']);
  initializeToggleableObjectFlags();
  showObject(TOGGLE.OLD_MAN_2); // as if still shown, so the script's own HideObject is visible
  await world('ViridianMart', 3, 5);
  expect(hasFlag('SPAWNED_OLD_MAN_1')).toBe(true);
  expect([isToggledOff(TOGGLE.OLD_MAN_2), isToggledOff(TOGGLE.OLD_MAN_1)]).toEqual([true, false]);
  // CheckAndSetEvent: with the event set the script returns before either toggle
  showObject(TOGGLE.OLD_MAN_2); hideObject(TOGGLE.OLD_MAN_1);
  await host.handleWarpLoad('ViridianMart', 0, { x: 3, y: 5 }); await host.finishFade();
  expect([isToggledOff(TOGGLE.OLD_MAN_2), isToggledOff(TOGGLE.OLD_MAN_1)]).toEqual([false, true]);
  // and before the catch training nothing happens
  restoreFlags(['GOT_STARTER', 'GOT_POKEDEX', 'GOT_OAKS_PARCEL']); initializeToggleableObjectFlags();
  await host.handleWarpLoad('ViridianMart', 0, { x: 3, y: 5 }); await host.finishFade();
  expect(hasFlag('SPAWNED_OLD_MAN_1')).toBe(false);
  expect(hex(getToggleableObjectFlags())).toBe(NEW_GAME);
  setFlag('GOT_STARTER');
});
