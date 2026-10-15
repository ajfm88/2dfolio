// scripts/ViridianMart.asm: direct DisplayTextID calls surround the simulated walk.
import type { ScriptCommand } from '../script/types';
import { displayTextID } from './text_handlers';

export function buildViridianMartParcelScript(): ScriptCommand[] {
  return [
    ...displayTextID([{ type: 'printText', program: 'ViridianMartClerkYouCameFromPalletTownText', box: 'keep' }]),
    { type: 'movePlayer', path: ['left', 'up', 'up'] },
    { type: 'wait', frames: 3 },
    ...displayTextID([{ type: 'printText', program: 'ViridianMartClerkParcelQuestText', box: 'keep' }]),
    { type: 'giveItem', itemId: 'OAKS_PARCEL' },
    { type: 'setFlag', flag: 'GOT_OAKS_PARCEL' },
  ];
}
