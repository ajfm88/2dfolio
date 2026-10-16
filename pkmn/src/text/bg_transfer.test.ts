import { describe, expect, it } from 'vitest';
import { BgTransfer } from './bg_transfer';
import { TextPrinter } from './text_printer';

describe('AutoBgMapTransfer bottom third', () => {
  it('copies the bottom third every third VBlank and keeps its phase between boxes', () => {
    const transfer = new BgTransfer(); expect(transfer.tick()).toBe(false);
    // Disabling it between boxes does not reset hAutoBGTransferPortion.
    expect(transfer.tick()).toBe(false); expect(transfer.tick()).toBe(true);
    expect([transfer.tick(), transfer.tick(), transfer.tick()]).toEqual([false, false, true]);
  });
  it('disabling copies nothing and holds the portion', () => {
    const transfer = new BgTransfer();
    transfer.tick();
    expect(transfer.nextPortion).toBe(1);
    transfer.enabled = false;
    for (let frame = 0; frame < 10; frame++) expect(transfer.tick()).toBe(false);
    expect(transfer.nextPortion).toBe(1);
    transfer.enabled = true;
    expect(transfer.tick()).toBe(false);
    expect(transfer.nextPortion).toBe(2);
    expect(transfer.tick()).toBe(true);
  });
  it.each([1, 3])('at speed %i, visible writes match the cartridge transfer cadence', speed => {
    const transfer = new BgTransfer();
    const printer = new TextPrinter('ABCDEFGHI', { buttons: () => speed === 1 ? 1 : 0,
      speed: () => speed, soundFinished: () => true, beep: () => {} }, speed === 1 ? 1 : 0);
    const snapshots: string[] = [];
    for (let frame = 1; frame <= 9; frame++) {
      if (transfer.tick()) snapshots.push(printer.buffer.slice(41, 59).join('').trimEnd());
      printer.advance();
    }
    expect(snapshots).toEqual(speed === 1 ? ['ABC', 'ABCDEF', 'ABCDEFGHI'] : ['A', 'AB', 'ABC']);
  });
});
