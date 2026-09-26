import { TILE, VIEW_H } from '../settings.js';
import { deserialise, serialise } from '../level/codec.js';
import { createParallax } from '../level/parallax.js';
import { drawLevel } from '../level/render.js';
import { createEmptyModel } from '../level/model.js';
import { LevelError } from '../level/schema.js';
import { byId } from '../data/palette.js';
import { CommandStack, createResizeCommand } from './commands.js';
import { createGestures } from './gestures.js';
import { findProblems } from './validate.js';
import {
  applyCell,
  cellKey,
  classifyAction,
  createCommand,
  forEachCellOnLine,
  pickToolAt,
  screenToCell,
} from './tools.js';
import {
  CURSOR_ERASE,
  CURSOR_HOVER,
  CURSOR_PAINT,
  drawCursor,
  drawGhost,
  drawGrid,
  drawPreviewIcon,
} from './grid-overlay.js';

/** @typedef {import('../level/model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */
/** @typedef {Awaited<ReturnType<import('../core/atlas.js').loadAtlas>>} Atlas */
/** @typedef {ReturnType<import('../core/input.js').createInput>} Input */
/** @typedef {import('../data/palette.js').PaletteEntry} PaletteEntry */
/** @typedef {import('./commands.js').MakerCommand} MakerCommand */

const PAN_SPEED = 300;

/**
 * @typedef {{
 *   getSelectedEntry: () => PaletteEntry | null,
 *   isErasing: () => boolean,
 *   getGroup: () => string,
 *   selectById: (id: string) => void,
 *   destroy: () => void,
 * }} PaletteController
 */

/**
 * @typedef {{
 *   isPanMode: () => boolean,
 *   destroy: () => void,
 * }} ToggleController
 */

/**
 * @typedef {import('./commands.js').MakerCommand} MakerCommand
 * @typedef {import('../ui/maker-toolbar.js').ToolbarController} ToolbarController
 */

/**
 * Everything the maker needs to come back exactly as it was left after a
 * test-play. `level` and `stack` are the live objects, handed over, not copied —
 * play runs on its own deserialised copy and never touches them.
 *
 * @typedef {{
 *   level: LevelModel,
 *   stack: CommandStack,
 *   zoom: number,
 *   camX: number,
 *   camY: number,
 *   group: string,
 *   toolId: string | null,
 *   erasing: boolean,
 *   panMode: boolean,
 * }} MakerSession
 */

/**
 * @typedef {{
 *   level?: LevelModel,
 *   session?: MakerSession,
 *   theme: Theme,
 *   atlas: Atlas,
 *   input: Input,
 *   camera: ReturnType<import('../core/camera.js').createCamera>,
 *   viewport: ReturnType<import('../core/viewport.js').createViewport>,
 *   ui: { createPalette: Function, createToggle?: Function, createToolbar?: Function },
 *   onBack?: () => void,
 *   onPlay?: (data: import('../types.js').LevelData, session: MakerSession) => void,
 *   openResizeDialog?: (root: HTMLElement, opts: {
 *     cols: number,
 *     rows: number,
 *     onApply: (cols: number, rows: number) => void,
 *   }) => { close: () => void },
 * }} MakerSceneParams
 */

export function createMakerScene() {
  /** @type {MakerSceneParams | null} */
  let params = null;
  /** @type {LevelModel | null} */
  let level = null;
  /** @type {ReturnType<typeof createParallax> | null} */
  let parallax = null;
  /** @type {CommandStack | null} */
  let stack = null;
  /** @type {PaletteController | null} */
  let palette = null;
  /** @type {ToggleController | null} */
  let toggle = null;
  /** @type {ToolbarController | null} */
  let toolbar = null;
  /** @type {ReturnType<typeof createGestures> | null} */
  let gestures = null;
  /** @type {{ close: () => void } | null} */
  let resizeDialog = null;

  /** @type {PaletteEntry | null} */
  let activeTool = null;
  let erasing = false;
  let zoom = 1;

  /**
   * `lastC` / `lastR` is the cell under the pointer on the previous frame of the drag.
   * @type {{ command: MakerCommand, action: import('./tools.js').ToolAction, button: number, dedupe: Set<number>, lastC: number, lastR: number } | null}
   */
  let dragState = null;

  let panning = false;
  let panPrevX = 0;
  let panPrevY = 0;

  /** @type {import('./validate.js').Problem[]} */
  let problems = [];
  /** @type {string | null} */
  let loadError = null;
  let lastRevision = -1;

  function dims() {
    const viewW = params.viewport.viewW;
    return {
      viewW,
      eW: viewW / zoom,
      eH: VIEW_H / zoom,
      worldW: level.cols * TILE,
      worldH: level.rows * TILE,
    };
  }

  /**
   * @param {LevelModel} model
   * @param {MakerSceneParams} p
   */
  function frameCameraOnSpawn(model, p) {
    const viewW = p.viewport.viewW;
    const eW = viewW / zoom;
    const eH = VIEW_H / zoom;
    const worldW = model.cols * TILE;
    const worldH = model.rows * TILE;
    const spawnX = model.spawn.c * TILE + TILE / 2;
    p.camera.x = spawnX - eW / 2;
    p.camera.y = worldH - eH;
    p.camera.panBy(0, 0, worldW, worldH, eW, eH);
  }

  /**
   * @param {number} newZoom
   * @param {number} centerVx
   * @param {number} centerVy
   */
  function applyZoom(newZoom, centerVx, centerVy) {
    if (!params || !level) return;
    const worldX = centerVx / zoom + params.camera.x;
    const worldY = centerVy / zoom + params.camera.y;
    zoom = newZoom;
    params.camera.x = worldX - centerVx / zoom;
    params.camera.y = worldY - centerVy / zoom;
    const d = dims();
    params.camera.panBy(0, 0, d.worldW, d.worldH, d.eW, d.eH);
  }

  function syncToolFromPalette() {
    if (!palette) return;
    activeTool = palette.getSelectedEntry();
    erasing = palette.isErasing();
  }

  /**
   * @param {number} vx
   * @param {number} vy
   */
  function eyedropAt(vx, vy) {
    if (!params || !level || !palette) return;
    const cell = screenToCell(vx, vy, params.camera, zoom);
    const picked = pickToolAt(cell.c, cell.r, level);
    if (picked) palette.selectById(picked.id);
  }

  function finalizeDrag() {
    if (!dragState || !stack) {
      dragState = null;
      return;
    }
    if (dragState.command.hasChanges()) stack.push(dragState.command);
    dragState = null;
  }

  /**
   * @param {LevelModel} lvl
   * @param {CommandStack} stk
   * @param {MakerSceneParams} p
   * @returns {MakerSession}
   */
  function snapshot(lvl, stk, p) {
    return {
      level: lvl,
      stack: stk,
      zoom,
      camX: p.camera.x,
      camY: p.camera.y,
      // The palette is the source of truth: a tool picked since the last update
      // (then Play tapped before the next frame) is still the one restored.
      group: palette ? palette.getGroup() : '',
      toolId: palette ? palette.getSelectedEntry()?.id ?? null : null,
      erasing: palette ? palette.isErasing() : false,
      panMode: toggle ? toggle.isPanMode() : false,
    };
  }

  /**
   * Re-check the level only when the stack says it may have changed. Every edit
   * goes through the stack, including toolbar Undo/Redo clicks between frames.
   */
  function refreshProblems() {
    if (!level || !stack || stack.revision === lastRevision) return;
    problems = findProblems(level);
    loadError = null;
    lastRevision = stack.revision;
  }

  /**
   * The one way into test-play, for the Play button and `M` alike. Play gets a
   * serialised copy, proven to load, so a level that test-plays is a level that
   * will load from storage (invariant 2).
   *
   * @returns {boolean} true when the play request was handed to the App
   */
  function requestPlay() {
    if (!params || !level || !stack || !params.onPlay) return false;
    // A toolbar Undo can land between frames, after the last check.
    refreshProblems();
    // The status message already says why.
    if (dragState || problems.length > 0) return false;
    let data;
    try {
      data = serialise(level);
      deserialise(data);
    } catch (err) {
      if (!(err instanceof LevelError)) throw err;
      loadError = err.message;
      return false;
    }
    params.onPlay(data, snapshot(level, stack, params));
    return true;
  }

  // applyCell reads c and r and keeps no reference, so one scratch cell serves.
  const scratchCell = { c: 0, r: 0 };

  /**
   * @param {number} c
   * @param {number} r
   */
  function paintAt(c, r) {
    if (!level || !dragState) return;
    if (!level.inBounds(c, r)) return;
    const key = cellKey(c, r, level.cols);
    if (dragState.dedupe.has(key)) return;
    dragState.dedupe.add(key);
    scratchCell.c = c;
    scratchCell.r = r;
    applyCell(level, dragState.command, dragState.action, activeTool, scratchCell);
  }

  /**
   * @param {{
   *   x: number,
   *   y: number,
   *   pressed: boolean,
   *   released: boolean,
   *   down: boolean,
   *   button: number,
   * }} src
   */
  function processPaintFrom(src) {
    if (!params || !level) return;

    if (src.pressed && src.button !== 1) {
      const action = classifyAction(src.button, erasing, activeTool);
      if (action !== 'noop' && action !== 'pan') {
        const cell = screenToCell(src.x, src.y, params.camera, zoom);
        if (level.inBounds(cell.c, cell.r)) {
          const command = createCommand(action, activeTool, level);
          if (command) {
            dragState = {
              command,
              action,
              button: src.button,
              dedupe: new Set(),
              lastC: cell.c,
              lastR: cell.r,
            };
            paintAt(cell.c, cell.r);
          }
        }
      }
    }

    if (src.down && dragState && src.button === dragState.button) {
      const cell = screenToCell(src.x, src.y, params.camera, zoom);
      if (cell.c !== dragState.lastC || cell.r !== dragState.lastR) {
        // Fill every cell the pointer crossed since last frame (issue 23).
        forEachCellOnLine(dragState.lastC, dragState.lastR, cell.c, cell.r, paintAt);
        dragState.lastC = cell.c;
        dragState.lastR = cell.r;
      }
    }

    // Last, so a touch tap — pressed and released in the same frame — places once
    // and then closes its command.
    if (src.released && dragState) finalizeDrag();
  }

  /**
   * @param {number} dt
   */
  function panKeyboard(dt) {
    if (!params || !level) return;
    const keys = params.input.keys;
    const d = dims();
    let dx = 0;
    let dy = 0;
    if (keys.left.held) dx -= PAN_SPEED * dt;
    if (keys.right.held) dx += PAN_SPEED * dt;
    if (keys.up.held) dy -= PAN_SPEED * dt;
    if (keys.down.held) dy += PAN_SPEED * dt;
    if (dx !== 0 || dy !== 0) {
      params.camera.panBy(dx, dy, d.worldW, d.worldH, d.eW, d.eH);
    }
  }

  function panMiddleMouse() {
    if (!params || !level) return;
    const ptr = params.input.pointer;
    const d = dims();
    if (ptr.pressed && ptr.button === 1) {
      eyedropAt(ptr.x, ptr.y);
      panning = true;
      panPrevX = ptr.x;
      panPrevY = ptr.y;
    }
    if (panning && ptr.down && ptr.button === 1) {
      params.camera.panBy(
        (panPrevX - ptr.x) / zoom,
        (panPrevY - ptr.y) / zoom,
        d.worldW,
        d.worldH,
        d.eW,
        d.eH,
      );
      panPrevX = ptr.x;
      panPrevY = ptr.y;
    }
    if (ptr.released) panning = false;
  }

  return {
    /**
     * @param {MakerSceneParams} p
     */
    enter(p) {
      params = p;
      const s = p.session;
      if (s) {
        level = s.level;
        stack = s.stack;
        zoom = s.zoom;
        activeTool = s.toolId ? byId(s.toolId) ?? null : null;
        erasing = s.erasing;
      } else {
        level = p.level ?? createEmptyModel();
        stack = new CommandStack();
        zoom = 1;
        activeTool = null;
        erasing = false;
      }
      parallax = createParallax(level, p.theme, p.atlas);
      dragState = null;
      panning = false;
      // Checked now, not on the first update: a frame can render before the first
      // fixed step, and Play must never show enabled on an unplayable level.
      lastRevision = -1;
      refreshProblems();
      gestures = createGestures(p.input, {
        isPanMode: () => (toggle ? toggle.isPanMode() : false),
      });
      if (s) {
        p.camera.x = s.camX;
        p.camera.y = s.camY;
        // The viewport may have changed size during play.
        const d = dims();
        p.camera.panBy(0, 0, d.worldW, d.worldH, d.eW, d.eH);
      } else {
        frameCameraOnSpawn(level, p);
      }
    },

    exit() {
      if (dragState) finalizeDrag();
      if (gestures) gestures.reset();
      params = null;
      parallax = null;
      stack = null;
      gestures = null;
      activeTool = null;
      erasing = false;
      dragState = null;
      panning = false;
      // level and stack live on in the session the App holds during test-play.
    },

    /**
     * @param {HTMLElement} root
     */
    mountUI(root) {
      if (!params) return;
      const s = params.session;
      palette = params.ui.createPalette(root, {
        atlas: params.atlas,
        initial: s ? { group: s.group, toolId: s.toolId, erasing: s.erasing } : undefined,
        /**
         * @param {PaletteEntry | null} entry
         * @param {boolean} isErasing
         */
        onSelect(entry, isErasing) {
          activeTool = entry;
          erasing = isErasing;
        },
      });
      if (params.ui.createToggle) {
        toggle = params.ui.createToggle(root, params.input, { panMode: s ? s.panMode : false });
      }
      if (params.ui.createToolbar) {
        toolbar = params.ui.createToolbar(root, {
          onBack: () => { if (params.onBack) params.onBack(); },
          onPlay: () => { requestPlay(); },
          onUndo: () => { if (!dragState && stack && level && stack.canUndo()) stack.undo(level); },
          onRedo: () => { if (!dragState && stack && level && stack.canRedo()) stack.redo(level); },
          onResize: () => {
            if (!params || !params.openResizeDialog || !level || !stack) return;
            resizeDialog = params.openResizeDialog(root, {
              cols: level.cols,
              rows: level.rows,
              /** @param {number} newCols @param {number} newRows */
              onApply(newCols, newRows) {
                if (!level || !stack || !params) return;
                if (newCols === level.cols && newRows === level.rows) return;
                const cmd = createResizeCommand(level, newCols, newRows, () => {
                  if (!level || !params) return;
                  parallax = createParallax(level, params.theme, params.atlas);
                  const d = dims();
                  params.camera.panBy(0, 0, d.worldW, d.worldH, d.eW, d.eH);
                });
                stack.execute(cmd, level);
              },
            });
          },
        });
      }
    },

    unmountUI() {
      // A mode switch (the M key) can arrive while the dialog is open.
      if (resizeDialog) {
        resizeDialog.close();
        resizeDialog = null;
      }
      if (toolbar) {
        toolbar.destroy();
        toolbar = null;
      }
      if (toggle) {
        toggle.destroy();
        toggle = null;
      }
      if (palette) {
        palette.destroy();
        palette = null;
      }
    },

    /**
     * @param {number} dt
     */
    update(dt) {
      if (!params || !level || !stack || !parallax || !gestures) return;

      params.input.advance();

      // Stop here once the request is out: anything painted after the snapshot
      // would be in the maker's level but not in the one being played.
      if (params.input.keys.modeSwitch.pressed && requestPlay()) return;

      syncToolFromPalette();
      gestures.update(dt, zoom);

      if (!dragState) {
        if (params.input.keys.undo.pressed) stack.undo(level);
        if (params.input.keys.redo.pressed) stack.redo(level);
      }

      const d = dims();
      if (gestures.panDx !== 0 || gestures.panDy !== 0) {
        params.camera.panBy(
          -gestures.panDx / zoom,
          -gestures.panDy / zoom,
          d.worldW,
          d.worldH,
          d.eW,
          d.eH,
        );
      }
      if (gestures.zoomSnap !== null) {
        applyZoom(gestures.zoomSnap, gestures.zoomCenterX, gestures.zoomCenterY);
      }

      panKeyboard(dt);
      if (!gestures.active) panMiddleMouse();

      if (gestures.active) {
        processPaintFrom({
          x: gestures.paintX,
          y: gestures.paintY,
          pressed: gestures.paintPressed,
          released: gestures.paintReleased,
          down: gestures.state === 'onePaint',
          button: 0,
        });
      } else {
        const ptr = params.input.pointer;
        processPaintFrom({
          x: ptr.x,
          y: ptr.y,
          pressed: ptr.pressed,
          released: ptr.released,
          down: ptr.down,
          button: ptr.button,
        });
      }

      if (gestures.eyedropFired) {
        eyedropAt(gestures.eyedropX, gestures.eyedropY);
      }

      parallax.update(dt, params.camera.x, d.eW);

      // Last, so a drag that closed this frame is reflected in this frame's render.
      refreshProblems();
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ x: number, y: number }} cam
     */
    render(ctx, cam) {
      if (!params || !level || !parallax) return;
      const d = dims();
      const atlas = params.atlas;
      ctx.scale(zoom, zoom);

      drawLevel(ctx, cam, d.eW, d.eH, level, params.theme, atlas, parallax);

      for (let i = 0; i < level.entities.length; i++) {
        const rec = level.entities[i];
        const entry = byId(rec.k);
        if (!entry) continue;
        drawPreviewIcon(ctx, cam, rec.c, rec.r, atlas.get(entry.icon), 'entity');
      }
      for (let i = 0; i < level.decor.length; i++) {
        const rec = level.decor[i];
        const entry = byId(rec.k);
        if (!entry) continue;
        drawPreviewIcon(ctx, cam, rec.c, rec.r, atlas.get(entry.icon), 'decor');
      }

      const spawnEntry = byId('spawn');
      if (spawnEntry) {
        drawPreviewIcon(
          ctx, cam, level.spawn.c, level.spawn.r,
          atlas.get(spawnEntry.icon), 'marker',
        );
      }
      if (level.goal) {
        const goalEntry = byId('goal');
        if (goalEntry) {
          drawPreviewIcon(
            ctx, cam, level.goal.c, level.goal.r,
            atlas.get(goalEntry.icon), 'marker',
          );
        }
      }

      drawGrid(
        ctx, cam, d.eW, d.eH, level.cols, level.rows,
        params.viewport.pixelScale * zoom,
      );

      // Before the cursor early-return below: the toolbar must track the stack and
      // the goal even while the pointer is off the level (e.g. over the toolbar).
      if (toolbar && stack) {
        toolbar.sync({
          canUndo: stack.canUndo(),
          canRedo: stack.canRedo(),
          problem: loadError ?? (problems.length > 0 ? problems[0].message : null),
        });
      }

      const ptr = params.input.pointer;
      const cell = screenToCell(ptr.x, ptr.y, cam, zoom);
      if (!level.inBounds(cell.c, cell.r)) return;

      const eraseCursor = erasing || ptr.button === 2;
      const color = eraseCursor
        ? CURSOR_ERASE
        : activeTool
          ? CURSOR_PAINT
          : CURSOR_HOVER;
      drawCursor(ctx, cam, cell.c, cell.r, color);

      if (activeTool && !erasing && activeTool.placement !== 'tile') {
        drawGhost(ctx, cam, cell.c, cell.r, atlas, activeTool);
      }
    },
  };
}
