import { GameObject } from "./gameObject.js";

const TILE_SIZE = 16;

const image = new Image();
image.src = "src/comboSprites.png";

export class ComboNumberBoxObject extends GameObject {
  constructor({boardX = 0, boardY = 0, lifetime = 50, number = 4} = {}) {
    super();
    this.boardX = boardX;
    this.boardY = boardY;
    this.number = number;
    this.lifetime = lifetime;
    this.age = 0;
  }

  tick() {
    this.age ++;
  }

  shouldDie() {
    return this.age >= this.lifetime;
  }

  // https://stackoverflow.com/a/7838871
  _roundedRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
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
