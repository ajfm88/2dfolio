// Scripted hidden event definitions (multi-page notebooks, etc.)
//
// Assembly references:
//   engine/events/hidden_events/school_notebooks.asm — ViridianSchoolNotebook

import type { ScriptCommand } from '../script';
import { getText } from '../text';

/** Build script commands for scripted hidden events. Returns null if no script. */
export function getHiddenEventScript(scriptId: string): ScriptCommand[] | null {
  if (scriptId === "VIRIDIAN_SCHOOL_NOTEBOOK") {
    // engine/events/hidden_events/school_notebooks.asm — ViridianSchoolNotebook
    // 4 pages with "Turn the page?" yes/no between them, then girl's reaction
    const page1: ScriptCommand = {
      type: "text",
      message: getText('SCHOOL_NOTEBOOK_LOOKED') + '\f' + getText('SCHOOL_NOTEBOOK_PAGE1'),
    };
    const page2: ScriptCommand = {
      type: "text",
      message: getText('SCHOOL_NOTEBOOK_PAGE2'),
    };
    const page3: ScriptCommand = {
      type: "text",
      message: getText('SCHOOL_NOTEBOOK_PAGE3'),
    };
    const page4: ScriptCommand = {
      type: "text",
      message: getText('SCHOOL_NOTEBOOK_PAGE4'),
    };
    const girlReaction: ScriptCommand = {
      type: "text",
      message: getText('SCHOOL_GIRL_REACTION'),
    };
    return [
      page1,
      {
        type: "yesNo",
        message: getText('SCHOOL_NOTEBOOK_TURN_PAGE'),
        yesBranch: [
          page2,
          {
            type: "yesNo",
            message: getText('SCHOOL_NOTEBOOK_TURN_PAGE'),
            yesBranch: [
              page3,
              {
                type: "yesNo",
                message: getText('SCHOOL_NOTEBOOK_TURN_PAGE'),
                yesBranch: [page4, girlReaction],
                noBranch: [],
              },
            ],
            noBranch: [],
          },
        ],
        noBranch: [],
      },
    ];
  }
  return null;
}
