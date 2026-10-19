// ItemUseMedicine (engine/items/item_effects.asm) out of battle.
// The opening, the effect, the heal animation and the white return to the bag.
// Vitamins, drinks, PP and X items stay gaps.

import { playSFX, isSoundFinished } from '../audio';
import type { BattlePokemon } from '../battle';
import type { StatusCondition } from '../battle/types';
import type { Bag } from '../items';
import { monDisplayName } from '../pokemon_names';
import { isStarterPikachu } from '../pikachu/pikachu_follower';
import { modifyPikachuHappiness } from '../pikachu/pikachu_happiness';
import { setPikachuSpawnState } from '../pikachu/pikachu_spawn';
import { isPassPressed } from '../input';
import type { BgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import type { GameButton } from '../core';
import { HpBarAnimation, staticHpBarPixels } from './hp_bar';
import { PartyMenu } from './party_menu';
import { PartyMenuOpening } from './party_menu_opening';

/** HandleMenuInput_ watches A and B here; any other new key goes back to .loop1 (Delay3). */
const UNWATCHED: readonly GameButton[] = ['up', 'down', 'left', 'right', 'start', 'select'];

/** The target row as the screen last drew it, before ItemUseMedicine writes the party data. */
interface FrozenRow { pixels: number; shownHp: number; status: StatusCondition }

/** Items at or below CALCIUM. Full Heal and the Revives are past it, so they skip happiness. */
const HAPPINESS_ITEMS = new Set([
  'POTION', 'SUPER_POTION', 'HYPER_POTION', 'MAX_POTION', 'FULL_RESTORE',
  'ANTIDOTE', 'BURN_HEAL', 'ICE_HEAL', 'AWAKENING', 'PARALYZE_HEAL',
]);

const STATUS_CURE: Record<string, { status: StatusCondition | 'any'; program: string }> = {
  ANTIDOTE: { status: 'PSN', program: 'AntidoteText' },
  BURN_HEAL: { status: 'BRN', program: 'BurnHealText' },
  ICE_HEAL: { status: 'FRZ', program: 'IceHealText' },
  AWAKENING: { status: 'SLP', program: 'AwakeningText' },
  PARALYZE_HEAL: { status: 'PAR', program: 'ParlyzHealText' },
  FULL_HEAL: { status: 'any', program: 'FullHealText' },
};

export interface MedicineOutcome {
  effect: 'none' | 'hp' | 'status';
  program: string;
  sound: 'heal_hp' | 'heal_ailment' | null;
  oldHp: number;
  newHp: number;
  respawn: boolean;
}

/**
 * The effect, including the starter happiness call that runs before the check.
 * Writes the new HP and status into the party mon. Does not remove the item.
 */
export function applyFieldMedicine(itemId: string, mon: BattlePokemon): MedicineOutcome {
  const oldHp = mon.currentHp;
  if (isStarterPikachu(mon) && HAPPINESS_ITEMS.has(itemId)) modifyPikachuHappiness('USEDITEM');
  const none = (): MedicineOutcome => ({
    effect: 'none', program: 'ItemUseNoEffectText', sound: null, oldHp, newHp: oldHp, respawn: false,
  });

  const cure = STATUS_CURE[itemId];
  if (cure) {
    const matches = cure.status === 'any' ? mon.status !== null : mon.status === cure.status;
    if (!matches) return none();
    mon.status = null;
    return { effect: 'status', program: cure.program, sound: 'heal_ailment', oldHp, newHp: oldHp, respawn: false };
  }

  const revive = itemId === 'REVIVE' || itemId === 'MAX_REVIVE';
  const hpItem = revive || itemId === 'POTION' || itemId === 'SUPER_POTION' || itemId === 'HYPER_POTION'
    || itemId === 'MAX_POTION' || itemId === 'FULL_RESTORE';
  if (!hpItem) return none();

  const fainted = mon.currentHp <= 0;
  if (fainted !== revive) return none();
  if (!fainted && mon.currentHp >= mon.maxHp) {
    if (itemId === 'FULL_RESTORE' && mon.status) {
      mon.status = null;
      return { effect: 'status', program: 'FullHealText', sound: 'heal_ailment', oldHp, newHp: oldHp, respawn: false };
    }
    return none();
  }

  let newHp = mon.currentHp;
  if (itemId === 'REVIVE') newHp = mon.maxHp >> 1;
  else if (itemId === 'MAX_POTION' || itemId === 'FULL_RESTORE' || itemId === 'MAX_REVIVE') newHp = mon.maxHp;
  else if (itemId === 'POTION') newHp = Math.min(mon.maxHp, mon.currentHp + 20);
  else if (itemId === 'SUPER_POTION') newHp = Math.min(mon.maxHp, mon.currentHp + 50);
  else newHp = Math.min(mon.maxHp, mon.currentHp + 200);
  mon.currentHp = newHp;
  if (itemId === 'FULL_RESTORE') mon.status = null;
  const respawn = revive && starterWasFainted(mon, fainted);
  if (respawn) setPikachuSpawnState(3);
  return {
    effect: 'hp', program: revive ? 'ReviveText' : 'PotionText', sound: 'heal_hp',
    oldHp, newHp, respawn,
  };
}

function starterWasFainted(mon: BattlePokemon, fainted: boolean): boolean {
  return fainted && isStarterPikachu(mon);
}

export type MedicineStep = 'busy' | 'start-list' | 'run-list' | 'done';

type Phase =
  | 'opening' | 'input-delay' | 'choose'
  | 'sound-wait' | 'animate' | 'after-anim'
  | 'msg-clear' | 'msg-palette' | 'msg-text' | 'msg-show' | 'msg-hold' | 'msg-wait'
  | 'no-effect'
  | 'return-delay' | 'return-list';

/**
 * One field use, from the USE press. `paletteWhite` is the full-white overlay.
 * `showsParty` is false on the way back, while the bag list is being rebuilt.
 */
export class FieldMedicine {
  readonly partyMenu = new PartyMenu();
  /** True while this use's PrintText owns the text box; the bag ticks it once a frame. */
  get ownsTextBox(): boolean { return this.textBox.active; }
  paletteWhite = true;
  showsParty = true;
  private phase: Phase = 'opening';
  private readonly opening: PartyMenuOpening;
  private wait = 3;
  private outcome: MedicineOutcome | null = null;
  private anim: HpBarAnimation | null = null;
  private slot = 0;
  private listFrames = 0;
  private frozen: FrozenRow | null = null;
  private returnAge = 0;

  constructor(
    private readonly textBox: TextBox,
    private readonly transfer: BgTransfer,
    private readonly bag: Bag,
    private readonly party: BattlePokemon[],
    private readonly bagIndex: number,
  ) {
    this.partyMenu.showForItem(party, textBox);
    this.partyMenu.promptVisible = false;
    this.opening = new PartyMenuOpening(textBox, transfer, 'PartyMenuItemUseText');
  }

  frame(readJoypad: () => void): MedicineStep {
    switch (this.phase) {
      case 'opening': {
        const ready = this.opening.frame(); // BagSession already owns this frame's text/BG tick.
        this.paletteWhite = this.opening.paletteWhite;
        this.partyMenu.promptVisible = !this.paletteWhite;
        if (!ready) return 'busy';
        this.phase = 'choose';
        return this.choose(readJoypad);
      }
      case 'input-delay':
        this.wait -= 1;
        if (this.wait <= 0) this.phase = 'choose';
        return 'busy';
      case 'choose':
        return this.choose(readJoypad);
      case 'sound-wait':
        if (!isSoundFinished()) return 'busy';
        playSFX(this.outcome?.sound ?? 'heal_hp');
        if (this.outcome?.effect === 'hp') {
          const mon = this.party[this.slot];
          this.anim = new HpBarAnimation(this.outcome.oldHp, this.outcome.newHp, mon.maxHp);
          this.phase = 'animate';
          return this.animate();
        }
        return this.beginMessage();
      case 'animate':
        return this.animate();
      case 'after-anim':
        return this.beginMessage();
      case 'msg-clear':
      case 'msg-palette':
      case 'msg-text':
      case 'msg-show':
        return this.message();
      case 'msg-hold':
        this.wait -= 1;
        if (this.wait <= 0) { this.phase = 'msg-wait'; return this.waitPress(readJoypad); }
        return 'busy';
      case 'msg-wait':
        return this.waitPress(readJoypad);
      case 'no-effect':
        return this.noEffect();
      case 'return-delay':
        this.returnAge++;
        // Two palette/white waits (6), then player/font/text-box copies (26).
        if (this.returnAge === 6) this.transfer.enabled = false;
        if (this.returnAge === 32) this.transfer.enabled = true;
        if (this.returnAge === 39) {
          this.phase = 'return-list';
          this.showsParty = false;
          this.listFrames = 1;
          return 'start-list';
        }
        return 'busy';
      case 'return-list':
        this.listFrames += 1;
        if (this.listFrames === 13) this.paletteWhite = false;
        return this.listFrames === 13 ? 'done' : 'run-list';
      default:
        return 'busy';
    }
  }

  render(): void {
    if (this.showsParty) this.partyMenu.render();
  }

  /**
   * HandlePartyMenuInput: one Joypad read every frame (.loop2). A key it does not watch
   * goes back to .loop1, whose Delay3 reads nothing (review note 46 F-1).
   */
  private choose(readJoypad: () => void): MedicineStep {
    if (!this.partyMenu.ownsInput) readJoypad(); // sleeping prompt owns its TextBox reads
    const closed = this.partyMenu.update(isPassPressed);
    if (!closed) {
      if (UNWATCHED.some(key => isPassPressed(key))) {
        this.phase = 'input-delay';
        this.wait = 2;
      }
      return 'busy';
    }
    if (this.partyMenu.chosenIndex < 0) return this.beginReturn();
    this.slot = this.partyMenu.chosenIndex;
    const itemId = this.bag.items[this.bagIndex]?.id;
    const mon = this.party[this.slot];
    if (!itemId || !mon) return this.beginReturn();
    // The screen keeps this row's picture (bar, color, number, status) until the result
    // redraw; UpdateHPBar2 changes only the bar tiles and the number (note 46 F-2).
    const frozen: FrozenRow = {
      pixels: staticHpBarPixels(mon.currentHp, mon.maxHp), shownHp: mon.currentHp, status: mon.status,
    };
    const outcome = applyFieldMedicine(itemId, mon);
    this.outcome = outcome;
    if (outcome.effect !== 'none') {
      this.frozen = frozen;
      this.partyMenu.setHpOverride(this.slot, { ...frozen, colorPixels: frozen.pixels });
    }
    if (outcome.effect === 'none') {
      this.partyMenu.promptVisible = false;
      this.textBox.printStandalone({ program: 'ItemUseNoEffectText' });
      this.phase = 'no-effect';
      return 'busy';
    }
    this.bag.removeAt(this.bagIndex, 1);
    this.phase = 'sound-wait';
    return 'busy';
  }

  private animate(): MedicineStep {
    const anim = this.anim;
    if (!anim) return this.beginMessage();
    const frame = anim.tick();
    const frozen = this.frozen;
    this.partyMenu.setHpOverride(this.slot, {
      pixels: frame.pixels, shownHp: frame.shownHp,
      colorPixels: frozen?.pixels ?? frame.pixels, status: frozen?.status ?? null,
    });
    if (frame.done) this.phase = 'after-anim';
    return 'busy';
  }

  /** .showHealingItemMessage: transfer off; the old screen stays until the redraw transfers. */
  private beginMessage(): MedicineStep {
    this.transfer.enabled = false;
    this.phase = 'msg-clear';
    this.wait = 3;
    return 'busy';
  }

  private message(): MedicineStep {
    this.wait -= 1;
    if (this.wait > 0) return 'busy';
    if (this.phase === 'msg-clear') {
      this.phase = 'msg-palette';
      this.wait = 3; // SET_PAL_PARTY_MENU: CGB Delay3, E+4..E+6, before PrintText.
    } else if (this.phase === 'msg-palette') {
      this.phase = 'msg-text';
      this.wait = 3;
      // RedrawPartyMenu's PrintText: its box replaces the prompt.
      this.partyMenu.promptVisible = false;
      const outcome = this.outcome;
      const mon = this.party[this.slot];
      if (outcome) {
        this.textBox.printStandalone({ program: outcome.program }, {
          noDelay: true,
          bindings: { nameBuffer: mon ? monDisplayName(mon) : '', hpDifference: outcome.newHp - outcome.oldHp },
        });
      }
    } else if (this.phase === 'msg-text') {
      this.phase = 'msg-show';
      this.wait = 3;
      this.transfer.enabled = true;
      // The redraw becomes visible: the row's new HP, bar color and status, and no cursor
      // (ErasePartyMenuCursors).
      this.partyMenu.setHpOverride(this.slot, null);
      this.partyMenu.cursorVisible = false;
      this.frozen = null;
    } else {
      this.phase = 'msg-hold';
      this.wait = 50;
    }
    return 'busy';
  }

  /** ItemUseNoEffectText's prompt. The bag's frame ticks the text box (note 46 F-3). */
  private noEffect(): MedicineStep {
    if (!this.textBox.isComplete) return 'busy';
    return this.beginReturn();
  }

  private waitPress(readJoypad: () => void): MedicineStep {
    readJoypad();
    if (!isPassPressed('a') && !isPassPressed('b')) return 'busy';
    if (this.textBox.active) this.textBox.dismiss();
    return this.beginReturn();
  }

  private beginReturn(): MedicineStep {
    if (this.textBox.active) this.textBox.dismiss();
    this.paletteWhite = true;
    this.showsParty = true;
    this.partyMenu.promptVisible = false;
    this.phase = 'return-delay';
    // Conditional default-palette Delay3 + START's 35-frame restore, then list at P+39.
    this.returnAge = 0;
    this.listFrames = 0;
    return 'busy';
  }
}
