// CheckSpriteAvailability (engine/overworld/movement.asm). Coordinates in steps.
export function inSpriteWindow(npcX: number, npcY: number, playerX: number, playerY: number, scripted = false): boolean {
  return scripted || (npcX >= playerX - 4 && npcX <= playerX + 5 && npcY >= playerY - 4 && npcY <= playerY + 4);
}

/** GetTileSpriteStandsOn aligns Y with +4 before examining the 2×2 footprint. */
export function spriteCovered(screenX: number, screenY: number, tileAt: (x: number, y: number) => number): boolean {
  const x = Math.floor(screenX / 8);
  const y = Math.floor((screenY + 4) / 8);
  return tileAt(x, y) >= 0x60 || tileAt(x + 1, y) >= 0x60 ||
    tileAt(x, y + 1) >= 0x60 || tileAt(x + 1, y + 1) >= 0x60;
}

/**
 * WillPikachuSpawnOnTheScreen .GetNPCCurrentTile: Pikachu's own footprint test, from its
 * screen pixels (XPIXELS/YPIXELS, bounce included). Rows from (Y + 4) & $f0, columns from
 * (X + 2) >> 3, as bytes — not the NPC rule above. Any of the four tiles at $60 or more
 * (UI) hides the whole sprite.
 */
export function pikachuCovered(gbX: number, gbY: number, tileAt: (x: number, y: number) => number): boolean {
  const row = (((gbY + 4) & 0xff) & 0xf0) >> 3;
  const col = ((gbX + 2) & 0xff) >> 3;
  return tileAt(col, row) >= 0x60 || tileAt(col + 1, row) >= 0x60 ||
    tileAt(col, row + 1) >= 0x60 || tileAt(col + 1, row + 1) >= 0x60;
}

/** IMAGEINDEX=$ff remains latched until a standing UpdateSprites refreshes it. */
export class SpriteVisibility {
  visible = false;

  update(available: boolean, playerWalking: boolean): void {
    if (!available) this.visible = false;
    else if (!playerWalking) this.visible = true;
  }
}
