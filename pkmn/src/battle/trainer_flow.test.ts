// Trainer battle flow — expected values from home/trainers.asm (PlayTrainerMusic,
// PrintEndBattleText), data/trainers/encounter_types.asm, engine/battle/core.asm
// (TrainerBattleVictory, HandlePlayerBlackOut), scroll_draw_trainer_pic.asm and
// scripts/OaksLab.asm. Detail: notes/04-v1c-plan.md §1.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  meetMusicFor, victoryMusicFor, battleTextPages, endBattleTextPages,
  picScrollX, PIC_SCROLL_FRAMES, PIC_SCROLL_FINAL_X, AFTER_PIC_SCROLL_DELAY,
  victorySequence, lossSequence, rivalStarterAfterLabBattle, RIVAL_STARTER,
  BATTLE_TEXT_WIDTH, trainerPicName,
} from './trainer_flow';

const MAPS_DIR = resolve(__dirname, '../../data/maps');

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

describe('victory music (TrainerBattleVictory)', () => {
  it('is defeatedtrainer, or defeatedgymleader for a gym leader or RIVAL3', () => {
    expect(victoryMusicFor('BUG_CATCHER')).toBe('defeatedtrainer');
    expect(victoryMusicFor('RIVAL1')).toBe('defeatedtrainer');
    expect(victoryMusicFor('BROCK', true)).toBe('defeatedgymleader');
    expect(victoryMusicFor('RIVAL3')).toBe('defeatedgymleader');
  });
});

describe('end-battle text (PrintEndBattleText)', () => {
  it('puts "NAME: " in front of the first line and pages two lines at a time', () => {
    expect(endBattleTextPages('BUG CATCHER', "No!\nCATERPIE can't\ncut it!")).toEqual([
      ['BUG CATCHER: No!', "CATERPIE can't"],
      ['cut it!'],
    ]);
  });

  it('starts a new page at a paragraph break', () => {
    expect(battleTextPages('a\nb\fc\nd\ne')).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it("keeps every map trainer's prefixed first line within the text box", () => {
    const trainerNames = JSON.parse(readFileSync(resolve(__dirname, '../../data/trainers.json'), 'utf-8'));
    let checked = 0;
    for (const file of readdirSync(MAPS_DIR)) {
      const map = JSON.parse(readFileSync(resolve(MAPS_DIR, file), 'utf-8'));
      for (const npc of map.npcs ?? []) {
        if (!npc.endBattleText) continue;
        const name = trainerNames[npc.trainerClass].displayName;
        const first = endBattleTextPages(name, npc.endBattleText)[0][0];
        expect(first.length, `${map.name}:${npc.id} "${first}"`).toBeLessThanOrEqual(BATTLE_TEXT_WIDTH);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(5); // the five Viridian Forest trainers
  });
});

describe('trainer pic scroll (_ScrollTrainerPicAfterBattle)', () => {
  it('moves one tile left every 4 frames, from tile 19 to tile 14', () => {
    expect(PIC_SCROLL_FRAMES).toBe(24);
    const xs = [0, 4, 8, 12, 16, 20].map(picScrollX);
    expect(xs).toEqual([152, 144, 136, 128, 120, 112]);
    expect(picScrollX(3)).toBe(152);
    expect(picScrollX(23)).toBe(112);
    expect(picScrollX(500)).toBe(PIC_SCROLL_FINAL_X);
  });
});

describe('victory sequence (TrainerBattleVictory)', () => {
  it('runs music → defeated → pic scroll → 40 frames → end text → money', () => {
    const steps = victorySequence({
      playerName: 'RED', trainerName: 'BUG CATCHER',
      endBattleText: "No!\nCATERPIE can't\ncut it!", moneyWon: 70,
    });
    expect(steps).toEqual([
      { type: 'victoryMusic' },
      { type: 'text', pages: [['RED defeated', 'BUG CATCHER!']] },
      { type: 'scrollPic' },
      { type: 'delay', frames: AFTER_PIC_SCROLL_DELAY },
      { type: 'text', pages: [['BUG CATCHER: No!', "CATERPIE can't"], ['cut it!']] },
      { type: 'text', pages: [['RED got ¥70', 'for winning!']] },
    ]);
    expect(AFTER_PIC_SCROLL_DELAY).toBe(40);
  });

  it('skips only the end text when none was saved', () => {
    const steps = victorySequence({ playerName: 'RED', trainerName: 'LASS', moneyWon: 90 });
    expect(steps.map(s => s.type)).toEqual(['victoryMusic', 'text', 'scrollPic', 'delay', 'text']);
  });
});

describe('loss sequence (HandlePlayerBlackOut)', () => {
  const texts = { rival1WinText: 'BLUE: Yeah! Am\nI great or what?', blackoutText: 'RED is out of\nuseable POKéMON!\fRED blacked\nout!' };

  it('prints only the blackout text against a map trainer', () => {
    const r = lossSequence({ trainerClass: 'BUG_CATCHER', mapName: 'ViridianForest', ...texts });
    expect(r.blackout).toBe(true);
    expect(r.steps).toEqual([{ type: 'blackout', pages: [['RED is out of', 'useable POKéMON!'], ['RED blacked', 'out!']] }]);
  });

  it("shows RIVAL1's pic and win text, with no blackout in Oak's Lab", () => {
    const r = lossSequence({ trainerClass: 'RIVAL1', mapName: 'OaksLab', ...texts });
    expect(r.blackout).toBe(false);
    expect(r.steps).toEqual([
      { type: 'scrollPic' },
      { type: 'delay', frames: 40 },
      { type: 'text', pages: [['BLUE: Yeah! Am', 'I great or what?']] },
    ]);
  });

  it('blacks out after the RIVAL1 text anywhere else', () => {
    const r = lossSequence({ trainerClass: 'RIVAL1', mapName: 'Route22', ...texts });
    expect(r.blackout).toBe(true);
    expect(r.steps.map(s => s.type)).toEqual(['scrollPic', 'delay', 'text', 'blackout']);
  });

  it('treats a wild battle like a map trainer', () => {
    expect(lossSequence({ trainerClass: null, mapName: 'Route1', ...texts }).blackout).toBe(true);
  });
});

describe('trainer pics', () => {
  // V1c found upstream loading pics by display name ("BUG CATCHER" → "bug catcher.png"),
  // which failed for 11 classes and left the game stuck before the battle.
  it('resolves every trainer class to an exported pic', () => {
    const classes = Object.keys(JSON.parse(readFileSync(resolve(__dirname, '../../data/trainers.json'), 'utf-8')));
    const files = new Set(readdirSync(resolve(__dirname, '../../static/gfx/trainers')));
    // CHIEF's ChiefPic isn't exported; no Yellow map or script uses the class
    const missing = classes.filter(c => c !== 'CHIEF' && !files.has(`${trainerPicName(c)}.png`));
    expect(missing).toEqual([]);
    expect(trainerPicName('BUG_CATCHER')).toBe('bugcatcher');
    expect(trainerPicName('PSYCHIC_TR')).toBe('psychic');
  });
});

describe("rival's starter after the Oak's Lab battle", () => {
  it('is Flareon after a win and Vaporeon after a loss', () => {
    expect(rivalStarterAfterLabBattle(true)).toBe(RIVAL_STARTER.FLAREON);
    expect(rivalStarterAfterLabBattle(false)).toBe(RIVAL_STARTER.VAPOREON);
    expect(RIVAL_STARTER).toEqual({ JOLTEON: 1, FLAREON: 2, VAPOREON: 3 });
  });
});
