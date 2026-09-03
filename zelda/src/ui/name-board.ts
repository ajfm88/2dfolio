// The 44-cell character board for name registration (NES Mode E).
//
// Layout mirrors `ModeE_CharMap` (Z_02.asm:1423-1429): 4 rows × 11 columns,
// row-major. The NES stores tile codes; here each cell is the display character
// the BitmapFont draws.
//
//   row 0: A B C D E F G H I J K
//   row 1: L M N O P Q R S T U V
//   row 2: W X Y Z <7 symbols>
//   row 3: 0 1 2 3 4 5 6 7 8 9 (space)
//
// The 7 symbol tiles in row 2 are NES codes $62 $63 $28 $29 $2A $2B $2C. Their
// exact glyphs aren't in this project's font sheet, so they map to the closest
// characters BitmapFont.charToIndex supports (`- . ! '`); the rest degrade to the
// font fallback tile and are flagged for the L0 font-polish pass. Names in
// practice use letters/digits, which all render correctly.

export const BOARD_COLS = 11;
export const BOARD_ROWS = 4;
export const BOARD_SIZE = BOARD_COLS * BOARD_ROWS; // 44

// The blank/space cell (last index), used to erase a character.
export const SPACE_CHAR = ' ';

// NES symbol tiles $62 $63 $28 $29 $2A $2B $2C — best-effort glyphs (see header).
const SYMBOLS = [',', '!', "'", '.', '-', '?', '"'] as const;

export const NAME_BOARD: readonly string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
  'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
  'W', 'X', 'Y', 'Z', ...SYMBOLS,
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', SPACE_CHAR,
];

/**
 * Cursor over the character board. The NES juggles pixel X/Y with edge checks
 * (Z_02.asm:1844-1931 ModeE_HandleDirections); on a row-major grid that reduces
 * to modular arithmetic — verified against every wrap case in the disassembly:
 *   Right from the last cell wraps to index 0; Left from 0 wraps to 43;
 *   Down/Up wrap top↔bottom within the same column.
 */
export class NameBoard {
  private _index = 0;

  get index(): number {
    return this._index;
  }

  get row(): number {
    return Math.floor(this._index / BOARD_COLS);
  }

  get col(): number {
    return this._index % BOARD_COLS;
  }

  /** The display character currently highlighted. */
  get char(): string {
    return NAME_BOARD[this._index]!;
  }

  reset(): void {
    this._index = 0;
  }

  moveRight(): void {
    this._index = (this._index + 1) % BOARD_SIZE;
  }

  moveLeft(): void {
    this._index = (this._index - 1 + BOARD_SIZE) % BOARD_SIZE;
  }

  moveDown(): void {
    this._index = (this._index + BOARD_COLS) % BOARD_SIZE;
  }

  moveUp(): void {
    this._index = (this._index - BOARD_COLS + BOARD_SIZE) % BOARD_SIZE;
  }
}
