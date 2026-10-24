// A5c1 CP2: the unused battle programs, against ROM operands and the frozen A5b data.
import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractTextPrograms } from '../extractors/text_programs';
import type { TextOp, TextProgramsFile } from '../extractors/text_programs';
import { TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';

const frozen = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/text_programs_a5b_baseline.json'), 'utf8')) as {
  programs: Record<string, string>; textPointers: string;
};
const committed = JSON.parse(readFileSync(resolve(__dirname, '../../../data/text_programs.json'), 'utf8')) as TextProgramsFile;
const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function preservesA5b(file: TextProgramsFile): void {
  expect(Object.keys(frozen.programs)).toHaveLength(633);
  for (const [label, hash] of Object.entries(frozen.programs)) {
    expect(file.programs[label], label).toBeDefined();
    expect(digest(file.programs[label]), label).toBe(hash);
  }
  expect(digest(file.textPointers)).toBe(frozen.textPointers);
}

it('keeps all 633 committed A5b programs and every map text pointer byte-identical', () => preservesA5b(committed));
it('adds exactly 362 programs, leaving link-only and evolution texts out', () => {
  // A5c3d checkpoint-03 adds TrainerEndBattleText and _TrainerNameText to the prior 360.
  expect(Object.keys(committed.programs)).toHaveLength(995);
  expect(Object.keys(committed.programs).filter(label => !(label in frozen.programs))).toHaveLength(362);
  for (const label of ['LinkBattleLostText', '_LinkBattleLostText', 'YouWinText', 'YouLoseText', 'DrawText',
    'EvolvedText', '_EvolvedText', 'IntoText', '_IntoText', 'StoppedEvolvingText', 'IsEvolvingText']) {
    expect(committed.programs).not.toHaveProperty(label);
  }
});

const operandCases: { label: string; relative: number; opcode: number; address: number; expected: TextOp }[] = [
  { label: '_PlayerMonFaintedText', relative: 0, opcode: 1, address: 0xD008, expected: { op: 'ram', binding: 'battleMonNick' } },
  { label: '_WildRanText', relative: 7, opcode: 1, address: 0xCFD9, expected: { op: 'ram', binding: 'enemyMonNick' } },
  { label: '_AIBattleWithdrawText', relative: 0, opcode: 1, address: 0xD049, expected: { op: 'ram', binding: 'trainerName' } },
  { label: '_LearnedMove1Text', relative: 0, opcode: 1, address: 0xD035, expected: { op: 'ram', binding: 'learnMoveMonName' } },
  { label: '_ItemUseBallText07', relative: 0, opcode: 1, address: 0xDE05, expected: { op: 'ram', binding: 'caughtMonNick' } },
  { label: '_GrewLevelText', relative: 20, opcode: 9, address: 0xD126, expected: { op: 'decimal', binding: 'curEnemyLevel', bytes: 1, digits: 3 } },
  { label: '_MultiHitText', relative: 16, opcode: 9, address: 0xD073, expected: { op: 'decimal', binding: 'playerNumHits', bytes: 1, digits: 1 } },
  { label: '_HitXTimesText', relative: 6, opcode: 9, address: 0xCD05, expected: { op: 'decimal', binding: 'enemyNumHits', bytes: 1, digits: 1 } },
  { label: '_ExpPointsText', relative: 0, opcode: 9, address: 0xCF4A, expected: { op: 'decimal', binding: 'expAmountGained', bytes: 2, digits: 4 } },
  { label: '_MoneyForWinningText', relative: 9, opcode: 2, address: 0xD078,
    expected: { op: 'bcd', binding: 'amountMoneyWon', bytes: 3, leadingZeroes: true, leftAlign: true, moneySign: false } },
  { label: '_PickUpPayDayMoneyText', relative: 15, opcode: 2, address: 0xCCE5,
    expected: { op: 'bcd', binding: 'totalPayDayMoney', bytes: 3, leadingZeroes: true, leftAlign: true, moneySign: false } },
];

describe.skipIf(!process.env.ROM_PATH)('battle text ROM contract', () => {
  let reader: BinaryReader;
  let extracted: TextProgramsFile;
  beforeAll(() => {
    const buffer = readFileSync(process.env.ROM_PATH!);
    reader = new BinaryReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    extracted = extractTextPrograms(reader);
  });
  it('preserves the frozen A5b data in the extractor, independently of setup', () => preservesA5b(extracted));
  it.each(operandCases)('reads $expected.binding from $label at the traced ROM operand', entry => {
    const [, bank, address] = TEXT_PROGRAM_SYMBOLS.find(([label]) => label === entry.label)!;
    const at = (bank === 0 ? address : bank * 0x4000 + (address & 0x3fff)) + entry.relative;
    expect(reader.readByte(at)).toBe(entry.opcode);
    expect(reader.readWord(at + 1)).toBe(entry.address);
    expect(extracted.programs[entry.label]).toContainEqual(entry.expected);
  });
  it('keeps $CF4A as a string for RAM, distinct from the EXP decimal binding', () => {
    expect(extracted.programs._MoveNameText[0]).toEqual({ op: 'ram', binding: 'stringBuffer' });
    expect(extracted.programs._ExpPointsText[0]).toEqual({ op: 'decimal', binding: 'expAmountGained', bytes: 2, digits: 4 });
  });
  it('takes all 362 new symbol addresses from pret symbols, without duplicate addresses or labels', () => {
    const root = resolve(__dirname, '../../../..');
    const sym = execFileSync('git', ['-C', 'refs/pokeyellow', 'show', 'origin/symbols:pokeyellow.sym'],
      { cwd: root, encoding: 'utf8', windowsHide: true });
    const symbols = new Map([...sym.matchAll(/^([\da-f]+):([\da-f]+) (\S+)$/gmi)]
      .map(m => [m[3], [parseInt(m[1], 16), parseInt(m[2], 16)]]));
    const rows = TEXT_PROGRAM_SYMBOLS.filter(([label]) => !(label in frozen.programs));
    expect(rows).toHaveLength(362);
    for (const [label, bank, address] of rows) expect([bank, address], label).toEqual(symbols.get(label));
    expect(new Set(TEXT_PROGRAM_SYMBOLS.map(([label]) => label)).size).toBe(995);
    expect(new Set(TEXT_PROGRAM_SYMBOLS.map(([, bank, address]) => `${bank}:${address}`)).size).toBe(995);
  });
  it.each([
    ['GreatlyRoseText', ['_GreatlyRoseText', '_RoseText']],
    ['GreatlyFellText', ['_GreatlyFellText', '_FellText']],
    ['BoostedText', ['_BoostedText', '_ExpPointsText']],
    ['PoofText', ['_PoofText', '_ForgotAndText']],
  ] as const)('follows the physical source fallthrough from %s', (label, children) => {
    expect(extracted.programs[label].filter(op => op.op === 'far').map(op => op.program)).toEqual(children);
  });
  it('keeps the empty-string fallthrough, battle controls and sound terminators', () => {
    expect(extracted.programs._MoveNameText).toEqual([
      { op: 'ram', binding: 'stringBuffer' }, { op: 'text', text: '' }, { op: 'text', text: '!<DONE>' },
    ]);
    expect(extracted.programs.GrewLevelText).toEqual([
      { op: 'far', program: '_GrewLevelText' }, { op: 'sound', sound: 'get_item1' },
    ]);
    expect(extracted.programs.HurtByPoisonText).toBeDefined();
    expect(extracted.programs._HurtByPoisonText.some(op => op.op === 'text' && op.text.includes('<USER>'))).toBe(true);
    expect(extracted.programs._BurnedText.some(op => op.op === 'text' && op.text.includes('<TARGET>'))).toBe(true);
  });
});
