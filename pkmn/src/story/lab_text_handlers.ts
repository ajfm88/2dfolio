// OaksLab.asm handlers evaluate flags/bag/owned count at the moment of talk.
import { displayTextID, registerTextHandler } from './text_handlers';
import type { TextHandlerContext } from './text_handlers';
import { buildOaksLabBallScript, buildOaksLabPokedexScript, labDisplay } from './oaks_lab';
import type { ScriptCommand } from '../script/types';

export function labRivalText(ctx: TextHandlerContext): ScriptCommand[] {
  const suffix = !ctx.hasFlag('FOLLOWED_OAK_INTO_LAB_2') ? 'GrampsIsntAroundText'
    : !ctx.hasFlag('GOT_STARTER') ? 'IllGetABetterPokemonThanYou' : 'MyPokemonLooksStrongerText';
  return labDisplay(`OaksLabRivalText.${suffix}`);
}
export function labEeveeText(ctx: TextHandlerContext): ScriptCommand[] {
  return ctx.hasFlag('OAK_ASKED_TO_CHOOSE_MON') ? buildOaksLabBallScript() : labDisplay('OaksLabEeveePokeBallText.Text');
}
export function labOakText(ctx: TextHandlerContext): ScriptCommand[] {
  if (ctx.ownedCount >= 2 || ctx.hasFlag('PALLET_AFTER_GETTING_POKEBALLS')) {
    // DisplayDexRating is approved as a gap: print its lead-in, no extra outer wait.
    return displayTextID([{ type: 'printText', program: 'OaksLabOak1Text.HowIsYourPokedexComingText' }],
      { autoBox: false, outerWait: false });
  }
  if (ctx.bag.getCount('POKE_BALL')) return labDisplay('OaksLabOak1Text.ComeSeeMeSometimesText');
  if (ctx.hasFlag('BEAT_ROUTE22_RIVAL_1ST_BATTLE')) throw new Error('Oak Poké Ball gift requires the Route 22 rival audit (I1)');
  if (ctx.hasFlag('GOT_POKEDEX')) return labDisplay('OaksLabOak1Text.PokemonAroundTheWorldText');
  if (ctx.hasFlag('BATTLED_RIVAL_IN_OAKS_LAB')) {
    if (ctx.bag.getCount('OAKS_PARCEL')) return buildOaksLabPokedexScript(ctx.step.x, ctx.step.y, ctx.findNpc ?? (() => undefined));
    return labDisplay('OaksLabOak1Text.YouShouldTalkToIt');
  }
  return labDisplay(`OaksLabOak1Text.${ctx.hasFlag('GOT_STARTER') ? 'YourPokemonCanFightText' : 'GoAheadItsYours'}`);
}
registerTextHandler('OaksLab', 1, labRivalText);
registerTextHandler('OaksLab', 2, labEeveeText);
registerTextHandler('OaksLab', 3, labOakText);
