import { substituteNames } from '../core/player_state';
import { TEXT_A, TEXT_B, TextScreen } from './text_printer';
import type { PrinterPorts } from './text_printer';
import type { TextBinding, TextPrograms } from '../rom/extractors/text_programs';

export type TextBindings = Partial<Record<TextBinding, string>>;
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
          if (yield* this.screen.placeString(substituteNames(text), noDelay)) return 'returned';
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
}
