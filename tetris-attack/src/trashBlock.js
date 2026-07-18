export class TrashBlock {

	// x and y represent the top left hand corner of the trash block
  constructor({ x, y, width = 3, height = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  *positions() {
  	for(let i=0; i<this.width; i++) {
  		for(let j=0; j<this.height; j++) {
  			yield [this.x+i, this.y+j];
  		}
  	}
  }
}