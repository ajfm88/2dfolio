// V5c checkpoint-03b (note 93 §16): the story scripts write the toggle flags themselves. After every command
// of every flow, the flags equal what the old-save migration derives from the events set so far, which the
// model's own test ties to the visibility rules story_state.ts had before 03b.
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { ScriptCommand } from '../script/types';
import { clearFlag, hasFlag, restoreFlags, setFlag } from '../events';
import {
  TOGGLE, LEGACY_HIDDEN_OBJECT_TOGGLES, initializeToggleableObjectFlags, getToggleableObjectFlags,
  legacyToggleableObjectFlags, hideObject, showObject, toggleableObjectIndex,
} from '../overworld/toggleable_objects';
import { toggleChanges } from '../test/toggle_state';
import { loadTextPrograms } from '../text/program_data';
import { loadBattleData } from '../battle';
import { Bag } from '../items';
import { buildOaksLabIntroScript, buildOaksLabRivalBattleScript, buildOaksLabPokedexScript } from './oaks_lab';
import { buildOldMan2Script, buildOldMan1Script } from './viridian_city';
import { daisyText } from './small_text_handlers';
import { museum1FScientist2Text } from './museum_1f';
import { pewterMuseumText, pewterYoungsterText } from './pewter_city';
import { getTextHandler } from './text_handlers';
import './pewter_gym';
import { itemBallScript } from '../overworld/item_pickup';
import { PEWTER_MUSEUM_COORDS, PEWTER_GYM_COORDS } from '../overworld/simulated_joypad';
import type { TextHandlerContext } from './text_handlers';

vi.mock('../audio', () => ({ playMusic: vi.fn(), stopMusic: vi.fn(), playSFX: vi.fn(), isSoundFinished: () => true, isSfxPlaying: () => false }));
vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false, isPassPressed: () => false, readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));

const hex = (bytes: readonly number[]): string => bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
const keyOf = Object.fromEntries(Object.entries(LEGACY_HIDDEN_OBJECT_TOGGLES).map(([key, index]) => [index, key]));
const ctx = (...flags: string[]): TextHandlerContext => ({ hasFlag: f => flags.includes(f) || hasFlag(f), bag: new Bag(),
  ownedCount: 1, facing: 'up', step: { x: 4, y: 3 }, party: [], findNpc: () => undefined });

beforeAll(async () => { await loadTextPrograms(); await loadBattleData(); });
beforeEach(() => { restoreFlags([]); initializeToggleableObjectFlags(); });

/** Every command of a list in order, nested lists (give-item branches, yes/no, escorts) included. */
function walk(commands: readonly ScriptCommand[], visit: (command: ScriptCommand) => void): void {
  for (const command of commands) {
    visit(command);
    for (const value of Object.values(command)) {
      if (Array.isArray(value) && value.length > 0 && value.every(item => item !== null && typeof item === 'object' && 'type' in item)) {
        walk(value as ScriptCommand[], visit);
      }
    }
  }
}

it('after every command of the story flows, the flags are what the old rules gave for the events so far', () => {
  const keys = new Set<string>(); // hideObject commands: what `hiddenObjects` held before 03b
  let writes = 0;
  const run = (name: string, commands: readonly ScriptCommand[]): void => {
    let n = 0;
    walk(commands, command => {
      n++;
      if (command.type === 'setFlag') {
        setFlag(command.flag);
        for (const toggle of command.hide ?? []) { hideObject(toggle); writes++; }
        for (const toggle of command.show ?? []) { showObject(toggle); writes++; }
      } else if (command.type === 'clearFlag') clearFlag(command.flag);
      else if (command.type === 'hideObject') { hideObject(command.toggle); keys.add(keyOf[command.toggle]); writes++; }
      else if (command.type === 'showObject') { showObject(command.toggle); keys.delete(keyOf[command.toggle]); writes++; }
      expect([`${name} #${n} ${command.type}`, hex(getToggleableObjectFlags())])
        .toEqual([`${name} #${n} ${command.type}`, hex(legacyToggleableObjectFlags([...keys], hasFlag))]);
    });
  };
  // the story in order
  run('lab intro', buildOaksLabIntroScript());
  expect(toggleChanges()).toEqual({ hidden: [TOGGLE.STARTER_BALL_1], shown: [TOGGLE.OAKS_LAB_OAK_1] });
  run('lab rival', buildOaksLabRivalBattleScript(5, 4, 5, 6));
  expect(toggleChanges()).toEqual({ hidden: [TOGGLE.OAKS_LAB_RIVAL, TOGGLE.STARTER_BALL_1], shown: [TOGGLE.OAKS_LAB_OAK_1] });
  run('lab pokedex', buildOaksLabPokedexScript(5, 4, () => ({ x: 80, y: 48, direction: 'up', hidden: true })));
  expect(toggleChanges()).toEqual({ hidden: [TOGGLE.LYING_OLD_MAN, TOGGLE.OAKS_LAB_RIVAL, TOGGLE.STARTER_BALL_1, TOGGLE.POKEDEX_1, TOGGLE.POKEDEX_2],
    shown: [TOGGLE.OLD_MAN_2, TOGGLE.OAKS_LAB_OAK_1] });
  run('old man 2', buildOldMan2Script(true, { x: 19, y: 9 }));
  expect(toggleChanges().shown).toEqual([TOGGLE.OAKS_LAB_OAK_1]);
  // ViridianMartScript2 as main.ts checkMapEntryScripts runs it (main_toggles.test.ts drives the real one)
  setFlag('GOT_OAKS_PARCEL'); setFlag('SPAWNED_OLD_MAN_1'); hideObject(TOGGLE.OLD_MAN_2); showObject(TOGGLE.OLD_MAN_1);
  run('old man 1', buildOldMan1Script());
  run('daisy', daisyText(ctx()));
  run('amber', museum1FScientist2Text(ctx()));
  run('museum guide', pewterMuseumText({ ...ctx(), step: PEWTER_MUSEUM_COORDS[0] }));
  run('gym guide', pewterYoungsterText({ ...ctx(), step: PEWTER_GYM_COORDS[0] }));
  run('brock', getTextHandler('PewterGym', 1)!(ctx('BEAT_BROCK')));
  run('ball', itemBallScript(toggleableObjectIndex('ViridianForest', 7)!, 'POTION'));
  expect(toggleChanges()).toEqual({
    hidden: [TOGGLE.LYING_OLD_MAN, TOGGLE.GYM_GUY, TOGGLE.TOWN_MAP, TOGGLE.OAKS_LAB_RIVAL, TOGGLE.STARTER_BALL_1,
      TOGGLE.POKEDEX_1, TOGGLE.POKEDEX_2, TOGGLE.OLD_AMBER, 0x64],
    shown: [TOGGLE.OLD_MAN_1, TOGGLE.OAKS_LAB_OAK_1],
  });
  expect([...keys].sort()).toEqual(['BluesHouse:town_map', 'Museum1F:old_amber', 'PewterCity:youngster', 'Route22:rival1', 'ViridianForest:potion1']);
  // 8 flag writes ride on the five deciding events; 7 hideObject and 2 showObject commands
  expect(writes).toBe(17);
});

it('only the five deciding events carry toggle writes, each with the toggles its ASM script names', () => {
  const carried: Record<string, { hide?: readonly number[]; show?: readonly number[] }> = {};
  const collect = (commands: readonly ScriptCommand[]): void => walk(commands, command => {
    if (command.type === 'setFlag' && (command.hide || command.show)) carried[command.flag] = { hide: command.hide, show: command.show };
  });
  for (const commands of [buildOaksLabIntroScript(), buildOaksLabRivalBattleScript(5, 4, 5, 6),
    buildOaksLabPokedexScript(5, 4, () => undefined), buildOldMan2Script(false, { x: 18, y: 9 }), buildOldMan1Script(),
    daisyText(ctx('GOT_POKEDEX')), museum1FScientist2Text(ctx()), getTextHandler('PewterGym', 1)!(ctx('BEAT_BROCK'))]) collect(commands);
  expect(carried).toEqual({
    OAK_ASKED_TO_CHOOSE_MON: { hide: undefined, show: [0x2d] },         // OaksLabToggleOaksScript: ShowObject OAK_1
    GOT_STARTER: { hide: [0x2c], show: undefined },                     // OaksLabRivalTakesPokeballScript
    BATTLED_RIVAL_IN_OAKS_LAB: { hide: [0x2b], show: undefined },       // OaksLabPlayerWatchRivalExitScript
    GOT_POKEDEX: { hide: [0x2e, 0x2f, 0x01], show: [0x03] },            // OaksLabOakGivesPokedexScript
    COMPLETED_CATCH_TRAINING: { hide: [0x03], show: undefined },        // ViridianCityOldManMovingDownScript
  });
});
