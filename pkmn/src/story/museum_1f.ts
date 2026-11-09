// scripts/Museum1F.asm (the map script) and scripts/Museum1F_2.asm Museum1FPrintScientist1Text (the ticket).
// V3 checkpoint-02a (notes/88-v3-plan.md §16). The Old Amber scientist and the fossils are 02b/02c.
import type { ScriptCommand } from '../script/types';
import type { TextHandlerContext } from './text_handlers';
import { registerTextHandler, displayTextID } from './text_handlers';
import { getMapScript } from '../events';

export const MUSEUM_1F = 'Museum1F';
export const Museum1FScript = { DEFAULT: 0, NOOP: 1 } as const;
/** ld a, $50 into hMoney + 2 / wPriceTemp + 2: ¥50, in BCD. */
export const MUSEUM_TICKET_PRICE = 50;

const T = 'Museum1FPrintScientist1Text.';
const print = (label: string): ScriptCommand => ({ type: 'printText', program: T + label });

/**
 * Museum1FPrintScientist1Text. The branch follows the player's position (wYCoord, wXCoord), whether the map script or
 * a talk started it: behind the counter (13,4) or (12,3) the amber question; on row 4 the ticket; elsewhere the
 * "other side" or "plenty of time" line. Branches that end the display close it themselves, so the refusal's
 * simulated ↓ step starts after CloseTextDisplay, as StartSimulatingJoypadStates' step does.
 */
export function museum1FScientist1Text(ctx: TextHandlerContext): ScriptCommand[] {
  const [open, close] = displayTextID([], { textId: 1 });
  const { x, y } = ctx.step;
  if ((y === 4 && x === 13) || (y === 3 && x === 12)) {
    // .behind_counter: YesNoChoice, cp $0 — YES (item 0) is "There's a lab somewhere", NO explains amber.
    return [open, print('DoYouKnowWhatAmberIsText'),
      { type: 'yesNoChoice', yes: [print('TheresALabSomewhereText'), close], no: [print('AmberIsFossilizedTreeSapText'), close] }];
  }
  const bought = ctx.hasFlag('BOUGHT_MUSEUM_TICKET');
  if (y !== 4) return [open, print(bought ? 'TakePlentyOfTimeText' : 'GoToOtherSideText'), close];
  if (bought) return [open, print('TakePlentyOfTimeText'), close];
  // .no_ticket. .deny_entry: ComeAgainText, one PAD_DOWN state, UpdateSprites, ret.
  const deny: ScriptCommand[] = [print('ComeAgainText'), { type: 'updateSprites' }, close, { type: 'pushPlayer', direction: 'down' }];
  const buy: ScriptCommand[] = [
    print('ThankYouText'),
    { type: 'setFlag', flag: 'BOUGHT_MUSEUM_TICKET' },
    { type: 'subtractMoney', amount: MUSEUM_TICKET_PRICE }, // SubBCDPredef
    { type: 'moneyBox' },                                     // MONEY_BOX again
    { type: 'sound', name: 'purchase', waitForCurrent: true }, // PlaySoundWaitForCurrent + WaitForSoundToFinish
    { type: 'setMapScript', map: MUSEUM_1F, state: Museum1FScript.NOOP }, // .allow_entry
    close,
  ];
  return [open, { type: 'moneyBox' }, print('WouldYouLikeToComeInText'), { type: 'yesNoChoice',
    yes: [{ type: 'ifEnoughMoney', amount: MUSEUM_TICKET_PRICE, yes: buy, no: [print('DontHaveEnoughMoneyText'), ...deny] }],
    no: deny }];
}

/** Museum1F_Script on a standing pass: SCRIPT_MUSEUM1F_DEFAULT calls DisplayTextID for text 1 on (9,4) or (10,4). */
export function museum1FScript(ctx: TextHandlerContext): ScriptCommand[] | null {
  if (getMapScript(MUSEUM_1F) !== Museum1FScript.DEFAULT) return null;
  if (ctx.step.y !== 4 || (ctx.step.x !== 9 && ctx.step.x !== 10)) return null;
  return museum1FScientist1Text(ctx);
}

registerTextHandler(MUSEUM_1F, 1, museum1FScientist1Text);
