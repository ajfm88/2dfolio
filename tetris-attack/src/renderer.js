const Constants = {
  TILE_SIZE: 48
};
const TS = Constants.TILE_SIZE;

import { SpriteRenderer } from "./spriteRenderer.js"
import { TrashRenderer } from "./trashRenderer.js"
import { stageLayout } from "./stages.js"
import { keyedSheet } from "./spriteSheet.js"
import { vsSpriteUrl, preloadVsSprites } from "./characters.js"
import { PixelFont, ProportionalFont, CHAR_H, THIN_CAP_H } from "./font.js"
import { recordScore } from "./highScore.js"
import { VS_STRIP_SLOTS, VS_LAMP_SLOTS } from "./vsFrames.js"
import { drawWinPoints } from "./winPoints.js"

//TODO remove
import { TrashBlock } from "./trashBlock.js"

// The HUD readouts, drawn in the SNES HUD font into the stage art's own two
// empty boxes: TIME upper-left, SCORE down the right, as the original lays them
// out. Coordinates are native (unscaled) panel pixels; the overlays are
// stretched up by CSS.
//
// Each readout is a caption with its value right-aligned underneath, in the
// SNES's own pairing of two faces: the narrow font for the caption, the chunky
// one for the value (see font.js). The narrow face is what lets the captions
// read in full -- "HI-SCORE" is 38px and "SPEED LV." 41px, against the 44px the
// 48px-wide box leaves past its left pad, where the chunky font fits 5
// characters (64px and 72px respectively, so both had to be abbreviated).
//
// Vertically a row is the caption's 11 cap-rows, a 2px gap, then the value's 6,
// which is 19 of the 24px row. Four rows start at y=2 and the last value ends at
// 92, inside the right box's 104; the left box holds its single row in 24.
const HUD_PAD = 4;
const HUD_LABEL_Y = 2;
const HUD_VALUE_Y = HUD_LABEL_Y + THIN_CAP_H + 2;
const HUD_ROW_HEIGHT = 24;

// Frames per second the board ticks at, for turning elapsed frames into a clock.
const TICKS_PER_SECOND = 60;

// Elapsed board ticks as the original's M'SS. Minutes are not padded but are
// allowed past 99 rather than wrapping. The separator is the apostrophe the SNES
// itself uses -- long stood in for by a colon, because the chunky font's own
// apostrophe was thought to be missing from the sheet; it is there, packed
// against the comma off the glyph grid (see font.js).
function formatClock(frames) {
  const total = Math.floor(frames / TICKS_PER_SECOND);
  const seconds = total % 60;
  return `${Math.floor(total / 60)}'${String(seconds).padStart(2, '0')}`;
}

// The SCORE box is 5 characters wide (see the HUD_PAD note above). Five
// digits (0-99,999) fit as-is; past that, abbreviate to K then M so the
// value never runs past the box and loses its low digit. Truncated, not
// rounded, so the readout never claims more than the player has earned.
function formatScore(value) {
  if (value < 100000) return String(value);
  if (value < 10000000) return `${Math.floor(value / 1000)}K`;
  return `${Math.floor(value / 1000000)}M`;
}

// The board canvas is always this size (6x12 tiles at 48px), and every
// stage's layout maps its well onto it 1:1 -- see stageLayout() -- so the
// result sign below can place itself against these constants rather than
// needing the board instance.
const BOARD_W = 6 * TS;
const BOARD_H = 12 * TS;

// The big WIN! / LOSE / DRAW result signs, cut from thewolfbunny's VS-mode
// sheet ("credit not necessary, but if you want, you can"; original art (c)
// Nintendo / Intelligent Systems). Drawn over each board's own well at match
// end -- one side reads WIN!, the other LOSE, as on the SNES VS screens --
// rather than a single sign on the shared results screen (which covered the
// Yoshi art there and couldn't show both outcomes at once). Rects measured
// by pure-python decode from the block the sheet captions RESULT SIGNS; DRAW
// is 45 tall rather than 40, since its banner shape hangs lower.
const SIGN_SHEET_URL = 'assets/vs-mode.png';
const SIGNS = {
  win: { x: 792, y: 233, w: 96, h: 40 },
  lose: { x: 792, y: 276, w: 96, h: 40 },
  draw: { x: 792, y: 318, w: 96, h: 45 },
};
const SIGN_DISPLAY_W = 240;

// How long a one-shot pose holds before falling back to idle, in ticks. The
// attack is generous because two of the sprites (Yoshi's) are animated files
// that need room to play through.
const ATTACK_TICKS = 90;
const HIT_TICKS = 45;

class Renderer {
  /**
   * @param {string} receiverId DOM id of the mount (stage container or compact well)
   * @param {object} board
   * @param {{ stage?: object|null, character?: object|null, scale?: number,
   *           chrome?: 'stage'|'vsCompact', side?: 'left'|'right' }} [options]
   */
  constructor(receiverId, board, options = {}) {
    const {
      stage = null,
      character = null,
      scale = 1,
      chrome = 'stage',
      side = 'left',
    } = options;

    this.receiver = document.getElementById(receiverId);
    this.tileColumns = board.width;
    this.tileRows = board.height;
    this.board = board;
    this.stage = stage;
    this.character = character;
    this.scale = scale;
    this.chrome = chrome;
    this.side = side;
    // Partner board + set tally for compact strip HUD (left renderer only).
    this.partnerBoard = null;
    this.sideLabels = null;
    this.setWins = null;
    this.winsNeeded = 1;

    if (this.chrome === 'vsCompact') {
      this._setupCompactWell();
    } else if (this.stage) {
      this._setupStageFrame();
    }

    // Stage framed: pixel-font HUD in the art's boxes.
    // Compact: shared strip panel on the left renderer (set via setCompactHud).
    // Else: plain score bar.
    if (this.stageLayout) {
      this.labelFont = new ProportionalFont('cyan');
      this.valueFont = new PixelFont('white');
      this.timePanel = this._createPanel(this.stageLayout.timePanel);
      this.scorePanel = this._createPanel(this.stageLayout.hudPanel);
      this.receiver.appendChild(this.timePanel.canvas);
      this.receiver.appendChild(this.scorePanel.canvas);
    } else if (this.chrome !== 'vsCompact') {
      this.scoreEl = this._createScoreElement();
      this.receiver.appendChild(this.scoreEl);
    }

    const canvasEl = this._createCanvasElement();
    this.receiver.appendChild(canvasEl);
    this.canvasCtx = canvasEl.getContext('2d');
    // Keep the 16x16 sprites crisp when scaled up to 48px tiles.
    this.canvasCtx.imageSmoothingEnabled = false;
    this.spriteRenderer = new SpriteRenderer();
    this.trashRenderer = new TrashRenderer();

    // Stage: full-frame wash. Compact: per-well wash (shared frame must not
    // tint the opponent). Unframed: canvas wash only.
    if (this.stage || this.chrome === 'vsCompact') {
      this.washOverlay = document.createElement('div');
      this.washOverlay.style.cssText = `
        position: absolute; left: 0; top: 0;
        width: 100%; height: 100%;
        z-index: 10; pointer-events: none;
      `;
      this.receiver.appendChild(this.washOverlay);
    }
  }

  // Multiply a layout CSS number by the display scale (one place for all * scale).
  _s(n) {
    return n * this.scale;
  }

  // Compact strip HUD is owned by the left renderer and reads both boards.
  setCompactHud({ partnerBoard, sideLabels, setWins, winsNeeded, stripPlacement, variant }) {
    this.partnerBoard = partnerBoard;
    this.sideLabels = sideLabels;
    this.setWins = setWins;
    this.winsNeeded = winsNeeded;
    this.compactVariant = variant;
    if (!this.labelFont) {
      this.labelFont = new ProportionalFont('cyan');
      this.valueFont = new PixelFont('white');
    }
    if (stripPlacement && !this.stripPanel) {
      // Mount strip on the shared shell (parent of both wells), not the well.
      const shell = this.receiver.parentElement;
      this.stripPanel = this._createPanel(stripPlacement);
      if (shell) shell.appendChild(this.stripPanel.canvas);
      else this.receiver.appendChild(this.stripPanel.canvas);
    }
  }

  // Compact path: receiver is already a well div sized by App._buildVsShell.
  // No stage frame, character, or decor — canvas fills the well at CSS scale.
  _setupCompactWell() {
    this.receiver.style.position = 'absolute';
    this.receiver.style.overflow = 'hidden';
    // Result sign origin is the well top-left (canvas at 0,0).
    this._setupResultSign({ canvasLeft: 0, canvasTop: 0 });
  }

  // Turn the receiver into a stage frame: a full-cell background image with the
  // board canvas + score overlaid at the well/score-box positions.
  // All CSS placements are multiplied by this.scale (ladder step); stageLayout
  // itself always returns unscaled numbers.
  _setupStageFrame() {
    const w = this.tileColumns * Constants.TILE_SIZE;
    const h = this.tileRows * Constants.TILE_SIZE;
    const raw = stageLayout(this.stage, w, h);
    const s = this.scale;
    // Scaled CSS copy; nativeW/H stay unscaled for panel backing stores.
    const L = {
      ...raw,
      frameW: raw.frameW * s,
      frameH: raw.frameH * s,
      scaleX: raw.scaleX * s,
      scaleY: raw.scaleY * s,
      canvasLeft: raw.canvasLeft * s,
      canvasTop: raw.canvasTop * s,
      bgSizeW: raw.bgSizeW * s,
      bgSizeH: raw.bgSizeH * s,
      bgPosX: raw.bgPosX * s,
      bgPosY: raw.bgPosY * s,
      timePanel: {
        ...raw.timePanel,
        left: raw.timePanel.left * s,
        top: raw.timePanel.top * s,
        width: raw.timePanel.width * s,
        height: raw.timePanel.height * s,
      },
      hudPanel: {
        ...raw.hudPanel,
        left: raw.hudPanel.left * s,
        top: raw.hudPanel.top * s,
        width: raw.hudPanel.width * s,
        height: raw.hudPanel.height * s,
      },
      decor: raw.decor
        ? {
          ...raw.decor,
          left: raw.decor.left * s,
          top: raw.decor.top * s,
          width: raw.decor.width * s,
          height: raw.decor.height * s,
        }
        : null,
    };
    this.stageLayout = L;

    this.receiver.style.position = 'relative';
    this.receiver.style.width = `${L.frameW}px`;
    this.receiver.style.height = `${L.frameH}px`;

    const frame = document.createElement('div');
    frame.style.cssText = `
      position: absolute; left: 0; top: 0;
      width: ${L.frameW}px; height: ${L.frameH}px;
      background-image: url('${L.sheetUrl}');
      background-repeat: no-repeat;
      background-size: ${L.bgSizeW}px ${L.bgSizeH}px;
      background-position: ${L.bgPosX}px ${L.bgPosY}px;
      image-rendering: pixelated;
    `;
    this.receiver.appendChild(frame);

    // Foreground character the stage-clear art omits (bottom right, on the
    // ground). Sits above the background but below the danger/dead wash.
    if (L.decor) {
      const canvas = document.createElement('canvas');
      canvas.width = L.decor.nativeW;
      canvas.height = L.decor.nativeH;
      canvas.style.cssText = `
        position: absolute;
        left: ${L.decor.left}px; top: ${L.decor.top}px;
        width: ${L.decor.width}px; height: ${L.decor.height}px;
        image-rendering: pixelated;
        z-index: 1; pointer-events: none;
      `;
      this.receiver.appendChild(canvas);
      const cycleOf = (frames) => frames.reduce((n, f) => n + (f.hold || 1), 0);
      this.decor = {
        canvas,
        sheet: keyedSheet(L.decor.sheet),
        idle: L.decor.idle,
        react: L.decor.react || null,
        attack: L.decor.attack || null,
        defeat: L.decor.defeat || null,
        idleCycle: cycleOf(L.decor.idle),
        reactCycle: L.decor.react ? cycleOf(L.decor.react) : 0,
        attackCycle: L.decor.attack ? cycleOf(L.decor.attack) : 0,
        reactStart: null,
        attackStart: null,
        lastReaction: null,
        lastAttack: null,
        shownKey: null,
      };
    }

    this._setupCharSprite(L);
    this._setupResultSign(L);
  }

  // The board's own WIN! / LOSE sign, shown over its own well at match end --
  // like the SNES VS screens (one side reads WIN!, the other LOSE), rather
  // than one sign on a shared results screen. Positioned over the well itself
  // (canvasLeft/canvasTop map 1:1 to the 288x576 board canvas), so it sits
  // clear of the character slot the stage keeps to the well's right.
  _setupResultSign(L) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      position: absolute; z-index: 11; pointer-events: none;
      image-rendering: pixelated; display: none;
    `;
    this.receiver.appendChild(canvas);
    this.resultSign = { canvas, ctx: canvas.getContext('2d'), state: undefined, well: L };
    // Start the sheet decoding NOW, at match start, rather than on first use.
    // The sign is only ever wanted on the very last frame a match draws --
    // endMatch() sets the outcome, draws one frame and stops ticking -- so a
    // sheet that only begins loading at that moment has no later frame to retry
    // on, and the sign never appears at all. Every other sheet here is already
    // constructed during setup; this one was the exception.
    keyedSheet(SIGN_SHEET_URL);
  }

  // Swaps in the WIN!/LOSE art once the board's outcome is known. `state` is
  // re-checked every frame but only redraws on an actual change; while the
  // sign sheet is still decoding, `state` is left `undefined` so the next
  // frame retries instead of latching on a blank canvas.
  _updateResultSign(board) {
    const sign = this.resultSign;
    if (!sign) return;
    // A simultaneous top-out is a draw, and the sheet has a sign for it -- so
    // `drew` is checked before `toppedOut`, which is true on both boards then.
    const wanted = board.drew ? 'draw'
      : board.toppedOut ? 'lose'
      : board.victorious ? 'win' : null;
    if (wanted === sign.state) return;

    if (!wanted) {
      sign.state = null;
      sign.canvas.style.display = 'none';
      return;
    }

    const rect = SIGNS[wanted];
    const sheet = keyedSheet(SIGN_SHEET_URL);
    const frame = sheet.frame(rect);
    if (!frame) {
      // Still decoding. There is no "next frame" to retry on -- the match has
      // already stopped ticking by the time this runs (see _setupResultSign) --
      // so wait on the decode explicitly. If the board is torn down first the
      // canvas is simply detached and this paints nothing.
      if (!sign.pendingDecode) {
        sign.pendingDecode = true;
        sheet.image.addEventListener('load', () => {
          sign.pendingDecode = false;
          this._updateResultSign(board);
        }, { once: true });
      }
      return;
    }

    sign.state = wanted;
    // Display size tracks the board CSS scale; backing store stays sheet-native.
    const dispW = Math.round(SIGN_DISPLAY_W * this.scale);
    const dispH = Math.round(rect.h * dispW / rect.w);
    const wellLeft = sign.well.canvasLeft || 0;
    const wellTop = sign.well.canvasTop || 0;
    const boardCssW = BOARD_W * this.scale;
    const boardCssH = BOARD_H * this.scale;

    sign.canvas.width = rect.w;
    sign.canvas.height = rect.h;
    sign.ctx.imageSmoothingEnabled = false;
    sign.ctx.drawImage(frame, 0, 0);

    sign.canvas.style.width = `${dispW}px`;
    sign.canvas.style.height = `${dispH}px`;
    sign.canvas.style.left = `${wellLeft + (boardCssW - dispW) / 2}px`;
    sign.canvas.style.top = `${wellTop + Math.round(boardCssH * 0.32 - dispH / 2)}px`;
    sign.canvas.style.display = '';
  }

  // The board's own character, posed by what is happening to that board. These
  // are whole image files with their own alpha, so this is a plain <img> whose
  // src is swapped -- which also lets the animated poses animate by themselves.
  _setupCharSprite(L) {
    if (!this.character) return;
    preloadVsSprites(this.character.id);
    const img = document.createElement('img');
    // Every one of these rips is drawn facing RIGHT, and the slot sits to the
    // right of the well -- so unflipped they all stare off the edge of the
    // screen. Mirroring turns them in towards the playfield, which is how the
    // SNES gameplay screens have it (and how the baby Yoshi already faces).
    // scaleX mirrors about the element's centre, so the bottom-centred
    // placement below is unaffected.
    img.style.cssText = `
      position: absolute;
      image-rendering: pixelated;
      transform: scaleX(-1);
      z-index: 1; pointer-events: none;
    `;
    // Each pose is a different size, so placement waits for the decode.
    img.addEventListener('load', () => this._placeCharSprite());
    this.receiver.appendChild(img);
    this.charSprite = {
      img,
      slot: L.charSlot,
      sx: L.scaleX,
      sy: L.scaleY,
      state: null,
      lastReaction: null,
      lastHit: null,
      attackStart: null,
      hitStart: null,
    };
  }

  // Bottom-centred on the slot: feet on the ground line, so poses of different
  // heights plant in the same place instead of floating.
  _placeCharSprite() {
    const c = this.charSprite;
    if (!c) return;
    const w = c.img.naturalWidth;
    const h = c.img.naturalHeight;
    if (!w || !h) return;
    c.img.style.width = `${w * c.sx}px`;
    c.img.style.height = `${h * c.sy}px`;
    c.img.style.left = `${(c.slot.cx - w / 2) * c.sx}px`;
    // Never let a sprite escape above the frame. Forest's slot stands the
    // character on top of the HUD box with only 26px of headroom (see stages.js),
    // and the sprites run to 56px tall -- an unclamped one would hang outside the
    // stage art entirely, over the page behind it. Clamped, a too-tall character
    // sinks down over the box's upper rows instead, behind the HUD text.
    c.img.style.top = `${Math.max(0, (c.slot.ground - h) * c.sy)}px`;
  }

  _drawCharSprite(board) {
    const c = this.charSprite;
    if (!c) return;
    const now = this.frameNumber || 0;

    if (board.hitId !== c.lastHit) {
      c.lastHit = board.hitId;
      if (c.lastHit != null) c.hitStart = now;
    }
    if (board.reactionId !== c.lastReaction) {
      c.lastReaction = board.reactionId;
      if (c.lastReaction != null) c.attackStart = now;
    }

    // Taking a hit reads over landing one, and the end of the match beats both.
    let state = 'idle';
    if (board.toppedOut) state = 'defeated';
    else if (board.victorious) state = 'victorious';
    else if (c.hitStart != null && now - c.hitStart < HIT_TICKS) state = 'hit';
    else if (c.attackStart != null && now - c.attackStart < ATTACK_TICKS) state = 'attacking';

    if (state === c.state) return;
    const url = vsSpriteUrl(this.character.id, state);
    if (!url) return;
    c.state = state;
    c.img.src = url;
    // Already-cached poses fire no load event, so place immediately too.
    this._placeCharSprite();
  }

  tileSize() {
    return TS;
  }

  _createScoreElement() {
    const el = document.createElement('div');
    const w = this.tileColumns * Constants.TILE_SIZE * this.scale;
    el.style.cssText = `
      width: ${w}px; height: ${28 * this.scale}px; line-height: ${28 * this.scale}px;
      font-family: 'Press Start 2P', 'Courier New', monospace;
      font-size: ${Math.max(10, 14 * this.scale)}px; text-align: right; padding: 0 6px;
      color: #ffe14d; background: #111; box-sizing: border-box;
      text-shadow: 0 1px 0 rgba(0,0,0,0.7);
      border-bottom: 2px solid #333;
    `;
    el.textContent = '0';
    return el;
  }

  // A transparent overlay sitting exactly on one of the stage art's HUD boxes.
  // Its backing store is the box's *native* size and CSS stretches it to the
  // frame's scale, so the pixel font always lands on whole pixels no matter
  // what fractional scale the frame works out to.
  _createPanel(placement) {
    const el = document.createElement('canvas');
    el.width = placement.nativeW;
    el.height = placement.nativeH;
    el.style.cssText = `
      position: absolute; z-index: 2;
      left: ${placement.left}px; top: ${placement.top}px;
      width: ${placement.width}px; height: ${placement.height}px;
      image-rendering: pixelated; pointer-events: none;
    `;
    const ctx = el.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: el, ctx };
  }

  // A caption with its value right-aligned underneath, cleared and redrawn each
  // frame. The box art itself lives in the stage background behind the canvas.
  _drawReadout(panel, label, value) {
    const ctx = panel.ctx;
    const w = panel.canvas.width;
    ctx.clearRect(0, 0, w, panel.canvas.height);

    if (!this.labelFont.ready() || !this.valueFont.ready()) {
      this._drawReadoutFallback(panel, value, w);
      return;
    }
    this.labelFont.draw(ctx, label, HUD_PAD, HUD_LABEL_Y);
    // An overlong value runs off to the right rather than out of the box's left edge.
    const valueX = Math.max(HUD_PAD, w - HUD_PAD - this.valueFont.width(value));
    this.valueFont.draw(ctx, value, valueX, HUD_VALUE_Y);
  }

  _drawHudColumn(panel, entries) {
    const ctx = panel.ctx;
    const w = panel.canvas.width;
    ctx.clearRect(0, 0, w, panel.canvas.height);

    if (!this.labelFont.ready() || !this.valueFont.ready()) {
      this._drawReadoutFallback(panel, entries[0].value, w);
      return;
    }

    let y = HUD_LABEL_Y;
    for (const { label, value } of entries) {
      this.labelFont.draw(ctx, label, HUD_PAD, y);
      const valueX = Math.max(HUD_PAD, w - HUD_PAD - this.valueFont.width(value));
      this.valueFont.draw(ctx, value, valueX, y + HUD_VALUE_Y - HUD_LABEL_Y);
      y += HUD_ROW_HEIGHT;
    }
  }

  // Used for the frames before font.png has decoded, and if the sheet can never
  // be read back (a tainted canvas, e.g. when served from file://).
  _drawReadoutFallback(panel, value, w) {
    const ctx = panel.ctx;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `${CHAR_H + 2}px monospace`;
    ctx.fillText(value, w - HUD_PAD, HUD_VALUE_Y);
  }

  _createCanvasElement() {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = this.tileColumns * Constants.TILE_SIZE;
    canvasEl.height = this.tileRows * Constants.TILE_SIZE;
    // Keep pixels sharp if the canvas is ever scaled by CSS.
    canvasEl.style.imageRendering = 'pixelated';
    // Explicit CSS size so the ladder scale takes effect (backing store stays 288×576).
    const cssW = BOARD_W * this.scale;
    const cssH = BOARD_H * this.scale;
    canvasEl.style.width = `${cssW}px`;
    canvasEl.style.height = `${cssH}px`;
    if (this.stageLayout) {
      // Drop the canvas into the stage's playfield well.
      const L = this.stageLayout;
      canvasEl.style.position = 'absolute';
      canvasEl.style.zIndex = '1';
      canvasEl.style.left = `${L.canvasLeft}px`;
      canvasEl.style.top = `${L.canvasTop}px`;
    } else if (this.chrome === 'vsCompact') {
      canvasEl.style.position = 'absolute';
      canvasEl.style.zIndex = '1';
      canvasEl.style.left = '0';
      canvasEl.style.top = '0';
    }
    return canvasEl;
  }

  // Advance the decor's idle animation. The sheet decodes asynchronously, so
  // this keeps retrying until the frame lands, and only repaints when the
  // frame actually changes -- most ticks are the long "eyes open" hold.
  _drawDecor(board) {
    const d = this.decor;
    if (!d) return;
    const now = this.frameNumber || 0;

    // A chain bumps board.attackId; that starts the tongue lash.
    const lashing = board && d.attack && board.attackId !== d.lastAttack;
    if (lashing) {
      d.lastAttack = board.attackId;
      if (d.lastAttack != null) d.attackStart = now;
    }

    // A combo or chain bumps board.reactionId; that starts the hop, which plays
    // once and hands back to the idle loop. Re-triggering restarts it, so a run
    // of combos keeps him hopping rather than queueing up.
    if (board && d.react && board.reactionId !== d.lastReaction) {
      d.lastReaction = board.reactionId;
      // A chain bumps both counters on the same tick. The lash is the bigger
      // reaction and wins, so the hop is swallowed here rather than queueing up
      // behind it -- which would otherwise leave him hopping after the fact.
      if (d.lastReaction != null && !lashing) d.reactStart = now;
    }

    // Dying beats everything, and holds: the board never comes back.
    const dead = !!(board && board.toppedOut && d.defeat);
    const attacking = !dead && d.attackStart != null && now - d.attackStart < d.attackCycle;
    if (!attacking) d.attackStart = null;
    const reacting = !dead && !attacking
      && d.reactStart != null && now - d.reactStart < d.reactCycle;
    if (!reacting) d.reactStart = null;

    let frames, t, tag;
    if (dead) { frames = d.defeat; t = 0; tag = 'd'; }
    else if (attacking) { frames = d.attack; t = now - d.attackStart; tag = 'a'; }
    else if (reacting) { frames = d.react; t = now - d.reactStart; tag = 'r'; }
    else { frames = d.idle; t = now % d.idleCycle; tag = 'i'; }

    let index = 0;
    for (let i = 0; i < frames.length; i++) {
      t -= frames[i].hold || 1;
      if (t < 0) { index = i; break; }
    }

    // Repaint only when the visible frame actually changes; most ticks are the
    // long "eyes open" hold.
    const key = `${tag}${index}`;
    if (key === d.shownKey) return;

    const spec = frames[index];
    const frame = d.sheet.frame(spec);
    if (!frame) return; // still decoding; try again next tick

    const ctx = d.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, d.canvas.width, d.canvas.height);
    // Ground-anchored and horizontally centred: the canvas bottom is the ground
    // line, and `lift` raises a frame off it. Centring is what stops the wider
    // jump frames from shifting him sideways mid-hop; `shift` then nudges the
    // frames centring does not suit (the tongue, which grows out one side only).
    const x = Math.round((d.canvas.width - spec.w) / 2) + (spec.shift || 0);
    const y = d.canvas.height - (spec.lift || 0) - spec.h;
    ctx.drawImage(frame, x, y);
    d.shownKey = key;
  }

  draw(game) {
    this._drawBackground();
    this._drawDecor(game.board);
    this._drawCharSprite(game.board);

    const scroll = game.board.scroll;
    this.yscroll = scroll * TS;
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, Math.floor(-this.yscroll));
    this.frameNumber = (this.frameNumber || 0) + 1;

    //this._drawTileGrid(game.board);
    this._drawBlocks(game.board);
    this._drawTrash(game.board);
    game.cursors.forEach((c) => this._drawCursor(c));
    this._drawObjects(game.board);
    this._drawStackState(game.board);
    this._updateResultSign(game.board);

    // Always update the hi-score record, even when HI-SCORE is not drawn
    // (compact chrome drops that row).
    recordScore(game.board.score);

    if (this.scorePanel) {
      this._drawReadout(this.timePanel, 'TIME', formatClock(game.board.elapsedFrames));
      this._drawHudColumn(this.scorePanel, [
        { label: 'HI-SCORE', value: formatScore(recordScore(game.board.score)) },
        { label: 'SCORE', value: formatScore(game.board.score) },
        { label: 'SPEED LV.', value: String(game.board.speedLevel) },
        { label: 'LEVEL', value: String(game.board.level) },
      ]);
    } else if (this.stripPanel && this.side === 'left') {
      this._drawCompactHud(game.board);
    } else if (this.scoreEl) {
      this.scoreEl.textContent = String(game.board.score);
    }
  }

  // Centre-strip HUD for vsCompact (left renderer only). Native 40×204 backing store.
  _drawCompactHud(leftBoard) {
    const panel = this.stripPanel;
    if (!panel) return;
    const rightBoard = this.partnerBoard;
    const labels = this.sideLabels || ['P1', 'P2'];
    const ctx = panel.ctx;
    const w = panel.canvas.width;
    const h = panel.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Cover baked STAGE 1 / *POINT* block (does not apply to this game).
    const cover = VS_STRIP_SLOTS.stageCover;
    ctx.fillStyle = '#102040';
    ctx.fillRect(cover.x, cover.y, cover.w, cover.h);

    if (!this.labelFont.ready() || !this.valueFont.ready()) {
      return;
    }

    // Two per-player SCORE rows in the blank top region (24 px pitch).
    const boards = [leftBoard, rightBoard].filter(Boolean);
    let y = 2;
    for (let i = 0; i < boards.length; i++) {
      const label = labels[i] || `P${i + 1}`;
      const value = formatScore(boards[i].score);
      this.labelFont.draw(ctx, label, HUD_PAD, y);
      const valueX = Math.max(HUD_PAD, w - HUD_PAD - this.valueFont.width(value));
      this.valueFont.draw(ctx, value, valueX, y + HUD_VALUE_Y - HUD_LABEL_Y);
      y += HUD_ROW_HEIGHT;
    }

    // Shared clock into the baked TIME value slot (M'SS = 4×8 = 32 px).
    // Past 10 minutes the string is 5 chars; still fits the strip, may overrun the baked box.
    const clock = formatClock(leftBoard.elapsedFrames);
    const tv = VS_STRIP_SLOTS.timeValue;
    const clockX = tv.x + Math.max(0, tv.w - this.valueFont.width(clock));
    this.valueFont.draw(ctx, clock, clockX, tv.y);

    // Per-player level digits in the baked LEVEL sub-slots (cover vsCpu HARD).
    const lv1 = String(Math.min(99, leftBoard.level));
    const lp1 = VS_STRIP_SLOTS.levelP1;
    const lx1 = lp1.x + Math.max(0, lp1.w - this.valueFont.width(lv1));
    this.valueFont.draw(ctx, lv1, lx1, lp1.y + 2);
    if (rightBoard) {
      const lv2 = String(Math.min(99, rightBoard.level));
      const lp2 = VS_STRIP_SLOTS.levelP2;
      const lx2 = lp2.x + Math.max(0, lp2.w - this.valueFont.width(lv2));
      this.valueFont.draw(ctx, lv2, lx2, lp2.y + 2);
    }

    // In-frame win lamps only when winsNeeded ≤ 2 (art has two rows).
    const needed = this.winsNeeded || 1;
    if (needed <= VS_LAMP_SLOTS.maxRows && this.setWins) {
      const variant = this.compactVariant || 'vsCpu';
      const bottomY = VS_LAMP_SLOTS.bottomY[variant] != null
        ? VS_LAMP_SLOTS.bottomY[variant]
        : VS_LAMP_SLOTS.bottomY.vsCpu;
      for (let row = 0; row < needed; row++) {
        // Rows stack upward from bottomY.
        const ly = bottomY - (needed - 1 - row) * VS_LAMP_SLOTS.pitch;
        const p1Lit = this.setWins[0] > row ? 1 : 0;
        const p2Lit = this.setWins[1] > row ? 1 : 0;
        // One lamp per player: draw a single-cell "row" at the measured x.
        drawWinPoints(ctx, VS_LAMP_SLOTS.p1x, ly, { side: 'p1', won: p1Lit, total: 1 });
        drawWinPoints(ctx, VS_LAMP_SLOTS.p2x, ly, { side: 'p2', won: p2Lit, total: 1 });
      }
    }
  }

  _drawStackState(board) {
    if (this.washOverlay) {
      this._updateFrameWash(board);
      return;
    }
    this._drawCanvasWash(board);
  }

  // Full-frame wash for staged boards: dims or tints the entire stage art,
  // character, HUD, and well together.
  _updateFrameWash(board) {
    if (board.toppedOut) {
      this.washOverlay.style.background = 'rgba(0, 0, 0, 0.55)';
      this.washOverlay.style.boxShadow = 'none';
      return;
    }
    if (board.inDanger) {
      const pulse = 0.5 + 0.5 * Math.sin(this.frameNumber / 5);
      const fillAlpha = (0.10 + 0.16 * pulse).toFixed(3);
      const edgeAlpha = (0.45 + 0.45 * pulse).toFixed(3);
      this.washOverlay.style.background = `rgba(255, 0, 0, ${fillAlpha})`;
      this.washOverlay.style.boxShadow = `inset 0 0 30px rgba(255, 64, 64, ${edgeAlpha})`;
      return;
    }
    this.washOverlay.style.background = 'none';
    this.washOverlay.style.boxShadow = 'none';
  }

  // Canvas-only wash fallback for unframed boards.
  _drawCanvasWash(board) {
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasCtx.setLineDash([]);
    const w = this.tileColumns * Constants.TILE_SIZE;
    const h = this.tileRows * Constants.TILE_SIZE;

    if (board.toppedOut) {
      this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      this.canvasCtx.fillRect(0, 0, w, h);
      return;
    }

    if (board.inDanger) {
      const pulse = 0.5 + 0.5 * Math.sin(this.frameNumber / 5);
      this.canvasCtx.fillStyle = `rgba(255, 0, 0, ${0.10 + 0.16 * pulse})`;
      this.canvasCtx.fillRect(0, 0, w, h);
      this.canvasCtx.strokeStyle = `rgba(255, 64, 64, ${0.45 + 0.45 * pulse})`;
      this.canvasCtx.lineWidth = 10;
      this.canvasCtx.strokeRect(5, 5, w - 10, h - 10);
    }
  }

  _drawFrameNumber() {
    if (this.frameNumber == 1) {
      this.fps_time = Date.now();
      this.fps_frame_count = this.frameNumber
    }

    if (this.frameNumber % 100 == 0) {
      this.fps = (this.frameNumber - this.fps_frame_count) / (Date.now() - this.fps_time) * 1000
      this.fps_time = Date.now();
      this.fps_frame_count = this.frameNumber
    }

    // TODO : Generalize this to a debug text display
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 15);
    this.canvasCtx.font = '15px monospace';
    this.canvasCtx.fillStyle = 'white';
    this.canvasCtx.fillText(`Frame ${this.frameNumber}, fps ${Math.round(this.fps)}`, 0, 0);
  }

  _drawBackground() {
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    const w = this.tileColumns * Constants.TILE_SIZE;
    const h = this.tileRows * Constants.TILE_SIZE;
    if (this.stage && this.chrome !== 'vsCompact') {
      // The stage's own well art shows through empty cells behind the canvas.
      this.canvasCtx.clearRect(0, 0, w, h);
      return;
    }
    // Compact wells are opaque white in the sheet art — must paint a fill.
    this.canvasCtx.fillStyle = '#222';
    this.canvasCtx.fillRect(0, 0, w, h);
  }

  _drawObjects(board) {
    for (const gameObject of board.gameObjects) {
      gameObject.draw(this);
    }
  }

  _drawBlocks(board) {
    for (let row = 0; row < this.tileRows; ++row) {
      for (let col = 0; col < this.tileColumns; ++col) {
        const block = board.grid.get(col, row);
        if (block != null) {
          let tx = 0;
          let ty = 0;
          let moved = block.movePosition();
          if (moved && moved > 0) {
            tx = (block.previousPosition()[0] - col) * TS * moved;
            ty = (block.previousPosition()[1] - row) * TS * moved;
          }
          this.canvasCtx.transform(1, 0, 0, 1, tx, ty);
          this.spriteRenderer.render(this.canvasCtx, block.spriteIndex, TS * col, TS * row, TS, TS, this.frameNumber, block);
          this.canvasCtx.transform(1, 0, 0, 1, -tx, -ty);
        }
      }
    }
    for (let col = 0; col < this.tileColumns; col++) {
      const block = board.nextRow[col];
      this.spriteRenderer.render(this.canvasCtx, block.spriteIndex, TS * col, TS * this.tileRows, TS, TS, this.frameNumber, block, true);
    }
  }

  _drawTrash(board) {
    for (let trash of board.trash) {
      this.trashRenderer.render(this.canvasCtx, trash, TS);
    }
  }

  _drawCursor(cursor) {
    const cursorPulse = this.frameNumber % 50 > 25 ? -1 : -4;
    const w = TS + cursorPulse * 2;

    this.canvasCtx.strokeStyle = cursor.color;
    const sideDash = [w / 4, w / 2, w / 2, w / 2, w / 2, w / 2, w / 2, w / 2, w / 2];
    this.canvasCtx.setLineDash(sideDash)
    this.canvasCtx.lineWidth = 5;
    this.canvasCtx.strokeRect(TS * cursor.position[0] - cursorPulse, TS * cursor.position[1] - cursorPulse, w, w);
    this.canvasCtx.strokeRect(TS * (cursor.position[0] + 1) - cursorPulse, TS * cursor.position[1] - cursorPulse, w, w);
  }

  _drawTileGrid(board) {
    const TS = Constants.TILE_SIZE;

    this.canvasCtx.strokeStyle = 'black';
    this.canvasCtx.lineWidth = 1;
    for (let row = 0; row < this.tileRows; ++row) {
      for (let col = 0; col < this.tileColumns; ++col) {
        this.canvasCtx.strokeRect(TS * col, TS * row, TS, TS);
      }
    }
  }
}

export { Renderer, Constants, formatClock, formatScore };
export const TILE_SIZE = TS;