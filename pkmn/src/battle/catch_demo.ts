// The catch demo — BATTLE_TYPE_OLD_MAN (the Viridian old man) and BATTLE_TYPE_PIKACHU
// (Oak's Pikachu catch in Pallet Town) as rules and data. No DOM: the screen that runs
// these steps is catch_demo_screen.ts. Detail: notes/05-v1d-plan.md §1.
//
// Both battle types go through the normal battle engine in the ASM, with special cases:
// a simulated FIGHT → ITEM → POKé BALL input (core.asm DisplayBattleMenu
// .doSimulatedMenuInput, home/list_menu.asm), a fixed one-ball bag, no ball used and
// nothing added to the party (engine/items/item_effects.asm ItemUseBall).

import type { ItemStack } from '../items';
import { battleTextPages } from './trainer_flow';

export type CatchDemoBattleType = 'OLD_MAN' | 'PIKACHU';

/** StartBattle: `ld c, 40; call DelayFrames` after the HUD is drawn. */
export const HUD_DELAY_FRAMES = 40;
/** .doSimulatedMenuInput: each simulated cursor stays for `ld c, 20; call DelayFrames`. */
export const MENU_CURSOR_FRAMES = 20;
/**
 * DisplayListMenuID turns tile transfer off, waits 10 frames, prints the list, then
 * Delay3. The ▶ ITEM screen stays frozen for the 10 frames; the list shows 3 frames
 * later, still without a cursor.
 */
export const LIST_FROZEN_FRAMES = 10;
export const LIST_DRAW_FRAMES = 3;
/** DisplayListMenuIDLoop (wBattleType ≠ 0): ▶ on the first entry for 20 frames. */
export const LIST_CURSOR_FRAMES = 20;
/** ItemUseBall .skipShakeCalculations: `ld c, 20; call DelayFrames` before the toss. */
export const THROW_DELAY_FRAMES = 20;

/** SimulatedInputBattleItemList: `db 1, POKE_BALL, 1, -1` — never the player's bag. */
export const CATCH_DEMO_BAG: readonly ItemStack[] = [{ id: 'POKE_BALL', count: 1 }];

/**
 * ItemUseBall .oldManBattle: the PIKACHU battle jumps straight to .captured. OLD_MAN
 * sets wCapturedMonSpecies = 1, then forces $63 (3 shakes, breaks free) when
 * EVENT_INITIAL_CATCH_TRAINING is set, and is caught otherwise.
 */
export function catchDemoCaught(battleType: CatchDemoBattleType, initialCatchTraining: boolean): boolean {
  return battleType === 'PIKACHU' || !initialCatchTraining;
}

/** LoadPlayerBackPic: OldManPicBack / ProfOakPicBack instead of RedPicBack. */
export function catchDemoBackPic(battleType: CatchDemoBattleType): string {
  return battleType === 'OLD_MAN' ? '/gfx/battle/oldmanb.png' : '/gfx/battle/prof.oakb.png';
}

/** .doSimulatedMenuInput copies "OLD MAN@" (wBattleType 1) or "PROF.OAK@" into wPlayerName. */
export function catchDemoNameKey(battleType: CatchDemoBattleType): 'BATTLE_OLD_MAN_NAME' | 'BATTLE_PROF_OAK_NAME' {
  return battleType === 'OLD_MAN' ? 'BATTLE_OLD_MAN_NAME' : 'BATTLE_PROF_OAK_NAME';
}

export type CatchDemoAnim = 'toss' | 'poof' | 'hide_pic' | 'shake' | 'show_pic';

/**
 * TossBallAnimation: the upper nybble of wPokeBallAnimData is how many animations of
 * TOSS, then .PokeBallAnimations (POOF, HIDEPIC, SHAKE, POOF, SHOWPIC) play. Caught is
 * $43 → 4; the old man's forced failure is $63 → 6, 3 shakes then a break-out.
 */
export function tossBallAnims(caught: boolean): CatchDemoAnim[] {
  const all: CatchDemoAnim[] = ['toss', 'poof', 'hide_pic', 'shake', 'poof', 'show_pic'];
  return all.slice(0, caught ? 4 : 6);
}

export type CatchDemoStep =
  /** Printed text; each page waits for A or B (`prompt` / `text_promptbutton`). */
  | { type: 'text'; pages: string[][] }
  /** The text box cleared and the enemy HUD drawn (_InitBattleCommon), then a delay. */
  | { type: 'hud'; frames: number }
  /** The battle menu box with ▶ on FIGHT (0) or ITEM (2). */
  | { type: 'menu'; cursor: 0 | 2; frames: number }
  /** The bag list (CATCH_DEMO_BAG), with or without ▶ on POKé BALL. */
  | { type: 'bag'; cursor: boolean; frames: number }
  /** "<name> used / <ball>!" (ends with `done`), then the throw delay. It stays up. */
  | { type: 'throw_text'; lines: string[]; frames: number }
  | { type: 'anim'; anim: CatchDemoAnim };

export interface CatchDemoOpts {
  /** wEnemyMonNick, e.g. "RATTATA". */
  enemyName: string;
  /** "OLD MAN" / "PROF.OAK" (catchDemoNameKey). */
  demoName: string;
  /** The POKé BALL's item name. */
  ballName: string;
  caught: boolean;
  /** _ItemUseBallText04, "Shoot! It was so\nclose too!" (BATTLE_SO_CLOSE). */
  soCloseText: string;
}

/** The ordered steps after the slide-in (notes/05-v1d-plan.md §1.1 steps 5–15). */
export function catchDemoSteps(opts: CatchDemoOpts): CatchDemoStep[] {
  // _WildMonAppearedText: "Wild @" text_ram wEnemyMonNick / line "appeared!" / prompt
  const appeared: CatchDemoStep = { type: 'text', pages: [[`Wild ${opts.enemyName}`, 'appeared!']] };
  // ItemUseBallText05 → _ItemUseBallText05: "All right!" / line nick " was" / cont "caught!",
  // then sound_caught_mon and text_promptbutton. Paged as V1c pages `cont` until A5.
  const result = opts.caught
    ? battleTextPages(`All right!\n${opts.enemyName} was\ncaught!`)
    : battleTextPages(opts.soCloseText);
  return [
    appeared,
    { type: 'hud', frames: HUD_DELAY_FRAMES },
    { type: 'menu', cursor: 0, frames: MENU_CURSOR_FRAMES },
    { type: 'menu', cursor: 2, frames: MENU_CURSOR_FRAMES + LIST_FROZEN_FRAMES },
    { type: 'bag', cursor: false, frames: LIST_DRAW_FRAMES },
    { type: 'bag', cursor: true, frames: LIST_CURSOR_FRAMES },
    // ItemUseText00: _ItemUseText001 "<PLAYER> used@" text_low _ItemUseText002 (item) "!" done
    { type: 'throw_text', lines: [`${opts.demoName} used`, `${opts.ballName}!`], frames: THROW_DELAY_FRAMES },
    ...tossBallAnims(opts.caught).map((anim): CatchDemoStep => ({ type: 'anim', anim })),
    { type: 'text', pages: result },
  ];
}
