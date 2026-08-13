import { describe, it, expect } from 'vitest';
import { charToIndex } from '../../src/ui/bitmap-font.js';

describe('charToIndex', () => {
  const COLUMNS = 26;

  describe('digits 0–9', () => {
    it('maps 0 to index 0', () => {
      expect(charToIndex('0', COLUMNS)).toBe(0);
    });

    it('maps 5 to index 5', () => {
      expect(charToIndex('5', COLUMNS)).toBe(5);
    });

    it('maps 9 to index 9', () => {
      expect(charToIndex('9', COLUMNS)).toBe(9);
    });
  });

  describe('special characters', () => {
    it('maps - to index 10', () => {
      expect(charToIndex('-', COLUMNS)).toBe(10);
    });

    it('maps . to index 11', () => {
      expect(charToIndex('.', COLUMNS)).toBe(11);
    });

    it('maps > to index 12', () => {
      expect(charToIndex('>', COLUMNS)).toBe(12);
    });

    it('maps @ to index 13', () => {
      expect(charToIndex('@', COLUMNS)).toBe(13);
    });

    it('maps ! to index 14', () => {
      expect(charToIndex('!', COLUMNS)).toBe(14);
    });

    it("maps ' to index 15", () => {
      expect(charToIndex("'", COLUMNS)).toBe(15);
    });
  });

  describe('space / unknown', () => {
    it('maps space to index 16', () => {
      expect(charToIndex(' ', COLUMNS)).toBe(16);
    });

    it('maps unknown char to index 16', () => {
      expect(charToIndex('#', COLUMNS)).toBe(16);
    });
  });

  describe('letters A–Z (row 1)', () => {
    it('maps A to columns + 0', () => {
      expect(charToIndex('A', COLUMNS)).toBe(COLUMNS);
    });

    it('maps B to columns + 1', () => {
      expect(charToIndex('B', COLUMNS)).toBe(COLUMNS + 1);
    });

    it('maps M to columns + 12', () => {
      expect(charToIndex('M', COLUMNS)).toBe(COLUMNS + 12);
    });

    it('maps Z to columns + 25', () => {
      expect(charToIndex('Z', COLUMNS)).toBe(COLUMNS + 25);
    });
  });

  describe('column count affects letter indices', () => {
    it('with 16 columns, A maps to 16', () => {
      expect(charToIndex('A', 16)).toBe(16);
    });

    it('with 32 columns, A maps to 32', () => {
      expect(charToIndex('A', 32)).toBe(32);
    });

    it('digit indices are independent of column count', () => {
      expect(charToIndex('5', 16)).toBe(5);
      expect(charToIndex('5', 32)).toBe(5);
    });
  });
});
