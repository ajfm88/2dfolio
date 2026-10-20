// hSpriteIndex and hTextID alias the same HRAM byte ($ff8c). Deliberately transient:
// a turn-in-place encounter uses the last writer; a land step usually clears it.
let spriteIndex = 0;
export function getSpriteIndex(): number { return spriteIndex; }
export function setSpriteIndex(value: number): void { spriteIndex = value & 0xff; }
