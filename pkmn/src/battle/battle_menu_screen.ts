// Logical Buffer1/2 and standalone PrintText ownership for the unused battle menus.
import { BattleScreen } from './battle_screen';
import type { BattleCell } from './battle_screen';
import { BattleTiles } from './battle_tiles';
import { TextBox } from '../text/textbox';
import type { TextDisplayHost } from '../text/textbox';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';
import type { Program } from './battle_menu_context';
import { textBgTransfer } from '../text/bg_transfer';

export class BattleMenuScreen {
  readonly tiles: BattleTiles;
  readonly textBox: TextBox;
  private buffer1: readonly BattleCell[];
  constructor(readonly screen = new BattleScreen(), host?: TextDisplayHost) {
    this.textBox = new TextBox(host);
    this.tiles = new BattleTiles(screen);
    this.buffer1 = screen.cells;
    screen.saveScreenTilesToBuffer2();
  }
  saveScreenTilesToBuffer1(): void { this.buffer1 = this.screen.cells; }
  /** pret home/tilemap.asm:9-13. The existing port shares BattleScreen's Buffer 2. */
  saveScreenTilesToBuffer2(): void { this.screen.saveScreenTilesToBuffer2(); }
  loadScreenTilesFromBuffer1(): void { this.restore(this.buffer1); }
  /** pret home/tilemap.asm:15-28. The existing port shares BattleScreen's Buffer 2. */
  loadScreenTilesFromBuffer2(): void { this.screen.loadScreenTilesFromBuffer2(); }
  private restore(cells: readonly BattleCell[]): void {
    textBgTransfer.enabled = false;
    cells.forEach((cell, i) => this.screen.put(i % 20, Math.floor(i / 20), cell));
    textBgTransfer.enabled = true;
  }
  /** Exactly one serviced VBlank, including the active text runner. Held frames must skip this. */
  vblank(): void { this.screen.vblank(this.textBox.active ? this.textBox : undefined, true); }
  *printText(program: string, bindings?: TextBindings, options: TextRunnerOptions = {}): Program {
    this.textBox.printStandalone({ program }, { bindings, ...options });
    while (!this.textBox.isComplete) yield 'serviced';
    // captureText already committed the final CPU writes. No extra flush, clear or Buffer1 restore.
    this.textBox.dismiss();
  }
}
