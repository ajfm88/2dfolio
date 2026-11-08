// A5e checkpoint-05 (note 80): data only. Independent source parse -> committed JSON; ROM -> extractor -> JSON.
// A5f checkpoint-01 (note 87): TossBallAnimation's five further IDs.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import {
  extractBattleAnimations, PRESENTATION_ANIMATIONS, type BattleAnimationData, type Subanimation,
} from '../extractors/battle_animations';
import {
  ATTACK_ANIMATION_POINTERS, SUBANIMATION_POINTERS, FRAME_BLOCK_POINTERS, FRAME_BLOCK_BASE_COORDS,
  MOVE_ANIMATION_TILES_POINTERS, ANIMATION_MINIMIZE_MON, MINIMIZED_MON_SPRITE, symToOffset,
} from '../rom_offsets';

const ROM_PATH = process.env.ROM_PATH;
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const raw = readFileSync(resolve(DATA, 'battle_animations.json'), 'utf8');
const file: BattleAnimationData = JSON.parse(raw);
const source = (path: string): string[] => readFileSync(resolve(REFS, path), 'utf8').split('\n')
  .map(line => line.replace(/;.*/, '').trim()).filter(Boolean);
function body(path: string, label: string): string[] {
  const lines = source(path);
  const start = lines.findIndex(line => line === `${label}:` || line === `${label}::`);
  if (start < 0) throw new Error(`missing source ${label}`);
  const next = lines.findIndex((line, i) => i > start && /^\w+::?$/.test(line));
  return lines.slice(start + 1, next < 0 ? undefined : next);
}
const hex = (token: string): number => parseInt(token.replace(/^\$/, ''), 16);
/** The index of `dw <label>` in a pointer table. */
function tableIndex(path: string, table: string, label: string): number {
  const rows = body(path, table).filter(line => line.startsWith('dw '));
  const index = rows.indexOf(`dw ${label}`);
  if (index < 0) throw new Error(`${label} not in ${table}`);
  return index;
}
/** Names declared by `const` after the const_def that precedes `first`, in order. */
function constBlock(path: string, first: string): string[] {
  const lines = source(path);
  const start = lines.indexOf(`const ${first}`);
  if (start < 0 || lines[start - 1] !== 'const_def') throw new Error(`no const_def block at ${first}`);
  const names: string[] = [];
  for (let i = start; lines[i]?.startsWith('const '); i++) names.push(lines[i].slice(6).trim());
  return names;
}
const OAM_FLAGS: Record<string, number> = { OAM_XFLIP: 0x20, OAM_YFLIP: 0x40 };
const flags = (expr: string): number => expr === '0' ? 0 : expr.split('|').reduce((value, name) => {
  const flag = OAM_FLAGS[name.trim()];
  if (flag === undefined) throw new Error(`unsupported OAM flag ${name}`);
  return value | flag;
}, 0);

/** A5f checkpoint-01 (note 87): the traced IDs and their pret labels, in move_constants.asm order. */
const SOURCE_ANIMATIONS: readonly (readonly [string, string])[] = [
  ['TOSS_ANIM', 'BallTossAnim'], ['SHAKE_ANIM', 'BallShakeAnim'], ['POOF_ANIM', 'BallPoofAnim'],
  ['BLOCKBALL_ANIM', 'BallBlockAnim'], ['GREATTOSS_ANIM', 'GreatTossAnim'], ['ULTRATOSS_ANIM', 'UltraTossAnim'],
];
/** A constant's value: its position among the `const` lines after the file's first const_def (DEF lines don't count). */
function constValue(path: string, name: string): number {
  const lines = source(path);
  const start = lines.indexOf('const_def');
  if (start < 0) throw new Error(`no const_def in ${path}`);
  let value = -1;
  for (let i = start + 1; i < lines.length && lines[i] !== 'const_def'; i++) {
    if (!lines[i].startsWith('const ')) continue;
    value++;
    if (lines[i].slice(6).trim() === name) return value;
  }
  throw new Error(`${name} not in ${path}`);
}

/** Source text can't give assembled addresses, so a source subanimation has no pointer/address (checkpoint-06a). */
type SourceData = Omit<BattleAnimationData, 'subanimations'> & { subanimations: Omit<Subanimation, 'pointer' | 'address'>[] };
/** Built only from pret's source text: macros/gfx.asm dbsprite, the subanim and battle_anim macros, the tables. */
function fromSource(): SourceData {
  const subanimConsts = constBlock('constants/move_animation_constants.asm', 'SUBANIM_0_STAR');
  const subanimLabels = body('data/battle_anims/subanimations.asm', 'SubanimationPointers')
    .filter(line => line.startsWith('dw ')).map(line => line.slice(3));
  const subtypes = constBlock('constants/move_animation_constants.asm', 'SUBANIMTYPE_NORMAL');
  const tilesetRows = body('engine/battle/animations.asm', 'MoveAnimationTilesPointers').filter(l => l.startsWith('anim_tileset'));
  const animations: SourceData['animations'] = [];
  const subanimations = new Map<number, SourceData['subanimations'][number]>();
  const tilesets = new Map<number, { id: number; tiles: number }>();
  for (const [name, label] of SOURCE_ANIMATIONS) {
    const id = tableIndex('data/moves/animations.asm', 'AttackAnimationPointers', label) + 1;
    expect(constValue('constants/move_constants.asm', name)).toBe(id);
    const [command, ...rest] = body('data/moves/animations.asm', label);
    expect(rest).toEqual(['db -1']);
    const anim = /^battle_anim NO_MOVE, (\w+), (\d+), (\d+)$/.exec(command);
    if (!anim) throw new Error(`unexpected ${label} command ${command}`);
    const subanimId = subanimConsts.indexOf(anim[1]);
    if (subanimId < 0) throw new Error(`${anim[1]} is not a SUBANIM_ constant`);
    const tileset = Number(anim[2]);
    expect(tilesetRows[tileset]).toMatch(/^anim_tileset \d+, MoveAnimationTiles0$/);
    tilesets.set(tileset, { id: tileset, tiles: Number(/^anim_tileset (\d+),/.exec(tilesetRows[tileset])![1]) });
    animations.push({ id, name, commands: [{ tileset, delay: Number(anim[3]), sound: null, subanimation: subanimId }] });
    if (subanimations.has(subanimId)) continue;
    const [header, ...rows] = body('data/battle_anims/subanimations.asm', subanimLabels[subanimId]);
    const sub = /^subanim (\w+), (\d+)$/.exec(header);
    if (!sub) throw new Error(`unexpected subanim header ${header}`);
    const entries = rows.map(row => {
      const m = /^db FRAMEBLOCK_(\w\w), BASECOORD_(\w\w), FRAMEBLOCKMODE_(\w\w)$/.exec(row);
      if (!m) throw new Error(`unexpected subentry ${row}`);
      return { frameBlock: hex(m[1]), baseCoord: hex(m[2]), mode: hex(m[3]) };
    });
    expect(entries).toHaveLength(Number(sub[2]));
    subanimations.set(subanimId, { id: subanimId, type: subtypes.indexOf(sub[1]), entries });
  }
  const allEntries = [...subanimations.values()].flatMap(sub => sub.entries);
  const frameBlocks = [...new Set(allEntries.map(e => e.frameBlock))].sort((a, b) => a - b).map(fb => {
    const label = `FrameBlock${fb.toString(16).padStart(2, '0')}`;
    expect(tableIndex('data/battle_anims/frame_blocks.asm', 'FrameBlockPointers', label)).toBe(fb);
    const [count, ...sprites] = body('data/battle_anims/frame_blocks.asm', label);
    expect(count).toBe(`db ${sprites.length}`);
    return { id: fb, tiles: sprites.map(line => {
      const m = /^dbsprite\s+(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*\$(\w\w),\s*(.+)$/.exec(line);
      if (!m) throw new Error(`unexpected sprite ${line}`);
      const [xt, yt, xp, yp] = m.slice(1, 5).map(Number);
      return { y: (yt * 8 + yp) % 256, x: (xt * 8 + xp) % 256, tile: hex(m[5]), flags: flags(m[6]) };
    }) };
  });
  const coordRows = body('data/battle_anims/base_coords.asm', 'FrameBlockBaseCoords').filter(l => l.startsWith('db '));
  const baseCoords = [...new Set(allEntries.map(e => e.baseCoord))].sort((a, b) => a - b).map(bc => {
    const m = /^db \$(\w\w), \$(\w\w)$/.exec(coordRows[bc]);
    if (!m) throw new Error(`unexpected base coord ${coordRows[bc]}`);
    return { id: bc, y: hex(m[1]), x: hex(m[2]) };
  });
  return {
    animations: animations.sort((a, b) => a.id - b.id),
    subanimations: [...subanimations.values()].sort((a, b) => a.id - b.id),
    frameBlocks, baseCoords,
    tilesets: [...tilesets.values()].sort((a, b) => a.id - b.id),
    minimizedMonSprite: minimizedFromSource(),
  };
}

/** A5e checkpoint-08a: `pusho b.X` makes `.` a 0 bit and `X` a 1 bit in each `db %` row. */
function minimizedFromSource(): number[] {
  const lines = body('engine/battle/animations.asm', 'MinimizedMonSprite');
  expect([lines[0], lines[lines.length - 1]]).toEqual(['pusho b.X', 'popo']);
  return lines.slice(1, -1).map(line => {
    const m = /^db %([.X]{8})$/.exec(line);
    if (!m) throw new Error(`unexpected MinimizedMonSprite row ${line}`);
    return parseInt(m[1].replace(/\./g, '0').replace(/X/g, '1'), 2);
  });
}

describe('battle_animations.json (A5e checkpoint-05)', () => {
  it('commits exactly the six TossBallAnimation IDs and the tables they reach', () => {
    expect(PRESENTATION_ANIMATIONS).toEqual({
      TOSS_ANIM: 0xc1, SHAKE_ANIM: 0xc2, POOF_ANIM: 0xc3, BLOCKBALL_ANIM: 0xc4, GREATTOSS_ANIM: 0xc5, ULTRATOSS_ANIM: 0xc6,
    });
    expect(Object.keys(file)).toEqual(['animations', 'subanimations', 'frameBlocks', 'baseCoords', 'tilesets', 'minimizedMonSprite']);
    const command = (delay: number, subanimation: number) => [{ tileset: 0, delay, sound: null, subanimation }];
    expect(file.animations).toEqual([
      { id: 0xc1, name: 'TOSS_ANIM', commands: command(3, 6) },
      { id: 0xc2, name: 'SHAKE_ANIM', commands: command(4, 9) },
      { id: 0xc3, name: 'POOF_ANIM', commands: command(4, 10) },
      { id: 0xc4, name: 'BLOCKBALL_ANIM', commands: command(3, 11) },
      { id: 0xc5, name: 'GREATTOSS_ANIM', commands: command(3, 7) },
      { id: 0xc6, name: 'ULTRATOSS_ANIM', commands: command(2, 8) },
    ]);
    // [id, pointer, address, type, entries]: DoBallTossSpecialEffects' counter starts at 11, the shake's restart rewinds 4.
    expect(file.subanimations.map(s => [s.id, s.pointer, s.address, s.type, s.entries.length])).toEqual([
      [6, 0x6921, 0x6a13, 0, 11], [7, 0x6923, 0x69f1, 0, 11], [8, 0x6925, 0x69cf, 0, 11],
      [9, 0x6927, 0x6a35, 0, 4], [10, 0x6929, 0x6a42, 2, 6], [11, 0x692b, 0x6a55, 0, 4],
    ]);
    expect(file.subanimations.find(s => s.id === 9)!.entries.every(e => e.mode === 4)).toBe(true);
    expect(file.subanimations.find(s => s.id === 10)!.entries).toEqual([
      { frameBlock: 6, baseCoord: 0x1b, mode: 0 }, { frameBlock: 7, baseCoord: 0x1b, mode: 0 },
      { frameBlock: 8, baseCoord: 0x36, mode: 0 }, { frameBlock: 9, baseCoord: 0x36, mode: 0 },
      { frameBlock: 10, baseCoord: 0x15, mode: 0 }, { frameBlock: 10, baseCoord: 0x15, mode: 0 },
    ]);
    expect(file.frameBlocks.map(fb => [fb.id, fb.tiles.length])).toEqual(
      [[1, 9], [3, 4], [4, 4], [5, 4], [6, 12], [7, 16], [8, 16], [9, 12], [10, 12]]);
    expect(file.baseCoords).toHaveLength(35);
    expect(file.baseCoords.filter(bc => [0x15, 0x1b, 0x36].includes(bc.id)))
      .toEqual([{ id: 0x15, y: 0x28, x: 0x68 }, { id: 0x1b, y: 0x30, x: 0x70 }, { id: 0x36, y: 0x2c, x: 0x6c }]);
    expect(file.tilesets).toEqual([{ id: 0, tiles: 79 }]);
    expect(file.minimizedMonSprite).toEqual([0x18, 0x3c, 0x7e, 0x3c, 0x24]); // A5e checkpoint-08a
  });

  it('matches an independent parse of pret source, tile by tile', () => {
    // A5e checkpoint-06a: assembled addresses aren't in the source text; the ROM block pins them to the symbol file.
    const withoutAddresses = { ...file, subanimations: file.subanimations.map(({ pointer: _p, address: _a, ...rest }) => rest) };
    expect(withoutAddresses).toEqual(fromSource());
  });

  it('is mirrored byte for byte in static/', () => {
    expect(readFileSync(resolve(STATIC, 'battle_animations.json'), 'utf8')).toBe(raw);
    expect(raw).toBe(JSON.stringify(file, null, 2) + '\n');
  });
});

describe.skipIf(!ROM_PATH)('battle_animations ROM extraction (A5e checkpoint-05)', () => {
  let rom: Uint8Array, reader: BinaryReader, symbols: string;
  beforeAll(() => {
    rom = Uint8Array.from(readFileSync(ROM_PATH!));
    reader = new BinaryReader(rom.slice().buffer);
    symbols = execFileSync('git', ['-C', REFS, 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8' });
  });
  function bankAddress(label: string): [number, number] {
    const match = symbols.split('\n').map(line => /^(\w+):(\w+) (\S+)\s*$/.exec(line)).find(m => m?.[3] === label);
    if (!match) throw new Error(`missing pinned symbol ${label}`);
    return [parseInt(match[1], 16), parseInt(match[2], 16)];
  }
  /** A ROM label's file offset. */
  const symbol = (label: string): number => symToOffset(...bankAddress(label));
  /** A label's CPU address: WRAM, or a ROM label as code sees it. */
  const address = (label: string): number => bankAddress(label)[1];
  const word = (at: number): number => rom[at] | rom[at + 1] << 8;
  const target = (table: number, index: number): number => symToOffset(0x1e, word(table + index * 2));

  it('extracts the committed file', () => {
    expect(extractBattleAnimations(reader)).toEqual(file);
  });

  it('pins every table offset and every pointer it follows to the symbol file', () => {
    expect(ATTACK_ANIMATION_POINTERS).toBe(symbol('AttackAnimationPointers'));
    expect(SUBANIMATION_POINTERS).toBe(symbol('SubanimationPointers'));
    expect(FRAME_BLOCK_POINTERS).toBe(symbol('FrameBlockPointers'));
    expect(FRAME_BLOCK_BASE_COORDS).toBe(symbol('FrameBlockBaseCoords'));
    expect(MOVE_ANIMATION_TILES_POINTERS).toBe(symbol('MoveAnimationTilesPointers'));
    // A5f checkpoint-01: all six animation pointers and the six subanimations they reach.
    const anims: [number, string][] = [[0xc1, 'BallTossAnim'], [0xc2, 'BallShakeAnim'], [0xc3, 'BallPoofAnim'],
      [0xc4, 'BallBlockAnim'], [0xc5, 'GreatTossAnim'], [0xc6, 'UltraTossAnim']];
    for (const [id, label] of anims) expect(target(ATTACK_ANIMATION_POINTERS, id - 1)).toBe(symbol(label));
    const subs: [number, string][] = [[6, 'Subanim_0BallTossHigh'], [7, 'Subanim_0BallTossMiddle'], [8, 'Subanim_0BallTossLow'],
      [9, 'Subanim_0BallShakeEnemy'], [10, 'Subanim_0BallPoofEnemy'], [11, 'Subanim_0BallBlock']];
    for (const [id, label] of subs) {
      expect(target(SUBANIMATION_POINTERS, id)).toBe(symbol(label));
      // A5e checkpoint-06a: the two WRAM pointer values, as CPU addresses.
      const sub = file.subanimations.find(s => s.id === id)!;
      expect(sub.pointer).toBe(address('SubanimationPointers') + id * 2);
      expect(sub.address).toBe(address(label));
    }
    for (const fb of file.frameBlocks.map(f => f.id))
      expect(target(FRAME_BLOCK_POINTERS, fb)).toBe(symbol(`FrameBlock${fb.toString(16).padStart(2, '0')}`));
    const ts = MOVE_ANIMATION_TILES_POINTERS;
    expect([rom[ts], symToOffset(0x1e, word(ts + 1)), rom[ts + 3]]).toEqual([79, symbol('MoveAnimationTiles0'), 0xff]);
  });

  it("pins POOF_ANIM's special-effect row and DoPoofSpecialEffects' counter and sound for checkpoint-06", () => {
    const rows: [number, number][] = [];
    for (let at = symbol('AnimationIdSpecialEffects'); rom[at] !== 0xff; at += 3) rows.push([rom[at], word(at + 1)]);
    expect(rows.filter(([id]) => id === 0xc3)).toEqual([[0xc3, address('DoPoofSpecialEffects')]]);
    const at = symbol('DoPoofSpecialEffects'), counter = address('wSubAnimCounter'), playSound = address('PlaySound');
    // ld a, [wSubAnimCounter]; cp 5; ret nz; ld a, SFX_BALL_POOF; jp PlaySound
    expect([...rom.subarray(at, at + 11)]).toEqual([0xfa, counter & 255, counter >> 8, 0xfe, 5, 0xc0, 0x3e, 0x93, 0xc3,
      playSound & 255, playSound >> 8]);
  });

  it('pins MinimizedMonSprite and both routines that copy it, for checkpoint-08', () => {
    expect([ANIMATION_MINIMIZE_MON, MINIMIZED_MON_SPRITE]).toEqual([symbol('AnimationMinimizeMon'), symbol('MinimizedMonSprite')]);
    const sprite = address('MinimizedMonSprite'), length = address('MinimizedMonSpriteEnd') - sprite;
    // ld de, MinimizedMonSprite; ld c, MinimizedMonSpriteEnd - MinimizedMonSprite
    const load = [0x11, sprite & 255, sprite >> 8, 0x0e, length];
    expect([length, ...rom.subarray(ANIMATION_MINIMIZE_MON + 16, ANIMATION_MINIMIZE_MON + 21)]).toEqual([5, ...load]);
    // HideSubstituteShowMonAnim's .monIsMinimized copies the same rows; ReshowSubstituteAnim follows it.
    const hide = symbol('HideSubstituteShowMonAnim'), end = symbol('ReshowSubstituteAnim'), body = [...rom.subarray(hide, end)];
    const hits = body.flatMap((_, i) => load.every((b, k) => body[i + k] === b) ? [i] : []);
    expect(hits).toHaveLength(1);
  });

  const poof = (): number => target(ATTACK_ANIMATION_POINTERS, 0xc3 - 1);
  const sub = (): number => target(SUBANIMATION_POINTERS, 10);
  const set = (at: () => number, value: number) => (r: Uint8Array) => { r[at()] = value; };
  it.each<[string, (r: Uint8Array) => void, string]>([
    ['a move sound', set(() => poof() + 1, 0x20), 'belongs to the attack-animation slice'],
    ['a special-effect command', set(poof, 0xd8), 'is not a traced presentation command'],
    ['a missing terminator', r => { for (let i = 0; i < 17 * 3; i++) r[poof() + i] = [0x04, 0xff, 0x0a][i % 3]; },
      'POOF_ANIM: missing terminator'],
    ['an untraced tileset', set(poof, 0x44), 'tileset 1 is not traced'],
    ['an invalid subanimation type', set(sub, 0xc6), 'invalid type 6'],
    ['an invalid frame block mode', set(() => sub() + 3, 5), 'invalid frame block mode 5'],
    ['an empty frame block', set(() => target(FRAME_BLOCK_POINTERS, 6), 0), 'invalid tile count 0'],
    ['a moved tileset pointer', set(() => MOVE_ANIMATION_TILES_POINTERS + 1, 0x38), 'not MoveAnimationTiles0'],
    // A5e checkpoint-06a: note 80 section 6 finding 1, witnesses for the three guards checkpoint-05 left untested.
    ['a sub-animation with no frame blocks', set(sub, 0x40), 'no frame blocks'],
    ['a sub-animation pointer outside the bank', r => { r[SUBANIMATION_POINTERS + 20] = 0; r[SUBANIMATION_POINTERS + 21] = 0; },
      'is outside bank $1e'],
    ['a frame block over 40 tiles', set(() => target(FRAME_BLOCK_POINTERS, 6), 41), 'invalid tile count 41'],
    // A5e checkpoint-08a: MinimizedMonSprite is read only through AnimationMinimizeMon's own operands.
    ['a moved ld de', set(() => ANIMATION_MINIMIZE_MON + 16, 0x21), 'ld de / ld c are not where they were traced'],
    ['a different sprite pointer', set(() => ANIMATION_MINIMIZE_MON + 17, 0x94), 'is not MinimizedMonSprite'],
    ['a different row count', set(() => ANIMATION_MINIMIZE_MON + 20, 6), 'MinimizedMonSprite: 6 rows, not 5'],
  ])('fails loudly on %s', (_, mutate, message) => {
    const changed = rom.slice();
    mutate(changed);
    expect(() => extractBattleAnimations(new BinaryReader(changed.buffer))).toThrow(message);
  });
});
