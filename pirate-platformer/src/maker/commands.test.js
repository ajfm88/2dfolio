import { describe, expect, it } from 'vitest';
import { createEmptyModel } from '../level/model.js';
import {
  CommandStack,
  TilePaintCommand,
} from './commands.js';
import { applyCell, classifyAction, createCommand } from './tools.js';

/** @type {import('../data/palette.js').PaletteEntry} */
const TERRAIN = {
  id: 'terrain',
  group: 'terrain',
  label: 'Terrain',
  icon: 'tiles/island',
  placement: 'tile',
  layer: 'terrain',
  z: 2,
};

/** @type {import('../data/palette.js').PaletteEntry} */
const CRABBY = {
  id: 'crabby',
  group: 'enemies',
  label: 'Crabby',
  icon: 'crabby/idle',
  placement: 'entity',
  layer: null,
  z: 5,
  defaultProps: { dir: -1 },
};

/** @type {import('../data/palette.js').PaletteEntry} */
const GOAL = {
  id: 'goal',
  group: 'markers',
  label: 'Goal',
  icon: 'flag',
  placement: 'marker',
  layer: null,
  z: 5,
};

/** @type {import('../data/palette.js').PaletteEntry} */
const SPAWN = {
  id: 'spawn',
  group: 'markers',
  label: 'Spawn',
  icon: 'player/idle',
  placement: 'marker',
  layer: null,
  z: 5,
};

function empty() {
  return createEmptyModel({ cols: 40, rows: 12 });
}

/**
 * @param {import('../level/model.js').LevelModel} model
 * @param {import('../data/palette.js').PaletteEntry} tool
 * @param {import('./tools.js').ToolAction} action
 * @param {Array<{ c: number, r: number }>} cells
 */
function drag(model, tool, action, cells) {
  const command = createCommand(action, tool, model);
  if (!command) throw new Error('no command');
  const seen = new Set();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const key = cell.r * model.cols + cell.c;
    if (seen.has(key)) continue;
    seen.add(key);
    applyCell(model, command, action, tool, cell);
  }
  return command;
}

describe('classifyAction', () => {
  it('paints tiles on left click', () => {
    expect(classifyAction(0, false, TERRAIN)).toBe('paint-tile');
  });

  it('erases the active tile layer on right click', () => {
    expect(classifyAction(2, false, TERRAIN)).toBe('erase-tile');
  });

  it('places and removes entities', () => {
    expect(classifyAction(0, false, CRABBY)).toBe('place-entity');
    expect(classifyAction(2, false, CRABBY)).toBe('remove-entity');
  });

  it('moves markers on left and no-ops on right', () => {
    expect(classifyAction(0, false, GOAL)).toBe('move-marker');
    expect(classifyAction(2, false, GOAL)).toBe('noop');
    expect(classifyAction(2, false, SPAWN)).toBe('noop');
  });

  it('eraser and right-click+eraser are erase-all', () => {
    expect(classifyAction(0, true, TERRAIN)).toBe('erase-all');
    expect(classifyAction(2, true, TERRAIN)).toBe('erase-all');
    expect(classifyAction(0, true, null)).toBe('erase-all');
  });

  it('middle click pans; no tool is a left-click no-op', () => {
    expect(classifyAction(1, false, TERRAIN)).toBe('pan');
    expect(classifyAction(0, false, null)).toBe('noop');
  });
});

describe('TilePaintCommand', () => {
  it('paints, undoes, and redoes a drag', () => {
    const model = empty();
    const stack = new CommandStack();
    const cmd = drag(model, TERRAIN, 'paint-tile', [
      { c: 1, r: 1 }, { c: 2, r: 1 }, { c: 2, r: 1 },
    ]);
    expect(cmd.hasChanges()).toBe(true);
    expect(/** @type {TilePaintCommand} */ (cmd).changes).toHaveLength(2);
    expect(model.get('terrain', 1, 1)).toBe(1);
    expect(model.get('terrain', 2, 1)).toBe(1);
    stack.push(cmd);
    stack.undo(model);
    expect(model.get('terrain', 1, 1)).toBe(0);
    expect(model.get('terrain', 2, 1)).toBe(0);
    stack.redo(model);
    expect(model.get('terrain', 1, 1)).toBe(1);
    expect(model.get('terrain', 2, 1)).toBe(1);
  });

  it('does not record painting a cell that is already terrain', () => {
    const model = empty();
    model.set('terrain', 3, 3, 1);
    const cmd = drag(model, TERRAIN, 'paint-tile', [{ c: 3, r: 3 }]);
    expect(cmd.hasChanges()).toBe(false);
  });

  it('right-click erase only clears the active layer', () => {
    const model = empty();
    model.set('terrain', 5, 5, 1);
    model.set('water', 5, 5, 1);
    const cmd = drag(model, TERRAIN, 'erase-tile', [{ c: 5, r: 5 }]);
    expect(model.get('terrain', 5, 5)).toBe(0);
    expect(model.get('water', 5, 5)).toBe(1);
    const stack = new CommandStack();
    stack.push(cmd);
    stack.undo(model);
    expect(model.get('terrain', 5, 5)).toBe(1);
  });
});

describe('EntityCommand', () => {
  it('places with defaultProps and replaces an existing entity', () => {
    const model = empty();
    const first = drag(model, CRABBY, 'place-entity', [{ c: 8, r: 6 }]);
    expect(model.entities).toEqual([{ k: 'crabby', c: 8, r: 6, p: { dir: -1 } }]);
    const coin = {
      ...CRABBY,
      id: 'coin_gold',
      defaultProps: undefined,
    };
    const second = drag(model, coin, 'place-entity', [{ c: 8, r: 6 }]);
    expect(model.entities).toEqual([{ k: 'coin_gold', c: 8, r: 6 }]);
    const stack = new CommandStack();
    stack.push(first);
    stack.push(second);
    stack.undo(model);
    expect(model.entities).toEqual([{ k: 'crabby', c: 8, r: 6, p: { dir: -1 } }]);
    stack.undo(model);
    expect(model.entities).toEqual([]);
    stack.redo(model);
    expect(model.entities[0].k).toBe('crabby');
  });

  it('skips placing the same kind on the same cell', () => {
    const model = empty();
    drag(model, CRABBY, 'place-entity', [{ c: 2, r: 2 }]);
    const again = drag(model, CRABBY, 'place-entity', [{ c: 2, r: 2 }]);
    expect(again.hasChanges()).toBe(false);
    expect(model.entities).toHaveLength(1);
  });

  it('removes an entity on right click', () => {
    const model = empty();
    drag(model, CRABBY, 'place-entity', [{ c: 4, r: 4 }]);
    const cmd = drag(model, CRABBY, 'remove-entity', [{ c: 4, r: 4 }]);
    expect(model.entities).toEqual([]);
    const stack = new CommandStack();
    stack.push(cmd);
    stack.undo(model);
    expect(model.entities[0].k).toBe('crabby');
  });
});

describe('MarkerMoveCommand', () => {
  it('places a goal from null and undoes back to null', () => {
    const model = empty();
    const cmd = drag(model, GOAL, 'move-marker', [{ c: 10, r: 8 }]);
    expect(model.goal).toEqual({ c: 10, r: 8 });
    const stack = new CommandStack();
    stack.push(cmd);
    stack.undo(model);
    expect(model.goal).toBeNull();
    stack.redo(model);
    expect(model.goal).toEqual({ c: 10, r: 8 });
  });

  it('moves spawn and restores the previous cell', () => {
    const model = empty();
    const before = { ...model.spawn };
    const cmd = drag(model, SPAWN, 'move-marker', [{ c: 9, r: 9 }]);
    expect(model.spawn).toEqual({ c: 9, r: 9 });
    const stack = new CommandStack();
    stack.push(cmd);
    stack.undo(model);
    expect(model.spawn).toEqual(before);
  });

  it('clicking the current cell is not a change', () => {
    const model = empty();
    const cmd = drag(model, SPAWN, 'move-marker', [model.spawn]);
    expect(cmd.hasChanges()).toBe(false);
  });
});

describe('EraseAllCommand', () => {
  it('clears tiles and entities but not markers', () => {
    const model = empty();
    model.set('terrain', 6, 6, 1);
    model.set('platform', 6, 6, 1);
    model.entities.push({ k: 'crabby', c: 6, r: 6, p: { dir: -1 } });
    const spawn = { ...model.spawn };
    const cmd = drag(model, TERRAIN, 'erase-all', [{ c: 6, r: 6 }]);
    expect(model.get('terrain', 6, 6)).toBe(0);
    expect(model.get('platform', 6, 6)).toBe(0);
    expect(model.entities).toEqual([]);
    expect(model.spawn).toEqual(spawn);
    const stack = new CommandStack();
    stack.push(cmd);
    stack.undo(model);
    expect(model.get('terrain', 6, 6)).toBe(1);
    expect(model.get('platform', 6, 6)).toBe(1);
    expect(model.entities[0].k).toBe('crabby');
  });
});

describe('CommandStack', () => {
  it('clears the redo tail on a new command', () => {
    const model = empty();
    const stack = new CommandStack();
    const a = drag(model, TERRAIN, 'paint-tile', [{ c: 0, r: 0 }]);
    const b = drag(model, TERRAIN, 'paint-tile', [{ c: 1, r: 0 }]);
    stack.push(a);
    stack.push(b);
    stack.undo(model);
    expect(stack.canRedo()).toBe(true);
    const c = drag(model, TERRAIN, 'paint-tile', [{ c: 2, r: 0 }]);
    stack.push(c);
    expect(stack.canRedo()).toBe(false);
    expect(model.get('terrain', 1, 0)).toBe(0);
    expect(model.get('terrain', 2, 0)).toBe(1);
  });

  it('drops the oldest command after 101 entries', () => {
    const model = empty();
    const stack = new CommandStack(100);
    for (let i = 0; i < 101; i++) {
      const c = i % 40;
      const r = Math.floor(i / 40);
      const cmd = new TilePaintCommand('terrain');
      cmd.changes.push({ c, r, oldValue: 0, newValue: 1 });
      cmd.execute(model);
      stack.push(cmd);
    }
    expect(stack.commands.length).toBe(100);
    let undos = 0;
    while (stack.canUndo()) {
      stack.undo(model);
      undos++;
    }
    expect(undos).toBe(100);
    expect(model.get('terrain', 0, 0)).toBe(1);
  });

  it('undo/redo is exact across mixed tile, entity, marker, and erase ops', () => {
    const model = empty();
    const stack = new CommandStack();
    const ops = [];
    for (let i = 0; i < 10; i++) {
      ops.push(drag(model, TERRAIN, 'paint-tile', [{ c: i, r: 10 }]));
    }
    ops.push(drag(model, CRABBY, 'place-entity', [{ c: 5, r: 9 }]));
    ops.push(drag(model, GOAL, 'move-marker', [{ c: 20, r: 8 }]));
    ops.push(drag(model, TERRAIN, 'erase-all', [{ c: 3, r: 10 }]));
    ops.push(drag(model, GOAL, 'move-marker', [{ c: 21, r: 8 }]));
    for (let i = 0; i < ops.length; i++) stack.push(ops[i]);

    expect(model.get('terrain', 0, 10)).toBe(1);
    expect(model.get('terrain', 3, 10)).toBe(0);
    expect(model.entities[0].k).toBe('crabby');
    expect(model.goal).toEqual({ c: 21, r: 8 });

    while (stack.canUndo()) stack.undo(model);
    expect(model.get('terrain', 0, 10)).toBe(0);
    expect(model.entities).toEqual([]);
    expect(model.goal).toBeNull();

    while (stack.canRedo()) stack.redo(model);
    expect(model.get('terrain', 0, 10)).toBe(1);
    expect(model.get('terrain', 3, 10)).toBe(0);
    expect(model.entities[0].k).toBe('crabby');
    expect(model.goal).toEqual({ c: 21, r: 8 });
  });
});
