// The catch demo's screen: BATTLE_TYPE_OLD_MAN (the Viridian old man) and
// BATTLE_TYPE_PIKACHU (Oak catches Pikachu in Pallet Town). The rules and the step list
// are in catch_demo.ts; this runs them. Upstream's pikachu/pikachu_battle.ts, moved and
// generalized in V1d (DECISIONS #32, notes/05-v1d-plan.md).
// The battle transition (startWildBattleTransition) runs before this is entered.

import {
  setActivePalette,
  getActivePalette,
  loadBattleSprite,
  getCtx,
  getScale,
  getMonsterPalette,
} from "../renderer";
import { reloadBorderTiles } from "../text";
import { getText } from "../text/game_text";
import { isPressed } from "../input";
import { playSFX } from "../audio";
import { getItemName } from "../items";
import type { BattlePokemon } from "./types";
import {
  renderBattleBg,
  renderEnemySprite,
  renderPlayerSprite,
  renderEnemyHUD,
  renderBattleText,
  renderActionMenu,
  renderItemMenu,
  createSilhouette,
} from "./battle_ui";
import {
  catchDemoCaught,
  catchDemoBackPic,
  catchDemoNameKey,
  catchDemoSteps,
  CATCH_DEMO_BAG,
} from "./catch_demo";
import type { CatchDemoBattleType, CatchDemoStep, CatchDemoAnim } from "./catch_demo";

// --- Animation sprite data (from data/battle_anims/frame_blocks.asm) ---

interface AnimSprite {
  x: number;    // tile grid X (0-based, each unit = 8px)
  y: number;    // tile grid Y (0-based, each unit = 8px)
  tile: number; // linear tile index in move_anim_0.png
  xFlip: boolean;
  yFlip: boolean;
}

// FrameBlock03 — Pokeball (2x2 tiles = 16x16 px)
const FB_POKEBALL: AnimSprite[] = [
  { x: 0, y: 0, tile: 0x02, xFlip: false, yFlip: false },
  { x: 1, y: 0, tile: 0x02, xFlip: true,  yFlip: false },
  { x: 0, y: 1, tile: 0x12, xFlip: false, yFlip: false },
  { x: 1, y: 1, tile: 0x12, xFlip: true,  yFlip: false },
];

// FrameBlock04 — Shake tilt right (2x2 tiles)
const FB_SHAKE_R: AnimSprite[] = [
  { x: 0, y: 0, tile: 0x06, xFlip: false, yFlip: false },
  { x: 1, y: 0, tile: 0x07, xFlip: false, yFlip: false },
  { x: 0, y: 1, tile: 0x16, xFlip: false, yFlip: false },
  { x: 1, y: 1, tile: 0x17, xFlip: false, yFlip: false },
];

// FrameBlock05 — Shake tilt left (2x2 tiles, X-flipped)
const FB_SHAKE_L: AnimSprite[] = [
  { x: 0, y: 0, tile: 0x07, xFlip: true,  yFlip: false },
  { x: 1, y: 0, tile: 0x06, xFlip: true,  yFlip: false },
  { x: 0, y: 1, tile: 0x17, xFlip: true,  yFlip: false },
  { x: 1, y: 1, tile: 0x16, xFlip: true,  yFlip: false },
];

// FrameBlock06 — Poof frame 1 (small burst, 4x4 grid)
const FB_POOF_1: AnimSprite[] = [
  { x: 1, y: 0, tile: 0x23, xFlip: false, yFlip: false },
  { x: 0, y: 1, tile: 0x32, xFlip: false, yFlip: false },
  { x: 1, y: 1, tile: 0x33, xFlip: false, yFlip: false },
  { x: 2, y: 0, tile: 0x23, xFlip: true,  yFlip: false },
  { x: 2, y: 1, tile: 0x33, xFlip: true,  yFlip: false },
  { x: 3, y: 1, tile: 0x32, xFlip: true,  yFlip: false },
  { x: 0, y: 2, tile: 0x32, xFlip: false, yFlip: true  },
  { x: 1, y: 2, tile: 0x33, xFlip: false, yFlip: true  },
  { x: 1, y: 3, tile: 0x23, xFlip: false, yFlip: true  },
  { x: 2, y: 2, tile: 0x33, xFlip: true,  yFlip: true  },
  { x: 3, y: 2, tile: 0x32, xFlip: true,  yFlip: true  },
  { x: 2, y: 3, tile: 0x23, xFlip: true,  yFlip: true  },
];

// FrameBlock07 — Poof frame 2 (medium burst, 4x4 grid)
const FB_POOF_2: AnimSprite[] = [
  { x: 0, y: 0, tile: 0x20, xFlip: false, yFlip: false },
  { x: 1, y: 0, tile: 0x21, xFlip: false, yFlip: false },
  { x: 0, y: 1, tile: 0x30, xFlip: false, yFlip: false },
  { x: 1, y: 1, tile: 0x31, xFlip: false, yFlip: false },
  { x: 2, y: 0, tile: 0x21, xFlip: true,  yFlip: false },
  { x: 3, y: 0, tile: 0x20, xFlip: true,  yFlip: false },
  { x: 2, y: 1, tile: 0x31, xFlip: true,  yFlip: false },
  { x: 3, y: 1, tile: 0x30, xFlip: true,  yFlip: false },
  { x: 0, y: 2, tile: 0x30, xFlip: false, yFlip: true  },
  { x: 1, y: 2, tile: 0x31, xFlip: false, yFlip: true  },
  { x: 0, y: 3, tile: 0x20, xFlip: false, yFlip: true  },
  { x: 1, y: 3, tile: 0x21, xFlip: false, yFlip: true  },
  { x: 2, y: 2, tile: 0x31, xFlip: true,  yFlip: true  },
  { x: 3, y: 2, tile: 0x30, xFlip: true,  yFlip: true  },
  { x: 2, y: 3, tile: 0x21, xFlip: true,  yFlip: true  },
  { x: 3, y: 3, tile: 0x20, xFlip: true,  yFlip: true  },
];

// FrameBlock08 — Poof frame 3 (large burst, 5x5 grid)
const FB_POOF_3: AnimSprite[] = [
  { x: 0, y: 0, tile: 0x20, xFlip: false, yFlip: false },
  { x: 1, y: 0, tile: 0x21, xFlip: false, yFlip: false },
  { x: 0, y: 1, tile: 0x30, xFlip: false, yFlip: false },
  { x: 1, y: 1, tile: 0x31, xFlip: false, yFlip: false },
  { x: 3, y: 0, tile: 0x21, xFlip: true,  yFlip: false },
  { x: 4, y: 0, tile: 0x20, xFlip: true,  yFlip: false },
  { x: 3, y: 1, tile: 0x31, xFlip: true,  yFlip: false },
  { x: 4, y: 1, tile: 0x30, xFlip: true,  yFlip: false },
  { x: 0, y: 3, tile: 0x30, xFlip: false, yFlip: true  },
  { x: 1, y: 3, tile: 0x31, xFlip: false, yFlip: true  },
  { x: 0, y: 4, tile: 0x20, xFlip: false, yFlip: true  },
  { x: 1, y: 4, tile: 0x21, xFlip: false, yFlip: true  },
  { x: 3, y: 3, tile: 0x31, xFlip: true,  yFlip: true  },
  { x: 4, y: 3, tile: 0x30, xFlip: true,  yFlip: true  },
  { x: 3, y: 4, tile: 0x21, xFlip: true,  yFlip: true  },
  { x: 4, y: 4, tile: 0x20, xFlip: true,  yFlip: true  },
];

// FrameBlock09 — Poof frame 4 (dispersing, 5x5 grid)
const FB_POOF_4: AnimSprite[] = [
  { x: 0, y: 0, tile: 0x24, xFlip: false, yFlip: false },
  { x: 1, y: 0, tile: 0x25, xFlip: false, yFlip: false },
  { x: 0, y: 1, tile: 0x34, xFlip: false, yFlip: false },
  { x: 3, y: 0, tile: 0x25, xFlip: true,  yFlip: false },
  { x: 4, y: 0, tile: 0x24, xFlip: true,  yFlip: false },
  { x: 4, y: 1, tile: 0x34, xFlip: true,  yFlip: false },
  { x: 0, y: 3, tile: 0x34, xFlip: false, yFlip: true  },
  { x: 0, y: 4, tile: 0x24, xFlip: false, yFlip: true  },
  { x: 1, y: 4, tile: 0x25, xFlip: false, yFlip: true  },
  { x: 4, y: 3, tile: 0x34, xFlip: true,  yFlip: true  },
  { x: 3, y: 4, tile: 0x25, xFlip: true,  yFlip: true  },
  { x: 4, y: 4, tile: 0x24, xFlip: true,  yFlip: true  },
];

// FrameBlock0A — Poof frame 5 (wide dispersal, 6x6 grid)
const FB_POOF_5: AnimSprite[] = [
  { x: 0, y: 0, tile: 0x24, xFlip: false, yFlip: false },
  { x: 1, y: 0, tile: 0x25, xFlip: false, yFlip: false },
  { x: 0, y: 1, tile: 0x34, xFlip: false, yFlip: false },
  { x: 4, y: 0, tile: 0x25, xFlip: true,  yFlip: false },
  { x: 5, y: 0, tile: 0x24, xFlip: true,  yFlip: false },
  { x: 5, y: 1, tile: 0x34, xFlip: true,  yFlip: false },
  { x: 0, y: 4, tile: 0x34, xFlip: false, yFlip: true  },
  { x: 0, y: 5, tile: 0x24, xFlip: false, yFlip: true  },
  { x: 1, y: 5, tile: 0x25, xFlip: false, yFlip: true  },
  { x: 5, y: 4, tile: 0x34, xFlip: true,  yFlip: true  },
  { x: 4, y: 5, tile: 0x25, xFlip: true,  yFlip: true  },
  { x: 5, y: 5, tile: 0x24, xFlip: true,  yFlip: true  },
];

// Subanim_0BallPoofEnemy sequence: 6 frames at 4-frame delay each = 24 frames
// SUBANIMTYPE_HFLIP — entire frame is horizontally flipped (enemy side)
const POOF_SEQUENCE: AnimSprite[][] = [
  FB_POOF_1, FB_POOF_2, FB_POOF_3, FB_POOF_4, FB_POOF_5, FB_POOF_5,
];

// --- Constants ---

// Ball arc positions (from base_coords.asm, converted to screen coords)
// BASECOORD_30: ($58,$28) → screen center ~(40, 80) — near the thrower's hand
// BASECOORD_34: ($32,$78) → screen center ~(120, 42) — enemy area
const BALL_START_X = 40;
const BALL_START_Y = 80;
const BALL_END_X = 120;
const BALL_END_Y = 42;

// Upstream's approximations of the toss animations (notes/05-v1d-plan.md §1.4). The exact
// frames are in data/battle_anims (Subanim_0BallToss*, ShakeEnemy, PoofEnemy).
const TOSS_FRAMES = 30;
// Assembly poof: 6 frames × 4 frame delay = 24 frames
const POOF_FRAMES = 24;
// The ball lands, then shakes: 4 anim frames × 4 delay = 16 frames wobble + pause
const SHAKE_REST_FRAMES = 15;
const SHAKE_FRAMES = 30;
const SHAKE_COUNT = 3;
// AnimationHideEnemyMonPic / AnimationShowMonPic end with Delay3
const PIC_FRAMES = 3;

// Slide-in animation (matching the wild battle intro in battle.ts)
const SLIDE_IN_FRAMES = 40;
const SLIDE_OFFSET = 160;       // full screen width
const COLORIZE_FRAMES = 15;

// --- Types ---

type Phase = "slide_in" | "colorize" | "steps" | "ended";

interface CatchDemoState {
  phase: Phase;
  timer: number;
  steps: CatchDemoStep[];
  stepIndex: number;
  pageIndex: number;
  enemy: BattlePokemon;
  enemySprite: HTMLCanvasElement | null;
  backSprite: HTMLCanvasElement | null;
  enemySilhouette: HTMLCanvasElement | null;
  backSilhouette: HTMLCanvasElement | null;
  animTileset: HTMLCanvasElement | null;
  animTilesetBW: HTMLCanvasElement | null; // grayscale version for the thrown ball
  slideOffset: number;
  colorT: number;
  /** The last text printed; it stays in the box until the next text or menu. */
  textLines: string[];
  showEnemyPic: boolean;
  showHud: boolean;
  ballVisible: boolean;
  ballX: number;
  ballY: number;
  caught: boolean;
  savedPalette: string;
}

export interface CatchDemoInit {
  battleType: CatchDemoBattleType;
  /** The opponent as LoadEnemyMonData builds it (the caller marks it seen). */
  enemy: BattlePokemon;
  /** EVENT_INITIAL_CATCH_TRAINING, read by ItemUseBall. */
  initialCatchTraining: boolean;
}

/** Returned by updateCatchDemo when the battle is over and main.ts takes over. */
export interface CatchDemoAction {
  type: "ended";
  savedPalette: string;
}

// --- Module state ---

let demo: CatchDemoState | null = null;

// --- Public API ---

/** Start the catch demo. Called AFTER the battle transition has completed. */
export function initCatchDemo(opts: CatchDemoInit): void {
  const savedPal = getActivePalette();
  setActivePalette("ROUTE");
  reloadBorderTiles();
  const enemyName = opts.enemy.nickname.toUpperCase();
  const caught = catchDemoCaught(opts.battleType, opts.initialCatchTraining);
  // Assembly: SetPal_Battle reads wBattleMonSpecies (0 = no player mon),
  // DeterminePaletteID maps species 0 → MonsterPalettes[0] = PAL_MEWMON.
  // OBJ palette 0 = MEWMON (white, yellow, red, black) — used for the back pic + pokeball.
  const spritePromise = Promise.all([
    loadBattleSprite(`/gfx/sprites/front/${opts.enemy.species.id}.png`, getMonsterPalette(opts.enemy.species.id)),
    loadBattleSprite(catchDemoBackPic(opts.battleType), "MEWMON"),
    // Animation tileset for pokeball/poof sprites — uses OBJ palette 0 (MEWMON)
    loadBattleSprite("/gfx/battle/move_anim_0.png", "MEWMON"),
  ]);
  demo = {
    phase: "slide_in",
    timer: 0,
    steps: catchDemoSteps({
      enemyName,
      demoName: getText(catchDemoNameKey(opts.battleType)),
      ballName: getItemName("POKE_BALL"),
      caught,
      soCloseText: getText("BATTLE_SO_CLOSE"),
    }),
    stepIndex: 0,
    pageIndex: 0,
    enemy: opts.enemy,
    enemySprite: null,
    backSprite: null,
    enemySilhouette: null,
    backSilhouette: null,
    animTileset: null,
    animTilesetBW: null,
    slideOffset: SLIDE_OFFSET,
    colorT: 0,
    textLines: [],
    showEnemyPic: true,
    showHud: false,
    ballVisible: false,
    ballX: 0,
    ballY: 0,
    caught,
    savedPalette: savedPal,
  };
  spritePromise.then(([enemyFront, back, animTiles]) => {
    if (demo) {
      demo.enemySprite = enemyFront;
      demo.backSprite = back;
      demo.enemySilhouette = createSilhouette(enemyFront);
      demo.backSilhouette = createSilhouette(back);
      demo.animTileset = animTiles;
      demo.animTilesetBW = createBWTileset(animTiles);
    }
  });
}

export function clearCatchDemo(): void {
  demo = null;
}

/** Advance the demo one frame. Returns an action when main.ts needs to take over. */
export function updateCatchDemo(): CatchDemoAction | null {
  if (!demo) return null;

  // Slide-in phase: silhouettes slide in from opposite sides
  if (demo.phase === "slide_in") {
    demo.timer++;
    const t = Math.min(demo.timer / SLIDE_IN_FRAMES, 1);
    const eased = 1 - (1 - t) * (1 - t); // ease-out quadratic
    demo.slideOffset = SLIDE_OFFSET * (1 - eased);
    if (t >= 1) {
      demo.slideOffset = 0;
      demo.phase = "colorize";
      demo.timer = 0;
      demo.colorT = 0;
    }
    return null;
  }

  // Colorize phase: silhouette → full color
  if (demo.phase === "colorize") {
    demo.timer++;
    demo.colorT = Math.min(demo.timer / COLORIZE_FRAMES, 1);
    if (demo.colorT >= 1) {
      demo.colorT = 1;
      startStep(demo);
    }
    return null;
  }

  if (demo.phase !== "steps") return null;

  const step = demo.steps[demo.stepIndex];
  if (step.type === "text") {
    // `prompt` / `text_promptbutton`: wait for A or B on every page
    if (isPressed("a") || isPressed("b")) {
      playSFX("press_ab");
      demo.pageIndex++;
      if (demo.pageIndex < step.pages.length) {
        demo.textLines = step.pages[demo.pageIndex];
        return null;
      }
      return nextStep(demo);
    }
    return null;
  }

  demo.timer++;
  if (step.type === "anim") updateAnim(demo, step.anim);
  if (demo.timer >= stepFrames(step)) return nextStep(demo);
  return null;
}

/** Render the catch demo's battle screen. */
export function renderCatchDemo(): void {
  if (!demo) return;

  // --- Slide-in phase: silhouettes slide in from opposite sides ---
  if (demo.phase === "slide_in") {
    renderBattleBg();
    if (demo.enemySilhouette) renderEnemySprite(demo.enemySilhouette, -demo.slideOffset);
    if (demo.backSilhouette) renderPlayerSprite(demo.backSilhouette, demo.slideOffset);
    return;
  }

  // --- Colorize phase: blend silhouette → full color ---
  if (demo.phase === "colorize") {
    renderBattleBg();
    if (demo.enemySprite && demo.enemySilhouette) {
      renderWithBlend(demo.enemySprite, demo.enemySilhouette,
        (s, off) => renderEnemySprite(s, off), demo.colorT);
    }
    if (demo.backSprite && demo.backSilhouette) {
      renderWithBlend(demo.backSprite, demo.backSilhouette,
        (s, off) => renderPlayerSprite(s, off), demo.colorT);
    }
    return;
  }

  // --- The steps ---
  renderBattleBg();
  if (demo.enemySprite && demo.showEnemyPic) renderEnemySprite(demo.enemySprite);
  // AnimationHideMonPic clears only the pic; the HUD stays
  if (demo.showHud) renderEnemyHUD(demo.enemy, demo.enemy.currentHp);
  if (demo.backSprite) renderPlayerSprite(demo.backSprite);

  const step = demo.phase === "steps" ? demo.steps[demo.stepIndex] : null;

  // Poof animation (tile-based, from move_anim_0.png FrameBlock06-0A)
  if (step?.type === "anim" && step.anim === "poof" && demo.animTileset) {
    const frameIdx = Math.min(Math.floor(demo.timer / 4), POOF_SEQUENCE.length - 1);
    drawFrameBlock(demo.animTileset, POOF_SEQUENCE[frameIdx], demo.ballX, demo.ballY, true);
  }

  // Pokeball (tile-based, from move_anim_0.png FrameBlock03-05).
  // B&W while thrown and shaking, colored (MEWMON) once caught.
  if (demo.ballVisible && demo.animTileset && demo.animTilesetBW) {
    const caughtNow = step?.type === "text" && demo.caught;
    let fb = FB_POKEBALL;
    if (step?.type === "anim" && step.anim === "shake") fb = shakeFrameBlock(demo.timer);
    drawFrameBlock(caughtNow ? demo.animTileset : demo.animTilesetBW, fb, demo.ballX, demo.ballY);
  }

  if (step?.type === "menu") {
    renderActionMenu(step.cursor);
  } else if (step?.type === "bag") {
    renderItemMenu([...CATCH_DEMO_BAG], 0, step.cursor);
  } else {
    renderBattleText(demo.textLines);
  }
}

// --- Step runner ---

function stepFrames(step: CatchDemoStep): number {
  switch (step.type) {
    case "hud":
    case "menu":
    case "bag":
    case "throw_text":
      return step.frames;
    case "anim":
      return animFrames(step.anim);
    case "text":
      return 0;
  }
}

function animFrames(anim: CatchDemoAnim): number {
  switch (anim) {
    case "toss": return TOSS_FRAMES;
    case "poof": return POOF_FRAMES;
    case "shake": return SHAKE_REST_FRAMES + SHAKE_COUNT * SHAKE_FRAMES;
    case "hide_pic":
    case "show_pic":
      return PIC_FRAMES;
  }
}

function nextStep(d: CatchDemoState): CatchDemoAction | null {
  d.stepIndex++;
  if (d.stepIndex >= d.steps.length) {
    d.phase = "ended";
    return { type: "ended", savedPalette: d.savedPalette };
  }
  startStep(d);
  return null;
}

function startStep(d: CatchDemoState): void {
  d.phase = "steps";
  d.timer = 0;
  d.pageIndex = 0;
  const step = d.steps[d.stepIndex];
  switch (step.type) {
    case "text":
      d.textLines = step.pages[0];
      break;
    case "hud":
      // _InitBattleCommon: PrintText .emptyString clears the box, then DrawEnemyHUDAndHPBar
      d.textLines = [];
      d.showHud = true;
      break;
    case "throw_text":
      // BagWasSelected / ItemUseBall: LoadScreenTilesFromBuffer1 drops the menus
      d.textLines = step.lines;
      break;
    case "anim":
      startAnim(d, step.anim);
      break;
    case "menu":
    case "bag":
      break;
  }
}

function startAnim(d: CatchDemoState, anim: CatchDemoAnim): void {
  switch (anim) {
    case "toss":
      d.ballVisible = true;
      d.ballX = BALL_START_X;
      d.ballY = BALL_START_Y;
      break;
    case "poof":
      // The second poof is the break-out: the ball is gone
      if (d.stepIndex > 0 && isAfterShake(d)) d.ballVisible = false;
      break;
    case "hide_pic":
      d.showEnemyPic = false;
      break;
    case "show_pic":
      d.showEnemyPic = true;
      break;
    case "shake":
      break;
  }
}

function isAfterShake(d: CatchDemoState): boolean {
  return d.steps.slice(0, d.stepIndex).some(s => s.type === "anim" && s.anim === "shake");
}

function updateAnim(d: CatchDemoState, anim: CatchDemoAnim): void {
  if (anim !== "toss") return;
  const t = Math.min(d.timer / TOSS_FRAMES, 1);
  d.ballX = BALL_START_X + (BALL_END_X - BALL_START_X) * t;
  d.ballY = BALL_START_Y + (BALL_END_Y - BALL_START_Y) * t - 40 * 4 * t * (1 - t);
}

/** Assembly shake: FB03 → FB04 → FB03 → FB05 (normal, tilt R, normal, tilt L), per shake. */
function shakeFrameBlock(timer: number): AnimSprite[] {
  const t = timer - SHAKE_REST_FRAMES;
  if (t < 0) return FB_POKEBALL;
  const subFrame = Math.floor(((t % SHAKE_FRAMES) / SHAKE_FRAMES) * 4);
  if (subFrame === 1) return FB_SHAKE_R;
  if (subFrame === 3) return FB_SHAKE_L;
  return FB_POKEBALL;
}

// --- Private helpers ---

/** Render a sprite with silhouette→color blending (matching Battle.renderSpriteWithSilhouette). */
function renderWithBlend(
  sprite: HTMLCanvasElement,
  silhouette: HTMLCanvasElement,
  renderFn: (s: HTMLCanvasElement, offset?: number) => void,
  colorT: number,
): void {
  const ctx = getCtx();
  if (colorT <= 0) {
    renderFn(silhouette);
  } else if (colorT >= 1) {
    renderFn(sprite);
  } else {
    renderFn(silhouette);
    ctx.globalAlpha = colorT;
    renderFn(sprite);
    ctx.globalAlpha = 1;
  }
}

/** Draw a frame block from the animation tileset at a center position.
 *  Assembly: each frame block defines N sprites as tile-grid entries.
 *  hFlip: SUBANIMTYPE_HFLIP — mirrors the entire frame horizontally (for enemy-side effects). */
function drawFrameBlock(
  tileset: HTMLCanvasElement,
  sprites: AnimSprite[],
  cx: number,
  cy: number,
  hFlip = false,
): void {
  const ctx = getCtx();
  const s = getScale();
  const tilesPerRow = Math.floor(tileset.width / 8);

  // Compute frame block bounds to center it
  let maxX = 0, maxY = 0;
  for (const sp of sprites) {
    if (sp.x + 1 > maxX) maxX = sp.x + 1;
    if (sp.y + 1 > maxY) maxY = sp.y + 1;
  }
  const halfW = (maxX * 8) / 2;
  const halfH = (maxY * 8) / 2;

  for (const sp of sprites) {
    const srcX = (sp.tile % tilesPerRow) * 8;
    const srcY = Math.floor(sp.tile / tilesPerRow) * 8;

    // Apply HFLIP: mirror X position and toggle xFlip
    let dx: number, xf: boolean;
    if (hFlip) {
      dx = (maxX - 1 - sp.x) * 8;
      xf = !sp.xFlip;
    } else {
      dx = sp.x * 8;
      xf = sp.xFlip;
    }
    const yf = sp.yFlip;

    const destX = cx - halfW + dx;
    const destY = cy - halfH + sp.y * 8;

    if (xf || yf) {
      ctx.save();
      ctx.translate(
        (destX + (xf ? 8 : 0)) * s,
        (destY + (yf ? 8 : 0)) * s,
      );
      ctx.scale(xf ? -1 : 1, yf ? -1 : 1);
      ctx.drawImage(tileset, srcX, srcY, 8, 8, 0, 0, 8 * s, 8 * s);
      ctx.restore();
    } else {
      ctx.drawImage(tileset, srcX, srcY, 8, 8, destX * s, destY * s, 8 * s, 8 * s);
    }
  }
}

/** Create a 2-tone B&W copy of a colored tileset.
 *  Light pixels (shade 1) → white, dark pixels (shades 2-3) → black.
 *  Matches the original GB monochrome pokeball appearance. */
function createBWTileset(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx2 = c.getContext("2d")!;
  ctx2.drawImage(src, 0, 0);
  const imgData = ctx2.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; // keep transparent
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (lum > 128) {
      d[i] = 0xF8; d[i + 1] = 0xF8; d[i + 2] = 0xF8;
    } else {
      d[i] = 0x08; d[i + 1] = 0x18; d[i + 2] = 0x20;
    }
  }
  ctx2.putImageData(imgData, 0, 0);
  return c;
}
