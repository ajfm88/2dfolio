// Pikachu emotion animation display (bordered box with animated face)
// Extracted from main.ts — manages its own internal state

import { loadTileset, getCtx, getScale } from "../renderer";
import { drawBox } from "../menus";
import type { BattlePokemon } from "../battle";
import type { PikachuAnimScript } from "./pikachu_happiness";
import { getPikachuAnimScript } from "./pikachu_happiness";

// --- Types ---

interface PikachuEmotionAnim {
  script: PikachuAnimScript;
  baseCanvas: HTMLCanvasElement | null;
  overlayCanvases: (HTMLCanvasElement | null)[];
  frameIndex: number;
  frameTicks: number;
  totalTicks: number;
  tickAccum: number;
  composited: HTMLCanvasElement;
}

// --- Constants ---

const ANIM_TICK_RATE = 3; // game frames per animation tick

// --- Module state ---

let emotionAnim: PikachuEmotionAnim | null = null;

// --- Public API ---

export function isPikachuEmotionActive(): boolean {
  return emotionAnim !== null;
}

export function isPikachuEmotionExpired(): boolean {
  if (!emotionAnim) return true;
  return emotionAnim.totalTicks >= emotionAnim.script.duration;
}

export function clearPikachuEmotion(): void {
  emotionAnim = null;
}

/** Start displaying Pikachu's emotion face with animation. */
export function startPikachuEmotion(party: BattlePokemon[]): void {
  const script = getPikachuAnimScript(party);

  const composited = document.createElement("canvas");
  composited.width = 40;
  composited.height = 40;

  emotionAnim = {
    script,
    baseCanvas: null,
    overlayCanvases: script.overlays.map(() => null),
    frameIndex: 0,
    frameTicks: 0,
    totalTicks: 0,
    tickAccum: 0,
    composited,
  };

  // Load base face
  loadTileset(script.baseFace).then((canvas) => {
    if (emotionAnim) {
      emotionAnim.baseCanvas = canvas;
      compositePikachuFace();
    }
  });

  // Load overlay images
  script.overlays.forEach((ov, i) => {
    loadTileset(ov.path).then((canvas) => {
      if (emotionAnim) {
        emotionAnim.overlayCanvases[i] = canvas;
      }
    });
  });
}

/** Advance the pikachu emotion animation by one game frame. */
export function updatePikachuEmotionAnim(): void {
  if (!emotionAnim) return;
  const anim = emotionAnim;

  anim.tickAccum++;
  if (anim.tickAccum < ANIM_TICK_RATE) return;
  anim.tickAccum = 0;
  anim.totalTicks++;

  const frames = anim.script.frames;
  if (frames.length === 0) return;

  anim.frameTicks++;
  const currentFrame = frames[anim.frameIndex];

  if (currentFrame.ticks > 0 && anim.frameTicks >= currentFrame.ticks) {
    anim.frameTicks = 0;
    anim.frameIndex = (anim.frameIndex + 1) % frames.length;
  }

  compositePikachuFace();
}

/** Render the Pikachu emotion box centered on screen. */
export function renderPikachuEmotionBox(): void {
  const boxX = 6 * 8; // 48
  const boxY = 5 * 8; // 40
  drawBox(boxX, boxY, 56, 56);
  if (emotionAnim?.baseCanvas) {
    const ctx = getCtx();
    const s = getScale();
    ctx.drawImage(
      emotionAnim.composited,
      0, 0, 40, 40,
      56 * s, 48 * s, 40 * s, 40 * s
    );
  }
}

// --- Private helpers ---

function compositePikachuFace(): void {
  const anim = emotionAnim;
  if (!anim || !anim.baseCanvas) return;
  const base = anim.baseCanvas;
  const ctx = anim.composited.getContext("2d")!;

  ctx.clearRect(0, 0, 40, 40);
  ctx.drawImage(base, 0, 0);

  const frames = anim.script.frames;
  if (frames.length > 0) {
    const frame = frames[anim.frameIndex];
    if (frame.overlay !== null) {
      const ovCanvas = anim.overlayCanvases[frame.overlay];
      const ovInfo = anim.script.overlays[frame.overlay];
      if (ovCanvas && ovInfo) {
        ctx.drawImage(ovCanvas, ovInfo.x, ovInfo.y);
      }
    }
  }
}
