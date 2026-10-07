// The catch demo — expected values from engine/battle/core.asm (DisplayBattleMenu
// .doSimulatedMenuInput, StartBattle, LoadPlayerBackPic), home/list_menu.asm,
// engine/items/item_effects.asm (ItemUseBall), engine/battle/animations.asm
// (TossBallAnimation) and data/text/text_{2,9}.asm. Detail: notes/v1d-plan.md §1.

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  catchDemoCaught, catchDemoBackPic, catchDemoNameKey, catchDemoSteps, tossBallAnims,
  CATCH_DEMO_BAG, HUD_DELAY_FRAMES, MENU_CURSOR_FRAMES, LIST_FROZEN_FRAMES,
  LIST_DRAW_FRAMES, LIST_CURSOR_FRAMES, THROW_DELAY_FRAMES,
} from './catch_demo';
import type { CatchDemoStep } from './catch_demo';
import { loadBattleData, getSpecies } from './data';

const gameText = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/game_text.json'), 'utf8'),
) as Record<string, string>;

const SO_CLOSE = gameText.BATTLE_SO_CLOSE;

function steps(caught: boolean, enemyName = 'RATTATA', demoName = 'OLD MAN'): CatchDemoStep[] {
  return catchDemoSteps({ enemyName, demoName, ballName: 'POKé BALL', caught, soCloseText: SO_CLOSE });
}

beforeAll(async () => {
  await loadBattleData();
});

describe('outcome (ItemUseBall .oldManBattle)', () => {
  it('always catches in the PIKACHU battle', () => {
    expect(catchDemoCaught('PIKACHU', false)).toBe(true);
    expect(catchDemoCaught('PIKACHU', true)).toBe(true);
  });

  it('fails the OLD_MAN throw only while EVENT_INITIAL_CATCH_TRAINING is set', () => {
    expect(catchDemoCaught('OLD_MAN', true)).toBe(false);
    expect(catchDemoCaught('OLD_MAN', false)).toBe(true);
  });
});

describe('back pics and names', () => {
  it('uses OldManPicBack / ProfOakPicBack, both exported', () => {
    expect(catchDemoBackPic('OLD_MAN')).toBe('/gfx/battle/oldmanb.png');
    expect(catchDemoBackPic('PIKACHU')).toBe('/gfx/battle/prof.oakb.png');
    for (const t of ['OLD_MAN', 'PIKACHU'] as const) {
      expect(existsSync(resolve(__dirname, '../../static', catchDemoBackPic(t).slice(1))), t).toBe(true);
    }
  });

  it('takes the temporary player name from the ROM strings', () => {
    expect(gameText[catchDemoNameKey('OLD_MAN')]).toBe('OLD MAN');
    expect(gameText[catchDemoNameKey('PIKACHU')]).toBe('PROF.OAK');
  });

  it('resolves both opponents (RATTATA, STARTER_PIKACHU)', () => {
    expect(getSpecies('RATTATA')?.id).toBe(19);
    expect(getSpecies('PIKACHU')?.id).toBe(25);
  });
});

describe('the simulated bag (SimulatedInputBattleItemList)', () => {
  it('holds exactly one POKé BALL', () => {
    expect(CATCH_DEMO_BAG).toEqual([{ id: 'POKE_BALL', count: 1 }]);
  });
});

describe('toss animations (TossBallAnimation)', () => {
  it('plays 4 animations when caught ($43)', () => {
    expect(tossBallAnims(true)).toEqual(['toss', 'poof', 'hide_pic', 'shake']);
  });

  it('plays 6 on a break-out ($63): the pic comes back', () => {
    expect(tossBallAnims(false)).toEqual(['toss', 'poof', 'hide_pic', 'shake', 'poof', 'show_pic']);
  });
});

describe('the step list', () => {
  it('runs the ASM frame counts in order before the throw', () => {
    const s = steps(true).slice(0, 7);
    expect(s).toEqual([
      { type: 'text', pages: [['Wild RATTATA', 'appeared!']] },
      { type: 'hud', frames: 40 },
      { type: 'menu', cursor: 0, frames: 20 },
      { type: 'menu', cursor: 2, frames: 30 },
      { type: 'bag', cursor: false, frames: 3 },
      { type: 'bag', cursor: true, frames: 20 },
      { type: 'throw_text', lines: ['OLD MAN used', 'POKé BALL!'], frames: 20 },
    ]);
    expect([HUD_DELAY_FRAMES, MENU_CURSOR_FRAMES, LIST_FROZEN_FRAMES, LIST_DRAW_FRAMES,
      LIST_CURSOR_FRAMES, THROW_DELAY_FRAMES]).toEqual([40, 20, 10, 3, 20, 20]);
  });

  it('ends a catch with "All right! / X was / caught!" (paged as V1c pages cont)', () => {
    const s = steps(true, 'PIKACHU', 'PROF.OAK');
    expect(s[6]).toEqual({ type: 'throw_text', lines: ['PROF.OAK used', 'POKé BALL!'], frames: 20 });
    expect(s.filter(x => x.type === 'anim')).toHaveLength(4);
    expect(s[s.length - 1]).toEqual({ type: 'text', pages: [['All right!', 'PIKACHU was'], ['caught!']] });
  });

  it('ends the old man\'s first demo with "Shoot! It was so / close too!"', () => {
    const s = steps(false);
    expect(s.filter(x => x.type === 'anim')).toHaveLength(6);
    expect(s[s.length - 1]).toEqual({ type: 'text', pages: [['Shoot! It was so', 'close too!']] });
  });
});
