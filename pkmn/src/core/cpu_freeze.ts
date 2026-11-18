// PlayPikachuSoundClip (audio/pikachu_pcm.asm:23-92) plays its whole clip between `di` and `ei`, in a loop that
// does nothing but write samples. For that span no VBlank is serviced (home/vblank.asm: no BG transfer, OAM,
// Random, ReadJoypad, frame counter or audio update) and no other code runs: the picture, the music and every
// program stand still while Pikachu speaks. The clip's owner calls freezeFrames(); main takes one frozen frame
// per tick, before anything else. The frame after the last frozen one is serviced normally: it is the VBlank that
// came due with interrupts off, which the cartridge services as soon as `ei` takes effect (note 113 §2.3).

let frozen = 0;

/** The next `frames` frames have no VBlank and run no code. A second call replaces the count. */
export function freezeFrames(frames: number): void {
  if (!Number.isInteger(frames) || frames < 0) throw new Error(`cannot freeze ${frames} frames`);
  frozen = frames;
}

/** main, before the joypad: the coming frame is frozen. */
export function isCpuFrozen(): boolean { return frozen > 0; }

/** main's tick, once per frame, before any VBlank work: true means this frame is frozen. */
export function takeFrozenFrame(): boolean {
  if (frozen === 0) return false;
  frozen -= 1;
  return true;
}

/** Test isolation. */
export function resetCpuFreeze(): void { frozen = 0; }
