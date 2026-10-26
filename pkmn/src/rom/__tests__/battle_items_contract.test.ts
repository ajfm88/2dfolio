import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BATTLE_ITEM_POINTERS, CARD_KEY_COMPARED_BYTE } from '../../battle/battle_items';

describe.skipIf(!process.env.ROM_PATH)('A5c3e dispatcher ROM contract', () => {
  it('pins all83 ItemUsePtrTable targets and labels to the cartridge and pret symbols', () => {
    const rom = readFileSync(process.env.ROM_PATH!);
    const symbols = execFileSync('git', ['-C', resolve(__dirname, '../../../../refs/pokeyellow'), 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8' });
    expect(symbols).toMatch(/^03:5307 ItemUsePtrTable$/m);
    expect(BATTLE_ITEM_POINTERS).toHaveLength(83);
    BATTLE_ITEM_POINTERS.forEach((row, index) => {
      expect(row.id).toBe(index + 1);
      expect(symbols).toMatch(new RegExp(`^03:${row.address.toString(16)} ${row.label}$`, 'm'));
      expect(rom.readUInt16LE(3 * 0x4000 + 0x1307 + index * 2)).toBe(row.address);
    });
  });
  it('Card Key loads the ROM routine opcode, not the fetched screen tile', () => {
    const rom = readFileSync(process.env.ROM_PATH!);
    expect(rom[3 * 0x4000 + 0x2d1]).toBe(CARD_KEY_COMPARED_BYTE);
    // ld a,[42D1]; cp18: source's accidental absolute load.
    expect([...rom.subarray(3 * 0x4000 + 0x1e5e, 3 * 0x4000 + 0x1e63)]).toEqual([0xfa, 0xd1, 0x42, 0xfe, 0x18]);
  });
});
