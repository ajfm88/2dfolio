import { AIPlayer } from "./aiplayer.js";
import { Buttons } from "../input.js";
import { BLOCK_STATE_NORMAL } from "../block.js";

const DIRECTIONS = [Buttons.LEFT, Buttons.RIGHT, Buttons.UP, Buttons.DOWN, Buttons.SWAP];

export class AISimpleton extends AIPlayer {
  constructor({board, input, cursor}) {
    super({board: board, input: input, cursor: cursor});
  }

  tick() {
    this.input.clear();

    this.inputDelay = (this.inputDelay || 5) - 1;
    if(this.inputDelay != 0) {
      return;
    } else {
      this.inputDelay = parseInt(5 + Math.random() * 10);
    }

    const foundHorizontalMatch = this._horizontalMatchingLogic();
    
    if(!foundHorizontalMatch) {
      this._downstackLogic();
    }
  }

  _downstackLogic() {
    const board = this.board;
    const grid = this.board.grid;
    const cursorY = this.cursor.position[1];
    const cursorX = this.cursor.position[0];

    // Simple pattern-based downstack logic. Better would be to scan left/right looking for a hole.

    for(let row=0; row<board.height-2; ++row) {
      for(let col=0; col<board.width-1; ++col) {
        // Look at a 2x2 grid TL corner at (row,col)
        // 1 2
        // 3 4
        const block1 = grid.get(col, row);
        const block2 = grid.get(col+1, row);
        const block3 = grid.get(col, row+1);
        const block4 = grid.get(col+1, row+1);

        // Two cases
        // 1 _  or _ 2
        // . _     _ .

        let swappable = block1 && (!block2) && (!block4);
        swappable |= block2 && (!block1) && (!block3);

        if( swappable ) {

          // Found a good swap. let's do it.

          if(cursorY > row)
            this.input.hold( Buttons.UP );
          else if(cursorY < row) 
            this.input.hold(Buttons.DOWN);
          
          // It doesn't make sense to move left right if we aren't on the right row yet.
          if(cursorY != row) {
            return true;
          }

          if(cursorX > col) {
            this.input.hold(Buttons.LEFT);
          } else if(cursorX < col) {
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

  _horizontalMatchingLogic() {
    const board = this.board;
    const grid = this.board.grid;

    // Find all the possible 3 combos on the board
    let options = [];
    for(let row=0; row<board.height; ++row) {

      // Count number of blocks by color on this row
      const columnsByColor = new Map();
      for(let col=0; col<board.width; ++col) {
        const block = grid.get(col, row);
        if(block && block.state() == BLOCK_STATE_NORMAL) 
          columnsByColor.set(block.color, (columnsByColor.get(block.color) || [ ]).concat([col]) );
      }

      // Every color that had at least three entries has some options to contribute
      for(const [color, columns] of columnsByColor) {
        if(columns.length >= 3) {
          for(let col=2; col< columns.length; ++col) {
            options.push([row, color, [columns[col-2], columns[col-1], columns[col]] ]);
          }
        }
      }

    }

    let bestScore = 9e9;
    let bestOption = null;

    const cursorY = this.cursor.position[1];
    const cursorX = this.cursor.position[0];

    for(const [row, color, columns] of options) {
      const deltaY = Math.abs( cursorY - row );
      const rangeX = columns[columns.length-1] - columns[0];
      const score = deltaY +
                    Math.abs(cursorX - columns[1]) + 
                    Math.abs(columns[0] - columns[1]) * 2 + 
                    Math.abs(columns[1] - columns[2]) * 2;
      if(score < bestScore) {
        bestScore = score;
        bestOption = [row, color, columns];
      }
    }

    if(!bestOption) { return false; } // Nothing found!

    const targetRow = bestOption[0];

    if(cursorY > targetRow)
      this.input.hold( Buttons.UP );
    else if(cursorY < targetRow) 
      this.input.hold(Buttons.DOWN);
    
    // It doesn't make sense to move left right if we aren't on the right row yet.
    if(cursorY != targetRow) {
      return true;
    }

    // Look at the second and third blocks to see which one needs to move left.
    const cols = bestOption[2]; 
    for(let i=1; i<=2; ++i) {
      if(cols[i] > cols[i-1] + 1) {
        const targetX = cols[i] - 1;
        if(cursorX > targetX) {
          this.input.hold(Buttons.LEFT);
        } else if(cursorX < targetX) {
          this.input.hold(Buttons.RIGHT);
        } else {
          this.input.hold(Buttons.SWAP);
        }
        break;
      }
    }

    return true;
  }

}
