import { textGlyphAt } from './charmap';

export const TEXT_BUFFER_SIZE = 20 * 6;
export const TEXT_A = 1;
export const TEXT_B = 2;
export interface PrinterPorts {
  buttons(): number;
  speed(): number;
  soundFinished(): boolean;
  beep(): void;
  joypadRead?(): void;
}
export type TextControl = '\n' | '\f' | '<LINE>' | '<NEXT>' | '<CONT>' | '<SCROLL>' | '<PROMPT>' | '<DONE>';
const CONTROLS: readonly string[] = ['<LINE>', '<NEXT>', '<CONT>', '<SCROLL>', '<PROMPT>', '<DONE>'];
/** Dictionary characters, not text commands (home/text.asm PlaceMoveUsersName). */
const ACTORS: readonly string[] = ['<USER>', '<TARGET>'];

/** Whose name PlaceMoveUsersName / PlaceMoveTargetsName prints. Inputs, not WRAM. */
export interface PlaceActors {
  /** hWhoseTurn as read. Zero is the player. */
  whoseTurn: number;
  /** wBattleMonNick, without the terminator. */
  battleMonNick: string;
  /** wEnemyMonNick, without the terminator. */
  enemyMonNick: string;
}

/** Longest-match glyphs, as constants/charmap.asm; no automatic word wrapping.
 * Actor tokens stay glyphs unless a caller is placing them from hWhoseTurn. */
export function tokenizeText(text: string, actors = false): string[] {
  const result: string[] = [];
  for (let i = 0; i < text.length;) {
    const control = CONTROLS.find(token => text.startsWith(token, i))
      ?? (actors ? ACTORS.find(token => text.startsWith(token, i)) : undefined);
    if (control) { result.push(control); i += control.length; continue; }
    const glyph = textGlyphAt(text, i);
    result.push(glyph); i += glyph.length;
  }
  return result;
}

/** PlaceString, PrintLetterDelay and ManualTextScroll. Each yield holds one frame.
 * Construction is the initial CPU work; advance resumes after the next VBlank.
 * The buffer is wTileMap rows 12–17. Out-of-box writes are deliberately clipped.
 */
export class TextScreen {
  readonly buffer: string[] = Array<string>(TEXT_BUFFER_SIZE).fill(' ');
  waiting = false;
  hasMore = false;
  private row = 2;
  private column = 1;
  private joyLast: number;
  constructor(protected readonly ports: PrinterPorts, initialJoy = 0) {
    this.joyLast = initialJoy;
  }
  get held(): number { return this.joyLast; }
  resetCursor(): void { this.row = 2; this.column = 1; }
  /** BC as bccoord. Screen row 14 is the first text line (buffer row 2). */
  bc(): { column: number; row: number } {
    return { column: this.column, row: this.row + 12 };
  }
  /** bccoord. TX_LOW uses (1, 16), the second line of the dialogue box. */
  setBc(column: number, row: number): void {
    this.column = column;
    this.row = row - 12;
  }
  clearInterior(): void {
    for (let row = 1; row <= 4; row++) this.buffer.fill(' ', row * 20 + 1, row * 20 + 19);
  }
  read(): number {
    const down = this.ports.buttons();
    const pressed = down & ~this.joyLast;
    this.joyLast = down;
    this.ports.joypadRead?.();
    return pressed;
  }
  private put(glyph: string): void {
    if (this.row >= 1 && this.row <= 4 && this.column >= 1 && this.column <= 18)
      this.buffer[this.row * 20 + this.column] = glyph;
    this.column++;
  }
  /** PrintBCDNumber advances over suppressed cells without changing their tiles;
   * its all-zero fallback backs up one cell for right-aligned numbers. */
  moveCursor(columns: number): void { this.column += columns; }
  /** A numeric digit uses PrintLetterDelay; currency and PrintNumber do not. */
  *writeGlyph(glyph: string, noDelay = false): Generator<void> {
    this.put(glyph);
    if (!noDelay) yield* this.letterDelay();
  }
  *delay(frames: number): Generator<void> { for (let i = 0; i < frames; i++) yield; }
  private *letterDelay(): Generator<void> {
    let remaining = this.ports.speed();
    while (true) {
      this.read();
      if (this.joyLast & (TEXT_A | TEXT_B)) { yield; return; }
      if (remaining === 0) return;
      yield; remaining--;
    }
  }
  /** WaitForTextScrollButtonPress: no reads during ProtectedDelay3 or scrolling. */
  *waitButton(arrow: boolean): Generator<void> {
    this.waiting = true;
    let blink = 0;
    while (true) {
      if (this.read() & (TEXT_A | TEXT_B)) break;
      yield;
      if (arrow && ++blink % 30 === 0)
        this.buffer[98] = this.buffer[98] === '▼' ? ' ' : '▼';
    }
    this.waiting = false;
  }
  *holdA(): Generator<void> {
    while (true) {
      this.read();
      if (!(this.joyLast & TEXT_A)) return;
      yield;
    }
  }
  *manual(protection = 3, arrow = true): Generator<void> {
    if (arrow) this.buffer[98] = '▼';
    this.waiting = true;
    yield* this.delay(protection);
    yield* this.waitButton(arrow);
    // WaitForSoundToFinish is a CPU loop, not a Joypad reader.
    while (!this.ports.soundFinished()) yield;
    this.ports.beep();
    // TextCommand_WAIT_BUTTON never writes (18,16); only the arrow's callers clear it.
    if (arrow) this.buffer[98] = ' ';
  }
  *scroll(): Generator<void> {
    for (let step = 0; step < 2; step++) {
      this.buffer.copyWithin(20, 40, 100);
      this.buffer.fill(' ', 81, 99);
      yield* this.delay(5);
    }
    this.row = 4; this.column = 1;
  }
  /** $5A uses hWhoseTurn as read; $59 XORs it with 1. Zero places the battle nick.
   * Nonzero places "Enemy " (EnemyText) and then the enemy nick (home/text.asm:147–185). */
  private *placeActor(token: '<USER>' | '<TARGET>', actors: PlaceActors, noDelay: boolean): Generator<void> {
    const turn = token === '<TARGET>' ? (actors.whoseTurn ^ 1) : actors.whoseTurn;
    if (turn === 0) {
      yield* this.placeString(actors.battleMonNick, noDelay);
      return;
    }
    yield* this.placeString('Enemy ', noDelay);
    yield* this.placeString(actors.enemyMonNick, noDelay);
  }
  /** Returns true for DoneText/PromptText: only the current processor level returns.
   * DoneText pops PlaceString's saved HL and does not copy it into BC, so the cursor
   * stays where this string began (home/text.asm:221–228). */
  *placeString(text: string, noDelay = false, actors?: PlaceActors): Generator<void, boolean> {
    const tokens = tokenizeText(text, actors !== undefined);
    const originRow = this.row;
    const originColumn = this.column;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      this.hasMore = i < tokens.length - 1;
      if (token === '<DONE>' || token === '<PROMPT>') {
        this.hasMore = false;
        if (token === '<PROMPT>') yield* this.manual();
        this.row = originRow;
        this.column = originColumn;
        return true;
      }
      if (token === '<USER>' || token === '<TARGET>') {
        yield* this.placeActor(token, actors!, noDelay);
        continue;
      }
      if (token === '\f') {
        yield* this.manual();
        this.clearInterior();
        yield* this.delay(20);
        this.row = 2; this.column = 1;
      } else if (token === '<SCROLL>') yield* this.scroll();
      else if (token === '<CONT>' || (token === '\n' && this.row >= 4)) {
        yield* this.manual(); yield* this.scroll();
      } else if (token === '\n' || token === '<LINE>') { this.row = 4; this.column = 1; }
      else if (token === '<NEXT>') { this.row += 2; this.column = 1; }
      else { this.put(token); if (!noDelay) yield* this.letterDelay(); }
    }
    this.hasMore = false;
    return false;
  }
}

/** Backwards-compatible one-string PlaceString wrapper, including initial CPU work. */
export class TextPrinter extends TextScreen {
  complete = false;
  private readonly run: Generator<void>;
  constructor(text: string, ports: PrinterPorts, initialJoy = 0) {
    super(ports, initialJoy);
    this.run = this.print(text);
    this.advance();
  }
  advance(): void { if (!this.complete) this.run.next(); }
  private *print(text: string): Generator<void> {
    yield* this.placeString(text);
    this.complete = true;
  }
}
