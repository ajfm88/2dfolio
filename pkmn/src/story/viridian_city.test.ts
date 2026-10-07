import { describe, it, expect, beforeAll } from 'vitest';
import { loadGameText, getText } from '../text/game_text';
import type { ScriptCommand } from '../script';
import {
  ViridianScript, viridianCityStep, initialViridianScript, viridianOldMenVisible,
  martSpawnsOldMan, buildSleepingOldManScript, buildGymLockedScript,
  buildOldMan2Script, buildOldMan1Script,
} from './viridian_city';

const flags = (...set: string[]) => (f: string) => set.includes(f);
const OTHER_7 = ['BADGE_1', 'BADGE_2', 'BADGE_3', 'BADGE_4', 'BADGE_5', 'BADGE_6', 'BADGE_7'];
const { DEFAULT, AFTER_POKEDEX, POST_CATCH_TRAINING } = ViridianScript;

/** The state a command list leaves the city in (its last setMapScript), if any. */
function endState(commands: ScriptCommand[]): number | undefined {
  const sets = commands.filter(c => c.type === 'setMapScript');
  const last = sets[sets.length - 1];
  return last && last.type === 'setMapScript' ? last.state : undefined;
}

beforeAll(async () => {
  await loadGameText();
});

describe('Viridian City map script — which check fires (scripts/ViridianCity.asm)', () => {
  it('DEFAULT: the sleeping old man at (19,9), whatever the facing', () => {
    expect(viridianCityStep(DEFAULT, 19, 9, flags()).trigger).toBe('sleepingOldMan');
    expect(viridianCityStep(DEFAULT, 19, 10, flags()).trigger).toBeNull();
    expect(viridianCityStep(DEFAULT, 20, 9, flags()).trigger).toBeNull();
  });

  it('AFTER_POKEDEX: the waiting old man at (19,9) until the demo is done', () => {
    expect(viridianCityStep(AFTER_POKEDEX, 19, 9, flags('GOT_POKEDEX')).trigger).toBe('waitingOldMan');
    expect(viridianCityStep(AFTER_POKEDEX, 19, 9, flags('GOT_POKEDEX', 'COMPLETED_CATCH_TRAINING')).trigger).toBeNull();
  });

  it('POST_CATCH_TRAINING: nothing at (19,9)', () => {
    expect(viridianCityStep(POST_CATCH_TRAINING, 19, 9, flags()).trigger).toBeNull();
    expect(viridianCityStep(POST_CATCH_TRAINING, 19, 9, flags('GOT_POKEDEX')).trigger).toBeNull();
  });

  it('the Gym door step (32,8) is locked in all three resting states', () => {
    for (const state of [DEFAULT, AFTER_POKEDEX, POST_CATCH_TRAINING]) {
      expect(viridianCityStep(state, 32, 8, flags()).trigger).toBe('gymLocked');
    }
    expect(viridianCityStep(DEFAULT, 32, 9, flags()).trigger).toBeNull();
  });

  it('exactly the seven other badges open the Gym, anywhere in the city', () => {
    expect(viridianCityStep(POST_CATCH_TRAINING, 5, 5, flags(...OTHER_7))).toEqual({ openGym: true, trigger: null });
    expect(viridianCityStep(POST_CATCH_TRAINING, 32, 8, flags(...OTHER_7)).trigger).toBeNull();
    // cp ~(1 << BIT_EARTHBADGE) is an equality: all eight, or six, don't open it
    expect(viridianCityStep(POST_CATCH_TRAINING, 32, 8, flags(...OTHER_7, 'BADGE_8')).trigger).toBe('gymLocked');
    expect(viridianCityStep(POST_CATCH_TRAINING, 32, 8, flags(...OTHER_7.slice(1))).trigger).toBe('gymLocked');
  });

  it('an open Gym stays open', () => {
    expect(viridianCityStep(DEFAULT, 32, 8, flags('VIRIDIAN_GYM_OPEN'))).toEqual({ openGym: false, trigger: null });
  });
});

describe('Viridian City — resting states each script leaves behind', () => {
  it('the Gym push-back ends in POST_CATCH_TRAINING, which turns the old-man checks off (Gen 1 quirk)', () => {
    const gym = buildGymLockedScript();
    expect(gym.map(c => c.type)).toEqual(['text', 'facePlayer', 'pushPlayer', 'wait', 'setMapScript']);
    expect(gym[0]).toEqual({ type: 'text', message: getText('VIRIDIAN_GYM_LOCKED') });
    expect(endState(gym)).toBe(POST_CATCH_TRAINING);
    // …so before the Pokédex, (19,9) no longer stops the player
    expect(viridianCityStep(endState(gym)!, 19, 9, flags()).trigger).toBeNull();
  });

  it('the sleeping old man returns the city to DEFAULT — talking to him re-arms (19,9)', () => {
    expect(endState(buildSleepingOldManScript(true))).toBe(DEFAULT);
    expect(endState(buildSleepingOldManScript(false))).toBe(DEFAULT);
  });

  it('the sleeping old man: the trigger faces the player down first, talking does not', () => {
    const trigger = buildSleepingOldManScript(true);
    expect(trigger[0]).toEqual({ type: 'text', message: getText('VIRIDIAN_OLDMAN_PRIVATE_PROPERTY') });
    expect(trigger.map(c => c.type)).toEqual(['text', 'facePlayer', 'pushPlayer', 'wait', 'setMapScript']);
    expect(buildSleepingOldManScript(false).map(c => c.type)).toEqual(['text', 'pushPlayer', 'wait', 'setMapScript']);
  });

  it('saves from before V1e get their state from the events', () => {
    expect(initialViridianScript(flags())).toBe(DEFAULT);
    expect(initialViridianScript(flags('GOT_POKEDEX'))).toBe(AFTER_POKEDEX);
    expect(initialViridianScript(flags('GOT_POKEDEX', 'COMPLETED_CATCH_TRAINING'))).toBe(POST_CATCH_TRAINING);
  });
});

describe('Viridian City — the first catch demo (OLD_MAN2)', () => {
  it('stepping on (19,9): he turns right (6 frames), the player left, then the demo fails', () => {
    const script = buildOldMan2Script(true, { x: 19, y: 9 });
    expect(script.slice(0, 3)).toEqual([
      { type: 'faceNpc', npcId: 'oldman2', direction: 'right' },
      { type: 'wait', frames: 6 },
      { type: 'facePlayer', direction: 'left' },
    ]);
    expect(script.map(c => c.type)).toEqual([
      'faceNpc', 'wait', 'facePlayer',
      'text', 'wait', 'setFlag', 'catchDemo', 'wait', 'setFlag', 'text',
      'moveNpc', 'hideNpc', 'setMapScript',
    ]);
    const texts = script.filter(c => c.type === 'text').map(c => c.type === 'text' && c.message);
    expect(texts).toEqual([getText('VIRIDIAN_OLDMAN_COFFEE'), getText('VIRIDIAN_OLDMAN_LOSING_TOUCH')]);
    // EVENT_INITIAL_CATCH_TRAINING before the battle: the ball fails; it is never cleared here
    expect(script.filter(c => c.type === 'setFlag')).toEqual([
      { type: 'setFlag', flag: 'INITIAL_CATCH_TRAINING' },
      { type: 'setFlag', flag: 'COMPLETED_CATCH_TRAINING' },
    ]);
    expect(script.some(c => c.type === 'clearFlag')).toBe(false);
    expect(script.find(c => c.type === 'catchDemo')).toEqual({ type: 'catchDemo', battleType: 'OLD_MAN', species: 'RATTATA', level: 5 });
    expect(endState(script)).toBe(POST_CATCH_TRAINING);
  });

  it('at x = 19 he walks down 6, and ViridianCityMovePikachu is skipped', () => {
    const script = buildOldMan2Script(true, { x: 19, y: 9 });
    expect(script.find(c => c.type === 'moveNpc')).toEqual(
      { type: 'moveNpc', npcId: 'oldman2', path: ['down', 'down', 'down', 'down', 'down', 'down'] });
    expect(script.some(c => c.type === 'tryPikachuMovement')).toBe(false);
  });

  it('elsewhere he walks right, then down 6 (MovementData1 falls through)', () => {
    const script = buildOldMan2Script(false, { x: 18, y: 10 });
    expect(script.map(c => c.type).slice(0, 2)).toEqual(['text', 'wait']); // no turn when talked to
    expect(script.find(c => c.type === 'moveNpc')).toEqual(
      { type: 'moveNpc', npcId: 'oldman2', path: ['right', 'down', 'down', 'down', 'down', 'down', 'down'] });
  });

  it('elsewhere ViridianCityMovePikachu always comes first; its guard is checked when it runs', () => {
    const script = buildOldMan2Script(false, { x: 18, y: 10 });
    const i = script.findIndex(c => c.type === 'tryPikachuMovement');
    expect(script[i]).toEqual({ type: 'tryPikachuMovement', caller: 'viridianStepAside' });
    expect(script[i + 1].type).toBe('moveNpc');
  });
});

describe('Viridian City — the old men\'s visibility and the Mart', () => {
  it('follows TOGGLE_LYING_OLD_MAN / TOGGLE_OLD_MAN_2 / TOGGLE_OLD_MAN_1', () => {
    expect(viridianOldMenVisible(flags())).toEqual({ oldman_blocking: true, oldman2: false, oldman1: false });
    expect(viridianOldMenVisible(flags('GOT_POKEDEX'))).toEqual({ oldman_blocking: false, oldman2: true, oldman1: false });
    expect(viridianOldMenVisible(flags('GOT_POKEDEX', 'COMPLETED_CATCH_TRAINING')))
      .toEqual({ oldman_blocking: false, oldman2: false, oldman1: false });
    expect(viridianOldMenVisible(flags('GOT_POKEDEX', 'COMPLETED_CATCH_TRAINING', 'SPAWNED_OLD_MAN_1')))
      .toEqual({ oldman_blocking: false, oldman2: false, oldman1: true });
  });

  it('ViridianMartScript2 spawns the walking old man once, after the first demo', () => {
    expect(martSpawnsOldMan(flags('GOT_OAKS_PARCEL'))).toBe(false);
    expect(martSpawnsOldMan(flags('GOT_OAKS_PARCEL', 'COMPLETED_CATCH_TRAINING'))).toBe(true);
    expect(martSpawnsOldMan(flags('GOT_OAKS_PARCEL', 'COMPLETED_CATCH_TRAINING', 'SPAWNED_OLD_MAN_1'))).toBe(false);
  });
});

describe('Viridian City — the repeat demo (OLD_MAN)', () => {
  it('YES: "Dandy!", clears INITIAL_CATCH_TRAINING (caught), then "weaken the target"', () => {
    const [ask] = buildOldMan1Script();
    expect(ask.type).toBe('yesNo');
    if (ask.type !== 'yesNo') return;
    expect(ask.message).toBe(getText('VIRIDIAN_OLDMAN_SHOW_AGAIN'));
    expect(ask.yesBranch.map(c => c.type)).toEqual(['text', 'clearFlag', 'catchDemo', 'wait', 'setFlag', 'text', 'setMapScript']);
    expect(ask.yesBranch[0]).toEqual({ type: 'text', message: getText('VIRIDIAN_OLDMAN_WATCH_CLOSELY') });
    expect(ask.yesBranch[1]).toEqual({ type: 'clearFlag', flag: 'INITIAL_CATCH_TRAINING' });
    expect(ask.yesBranch[4]).toEqual({ type: 'setFlag', flag: 'COMPLETED_CATCH_TRAINING_AGAIN' });
    expect(ask.yesBranch[5]).toEqual({ type: 'text', message: getText('VIRIDIAN_OLDMAN_WEAKEN_TARGET') });
    expect(endState(ask.yesBranch)).toBe(POST_CATCH_TRAINING);
  });

  it('NO: "not good enough", state unchanged', () => {
    const [ask] = buildOldMan1Script();
    if (ask.type !== 'yesNo') return;
    expect(ask.noBranch).toEqual([{ type: 'text', message: getText('VIRIDIAN_OLDMAN_NOT_GOOD_ENOUGH') }]);
  });

  it('every text is real ROM text, not a missing-key placeholder', () => {
    const all = [...buildOldMan2Script(true, { x: 19, y: 9 }), ...buildGymLockedScript(), ...buildSleepingOldManScript(true)];
    const [ask] = buildOldMan1Script();
    if (ask.type === 'yesNo') all.push(...ask.yesBranch, ...ask.noBranch, { type: 'text', message: ask.message });
    for (const c of all) {
      if (c.type === 'text') expect(c.message).not.toMatch(/^\[/);
    }
  });
});

describe('the demo gates are gone from the committed data (V1e)', () => {
  it('no "demo" text anywhere in data/game_text.json or data/maps/*.json', async () => {
    const { readFileSync, readdirSync } = await import('fs');
    const { resolve } = await import('path');
    const dataDir = resolve(__dirname, '../../data');
    const files = ['game_text.json', ...readdirSync(resolve(dataDir, 'maps')).map(f => `maps/${f}`)];
    const hits = files.filter(f => /demo/i.test(readFileSync(resolve(dataDir, f), 'utf-8')));
    expect(hits).toEqual([]);
  });
});
