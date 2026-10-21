// core.asm:2567–3085; battle/misc.asm; item_effects.asm GetMaxPP/AddBonusPP.
// Unused until A5c3. CPU work runs between yields; the host alone services VBlank.
import { isPassPressed } from '../input';
import type { GameButton } from '../core';
import { MenuInput } from '../menus/menu_input';
import { eraseMenuCursor, placeMenuCursor, placeString, textBoxBorder, writeNumber } from '../menus/tile_surface';
import type { MenuCursorState } from '../menus/tile_surface';
import { textBgTransfer } from '../text/bg_transfer';
import { moveTypeDisplayName } from './type_names';
import { delayFrames } from './battle_menu_context';
import type { BattleMenuContext, MoveMenuFlags, MoveMenuHost, Program } from './battle_menu_context';

const STRUGGLE = 165;
const KEYS: readonly GameButton[] = ['a', 'b', 'select', 'start', 'right', 'left', 'up', 'down'];

export function formatMovesString(ctx: BattleMenuContext, moves: readonly number[], host: MoveMenuHost): void {
  let text = '', empty = false;
  for (let row = 0; row < 4; row++) {
    const id = moves[row] ?? 0;
    if (!id) empty = true; // first zero terminates names, even if a later byte is nonzero
    if (empty) text += '-' + (row === 3 ? '' : '<NEXT>');
    else {
      text += host.getMove(id).name + '<NEXT>';
      ctx.numMovesMinusOne = row;
    }
  }
  ctx.movesString = text + '@';
}

/** AddBonusPP's byte arithmetic, including the zero-count 256-iteration wrap. CPU only. */
export function addBonusPP(base: number, ppByte: number, usingPPUp = 0): number {
  let count = (ppByte >> 6) & 3, value = ppByte;
  do {
    value = (value + Math.min(Math.floor(base / 5), 7)) & 0xff;
    if (usingPPUp === 1) break;
    count = (count - 1) & 0xff;
  } while (count !== 0);
  return value;
}

export function getMaxPP(ctx: BattleMenuContext, slot: number, host: MoveMenuHost): void {
  const move = host.getMove(ctx.battleMoves[slot]);
  ctx.moveData = { ...move };
  ctx.usingPPUp = 0;
  ctx.ppUpCountAndMaxPP = addBonusPP(move.pp, (ctx.battlePP[slot] & 0xc0) | move.pp, ctx.usingPPUp);
  ctx.maxPP = ctx.ppUpCountAndMaxPP & 0x3f;
}

/** Writes STRUGGLE before testing availability, even when a chooser will be drawn. */
export function anyMoveToSelect(ctx: BattleMenuContext): boolean {
  ctx.playerSelectedMove = STRUGGLE;
  const disabled = ctx.playerDisabledMove >>> 4;
  let pp = 0;
  for (let slot = 0; slot < 4; slot++) if (slot + 1 !== disabled) pp |= ctx.battlePP[slot] ?? 0;
  return (pp & 0x3f) !== 0;
}

export function* printMenuItem(ctx: BattleMenuContext, host: MoveMenuHost): Program {
  const tiles = host.tiles;
  textBgTransfer.enabled = false;
  textBoxBorder(tiles, 0, 8, 3, 9);
  if (ctx.playerDisabledMove !== 0 && ctx.currentMenuItem === (ctx.playerDisabledMove >>> 4)) {
    placeString(tiles, 1, 10, 'Disabled!');
  } else {
    const slot = ctx.currentMenuItem - 1;
    ctx.whoseTurn = 0;
    ctx.playerSelectedMove = ctx.battleMoves[slot];
    ctx.whichPokemon = ctx.playerMonNumber;
    ctx.monDataLocation = 4;
    getMaxPP(ctx, slot, host);
    ctx.battleMenuCurrentPP = ctx.battlePP[slot] & 0x3f;
    placeString(tiles, 1, 9, 'TYPE');
    tiles.put(5, 9, '/'); tiles.put(7, 11, '/');
    writeNumber(tiles, 5, 11, ctx.battleMenuCurrentPP, { digits: 2, leadingZeroes: false });
    writeNumber(tiles, 8, 11, ctx.maxPP, { digits: 2, leadingZeroes: false });
    ctx.playerMove = { ...host.getMove(ctx.playerSelectedMove) }; // GetCurrentMove
    placeString(tiles, 2, 10, moveTypeDisplayName(ctx.playerMove.type));
  }
  textBgTransfer.enabled = true;
  yield* delayFrames(3);
}

export function swapMovesInMenu(ctx: BattleMenuContext): void {
  if (ctx.transformed) return;
  if (ctx.menuItemToSwap === 0) { ctx.menuItemToSwap = ctx.currentMenuItem; return; }
  const first = ctx.menuItemToSwap - 1, second = ctx.currentMenuItem - 1;
  const swap = (values: number[]) => { [values[first], values[second]] = [values[second], values[first]]; };
  swap(ctx.battleMoves); swap(ctx.battlePP);
  const disabled = ctx.playerDisabledMove >>> 4;
  const next = disabled === second + 1 ? first + 1 : disabled === first + 1 ? second + 1 : disabled;
  ctx.playerDisabledMove = (next << 4) | (ctx.playerDisabledMove & 0x0f);
  const party = ctx.party[ctx.playerMonNumber];
  swap(party.moves); swap(party.pp);
  ctx.menuItemToSwap = 0;
}

function* handleInput(ctx: BattleMenuContext, host: MoveMenuHost, cursor: MenuCursorState): Program<GameButton[]> {
  const watched: readonly GameButton[] = ctx.moveMenuType === 1 ? ['up', 'down', 'a']
    : ctx.moveMenuType === 2 ? ['up', 'down', 'a', 'b'] : ['up', 'down', 'select', 'a', 'b'];
  const menu = new MenuInput({ watched, topX: cursor.topX, topY: cursor.topY, rowStep: 1,
    maxItem: ctx.numMovesMinusOne + 2, item: ctx.currentMenuItem, watchOutOfBounds: false });
  cursor.item = ctx.currentMenuItem;
  placeMenuCursor(host.tiles, cursor);
  for (;;) {
    yield 'serviced';
    let fresh: GameButton[] = [];
    const hit = menu.update(() => {
      host.readJoypad(); fresh = KEYS.filter(key => isPassPressed(key));
    }, () => host.pressSound());
    ctx.currentMenuItem = menu.item;
    if (hit) return hit; // caller sees raw bits, not just watched ones
    if (fresh.length) { // unwatched key reentered loop1, so redraw now and wait input Delay3 only
      cursor.item = menu.item;
      placeMenuCursor(host.tiles, cursor);
    }
  }
}

/** SelectMenuItem and both sentinel-wrap handlers. A redraw result reenters MoveSelectionMenu. */
function* selectMenuItem(ctx: BattleMenuContext, host: MoveMenuHost, cursor: MenuCursorState): Program<'redraw' | MoveMenuFlags> {
  for (;;) {
    if (ctx.moveMenuType === 0) {
      yield* printMenuItem(ctx, host);
      if (ctx.menuItemToSwap) host.tiles.put(5, 12 + ctx.menuItemToSwap, '▷');
    } else if (ctx.moveMenuType === 1) placeString(host.tiles, 1, 14, 'WHICH TECHNIQUE?');
    const keys = yield* handleInput(ctx, host, cursor);
    if (keys.includes('up')) {
      if (ctx.currentMenuItem === 0) {
        eraseMenuCursor(host.tiles, cursor);
        ctx.currentMenuItem = ctx.numMovesMinusOne + 1;
      }
      continue;
    }
    if (keys.includes('down')) {
      if (ctx.currentMenuItem === ctx.numMovesMinusOne + 2) {
        eraseMenuCursor(host.tiles, cursor);
        ctx.currentMenuItem = 1;
      }
      continue;
    }
    if (keys.includes('select')) { swapMovesInMenu(ctx); return 'redraw'; }
    const cancelled = keys.includes('b');
    ctx.menuItemToSwap = 0;
    ctx.currentMenuItem--;
    if (ctx.moveMenuType !== 1) ctx.playerMoveListIndex = ctx.currentMenuItem;
    if (ctx.moveMenuType !== 0 || cancelled) return { zero: !cancelled };
    const slot = ctx.currentMenuItem;
    const refusal = (ctx.battlePP[slot] & 0x3f) === 0 ? 'MoveNoPPText'
      : (ctx.playerDisabledMove >>> 4) === slot + 1 ? 'MoveDisabledText' : null;
    if (refusal) {
      yield* host.printText(refusal);
      host.loadScreenTilesFromBuffer1();
      return 'redraw';
    }
    ctx.playerSelectedMove = ctx.battleMoves[slot];
    return { zero: true };
  }
}

export function* moveSelectionMenu(ctx: BattleMenuContext, host: MoveMenuHost): Program<MoveMenuFlags> {
  // The old underlying cursor byte is deliberately retained across full redraws.
  const cursor = ctx.cursor;
  cursor.rowStep = 1;
  for (;;) {
    if (ctx.moveMenuType === 0 && !anyMoveToSelect(ctx)) {
      yield* host.printText('NoMovesLeftText');
      yield* delayFrames(60);
      return { zero: true };
    }
    const moves = ctx.moveMenuType === 0 ? ctx.battleMoves : ctx.moveMenuType === 1
      ? ctx.enemyMoves : ctx.party[ctx.whichPokemon].moves;
    formatMovesString(ctx, moves, host);
    const x = ctx.moveMenuType === 1 ? 0 : 4, y = ctx.moveMenuType === 0 ? 12 : 7;
    textBoxBorder(host.tiles, x, y, 4, 14);
    if (ctx.moveMenuType === 0) { host.tiles.put(4, 12, '─'); host.tiles.put(10, 12, '┘'); }
    placeString(host.tiles, x + 2, y + 1, ctx.movesString, 1);
    ctx.currentMenuItem = ctx.moveMenuType === 1 ? 1 : ctx.playerMoveListIndex + 1;
    cursor.topX = x + 1; cursor.topY = y;
    cursor.item = cursor.lastItem = ctx.currentMenuItem;
    const result = yield* selectMenuItem(ctx, host, cursor);
    if (result !== 'redraw') return result;
  }
}
