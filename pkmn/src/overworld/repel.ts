// wRepelRemainingSteps is transient WRAM, outside the saved data range.
let remaining = 0;

export function setRepelSteps(steps: number): void { remaining = steps; }
export function getRepelSteps(): number { return remaining; }
export function advanceRepel(blocked: boolean): 'blocked' | 'active' | 'expired' {
  if (blocked) return 'blocked';
  if (remaining > 0 && --remaining === 0) return 'expired';
  return 'active';
}
