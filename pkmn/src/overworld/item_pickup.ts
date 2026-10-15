// Pickups transcribed from refs/pokeyellow (DECISIONS #41). Names are runtime values.
import type { ScriptCommand } from '../script/types';
import { hasFlag } from '../events';
import { getItemName } from '../items';
import { displayTextID } from '../story/text_handlers';

/** PickUpItem (engine/events/pick_up_item.asm), _FoundItemText / _NoMoreRoomForItemText
 * (data/text/text_1.asm). Give first; HideObject only on success. */
export function itemBallScript(map: string, npcId: string, item: string): ScriptCommand[] {
  return [{ type: 'displayOpen' }, { type: 'giveItem', itemId: item,
    successCommands: [
      { type: 'hideObject', map, npcId },
      { type: 'printText', program: 'FoundItemText', bindings: { stringBuffer: getItemName(item) } },
      { type: 'displayClose', outerWait: false },
    ],
    failCommands: [
      { type: 'printText', program: 'NoMoreRoomForItemText' },
      { type: 'displayClose', outerWait: true },
    ],
  }];
}

/** HiddenItems / FoundHiddenItemText (engine/events/hidden_items.asm), strings from
 * data/text/text_2.asm: text before GiveItem; two silent waits on a full bag. */
export function hiddenItemScript(flag: string, item: string): ScriptCommand[] {
  return [
    { type: 'displayOpen' },
    { type: 'printText', program: 'FoundHiddenItemText', box: 'keep', bindings: { nameBuffer: getItemName(item) } },
    { type: 'giveItem', itemId: item,
      successCommands: [
        { type: 'setFlag', flag },
        { type: 'sound', name: 'get_item2', waitForCurrent: true },
        { type: 'displayClose', outerWait: false },
      ],
      failCommands: [
        { type: 'textButtonWait' },
        { type: 'printText', program: 'HiddenItemBagFullText' },
        { type: 'displayClose', outerWait: true },
      ],
    },
  ];
}

/** Route1PrintYoungster1Text (scripts/Route1_2.asm), text/Route1.asm. The flag is set
 * BEFORE the give: a full bag permanently loses the sample, as on the cartridge. */
export function potionSampleScript(already = hasFlag('GOT_POTION_SAMPLE')): ScriptCommand[] {
  if (already) return displayTextID([{ type: 'printText', program: 'Route1PrintYoungster1Text.AlsoGotPokeballsText' }]);
  return displayTextID([
    { type: 'setFlag', flag: 'GOT_POTION_SAMPLE' },
    { type: 'printText', program: 'Route1PrintYoungster1Text.MartSampleText' },
    { type: 'giveItem', itemId: 'POTION',
      successCommands: [
        { type: 'printText', program: 'Route1PrintYoungster1Text.GotPotionText', bindings: { stringBuffer: getItemName('POTION') } },
      ],
      failCommands: [
        { type: 'printText', program: 'Route1PrintYoungster1Text.NoRoomText' },
      ],
    },
  ]);
}
