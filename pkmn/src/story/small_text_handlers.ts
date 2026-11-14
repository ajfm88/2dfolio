// scripts/RedsHouse1F_2.asm, BluesHouse.asm, Route1_2.asm, ViridianCity_2.asm.
import type { ScriptCommand } from '../script/types';
import { getItemName } from '../items';
import { displayTextID, registerTextHandler } from './text_handlers';
import type { TextHandlerContext } from './text_handlers';
import { potionSampleScript } from '../overworld/item_pickup';
import { buildSleepingOldManScript, buildOldMan1Script, buildOldMan2Script } from './viridian_city';
import { shouldPikachuFollow } from '../pikachu/pikachu_follower';
import { getPikachuHappiness } from '../pikachu/pikachu_happiness';
import { TOGGLE } from '../overworld/toggleable_objects';

const print = (program: string): ScriptCommand => ({ type: 'printText', program });
export function momText(ctx: TextHandlerContext): ScriptCommand[] {
  if (!ctx.hasFlag('GOT_STARTER')) return displayTextID([print('RedsHouse1FPrintMomText.WakeUpText')]);
  return displayTextID([print('RedsHouse1FMomYouShouldRestText'), { type: 'fadeOut' },
    { type: 'healParty' },
    { type: 'healJingle' }, { type: 'fadeIn' }, print('RedsHouse1FMomLookingGreatText')]);
}
export function tvText(ctx: TextHandlerContext): ScriptCommand[] {
  return displayTextID([print(`RedsHouse1FPrintTVText.${ctx.facing === 'up' ? 'StandByMeMovieText' : 'WrongSideText'}`)]);
}
export function daisyText(ctx: TextHandlerContext): ScriptCommand[] {
  if (ctx.hasFlag('GOT_TOWN_MAP')) return displayTextID([print('BluesHouseDaisyUseMapText')]);
  if (!ctx.hasFlag('GOT_POKEDEX')) return displayTextID([print('BluesHouseDaisyRivalAtLabText')]);
  return displayTextID([print('BluesHouseDaisyOfferMapText'), { type: 'giveItem', itemId: 'TOWN_MAP',
    successCommands: [{ type: 'hideObject', toggle: TOGGLE.TOWN_MAP },
      { type: 'printText', program: 'GotMapText', bindings: { stringBuffer: getItemName('TOWN_MAP') } },
      { type: 'setFlag', flag: 'GOT_TOWN_MAP' }],
    failCommands: [print('BluesHouseDaisyBagFullText')] }]);
}
export function gamblerText(ctx: TextHandlerContext): ScriptCommand[] {
  // cp ~EARTHBADGE is exactly $7f, not an "at least seven" condition.
  const seven = Array.from({ length: 8 }, (_, i) => ctx.hasFlag(`BADGE_${i + 1}`)).every((got, i) => got === (i < 7));
  return displayTextID([print(`ViridianCityPrintGambler1Text.${seven || ctx.hasFlag('BEAT_VIRIDIAN_GYM_GIOVANNI')
    ? 'GymLeaderReturnedText' : 'GymAlwaysClosedText'}`)]);
}
export function caterpillarText(): ScriptCommand[] {
  return displayTextID([print('ViridianCityPrintYoungster2Text.YouWantToKnowAboutText'),
    { type: 'yesNoChoice', yes: [print('ViridianCityPrintYoungster2Text.CaterpieAndWeedleDescriptionText')],
      no: [print('ViridianCityPrintYoungster2Text.OkThenText')] }]);
}
/** PewterCitySuperNerd2Text: cp $0 after YesNoChoice, so YES (item 0) is the "That's right!" branch. */
export function pewterSuperNerdText(): ScriptCommand[] {
  return displayTextID([print('PewterCitySuperNerd2Text.DoYouKnowWhatImDoingText'),
    { type: 'yesNoChoice', yes: [print('PewterCitySuperNerd2Text.ThatsRightText')],
      no: [print('PewterCitySuperNerd2Text.ImSprayingRepelText')] }]);
}
/** Museum2FHikerText: BIT_PIKACHU_SPAWN_STARTER (the starter alive in the party; refreshed every overworld pass), then cp 101. */
export function museum2FHikerText(ctx: TextHandlerContext): ScriptCommand[] {
  const line = !shouldPikachuFollow(ctx.party) ? 1 : getPikachuHappiness() < 101 ? 2 : 3;
  return displayTextID([print(`Museum2FHikerText${line}`)]);
}
export function girlText(ctx: TextHandlerContext): ScriptCommand[] {
  return displayTextID([print(`ViridianCityPrintGirlText.${ctx.hasFlag('GOT_POKEDEX') ? 'WhenIGoShopText' : 'HasntHadHisCoffeeYetText'}`)]);
}

registerTextHandler('RedsHouse1F', 1, momText);
registerTextHandler('RedsHouse1F', 2, tvText);
registerTextHandler('BluesHouse', 1, daisyText);
registerTextHandler('Route1', 1, ctx => potionSampleScript(ctx.hasFlag('GOT_POTION_SAMPLE')));
registerTextHandler('ViridianCity', 2, gamblerText);
registerTextHandler('ViridianCity', 3, caterpillarText);
registerTextHandler('ViridianCity', 4, girlText);
registerTextHandler('PewterCity', 4, pewterSuperNerdText);
registerTextHandler('Museum2F', 5, museum2FHikerText);
registerTextHandler('ViridianCity', 5, () => buildSleepingOldManScript(false));
registerTextHandler('ViridianCity', 7, buildOldMan1Script);
registerTextHandler('ViridianCity', 8, ctx => ctx.hasFlag('COMPLETED_CATCH_TRAINING')
  ? displayTextID([print('ViridianCityOldMan2Text.LosingMyTouchText')]) : buildOldMan2Script(false, ctx.step));
