import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { decodeMapText, decodeText } from '../extractors/text';
import { extractGameText } from '../extractors/game_text';
import { extractAllMaps } from '../extractors/maps';
import { readItemNames, readTrainerClassNames } from '../extractors/text';
import { tokenizeText } from '../../text/text_printer';

function decode(bytes: number[], opts?: { terminators?: boolean; trim?: boolean }): string {
  return decodeMapText(new BinaryReader(Uint8Array.from(bytes).buffer), 0, bytes.length, opts);
}
describe('cartridge text decoding', () => {
  it('preserves prompt, while done and string termination return immediately', () => {
    expect(decode([0, 0x80, 0x58])).toBe('A<PROMPT>');
    expect(decode([0x80, 0x57])).toBe('A'); expect(decode([0x80, 0x50])).toBe('A');
  });
  it('keeps readable newlines where line/next/cont have their inferred meaning', () => {
    expect(decode([0x80, 0x4F, 0x81, 0x55, 0x82, 0x51, 0x83, 0x4E, 0x84, 0x57]))
      .toBe('A\nB\nC\fD\nE');
  });
  it.each([[0x55, '<CONT>'], [0x4B, '<CONT>']])('preserves explicit first-row cont ($%i)', (code, token) => {
    expect(decode([0x80, 0x51, 0x81, code, 0x82, 0x57])).toBe(`A\fB${token}C`);
  });
  it('preserves second-row line and next instead of silently scrolling', () => {
    expect(decode([0x80, 0x4F, 0x81, 0x4F, 0x82, 0x4E, 0x83, 0x57])).toBe('A\nB<LINE>C<NEXT>D');
  });
  it('decodes contractions, extra-font characters and expanded PK/MN glyphs', () => {
    expect(decode([0xBB, 0xBC, 0xBD, 0xBE, 0xBF, 0xE4, 0xE5, 0x70, 0x71, 0x72, 0x73, 0x75, 0x56, 0xE1, 0xE2, 0x4A, 0x57]))
      .toBe("'d'l's't'v'r'm‘’“”………\uE001\uE002\uE001\uE002");
  });
  it('throws for an unmapped byte, including an accidental inline TX_START', () => {
    expect(() => decode([0x80, 0x76, 0x57])).toThrow('Unmapped text byte $76 at ROM $1');
    expect(() => decode([0x80, 0, 0x57])).toThrow('Unmapped text byte $0');
    expect(() => decodeText(new BinaryReader(Uint8Array.from([0x76, 0x50]).buffer), 0)).toThrow('Unmapped');
  });
  it('script migration option omits terminators and retains whitespace', () => {
    expect(decode([0, 0x80, 0x7F, 0x58], { terminators: false, trim: false })).toBe('A ');
    expect(decode([0, 0x80, 0x7F, 0x58])).toBe('A<PROMPT>');
  });
});

const romPath = process.env.ROM_PATH;
const asmRoot = resolve(__dirname, '../../../../refs/pokeyellow');
describe.skipIf(!romPath)('A5a ROM text invariants', () => {
  const getRom = () => {
    const bytes = readFileSync(resolve(romPath!));
    return new BinaryReader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  };
  // A5b1 (DECISIONS #45): texts ending in `prompt` keep their <PROMPT>; with it removed,
  // game_text.json is still the approved pre-A5a baseline byte for byte.
  it('game_text.json differs from the pre-A5a baseline only by trailing <PROMPT>s', () => {
    const text = extractGameText(getRom());
    const body = Object.values(text).map(v => v.replace(/<PROMPT>$/, ''));
    expect(body.filter(v => /<(PROMPT|DONE)>/.test(v))).toEqual([]);
    const stripped = Object.fromEntries(Object.entries(text).map(([k, v]) => [k, v.replace(/<PROMPT>$/, '')]));
    const data = JSON.stringify(stripped, null, 2) + '\n';
    expect(createHash('sha256').update(data).digest('hex'))
      .toBe('d3e4aa2ae5e9edfd1e3e1643c30a8b1519f9520606a8d5c467271808443bf643');
  });
  it('every extracted map line fits eighteen cartridge glyphs and has no unnecessary tokens', () => {
    const rom = getRom();
    const maps = extractAllMaps(rom, readItemNames(rom), readTrainerClassNames(rom));
    for (const map of Object.values(maps)) {
      const texts = [...map.signs.map(s => s.text), ...map.npcs.flatMap(n => [n.dialogue, n.endBattleText ?? '', n.afterBattleText ?? '']),
        ...(map.hiddenEvents ?? []).map(e => e.text ?? '')];
      for (const text of texts.filter(t => t && !t.startsWith('__'))) {
        expect(text).not.toMatch(/<(CONT|LINE|NEXT)>/);
        // Names are encoded tokens in the ROM (at most seven glyphs).
        const literal = text.replace(/<(PLAYER|RIVAL)>/g, 'AAAAAAA').replace(/<PROMPT>$/, '');
        for (const line of literal.split(/[\n\f]/)) expect(tokenizeText(line).length, `${map.name}: ${line}`).toBeLessThanOrEqual(18);
      }
    }
  });
  it.skipIf(!existsSync(asmRoot))('all extracted map texts reproduce the disassembly controls and terminators', () => {
    const candidates = new Set<string>();
    for (const folder of ['text', 'data/text']) {
      for (const file of readdirSync(resolve(asmRoot, folder)).filter(f => f.endsWith('.asm'))) {
        const source = readFileSync(resolve(asmRoot, folder, file), 'utf8');
        for (const block of source.split(/^\w[^\n]*::?/m)) {
          let result = ''; let row = 1; let writing = false;
          for (const line of block.split('\n')) {
            const match = line.match(/^\s*(text|line|cont|next|para)\s+"([^"]*)"/);
            if (match) {
              const [, macro, raw] = match;
              if (macro === 'line') { result += row === 1 ? '\n' : '<LINE>'; row = 2; }
              if (macro === 'next') { result += row === 1 ? '\n' : '<NEXT>'; row++; }
              if (macro === 'cont') { result += row === 2 ? '\n' : '<CONT>'; row = 2; }
              if (macro === 'para') { result += '\f'; row = 1; }
              writing = true;
              result += raw.replace(/@$/, '').replace(/#/g, 'POKé').replace(/<PKMN>/g, '\uE001\uE002')
                .replace(/<PK>/g, '\uE001').replace(/<MN>/g, '\uE002').replace(/<……>/g, '……');
              if (raw.endsWith('@')) break;
            }
            if (/^\s*prompt\b/.test(line)) { result += '<PROMPT>'; break; }
            if (/^\s*(done|text_end)\b/.test(line)) break;
          }
          if (writing) candidates.add(result.replace(/ +(?=<PROMPT>$|$)/gm, ''));
        }
      }
    }
    const rom = getRom(); const maps = extractAllMaps(rom, readItemNames(rom), readTrainerClassNames(rom));
    for (const map of Object.values(maps)) {
      for (const text of [...map.signs.map(s => s.text), ...map.npcs.flatMap(n => [n.dialogue, n.endBattleText ?? '', n.afterBattleText ?? '']),
        ...(map.hiddenEvents ?? []).map(e => e.text ?? '')].filter(t => t && !t.startsWith('__'))) {
        expect(candidates.has(text), `${map.name}: ${text}`).toBe(true);
      }
    }
  });
});
