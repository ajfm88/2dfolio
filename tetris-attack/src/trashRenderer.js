import { TRASH_STATE_NORMAL, TRASH_STATE_POPPING } from "./trashBlock.js";
import { SpriteRenderer } from "./spriteRenderer.js";

const image = new Image();
image.src = "trashSprites.png";

const spritesImage = new Image();
spritesImage.src = "sprites.png";

const TILE_SIZE = 16;

//Sprite mapping to sprite sheet indexed by 
//horizontal alignment [left, center, right] then 
//vertical alignment [top, center, bottom]
const spriteMap = [
  [
    [0, 1],
    [0, 3],
    [0, 2]
  ],
  [
    [1, 1],
    [1, 3],
    [2, 2]
  ],
  [
    [3, 1],
    [3, 3],
    [3, 2]
  ]
];

class TrashRenderer {
  constructor() {
    this.spriteRenderer = new SpriteRenderer();
  }

  render(context, trashBlock, destTileSize) {

    if(trashBlock.state() == TRASH_STATE_NORMAL) {
      this._drawNormalTrashBlock(context, {x: trashBlock.x, y: trashBlock.y, width: trashBlock.width, height: trashBlock.height}, destTileSize);
    } else if(trashBlock.state() == TRASH_STATE_POPPING) {
      this._drawPoppingTrashBlock(context, trashBlock, destTileSize);
    }
  }

  //context, spriteIndex, x, y, width, height, frameNumber, block, bottomRow

  _drawPoppingTrashBlock(context, trashBlock, destTileSize) {
    const trashWidth = trashBlock.width;
    const trashHeight = trashBlock.height;
    const popAge = trashBlock.popAge();

    // Draw underlying trash and blocks
    this._drawNormalTrashBlock(context, {x: trashBlock.x, y: trashBlock.y, width: trashBlock.width, height: trashBlock.height-1}, destTileSize);

    // Draw interior blocks
    for (let i = 0; i < trashWidth; i++) {
      const block = trashBlock.interiorBlocks.get(i, trashBlock.height-1);
      context.drawImage(spritesImage, block.spriteIndex * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE,
                        (trashBlock.x + i) * destTileSize,
                        (trashBlock.y + trashBlock.height - 1) * destTileSize,
                        destTileSize,
                        destTileSize);
    }

    // Draw the popping animation
    let accumulatedPopAge = 0;
    for (let j = 0; j < trashHeight; j++) {
      for (let i = 0; i < trashWidth; i++) {
        if(accumulatedPopAge < popAge) {
          context.drawImage(spritesImage, 6 * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE,
            (trashBlock.x + i) * destTileSize, (trashBlock.y + j) * destTileSize, destTileSize, destTileSize);
        }

        accumulatedPopAge += trashBlock.popTimePerBlock;
      }
    }
  }

  _drawNormalTrashBlock(context, rect, destTileSize) {
    let trashWidth = rect.width;
    let trashHeight = rect.height;

    for (let i = 0; i < trashWidth; i++) {
      for (let j = 0; j < trashHeight; j++) {
        let hl = i == 0;
        let hr = i == trashWidth - 1;
        let hc = !hl && !hr;

        let vt = j == 0;
        let vb = j == trashHeight - 1;
        let vc = !vt && !vb;

        let spriteIndex = spriteMap[hc + 2 * hr][vc + 2 * vb];
        if (trashHeight == 1) {
          spriteIndex = [hc + 3 * hr, 0]
        }

        const xFromCenter = trashWidth / 2 - i;
        const yFromCenter = trashHeight / 2 - j;
        if (xFromCenter >= 0 && xFromCenter <= 0.5 && yFromCenter >= 0 && yFromCenter <= 0.5) {
          //Trash face
          if (trashHeight == 1) {
            spriteIndex = [2, 0];
          } else {
            spriteIndex = [2, 1];
          }
        }

        context.drawImage(image,
          spriteIndex[0] * TILE_SIZE, spriteIndex[1] * TILE_SIZE,
          TILE_SIZE, TILE_SIZE,
          (rect.x + i) * destTileSize, (rect.y +  j) * destTileSize,
          destTileSize, destTileSize);
      }
    }
  }
}

export { TrashRenderer }