export class FpsCounter {
  private frames = 0;
  private lastSampleTime = 0;
  private currentFps = 0;
  private initialized = false;
  private readonly sampleInterval: number;

  constructor(sampleInterval = 1000) {
    this.sampleInterval = sampleInterval;
  }

  get fps(): number {
    return this.currentFps;
  }

  tick(now: number): void {
    if (!this.initialized) {
      this.lastSampleTime = now;
      this.initialized = true;
      return;
    }

    this.frames++;
    const elapsed = now - this.lastSampleTime;
    if (elapsed >= this.sampleInterval) {
      this.currentFps = Math.round((this.frames * 1000) / elapsed);
      this.frames = 0;
      this.lastSampleTime = now;
    }
  }

  reset(): void {
    this.frames = 0;
    this.lastSampleTime = 0;
    this.currentFps = 0;
    this.initialized = false;
  }
}
