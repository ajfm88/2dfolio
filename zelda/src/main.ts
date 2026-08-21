import {
  LINK_SHEET_COLUMNS,
  SPRITE_SPACING,
} from './core/constants.js';
import { DebugOverlay } from './core/debug-overlay.js';
import { FpsCounter } from './core/fps-counter.js';
import { GameLoop } from './core/game-loop.js';
import { GameMode } from './core/game-mode.js';
import { Action, InputManager } from './core/input.js';
import { Direction } from './core/types.js';
import { DeathAnimation } from './death/death-animation.js';
import { GameOverScreen } from './death/game-over-screen.js';
import { computeRespawnParams } from './death/respawn.js';
import { Renderer } from './render/renderer.js';
import { SpriteSheet } from './render/sprite-renderer.js';
import { TileRenderer } from './render/tile-renderer.js';
import { loadAllAssets, type LoadedAssets } from './data/asset-manifest.js';
import type { OverworldData } from './data/overworld-types.js';
import type { SecretsData } from './data/secret-types.js';
import { BitmapFont } from './ui/bitmap-font.js';
import { HudRenderer } from './ui/hud.js';
import { InventoryScreen, getNextOwnedSlot } from './ui/inventory-screen.js';
import { InventorySlide } from './ui/inventory-slide.js';
import { createTintedFontImage } from './ui/tint-utils.js';
import { OverworldManager } from './world/overworld-manager.js';
import { CurtainEffect } from './world/curtain-effect.js';
import { CaveRoom, type CaveContents } from './world/cave-room.js';
import type { CaveTextData, CaveTextMessage } from './data/cave-text-types.js';
import type { ItemData, CaveTypeInfo } from './data/item-types.js';
import { processItemsImage } from './data/item-sprites.js';
import { Link } from './objects/player/link.js';
import { ItemPickup } from './objects/pickups/item-pickup.js';
import { Arrow } from './objects/weapons/arrow.js';
import { Bomb } from './objects/weapons/bomb.js';
import { Boomerang } from './objects/weapons/boomerang.js';
import { CandleFire } from './objects/weapons/candle-fire.js';
import { Food } from './objects/weapons/food.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const input = new InputManager();
input.attach();
const fpsCounter = new FpsCounter();
const debug = new DebugOverlay();
debug.attach();
const tileRenderer = new TileRenderer();

let frameCount = 0;
let loadProgress = { loaded: 0, total: 0 };
let assets: LoadedAssets | null = null;
let loadError: string | null = null;
let linkSheet: SpriteSheet | null = null;
let hudRenderer: HudRenderer | null = null;
let link: Link | null = null;
let overworld: OverworldManager | null = null;

// Death + respawn
let gameMode: GameMode = GameMode.Gameplay;
let deathAnimation: DeathAnimation | null = null;
let gameOverScreen: GameOverScreen | null = null;
let font: BitmapFont | null = null;
let deathCount = 0;

// Cave system
let curtainEffect: CurtainEffect | null = null;
let caveRoom: CaveRoom | null = null;
let pendingCaveIndex: number | null = null;
let caveContentsData: CaveContents[] = [];
let caveEntryX = 0;
let caveEntryY = 0;
let caveWalkIntoFrames = 0;
let caveItemHandled = false;

// Weapons
let bombs: Bomb[] = [];
let fires: CandleFire[] = [];
let boomerang: Boomerang | null = null;
let arrow: Arrow | null = null;
let food: Food | null = null;
let usedCandleThisScreen = false;

// Weapon sprite sheets (initialized in init)
let projectilesSheet: SpriteSheet | null = null;
let cloudSheet: SpriteSheet | null = null;

// Item pickups on the overworld
let pickups: ItemPickup[] = [];

// Inventory subscreen
let inventorySlide: InventorySlide | null = null;
let inventoryScreen: InventoryScreen | null = null;
let redFont: BitmapFont | null = null;
let processedItems: HTMLCanvasElement | null = null;

// Cave data
let caveTextData: CaveTextData | null = null;
let caveTypesData: readonly CaveTypeInfo[] = [];

async function init(): Promise<void> {
  try {
    assets = await loadAllAssets((loaded, total) => {
      loadProgress = { loaded, total };
    });

    const [owResp, itemsResp, secretsResp, caveTextResp] = await Promise.all([
      fetch('/src/data/overworld.json'),
      fetch('/src/data/items.json'),
      fetch('/src/data/secrets.json'),
      fetch('/src/data/cave-text.json'),
    ]);
    const overworldData = (await owResp.json()) as OverworldData;
    const itemsData = (await itemsResp.json()) as ItemData;
    const secretsData = (await secretsResp.json()) as SecretsData;
    caveTextData = (await caveTextResp.json()) as CaveTextData;
    caveContentsData = [...itemsData.caveContents];
    caveTypesData = itemsData.caveTypes;

    tileRenderer.init(assets.maps.overworldMap);
    linkSheet = new SpriteSheet({
      image: assets.sprites.link,
      columns: LINK_SHEET_COLUMNS,
      spacingX: SPRITE_SPACING,
      spacingY: SPRITE_SPACING,
      autoDetectTransparency: true,
    });
    processedItems = processItemsImage(assets.sprites.items);
    projectilesSheet = new SpriteSheet({
      image: assets.sprites.projectiles,
      columns: 15,
      autoDetectTransparency: true,
    });
    cloudSheet = new SpriteSheet({
      image: assets.sprites.cloud,
      columns: 1,
      autoDetectTransparency: true,
    });
    hudRenderer = new HudRenderer(
      assets.ui.hud,
      assets.sprites.font,
      assets.sprites.treasuresFull,
      processedItems,
    );
    font = new BitmapFont(assets.sprites.font);
    redFont = new BitmapFont(createTintedFontImage(assets.sprites.font, '#d82800'));
    inventorySlide = new InventorySlide();
    inventoryScreen = new InventoryScreen();
    link = new Link();
    overworld = new OverworldManager(overworldData, tileRenderer, 7, 7, secretsData);
  } catch (err: unknown) {
    loadError = err instanceof Error ? err.message : String(err);
  }
}

void init();

function enterCave(caveIndex: number): void {
  if (!assets || !link || !overworld || !font) return;

  const contents = caveContentsData[caveIndex];
  if (!contents) return;

  // Remember where Link was on the overworld for return
  caveEntryX = link.posX;
  caveEntryY = link.posY;

  pendingCaveIndex = caveIndex;
  // Link walks into the dark opening for ~8 frames (~12px) before curtain starts
  caveWalkIntoFrames = 8;
  link.setDirection(Direction.Up);
  gameMode = GameMode.CaveTransition;
}

function lookupCaveText(caveIndex: number): CaveTextMessage | null {
  if (!caveTextData) return null;
  const caveType = caveTypesData[caveIndex];
  if (!caveType) return null;
  // textSelector is a byte index into the address table (2 bytes per entry)
  const messageIndex = caveType.textSelector / 2;
  return caveTextData.messages[messageIndex] ?? null;
}

function startCaveInterior(): void {
  if (!assets || !link || !font || !overworld || pendingCaveIndex === null) return;

  const contents = caveContentsData[pendingCaveIndex];
  if (!contents) return;

  // Check room flags — if item already taken for take-type caves, skip person/items
  const alreadyTaken = overworld.roomFlags.isSecretFound(overworld.currentScreen.id);

  const textMessage = alreadyTaken ? null : lookupCaveText(pendingCaveIndex);

  caveRoom = new CaveRoom(
    assets.maps.caveMap,
    assets.sprites.npcs,
    processedItems!,
    font,
    alreadyTaken ? { ...contents, items: [63, 63, 63] } : contents,
    textMessage,
  );
  caveRoom.initLink(link);

  // Door repair: auto-deduct 20 rupees on entry (Z_01.asm:696)
  if (!alreadyTaken && caveRoom.behavior === 'doorRepair') {
    link.spendRupees(20);
    overworld.roomFlags.setSecretFound(overworld.currentScreen.id);
  }

  // Moblin giveaway: give rupees on entry
  if (!alreadyTaken && caveRoom.behavior === 'moblinGive') {
    link.addRupees(caveRoom.rupeeReward);
    overworld.roomFlags.setSecretFound(overworld.currentScreen.id);
  }

  caveItemHandled = false;
  curtainEffect = new CurtainEffect('open');
  gameMode = GameMode.CaveInterior;
  pendingCaveIndex = null;
}

function exitCave(): void {
  if (!link || !overworld) return;
  curtainEffect = new CurtainEffect('close');
  gameMode = GameMode.CaveTransition;
  pendingCaveIndex = -1; // sentinel: returning to overworld
}

function returnToOverworld(): void {
  if (!link || !overworld) return;

  // Restore Link to where they were when they entered the cave, facing down
  link.setPosition(caveEntryX, caveEntryY);
  link.setDirection(Direction.Down);

  caveRoom = null;
  curtainEffect = new CurtainEffect('open');
  gameMode = GameMode.CaveTransition;
  pendingCaveIndex = -2; // sentinel: opening curtain on overworld
}

function getHudState(): import('./ui/hud.js').HudState {
  return {
    rupees: link ? link.rupees : 0,
    keys: link ? link.keys : 0,
    bombs: link ? link.bombs : 0,
    hasMagicKey: link ? link.inventory.magicKey : false,
    health: link ? link.health : 6,
    maxHealth: link ? link.maxHealth : 6,
    bItem: link ? link.inventory.getEquippedBItemId() : null,
    aItem: link ? link.inventory.getSwordItemId() : null,
    mapRow: overworld ? overworld.screenRow : 7,
    mapCol: overworld ? overworld.screenCol : 7,
    isOverworld: gameMode !== GameMode.CaveInterior,
    levelNumber: 0,
  };
}

function renderDebugOverlay(): void {
  const ctx = renderer.ctx;
  const screenId = overworld ? overworld.currentScreen.id : -1;
  const sr = overworld ? overworld.screenRow : 0;
  const sc = overworld ? overworld.screenCol : 0;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, renderer.playAreaWidth, 12);

  ctx.font = '8px monospace';
  ctx.fillStyle = '#0f0';
  const lx = link ? link.posX : 0;
  const ly = link ? link.posY : 0;
  const modeStr = GameMode[gameMode] ?? '?';
  ctx.fillText(
    `FPS:${fpsCounter.fps} F:${frameCount} Screen:${screenId} (${sr},${sc}) Link:(${lx},${ly}) ${modeStr}`,
    2,
    9,
  );
}

function updateInventory(): void {
  if (!link || !inventorySlide || !inventoryScreen) return;

  inventorySlide.update();
  inventoryScreen.update();

  if (inventorySlide.isActive) {
    if (input.isJustPressed(Action.Left)) {
      link.inventory.selectedBSlot = getNextOwnedSlot(link.inventory, link.inventory.selectedBSlot, -1);
    }
    if (input.isJustPressed(Action.Right)) {
      link.inventory.selectedBSlot = getNextOwnedSlot(link.inventory, link.inventory.selectedBSlot, 1);
    }
    if (input.isJustPressed(Action.Start)) {
      inventorySlide.close();
    }
  }
}

function updateGameplay(): void {
  if (!link || !overworld || !inventorySlide) return;

  // Inventory subscreen — blocks gameplay while visible
  if (inventorySlide.isVisible) {
    updateInventory();
    return;
  }

  // Start button opens inventory
  if (input.isJustPressed(Action.Start)) {
    inventorySlide.open();
    return;
  }

  if (overworld.isTransitioning) {
    overworld.updateTransition(link);
    // Clear weapons and pickups on screen transition
    bombs = [];
    fires = [];
    boomerang = null;
    arrow = null;
    food = null;
    pickups = [];
    usedCandleThisScreen = false;
    return;
  }

  const result = link.update(input, overworld.collisionMap, overworld.currentScreen);
  if (result.screenEdge !== null) {
    overworld.tryTransition(result.screenEdge, link);
  }

  // Item button (Z key) — use equipped B-item
  if (input.isJustPressed(Action.Item) && !link.isSwordActive) {
    useBItem(link);
  }

  // Update bombs
  for (const bomb of bombs) {
    bomb.update();
  }
  bombs = bombs.filter(b => b.isActive);

  // Update fires
  for (const fire of fires) {
    fire.update();
  }
  fires = fires.filter(f => f.isActive);

  // Update boomerang
  if (boomerang && link) {
    boomerang.update(link.posX, link.posY);
    if (!boomerang.isActive) {
      boomerang = null;
    }
  }

  // Update arrow
  if (arrow) {
    arrow.update(overworld.collisionMap, overworld.currentScreen);
    if (!arrow.isActive) {
      arrow = null;
    }
  }

  // Update food
  if (food) {
    food.update();
    if (!food.isActive) {
      food = null;
    }
  }

  // Update tile objects (secret detection)
  const revealEvent = overworld.updateTileObjects(link, bombs, fires);
  if (revealEvent) {
    // Secret was revealed — could play SFX here (K1)
  }

  // Update pickups — collision with Link
  for (const pickup of pickups) {
    pickup.update();
    if (pickup.isActive && pickup.checkCollision(link.getCollisionRect())) {
      pickup.collect();
      handleItemPickup(pickup.itemId);
    }
  }
  pickups = pickups.filter(p => p.isActive);

  // Check cave entry — Link facing up, walking into a cave entrance tile
  const caveIndex = overworld.checkCaveEntry(link);
  if (caveIndex !== null) {
    enterCave(caveIndex);
    return;
  }

  if (link.isDead && gameMode === GameMode.Gameplay) {
    gameMode = GameMode.DeathAnimation;
    deathAnimation = new DeathAnimation(link.posX, link.posY);
    return;
  }
}

// Placement offset: 16px from Link in his facing direction (Z_05.asm WieldBoomerang/WieldBomb)
function facingOffsetX(dir: Direction): number {
  return dir === Direction.Left ? -16 : dir === Direction.Right ? 16 : 0;
}
function facingOffsetY(dir: Direction): number {
  return dir === Direction.Up ? -16 : dir === Direction.Down ? 16 : 0;
}

function useBItem(linkRef: Link): void {
  const slot = linkRef.inventory.selectedBSlot;
  switch (slot) {
    case 1: // Bomb
      if (linkRef.bombs > 0) {
        linkRef.addBombs(-1);
        bombs.push(new Bomb(linkRef.posX, linkRef.posY));
      }
      break;
    case 4: { // Candle
      const candleLevel = linkRef.inventory.candle;
      if (candleLevel <= 0) break;
      if (candleLevel === 1 && usedCandleThisScreen) break; // blue: once per screen
      fires.push(new CandleFire(linkRef.posX, linkRef.posY, linkRef.facing));
      if (candleLevel === 1) usedCandleThisScreen = true;
      break;
    }
    case 0: { // Boomerang — shares NES slot $0F with food
      if (boomerang || food) break;
      if (!linkRef.inventory.woodBoomerang && !linkRef.inventory.magicBoomerang) break;
      const isMagic = linkRef.inventory.magicBoomerang;
      // NES supports diagonal throw — use held input directions, fallback to facing
      let dirX = 0;
      let dirY = 0;
      if (input.isHeld(Action.Right)) dirX = 1;
      else if (input.isHeld(Action.Left)) dirX = -1;
      if (input.isHeld(Action.Down)) dirY = 1;
      else if (input.isHeld(Action.Up)) dirY = -1;
      if (dirX === 0 && dirY === 0) {
        switch (linkRef.facing) {
          case Direction.Up: dirY = -1; break;
          case Direction.Down: dirY = 1; break;
          case Direction.Left: dirX = -1; break;
          case Direction.Right: dirX = 1; break;
        }
      }
      const ofsX = facingOffsetX(linkRef.facing);
      const ofsY = facingOffsetY(linkRef.facing);
      boomerang = new Boomerang(linkRef.posX + ofsX, linkRef.posY + ofsY, dirX, dirY, isMagic);
      break;
    }
    case 2: { // Arrow — requires bow + 1 rupee per shot
      if (arrow) break;
      if (!linkRef.inventory.bow || linkRef.inventory.arrow <= 0) break;
      if (linkRef.rupees <= 0) break;
      linkRef.addRupees(-1);
      const isSilver = linkRef.inventory.arrow >= 2;
      arrow = new Arrow(
        linkRef.posX + facingOffsetX(linkRef.facing),
        linkRef.posY + facingOffsetY(linkRef.facing),
        linkRef.facing,
        isSilver,
      );
      break;
    }
    case 6: { // Food/Bait — shares NES slot $0F with boomerang
      if (food || boomerang) break;
      if (!linkRef.inventory.food) break;
      food = new Food(
        linkRef.posX + facingOffsetX(linkRef.facing),
        linkRef.posY + facingOffsetY(linkRef.facing),
      );
      break;
    }
    // F4: flute(5), potion(7), wand(8)
  }
}

function handleItemPickup(itemId: number): void {
  if (!link || !overworld) return;

  const masked = itemId & 0x3f;
  const inv = link.inventory;

  switch (masked) {
    // Swords (graded 1/2/3)
    case 0x01: inv.sword = Math.max(inv.sword, 1); break;
    case 0x02: inv.sword = Math.max(inv.sword, 2); break;
    case 0x03: inv.sword = Math.max(inv.sword, 3); break;

    // Boomerangs
    case 0x1d: inv.woodBoomerang = true; break;
    case 0x1e: inv.magicBoomerang = true; break;

    // Arrows (graded)
    case 0x08: inv.arrow = Math.max(inv.arrow, 1); break;
    case 0x09: inv.arrow = Math.max(inv.arrow, 2); break;

    // Candles (graded)
    case 0x06: inv.candle = Math.max(inv.candle, 1); break;
    case 0x07: inv.candle = Math.max(inv.candle, 2); break;

    // Rings (graded)
    case 0x12: inv.ring = Math.max(inv.ring, 1); break;
    case 0x13: inv.ring = Math.max(inv.ring, 2); break;

    // Potions (graded)
    case 0x1f: inv.potion = Math.max(inv.potion, 1); break;
    case 0x20: inv.potion = Math.max(inv.potion, 2); break;

    // Boolean items
    case 0x0a: inv.bow = true; break;
    case 0x04: inv.food = true; break;
    case 0x05: inv.flute = true; break;
    case 0x10: inv.wand = true; break;
    case 0x11: inv.book = true; break;
    case 0x0c: inv.raft = true; break;
    case 0x0d: inv.ladder = true; break;
    case 0x0b: inv.magicKey = true; break;
    case 0x14: inv.bracelet = true; break;
    case 0x15: if (inv.letter === 0) inv.letter = 1; break;
    case 0x1c: inv.magicShield = true; break;

    // Count items
    case 0x00: link.addBombs(4); break;  // Bomb pickup
    case 0x19: link.addKeys(1); break;   // Key
    case 0x0f: link.addRupees(5); break; // FiveRupees
    case 0x18: link.addRupees(1); break; // OneRupee

    // Health items
    case 0x1a: link.addHeartContainer(); break; // HeartContainer
    case 0x22: link.heal(2); break;             // Heart (1 container = 2 half-hearts)
    case 0x23: link.heal(link.maxHealth); break; // Fairy (full heal)

    // Triforce piece
    case 0x1b: inv.triforce |= (1 << 0); break; // bit set by dungeon number in H1

    // Dungeon items
    case 0x16: break; // Compass — dungeon-specific, set in H1
    case 0x17: break; // Map — dungeon-specific, set in H1

    // Clock — temporary enemy freeze, G1
    case 0x21: break;

    // TriforceOfPower — end game, I3
    case 0x0e: break;
  }

  // Mark cave as taken
  overworld.roomFlags.setSecretFound(overworld.currentScreen.id);
}

function updateCaveInterior(): void {
  if (!link || !caveRoom) return;

  if (curtainEffect && !curtainEffect.done) {
    curtainEffect.update();
    return;
  }
  curtainEffect = null;

  const dir = readCaveInputDirection();
  if (dir !== null) {
    link.setDirection(dir);
    const speed = 1.5;
    const dx = dir === Direction.Left ? -speed : dir === Direction.Right ? speed : 0;
    const dy = dir === Direction.Up ? -speed : dir === Direction.Down ? speed : 0;
    caveRoom.updateMovement(link, dx, dy);
    link.tickAnimation();
  }

  caveRoom.update(link);

  // Gift cave item pickup
  if (caveRoom.itemPickedUp && !caveItemHandled) {
    caveItemHandled = true;
    const pickedId = caveRoom.pickedUpItemId;
    if (pickedId >= 0) {
      handleItemPickup(pickedId);
    }
  }

  // Shop purchase event
  const purchase = caveRoom.purchaseEvent;
  if (purchase) {
    link.spendRupees(purchase.price);
    handleItemPickup(purchase.itemId);
    caveRoom.clearPurchaseEvent();
  }

  // Money game: pay 10 to play, then win/lose the chosen amount
  const mgResult = caveRoom.moneyGameResult;
  if (mgResult && !caveItemHandled) {
    caveItemHandled = true;
    link.spendRupees(10);
    // amount is positive for wins (+20/+50), negative for losses (-10/-40)
    if (mgResult.amount > 0) {
      link.addRupees(mgResult.amount);
    } else {
      link.spendRupees(-mgResult.amount);
    }
    caveRoom.clearMoneyGameResult();
  }

  if (caveRoom.exitRequested) {
    exitCave();
  }
}

function readCaveInputDirection(): Direction | null {
  if (input.isHeld(Action.Up)) return Direction.Up;
  if (input.isHeld(Action.Down)) return Direction.Down;
  if (input.isHeld(Action.Left)) return Direction.Left;
  if (input.isHeld(Action.Right)) return Direction.Right;
  return null;
}

function handleRespawn(): void {
  const params = computeRespawnParams(0);

  if (overworld) {
    overworld.setScreen(params.screenRow, params.screenCol);
  }

  if (link) {
    link.reset(params.linkX, params.linkY, params.linkDirection, params.health);
  }

  deathCount = Math.min(deathCount + 1, 255);
  gameMode = GameMode.Gameplay;
}

const loop = new GameLoop({
  update(_dt: number) {
    input.update();
    frameCount++;

    switch (gameMode) {
      case GameMode.Gameplay:
        updateGameplay();
        break;

      case GameMode.CaveTransition:
        // Walk-into-darkness phase: Link walks into the cave opening before curtain
        if (caveWalkIntoFrames > 0 && link) {
          caveWalkIntoFrames--;
          link.walkForward();
          link.tickAnimation();
          if (caveWalkIntoFrames <= 0) {
            curtainEffect = new CurtainEffect('close');
          }
          break;
        }
        if (curtainEffect) {
          curtainEffect.update();
          if (curtainEffect.done) {
            if (pendingCaveIndex !== null && pendingCaveIndex >= 0) {
              startCaveInterior();
            } else if (pendingCaveIndex === -1) {
              returnToOverworld();
            } else {
              // Curtain opened on overworld — back to gameplay
              curtainEffect = null;
              pendingCaveIndex = null;
              gameMode = GameMode.Gameplay;
            }
          }
        }
        break;

      case GameMode.CaveInterior:
        updateCaveInterior();
        break;

      case GameMode.DeathAnimation:
        if (deathAnimation) {
          deathAnimation.update();
          if (deathAnimation.isDone) {
            gameMode = GameMode.GameOver;
            gameOverScreen = new GameOverScreen();
            deathAnimation = null;
          }
        }
        break;

      case GameMode.GameOver:
        if (gameOverScreen) {
          gameOverScreen.update(input);
          if (gameOverScreen.done) {
            gameOverScreen = null;
            handleRespawn();
          }
        }
        break;
    }
  },

  render() {
    fpsCounter.tick(performance.now());
    renderer.clear();

    if (hudRenderer && gameMode !== GameMode.GameOver) {
      hudRenderer.render(renderer, getHudState());
    }

    renderer.beginPlayArea();

    if (loadError) {
      renderer.fillRect(0, 0, renderer.playAreaWidth, renderer.playAreaHeight, '#400');
      renderer.ctx.fillStyle = '#f88';
      renderer.ctx.font = '10px monospace';
      renderer.ctx.fillText('Load error:', 8, 40);
      renderer.ctx.fillText(loadError, 8, 56);
    } else if (!assets || !overworld) {
      renderer.fillRect(0, 0, renderer.playAreaWidth, renderer.playAreaHeight, '#000');
      renderer.ctx.fillStyle = '#fff';
      renderer.ctx.font = '10px monospace';
      renderer.ctx.fillText(
        `Loading... ${loadProgress.loaded}/${loadProgress.total}`,
        8,
        80,
      );
      const barW = 200;
      const barH = 8;
      const barX = (renderer.playAreaWidth - barW) / 2;
      const barY = 100;
      renderer.fillRect(barX, barY, barW, barH, '#333');
      if (loadProgress.total > 0) {
        const fill = (loadProgress.loaded / loadProgress.total) * barW;
        renderer.fillRect(barX, barY, fill, barH, '#0f0');
      }
    } else if (gameMode === GameMode.DeathAnimation && deathAnimation && linkSheet) {
      deathAnimation.render(renderer, linkSheet, tileRenderer, overworld.currentScreen, font);
    } else if (gameMode === GameMode.GameOver && gameOverScreen && font) {
      gameOverScreen.render(renderer, font);
    } else if (gameMode === GameMode.CaveInterior && caveRoom && linkSheet && link) {
      caveRoom.render(renderer, link, linkSheet);
      if (curtainEffect && !curtainEffect.done) {
        curtainEffect.render(renderer);
      }
    } else if (gameMode === GameMode.CaveTransition) {
      // During cave transition, show the appropriate background under the curtain
      if (caveRoom && linkSheet && link) {
        caveRoom.render(renderer, link, linkSheet);
      } else {
        overworld.renderScreen(renderer);
        if (linkSheet && link) {
          link.render(renderer, linkSheet);
        }
      }
      if (curtainEffect) {
        curtainEffect.render(renderer);
      }
    } else if (inventorySlide && inventorySlide.isVisible && overworld && assets && inventoryScreen && font && redFont && hudRenderer && link) {
      // Inventory subscreen with slide transition
      const offset = inventorySlide.offset;

      // Draw gameplay below (pushed down by offset)
      renderer.ctx.save();
      renderer.ctx.translate(0, offset);
      overworld.renderScreen(renderer);
      if (linkSheet) {
        link.render(renderer, linkSheet);
      }
      renderer.ctx.restore();

      // Draw inventory screen above (slides in from top)
      renderer.ctx.save();
      renderer.ctx.translate(0, offset - renderer.playAreaHeight);
      inventoryScreen.render(renderer, link.inventory, font, redFont, processedItems!, hudRenderer, getHudState());
      renderer.ctx.restore();
    } else if (overworld.isTransitioning) {
      overworld.renderTransition(renderer);

      if (linkSheet && link) {
        const off = overworld.getNewScreenOffset();
        link.render(renderer, linkSheet, off.x, off.y);
      }
    } else {
      overworld.renderScreen(renderer);

      // Render weapons, pickups, and tile objects
      const ctx = renderer.ctx;
      for (const bomb of bombs) {
        bomb.render(ctx, cloudSheet ?? undefined, renderer, projectilesSheet ?? undefined);
      }
      for (const fire of fires) {
        fire.render(renderer, projectilesSheet ?? undefined);
      }
      if (boomerang && projectilesSheet) {
        boomerang.render(renderer, projectilesSheet);
      }
      if (arrow && projectilesSheet) {
        arrow.render(renderer, projectilesSheet);
      }
      if (food) {
        food.render(ctx, processedItems);
      }
      if (processedItems) {
        for (const pickup of pickups) {
          pickup.render(ctx, processedItems);
        }
      }
      overworld.renderTileObject(ctx);

      // Bomb screen flash — Z_01.asm:4086 UpdateBombFlashEffect
      if (bombs.some(b => b.shouldFlash)) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(0, 0, 256, 176);
        ctx.restore();
      }

      if (linkSheet && link) {
        link.render(renderer, linkSheet);
      }
    }

    if (debug.enabled) {
      renderDebugOverlay();
    }

    renderer.endPlayArea();
  },
});

loop.start();
