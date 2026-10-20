import { describe, it, expect, beforeAll } from 'vitest';
import { loadGameText } from '../text/game_text';
import { loadTextPrograms, getTextProgramData } from '../text/program_data';
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
  await loadGameText(); await loadTextPrograms();
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
    expect(gym.map(c => c.type)).toEqual(['displayOpen', 'printText', 'displayClose', 'facePlayer', 'pushPlayer', 'wait', 'setMapScript']);
    expect(gym[1]).toEqual({ type: 'printText', program: 'ViridianCityPrintGymLockedText.text' });
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
    expect(trigger[1]).toEqual({ type: 'printText', program: 'ViridianCityPrintOldManSleepyText.PrivatePropertyText' });
    expect(trigger.map(c => c.type)).toEqual(['displayOpen', 'printText', 'displayClose', 'facePlayer', 'pushPlayer', 'wait', 'setMapScript']);
    expect(buildSleepingOldManScript(false).map(c => c.type)).toEqual(['displayOpen', 'printText', 'displayClose', 'pushPlayer', 'wait', 'setMapScript']);
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
      { type: 'faceNpc', npcId: 'oldman2', direction: 'right', spriteIndex: 8 },
      { type: 'wait', frames: 6 },
      { type: 'facePlayer', direction: 'left' },
    ]);
    expect(script.map(c => c.type)).toEqual([
      'faceNpc', 'wait', 'facePlayer',
      'displayOpen', 'printText', 'wait', 'displayClose', 'setFlag', 'catchDemo', 'wait', 'setFlag', 'displayOpen', 'printText', 'displayClose',
      'moveNpc', 'hideNpc', 'setMapScript',
    ]);
    const texts = script.filter(c => c.type === 'printText').map(c => c.program);
    expect(texts).toEqual(['ViridianCityOldMan2Text.HadMyCoffeeNowText', 'ViridianCityOldMan2Text.LosingMyTouchText']);
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
      { type: 'moveNpc', npcId: 'oldman2', path: ['down', 'down', 'down', 'down', 'down', 'down'], spriteIndex: 8 });
    expect(script.some(c => c.type === 'tryPikachuMovement')).toBe(false);
  });

  it('elsewhere he walks right, then down 6 (MovementData1 falls through)', () => {
    const script = buildOldMan2Script(false, { x: 18, y: 10 });
    expect(script.map(c => c.type).slice(0, 2)).toEqual(['displayOpen', 'printText']); // no turn when talked to
    expect(script.find(c => c.type === 'moveNpc')).toEqual(
      { type: 'moveNpc', npcId: 'oldman2', path: ['right', 'down', 'down', 'down', 'down', 'down', 'down'], spriteIndex: 8 });
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
    const script = buildOldMan1Script();
    expect(script[1]).toEqual({ type: 'printText', program: 'ViridianCityPrintOldManText.WantMeToShowYouAgainText' });
    expect(script[2]).toEqual({ type: 'wait', frames: 2 });
    const ask = script[3]; expect(ask.type).toBe('yesNoChoice');
    if (ask.type !== 'yesNoChoice') throw new Error('Expected choice');
    expect(ask.yes.map(c => c.type)).toEqual(['printText', 'displayClose', 'clearFlag', 'catchDemo', 'wait', 'setFlag', 'displayOpen', 'printText', 'displayClose', 'setMapScript']);
    expect(ask.yes[0]).toEqual({ type: 'printText', program: 'ViridianCityPrintOldManText.WatchCloselyText' });
    expect(ask.yes[2]).toEqual({ type: 'clearFlag', flag: 'INITIAL_CATCH_TRAINING' });
    expect(ask.yes[5]).toEqual({ type: 'setFlag', flag: 'COMPLETED_CATCH_TRAINING_AGAIN' });
    expect(ask.yes[7]).toEqual({ type: 'printText', program: 'ViridianCityOldManYouNeedToWeakenTheTargetText', box: 'keep' });
    expect(endState(ask.yes)).toBe(POST_CATCH_TRAINING);
  });

  it('NO: "not good enough", state unchanged', () => {
    const ask = buildOldMan1Script()[3];
    if (ask.type !== 'yesNoChoice') throw new Error('Expected choice');
    expect(ask.no).toEqual([{ type: 'printText', program: 'ViridianCityPrintOldManText.NotGoodEnoughForYouText' },
      { type: 'displayClose', outerWait: true }]);
    expect(endState(ask.no)).toBeUndefined();
  });

  it('every text is real ROM text, not a missing-key placeholder', () => {
    const all = [...buildOldMan2Script(true, { x: 19, y: 9 }), ...buildGymLockedScript(), ...buildSleepingOldManScript(true)];
    const ask = buildOldMan1Script()[3];
    if (ask.type !== 'yesNoChoice') throw new Error('Expected choice');
    all.push(...ask.yes, ...ask.no, buildOldMan1Script()[1]);
    const programs = all.filter(c => c.type === 'printText');
    expect(programs.length).toBeGreaterThan(0);
    for (const c of programs) expect(getTextProgramData().programs[c.program], c.program).toBeDefined();
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
