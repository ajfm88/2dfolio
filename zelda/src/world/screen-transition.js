import { SCREEN_WIDTH, PLAY_AREA_HEIGHT } from '../core/constants.js';
import { Direction } from '../core/types.js';

// NES overworld scroll speed: 4px/frame (Z_05.asm ScrollWorld)
const SCROLL_SPEED = 4;

export class ScreenTransition {
   direction;
   oldScreen;
   newScreen;

   offset = 0;
    totalDistance;

  constructor(direction, oldScreen, newScreen) {
    this.direction = direction;
    this.oldScreen = oldScreen;
    this.newScreen = newScreen;
    this.totalDistance = isHorizontal(direction) ? SCREEN_WIDTH : PLAY_AREA_HEIGHT;
  }

  update() {
    if (this.offset < this.totalDistance) {
      this.offset = Math.min(this.offset + SCROLL_SPEED, this.totalDistance);
    }
  }

  get done() {
    return this.offset >= this.totalDistance;
  }

  get scrollOffset() {
    return this.offset;
  }

  getOldScreenOffset() {
    switch (this.direction) {
      case Direction.Right: return { x: -this.offset, y: 0 };
      case Direction.Left:  return { x: this.offset, y: 0 };
      case Direction.Down:  return { x: 0, y: -this.offset };
      case Direction.Up:    return { x: 0, y: this.offset };
    }
  }

  getNewScreenOffset() {
    switch (this.direction) {
      case Direction.Right: return { x: SCREEN_WIDTH - this.offset, y: 0 };
      case Direction.Left:  return { x: -SCREEN_WIDTH + this.offset, y: 0 };
      case Direction.Down:  return { x: 0, y: PLAY_AREA_HEIGHT - this.offset };
      case Direction.Up:    return { x: 0, y: -PLAY_AREA_HEIGHT + this.offset };
    }
  }
}

export function isHorizontal(dir) {
  return dir === Direction.Left || dir === Direction.Right;
}
