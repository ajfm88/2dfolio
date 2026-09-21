import { TILE } from '../settings.js';
import {
  cloneCell,
  cloneDecor,
  cloneEntity,
  DecorCommand,
  EntityCommand,
  EraseAllCommand,
  MarkerMoveCommand,
  TilePaintCommand,
} from './commands.js';

/** @typedef {import('../types.js').Cell} Cell */
/** @typedef {import('../types.js').LayerName} LayerName */
/** @typedef {import('../level/model.js').LevelModel} LevelModel */
/** @typedef {import('../data/palette.js').PaletteEntry} PaletteEntry */
/** @typedef {import('./commands.js').MakerCommand} MakerCommand */

/** @typedef {'paint-tile' | 'erase-tile' | 'place-entity' | 'remove-entity' | 'place-decor' | 'remove-decor' | 'move-marker' | 'erase-all' | 'pan' | 'noop'} ToolAction */

/**
 * @param {number} pointerX
 * @param {number} pointerY
 * @param {{ x: number, y: number }} cam
 * @returns {Cell}
 */
export function screenToCell(pointerX, pointerY, cam) {
  const wx = pointerX + cam.x;
  const wy = pointerY + cam.y;
  return { c: Math.floor(wx / TILE), r: Math.floor(wy / TILE) };
}

/**
 * @param {number} c
 * @param {number} r
 * @param {number} cols
 */
export function cellKey(c, r, cols) {
  return r * cols + c;
}

/**
 * @param {number} button MouseEvent.button
 * @param {boolean} erasing
 * @param {PaletteEntry | null} tool
 * @returns {ToolAction}
 */
export function classifyAction(button, erasing, tool) {
  if (button === 1) return 'pan';
  if (button !== 0 && button !== 2) return 'noop';
  if (erasing) return 'erase-all';
  if (button === 2) {
    if (!tool) return 'noop';
    if (tool.placement === 'tile') return 'erase-tile';
    if (tool.placement === 'entity') return 'remove-entity';
    if (tool.placement === 'decor') return 'remove-decor';
    return 'noop';
  }
  if (!tool) return 'noop';
  if (tool.placement === 'tile') return 'paint-tile';
  if (tool.placement === 'entity') return 'place-entity';
  if (tool.placement === 'decor') return 'place-decor';
  if (tool.placement === 'marker') return 'move-marker';
  return 'noop';
}

/**
 * @param {ToolAction} action
 * @param {PaletteEntry | null} tool
 * @param {LevelModel} model
 * @returns {MakerCommand | null}
 */
export function createCommand(action, tool, model) {
  switch (action) {
    case 'paint-tile':
    case 'erase-tile':
      if (!tool || !tool.layer) return null;
      return new TilePaintCommand(tool.layer);
    case 'place-entity':
    case 'remove-entity':
      return new EntityCommand();
    case 'place-decor':
    case 'remove-decor':
      return new DecorCommand();
    case 'move-marker': {
      if (!tool || (tool.id !== 'spawn' && tool.id !== 'goal')) return null;
      const current = tool.id === 'spawn' ? model.spawn : model.goal;
      return new MarkerMoveCommand(tool.id, current);
    }
    case 'erase-all':
      return new EraseAllCommand();
    default:
      return null;
  }
}

/**
 * Apply one cell to the model and record the diff on the command.
 *
 * @param {LevelModel} model
 * @param {MakerCommand} command
 * @param {ToolAction} action
 * @param {PaletteEntry | null} tool
 * @param {Cell} cell
 * @returns {boolean} true if the model changed
 */
export function applyCell(model, command, action, tool, cell) {
  const { c, r } = cell;
  switch (action) {
    case 'paint-tile':
      if (!tool || !tool.layer) return false;
      return applyTile(model, /** @type {TilePaintCommand} */ (command), tool.layer, c, r, 1);
    case 'erase-tile':
      if (!tool || !tool.layer) return false;
      return applyTile(model, /** @type {TilePaintCommand} */ (command), tool.layer, c, r, 0);
    case 'place-entity':
      if (!tool) return false;
      return applyPlaceEntity(model, /** @type {EntityCommand} */ (command), tool, c, r);
    case 'remove-entity':
      return applyRemoveEntity(model, /** @type {EntityCommand} */ (command), c, r);
    case 'place-decor':
      if (!tool) return false;
      return applyPlaceDecor(model, /** @type {DecorCommand} */ (command), tool, c, r);
    case 'remove-decor':
      return applyRemoveDecor(model, /** @type {DecorCommand} */ (command), c, r);
    case 'move-marker':
      if (!tool || (tool.id !== 'spawn' && tool.id !== 'goal')) return false;
      return applyMoveMarker(model, /** @type {MarkerMoveCommand} */ (command), tool.id, c, r);
    case 'erase-all':
      return applyEraseAll(model, /** @type {EraseAllCommand} */ (command), c, r);
    default:
      return false;
  }
}

/**
 * @param {LevelModel} model
 * @param {TilePaintCommand} command
 * @param {LayerName} layer
 * @param {number} c
 * @param {number} r
 * @param {number} newValue
 */
function applyTile(model, command, layer, c, r, newValue) {
  const oldValue = model.get(layer, c, r);
  if (oldValue === newValue) return false;
  model.set(layer, c, r, newValue);
  command.changes.push({ c, r, oldValue, newValue });
  return true;
}

/**
 * @param {LevelModel} model
 * @param {number} c
 * @param {number} r
 */
function findEntityAt(model, c, r) {
  for (let i = 0; i < model.entities.length; i++) {
    const rec = model.entities[i];
    if (rec.c === c && rec.r === r) return i;
  }
  return -1;
}

/**
 * @param {LevelModel} model
 * @param {number} c
 * @param {number} r
 */
function findDecorAt(model, c, r) {
  for (let i = 0; i < model.decor.length; i++) {
    const rec = model.decor[i];
    if (rec.c === c && rec.r === r) return i;
  }
  return -1;
}

/**
 * @param {LevelModel} model
 * @param {EntityCommand} command
 * @param {PaletteEntry} tool
 * @param {number} c
 * @param {number} r
 */
function applyPlaceEntity(model, command, tool, c, r) {
  /** @type {import('../types.js').EntityRecord} */
  const rec = { k: tool.id, c, r };
  if (tool.defaultProps) rec.p = { ...tool.defaultProps };

  const idx = findEntityAt(model, c, r);
  if (idx >= 0) {
    const existing = model.entities[idx];
    if (existing.k === rec.k && propsEqual(existing.p, rec.p)) return false;
    command.removed.push(cloneEntity(existing));
    model.entities.splice(idx, 1);
  }
  command.placed.push(cloneEntity(rec));
  model.entities.push(rec);
  model.modified = Date.now();
  return true;
}

/**
 * @param {LevelModel} model
 * @param {EntityCommand} command
 * @param {number} c
 * @param {number} r
 */
function applyRemoveEntity(model, command, c, r) {
  const idx = findEntityAt(model, c, r);
  if (idx < 0) return false;
  command.removed.push(cloneEntity(model.entities[idx]));
  model.entities.splice(idx, 1);
  model.modified = Date.now();
  return true;
}

/**
 * @param {LevelModel} model
 * @param {DecorCommand} command
 * @param {PaletteEntry} tool
 * @param {number} c
 * @param {number} r
 */
function applyPlaceDecor(model, command, tool, c, r) {
  const rec = { k: tool.id, c, r };
  const idx = findDecorAt(model, c, r);
  if (idx >= 0) {
    const existing = model.decor[idx];
    if (existing.k === rec.k) return false;
    command.removed.push(cloneDecor(existing));
    model.decor.splice(idx, 1);
  }
  command.placed.push(cloneDecor(rec));
  model.decor.push(rec);
  model.modified = Date.now();
  return true;
}

/**
 * @param {LevelModel} model
 * @param {DecorCommand} command
 * @param {number} c
 * @param {number} r
 */
function applyRemoveDecor(model, command, c, r) {
  const idx = findDecorAt(model, c, r);
  if (idx < 0) return false;
  command.removed.push(cloneDecor(model.decor[idx]));
  model.decor.splice(idx, 1);
  model.modified = Date.now();
  return true;
}

/**
 * @param {LevelModel} model
 * @param {MarkerMoveCommand} command
 * @param {'spawn' | 'goal'} marker
 * @param {number} c
 * @param {number} r
 */
function applyMoveMarker(model, command, marker, c, r) {
  const current = model[marker];
  if (current && current.c === c && current.r === r) return false;
  model[marker] = { c, r };
  command.newCell = cloneCell(model[marker]);
  model.modified = Date.now();
  return true;
}

const LAYERS = /** @type {const} */ (['terrain', 'platform', 'water']);

/**
 * @param {LevelModel} model
 * @param {EraseAllCommand} command
 * @param {number} c
 * @param {number} r
 */
function applyEraseAll(model, command, c, r) {
  let changed = false;
  for (let i = 0; i < LAYERS.length; i++) {
    const layer = LAYERS[i];
    const oldValue = model.get(layer, c, r);
    if (oldValue === 0) continue;
    model.set(layer, c, r, 0);
    command.tileChanges.push({ layer, c, r, oldValue });
    changed = true;
  }
  const ei = findEntityAt(model, c, r);
  if (ei >= 0) {
    command.removedEntities.push(cloneEntity(model.entities[ei]));
    model.entities.splice(ei, 1);
    changed = true;
  }
  const di = findDecorAt(model, c, r);
  if (di >= 0) {
    command.removedDecor.push(cloneDecor(model.decor[di]));
    model.decor.splice(di, 1);
    changed = true;
  }
  if (changed) model.modified = Date.now();
  return changed;
}

/**
 * @param {Record<string, unknown> | undefined} a
 * @param {Record<string, unknown> | undefined} b
 */
function propsEqual(a, b) {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (a[ak[i]] !== b[ak[i]]) return false;
  }
  return true;
}
