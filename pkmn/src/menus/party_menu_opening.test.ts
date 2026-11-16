import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false, syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({ loadFont: async () => ({}), loadTileset: async () => ({}), fillRect: vi.fn(), drawTile: vi.fn() }));
import { PartyMenuOpening } from './party_menu_opening';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms } from '../text/program_data';
import { syncJoypadRead } from '../input';
import { isVBlankHeld, takeHeldFrame } from '../core/vblank_hold';
import * as paletteHold from '../core/vblank_hold';
import { BattleScreen } from '../battle/battle_screen';

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); setTextSpeed('slow'); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

describe('DisplayPartyMenu opening (note 58 §12.3)', () => {
  it.each([0, 1, 2].flatMap(portion => [false, true].map(medicine => ({ portion, medicine }))))(
    'battle-owned palette uses physical age without touching field holds, portion $portion, medicine=$medicine', ({ portion, medicine }) => {
      for (let i = 0; i < portion; i++) textBgTransfer.tick();
      const box = new TextBox(), screen = new BattleScreen();
      const opening = new PartyMenuOpening(box, textBgTransfer,
        medicine ? 'PartyMenuItemUseText' : 'PartyMenuNormalText', 'battle');
      const hold = vi.spyOn(paletteHold, 'holdVBlank'), take = vi.spyOn(paletteHold, 'takeHeldFrame');
      const tick = vi.spyOn(textBgTransfer, 'tick'), update = vi.spyOn(box, 'update');
      let command: Generator<'held' | 'serviced'> | null = null;
      for (let frame = 1; frame <= 24; frame++) {
        if (opening.paletteCommandDue) command = screen.setPalPartyMenu();
        const paletteFrame = command?.next();
        if (paletteFrame?.done) command = null;
        const held = !paletteFrame?.done && paletteFrame?.value === 'held';
        expect(held, `C+${frame} held`).toBe(frame === 11 || frame === 12);
        const before = tick.mock.calls.length, updates = update.mock.calls.length;
        if (!held) opening.present();
        expect(opening.frame()).toBe(frame === 24);
        expect(tick.mock.calls.length - before).toBe(held ? 0 : 1);
        if (held) expect(update).toHaveBeenCalledTimes(updates);
        expect(opening.paletteWhite).toBe(frame < 21);
        expect(isVBlankHeld()).toBe(false);
      }
      expect(hold).not.toHaveBeenCalled(); expect(take).not.toHaveBeenCalled();
      expect([0, 1, 2, 3].map(i => screen.paletteName(i))).toEqual(['MEWMON', 'GREENBAR', 'YELLOWBAR', 'REDBAR']);
    },
  );
  it.each([0, 1, 2].flatMap(portion => [false, true].map(medicine => ({ portion, medicine }))))(
    'prompt and transfer timing with portion $portion, medicine=$medicine', ({ portion, medicine }) => {
      for (let i = 0; i < portion; i++) textBgTransfer.tick();
      const box = new TextBox(), print = vi.spyOn(box, 'printStandalone');
      const opening = new PartyMenuOpening(box, textBgTransfer, medicine ? 'PartyMenuItemUseText' : 'PartyMenuNormalText');
      const tick = vi.spyOn(textBgTransfer, 'tick');
      expect(opening.paletteWhite).toBe(true);
      for (let frame = 1; frame <= 24; frame++) {
        const before = tick.mock.calls.length, third = textBgTransfer.nextPortion, enabled = textBgTransfer.enabled;
        const held = frame === 11 || frame === 12;
        expect(isVBlankHeld()).toBe(held);
        if (medicine) { if (takeHeldFrame()) { /* BagSession skips VBlank. */ } else if (box.active) box.update(); else textBgTransfer.tick(); } // BagSession's owner
        else opening.present();
        const ready = opening.frame();
        expect(tick.mock.calls.length - before, `VBlank ${frame}`).toBe(held ? 0 : 1);
        expect(textBgTransfer.nextPortion).toBe(enabled && !held ? (third + 1) % 3 : third);
        expect(textBgTransfer.enabled, `transfer ${frame}`).toBe(frame < 3 || frame >= 18);
        expect(opening.paletteWhite, `white ${frame}`).toBe(frame < 21);
        expect(ready, `first read ${frame}`).toBe(frame === 24);
        expect(print).toHaveBeenCalledTimes(frame < 15 ? 0 : 1);
        if (frame >= 15 && frame <= 20) {
          expect(box.active).toBe(true);
          expect(box.isComplete).toBe(frame >= 18);
          const text = box.saveScreen().buffer.join('');
          if (frame < 18) expect(text).not.toMatch(/[A-Za-z]/);
          else expect(text).toContain(medicine ? 'Use item on which' : 'Choose a');
        }
        if (frame >= 21) expect(box.active).toBe(false);
        expect(syncJoypadRead).not.toHaveBeenCalled();
      }
      expect(print).toHaveBeenCalledWith({ program: medicine ? 'PartyMenuItemUseText' : 'PartyMenuNormalText' }, { noDelay: true });
    },
  );
});
