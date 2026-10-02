// Pokedex menu — list, data, and area screens
// Assembly ref: engine/menus/pokedex.asm, engine/items/town_map.asm

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { getCtx, getScale, fillRect, loadTileset, loadSprite } from '../renderer';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { isSeen, isOwned, getSeenCount, getOwnedCount, getMaxSeen } from '../pokedex_state';
import { loadPokemonSprites } from '../battle';
import { playSFX } from '../audio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PokedexEntry {
  id: number;
  species: string;
  heightFeet: number;
  heightInches: number;
  weight: number;
  description: string[][];
  locations: string[];
}

interface TownMapData {
  tilemap: number[];
  width: number;
  height: number;
  locations: Record<string, { x: number; y: number; name: string }>;
  indoorMapParent: Record<string, string>;
}

type PokedexState = 'list' | 'side_menu' | 'data' | 'data_page2' | 'area';
type PokedexResult = 'open' | 'closed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const T = TILE_SIZE; // 8px
const MAX_VISIBLE = 7;
const TILESET_COLS = 4; // town map tileset is 4 tiles wide
const BLINK_PERIOD = 50;
const BLINK_ON = 25;

// Pokemon names indexed by dex number (loaded from pokemon.json)
let pokemonNames: string[] = [];

// ---------------------------------------------------------------------------
// PokedexMenu class
// ---------------------------------------------------------------------------

export class PokedexMenu {
  private state: PokedexState = 'list';
  private cursor = 0;          // 0-6 visible slot index
  private scrollOffset = 0;    // first visible dex number - 1
  private maxDex = 0;          // highest dex number seen
  private sideMenuCursor = 0;  // 0=DATA, 1=AREA, 2=QUIT
  private selectedDex = 0;     // dex number of currently selected Pokemon

  // Data screen
  private frontSprite: HTMLCanvasElement | null = null;
  private spriteLoadingFor = '';

  // Pokedex data
  private pokedexData: (PokedexEntry | null)[] = [];
  private dataLoaded = false;

  // Area screen assets
  private townMapData: TownMapData | null = null;
  private townMapTileset: HTMLCanvasElement | null = null;
  private nestIcon: HTMLCanvasElement | null = null;
  private playerSprite: HTMLCanvasElement | null = null;
  private playerLocationKey = '';

  // Pokedex tiles — MEWMON palette for list screen divider
  private pokedexTileset: HTMLCanvasElement | null = null;
  // Pokedex tiles — BROWNMON palette for data screen border/divider/ticks
  private pokedexTilesetBrown: HTMLCanvasElement | null = null;
  // font_battle_extra tiles — BROWNMON palette for № character
  private battleExtraTiles: HTMLCanvasElement | null = null;

  // Pokeball indicator tile (from gfx/battle/balls.png)
  private pokeballTiles: HTMLCanvasElement | null = null;

  // Blink timer for area screen nest icons
  private blinkTimer = 0;

  async show(currentMapName?: string): Promise<void> {
    this.state = 'list';
    this.cursor = 0;
    this.scrollOffset = 0;
    this.sideMenuCursor = 0;
    this.maxDex = getMaxSeen();
    this.frontSprite = null;
    this.spriteLoadingFor = '';

    if (!this.dataLoaded) {
      const [pokedexData, pokemonData, townMapData, tileset, nestIcon, playerSpr, pokedexTileset, pokeballTiles, pokedexTilesetBrown, battleExtraTiles] = await Promise.all([
        fetch('pokedex.json').then(r => r.json()) as Promise<(PokedexEntry | null)[]>,
        fetch('pokemon.json').then(r => r.json()) as Promise<({ name: string } | null)[]>,
        fetch('town_map.json').then(r => r.json()) as Promise<TownMapData>,
        loadTileset('/gfx/town_map/town_map.png', 'TOWNMAP'),
        loadSprite('/gfx/town_map/mon_nest_icon.png', 'TOWNMAP'),
        loadSprite('/gfx/sprites/red.png', 'TOWNMAP'),
        loadTileset('/gfx/pokedex/pokedex.png', 'MEWMON'),
        loadTileset('/gfx/battle/balls.png', 'MEWMON'),
        loadTileset('/gfx/pokedex/pokedex.png', 'BROWNMON'),
        loadTileset('/gfx/font/font_battle_extra.png', 'BROWNMON'),
      ]);
      this.pokedexData = pokedexData;
      this.townMapData = townMapData;
      this.townMapTileset = tileset;
      this.nestIcon = nestIcon;
      this.playerSprite = playerSpr;
      this.pokedexTileset = pokedexTileset;
      this.pokeballTiles = pokeballTiles;
      this.pokedexTilesetBrown = pokedexTilesetBrown;
      this.battleExtraTiles = battleExtraTiles;

      // Build pokemon names array
      pokemonNames = [];
      for (let i = 0; i < pokemonData.length; i++) {
        pokemonNames[i] = pokemonData[i]?.name?.toUpperCase() ?? '';
      }

      this.dataLoaded = true;
    }

    // Resolve player's map location (indoor maps → parent town)
    if (currentMapName && this.townMapData) {
      const parent = this.townMapData.indoorMapParent[currentMapName];
      this.playerLocationKey = parent ?? currentMapName;
    }
  }

  update(): PokedexResult {
    this.blinkTimer = (this.blinkTimer + 1) % BLINK_PERIOD;

    if (this.state === 'list') return this.updateList();
    if (this.state === 'side_menu') return this.updateSideMenu();
    if (this.state === 'data') return this.updateData();
    if (this.state === 'data_page2') return this.updateDataPage2();
    if (this.state === 'area') return this.updateArea();
    return 'open';
  }

  render(): void {
    if (this.state === 'list' || this.state === 'side_menu') {
      this.renderList();
    } else if (this.state === 'data' || this.state === 'data_page2') {
      this.renderData();
    } else if (this.state === 'area') {
      this.renderArea();
    }
  }

  // =========================================================================
  // List screen
  // =========================================================================

  private updateList(): PokedexResult {
    if (this.maxDex === 0) {
      // Empty pokedex, only B to exit
      if (isPressed('b')) {
        playSFX('press_ab');
        return 'closed';
      }
      return 'open';
    }

    const maxScroll = Math.max(0, this.maxDex - MAX_VISIBLE);

    if (isPressed('up')) {
      if (this.cursor > 0) {
        this.cursor--;
      } else if (this.scrollOffset > 0) {
        this.scrollOffset--;
      }
    } else if (isPressed('down')) {
      const currentDex = this.scrollOffset + this.cursor + 1;
      if (currentDex < this.maxDex) {
        if (this.cursor < MAX_VISIBLE - 1) {
          this.cursor++;
        } else {
          this.scrollOffset = Math.min(this.scrollOffset + 1, maxScroll);
        }
      }
    } else if (isPressed('left')) {
      // Page up
      this.scrollOffset = Math.max(0, this.scrollOffset - MAX_VISIBLE);
      this.cursor = 0;
    } else if (isPressed('right')) {
      // Page down
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + MAX_VISIBLE);
      // Clamp cursor
      const visibleCount = Math.min(MAX_VISIBLE, this.maxDex - this.scrollOffset);
      this.cursor = Math.min(this.cursor, visibleCount - 1);
    } else if (isPressed('a')) {
      playSFX('press_ab');
      const dexNum = this.scrollOffset + this.cursor + 1;
      if (dexNum >= 1 && dexNum <= 151 && isSeen(dexNum)) {
        this.selectedDex = dexNum;
        this.sideMenuCursor = 0;
        this.state = 'side_menu';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      return 'closed';
    }

    return 'open';
  }

  private renderList(): void {
    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0); // white background

    // Title "CONTENTS" — ASM: hlcoord 1, 1
    drawText('CONTENTS', T, T);

    // Visible Pokemon entries — ASM: list starts at hlcoord 1, 3
    const visibleCount = Math.min(MAX_VISIBLE, Math.max(0, this.maxDex - this.scrollOffset));
    for (let i = 0; i < visibleCount; i++) {
      const dexNum = this.scrollOffset + i + 1;
      const y = (i * 2 + 2) * T; // dex# row; name row = y + T

      // Dex number (3 digits, zero-padded) — columns 1-3
      const numStr = String(dexNum).padStart(3, '0');
      drawText(numStr, T, y);

      // Pokeball icon if owned — column 3, same row as name
      if (isOwned(dexNum) && this.pokeballTiles) {
        const s = getScale();
        const ctx = getCtx();
        // Tile 0 from balls.png (healthy pokeball, 8x8)
        ctx.drawImage(this.pokeballTiles, 0, 0, 8, 8, 3 * T * s, (y + T) * s, 8 * s, 8 * s);
      }

      // Pokemon name (or dashes if unseen) — column 4+
      if (isSeen(dexNum)) {
        const name = pokemonNames[dexNum] || '???';
        drawText(name, 4 * T, y + T);
      } else {
        drawText('----------', 4 * T, y + T);
      }

      // Selection cursor — column 0
      // Hollow arrow when side menu is active, filled when list is active
      if (i === this.cursor) {
        const cursorChar = this.state === 'side_menu' ? '\u25B7' : '\u25B6';
        drawText(cursorChar, 0, y + T);
      }
    }

    // Vertical divider — column 14, using pokedex.png tiles $70/$71
    this.drawPokedexDivider();

    // Right side: SEEN — ASM: hlcoord 16, 1
    drawText('SEEN', 16 * T, T);
    // SEEN count — ASM: hlcoord 16, 2
    const seenStr = String(getSeenCount()).padStart(3);
    drawText(seenStr, 16 * T, 2 * T);

    // OWN — ASM: hlcoord 16, 4
    drawText('OWN', 16 * T, 4 * T);
    // OWN count — ASM: hlcoord 16, 5
    const ownStr = String(getOwnedCount()).padStart(3);
    drawText(ownStr, 16 * T, 5 * T);

    // Double-line divider below OWN — ASM: hlcoord 15, 6 (5 '─' tiles)
    // Font '─' tile is two thin horizontal lines with a white gap between them
    const ctx = getCtx();
    const s = getScale();
    ctx.fillStyle = '#000';
    ctx.fillRect(15 * T * s, (6 * T + 3) * s, 5 * T * s, 1 * s);
    ctx.fillRect(15 * T * s, (6 * T + 5) * s, 5 * T * s, 2 * s);

    // Side menu items — ALWAYS visible, spaced with 2-row gaps
    // Original has 5 items (DATA/CRY/AREA/PRNT/QUIT) on consecutive rows 8-12.
    // We skip CRY/PRNT, so space the remaining 3 items with 2-row gaps.
    const sideItems = ['DATA', 'AREA', 'QUIT'];
    for (let i = 0; i < sideItems.length; i++) {
      const row = 8 + i * 2;
      drawText(sideItems[i], 16 * T, row * T);
      // Show filled cursor when side menu is active
      if (this.state === 'side_menu' && i === this.sideMenuCursor) {
        drawText('\u25B6', 15 * T, row * T);
      }
    }
  }

  /** Draw vertical divider at column 14 using pokedex.png tiles. */
  private drawPokedexDivider(): void {
    if (!this.pokedexTileset) return;
    const ctx = getCtx();
    const s = getScale();
    const ts = this.pokedexTileset;
    const tilesPerRow = Math.floor(ts.width / T); // 3 tiles per row

    const drawPokedexTile = (tileIdx: number, col: number, row: number) => {
      const srcX = (tileIdx % tilesPerRow) * T;
      const srcY = Math.floor(tileIdx / tilesPerRow) * T;
      ctx.drawImage(ts, srcX, srcY, T, T, col * T * s, row * T * s, T * s, T * s);
    };

    // ASM pattern: tile $71 (index 17) and $70 (index 16) alternating
    // Row 0: $71, then rows 1-9 start with $71 alternating, rows 9-17 start with $71 alternating
    // Result: even rows = $71 (line with square), odd rows = $70 (plain line)
    // Exception: row 1 = $71 (same as row 0)
    for (let row = 0; row < 18; row++) {
      const tileIdx = (row === 0 || row % 2 === 1) ? 17 : 16;
      drawPokedexTile(tileIdx, 14, row);
    }
  }

  // =========================================================================
  // Side menu (DATA / AREA / QUIT)
  // =========================================================================

  private updateSideMenu(): PokedexResult {
    if (isPressed('up')) {
      this.sideMenuCursor = (this.sideMenuCursor - 1 + 3) % 3;
    } else if (isPressed('down')) {
      this.sideMenuCursor = (this.sideMenuCursor + 1) % 3;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.sideMenuCursor === 0) {
        // DATA — show for any seen Pokemon (owned shows full info, seen shows ?)
        if (isSeen(this.selectedDex)) {
          this.state = 'data';
          this.loadFrontSprite();
        }
      } else if (this.sideMenuCursor === 1) {
        // AREA
        this.state = 'area';
        this.blinkTimer = 0;
      } else {
        // QUIT — back to list
        this.state = 'list';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'list';
    }
    return 'open';
  }

  // Side menu items are now always rendered as part of renderList()

  // =========================================================================
  // Data screen
  // =========================================================================

  private loadFrontSprite(): void {
    const name = pokemonNames[this.selectedDex];
    if (!name) return;
    const speciesName = name.charAt(0) + name.slice(1).toLowerCase();
    if (this.spriteLoadingFor === speciesName && this.frontSprite) return;
    this.frontSprite = null;
    this.spriteLoadingFor = speciesName;
    loadPokemonSprites(speciesName, this.selectedDex).then(sprites => {
      if (this.spriteLoadingFor === speciesName) {
        this.frontSprite = sprites.front;
      }
    }).catch(() => { /* sprite not available */ });
  }

  private updateData(): PokedexResult {
    if (isPressed('a') || isPressed('b')) {
      playSFX('press_ab');
      if (isPressed('a') && isOwned(this.selectedDex)) {
        const entry = this.pokedexData[this.selectedDex];
        if (entry && entry.description.length > 1) {
          this.state = 'data_page2';
          return 'open';
        }
      }
      this.state = 'side_menu';
    }
    return 'open';
  }

  private updateDataPage2(): PokedexResult {
    if (isPressed('a') || isPressed('b')) {
      playSFX('press_ab');
      this.state = 'side_menu';
    }
    return 'open';
  }

  private renderData(): void {
    const entry = this.pokedexData[this.selectedDex];
    if (!entry) return;

    const owned = isOwned(this.selectedDex);

    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0); // white background

    // Draw decorative border using BROWNMON palette pokedex tileset
    this.drawPokedexBorder();

    // Front sprite (7x7 tile area at tile position 1,1)
    this.drawFrontSprite();

    // Pokemon name
    const name = pokemonNames[this.selectedDex] || '???';
    drawText(name, 9 * T, 2 * T);

    // Species name (e.g., "MOUSE")
    drawText(entry.species, 9 * T, 4 * T);

    // Height: HT  X′XX″ — ASM pre-fills "?′??″", only overwrites if owned
    drawText('HT', 9 * T, 6 * T);
    if (owned) {
      const feetStr = String(entry.heightFeet);
      drawText(feetStr, (14 - feetStr.length) * T, 6 * T);
      this.drawBrownPokedexTile(0, 14, 6); // ′ (prime)
      const inchStr = String(entry.heightInches).padStart(2, '0');
      drawText(inchStr, 15 * T, 6 * T);
      this.drawBrownPokedexTile(1, 17, 6); // ″ (double prime)
    } else {
      drawText('?', 13 * T, 6 * T);
      this.drawBrownPokedexTile(0, 14, 6); // ′
      drawText('??', 15 * T, 6 * T);
      this.drawBrownPokedexTile(1, 17, 6); // ″
    }

    // Weight: WT  XXX.Xlb — shows "???lb" if not owned
    if (owned) {
      const wtStr = `WT  ${entry.weight.toFixed(1)}lb`;
      drawText(wtStr, 9 * T, 8 * T);
    } else {
      drawText('WT   ???lb', 9 * T, 8 * T);
    }

    // Decorative horizontal divider at row 9 (ASM: PokedexDataDividerLine)
    this.drawDataDivider();

    // "No. 025" — above the divider, at row 8 left side (below sprite area)
    this.drawNoSymbol(1, 8);
    drawText(`. ${String(entry.id).padStart(3, '0')}`, 2 * T, 8 * T);

    // Description text and page indicator — only if owned (ASM: ret z skips all)
    if (owned) {
      const page = this.state === 'data_page2' ? 1 : 0;
      const lines = entry.description[page] || [];
      for (let i = 0; i < lines.length; i++) {
        drawText(lines[i], T, (11 + i * 2) * T);
      }

      // Page indicator: blinking down arrow if page 2 available, on page 1
      if (this.state === 'data' && entry.description.length > 1 && this.blinkTimer < BLINK_ON) {
        drawText('\u25BC', 18 * T, 16 * T);
      }
    }
  }

  /** Draw decorative border on data screen using BROWNMON palette pokedex tiles.
   *  Tile indices from ASM: $63=UL, $64=top, $65=UR, $66=left, $67=right,
   *  $6C=LL, $6E=LR, $6F=bottom (subtract $60 for 0-based index). */
  private drawPokedexBorder(): void {
    // Corners
    this.drawBrownPokedexTile(3, 0, 0);    // upper-left
    this.drawBrownPokedexTile(5, 19, 0);   // upper-right
    this.drawBrownPokedexTile(12, 0, 17);  // lower-left
    this.drawBrownPokedexTile(14, 19, 17); // lower-right
    // Top edge
    for (let col = 1; col < 19; col++) this.drawBrownPokedexTile(4, col, 0);
    // Bottom edge
    for (let col = 1; col < 19; col++) this.drawBrownPokedexTile(15, col, 17);
    // Left edge
    for (let row = 1; row < 17; row++) this.drawBrownPokedexTile(6, 0, row);
    // Right edge
    for (let row = 1; row < 17; row++) this.drawBrownPokedexTile(7, 19, row);
  }

  /** Draw a tile from pokedex.png (BROWNMON palette) at tile grid position. */
  private drawBrownPokedexTile(tileIdx: number, col: number, row: number): void {
    if (!this.pokedexTilesetBrown) return;
    const ctx = getCtx();
    const s = getScale();
    const ts = this.pokedexTilesetBrown;
    const tilesPerRow = Math.floor(ts.width / T); // 3
    const srcX = (tileIdx % tilesPerRow) * T;
    const srcY = Math.floor(tileIdx / tilesPerRow) * T;
    ctx.drawImage(ts, srcX, srcY, T, T, col * T * s, row * T * s, T * s, T * s);
  }

  /** Draw decorative horizontal divider at row 9 on data screen.
   *  ASM: PokedexDataDividerLine pattern using tiles $68/$69/$6A/$6B. */
  private drawDataDivider(): void {
    const pattern = [8, 9, 11, 9, 11, 9, 11, 9, 11, 11, 11, 11, 9, 11, 9, 11, 9, 11, 9, 10];
    for (let col = 0; col < 20; col++) {
      this.drawBrownPokedexTile(pattern[col], col, 9);
    }
  }

  /** Draw the № (compact "No") symbol from font_battle_extra.png tile 18. */
  private drawNoSymbol(col: number, row: number): void {
    if (!this.battleExtraTiles) return;
    const ctx = getCtx();
    const s = getScale();
    const ts = this.battleExtraTiles;
    const tilesPerRow = Math.floor(ts.width / T); // 30
    const tileIdx = 18; // $74 - $62 = 18
    const srcX = (tileIdx % tilesPerRow) * T;
    const srcY = Math.floor(tileIdx / tilesPerRow) * T;
    ctx.drawImage(ts, srcX, srcY, T, T, col * T * s, row * T * s, T * s, T * s);
  }

  /** Draw the front sprite (flipped, matching assembly LoadFlippedFrontSpriteByMonIndex). */
  private drawFrontSprite(): void {
    if (!this.frontSprite) return;
    const ctx = getCtx();
    const s = getScale();
    const spriteW = this.frontSprite.width;
    const spriteH = this.frontSprite.height;
    // 7x7 tile area at (1,1)
    const areaX = T;
    const areaY = T;
    const areaSize = 7 * T; // 56px
    const x = areaX + (areaSize - spriteW);
    const y = areaY + (areaSize - spriteH);
    // Draw flipped (mirrored horizontally, matching party_menu.ts pattern)
    ctx.save();
    ctx.translate((x + spriteW) * s, y * s);
    ctx.scale(-1, 1);
    ctx.drawImage(this.frontSprite, 0, 0, spriteW, spriteH, 0, 0, spriteW * s, spriteH * s);
    ctx.restore();
  }

  // =========================================================================
  // Area screen
  // =========================================================================

  private updateArea(): PokedexResult {
    if (isPressed('b') || isPressed('a')) {
      playSFX('press_ab');
      this.state = 'side_menu';
    }
    return 'open';
  }

  private renderArea(): void {
    if (!this.townMapData || !this.townMapTileset) return;

    const ctx = getCtx();
    const s = getScale();
    const { tilemap, width, height, locations } = this.townMapData;

    // Draw the tilemap (full screen 20x18 tiles)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tileIdx = tilemap[row * width + col];
        const srcX = (tileIdx % TILESET_COLS) * T;
        const srcY = Math.floor(tileIdx / TILESET_COLS) * T;
        ctx.drawImage(
          this.townMapTileset,
          srcX, srcY, T, T,
          col * T * s, row * T * s, T * s, T * s,
        );
      }
    }

    // Pokemon name + "'s NEST" at top
    const name = pokemonNames[this.selectedDex] || '???';
    const nestTitle = `${name}\u2019s NEST`;
    fillRect(T, 0, nestTitle.length * T, T, 0);
    drawText(nestTitle, T, 0);

    // Get the entry's locations
    const entry = this.pokedexData[this.selectedDex];
    const entryLocations = entry?.locations || [];

    if (entryLocations.length === 0) {
      // "AREA UNKNOWN" centered text box
      const boxX = T;
      const boxY = 7 * T;
      const boxW = 18 * T;
      const boxH = 4 * T;
      drawBox(boxX, boxY, boxW, boxH);
      drawText('AREA UNKNOWN', 4 * T, 9 * T);
    } else {
      // Player sprite first (below nests) — always visible, non-blinking
      const playerLoc = locations[this.playerLocationKey];
      if (playerLoc && this.playerSprite) {
        const ppx = playerLoc.x * 8 + 12;
        const ppy = playerLoc.y * 8 + 4;
        ctx.drawImage(
          this.playerSprite,
          0, 0, 16, 16,
          ppx * s, ppy * s, 16 * s, 16 * s,
        );
      }

      // Draw nest icons on top (blinking)
      if (this.blinkTimer < BLINK_ON && this.nestIcon) {
        for (const locKey of entryLocations) {
          const loc = locations[locKey];
          if (!loc) continue;
          // OAM coordinate conversion: ASM uses (coord*8)+24, screen = OAM-16(Y) / OAM-8(X)
          const px = loc.x * 8 + 16;
          const py = loc.y * 8 + 8;
          ctx.drawImage(
            this.nestIcon,
            0, 0, this.nestIcon.width, this.nestIcon.height,
            px * s, py * s, this.nestIcon.width * s, this.nestIcon.height * s,
          );
        }
      }
    }
  }
}
