// Logical Buffer1/2 and standalone PrintText ownership for the unused battle menus.
import { BattleScreen } from './battle_screen';
import type { BattleCell } from './battle_screen';
import { BattleTiles } from './battle_tiles';
import { TextBox } from '../text/textbox';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';
import type { Program } from './battle_menu_context';
import { textBgTransfer } from '../text/bg_transfer';

export class BattleMenuScreen {
  readonly tiles: BattleTiles;
  readonly textBox = new TextBox();
  private buffer1: readonly BattleCell[];
  private buffer2: readonly BattleCell[];
  constructor(readonly screen = new BattleScreen()) {
    this.tiles = new BattleTiles(screen);
    this.buffer1 = this.buffer2 = screen.cells;
  }
  saveScreenTilesToBuffer1(): void { this.buffer1 = this.screen.cells; }
  saveScreenTilesToBuffer2(): void { this.buffer2 = this.screen.cells; }
  loadScreenTilesFromBuffer1(): void { this.restore(this.buffer1); }
  loadScreenTilesFromBuffer2(): void { this.restore(this.buffer2); }
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
