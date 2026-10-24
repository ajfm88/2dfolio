import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false), isHeld: vi.fn(() => false) }));
import { isPassPressed } from '../input';
import type { GameButton } from '../core';
import { BattleState } from './battle_state';
import { BattleScreen, battleGlyphTile } from './battle_screen';
import { BattleTiles } from './battle_tiles';
import { D } from './battle_end_state';
import { displayTwoOptionMenu } from './battle_two_option';
import { textBgTransfer } from '../text/bg_transfer';

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); vi.clearAllMocks(); });
function run(options: { origin?: number[]; id?: number; phase?: number; keys?: (frame: number) => GameButton[];
  muted?: boolean; corruptBuffer?: boolean } = {}) {
  const s = new BattleState(), screen = new BattleScreen(), tiles = new BattleTiles(screen);
  const [x,y,cy,cx] = options.origin ?? [13,9,10,14];
  for (let i = 0; i < 360; i++) screen.put(i%20,Math.floor(i/20),0x80+i%100);
  for (let i = 0; i < 3 + (options.phase ?? 0); i++) screen.vblank();
  const before = [...screen.cells], saved = Array.from({ length:30 },(_,i) => before[(y+Math.floor(i/6))*20+x+i%6]);
  s.mem[D.wTwoOptionMenuID] = options.id ?? 0; s.mem[D.wStatusFlags5] = 0xe5;
  s.mem[D.wBuffer-1] = 0xa5; s.mem[D.wBuffer+30] = 0x5a;
  s.mem[D.wMiscFlags] = options.muted ? 32 : 0;
  s.mem[D.hDownArrowBlinkCount1] = 0x82; s.mem[D.hDownArrowBlinkCount2] = 0x91;
  let frame = 0; const reads: number[] = [], sounds: number[] = [], sprites: number[] = [], ledgers: unknown[] = [];
  const p = displayTwoOptionMenu(s,{ tiles, updateSprites: () => { sprites.push(frame); }, pressSound: () => { sounds.push(frame); },
    readJoypad: () => { reads.push(frame); const keys = options.keys?.(frame) ?? ['a'];
      vi.mocked(isPassPressed).mockImplementation(k => keys.includes(k));
    } },x,y,cy,cx);
  let step = p.next();
  expect(s.mem[D.wTwoOptionMenuID]).toBe(0); expect(s.mem[D.wStatusFlags5]).toBe(0xa5);
  expect([...s.mem.slice(D.wBuffer,D.wBuffer+30)]).toEqual(saved);
  expect([s.mem[D.wMenuWatchedKeys],s.wMaxMenuItem,s.mem[D.wTopMenuItemY],s.mem[D.wTopMenuItemX],s.wMenuWatchMovingOutOfBounds])
    .toEqual([3,1,cy,cx,0]);
  const first = s.wCurrentMenuItem; expect(first).toBe((options.id ?? 0) >>> 7);
  while (!step.done && frame < 100) {
    frame++; expect(step.value).toBe('serviced');
    screen.vblank();
    if (options.corruptBuffer && frame === 10) s.mem[D.wBuffer+13] = 0x33;
    ledgers.push({ frame, current:s.wCurrentMenuItem, chosen:s.mem[D.wChosenMenuItem], exit:s.mem[D.wMenuExitMethod],
      cells:screen.cells, visible:screen.visibleCells });
    step = p.next();
  }
  if (!step.done) throw new Error('menu did not finish');
  const physical = screen.cells.map(v => typeof v === 'number' ? v : battleGlyphTile(v));
  const expected = before.map(v => typeof v === 'number' ? v : battleGlyphTile(v));
  if ((options.id ?? 0) % 128 === 0) {
    if (options.corruptBuffer) expected[(y+2)*20+x+1] = 0x33;
    expect(physical).toEqual(expected);
  }
  expect([s.mem[D.wBuffer-1],s.mem[D.wBuffer+30]]).toEqual([0xa5,0x5a]);
  expect([s.mem[D.hDownArrowBlinkCount1],s.mem[D.hDownArrowBlinkCount2]]).toEqual([0x82,0x91]);
  expect(sprites).toEqual([0,frame]);
  return { s, screen, first, frame, reads, sounds, sprites, ledgers, result:step.value };
}

describe('tile DisplayTwoOptionMenu ledgers', () => {
  it.each([0,1,2])('all three battle origins restore exactly30 tiles with BG-third phase%i, first read3 and answer hold15', phase => {
    for (const origin of [[13,9,10,14],[0,7,8,1],[14,7,8,15]]) {
      const r = run({ phase, origin });
      expect(r.frame).toBe(18); expect(r.reads).toEqual([3]); expect(r.sounds).toEqual([3]); expect(r.result).toEqual({ carry:false });
      expect(r.ledgers.slice(3).every(row => (row as {exit:number}).exit === 1)).toBe(true);
      expect([r.s.wCurrentMenuItem,r.s.mem[D.wChosenMenuItem],r.s.mem[D.wMenuExitMethod]]).toEqual([0,0,1]);
    }
  });
  it.each([{ keys:['b'] as GameButton[] },{ keys:['a','b'] as GameButton[] }])('raw$keys selects NO from YES, with no last-cursor repaint', ({ keys }) => {
    const r = run({ keys: () => keys });
    expect(r.result).toEqual({ carry:true }); expect(r.frame).toBe(18); expect(r.sounds).toEqual([3]);
    expect([r.s.wCurrentMenuItem,r.s.mem[D.wChosenMenuItem],r.s.mem[D.wMenuExitMethod],r.s.mem[D.wLastMenuItem]]).toEqual([1,1,2,0]);
  });
  it('reads the high-bit NO default before clearing menu ID, and A accepts NO', () => {
    const r = run({ id:128 }); expect(r.first).toBe(1); expect(r.result).toEqual({ carry:true });
    expect(r.s.mem[D.wLastMenuItem]).toBe(1); expect(r.frame).toBe(18);
  });
  it('down redraws the cursor and re-arms3, B at6 answers NO; sound inhibition is respected', () => {
    const r = run({ muted:true, keys: frame => frame === 3 ? ['down'] : ['b'] });
    expect(r.reads).toEqual([3,6]); expect(r.frame).toBe(21); expect(r.result).toEqual({ carry:true });
    expect(r.s.mem[D.wLastMenuItem]).toBe(1); expect(r.sounds).toEqual([]);
    expect((r.ledgers[3] as {cells:unknown[]}).cells[12*20+14]).toBe('▶');
  });
  it('retains a nonzero menu ID long enough to select its source strings and width', () => {
    const r = run({ id:7 }); expect(r.first).toBe(0); expect(r.result).toEqual({ carry:false });
    const first = r.ledgers[0] as {cells:unknown[]}; expect(first.cells[10*20+15]).toBe('N'); // NO/YES, not YES/NO
  });
  it('restores from authoritative wBuffer rather than a hidden second snapshot', () => {
    expect(run({ corruptBuffer:true }).frame).toBe(18);
  });
  it('a wider menu ID retains the cartridge right-edge leftovers beyond its fixed30-cell save', () => {
    const r = run({ id:3, origin:[0,7,8,1] });
    for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
      expect(r.screen.at(col,7+row)).toBe(0x80+((7+row)*20+col)%100);
    }
    expect(r.screen.at(6,7)).toBe('─'); expect(r.screen.at(7,7)).toBe('┐');
  });
});
