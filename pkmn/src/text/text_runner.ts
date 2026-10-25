import { substituteNames } from '../core/player_state';
import { TEXT_A, TEXT_B, TextScreen } from './text_printer';
import type { PlaceActors, PrinterPorts } from './text_printer';
import type { TextBinding, TextPrograms } from '../rom/extractors/text_programs';

type NumericTextBinding = Extract<TextBinding, 'money' | 'coins' | 'hpDifference'
  | 'playerNumHits' | 'enemyNumHits' | 'expAmountGained' | 'curEnemyLevel' | 'amountMoneyWon' | 'totalPayDayMoney'>;
export type TextBindings = Partial<Record<Exclude<TextBinding, NumericTextBinding>, string>
  & Record<NumericTextBinding, number>>;
export interface RunnerPorts extends PrinterPorts {
  playSound(name: string): void;
  /** Declared cue only; cry playback and its wait remain J2 (DECISIONS #45). */
  cry(species: string): void;
}
export type TextReturn = 'returned' | 'asm';

/** What a text_asm handler sees. The effect bytes and exp flags are its own inputs. */
export interface TextAsmState {
  /** The committed program label whose asm op is running. */
  label: string;
  /** BC as bccoord: column, and screen row (14 is the first text line). */
  column: number;
  row: number;
}

/** Returns the next program to run on this screen, or nothing to continue after the op. */
export type TextAsmHandler = (state: TextAsmState) => string | void;

/** Optional per-print CPU continuation. Each yield holds a frame on the same text screen. */
export type TextAsmContinuation = (state: TextAsmState) => Generator<void, string | void, void>;

/** Per-print runner configuration; ordinary overworld prints omit these options. */
export interface TextRunnerOptions {
  actors?: PlaceActors;
  asm?: Record<string, TextAsmHandler>;
  /** Overrides a synchronous handler only for this print; never registers on the runner. */
  asmContinuations?: Readonly<Record<string, TextAsmContinuation>>;
}

/** effects.asm:552–565. cp ATTACK_DOWN1_EFFECT ($12); ret nc keeps GreatlyRoseText. */
export function monsStatsRoseText(effect: number): TextAsmHandler {
  return () => (effect & 0xff) >= 0x12 ? 'GreatlyRoseText' : 'RoseText';
}

/** experience.asm:352–364. EXP.ALL is tested first; any nonzero selects WithExpAllText. */
export function gainedText(boostExpByExpAll: number, gainBoostedExp: number): TextAsmHandler {
  return () => {
    if (boostExpByExpAll !== 0) return 'WithExpAllText';
    if (gainBoostedExp === 0) return 'ExpPointsText';
    return 'BoostedText';
  };
}

/** experience.asm:366–370. The asm only continues at ExpPointsText. */
export function withExpAllText(): TextAsmHandler {
  return () => 'ExpPointsText';
}

/** TextCommandProcessor, home/text.asm. Every yield holds one frame.
 * FAR creates a processor level; bc (the cursor) and Joypad history stay shared.
 * DoneText/PromptText return only that level and leave BC where that PlaceString began.
 * @ returns to the next op. An unregistered asm returns 'asm'.
 */
export class TextProgramRunner {
  private battleNames: PlaceActors | undefined;
  private readonly asmHandlers = new Map<string, TextAsmHandler>();

  constructor(
    readonly screen: TextScreen,
    private readonly programs: TextPrograms,
    private readonly ports: RunnerPorts,
  ) {}

  /** hWhoseTurn and the two nicks. Absent, `<USER>` / `<TARGET>` stay glyphs. */
  setBattleNames(names: PlaceActors | undefined): void {
    this.battleNames = names;
  }

  /** Keyed by the committed program label. Unregistered asm still returns 'asm'. */
  registerAsm(label: string, handler: TextAsmHandler): void {
    this.asmHandlers.set(label, handler);
  }

  *run(label: string, bindings: TextBindings = {}, noDelay = false,
    continuations?: TextRunnerOptions['asmContinuations']): Generator<void, TextReturn> {
    const ops = this.programs[label];
    if (!ops) throw new Error(`missing text program ${label}`);
    for (const op of ops) {
      switch (op.op) {
        case 'text':
          if (yield* this.screen.placeString(substituteNames(op.text), noDelay, this.battleNames)) return 'returned';
          break;
        case 'far':
          if ((yield* this.run(op.program, bindings, noDelay, continuations)) === 'asm') return 'asm';
          break;
        case 'ram': {
          const text = bindings[op.binding];
          if (text === undefined) throw new Error(`missing text binding ${op.binding} in ${label}`);
          if (typeof text !== 'string') throw new Error(`invalid string text binding ${op.binding} in ${label}`);
          if (yield* this.screen.placeString(substituteNames(text), noDelay, this.battleNames)) return 'returned';
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
            || !Number.isInteger(op.digits) || op.digits < 1 || op.digits > 7)
            throw new Error(`invalid decimal width in ${label}`);
          // Digit count 1 falls through print_num.asm:61 into the millions place.
          // Left align prints the whole number. TextCommand_NUM does not add the value to '0',
          // so a 1-digit operand is limited by its byte width, not by 10.
          const limit = op.digits === 1 ? 256 ** op.bytes : Math.min(256 ** op.bytes, 10 ** op.digits);
          const value = this.numberBinding(bindings, op.binding, limit, label);
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
        case 'low':
          // TextCommand_LOW: bccoord 1, 16, then the next command. No print and no box.
          this.screen.setBc(1, 16);
          break;
        case 'asm': {
          const continuation = continuations?.[label];
          const handler = this.asmHandlers.get(label);
          if (!continuation && !handler) return 'asm';
          const bc = this.screen.bc();
          const state = { label, column: bc.column, row: bc.row };
          const next = continuation ? yield* continuation(state) : handler!(state);
          if (next === undefined) break;
          // TextCommand_START_ASM returns into NextTextCommand. The handler's HL
          // replaces the command pointer on this screen; PrintText is not called again.
          if ((yield* this.run(next, bindings, noDelay, continuations)) === 'asm') return 'asm';
          return 'returned';
        }
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
