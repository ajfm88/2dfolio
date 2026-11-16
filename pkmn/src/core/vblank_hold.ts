// LoadBGMapAttributes (engine/gfx/bg_map_attributes.asm:19-99): with the LCD on, a CGB palette command waits for
// LY $90 twice with interrupts off and clears IF.VBlank before `ei`. Those two frames have no VBlank
// (home/vblank.asm: no BG transfer, OAM, play time, Random or ReadJoypad); UpdateAudioDuringLoadBGMapAttributes
// updates the audio once in each. SendSGBPackets' Delay3 follows (engine/gfx/palettes.asm:717-729). DECISIONS #73.
// The battle has its own hold (BattleScreen.setPalBattle). Outside battle, the screen that runs the command calls
// holdVBlank(); main peeks before VBlank's Random and joypad read; the frame's one VBlank owner takes the frame.

let held = 0;

/** A palette command's CPU work this frame: the next two frames have no VBlank. */
export function holdVBlank(): void { held = 2; }

/** main, before VBlank's work: the coming frame is held. */
export function isVBlankHeld(): boolean { return held > 0; }

/** The frame's VBlank owner, once per frame, in place of its BG transfer: true means this frame is held. */
export function takeHeldFrame(): boolean {
  if (held === 0) return false;
  held -= 1;
  return true;
}

/** Test isolation. */
export function resetVBlankHold(): void { held = 0; }
