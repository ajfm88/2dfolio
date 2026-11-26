// Route2Gate.asm/OaksAideScript and ViridianCity_2.asm: live-map machine gifts.
import type { ScriptCommand } from '../script/types';
import { getItemName } from '../items';
import { displayTextID, registerTextHandler } from './text_handlers';
import type { TextHandlerContext } from './text_handlers';

const print = (program: string, bindings?: Extract<ScriptCommand, { type: 'printText' }>['bindings']): ScriptCommand =>
  ({ type: 'printText', program, ...(bindings ? { bindings } : {}) });

export function route2GateOaksAideText(ctx: TextHandlerContext): ScriptCommand[] {
  const explanation = print('Route2GateOaksAideText.FlashExplanationText');
  if (ctx.hasFlag('GOT_HM05')) return displayTextID([explanation]);

  const bindings = {
    oaksAideRequirement: 10,
    oaksAideOwnedCount: ctx.ownedCount,
    oaksAideRewardItemName: getItemName('HM05'),
  };
  const aide = (program: string): ScriptCommand => print(program, bindings);
  return displayTextID([aide('OaksAideHiText'), { type: 'yesNoChoice',
    no: [aide('OaksAideComeBackText')],
    yes: ctx.ownedCount < 10 ? [aide('OaksAideUhOhText')] : [
      aide('OaksAideHereYouGoText'),
      { type: 'giveItem', itemId: 'HM05',
        successCommands: [aide('OaksAideGotItemText'), { type: 'setFlag', flag: 'GOT_HM05' }, explanation],
        failCommands: [aide('OaksAideNoRoomText')] },
    ] }]);
}

export function viridianCityFisherText(ctx: TextHandlerContext): ScriptCommand[] {
  if (ctx.hasFlag('GOT_TM42')) return displayTextID([print('ViridianCityPrintFisherText.TM42ExplanationText')]);
  return displayTextID([print('ViridianCityPrintFisherText.YouCanHaveThisText'),
    { type: 'giveItem', itemId: 'TM42',
      successCommands: [print('ViridianCityPrintFisherText.ReceivedTM42Text'), { type: 'setFlag', flag: 'GOT_TM42' }],
      failCommands: [print('ViridianCityPrintFisherText.TM42NoRoomText')] }]);
}

registerTextHandler('Route2Gate', 1, route2GateOaksAideText);
registerTextHandler('ViridianCity', 6, viridianCityFisherText);
