const image = new Image();
image.src = "src/trashSprites.png";

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
  render(context, trashBlock, x, y, destTileSize) {

    let trashWidth = trashBlock.width;
    let trashHeight = trashBlock.height;

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
          x + (destTileSize * i), y + (destTileSize * j),
          destTileSize, destTileSize);
      }
    }
  }
}

export { TrashRenderer }