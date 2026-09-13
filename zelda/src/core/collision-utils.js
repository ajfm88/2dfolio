export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Up(0)↔Down(1), Left(2)↔Right(3) — XOR with 1
export function getOppositeDirection(dir) {
  return (dir ^ 1);
}
