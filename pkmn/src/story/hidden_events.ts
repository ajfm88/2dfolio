// Scripted hidden events, on the DisplayTextID session (A5b6).
//
// Assembly references:
//   engine/events/hidden_events/school_notebooks.asm — PrintNotebookText, ViridianSchoolNotebook
//   engine/events/hidden_events/school_blackboard.asm — ViridianSchoolBlackboard
//   engine/events/hidden_events/town_map.asm — TownMapText (a bookshelf predef)

import type { ScriptCommand } from '../script';
import type { MenuBoxLayout } from '../script/types';
import { copyFrames } from '../overworld/sprite_sets';
import { displayTextID } from './text_handlers';

const print = (program: string): ScriptCommand => ({ type: 'printText', program });

/** TurnPageSchoolNotebook: PrintText TurnPageText (done), then YesNoChoice; NO ends the reading. */
function turnPage(next: ScriptCommand[]): ScriptCommand[] {
  return [print('TurnPageText'), { type: 'yesNoChoice', yes: next, no: [] }];
}

/**
 * PrintNotebookText sets wDoNotWaitForButtonPressAfterDisplayingText, so DisplayTextID goes
 * straight to HoldTextDisplayOpen after the handler's TextScriptEnd: no outer wait.
 * ViridianSchoolNotebook: four pages, each a new PrintText; Text5 (the girl) ends in
 * text_waitbutton inside its own program.
 */
export function buildSchoolNotebookScript(): ScriptCommand[] {
  return displayTextID([
    print('ViridianSchoolNotebookText1'),
    ...turnPage([
      print('ViridianSchoolNotebookText2'),
      ...turnPage([
        print('ViridianSchoolNotebookText3'),
        ...turnPage([print('ViridianSchoolNotebookText4'), print('ViridianSchoolNotebookText5')]),
      ]),
    ]),
  ], { outerWait: false });
}

// ViridianSchoolBlackboard (school_blackboard.asm): TextBoxBorder at (0,0) with a 6×10
// interior, StatusAilmentText1 at (1,2) and StatusAilmentText2 at (6,2), `next` = 2 rows.
const BLACKBOARD_BOX: MenuBoxLayout = {
  x: 0, y: 0, width: 12, height: 8,
  labels: [
    { x: 1, y: 2, text: ' SLP' }, { x: 1, y: 4, text: ' PSN' }, { x: 1, y: 6, text: ' PAR' },
    { x: 6, y: 2, text: ' BRN' }, { x: 6, y: 4, text: ' FRZ' }, { x: 6, y: 6, text: ' QUIT' },
  ],
};
/** ViridianBlackboardStatusPointers, by wCurrentMenuItem + wMenuItemOffset; 5 is QUIT. */
const BLACKBOARD_STATUS_TEXTS = ['ViridianBlackboardSleepText', 'ViridianBlackboardPoisonText',
  'ViridianBlackboardPrlzText', 'ViridianBlackboardBurnText', 'ViridianBlackboardFrozenText'];

/**
 * .blackboardLoop: redraw the box and labels, PrintText Text2 with BIT_NO_TEXT_DELAY, then
 * HandleMenuInput (LEFT/RIGHT/A/B watched, max 2, top y 2). B exits; RIGHT and LEFT run the
 * loop again in that column with the same item, even from that column; QUIT exits; any other
 * A prints its heading with letter delays and runs the loop again.
 */
function blackboardLoop(column: 0 | 1, item: number): ScriptCommand[] {
  const exit: ScriptCommand[] = [{ type: 'restoreSavedScreen' }];
  return [
    { type: 'menuBox', layout: BLACKBOARD_BOX },
    { type: 'printText', program: 'ViridianSchoolBlackboardText2', noDelay: true },
    {
      type: 'menuInput',
      menu: { watched: ['left', 'right', 'a', 'b'], maxItem: 2, topX: column === 1 ? 6 : 1, topY: 2, item },
      then: (keys, current) => {
        if (keys.includes('b')) return exit;
        if (keys.includes('right')) return blackboardLoop(1, current);
        if (keys.includes('left')) return blackboardLoop(0, current);
        const index = current + (column === 1 ? 3 : 0);
        if (index === 5) return exit;
        return [print(BLACKBOARD_STATUS_TEXTS[index]), ...blackboardLoop(column, current)];
      },
    },
  ];
}

/**
 * PrintBlackboardLinkCableText sets wDoNotWaitForButtonPressAfterDisplayingText: after the
 * handler's TextScriptEnd, DisplayTextID holds and closes with no outer wait. The handler
 * saves the screen with the empty box, prints Text1 (prompt), then loops; on exit
 * LoadScreenTilesFromBuffer1 restores that empty box and removes the menu.
 */
export function buildSchoolBlackboardScript(): ScriptCommand[] {
  return displayTextID([print('ViridianSchoolBlackboardText1'), ...blackboardLoop(0, 0)], { outerWait: false });
}

/**
 * TownMapText (engine/events/hidden_events/town_map.asm), a bookshelf predef: PrintBookshelfText
 * enables the automatic box, DisplayTextID prints "A TOWN MAP." directly, then
 * text_promptbutton (▼, no ProtectedDelay3) and text_asm:
 * - wDoNotWaitForButtonPressAfterDisplayingText = 1; GBPalWhiteOutWithDelay3;
 * - LoadFontTilePatterns with the LCD on: CopyVideoDataDouble of the 128 font tiles;
 * - DisplayTownMap (the existing screen; its own internals wait for a Town Map audit);
 * - `jp CloseTextDisplay` with the font still loaded. The screen is still the one ExitTownMap
 *   cleared until that close's LoadCurrentMapView and UpdateSprites.
 * TextScriptEnd then returns into DisplayTextID, which holds and closes a second time, now
 * with BIT_FONT_LOADED clear: the full sprite reload (overworld/sprite_sets.ts).
 */
export function buildTownMapSignScript(): ScriptCommand[] {
  return [
    { type: 'displayOpen' },
    { type: 'printText', program: 'TownMapText', box: 'keep' },
    { type: 'whiteOut', on: true },
    { type: 'wait', frames: 3 },
    { type: 'wait', frames: copyFrames(128) },
    { type: 'whiteOut', on: false },
    { type: 'townMap' },
    { type: 'whiteOut', on: true },
    { type: 'displayCloseInPlace' },
    { type: 'whiteOut', on: false },
    { type: 'displayClose', outerWait: false, reload: 'full' },
  ];
}

/** Build script commands for scripted hidden events. Returns null if no script. */
export function getHiddenEventScript(scriptId: string): ScriptCommand[] | null {
  if (scriptId === 'VIRIDIAN_SCHOOL_NOTEBOOK') return buildSchoolNotebookScript();
  if (scriptId === 'VIRIDIAN_SCHOOL_BLACKBOARD') return buildSchoolBlackboardScript();
  if (scriptId === 'TOWN_MAP_TEXT') return buildTownMapSignScript();
  return null;
}
