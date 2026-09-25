/** @typedef {import('../types.js').Cell} Cell */
/** @typedef {import('../types.js').LayerName} LayerName */
/** @typedef {import('../types.js').EntityRecord} EntityRecord */
/** @typedef {import('../types.js').DecorRecord} DecorRecord */
/** @typedef {import('../level/model.js').LevelModel} LevelModel */

/**
 * @param {EntityRecord} rec
 * @returns {EntityRecord}
 */
export function cloneEntity(rec) {
  return { k: rec.k, c: rec.c, r: rec.r, ...(rec.p ? { p: { ...rec.p } } : {}) };
}

/**
 * @param {DecorRecord} rec
 * @returns {DecorRecord}
 */
export function cloneDecor(rec) {
  return { k: rec.k, c: rec.c, r: rec.r };
}

/**
 * @param {Cell} cell
 * @returns {Cell}
 */
export function cloneCell(cell) {
  return { c: cell.c, r: cell.r };
}

/**
 * @template {{ c: number, r: number }} T
 * @param {T[]} list
 * @param {Array<{ c: number, r: number }>} matches
 */
function removeMatching(list, matches) {
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    for (let j = 0; j < list.length; j++) {
      if (list[j].c === m.c && list[j].r === m.r) {
        list.splice(j, 1);
        break;
      }
    }
  }
}

/**
 * @param {LevelModel} model
 */
function touch(model) {
  model.modified = Date.now();
}

export class TilePaintCommand {
  /**
   * @param {LayerName} layer
   */
  constructor(layer) {
    this.layer = layer;
    /** @type {Array<{ c: number, r: number, oldValue: number, newValue: number }>} */
    this.changes = [];
  }

  /**
   * @param {LevelModel} model
   */
  execute(model) {
    for (let i = 0; i < this.changes.length; i++) {
      const ch = this.changes[i];
      model.set(this.layer, ch.c, ch.r, ch.newValue);
    }
  }

  /**
   * @param {LevelModel} model
   */
  undo(model) {
    for (let i = 0; i < this.changes.length; i++) {
      const ch = this.changes[i];
      model.set(this.layer, ch.c, ch.r, ch.oldValue);
    }
  }

  hasChanges() {
    return this.changes.length > 0;
  }
}

export class EntityCommand {
  constructor() {
    /** @type {EntityRecord[]} */
    this.placed = [];
    /** @type {EntityRecord[]} */
    this.removed = [];
  }

  /**
   * @param {LevelModel} model
   */
  execute(model) {
    removeMatching(model.entities, this.removed);
    for (let i = 0; i < this.placed.length; i++) {
      model.entities.push(cloneEntity(this.placed[i]));
    }
    touch(model);
  }

  /**
   * @param {LevelModel} model
   */
  undo(model) {
    removeMatching(model.entities, this.placed);
    for (let i = 0; i < this.removed.length; i++) {
      model.entities.push(cloneEntity(this.removed[i]));
    }
    touch(model);
  }

  hasChanges() {
    return this.placed.length > 0 || this.removed.length > 0;
  }
}

export class DecorCommand {
  constructor() {
    /** @type {DecorRecord[]} */
    this.placed = [];
    /** @type {DecorRecord[]} */
    this.removed = [];
  }

  /**
   * @param {LevelModel} model
   */
  execute(model) {
    removeMatching(model.decor, this.removed);
    for (let i = 0; i < this.placed.length; i++) {
      model.decor.push(cloneDecor(this.placed[i]));
    }
    touch(model);
  }

  /**
   * @param {LevelModel} model
   */
  undo(model) {
    removeMatching(model.decor, this.placed);
    for (let i = 0; i < this.removed.length; i++) {
      model.decor.push(cloneDecor(this.removed[i]));
    }
    touch(model);
  }

  hasChanges() {
    return this.placed.length > 0 || this.removed.length > 0;
  }
}

export class MarkerMoveCommand {
  /**
   * @param {'spawn' | 'goal'} marker
   * @param {Cell | null} oldCell
   */
  constructor(marker, oldCell) {
    this.marker = marker;
    /** @type {Cell | null} */
    this.oldCell = oldCell ? cloneCell(oldCell) : null;
    /** @type {Cell | null} */
    this.newCell = null;
  }

  /**
   * @param {LevelModel} model
   */
  execute(model) {
    const cell = this.newCell;
    if (!cell) return;
    model[this.marker] = cloneCell(cell);
    touch(model);
  }

  /**
   * @param {LevelModel} model
   */
  undo(model) {
    model[this.marker] = this.oldCell ? cloneCell(this.oldCell) : null;
    touch(model);
  }

  hasChanges() {
    const next = this.newCell;
    if (!next) return false;
    const prev = this.oldCell;
    if (!prev) return true;
    return prev.c !== next.c || prev.r !== next.r;
  }
}

export class EraseAllCommand {
  constructor() {
    /** @type {Array<{ layer: LayerName, c: number, r: number, oldValue: number }>} */
    this.tileChanges = [];
    /** @type {EntityRecord[]} */
    this.removedEntities = [];
    /** @type {DecorRecord[]} */
    this.removedDecor = [];
  }

  /**
   * @param {LevelModel} model
   */
  execute(model) {
    for (let i = 0; i < this.tileChanges.length; i++) {
      const ch = this.tileChanges[i];
      model.set(ch.layer, ch.c, ch.r, 0);
    }
    removeMatching(model.entities, this.removedEntities);
    removeMatching(model.decor, this.removedDecor);
    touch(model);
  }

  /**
   * @param {LevelModel} model
   */
  undo(model) {
    for (let i = 0; i < this.tileChanges.length; i++) {
      const ch = this.tileChanges[i];
      model.set(ch.layer, ch.c, ch.r, ch.oldValue);
    }
    for (let i = 0; i < this.removedEntities.length; i++) {
      model.entities.push(cloneEntity(this.removedEntities[i]));
    }
    for (let i = 0; i < this.removedDecor.length; i++) {
      model.decor.push(cloneDecor(this.removedDecor[i]));
    }
    touch(model);
  }

  hasChanges() {
    return this.tileChanges.length > 0
      || this.removedEntities.length > 0
      || this.removedDecor.length > 0;
  }
}

export class ResizeCommand {
  /**
   * @param {number} newCols
   * @param {number} newRows
   * @param {{
   *   cols: number, rows: number,
   *   terrain: Uint8Array, platform: Uint8Array, water: Uint8Array,
   *   entities: EntityRecord[], decor: DecorRecord[],
   *   spawn: Cell, goal: Cell | null,
   * }} snapshot
   * @param {() => void} onResize
   */
  constructor(newCols, newRows, snapshot, onResize) {
    this.newCols = newCols;
    this.newRows = newRows;
    this.snapshot = snapshot;
    this.onResize = onResize;
  }

  /**
   * @param {LevelModel} model
   */
  execute(model) {
    model.resize(this.newCols, this.newRows);
    this.onResize();
  }

  /**
   * @param {LevelModel} model
   */
  undo(model) {
    const s = this.snapshot;
    model.cols = s.cols;
    model.rows = s.rows;
    model.layers.terrain = new Uint8Array(s.terrain);
    model.layers.platform = new Uint8Array(s.platform);
    model.layers.water = new Uint8Array(s.water);
    model.entities = s.entities.map(cloneEntity);
    model.decor = s.decor.map(cloneDecor);
    model.spawn = cloneCell(s.spawn);
    model.goal = s.goal ? cloneCell(s.goal) : null;
    touch(model);
    this.onResize();
  }

  hasChanges() {
    return true;
  }
}

/**
 * @param {LevelModel} model
 * @param {number} newCols
 * @param {number} newRows
 * @param {() => void} onResize
 * @returns {ResizeCommand}
 */
export function createResizeCommand(model, newCols, newRows, onResize) {
  const snapshot = {
    cols: model.cols,
    rows: model.rows,
    terrain: new Uint8Array(model.layers.terrain),
    platform: new Uint8Array(model.layers.platform),
    water: new Uint8Array(model.layers.water),
    entities: model.entities.map(cloneEntity),
    decor: model.decor.map(cloneDecor),
    spawn: cloneCell(model.spawn),
    goal: model.goal ? cloneCell(model.goal) : null,
  };
  return new ResizeCommand(newCols, newRows, snapshot, onResize);
}

/**
 * @typedef {{
 *   execute: (model: LevelModel) => void,
 *   undo: (model: LevelModel) => void,
 *   hasChanges: () => boolean,
 * }} MakerCommand
 */

export class CommandStack {
  /**
   * @param {number} [maxSize]
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    /** @type {MakerCommand[]} */
    this.commands = [];
    this.index = 0;
    // Bumped whenever the model may have changed through the stack, so the maker
    // can re-validate only then instead of every frame.
    this.revision = 0;
  }

  /**
   * @param {MakerCommand} command
   */
  _record(command) {
    this.revision++;
    this.commands.length = this.index;
    this.commands.push(command);
    this.index++;
    if (this.commands.length > this.maxSize) {
      this.commands.shift();
      this.index--;
    }
  }

  /**
   * Execute a command and push it. Clears the redo tail. Enforces the cap.
   *
   * @param {MakerCommand} command
   * @param {LevelModel} model
   */
  execute(command, model) {
    this._record(command);
    command.execute(model);
  }

  /**
   * Push a command that has already been applied to the model (a finished drag).
   * Clears the redo tail. Does not call execute.
   *
   * @param {MakerCommand} command
   */
  push(command) {
    this._record(command);
  }

  /**
   * @param {LevelModel} model
   */
  undo(model) {
    if (!this.canUndo()) return;
    this.index--;
    this.commands[this.index].undo(model);
    this.revision++;
  }

  /**
   * @param {LevelModel} model
   */
  redo(model) {
    if (!this.canRedo()) return;
    this.commands[this.index].execute(model);
    this.index++;
    this.revision++;
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index < this.commands.length;
  }
}
