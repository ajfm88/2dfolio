export class FpsCounter {
   frames = 0;
   lastSampleTime = 0;
   currentFps = 0;
   initialized = false;
    sampleInterval;

  constructor(sampleInterval = 1000) {
    this.sampleInterval = sampleInterval;
  }

  get fps() {
    return this.currentFps;
  }

  tick(now) {
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

  reset() {
    this.frames = 0;
    this.lastSampleTime = 0;
    this.currentFps = 0;
    this.initialized = false;
  }
}
