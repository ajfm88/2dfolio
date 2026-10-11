import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaveTextData } from '../../src/data/cave-text-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '../../src/data/cave-text.json');

function loadCaveText(): CaveTextData {
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as CaveTextData;
}

describe('cave-text.json', () => {
  const data = loadCaveText();

  it('has 38 messages', () => {
    expect(data.messages.length).toBe(38);
  });

  it('each message has index, textSelector, and lines', () => {
    for (const msg of data.messages) {
      expect(typeof msg.index).toBe('number');
      expect(typeof msg.textSelector).toBe('number');
      expect(msg.textSelector).toBe(msg.index * 2);
      expect(Array.isArray(msg.lines)).toBe(true);
      expect(msg.lines.length).toBeGreaterThan(0);
    }
  });

  it('message 0 is the sword cave text', () => {
    const msg = data.messages[0]!;
    expect(msg.lines.join(' ')).toContain('DANGEROUS');
    expect(msg.lines.join(' ')).toContain('TAKE THIS');
  });

  it('message 5 is the door repair text', () => {
    const msg = data.messages[5]!;
    expect(msg.lines.join(' ')).toContain('DOOR');
    expect(msg.lines.join(' ')).toContain('REPAIR');
  });

  it('message 17 is the moblin secret text', () => {
    const msg = data.messages[17]!;
    expect(msg.lines.join(' ')).toContain('SECRET');
    expect(msg.lines.join(' ')).toContain('EVERYBODY');
  });

  it('message 3 has the dead-end hint with hyphen', () => {
    const msg = data.messages[3]!;
    expect(msg.lines.join(' ')).toContain('DEAD-END');
  });

  it('all lines contain only printable characters', () => {
    for (const msg of data.messages) {
      for (const line of msg.lines) {
        expect(line).toMatch(/^[A-Z0-9 ',!?\-.]+$/);
      }
    }
  });

  it('no message exceeds 3 lines', () => {
    for (const msg of data.messages) {
      expect(msg.lines.length).toBeLessThanOrEqual(3);
    }
  });

  it('known hint messages are present', () => {
    const allText = data.messages.map(m => m.lines.join(' ')).join('\n');
    expect(allText).toContain('DODONGO DISLIKES SMOKE');
    expect(allText).toContain('EASTMOST PENNINSULA');
    expect(allText).toContain('SPECTACLE ROCK');
    expect(allText).toContain('GRUMBLE,GRUMBLE');
    expect(allText).toContain('DIGDOGGER');
  });
});
