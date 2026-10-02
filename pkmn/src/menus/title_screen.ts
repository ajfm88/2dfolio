// Title screen — Pokemon Yellow logo + Pikachu display with eye blink animation
// Assembly ref: engine/movie/title.asm, engine/movie/title_yellow.asm
// Blink logic: DoTitleScreenFunction in title.asm (lines 272-346)

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { loadTileset, setActivePalette, getCtx, getScale, getPaletteColors } from '../renderer';

// Title screen uses two CGB palettes (from PalPacket_Titlescreen):
// BGP0 = PAL_LOGO2 — Pokemon logo area (yellow + deep blue)
// BGP2 = PAL_MEWMON — Pikachu area (yellow + red cheeks)
const PAL_LOGO = 'LOGO2';
const PAL_PIKACHU = 'MEWMON';

// Screen positions from assembly (tile coordinates)
const LOGO_X = 2, LOGO_Y = 1, LOGO_W = 16, LOGO_H = 7;
const BUBBLE_X = 6, BUBBLE_Y = 4, BUBBLE_W = 7, BUBBLE_H = 4;
const PIKA_X = 4, PIKA_Y = 8, PIKA_W = 12, PIKA_H = 9;

// Extra individual tiles from assembly (TitleScreen_PlacePikaSpeechBubble / PlacePikachu)
const BUBBLE_EXTRAS: [number, number, number][] = [
  [9, 8, 0x64],  // hlcoord 9, 8 → $64
  [10, 8, 0x65], // next byte → $65
];
const PIKA_EXTRAS: [number, number, number][] = [
  [16, 10, 0x96], // hlcoord 16, 10
  [16, 11, 0x9D], // hlcoord 16, 11
  [16, 12, 0xA7], // hlcoord 16, 12
  [16, 13, 0xB1], // hlcoord 16, 13
];

// Pikachu eye OAM sprite data from TitleScreenPikachuEyesOAMData
// Format: [screenY, screenX, baseTileIndex, xFlip]
// OAM Y/X have +16/+8 offsets; base tile indices 0-3 = open eyes
const EYE_SPRITES: [number, number, number, boolean][] = [
  [0x60 - 16, 0x40 - 8, 1, true],   // left eye top-left (tile 1 flipped)
  [0x60 - 16, 0x48 - 8, 0, true],   // left eye top-right (tile 0 flipped)
  [0x68 - 16, 0x40 - 8, 3, true],   // left eye bottom-left (tile 3 flipped)
  [0x68 - 16, 0x48 - 8, 2, true],   // left eye bottom-right (tile 2 flipped)
  [0x60 - 16, 0x60 - 8, 0, false],  // right eye top-left
  [0x60 - 16, 0x68 - 8, 1, false],  // right eye top-right
  [0x68 - 16, 0x60 - 8, 2, false],  // right eye bottom-left
  [0x68 - 16, 0x68 - 8, 3, false],  // right eye bottom-right
];

// Eye tile offset for each blink state (pikachu_ob.png has 12 tiles: 4 open + 4 half + 4 closed)
// Assembly uses: tileId AND $F3 OR e, where e = 0 (open), 4 (half), 8 (closed)
const EYE_OPEN = 0;
const EYE_HALF = 4;
const EYE_CLOSED = 8;

// Eye overlay bounding box (precomputed from EYE_SPRITES screen positions)
const EYE_REGION_X = 56;  // min sprite X: 0x40 - 8
const EYE_REGION_Y = 80;  // min sprite Y: 0x60 - 16
const EYE_REGION_W = 48;  // (0x68 - 8 + 8) - 56
const EYE_REGION_H = 16;  // (0x68 - 16 + 8) - 80

// Copyright text position (bottom of screen)
const COPYRIGHT_Y = 17; // last tile row

export class TitleScreen {
  private background: HTMLCanvasElement | null = null;
  private eyeFrames = new Map<number, HTMLCanvasElement>();

  // Blink animation state (from DoTitleScreenFunction in title.asm)
  // Timer is a byte (0-255) that increments each frame; triggers blink at 0x80, 0x90, 0x00
  // Scene tracks blink animation progress: 0 = idle, 1-11 = animating
  private blinkTimer = 0;
  private blinkScene = 0;

  async load(): Promise<void> {
    setActivePalette(PAL_LOGO);

    // Load tilesets with their respective palettes, and tilemaps in parallel
    const [logoTiles, pikaBgTiles, cornerTiles, eyeTiles, gfTiles, logoMap, bubbleMap, pikaMap] =
      await Promise.all([
        loadTileset('/gfx/title/pokemon_logo.png', PAL_LOGO),              // logo: yellow + blue
        loadTileset('/gfx/title/pikachu_bg.png', PAL_PIKACHU),           // pikachu: yellow + red
        loadTileset('/gfx/title/pokemon_logo_corner.png', PAL_LOGO),
        loadTileset('/gfx/title/pikachu_ob.png', PAL_PIKACHU),           // eyes use pikachu palette
        loadTileset('/gfx/title/gamefreak_inc.png', PAL_PIKACHU),        // copyright in pikachu area
        fetchTilemap('/gfx/title/pokemon_logo.tilemap'),
        fetchTilemap('/gfx/title/pika_bubble.tilemap'),
        fetchTilemap('/gfx/title/pikachu.tilemap'),
      ]);

    // Pre-compose background (everything except eyes) into an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = GB_WIDTH;
    offscreen.height = GB_HEIGHT;
    const oc = offscreen.getContext('2d')!;
    oc.imageSmoothingEnabled = false;

    // Fill with white (palette color 0 — same for both palettes)
    const colors = getPaletteColors(PAL_LOGO);
    oc.fillStyle = `rgb(${colors[0][0]},${colors[0][1]},${colors[0][2]})`;
    oc.fillRect(0, 0, GB_WIDTH, GB_HEIGHT);

    const logoTileCount = (logoTiles.width / TILE_SIZE) * (logoTiles.height / TILE_SIZE);
    const pikaBgTileCount = (pikaBgTiles.width / TILE_SIZE) * (pikaBgTiles.height / TILE_SIZE);

    // Helper: draw a single tile from the appropriate tileset
    const drawTileAt = (tileId: number, destCol: number, destRow: number) => {
      let tileset: HTMLCanvasElement;
      let index: number;

      if (tileId < 0x80) {
        // vChars2 ($9000) — pokemon_logo tiles
        tileset = logoTiles;
        index = tileId;
        if (index >= logoTileCount) return; // out of bounds → blank
      } else if (tileId >= 0xFD) {
        // Corner tiles (loaded at vChars1 tiles $7D-$7F)
        tileset = cornerTiles;
        index = tileId - 0xFD;
      } else {
        // vChars1 ($8800) — pikachu_bg tiles
        tileset = pikaBgTiles;
        index = tileId - 0x80;
        if (index >= pikaBgTileCount) return; // out of bounds → blank
      }

      const tilesPerRow = tileset.width / TILE_SIZE;
      const srcX = (index % tilesPerRow) * TILE_SIZE;
      const srcY = Math.floor(index / tilesPerRow) * TILE_SIZE;
      oc.drawImage(
        tileset,
        srcX, srcY, TILE_SIZE, TILE_SIZE,
        destCol * TILE_SIZE, destRow * TILE_SIZE, TILE_SIZE, TILE_SIZE,
      );
    };

    // 1. Render Pokemon logo tilemap at (2,1) — 16x7
    for (let row = 0; row < LOGO_H; row++) {
      for (let col = 0; col < LOGO_W; col++) {
        drawTileAt(logoMap[row * LOGO_W + col], LOGO_X + col, LOGO_Y + row);
      }
    }

    // 2. Render Pikachu tilemap at (4,8) — 12x9
    for (let row = 0; row < PIKA_H; row++) {
      for (let col = 0; col < PIKA_W; col++) {
        drawTileAt(pikaMap[row * PIKA_W + col], PIKA_X + col, PIKA_Y + row);
      }
    }

    // 3. Pikachu extra column tiles
    for (const [col, row, tileId] of PIKA_EXTRAS) {
      drawTileAt(tileId, col, row);
    }

    // 4. Render Pika speech bubble tilemap at (6,4) — 7x4
    for (let row = 0; row < BUBBLE_H; row++) {
      for (let col = 0; col < BUBBLE_W; col++) {
        drawTileAt(bubbleMap[row * BUBBLE_W + col], BUBBLE_X + col, BUBBLE_Y + row);
      }
    }

    // 5. Bubble extra tiles (tail connecting to Pikachu)
    for (const [col, row, tileId] of BUBBLE_EXTRAS) {
      drawTileAt(tileId, col, row);
    }

    // 6. Copyright text at bottom
    const gfX = Math.floor((GB_WIDTH - gfTiles.width) / 2);
    oc.drawImage(gfTiles, 0, 0, gfTiles.width, gfTiles.height, gfX, COPYRIGHT_Y * TILE_SIZE, gfTiles.width, gfTiles.height);

    this.background = offscreen;

    // 7. Pre-render eye overlays for each blink state (open, half-closed, closed)
    const eyeTilesPerRow = eyeTiles.width / TILE_SIZE;
    const c0 = colors[0]; // lightest color = transparent for sprites

    for (const offset of [EYE_OPEN, EYE_HALF, EYE_CLOSED]) {
      const eyeCanvas = document.createElement('canvas');
      eyeCanvas.width = EYE_REGION_W;
      eyeCanvas.height = EYE_REGION_H;
      const ec = eyeCanvas.getContext('2d')!;
      ec.imageSmoothingEnabled = false;

      for (const [sy, sx, baseTileIdx, xFlip] of EYE_SPRITES) {
        const tileIdx = baseTileIdx + offset;
        const srcX = (tileIdx % eyeTilesPerRow) * TILE_SIZE;
        const srcY = Math.floor(tileIdx / eyeTilesPerRow) * TILE_SIZE;

        const tmp = document.createElement('canvas');
        tmp.width = TILE_SIZE;
        tmp.height = TILE_SIZE;
        const tc = tmp.getContext('2d')!;
        tc.imageSmoothingEnabled = false;

        if (xFlip) {
          tc.save();
          tc.translate(TILE_SIZE, 0);
          tc.scale(-1, 1);
        }
        tc.drawImage(eyeTiles, srcX, srcY, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
        if (xFlip) tc.restore();

        // Make lightest color transparent (sprite color 0)
        const imgData = tc.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
        for (let i = 0; i < imgData.data.length; i += 4) {
          if (
            imgData.data[i] === c0[0] &&
            imgData.data[i + 1] === c0[1] &&
            imgData.data[i + 2] === c0[2]
          ) {
            imgData.data[i + 3] = 0;
          }
        }
        tc.putImageData(imgData, 0, 0);

        // Draw onto eye overlay at relative position
        ec.drawImage(tmp, sx - EYE_REGION_X, sy - EYE_REGION_Y);
      }

      this.eyeFrames.set(offset, eyeCanvas);
    }
  }

  update(): 'start' | null {
    this.advanceBlink();
    if (isPressed('a') || isPressed('start')) {
      return 'start';
    }
    return null;
  }

  render(): void {
    if (!this.background) return;
    const ctx = getCtx();
    const s = getScale();

    // Draw background (logo, pikachu body, bubble, copyright)
    ctx.drawImage(this.background, 0, 0, GB_WIDTH, GB_HEIGHT, 0, 0, GB_WIDTH * s, GB_HEIGHT * s);

    // Draw eye overlay for current blink state
    const eyeCanvas = this.eyeFrames.get(this.getEyeState());
    if (eyeCanvas) {
      ctx.drawImage(
        eyeCanvas, 0, 0, EYE_REGION_W, EYE_REGION_H,
        EYE_REGION_X * s, EYE_REGION_Y * s, EYE_REGION_W * s, EYE_REGION_H * s,
      );
    }
  }

  // Blink timer + scene state machine (matches assembly DoTitleScreenFunction)
  // Timer increments every frame (wraps as byte). Blink triggers at 0x80, 0x90, 0x00.
  // Scene 1-3: half-closed, 4-6: closed, 7-9: half-closed, 10: open, 11: reset
  private advanceBlink(): void {
    this.blinkTimer = (this.blinkTimer + 1) & 0xFF;

    if (this.blinkScene > 0) {
      // Animation in progress — advance to next frame
      this.blinkScene++;
      if (this.blinkScene > 11) {
        this.blinkScene = 0;
      }
    } else {
      // Idle — check timer for blink triggers
      if (
        this.blinkTimer === 0x80 ||
        this.blinkTimer === 0x90 ||
        this.blinkTimer === 0x00
      ) {
        this.blinkScene = 1;
      }
    }
  }

  private getEyeState(): number {
    if (this.blinkScene >= 1 && this.blinkScene <= 3) return EYE_HALF;
    if (this.blinkScene >= 4 && this.blinkScene <= 6) return EYE_CLOSED;
    if (this.blinkScene >= 7 && this.blinkScene <= 9) return EYE_HALF;
    return EYE_OPEN;
  }
}

async function fetchTilemap(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
