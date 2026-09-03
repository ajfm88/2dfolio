import {
  ENEMY_SHEET_COLUMNS,
  HEART_REFILL_INTERVAL,
  LADDER_ROOMS_OW,
  LINK_SHEET_COLUMNS,
  RAFT_DOCK_X_A,
  RAFT_DOCK_X_B,
  RAFT_ROOM_A,
  RAFT_ROOM_B,
  RING_TINT_BLUE,
  RING_TINT_RED,
  SILVER_ARROW_DAMAGE,
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
import { HudRenderer, processHudImage } from './ui/hud.js';
import { InventoryScreen, getNextOwnedSlot } from './ui/inventory-screen.js';
import { InventorySlide } from './ui/inventory-slide.js';
import { createTintedFontImage } from './ui/tint-utils.js';
import { OverworldManager } from './world/overworld-manager.js';
import { CurtainEffect } from './world/curtain-effect.js';
import { CaveRoom, type CaveContents } from './world/cave-room.js';
import type { CaveTextData, CaveTextMessage } from './data/cave-text-types.js';
import type { ItemData, CaveTypeInfo } from './data/item-types.js';
import { processItemsImage } from './data/item-sprites.js';
import { createTintedLinkImage } from './render/link-tint.js';
import { Link } from './objects/player/link.js';
import { ItemPickup } from './objects/pickups/item-pickup.js';
import { Arrow } from './objects/weapons/arrow.js';
import { Bomb } from './objects/weapons/bomb.js';
import { Boomerang } from './objects/weapons/boomerang.js';
import { CandleFire } from './objects/weapons/candle-fire.js';
import { Food } from './objects/weapons/food.js';
import { Raft } from './objects/items/raft.js';
import { RecorderEffect, RecorderPhase } from './objects/items/recorder.js';
import { Stepladder } from './objects/items/stepladder.js';
import { MagicRod } from './objects/weapons/magic-rod.js';
import { MagicShot } from './objects/weapons/magic-shot.js';
import { SpawnManager } from './objects/enemies/spawn-manager.js';
import { checkWeaponEnemyCollisions, checkEnemyLinkCollisions, checkEnemyProjectileCollisions } from './objects/enemies/enemy-collision.js';
import { DropEngine } from './objects/enemies/drop-engine.js';
import { DAMAGE_TABLE } from './core/damage-tables.js';
import type { EnemySpawnData } from './data/enemy-spawn-types.js';
import type { DungeonData } from './data/dungeon-types.js';
import { getDungeonLevel } from './data/dungeon-entrance-data.js';
import { isCaveEntranceTile } from './data/cave-data.js';
import { SQUARE_INDEX_CAVE_ENTRANCE, SQUARE_INDEX_STAIRS } from './data/secret-types.js';
import { DungeonManager } from './world/dungeon-manager.js';
import { DungeonRenderer } from './render/dungeon-renderer.js';
import type { TileCollisionMap } from './world/collision.js';
import { RoomFlags } from './world/room-flags.js';
import { checkSecretTrigger } from './world/dungeon-secrets.js';
import { SpikeTrap } from './objects/enemies/spike-trap.js';
import { DungeonStatues } from './world/dungeon-statues.js';
import { BUBBLE_FLASH, BUBBLE_BLUE, BUBBLE_RED, BUBBLE_TEMP_JINX_FRAMES } from './objects/enemies/bubble.js';
import { LikeLike } from './objects/enemies/like-like.js';
import { Wallmaster } from './objects/enemies/wallmaster.js';
import { PushBlock, PushBlockState } from './world/push-block.js';
import { Ganon } from './objects/enemies/ganon.js';
import { ZeldaNpc } from './objects/enemies/zelda-npc.js';
import { SaveManager } from './save/save-manager.js';
import { TitleScreen } from './ui/title-screen.js';
import { FileSelectScreen } from './ui/file-select-screen.js';
import { NameRegistrationScreen } from './ui/name-registration.js';
import { EliminationScreen } from './ui/elimination.js';

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
let gameMode: GameMode = GameMode.Title;
let deathAnimation: DeathAnimation | null = null;
let gameOverScreen: GameOverScreen | null = null;
let font: BitmapFont | null = null;
let deathCount = 0;

// Front-end (J1): title, file select, save slots. The world is not created until
// a file is started (see startGameFromSlot). SaveManager persists slot metadata to
// localStorage now; slice L1 widens it to full game state via IndexedDB.
const saveManager = new SaveManager();
const titleScreen = new TitleScreen();
const fileSelectScreen = new FileSelectScreen();
const registerScreen = new NameRegistrationScreen();
const eliminationScreen = new EliminationScreen();
let activeSaveSlot = 0;
let overworldDataModule: OverworldData | null = null;

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
let magicRod: MagicRod | null = null;
let magicShot: MagicShot | null = null;
let usedCandleThisScreen = false;

// Potion heart refill — Z_05.asm:3019 WieldPotion
let heartRefillActive = false;
let heartRefillTimer = 0;

// Ring-tinted link sheets
let linkSheetBlue: SpriteSheet | null = null;
let linkSheetRed: SpriteSheet | null = null;

// Auto-activation items
let stepladder: Stepladder | null = null;
let raft: Raft | null = null;

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
let processedNpcs: HTMLCanvasElement | null = null;

// Cave data
let caveTextData: CaveTextData | null = null;
let caveTypesData: readonly CaveTypeInfo[] = [];

// Recorder/Flute data + state
let fluteSecretRoomIds: readonly number[] = [];
let moduleLevelSecretsData: SecretsData | null = null;
let teleportingLevelIndex = 0;
let recorderEffect: RecorderEffect | null = null;

// Enemy system (G1/G2)
let spawnManager: SpawnManager | null = null;
let dropEngine: DropEngine | null = null;
let enemySpawnData: EnemySpawnData | null = null;
let itemsDataForDrops: ItemData | null = null;
let enemySheet: SpriteSheet | null = null;

// Dungeon system (H1a + H1b)
let currentLevel = 0; // 0 = overworld, 1-9 = dungeon
let dungeonManager: DungeonManager | null = null;
let dungeonRenderer: DungeonRenderer | null = null;
let dungeonData: DungeonData | null = null;
let dungeonEntryScreenRow = 0;
let dungeonEntryScreenCol = 0;
let dungeonEntryX = 0;
let dungeonEntryY = 0;
let dungeonRoomFlags: RoomFlags | null = null;
let dungeonSpikeTraps: SpikeTrap[] = [];
let dungeonStatues: DungeonStatues | null = null;
let dungeonPushBlock: PushBlock | null = null;
let dungeonRoomItem: ItemPickup | null = null;
let dungeonRoomItemActive = false;
let dungeonStairsPos: { x: number; y: number } | null = null;
let cellarWalkInFrames = 0;
// True while a Like-Like is holding Link captured (paralyzed).
let dungeonLinkCaptured = false;
// Triforce-get completion sequence (H2). Frames left to hold the display before
// warping Link out of the dungeon. NES sets GameMode $12 on triforce pickup.
let triforceGetTimer = 0;
const TRIFORCE_GET_FRAMES = 200; // ~3.3s hold before the exit curtain

function applyTransparencyKey(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  if (d[3]! < 255) return canvas;
  const keyR = d[0]!;
  const keyG = d[1]!;
  const keyB = d[2]!;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i]! - keyR) < 3 &&
        Math.abs(d[i + 1]! - keyG) < 3 &&
        Math.abs(d[i + 2]! - keyB) < 3) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function init(): Promise<void> {
  try {
    assets = await loadAllAssets((loaded, total) => {
      loadProgress = { loaded, total };
    });

    const [owResp, itemsResp, secretsResp, caveTextResp, enemySpawnResp, dungeonResp] = await Promise.all([
      fetch('/src/data/overworld.json'),
      fetch('/src/data/items.json'),
      fetch('/src/data/secrets.json'),
      fetch('/src/data/cave-text.json'),
      fetch('/src/data/enemy-spawns.json'),
      fetch('/src/data/dungeons.json'),
    ]);
    overworldDataModule = (await owResp.json()) as OverworldData;
    const itemsData = (await itemsResp.json()) as ItemData;
    const secretsData = (await secretsResp.json()) as SecretsData;
    caveTextData = (await caveTextResp.json()) as CaveTextData;
    enemySpawnData = (await enemySpawnResp.json()) as EnemySpawnData;
    dungeonData = (await dungeonResp.json()) as DungeonData;
    caveContentsData = [...itemsData.caveContents];
    caveTypesData = itemsData.caveTypes;
    fluteSecretRoomIds = itemsData.fluteSecretRoomIds;
    moduleLevelSecretsData = secretsData;
    itemsDataForDrops = itemsData;

    tileRenderer.init(assets.maps.overworldMap);
    linkSheet = new SpriteSheet({
      image: assets.sprites.link,
      columns: LINK_SHEET_COLUMNS,
      spacingX: SPRITE_SPACING,
      spacingY: SPRITE_SPACING,
      autoDetectTransparency: true,
    });
    processedItems = processItemsImage(assets.sprites.items);
    processedNpcs = applyTransparencyKey(assets.sprites.npcs);
    linkSheetBlue = new SpriteSheet({
      image: createTintedLinkImage(assets.sprites.link, RING_TINT_BLUE),
      columns: LINK_SHEET_COLUMNS,
      spacingX: SPRITE_SPACING,
      spacingY: SPRITE_SPACING,
      autoDetectTransparency: true,
    });
    linkSheetRed = new SpriteSheet({
      image: createTintedLinkImage(assets.sprites.link, RING_TINT_RED),
      columns: LINK_SHEET_COLUMNS,
      spacingX: SPRITE_SPACING,
      spacingY: SPRITE_SPACING,
      autoDetectTransparency: true,
    });
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
    enemySheet = new SpriteSheet({
      image: assets.sprites.enemies,
      columns: ENEMY_SHEET_COLUMNS,
      spacingX: SPRITE_SPACING,
      spacingY: SPRITE_SPACING,
      autoDetectTransparency: true,
    });
    dungeonRenderer = new DungeonRenderer(assets.maps.dungeonsMap);
    hudRenderer = new HudRenderer(
      processHudImage(assets.ui.hud),
      assets.sprites.font,
      assets.sprites.treasuresFull,
      processedItems,
    );
    font = new BitmapFont(assets.sprites.font);
    redFont = new BitmapFont(createTintedFontImage(assets.sprites.font, '#d82800'));
    inventorySlide = new InventorySlide();
    inventoryScreen = new InventoryScreen();
    // The playable world is created lazily by startGameFromSlot() once a file is
    // chosen on the file-select screen — boot lands on GameMode.Title.
  } catch (err: unknown) {
    loadError = err instanceof Error ? err.message : String(err);
  }
}

void init();

// Debug: expose game state for console testing
(window as unknown as Record<string, unknown>).__zelda = {
  get link() { return link; },
  get overworld() { return overworld; },
  get spawnManager() { return spawnManager; },
  get dungeonManager() { return dungeonManager; },
  get currentLevel() { return currentLevel; },
  giveAll() {
    if (!link) return;
    const inv = link.inventory;
    inv.sword = 3;
    inv.woodBoomerang = true;
    inv.magicBoomerang = true;
    inv.bow = true;
    inv.arrow = 2;
    inv.candle = 2;
    inv.ring = 0;
    inv.food = true;
    inv.flute = true;
    inv.wand = true;
    inv.book = true;
    inv.raft = true;
    inv.ladder = true;
    inv.magicKey = true;
    inv.bracelet = true;
    inv.magicShield = true;
    inv.potion = 2;
    link.addRupees(999);
    link.addBombs(16);
    link.addKeys(9);
    link.setHealth(32, 32);
  },
  // Warp straight into a dungeon (default Level 1) via the normal transition.
  goToDungeon(level = 1) {
    enterDungeon(level);
  },
  // Drop a single enemy next to Link for inspection. Default $23 = Blue Wizzrobe;
  // $24 = Red Wizzrobe. Works in overworld or dungeon.
  spawnEnemy(type = 0x23) {
    if (!spawnManager || !link) return;
    spawnManager.debugSpawn(type, Math.min(link.posX + 40, 224), link.posY);
  },
  // Jump to a front-end screen (title / file select / register / eliminate).
  goToTitle() { titleScreen.reset(); gameMode = GameMode.Title; },
  goToFileSelect() { fileSelectScreen.reset(); gameMode = GameMode.FileSelect; },
  goToRegister() { registerScreen.reset(saveManager.getSlots()); gameMode = GameMode.Register; },
  goToElimination() { eliminationScreen.reset(); gameMode = GameMode.Elimination; },
  // Skip the front end and start a game on the given slot (default 0).
  startGame(slot = 0) {
    startGameFromSlot(slot);
  },
  // Seed a registered save slot so the file-select screen has a playable file
  // (name registration itself lands in J1b).
  registerTest(slot = 0, name = 'LINK') {
    saveManager.register(slot, name);
  },
  get saveManager() { return saveManager; },
};

// Create the playable world for a chosen file and drop into gameplay. This is the
// single seam through which any new game begins (front end, or debug). Slot name/
// quest are display + L2 concerns; a new game always starts on the overworld start
// screen (7,7). Slice L1 will branch here to restore a saved game state.
function startGameFromSlot(index: number): void {
  if (!overworldDataModule || !enemySpawnData || !itemsDataForDrops || !moduleLevelSecretsData) return;
  activeSaveSlot = index;
  link = new Link();
  overworld = new OverworldManager(overworldDataModule, tileRenderer, 7, 7, moduleLevelSecretsData);
  spawnManager = new SpawnManager(enemySpawnData, itemsDataForDrops.objectHpPairs);
  dropEngine = new DropEngine();
  spawnManager.spawnForScreen(overworld.currentScreen, Direction.Down);
  gameMode = GameMode.Gameplay;
}

function getActiveLinkSheet(): SpriteSheet | null {
  if (!link) return linkSheet;
  switch (link.ringLevel) {
    case 1: return linkSheetBlue ?? linkSheet;
    case 2: return linkSheetRed ?? linkSheet;
    default: return linkSheet;
  }
}

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
  if (spawnManager) spawnManager.clear();
}

function enterDungeon(level: number): void {
  if (!link || !overworld || !dungeonData || !dungeonRenderer) return;

  dungeonEntryScreenRow = overworld.screenRow;
  dungeonEntryScreenCol = overworld.screenCol;
  dungeonEntryX = link.posX;
  dungeonEntryY = link.posY;

  currentLevel = level;
  caveWalkIntoFrames = 8;
  link.setDirection(Direction.Up);
  gameMode = GameMode.DungeonTransition;
  if (spawnManager) spawnManager.clear();
}

function startDungeonInterior(): void {
  if (!link || !dungeonData || !dungeonRenderer) return;

  if (!dungeonRoomFlags) dungeonRoomFlags = new RoomFlags();
  dungeonManager = new DungeonManager(currentLevel, dungeonData, dungeonRenderer, dungeonRoomFlags);

  const info = dungeonManager.dungeonInfo;
  link.setPosition(120, info.startY - 64);
  link.setDirection(Direction.Up);

  curtainEffect = new CurtainEffect('open');
  gameMode = GameMode.DungeonGameplay;

  if (spawnManager) {
    spawnManager.clear();
    spawnDungeonRoomEnemies();
  }
  initDungeonRoomObjects();
}

function exitDungeon(): void {
  if (!link || !overworld) return;

  currentLevel = 0;
  dungeonManager = null;
  dungeonSpikeTraps = [];
  dungeonStatues = null;
  dungeonPushBlock = null;
  dungeonRoomItem = null;
  dungeonRoomItemActive = false;
  dungeonStairsPos = null;
  cellarWalkInFrames = 0;

  overworld.setScreen(dungeonEntryScreenRow, dungeonEntryScreenCol);
  link.setPosition(dungeonEntryX, dungeonEntryY);
  link.setDirection(Direction.Down);

  curtainEffect = new CurtainEffect('open');
  gameMode = GameMode.DungeonTransition;

  if (spawnManager && overworld) {
    spawnManager.spawnForScreen(overworld.currentScreen, Direction.Down);
  }
}

// Triforce piece collected — NES sets GameMode $12: record the piece, full heal,
// hold a triumphant display, then warp Link out to the overworld entrance.
function beginTriforceGet(): void {
  if (!link) return;
  link.inventory.triforce |= (1 << (currentLevel - 1));
  link.heal(link.maxHealth);
  link.halted = true;
  link.setDirection(Direction.Down);
  // Clear any in-flight weapons/pickups so nothing lingers over the display.
  boomerang = null;
  arrow = null;
  food = null;
  magicRod = null;
  magicShot = null;
  bombs = [];
  fires = [];
  pickups = [];
  dungeonRoomItem = null;
  triforceGetTimer = TRIFORCE_GET_FRAMES;
  gameMode = GameMode.DungeonTriforceGet;
}

function spawnDungeonRoomEnemies(): void {
  if (!spawnManager || !dungeonManager || !enemySpawnData) return;

  spawnManager.clear();
  const room = dungeonManager.currentRoom;
  if (room.monsterListId === 0) return;
  if (dungeonManager.roomFlags.isRoomCleared(dungeonManager.currentRoomId)) return;

  const foeCounts = dungeonManager.dungeonInfo.foeCounts;
  const maxCount = foeCounts[room.monsterCountIndex] ?? 4;

  spawnManager.spawnForDungeonRoom(
    room.monsterListId,
    maxCount,
    Direction.Down,
  );

}

// Bubble contact jinxes Link's sword instead of dealing damage.
// Returns true if the enemy was a Bubble (so contact damage is skipped).
function applyBubbleJinx(objectType: number): boolean {
  if (!link) return false;
  switch (objectType) {
    case BUBBLE_RED:
      link.disableSword();
      return true;
    case BUBBLE_FLASH:
      link.disableSword(BUBBLE_TEMP_JINX_FRAMES);
      return true;
    case BUBBLE_BLUE:
      link.enableSword();
      return true;
    default:
      return false;
  }
}

function initDungeonRoomObjects(): void {
  if (!dungeonManager) return;

  dungeonSpikeTraps = [];
  dungeonStatues = null;
  dungeonPushBlock = null;
  dungeonRoomItem = null;
  dungeonRoomItemActive = false;

  const room = dungeonManager.currentRoom;

  // Spike traps: monsterListId $49 or $4A
  if (room.monsterListId === 0x49 || room.monsterListId === 0x4A) {
    dungeonSpikeTraps = SpikeTrap.createTraps(room.monsterListId);
  }

  // Fireball statues: keyed off the room's unique-room layout ($23/$24)
  const statues = new DungeonStatues(room.uniqueRoomId);
  if (statues.active) {
    dungeonStatues = statues;
  }

  // Push block
  const pbPos = dungeonManager.findPushBlockPosition();
  if (pbPos) {
    dungeonPushBlock = new PushBlock(pbPos.x, pbPos.y);
  }

  // Room item
  const itemId = room.itemId;
  if (itemId !== 3 && !dungeonManager.isItemTaken()) {
    const itemPos = dungeonManager.getRoomItemPosition();
    if (itemPos) {
      dungeonRoomItem = new ItemPickup(itemId, itemPos.x, itemPos.y);
      // Secret-gated items start hidden
      dungeonRoomItemActive = !dungeonManager.isItemSecretGated();
    }
  }
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
    processedNpcs ?? assets.sprites.npcs,
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
  // Respawn enemies when returning to overworld
  if (spawnManager && overworld) {
    spawnManager.spawnForScreen(overworld.currentScreen, Direction.Down);
  }
}

function getHudState(): import('./ui/hud.js').HudState {
  const inDungeon = currentLevel > 0 && dungeonManager !== null;
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
    isOverworld: !inDungeon && gameMode !== GameMode.CaveInterior,
    levelNumber: currentLevel,
    dungeonRoomCol: inDungeon ? dungeonManager!.currentRoomId % 16 : undefined,
    dungeonRoomRow: inDungeon ? Math.floor(dungeonManager!.currentRoomId / 16) : undefined,
    dungeonVisitedRooms: inDungeon ? dungeonManager!.visitedRooms : undefined,
    dungeonValidRooms: inDungeon ? dungeonManager!.validRoomIds : undefined,
    hasMap: inDungeon && link ? link.inventory.hasMapForLevel(currentLevel) : undefined,
    hasCompass: inDungeon && link ? link.inventory.hasCompassForLevel(currentLevel) : undefined,
    triforceRoomId: inDungeon ? dungeonManager!.triforceRoomId : undefined,
  };
}

function renderDebugOverlay(): void {
  const ctx = renderer.ctx;
  let screenId: number;
  let sr: number;
  let sc: number;

  if (currentLevel > 0 && dungeonManager) {
    screenId = dungeonManager.currentRoomId;
    sr = Math.floor(screenId / 16);
    sc = screenId % 16;
  } else {
    screenId = overworld ? overworld.currentScreen.id : -1;
    sr = overworld ? overworld.screenRow : 0;
    sc = overworld ? overworld.screenCol : 0;
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, renderer.playAreaWidth, 12);

  ctx.font = '8px monospace';
  ctx.fillStyle = '#0f0';
  const lx = link ? link.posX : 0;
  const ly = link ? link.posY : 0;
  const modeStr = GameMode[gameMode] ?? '?';
  const levelStr = currentLevel > 0 ? ` L${currentLevel}` : '';
  ctx.fillText(
    `FPS:${fpsCounter.fps} F:${frameCount} Room:${screenId} (${sr},${sc}) Link:(${lx},${ly}) ${modeStr}${levelStr}`,
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

function updateRecorderEffect(): void {
  if (!recorderEffect || !link || !overworld || !moduleLevelSecretsData) return;

  recorderEffect.update(link.posX, link.posY);

  // Pond-drying: apply walkable overrides for water tiles
  if (recorderEffect.waterWalkable) {
    const screen = overworld.currentScreen;
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 16; col++) {
        const px = col * 16 + 8;
        const py = row * 16 + 8;
        if (overworld.collisionMap.isWaterTileAt(screen, px, py)) {
          overworld.collisionMap.setWalkableOverride(row, col);
        }
      }
    }
  }

  // Pond-drying: reveal stairs (consumed once)
  if (recorderEffect.revealStairs) {
    overworld.tileObjectManager.revealFluteSecret(
      overworld.currentScreen,
      overworld.roomFlags,
      moduleLevelSecretsData,
    );
  }

  // Whirlwind: Link tracks whirlwind position
  if (recorderEffect.linkCaught) {
    link.setPosition(recorderEffect.whirlwindX, link.posY);
  }

  // Whirlwind: transition to destination screen
  if (recorderEffect.phase === RecorderPhase.TransitionPending) {
    const destId = recorderEffect.destinationScreenId;
    const destRow = Math.floor(destId / 16);
    const destCol = destId % 16;
    const destY = recorderEffect.destinationLinkY;
    overworld.setScreen(destRow, destCol);
    link.setPosition(0, destY);
    link.setDirection(Direction.Right);
    recorderEffect.startDestinationPhase(destY);
  }

  // Done: cleanup
  if (recorderEffect.isDone) {
    link.halted = false;
    overworld.collisionMap.clearWalkableOverrides();
    recorderEffect = null;
  }
}

function updateGameplay(): void {
  if (!link || !overworld || !inventorySlide) return;

  // Potion heart refill — blocks gameplay while healing
  if (heartRefillActive) {
    heartRefillTimer++;
    if (heartRefillTimer >= HEART_REFILL_INTERVAL) {
      heartRefillTimer = 0;
      link.heal(1);
      if (link.health >= link.maxHealth) {
        heartRefillActive = false;
      }
    }
    return;
  }

  // Recorder/Flute effect — blocks gameplay during tune + animation
  if (recorderEffect) {
    updateRecorderEffect();
    return;
  }

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
    // Clear weapons, pickups, enemies, and auto-activation items on screen transition
    bombs = [];
    fires = [];
    boomerang = null;
    arrow = null;
    food = null;
    magicRod = null;
    magicShot = null;
    stepladder = null;
    raft = null;
    recorderEffect = null;
    overworld.collisionMap.clearWalkableOverrides();
    pickups = [];
    usedCandleThisScreen = false;

    // Spawn enemies for the new screen after transition completes
    if (!overworld.isTransitioning && spawnManager) {
      const entryDir = link.facing;
      spawnManager.spawnForScreen(overworld.currentScreen, entryDir);
    }

    // Check for raft room after transition completes
    if (!overworld.isTransitioning && link.inventory.raft) {
      const sid = overworld.currentScreen.id;
      if (sid === RAFT_ROOM_A) {
        raft = new Raft(RAFT_DOCK_X_A);
      } else if (sid === RAFT_ROOM_B) {
        raft = new Raft(RAFT_DOCK_X_B);
      }
    }
    return;
  }

  // Update raft — halts Link and moves him during raft travel
  if (raft) {
    const raftResult = raft.update(link);
    if (raftResult.shouldTransitionUp) {
      overworld.tryTransition(Direction.Up, link);
    }
  }

  // Set stepladder walkable override before Link's collision checks
  if (stepladder && stepladder.isActive) {
    overworld.collisionMap.setWalkableOverride(stepladder.tileRow, stepladder.tileCol);
  }

  link.blockSwordAttack = magicRod !== null && magicRod.isActive();
  const result = link.update(input, overworld.collisionMap, overworld.currentScreen);

  // Clear walkable overrides after Link update
  overworld.collisionMap.clearWalkableOverrides();

  if (result.screenEdge !== null) {
    overworld.tryTransition(result.screenEdge, link);
  }

  // Stepladder spawn check — Z_07.asm:3225
  if (!stepladder && link.inventory.ladder && !link.halted) {
    const screenId = overworld.currentScreen.id;
    if ((LADDER_ROOMS_OW as readonly number[]).includes(screenId)) {
      const inputDir = readGameplayInputDirection();
      if (inputDir !== null && inputDir === link.facing && isGridAligned(link.posX, link.posY)) {
        const checkX = link.posX + facingOffsetX(inputDir);
        const checkY = link.posY + facingOffsetY(inputDir);
        if (overworld.collisionMap.isWaterTileAt(overworld.currentScreen, checkX + 8, checkY + 8)) {
          stepladder = new Stepladder(link.posX, link.posY, inputDir);
        }
      }
    }
  }

  // Update stepladder
  if (stepladder) {
    stepladder.update(link.posX, link.posY);
    if (!stepladder.isActive) {
      stepladder = null;
    }
  }

  // Item button (Z key) — use equipped B-item (rod and sword share animation slot)
  const rodActive = magicRod !== null && magicRod.isActive();
  if (input.isJustPressed(Action.Item) && !link.isSwordActive && !rodActive) {
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

  // Update magic rod
  if (magicRod) {
    const rodResult = magicRod.update();
    if (rodResult.shouldFireShot && !magicShot) {
      const shotPos = magicRod.getRodPosition(link.posX, link.posY);
      if (shotPos) {
        magicShot = new MagicShot(shotPos.x, shotPos.y, link.facing);
      }
    }
    if (rodResult.done) {
      magicRod = null;
    }
  }

  // Update magic shot
  if (magicShot) {
    magicShot.update(overworld.collisionMap, overworld.currentScreen);
    if (!magicShot.isActive) {
      if (magicShot.wasBlocked && link.inventory.book) {
        fires.push(CandleFire.createBookFire(magicShot.x, magicShot.y));
      }
      magicShot = null;
    }
  }

  // Update tile objects (secret detection)
  const revealEvent = overworld.updateTileObjects(link, bombs, fires);
  if (revealEvent) {
    // Secret was revealed — could play SFX here (K1)
  }

  // Update enemies
  if (spawnManager) {
    spawnManager.update(overworld.collisionMap, overworld.currentScreen, link.posX, link.posY, bombs);

    // Check weapon→enemy collisions
    const hitResults = checkWeaponEnemyCollisions(spawnManager.activeEnemies, {
      swordHitbox: link.getSwordHitbox(),
      swordDirection: link.swordDirection,
      swordBeam: link.activeSwordBeam,
      boomerang,
      bombs,
      arrow,
      fires,
      magicShot,
      magicRod,
      linkX: link.posX,
      linkY: link.posY,
      swordLevel: link.inventory.sword,
      hasMagicBoomerang: link.inventory.magicBoomerang,
    });

    // Handle kills — spawn item drops
    for (const result of hitResults) {
      if (result.killed && dropEngine && itemsDataForDrops) {
        const droppedItemId = dropEngine.rollDrop(result.enemy.objectType, itemsDataForDrops.dropTables);
        if (droppedItemId !== null) {
          pickups.push(new ItemPickup(droppedItemId, result.enemy.x, result.enemy.y));
        }
      }
    }

    // Check enemy→Link contact damage
    if (!link.isInvincible && !link.isDead) {
      const hittingEnemy = checkEnemyLinkCollisions(spawnManager.activeEnemies, link.getCollisionRect());
      if (hittingEnemy) {
        const rawDamage = DAMAGE_TABLE[hittingEnemy.objectType] ?? 0x80;
        if (rawDamage > 0) {
          link.takeDamage(rawDamage, hittingEnemy.direction);
        }
      }
    }

    // Check enemy projectiles against Link (shield deflection + damage)
    if (!link.isInvincible && !link.isDead && spawnManager.projectiles.length > 0) {
      const projHit = checkEnemyProjectileCollisions(
        spawnManager.projectiles,
        link.getCollisionRect(),
        link.facing,
        link.isIdle,
        link.hasMagicShield,
      );
      if (projHit) {
        if (!projHit.blocked) {
          const projDamage = DAMAGE_TABLE[projHit.projectile.type] ?? 0x80;
          if (projDamage > 0) {
            link.takeDamage(projDamage, projHit.projectile.direction);
          }
          projHit.projectile.deactivate();
        }
      }
    }
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

  // Check dungeon entrance first, then cave entry
  const dungeonLevel = getDungeonLevel(overworld.currentScreen.id);
  if (dungeonLevel !== null && link.facing === Direction.Up && link.isMoving) {
    const checkX = link.posX + 8;
    const checkY = link.posY - 1;
    if (checkY >= 0) {
      const col = Math.floor(checkX / 16);
      const row = Math.floor(checkY / 16);
      const tileIndex = overworld.currentScreen.tiles[row]?.[col];
      if (tileIndex !== undefined && isCaveEntranceTile(tileIndex)) {
        enterDungeon(dungeonLevel);
        return;
      }
      // Check tile overrides for secret-revealed entrances (L7-9)
      const gridIdx = row * 16 + col;
      const override = overworld.tileObjectManager.tileOverrides.get(gridIdx);
      if (override === SQUARE_INDEX_CAVE_ENTRANCE || override === SQUARE_INDEX_STAIRS) {
        enterDungeon(dungeonLevel);
        return;
      }
    }
  }

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

function updateDungeonGameplay(): void {
  if (!link || !dungeonManager || !inventorySlide) return;

  if (heartRefillActive) {
    heartRefillTimer++;
    if (heartRefillTimer >= HEART_REFILL_INTERVAL) {
      heartRefillTimer = 0;
      link.heal(1);
      if (link.health >= link.maxHealth) {
        heartRefillActive = false;
      }
    }
    return;
  }

  if (inventorySlide.isVisible) {
    updateInventory();
    return;
  }

  if (cellarWalkInFrames > 0) {
    cellarWalkInFrames--;
    link.walkForward();
    link.tickAnimation();
    if (cellarWalkInFrames <= 0) {
      link.halted = false;
    }
    return;
  }

  let dungeonFluteActive = false;
  if (recorderEffect) {
    recorderEffect.update(link.posX, link.posY);
    if (recorderEffect.isDone) {
      link.halted = false;
      recorderEffect = null;
    } else if (recorderEffect.phase === RecorderPhase.Tune) {
      dungeonFluteActive = true;
    }
  }

  if (input.isJustPressed(Action.Start)) {
    inventorySlide.open();
    return;
  }

  const collision = dungeonManager.collision as unknown as TileCollisionMap;
  const screen = dungeonManager.dummyScreen;

  link.blockSwordAttack = magicRod !== null && magicRod.isActive();
  const result = link.update(input, collision, screen);

  // Ignore screen edge results in dungeons — door transitions handled differently
  void result;

  // Check dungeon exit BEFORE room transitions (start room's south door leads out)
  if (!dungeonManager.inCellar && dungeonManager.checkDungeonExit(link)) {
    curtainEffect = new CurtainEffect('close');
    gameMode = GameMode.DungeonTransition;
    caveWalkIntoFrames = 0;
    pendingCaveIndex = -3; // sentinel: exiting dungeon
    return;
  }

  // Check for room transitions through doors (skip when in cellar)
  const doorDir = dungeonManager.inCellar ? null : dungeonManager.checkRoomTransition(link);
  if (doorDir !== null) {
    // Try to pass through the door (key/bomb/shutter checks)
    if (dungeonManager.touchDoor(doorDir, link)) {
      dungeonManager.transitionToRoom(doorDir);
      const entry = dungeonManager.getEntryPosition(doorDir);
      link.setPosition(entry.x, entry.y);
      link.setDirection(doorDir);

      bombs = [];
      fires = [];
      boomerang = null;
      arrow = null;
      food = null;
      magicRod = null;
      magicShot = null;
      pickups = [];
      usedCandleThisScreen = false;
      dungeonStairsPos = null;

      spawnDungeonRoomEnemies();
      initDungeonRoomObjects();
      return;
    }
  }

  // Stair entry detection — Link steps on revealed stairs → cellar transition
  if (dungeonStairsPos && !dungeonManager.inCellar) {
    const lx = link.posX;
    const ly = link.posY;
    const sx = dungeonStairsPos.x;
    const sy = dungeonStairsPos.y;
    if (lx + 12 > sx && lx < sx + 16 && ly + 12 > sy && ly < sy + 16) {
      const cellar = dungeonManager.getCellarForRoom(dungeonManager.currentRoomId);
      if (cellar) {
        dungeonManager.enterCellar(cellar.conn, cellar.isLeftSide);
        const entryX = cellar.isLeftSide ? 0x30 : 0xC0;
        link.setPosition(entryX, 0x41);
        link.setDirection(Direction.Down);
        link.halted = true;
        cellarWalkInFrames = 28;
        bombs = [];
        fires = [];
        boomerang = null;
        arrow = null;
        food = null;
        magicRod = null;
        magicShot = null;
        pickups = [];
        dungeonStairsPos = null;
        if (spawnManager) spawnManager.clear();
        return;
      }
    }
  }

  // Cellar exit detection — Link walks up past Y threshold
  if (dungeonManager.inCellar && link.posY < 40 && link.facing === Direction.Up) {
    const isLeftSide = link.posX < 0x80;
    const exit = dungeonManager.exitCellar(isLeftSide);
    link.setPosition(exit.x, exit.y);
    link.setDirection(Direction.Up);
    bombs = [];
    fires = [];
    boomerang = null;
    arrow = null;
    food = null;
    magicRod = null;
    magicShot = null;
    pickups = [];
    spawnDungeonRoomEnemies();
    initDungeonRoomObjects();
    return;
  }

  // Item button
  const rodActive = magicRod !== null && magicRod.isActive();
  if (input.isJustPressed(Action.Item) && !link.isSwordActive && !rodActive) {
    useBItem(link);
  }

  // Update weapons
  for (const bomb of bombs) { bomb.update(); }
  bombs = bombs.filter(b => b.isActive);
  for (const fire of fires) { fire.update(); }
  fires = fires.filter(f => f.isActive);
  if (boomerang && link) {
    boomerang.update(link.posX, link.posY);
    if (!boomerang.isActive) boomerang = null;
  }
  if (arrow) {
    arrow.update(collision, screen);
    if (!arrow.isActive) arrow = null;
  }
  if (food) {
    food.update();
    if (!food.isActive) food = null;
  }
  if (magicRod) {
    const rodResult = magicRod.update();
    if (rodResult.shouldFireShot && !magicShot) {
      const shotPos = magicRod.getRodPosition(link.posX, link.posY);
      if (shotPos) magicShot = new MagicShot(shotPos.x, shotPos.y, link.facing);
    }
    if (rodResult.done) magicRod = null;
  }
  if (magicShot) {
    magicShot.update(collision, screen);
    if (!magicShot.isActive) {
      if (magicShot.wasBlocked && link.inventory.book) {
        fires.push(CandleFire.createBookFire(magicShot.x, magicShot.y));
      }
      magicShot = null;
    }
  }

  // Update enemies
  if (spawnManager) {
    spawnManager.update(collision, screen, link.posX, link.posY, bombs, dungeonFluteActive);

    // Fireball statues feed the shared projectile pipeline (collision-checked
    // below, same frame, alongside enemy shots).
    if (dungeonStatues) {
      for (const fireball of dungeonStatues.update(link.posX, link.posY)) {
        spawnManager.addProjectile(fireball);
      }
    }

    const hitResults = checkWeaponEnemyCollisions(spawnManager.activeEnemies, {
      swordHitbox: link.getSwordHitbox(),
      swordDirection: link.swordDirection,
      swordBeam: link.activeSwordBeam,
      boomerang,
      bombs,
      arrow,
      fires,
      magicShot,
      magicRod,
      linkX: link.posX,
      linkY: link.posY,
      swordLevel: link.inventory.sword,
      hasMagicBoomerang: link.inventory.magicBoomerang,
    });

    for (const hitResult of hitResults) {
      if (hitResult.killed && dropEngine && itemsDataForDrops) {
        const droppedItemId = dropEngine.rollDrop(hitResult.enemy.objectType, itemsDataForDrops.dropTables);
        if (droppedItemId !== null) {
          pickups.push(new ItemPickup(droppedItemId, hitResult.enemy.x, hitResult.enemy.y));
        }
      }
    }

    // Ganon custom collision — _vulnerable=false bypasses normal pipeline
    const ganon = spawnManager.activeEnemies.find(
      (e): e is Ganon => e instanceof Ganon,
    );
    if (ganon && ganon.scenePhase === 2) {
      // Sword collision check (blue/invisible state)
      const swordHitbox = link.getSwordHitbox();
      if (swordHitbox) {
        const gHb = ganon.getHitbox();
        if (swordHitbox.x < gHb.x + gHb.width && swordHitbox.x + swordHitbox.width > gHb.x &&
            swordHitbox.y < gHb.y + gHb.height && swordHitbox.y + swordHitbox.height > gHb.y) {
          const swordDmg = [0, 0x10, 0x20, 0x40, 0x80][link.inventory.sword] ?? 0x10;
          ganon.takeDamage(swordDmg, link.swordDirection ?? Direction.Down);
        }
      }
      // Arrow collision check (brown state — silver arrow kills)
      if (arrow && arrow.isActive) {
        const gHb = ganon.getHitbox();
        const aRect = { x: arrow.x, y: arrow.y, width: 8, height: 8 };
        if (aRect.x < gHb.x + gHb.width && aRect.x + aRect.width > gHb.x &&
            aRect.y < gHb.y + gHb.height && aRect.y + aRect.height > gHb.y) {
          const arrDmg = arrow.isSilver ? SILVER_ARROW_DAMAGE : 0x20;
          const killed = ganon.takeDamage(arrDmg, arrow.direction,
            { x: arrow.x, y: arrow.y, dir: arrow.direction });
          if (killed) arrow.deactivate();
        }
      }
      // Ganon room item activation on death
      if (ganon.roomItemActivated && !dungeonRoomItem) {
        dungeonRoomItem = new ItemPickup(0x0e, ganon.roomItemX, ganon.roomItemY);
        dungeonRoomItemActive = true;
      }
    }

    // Ganon scene phase 0/1: halt Link during intro
    if (ganon && ganon.shouldHaltLink) {
      link.halted = true;
    }

    // Zelda NPC: detect rescue trigger → ending
    const zelda = spawnManager.activeEnemies.find(
      (e): e is ZeldaNpc => e instanceof ZeldaNpc,
    );
    if (zelda) {
      if (zelda.isRescueTriggered && !link.halted) {
        link.halted = true;
        link.setPosition(0x88, 0x48);
        link.setDirection(Direction.Left);
      }
      if (zelda.isEndingTriggered) {
        gameMode = GameMode.ZeldaRescue;
      }
    }

    if (!link.isInvincible && !link.isDead) {
      const hittingEnemy = checkEnemyLinkCollisions(spawnManager.activeEnemies, link.getCollisionRect());
      if (hittingEnemy) {
        if (hittingEnemy instanceof LikeLike) {
          hittingEnemy.beginCapture(); // paralyze instead of damage
        } else if (hittingEnemy instanceof Wallmaster) {
          hittingEnemy.grab(); // warp-to-entrance handled below
        } else if (!applyBubbleJinx(hittingEnemy.objectType)) {
          const rawDamage = DAMAGE_TABLE[hittingEnemy.objectType] ?? 0x80;
          if (rawDamage > 0) link.takeDamage(rawDamage, hittingEnemy.direction);
        }
      }
    }

    // Like-Like capture: hold Link paralyzed while grabbed; eat the Magic Shield.
    const capturer = spawnManager.activeEnemies.find(
      (e): e is LikeLike => e instanceof LikeLike && e.capturing,
    );
    if (capturer) {
      link.halted = true;
      if (capturer.consumeShieldEat()) link.setMagicShield(false);
      dungeonLinkCaptured = true;
    } else if (dungeonLinkCaptured) {
      link.halted = false;
      dungeonLinkCaptured = false;
    }

    // Wallmaster grab: drag Link back to the dungeon entrance room.
    const grabber = spawnManager.activeEnemies.find(
      (e): e is Wallmaster => e instanceof Wallmaster && e.grabbed,
    );
    if (grabber) {
      const entry = dungeonManager.returnToEntranceRoom();
      link.setPosition(entry.x, entry.y);
      link.setDirection(Direction.Up);
      bombs = [];
      fires = [];
      boomerang = null;
      arrow = null;
      food = null;
      magicRod = null;
      magicShot = null;
      pickups = [];
      usedCandleThisScreen = false;
      spawnDungeonRoomEnemies();
      initDungeonRoomObjects();
      return;
    }

    if (!link.isInvincible && !link.isDead && spawnManager.projectiles.length > 0) {
      const projHit = checkEnemyProjectileCollisions(
        spawnManager.projectiles,
        link.getCollisionRect(),
        link.facing,
        link.isIdle,
        link.hasMagicShield,
      );
      if (projHit && !projHit.blocked) {
        const projDamage = DAMAGE_TABLE[projHit.projectile.type] ?? 0x80;
        if (projDamage > 0) link.takeDamage(projDamage, projHit.projectile.direction);
        projHit.projectile.deactivate();
      }
    }
  }

  if (!dungeonManager.inCellar) {
    // Update spike traps
    for (const trap of dungeonSpikeTraps) {
      trap.update(link.posX, link.posY);
      if (!link.isInvincible && !link.isDead) {
        const trapHb = trap.getHitbox();
        const linkRect = link.getCollisionRect();
        if (
          linkRect.x < trapHb.x + trapHb.width &&
          linkRect.x + linkRect.width > trapHb.x &&
          linkRect.y < trapHb.y + trapHb.height &&
          linkRect.y + linkRect.height > trapHb.y
        ) {
          link.takeDamage(trap.damage, link.facing);
        }
      }
    }

    // Update push block
    if (dungeonPushBlock && dungeonPushBlock.state !== PushBlockState.Done) {
      const allDead = spawnManager ? spawnManager.activeEnemies.length === 0 : true;
      dungeonPushBlock.update(
        { posX: link.posX, posY: link.posY, facing: link.facing, isMoving: link.isMoving },
        allDead,
      );
    }

    // Check bomb detonation near bombable doors
    for (const bomb of bombs) {
      if (bomb.isDetonating) {
        const bx = bomb.x;
        const by = bomb.y;
        if (by < 32) dungeonManager.bombDoor(Direction.Up);
        if (by > 128) dungeonManager.bombDoor(Direction.Down);
        if (bx < 32) dungeonManager.bombDoor(Direction.Left);
        if (bx > 208) dungeonManager.bombDoor(Direction.Right);
      }
    }

    // Check secret triggers
    if (!dungeonManager.secretTriggered) {
      const trigger = dungeonManager.currentRoom.secretTrigger;
      if (trigger !== 0) {
        const allDead = spawnManager ? spawnManager.activeEnemies.length === 0 : true;
        const pushComplete = dungeonPushBlock ? dungeonPushBlock.pushComplete : false;
        const result = checkSecretTrigger(trigger, allDead, pushComplete, allDead);
        if (result.shuttersOpen || result.stairsRevealed || result.itemActivated) {
          dungeonManager.markSecretTriggered();
          if (result.shuttersOpen) dungeonManager.triggerShutters();
          if (result.stairsRevealed) dungeonStairsPos = { x: 0xD0, y: 0x60 };
          if (result.itemActivated && dungeonRoomItem) dungeonRoomItemActive = true;
        }
      }
    }

    // Mark room cleared when all enemies are dead
    if (
      spawnManager &&
      dungeonManager.currentRoom.monsterListId > 0 &&
      !dungeonManager.roomFlags.isRoomCleared(dungeonManager.currentRoomId) &&
      spawnManager.enemies.length > 0 &&
      spawnManager.activeEnemies.length === 0
    ) {
      dungeonManager.roomFlags.setRoomCleared(dungeonManager.currentRoomId);
    }
  }

  // Dark room: candle fire brightens
  if (dungeonManager.isDark && fires.length > 0) {
    dungeonManager.brightenRoom();
  }

  // Update pickups (enemy drops)
  for (const pickup of pickups) {
    pickup.update();
    if (pickup.isActive && pickup.checkCollision(link.getCollisionRect())) {
      pickup.collect();
      handleItemPickup(pickup.itemId);
    }
  }
  pickups = pickups.filter(p => p.isActive);

  // Update room item
  if (dungeonRoomItem && dungeonRoomItemActive && dungeonRoomItem.isActive) {
    dungeonRoomItem.update();
    if (dungeonRoomItem.checkCollision(link.getCollisionRect())) {
      dungeonRoomItem.collect();
      handleDungeonItemPickup(dungeonRoomItem.itemId);
      dungeonManager.setItemTaken();
      dungeonRoomItem = null;
    }
  }

  if (link.isDead && gameMode === GameMode.DungeonGameplay) {
    gameMode = GameMode.DeathAnimation;
    deathAnimation = new DeathAnimation(link.posX, link.posY);
  }
}

// Placement offset: 16px from Link in his facing direction (Z_05.asm WieldBoomerang/WieldBomb)
function facingOffsetX(dir: Direction): number {
  return dir === Direction.Left ? -16 : dir === Direction.Right ? 16 : 0;
}
function facingOffsetY(dir: Direction): number {
  return dir === Direction.Up ? -16 : dir === Direction.Down ? 16 : 0;
}

function readGameplayInputDirection(): Direction | null {
  if (input.isHeld(Action.Up)) return Direction.Up;
  if (input.isHeld(Action.Down)) return Direction.Down;
  if (input.isHeld(Action.Left)) return Direction.Left;
  if (input.isHeld(Action.Right)) return Direction.Right;
  return null;
}

function isGridAligned(x: number, y: number): boolean {
  return x % 8 === 0 && y % 8 === 0;
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
    case 5: { // Recorder/Flute
      if (!linkRef.inventory.flute) break;
      if (recorderEffect) break;
      const screenId = overworld ? overworld.currentScreen.id : 0;
      recorderEffect = new RecorderEffect(
        screenId,
        linkRef.facing,
        linkRef.inventory.triforce,
        teleportingLevelIndex,
        fluteSecretRoomIds,
        linkRef.posY,
      );
      teleportingLevelIndex = recorderEffect.updatedTeleportIndex;
      linkRef.halted = true;
      break;
    }
    case 7: { // Potion
      const inv = linkRef.inventory;
      if (inv.potion <= 0) break;
      inv.potion--;
      heartRefillActive = true;
      heartRefillTimer = 0;
      break;
    }
    case 8: { // Magic Rod (Wand)
      if (magicRod && magicRod.isActive()) break;
      if (!linkRef.inventory.wand) break;
      if (linkRef.isSwordActive) break;
      magicRod = new MagicRod();
      magicRod.start(linkRef.facing);
      break;
    }
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

    // Clock — freeze all enemies for ~660 frames (Z_01.asm:2571)
    case 0x21:
      if (spawnManager) spawnManager.freezeAll(660);
      break;

    // TriforceOfPower — end game, I3
    case 0x0e: break;
  }

  // Mark cave as taken
  overworld.roomFlags.setSecretFound(overworld.currentScreen.id);
}

function handleDungeonItemPickup(itemId: number): void {
  if (!link) return;
  const masked = itemId & 0x3f;
  const inv = link.inventory;

  switch (masked) {
    case 0x16: inv.giveCompass(currentLevel); break;
    case 0x17: inv.giveMap(currentLevel); break;
    case 0x19: link.addKeys(1); break;
    case 0x1b: beginTriforceGet(); return; // triforce piece → level-complete sequence
    case 0x00: link.addBombs(4); break;
    case 0x0f: link.addRupees(5); break;
    case 0x18: link.addRupees(1); break;
    case 0x22: link.heal(2); break;
    case 0x23: link.heal(link.maxHealth); break;
    case 0x1a: link.addHeartContainer(); break;
    // Triforce of Power — Ganon defeated, trigger ending path
    case 0x0e:
      // For now, just give ring (NES drops Red Ring in L9 boss room via trigger 3)
      // The actual ending is triggered by Zelda NPC proximity, not this pickup
      link.inventory.ring = Math.max(link.inventory.ring, 2);
      break;
    default:
      // For other items (weapons, tools), use the common handler logic
      handleDungeonItemGeneric(masked);
      break;
  }
}

function handleDungeonItemGeneric(masked: number): void {
  if (!link) return;
  const inv = link.inventory;
  switch (masked) {
    case 0x01: inv.sword = Math.max(inv.sword, 1); break;
    case 0x02: inv.sword = Math.max(inv.sword, 2); break;
    case 0x03: inv.sword = Math.max(inv.sword, 3); break;
    case 0x1d: inv.woodBoomerang = true; break;
    case 0x1e: inv.magicBoomerang = true; break;
    case 0x08: inv.arrow = Math.max(inv.arrow, 1); break;
    case 0x09: inv.arrow = Math.max(inv.arrow, 2); break;
    case 0x06: inv.candle = Math.max(inv.candle, 1); break;
    case 0x07: inv.candle = Math.max(inv.candle, 2); break;
    case 0x0a: inv.bow = true; break;
    case 0x0b: inv.magicKey = true; break;
    case 0x0c: inv.raft = true; break;
    case 0x0d: inv.ladder = true; break;
    case 0x10: inv.wand = true; break;
    case 0x11: inv.book = true; break;
    case 0x14: inv.bracelet = true; break;
    case 0x1c: inv.magicShield = true; break;
    case 0x12: inv.ring = Math.max(inv.ring, 1); break;
    case 0x13: inv.ring = Math.max(inv.ring, 2); break;
    case 0x21: if (spawnManager) spawnManager.freezeAll(660); break;
  }
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
  const params = computeRespawnParams(currentLevel);

  if (params.isDungeon && dungeonManager && dungeonData && dungeonRenderer) {
    // Respawn at dungeon entrance room (preserve room flags)
    dungeonManager = new DungeonManager(currentLevel, dungeonData, dungeonRenderer, dungeonRoomFlags ?? undefined);

    if (link) {
      const info = dungeonManager.dungeonInfo;
      link.reset(120, info.startY - 64, Direction.Up, params.health);
    }

    deathCount = Math.min(deathCount + 1, 255);
    gameMode = GameMode.DungeonGameplay;

    if (spawnManager) {
      spawnDungeonRoomEnemies();
    }
    initDungeonRoomObjects();
  } else {
    currentLevel = 0;
    dungeonManager = null;

    if (overworld) {
      overworld.setScreen(params.screenRow, params.screenCol);
    }

    if (link) {
      link.reset(params.linkX, params.linkY, params.linkDirection, params.health);
    }

    deathCount = Math.min(deathCount + 1, 255);
    gameMode = GameMode.Gameplay;

    if (spawnManager && overworld) {
      spawnManager.spawnForScreen(overworld.currentScreen, Direction.Down);
    }
  }
}

function renderDungeonEntities(): void {
  if (!link) return;
  const ctx = renderer.ctx;

  if (dungeonStairsPos) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(dungeonStairsPos.x, dungeonStairsPos.y, 16, 16);
    ctx.fillStyle = '#b86820';
    for (let sy = 0; sy < 16; sy += 4) {
      ctx.fillRect(dungeonStairsPos.x, dungeonStairsPos.y + sy, 16, 2);
    }
  }

  if (!dungeonManager?.inCellar) {
    if (dungeonPushBlock) dungeonPushBlock.render(renderer);
    for (const trap of dungeonSpikeTraps) trap.render(renderer);
  }

  // Render room item
  if (dungeonRoomItem && dungeonRoomItemActive && dungeonRoomItem.isActive && processedItems) {
    dungeonRoomItem.render(ctx, processedItems);
  }

  for (const bomb of bombs) {
    bomb.render(ctx, cloudSheet ?? undefined, renderer, projectilesSheet ?? undefined);
  }
  for (const fire of fires) {
    fire.render(renderer, projectilesSheet ?? undefined);
  }
  if (boomerang && projectilesSheet) boomerang.render(renderer, projectilesSheet);
  if (arrow && projectilesSheet) arrow.render(renderer, projectilesSheet);
  if (food) food.render(ctx, processedItems);
  if (magicRod && link) magicRod.render(renderer, projectilesSheet!, link.posX, link.posY);
  if (magicShot) magicShot.render(renderer);
  if (processedItems) {
    for (const pickup of pickups) pickup.render(ctx, processedItems);
  }
  if (spawnManager) spawnManager.render(renderer, enemySheet ?? undefined);

  if (bombs.some(b => b.shouldFlash)) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(0, 0, 256, 176);
    ctx.restore();
  }

  const activeLinkSheet = getActiveLinkSheet();
  if (activeLinkSheet && link) link.render(renderer, activeLinkSheet);

  // Dark room overlay (render after everything — covers the room but not HUD)
  if (dungeonManager && dungeonManager.isDark) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 176);
  }
}

const loop = new GameLoop({
  update(_dt: number) {
    input.update();
    frameCount++;

    switch (gameMode) {
      case GameMode.Title:
        titleScreen.update(input);
        if (titleScreen.shouldGoToFileSelect) {
          titleScreen.reset();
          fileSelectScreen.reset();
          gameMode = GameMode.FileSelect;
        }
        break;

      case GameMode.FileSelect: {
        fileSelectScreen.update(input);
        const sel = fileSelectScreen.selection;
        if (sel) {
          fileSelectScreen.clearSelection();
          if (sel.kind === 'slot') {
            const slot = saveManager.getSlot(sel.index);
            // Only a registered file can be played. Empty slots need a name first.
            if (slot && slot.registered) startGameFromSlot(sel.index);
          } else if (sel.kind === 'register') {
            registerScreen.reset(saveManager.getSlots());
            gameMode = GameMode.Register;
          } else {
            eliminationScreen.reset();
            gameMode = GameMode.Elimination;
          }
        }
        break;
      }

      case GameMode.Register:
        registerScreen.update(input);
        if (registerScreen.done) {
          for (const reg of registerScreen.registrations) {
            saveManager.register(reg.slot, reg.name);
          }
          fileSelectScreen.reset();
          gameMode = GameMode.FileSelect;
        }
        break;

      case GameMode.Elimination: {
        eliminationScreen.update(input);
        const pending = eliminationScreen.pendingEliminate;
        if (pending !== null) {
          saveManager.eliminate(pending);
          eliminationScreen.clearPending();
        }
        if (eliminationScreen.done) {
          fileSelectScreen.reset();
          gameMode = GameMode.FileSelect;
        }
        break;
      }

      case GameMode.Gameplay:
        updateGameplay();
        break;

      case GameMode.DungeonGameplay:
        updateDungeonGameplay();
        break;

      case GameMode.DungeonTransition:
        // Walk-into-darkness phase before curtain
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
            if (currentLevel > 0 && dungeonManager === null) {
              // Entering dungeon — curtain closed, now start dungeon interior
              startDungeonInterior();
            } else if (pendingCaveIndex === -3) {
              // Exiting dungeon — curtain closed, now return to overworld
              exitDungeon();
              pendingCaveIndex = null;
            } else {
              // Curtain opened on overworld/dungeon — back to appropriate mode
              curtainEffect = null;
              pendingCaveIndex = null;
              gameMode = currentLevel > 0 ? GameMode.DungeonGameplay : GameMode.Gameplay;
            }
          }
        }
        break;

      case GameMode.DungeonTriforceGet:
        // Hold the triforce-get display, then curtain out to the overworld.
        if (triforceGetTimer > 0) {
          triforceGetTimer--;
          if (triforceGetTimer <= 0) {
            if (link) link.halted = false;
            curtainEffect = new CurtainEffect('close');
            gameMode = GameMode.DungeonTransition;
            caveWalkIntoFrames = 0;
            pendingCaveIndex = -3; // sentinel: exiting dungeon
          }
        }
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
            // Record the death against the active file (no-op for unregistered slots).
            saveManager.recordDeath(activeSaveSlot);
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

      case GameMode.ZeldaRescue:
        // Ending stub — freeze here. Full credits in J2.
        break;
    }
  },

  render() {
    fpsCounter.tick(performance.now());
    renderer.clear();

    // Front-end screens draw full-screen (no HUD, outside the play-area clip). While
    // assets are still loading these fall through to the loading UI below.
    const isFrontEnd = gameMode === GameMode.Title || gameMode === GameMode.FileSelect
      || gameMode === GameMode.Register || gameMode === GameMode.Elimination;
    if (isFrontEnd && assets && font) {
      const rf = redFont ?? font;
      if (gameMode === GameMode.Title) {
        titleScreen.render(renderer, assets.ui.title, font, assets.ui.crest);
      } else if (gameMode === GameMode.FileSelect) {
        fileSelectScreen.render(renderer, font, rf, saveManager.getSlots());
      } else if (gameMode === GameMode.Register) {
        registerScreen.render(renderer, font, rf);
      } else {
        eliminationScreen.render(renderer, font, rf, saveManager.getSlots());
      }
      if (debug.enabled) renderDebugOverlay();
      return;
    }

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
    } else if (inventorySlide && inventorySlide.isVisible && inventoryScreen && font && redFont && hudRenderer && link) {
      // Inventory subscreen — checked before the gameplay branches so it renders in
      // BOTH the overworld and dungeons (the play area slides down, panel slides in).
      const offset = inventorySlide.offset;
      const invLinkSheet = getActiveLinkSheet();

      // Draw the current play area below, pushed down by the slide offset.
      renderer.ctx.save();
      renderer.ctx.translate(0, offset);
      if (currentLevel > 0 && dungeonManager) {
        dungeonManager.renderRoom(renderer);
      } else if (overworld) {
        overworld.renderScreen(renderer);
      }
      if (invLinkSheet) link.render(renderer, invLinkSheet);
      renderer.ctx.restore();

      // Draw the inventory panel above, sliding in from the top.
      renderer.ctx.save();
      renderer.ctx.translate(0, offset - renderer.playAreaHeight);
      inventoryScreen.render(renderer, link.inventory, font, redFont, processedItems!, hudRenderer, getHudState());
      renderer.ctx.restore();
    } else if (gameMode === GameMode.DungeonGameplay && dungeonManager && link) {
      dungeonManager.renderRoom(renderer);
      renderDungeonEntities();
    } else if (gameMode === GameMode.DungeonTriforceGet && dungeonManager && link) {
      // Frozen room, Link holding the triforce aloft, a pulsing gold wash + banner.
      dungeonManager.renderRoom(renderer);
      const tgSheet = getActiveLinkSheet();
      if (tgSheet) link.render(renderer, tgSheet);
      const pulse = Math.floor(triforceGetTimer / 4) % 2 === 0;
      renderer.ctx.save();
      renderer.ctx.globalAlpha = pulse ? 0.30 : 0.12;
      renderer.fillRect(0, 0, renderer.playAreaWidth, renderer.playAreaHeight, '#f8d000');
      renderer.ctx.restore();
      if (font) {
        const banner = 'TRIFORCE';
        const x = Math.round((renderer.playAreaWidth - banner.length * 8) / 2);
        (redFont ?? font).drawString(renderer, x, 72, banner);
      }
    } else if (gameMode === GameMode.DungeonTransition && dungeonManager) {
      dungeonManager.renderRoom(renderer);
      const dtLinkSheet = getActiveLinkSheet();
      if (dtLinkSheet && link) link.render(renderer, dtLinkSheet);
      if (curtainEffect) curtainEffect.render(renderer);
    } else if (gameMode === GameMode.DungeonTransition && !dungeonManager && overworld) {
      // Transitioning into dungeon — show overworld with curtain
      overworld.renderScreen(renderer);
      const dtLinkSheet = getActiveLinkSheet();
      if (dtLinkSheet && link) link.render(renderer, dtLinkSheet);
      if (curtainEffect) curtainEffect.render(renderer);
    } else if (gameMode === GameMode.DeathAnimation && deathAnimation && linkSheet) {
      if (currentLevel > 0 && dungeonManager) {
        dungeonManager.renderRoom(renderer);
      } else {
        // Overworld death uses existing render
      }
      deathAnimation.render(renderer, linkSheet, tileRenderer, overworld!.currentScreen, font);
    } else if (gameMode === GameMode.GameOver && gameOverScreen && font) {
      gameOverScreen.render(renderer, font);
    } else if (gameMode === GameMode.ZeldaRescue && font) {
      // Ending stub: black screen with congratulations text
      renderer.fillRect(0, 0, 256, 176, '#000');
      font.drawString(renderer, 56, 48, 'THANKS LINK,');
      font.drawString(renderer, 96, 72, "YOU'RE");
      font.drawString(renderer, 32, 96, 'THE HERO OF HYRULE.');
    } else if (gameMode === GameMode.CaveInterior && caveRoom && link) {
      const caveLinkSheet = getActiveLinkSheet();
      if (caveLinkSheet) caveRoom.render(renderer, link, caveLinkSheet);
      if (curtainEffect && !curtainEffect.done) {
        curtainEffect.render(renderer);
      }
    } else if (gameMode === GameMode.CaveTransition) {
      // During cave transition, show the appropriate background under the curtain
      const ctLinkSheet = getActiveLinkSheet();
      if (caveRoom && ctLinkSheet && link) {
        caveRoom.render(renderer, link, ctLinkSheet);
      } else {
        overworld.renderScreen(renderer);
        if (ctLinkSheet && link) {
          link.render(renderer, ctLinkSheet);
        }
      }
      if (curtainEffect) {
        curtainEffect.render(renderer);
      }
    } else if (overworld.isTransitioning) {
      overworld.renderTransition(renderer);

      const transLinkSheet = getActiveLinkSheet();
      if (transLinkSheet && link) {
        const off = overworld.getNewScreenOffset();
        link.render(renderer, transLinkSheet, off.x, off.y);
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
      if (magicRod && link) {
        magicRod.render(renderer, projectilesSheet!, link.posX, link.posY);
      }
      if (magicShot) {
        magicShot.render(renderer);
      }
      if (processedItems) {
        for (const pickup of pickups) {
          pickup.render(ctx, processedItems);
        }
      }
      overworld.renderTileObject(ctx);
      // Render enemies
      if (spawnManager) {
        spawnManager.render(renderer, enemySheet ?? undefined);
      }
      if (stepladder) {
        stepladder.render(renderer);
      }
      if (raft && link) {
        raft.render(renderer, link.posX);
      }
      if (recorderEffect) {
        recorderEffect.render(renderer);
      }

      // Bomb screen flash — Z_01.asm:4086 UpdateBombFlashEffect
      if (bombs.some(b => b.shouldFlash)) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(0, 0, 256, 176);
        ctx.restore();
      }

      const activeLinkSheet = getActiveLinkSheet();
      const linkHiddenByWhirlwind = recorderEffect !== null && recorderEffect.linkCaught;
      if (activeLinkSheet && link && !linkHiddenByWhirlwind) {
        link.render(renderer, activeLinkSheet);
      }
    }

    if (debug.enabled) {
      renderDebugOverlay();
    }

    renderer.endPlayArea();
  },
});

loop.start();
