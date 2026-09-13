import {
  DEATH_BLANK_PAUSE_FRAMES,
  DEATH_FADE_FRAMES_PER_STEP,
  DEATH_FADE_STEPS,
  DEATH_FLASH_FRAMES,
  DEATH_GAME_OVER_TEXT_FRAMES,
  DEATH_GREY_PAUSE_FRAMES,
  DEATH_SPARK_BIG_FRAMES,
  DEATH_SPARK_SMALL_FRAMES,
  DEATH_SPIN_FRAMES_PER_DIR,
  DEATH_SPIN_ROTATIONS,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH
} from '../core/constants.js';
import { Direction } from '../core/types.js';

import { directionToSpriteCol } from '../render/sprite-renderer.js';

export const DeathPhase = Object.freeze({
  Flash: 0,
  Spin: 1,
  PaletteFade: 2,
  GreyPause: 3,
  Spark: 4,
  BlankPause: 5,
  GameOverText: 6,
  Done: 7
});

// Z_05.asm:2607 — Down($04)→Right($01)→Up($08)→Left($02)
const DEATH_SPIN_SEQUENCE = [
  Direction.Down,
  Direction.Right,
  Direction.Up,
  Direction.Left,
];

const FADE_ALPHAS = [0.25, 0.50, 0.75, 1.0];

export class DeathAnimation {
   _phase = DeathPhase.Flash;
   timer = 0;
   spinDirIndex = 0;
   spinRotationsLeft = DEATH_SPIN_ROTATIONS;
   fadeStep = 0;
    linkX;
    linkY;

  constructor(linkX, linkY) {
    this.linkX = linkX;
    this.linkY = linkY;
  }

  get phase() {
    return this._phase;
  }

  get isDone() {
    return this._phase === DeathPhase.Done;
  }

  get currentDirection() {
    return DEATH_SPIN_SEQUENCE[this.spinDirIndex] ?? Direction.Down;
  }

  update() {
    this.timer++;

    switch (this._phase) {
      case DeathPhase.Flash:
        if (this.timer >= DEATH_FLASH_FRAMES) {
          this.advancePhase();
        }
        break;

      case DeathPhase.Spin:
        this.updateSpin();
        break;

      case DeathPhase.PaletteFade:
        if (this.timer % DEATH_FADE_FRAMES_PER_STEP === 0) {
          this.fadeStep++;
        }
        if (this.fadeStep >= DEATH_FADE_STEPS) {
          this.advancePhase();
        }
        break;

      case DeathPhase.GreyPause:
        if (this.timer >= DEATH_GREY_PAUSE_FRAMES) {
          this.advancePhase();
        }
        break;

      case DeathPhase.Spark:
        if (this.timer >= DEATH_SPARK_SMALL_FRAMES + DEATH_SPARK_BIG_FRAMES) {
          this.advancePhase();
        }
        break;

      case DeathPhase.BlankPause:
        if (this.timer >= DEATH_BLANK_PAUSE_FRAMES) {
          this.advancePhase();
        }
        break;

      case DeathPhase.GameOverText:
        if (this.timer >= DEATH_GAME_OVER_TEXT_FRAMES) {
          this._phase = DeathPhase.Done;
        }
        break;

      case DeathPhase.Done:
        break;
    }
  }

   updateSpin() {
    if (this.timer % DEATH_SPIN_FRAMES_PER_DIR === 0) {
      this.spinDirIndex++;
      if (this.spinDirIndex >= DEATH_SPIN_SEQUENCE.length) {
        this.spinDirIndex = 0;
        this.spinRotationsLeft--;
        if (this.spinRotationsLeft <= 0) {
          this.advancePhase();
        }
      }
    }
  }

   advancePhase() {
    this.timer = 0;
    switch (this._phase) {
      case DeathPhase.Flash:
        this._phase = DeathPhase.Spin;
        this.spinDirIndex = 0;
        this.spinRotationsLeft = DEATH_SPIN_ROTATIONS;
        break;
      case DeathPhase.Spin:
        this._phase = DeathPhase.PaletteFade;
        this.fadeStep = 0;
        break;
      case DeathPhase.PaletteFade:
        this._phase = DeathPhase.GreyPause;
        break;
      case DeathPhase.GreyPause:
        this._phase = DeathPhase.Spark;
        break;
      case DeathPhase.Spark:
        this._phase = DeathPhase.BlankPause;
        break;
      case DeathPhase.BlankPause:
        this._phase = DeathPhase.GameOverText;
        break;
      default:
        break;
    }
  }

  render(
    renderer,
    linkSheet,
    tileRenderer,
    currentScreen,
    font,
  ) {
    switch (this._phase) {
      case DeathPhase.Flash:
        this.renderFlash(renderer, linkSheet, tileRenderer, currentScreen);
        break;
      case DeathPhase.Spin:
        this.renderSpin(renderer, linkSheet, tileRenderer, currentScreen);
        break;
      case DeathPhase.PaletteFade:
        this.renderFade(renderer, linkSheet, tileRenderer, currentScreen);
        break;
      case DeathPhase.GreyPause:
        this.renderGreyPause(renderer, linkSheet);
        break;
      case DeathPhase.Spark:
        this.renderSpark(renderer);
        break;
      case DeathPhase.BlankPause:
        renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, '#000');
        break;
      case DeathPhase.GameOverText:
        this.renderGameOverText(renderer, font);
        break;
      default:
        break;
    }
  }

  // Sub0-1: Link flashes with grayscale screen
   renderFlash(
    renderer,
    linkSheet,
    tileRenderer,
    currentScreen,
  ) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.filter = 'grayscale(1)';
    if (currentScreen) {
      tileRenderer.renderScreen(renderer, currentScreen);
    }
    ctx.restore();

    // Flash: toggle visibility every 2 frames
    if ((this.timer & 0x02) !== 0) {
      this.drawLink(renderer, linkSheet, this.currentDirection);
    }
  }

  // Sub7: Link spins on grayscale screen
   renderSpin(
    renderer,
    linkSheet,
    tileRenderer,
    currentScreen,
  ) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.filter = 'grayscale(1)';
    if (currentScreen) {
      tileRenderer.renderScreen(renderer, currentScreen);
    }
    ctx.restore();

    this.drawLink(renderer, linkSheet, this.currentDirection);
  }

  // Sub8: Screen fades to dark red
   renderFade(
    renderer,
    linkSheet,
    tileRenderer,
    currentScreen,
  ) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.filter = 'grayscale(1)';
    if (currentScreen) {
      tileRenderer.renderScreen(renderer, currentScreen);
    }
    ctx.restore();

    const alpha = FADE_ALPHAS[this.fadeStep] ?? 1.0;
    renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, `rgba(139,0,0,${alpha})`);

    this.drawLink(renderer, linkSheet, this.currentDirection);
  }

  // Sub9: Dark red screen with grey-tinted Link
   renderGreyPause(renderer, linkSheet) {
    renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, 'rgba(139,0,0,1)');

    const ctx = renderer.ctx;
    ctx.save();
    ctx.filter = 'grayscale(1) brightness(0.6)';
    this.drawLink(renderer, linkSheet, Direction.Down);
    ctx.restore();
  }

  // SubA: Death spark — small then big
   renderSpark(renderer) {
    renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, '#000');

    const ctx = renderer.ctx;
    const cx = this.linkX + 8;
    const cy = this.linkY + 8;
    const isSmall = this.timer < DEATH_SPARK_SMALL_FRAMES;
    const radius = isSmall ? 4 : 8;
    const color = isSmall ? '#FFF' : '#FF0';

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // SubB-C: "GAME OVER" text on black
   renderGameOverText(renderer, font) {
    renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, '#000');

    if (font) {
      const text = 'GAME OVER';
      const textWidth = text.length * 8;
      const x = (SCREEN_WIDTH - textWidth) / 2;
      font.drawString(renderer, x, 80, text);
    }
  }

   drawLink(renderer, linkSheet, direction) {
    const col = directionToSpriteCol(direction);
    const frameIndex = col; // row 0, walk frame 0
    linkSheet.drawFrame(renderer, frameIndex, this.linkX, this.linkY);
  }
}
