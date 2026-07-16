import { BLOCK_STATE_FALLING, BLOCK_STATE_POPPING, BLOCK_STATE_NORMAL } from './board.js';

const image = new Image();
image.src = "src/sprites.png";

const TILE_SIZE = 16;

class SpriteRenderer {
  render(context, spriteIndex, x, y, width, height, frameNumber, block, bottomRow) {

    let spriteFrame = 0;

    switch (block.state()) {
      case BLOCK_STATE_NORMAL:
        spriteFrame = 0;
        break;

      case BLOCK_STATE_FALLING:
        {
          spriteFrame = Math.floor((frameNumber + spriteIndex * 13) / 3) % 8;
          if (spriteFrame >= 4) {
            spriteFrame = 8 - spriteFrame - 1;
          }
        }
        break;

      case BLOCK_STATE_POPPING:
        spriteFrame = Math.floor(frameNumber / 6) % 2 == 0 ? 0 : 6;
        if (block.popTime() - block.popAge() < 40) {
          spriteFrame = 5;
        }
        if(block.popAge() > block.disapearAge()) {
          spriteFrame = 9999;
        }
        break;
    }
    if (bottomRow) {
      spriteFrame = 4;
    }

    const yOffset = spriteFrame * TILE_SIZE;
    context.drawImage(image, spriteIndex * TILE_SIZE, yOffset, TILE_SIZE, TILE_SIZE, x, y, width, height);
  }
}

export { SpriteRenderer }