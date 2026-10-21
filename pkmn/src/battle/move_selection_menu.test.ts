import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPassPressed } from '../input';
import type { GameButton } from '../core';
import { textBgTransfer } from '../text/bg_transfer';
import { BattleScreen } from './battle_screen';
import { BattleTiles } from './battle_tiles';
import { addBonusPP, formatMovesString, getMaxPP, moveSelectionMenu } from './move_selection_menu';
import { delayFrames } from './battle_menu_context';
import type { BattleMenuContext, MenuMove, MoveMenuFlags, MoveMenuHost } from './battle_menu_context';
vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false), isHeld: () => false }));

const data = JSON.parse(readFileSync(resolve(__dirname, '../../data/moves.json'), 'utf8')) as Record<string, Omit<MenuMove, 'name'>>;
const names = JSON.parse(readFileSync(resolve(__dirname, '../../data/move_names.json'), 'utf8')) as Record<string, string>;
const moves = new Map(Object.entries(data).map(([key, move]) => [move.id, { ...move, name: names[key] }]));
const initialMoves = [1, 45, 84, 93]; // POUND, GROWL, THUNDERSHOCK, CONFUSION

function context(type: 0 | 1 | 2 = 0, count = 4): BattleMenuContext {
  const list = initialMoves.map((id, slot) => slot < count ? id : 0);
  const pp = list.map(id => id ? 5 : 0);
  return { moveMenuType: type, battleMoves: [...list], battlePP: [...pp], enemyMoves: [...list],
    party: [{ moves: [...list], pp: [...pp] }, { moves: [...list], pp: [...pp] }], playerMonNumber: 0,
    whichPokemon: 0, playerMoveListIndex: 0, menuItemToSwap: 0, currentMenuItem: 0, numMovesMinusOne: 3,
    movesString: '', playerDisabledMove: 0, transformed: false, playerSelectedMove: 99,
    playerMove: null, moveData: null, maxPP: 0, battleMenuCurrentPP: 0, whoseTurn: 1,
    monDataLocation: 0, usingPPUp: 1, ppUpCountAndMaxPP: 0,
    cursor: { topX: 0, topY: 0, item: 0, lastItem: 0, tileBehind: ' ', location: null } };
}

function rig(ctx = context(), portion = 0) {
  const screen = new BattleScreen();
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  for (let i = 0; i < portion; i++) screen.vblank();
  let frame = 0, keys: GameButton[] = [];
  const reads: number[] = [], sounds: number[] = [], texts: { program: string; at: number }[] = [];
  const restores: number[] = [];
  const host: MoveMenuHost = {
    tiles: new BattleTiles(screen),
    getMove: id => { const move = moves.get(id); if (!move) throw new Error(`unknown move ${id}`); return move; },
    readJoypad: () => { reads.push(frame); vi.mocked(isPassPressed).mockImplementation(key => keys.includes(key)); },
    pressSound: () => { sounds.push(frame); },
    printText: function* (program) { texts.push({ program, at: frame }); yield* delayFrames(2); },
    loadScreenTilesFromBuffer1: () => { restores.push(frame); for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, ' '); },
  };
  const program = moveSelectionMenu(ctx, host);
  let step = program.next();
  const tick = (...pressed: GameButton[]) => {
    keys = pressed; frame++;
    if (!step.done) {
      if (step.value === 'serviced') screen.vblank();
      // held/session frames service no second VBlank; none are expected in this routine.
      step = program.next();
    }
    return step;
  };
  const frames = (n: number) => { for (let i = 0; i < n; i++) tick(); };
  const row = (y: number, visible = false) => Array.from({ length: 20 }, (_, x) => String((visible ? screen.visibleAt(x, y) : screen.at(x, y)) ?? ' ')).join('');
  return { ctx, screen, host, reads, sounds, texts, restores, tick, frames, row,
    get frame() { return frame; }, get done() { return step.done; }, get result() { return step.value as MoveMenuFlags; } };
}

beforeEach(() => { vi.mocked(isPassPressed).mockReset(); vi.mocked(isPassPressed).mockReturnValue(false); });

describe('MoveSelectionMenu layouts and transfer/input timing', () => {
  for (const type of [0, 1, 2] as const) for (const count of [1, 2, 3, 4]) {
    it(`type ${type}, ${count} moves: exact box, names, dashes, junctions and first read`, () => {
      const r = rig(context(type, count));
      const x = type === 1 ? 0 : 4, top = type === 0 ? 12 : 7;
      expect(r.screen.at(x, top)).toBe(type === 0 ? '─' : '┌');
      expect(r.screen.at(x + 15, top)).toBe('┐');
      expect(r.screen.at(x + 15, top + 5)).toBe('┘');
      for (let slot = 0; slot < 4; slot++) {
        const name = slot < count ? moves.get(initialMoves[slot])!.name : '-';
        expect(r.row(top + slot + 1).slice(x + 2, x + 2 + name.length)).toBe(name);
      }
      const strings = initialMoves.slice(0, count).map(id => moves.get(id)!.name);
      expect(r.ctx.movesString).toBe(count === 4 ? strings.join('<NEXT>') + '<NEXT>@'
        : [...strings, ...Array(4 - count).fill('-')].join('<NEXT>') + '@');
      expect(r.ctx.numMovesMinusOne).toBe(count - 1);
      r.frames(type === 0 ? 5 : 2); expect(r.reads).toEqual([]);
      r.tick(); expect(r.reads).toEqual([type === 0 ? 6 : 3]);
      expect(r.screen.at(x + 1, top + 1)).toBe('▶');
      if (type === 0) {
        expect(r.screen.at(10, 12)).toBe('┘');
        expect(r.row(9).slice(1, 6)).toBe('TYPE/');
        expect(r.row(10).slice(2, 8)).toBe('NORMAL');
      } else if (type === 1) expect(r.row(14).slice(1, 17)).toBe('WHICH TECHNIQUE?');
      // Complete 360-cell fixtures, including untouched space outside the ASM's boxes.
      const expected = Array<string>(18).fill(' '.repeat(20));
      const labels = initialMoves.map((id, slot) => (slot < count ? moves.get(id)!.name : '-').padEnd(13));
      if (type === 0) {
        expected[8] = '┌─────────┐         ';
        expected[9] = '│TYPE/    │         ';
        expected[10] = '│ NORMAL  │         ';
        expected[11] = '│     5/35│         ';
        expected[12] = '└─────────┘────────┐';
        expected[17] = '    └──────────────┘';
      } else {
        expected[7] = type === 1 ? '┌──────────────┐    ' : '    ┌──────────────┐';
        expected[12] = type === 1 ? '└──────────────┘    ' : '    └──────────────┘';
        if (type === 1) expected[14] = ' WHICH TECHNIQUE?   ';
      }
      for (let slot = 0; slot < 4; slot++) expected[top + slot + 1] = (type === 1 ? '│' : '    │')
        + (slot === 0 ? '▶' : ' ') + labels[slot] + (type === 1 ? '│    ' : '│');
      expect(Array.from({ length: 18 }, (_, y) => r.row(y))).toEqual(expected);
    });
  }

  for (const portion of [0, 1, 2]) it(`phase ${portion}: TYPE halves and moved arrow transfer on separate thirds`, () => {
    const r = rig(context(), portion);
    const middle = [2, 1, 3][portion], bottom = [3, 2, 1][portion];
    r.frames(middle - 1); expect(r.row(9, true).slice(1, 6)).toBe('     ');
    r.tick(); expect(r.row(9, true).slice(1, 6)).toBe('TYPE/');
    r.frames(5 - r.frame);
    r.tick('down'); const moved = r.frame;
    expect(r.ctx.currentMenuItem).toBe(2);
    expect(r.screen.at(5, 13)).toBe('▶'); expect(r.screen.at(5, 14)).toBe(' ');
    r.frames(3); expect(r.screen.at(5, 13)).toBe(' '); expect(r.screen.at(5, 14)).toBe('▶');
    r.frames(bottom - 1); expect(r.screen.visibleAt(5, 14)).toBe(' ');
    r.tick(); expect(r.screen.visibleAt(5, 14)).toBe('▶');
    r.frames(moved + 6 - r.frame); expect(r.reads[r.reads.length - 1]).toBe(moved + 6);
  });

  for (const type of [1, 2] as const) for (const portion of [0, 1, 2]) {
    it(`type ${type}, phase ${portion}: middle and bottom portions copy only at their serviced VBlank`, () => {
      const r = rig(context(type), portion);
      for (let frame = 1; frame <= 3; frame++) {
        const copied = Array.from({ length: frame }, (_, i) => (portion + i) % 3);
        r.tick();
        expect(r.row(7, true)).toBe(copied.includes(1) ? r.row(7) : ' '.repeat(20));
        expect(r.row(12, true)).toBe(copied.includes(2) ? r.row(12) : ' '.repeat(20));
      }
      expect(r.reads).toEqual([3]);
    });
  }

  for (const type of [0, 1, 2] as const) it(`type ${type}: watched moves and both sentinel wraps cost ${type === 0 ? 6 : 3}`, () => {
    const r = rig(context(type, 2)), gap = type === 0 ? 6 : 3;
    r.frames(gap - 1); r.tick('up'); const first = r.frame;
    expect(r.ctx.currentMenuItem).toBe(2); // 1 -> sentinel0 -> last move
    expect(r.screen.at(type === 1 ? 1 : 5, type === 0 ? 12 : 7)).not.toBe('▶');
    r.frames(gap - 1); expect(r.reads).toEqual([first]);
    r.tick('down'); expect(r.ctx.currentMenuItem).toBe(1);
    r.frames(gap - 1); r.tick('down'); expect(r.ctx.currentMenuItem).toBe(2);
    expect(r.reads).toEqual([first, first + gap, first + gap * 2]);
    expect(r.sounds).toEqual([]);
  });

  it('irrelevant keys rearm only input Delay3, while idle polls read every frame', () => {
    const r = rig(); r.frames(5); r.tick('right'); expect(r.reads).toEqual([6]);
    r.frames(2); expect(r.reads).toEqual([6]); r.tick(); expect(r.reads).toEqual([6, 9]);
    r.tick(); expect(r.reads).toEqual([6, 9, 10]);
  });

  it('does not buffer an A edge pressed during the protected opening', () => {
    const r = rig(); r.tick('a'); r.frames(5); expect(r.done).toBe(false);
    r.tick('a'); expect(r.result).toEqual({ zero: true }); expect(r.sounds).toEqual([7]);
  });

  it('A+UP takes UP without moving, ahead of SELECT and B', () => {
    const r = rig(); r.frames(5); r.tick('a', 'up', 'select', 'b');
    expect(r.done).toBe(false); expect(r.ctx.currentMenuItem).toBe(1); expect(r.ctx.menuItemToSwap).toBe(0);
    r.frames(5); expect(r.reads).toEqual([6]); r.tick(); expect(r.reads).toEqual([6, 12]);
    expect(r.sounds).toEqual([6]);
  });
});

describe('move selection, text ports and PP side effects', () => {
  it('disabled hover retains previous move/scratch/PP bytes and prints only Disabled!', () => {
    const ctx = context(); ctx.playerDisabledMove = 0x25;
    const r = rig(ctx); r.frames(6);
    const old = { selected: ctx.playerSelectedMove, move: ctx.playerMove, data: ctx.moveData,
      pp: ctx.battleMenuCurrentPP, max: ctx.maxPP };
    r.tick('down');
    expect(r.row(10).slice(1, 10)).toBe('Disabled!');
    expect(r.row(9).slice(1, 10)).toBe('         ');
    expect({ selected: ctx.playerSelectedMove, move: ctx.playerMove, data: ctx.moveData,
      pp: ctx.battleMenuCurrentPP, max: ctx.maxPP }).toEqual(old);
  });

  it('no-PP refusal wins over disabled, then restores Buffer1 and reenters at the saved hovered row', () => {
    const ctx = context(); ctx.battlePP[1] = 0xc0; ctx.playerDisabledMove = 0x25; ctx.playerMoveListIndex = 1;
    const r = rig(ctx); r.frames(5); r.tick('a');
    expect(r.texts).toEqual([{ program: 'MoveNoPPText', at: 6 }]); expect(r.restores).toEqual([]);
    r.frames(2); expect(r.restores).toEqual([8]); expect(ctx.playerMoveListIndex).toBe(1);
    r.frames(5); expect(r.reads).toEqual([6]); r.tick(); expect(r.reads).toEqual([6, 14]);
  });

  it('disabled A uses MoveDisabledText and clears a pending swap on exit', () => {
    const ctx = context(); ctx.playerMoveListIndex = 1; ctx.playerDisabledMove = 0x25; ctx.menuItemToSwap = 4;
    const r = rig(ctx); r.frames(5); r.tick('a');
    expect(r.texts[0]).toEqual({ program: 'MoveDisabledText', at: 6 }); expect(ctx.menuItemToSwap).toBe(0);
    r.frames(2); expect(r.restores).toEqual([8]);
  });

  for (const disabled of [0, 0x25]) it(`Struggle masks PP-up bits and excludes disabled slot (${disabled}) before drawing`, () => {
    const ctx = context(); ctx.battlePP = [0xc0, disabled ? 5 : 0x40, 0x80, 0]; ctx.playerDisabledMove = disabled;
    const r = rig(ctx);
    expect(r.texts).toEqual([{ program: 'NoMovesLeftText', at: 0 }]); expect(ctx.playerSelectedMove).toBe(165);
    expect(r.screen.cells.every(cell => cell === ' ')).toBe(true);
    r.frames(61); expect(r.done).toBe(false); r.tick(); expect(r.result).toEqual({ zero: true });
    expect(r.reads).toEqual([]);
  });

  for (const type of [0, 1, 2] as const) it(`type ${type}: B chord return flags and saved-index ownership`, () => {
    const ctx = context(type); ctx.playerMoveListIndex = 2; ctx.menuItemToSwap = 4;
    const r = rig(ctx); r.frames(type === 0 ? 5 : 2); r.tick('a', 'b');
    expect(r.result).toEqual({ zero: false }); expect(ctx.currentMenuItem).toBe(type === 1 ? 0 : 2);
    expect(ctx.playerMoveListIndex).toBe(2); expect(ctx.menuItemToSwap).toBe(0);
  });

  for (const type of [0, 2] as const) it(`type ${type}: B remembers a newly hovered row`, () => {
    const r = rig(context(type)), gap = type === 0 ? 6 : 3;
    r.frames(gap - 1); r.tick('down'); r.frames(gap - 1); r.tick('b');
    expect(r.result).toEqual({ zero: false }); expect(r.ctx.playerMoveListIndex).toBe(1);
  });

  it('type 1 selects enemy moves and leaves the saved player index unchanged', () => {
    const ctx = context(1); ctx.enemyMoves = [93, 0, 0, 0]; ctx.playerMoveListIndex = 3;
    const r = rig(ctx); expect(r.row(8).slice(2, 11)).toBe('CONFUSION');
    r.frames(2); r.tick('a'); expect(r.result).toEqual({ zero: true }); expect(ctx.playerMoveListIndex).toBe(3);
  });

  it('type 2 lists the selected party slot, uses no TYPE box and remembers the chosen row', () => {
    const ctx = context(2); ctx.whichPokemon = 1; ctx.party[1].moves = [93, 84, 0, 0];
    const r = rig(ctx); expect(r.row(8).slice(6, 15)).toBe('CONFUSION');
    r.frames(2); r.tick('down'); r.frames(2); r.tick('a');
    expect(r.result).toEqual({ zero: true }); expect(ctx.playerMoveListIndex).toBe(1);
  });

  for (const [base, raw, max] of [[35, 5, 35], [35, 0xc5, 56], [40, 0xc5, 61]]) {
    it(`GetMaxPP base${base}/raw${raw} => ${max}, reset source/scratch and mask current PP`, () => {
      const ctx = context(); ctx.battleMoves[0] = base === 35 ? 1 : 45; ctx.battlePP[0] = raw;
      const r = rig(ctx); expect(ctx.maxPP).toBe(max); expect(ctx.battleMenuCurrentPP).toBe(5);
      expect(r.row(11).slice(5, 10)).toBe(` 5/${max}`);
      expect(ctx.usingPPUp).toBe(0); expect(ctx.monDataLocation).toBe(4); expect(ctx.whoseTurn).toBe(0);
      expect(ctx.whichPokemon).toBe(ctx.playerMonNumber); expect(ctx.playerMove?.id).toBe(ctx.battleMoves[0]);
    });
  }

  it('Transformed PP is current5/base35, and a Psychic move displays PSYCHIC', () => {
    const ctx = context(); ctx.transformed = true; ctx.battlePP[0] = 5;
    const r = rig(ctx); expect(r.row(11).slice(5, 10)).toBe(' 5/35');
    r.frames(5); r.tick('up'); expect(r.row(10).slice(2, 9)).toBe('PSYCHIC');
  });

  it('FormatMovesString stops on first zero and retains the old count on a malformed all-zero list', () => {
    const r = rig(context(1)); r.ctx.numMovesMinusOne = 2;
    formatMovesString(r.ctx, [0, 1, 0, 0], r.host);
    expect(r.ctx.movesString).toBe('-<NEXT>-<NEXT>-<NEXT>-@'); expect(r.ctx.numMovesMinusOne).toBe(2);
  });

  it('AddBonusPP retains byte wrapping and PP-Up-use exits after one increment', () => {
    expect(addBonusPP(35, 35)).toBe(35); expect(addBonusPP(40, 40)).toBe(40);
    expect(addBonusPP(35, 0xc0 | 35)).toBe(0xc0 | 56);
    expect(addBonusPP(40, 0xc0 | 40)).toBe(0xc0 | 61);
    expect(addBonusPP(35, 0x40 | 5, 1)).toBe(0x40 | 12);
    const r = rig(); getMaxPP(r.ctx, 0, r.host); expect(r.ctx.maxPP).toBe(35);
  });
});

describe('SELECT redraw and move swaps', () => {
  it('swaps raw PP, disabled high nibble and the active party slot, then returns cursor to saved index+1', () => {
    const ctx = context(); ctx.playerMonNumber = 1; ctx.playerDisabledMove = 0x25;
    ctx.battlePP = [5, 0xc5, 6, 7]; ctx.party[1].pp = [9, 0x85, 11, 12];
    const untouched = structuredClone(ctx.party[0]);
    const r = rig(ctx); r.frames(5); r.tick('down'); r.frames(5); r.tick('select');
    expect(ctx.menuItemToSwap).toBe(2); expect(ctx.currentMenuItem).toBe(1); expect(ctx.playerMoveListIndex).toBe(0);
    r.frames(6); expect(r.screen.at(5, 14)).toBe('▷');
    r.tick('up'); r.frames(5); r.tick('select');
    expect(ctx.battleMoves).toEqual([1, 93, 84, 45]); expect(ctx.battlePP).toEqual([5, 7, 6, 0xc5]);
    expect(ctx.playerDisabledMove).toBe(0x45); expect(ctx.party[1].moves).toEqual([1, 93, 84, 45]);
    expect(ctx.party[1].pp).toEqual([9, 12, 11, 0x85]); expect(ctx.party[0]).toEqual(untouched);
    expect(ctx.menuItemToSwap).toBe(0); expect(ctx.currentMenuItem).toBe(1);
  });

  it('same-slot SELECT self-swaps and clears the marker', () => {
    const r = rig(); const old = structuredClone(r.ctx.battleMoves);
    r.frames(5); r.tick('select'); r.frames(5); r.tick('select');
    expect(r.ctx.menuItemToSwap).toBe(0); expect(r.ctx.battleMoves).toEqual(old);
  });

  it('moves the disabled nibble from the current slot back to the marked slot', () => {
    const ctx = context(); ctx.playerDisabledMove = 0x45; ctx.menuItemToSwap = 2; ctx.playerMoveListIndex = 3;
    const r = rig(ctx); r.frames(5); r.tick('select');
    expect(ctx.playerDisabledMove).toBe(0x25); expect(ctx.battleMoves).toEqual([1, 93, 84, 45]);
  });

  it('Transformed SELECT preserves an already pending marker and redraws to the saved row', () => {
    const ctx = context(); ctx.transformed = true; ctx.menuItemToSwap = 3;
    const r = rig(ctx); r.frames(5); r.tick('select'); r.frames(3);
    expect(ctx.menuItemToSwap).toBe(3); expect(r.screen.at(5, 15)).toBe('▷');
    expect(ctx.battleMoves).toEqual(initialMoves);
  });

  it('Transformed SELECT redraws without setting a marker or touching either moves/PP copy', () => {
    const ctx = context(); ctx.transformed = true;
    const r = rig(ctx), before = structuredClone({ moves: ctx.battleMoves, pp: ctx.battlePP, party: ctx.party });
    r.frames(5); r.tick('select'); expect(ctx.menuItemToSwap).toBe(0); expect(ctx.currentMenuItem).toBe(1);
    r.frames(5); expect(r.reads).toEqual([6]); r.tick(); expect(r.reads).toEqual([6, 12]);
    expect({ moves: ctx.battleMoves, pp: ctx.battlePP, party: ctx.party }).toEqual(before);
  });

  for (const type of [1, 2] as const) it(`type ${type}: SELECT alone is ignored, SELECT+A reaches the raw swap handler ahead of B`, () => {
    const r = rig(context(type)); r.frames(2); r.tick('select'); expect(r.ctx.menuItemToSwap).toBe(0);
    r.frames(2); r.tick('select', 'a', 'b'); expect(r.done).toBe(false); expect(r.ctx.menuItemToSwap).toBe(1);
    expect(r.ctx.playerMoveListIndex).toBe(0); expect(r.sounds).toEqual([6]);
    r.frames(2); r.tick('select', 'a'); expect(r.ctx.menuItemToSwap).toBe(0);
  });

  for (const type of [1, 2] as const) it(`type ${type}: SELECT+A swaps battle/party bytes despite the displayed source`, () => {
    const ctx = context(type); ctx.menuItemToSwap = 2; ctx.playerMoveListIndex = 3;
    ctx.battlePP = [1, 0xc5, 2, 3];
    const r = rig(ctx); r.frames(2); r.tick('select', 'a');
    expect(ctx.battleMoves).toEqual(type === 1 ? [45, 1, 84, 93] : [1, 93, 84, 45]);
    expect(ctx.battlePP).toEqual(type === 1 ? [0xc5, 1, 2, 3] : [1, 3, 2, 0xc5]);
    expect(ctx.party[0].moves).toEqual(ctx.battleMoves); expect(ctx.menuItemToSwap).toBe(0);
  });
});
