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

/** Longest-match glyphs, as constants/charmap.asm; no automatic word wrapping. */
export function tokenizeText(text: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < text.length;) {
    const control = CONTROLS.find(token => text.startsWith(token, i));
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
  /** Returns true for DoneText/PromptText: only the current processor level returns. */
  *placeString(text: string, noDelay = false): Generator<void, boolean> {
    const tokens = tokenizeText(text);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      this.hasMore = i < tokens.length - 1;
      if (token === '<DONE>') { this.hasMore = false; return true; }
      if (token === '<PROMPT>') { this.hasMore = false; yield* this.manual(); return true; }
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
