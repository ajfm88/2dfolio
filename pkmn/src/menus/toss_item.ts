// TossItem_ (engine/items/item_effects.asm). Quantity selection belongs to its caller.
import { isKeyItem, removeFromInventoryAt, type ItemStack } from '../items';
import type { TextBindings } from '../text/text_runner';

export interface TossText { program: string; bindings?: TextBindings }

export function cannotToss(id: string): boolean {
  return isKeyItem(id) || /^HM0[1-5]$/.test(id);
}

export function tossItemPrompt(id: string, name: string): TossText {
  return cannotToss(id) ? { program: 'TooImportantToTossText' }
    : { program: 'IsItOKToTossItemText', bindings: { stringBuffer: name } };
}

/** The chosen slot, including duplicate item IDs. NO returns without touching it. */
export function finishTossItem(
  source: ItemStack[], index: number, quantity: number, name: string, answer: 'yes' | 'no',
): TossText | null {
  if (answer === 'no') return null;
  const item = source[index];
  if (!item || cannotToss(item.id)) return null;
  removeFromInventoryAt(source, index, quantity);
  return { program: 'ThrewAwayItemText', bindings: { nameBuffer: name } };
}
