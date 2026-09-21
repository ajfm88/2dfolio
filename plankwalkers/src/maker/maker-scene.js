import { TILE, VIEW_H } from '../settings.js';
import { createParallax } from '../level/parallax.js';
import { drawLevel } from '../level/render.js';
import { createEmptyModel } from '../level/model.js';
import { byId } from '../data/palette.js';
import { CommandStack } from './commands.js';
import {
  applyCell,
  cellKey,
  classifyAction,
  createCommand,
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
 *   destroy: () => void,
 * }} PaletteController
 */

/**
 * @typedef {{
 *   level?: LevelModel,
 *   theme: Theme,
 *   atlas: Atlas,
 *   input: Input,
 *   camera: ReturnType<import('../core/camera.js').createCamera>,
 *   viewport: ReturnType<import('../core/viewport.js').createViewport>,
 *   ui: { createPalette: Function },
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

  /** @type {PaletteEntry | null} */
  let activeTool = null;
  let erasing = false;

  /** @type {{ command: MakerCommand, action: import('./tools.js').ToolAction, button: number, dedupe: Set<number> } | null} */
  let dragState = null;

  let panning = false;
  let panPrevX = 0;
  let panPrevY = 0;

  /**
   * @param {LevelModel} model
   * @param {MakerSceneParams} p
   */
  function frameCameraOnSpawn(model, p) {
    const viewW = p.viewport.viewW;
    const worldW = model.cols * TILE;
    const worldH = model.rows * TILE;
    const spawnX = model.spawn.c * TILE + TILE / 2;
    p.camera.x = spawnX - viewW / 2;
    p.camera.y = worldH - VIEW_H;
    p.camera.panBy(0, 0, worldW, worldH, viewW, VIEW_H);
  }

  function syncToolFromPalette() {
    if (!palette) return;
    activeTool = palette.getSelectedEntry();
    erasing = palette.isErasing();
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
   * @param {{ c: number, r: number }} cell
   */
  function paintCell(cell) {
    if (!level || !dragState) return;
    if (!level.inBounds(cell.c, cell.r)) return;
    const key = cellKey(cell.c, cell.r, level.cols);
    if (dragState.dedupe.has(key)) return;
    dragState.dedupe.add(key);
    applyCell(level, dragState.command, dragState.action, activeTool, cell);
  }

  /**
   * @param {number} dt
   */
  function panCamera(dt) {
    if (!params || !level) return;
    const keys = params.input.keys;
    const viewW = params.viewport.viewW;
    const worldW = level.cols * TILE;
    const worldH = level.rows * TILE;
    let dx = 0;
    let dy = 0;
    if (keys.left.held) dx -= PAN_SPEED * dt;
    if (keys.right.held) dx += PAN_SPEED * dt;
    if (keys.up.held) dy -= PAN_SPEED * dt;
    if (keys.down.held) dy += PAN_SPEED * dt;
    if (dx !== 0 || dy !== 0) {
      params.camera.panBy(dx, dy, worldW, worldH, viewW, VIEW_H);
    }

    const ptr = params.input.pointer;
    if (ptr.pressed && ptr.button === 1) {
      panning = true;
      panPrevX = ptr.x;
      panPrevY = ptr.y;
    }
    if (panning && ptr.down && ptr.button === 1) {
      params.camera.panBy(
        panPrevX - ptr.x,
        panPrevY - ptr.y,
        worldW,
        worldH,
        viewW,
        VIEW_H,
      );
      panPrevX = ptr.x;
      panPrevY = ptr.y;
    }
    if (ptr.released) panning = false;
  }

  function processPaint() {
    if (!params || !level) return;
    const ptr = params.input.pointer;

    if (ptr.released && dragState) finalizeDrag();

    if (ptr.pressed && ptr.button !== 1) {
      const action = classifyAction(ptr.button, erasing, activeTool);
      if (action !== 'noop' && action !== 'pan') {
        const cell = screenToCell(ptr.x, ptr.y, params.camera);
        if (level.inBounds(cell.c, cell.r)) {
          const command = createCommand(action, activeTool, level);
          if (command) {
            dragState = {
              command,
              action,
              button: ptr.button,
              dedupe: new Set(),
            };
            paintCell(cell);
          }
        }
      }
    }

    if (ptr.down && dragState && ptr.button === dragState.button) {
      paintCell(screenToCell(ptr.x, ptr.y, params.camera));
    }
  }

  return {
    /**
     * @param {MakerSceneParams} p
     */
    enter(p) {
      params = p;
      level = p.level ?? createEmptyModel();
      parallax = createParallax(level, p.theme, p.atlas);
      stack = new CommandStack();
      activeTool = null;
      erasing = false;
      dragState = null;
      panning = false;
      frameCameraOnSpawn(level, p);
    },

    exit() {
      if (dragState) finalizeDrag();
      params = null;
      parallax = null;
      stack = null;
      activeTool = null;
      erasing = false;
      dragState = null;
      panning = false;
      // level is owned by the caller (the dev bridge).
    },

    /**
     * @param {HTMLElement} root
     */
    mountUI(root) {
      if (!params) return;
      palette = params.ui.createPalette(root, {
        atlas: params.atlas,
        /**
         * @param {PaletteEntry | null} entry
         * @param {boolean} isErasing
         */
        onSelect(entry, isErasing) {
          activeTool = entry;
          erasing = isErasing;
        },
      });
    },

    unmountUI() {
      if (palette) {
        palette.destroy();
        palette = null;
      }
    },

    /**
     * @param {number} dt
     */
    update(dt) {
      if (!params || !level || !stack || !parallax) return;

      params.input.advance();
      syncToolFromPalette();

      if (!dragState) {
        if (params.input.keys.undo.pressed) stack.undo(level);
        if (params.input.keys.redo.pressed) stack.redo(level);
      }

      panCamera(dt);
      processPaint();
      parallax.update(dt, params.camera.x, params.viewport.viewW);
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ x: number, y: number }} cam
     */
    render(ctx, cam) {
      if (!params || !level || !parallax) return;
      const viewW = params.viewport.viewW;
      const atlas = params.atlas;

      drawLevel(ctx, cam, viewW, VIEW_H, level, params.theme, atlas, parallax);

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
        ctx, cam, viewW, VIEW_H, level.cols, level.rows,
        params.viewport.pixelScale,
      );

      const cell = screenToCell(params.input.pointer.x, params.input.pointer.y, cam);
      if (!level.inBounds(cell.c, cell.r)) return;

      const eraseCursor = erasing || params.input.pointer.button === 2;
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

    getLevel() {
      return level;
    },
  };
}
