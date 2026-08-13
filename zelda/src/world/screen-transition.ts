import { SCREEN_WIDTH, PLAY_AREA_HEIGHT } from '../core/constants.js';
import { Direction } from '../core/types.js';
import type { OverworldScreen } from '../data/overworld-types.js';

// NES overworld scroll speed: 4px/frame (Z_05.asm ScrollWorld)
const SCROLL_SPEED = 4;

export class ScreenTransition {
  readonly direction: Direction;
  readonly oldScreen: OverworldScreen;
  readonly newScreen: OverworldScreen;

  private offset = 0;
  private readonly totalDistance: number;

  constructor(direction: Direction, oldScreen: OverworldScreen, newScreen: OverworldScreen) {
    this.direction = direction;
    this.oldScreen = oldScreen;
    this.newScreen = newScreen;
    this.totalDistance = isHorizontal(direction) ? SCREEN_WIDTH : PLAY_AREA_HEIGHT;
  }

  update(): void {
    if (this.offset < this.totalDistance) {
      this.offset = Math.min(this.offset + SCROLL_SPEED, this.totalDistance);
    }
  }

  get done(): boolean {
    return this.offset >= this.totalDistance;
  }

  get scrollOffset(): number {
    return this.offset;
  }

  getOldScreenOffset(): { x: number; y: number } {
    switch (this.direction) {
      case Direction.Right: return { x: -this.offset, y: 0 };
      case Direction.Left:  return { x: this.offset, y: 0 };
      case Direction.Down:  return { x: 0, y: -this.offset };
      case Direction.Up:    return { x: 0, y: this.offset };
    }
  }

  getNewScreenOffset(): { x: number; y: number } {
    switch (this.direction) {
      case Direction.Right: return { x: SCREEN_WIDTH - this.offset, y: 0 };
      case Direction.Left:  return { x: -SCREEN_WIDTH + this.offset, y: 0 };
      case Direction.Down:  return { x: 0, y: PLAY_AREA_HEIGHT - this.offset };
      case Direction.Up:    return { x: 0, y: -PLAY_AREA_HEIGHT + this.offset };
    }
  }
}

export function isHorizontal(dir: Direction): boolean {
  return dir === Direction.Left || dir === Direction.Right;
}
