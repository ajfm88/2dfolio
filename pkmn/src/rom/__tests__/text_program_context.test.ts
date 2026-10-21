// Synthetic command streams isolate the row cache and operand validation without a ROM or refs.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinaryReader } from '../binary_reader';
import { createTextOperandBindings } from '../extractors/text_programs';

type Symbols = readonly (readonly [string, number, number, boolean])[];
afterEach(() => { vi.doUnmock('../text_program_symbols'); vi.resetModules(); });

async function extract(bytes: [number, number[]][], symbols: Symbols) {
  vi.resetModules();
  vi.doMock('../text_program_symbols', () => ({ TEXT_PROGRAM_SYMBOLS: symbols, TEXT_POINTER_TABLES: [] }));
  const { extractTextPrograms } = await import('../extractors/text_programs');
  const buffer = new ArrayBuffer(0x1000);
  for (const [at, code] of bytes) new Uint8Array(buffer).set(code, at);
  return extractTextPrograms(new BinaryReader(buffer));
}
const far = (address: number): number[] => [0x17, address & 255, address >> 8, 0];

describe('text operand table validation', () => {
  it('allows $CF4A to hold different meanings under RAM and decimal', () => {
    const bindings = createTextOperandBindings([['ram', 0xCF4A, 'stringBuffer'], ['decimal', 0xCF4A, 'expAmountGained']]);
    expect(bindings.get('ram:53066')).toBe('stringBuffer');
    expect(bindings.get('decimal:53066')).toBe('expAmountGained');
  });
  it('rejects different meanings at the same address and opcode', () => {
    expect(() => createTextOperandBindings([['ram', 0xCF4A, 'stringBuffer'], ['ram', 0xCF4A, 'enemyMonNick']]))
      .toThrow('Ambiguous text ram operand $cf4a');
  });
  it('allows identical declarations without treating them as competing meanings', () => {
    expect(createTextOperandBindings([['ram', 0xCF4A, 'stringBuffer'], ['ram', 0xCF4A, 'stringBuffer']]).size).toBe(1);
  });
});

describe('text row-context extraction', () => {
  const symbols: Symbols = [
    ['First', 0, 0x100, true], ['Second', 0, 0x110, true], ['UnknownRow', 0, 0x140, true],
    ['Again', 0, 0x150, true], ['Shared', 0, 0x120, false],
    ['FirstTail', 0, 0x160, false], ['SecondTail', 0, 0x170, false],
    ['UnknownTail', 0, 0x180, false], ['AgainTail', 0, 0x190, false],
  ];
  const prefix: [number, number[]][] = [
    [0x100, [...far(0x120), ...far(0x160), 0x50]],
    [0x110, [0, 0x4f, 0x50, ...far(0x120), ...far(0x120), ...far(0x170), 0x50]],
    [0x140, [3, 0xa0, 0xc3, ...far(0x120), ...far(0x120), ...far(0x180), 0x50]],
    [0x150, [...far(0x120), ...far(0x190), 0x50]],
    ...[0x160, 0x170, 0x180, 0x190].map(at => [at, [0, 0x4f, 0x80, 0x57]] as [number, number[]]),
  ];
  it('shares identical ops while returning each incoming row, including cached and unknown-row returns', async () => {
    const file = await extract([...prefix, [0x120, [0, 0x97, 0x50, 0x50]]], symbols);
    expect(file.programs.Shared).toEqual([{ op: 'text', text: 'X' }]);
    expect(file.programs.FirstTail).toEqual([{ op: 'text', text: '\nA<DONE>' }]);
    expect(file.programs.SecondTail).toEqual([{ op: 'text', text: '<LINE>A<DONE>' }]);
    expect(file.programs.UnknownTail).toEqual([{ op: 'text', text: '<LINE>A<DONE>' }]);
    expect(file.programs.AgainTail).toEqual([{ op: 'text', text: '\nA<DONE>' }]);
  });
  it('rejects a shared label whose decoded text differs between incoming rows', async () => {
    await expect(extract([...prefix, [0x120, [0, 0x4f, 0x97, 0x50, 0x50]]], symbols))
      .rejects.toThrow('Shared: different text ops for incoming row 2');
  });
  it('propagates a child cursor change, both when first decoded and when returned from the cache', async () => {
    const file = await extract([...prefix, [0x120, [7, 0x50]]], symbols);
    expect(file.programs.Shared).toEqual([{ op: 'scroll' }]);
    for (const label of ['FirstTail', 'SecondTail', 'UnknownTail', 'AgainTail'])
      expect(file.programs[label]).toEqual([{ op: 'text', text: '<LINE>A<DONE>' }]);
  });
  it('still rejects a FAR cycle', async () => {
    await expect(extract([[0x100, [...far(0x100), 0x50]]], [['Cycle', 0, 0x100, true]]))
      .rejects.toThrow('text_far cycle through Cycle');
  });
  it('rejects a known address under the wrong operand opcode', async () => {
    await expect(extract([[0x100, [9, 0x6d, 0xcd, 0x23, 0x50]]], [['WrongOp', 0, 0x100, true]]))
      .rejects.toThrow('Unbound text decimal operand $cd6d');
  });
});
