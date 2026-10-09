/**
 * Rolling frame statistics over the last `size` frames.
 * Push and summarize allocate nothing after this function returns.
 * @param {number} size
 */
export function createFrameStats(size) {
  const work = new Float64Array(size);
  const interval = new Float64Array(size);
  let next = 0;
  let count = 0;
  return {
    /** @param {number} workMs @param {number} intervalMs */
    push(workMs, intervalMs) {
      work[next] = workMs;
      interval[next] = intervalMs;
      next += 1;
      if (next === size) next = 0;
      if (count < size) count += 1;
    },
    /**
     * @param {{ avgWork: number, maxWork: number, fps: number, count: number }} out
     */
    summarize(out) {
      if (count === 0) {
        out.avgWork = 0;
        out.maxWork = 0;
        out.fps = 0;
        out.count = 0;
        return;
      }
      let sumWork = 0;
      let maxWork = 0;
      let sumInterval = 0;
      for (let i = 0; i < count; i++) {
        const sample = work[i];
        sumWork += sample;
        if (sample > maxWork) maxWork = sample;
        sumInterval += interval[i];
      }
      const meanInterval = sumInterval / count;
      out.avgWork = sumWork / count;
      out.maxWork = maxWork;
      out.fps = meanInterval === 0 ? 0 : 1000 / meanInterval;
      out.count = count;
    },
  };
}
