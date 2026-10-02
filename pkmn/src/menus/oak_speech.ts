// Oak Speech intro sequence — plays when starting a new game
// Assembly ref: engine/movie/oak_speech/oak_speech.asm, oak_speech2.asm
// Shows Oak, Pikachu, asks player/rival names, shrink animation

import { GB_WIDTH, TILE_SIZE } from '../core';
import { setPlayerName, setRivalName, substituteNames } from '../core/player_state';
import { getText } from '../text';
import {
  loadTileset, getCtx, getScale, drawFadeOverlay,
  setActivePalette, clear, fillRect,
} from '../renderer';
import { isPressed } from '../input';
import { TextBox, reloadBorderTiles } from '../text';
import { drawText, drawChar, drawBox } from './menu_render';

// Portrait positions (from assembly hlcoord coordinates)
const PIC_CENTER_X = 48;  // tile 6 × 8
const PIC_CENTER_Y = 32;  // tile 4 × 8
const PIC_RIGHT_X = 96;   // shifted right when name menu is open

const PIKA_CENTER_X = 60;  // centered: (160-40)/2
const PIKA_CENTER_Y = 36;  // vertically centered in upper area

// Animation timings
const FADEIN_FRAMES = 60;  // total frames for portrait fade-in (~1 sec)
const FADEOUT_FRAMES = 8;  // frames for fade to white
const SLIDE_SPEED = 8;     // pixels per frame for slide animation
const SHRINK_DELAY = 4;    // frames per shrink stage
const POST_SHRINK_WAIT = 0; // no delay — go straight to fade-out

// Name menu layout (from assembly DisplayIntroNameTextBox)
// TextBoxBorder at (0,0), inner bc = 10, 9 → total 11×12 tiles
const MENU_X = 0;
const MENU_Y = 0;
const MENU_W = 11; // tiles
const MENU_H = 12; // tiles
const MENU_TITLE_X = 3;  // tile col for "NAME" title
const MENU_ITEM_X = 2;   // tile col for menu items
const MENU_ITEM_Y = 2;   // starting tile row for items
const MENU_ITEM_SPACING = 2; // tile rows between items
const MENU_CURSOR_X = 1; // tile col for cursor

// Preset names (from constants/player_constants.asm)
const PLAYER_NAMES = ['NEW NAME', 'YELLOW', 'ASH', 'JACK'];
const RIVAL_NAMES = ['NEW NAME', 'BLUE', 'GARY', 'JOHN'];

// Text strings (from data/text/text_3.asm)
function textOak1(): string { return getText('OAK_SPEECH_1'); }
function textPikachu(): string { return getText('OAK_SPEECH_PIKACHU'); }
function textPlayerAsk(): string { return getText('OAK_SPEECH_PLAYER_ASK'); }
function textRivalAsk(): string { return getText('OAK_SPEECH_RIVAL_ASK'); }

function textPlayerConfirm(): string {
  return substituteNames(getText('OAK_SPEECH_PLAYER_CONFIRM'));
}

function textRivalConfirm(): string {
  return substituteNames(getText('OAK_SPEECH_RIVAL_CONFIRM'));
}

function textFinal(): string {
  return substituteNames(getText('OAK_SPEECH_FINAL'));
}

type Phase =
  // Oak portrait
  | 'oak_fadein' | 'oak_text' | 'fadeout1'
  // Pikachu
  | 'pikachu_slide' | 'pikachu_text' | 'fadeout2'
  // Player naming
  | 'red_slide' | 'player_ask' | 'player_menu'
  | 'player_slide_back' | 'player_confirm'
  // Rival naming
  | 'fadeout3' | 'rival_fadein' | 'rival_ask' | 'rival_menu'
  | 'rival_slide_back' | 'rival_confirm'
  // Final
  | 'fadeout4' | 'final_fadein' | 'final_text'
  | 'shrink' | 'post_shrink' | 'final_fadeout'
  | 'done';

export type OakSpeechAction =
  | null
  | { type: 'openNamingScreen'; target: 'player' | 'rival' }
  | { type: 'done' };

export class OakSpeech {
  // Loaded portrait canvases
  private oakPic: HTMLCanvasElement | null = null;
  private pikachuPic: HTMLCanvasElement | null = null;
  private redPic: HTMLCanvasElement | null = null;
  private rivalPic: HTMLCanvasElement | null = null;
  private shrink1Pic: HTMLCanvasElement | null = null;
  private shrink2Pic: HTMLCanvasElement | null = null;

  // Phase state
  private phase: Phase = 'oak_fadein';
  private frame = 0;
  private textBox = new TextBox();

  // Fade overlay
  private fadeAlpha = 1;

  // Portrait display
  private currentPic: HTMLCanvasElement | null = null;
  private picX = PIC_CENTER_X;
  private picY = PIC_CENTER_Y;
  private picFlipX = false;

  // Slide animation
  private slideX = 0;
  private slideTarget = 0;

  // Name menu
  private menuVisible = false;
  private menuCursor = 0;
  private menuItems: string[] = [];
  private namingTarget: 'player' | 'rival' = 'player';

  // Shrink stage
  private shrinkStage = 0;

  async load(): Promise<void> {
    setActivePalette('MEWMON');
    await reloadBorderTiles();
    const [oak, pikachu, red, rival, s1, s2] = await Promise.all([
      loadTileset('/gfx/trainers/prof.oak.png'),
      loadTileset('/gfx/sprites/front/25.png'),
      loadTileset('/gfx/player/red.png'),
      loadTileset('/gfx/trainers/rival1.png'),
      loadTileset('/gfx/player/shrink1.png'),
      loadTileset('/gfx/player/shrink2.png'),
    ]);
    this.oakPic = oak;
    this.pikachuPic = pikachu;
    this.redPic = red;
    this.rivalPic = rival;
    this.shrink1Pic = s1;
    this.shrink2Pic = s2;
  }

  start(): void {
    this.phase = 'oak_fadein';
    this.frame = 0;
    this.fadeAlpha = 1;
    this.menuVisible = false;
    this.textBox = new TextBox();

    // Show Oak portrait centered
    this.currentPic = this.oakPic;
    this.picX = PIC_CENTER_X;
    this.picY = PIC_CENTER_Y;
    this.picFlipX = false;
  }

  /** Called by main.ts after naming screen returns with the chosen name. */
  continueAfterNaming(name: string): void {
    this.menuVisible = false;
    if (this.namingTarget === 'player') {
      setPlayerName(name);
      this.currentPic = this.redPic;
      this.picX = PIC_CENTER_X;
      this.picY = PIC_CENTER_Y;
      this.picFlipX = false;
      this.textBox.show(textPlayerConfirm());
      this.phase = 'player_confirm';
    } else {
      setRivalName(name);
      this.currentPic = this.rivalPic;
      this.picX = PIC_CENTER_X;
      this.picY = PIC_CENTER_Y;
      this.picFlipX = false;
      this.textBox.show(textRivalConfirm());
      this.phase = 'rival_confirm';
    }
    this.frame = 0;
  }

  update(): OakSpeechAction {
    this.frame++;

    switch (this.phase) {
      // ── Oak portrait fade-in ──
      case 'oak_fadein': {
        this.fadeAlpha = Math.max(0, 1 - this.frame / FADEIN_FRAMES);
        if (this.frame >= FADEIN_FRAMES) {
          this.fadeAlpha = 0;
          this.textBox.show(textOak1());
          this.setPhase('oak_text');
        }
        break;
      }

      case 'oak_text': {
        this.textBox.update();
        if (!this.textBox.active) {
          this.startFadeOut('fadeout1');
        }
        break;
      }

      case 'fadeout1': {
        if (this.updateFadeOut()) {
          // Set up Pikachu slide
          this.currentPic = this.pikachuPic;
          this.picFlipX = true;
          this.picY = PIKA_CENTER_Y;
          this.slideX = GB_WIDTH;
          this.picX = GB_WIDTH;
          this.slideTarget = PIKA_CENTER_X;
          this.fadeAlpha = 0;
          this.setPhase('pikachu_slide');
        }
        break;
      }

      // ── Pikachu slide-in ──
      case 'pikachu_slide': {
        this.slideX -= SLIDE_SPEED;
        if (this.slideX <= this.slideTarget) {
          this.slideX = this.slideTarget;
          this.picX = this.slideTarget;
          this.textBox.show(textPikachu());
          this.setPhase('pikachu_text');
        } else {
          this.picX = this.slideX;
        }
        break;
      }

      case 'pikachu_text': {
        this.textBox.update();
        if (!this.textBox.active) {
          this.startFadeOut('fadeout2');
        }
        break;
      }

      case 'fadeout2': {
        if (this.updateFadeOut()) {
          // Set up Red slide
          this.currentPic = this.redPic;
          this.picFlipX = false;
          this.picY = PIC_CENTER_Y;
          this.slideX = GB_WIDTH;
          this.picX = GB_WIDTH;
          this.slideTarget = PIC_CENTER_X;
          this.fadeAlpha = 0;
          this.setPhase('red_slide');
        }
        break;
      }

      // ── Player naming sequence ──
      case 'red_slide': {
        this.slideX -= SLIDE_SPEED;
        if (this.slideX <= this.slideTarget) {
          this.slideX = this.slideTarget;
          this.picX = this.slideTarget;
          this.textBox.show(textPlayerAsk());
          this.setPhase('player_ask');
        } else {
          this.picX = this.slideX;
        }
        break;
      }

      case 'player_ask': {
        // Keep textbox visible when transitioning to menu
        // (assembly: PrintText stays on VRAM, then ChoosePlayerName overlays the menu)
        if (this.textBox.isWaitingForInput && !this.textBox.hasMorePages) {
          if (isPressed('a') || isPressed('b')) {
            this.openNameMenu('player');
            this.setPhase('player_menu');
          }
        } else {
          this.textBox.update();
        }
        break;
      }

      case 'player_menu': {
        const result = this.updateNameMenu();
        if (result === 'custom') {
          this.namingTarget = 'player';
          return { type: 'openNamingScreen', target: 'player' };
        }
        if (result === 'preset') {
          const name = this.menuItems[this.menuCursor];
          setPlayerName(name);
          // Slide portrait back to center
          this.slideX = PIC_RIGHT_X;
          this.slideTarget = PIC_CENTER_X;
          this.menuVisible = false;
          this.textBox.dismiss();
          this.setPhase('player_slide_back');
        }
        break;
      }

      case 'player_slide_back': {
        this.slideX -= SLIDE_SPEED;
        if (this.slideX <= this.slideTarget) {
          this.picX = this.slideTarget;
          this.textBox.show(textPlayerConfirm());
          this.setPhase('player_confirm');
        } else {
          this.picX = this.slideX;
        }
        break;
      }

      case 'player_confirm': {
        this.textBox.update();
        if (!this.textBox.active) {
          this.startFadeOut('fadeout3');
        }
        break;
      }

      // ── Rival naming sequence ──
      case 'fadeout3': {
        if (this.updateFadeOut()) {
          this.currentPic = this.rivalPic;
          this.picX = PIC_CENTER_X;
          this.picY = PIC_CENTER_Y;
          this.picFlipX = false;
          this.fadeAlpha = 1;
          this.setPhase('rival_fadein');
        }
        break;
      }

      case 'rival_fadein': {
        this.fadeAlpha = Math.max(0, 1 - this.frame / FADEIN_FRAMES);
        if (this.frame >= FADEIN_FRAMES) {
          this.fadeAlpha = 0;
          this.textBox.show(textRivalAsk());
          this.setPhase('rival_ask');
        }
        break;
      }

      case 'rival_ask': {
        // Keep textbox visible when transitioning to menu
        if (this.textBox.isWaitingForInput && !this.textBox.hasMorePages) {
          if (isPressed('a') || isPressed('b')) {
            this.openNameMenu('rival');
            this.setPhase('rival_menu');
          }
        } else {
          this.textBox.update();
        }
        break;
      }

      case 'rival_menu': {
        const result = this.updateNameMenu();
        if (result === 'custom') {
          this.namingTarget = 'rival';
          return { type: 'openNamingScreen', target: 'rival' };
        }
        if (result === 'preset') {
          const name = this.menuItems[this.menuCursor];
          setRivalName(name);
          this.slideX = PIC_RIGHT_X;
          this.slideTarget = PIC_CENTER_X;
          this.menuVisible = false;
          this.textBox.dismiss();
          this.setPhase('rival_slide_back');
        }
        break;
      }

      case 'rival_slide_back': {
        this.slideX -= SLIDE_SPEED;
        if (this.slideX <= this.slideTarget) {
          this.picX = this.slideTarget;
          this.textBox.show(textRivalConfirm());
          this.setPhase('rival_confirm');
        } else {
          this.picX = this.slideX;
        }
        break;
      }

      case 'rival_confirm': {
        this.textBox.update();
        if (!this.textBox.active) {
          this.startFadeOut('fadeout4');
        }
        break;
      }

      // ── Final sequence ──
      case 'fadeout4': {
        if (this.updateFadeOut()) {
          this.currentPic = this.redPic;
          this.picX = PIC_CENTER_X;
          this.picY = PIC_CENTER_Y;
          this.picFlipX = false;
          this.fadeAlpha = 1;
          this.setPhase('final_fadein');
        }
        break;
      }

      case 'final_fadein': {
        this.fadeAlpha = Math.max(0, 1 - this.frame / FADEIN_FRAMES);
        if (this.frame >= FADEIN_FRAMES) {
          this.fadeAlpha = 0;
          this.textBox.show(textFinal());
          this.setPhase('final_text');
        }
        break;
      }

      case 'final_text': {
        this.textBox.update();
        if (!this.textBox.active) {
          this.shrinkStage = 0;
          this.setPhase('shrink');
        }
        break;
      }

      case 'shrink': {
        // 3 stages: red.png → shrink1 → shrink2, each for SHRINK_DELAY frames
        if (this.frame >= SHRINK_DELAY) {
          this.shrinkStage++;
          this.frame = 0;
          if (this.shrinkStage === 1) {
            this.currentPic = this.shrink1Pic;
          } else if (this.shrinkStage === 2) {
            this.currentPic = this.shrink2Pic;
          } else {
            this.currentPic = null;
            this.phase = 'done';
            return { type: 'done' };
          }
        }
        break;
      }

      case 'post_shrink': {
        if (this.frame >= POST_SHRINK_WAIT) {
          this.startFadeOut('final_fadeout');
        }
        break;
      }

      case 'final_fadeout': {
        if (this.updateFadeOut()) {
          this.phase = 'done';
          return { type: 'done' };
        }
        break;
      }

      case 'done':
        return { type: 'done' };
    }

    return null;
  }

  render(): void {
    // Clear screen to lightest palette color
    clear();

    // Draw current portrait
    if (this.currentPic) {
      this.drawPic(this.currentPic, this.picX, this.picY, this.picFlipX);
    }

    // Draw name menu if visible
    if (this.menuVisible) {
      this.renderNameMenu();
    }

    // Draw textbox if active
    this.textBox.render();

    // Fade overlay
    if (this.fadeAlpha > 0) {
      drawFadeOverlay(this.fadeAlpha);
    }
  }

  // ── Helpers ──

  private setPhase(p: Phase): void {
    this.phase = p;
    this.frame = 0;
  }

  private startFadeOut(nextPhase: Phase): void {
    this.fadeAlpha = 0;
    this.setPhase(nextPhase);
  }

  /** Advance fade-out. Returns true when fully faded. */
  private updateFadeOut(): boolean {
    this.fadeAlpha = Math.min(1, this.frame / FADEOUT_FRAMES);
    return this.frame >= FADEOUT_FRAMES;
  }

  /** Draw a portrait canvas at a pixel position. */
  private drawPic(
    pic: HTMLCanvasElement,
    x: number, y: number,
    flipX = false,
  ): void {
    const ctx = getCtx();
    const s = getScale();
    const w = pic.width;
    const h = pic.height;

    if (flipX) {
      ctx.save();
      ctx.translate((x + w) * s, y * s);
      ctx.scale(-1, 1);
      ctx.drawImage(pic, 0, 0, w, h, 0, 0, w * s, h * s);
      ctx.restore();
    } else {
      ctx.drawImage(pic, 0, 0, w, h, x * s, y * s, w * s, h * s);
    }
  }

  // ── Name menu ──

  private openNameMenu(target: 'player' | 'rival'): void {
    this.namingTarget = target;
    this.menuItems = target === 'player' ? PLAYER_NAMES : RIVAL_NAMES;
    this.menuCursor = 0;
    this.menuVisible = true;
    // Move portrait to the right (Y stays the same — assembly slides horizontally only)
    this.picX = PIC_RIGHT_X;
    this.picY = PIC_CENTER_Y;
  }

  /** Returns 'custom' (NEW NAME), 'preset' (named selected), or null (still browsing). */
  private updateNameMenu(): 'custom' | 'preset' | null {
    if (isPressed('up')) {
      this.menuCursor = (this.menuCursor - 1 + this.menuItems.length) % this.menuItems.length;
    } else if (isPressed('down')) {
      this.menuCursor = (this.menuCursor + 1) % this.menuItems.length;
    }

    if (isPressed('a')) {
      if (this.menuCursor === 0) return 'custom';
      return 'preset';
    }

    return null;
  }

  private renderNameMenu(): void {
    const T = TILE_SIZE;

    // Draw bordered box
    drawBox(MENU_X, MENU_Y, MENU_W * T, MENU_H * T);

    // Title "NAME" on top border — white background to clear border tiles beneath
    // Assembly: PlaceString at hlcoord 3, 0 overwrites border tiles in VRAM
    fillRect(MENU_TITLE_X * T, MENU_Y, 4 * T, T, 0);
    drawText('NAME', MENU_TITLE_X * T, MENU_Y);

    // Menu items
    for (let i = 0; i < this.menuItems.length; i++) {
      const row = MENU_ITEM_Y + i * MENU_ITEM_SPACING;
      drawText(this.menuItems[i], MENU_ITEM_X * T, row * T);
    }

    // Cursor
    const cursorRow = MENU_ITEM_Y + this.menuCursor * MENU_ITEM_SPACING;
    drawChar('\u25B6', MENU_CURSOR_X * T, cursorRow * T);
  }
}
