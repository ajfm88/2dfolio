import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { textBgTransfer } from '../text/bg_transfer';
import { battleTransition, blackScreen, flashScreen, transitionPrologue, transitionTail, transferDelay3,
  copyTiles1, copyTiles2 } from './battle_transition';
import { TransitionScreen, TRANSITION_BLACK as FF, TRANSITION_BLANK as BLANK } from './transition_screen';
import type { BattleTransitionKind } from './battle_transition_choice';

type OracleRow = [tick: number, enabled: number, bgp: number, obp0: number | null, obp1: number | null, writes: [number, number][]];
const NOTES = resolve(__dirname, '../../../notes');
const oracle: Record<string, { rows: OracleRow[]; outside: [number, number][] }> = JSON.parse(
  readFileSync(resolve(NOTES, '65-a5d-cp3/cp1_cells.json'), 'utf8'));
const ticks = readFileSync(resolve(NOTES, '65-a5d-cp1/ticks_p0.txt'), 'utf8');
const tables = readFileSync(resolve(NOTES, '65-a5d-cp1/frame_tables.txt'), 'utf8');
const cases: [string, BattleTransitionKind, 0 | 1, number, number][] = [
  ['000 DoubleCircle', 'doubleCircle', 1, 102, 110], ['010 Circle', 'circle', 0, 132, 140],
  ['100 HStripes', 'horizontalStripes', 1, 60, 68], ['110 VStripes', 'verticalStripes', 0, 54, 62],
  ['101 Shrink', 'shrink', 1, 64, 62], ['111 Split', 'split', 0, 64, 62],
  ['x01 Spiral in', 'spiral', 1, 153, 161], ['x01 Spiral out', 'spiral', 0, 120, 128],
];
beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

it('cell-oracle timings match CP1 ticks_p0, accounting for its pre-tail end() flag snapshot', () => {
  for (const [name] of cases) {
    const section = ticks.split(`## ${name} `)[1].split('## ')[0];
    const rows = [...section.matchAll(/^\s*(\d+)\s+(None|\d)\s+(\d)\s+\$(\w+)\s+(--|\$\w+)\/(--|\$\w+)\s+(\d+)/gm)];
    expect(rows).toHaveLength(oracle[name].rows.length);
    let portion = 0;
    const logical = Array.from({ length: 360 }, (_, i) => i), visible = [...logical];
    let enabled = true;
    for (const [index, match] of rows.entries()) {
      const [tick, after, bgp, obp0, obp1, writes] = oracle[name].rows[index];
      const xfer = enabled ? portion : null;
      if (xfer !== null) { visible.splice(xfer * 120, 120, ...logical.slice(xfer * 120, xfer * 120 + 120)); portion = (portion + 1) % 3; }
      // CP1 run() flushes end() before tail(): at Shrink/Split/Outward's return it logs
      // the enable byte before the tail's immediate CopyVideoData disables it. No wait
      // occurs between those CPU operations. The chained frame program logs the latter.
      const beforeTail = tick === oracle[name].rows.length - 9;
      const expectedEnable = beforeTail ? 0 : Number(match[3]);
      if (beforeTail) expect(Number(match[3])).toBe(['101 Shrink', 'x01 Spiral out'].includes(name) ? 1 : 0);
      expect([tick, xfer, after, bgp, obp0, obp1, visible.filter(cell => cell === FF).length])
        .toEqual([Number(match[1]), match[2] === 'None' ? null : Number(match[2]), expectedEnable, parseInt(match[4], 16),
          match[5] === '--' ? null : parseInt(match[5].slice(1), 16), match[6] === '--' ? null : parseInt(match[6].slice(1), 16), Number(match[7])]);
      for (const [pointer, value] of writes) logical[pointer] = value;
      enabled = after !== 0;
    }
  }
});

for (const [name, kind, spiralDirection, duration, blackFrom] of cases) {
  it.each([0, 1, 2])(`${name}: every logical/scanned cell and inherited third, p0=%i`, p0 => {
    for (let p = 0; p < p0; p++) textBgTransfer.tick();
    const screen = new TransitionScreen(); screen.obp0 = 0xd0; screen.obp1 = 0xc8;
    const program = battleTransition(screen, { kind, spiralDirection });
    const writes: [number, number, number][] = [], original = screen.write.bind(screen);
    let tick = 0;
    vi.spyOn(screen, 'write').mockImplementation((p, value = FF) => { writes.push([tick, p, value]); original(p, value); });
    expect(program.next().done).toBe(false);
    const logical = Array.from({ length: 360 }, (_, i) => i), visible = [...logical];
    let enabled = true, portion = p0;
    for (const [frame, after, bgp, obp0, obp1, cpu] of oracle[name].rows) {
      tick = frame;
      const xfer = enabled ? portion : null;
      if (xfer !== null) { visible.splice(xfer * 120, 120, ...logical.slice(xfer * 120, xfer * 120 + 120)); portion = (portion + 1) % 3; }
      expect(screen.vblank(), `VBlank ${tick}`).toBe(xfer);
      const next = program.next();
      for (const [p, value] of cpu) logical[p] = value === 0x7f && tick >= 8 + duration + 6 ? BLANK : value;
      expect(screen.cells, `CPU ${tick}`).toEqual(logical);
      expect(screen.visibleCells, `scanout ${tick}`).toEqual(visible);
      expect([screen.bgp, screen.obp0, screen.obp1], `palette ${tick}`).toEqual([bgp, obp0 ?? 0xd0, obp1 ?? 0xc8]);
      expect(screen.black, `BlackScreen ${tick}`).toBe(tick >= blackFrom);
      expect(textBgTransfer.enabled).toBe(after !== 0);
      expect(textBgTransfer.nextPortion).toBe(portion);
      expect(next.done).toBe(tick === 8 + duration + 9);
      enabled = after !== 0;
    }
    const outside = writes.filter(([, p]) => p < 0 || p >= 360).map(([t, p]) => [t, p]);
    expect(outside).toEqual(oracle[name].outside);
    expect(screen.visibleCells).toEqual(Array(360).fill(BLANK));
    expect(screen.visibleSprites).toEqual([]); expect(screen.tileAnimationsEnabled).toBe(false);
  });
}

function runProgram(screen: TransitionScreen, program: Generator<void>): number {
  let frames = 0, result = program.next();
  while (!result.done) { screen.vblank(); result = program.next(); frames++; if (frames > 300) throw new Error('program did not end'); }
  return frames;
}

it('prologue: WY/freeze after 3, OAM clear DMA at 5, no transfer at 8; tail clears OAM at L+7', () => {
  const screen = new TransitionScreen([0, 1, 2, 15].map(slot => ({ slot, visible: true, occupied: true })), 2);
  const prologue = transitionPrologue(screen); prologue.next();
  for (let tick = 1; tick <= 8; tick++) {
    const transfer = screen.vblank(); prologue.next();
    expect(screen.windowY).toBe(tick < 4 ? 0x90 : 0);
    expect(screen.spriteUpdatesEnabled).toBe(tick < 3);
    expect(screen.visibleSprites).toEqual(tick < 5 ? [0, 1, 2, 15] : [0, 2]);
    expect(transfer).toBe(tick === 8 ? null : (tick - 1) % 3);
    expect(screen.transitionTileLoaded).toBe(tick === 8);
  }
  runProgram(screen, blackScreen(screen));
  const tail = transitionTail(screen); tail.next();
  for (let t = 1; t <= 9; t++) {
    const transfer = screen.vblank(); tail.next();
    expect(transfer === null).toBe(t < 7);
    expect(screen.hpBarTilesLoaded).toBe(t >= 4); expect(screen.hud1Loaded).toBe(t >= 5); expect(screen.hud2Loaded).toBe(t >= 6);
    expect(screen.visibleSprites).toEqual(t < 7 ? [0, 2] : []);
    expect(screen.black).toBe(true); expect(screen.tileAnimationsEnabled).toBe(t < 9);
  }
  expect(textBgTransfer.enabled).toBe(false);
});

it('flash is 36 BGP writes/72 ticks from frame_tables, leaving both OBJ registers unchanged', () => {
  const screen = new TransitionScreen(); screen.obp0 = 0xd0; screen.obp1 = 0xc8;
  const program = flashScreen(screen); program.next();
  const sequence: number[] = [screen.bgp];
  for (let tick = 1; tick < 72; tick++) {
    screen.vblank(); program.next(); sequence.push(screen.bgp);
    expect([screen.obp0, screen.obp1]).toEqual([0xd0, 0xc8]);
  }
  const table = [...tables.matchAll(/(?:^|\s)(\d+):\$([0-9A-F]{2})/gm)].map(match => parseInt(match[2], 16));
  expect(sequence).toEqual(table); expect(sequence).toHaveLength(72);
  screen.vblank(); expect(program.next().done).toBe(true); expect(textBgTransfer.enabled).toBe(false);
});

it.each(cases)('%s CPU cell sets match frame_tables, including Shrink/Split cell identities', (name, kind, spiralDirection) => {
  const sectionName = name.startsWith('x01') ? name.endsWith('in') ? 'Inward spiral' : 'Outward spiral' : name;
  expect(tables).toContain(`## ${sectionName}`);
  const screen = new TransitionScreen(), program = battleTransition(screen, { kind, spiralDirection });
  let tick = 0; program.next();
  const snapshots = new Map<number, readonly number[]>();
  while (true) { tick++; screen.vblank(); const next = program.next(); snapshots.set(tick, screen.cells); if (next.done) break; }
  if (kind === 'shrink' || kind === 'split') {
    for (let k = 1; k <= 9; k++) {
      const cells = snapshots.get(8 + (k - 1) * 6)!;
      const expected = Array<number>(360).fill(FF);
      for (let y = 0; y < 18 - 2 * k; y++) for (let x = 0; x < 20 - 2 * k; x++) {
        if (kind === 'shrink') {
          const sy = y < 9 - k ? y : y + 2 * k;
          const sx = x < 10 - k ? x : x + 2 * k;
          expected[(y + k) * 20 + x + k] = sy * 20 + sx;
        } else {
          const dy = y < 9 - k ? y : y + 2 * k, dx = x < 10 - k ? x : x + 2 * k;
          expected[dy * 20 + dx] = (y + k) * 20 + x + k;
        }
      }
      expect(cells).toEqual(expected);
    }
  } else if (kind !== 'spiral') {
    const section = tables.split(`## ${name}:`)[1].split('## ')[0];
    for (const row of section.matchAll(/CPU phase of tick\s+(\d+):[^\n]*?FF: (.*)/g)) {
      const at = Number(row[1]), cells = snapshots.get(at)!, before = snapshots.get(at - 1)!;
      const expected: number[] = [];
      for (const part of row[2].matchAll(/y(\d+):([\d,-]+)/g)) {
        for (const span of part[2].split(',')) {
          const [start, end = start] = span.split('-').map(Number);
          for (let x = start; x <= end; x++) expected.push(Number(part[1]) * 20 + x);
        }
      }
      expect(cells.flatMap((value, i) => value === FF && before[i] !== FF ? [i] : [])).toEqual(expected);
    }
  }
});

it('inward never writes (9,8); its final two CPU writes happen after the last transfer', () => {
  const screen = new TransitionScreen(), program = battleTransition(screen, { kind: 'spiral', spiralDirection: 1 });
  const writes: number[] = []; const original = screen.write.bind(screen);
  vi.spyOn(screen, 'write').mockImplementation((p, v) => { writes.push(p); original(p, v); });
  program.next(); for (let t = 1; t <= 161; t++) { screen.vblank(); program.next(); }
  expect(writes).toHaveLength(359); expect(writes).not.toContain(169); expect(writes.slice(-2)).toEqual([171, 170]);
  expect(screen.cells[169]).toBe(169); expect(screen.cells[171]).toBe(FF);
  expect(screen.visibleCells[171]).toBe(171); expect(screen.visibleCells[170]).toBe(170);
});

it('outward overshoots row 18 and leaves exactly the 19 cells pinned in frame_tables', () => {
  const screen = new TransitionScreen(), program = battleTransition(screen, { kind: 'spiral', spiralDirection: 0 });
  program.next(); for (let t = 1; t <= 128; t++) { screen.vblank(); program.next(); }
  expect(screen.cells.flatMap((value, i) => value !== FF ? [i] : [])).toEqual([0, 1, ...Array.from({ length: 17 }, (_, i) => (i + 1) * 20)]);
  for (let offset = 361; offset <= 379; offset++) expect(screen.read(offset)).toBe(FF);
  expect(screen.cells.filter(cell => cell === FF)).toHaveLength(341);
});

it('TransferDelay3 holds disabled phase, never resets it; BlackScreen has no waits', () => {
  textBgTransfer.tick(); textBgTransfer.enabled = false;
  const screen = new TransitionScreen(); screen.vblank(); expect(textBgTransfer.nextPortion).toBe(1);
  expect(runProgram(screen, transferDelay3())).toBe(3); expect(textBgTransfer.nextPortion).toBe(1);
  expect(textBgTransfer.enabled).toBe(false); expect(runProgram(screen, blackScreen(screen))).toBe(0);
  expect([screen.bgp, screen.obp0, screen.obp1]).toEqual([255, 255, 255]);
});

it('CopyTiles1/2 swap the pointers after each forward byte copy and fill the final row/column', () => {
  const rows = new TransitionScreen(); copyTiles1(rows, 140, 160, -40);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 20; x++) expect(rows.read(y * 20 + x)).toBe(y === 0 ? FF : (y - 1) * 20 + x);
  const cols = new TransitionScreen(); copyTiles2(cols, 8, 9, -2);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 10; x++) expect(cols.read(y * 20 + x)).toBe(x === 0 ? FF : y * 20 + x - 1);
});
