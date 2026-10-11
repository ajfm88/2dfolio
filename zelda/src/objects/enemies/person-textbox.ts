// Typewriter textbox shared by dungeon people and Grumble.
// Z_01.asm:576 UpdatePersonState_Textbox — one character every 6 frames, each with
// the "character" sound, into three lines starting at nametable column 4, rows
// 13-15 (TextboxLineAddrsLo $A4/$C4/$E4). When the last character lands, the
// person advances its state and Link is unhalted.
//
// Strings come from cave-text.json (the PersonText table), indexed by the NES
// text selector: PersonTextAddrs is a word table, so message = selector / 2.

import caveTextJson from '../../data/cave-text.json';
import type { CaveTextData } from '../../data/cave-text-types.js';

const caveText = caveTextJson as CaveTextData;

const CHAR_DELAY = 6;

// Row 13 of the nametable is screen Y $68; minus the $40 status bar.
export const TEXTBOX_TOP_Y = 0x68 - 0x40;
export const TEXTBOX_LINE_HEIGHT = 8;
// Lines run from column 4 to column 27 (24 tiles).
const TEXTBOX_LEFT_X = 4 * 8;
const TEXTBOX_COLUMNS = 24;

/** PersonText lines for an NES text selector ($24 = GRUMBLE, $26 = EASTMOST …). */
export function personTextLines(selector: number): readonly string[] {
  return caveText.messages[selector >> 1]?.lines ?? [];
}

/**
 * Left X of a textbox line. The ROM strings carry their own leading blanks; the
 * extracted ones are trimmed, so centre them on the 24-column line instead.
 */
export function textboxLineX(line: string): number {
  return TEXTBOX_LEFT_X + Math.floor(Math.max(0, TEXTBOX_COLUMNS - line.length) / 2) * 8;
}

export class PersonTextbox {
  private readonly _lines: readonly string[];
  private readonly _total: number;
  private _shown = 0;
  private _timer: number;
  private _blank = false;

  /** `startDelay` = the person's ObjTimer when typing begins ($A for complex people). */
  constructor(lines: readonly string[], startDelay = 0) {
    this._lines = lines;
    this._total = lines.reduce((n, l) => n + l.length, 0);
    this._timer = startDelay;
  }

  get done(): boolean { return this._shown >= this._total; }
  get shownChars(): number { return this._shown; }
  get lines(): readonly string[] { return this._lines; }

  /** Advance one frame. Returns true when a character was typed (play the sfx). */
  tick(): boolean {
    if (this.done) return false;
    if (this._timer > 0) this._timer--;
    if (this._timer > 0) return false;
    this._timer = CHAR_DELAY;
    this._shown++;
    return true;
  }

  /** The textbox lines are blanked (transfer record $1E) when a deal completes. */
  clear(): void {
    this._blank = true;
  }

  /** Visible portion of each line, for rendering. */
  visibleLines(): string[] {
    if (this._blank) return [];
    const out: string[] = [];
    let remaining = this._shown;
    for (const line of this._lines) {
      if (remaining <= 0) break;
      out.push(line.slice(0, remaining));
      remaining -= line.length;
    }
    return out;
  }
}
