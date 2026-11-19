// The opening's screen model (opening checkpoint-05, note 114 §3): the hardware the title, and later the copyright,
// the star and the movie, draw on. VRAM bank 0's 384 tiles, both 32 × 32 BG maps and their CGB attributes, the
// scroll and window registers with the copies VBlank latches (home/vblank.asm), shadow OAM and the OAM VBlank's DMA
// shows, BGP/OBP0/OBP1 and the CGB base palettes the last palette command chose, and the LCD's state. wTileMap and
// AutoBgMapTransfer's thirds are the shared core (renderer/screen_model.ts). No clock and no browser here.
import { TileMap } from '../renderer/screen_model';
import { textBgTransfer } from '../text/bg_transfer';
import { SCREEN_WIDTH } from './screen_tiles';

export const VRAM_TILES = 384;
export const BG_MAP0 = 0x9800;
export const BG_MAP1 = 0x9c00;
export const OAM_BYTES = 160;
/** ' ' in the charmap. */
export const SPACE_TILE = 0x7f;

export interface OpeningImage {
  readonly width: number;
  readonly height: number;
  /** RGBA; the red channel carries the PNG's gray. */
  readonly data: ArrayLike<number>;
}

/** The colour index of a gray pixel, as renderer.ts's grayToColorIndex buckets it (255/170/85/0 → 0–3). */
function colourIndex(gray: number): number {
  if (gray >= 192) return 0;
  if (gray >= 128) return 1;
  if (gray >= 64) return 2;
  return 3;
}

/** LCDC_BLOCK21 (LCDC_DEFAULT): BG and window tile ids $80–$FF are $8800–$8FFF, $00–$7F are $9000–$97FF. */
export function bgTileIndex(id: number): number {
  return id >= 0x80 ? id : 0x100 + id;
}

export class OpeningScreen {
  /** Colour indices 0–3, 64 per tile, $8000 + 16 × index. */
  readonly vram: Uint8Array[] = Array.from({ length: VRAM_TILES }, () => new Uint8Array(64));
  /** Init's ClearBgMap fills both maps with ' ' (home/init.asm). */
  readonly bgMaps: [Uint8Array, Uint8Array] = [new Uint8Array(1024).fill(SPACE_TILE), new Uint8Array(1024).fill(SPACE_TILE)];
  /** VRAM bank 1: the palette number in bits 0–2, X and Y flip in bits 5–6, BG priority in bit 7. */
  readonly attributes: [Uint8Array, Uint8Array] = [new Uint8Array(1024), new Uint8Array(1024)];
  readonly tileMap = new TileMap<number>(() => SPACE_TILE);
  /** hAutoBGTransferDest. Init points it at vBGMap1. */
  bgTransferDest = BG_MAP1;
  /** hSCX, hSCY, hWY: the CPU's copies. VBlank writes them to the registers below. */
  hScx = 0;
  hScy = 0;
  hWy = 144;
  scx = 0;
  scy = 0;
  wy = 144;
  /** Init writes rWX = 7 once. */
  wx = 7;
  bgp = 0;
  obp0 = 0;
  obp1 = 0;
  /** CGB BG palettes 0–3 and OBJ palettes 0–7 (0–3 through OBP0, 4–7 through OBP1): CGBBasePalettes names.
   *  Before a palette command every slot is the renderer's fallback, unseen while the DMG registers are 0. */
  bgPalettes: string[] = ['ROUTE', 'ROUTE', 'ROUTE', 'ROUTE'];
  objPalettes: string[] = Array<string>(8).fill('ROUTE');
  /** wShadowOAM. */
  readonly oam = new Uint8Array(OAM_BYTES);
  private readonly dmaOam = new Uint8Array(OAM_BYTES);
  private lcd = true;
  private skipped = false;

  /** OAM as the last DMA left it: what the LCD draws. */
  get shownOam(): Uint8Array { return this.dmaOam.slice(); }
  get lcdOn(): boolean { return this.lcd; }
  /** The first frame after EnableLCD is not drawn (DECISIONS #97). */
  get blankFrame(): boolean { return !this.lcd || this.skipped; }

  disableLcd(): void { this.lcd = false; }
  enableLcd(): void { this.lcd = true; this.skipped = true; }

  /** A tile copy into VRAM: `count` tiles of `image`, row-major from tile `first`, to VRAM tile `vramTile`. */
  loadTiles(vramTile: number, image: OpeningImage, count: number, first = 0): void {
    const across = image.width >> 3;
    if (first + count > across * (image.height >> 3)) throw new Error('tile copy past the end of its image');
    if (vramTile + count > VRAM_TILES) throw new Error('tile copy past the end of VRAM');
    for (let tile = 0; tile < count; tile++) {
      const column = (first + tile) % across, row = Math.floor((first + tile) / across);
      const target = this.vram[vramTile + tile];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
        target[y * 8 + x] = colourIndex(image.data[((row * 8 + y) * image.width + column * 8 + x) * 4]);
    }
  }

  /** A CPU write to $9800–$9FFF. */
  writeBg(address: number, value: number): void {
    if (address < BG_MAP0 || address >= BG_MAP1 + 0x400) throw new Error(`BG map write outside VRAM: $${address.toString(16)}`);
    this.bgMaps[address < BG_MAP1 ? 0 : 1][address & 0x3ff] = value;
  }

  /** FillMemory over BG map addresses. */
  fillBg(address: number, count: number, value: number): void {
    for (let offset = 0; offset < count; offset++) this.writeBg(address + offset, value);
  }

  /** LoadBGMapAttributes' two VRAM DMAs: rows of 32, from row 0. */
  setAttributes(map: 0 | 1, rows: readonly number[]): void {
    if (rows.length % 32 !== 0 || rows.length > 1024) throw new Error('attribute block must be whole rows of 32');
    this.attributes[map].set(rows);
  }

  /** The VBlank half, in home/vblank.asm's order: the scroll and window registers, AutoBgMapTransfer, OAM DMA.
   *  Returns the third transferred, or null while the transfer is disabled. */
  vblank(): number | null {
    this.skipped = false;
    this.scx = this.hScx; this.scy = this.hScy; this.wy = this.hWy;
    const dest = this.bgTransferDest;
    // TransferBgRows: each row starts 32 bytes after the last, so rows 0–7 of a $9B00 copy land in vBGMap0's rows
    // 24–31 and rows 8–17 in vBGMap1's rows 0–9.
    const third = this.tileMap.transferThird((index, cell) =>
      this.writeBg(dest + Math.floor(index / SCREEN_WIDTH) * 32 + index % SCREEN_WIDTH, cell));
    textBgTransfer.tick();
    this.dmaOam.set(this.oam);
    return third;
  }
}
