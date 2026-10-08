// Pickups transcribed from refs/pokeyellow (DECISIONS #41). Names are runtime values.
import type { ScriptCommand } from '../script/types';
import { getPlayerName } from '../core/player_state';
import { getItemName } from '../items';
import { getText } from '../text/game_text';

/** PickUpItem (engine/events/pick_up_item.asm), _FoundItemText / _NoMoreRoomForItemText
 * (data/text/text_1.asm). Give first; HideObject only on success. */
export function itemBallScript(map: string, npcId: string, item: string): ScriptCommand[] {
  return [{ type: 'giveItem', itemId: item,
    successCommands: [
      { type: 'hideObject', map, npcId },
      { type: 'text', message: `${getPlayerName()} found\n${getItemName(item)}!`, end: 'none' },
      { type: 'sound', name: 'get_item1' },
      { type: 'closeText' },
    ],
    failCommands: [
      { type: 'text', message: 'No more room for\nitems!', end: 'none' },
      { type: 'textButtonWait' },
      { type: 'closeText' },
    ],
  }];
}

/** HiddenItems / FoundHiddenItemText (engine/events/hidden_items.asm), strings from
 * data/text/text_2.asm: text before GiveItem; two silent waits on a full bag. */
export function hiddenItemScript(flag: string, item: string): ScriptCommand[] {
  return [
    { type: 'text', message: `${getPlayerName()} found\n${getItemName(item)}!`, end: 'none' },
    { type: 'giveItem', itemId: item,
      successCommands: [
        { type: 'setFlag', flag },
        { type: 'sound', name: 'get_item2', waitForCurrent: true },
        { type: 'closeText' },
      ],
      failCommands: [
        { type: 'textButtonWait' },
        { type: 'text', message: `But, ${getPlayerName()} has\nno more room for\nother items!`, end: 'none' },
        { type: 'textButtonWait' },
        { type: 'closeText' },
      ],
    },
  ];
}

/** Route1PrintYoungster1Text (scripts/Route1_2.asm), text/Route1.asm. The flag is set
 * BEFORE the give: a full bag permanently loses the sample, as on the cartridge. */
export function potionSampleScript(): ScriptCommand[] {
  return [
    { type: 'setFlag', flag: 'GOT_POTION_SAMPLE' },
    { type: 'text', message: getText('ROUTE1_MART_SAMPLE'), end: 'prompt' },
    { type: 'giveItem', itemId: 'POTION',
      successCommands: [
        { type: 'text', message: `${getPlayerName()} got\n${getItemName('POTION')}!`, end: 'none' },
        { type: 'sound', name: 'get_item1' },
        { type: 'textButtonWait' },
        { type: 'closeText' },
      ],
      failCommands: [
        { type: 'text', message: 'You have too much\nstuff with you!', end: 'none' },
        { type: 'textButtonWait' },
        { type: 'closeText' },
      ],
    },
  ];
}
