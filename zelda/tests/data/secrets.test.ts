import { describe, it, expect } from 'vitest';
import secretsData from '../../src/data/secrets.json';

describe('secrets.json', () => {
  it('has 128 quest secret entries', () => {
    expect(secretsData.questSecretByScreen).toHaveLength(128);
  });

  it('has 128 shortcut position index entries', () => {
    expect(secretsData.shortcutPositionIndexByScreen).toHaveLength(128);
  });

  it('has 4 shortcut positions', () => {
    expect(secretsData.shortcutPositions).toHaveLength(4);
  });

  it('all quest secret values are 0, 1, or 2', () => {
    for (const val of secretsData.questSecretByScreen) {
      expect([0, 1, 2]).toContain(val);
    }
  });

  it('all shortcut position indices are 0-3', () => {
    for (const val of secretsData.shortcutPositionIndexByScreen) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(3);
    }
  });

  it('shortcut positions have valid x and y coordinates', () => {
    for (const pos of secretsData.shortcutPositions) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(240);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(176);
    }
  });

  it('has some screens with quest-specific secrets', () => {
    const nonZero = secretsData.questSecretByScreen.filter(v => v !== 0);
    expect(nonZero.length).toBeGreaterThan(0);
  });

  it('shortcut positions match expected NES values', () => {
    // From LevelInfoOW at offset 41: 4 packed bytes
    expect(secretsData.shortcutPositions[0]).toEqual({ x: 80, y: 112 });
    expect(secretsData.shortcutPositions[1]).toEqual({ x: 64, y: 144 });
    expect(secretsData.shortcutPositions[2]).toEqual({ x: 144, y: 144 });
    expect(secretsData.shortcutPositions[3]).toEqual({ x: 96, y: 144 });
  });
});
