// SaveMenu / PrintSaveScreenText / StartMenu_SaveReset (engine/menus/{save,main_menu,start_sub_menus}.asm).
import { isHeld } from '../input';
import { isSoundFinished, playSFX } from '../audio';
import type { TextBox } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { YesNoMenu } from './yes_no_menu';
import type { StartMenuSession } from './start_menu';
import { TIME_COLON_GLYPH } from './menu_glyphs';

export interface SaveInfo { player: string; badges: number; owned: number; playTimeMs: number }
type SavePhase = 'copy' | 'info' | 'question' | 'choice' | 'write' | 'saving' |
  'savingWait' | 'saved' | 'soundDelay' | 'sound' | 'finalWait' | 'holding' | 'done';

export class SaveSession {
  private phase: SavePhase = 'done';
  private remaining = 0;
  private choice: YesNoMenu | null = null;
  private info: SaveInfo | null = null;
  private soundStarted = false;
  private linger = false;

  constructor(
    private readonly start: StartMenuSession,
    private readonly textBox: TextBox,
    private readonly onSprites: () => void,
    private readonly writeSave: () => void,
  ) {}

  open(info: SaveInfo): void {
    this.info = info; this.choice = null; this.soundStarted = false; this.linger = false;
    this.phase = 'copy'; this.remaining = 5;
    textBgTransfer.enabled = false;
    this.start.tiles.textBoxBorder(4, 0, 8, 14);
  }

  frame(readJoypad: () => void): 'close' | null {
    if (this.phase === 'done') return null;
    this.present();
    switch (this.phase) {
      case 'copy':
        if (--this.remaining === 0) {
          this.onSprites(); this.drawInfo(); textBgTransfer.enabled = true;
          this.phase = 'info'; this.remaining = 40; // PrintSaveScreenText 30 + SaveMenu 10
        }
        break;
      case 'info':
        if (--this.remaining === 0) { this.print('WouldYouLikeToSaveText'); this.phase = 'question'; }
        break;
      case 'question':
        if (this.textBox.isComplete) {
          this.choice = new YesNoMenu(); this.choice.show({ actualRead: true, position: 'left' });
          this.phase = 'choice';
        }
        break;
      case 'choice': {
        const answer = this.choice!.update(readJoypad);
        if (!answer) break;
        this.choice = null;
        if (answer === 'no') return this.hold(readJoypad, true);
        this.phase = 'write'; this.remaining = 10;
        break;
      }
      case 'write':
        if (--this.remaining === 0) {
          this.writeSave(); this.print('SavingText'); this.phase = 'saving';
        }
        break;
      case 'saving':
        if (this.textBox.isComplete) { this.phase = 'savingWait'; this.remaining = 128; }
        break;
      case 'savingWait':
        if (--this.remaining === 0) { this.print('GameSavedText'); this.phase = 'saved'; }
        break;
      case 'saved':
        if (this.textBox.isComplete) { this.phase = 'soundDelay'; this.remaining = 10; }
        break;
      case 'soundDelay':
        if (--this.remaining === 0) { this.phase = 'sound'; this.advanceSound(); }
        break;
      case 'sound': this.advanceSound(); break;
      case 'finalWait':
        if (--this.remaining === 0) return this.hold(readJoypad, true);
        break;
      case 'holding': return this.hold(readJoypad);
    }
    return null;
  }

  paint(): void {
    this.start.paint(); this.textBox.render(); this.choice?.render();
  }

  private present(): void {
    const enabled = textBgTransfer.enabled, third = textBgTransfer.nextPortion;
    if (this.textBox.active) {
      if (this.phase === 'question' || this.phase === 'saving' || this.phase === 'saved') this.textBox.update();
      else this.textBox.updateDisplay();
      if (enabled) this.start.tiles.copyShownThird(third);
      if (this.linger && enabled && third === 2) { this.textBox.dismiss(); this.linger = false; }
    } else this.start.tiles.present(textBgTransfer);
  }

  private drawInfo(): void {
    const t = this.start.tiles, info = this.info!;
    t.placeString(5, 2, 'PLAYER<NEXT>BADGES    <NEXT>POKéDEX    <NEXT>TIME');
    t.placeString(12, 2, info.player);
    t.writeNumber(17, 4, info.badges, { digits: 2, leadingZeroes: false });
    t.writeNumber(16, 6, info.owned, { digits: 3, leadingZeroes: false });
    t.writeNumber(13, 8, Math.floor(info.playTimeMs / 3600000), { digits: 3, leadingZeroes: false });
    t.put(16, 8, TIME_COLON_GLYPH);
    t.writeNumber(17, 8, Math.floor(info.playTimeMs / 60000) % 60, { digits: 2, leadingZeroes: true });
  }

  private print(program: string): void {
    this.start.tiles.release(0, 12, 6, 20);
    this.textBox.printStandalone({ program }, { noDelay: false });
    this.onSprites(); // PrintText's logical border exists before Delay3/glyphs
  }

  private advanceSound(): void {
    if (!this.soundStarted) {
      if (!isSoundFinished()) return; // PlaySoundWaitForCurrent
      playSFX('save'); this.soundStarted = true;
    }
    if (!isSoundFinished()) return;
    this.phase = 'finalWait'; this.remaining = 30;
  }

  private hold(readJoypad: () => void, restore = false): 'close' | null {
    if (restore) { this.start.restore(); this.linger = this.textBox.active; this.phase = 'holding'; }
    readJoypad(); // HoldTextDisplayOpen reads held A, never asks for a fresh acknowledgement
    if (isHeld('a')) return null;
    this.phase = 'done'; return 'close';
  }
}
