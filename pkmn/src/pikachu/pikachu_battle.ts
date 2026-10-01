// Pikachu battle auto-sequence (Oak catches Pikachu in the grass cutscene)
// Assembly: BATTLE_TYPE_PIKACHU — auto-plays with simulated input (Oak throws POKé BALL)
// The standard battle transition (startWildBattleTransition) runs before this is entered.

import {
  setActivePalette,
  getActivePalette,
  loadBattleSprite,
  getCtx,
  getScale,
} from "../renderer";
import { reloadBorderTiles } from "../text";
import { isPressed } from "../input";
import type { BattlePokemon } from "../battle";
import {
  renderBattleBg,
  renderEnemySprite,
  renderPlayerSprite,
  renderEnemyHUD,
  renderBattleText,
  createSilhouette,
} from "../battle";
import { getItemName } from "../items";
import { getSpeciesById } from "../battle/data";
import { getTrainerClass } from "../battle/trainer_ai";

// --- Types ---

type PikaBattlePhase =
  | "slide_in"
  | "colorize"
  | "intro"
  | "oak_throw"
  | "ball_arc"
  | "poof"
  | "hit"
  | "shake1"
  | "shake2"
  | "shake3"
  | "caught"
  | "ending";

interface PikachuBattleState {
  phase: PikaBattlePhase;
  timer: number;
  pikachuSprite: HTMLCanvasElement | null;
  oakBackSprite: HTMLCanvasElement | null;
  pikachuSilhouette: HTMLCanvasElement | null;
  oakSilhouette: HTMLCanvasElement | null;
  animTileset: HTMLCanvasElement | null;
  animTilesetBW: HTMLCanvasElement | null; // grayscale version for ball throw arc
  slideOffset: number;
  colorT: number;
  ballT: number;
  ballX: number;
  ballY: number;
  showPikachu: boolean;
  poofTimer: number;
  savedPalette: string;
}

/** Returned by updatePikachuBattle when main.ts needs to take action. */
export interface PikachuBattleAction {
  type: "caught";
  savedPalette: string;
}

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
// BASECOORD_30: ($58,$28) → screen center ~(40, 80) — near Oak's hand
// BASECOORD_34: ($32,$78) → screen center ~(120, 42) — enemy area
const PIKA_BALL_START_X = 40;
const PIKA_BALL_START_Y = 80;
const PIKA_BALL_END_X = 120;
const PIKA_BALL_END_Y = 42;

// Assembly poof: 6 frames × 4 frame delay = 24 frames
const POOF_FRAMES = 24;
// Assembly shake: 4 anim frames × 4 delay = 16 frames wobble + pause
const SHAKE_FRAMES = 30;

// Slide-in animation (matching wild battle intro from battle.ts)
const SLIDE_IN_FRAMES = 40;
const SLIDE_OFFSET = 160;       // full screen width
const COLORIZE_FRAMES = 15;

/** Fake BattlePokemon for rendering the enemy HUD. */
const pikachuHudData = {
  get nickname(): string { return (getSpeciesById(25)?.name ?? '???').toUpperCase(); },
  level: 5,
  maxHp: 22,
  status: null as string | null,
};

// --- Module state ---

let battle: PikachuBattleState | null = null;

// --- Public API ---

/** Start the pikachu battle sequence.
 *  Called AFTER the standard battle transition has completed. */
export function initPikachuBattle(): void {
  const savedPal = getActivePalette();
  setActivePalette("ROUTE");
  reloadBorderTiles();
  // Assembly: SetPal_Battle reads wBattleMonSpecies (0 = no player mon),
  // DeterminePaletteID maps species 0 → MonsterPalettes[0] = PAL_MEWMON.
  // OBJ palette 0 = MEWMON (white, yellow, red, black) — used for Oak + pokeball.
  const spritePromise = Promise.all([
    loadBattleSprite("/gfx/sprites/front/25.png", "YELLOWMON"),
    loadBattleSprite("/gfx/battle/prof.oakb.png", "MEWMON"),
    // Animation tileset for pokeball/poof sprites — uses OBJ palette 0 (MEWMON)
    loadBattleSprite("/gfx/battle/move_anim_0.png", "MEWMON"),
  ]);
  battle = {
    phase: "slide_in",
    timer: 0,
    pikachuSprite: null,
    oakBackSprite: null,
    pikachuSilhouette: null,
    oakSilhouette: null,
    animTileset: null,
    animTilesetBW: null,
    slideOffset: SLIDE_OFFSET,
    colorT: 0,
    ballT: 0,
    ballX: 0,
    ballY: 0,
    showPikachu: true,
    poofTimer: 0,
    savedPalette: savedPal,
  };
  spritePromise.then(([pikachuFront, oakBack, animTiles]) => {
    if (battle) {
      battle.pikachuSprite = pikachuFront;
      battle.oakBackSprite = oakBack;
      battle.pikachuSilhouette = createSilhouette(pikachuFront);
      battle.oakSilhouette = createSilhouette(oakBack);
      battle.animTileset = animTiles;
      battle.animTilesetBW = createBWTileset(animTiles);
    }
  });
}

export function clearPikachuBattle(): void {
  battle = null;
}

/** Update the auto-played battle. Returns an action when main.ts needs to handle a transition. */
export function updatePikachuBattle(): PikachuBattleAction | null {
  if (!battle) return null;

  // Slide-in phase: silhouettes slide in from opposite sides
  if (battle.phase === "slide_in") {
    battle.timer++;
    const t = Math.min(battle.timer / SLIDE_IN_FRAMES, 1);
    const eased = 1 - (1 - t) * (1 - t); // ease-out quadratic
    battle.slideOffset = SLIDE_OFFSET * (1 - eased);
    if (t >= 1) {
      battle.slideOffset = 0;
      battle.phase = "colorize";
      battle.timer = 0;
      battle.colorT = 0;
    }
    return null;
  }

  // Colorize phase: silhouette → full color
  if (battle.phase === "colorize") {
    battle.timer++;
    battle.colorT = Math.min(battle.timer / COLORIZE_FRAMES, 1);
    if (battle.colorT >= 1) {
      battle.colorT = 1;
      battle.phase = "intro";
      battle.timer = 20;
    }
    return null;
  }

  // Ball arc animation
  if (battle.phase === "ball_arc") {
    battle.ballT += 1 / 30;
    const t = battle.ballT;
    battle.ballX =
      PIKA_BALL_START_X + (PIKA_BALL_END_X - PIKA_BALL_START_X) * t;
    battle.ballY =
      PIKA_BALL_START_Y +
      (PIKA_BALL_END_Y - PIKA_BALL_START_Y) * t -
      40 * 4 * t * (1 - t);
    if (battle.ballT >= 1) {
      battle.showPikachu = false;
      battle.ballX = PIKA_BALL_END_X;
      battle.ballY = PIKA_BALL_END_Y;
      battle.phase = "poof";
      battle.poofTimer = POOF_FRAMES;
      battle.timer = POOF_FRAMES;
    }
    return null;
  }

  // Poof animation
  if (battle.phase === "poof") {
    battle.poofTimer--;
    battle.timer--;
    if (battle.timer <= 0) {
      battle.phase = "hit";
      battle.timer = 15;
    }
    return null;
  }

  // Intro waits for button press
  if (battle.phase === "intro") {
    if (battle.timer > 0) battle.timer--;
    if (battle.timer <= 0 && (isPressed("a") || isPressed("b"))) {
      battle.phase = "oak_throw";
      battle.timer = 60;
    }
    return null;
  }

  battle.timer--;
  if (battle.timer > 0) return null;

  switch (battle.phase) {
    case "oak_throw":
      battle.phase = "ball_arc";
      battle.ballT = 0;
      break;
    case "hit":
      battle.phase = "shake1";
      battle.timer = SHAKE_FRAMES;
      break;
    case "shake1":
      battle.phase = "shake2";
      battle.timer = SHAKE_FRAMES;
      break;
    case "shake2":
      battle.phase = "shake3";
      battle.timer = SHAKE_FRAMES;
      break;
    case "shake3":
      battle.phase = "caught";
      battle.timer = 90;
      break;
    case "caught":
      battle.phase = "ending";
      return { type: "caught", savedPalette: battle.savedPalette };
    case "ending":
      break;
  }
  return null;
}

/** Render the auto-played Pikachu battle screen. */
export function renderPikachuBattle(): void {
  if (!battle) return;

  const phase = battle.phase;

  // --- Slide-in phase: silhouettes slide in from opposite sides ---
  if (phase === "slide_in") {
    renderBattleBg();
    if (battle.pikachuSilhouette) {
      renderEnemySprite(battle.pikachuSilhouette, -battle.slideOffset);
    }
    if (battle.oakSilhouette) {
      renderPlayerSprite(battle.oakSilhouette, battle.slideOffset);
    }
    return;
  }

  // --- Colorize phase: blend silhouette → full color ---
  if (phase === "colorize") {
    renderBattleBg();
    if (battle.pikachuSprite && battle.pikachuSilhouette) {
      renderWithBlend(battle.pikachuSprite, battle.pikachuSilhouette,
        (s, off) => renderEnemySprite(s, off), battle.colorT);
    }
    if (battle.oakBackSprite && battle.oakSilhouette) {
      renderWithBlend(battle.oakBackSprite, battle.oakSilhouette,
        (s, off) => renderPlayerSprite(s, off), battle.colorT);
    }
    return;
  }

  // --- Normal phases (intro onward) ---
  renderBattleBg();

  if (battle.pikachuSprite && battle.showPikachu) {
    renderEnemySprite(battle.pikachuSprite);
  }

  if (battle.showPikachu) {
    renderEnemyHUD(
      pikachuHudData as unknown as BattlePokemon,
      pikachuHudData.maxHp
    );
  }

  if (battle.oakBackSprite) {
    renderPlayerSprite(battle.oakBackSprite);
  }

  // Poof animation (tile-based, from move_anim_0.png FrameBlock06-0A)
  if (phase === "poof" && battle.animTileset) {
    const elapsed = POOF_FRAMES - battle.poofTimer;
    const frameIdx = Math.min(Math.floor(elapsed / 4), POOF_SEQUENCE.length - 1);
    drawFrameBlock(battle.animTileset, POOF_SEQUENCE[frameIdx],
      battle.ballX, battle.ballY, true);
  }

  // Pokeball rendering (tile-based, from move_anim_0.png FrameBlock03-05)
  // B&W during throw/shake, colored (MEWMON) only after catch confirmed
  if (battle.animTileset && battle.animTilesetBW) {
    const ballTiles = phase === "caught" ? battle.animTileset : battle.animTilesetBW;
    if (phase === "ball_arc") {
      drawFrameBlock(battle.animTilesetBW, FB_POKEBALL,
        battle.ballX, battle.ballY);
    } else if (
      phase === "poof" || phase === "hit" ||
      phase === "shake1" || phase === "shake2" || phase === "shake3" ||
      phase === "caught"
    ) {
      // Assembly shake: FB03 → FB04 → FB03 → FB05 (normal, tilt R, normal, tilt L)
      let fb = FB_POKEBALL;
      if (phase === "shake1" || phase === "shake2" || phase === "shake3") {
        const t = 1 - battle.timer / SHAKE_FRAMES;
        const subFrame = Math.floor(t * 4);
        if (subFrame === 1) fb = FB_SHAKE_R;
        else if (subFrame === 3) fb = FB_SHAKE_L;
      }
      drawFrameBlock(ballTiles, fb, battle.ballX, battle.ballY);
    }
  }

  switch (phase) {
    case "intro":
      renderBattleText([`Wild ${pikachuHudData.nickname} appeared!`]);
      break;
    case "oak_throw":
    case "ball_arc":
      renderBattleText([(getTrainerClass('PROF_OAK')?.displayName ?? 'TRAINER') + ' used', getItemName('POKE_BALL') + '!']);
      break;
    case "poof":
    case "hit":
    case "shake1":
    case "shake2":
    case "shake3":
      renderBattleText([""]);
      break;
    case "caught":
      // Original: 3 lines with scroll; we fit in 2 lines for our 2-line textbox
      renderBattleText([`All right! ${pikachuHudData.nickname}`, "was caught!"]);
      break;
  }
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
