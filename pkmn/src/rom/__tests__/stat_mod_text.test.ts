import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractStatModText, STAT_MOD_TEXT_OFFSET, STAT_MOD_TEXT_LENGTH } from '../extractors/stat_mod_text';
import { STAT_MODIFIER_RATIOS } from '../../battle/battle_math';
import { A, BattleState, encodeText } from '../../battle/battle_state';
import { loadBattleMoveData, moveNameBinding } from '../../battle/battle_move_data';

const dataPath = resolve(__dirname, '../../../data/stat_mod_text.json');
const file: { bytes: number[] } = JSON.parse(readFileSync(dataPath, 'utf8'));
const names = ['ATTACK', 'DEFENSE', 'SPEED', 'SPECIAL', 'ACCURACY', 'EVADE'];

it('committed names decode through the existing moveNameBinding glyphs; EVADE retains all four ratio bytes', async () => {
  await loadBattleMoveData();
  const s = new BattleState(); let offset = 0;
  for (const name of names) {
    s.setBytes(A.wStringBuffer, file.bytes.slice(offset, offset + 10), 10);
    expect(moveNameBinding(s)).toBe(name); offset += name.length + 1;
  }
  expect(offset).toBe(STAT_MOD_TEXT_LENGTH);
  expect(file.bytes.slice(-4)).toEqual(STAT_MODIFIER_RATIOS.slice(0, 2).flat());
  expect(readFileSync(resolve(__dirname, '../../../static/stat_mod_text.json'))).toEqual(readFileSync(dataPath));
});

it.skipIf(!process.env.ROM_PATH)('confirms 0f:7655 from PrintStatText operand, ASM names and adjacent ROM ratios', () => {
  const bytes = readFileSync(process.env.ROM_PATH!);
  const rom = new BinaryReader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  // effects.asm:781: ld hl, StatModTextStrings (21 55 76), at PrintStatText 0f:763e.
  expect([...rom.readBytes(0x0f * 0x4000 + 0x363e, 3)]).toEqual([0x21, 0x55, 0x76]);
  expect(STAT_MOD_TEXT_OFFSET).toBe(rom.resolvePointer(0x0f, 0x7655));
  const source = readFileSync(resolve(__dirname, '../../../../refs/pokeyellow/data/battle/stat_mod_names.asm'), 'utf8');
  expect([...source.matchAll(/li "([A-Z]+)"/g)].map(m => m[1])).toEqual(names);
  expect([...rom.readBytes(STAT_MOD_TEXT_OFFSET, STAT_MOD_TEXT_LENGTH)]).toEqual([...encodeText(names.join('@') + '@')]);
  expect([...rom.readBytes(STAT_MOD_TEXT_OFFSET + STAT_MOD_TEXT_LENGTH, 26)]).toEqual(STAT_MODIFIER_RATIOS.flat());
  expect(extractStatModText(rom)).toEqual(file);
  expect(readFileSync(dataPath, 'utf8')).toBe(JSON.stringify(extractStatModText(rom), null, 2) + '\n');
});
