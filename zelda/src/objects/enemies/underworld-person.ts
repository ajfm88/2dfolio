// Dungeon old men — UnderworldPerson $4B-$50/$52 and the life-or-money man $51.
// Z_01.asm: InitUnderworldPerson_Full (1011) + InitUnderworldPersonA/B/C,
//           UpdateUnderworldPerson_Full (1170), UpdateUnderworldPersonComplex (1215),
//           InitUnderworldPersonLifeOrMoney_Full (1056),
//           UpdateUnderworldPersonLifeOrMoney_Full (1328).
//
// Which hint a person gives depends on the level, not just the type:
//   Levels 1, 2, 5, 7 → table A, "complex" update (the $4F man sells bomb capacity)
//   Levels 3, 4, 6, 8 → table B, talk only
//   Level 9           → table C; the $4B entrance man steps aside (and opens the
//                       shutters) once Link holds all eight Triforce pieces.

import type { Renderer } from '../../render/renderer.js';
import { drawNpcSprite } from '../../render/boss-sprite-data.js';
import { drawItemSprite, getProcessedItemsCanvas } from '../../data/item-sprites.js';
import { personTextLines } from './person-textbox.js';
import { RoomPerson, linkNesY, type PersonRoomContext } from './room-person.js';

export const UNDERWORLD_PERSON_FIRST = 0x4b;
export const UNDERWORLD_PERSON_LAST = 0x52;
export const BOMB_CAPACITY_MAN = 0x4f;
export const LIFE_OR_MONEY_MAN = 0x51;
const LEVEL9_ENTRANCE_MAN = 0x4b;

// Text selectors, indexed by type − $4B.
const TEXT_SELECTORS_A = [0x28, 0x26, 0x2e, 0x30, 0x32, 0x3e, 0x3e, 0x34] as const;
const TEXT_SELECTORS_B = [0x2a, 0x38, 0x3a, 0x2c, 0x40, 0x42, 0x42, 0x3c] as const;
const TEXT_SELECTORS_C = [0x44, 0x46, 0x48, 0x4a] as const;
const LIFE_OR_MONEY_SELECTOR = 0x36;

const ALL_TRIFORCE = 0xff;
// UpdateUnderworldPersonComplexState_Begin / LifeOrMoney state 0: $A frames
// before the first character.
const COMPLEX_TEXT_DELAY = 0x0a;
// L_Person_FlagItemTakenAndAdvanceState: $40 frames of flicker, then gone.
const LEAVE_FRAMES = 0x40;

const OLD_MAN_SPRITE = { sx: 1, sy: 11, sw: 16, sh: 16 } as const;
const ONE_RUPEE_ITEM = 0x18;
const HEART_CONTAINER_ITEM = 0x1a;

// Offers sit at NES ObjY $98; Link must line up exactly on X and come within 6px.
const OFFER_NES_Y = 0x98;
const OFFER_Y = OFFER_NES_Y - 0x3d;
const OFFER_TOUCH_DY = 6;
const BOMB_OFFER_X = 0x78;
const BOMB_CAPACITY_PRICE = 100;
const BOMB_CAPACITY_STEP = 4;
// LifeOrMoneyItemXs / LifeOrMoneyItemTypes: heart container left, rupee right.
const LIFE_OFFER_X = 0x58;
const MONEY_OFFER_X = 0x98;
const MONEY_PRICE = 50;

// Price text: row 22 of the nametable (screen Y $B0) minus the status bar.
export const PRICE_TEXT_Y = 0xb0 - 0x40;
// BombCapacityPriceTextTransferBuf at $22CD → column 13.
const BOMB_PRICE_TEXT = { x: 13 * 8, text: '-100' } as const;
// LifeOrMoneyCostTextTransferBuf at $22CB → "-1" at column 11, "-50" at column 18.
const LIFE_PRICE_TEXTS = [{ x: 11 * 8, text: '-1' }, { x: 18 * 8, text: '-50' }] as const;

export interface PriceText {
  readonly x: number;
  readonly text: string;
}

/** Hint table group for a level: 'A' complex, 'B' talk-only, 'C' Level 9. */
export function personGroup(level: number): 'A' | 'B' | 'C' | null {
  switch (level) {
    case 1: case 2: case 5: case 7: return 'A';
    case 3: case 4: case 6: case 8: return 'B';
    case 9: return 'C';
    default: return null;
  }
}

/** InitUnderworldPersonA/B/C text selector, or null if the ROM has none. */
export function personTextSelector(objectType: number, level: number): number | null {
  const index = objectType - UNDERWORLD_PERSON_FIRST;
  switch (personGroup(level)) {
    case 'A': return TEXT_SELECTORS_A[index] ?? null;
    case 'B': return TEXT_SELECTORS_B[index] ?? null;
    case 'C': return TEXT_SELECTORS_C[index] ?? null;
    default: return null;
  }
}

function drawOldMan(renderer: Renderer, x: number, y: number): void {
  drawNpcSprite(renderer, OLD_MAN_SPRITE, x, y);
}

/** Item offers are 8px wide; drawItemSprite centres them in a 16px cell. */
function drawOffer(renderer: Renderer, itemId: number, x: number): void {
  const items = getProcessedItemsCanvas();
  if (items) drawItemSprite(renderer.ctx, items, itemId, x - 4, OFFER_Y);
}

function touchesOffer(linkX: number, linkY: number, offerX: number): boolean {
  return linkX === offerX && Math.abs(linkNesY(linkY) - OFFER_NES_Y) < OFFER_TOUCH_DY;
}

export class UnderworldPerson extends RoomPerson {
  private _complex = false;
  private _opensShutters = false;
  private _sold = false;
  private _leaveTimer = 0;

  /** Level 9 entrance man with a full Triforce — main.ts opens the shutters. */
  get opensShutters(): boolean { return this._opensShutters; }

  /** The bomb-capacity offer (rupee + "-100") shown by the $4F man in table-A levels. */
  get sellsBombCapacity(): boolean {
    return this._complex && this._objectType === BOMB_CAPACITY_MAN && !this._sold;
  }

  /** Prices main.ts draws on row 22 while the person is shown. */
  get priceTexts(): readonly PriceText[] {
    return this.sellsBombCapacity && this.isActive ? [BOMB_PRICE_TEXT] : [];
  }

  setup(ctx: PersonRoomContext): void {
    const group = personGroup(ctx.level);
    this._complex = group === 'A';
    const selector = personTextSelector(this._objectType, ctx.level);

    // InitUnderworldPersonA: the bomb-capacity man is gone once bought from.
    if (group === 'A' && this._objectType === BOMB_CAPACITY_MAN && ctx.itemTaken) {
      this.remove();
      return;
    }
    // InitUnderworldPersonC: with all 8 pieces the Level 9 gatekeeper opens the
    // shutters and is destroyed before saying anything.
    if (group === 'C' && this._objectType === LEVEL9_ENTRANCE_MAN && ctx.triforce === ALL_TRIFORCE) {
      this._opensShutters = true;
      this.remove();
      return;
    }
    if (selector === null) return;
    this.startText(personTextLines(selector), this._complex ? COMPLEX_TEXT_DELAY : 0);
  }

  /**
   * UpdateUnderworldPersonComplexState_SenseLink: standing on the rupee at
   * ($78, $98) with at least 100 rupees buys +4 bomb capacity. Returns true on
   * the frame of the sale; main.ts applies it and flags the room item taken.
   */
  tryBombCapacitySale(linkX: number, linkY: number, rupees: number): boolean {
    if (!this.sellsBombCapacity || !this._textbox?.done || this._leaveTimer > 0) return false;
    if (!touchesOffer(linkX, linkY, BOMB_OFFER_X)) return false;
    if (rupees < BOMB_CAPACITY_PRICE) return false;
    this._sold = true;
    this.beginLeaving();
    return true;
  }

  private beginLeaving(): void {
    this._textbox?.clear();
    this._flicker = true;
    this._leaveTimer = LEAVE_FRAMES;
  }

  protected updatePerson(): void {
    if (this._leaveTimer > 0 && --this._leaveTimer === 0) this.remove();
  }

  protected drawPerson(renderer: Renderer): void {
    drawOldMan(renderer, this._x, this._y);
  }

  // UpdateUnderworldPersonComplex: the $4F man's rupee at ($78, $98), drawn every
  // frame the man is (including while he flickers away after the sale).
  protected override drawWares(renderer: Renderer): void {
    if (this._complex && this._objectType === BOMB_CAPACITY_MAN) {
      drawOffer(renderer, ONE_RUPEE_ITEM, BOMB_OFFER_X);
    }
  }
}

export const BOMB_CAPACITY = { price: BOMB_CAPACITY_PRICE, step: BOMB_CAPACITY_STEP } as const;

export type LifeOrMoneyChoice = 'life' | 'money';

/** $51 — "LEAVE YOUR LIFE OR MONEY!": a heart container or 50 rupees opens the shutters. */
export class UnderworldPersonLifeOrMoney extends RoomPerson {
  private _paid = false;
  private _leaveTimer = 0;

  constructor() {
    super(LIFE_OR_MONEY_MAN);
  }

  get priceTexts(): readonly PriceText[] {
    return this.isActive && !this._paid ? LIFE_PRICE_TEXTS : [];
  }

  setup(ctx: PersonRoomContext): void {
    // UnderworldPerson_DestroyIfTaken.
    if (ctx.itemTaken) {
      this.remove();
      return;
    }
    this.startText(personTextLines(LIFE_OR_MONEY_SELECTOR), COMPLEX_TEXT_DELAY);
  }

  /**
   * UpdateUnderworldPersonLifeOrMoneyState_2: line up on an offer (exact X,
   * |dy| < 6). The money needs 50 rupees; the heart container is always taken.
   */
  tryChoice(linkX: number, linkY: number, rupees: number): LifeOrMoneyChoice | null {
    if (this._paid || !this._textbox?.done) return null;
    let choice: LifeOrMoneyChoice | null = null;
    if (touchesOffer(linkX, linkY, LIFE_OFFER_X)) choice = 'life';
    else if (touchesOffer(linkX, linkY, MONEY_OFFER_X) && rupees >= MONEY_PRICE) choice = 'money';
    if (!choice) return null;
    this._paid = true;
    this._textbox.clear();
    this._flicker = true;
    this._leaveTimer = LEAVE_FRAMES;
    return choice;
  }

  protected updatePerson(): void {
    if (this._leaveTimer > 0 && --this._leaveTimer === 0) this.remove();
  }

  protected drawPerson(renderer: Renderer): void {
    drawOldMan(renderer, this._x, this._y);
  }

  protected override drawWares(renderer: Renderer): void {
    drawOffer(renderer, HEART_CONTAINER_ITEM, LIFE_OFFER_X);
    drawOffer(renderer, ONE_RUPEE_ITEM, MONEY_OFFER_X);
  }
}

export const LIFE_OR_MONEY = { moneyPrice: MONEY_PRICE } as const;

/**
 * @PayWithHeartContainer, in half-hearts. Under 4 containers Link keeps them
 * but is left on his last half heart; otherwise one container and one heart go.
 */
export function payWithHeartContainer(health: number, maxHealth: number): { health: number; maxHealth: number } {
  const containers = maxHealth / 2;
  if (containers < 4) return { health: 1, maxHealth };
  const newMax = maxHealth - 2;
  return { health: Math.max(1, Math.min(newMax, health - 2)), maxHealth: newMax };
}
