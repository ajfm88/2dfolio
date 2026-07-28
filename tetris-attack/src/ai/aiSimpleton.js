import { AIPlayer } from "./aiplayer.js";
import { Buttons } from "../input.js";
import { BLOCK_STATE_NORMAL, BLOCK_STATE_POPPING } from "../block.js";
import { PositionSet } from "../utils.js";

const DIRECTIONS = [Buttons.LEFT, Buttons.RIGHT, Buttons.UP, Buttons.DOWN, Buttons.SWAP];

// Difficulty tiers, named as on the SNES's own VS setup screen.
// - delayMin/delayMax: frames between actions -- the AI's hand speed. normal's
//   5-15 is the original AISimpleton pacing, unchanged.
// - raiseWhenIdle: hold the raise button when there is nothing better to do.
//   easy leaves its stack to rise on its own instead.
// - chainBuilding: during a pop, look for a swap that makes a match form out
//   of the panels that are about to fall (see _chainBuildingLogic).
export const AI_DIFFICULTIES = {
  easy:   { delayMin: 25, delayMax: 45, raiseWhenIdle: false, chainBuilding: false },
  normal: { delayMin: 5,  delayMax: 15, raiseWhenIdle: true,  chainBuilding: false },
  hard:   { delayMin: 3,  delayMax: 8,  raiseWhenIdle: true,  chainBuilding: true },
};

export class AISimpleton extends AIPlayer {
  constructor({ board, input, cursor, difficulty = 'normal' }) {
    super({ board: board, input: input, cursor: cursor });
    this.difficulty = AI_DIFFICULTIES[difficulty] ? difficulty : 'normal';
    this.settings = AI_DIFFICULTIES[this.difficulty];
  }

  tick() {
    this.input.clear();

    this.inputDelay = (this.inputDelay || 5) - 1;
    if (this.inputDelay != 0) {
      return;
    } else {
      const { delayMin, delayMax } = this.settings;
      this.inputDelay = Math.floor(delayMin + Math.random() * (delayMax - delayMin));
    }

    let done = false;
    if (this.settings.chainBuilding) {
      done = this._chainBuildingLogic();
    }
    if (!done) {
      done = this._vericalMatchingLogic();
    }
    if (!done) {
      done = this._horizontalMatchingLogic();
    }
    if (!done) {
      done = this._downstackLogic();
    }
    if (!done && this.settings.raiseWhenIdle) {
      this.input.hold(Buttons.SCROLL);
    }
  }

  // While the board is popping, look for a swap that creates a match once the
  // popped panels vanish and everything above them settles -- the classic way a
  // chain is built. The panels that fall out of a clear carry chain
  // eligibility until they rest, so a match they land in pays out as chain
  // x2+. (A projected run usually contains such a faller; the rare setup that
  // matches only resting panels still clears, it just scores as a combo.)
  _chainBuildingLogic() {
    const board = this.board;
    const grid = board.grid;

    let anythingPopping = false;
    for (const [block] of grid.entries()) {
      if (block.state() == BLOCK_STATE_POPPING) {
        anythingPopping = true;
        break;
      }
    }
    if (!anythingPopping) {
      return false;
    }

    // If the fall is already going to make a match by itself, a chain is
    // coming with no help needed -- hold still rather than risk a swap that
    // dismantles it.
    if (this._findRuns(this._projectSettled()).length > 0) {
      return true;
    }

    // Try every legal swap and keep the one closest to the cursor that makes a
    // match appear in the settled board.
    const [cursorX, cursorY] = this.cursor.position;
    let best = null;
    let bestDist = Infinity;
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width - 1; x++) {
        if (!this._isSwappable(x, y) || !this._isSwappable(x + 1, y)) continue;
        const a = grid.get(x, y);
        const b = grid.get(x + 1, y);
        if (!a && !b) continue;
        if (a && b && a.color == b.color) continue; // swapping does nothing
        const runs = this._findRuns(this._projectSettled([x, y]), true);
        if (runs.length == 0) continue;
        const dist = Math.abs(cursorX - x) + Math.abs(cursorY - y);
        if (dist < bestDist) {
          bestDist = dist;
          best = [x, y];
        }
      }
    }
    if (!best) {
      return false;
    }

    // Same movement idiom as the other logics: row first, then column, then swap.
    const [targetX, targetY] = best;
    if (cursorY > targetY) {
      this.input.hold(Buttons.UP);
    } else if (cursorY < targetY) {
      this.input.hold(Buttons.DOWN);
    } else if (cursorX > targetX) {
      this.input.hold(Buttons.LEFT);
    } else if (cursorX < targetX) {
      this.input.hold(Buttons.RIGHT);
    } else {
      this.input.hold(Buttons.SWAP);
    }
    return true;
  }

  // A cell the cursor could swap right now: empty, or a resting panel. Trash
  // cells are never swappable.
  _isSwappable(x, y) {
    if (this.board.trashGrid && this.board.trashGrid.get(x, y)) {
      return false;
    }
    const block = this.board.grid.get(x, y);
    return !block || block.state() == BLOCK_STATE_NORMAL;
  }

  // Project where every panel comes to rest once the current pops resolve:
  // popping panels vanish, everything else falls straight down its column.
  // Returns a [x][y] array of { color, swapped } cells (null = empty), with
  // the optional candidate swap at (swap[0], swap[1])<->(swap[0]+1, swap[1])
  // applied first; `swapped` marks the panels that swap moved, so a run can be
  // traced back to the swap that caused it. Trash is approximated as a static
  // floor: panels above it rest on top, and it never moves.
  _projectSettled(swap) {
    const board = this.board;
    const grid = board.grid;
    const trashGrid = board.trashGrid;

    const cellAt = (x, y) => {
      let sx = x;
      if (swap && y == swap[1]) {
        if (x == swap[0]) sx = swap[0] + 1;
        else if (x == swap[0] + 1) sx = swap[0];
      }
      const block = grid.get(sx, y);
      if (!block || block.state() == BLOCK_STATE_POPPING) return null;
      return { color: block.color, swapped: sx != x };
    };

    const cols = [];
    for (let x = 0; x < board.width; x++) {
      const col = new Array(board.height).fill(null);
      let writeY = board.height - 1;
      for (let y = board.height - 1; y >= 0; y--) {
        if (trashGrid && trashGrid.get(x, y)) {
          // Panels above the trash come to rest on top of it.
          writeY = y - 1;
          continue;
        }
        const cell = cellAt(x, y);
        if (cell) {
          col[writeY] = cell;
          writeY--;
        }
      }
      cols.push(col);
    }
    return cols;
  }

  // All horizontal and vertical runs of 3+ same-colored cells in a projected
  // grid. With `requireSwapped`, only runs containing a panel the candidate
  // swap moved -- i.e. matches that swap is responsible for.
  _findRuns(cols, requireSwapped = false) {
    const runs = [];
    const scan = (cells) => {
      let run = [];
      const flush = () => {
        if (run.length >= 3 && (!requireSwapped || run.some(c => c.swapped))) {
          runs.push(run);
        }
      };
      for (const cell of cells) {
        if (cell && run.length > 0 && run[0].color == cell.color) {
          run.push(cell);
        } else {
          flush();
          run = cell ? [cell] : [];
        }
      }
      flush();
    };
    for (let y = 0; y < this.board.height; y++) {
      scan(cols.map(col => col[y]));
    }
    for (const col of cols) {
      scan(col);
    }
    return runs;
  }

  _downstackLogic() {
    const board = this.board;
    const grid = this.board.grid;
    const cursorY = this.cursor.position[1];
    const cursorX = this.cursor.position[0];

    // Simple pattern-based downstack logic. Better would be to scan left/right looking for a hole.

    for (let row = 0; row < board.height - 2; ++row) {
      for (let col = 0; col < board.width - 1; ++col) {
        // Look at a 2x2 grid TL corner at (row,col)
        // 1 2
        // 3 4
        const block1 = grid.get(col, row);
        const block2 = grid.get(col + 1, row);
        const block3 = grid.get(col, row + 1);
        const block4 = grid.get(col + 1, row + 1);

        // Two cases
        // 1 _  or _ 2
        // . _     _ .

        let swappable = block1 && block3 && (!block2) && (!block4);
        swappable |= block2 && block4 && (!block1) && (!block3);

        if (swappable) {

          // Found a good swap. let's do it.

          if (cursorY > row)
            this.input.hold(Buttons.UP);
          else if (cursorY < row)
            this.input.hold(Buttons.DOWN);

          // It doesn't make sense to move left right if we aren't on the right row yet.
          if (cursorY != row) {
            return true;
          }

          if (cursorX > col) {
            this.input.hold(Buttons.LEFT);
          } else if (cursorX < col) {
            this.input.hold(Buttons.RIGHT);
          } else {
            this.input.hold(Buttons.SWAP);
          }
          return true;

        }

      }
    }

    return false; // Didn't find anything
  }

  _vericalMatchingLogic() {
    const board = this.board;
    const grid = this.board.grid;

    let colorsPositionSet = new Map();
    for (let [block, x, y] of grid.entries()) {
      let ps = colorsPositionSet.get(block.color);
      if (!ps) {
        ps = new PositionSet();
        colorsPositionSet.set(block.color, ps);
      }
      ps.add(x, y);
    }

    let candidate;
    let entries = [...colorsPositionSet.entries()];
    entries.sort(([k], [k2]) => k < k2);
    for (let [color, ps] of entries) {
      let rows = [...ps.byRows().keys()];
      rows.sort((x, y) => x - y);
      let streak = [];
      for (let row of rows) {
        if (streak.length == 0 || streak[streak.length - 1] == row - 1) {
          streak.push(row);
        } else {
          streak = [];
        }
        if (streak.length >= 3) {
          candidate = { color, streak };
        }
        if (candidate) {
          break;
        }
      }
      if (candidate) {
        break;
      }
    }

    if (candidate) {
      let ps = colorsPositionSet.get(candidate.color);
      let columns = candidate.streak.map(s => [...ps.byRows().get(s)]);
      columns.forEach(c => c.sort((x, y) => x - y));
      let targetColumn = columns[0][0];
      let cmd;
      for (let i = 0; i < candidate.streak.length; i++) {
        let row = candidate.streak[i];
        if (!columns[i].find(x => x === targetColumn)) {
          columns[i].sort((f, s) => Math.abs(f - targetColumn) - Math.abs(s - targetColumn));
          let column = columns[i][0];
          cmd = this._moveBlockTo(column, row, targetColumn);
          if (cmd) break;
        }
      }
      if (cmd) {
        cmd();
        return true;
      }
    }
    return false;
  }

  _horizontalMatchingLogic() {
    const board = this.board;
    const grid = this.board.grid;

    // Find all the possible 3 combos on the board
    let options = [];
    for (let row = 0; row < board.height; ++row) {

      // Count number of blocks by color on this row
      const columnsByColor = new Map();
      for (let col = 0; col < board.width; ++col) {
        const block = grid.get(col, row);
        if (block && block.state() == BLOCK_STATE_NORMAL)
          columnsByColor.set(block.color, (columnsByColor.get(block.color) || []).concat([col]));
      }

      // Every color that had at least three entries has some options to contribute
      for (const [color, columns] of columnsByColor) {
        if (columns.length >= 3) {
          for (let col = 2; col < columns.length; ++col) {
            options.push([row, color, [columns[col - 2], columns[col - 1], columns[col]]]);
          }
        }
      }

    }

    let bestScore = 9e9;
    let bestOption = null;

    const cursorY = this.cursor.position[1];
    const cursorX = this.cursor.position[0];

    for (const [row, color, columns] of options) {
      const deltaY = Math.abs(cursorY - row);
      const rangeX = columns[columns.length - 1] - columns[0];
      const score = deltaY +
        Math.abs(cursorX - columns[1]) +
        Math.abs(columns[0] - columns[1]) * 2 +
        Math.abs(columns[1] - columns[2]) * 2 + Math.random()*2;
      if (score < bestScore) {
        bestScore = score;
        bestOption = [row, color, columns];
      }
    }

    if (!bestOption) { return false; } // Nothing found!

    const targetRow = bestOption[0];

    if (cursorY > targetRow)
      this.input.hold(Buttons.UP);
    else if (cursorY < targetRow)
      this.input.hold(Buttons.DOWN);

    // It doesn't make sense to move left right if we aren't on the right row yet.
    if (cursorY != targetRow) {
      return true;
    }

    // Look at the second and third blocks to see which one needs to move left.
    const cols = bestOption[2];
    for (let i = 1; i <= 2; ++i) {
      if (cols[i] > cols[i - 1] + 1) {
        const targetX = cols[i] - 1;
        if (cursorX > targetX) {
          this.input.hold(Buttons.LEFT);
        } else if (cursorX < targetX) {
          this.input.hold(Buttons.RIGHT);
        } else {
          this.input.hold(Buttons.SWAP);
        }
        break;
      }
    }

    return true;
  }

  _moveTo(x, y) {
    if (this.cursor.position[0] > x) {
      return () => this.input.hold(Buttons.LEFT);
    }
    if (this.cursor.position[0] < x) {
      return () => this.input.hold(Buttons.RIGHT);
    }
    if (this.cursor.position[1] > y) {
      return () => this.input.hold(Buttons.UP);
    }
    if (this.cursor.position[1] < y) {
      return () => this.input.hold(Buttons.DOWN);
    }
  }

  _moveBlockTo(x, y, newX) {
    if (x === newX) {
      return;
    }
    if (newX > x) {
      let moveCmd = this._moveTo(x, y);
      if (moveCmd) return moveCmd;
      return () => this.input.hold(Buttons.SWAP);
    }
    if (newX < x) {
      let moveCmd = this._moveTo(x - 1, y);
      if (moveCmd) return moveCmd;
      return () => this.input.hold(Buttons.SWAP);
    }
  }
}