// V5c checkpoint-05 (note 93 §22): PalletTown_Script's preamble and PalletTownDaisyScript, as a pure routine.
// scripts/PalletTown.asm:2–4 and :203–219.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllFlags, hasFlag, restoreFlags } from '../events';
import { TOGGLE, loadToggleableObjects, initializeToggleableObjectFlags, isToggledOff } from '../overworld/toggleable_objects';
import { toggleChanges } from '../test/toggle_state';
import { palletTownScript } from './pallet_town';

vi.mock('../audio', () => ({ playMusic: vi.fn(), stopMusic: vi.fn() }));

const READY =['FOLLOWED_OAK_INTO_LAB', 'GOT_TOWN_MAP', 'ENTERED_BLUES_HOUSE'];
const daisies = (): boolean[] => [isToggledOff(TOGGLE.DAISY_SITTING), isToggledOff(TOGGLE.DAISY_WALKING)];
/** One RunMapScript call; returns what each UpdateSprites saw. */
function pass(): string[] {
  const seen: string[] = [];
  palletTownScript(() => seen.push(`${hasFlag('DAISY_WALKING')}/${daisies().join(',')}`));
  return seen;
}

beforeAll(async () => { await loadToggleableObjects(); });
beforeEach(() => { restoreFlags([]); initializeToggleableObjectFlags(); });

describe('PalletTownDaisyScript', () => {
  it('swaps the two Daisies once, the event first, each toggle followed by its own UpdateSprites', () => {
    restoreFlags(READY);
    expect(daisies()).toEqual([false, true]); // New Game: sitting ON, walking OFF
    // SetEvent; HideObject TOGGLE_DAISY_SITTING (→ UpdateSprites); ShowObject TOGGLE_DAISY_WALKING (→ UpdateSprites)
    expect(pass()).toEqual(['true/true,true', 'true/true,false']);
    expect(toggleChanges()).toEqual({ hidden: [TOGGLE.DAISY_SITTING], shown: [TOGGLE.DAISY_WALKING] });
    expect(getAllFlags().sort()).toEqual([...READY, 'DAISY_WALKING'].sort());
    // EVENT_DAISY_WALKING set: straight to .next, nothing toggles and nothing updates
    expect(pass()).toEqual([]);
    expect(toggleChanges()).toEqual({ hidden: [TOGGLE.DAISY_SITTING], shown: [TOGGLE.DAISY_WALKING] });
  });

  it.each([
    ['no Town Map', ['FOLLOWED_OAK_INTO_LAB', 'ENTERED_BLUES_HOUSE']],
    ['never entered the house', ['FOLLOWED_OAK_INTO_LAB', 'GOT_TOWN_MAP']],
    ['neither', ['FOLLOWED_OAK_INTO_LAB']],
    ['the Oak scene has not ended (wPalletTownCurScript is not SCRIPT_PALLETTOWN_DAISY)', ['GOT_TOWN_MAP', 'ENTERED_BLUES_HOUSE']],
  ])('does nothing with %s', (_name, flags) => {
    restoreFlags(flags);
    expect(pass()).toEqual([]);
    expect(toggleChanges()).toEqual({ hidden: [], shown: [] });
    expect(getAllFlags().sort()).toEqual([...flags].sort());
  });

  it('with EVENT_DAISY_WALKING already set it does not swap again, whatever the flags say', () => {
    restoreFlags([...READY, 'DAISY_WALKING']);
    expect(pass()).toEqual([]);
    expect(daisies()).toEqual([false, true]);
  });
});

describe("the Poké Ball events (unreachable until Oak's gift is ported)", () => {
  it('the preamble sets PALLET_AFTER_GETTING_POKEBALLS in any script state, .next sets _2 only in the Daisy state', () => {
    restoreFlags(['GOT_POKEBALLS_FROM_OAK']);
    pass();
    expect(getAllFlags().sort()).toEqual(['GOT_POKEBALLS_FROM_OAK', 'PALLET_AFTER_GETTING_POKEBALLS']);
    restoreFlags(['GOT_POKEBALLS_FROM_OAK', 'FOLLOWED_OAK_INTO_LAB']);
    pass();
    expect(getAllFlags().sort()).toEqual(['FOLLOWED_OAK_INTO_LAB', 'GOT_POKEBALLS_FROM_OAK',
      'PALLET_AFTER_GETTING_POKEBALLS', 'PALLET_AFTER_GETTING_POKEBALLS_2']);
    restoreFlags(['FOLLOWED_OAK_INTO_LAB']);
    pass();
    expect(getAllFlags()).toEqual(['FOLLOWED_OAK_INTO_LAB']);
  });

  it('predef_jump ShowObject returns: the swapping pass skips .next, the following pass runs it', () => {
    restoreFlags([...READY, 'GOT_POKEBALLS_FROM_OAK']);
    expect(pass()).toHaveLength(2);
    expect(hasFlag('PALLET_AFTER_GETTING_POKEBALLS')).toBe(true);
    expect(hasFlag('PALLET_AFTER_GETTING_POKEBALLS_2')).toBe(false);
    expect(pass()).toEqual([]);
    expect(hasFlag('PALLET_AFTER_GETTING_POKEBALLS_2')).toBe(true);
  });
});
