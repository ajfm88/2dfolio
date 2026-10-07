// The Canvas equivalent of UI tile IDs >= $60 in wTileMap. Boxes register their
// tile coverage while drawing to the UI layer, before overworld sprites are drawn.
export class UiTiles {
  private readonly covered = new Set<number>();

  clear(): void { this.covered.clear(); }

  cover(x: number, y: number, width: number, height: number): void {
    for (let ty = Math.max(0, Math.floor(y / 8)); ty < Math.min(18, Math.ceil((y + height) / 8)); ty++) {
      for (let tx = Math.max(0, Math.floor(x / 8)); tx < Math.min(20, Math.ceil((x + width) / 8)); tx++) {
        this.covered.add(ty * 20 + tx);
      }
    }
  }

  tileAt = (x: number, y: number): number => {
    return x >= 0 && x < 20 && y >= 0 && y < 18 && this.covered.has(y * 20 + x) ? 0x60 : 0;
  };
}

export const uiTiles = new UiTiles();
