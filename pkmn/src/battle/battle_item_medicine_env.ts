// Unused medicine presentation. pret e89ead15 home/pokemon.asm:187–306;
// engine/menus/party_menu.asm:1–235; engine/gfx/hp_bar.asm:48–283.
import { I } from './battle_item_state';
import { battleContext, decodeNick, type BattleState } from './battle_state';
import type { MedicineItemEnvironment } from './battle_item_medicine';
import type { BattleMenuScreen } from './battle_menu_screen';
import type { BattleScreen } from './battle_screen';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { delayFrames, type Program } from './battle_menu_context';
import { readHpBarWord, writeHpBarWord } from './battle_hp';
import { drawHpBar } from './battle_hud';
import { PartyMenu } from '../menus/party_menu';
import { PartyMenuOpening } from '../menus/party_menu_opening';
import { MenuInput } from '../menus/menu_input';
import { HpBarAnimation, staticHpBarPixels } from '../menus/hp_bar';
import type { PartyRowOverride } from '../menus/party_menu';
import type { GameButton } from '../core';
import { isPassPressed } from '../input';
import { textBgTransfer } from '../text/bg_transfer';
import { getPartyAndBillsSavedMenuItem } from '../list_state';
import { loadExperienceMonData } from './battle_experience';

/** RedrawPartyMenu_: LoadMonData runs after each row's icon, without a frame wait.
 * The following-starter $FF icon index never replaces wWhichPokemon. */
function loadDrawnPartyRows(state: BattleState): void {
  for (let row = 0; row < state.mem[I.wPartyCount]; row++) {
    state.wWhichPokemon = row;
    loadExperienceMonData(state);
  }
}

export interface MedicinePresentationHost {
  screen: BattleScreen;
  video: BattleMenuScreen;
  partyView: PartyMenu;
  readJoypad(): void;
  pressSound(): void;
}

// Same narrow unused-owner adaptation as battle_slides.ts: existing state/timing only,
// no duplicate palette engine, menu input implementation, sprite store or live edit.
type PartyPaletteOwner = { installPalettes(names: string[]): void; paletteFrames(): Program };
type UseItemOwner = { cursor: number;
  updateItemUse(pressed: (key: GameButton) => boolean, sound: () => void): 'close' | null };
const KEYS: readonly GameButton[] = ['a', 'b', 'select', 'start', 'right', 'left', 'up', 'down'];
const MESSAGES: Readonly<Record<number, string>> = { 0xf0: 'AntidoteText', 0xf1: 'BurnHealText',
  0xf2: 'IceHealText', 0xf3: 'AwakeningText', 0xf4: 'ParlyzHealText', 0xf5: 'PotionText',
  0xf6: 'FullHealText', 0xf7: 'ReviveText' };

/** home/pokemon.asm:187–306; item_effects.asm:1317–1377. No registration or live caller. */
export function createMedicineItemEnvironment(state: BattleState, host: MedicinePresentationHost): MedicineItemEnvironment {
  bindEntryBattleScreen(state, host.screen);
  if (host.video.screen !== host.screen) throw new Error('medicine requires the host video screen');
  const { screen, video, partyView: party } = host;
  const palette = screen as unknown as PartyPaletteOwner;
  let frozen: PartyRowOverride[] = [];
  function transfer(enabled: boolean): void {
    state.mem[I.hAutoBGTransferEnabled] = Number(enabled); textBgTransfer.enabled = enabled;
  }
  function white(): void { screen.bgp = screen.obp0 = screen.obp1 = 0; }
  function normal(): void { screen.bgp = 0xe4; screen.obp0 = 0xd0; }
  function blank(): void { for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, ' '); }
  // data/sgb/sgb_packets.asm PalPacket_PartyMenu; same screen owns all four bases.
  function installPartyPalette(): void { palette.installPalettes(['MEWMON', 'GREENBAR', 'YELLOWBAR', 'REDBAR']); }

  return {
    /** home/pokemon.asm:187–306. Medicine retains the pre-use row picture. */
    displayPartyMenu: function* (): Program<number | null> {
      frozen = state.partyMons.slice(0, state.mem[I.wPartyCount]).map(mon => ({
        pixels: staticHpBarPixels(mon!.currentHp, mon!.maxHp), shownHp: mon!.currentHp, status: mon!.status,
      }));
      return yield* displayUseItemPartyMenu(state, host);
    },

    /** hp_bar.asm:48–159,204–283. Type2 is the nonzero number schedule with
     * party placement(+9 columns), party right bracket$6C and LE scratch words. */
    animateHpBar: function* (x, y): Program {
      const oldHp = readHpBarWord(state, I.wHPBarOldHP), newHp = readHpBarWord(state, I.wHPBarNewHP);
      const maxHp = readHpBarWord(state, I.wHPBarMaxHP), type = state.wHPBarType;
      state.writeBE(I.wHPBarHPDifference, Math.abs(newHp - oldHp));
      const animation = new HpBarAnimation(oldHp, newHp, maxHp, type === 0 ? 0 : 1);
      if (animation.done) return;
      const slot = state.mem[I.wUsedItemOnWhichPokemon], delta = newHp > oldHp ? 1 : -1;
      state.wHPBarDelta = delta;
      while (!animation.done) {
        const frame = animation.tick();
        writeHpBarWord(state, I.wHPBarOldHP, frame.shownHp);
        writeHpBarWord(state, I.wHPBarNewHP, frame.shownHp === newHp ? newHp : frame.shownHp + delta);
        drawHpBar(screen, x, y, frame.pixels, type === 1 ? 1 : 0);
        if (type !== 0) {
          state.writeBE(I.wHPBarTempHP, frame.shownHp);
          const number = String(frame.shownHp).padStart(3, ' ');
          for (let i = 0; i < 3; i++) screen.put(x + ((state.mem[I.hUILayoutFlags] & 1) ? 9 : 1) + i,
            y + ((state.mem[I.hUILayoutFlags] & 1) ? 0 : 1), number[i]);
        }
        party.setHpOverride(slot, { ...frozen[slot], pixels: frame.pixels, shownHp: frame.shownHp,
          colorPixels: frozen[slot].pixels });
        yield 'serviced';
      }
    },

    /** home/copy2.asm:226–239. BG transfer was disabled by ItemUseMedicine. */
    clearScreen: function* (): Program { blank(); yield* delayFrames(3); },

    /** party_menu.asm:8–235. Clear3 (caller) + palette5 + PrintText3 + reveal3 =14. */
    redrawPartyMenu: function* (id): Program {
      const message = MESSAGES[id];
      if (!message) throw new Error(`unknown medicine message ${id}`);
      party.promptVisible = false; party.cursorVisible = false;
      frozen.forEach((_row, index) => party.setHpOverride(index, null));
      party.render(); loadDrawnPartyRows(state); installPartyPalette();
      yield* palette.paletteFrames();
      const savedFlags = state.mem[I.wStatusFlags5]; state.mem[I.wStatusFlags5] |= 0x40;
      video.textBox.printStandalone({ program: message }, { noDelay: true, bindings: {
        nameBuffer: decodeNick(state.mem, I.wPartyMonNicks + state.mem[I.wUsedItemOnWhichPokemon] * 11),
        hpDifference: state.readBE(I.wHPBarHPDifference),
      } });
      while (!video.textBox.isComplete) yield 'serviced';
      video.textBox.dismiss(); state.mem[I.wStatusFlags5] = savedFlags;
      transfer(true); yield* delayFrames(3); normal();
    },

    /** home/palettes.asm:34–51. The default command stored by SetPal_Battle is battle. */
    gbPalWhiteOut: white,
    runDefaultPaletteCommand: function* (): Program {
      const ctx = battleContext(state);
      yield* screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
        playerBar: state.wPlayerHPBarColor as 0 | 1 | 2, enemyBar: state.wEnemyHPBarColor as 0 | 1 | 2 });
    },
  };
}

/** home/pokemon.asm:187–306. Shared full USE_ITEM_PARTY_MENU session; first read24. */
export function* displayUseItemPartyMenu(state: BattleState, host: MedicinePresentationHost): Program<number | null> {
  bindEntryBattleScreen(state, host.screen);
  if (host.video.screen !== host.screen) throw new Error('medicine requires the host video screen');
  const { screen, video, partyView: party } = host;
  const palette = screen as unknown as PartyPaletteOwner;
  const useItem = party as unknown as UseItemOwner;
  function transfer(enabled: boolean): void {
    state.mem[I.hAutoBGTransferEnabled] = Number(enabled); textBgTransfer.enabled = enabled;
  }
  function white(): void { screen.bgp = screen.obp0 = screen.obp1 = 0; }
  function normal(): void { screen.bgp = 0xe4; screen.obp0 = 0xd0; }
  function blank(): void { for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, ' '); }
  // data/sgb/sgb_packets.asm PalPacket_PartyMenu; same screen owns all four bases.
  function installPartyPalette(): void { palette.installPalettes(['MEWMON', 'GREENBAR', 'YELLOWBAR', 'REDBAR']); }
  function* sessionFrame(): Program { yield 'session'; video.vblank(); }
  function selectedCells(slot: number): void {
    state.wWhichPokemon = slot;
    state.wCurPartySpecies = state.wBattleMonSpecies2 = state.mem[I.wPartySpecies + slot];
  }


  const mons = state.partyMons.slice(0, state.mem[I.wPartyCount]);
  if (mons.some(mon => !mon)) throw new Error('medicine requires the party mirror');
  party.showForItem(mons as NonNullable<typeof mons[number]>[], video.textBox);
  const frozen = mons.map(mon => ({ pixels: staticHpBarPixels(mon!.currentHp, mon!.maxHp),
    shownHp: mon!.currentHp, status: mon!.status }));
  party.promptVisible = false;
  const opening = new PartyMenuOpening(video.textBox, textBgTransfer, 'PartyMenuItemUseText');
  white();
  state.wMonDataLocation = state.wMenuWatchMovingOutOfBounds = 0;
  state.mem[I.wStatusFlags5] |= 0x40;
  state.mem[I.wTopMenuItemY] = 1; state.mem[I.wTopMenuItemX] = 0;
  state.wCurrentMenuItem = useItem.cursor;
  state.mem[I.wMaxMenuItem] = Math.max(0, mons.length - 1); state.mem[I.wMenuWatchedKeys] = 3;
  state.mem[I.wMenuWrappingEnabled] = 1;
  for (let age = 1; age <= 10; age++) {
    yield* sessionFrame(); opening.frame();
    if (age === 3) {
      transfer(false);
      for (let i = 0; i < 40; i++) screen.setOam(i, { x: 0, y: 0, tile: 0, attributes: 0 });
    }
    if (age === 7) blank();
  }
  party.render(); loadDrawnPartyRows(state); installPartyPalette();
  // Opening already accounts for the palette's three serviced waits. Advance its
  // age only on those waits; held frames tick neither the screen nor the TextBox.
  for (const frame of palette.paletteFrames()) {
    if (frame === 'held') yield 'held';
    else { yield* sessionFrame(); opening.frame(); }
  }
  for (let age = 14; age <= 19; age++) { yield* sessionFrame(); opening.frame(); }
  transfer(true); normal(); party.promptVisible = true;
  const input = new MenuInput({ watched: ['a', 'b'], maxItem: mons.length - 1,
    topX: 0, topY: 1, item: useItem.cursor });
  let closed: 'close' | null = null;
  while (!closed) {
    yield* sessionFrame();
    if (party.ownsInput) closed = party.update(isPassPressed); // retained sleeping-Pikachu text gate.
    else {
      let pressed: GameButton[] | null = null;
      input.item = useItem.cursor;
      input.update(() => { host.readJoypad(); pressed = KEYS.filter(isPassPressed); }, () => {});
      // MenuInput owns Delay3/read cadence. PartyMenu owns wrapping, A+B, saved
      // cursor and its starter gate; its sound callback routes through the battle host.
      if (pressed) closed = useItem.updateItemUse(key => pressed!.includes(key), host.pressSound);
    }
    state.wCurrentMenuItem = useItem.cursor;
  }
  state.mem[I.wPartyAndBillsPCSavedMenuItem] = getPartyAndBillsSavedMenuItem();
  state.mem[I.wStatusFlags5] &= ~0x40; state.mem[I.wMenuWrappingEnabled] = 0;
  const slot = party.chosenIndex;
  if (slot < 0) return null;
  selectedCells(slot);
  frozen.forEach((row, index) => party.setHpOverride(index, row));
  return slot;
}
