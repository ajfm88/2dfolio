// Name registration (NES Mode E; Z_02.asm UpdateModeERegister + ModeE_HandleAOrB
// + ModeE_HandleDirections + UpdateModeEandF_Idle).
//
// A slot cursor over the three files + "END", plus the 44-cell character board.
// You can only register into an empty file (Select skips already-registered
// slots, matching the NES `IsSaveSlotActive` skip). Directions move the board
// with DAS auto-repeat; A writes the highlighted character into the current
// file's 8-char name and advances the name cursor; B advances without writing;
// Start on END commits every edited file. Like FileSelectScreen, this screen
// emits registration intents that main.ts applies to the SaveManager.
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../core/constants.js';
import { Action, type InputManager } from '../core/input.js';
import type { Renderer } from '../render/renderer.js';
import type { BitmapFont } from './bitmap-font.js';
import { SAVE_SLOT_COUNT, MAX_NAME_LENGTH, type SaveSlot } from '../save/save-manager.js';
import { NameBoard, BOARD_COLS, NAME_BOARD } from './name-board.js';
import {
  CURSOR_FLASH_FRAMES,
  FS_CURSOR_X,
  FS_LABEL_X,
  FS_SLOT_SPACING,
  FS_SLOT_Y0,
  drawFrontEndTitle,
} from './file-select-screen.js';

const END_TARGET = SAVE_SLOT_COUNT;      // slot-cursor index of "END"
const SLOT_TARGET_COUNT = SAVE_SLOT_COUNT + 1;

// DAS auto-repeat: act on press, then wait 16 frames to the first repeat, then
// every 8 frames (Z_02.asm:1830-1838 ModeE_ChooseRepeatDelay).
const DAS_INITIAL = 16;
const DAS_REPEAT = 8;

// Character-board layout (below the name rows).
const BOARD_ORIGIN_X = 44;
const BOARD_ORIGIN_Y = 144;
const BOARD_CELL_W = 16;
const BOARD_CELL_H = 16;
const END_Y = 216;

type Dir = 'right' | 'left' | 'down' | 'up' | null;

function blankName(): string {
  return ' '.repeat(MAX_NAME_LENGTH);
}

function targetY(target: number): number {
  return target < SAVE_SLOT_COUNT ? FS_SLOT_Y0 + target * FS_SLOT_SPACING : END_Y;
}

export interface Registration {
  slot: number;
  name: string;
}

export class NameRegistrationScreen {
  private readonly board = new NameBoard();
  private names: string[] = [];        // live 8-char buffers, one per slot
  private editable: boolean[] = [];    // false for slots already registered
  private slotCursor = 0;              // 0..2 or END_TARGET
  private nameCursor = 0;              // 0..MAX_NAME_LENGTH-1
  private heldDir: Dir = null;
  private repeatTimer = 0;
  private cursorVisible = true;
  private cursorTimer = 0;
  private _done = false;
  private _registrations: Registration[] = [];

  get done(): boolean {
    return this._done;
  }

  /** Registrations to apply once done; main.ts reads these then leaves the mode. */
  get registrations(): readonly Registration[] {
    return this._registrations;
  }

  get slotCursorIndex(): number {
    return this.slotCursor;
  }

  get boardIndex(): number {
    return this.board.index;
  }

  /** Current buffer text for a slot (for tests/inspection). */
  nameOf(slot: number): string {
    return this.names[slot] ?? '';
  }

  reset(slots: readonly SaveSlot[]): void {
    this.names = [];
    this.editable = [];
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
      const slot = slots[i];
      const registered = !!slot && slot.registered;
      this.editable[i] = !registered;
      this.names[i] = registered ? slot!.name.padEnd(MAX_NAME_LENGTH, ' ') : blankName();
    }
    this.board.reset();
    // Start on the first editable slot, else END.
    this.slotCursor = this.editable.findIndex(e => e);
    if (this.slotCursor < 0) this.slotCursor = END_TARGET;
    this.nameCursor = 0;
    this.heldDir = null;
    this.repeatTimer = 0;
    this._done = false;
    this._registrations = [];
    this.cursorVisible = true;
    this.cursorTimer = 0;
  }

  private currentDir(input: InputManager): Dir {
    if (input.isHeld(Action.Right)) return 'right';
    if (input.isHeld(Action.Left)) return 'left';
    if (input.isHeld(Action.Down)) return 'down';
    if (input.isHeld(Action.Up)) return 'up';
    return null;
  }

  private applyDir(dir: Dir): void {
    switch (dir) {
      case 'right': this.board.moveRight(); break;
      case 'left': this.board.moveLeft(); break;
      case 'down': this.board.moveDown(); break;
      case 'up': this.board.moveUp(); break;
      default: break;
    }
  }

  /** Select cycles to the next editable slot or END, skipping registered slots. */
  private cycleSlot(): void {
    let next = this.slotCursor;
    for (let i = 0; i < SLOT_TARGET_COUNT; i++) {
      next = (next + 1) % SLOT_TARGET_COUNT;
      if (next === END_TARGET || this.editable[next]) break;
    }
    this.slotCursor = next;
    this.nameCursor = 0;
  }

  update(input: InputManager): void {
    this.cursorTimer++;
    if (this.cursorTimer >= CURSOR_FLASH_FRAMES) {
      this.cursorTimer = 0;
      this.cursorVisible = !this.cursorVisible;
    }

    if (input.isJustPressed(Action.Select)) {
      this.cycleSlot();
      return;
    }

    if (input.isJustPressed(Action.Start)) {
      if (this.slotCursor === END_TARGET) this.commit();
      return;
    }

    const onSlot = this.slotCursor < SAVE_SLOT_COUNT;

    // Character-board movement with DAS auto-repeat (only while editing a slot).
    const dir = onSlot ? this.currentDir(input) : null;
    if (dir === null) {
      this.heldDir = null;
      this.repeatTimer = 0;
    } else if (dir !== this.heldDir) {
      this.applyDir(dir);
      this.heldDir = dir;
      this.repeatTimer = DAS_INITIAL;
    } else if (--this.repeatTimer <= 0) {
      this.applyDir(dir);
      this.repeatTimer = DAS_REPEAT;
    }

    if (!onSlot) return;

    // A writes the highlighted character; B advances the name cursor only.
    if (input.isJustPressed(Action.Attack)) {
      this.writeChar(this.board.char);
      this.advanceNameCursor();
    } else if (input.isJustPressed(Action.Item)) {
      this.advanceNameCursor();
    }
  }

  private writeChar(ch: string): void {
    const buf = (this.names[this.slotCursor] ?? blankName()).split('');
    buf[this.nameCursor] = ch;
    this.names[this.slotCursor] = buf.join('');
  }

  private advanceNameCursor(): void {
    this.nameCursor = (this.nameCursor + 1) % MAX_NAME_LENGTH;
  }

  private commit(): void {
    this._registrations = [];
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
      if (!this.editable[i]) continue;          // was already registered
      const name = (this.names[i] ?? '').trim();
      if (name.length > 0) this._registrations.push({ slot: i, name });
    }
    this._done = true;
  }

  render(
    renderer: Renderer,
    font: BitmapFont,
    redFont: BitmapFont,
  ): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    drawFrontEndTitle(renderer, redFont);

    // Name rows (live buffers) + END.
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
      const shown = (this.names[i] ?? '').replace(/ +$/, ''); // trim trailing pad
      font.drawString(renderer, FS_LABEL_X, FS_SLOT_Y0 + i * FS_SLOT_SPACING, shown || '- - - - -');
    }
    font.drawString(renderer, FS_LABEL_X, END_Y, 'END');

    // Character board.
    for (let idx = 0; idx < NAME_BOARD.length; idx++) {
      const col = idx % BOARD_COLS;
      const row = Math.floor(idx / BOARD_COLS);
      font.drawString(
        renderer,
        BOARD_ORIGIN_X + col * BOARD_CELL_W,
        BOARD_ORIGIN_Y + row * BOARD_CELL_H,
        NAME_BOARD[idx]!,
      );
    }

    // Slot cursor.
    if (this.cursorVisible) {
      font.drawString(renderer, FS_CURSOR_X, targetY(this.slotCursor), '>');
    }

    // Flashing box around the highlighted board cell (only while editing a slot).
    if (this.cursorVisible && this.slotCursor < SAVE_SLOT_COUNT) {
      const bx = BOARD_ORIGIN_X + this.board.col * BOARD_CELL_W;
      const by = BOARD_ORIGIN_Y + this.board.row * BOARD_CELL_H;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 2, by - 2, 12, 11);
    }
  }
}
