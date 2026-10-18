// AnimateHealingMachine (engine/overworld/healing_machine.asm); trace: note 59 §12.
import { getActivePalette, getCtx, getScale, loadSpriteMapped, obpMapping } from '../renderer';

export interface HealingMachineAudio {
  preloadMusic(name: string): Promise<void> | void;
  fadeOutAndStopMusic(control: number): void;
  isAudioFadingOut(): boolean;
  playSFX(name: string): Promise<void> | void;
  playMusic(name: string): Promise<void> | void;
  isMusicChannelActive(id: number): boolean;
}

// OAM X−8, Y−16, then the scene's existing −4 Y offset. No nurse/camera lookup.
const ENTRIES = [
  { x: 44, y: 16, tile: 0, flip: false },
  { x: 40, y: 23, tile: 1, flip: false }, { x: 48, y: 23, tile: 1, flip: true },
  { x: 40, y: 28, tile: 1, flip: false }, { x: 48, y: 28, tile: 1, flip: true },
  { x: 40, y: 33, tile: 1, flip: false }, { x: 48, y: 33, tile: 1, flip: true },
] as const;

type Phase = 'copy' | 'fade' | 'balls' | 'flash' | 'jingle' | 'tail' | 'done';

/** Load both OBJ palette variants with the map, before the one-frame tile-copy window. */
export async function preloadHealingMachineGraphics(): Promise<void> {
  const palette = getActivePalette();
  await Promise.all([0xe0, 0xc8].map(reg =>
    loadSpriteMapped('/gfx/overworld/heal_machine.png', obpMapping(reg), palette)));
}

export class HealingMachineSession {
  private phase: Phase = 'copy';
  private delay = 0;
  private balls = 0;
  private flashes = 0;
  private shadowEntries = 0;
  private visibleEntries = 0;
  private obp1 = 0xe0;
  private jingleReady = false;
  private readonly art = new Map<number, HTMLCanvasElement>();
  private readonly count: number;

  constructor(partyCount: number, private readonly audio: HealingMachineAudio,
    private readonly savedObp1 = 0xe0) { // FadePal4's normal overworld OBP1
    // Yellow's zero-party loop underflows to 256; unreachable after the starter gift.
    this.count = Math.min(Math.max(partyCount, 0), 6);
    if (!this.count) { this.phase = 'done'; return; }
    void audio.preloadMusic('pkmnhealed');
    const palette = getActivePalette();
    for (const reg of new Set([0xe0, 0xc8, savedObp1])) {
      void loadSpriteMapped('/gfx/overworld/heal_machine.png', obpMapping(reg), palette)
        .then(image => { this.art.set(reg, image); });
    }
    // H has already had its VBlank; the first frame() is H+1 (one tile-copy wait).
  }

  get done(): boolean { return this.phase === 'done'; }
  get visible(): boolean { return this.visibleEntries !== 0; }

  /** One VBlank/CPU frame. Continue for two frames after done to model OAM cleanup. */
  frame(): 'busy' | 'done' {
    this.visibleEntries = this.shadowEntries; // DMA precedes CPU writes and PrepareOAMData.
    if (this.done) { this.shadowEntries = 0; return 'done'; }
    if (this.phase === 'copy') {
      this.shadowEntries = 1;
      this.audio.fadeOutAndStopMusic(4);
      this.phase = 'fade';
    }
    if (this.phase === 'fade') {
      if (this.audio.isAudioFadingOut()) return 'busy';
      return this.placeBall();
    }
    if (this.phase === 'balls') {
      if (--this.delay > 0) return 'busy';
      if (this.balls < this.count) return this.placeBall();
      const playing = this.audio.playMusic('pkmnhealed');
      this.jingleReady = this.audio.isMusicChannelActive(1) || !playing;
      if (playing) void playing.then(() => { this.jingleReady = true; });
      this.obp1 = 0xc8; // First of eight XORs happens in the call frame.
      this.flashes = 8; this.delay = 10; this.phase = 'flash';
      return 'busy';
    }
    if (this.phase === 'flash') {
      if (--this.delay > 0) return 'busy';
      if (--this.flashes > 0) {
        this.obp1 ^= 0x28; this.delay = 10; return 'busy';
      }
      this.phase = 'jingle';
    }
    if (this.phase === 'jingle') {
      if (!this.jingleReady || this.audio.isMusicChannelActive(1)) return 'busy';
      this.delay = 32; this.phase = 'tail'; return 'busy';
    }
    if (--this.delay > 0) return 'busy';
    this.obp1 = this.savedObp1;
    this.phase = 'done'; // Caller updates sprites, heals and restarts map music this tick.
    return 'done';
  }

  private placeBall(): 'busy' {
    this.balls++; this.shadowEntries++;
    void this.audio.playSFX('healing_machine');
    this.delay = 30; this.phase = 'balls'; return 'busy';
  }

  /** Pure draw: OAM scanout and palette change only in frame(), never during render(). */
  render(): void {
    if (!this.visibleEntries) return;
    const image = this.art.get(this.obp1);
    if (!image) return;
    const ctx = getCtx(), scale = getScale();
    for (const entry of ENTRIES.slice(0, this.visibleEntries)) {
      ctx.save();
      ctx.translate((entry.x + (entry.flip ? 8 : 0)) * scale, entry.y * scale);
      if (entry.flip) ctx.scale(-1, 1);
      ctx.drawImage(image, 0, entry.tile * 8, 8, 8, 0, 0, 8 * scale, 8 * scale);
      ctx.restore();
    }
  }
}
