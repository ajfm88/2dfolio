// Title screen + backstory scroll (NES Mode 0 "demo"; Z_02.asm UpdateMode0Demo).
//
// Two sub-phases: the static title art (waiting for Start), and — after an idle
// period with no input — the vertically-scrolling backstory, matching the NES
// attract sequence. We deliberately do NOT reproduce the scripted gameplay demo
// (a large, low-value effort); any button during the scroll returns to the title.
//
// Note: "PUSH START BUTTON" is baked into title.png (as on the NES, where it is
// static, not blinking), so no separate text is drawn in the Title phase.
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../core/constants.js';
import { Action, type InputManager } from '../core/input.js';
import type { Renderer } from '../render/renderer.js';
import type { BitmapFont } from './bitmap-font.js';

export enum TitlePhase {
  Title,
  StoryScroll,
}

// Frames of no input on the title before the backstory scroll begins.
// 30s @ 60fps — long enough to sit on the art (user, 2026-09-06).
export const TITLE_IDLE_FRAMES = 30 * 60;
// Vertical scroll speed. NES increments CurVScroll every odd frame (Z_02.asm:555),
// i.e. ~0.5 px/frame.
const SCROLL_SPEED = 0.5;
const LINE_HEIGHT = 16;
const CREST_MARGIN = 24;

// Canonical NES backstory text (Z_02.asm stores it as nametable tile data, not
// ASCII, so it is transcribed here). The BitmapFont is uppercase-only and maps
// apostrophes; commas/quotes are avoided to stay within the glyph set.
const STORY_LINES: readonly string[] = [
  'MANY YEARS AGO PRINCE',
  "DARKNESS 'GANNON' STOLE",
  'ONE OF THE TRIFORCE WITH',
  'POWER. PRINCESS ZELDA HAD',
  'ONE OF THE TRIFORCE WITH',
  'WISDOM. SHE DIVIDED IT',
  "INTO '8' UNITS TO HIDE",
  "IT FROM 'GANNON' BEFORE",
  'SHE WAS CAPTURED. GO',
  "FIND THE '8' UNITS 'LINK'",
  'TO SAVE HER.',
];

const CHAR_ADVANCE = 8;

// Title waterfall — Z_02.asm UpdateWaterfallAnimation. Sprites from
// zelda-clone Waterfall.png (3×16px strips) + WaterfallSpray.png (2×16px).
const WATERFALL_X = 0x50; // $50..$68, 32px wide
const WATERFALL_FRAME_W = 32;
const WATERFALL_FRAME_H = 16;
const CREST_Y = 0xa8; // NES TitleWave crest — leave transparent, do not fill behind it
const WAVE_Y_MIN = 0xb2;
const WAVE_Y_MAX = 0xe3;
const WAVE_START_YS = [0xb6, 0xc8, 0xd8] as const;
// Spray-sheet cyan (176,252,204). Fill only the cliff notch under the crest.
const WATERFALL_CHANNEL = '#b0fccc';
const CHANNEL_TOP = CREST_Y + WATERFALL_FRAME_H; // 184 — first 32px-wide notch row

const ALL_ACTIONS: readonly Action[] = [
  Action.Up, Action.Down, Action.Left, Action.Right,
  Action.Attack, Action.Item, Action.Start, Action.Select,
];

function anyJustPressed(input: InputManager): boolean {
  return ALL_ACTIONS.some(a => input.isJustPressed(a));
}

export class TitleScreen {
  private _phase = TitlePhase.Title;
  private idleTimer = 0;
  private scrollY = 0;
  private _goToFileSelect = false;
  private _frameCounter = 0;
  private readonly _waveYs: number[] = [...WAVE_START_YS];

  get phase(): TitlePhase {
    return this._phase;
  }

  /** True once Start was pressed on the title — main.ts consumes this and resets. */
  get shouldGoToFileSelect(): boolean {
    return this._goToFileSelect;
  }

  get scrollOffset(): number {
    return this.scrollY;
  }

  /** Debug/tests: current Y of the three cascading waves. */
  get waterfallWaveYs(): readonly number[] {
    return this._waveYs;
  }

  reset(): void {
    this._phase = TitlePhase.Title;
    this.idleTimer = 0;
    this.scrollY = 0;
    this._goToFileSelect = false;
    this._frameCounter = 0;
    this._waveYs[0] = WAVE_START_YS[0];
    this._waveYs[1] = WAVE_START_YS[1];
    this._waveYs[2] = WAVE_START_YS[2];
  }

  update(input: InputManager): void {
    if (this._phase === TitlePhase.Title) {
      if (input.isJustPressed(Action.Start)) {
        this._goToFileSelect = true;
        return;
      }
      if (anyJustPressed(input)) {
        this.idleTimer = 0;
      } else {
        this.idleTimer++;
        if (this.idleTimer >= TITLE_IDLE_FRAMES) {
          this._phase = TitlePhase.StoryScroll;
          this.scrollY = 0;
        }
      }
      this.tickWaterfall();
      return;
    }

    // StoryScroll — any button skips back to the title.
    if (anyJustPressed(input)) {
      this._phase = TitlePhase.Title;
      this.idleTimer = 0;
      return;
    }
    this.scrollY += SCROLL_SPEED;
    if (this.scrollY >= this.storyTotalHeight()) {
      this._phase = TitlePhase.Title;
      this.idleTimer = 0;
    }
  }

  private tickWaterfall(): void {
    this._frameCounter++;
    for (let i = 0; i < this._waveYs.length; i++) {
      let y = (this._waveYs[i] ?? WAVE_START_YS[0]) + 2;
      if (y >= WAVE_Y_MAX) y = WAVE_Y_MIN;
      this._waveYs[i] = y;
    }
  }

  private waveFrame(y: number): number {
    if (y < 0xb9) return 0;
    if (y < 0xc2) return 1;
    return 2;
  }

  /** Total scroll distance until the whole block has passed off the top. */
  private storyTotalHeight(): number {
    return SCREEN_HEIGHT + STORY_LINES.length * LINE_HEIGHT + CREST_MARGIN + 32;
  }

  render(
    renderer: Renderer,
    titleImage: HTMLImageElement | HTMLCanvasElement,
    font: BitmapFont,
    crestImage?: HTMLImageElement | HTMLCanvasElement,
    waterfallImage?: HTMLImageElement | HTMLCanvasElement,
    waterfallSprayImage?: HTMLImageElement | HTMLCanvasElement,
  ): void {
    const ctx = renderer.ctx;
    if (this._phase === TitlePhase.Title) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      renderer.drawImage(
        titleImage,
        0, 0, titleImage.width, titleImage.height,
        0, 0, SCREEN_WIDTH, SCREEN_HEIGHT,
      );
      this.drawWaterfall(renderer, waterfallImage, waterfallSprayImage);
      return;
    }

    // StoryScroll: black field, crest above the text block, text scrolling up.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const firstLineY = SCREEN_HEIGHT - Math.round(this.scrollY);

    if (crestImage) {
      const cx = Math.round((SCREEN_WIDTH - crestImage.width) / 2);
      const cy = firstLineY - CREST_MARGIN - crestImage.height;
      renderer.drawImage(
        crestImage,
        0, 0, crestImage.width, crestImage.height,
        cx, cy, crestImage.width, crestImage.height,
      );
    }

    for (let i = 0; i < STORY_LINES.length; i++) {
      const line = STORY_LINES[i]!;
      const y = firstLineY + i * LINE_HEIGHT;
      if (y < -LINE_HEIGHT || y > SCREEN_HEIGHT) continue; // cull off-screen lines
      const x = Math.round((SCREEN_WIDTH - line.length * CHAR_ADVANCE) / 2);
      font.drawString(renderer, x, y, line);
    }
  }

  private drawWaterfall(
    renderer: Renderer,
    waterfallImage?: HTMLImageElement | HTMLCanvasElement,
    sprayImage?: HTMLImageElement | HTMLCanvasElement,
  ): void {
    // Mint column in the cliff notch only — not behind the crest, which stays
    // the original transparent spray on the title art.
    renderer.fillRect(
      WATERFALL_X,
      CHANNEL_TOP,
      WATERFALL_FRAME_W,
      SCREEN_HEIGHT - CHANNEL_TOP,
      WATERFALL_CHANNEL,
    );
    if (waterfallImage) {
      for (const y of this._waveYs) {
        const frame = this.waveFrame(y);
        renderer.drawImage(
          waterfallImage,
          0, frame * WATERFALL_FRAME_H, WATERFALL_FRAME_W, WATERFALL_FRAME_H,
          WATERFALL_X, y, WATERFALL_FRAME_W, WATERFALL_FRAME_H,
        );
      }
    }
    if (sprayImage) {
      // Z_02.asm:1159 FrameCounter AND #$08 — swap crest every 8 frames.
      const frame = (this._frameCounter & 0x08) === 0 ? 0 : 1;
      renderer.drawImage(
        sprayImage,
        0, frame * WATERFALL_FRAME_H, WATERFALL_FRAME_W, WATERFALL_FRAME_H,
        WATERFALL_X, CREST_Y, WATERFALL_FRAME_W, WATERFALL_FRAME_H,
      );
    }
  }
}
