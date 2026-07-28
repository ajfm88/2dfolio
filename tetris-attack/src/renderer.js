const Constants = {
  TILE_SIZE: 48
};
const TS = Constants.TILE_SIZE;

import { SpriteRenderer } from "./spriteRenderer.js"
import { TrashRenderer } from "./trashRenderer.js"
import { stageLayout } from "./stages.js"
import { keyedSheet } from "./spriteSheet.js"
import { vsSpriteUrl, preloadVsSprites } from "./characters.js"
import { PixelFont, CHAR_H } from "./font.js"
import { recordScore } from "./highScore.js"

//TODO remove
import { TrashBlock } from "./trashBlock.js"

// The HUD readouts, drawn in the SNES HUD font into the stage art's own two
// empty boxes: TIME upper-left, SCORE down the right, as the original lays them
// out. Coordinates are native (unscaled) panel pixels; the overlays are
// stretched up by CSS.
//
// Each readout is a caption with its value right-aligned underneath. At 8px per
// character the right box holds 5 ("SCORE" exactly); the left box is 64 wide,
// so "TIME" and a MM:SS value sit comfortably.
const HUD_PAD = 4;
const HUD_LABEL_Y = 4;
const HUD_VALUE_Y = 14;
const HUD_ROW_HEIGHT = 24;

// Frames per second the board ticks at, for turning elapsed frames into a clock.
const TICKS_PER_SECOND = 60;

// Elapsed board ticks as MM:SS. Minutes are not padded (so it reads 0:07, like
// the original's 0'07) but are allowed past 99 rather than wrapping.
function formatClock(frames) {
  const total = Math.floor(frames / TICKS_PER_SECOND);
  const seconds = total % 60;
  return `${Math.floor(total / 60)}:${String(seconds).padStart(2, '0')}`;
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

// The big WIN! / LOSE result signs, cut from thewolfbunny's VS-mode sheet
// ("credit not necessary, but if you want, you can"; original art (c)
// Nintendo / Intelligent Systems). Drawn over each board's own well at match
// end -- one side reads WIN!, the other LOSE, as on the SNES VS screens --
// rather than a single sign on the shared results screen (which covered the
// Yoshi art there and couldn't show both outcomes at once). Rects measured
// by pure-python decode (see CLAUDE.md).
const SIGN_SHEET_URL = 'assets/vs-mode.png';
const SIGNS = {
  win: { x: 792, y: 233, w: 96, h: 40 },
  lose: { x: 792, y: 276, w: 96, h: 40 },
};
const SIGN_DISPLAY_W = 240;

// How long a one-shot pose holds before falling back to idle, in ticks. The
// attack is generous because two of the sprites (Yoshi's) are animated files
// that need room to play through.
const ATTACK_TICKS = 90;
const HIT_TICKS = 45;

class Renderer {
  constructor(receiverId, board, stage = null, character = null) {
    this.receiver = document.getElementById(receiverId);
    this.tileColumns = board.width;
    this.tileRows = board.height;
    this.stage = stage;
    this.character = character;

    // When a stage is set, the board is framed inside its stage-clear artwork:
    // the canvas is positioned to sit exactly in the art's playfield well, and
    // the surrounding frame + character are drawn behind it via the DOM. The
    // canvas coordinate system is unchanged, so all draw logic below is agnostic
    // to whether a frame is present.
    if (this.stage) {
      this._setupStageFrame();
    }

    // Framed boards get the pixel-font HUD drawn into the stage's own boxes
    // (one canvas each); the plain (unframed) fallback keeps the simple HTML
    // score bar.
    if (this.stageLayout) {
      // The SNES HUD captions its readouts in cyan over a white value.
      this.labelFont = new PixelFont('cyan');
      this.valueFont = new PixelFont('white');
      this.timePanel = this._createPanel(this.stageLayout.timePanel);
      this.scorePanel = this._createPanel(this.stageLayout.hudPanel);
      this.receiver.appendChild(this.timePanel.canvas);
      this.receiver.appendChild(this.scorePanel.canvas);
    } else {
      this.scoreEl = this._createScoreElement();
      this.receiver.appendChild(this.scoreEl);
    }

    const canvasEl = this._createCanvasElement();
    this.receiver.appendChild(canvasEl);
    this.canvasCtx = canvasEl.getContext('2d');
    // Keep the 16x16 sprites crisp when scaled up to 48px tiles.
    // Without this the canvas bilinear-interpolates the upscale and the pixel art looks blurry.
    this.canvasCtx.imageSmoothingEnabled = false;
    this.spriteRenderer = new SpriteRenderer();
    this.trashRenderer = new TrashRenderer();

    if (this.stage) {
      this.washOverlay = document.createElement('div');
      this.washOverlay.style.cssText = `
        position: absolute; left: 0; top: 0;
        width: 100%; height: 100%;
        z-index: 10; pointer-events: none;
      `;
      this.receiver.appendChild(this.washOverlay);
    }
  }

  // Turn the receiver into a stage frame: a full-cell background image with the
  // board canvas + score overlaid at the well/score-box positions.
  _setupStageFrame() {
    const w = this.tileColumns * Constants.TILE_SIZE;
    const h = this.tileRows * Constants.TILE_SIZE;
    const L = stageLayout(this.stage, w, h);
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
      // The sprite is cut from a sheet whose white background has to be keyed
      // out, so this is a canvas at the sprite's native size stretched by CSS
      // -- the same trick the HUD panels use to stay on whole pixels.
      const canvas = document.createElement('canvas');
      // The decor box is ground-anchored at its native size (see stages.js), so
      // frames of different sizes can share one canvas without sliding.
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
        reactStart: null,     // frameNumber the current hop began on
        attackStart: null,    // frameNumber the current tongue lash began on
        lastReaction: null,   // board.reactionId we last saw
        lastAttack: null,     // board.attackId we last saw
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
    const wanted = board.toppedOut ? 'lose' : board.victorious ? 'win' : null;
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
    const scale = SIGN_DISPLAY_W / rect.w;
    const dispW = Math.round(rect.w * scale);
    const dispH = Math.round(rect.h * scale);

    sign.canvas.width = rect.w;
    sign.canvas.height = rect.h;
    sign.ctx.imageSmoothingEnabled = false;
    sign.ctx.drawImage(frame, 0, 0);

    sign.canvas.style.width = `${dispW}px`;
    sign.canvas.style.height = `${dispH}px`;
    sign.canvas.style.left = `${sign.well.canvasLeft + (BOARD_W - dispW) / 2}px`;
    sign.canvas.style.top = `${sign.well.canvasTop + Math.round(BOARD_H * 0.32 - dispH / 2)}px`;
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
    const w = this.tileColumns * Constants.TILE_SIZE;
    el.style.cssText = `
      width: ${w}px; height: 28px; line-height: 28px;
      font-family: 'Press Start 2P', 'Courier New', monospace;
      font-size: 14px; text-align: right; padding: 0 6px;
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
    if (this.stageLayout) {
      // Drop the canvas into the stage's playfield well.
      const L = this.stageLayout;
      canvasEl.style.position = 'absolute';
      canvasEl.style.zIndex = '1';
      canvasEl.style.left = `${L.canvasLeft}px`;
      canvasEl.style.top = `${L.canvasTop}px`;
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

    if (this.scorePanel) {
      this._drawReadout(this.timePanel, 'TIME', formatClock(game.board.elapsedFrames));
      this._drawHudColumn(this.scorePanel, [
        { label: 'BEST', value: formatScore(recordScore(game.board.score)) },
        { label: 'SCORE', value: formatScore(game.board.score) },
        { label: 'SPEED', value: String(game.board.speedLevel) },
        { label: 'LEVEL', value: String(game.board.level) },
      ]);
    } else {
      this.scoreEl.textContent = String(game.board.score);
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
    if (this.stage) {
      // The stage's own well art shows through empty cells behind the canvas.
      this.canvasCtx.clearRect(0, 0, w, h);
      return;
    }
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

export { Renderer };