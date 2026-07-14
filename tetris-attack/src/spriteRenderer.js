const image = new Image();
image.src = "src/sprites.png"

const TILE_SIZE = 16;
const TILE_MARGIN = 3;

class SpriteRenderer {
  render(context, spriteIndex, x, y, width, height, frameNumber, falling) {
    var spriteFrame = Math.floor((frameNumber + spriteIndex * 13) / 3) % 8;
    if (spriteFrame >= 4) {
      spriteFrame = 8 - spriteFrame - 1;
    }
    if (!falling) {
      spriteFrame = 0;
    }
    const yOffset = spriteFrame * (TILE_SIZE + TILE_MARGIN);
    context.drawImage(image, spriteIndex * (TILE_SIZE + TILE_MARGIN), yOffset, TILE_SIZE, TILE_SIZE, x, y, width, height);
  }
}

export { SpriteRenderer }