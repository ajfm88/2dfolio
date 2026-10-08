// Trainer battle flow — the rules of home/trainers.asm and the trainer branches of
// engine/battle/core.asm, kept free of canvas and audio so they can be unit-tested.
// Battle and main.ts turn these into states; nothing here draws or plays anything.

/** data/trainers/encounter_types.asm FemaleTrainerList */
export const FEMALE_TRAINER_CLASSES: readonly string[] = ['LASS', 'JR_TRAINER_F', 'BEAUTY', 'COOLTRAINER_F'];

/** data/trainers/encounter_types.asm EvilTrainerList */
export const EVIL_TRAINER_CLASSES: readonly string[] = [
  'UNUSED_JUGGLER', 'GAMBLER', 'ROCKER', 'JUGGLER', 'CHIEF', 'SCIENTIST', 'GIOVANNI', 'ROCKET',
];

const RIVAL_CLASSES: readonly string[] = ['RIVAL1', 'RIVAL2', 'RIVAL3'];

/**
 * The music EngageMapTrainer starts before a trainer battle, or null for none.
 * Assembly: PlayTrainerMusic — none for the three rival classes or when wGymLeaderNo
 * is set; the evil list is checked before the female list.
 */
export function meetMusicFor(trainerClass: string, isGymLeader = false): string | null {
  if (RIVAL_CLASSES.includes(trainerClass) || isGymLeader) return null;
  if (EVIL_TRAINER_CLASSES.includes(trainerClass)) return 'meeteviltrainer';
  if (FEMALE_TRAINER_CLASSES.includes(trainerClass)) return 'meetfemaletrainer';
  return 'meetmaletrainer';
}

/**
 * The fanfare TrainerBattleVictory plays once the whole enemy party is down.
 * Assembly: MUSIC_DEFEATED_GYM_LEADER for a gym leader or RIVAL3 (the final battle),
 * MUSIC_DEFEATED_TRAINER otherwise.
 */
export function victoryMusicFor(trainerClass: string, isGymLeader = false): string {
  return isGymLeader || trainerClass === 'RIVAL3' ? 'defeatedgymleader' : 'defeatedtrainer';
}

/** Battle text line width in tiles (text starts at hlcoord 1, 14). */
export const BATTLE_TEXT_WIDTH = 18;

/**
 * Split a text into battle text-box pages of two lines each; `\f` (para) starts a
 * new page. Upstream's battle text box shows whole pages rather than scrolling on
 * `cont` — typed, scrolling battle text is A5.
 */
export function battleTextPages(text: string): string[][] {
  const pages: string[][] = [];
  // A5a map terminators must not become literal battle text; A5c consumes them.
  for (const para of text.replace(/<(PROMPT|DONE)>/g, '')
    .replace(/<(CONT|LINE|NEXT|SCROLL)>/g, '\n').split('\f')) {
    const lines = para.split('\n');
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  }
  return pages;
}

/**
 * The text PrintEndBattleText prints: TrainerEndBattleText is `_TrainerNameText`
 * ("<name>: ", from SaveTrainerName — in English always the class name, or the
 * rival's name) followed on the same line by the saved end-battle text.
 */
export function endBattleTextPages(trainerName: string, text: string): string[][] {
  return battleTextPages(`${trainerName}: ${text}`);
}

// ── _ScrollTrainerPicAfterBattle (engine/battle/scroll_draw_trainer_pic.asm) ──
// Step k = 1…6 draws pic columns 0…k−1 at tile x 20−k…19, then waits 4 frames.
// It stops at c = 7, so the pic ends at tile 14 with its 7th column off-screen.

export const PIC_SCROLL_STEPS = 6;
export const PIC_SCROLL_FRAMES_PER_STEP = 4;
export const PIC_SCROLL_FRAMES = PIC_SCROLL_STEPS * PIC_SCROLL_FRAMES_PER_STEP; // 24
/** Final x of the scrolled-in pic, in pixels (tile 14). */
export const PIC_SCROLL_FINAL_X = (20 - PIC_SCROLL_STEPS) * 8; // 112

/** Pixel x of the trainer pic `frame` frames into the scroll (0-based). */
export function picScrollX(frame: number): number {
  const step = Math.min(PIC_SCROLL_STEPS, Math.floor(frame / PIC_SCROLL_FRAMES_PER_STEP) + 1);
  return (20 - step) * 8;
}

/** TrainerBattleVictory / HandlePlayerBlackOut: `ld c, 40; call DelayFrames` after the scroll. */
export const AFTER_PIC_SCROLL_DELAY = 40;

export type TrainerEndStep =
  | { type: 'victoryMusic' }
  | { type: 'text'; pages: string[][] }
  | { type: 'scrollPic' }
  | { type: 'delay'; frames: number }
  | { type: 'blackout'; pages: string[][] }; // SET_PAL_BATTLE_BLACK + PlayerBlackedOutText2

/**
 * Assembly: TrainerBattleVictory (engine/battle/core.asm), after the last enemy
 * Pokémon has fainted and EXP has been given.
 * The end text prints only when one was saved (BIT_PRINT_END_BATTLE_TEXT).
 */
export function victorySequence(opts: {
  playerName: string;
  trainerName: string;
  endBattleText?: string;
  moneyWon: number;
}): TrainerEndStep[] {
  const { playerName, trainerName, endBattleText, moneyWon } = opts;
  return [
    { type: 'victoryMusic' },
    // data/text/text_2.asm _TrainerDefeatedText
    { type: 'text', pages: [[`${playerName} defeated`, `${trainerName}!`]] },
    { type: 'scrollPic' },
    { type: 'delay', frames: AFTER_PIC_SCROLL_DELAY },
    ...(endBattleText
      ? [{ type: 'text' as const, pages: endBattleTextPages(trainerName, endBattleText) }]
      : []),
    // data/text/text_2.asm _MoneyForWinningText
    { type: 'text', pages: [[`${playerName} got ¥${moneyWon}`, 'for winning!']] },
  ];
}

/**
 * Assembly: HandlePlayerBlackOut (engine/battle/core.asm). A lost battle prints no
 * trainer text — the saved lose text is never read — except against RIVAL1, whose
 * pic scrolls back in before _Rival1WinText. In OAKS_LAB that battle ends there:
 * no blackout (`ret z`), and .battleOccurred skips the faint check too.
 */
export function lossSequence(opts: {
  trainerClass: string | null;
  mapName: string;
  rival1WinText: string;
  blackoutText: string;
}): { steps: TrainerEndStep[]; blackout: boolean } {
  const blackoutStep: TrainerEndStep = { type: 'blackout', pages: battleTextPages(opts.blackoutText) };
  if (opts.trainerClass !== 'RIVAL1') return { steps: [blackoutStep], blackout: true };

  const steps: TrainerEndStep[] = [
    { type: 'scrollPic' },
    { type: 'delay', frames: AFTER_PIC_SCROLL_DELAY },
    { type: 'text', pages: battleTextPages(opts.rival1WinText) },
  ];
  if (opts.mapName === 'OaksLab') return { steps, blackout: false };
  return { steps: [...steps, blackoutStep], blackout: true };
}

/** constants/pokemon_constants.asm RIVAL_STARTER_* (wRivalStarter). */
export const RIVAL_STARTER = { JOLTEON: 1, FLAREON: 2, VAPOREON: 3 } as const;

/** scripts/OaksLab.asm OaksLabRivalEndBattleScript: wBattleResult 0 → Flareon, else Vaporeon. */
export function rivalStarterAfterLabBattle(playerWon: boolean): number {
  return playerWon ? RIVAL_STARTER.FLAREON : RIVAL_STARTER.VAPOREON;
}

// ── Trainer pics ──

/** Trainer sprite filename overrides for non-trivial mappings, keyed by trainers.json
 *  class key. UNUSED_JUGGLER and PSYCHIC_TR share JugglerPic / PsychicPic
 *  (data/trainers/pic_pointers_money.asm). */
const TRAINER_SPRITE_OVERRIDES: Record<string, string> = {
  UNUSED_JUGGLER: 'juggler', PSYCHIC_TR: 'psychic',
  LT_SURGE: 'lt.surge', JR_TRAINER_M: 'jr.trainerm', JR_TRAINER_F: 'jr.trainerf',
  PROF_OAK: 'prof.oak', JESSIE_JAMES: 'jessiejames', COOL_TRAINER_M: 'cooltrainerm',
  COOL_TRAINER_F: 'cooltrainerf', SUPER_NERD: 'supernerd', CUE_BALL: 'cueball',
  BIRD_KEEPER: 'birdkeeper', BLACK_BELT: 'blackbelt', POKE_MANIAC: 'pokemaniac',
  BUG_CATCHER: 'bugcatcher',
};

/** /gfx/trainers/ file name (without .png) for a trainers.json class key, e.g.
 *  BUG_CATCHER → bugcatcher. Display names ("BUG CATCHER") don't map to files. */
export function trainerPicName(classKey: string): string {
  return TRAINER_SPRITE_OVERRIDES[classKey] ?? classKey.toLowerCase().replace(/_/g, '');
}
