import type { TileCell, TileSurface } from '../menus/tile_surface';
import type { BattleScreen } from './battle_screen';

/** Preserve string/numeric BattleCells. A transparent overlay write has no battle tile to replace. */
export class BattleTiles implements TileSurface {
  constructor(readonly screen: BattleScreen) {}
  at(x: number, y: number): TileCell { return this.screen.at(x, y); }
  put(x: number, y: number, value: TileCell): void {
    if (value !== null) this.screen.put(x, y, value);
  }
  /** An explicit battle clear, unlike a transparent overlay null. */
  clear(x: number, y: number): void { this.screen.put(x, y, ' '); }
}
