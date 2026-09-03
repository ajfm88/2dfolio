import { describe, it, expect } from 'vitest';
import { NameBoard, NAME_BOARD, BOARD_SIZE, SPACE_CHAR } from '../../src/ui/name-board.js';

describe('NameBoard', () => {
  it('has 44 cells with the expected corner characters', () => {
    expect(NAME_BOARD).toHaveLength(BOARD_SIZE);
    expect(NAME_BOARD[0]).toBe('A');   // row 0 col 0
    expect(NAME_BOARD[10]).toBe('K');  // row 0 col 10
    expect(NAME_BOARD[11]).toBe('L');  // row 1 col 0
    expect(NAME_BOARD[25]).toBe('Z');  // row 2 col 3
    expect(NAME_BOARD[33]).toBe('0');  // row 3 col 0
    expect(NAME_BOARD[42]).toBe('9');  // row 3 col 9
    expect(NAME_BOARD[43]).toBe(SPACE_CHAR); // row 3 col 10 = space
  });

  it('starts at index 0', () => {
    expect(new NameBoard().index).toBe(0);
  });

  it('moves right by 1 and wraps from the last cell to 0', () => {
    const b = new NameBoard();
    b.moveRight();
    expect(b.index).toBe(1);
    for (let i = 0; i < BOARD_SIZE - 1; i++) b.moveRight(); // back to 0 (wrap once)
    expect(b.index).toBe(0);
  });

  it('moves left from 0 wrapping to the last cell', () => {
    const b = new NameBoard();
    b.moveLeft();
    expect(b.index).toBe(BOARD_SIZE - 1);
  });

  it('moves down by one row (+11) and wraps top<->bottom in the same column', () => {
    const b = new NameBoard();
    b.moveDown();
    expect(b.index).toBe(11); // row0col0 -> row1col0
    b.moveDown(); b.moveDown(); // -> 33 (row3col0)
    expect(b.index).toBe(33);
    b.moveDown(); // wraps to row0col0
    expect(b.index).toBe(0);
  });

  it('moves up by one row (-11) wrapping bottom<->top', () => {
    const b = new NameBoard();
    b.moveUp(); // row0col0 -> row3col0
    expect(b.index).toBe(33);
    b.moveUp();
    expect(b.index).toBe(22); // row2col0
  });

  it('exposes row/col and the highlighted char', () => {
    const b = new NameBoard();
    b.moveDown();      // index 11
    b.moveRight();     // index 12
    expect(b.row).toBe(1);
    expect(b.col).toBe(1);
    expect(b.char).toBe('M');
  });

  it('reset() returns to index 0', () => {
    const b = new NameBoard();
    b.moveDown(); b.moveRight();
    b.reset();
    expect(b.index).toBe(0);
  });
});
