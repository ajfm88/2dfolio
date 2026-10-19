import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decodeRle, pewterGuys, SimulatedJoypad, npcDirections,
  PEWTER_MUSEUM_PLAYER, PEWTER_MUSEUM_GUIDE, PEWTER_GYM_PLAYER, PEWTER_GYM_GUIDE,
  PEWTER_MUSEUM_COORDS, PEWTER_GYM_COORDS,
} from './simulated_joypad';
import type { Direction } from '../core';

const repeat = (d: Direction | null, n: number) => Array<Direction | null>(n).fill(d);
const museumTail = [...repeat('up', 5), ...repeat('left', 13), ...repeat('up', 3), null];
const gymTail = [...repeat('left', 14), ...repeat('up', 5), ...repeat('left', 11), ...repeat('down', 5), ...repeat('right', 2), null];
const variants: { which: 'museum' | 'gym'; x: number; y: number; prefix: (Direction | null)[] }[] = [
  { which: 'museum', x: 27, y: 18, prefix: ['up', 'up'] },
  { which: 'museum', x: 27, y: 16, prefix: ['left', 'right'] },
  { which: 'museum', x: 26, y: 17, prefix: ['right', 'up'] },
  { which: 'museum', x: 28, y: 17, prefix: ['left', 'up'] },
  { which: 'gym', x: 34, y: 16, prefix: ['right', 'down', 'down', 'left'] },
  { which: 'gym', x: 35, y: 17, prefix: ['left', 'right', 'down', 'left'] },
  { which: 'gym', x: 37, y: 18, prefix: [...repeat(null, 8), 'left', 'left', 'left'] },
  { which: 'gym', x: 37, y: 19, prefix: ['left', 'up', 'left', 'left'] },
  { which: 'gym', x: 36, y: 17, prefix: [...repeat(null, 8), 'left', 'down', 'left'] },
];

describe('native simulated joypad lists', () => {
  it('DecodeRLEList writes and counts its sentinel, including an empty list', () => {
    expect(decodeRle([0, 2, 0x40, 3, 0xff])).toEqual({ entries: [0, 0, 0x40, 0x40, 0x40, 0xff], count: 6 });
    expect(decodeRle([0xff])).toEqual({ entries: [0xff], count: 1 });
    expect(() => decodeRle([0x40, 2])).toThrow('sentinel');
  });
  it('PewterGuys overwrites the last real byte, leaving its input untouched', () => {
    const decoded = decodeRle(PEWTER_MUSEUM_PLAYER);
    const built = pewterGuys(decoded.entries, decoded.count - 1, 'museum', 27, 16);
    expect(decoded.entries.slice(-3)).toEqual([0x40, 0x40, 0xff]);
    expect(built.index).toBe(24);
    expect(built.entries.slice(21)).toEqual([0x40, 0x10, 0x20]);
    expect(() => pewterGuys(decoded.entries, decoded.count - 1, 'gym', 36, 16)).toThrow('unreachable before V3');
  });
  it.each(variants)('$which ($x,$y) executes the source prefix backwards and collides only at index zero', v => {
    const decoded = decodeRle(v.which === 'museum' ? PEWTER_MUSEUM_PLAYER : PEWTER_GYM_PLAYER);
    const joy = new SimulatedJoypad(pewterGuys(decoded.entries, decoded.count - 1, v.which, v.x, v.y));
    const expected = [...v.prefix, ...(v.which === 'museum' ? museumTail : gymTail)];
    const got = [];
    while (!joy.done) got.push(joy.next());
    expect(got.map(n => n!.entry)).toEqual(expected);
    expect(got.map(n => n!.collide)).toEqual(expected.map((_, i) => i === expected.length - 1));
    expect(joy.index).toBe(0); expect(joy.next()).toBeNull();
  });
  it('NPC bytes decode forward, with an encoding independent of PAD masks', () => {
    expect(npcDirections([0, 0x40, 0x80, 0xc0, 0xff])).toEqual(['down', 'up', 'left', 'right']);
    expect(npcDirections(decodeRle(PEWTER_MUSEUM_GUIDE).entries)).toHaveLength(23);
    expect(npcDirections(decodeRle(PEWTER_GYM_GUIDE).entries)).toHaveLength(41);
  });

  const refs = resolve(__dirname, '../../../refs/pokeyellow');
  it('independently parses all four source RLE lists and both coordinate/prefix tables without a ROM', () => {
    if (!existsSync(refs)) return;
    const values: Record<string, number> = { NO_INPUT: 0, PAD_UP: 0x40, PAD_DOWN: 0x80, PAD_LEFT: 0x20, PAD_RIGHT: 0x10,
      NPC_MOVEMENT_UP: 0x40, NPC_MOVEMENT_DOWN: 0, NPC_MOVEMENT_LEFT: 0x80, NPC_MOVEMENT_RIGHT: 0xc0 };
    const number = (s: string): number => s in values ? values[s] : s.startsWith('$') ? parseInt(s.slice(1), 16) : Number(s) & 255;
    const db = (body: string) => [...body.matchAll(/^\s*db\s+([^;\r\n]+)/gm)]
      .flatMap(m => m[1].split(',').map(s => number(s.trim())));
    const auto = readFileSync(resolve(refs, 'engine/overworld/auto_movement.asm'), 'utf8');
    for (const [label, bytes] of [
      ['RLEList_PewterMuseumPlayer', PEWTER_MUSEUM_PLAYER], ['RLEList_PewterMuseumGuy', PEWTER_MUSEUM_GUIDE],
      ['RLEList_PewterGymPlayer', PEWTER_GYM_PLAYER], ['RLEList_PewterGymGuy', PEWTER_GYM_GUIDE],
    ] as const) {
      const body = auto.split(label + ':')[1].split(/\r?\n(?=[A-Za-z_])/)[0];
      expect(db(body), label).toEqual([...bytes]);
    }
    const guys = readFileSync(resolve(refs, 'engine/events/pewter_guys.asm'), 'utf8');
    expect(guys.match(/PewterGuysCoordsTable:\s*dw (\w+)\s*dw (\w+)/)?.slice(1)).toEqual(['PewterMuseumGuyCoords', 'PewterGymGuyCoords']);
    for (const [label, expected] of [['PewterMuseumGuyCoords', PEWTER_MUSEUM_COORDS], ['PewterGymGuyCoords', PEWTER_GYM_COORDS]] as const) {
      const body = guys.split(label + ':')[1].split(/\r?\n(?=[A-Z])/)[0];
      const parsed = [...body.matchAll(/db\s+(\d+),\s*(\d+)\s*\r?\n\s*dw\s+(\.\w+)/g)].map(m => {
        const prefix = body.split(new RegExp('^\\' + m[3] + '\\r?\\n', 'm'))[1];
        return { x: Number(m[2]), y: Number(m[1]), prefix: db(prefix.split(/\r?\n\./)[0]) };
      });
      expect(parsed, label).toEqual(expected);
    }
  });

  // All addresses taken from pret origin/symbols:pokeyellow.sym at e89ead15, never byte searches.
  it.skipIf(!process.env.ROM_PATH)('pins the four streams, coordinate rows, table pointers and all nine prefixes to ROM symbols', () => {
    const rom = readFileSync(resolve(process.env.ROM_PATH!));
    const offset = (addr: number) => 6 * 0x4000 + addr - 0x4000;
    for (const [addr, bytes] of [[0x6661, PEWTER_MUSEUM_PLAYER], [0x666a, PEWTER_MUSEUM_GUIDE],
      [0x66cb, PEWTER_GYM_PLAYER], [0x66d8, PEWTER_GYM_GUIDE]] as const)
      expect([...rom.subarray(offset(addr), offset(addr) + bytes.length)]).toEqual([...bytes]);
    expect([...rom.subarray(offset(0x672a), offset(0x672e))]).toEqual([0x2e, 0x67, 0x4a, 0x67]);
    for (const [table, rows, addresses] of [
      [0x672e, PEWTER_MUSEUM_COORDS, [0x673e, 0x6741, 0x6744, 0x6747]],
      [0x674a, PEWTER_GYM_COORDS, [0x675e, 0x6763, 0x6768, 0x6774, 0x6779]],
    ] as const) rows.forEach((row, i) => {
      const addr = addresses[i], p = offset(table) + 4 * i;
      expect([...rom.subarray(p, p + 4)]).toEqual([row.y, row.x, addr & 255, addr >> 8]);
      expect([...rom.subarray(offset(addr), offset(addr) + row.prefix.length)]).toEqual(row.prefix);
    });
  });
});
