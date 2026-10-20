// Talking to Pikachu: DisplayPikachuEmotion → TalkToPikachu (engine/pikachu/pikachu_emotions.asm).
// Phases, in source order:
//   entry    — DisplayTextIDInit with no border: its UpdateSprites turns Pikachu to the
//              player on the bare map (overworld/ui_entry.ts);
//   prelude  — the emotion's pikaemotion_movement calls (ApplyPikachuMovementData, direct:
//              no guard, no refresh), the map still showing, nothing dismissable;
//   border   — PlacePikapicTextBoxBorder: the box, Delay3, UpdateSprites (Pikachu under the
//              box), Delay3;
//   portrait — the face animation (A or B, or its duration, closes it).
// Emotion 26 adds its ZZZ bubble before the border and SHOWMAPVIEW/Delay3/wake/close
// after the portrait. Cries and the other emotions' bubbles/exits remain J2.

import { loadTileset, getCtx, getScale } from "../renderer";
import { drawBox } from "../menus";
import type { BattlePokemon } from "../battle";
import type { PikachuAnimScript } from "./pikachu_happiness";
import { selectPikachuEmotion, pikachuAnimScriptFor } from "./pikachu_happiness";
import type { PikachuFollower } from "./pikachu_follower";
import type { PikachuMovementProgramId } from "../rom/extractors/pikachu_movement";
import { getPikachuMovementData, pikachuMovementProgram } from "./pikachu_movement_data";
import type { Direction } from '../core';
import { EmotionBubble } from '../overworld/emotion_bubble';
import { CloseSequence } from '../text/close_sequence';
import { setSpriteIndex } from '../overworld/sprite_index';
import { enablePikachuFollowing } from './pikachu_following';

// --- Types ---

export type PikachuEmotionPhase = 'entry' | 'bubble' | 'prelude' | 'border' | 'portrait' | 'mapview' | 'closing';

interface PikachuEmotionAnim {
  /** wExpressionNumber */
  emotion: number;
  savedFacing: Direction | null;
  exitFrames: number;
  close: CloseSequence | null;
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
const sleepBubble = new EmotionBubble<PikachuFollower>();

/** EmotionBubble owns the sprite while updates are disabled, including its trailing update. */
export function pikachuEmotionBubble(): PikachuFollower | null { return sleepBubble.showing; }

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
      if (anim.emotion === 26) {
        sleepBubble.start(deps.follower);
        anim.phase = 'bubble';
        return;
      }
      nextEmotionCall(anim, deps);
      return;
    case 'bubble':
      if (sleepBubble.tick()) nextEmotionCall(anim, deps);
      // wUpdateSpritesEnabled=$ff suppresses EmotionBubble's trailing UpdateSprites too.
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
  if (emotionAnim) setSpriteIndex(0); // IsPlayerTalkingToPikachu, after DisplayTextID returns
  sleepBubble.clear();
  emotionAnim = null;
}

export interface PikachuEmotionExitDeps {
  follower: PikachuFollower;
  playerFacing: Direction;
  showMapView(): void;
  fontLoadedUpdate(): void;
  closeFrames(): number;
  updateSprites(): void;
}

/** SHOWMAPVIEW: redraw before the still-asleep font-loaded update, then Delay3. */
export function beginPikachuEmotionExit(deps: PikachuEmotionExitDeps): void {
  if (!emotionAnim) return;
  emotionAnim.phase = 'mapview';
  emotionAnim.exitFrames = 0;
  deps.showMapView();
  deps.fontLoadedUpdate();
}

/** CHECKPEWTERCENTER, then CloseTextDisplay's DelayFrame/facing restore/map reload. */
export function tickPikachuEmotionExit(deps: PikachuEmotionExitDeps): boolean {
  const anim = emotionAnim;
  if (!anim) return true;
  if (anim.phase === 'mapview') {
    if (++anim.exitFrames < 3) return false;
    enablePikachuFollowing();
    const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    deps.follower.setLiveFacing(opposite[deps.playerFacing]);
    anim.phase = 'closing';
    anim.close = new CloseSequence(deps.closeFrames(), deps.updateSprites);
    return false;
  }
  if (anim.phase !== 'closing' || !anim.close) return false;
  if (anim.close.firstFrame && anim.savedFacing) deps.follower.setLiveFacing(anim.savedFacing);
  anim.close.advance();
  return anim.close.complete;
}

/** Start displaying Pikachu's emotion face with animation. */
export function startPikachuEmotion(party: BattlePokemon[], mapName?: string, savedFacing: Direction | null = null): void {
  setSpriteIndex(0xd4); // InitializePikachuTextID: TEXT_PIKACHU_ANIM
  const emotion = selectPikachuEmotion(party, mapName);
  const script = pikachuAnimScriptFor(emotion);

  const composited = document.createElement("canvas");
  composited.width = 40;
  composited.height = 40;

  emotionAnim = {
    emotion,
    savedFacing,
    exitFrames: 0,
    close: null,
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
