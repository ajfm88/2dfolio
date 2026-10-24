import { MenuInput } from '../menus/menu_input';
import { placeMenuCursor, placeString, textBoxBorder, type TileSurface, type MenuCursorState } from '../menus/tile_surface';
import { battleGlyphTile } from './battle_screen';
import type { BattleState } from './battle_state';
import { D } from './battle_end_state';
import { delayFrames, type Program } from './battle_menu_context';
import { BattleUnsupportedState } from './battle_move_data';

export interface TwoOptionHost {
  tiles: TileSurface;
  readJoypad(): void;
  pressSound(): void;
  updateSprites(): void;
}
// pret data/yes_no_menu_strings.asm:7-58. TRADE_CANCEL's cable-club border is unsupported.
const MENUS = [[4, 3, 0, 'YES<NEXT>NO'], [6, 3, 0, 'NORTH<NEXT>WEST'], [6, 3, 0, 'SOUTH<NEXT>EAST'],
  [6, 3, 0, 'YES<NEXT>NO'], [6, 3, 0, 'NORTH<NEXT>EAST'], [7, 3, 0, 'TRADE<NEXT>CANCEL'],
  [7, 4, 1, 'HEAL<NEXT>CANCEL'], [4, 3, 0, 'NO<NEXT>YES']] as const;

/** pret text_box.asm:205-351; home/window.asm:1-114. HL=border, BC=cursorY/X.
 * TileSurface is the battle's existing tile owner; only wBuffer is the30-byte cartridge save. */
export function* displayTwoOptionMenu(state: BattleState, host: TwoOptionHost,
  x: number, y: number, cursorY: number, cursorX: number): Program<{ carry: boolean }> {
  state.mem[D.wStatusFlags5] |= 0x40;
  state.mem[D.wChosenMenuItem] = state.mem[D.wMenuExitMethod] = 0;
  state.mem[D.wMenuWatchedKeys] = 3; state.wMaxMenuItem = 1;
  state.mem[D.wTopMenuItemY] = cursorY; state.mem[D.wTopMenuItemX] = cursorX;
  state.mem[D.wLastMenuItem] = state.wMenuWatchMovingOutOfBounds = 0;
  const id = state.mem[D.wTwoOptionMenuID], selected = id >>> 7;
  state.mem[D.wTwoOptionMenuID] = id & 127; state.wCurrentMenuItem = selected;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
    const tile = host.tiles.at(x + col, y + row);
    state.mem[D.wBuffer + row * 6 + col] = typeof tile === 'number' ? tile : battleGlyphTile(tile ?? ' ');
  }
  const entry = MENUS[id & 127];
  if (!entry || (id & 127) === 5) throw new BattleUnsupportedState('two-option menu id');
  const [width, height, blank, label] = entry;
  textBoxBorder(host.tiles, x, y, height, width); host.updateSprites();
  placeString(host.tiles, x + 2, y + 1 + blank, label);
  state.mem[D.wTwoOptionMenuID] = 0; state.mem[D.wStatusFlags5] &= ~0x40;
  state.mem[D.wPartyMenuAnimMonEnabled] = state.mem[D.wAnimCounter] = 0;
  const blink1 = state.mem[D.hDownArrowBlinkCount1], blink2 = state.mem[D.hDownArrowBlinkCount2];
  state.mem[D.hDownArrowBlinkCount1] = 0; state.mem[D.hDownArrowBlinkCount2] = 6;
  const menu = new MenuInput({ watched: ['a', 'b'], maxItem: 1, topY: cursorY, topX: cursorX, item: selected });
  const cursor: MenuCursorState = { topX: cursorX, topY: cursorY, item: selected, lastItem: 0, tileBehind: ' ', location: null };
  placeMenuCursor(host.tiles, cursor);
  state.mem[D.wLastMenuItem] = selected;
  for (;;) {
    yield 'serviced';
    const pressed = menu.update(host.readJoypad, () => { if (!(state.mem[D.wMiscFlags] & 32)) host.pressSound(); });
    state.wCurrentMenuItem = menu.item;
    if (pressed) {
      state.mem[D.hDownArrowBlinkCount1] = blink1; state.mem[D.hDownArrowBlinkCount2] = blink2;
      state.mem[D.wMenuWrappingEnabled] = 0;
      const second = pressed.includes('b') || menu.item !== 0;
      state.wCurrentMenuItem = state.mem[D.wChosenMenuItem] = second ? 1 : 0;
      state.mem[D.wMenuExitMethod] = second ? 2 : 1;
      yield* delayFrames(15);
      for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
        host.tiles.put(x + col, y + row, state.mem[D.wBuffer + row * 6 + col]);
      }
      host.updateSprites(); return { carry: second };
    }
    if (cursor.item !== menu.item) {
      cursor.item = menu.item; placeMenuCursor(host.tiles, cursor); state.mem[D.wLastMenuItem] = cursor.lastItem;
      state.mem[D.wAnimCounter] = 0;
    }
  }
}
