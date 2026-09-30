// Battle screen rendering using actual game tile assets
// Layout (160x144):
//   Enemy HUD (top-left) | Enemy sprite (top-right)
//   Player sprite (bottom-left) | Player HUD (bottom-right)
//   Text/Menu box (bottom 6 tiles)

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { getCtx, getScale, fillRect, loadBattleSprite, loadTileset, loadFont, drawTile, getMonsterPalette } from '../renderer';
import { charToTile, drawTileBorder } from '../text';
import type { BattlePokemon } from './types';
import { getMove } from './data';
import { type ItemStack, getItemName } from '../items';

let fontCanvas: HTMLCanvasElement | null = null;

// Battle HUD tilesets
let hpBarGreen: HTMLCanvasElement | null = null;
let hpBarYellow: HTMLCanvasElement | null = null;
let hpBarRed: HTMLCanvasElement | null = null;
let hudTiles1: HTMLCanvasElement | null = null;  // battle_hud_1.png (1bpp → black on transparent)
let hudTiles2: HTMLCanvasElement | null = null;  // battle_hud_2.png
let hudTiles3: HTMLCanvasElement | null = null;  // battle_hud_3.png
let pokeballTiles: HTMLCanvasElement | null = null;  // balls.png (4 tiles: healthy, status, fainted, empty)

// Tile indices in font_battle_extra.png (loaded at VRAM $62)
// PNG is 15 tiles/row × 2 rows = 30 tiles
const HP_LEFT_BRACKET = 0;  // VRAM $62
const HP_EMPTY = 1;         // VRAM $63
// Partial fill: HP_EMPTY + pixels (1-7) → tiles 2-8 ($64-$6A)
const HP_FULL = 9;          // VRAM $6B (8 pixels filled)
const HP_LABEL = 15;        // VRAM $71 ("HP:" label, row 1 col 0)

// Tile indices in battle_hud_1.png (3 tiles)
const HUD1_RIGHT_BRACKET = 0; // VRAM $6D
const HUD1_LEVEL = 1;         // VRAM $6E (":L" combined glyph)
const HUD1_PLAYER_TRI = 2;    // VRAM $6F

// Tile indices in battle_hud_2.png (3 tiles)
const HUD2_CORNER = 0;        // VRAM $73
const HUD2_ENEMY_CORNER = 1;  // VRAM $74

// Tile indices in battle_hud_3.png (3 tiles)
const HUD3_SEPARATOR = 0;     // VRAM $76
const HUD3_PLAYER_CORNER = 1; // VRAM $77
const HUD3_ENEMY_TRI = 2;     // VRAM $78

// Pokeball tile indices in balls.png (4 tiles: $31-$34)
const BALL_HEALTHY = 0;  // Normal pokeball (healthy mon)
// const BALL_STATUS = 1;   // Dark ball (mon has status)
// const BALL_FAINTED = 2;  // Crossed ball (fainted mon)
const BALL_EMPTY = 3;    // Empty slot (no mon in party slot)

// Sprite caches
const frontSpriteCache = new Map<string, HTMLCanvasElement>();
const backSpriteCache = new Map<string, HTMLCanvasElement>();

export async function initBattleUI(font: HTMLCanvasElement): Promise<void> {
  fontCanvas = font;
  // Load HP bar tilesets with 3 color palettes
  [hpBarGreen, hpBarYellow, hpBarRed] = await Promise.all([
    loadTileset('/gfx/font/font_battle_extra.png', 'GREENBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'YELLOWBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'REDBAR'),
  ]);
  // Load 1bpp HUD border tiles as font (black on transparent).
  [hudTiles1, hudTiles2, hudTiles3] = await Promise.all([
    loadFont('/gfx/battle/battle_hud_1.png'),
    loadFont('/gfx/battle/battle_hud_2.png'),
    loadFont('/gfx/battle/battle_hud_3.png'),
  ]);
  // Load pokeball indicator tiles (2bpp, green palette for battle)
  pokeballTiles = await loadBattleSprite('/gfx/battle/balls.png', 'GREENBAR');
}

export async function loadPokemonSprites(speciesName: string, dexNumber?: number): Promise<{
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
}> {
  const dex = dexNumber ?? 0;

  // Use per-Pokemon CGB battle palette by dex number
  const palette = getMonsterPalette(dex);

  const front = `/gfx/sprites/front/${dex}.png`;
  const back = `/gfx/sprites/back/${dex}.png`;

  if (!frontSpriteCache.has(speciesName)) {
    frontSpriteCache.set(speciesName, await loadBattleSprite(front, palette));
  }
  if (!backSpriteCache.has(speciesName)) {
    backSpriteCache.set(speciesName, await loadBattleSprite(back, palette));
  }

  return {
    front: frontSpriteCache.get(speciesName)!,
    back: backSpriteCache.get(speciesName)!,
  };
}

// ──────── Text helpers (using font charmap) ────────

function drawChar(ch: string, x: number, y: number): void {
  if (!fontCanvas) return;
  const tileId = charToTile(ch);
  if (tileId < 0) return;
  const s = getScale();
  const tilesPerRow = Math.floor(fontCanvas.width / TILE_SIZE);
  const srcX = (tileId % tilesPerRow) * TILE_SIZE;
  const srcY = Math.floor(tileId / tilesPerRow) * TILE_SIZE;
  const ctx = getCtx();
  ctx.drawImage(
    fontCanvas,
    srcX, srcY, TILE_SIZE, TILE_SIZE,
    x * s, y * s, TILE_SIZE * s, TILE_SIZE * s,
  );
}

function drawText(text: string, x: number, y: number): void {
  for (let i = 0; i < text.length; i++) {
    drawChar(text[i], x + i * TILE_SIZE, y);
  }
}

// ──────── HP bar (tile-based, matching assembly DrawHPBar) ────────

function getHpBarTileset(ratio: number): HTMLCanvasElement {
  if (ratio > 0.5) return hpBarGreen!;
  if (ratio > 0.25) return hpBarYellow!;
  return hpBarRed!;
}

/**
 * Draw a tile-based HP bar matching the original Game Boy rendering.
 * x, y = pixel position of the HP: label tile.
 * barTiles = number of fill segments (6 for battle HUD).
 *
 * Layout: [HP: label] [left bracket] [fill × barTiles] [right bracket]
 * Assembly: tile $71, $62, d×(fill), $6D
 */
function drawHpBar(x: number, y: number, currentHp: number, maxHp: number, barTiles: number = 6, isEnemy: boolean = false): void {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  const pixels = maxHp > 0 ? Math.ceil(currentHp * (barTiles * 8) / maxHp) : 0;
  const tileset = getHpBarTileset(ratio);
  if (!tileset) return;

  // HP: label tile (font_battle_extra tile 15 = VRAM $71)
  drawTile(tileset, HP_LABEL, x, y);

  // Left bracket (font_battle_extra tile 0 = VRAM $62)
  drawTile(tileset, HP_LEFT_BRACKET, x + TILE_SIZE, y);

  // Bar fill segments
  let remaining = pixels;
  for (let i = 0; i < barTiles; i++) {
    let tileIdx: number;
    if (remaining >= 8) {
      tileIdx = HP_FULL;
      remaining -= 8;
    } else if (remaining > 0) {
      tileIdx = HP_EMPTY + remaining; // partial: $63 + pixels = tiles 2-8
      remaining = 0;
    } else {
      tileIdx = HP_EMPTY;
    }
    drawTile(tileset, tileIdx, x + (2 + i) * TILE_SIZE, y);
  }

  // Right bracket: enemy uses font_battle_extra tile 10 ($6C, colored),
  // player uses battle_hud_1 tile 0 ($6D, 1bpp black on transparent)
  if (isEnemy) {
    drawTile(tileset, 10, x + (2 + barTiles) * TILE_SIZE, y);
  } else if (hudTiles1) {
    drawTile(hudTiles1, HUD1_RIGHT_BRACKET, x + (2 + barTiles) * TILE_SIZE, y);
  }
}

// ──────── Main render functions ────────

/** Render the full battle screen background (clear to white). */
export function renderBattleBg(): void {
  fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);
}

/** Fill screen with darkest palette color (for flash effect). */
export function renderBlackScreen(): void {
  fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 3);
}

/** Apply the PAL_BLACK palette effect for the blackout state.
 *  Assembly: SET_PAL_BATTLE_BLACK sets colors 1-3 to near-black (RGB 3,3,3)
 *  while color 0 (white) stays white. The result is a high-contrast B&W image:
 *  white background stays white, everything else becomes black.
 *  We redraw the canvas onto itself with extreme contrast + grayscale filter. */
export function renderBlackoutOverlay(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const canvas = ctx.canvas;
  ctx.save();
  ctx.filter = 'saturate(0) contrast(10)';
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
}

/** Render the enemy Pokemon's front sprite. */
export function renderEnemySprite(sprite: HTMLCanvasElement, xOffset = 0): void {
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  const x = GB_WIDTH - spriteW - 8 + xOffset;
  // Bottom-aligned to the 7×7 tile block (rows 0-6, bottom at y=56)
  const y = 56 - spriteH;
  ctx.drawImage(sprite, 0, 0, spriteW, spriteH, x * s, y * s, spriteW * s, spriteH * s);
}

/** Render the player's back sprite sliding down during faint animation.
 *  slideRows: how many 8px rows have slid off (0 = full sprite, 7+ = gone).
 *  Assembly: SlideDownFaintedMonPic — crops from top, bottom anchored. */
export function renderPlayerSpriteFaintSlide(sprite: HTMLCanvasElement, slideRows: number): void {
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  const displayW = spriteW * 2;
  const displayH = spriteH * 2;
  // Each slideRow removes 8px (1 tile) from the displayed height (at 2x = 16px per row)
  const cropPx = slideRows * 8; // pixels cropped from top at 2x display scale
  const visibleH = Math.max(0, displayH - cropPx);
  if (visibleH <= 0) return;
  // Source: crop from top of sprite
  const srcCropRows = slideRows * 4; // at 1x sprite scale (sprite is half display size)
  const srcY = srcCropRows;
  const srcH = spriteH - srcCropRows;
  if (srcH <= 0) return;
  const x = 8;
  // Bottom-anchored: sprite bottom stays at BOX_Y + 8
  const y = BOX_Y + 8 - visibleH;
  ctx.drawImage(sprite, 0, srcY, spriteW, srcH, x * s, y * s, displayW * s, visibleH * s);
}

/** Render the enemy's front sprite sliding down during faint animation.
 *  slideRows: how many 8px rows have slid off (0 = full sprite, 7+ = gone). */
export function renderEnemySpriteFaintSlide(sprite: HTMLCanvasElement, slideRows: number): void {
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  // Each slideRow removes 8px from the visible height
  const cropPx = slideRows * 8;
  const visibleH = Math.max(0, spriteH - cropPx);
  if (visibleH <= 0) return;
  const srcY = cropPx;
  const srcH = visibleH;
  const x = GB_WIDTH - spriteW - 8;
  // Bottom-anchored: sprite bottom stays at y=56
  const y = 56 - visibleH;
  ctx.drawImage(sprite, 0, srcY, spriteW, srcH, x * s, y * s, spriteW * s, srcH * s);
}

/** Render the player's Pokemon back sprite (scaled 2x since back sprites are 32x32). */
export function renderPlayerSprite(sprite: HTMLCanvasElement, xOffset = 0): void {
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  const displayW = spriteW * 2;
  const displayH = spriteH * 2;
  const x = 8 + xOffset;
  // Match original: 32×32 sprite sits at bottom of 7×7 block (row 5-11, y=40-96).
  // At 2x scale (64px), offset down 8px so visual center matches original.
  const y = BOX_Y - displayH + 8;
  ctx.drawImage(sprite, 0, 0, spriteW, spriteH, x * s, y * s, displayW * s, displayH * s);
}

/**
 * Render the player's back sprite at a fractional scale (for switch shrink/grow animation).
 * Assembly uses 3 sizes: full (7/7), medium (5/7), small (3/7).
 * spriteScale: 1 = full, 5/7 = medium, 3/7 = small.
 * Sprite is anchored at the bottom-center of the normal display area.
 */
export function renderPlayerSpriteScaled(sprite: HTMLCanvasElement, spriteScale: number): void {
  if (spriteScale <= 0) return;
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  // Full display size (normal 2x)
  const fullW = spriteW * 2;
  const fullH = spriteH * 2;
  // Scaled display size
  const displayW = Math.round(fullW * spriteScale);
  const displayH = Math.round(fullH * spriteScale);
  // Anchor at bottom-center of the normal sprite area
  const fullX = 8;
  const fullY = BOX_Y - fullH + 8;
  const x = fullX + (fullW - displayW) / 2;
  const y = fullY + (fullH - displayH); // bottom-aligned
  ctx.drawImage(sprite, 0, 0, spriteW, spriteH, x * s, y * s, displayW * s, displayH * s);
}

/**
 * Render the player's back sprite with a horizontal pixel offset (for Pikachu slide animation).
 * slideOffset < 0 slides left off screen, > 0 slides in from left.
 * Assembly: AnimationSlideMonOff slides 8 tiles left, 3 frames per tile.
 */
export function renderPlayerSpriteSliding(sprite: HTMLCanvasElement, slideOffset: number): void {
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  const displayW = spriteW * 2;
  const displayH = spriteH * 2;
  const x = 8 + slideOffset;
  const y = BOX_Y - displayH + 8;
  // Clip to the sprite area so it doesn't draw outside
  ctx.save();
  ctx.beginPath();
  ctx.rect(8 * s, y * s, displayW * s, displayH * s);
  ctx.clip();
  ctx.drawImage(sprite, 0, 0, spriteW, spriteH, x * s, y * s, displayW * s, displayH * s);
  ctx.restore();
}

/**
 * Render a simple "poof" effect (star-burst) at the player sprite center.
 * Assembly uses OAM sprites from move_anim tiles; we approximate with small expanding shapes.
 * frame: 0-based animation frame; totalFrames: how many frames the poof lasts.
 */
export function renderPoofEffect(frame: number, totalFrames: number): void {
  const ctx = getCtx();
  const s = getScale();
  // Center of the player sprite area
  const cx = (8 + 32) * s;  // center X of the 64px wide sprite at x=8
  const cy = (BOX_Y - 32 + 8) * s; // center Y of the sprite area
  const t = frame / totalFrames;
  // 4 small diamond shapes expanding outward (matching assembly's 4-subentry OAM pattern)
  const radius = (6 + t * 14) * s;
  const size = Math.max(1, Math.round((3 - t * 2) * s)); // shrink slightly as they expand
  ctx.fillStyle = '#000';
  const offsets = [
    [0, -1], [0, 1], [-1, 0], [1, 0], // cardinal directions
  ];
  for (const [dx, dy] of offsets) {
    const px = cx + dx * radius;
    const py = cy + dy * radius;
    ctx.fillRect(px - size, py - size, size * 2, size * 2);
  }
  // Also draw smaller diagonal shapes
  const diagRadius = radius * 0.6;
  const diagSize = Math.max(1, Math.round(size * 0.7));
  const diagOffsets = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  for (const [dx, dy] of diagOffsets) {
    const px = cx + dx * diagRadius;
    const py = cy + dy * diagRadius;
    ctx.fillRect(px - diagSize, py - diagSize, diagSize * 2, diagSize * 2);
  }
}

/**
 * Render the enemy HUD using actual game tile assets.
 * Matches assembly DrawEnemyHUDAndHPBar + PlaceEnemyHUDTiles layout:
 *   Row 0 (y=0):  Name at col 1
 *   Row 1 (y=8):  Status or :L+level at col 4
 *   Row 2 (y=16): Corner at col 1, HP bar at col 2
 *   Row 3 (y=24): Corner at col 1, separator ×8, triangle at col 10
 */
export function renderEnemyHUD(pokemon: BattlePokemon, displayHp: number): void {
  const hudW = 12 * TILE_SIZE; // 96px, cols 0-11

  // Clear HUD area
  fillRect(0, 0, hudW, TILE_SIZE * 4, 0);

  // Row 0: Name at (col 1, row 0) = (8, 0)
  drawText(pokemon.nickname.toUpperCase(), TILE_SIZE, 0);

  // Row 1: Status or level at (col 4, row 1) = (32, 8)
  if (pokemon.status) {
    // Status condition at col 5 (assembly: inc hl from col 4)
    drawText(pokemon.status, TILE_SIZE * 5, TILE_SIZE);
  } else {
    // :L tile at col 4, level digits at col 5+
    if (hudTiles1) {
      drawTile(hudTiles1, HUD1_LEVEL, TILE_SIZE * 4, TILE_SIZE);
    }
    drawText(String(pokemon.level), TILE_SIZE * 5, TILE_SIZE);
  }

  // Row 2: HUD corner + HP bar
  if (hudTiles2) {
    drawTile(hudTiles2, HUD2_CORNER, TILE_SIZE, TILE_SIZE * 2);
  }
  // HP bar at (col 2, row 2) = (16, 16), 6 fill tiles
  drawHpBar(TILE_SIZE * 2, TILE_SIZE * 2, displayHp, pokemon.maxHp, 6, true);

  // Row 3: Bottom border with separator tiles
  if (hudTiles2 && hudTiles3) {
    drawTile(hudTiles2, HUD2_ENEMY_CORNER, TILE_SIZE, TILE_SIZE * 3);
    for (let i = 0; i < 8; i++) {
      drawTile(hudTiles3, HUD3_SEPARATOR, TILE_SIZE * (2 + i), TILE_SIZE * 3);
    }
    drawTile(hudTiles3, HUD3_ENEMY_TRI, TILE_SIZE * 10, TILE_SIZE * 3);
  }
}

/**
 * Render the player HUD using actual game tile assets.
 * Matches assembly DrawPlayerHUDAndHPBar + PlacePlayerHUDTiles layout:
 *   Row 7 (y=56):  Name at col 10
 *   Row 8 (y=64):  Status or :L+level at col 14
 *   Row 9 (y=72):  HP bar at col 10
 *   Row 10 (y=80): HP numbers, corner at col 18
 *   Row 11 (y=88): Triangle at col 9, separator ×8, corner at col 18
 */
export function renderPlayerHUD(pokemon: BattlePokemon, displayHp: number): void {
  // Clear player HUD area (cols 9-19, rows 7-11)
  fillRect(TILE_SIZE * 9, TILE_SIZE * 7, TILE_SIZE * 11, TILE_SIZE * 5, 0);

  // Row 7: Name at (col 10, row 7)
  drawText(pokemon.nickname.toUpperCase(), TILE_SIZE * 10, TILE_SIZE * 7);

  // Row 8: Status or level at (col 14, row 8)
  if (pokemon.status) {
    drawText(pokemon.status, TILE_SIZE * 15, TILE_SIZE * 8);
  } else {
    if (hudTiles1) {
      drawTile(hudTiles1, HUD1_LEVEL, TILE_SIZE * 14, TILE_SIZE * 8);
    }
    drawText(String(pokemon.level), TILE_SIZE * 15, TILE_SIZE * 8);
  }

  // Row 9: HP bar at (col 10, row 9)
  drawHpBar(TILE_SIZE * 10, TILE_SIZE * 9, displayHp, pokemon.maxHp, 6);

  // Row 10: HP numbers at cols 11-17 (assembly: SCREEN_WIDTH+1 offset from bar start)
  const curHpStr = String(Math.max(0, Math.floor(displayHp))).padStart(3, ' ');
  const maxHpStr = String(pokemon.maxHp).padStart(3, ' ');
  const hpText = `${curHpStr}/${maxHpStr}`;
  drawText(hpText, TILE_SIZE * 11, TILE_SIZE * 10);

  // Row 10: Corner at col 18
  if (hudTiles2) {
    drawTile(hudTiles2, HUD2_CORNER, TILE_SIZE * 18, TILE_SIZE * 10);
  }

  // Row 11: Bottom border
  if (hudTiles1 && hudTiles3) {
    drawTile(hudTiles1, HUD1_PLAYER_TRI, TILE_SIZE * 9, TILE_SIZE * 11);
    for (let i = 0; i < 8; i++) {
      drawTile(hudTiles3, HUD3_SEPARATOR, TILE_SIZE * (10 + i), TILE_SIZE * 11);
    }
    drawTile(hudTiles3, HUD3_PLAYER_CORNER, TILE_SIZE * 18, TILE_SIZE * 11);
  }
}

// Bottom text box: 6 tiles tall (48px), matching original Gen 1
const BOX_H = 6 * TILE_SIZE; // 48px
const BOX_Y = GB_HEIGHT - BOX_H; // 96

/** Word-wrap a line to fit within maxChars, splitting at spaces. */
function wordWrap(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const result: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(' ', maxChars);
    if (splitAt <= 0) splitAt = maxChars;
    result.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt + (remaining[splitAt] === ' ' ? 1 : 0));
  }
  if (remaining.length > 0) result.push(remaining);
  return result;
}

/** Draw a bordered box (background + tile border). */
function drawBox(x: number, y: number, wTiles: number, hTiles: number): void {
  fillRect(x, y, wTiles * TILE_SIZE, hTiles * TILE_SIZE, 0);
  drawTileBorder(x, y, wTiles, hTiles);
}

/** Render the text message box at the bottom of the screen. */
export function renderBattleText(lines: string[]): void {
  drawBox(0, BOX_Y, 20, 6);

  const wrapped: string[] = [];
  for (const line of lines) {
    wrapped.push(...wordWrap(line, 18));
  }

  // Text at rows 2 and 4 (matching assembly coord hl, 1, 14 / 1, 16)
  const lineY0 = BOX_Y + TILE_SIZE * 2;
  const lineY1 = BOX_Y + TILE_SIZE * 4;
  if (wrapped[0]) drawText(wrapped[0], TILE_SIZE, lineY0);
  if (wrapped[1]) drawText(wrapped[1], TILE_SIZE, lineY1);
}

/** Render the action menu (FIGHT / PKMN / ITEM / RUN) with cursor. */
export function renderActionMenu(cursorIndex: number): void {
  // Full-width empty textbox behind the action menu
  drawBox(0, BOX_Y, 20, 6);
  // Smaller action menu box overlaid on the right (tiles 8-19, matching assembly)
  drawBox(TILE_SIZE * 8, BOX_Y, 12, 6);

  const PKMN = '\uE001\uE002'; // <PK><MN> compact glyphs
  const items = ['FIGHT', PKMN, 'ITEM', 'RUN'];
  // Assembly positions: text at (10,14)/(16,14)/(10,16)/(16,16)
  const col0X = TILE_SIZE * 10;
  const col1X = TILE_SIZE * 16;
  const row0Y = BOX_Y + TILE_SIZE * 2;
  const row1Y = BOX_Y + TILE_SIZE * 4;

  // Cursor positions: col 9 (left) and col 15 (right)
  const curCol0X = TILE_SIZE * 9;
  const curCol1X = TILE_SIZE * 15;

  const positions = [
    { x: col0X, y: row0Y, curX: curCol0X },
    { x: col1X, y: row0Y, curX: curCol1X },
    { x: col0X, y: row1Y, curX: curCol0X },
    { x: col1X, y: row1Y, curX: curCol1X },
  ];

  for (let i = 0; i < items.length; i++) {
    drawText(items[i], positions[i].x, positions[i].y);
  }

  const cp = positions[cursorIndex];
  drawText('\u25B6', cp.curX, cp.y);
}

/** Render the move selection menu with cursor. */
export function renderMoveMenu(pokemon: BattlePokemon, cursorIndex: number): void {
  // Full-width empty textbox behind
  drawBox(0, BOX_Y, 20, 6);
  // Move box overlaid on right (assembly: hlcoord 4,12; lb bc,4,14 → 16 tiles wide)
  drawBox(TILE_SIZE * 4, BOX_Y, 16, 6);

  // Draw all 4 move slots (show "-" for empty slots)
  for (let i = 0; i < 4; i++) {
    const mx = TILE_SIZE * 6;
    const my = BOX_Y + TILE_SIZE + i * TILE_SIZE;
    if (i < pokemon.moves.length) {
      const name = pokemon.moves[i].id.replace(/_/g, ' ').substring(0, 12);
      drawText(name, mx, my);
    } else {
      drawText('-', mx, my);
    }
  }

  // TYPE/PP info box (assembly: hlcoord 0,8; lb bc,3,9 → 11 wide × 5 tall)
  const typeBoxY = TILE_SIZE * 8;
  drawBox(0, typeBoxY, 11, 5);

  if (cursorIndex < pokemon.moves.length) {
    const sel = pokemon.moves[cursorIndex];
    const moveData = getMove(sel.id);
    // "TYPE/" at (1,9) and (5,9)
    drawText('TYPE', TILE_SIZE, typeBoxY + TILE_SIZE);
    drawText('/', TILE_SIZE * 5, typeBoxY + TILE_SIZE);
    // Type name at (2,10)
    if (moveData) {
      drawText(moveData.type, TILE_SIZE * 2, typeBoxY + TILE_SIZE * 2);
    }
    // PP: current/max at row 11 → typeBoxY + TILE_SIZE * 3
    const ppCur = String(sel.pp).padStart(2, ' ');
    const ppMax = String(sel.maxPp).padStart(2, ' ');
    drawText(`${ppCur}/${ppMax}`, TILE_SIZE * 5, typeBoxY + TILE_SIZE * 3);
  }

  // Cursor at col 5 (assembly: wTopMenuItemX = 5)
  const cy = BOX_Y + TILE_SIZE + cursorIndex * TILE_SIZE;
  drawText('\u25B6', TILE_SIZE * 5, cy);
}

/** Render the item selection menu with cursor.
 *  Assembly layout: item list box at (4,2)→(19,12), textbox at (0,12)→(19,17).
 *  cursorIndex ranges 0..items.length where items.length = CANCEL. */
export function renderItemMenu(items: ItemStack[], cursorIndex: number): void {
  // Empty textbox at the bottom
  drawBox(0, BOX_Y, 20, 6);
  // Item list box (assembly: LIST_MENU_BOX 4,2,19,12 → 16 wide × 11 tall)
  const listX = TILE_SIZE * 4;
  const listY = TILE_SIZE * 2;
  drawBox(listX, listY, 16, 11);

  // Total entries = items + CANCEL
  const totalEntries = items.length + 1;
  // Show up to 4 entries at a time (rows 4, 6, 8, 10 in tile coords)
  const maxVisible = 4;
  const scrollOffset = Math.max(0, Math.min(cursorIndex - (maxVisible - 1), totalEntries - maxVisible));

  for (let i = 0; i < maxVisible; i++) {
    const entryIdx = scrollOffset + i;
    if (entryIdx >= totalEntries) break;
    const row = 4 + i * 2; // tile rows: 4, 6, 8, 10
    const my = row * TILE_SIZE;
    const mx = TILE_SIZE * 6; // col 6

    if (entryIdx < items.length) {
      const item = items[entryIdx];
      drawText(getItemName(item.id).substring(0, 12), mx, my);
      // "×count" right-aligned (assembly uses ×)
      const qtyText = '\u00D7' + String(item.count).padStart(2, ' ');
      drawText(qtyText, TILE_SIZE * 16, my);
    } else {
      drawText('CANCEL', mx, my);
    }
  }

  // Cursor at col 5
  const cursorVisIdx = cursorIndex - scrollOffset;
  const cursorRow = 4 + cursorVisIdx * 2;
  drawText('\u25B6', TILE_SIZE * 5, cursorRow * TILE_SIZE);
}

// ──────── Trainer Intro Helpers ────────

/** Trainer sprite filename overrides for non-trivial mappings. */
const TRAINER_SPRITE_OVERRIDES: Record<string, string> = {
  LT_SURGE: 'lt.surge', JR_TRAINER_M: 'jr.trainerm', JR_TRAINER_F: 'jr.trainerf',
  PROF_OAK: 'prof.oak', JESSIE_JAMES: 'jessiejames', COOL_TRAINER_M: 'cooltrainerm',
  COOL_TRAINER_F: 'cooltrainerf', SUPER_NERD: 'supernerd', CUE_BALL: 'cueball',
  BIRD_KEEPER: 'birdkeeper', BLACK_BELT: 'blackbelt', POKE_MANIAC: 'pokemaniac',
  BUG_CATCHER: 'bugcatcher',
};

/** Trainer CGB palettes by class ID (matching assembly trainer_pic_pointers_money.asm). */
const TRAINER_PALETTES: Record<number, string> = {
  25: 'REDMON', 42: 'REDMON', 43: 'REDMON',   // rival classes
  34: 'BROWNMON', 35: 'REDMON', 37: 'GREENMON', // gym leaders 1
  38: 'PURPLEMON', 40: 'PURPLEMON', 39: 'BROWNMON', // gym leaders 2
  29: 'BROWNMON', 44: 'REDMON', 33: 'BROWNMON', // Giovanni, Lorelei, Bruno
  46: 'PURPLEMON', 47: 'REDMON',                // Agatha, Lance
};

export interface TrainerIntroAssets {
  enemyTrainer: HTMLCanvasElement;
  enemySilhouette: HTMLCanvasElement;
  playerTrainer: HTMLCanvasElement;
  playerSilhouette: HTMLCanvasElement;
}

/** Create a solid black silhouette of a sprite (non-transparent pixels → black). */
export function createSilhouette(sprite: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sprite.width;
  c.height = sprite.height;
  const ctx2 = c.getContext('2d')!;
  ctx2.drawImage(sprite, 0, 0);
  ctx2.globalCompositeOperation = 'source-atop';
  ctx2.fillStyle = '#000';
  ctx2.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Load the player's trainer backsprite (Red) for wild battle intros. */
export async function loadPlayerTrainerSprite(): Promise<{ sprite: HTMLCanvasElement; silhouette: HTMLCanvasElement }> {
  const sprite = await loadBattleSprite('/gfx/player/redb.png', 'REDMON');
  return { sprite, silhouette: createSilhouette(sprite) };
}

/** Load Prof. Oak's backsprite for the Pikachu battle (BATTLE_TYPE_PIKACHU).
 *  Assembly: SetPal_Battle with wBattleMonSpecies=0 → MonsterPalettes[0] = PAL_MEWMON. */
export async function loadOakTrainerSprite(): Promise<{ sprite: HTMLCanvasElement; silhouette: HTMLCanvasElement }> {
  const sprite = await loadBattleSprite('/gfx/battle/prof.oakb.png', 'MEWMON');
  return { sprite, silhouette: createSilhouette(sprite) };
}

/** Load trainer intro sprites (enemy front + player back) with silhouettes. */
export async function loadTrainerIntroAssets(trainerClassName: string, trainerClassId?: number): Promise<TrainerIntroAssets> {
  const spriteName = TRAINER_SPRITE_OVERRIDES[trainerClassName]
    ?? trainerClassName.toLowerCase().replace(/_/g, '');
  const palette = TRAINER_PALETTES[trainerClassId ?? 0] ?? 'BROWNMON';

  const [enemyTrainer, playerTrainer] = await Promise.all([
    loadBattleSprite(`/gfx/trainers/${spriteName}.png`, palette),
    loadBattleSprite('/gfx/player/redb.png', 'REDMON'),
  ]);
  return {
    enemyTrainer,
    enemySilhouette: createSilhouette(enemyTrainer),
    playerTrainer,
    playerSilhouette: createSilhouette(playerTrainer),
  };
}

// Trainer intro positions (matching assembly battle layout)
// Trainer intro sprite positions (matching original game layout)
const ENEMY_TRAINER_FINAL_X = GB_WIDTH - 56;         // 104 (flush right, tiles 13-19)
const ENEMY_TRAINER_Y = 0;                           // top of screen
const PLAYER_TRAINER_FINAL_X = 8;                    // left side
const PLAYER_TRAINER_Y = BOX_Y - 64 + 8;             // 40 (bottom overlaps text box slightly)
const SLIDE_OFFSET = 160; // full screen scroll (both trainers pan right-to-left)

/** Render a trainer sprite with silhouette→color blending. */
export function renderTrainerSpriteAt(
  sprite: HTMLCanvasElement, silhouette: HTMLCanvasElement,
  x: number, y: number, colorT: number, scale2x: boolean,
): void {
  const ctx = getCtx();
  const s = getScale();
  const sw = sprite.width;
  const sh = sprite.height;
  const dw = sw * (scale2x ? 2 : 1);
  const dh = sh * (scale2x ? 2 : 1);

  if (colorT <= 0) {
    ctx.drawImage(silhouette, 0, 0, sw, sh, x * s, y * s, dw * s, dh * s);
  } else if (colorT >= 1) {
    ctx.drawImage(sprite, 0, 0, sw, sh, x * s, y * s, dw * s, dh * s);
  } else {
    ctx.drawImage(silhouette, 0, 0, sw, sh, x * s, y * s, dw * s, dh * s);
    ctx.globalAlpha = colorT;
    ctx.drawImage(sprite, 0, 0, sw, sh, x * s, y * s, dw * s, dh * s);
    ctx.globalAlpha = 1;
  }
}

/** Draw a single 8x8 tile from a tileset canvas at screen position. */
function drawBallTile(tileId: number, destX: number, destY: number): void {
  if (!pokeballTiles) return;
  const s = getScale();
  const ctx = getCtx();
  // balls.png is 4 tiles in a row (32x8), each 8x8
  ctx.drawImage(pokeballTiles, tileId * 8, 0, 8, 8, destX * s, destY * s, 8 * s, 8 * s);
}

/** Render pokeball indicators for both sides using actual game tiles. */
export function renderPokeballs(playerPartySize: number, enemyPartySize: number): void {
  if (!hudTiles1 || !hudTiles2 || !hudTiles3 || !pokeballTiles) return;

  // === Enemy pokeball row (top area) ===
  // Bracket line at Y=16, pokeball sprites at Y=8
  drawTile(hudTiles2, HUD2_ENEMY_CORNER, 8, 16);    // └ corner
  for (let i = 0; i < 8; i++) {
    drawTile(hudTiles3, HUD3_SEPARATOR, 16 + i * 8, 16);  // ─ separators
  }
  drawTile(hudTiles3, HUD3_ENEMY_TRI, 80, 16);      // ▷ triangle

  // 6 pokeball tiles above the bracket (right to left)
  for (let i = 0; i < 6; i++) {
    const x = 64 - i * 8;  // 64, 56, 48, 40, 32, 24
    const tileId = i < enemyPartySize ? BALL_HEALTHY : BALL_EMPTY;
    drawBallTile(tileId, x, 8);
  }

  // === Player pokeball row (bottom area) ===
  // Bracket line at Y=88, pokeball sprites at Y=80
  drawTile(hudTiles1, HUD1_PLAYER_TRI, 72, 88);     // ◁ triangle
  for (let i = 0; i < 8; i++) {
    drawTile(hudTiles3, HUD3_SEPARATOR, 80 + i * 8, 88);  // ─ separators
  }
  drawTile(hudTiles3, HUD3_PLAYER_CORNER, 144, 88); // ┘ corner

  // 6 pokeball tiles above the bracket (left to right)
  for (let i = 0; i < 6; i++) {
    const x = 88 + i * 8;  // 88, 96, 104, 112, 120, 128
    const tileId = i < playerPartySize ? BALL_HEALTHY : BALL_EMPTY;
    drawBallTile(tileId, x, 80);
  }
}

/** Render a yes/no menu box at the right side of the screen.
 *  Assembly: DrawYesNoTextBox — 2-option box at (14,7) 6 wide × 5 tall. */
export function renderYesNoMenu(cursorIndex: number): void {
  const boxX = TILE_SIZE * 14;
  const boxY = TILE_SIZE * 7;
  drawBox(boxX, boxY, 6, 5);
  drawText('YES', boxX + TILE_SIZE * 2, boxY + TILE_SIZE);
  drawText('NO', boxX + TILE_SIZE * 2, boxY + TILE_SIZE * 3);
  // Cursor
  const cy = cursorIndex === 0
    ? boxY + TILE_SIZE
    : boxY + TILE_SIZE * 3;
  drawText('\u25B6', boxX + TILE_SIZE, cy);
}

/** Render the move selection for the learn-move flow.
 *  Assembly: learn_move.asm — TextBoxBorder at hlcoord 4,7 with lb bc,4,14.
 *  Moves at hlcoord 6,8, cursor at wTopMenuItemX=5, wTopMenuItemY=8.
 *  Bottom textbox shows "Which move should be forgotten?" */
export function renderLearnMoveSelect(pokemon: BattlePokemon, cursorIndex: number): void {
  // Move list box: border at tile (4,7), inner 4 rows × 14 cols
  drawBox(TILE_SIZE * 4, TILE_SIZE * 7, 16, 6);
  // Move names at (6,8), one per row
  for (let i = 0; i < 4; i++) {
    const mx = TILE_SIZE * 6;
    const my = TILE_SIZE * (8 + i);
    if (i < pokemon.moves.length) {
      const name = pokemon.moves[i].id.replace(/_/g, ' ').substring(0, 13);
      drawText(name, mx, my);
    }
  }
  // Cursor at (5, 8+cursor)
  const cy = TILE_SIZE * (8 + cursorIndex);
  drawText('\u25B6', TILE_SIZE * 5, cy);

  // Bottom text box: "Which move should be forgotten?"
  drawBox(0, BOX_Y, 20, 6);
  drawText('Which move should', TILE_SIZE, BOX_Y + TILE_SIZE * 2);
  drawText('be forgotten?', TILE_SIZE, BOX_Y + TILE_SIZE * 4);
}

/** Get trainer intro layout constants. */
export function getTrainerIntroLayout() {
  return {
    enemyFinalX: ENEMY_TRAINER_FINAL_X,
    enemyY: ENEMY_TRAINER_Y,
    playerFinalX: PLAYER_TRAINER_FINAL_X,
    playerY: PLAYER_TRAINER_Y,
    slideOffset: SLIDE_OFFSET,
  };
}
