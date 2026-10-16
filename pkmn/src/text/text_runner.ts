import { substituteNames } from '../core/player_state';
import { TEXT_A, TEXT_B, TextScreen } from './text_printer';
import type { PrinterPorts } from './text_printer';
import type { TextBinding, TextPrograms } from '../rom/extractors/text_programs';

type NumericTextBinding = Extract<TextBinding, 'money' | 'coins' | 'hpDifference'>;
export type TextBindings = Partial<Record<Exclude<TextBinding, NumericTextBinding>, string>
  & Record<NumericTextBinding, number>>;
export interface RunnerPorts extends PrinterPorts {
  playSound(name: string): void;
  /** Declared cue only; cry playback and its wait remain J2 (DECISIONS #45). */
  cry(species: string): void;
}
export type TextReturn = 'returned' | 'asm';

/** TextCommandProcessor, home/text.asm. Every yield holds one frame.
 * FAR creates a processor level; bc (the cursor) and Joypad history stay shared.
 * DoneText/PromptText return only that level, while @ returns to the next op.
 */
export class TextProgramRunner {
  constructor(
    readonly screen: TextScreen,
    private readonly programs: TextPrograms,
    private readonly ports: RunnerPorts,
  ) {}

  *run(label: string, bindings: TextBindings = {}, noDelay = false): Generator<void, TextReturn> {
    const ops = this.programs[label];
    if (!ops) throw new Error(`missing text program ${label}`);
    for (const op of ops) {
      switch (op.op) {
        case 'text':
          if (yield* this.screen.placeString(substituteNames(op.text), noDelay)) return 'returned';
          break;
        case 'far':
          if ((yield* this.run(op.program, bindings, noDelay)) === 'asm') return 'asm';
          break;
        case 'ram': {
          const text = bindings[op.binding];
          if (text === undefined) throw new Error(`missing text binding ${op.binding} in ${label}`);
          if (typeof text !== 'string') throw new Error(`invalid string text binding ${op.binding} in ${label}`);
          if (yield* this.screen.placeString(substituteNames(text), noDelay)) return 'returned';
          break;
        }
        case 'bcd': {
          if (!Number.isInteger(op.bytes) || op.bytes < 1 || op.bytes > 31)
            throw new Error(`invalid BCD width in ${label}`);
          const value = this.numberBinding(bindings, op.binding, 10 ** (op.bytes * 2), label);
          // home/print_bcd.asm: bit 7 SUPPRESSES leading zeroes (unlike PrintNumber).
          let suppress = op.leadingZeroes;
          if (op.moneySign && !suppress) yield* this.screen.writeGlyph('¥', true);
          for (const digit of String(value).padStart(op.bytes * 2, '0')) {
            if (suppress && digit === '0') {
              if (!op.leftAlign) this.screen.moveCursor(1);
              continue;
            }
            if (suppress && op.moneySign) yield* this.screen.writeGlyph('¥', true);
            suppress = false;
            yield* this.screen.writeGlyph(digit, noDelay);
          }
          if (suppress) {
            if (!op.leftAlign) this.screen.moveCursor(-1);
            if (op.moneySign) yield* this.screen.writeGlyph('¥', true);
            yield* this.screen.writeGlyph('0', noDelay);
          }
          break;
        }
        case 'decimal': {
          if (!Number.isInteger(op.bytes) || op.bytes < 1 || op.bytes > 3
            || !Number.isInteger(op.digits) || op.digits < 2 || op.digits > 7)
            throw new Error(`invalid decimal width in ${label}`);
          const value = this.numberBinding(bindings, op.binding, Math.min(256 ** op.bytes, 10 ** op.digits), label);
          // TextCommand_NUM sets LEFT_ALIGN. PrintNumber writes immediately, including zero.
          for (const digit of String(value)) yield* this.screen.writeGlyph(digit, true);
          break;
        }
        case 'sound':
          this.ports.playSound(op.sound);
          // WaitForSoundToFinish spins in the CPU while VBlank runs, without Joypad reads.
          while (!this.ports.soundFinished()) yield;
          break;
        case 'waitButton': yield* this.screen.manual(0, false); break;
        case 'promptButton': yield* this.screen.manual(0, true); break;
        case 'pause':
          this.screen.read();
          if (!(this.screen.held & (TEXT_A | TEXT_B))) yield* this.screen.delay(30);
          break;
        case 'cry': this.ports.cry(op.species); break;
        case 'asm': return 'asm';
        default: throw new Error(`unsupported text op ${op.op} (A5b7) in ${label}`);
      }
    }
    return 'returned';
  }

  private numberBinding(bindings: TextBindings, binding: TextBinding, limit: number, label: string): number {
    const value = bindings[binding];
    if (value === undefined) throw new Error(`missing text binding ${binding} in ${label}`);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= limit)
      throw new Error(`invalid numeric text binding ${binding} in ${label}`);
    return value;
  }
}
