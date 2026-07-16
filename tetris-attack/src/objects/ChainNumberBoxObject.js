import { GameObject } from "./gameObject.js";

const TILE_SIZE = 16;

const image = new Image();
image.src = "src/chainSprites.png";

export class ChainNumberBoxObject extends GameObject {
  constructor({boardX = 0, boardY = 0, lifetime = 50, number = 1} = {}) {
    super();
    this.boardX = boardX;
    this.boardY = boardY;
    this.number = Math.min(number, 13);
    this.lifetime = lifetime;
    this.age = 0;
  }

  tick() {
    this.age ++;
  }

  shouldDie() {
    return this.age >= this.lifetime;
  }

  draw(renderer) {
    if( this.age < 5) {
      return;
    }

    const easeIn = Math.exp( -0.1 * (this.age - 5));

    const TS = renderer.tileSize();

    const spriteIndex = this.number - 2;

    const x = TS * this.boardX;
    const y = TS * this.boardY + (easeIn - 1) * TS;
    const width = TS;
    const height = TS;
    
    renderer.canvasCtx.drawImage(image, spriteIndex * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x, y, width, height);
  }
}
