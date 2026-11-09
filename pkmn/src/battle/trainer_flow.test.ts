// Trainer battle flow — expected values from home/trainers.asm (PlayTrainerMusic,
// PrintEndBattleText), data/trainers/encounter_types.asm, engine/battle/core.asm
// (TrainerBattleVictory, HandlePlayerBlackOut), scroll_draw_trainer_pic.asm and
// scripts/OaksLab.asm. Detail: notes/04-v1c-plan.md §1.

import { describe, it, expect } from 'vitest';
import {
  meetMusicFor,
  rivalStarterAfterLabBattle, RIVAL_STARTER,
} from './trainer_flow';


describe('meet music (PlayTrainerMusic)', () => {
  it('plays the male track for any class not on a list', () => {
    for (const c of ['BUG_CATCHER', 'YOUNGSTER', 'HIKER', 'SAILOR', 'PROF_OAK']) {
      expect(meetMusicFor(c)).toBe('meetmaletrainer');
    }
  });

  it('plays the female track for FemaleTrainerList', () => {
    for (const c of ['LASS', 'JR_TRAINER_F', 'BEAUTY', 'COOLTRAINER_F']) {
      expect(meetMusicFor(c)).toBe('meetfemaletrainer');
    }
  });

  it('plays the evil track for EvilTrainerList', () => {
    for (const c of ['UNUSED_JUGGLER', 'GAMBLER', 'ROCKER', 'JUGGLER', 'CHIEF', 'SCIENTIST', 'GIOVANNI', 'ROCKET']) {
      expect(meetMusicFor(c)).toBe('meeteviltrainer');
    }
  });

  it('plays nothing for the rivals or a gym leader', () => {
    for (const c of ['RIVAL1', 'RIVAL2', 'RIVAL3']) expect(meetMusicFor(c)).toBeNull();
    expect(meetMusicFor('BROCK', true)).toBeNull();
    expect(meetMusicFor('GIOVANNI', true)).toBeNull(); // wGymLeaderNo is checked before the lists
  });
});

describe("rival's starter after the Oak's Lab battle", () => {
  it('is Flareon after a win and Vaporeon after a loss', () => {
    expect(rivalStarterAfterLabBattle(true)).toBe(RIVAL_STARTER.FLAREON);
    expect(rivalStarterAfterLabBattle(false)).toBe(RIVAL_STARTER.VAPOREON);
    expect(RIVAL_STARTER).toEqual({ JOLTEON: 1, FLAREON: 2, VAPOREON: 3 });
  });
});
