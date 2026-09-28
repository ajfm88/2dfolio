import { describe, expect, it } from 'vitest';

import { fileNameFor } from './files.js';

describe('fileNameFor', () => {
  it('slugs the level name', () => {
    expect(fileNameFor('Cannon Cove', 'lvl_a')).toBe('cannon-cove.json');
    expect(fileNameFor('  Skull & Bones!! 2 ', 'lvl_a')).toBe('skull-bones-2.json');
  });

  it('falls back to the id when nothing usable is left', () => {
    expect(fileNameFor('', 'lvl_abc')).toBe('lvl_abc.json');
    expect(fileNameFor('★★★', 'lvl_abc')).toBe('lvl_abc.json');
  });

  it('caps the length without a trailing dash', () => {
    const name = `${'a'.repeat(39)} tail`;
    expect(fileNameFor(name, 'x')).toBe(`${'a'.repeat(39)}.json`);
    expect(fileNameFor('b'.repeat(60), 'x')).toBe(`${'b'.repeat(40)}.json`);
  });
});
