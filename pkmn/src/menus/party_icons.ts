// Party menu Pokemon icons — maps species to mini sprite icons
// Data sourced from data/pokemon/menu_icons.asm and data/icon_pointers.asm
// Supports animation: most icons alternate frames, BALL/HELIX bounce Y only.

import { loadSprite, drawSprite, getCtx, getScale } from '../renderer';

type IconType = 'MON' | 'BALL' | 'HELIX' | 'FAIRY' | 'BIRD' | 'WATER' | 'BUG' | 'GRASS' | 'SNAKE' | 'QUADRUPED' | 'PIKACHU';

interface IconInfo {
  url: string;
  frame1Y: number;
  frame2Y: number;
  narrow?: boolean;    // 8px-wide PNGs need symmetric tile rendering
  bounceOnly?: boolean; // BALL/HELIX shift Y by 1px instead of changing frame
}

// Sprite source and both animation frame Y-offsets for each icon type.
// Overworld sprites (16x96): frame Y calculated as (tileOffset/4)*16.
// Dedicated icons (8x32): frame1=y0 or y16, frame2=other half.
const ICON_INFO: Record<IconType, IconInfo> = {
  MON:       { url: '/gfx/sprites/monster.png', frame1Y: 48, frame2Y: 0 },
  BALL:      { url: '/gfx/sprites/poke_ball.png', frame1Y: 0, frame2Y: 0, bounceOnly: true },
  HELIX:     { url: '/gfx/sprites/poke_ball.png', frame1Y: 0, frame2Y: 0, bounceOnly: true },
  FAIRY:     { url: '/gfx/sprites/fairy.png', frame1Y: 48, frame2Y: 0 },
  BIRD:      { url: '/gfx/sprites/bird.png', frame1Y: 48, frame2Y: 0 },
  WATER:     { url: '/gfx/sprites/seel.png', frame1Y: 0, frame2Y: 48 },
  BUG:       { url: '/gfx/icons/bug.png', frame1Y: 16, frame2Y: 0, narrow: true },
  GRASS:     { url: '/gfx/icons/plant.png', frame1Y: 16, frame2Y: 0, narrow: true },
  SNAKE:     { url: '/gfx/icons/snake.png', frame1Y: 0, frame2Y: 16, narrow: true },
  QUADRUPED: { url: '/gfx/icons/quadruped.png', frame1Y: 0, frame2Y: 16, narrow: true },
  PIKACHU:   { url: '/gfx/sprites/pikachu.png', frame1Y: 0, frame2Y: 48 },
};

// Dex number (1-151) → icon type, from data/pokemon/menu_icons.asm
// prettier-ignore
const DEX_TO_ICON: IconType[] = [
  'GRASS','GRASS','GRASS','MON','MON','MON','WATER','WATER','WATER','BUG',           // 1-10
  'BUG','BUG','BUG','BUG','BUG','BIRD','BIRD','BIRD','QUADRUPED','QUADRUPED',       // 11-20
  'BIRD','BIRD','SNAKE','SNAKE','PIKACHU','PIKACHU','MON','MON','MON','MON',         // 21-30
  'MON','MON','MON','MON','FAIRY','FAIRY','QUADRUPED','QUADRUPED','FAIRY','FAIRY',   // 31-40
  'MON','MON','GRASS','GRASS','GRASS','BUG','BUG','BUG','BUG','MON',                // 41-50
  'MON','MON','MON','MON','MON','MON','MON','QUADRUPED','QUADRUPED','MON',           // 51-60
  'MON','MON','MON','MON','MON','MON','MON','MON','GRASS','GRASS',                   // 61-70
  'GRASS','WATER','WATER','MON','MON','MON','QUADRUPED','QUADRUPED','QUADRUPED','MON',// 71-80
  'BALL','BALL','BIRD','BIRD','BIRD','WATER','WATER','MON','MON','HELIX',            // 81-90
  'HELIX','MON','MON','MON','SNAKE','MON','MON','WATER','WATER','BALL',              // 91-100
  'BALL','GRASS','GRASS','MON','MON','MON','MON','MON','MON','MON',                  // 101-110
  'QUADRUPED','MON','FAIRY','GRASS','MON','WATER','WATER','WATER','WATER','HELIX',   // 111-120
  'HELIX','MON','BUG','MON','MON','MON','BUG','QUADRUPED','WATER','SNAKE',           // 121-130
  'WATER','MON','QUADRUPED','QUADRUPED','QUADRUPED','QUADRUPED','MON','HELIX','HELIX','HELIX', // 131-140
  'HELIX','BIRD','MON','BIRD','BIRD','BIRD','SNAKE','SNAKE','SNAKE','MON','MON',     // 141-151
];

// Cached loaded sprite canvases
const spriteCache = new Map<string, HTMLCanvasElement>();
let loading = false;

/** Preload all party icon sprite sheets. */
export async function loadPartyIcons(): Promise<void> {
  if (loading || spriteCache.size > 0) return;
  loading = true;
  const urls = new Set(Object.values(ICON_INFO).map(s => s.url));
  await Promise.all([...urls].map(async url => {
    try {
      const canvas = await loadSprite(url);
      spriteCache.set(url, canvas);
    } catch {
      // Sprite not available, skip silently
    }
  }));
}

/** Draw an 8x8 tile from a sprite sheet at dest coords, optionally X-flipped. */
function drawTile8(
  sheet: HTMLCanvasElement, srcY: number,
  destX: number, destY: number, flipX: boolean,
): void {
  const ctx = getCtx();
  const s = getScale();
  if (flipX) {
    ctx.save();
    ctx.translate((destX + 8) * s, destY * s);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, 0, srcY, 8, 8, 0, 0, 8 * s, 8 * s);
    ctx.restore();
  } else {
    ctx.drawImage(sheet, 0, srcY, 8, 8, destX * s, destY * s, 8 * s, 8 * s);
  }
}

/**
 * Draw a symmetric icon from an 8px-wide sprite column (bug, plant, snake, quadruped).
 * Assembly uses WriteSymmetricMonPartySpriteOAM which X-flips the left half to make the right half.
 * Each frame has 2 tiles (top + bottom), each drawn normal then X-flipped.
 */
function drawSymmetricIcon(sheet: HTMLCanvasElement, frameY: number, x: number, y: number): void {
  drawTile8(sheet, frameY, x, y, false);
  drawTile8(sheet, frameY, x + 8, y, true);
  drawTile8(sheet, frameY + 8, x, y + 8, false);
  drawTile8(sheet, frameY + 8, x + 8, y + 8, true);
}

/**
 * Animation half-cycle speed in frames, based on HP ratio.
 * Assembly: PartyMonSpeeds db 5, 16, 32; add 1 for non-SGB.
 */
function getAnimSpeed(hpRatio: number): number {
  if (hpRatio > 0.5) return 6;
  if (hpRatio > 0.25) return 17;
  return 33;
}

/**
 * Draw the party icon for a given dex number with animation.
 * frameCounter: increments each render frame (60fps).
 * hpRatio: currentHp/maxHp, determines animation speed.
 */
export function drawPartyIcon(
  dexNum: number, x: number, y: number,
  frameCounter: number, hpRatio: number,
): void {
  const iconType = DEX_TO_ICON[dexNum - 1] ?? 'MON';
  const info = ICON_INFO[iconType];
  const sheet = spriteCache.get(info.url);
  if (!sheet) return;

  const speed = getAnimSpeed(hpRatio);
  const isAlt = (frameCounter % (speed * 2)) >= speed;

  if (info.bounceOnly) {
    // BALL/HELIX: bounce Y by 1 pixel on alternate frame
    drawSprite(sheet, 0, info.frame1Y, x, isAlt ? y + 1 : y);
  } else if (info.narrow) {
    // 8px-wide icon PNG: render with X-flip symmetry
    const frameY = isAlt ? info.frame2Y : info.frame1Y;
    drawSymmetricIcon(sheet, frameY, x, y);
  } else {
    // 16px-wide overworld sprite: draw frame directly
    const frameY = isAlt ? info.frame2Y : info.frame1Y;
    drawSprite(sheet, 0, frameY, x, y);
  }
}
