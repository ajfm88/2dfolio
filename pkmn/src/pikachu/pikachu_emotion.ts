// Talking to Pikachu: DisplayPikachuEmotion → TalkToPikachu (engine/pikachu/pikachu_emotions.asm).
// Phases, in source order:
//   entry    — DisplayTextIDInit with no border: its UpdateSprites turns Pikachu to the
//              player on the bare map (overworld/ui_entry.ts);
//   prelude  — the emotion's pikaemotion_movement calls (ApplyPikachuMovementData, direct:
//              no guard, no refresh), the map still showing, nothing dismissable;
//   border   — PlacePikapicTextBoxBorder: the box, Delay3, UpdateSprites (Pikachu under the
//              box), Delay3;
//   portrait — the face animation (A or B, or its duration, closes it).
// The emotion commands' cries (PCM) and emote bubbles are not played here: they have
// their own homes (V5 audio, the J2 emotion audit), so the prelude's frames are the
// movement's only, not the whole interaction's.

import { loadTileset, getCtx, getScale } from "../renderer";
import { drawBox } from "../menus";
import type { BattlePokemon } from "../battle";
import type { PikachuAnimScript } from "./pikachu_happiness";
import { selectPikachuEmotion, pikachuAnimScriptFor } from "./pikachu_happiness";
import type { PikachuFollower } from "./pikachu_follower";
import type { PikachuMovementProgramId } from "../rom/extractors/pikachu_movement";
import { getPikachuMovementData, pikachuMovementProgram } from "./pikachu_movement_data";

// --- Types ---

export type PikachuEmotionPhase = 'entry' | 'prelude' | 'border' | 'portrait';

interface PikachuEmotionAnim {
  /** wExpressionNumber */
  emotion: number;
  phase: PikachuEmotionPhase;
  /** The movement calls still to make. */
  calls: PikachuMovementProgramId[];
  /** Frames since the border was drawn. */
  borderFrames: number;
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

/**
 * The ordinary emotions that move Pikachu before the portrait (pikaemotion_movement in
 * data/pikachu/pikachu_emotions.asm), one entry per ApplyPikachuMovementData call. Each call
 * keeps its own return frame: emotion 7's two calls are not one program.
 */
export const EMOTION_MOVEMENTS: Readonly<Record<number, readonly PikachuMovementProgramId[]>> = {
  4: ['emotion_fd230'],                  // then cry 29, portrait 4
  6: ['emotion_fd21e'],                  // after a silent cry ($ff); then skull bubble, portrait 6
  7: ['emotion_fd224', 'emotion_fd224'], // cry 1 between them; then portrait 7
  9: ['emotion_fd218'],                  // after cry 6; then skull bubble, portrait 9
  13: ['emotion_fd21e'],                 // then portrait 13
};

/** PlacePikapicTextBoxBorder: Delay3, UpdateSprites, Delay3. */
const BORDER_UPDATE_FRAME = 3;
const BORDER_FRAMES = 6;

const ANIM_TICK_RATE = 3; // game frames per animation tick

// --- Module state ---

let emotionAnim: PikachuEmotionAnim | null = null;

// --- Public API ---

export function isPikachuEmotionActive(): boolean {
  return emotionAnim !== null;
}

export function isPikachuEmotionExpired(): boolean {
  if (!emotionAnim) return true;
  return emotionAnim.phase === 'portrait' && emotionAnim.totalTicks >= emotionAnim.script.duration;
}

/** The phase under way, or null when no emotion is up. */
export function pikachuEmotionPhase(): PikachuEmotionPhase | null {
  return emotionAnim?.phase ?? null;
}

/** The emotion number being shown. */
export function pikachuEmotionNumber(): number | null {
  return emotionAnim?.emotion ?? null;
}

/** What the phases before the portrait need from the game. */
export interface PikachuEmotionEntryDeps {
  follower: PikachuFollower;
  /** The player's world pixels (screen $40, $3c for the interpreter). */
  player: { x: number; y: number };
  /** Pikachu's GRASSPRIORITY as a call starts. */
  inGrass: () => boolean;
  /** TextBoxBorder at (6,5): register the box's tiles (main.ts captureUi). */
  captureBorder: () => void;
  /** The border's UpdateSprites, with the box up and the font loaded. */
  coveredUpdate: () => void;
}

/**
 * One game frame before the portrait. The first runs after the opening's bare-map turn;
 * a call that returns starts the next one in the same frame (no frame between the
 * emotion's commands); the border follows the last.
 */
export function tickPikachuEmotionEntry(deps: PikachuEmotionEntryDeps): void {
  const anim = emotionAnim;
  if (!anim) return;
  switch (anim.phase) {
    case 'entry':
      nextEmotionCall(anim, deps);
      return;
    case 'prelude':
      if (deps.follower.tickMovement()) nextEmotionCall(anim, deps);
      return;
    case 'border':
      anim.borderFrames++;
      if (anim.borderFrames === BORDER_UPDATE_FRAME) deps.coveredUpdate();
      if (anim.borderFrames === BORDER_FRAMES) anim.phase = 'portrait';
      return;
    case 'portrait':
      return;
  }
}

function nextEmotionCall(anim: PikachuEmotionAnim, deps: PikachuEmotionEntryDeps): void {
  const program = anim.calls.shift();
  if (program) {
    deps.follower.startMovement(getPikachuMovementData(), pikachuMovementProgram(program), deps.inGrass(), deps.player);
    anim.phase = 'prelude';
    return;
  }
  anim.phase = 'border';
  anim.borderFrames = 0;
  deps.captureBorder();
}

export function clearPikachuEmotion(): void {
  emotionAnim = null;
}

/** Start displaying Pikachu's emotion face with animation. */
export function startPikachuEmotion(party: BattlePokemon[]): void {
  const emotion = selectPikachuEmotion(party);
  const script = pikachuAnimScriptFor(emotion);

  const composited = document.createElement("canvas");
  composited.width = 40;
  composited.height = 40;

  emotionAnim = {
    emotion,
    phase: 'entry',
    calls: [...(EMOTION_MOVEMENTS[emotion] ?? [])],
    borderFrames: 0,
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

/** Advance the pikachu emotion animation by one game frame (the portrait phase only). */
export function updatePikachuEmotionAnim(): void {
  if (!emotionAnim || emotionAnim.phase !== 'portrait') return;
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
  const phase = emotionAnim?.phase;
  if (phase !== 'border' && phase !== 'portrait') return; // the map shows through the prelude
  const boxX = 6 * 8; // 48
  const boxY = 5 * 8; // 40
  drawBox(boxX, boxY, 56, 56);
  if (phase === 'portrait' && emotionAnim?.baseCanvas) {
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
