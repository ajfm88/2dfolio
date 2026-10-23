// Unused entry-screen hardening. pret home/tilemap.asm:9-28; animations.asm:599-617;
// note 69 section 10.4 item 0: the entry and animation refresh must share a screen/Buffer 2.
import { bindBattleScreen, boundBattleScreenFor, type BattleScreen } from './battle_screen';
import { BattleUnsupportedState } from './battle_move_data';

/** pret core.asm:289-475,479-691,3244-3450,5639-5856: validate the screen before entry work. */
export function bindEntryBattleScreen(state: object, screen: BattleScreen): void {
  const bound = boundBattleScreenFor(state);
  if (bound && bound !== screen) throw new BattleUnsupportedState('different battle screen already bound');
  bindBattleScreen(state, screen);
}
