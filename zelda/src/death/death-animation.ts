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
  SCREEN_WIDTH,
} from '../core/constants.js';
import { Direction } from '../core/types.js';
import type { Renderer } from '../render/renderer.js';
import { type SpriteSheet, directionToSpriteCol } from '../render/sprite-renderer.js';
import type { TileRenderer } from '../render/tile-renderer.js';
import type { OverworldScreen } from '../data/overworld-types.js';
import type { BitmapFont } from '../ui/bitmap-font.js';

export enum DeathPhase {
  Flash,
  Spin,
  PaletteFade,
  GreyPause,
  Spark,
  BlankPause,
  GameOverText,
  Done,
}

// Z_05.asm:2607 — Down($04)→Right($01)→Up($08)→Left($02)
const DEATH_SPIN_SEQUENCE: readonly Direction[] = [
  Direction.Down,
  Direction.Right,
  Direction.Up,
  Direction.Left,
];

const FADE_ALPHAS = [0.25, 0.50, 0.75, 1.0] as const;

export class DeathAnimation {
  private _phase = DeathPhase.Flash;
  private timer = 0;
  private spinDirIndex = 0;
  private spinRotationsLeft = DEATH_SPIN_ROTATIONS;
  private fadeStep = 0;
  private readonly linkX: number;
  private readonly linkY: number;

  constructor(linkX: number, linkY: number) {
    this.linkX = linkX;
    this.linkY = linkY;
  }

  get phase(): DeathPhase {
    return this._phase;
  }

  get isDone(): boolean {
    return this._phase === DeathPhase.Done;
  }

  get currentDirection(): Direction {
    return DEATH_SPIN_SEQUENCE[this.spinDirIndex] ?? Direction.Down;
  }

  update(): void {
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

  private updateSpin(): void {
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

  private advancePhase(): void {
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
    renderer: Renderer,
    linkSheet: SpriteSheet,
    tileRenderer: TileRenderer,
    currentScreen: OverworldScreen | null,
    font: BitmapFont | null,
  ): void {
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
  private renderFlash(
    renderer: Renderer,
    linkSheet: SpriteSheet,
    tileRenderer: TileRenderer,
    currentScreen: OverworldScreen | null,
  ): void {
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
  private renderSpin(
    renderer: Renderer,
    linkSheet: SpriteSheet,
    tileRenderer: TileRenderer,
    currentScreen: OverworldScreen | null,
  ): void {
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
  private renderFade(
    renderer: Renderer,
    linkSheet: SpriteSheet,
    tileRenderer: TileRenderer,
    currentScreen: OverworldScreen | null,
  ): void {
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
  private renderGreyPause(renderer: Renderer, linkSheet: SpriteSheet): void {
    renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, 'rgba(139,0,0,1)');

    const ctx = renderer.ctx;
    ctx.save();
    ctx.filter = 'grayscale(1) brightness(0.6)';
    this.drawLink(renderer, linkSheet, Direction.Down);
    ctx.restore();
  }

  // SubA: Death spark — small then big
  private renderSpark(renderer: Renderer): void {
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
  private renderGameOverText(renderer: Renderer, font: BitmapFont | null): void {
    renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, '#000');

    if (font) {
      const text = 'GAME OVER';
      const textWidth = text.length * 8;
      const x = (SCREEN_WIDTH - textWidth) / 2;
      font.drawString(renderer, x, 80, text);
    }
  }

  private drawLink(renderer: Renderer, linkSheet: SpriteSheet, direction: Direction): void {
    const col = directionToSpriteCol(direction);
    const frameIndex = col; // row 0, walk frame 0
    linkSheet.drawFrame(renderer, frameIndex, this.linkX, this.linkY);
  }
}
