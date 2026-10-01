export type { ScriptCommand, ScriptRunner, CommandState } from './types';
export { createScript, isCommandDone, currentCommand, advanceScript } from './engine';
export {
  initScript, updateScript, getActiveScript,
  isScriptBattlePending, clearScriptBattlePending, advanceActiveScript,
  getScriptNpcs, clearScriptNpcs, getScriptFadeAlpha, lookupNpc,
  renderPokecenterHeal, renderScriptExclamation, renderScriptYesNo,
} from './script_controller';
export type { ScriptDeps, ScriptAction } from './script_controller';
