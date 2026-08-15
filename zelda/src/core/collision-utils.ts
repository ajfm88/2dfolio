import { Direction, type Rect } from './types.js';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Up(0)↔Down(1), Left(2)↔Right(3) — XOR with 1
export function getOppositeDirection(dir: Direction): Direction {
  return (dir ^ 1) as Direction;
}
