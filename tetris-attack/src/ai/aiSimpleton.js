import { AIPlayer } from "./aiplayer.js";
import { Buttons } from "../input.js";
import { BLOCK_STATE_NORMAL } from "../board.js";

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

    if(!bestOption) { return; } // Nothing found!

    const targetRow = bestOption[0];

    if(cursorY > targetRow)
      this.input.hold( Buttons.UP );
    else if(cursorY < targetRow) 
      this.input.hold(Buttons.DOWN);
    
    // It doesn't make sense to move left right if we aren't on the right row yet.
    if(cursorY != targetRow) {
      return;
    }

    const cols = bestOption[2]; 
    if(cols[1] > cols[0] + 1) {
      const targetX = cols[1] - 1;
      if(cursorX > targetX) {
        this.input.hold(Buttons.LEFT);
      } else if(cursorX < targetX) {
        this.input.hold(Buttons.RIGHT);
      } else {
        this.input.hold(Buttons.SWAP);
      }
    } else if(cols[2] > cols[1] + 1) {
      const targetX = cols[2] - 1;
      if(cursorX > targetX) {
        this.input.hold(Buttons.LEFT);
      } else if(cursorX < targetX) {
        this.input.hold(Buttons.RIGHT);
      } else {
        this.input.hold(Buttons.SWAP);
      }
    }


    // Random moves
    /*
    this.x = (this.x || 1) - 1;
    if(this.x <= 0) {
      this.x = null;
      this.input.hold( DIRECTIONS[ parseInt(Math.random() * 10) % 5 ] );
    }
    */
  }
}
