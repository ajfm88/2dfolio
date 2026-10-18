import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false, syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({ loadFont: async () => ({}), loadTileset: async () => ({}), fillRect: vi.fn(), drawTile: vi.fn() }));
import { PartyMenuOpening } from './party_menu_opening';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms } from '../text/program_data';
import { syncJoypadRead } from '../input';

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); setTextSpeed('slow'); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

describe('DisplayPartyMenu opening (note 58 §12.3)', () => {
  it.each([0, 1, 2].flatMap(portion => [false, true].map(medicine => ({ portion, medicine }))))(
    'prompt and transfer timing with portion $portion, medicine=$medicine', ({ portion, medicine }) => {
      for (let i = 0; i < portion; i++) textBgTransfer.tick();
      const box = new TextBox(), print = vi.spyOn(box, 'printStandalone');
      const opening = new PartyMenuOpening(box, textBgTransfer, medicine ? 'PartyMenuItemUseText' : 'PartyMenuNormalText');
      const tick = vi.spyOn(textBgTransfer, 'tick');
      expect(opening.paletteWhite).toBe(true);
      for (let frame = 1; frame <= 22; frame++) {
        const before = tick.mock.calls.length, third = textBgTransfer.nextPortion, enabled = textBgTransfer.enabled;
        if (medicine) { if (box.active) box.update(); else textBgTransfer.tick(); } // BagSession's owner
        else opening.present();
        const ready = opening.frame();
        expect(tick.mock.calls.length - before, `VBlank ${frame}`).toBe(1);
        expect(textBgTransfer.nextPortion).toBe(enabled ? (third + 1) % 3 : third);
        expect(textBgTransfer.enabled, `transfer ${frame}`).toBe(frame < 3 || frame >= 16);
        expect(opening.paletteWhite, `white ${frame}`).toBe(frame < 19);
        expect(ready, `first read ${frame}`).toBe(frame === 22);
        expect(print).toHaveBeenCalledTimes(frame < 13 ? 0 : 1);
        if (frame >= 13 && frame <= 18) {
          expect(box.active).toBe(true);
          expect(box.isComplete).toBe(frame >= 16);
          const text = box.saveScreen().buffer.join('');
          if (frame < 16) expect(text).not.toMatch(/[A-Za-z]/);
          else expect(text).toContain(medicine ? 'Use item on which' : 'Choose a');
        }
        if (frame >= 19) expect(box.active).toBe(false);
        expect(syncJoypadRead).not.toHaveBeenCalled();
      }
      expect(print).toHaveBeenCalledWith({ program: medicine ? 'PartyMenuItemUseText' : 'PartyMenuNormalText' }, { noDelay: true });
    },
  );
});
