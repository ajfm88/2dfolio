import { GameObject } from "./gameObject.js";

const TILE_SIZE = 16;

const image = new Image();
image.src = "src/popParticle.png";

export class ComboPopParticles extends GameObject {
  constructor({boardX = 0, boardY = 0, lifetime = 45} = {}) {
    super();
    this.boardX = boardX;
    this.boardY = boardY;
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
    const TS = renderer.tileSize();

    const easeIn = 1.0 - Math.exp( -0.02 * this.age );
    const distance = TS * 1.0;

    const width = TS / 2;
    const height = TS / 2;

    const x = TS * (this.boardX + 0.5);
    const y = TS * (this.boardY + 0.5);

    const rotationRadians = easeIn * Math.PI * 3.0;

    const dxya = [[1,1,1], [-1,1,-1], [-1,-1,-1], [1,-1,1]];
    for(const [dx, dy, da] of dxya) {
      renderer.canvasCtx.save();

      renderer.canvasCtx.translate(x + dx * easeIn * distance, y + dy * easeIn * distance);
      renderer.canvasCtx.rotate(rotationRadians * -da);
      renderer.canvasCtx.drawImage(image, -TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE * 1.2, TILE_SIZE * 1.2);

      renderer.canvasCtx.restore();
    }
  
    
  }
}
