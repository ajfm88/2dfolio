export type { ScriptCommand, ScriptRunner } from './types';
export { createScript, currentCommand, advanceScript } from './engine';
export {
  initScript, updateScript, getActiveScript,
  isScriptBattlePending, clearScriptBattlePending, advanceActiveScript,
  setLastBattleWon, wasLastBattleWon,
  getScriptNpcs, clearScriptNpcs, getScriptFadeAlpha, lookupNpc,
  isScriptMenuFullScreen,
  renderHealingMachine, renderScriptExclamation, renderScriptYesNo, renderScriptMenu, renderMenuSession,
} from './script_controller';
export type { ScriptDeps, ScriptAction } from './script_controller';
