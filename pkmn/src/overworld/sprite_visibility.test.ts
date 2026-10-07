import { describe, it, expect } from 'vitest';
import { inSpriteWindow, spriteCovered, pikachuCovered, SpriteVisibility } from './sprite_visibility';
import { UiTiles } from '../renderer/ui_tiles';

describe('CheckSpriteAvailability', () => {
  it.each([[-4, 0], [5, 0], [0, -4], [0, 4]])('includes the edge at (%i,%i)', (x, y) => {
    expect(inSpriteWindow(10 + x, 20 + y, 10, 20)).toBe(true);
  });
  it.each([[-5, 0], [6, 0], [0, -5], [0, 5]])('excludes (%i,%i)', (x, y) => {
    expect(inSpriteWindow(10 + x, 20 + y, 10, 20)).toBe(false);
    expect(inSpriteWindow(10 + x, 20 + y, 10, 20, true)).toBe(true);
  });

  it('an invisible image stays hidden during a step, then pops in on the standing update', () => {
    const sprite = new SpriteVisibility();
    sprite.update(false, false);
    sprite.update(true, true);
    expect(sprite.visible).toBe(false);
    sprite.update(true, false);
    expect(sprite.visible).toBe(true);
    sprite.update(false, true);
    expect(sprite.visible).toBe(false);
  });

  it.each([[0, 0], [1, 0], [0, 1], [1, 1]])('any UI tile at (%i,%i) hides the whole sprite', (x, y) => {
    expect(spriteCovered(64, 60, (tx, ty) => tx === 8 + x && ty === 8 + y ? 0x60 : 0x5f)).toBe(true);
  });

  it("Pikachu's footprint: columns from (X + 2) >> 3, rows from (Y + 4) & $f0 (A6c R-1)", () => {
    const only = (cx: number, cy: number) => (x: number, y: number) => x === cx && y === cy ? 0x60 : 0;
    // X: 78 + 2 = 80 → column 10; 77 + 2 = 79 → column 9
    expect(pikachuCovered(78, 0x3c, only(10, 8))).toBe(true);
    expect(pikachuCovered(78, 0x3c, only(9, 8))).toBe(false);
    expect(pikachuCovered(77, 0x3c, only(9, 8))).toBe(true);
    expect(pikachuCovered(77, 0x3c, only(11, 8))).toBe(false);
    // Y snaps to its 16 px block: 56 + 4 = 60 → rows 6–7, 59 too, 60 → rows 8–9
    expect(pikachuCovered(64, 56, only(8, 7))).toBe(true);
    expect(pikachuCovered(64, 56, only(8, 8))).toBe(false);
    expect(pikachuCovered(64, 59, only(8, 8))).toBe(false);
    expect(pikachuCovered(64, 60, only(8, 8))).toBe(true);
    // The NPC rule differs at the same pixels: (Y + 4) & $f8 reaches row 7–8 from 56
    expect(spriteCovered(64, 56, only(8, 8))).toBe(true);
    // Byte wrap: X $fe + 2 → column 0; Y $fc + 4 → row 0
    expect(pikachuCovered(0xfe, 0xfc, only(0, 0))).toBe(true);
  });

  it('map tiles through $5f never hide the sprite', () => {
    expect(spriteCovered(64, 60, () => 0x5f)).toBe(false);
  });

  it('a sprite straddling the START menu edge vanishes, including its uncovered half', () => {
    const tiles = new UiTiles();
    tiles.cover(80, 0, 80, 128);
    expect(spriteCovered(72, 60, tiles.tileAt)).toBe(true);
    expect(spriteCovered(64, 60, tiles.tileAt)).toBe(false);
    tiles.clear();
    expect(spriteCovered(72, 60, tiles.tileAt)).toBe(false);
  });

  it('the bottom text box hides only sprites whose footprint reaches its tiles', () => {
    const tiles = new UiTiles();
    tiles.cover(0, 96, 160, 48);
    expect(spriteCovered(64, 84, tiles.tileAt)).toBe(true);
    expect(spriteCovered(64, 76, tiles.tileAt)).toBe(false);
    expect(tiles.tileAt(-1, 12)).toBe(0);
    expect(tiles.tileAt(20, 12)).toBe(0);
  });
});
