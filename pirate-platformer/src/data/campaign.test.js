import { describe, expect, it } from 'vitest';

import { deserialise, serialise } from '../level/codec.js';
import { findProblems } from '../maker/validate.js';
import { campaign } from './campaign.js';

describe('campaign', () => {
  it('has five to eight levels with unique ids', () => {
    expect(campaign.length).toBeGreaterThanOrEqual(5);
    expect(campaign.length).toBeLessThanOrEqual(8);
    expect(new Set(campaign.map((entry) => entry.id)).size).toBe(campaign.length);
  });

  for (const entry of campaign) {
    describe(`${entry.id} (${entry.data.name})`, () => {
      // Exactly what Export file writes: nothing hand-added, reordered, or left
      // over from an older shape. Invariant 2 — the campaign is maker levels.
      it('is a canonical maker export', () => {
        expect(JSON.stringify(serialise(deserialise(entry.data)))).toBe(JSON.stringify(entry.data));
      });

      it('passes every playability rule', () => {
        expect(findProblems(deserialise(entry.data))).toEqual([]);
      });

      it('has a name and uses the island theme', () => {
        expect(entry.data.name.length).toBeGreaterThan(0);
        expect(entry.data.theme).toBe('island');
      });
    });
  }
});
