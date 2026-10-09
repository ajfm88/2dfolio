import './styles/perf-readout.css';

import { createFrameStats } from '../core/frame-stats.js';
import { el } from './dom.js';

/**
 * The only URL parameter the game reads. Only its presence matters.
 * @returns {boolean}
 */
export function perfRequested() {
  return new URLSearchParams(window.location.search).has('perf');
}

/**
 * Mount the frame-time readout on `root` (the app root, outside `#ui`).
 * @param {HTMLElement} root
 * @returns {{ sample: (workMs: number, intervalMs: number) => void }}
 */
export function createPerfReadout(root) {
  const node = el('div', { class: 'perf-readout' });
  root.append(node);
  const stats = createFrameStats(120);
  const out = { avgWork: 0, maxWork: 0, fps: 0, count: 0 };
  let samples = 0;

  // This function is created once. The string below is allocated only while
  // ?perf is on, because the readout itself is not created without the flag.
  function sample(workMs, intervalMs) {
    stats.push(workMs, intervalMs);
    samples += 1;
    if (samples % 30 !== 0) return;
    stats.summarize(out);
    node.textContent = `${out.avgWork.toFixed(1)} ms avg · ${out.maxWork.toFixed(1)} max · ${Math.round(out.fps)} fps`;
  }

  return { sample };
}
