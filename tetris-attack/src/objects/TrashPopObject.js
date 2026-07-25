import { GameObject } from "./gameObject.js";

const TILE_SIZE = 16;

const image = new Image();
image.src = "assets/comboSprites.png";

export class TashPopObject extends GameObject {
  constructor({x = 0, y = 0, popTime = 50} = {}) {
    super();
    this.x = x;
    this.y = y;
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

    const spriteIndex = this.number - 4;

    const x = TS * this.boardX;
    const y = TS * this.boardY + (easeIn - 1) * TS;
    const width = TS;
    const height = TS;
    
    renderer.canvasCtx.drawImage(image, spriteIndex * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x, y, width, height);
  }
}
