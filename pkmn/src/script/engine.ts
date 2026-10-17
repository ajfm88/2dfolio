// Script engine — runs scripted cutscene sequences
// Commands are executed in order; some take multiple frames (movement, text)

import type { ScriptCommand, ScriptRunner } from './types';

export function createScript(commands: ScriptCommand[]): ScriptRunner {
  return { commands, index: 0, active: true };
}

/** Get the current command (or null if script is done). */
export function currentCommand(runner: ScriptRunner): ScriptCommand | null {
  if (runner.index >= runner.commands.length) {
    runner.active = false;
    return null;
  }
  return runner.commands[runner.index];
}

/** Advance to the next command. */
export function advanceScript(runner: ScriptRunner): void {
  runner.index++;
}
