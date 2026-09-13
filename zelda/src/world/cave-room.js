import { PLAY_AREA_HEIGHT, SCREEN_WIDTH } from '../core/constants.js';
import { Direction } from '../core/types.js';
import { drawItemSprite } from '../data/item-sprites.js';
import { drawFireSprite } from '../render/boss-sprite-data.js';

// NES cave layout positions (play-area-relative)
const NPC_X = 120;
const NPC_Y = 72;
const FIRE_LEFT_X = 88;
const FIRE_RIGHT_X = 152;
const FIRE_Y = 72;
const TEXT_Y = 48;

// NES item X positions from Z_01.asm CaveWareXs: $58, $78, $98
const ITEM_XS = [88, 120, 152];
const ITEM_Y = 88; // NES ObjY $98 - HUD $40 = $58 = 88
const PRICE_Y = 108; // Below items, above rupee indicator
const RUPEE_INDICATOR_X = 48; // NES $30
const RUPEE_INDICATOR_Y = 107; // NES $AB - $40 = $6B = 107

const CAVE_ENTRY_X = 112;
const CAVE_ENTRY_Y = 153;

const CAVE_FLOOR_LEFT = 48;
const CAVE_FLOOR_RIGHT = 192;
const CAVE_FLOOR_TOP = 64;
const CAVE_FLOOR_BOTTOM = 160;

const CAVE_EXIT_Y = 160;
const WALK_IN_FRAMES = 32;

// Item proximity check (NES uses exact X match + |dy| < 6)
const ITEM_TOUCH_DX = 12;
const ITEM_TOUCH_DY = 10;

function getNpcType(objectType) {
  if (objectType >= 0x7b) return 'moblin';
  if (objectType === 0x70 || objectType === 0x79 || objectType === 0x7a) return 'oldWoman';
  return 'oldMan';
}

function getCaveBehavior(objectType) {
  if (objectType >= 0x7b) return 'moblinGive';
  if (objectType === 0x71) return 'doorRepair';
  if (objectType === 0x72) return 'gift';
  if (objectType === 0x74) return 'potionShop';
  if (objectType === 0x70) return 'moneyGame';
  if (objectType < 0x6e) return 'gift';
  if (objectType >= 0x75 && objectType <= 0x7a) return 'shop';
  if (objectType === 0x73) return 'hint';
  return 'hint';
}

function getHeartRequirement(objectType) {
  if (objectType === 0x6c) return 10;
  if (objectType === 0x6d) return 24;
  return 0;
}

// Money game: generate 3 random amounts per NES algorithm (Z_01.asm InitCaveContinue)
function generateMoneyGameAmounts() {
  const winAmount = Math.random() < 0.5 ? 20 : 50;
  const lossRandom = Math.random() < 0.5 ? 10 : 40;
  const lossFixed = 10;
  const pool = [lossRandom, lossFixed, winAmount];
  // Shuffle using Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export class CaveRoom {
    caveMap;
    npcsImage;
    itemsImage;
    font;
    contents;
    textLines;
    npcType;
   behavior;
    heartReq;

   _itemPickedUp = false;
   _exitRequested = false;
   _walkInFrames = WALK_IN_FRAMES;
   _rupeeReward = 0;

  // Shop state
   _shopSlotTaken = [false, false, false];
   _purchaseEvent = null;
   _letterDelivered = false;

  // Money game state
   _moneyGameAmounts = [];
   _moneyGameResult = null;
   _moneyGamePaid = false;
   _moneyGameChosen = false;

  constructor(
    caveMap,
    npcsImage,
    itemsImage,
    font,
    contents,
    textMessage,
  ) {
    this.caveMap = caveMap;
    this.npcsImage = npcsImage;
    this.itemsImage = itemsImage;
    this.font = font;
    this.contents = contents;
    this.textLines = textMessage?.lines ?? [];
    this.npcType = getNpcType(contents.objectType);
    this.behavior = getCaveBehavior(contents.objectType);
    this.heartReq = getHeartRequirement(contents.objectType);

    if (this.behavior === 'moblinGive') {
      this._rupeeReward = contents.prices[1] ?? 0;
    }

    if (this.behavior === 'moneyGame') {
      this._moneyGameAmounts = generateMoneyGameAmounts();
    }
  }

  get exitRequested() {
    return this._exitRequested;
  }

  get itemPickedUp() {
    return this._itemPickedUp;
  }

  get pickedUpItemId() {
    if (!this._itemPickedUp) return -1;
    return this.getCenterItemId();
  }

  get rupeeReward() {
    return this._rupeeReward;
  }

  get purchaseEvent() {
    return this._purchaseEvent;
  }

  get moneyGameResult() {
    return this._moneyGameResult;
  }

  clearPurchaseEvent() {
    this._purchaseEvent = null;
  }

  clearMoneyGameResult() {
    this._moneyGameResult = null;
  }

  initLink(link) {
    link.setPosition(CAVE_ENTRY_X, CAVE_ENTRY_Y);
    link.setDirection(Direction.Up);
  }

  update(link) {
    // Tick once per logic frame so both fires share a frame. Incrementing
    // inside drawFire (called twice per render) made the swap 2× too fast
    // and put left/right on opposite sprites (Z_01 Fire % 12 > 6).
    this._fireFrame = (this._fireFrame + 1) % 12;

    if (this._walkInFrames > 0) {
      this._walkInFrames--;
      link.walkForward();
      return;
    }

    if (link.posY >= CAVE_EXIT_Y) {
      this._exitRequested = true;
      return;
    }

    if (this.behavior === 'hint' || this.behavior === 'doorRepair') {
      return;
    }

    if (this.behavior === 'gift' || this.behavior === 'moblinGive') {
      this.updateGiftPickup(link);
      return;
    }

    if (this.behavior === 'shop') {
      this.updateShopPickup(link);
      return;
    }

    if (this.behavior === 'potionShop') {
      this.updatePotionShop(link);
      return;
    }

    if (this.behavior === 'moneyGame') {
      this.updateMoneyGame(link);
      return;
    }
  }

  updateMovement(link, dx, dy) {
    if (this._walkInFrames > 0) return;

    const nx = link.posX + dx;
    const ny = link.posY + dy;

    if (nx >= CAVE_FLOOR_LEFT && nx <= CAVE_FLOOR_RIGHT &&
        ny >= CAVE_FLOOR_TOP && ny <= CAVE_FLOOR_BOTTOM + 16) {
      link.setPosition(nx, ny);
    }
  }

  render(renderer, link, linkSheet) {
    const ctx = renderer.ctx;

    ctx.drawImage(this.caveMap, 0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, 0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT);

    this.drawFire(renderer, FIRE_LEFT_X, FIRE_Y);
    this.drawFire(renderer, FIRE_RIGHT_X, FIRE_Y);

    this.drawNpc(ctx, NPC_X, NPC_Y);

    if (this.behavior === 'gift' || this.behavior === 'moblinGive') {
      if (!this._itemPickedUp && this.hasPickableItem()) {
        this.drawItem(ctx, ITEM_XS[1], ITEM_Y, this.getCenterItemId());
      }
    } else if (this.behavior === 'shop') {
      this.renderShopItems(ctx, renderer);
    } else if (this.behavior === 'potionShop' && this._letterDelivered) {
      this.renderShopItems(ctx, renderer);
    } else if (this.behavior === 'moneyGame') {
      this.renderMoneyGame(ctx, renderer);
    }

    this.drawText(renderer);

    if (link.isVisible) {
      link.render(renderer, linkSheet);
    }
  }

  // --- Gift pickup (E4a) ---

   updateGiftPickup(link) {
    if (this._itemPickedUp || !this.hasPickableItem()) return;
    const dx = Math.abs(link.posX - ITEM_XS[1]);
    const dy = Math.abs(link.posY - ITEM_Y);
    if (dx < ITEM_TOUCH_DX && dy < ITEM_TOUCH_DY) {
      if (this.heartReq > 0 && link.maxHealth < this.heartReq) return;
      this._itemPickedUp = true;
    }
  }

  // --- Shop (E4b) ---

   updateShopPickup(link) {
    if (this._purchaseEvent) return; // waiting for main.ts to process

    for (let i = 0; i < 3; i++) {
      if (this._shopSlotTaken[i]) continue;
      const rawItem = this.contents.items[i];
      if (rawItem === undefined || (rawItem & 0x3f) === 0x3f) continue;

      const itemX = ITEM_XS[i];
      const dx = Math.abs(link.posX - itemX);
      const dy = Math.abs(link.posY - ITEM_Y);

      if (dx < ITEM_TOUCH_DX && dy < ITEM_TOUCH_DY) {
        const price = this.contents.prices[i] ?? 0;
        if (link.rupees < price) continue; // can't afford

        this._shopSlotTaken[i] = true;
        this._purchaseEvent = {
          slotIndex: i,
          itemId: rawItem & 0x3f,
          price
        };
        return;
      }
    }
  }

  // Z_01.asm:319 — potion shop requires letter delivery before selling
   updatePotionShop(link) {
    if (link.inventory.letter === 0) return;

    // Auto-deliver letter on first visit
    if (link.inventory.letter === 1 && !this._letterDelivered) {
      link.inventory.letter = 2;
      this._letterDelivered = true;
      // NES plays "secret found" tune — audio is K-phase
    }

    if (link.inventory.letter >= 2) {
      this.updateShopPickup(link);
    }
  }

   renderShopItems(ctx, renderer) {
    let hasAnyItem = false;

    for (let i = 0; i < 3; i++) {
      if (this._shopSlotTaken[i]) continue;
      const rawItem = this.contents.items[i];
      if (rawItem === undefined || (rawItem & 0x3f) === 0x3f) continue;

      hasAnyItem = true;
      this.drawItem(ctx, ITEM_XS[i], ITEM_Y, rawItem & 0x3f);

      const price = this.contents.prices[i] ?? 0;
      if (price > 0) {
        const priceStr = price.toString();
        const px = ITEM_XS[i] + 8 - (priceStr.length * 4);
        this.font.drawString(renderer, px, PRICE_Y, priceStr);
      }
    }

    if (hasAnyItem) {
      // Rupee indicator: rupee shape + "X"
      ctx.fillStyle = '#f0c000';
      ctx.fillRect(RUPEE_INDICATOR_X, RUPEE_INDICATOR_Y, 8, 8);
      this.font.drawString(renderer, RUPEE_INDICATOR_X + 12, RUPEE_INDICATOR_Y, 'X');
    }
  }

  // --- Money Game (E4b) ---

   updateMoneyGame(link) {
    if (this._moneyGameChosen) return;

    // Pay 10 rupees on first touch of any position
    if (!this._moneyGamePaid) {
      for (let i = 0; i < 3; i++) {
        const dx = Math.abs(link.posX - ITEM_XS[i]);
        const dy = Math.abs(link.posY - ITEM_Y);
        if (dx < ITEM_TOUCH_DX && dy < ITEM_TOUCH_DY) {
          if (link.rupees < 10) return;
          this._moneyGamePaid = true;
          this._moneyGameChosen = true;
          const amount = this._moneyGameAmounts[i] ?? 0;
          const isWin = amount === 20 || amount === 50;
          this._moneyGameResult = {
            amount: isWin ? amount : -amount,
            isWin
          };
          return;
        }
      }
      return;
    }
  }

   renderMoneyGame(ctx, renderer) {
    if (this._moneyGameChosen) {
      for (let i = 0; i < 3; i++) {
        const amount = this._moneyGameAmounts[i] ?? 0;
        const isWin = amount === 20 || amount === 50;
        const sign = isWin ? '+' : '-';
        const str = `${sign}${amount}`;
        const px = ITEM_XS[i] + 8 - (str.length * 4);
        this.font.drawString(renderer, px, ITEM_Y, str);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        this.drawItem(ctx, ITEM_XS[i], ITEM_Y, 0x18);
      }
    }
  }

  // --- Common rendering ---

   hasPickableItem() {
    const item = this.contents.items[1];
    return item !== undefined && item !== 63;
  }

   getCenterItemId() {
    return (this.contents.items[1] ?? 63) & 0x3f;
  }

   _fireFrame = 0;

  /** 0 or 1 — which of the two npcs.png flame frames is showing. */
  get fireAnimFrame() {
    return this._fireFrame > 6 ? 1 : 0;
  }

   drawFire(renderer, x, y) {
    drawFireSprite(renderer, this.fireAnimFrame, x, y);
  }

   drawNpc(ctx, x, y) {
    switch (this.npcType) {
      case 'oldMan':
        ctx.drawImage(this.npcsImage, 1, 11, 16, 16, x, y, 16, 16);
        break;
      case 'oldWoman':
        ctx.drawImage(this.npcsImage, 35, 11, 16, 16, x, y, 16, 16);
        break;
      case 'merchant':
        ctx.drawImage(this.npcsImage, 137, 11, 16, 16, x, y, 16, 16);
        break;
      case 'moblin':
        ctx.fillStyle = '#a04020';
        ctx.fillRect(x + 2, y, 12, 16);
        ctx.fillStyle = '#d06030';
        ctx.fillRect(x + 4, y + 2, 8, 12);
        break;
    }
  }

   drawItem(ctx, x, y, itemId) {
    drawItemSprite(ctx, this.itemsImage, itemId & 0x3f, x, y);
  }

   drawText(renderer) {
    if (this.textLines.length === 0) return;

    for (let i = 0; i < this.textLines.length; i++) {
      const line = this.textLines[i];
      const x = (SCREEN_WIDTH - line.length * 8) / 2;
      this.font.drawString(renderer, x, TEXT_Y + i * 12, line);
    }
  }
}
