import {
  initRenderer,
  clear,
  drawFadeOverlay,
  setActivePalette,
  getMapPalette,
  loadEmoteSprite,
  getCtx,
  getScale,
} from "./renderer";
import { initAudio, resumeAudio, playMusic, stopMusic, tickAudio, playSFX, suspendAudio, resumeAudioOutput } from "./audio";
import { updateInput, isPressed, initTouchControls } from "./input";
import { GameMap, Player, Npc, loadNpcs } from "./overworld";
import {
  applyDefeatedTrainers, applyStoryNpcState, recordDefeated,
  startSpiralTransition, startWildTransition, updateBattleTransition, renderBattleTransitionOverlay,
  performWarpLoad, performMapConnection,
  updateOverworld as runOverworld, createOverworldState,
} from "./overworld";
import type { OverworldAction } from "./overworld";
import { PikachuFollower, shouldPikachuFollow, modifyPikachuHappiness, resetPikachuHappiness, restorePikachuHappiness, getPikachuHappiness, getPikachuMood } from "./pikachu";
import {
  initPikachuBattle, updatePikachuBattle, renderPikachuBattle,
  clearPikachuBattle,
  startPikachuEmotion, updatePikachuEmotionAnim, renderPikachuEmotionBox,
  isPikachuEmotionActive, isPikachuEmotionExpired, clearPikachuEmotion,
} from "./pikachu";
import {
  initTextSystem,
  reloadBorderTiles,
  TextBox,
  getFontCanvas,
  loadGameText,
} from "./text";
import { updateDebugPanel, consumeDebugWarp } from "./debug";
import {
  Battle,
  loadBattleData,
  createPokemon,
  initBattleUI,
  loadWildEncounters,
  initExperience,
  loadTrainerData,
  getTrainerClass,
  checkEvolutions,
  applyEvolution,
  loadPokemonSprites,
  renderBattleText,
} from "./battle";
import { createSilhouette } from "./battle/battle_ui";
import type { BattlePokemon, TrainerPartyMember, EvolutionCandidate } from "./battle";
import { Bag, getItemName, initItemNames } from "./items";
import type { ItemStack } from "./items";
import {
  StartMenu,
  PartyMenu,
  ShopMenu,
  ItemMenu,
  TownMap,
  BlackboardMenu,
  getSchoolBlackboardConfig,
  PcMenu,
  PokecenterPcMenu,
  NUM_BOXES,
  pokemonToBoxed,
  TrainerCard,
  BADGE_FLAGS,
  OptionMenu,
  SaveMenu,
  PokedexMenu,
  TitleScreen,
  MainMenu,
  OakSpeech,
  NamingScreen,
  loadEdTile,
} from "./menus";
import type { BoxedPokemon } from "./menus";
import { saveGame, loadGame, restoreParty, restoreBag, hasSavedGame } from "./save";
import { hasFlag, getAllFlags, restoreFlags } from "./events";
import { markSeen, markOwned, getSeenList, getOwnedList, getOwnedCount, restorePokedex } from "./pokedex_state";
import type { ScriptCommand } from "./script";
import {
  initScript, updateScript as runScript, getActiveScript,
  isScriptBattlePending, clearScriptBattlePending, advanceActiveScript,
  getScriptNpcs, getScriptFadeAlpha, lookupNpc,
  renderPokecenterHeal, renderScriptExclamation, renderScriptYesNo,
} from "./script";
import type { ScriptDeps } from "./script";
import {
  buildOaksLabIntroScript,
  buildOaksLabAwaitBallScript,
} from "./story/oaks_lab";
import { buildViridianMartParcelScript } from "./story/viridian_mart";
import { getPlayerName, getRivalName, setPlayerName, setRivalName, restoreNames } from "./core/player_state";

const gameMap = new GameMap();
const player = new Player();
const textBox = new TextBox();
const pikachuFollower = new PikachuFollower();
let npcs: Npc[] = [];

type GameState =
  | "splash"
  | "title_screen"
  | "main_menu"
  | "oak_speech"
  | "naming_screen"
  | "overworld"
  | "textbox"
  | "transition"
  | "battle"
  | "battle_transition"
  | "trainer_approach"
  | "start_menu"
  | "party_menu"
  | "shop"
  | "item_menu"
  | "script"
  | "town_map"
  | "blackboard"
  | "pc"
  | "pokecenter_pc"
  | "trainer_card"
  | "option_menu"
  | "save_menu"
  | "pikachu_battle"
  | "pikachu_emotion"
  | "dex"
  | "evolution";
let state: GameState = "title_screen";
let stateBeforeMenu: GameState = "overworld"; // where to return after start_menu/textbox
let pendingTownMap = false; // open town map after textbox dismissal
let paused = false;

window.addEventListener("keydown", (e) => {
  if (e.key === "p") {
    paused = !paused;
    if (paused) suspendAudio(); else resumeAudioOutput();
  }
});

// Title screen & main menu
const titleScreen = new TitleScreen();
const mainMenu = new MainMenu();

// Oak speech intro & naming screen
const oakSpeech = new OakSpeech();
const namingScreen = new NamingScreen();

// Pokedex
const pokedexMenu = new PokedexMenu();

// Blackboard interactive menu
const blackboardMenu = new BlackboardMenu();

// Overworld state (mutable, passed to overworld controller)
const ow = createOverworldState();

// Player's party
const playerParty: BattlePokemon[] = [];

// Player's bag
let playerBag = new Bag();

// Player's PC item storage (assembly: wBoxItems, max 50)
// Starts with 1 POTION (assembly: InitPlayerPCItems)
let pcItems: ItemStack[] = [{ id: 'POTION', count: 1 }];

// Pokemon box storage (assembly: sBox1-sBox12, 12 boxes × 20 mons)
let pcBoxes: BoxedPokemon[][] = Array.from({ length: NUM_BOXES }, () => []);
let currentPcBox = 0;

/** Deserialize a boxed Pokemon back into a live BattlePokemon. */
function deserializeBoxed(boxed: BoxedPokemon): BattlePokemon | null {
  const mon = createPokemon(
    boxed.speciesName,
    boxed.level,
    boxed.nickname,
    { atk: boxed.atkDV, def: boxed.defDV, spd: boxed.spdDV, spc: boxed.spcDV },
  );
  if (!mon) return null;
  mon.currentHp = boxed.currentHp;
  mon.status = boxed.status;
  mon.exp = boxed.exp;
  mon.moves = boxed.moves.map(m => ({ id: m.id, pp: m.pp, maxPp: m.maxPp }));
  mon.otName = boxed.otName ?? '';
  mon.otId = boxed.otId ?? 0;
  initExperience(mon);
  return mon;
}

// Player's money
let playerMoney = 3000;

// Defeated trainers tracked globally (persisted across map loads)
const defeatedTrainers = new Set<string>();

// Last blackout warp — where the player warps on whiteout (assembly: wLastBlackoutMap)
// Stores the pokecenter door's exit warp destination, so we warp to the correct
// position in the town. Updated when the player heals at a pokecenter.
// Default: Red's house in Pallet Town (warp 0 = front door).
let lastBlackoutWarp = { destMap: 'PalletTown', destWarpId: 0 };

// Evolution state machine
let evolutionQueue: EvolutionCandidate[] = [];
let evolutionCurrent: EvolutionCandidate | null = null;
let evolutionPhase: 'text_evolving' | 'pre_anim' | 'animate' | 'cancelled' | 'text_evolved' | 'done' = 'done';
let evolutionTimer = 0;
let evolutionOldSprite: HTMLCanvasElement | null = null;
let evolutionNewSprite: HTMLCanvasElement | null = null;
let evolutionOldSilhouette: HTMLCanvasElement | null = null;
let evolutionNewSilhouette: HTMLCanvasElement | null = null;
let evolutionTextLines: string[] = [];
let evolutionWaitingForInput = false;
// Assembly animation state: 8 cycles, b=swaps per cycle (1→8), c=delay frames (16→2)
let evolutionAnimCycle = 0;    // which cycle (0-7)
let evolutionAnimSwaps = 0;    // back-and-forth swaps remaining this cycle
let evolutionAnimDelay = 0;    // delay frames remaining before next swap
let evolutionShowNew = false;  // currently showing new species?
// After evolution finishes, return to overworld (or process next evolution)
let evolutionReturnState: GameState = 'overworld';

// Menus
const startMenu = new StartMenu();
const partyMenu = new PartyMenu();
const shopMenu = new ShopMenu();
const itemMenu = new ItemMenu();
const pcMenu = new PcMenu();
const pokecenterPcMenu = new PokecenterPcMenu();
const trainerCard = new TrainerCard();
const townMap = new TownMap();
const optionMenu = new OptionMenu();
const saveMenu = new SaveMenu();

// Play time tracking
let playTimeMs = 0;
let lastPlayTimeUpdate = Date.now();

// Active battle
let currentBattle: Battle | null = null;


// Screen fade transition state
const FADE_FRAMES = 8; // frames for fade out or fade in (original ~8 frames)
let fadeAlpha = 0; // 0 = no overlay, 1 = fully white
let fadeDir: "out" | "in" | null = null; // 'out' = fading to white, 'in' = fading from white
let fadeCallback: (() => void) | null = null; // called when fade-out completes

/** Start a spiral battle transition (trainer battles), then call cb when done. */
function startBattleTransition(cb: () => void): void {
  startSpiralTransition(cb);
  state = "battle_transition";
}

/** Start a wild battle transition (flash + horizontal stripes), then call cb. */
function startWildBattleTransition(cb: () => void): void {
  startWildTransition(cb);
  state = "battle_transition";
}

// Current map name (for save/defeated tracking)
let currentMapName = "PalletTown";

/** Get the effective map name for story/defeated lookups. */
function getMapName(): string {
  return gameMap.mapData?.name ?? currentMapName;
}

/** Mark defeated trainers on current map NPCs. */
function applyDefeated(): void {
  applyDefeatedTrainers(getMapName(), npcs, defeatedTrainers);
}

/** Apply story-based NPC visibility on current map. */
function applyStory(): void {
  applyStoryNpcState(getMapName(), npcs);
}

/** Record a trainer NPC as defeated. */
function markDefeated(npcId: string): void {
  recordDefeated(getMapName(), npcId, defeatedTrainers);
}

/** Render the splash screen — black with centered "Click to start" text. */
function renderSplash(): void {
  const ctx = getCtx();
  const scale = getScale();
  const w = 160 * scale;
  const h = 144 * scale;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = `${8 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Click to start', w / 2, h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

async function init(): Promise<void> {
  // Always require ROM — no static game assets are shipped with the code.
  // After first upload, IndexedDB cache provides instant loads.
  const useRom = true;
  if (useRom) {
    const { tryLoadFromCache, showUploadScreen } = await import('./rom/upload_ui');
    // Try loading from IndexedDB cache first (instant if previously uploaded)
    const cached = await tryLoadFromCache();
    if (!cached) {
      await showUploadScreen();
    }
  }

  initRenderer();
  initAudio();
  initTouchControls();

  // Load core assets and title screen in parallel
  await Promise.all([
    initTextSystem(),
    loadBattleData(),
    loadTrainerData(),
    loadEmoteSprite(),
    pikachuFollower.loadSprite(),
    titleScreen.load(),
    fetch('item_names.json').then(r => r.ok ? r.json() : {}).then(names => initItemNames(names)),
    loadGameText(),
  ]);

  const font = getFontCanvas();
  if (font) await initBattleUI(font);

  // Start at splash screen — click required to unlock browser audio
  state = "splash";

  const onSplashClick = async () => {
    document.removeEventListener('click', onSplashClick);
    await resumeAudio();
    state = "title_screen";
    playMusic("titlescreen");
  };
  document.addEventListener('click', onSplashClick);

  requestAnimationFrame(gameLoop);
}

/** Load a saved game and transition to overworld. */
async function loadSavedGame(): Promise<void> {
  const saved = loadGame();
  if (!saved) return;

  currentMapName = saved.mapName;
  setActivePalette(getMapPalette(saved.mapName));
  await reloadBorderTiles();
  await gameMap.load(saved.mapName);
  await player.loadSprite();
  npcs = await loadNpcs(gameMap.mapData?.npcs ?? []);
  await loadWildEncounters(saved.mapName);

  player.x = saved.playerX;
  player.y = saved.playerY;
  player.direction = saved.playerDirection;

  const restoredParty = restoreParty(saved);
  playerParty.length = 0;
  playerParty.push(...restoredParty);

  playerBag = restoreBag(saved);
  playerMoney = saved.money;

  // Restore PC item storage
  if (saved.pcItems) {
    pcItems = saved.pcItems.map(i => ({ id: i.id, name: getItemName(i.id), count: i.count }));
  }
  // Restore play time
  if (saved.playTimeMs) {
    playTimeMs = saved.playTimeMs;
  }
  // Restore Pokemon box storage
  if (saved.pcBoxes) {
    pcBoxes = saved.pcBoxes.map(box => [...box]);
    while (pcBoxes.length < NUM_BOXES) pcBoxes.push([]);
  }
  if (saved.currentPcBox !== undefined) {
    currentPcBox = saved.currentPcBox;
  }

  for (const key of saved.defeatedTrainers) {
    defeatedTrainers.add(key);
  }
  if (saved.eventFlags) {
    restoreFlags(saved.eventFlags);
  }
  restorePikachuHappiness(saved.pikachuHappiness ?? 90, saved.pikachuMood ?? 128);
  restoreNames(saved.playerName, saved.rivalName);
  restorePokedex(saved.pokedexSeen ?? [], saved.pokedexOwned ?? []);
  if (!saved.pokedexSeen && !saved.pokedexOwned) {
    for (const mon of playerParty) markOwned(mon.species.id);
  }
  if (saved.lastBlackoutWarp) {
    lastBlackoutWarp = saved.lastBlackoutWarp;
  } else if ((saved as any).lastBlackoutMap) {
    // Backwards compat: old saves stored just the map name. Convert to warp 0.
    lastBlackoutWarp = { destMap: (saved as any).lastBlackoutMap, destWarpId: 0 };
  }

  applyDefeated();
  applyStory();

  pikachuFollower.visible = shouldPikachuFollow(playerParty);
  if (pikachuFollower.visible) {
    pikachuFollower.spawn(player.x, player.y, player.direction);
  }

  checkMapEntryScripts();
}

/** Start a new game — place player in Red's bedroom. */
async function startNewGame(): Promise<void> {
  currentMapName = "RedsHouse2F";
  setActivePalette(getMapPalette("RedsHouse2F"));
  await reloadBorderTiles();
  await gameMap.load("RedsHouse2F");
  await player.loadSprite();
  npcs = await loadNpcs(gameMap.mapData?.npcs ?? []);

  player.setTilePosition(6, 4);
  player.direction = "down";

  // Reset all mutable state for a fresh game
  playerParty.length = 0;
  playerBag = new Bag();
  playerMoney = 3000;
  pcItems = [{ id: 'POTION', count: 1 }];
  pcBoxes = Array.from({ length: NUM_BOXES }, () => []);
  currentPcBox = 0;
  defeatedTrainers.clear();
  playTimeMs = 0;
  resetPikachuHappiness();
  restoreFlags([]);           // clear all event flags
  restorePokedex([], []);     // clear pokedex
  // Note: player/rival names are set during Oak speech, before this function runs
}

/** Build a set of currently held badge flags for battle stat boosts. */
function getPlayerBadges(): ReadonlySet<string> {
  return new Set(BADGE_FLAGS.filter(f => hasFlag(f)));
}

/** Start a wild battle with transition animation. */
function startBattle(wildPokemon: BattlePokemon): void {
  if (playerParty.length === 0) return;
  markSeen(wildPokemon.species.id);

  stopMusic();
  currentMapMusic = null;
  playMusic('wildbattle');
  startWildBattleTransition(() => {
    const battle = new Battle(
      playerParty[0],
      wildPokemon,
      playerParty,
      playerBag,
      getPlayerBadges(),
      getPlayerName()
    );
    battle.onVictory = () => { stopMusic(); playMusic('defeatedwildmon'); };
    battle.init().then(() => {
      currentBattle = battle;
      state = "battle";
    });
  });
}

/** Start a trainer battle. */
function startTrainerBattle(
  trainerClassName: string,
  partyIndex: number,
  trainerName?: string
): void {
  if (playerParty.length === 0) return;

  const trainerClass = getTrainerClass(trainerClassName);
  if (!trainerClass || partyIndex >= trainerClass.parties.length) {
    console.warn(`Invalid trainer: ${trainerClassName}[${partyIndex}]`);
    return;
  }

  state = "transition";
  const partyMembers = trainerClass.parties[partyIndex] as TrainerPartyMember[];
  // Create a dummy enemy for the constructor (will be replaced by setupTrainerBattle)
  const dummyEnemy = createPokemon(
    partyMembers[0].species,
    partyMembers[0].level
  );
  if (!dummyEnemy) return;

  // Mark all trainer's Pokemon as seen
  for (const pm of partyMembers) {
    const mon = createPokemon(pm.species, pm.level);
    if (mon) markSeen(mon.species.id);
  }

  // Assembly: init_battle.asm — trigger GYMLEADER happiness before gym leader battles
  // Gym leader trainer class IDs (assembly indices)
  const GYM_LEADER_IDS = new Set([34, 35, 36, 37, 38, 39, 40, 29]);
  if (GYM_LEADER_IDS.has(trainerClass.id)) {
    modifyPikachuHappiness('GYMLEADER');
  }

  stopMusic();
  currentMapMusic = null;
  playMusic('trainerbattle');
  const battle = new Battle(playerParty[0], dummyEnemy, playerParty, playerBag, getPlayerBadges(), getPlayerName());
  const displayName = trainerName ?? trainerClass.displayName;
  battle.setupTrainerBattle(trainerClass, partyMembers, displayName);
  battle.onVictory = () => { stopMusic(); playMusic('defeatedtrainer'); };
  battle.init().then(() => {
    currentBattle = battle;
    state = "battle";
  });
}

// ──────── Evolution state machine ────────

// Assembly timing: 80 frame initial delay, 8 animation cycles
const EVOLUTION_PRE_ANIM_FRAMES = 80;  // assembly: ld c, 80; call DelayFrames
const EVOLUTION_ANIM_CYCLES = 8;       // assembly: lb bc, $1, $10 → c decrements by 2 per cycle

/** Start the next evolution in the queue. */
function startNextEvolution(): void {
  const candidate = evolutionQueue.shift();
  if (!candidate) {
    // All evolutions done — return to the saved state
    fadeAlpha = 1;
    fadeDir = "in";
    if (evolutionReturnState === 'script') {
      state = 'script';
      advanceActiveScript();
    } else {
      state = 'overworld';
    }
    // Resume map music after evolution(s)
    updateMapMusic(currentMapName);
    return;
  }

  evolutionCurrent = candidate;
  evolutionPhase = 'text_evolving';
  evolutionOldSprite = null;
  evolutionNewSprite = null;
  evolutionOldSilhouette = null;
  evolutionNewSilhouette = null;
  evolutionWaitingForInput = false;
  state = 'evolution';

  const pName = candidate.pokemon.nickname.toUpperCase();
  // assembly: _IsEvolvingText — "What? {name}\nis evolving!"
  evolutionTextLines = [`What? ${pName}`, `is evolving!`];

  // Load sprites with proper Pokemon palettes (via loadPokemonSprites)
  // Assembly: loads both species pics, shows old in normal palette first,
  // then uses PAL_BLACK (silhouettes) during animation, then restores palette for new species.
  const oldName = candidate.pokemon.species.name;
  const newName = candidate.targetSpecies.name;
  const oldDex = candidate.pokemon.species.id;
  const newDex = candidate.targetSpecies.id;
  Promise.all([
    loadPokemonSprites(oldName, oldDex),
    loadPokemonSprites(newName, newDex),
  ]).then(([oldSprites, newSprites]) => {
    evolutionOldSprite = oldSprites.front;
    evolutionNewSprite = newSprites.front;
    // Create black silhouettes for the animation phase (assembly: PAL_BLACK)
    evolutionOldSilhouette = createSilhouette(oldSprites.front);
    evolutionNewSilhouette = createSilhouette(newSprites.front);
    // Once sprites are loaded, allow the text to be dismissed
    evolutionWaitingForInput = true;
  });
}

/** Start the assembly-accurate animation: 8 cycles, accelerating swaps. */
function startEvolutionAnimation(): void {
  evolutionPhase = 'pre_anim';
  evolutionTimer = EVOLUTION_PRE_ANIM_FRAMES;
  evolutionShowNew = false;
}

/** Begin the next animation cycle (assembly: .animLoop). */
function startEvolutionAnimCycle(): void {
  // cycle 0: b=1 swaps, c=16 delay; cycle 1: b=2, c=14; ... cycle 7: b=8, c=2
  const swapsPerCycle = evolutionAnimCycle + 1;
  const delayPerSwap = 16 - evolutionAnimCycle * 2;
  evolutionAnimSwaps = swapsPerCycle * 2; // *2 because each back-and-forth = 2 swaps (new→old)
  evolutionAnimDelay = delayPerSwap;
  evolutionShowNew = false;
}

/** Update the evolution state each frame. */
function updateEvolution(): void {
  if (!evolutionCurrent) return;

  switch (evolutionPhase) {
    case 'text_evolving':
      // Wait for sprites to load, then immediately start animation
      if (evolutionWaitingForInput) {
        startEvolutionAnimation();
      }
      break;

    case 'pre_anim':
      // 80-frame delay before animation starts (assembly: ld c, 80; call DelayFrames)
      evolutionTimer--;
      if (evolutionTimer <= 0) {
        evolutionPhase = 'animate';
        evolutionAnimCycle = 0;
        startEvolutionAnimCycle();
      }
      break;

    case 'animate': {
      // B button cancels evolution (assembly: Evolution_CheckForCancel)
      if (isPressed('b')) {
        evolutionShowNew = false;
        const pName = evolutionCurrent.pokemon.nickname.toUpperCase();
        // assembly: _StoppedEvolvingText — "Huh? {name}\nstopped evolving!"
        evolutionTextLines = [`Huh? ${pName}`, `stopped evolving!`];
        evolutionPhase = 'cancelled';
        evolutionWaitingForInput = true;
        break;
      }

      // Count down delay, then swap sprite
      evolutionAnimDelay--;
      if (evolutionAnimDelay <= 0) {
        evolutionShowNew = !evolutionShowNew;
        evolutionAnimSwaps--;
        if (evolutionAnimSwaps <= 0) {
          // This cycle is done — advance to next
          evolutionAnimCycle++;
          if (evolutionAnimCycle >= EVOLUTION_ANIM_CYCLES) {
            // Animation complete — evolution succeeds
            evolutionShowNew = true; // show new species
            const pName = evolutionCurrent.pokemon.nickname.toUpperCase();
            const newName = evolutionCurrent.targetSpecies.name.toUpperCase();
            applyEvolution(evolutionCurrent.pokemon, evolutionCurrent.targetSpecies);
            markOwned(evolutionCurrent.targetSpecies.id);
            markSeen(evolutionCurrent.targetSpecies.id);
            // assembly: _EvolvedText + _IntoText — "{name} evolved\ninto {newname}!"
            evolutionTextLines = [`${pName} evolved`, `into ${newName}!`];
            evolutionPhase = 'text_evolved';
            evolutionWaitingForInput = true;
          } else {
            startEvolutionAnimCycle();
          }
        } else {
          // Reset delay for next swap within this cycle
          const delayPerSwap = 16 - evolutionAnimCycle * 2;
          evolutionAnimDelay = delayPerSwap;
        }
      }
      break;
    }

    case 'cancelled':
      if (isPressed('a')) {
        evolutionCurrent = null;
        startNextEvolution();
      }
      break;

    case 'text_evolved':
      if (isPressed('a')) {
        evolutionCurrent = null;
        startNextEvolution();
      }
      break;
  }
}

/** Render the evolution screen.
 *  Assembly: white background, old species in color → PAL_BLACK silhouettes during
 *  animation → new species in color after. (EvolutionSetWholeScreenPalette c=0/1) */
function renderEvolution(): void {
  const ctx = getCtx();
  const s = getScale();
  if (!ctx) return;

  // White background (assembly: cleared screen with lightest palette shade)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 160 * s, 144 * s);

  // Center sprite at hlcoord 7,2 → pixel (56, 16), size 56x56 (7×7 tiles)
  const sprX = 56 * s;
  const sprY = 16 * s;
  const sprW = 56 * s;
  const sprH = 56 * s;

  if (evolutionPhase === 'animate') {
    // During animation: PAL_BLACK — show black silhouettes alternating
    const sprite = (evolutionShowNew && evolutionNewSilhouette)
      ? evolutionNewSilhouette : evolutionOldSilhouette;
    if (sprite) ctx.drawImage(sprite, sprX, sprY, sprW, sprH);
  } else if (evolutionPhase === 'pre_anim') {
    // Pre-animation delay: still showing old species in normal colors
    if (evolutionOldSprite) ctx.drawImage(evolutionOldSprite, sprX, sprY, sprW, sprH);
  } else if (evolutionPhase === 'text_evolved') {
    // After evolution: new species in full color (palette restored)
    if (evolutionNewSprite) ctx.drawImage(evolutionNewSprite, sprX, sprY, sprW, sprH);
  } else if (evolutionPhase === 'cancelled') {
    // Cancelled: old species in full color (palette restored)
    if (evolutionOldSprite) ctx.drawImage(evolutionOldSprite, sprX, sprY, sprW, sprH);
  } else {
    // text_evolving: old species in full color
    if (evolutionOldSprite) ctx.drawImage(evolutionOldSprite, sprX, sprY, sprW, sprH);
  }

  // Text box at bottom using the tile-based renderer
  if (evolutionTextLines.length > 0) {
    renderBattleText(evolutionTextLines);
  }
}

/** Outdoor maps have map connections; indoor maps are buildings/caves/etc.
 *  Uses explicit set rather than patterns for build-time obfuscation compatibility. */
const OUTDOOR_MAPS = new Set([
  'PalletTown', 'ViridianCity', 'ViridianForest',
  'Route1', 'Route2', 'Route3', 'Route4', 'Route5', 'Route6', 'Route7', 'Route8',
  'Route9', 'Route10', 'Route11', 'Route12', 'Route13', 'Route14', 'Route15',
  'Route16', 'Route17', 'Route18', 'Route19', 'Route20', 'Route21', 'Route22',
  'Route23', 'Route24', 'Route25',
]);
function isOutdoorMap(name: string): boolean {
  return OUTDOOR_MAPS.has(name);
}

/**
 * Map name → music track. Derived from data/maps/songs.asm.
 * Indoor maps inherit their parent town's music unless they have specific music.
 */
const MAP_MUSIC: Record<string, string> = {
  // Towns & cities
  PalletTown: 'pallettown',
  ViridianCity: 'cities1',
  // Routes
  Route1: 'routes1',
  Route22: 'routes1',
  // Indoor — Pallet
  RedsHouse1F: 'pallettown',
  RedsHouse2F: 'pallettown',
  BluesHouse: 'pallettown',
  OaksLab: 'oakslab',
  // Indoor — Viridian
  ViridianPokecenter: 'pokecenter',
  ViridianMart: 'pokecenter',
  ViridianSchoolHouse: 'cities1',
  ViridianNicknameHouse: 'cities1',
  ViridianGym: 'gym',
};

/** Get the music track for a map, or null if unknown. */
function getMapMusic(mapName: string): string | null {
  return MAP_MUSIC[mapName] ?? null;
}

/** Current map music track name (to avoid restarting same track on indoor transitions). */
let currentMapMusic: string | null = null;

/** Start playing the music for a map, but only if it's different from current. */
function updateMapMusic(mapName: string): void {
  const track = getMapMusic(mapName);
  if (!track) return;
  if (track === currentMapMusic) return; // same track, don't restart
  currentMapMusic = track;
  playMusic(track);
}

/** Transition to a new map via warp (entering/exiting buildings).
 *  forceStepDown: if true, always auto-step down from warp tile (for blackout). */
function warpToMap(destMapName: string, destWarpId: number, forceStepDown = false, stepPos?: { x: number; y: number }): void {
  state = "transition";
  fadeDir = "out";
  fadeAlpha = 0;
  fadeCallback = () => {
    handleWarpLoad(destMapName, destWarpId, stepPos, forceStepDown);
  };
}

/** Blackout warp: load the destination map, place the player one step BELOW the
 *  pokecenter door (not on it), facing down. Pikachu hidden until first move.
 *  Assembly: HandleBlackout → SpecialWarpIn places player at door, then
 *  PlayerStepOutFromDoor auto-steps down. We do it in one go. */
function handleBlackoutWarp(): void {
  state = "transition";
  fadeDir = "out";
  fadeAlpha = 0;
  fadeCallback = async () => {
    const { destMap, destWarpId } = lastBlackoutWarp;
    const result = await performWarpLoad(
      destMap, destWarpId,
      gameMap, player, pikachuFollower, playerParty, defeatedTrainers,
    );
    if (!result) {
      fadeDir = null;
      fadeAlpha = 0;
      state = "overworld";
      return;
    }
    currentMapName = destMap;
    npcs = result.npcs;

    // Move player one step (16px = 2 tiles) below the door tile
    player.setTilePosition(player.tileX, player.tileY + 2);
    player.direction = 'down';

    // Don't set doorExitStep — player is already below the door
    ow.justWarped = true;
    ow.doorExitStep = false;
    ow.standingOnWarp = false;

    // Hide Pikachu until player moves
    pikachuFollower.visible = false;
    ow.pikachuDeferredSpawn = shouldPikachuFollow(playerParty);

    fadeDir = "in";
    updateMapMusic(currentMapName);
    fadeCallback = () => {
      state = "overworld";
      checkMapEntryScripts();
    };
  };
}

/** Warp to a specific step position on a map (no warp ID needed). */
/** Load destination map and apply result to game state.
 *  forceStepDown: if true, always auto-step down from the warp tile and hide
 *  Pikachu until the step completes (used for blackout warps). */
async function handleWarpLoad(
  destMapName: string,
  destWarpId: number,
  stepPos?: { x: number; y: number },
  forceStepDown = false,
): Promise<void> {
  const result = await performWarpLoad(
    destMapName, destWarpId,
    gameMap, player, pikachuFollower, playerParty, defeatedTrainers,
    stepPos
  );
  if (!result) {
    fadeDir = null;
    fadeAlpha = 0;
    state = "overworld";
    return;
  }
  currentMapName = destMapName;
  npcs = result.npcs;
  // Play map music if it changed
  updateMapMusic(destMapName);
  ow.justWarped = true;
  ow.doorExitStep = result.doorExitStep || forceStepDown;
  ow.standingOnWarp = result.standingOnWarp && !forceStepDown;
  ow.pikachuDeferredSpawn = result.pikachuDeferredSpawn;
  // For forced step-down (blackout): hide Pikachu, defer spawn until step completes
  if (forceStepDown && shouldPikachuFollow(playerParty)) {
    pikachuFollower.visible = false;
    ow.pikachuDeferredSpawn = true;
  }
  // Start fade-in (from white back to normal)
  fadeDir = "in";
  fadeCallback = () => {
    state = "overworld";
    checkMapEntryScripts();
  };
}

/** Transition to a connected map (walking off map edge). */
async function connectToMap(
  destMapName: string,
  connectionDir: "north" | "south" | "east" | "west",
  offset: number
): Promise<void> {
  state = "transition";
  npcs = await performMapConnection(
    destMapName, connectionDir, offset,
    gameMap, player, pikachuFollower, playerParty, defeatedTrainers
  );
  currentMapName = destMapName;
  updateMapMusic(destMapName);
  state = "overworld";
}

// Frame rate cap — adjustable with -/+ keys, persisted in localStorage
const FPS_KEY = "p151-f";
const DEFAULT_FPS = 50;
const MIN_FPS = 10;
const MAX_FPS = 200;
const FPS_STEP = 5;
let targetFps = (() => {
  const saved = localStorage.getItem(FPS_KEY);
  if (saved) {
    const n = Number(saved);
    if (n >= MIN_FPS && n <= MAX_FPS) return n;
  }
  return DEFAULT_FPS;
})();
let targetFrameMs = 1000 / targetFps;
let lastFrameTime = 0;

let fpsDisplayTimer = 0;
function setTargetFps(fps: number): void {
  targetFps = Math.max(MIN_FPS, Math.min(MAX_FPS, fps));
  targetFrameMs = 1000 / targetFps;
  localStorage.setItem(FPS_KEY, String(targetFps));
  fpsDisplayTimer = targetFps * 2; // show for ~2 seconds
}

window.addEventListener("keydown", (e) => {
  if (e.key === "-" || e.key === "_") {
    setTargetFps(targetFps - FPS_STEP);
  }
  if (e.key === "=" || e.key === "+") {
    setTargetFps(targetFps + FPS_STEP);
  }
});

/** One game tick — all update logic (no rendering). */
function gameTick(): void {
  // Accumulate play time (only during gameplay, not title/menu screens)
  const now = Date.now();
  if (state !== "title_screen" && state !== "main_menu" && state !== "oak_speech" && state !== "naming_screen") {
    playTimeMs += now - lastPlayTimeUpdate;
  }
  lastPlayTimeUpdate = now;

  // Tick the audio engine every frame
  tickAudio();

  if (state === "splash") {
    // Waiting for mouse click — no game logic
    return;
  } else if (state === "title_screen") {
    const action = titleScreen.update();
    if (action === 'start') {
      // Title music keeps playing through main menu (matches original game)
      mainMenu.show(hasSavedGame());
      state = "main_menu";
    }
  } else if (state === "main_menu") {
    const action = mainMenu.update();
    if (action === 'continue') {
      // Fade out then load saved game
      stopMusic(); currentMapMusic = null;
      fadeDir = "out";
      fadeCallback = () => {
        loadSavedGame().then(() => {
          updateMapMusic(currentMapName);
          state = "overworld";
          lastPlayTimeUpdate = Date.now();
          fadeDir = "in";
        });
      };
      state = "transition";
    } else if (action === 'new_game') {
      stopMusic(); currentMapMusic = null;
      fadeDir = "out";
      fadeCallback = () => {
        Promise.all([oakSpeech.load(), loadEdTile()]).then(() => {
          oakSpeech.start();
          // Assembly: OakSpeech plays MUSIC_ROUTES2
          playMusic('routes2');
          fadeAlpha = 0;
          fadeDir = null;
          state = "oak_speech";
        });
      };
      state = "transition";
    } else if (action === 'new_game_quick') {
      stopMusic(); currentMapMusic = null;
      setPlayerName('YELLOW');
      setRivalName('BLUE');
      fadeDir = "out";
      fadeCallback = () => {
        startNewGame().then(() => {
          updateMapMusic('RedsHouse2F');
          state = "overworld";
          lastPlayTimeUpdate = Date.now();
          fadeDir = "in";
        });
      };
      state = "transition";
    } else if (action === 'option') {
      optionMenu.show();
      stateBeforeMenu = "main_menu";
      state = "option_menu";
    } else if (action === 'back') {
      state = "title_screen";
    }
  } else if (state === "oak_speech") {
    const oakAction = oakSpeech.update();
    if (oakAction) {
      if (oakAction.type === 'openNamingScreen') {
        namingScreen.show(oakAction.target);
        state = "naming_screen";
      } else if (oakAction.type === 'done') {
        // Oak speech finished — start the actual game
        stopMusic();
        fadeDir = "out";
        fadeAlpha = 1;
        fadeCallback = () => {
          startNewGame().then(() => {
            updateMapMusic('RedsHouse2F');
            state = "overworld";
            lastPlayTimeUpdate = Date.now();
            fadeDir = "in";
          });
        };
        state = "transition";
      }
    }
  } else if (state === "naming_screen") {
    const namingResult = namingScreen.update();
    if (namingResult === 'done') {
      const name = namingScreen.result;
      if (name) {
        oakSpeech.continueAfterNaming(name);
      }
      state = "oak_speech";
    }
  } else if (state === "overworld") {
    // Check for debug warp request
    const debugWarp = consumeDebugWarp();
    if (debugWarp) {
      warpToMap(debugWarp.map, debugWarp.warpId, false, debugWarp.stepPos);
      return;
    }
    if (isPressed("start")) {
      playSFX('start_menu');
      startMenu.show(hasFlag("GOT_POKEDEX"), getPlayerName());
      stateBeforeMenu = "overworld";
      state = "start_menu";
    } else {
      const action = runOverworld(
        {
          player, gameMap, npcs, pikachuFollower, playerParty, playerBag, currentMapName, findNpc,
          onPokecenterHeal: () => {
            // Record the pokecenter door warp as the blackout destination.
            // Warp 0 is the door exit — its destMap/destWarpId point to the
            // correct position in the town. (assembly: SetLastBlackoutMap)
            const doorWarp = gameMap.getWarpByIndex(0);
            if (doorWarp) {
              lastBlackoutWarp = { destMap: doorWarp.destMap, destWarpId: doorWarp.destWarpId };
            }
          },
        },
        ow,
      );
      if (action) handleOverworldAction(action);
    }
  } else if (state === "start_menu") {
    const action = startMenu.update();
    if (action === "dex") {
      pokedexMenu.show(currentMapName);
      state = "dex";
    } else if (action === "party") {
      if (playerParty.length === 0) return;
      partyMenu.show(playerParty);
      state = "party_menu";
    } else if (action === "save") {
      const badgeCount = BADGE_FLAGS.filter(f => hasFlag(f)).length;
      saveMenu.show(getPlayerName(), badgeCount, getOwnedCount(), playTimeMs);
      state = "save_menu";
    } else if (action === "item") {
      itemMenu.show(playerBag, playerParty);
      state = "item_menu";
    } else if (action === "trainer") {
      const badges = BADGE_FLAGS.map(f => hasFlag(f));
      trainerCard.show(getPlayerName(), playerMoney, playTimeMs, badges);
      state = "trainer_card";
    } else if (action === "option") {
      optionMenu.show();
      stateBeforeMenu = "start_menu";
      state = "option_menu";
    } else if (action === "exit") {
      state = "overworld";
    }
  } else if (state === "party_menu") {
    if (partyMenu.update() === "close") {
      state = "start_menu";
    }
  } else if (state === "item_menu") {
    const itemResult = itemMenu.update();
    if (itemResult === "closed") {
      state = "start_menu";
    } else if (itemResult === "use_town_map") {
      // Assembly: ItemUseTownMap → DisplayTownMap (engine/items/town_map.asm)
      state = "town_map";
      townMap.show(currentMapName);
    }
  } else if (state === "shop") {
    if (shopMenu.update() === "closed") {
      state = "overworld";
    }
  } else if (state === "pc") {
    if (pcMenu.update() === "closed") {
      state = "overworld";
    }
  } else if (state === "pokecenter_pc") {
    if (pokecenterPcMenu.update() === "closed") {
      currentPcBox = pokecenterPcMenu.getCurrentBox();
      const wasVis = pikachuFollower.visible;
      pikachuFollower.visible = shouldPikachuFollow(playerParty);
      if (pikachuFollower.visible && !wasVis) {
        pikachuFollower.spawn(player.x, player.y, player.direction);
      }
      state = "overworld";
    }
  } else if (state === "blackboard") {
    if (blackboardMenu.update() === "closed") {
      state = "overworld";
    }
  } else if (state === "trainer_card") {
    if (trainerCard.update()) {
      trainerCard.close();
      state = "start_menu";
    }
  } else if (state === "option_menu") {
    if (optionMenu.update()) {
      state = stateBeforeMenu;
    }
  } else if (state === "save_menu") {
    const saveResult = saveMenu.update();
    if (saveResult === "do_save") {
      saveGame(
        currentMapName,
        player.x,
        player.y,
        player.direction,
        playerParty,
        playerBag,
        playerMoney,
        defeatedTrainers,
        getAllFlags(),
        pcItems,
        playTimeMs,
        getPikachuHappiness(),
        getPikachuMood(),
        pcBoxes,
        currentPcBox,
        getSeenList(),
        getOwnedList(),
        getPlayerName(),
        getRivalName(),
        lastBlackoutWarp,
      );
    } else if (saveResult === "closed") {
      state = "start_menu";
    }
  } else if (state === "dex") {
    if (pokedexMenu.update() === "closed") {
      state = "start_menu";
    }
  } else if (state === "town_map") {
    if (townMap.update() === "closed") {
      state = "overworld";
    }
  } else if (state === "trainer_approach") {
    if (ow.approachingNpc) {
      ow.approachingNpc.updateApproach();
      if (ow.approachingNpc.approachDone) {
        const npcData = ow.approachingNpc.data;
        ow.approachingNpc = null;
        if (npcData.trainerClass && npcData.trainerParty !== undefined) {
          npcData.defeated = true;
          markDefeated(npcData.id);
          startTrainerBattle(
            npcData.trainerClass,
            npcData.trainerParty,
            npcData.trainerName
          );
        } else {
          state = "overworld";
        }
      }
    }
  } else if (state === "script") {
    const scriptDeps: ScriptDeps = {
      textBox, player, gameMap, npcs, playerParty, playerBag,
      pikachuTile: pikachuFollower.visible ? { x: pikachuFollower.tileX, y: pikachuFollower.tileY } : undefined,
      pikachuFollower,
    };
    const scriptAction = runScript(scriptDeps);
    if (scriptAction) {
      switch (scriptAction.type) {
        case 'scriptEnded': {
          state = 'overworld';
          applyStory();
          const wasVis = pikachuFollower.visible;
          pikachuFollower.visible = shouldPikachuFollow(playerParty);
          if (pikachuFollower.visible && !wasVis) {
            pikachuFollower.spawn(player.x, player.y, player.direction);
          }
          break;
        }
        case 'pikachuBattle':
          // Assembly: BATTLE_TYPE_PIKACHU — standard battle transition, then custom auto-battle
          stopMusic();
          currentMapMusic = null;
          playMusic('wildbattle');
          startWildBattleTransition(() => {
            initPikachuBattle();
            state = 'pikachu_battle';
          });
          break;
        case 'startBattleTransition':
          startBattleTransition(() => {
            startTrainerBattle(scriptAction.trainerClass, scriptAction.partyIndex, scriptAction.trainerName);
          });
          break;
        case 'warp':
          warpToMap(scriptAction.map, scriptAction.warpId);
          break;
        case 'openStartMenu':
          startMenu.show(hasFlag("GOT_POKEDEX"), getPlayerName());
          stateBeforeMenu = "script";
          state = "start_menu";
          break;
      }
    }
    const sfa = getScriptFadeAlpha();
    if (sfa !== null) fadeAlpha = sfa;
  } else if (state === "pikachu_emotion") {
    if (isPikachuEmotionActive()) {
      if (isPressed('a') || isPressed('b') || isPikachuEmotionExpired()) {
        state = 'overworld';
        clearPikachuEmotion();
      } else {
        updatePikachuEmotionAnim();
      }
    }
  } else if (state === "textbox") {
    textBox.update();
    if (!textBox.active) {
      if (ow.interactedNpc && !ow.interactedNpc.data.object) {
        ow.interactedNpc.restoreDirection();
      }
      ow.interactedNpc = null;
      if (pendingTownMap) {
        pendingTownMap = false;
        state = "town_map";
        townMap.show(currentMapName);
        return;
      }
      state = stateBeforeMenu;
    }
  } else if (state === "pikachu_battle") {
    const action = updatePikachuBattle();
    if (action?.type === "caught") {
      // Caught → fade out → resume script
      stopMusic();
      state = "transition";
      fadeDir = "out";
      fadeAlpha = 0;
      fadeCallback = () => {
        clearPikachuBattle();
        setActivePalette(action.savedPalette);
        reloadBorderTiles();
        state = "script";
        advanceActiveScript();
        fadeDir = "in";
        fadeCallback = null;
        updateMapMusic(currentMapName);
      };
    }
  } else if (state === "evolution") {
    updateEvolution();
  } else if (state === "battle_transition") {
    updateBattleTransition();
  } else if (state === "battle") {
    if (currentBattle) {
      currentBattle.update();

      if (currentBattle.finished) {
        if (currentBattle.caughtPokemon) {
          const caught = currentBattle.caughtPokemon;
          caught.otName = getPlayerName();
          markOwned(caught.species.id);
          initExperience(caught);
          if (playerParty.length < 6) {
            playerParty.push(caught);
          } else {
            // Party full — send to current PC box (assembly: SendNewMonToBox)
            pcBoxes[currentPcBox].push(pokemonToBoxed(caught));
          }
        }
        if (currentBattle.moneyWon > 0) {
          playerMoney += currentBattle.moneyWon;
        }

        // Pikachu happiness modifiers from battle
        for (let i = 0; i < currentBattle.levelsGained; i++) {
          modifyPikachuHappiness('LEVELUP');
        }
        if (currentBattle.playerPokemonFainted) {
          // Assembly: core.asm — CARELESSTRAINER fires instead of FAINTED when level gap >= 30
          if (currentBattle.carelessTrainerFaint) {
            modifyPikachuHappiness('CARELESSTRAINER');
          } else {
            modifyPikachuHappiness('FAINTED');
          }
        }

        // Check for blackout: battle sets isBlackout when all party Pokemon fainted
        // and has already shown "X is out of useable POKéMON!" + "X blacked out!" text
        const blackout = currentBattle.isBlackout;

        currentBattle = null;

        if (blackout) {
          stopMusic();
          // Blackout sequence: halve money, heal party, warp to last pokecenter town
          playerMoney = Math.floor(playerMoney / 2);
          for (const mon of playerParty) {
            mon.currentHp = mon.maxHp;
            mon.status = null;
            for (const move of mon.moves) move.pp = move.maxPp;
          }
          clearScriptBattlePending();
          pikachuFollower.visible = false;
          handleBlackoutWarp();
        } else {
          // Victory fanfare is already playing (triggered by battle.onVictory callback)
          // Re-evaluate Pikachu visibility (Pikachu may have fainted)
          pikachuFollower.visible = shouldPikachuFollow(playerParty);

          // Check for post-battle evolutions before returning to overworld
          const evoCandidates = checkEvolutions(playerParty);
          if (evoCandidates.length > 0) {
            // Determine where to return after all evolutions
            if (isScriptBattlePending() && getActiveScript()) {
              evolutionReturnState = 'script';
            } else {
              evolutionReturnState = 'overworld';
            }
            clearScriptBattlePending();
            evolutionQueue = evoCandidates;
            startNextEvolution();
          } else {
            fadeAlpha = 1;
            fadeDir = "in";
            if (isScriptBattlePending() && getActiveScript()) {
              clearScriptBattlePending();
              state = "script";
              advanceActiveScript();
            } else {
              clearScriptBattlePending();
              state = "overworld";
            }
            // Stop victory fanfare and resume map music
            stopMusic();
            updateMapMusic(currentMapName);
          }
        }
      }
    }
  }

  // Update fade transition
  if (fadeDir === "out") {
    fadeAlpha += 1 / FADE_FRAMES;
    if (fadeAlpha >= 1) {
      fadeAlpha = 1;
      fadeDir = null;
      if (fadeCallback) {
        const cb = fadeCallback;
        fadeCallback = null;
        cb();
      }
    }
  } else if (fadeDir === "in") {
    fadeAlpha -= 1 / FADE_FRAMES;
    if (fadeAlpha <= 0) {
      fadeAlpha = 0;
      fadeDir = null;
      if (fadeCallback) {
        const cb = fadeCallback;
        fadeCallback = null;
        cb();
      }
    }
  }
}

function gameLoop(now = 0): void {
  requestAnimationFrame(gameLoop);

  if (paused) return;

  // Run multiple update ticks if targetFps exceeds monitor refresh rate
  const elapsed = now - lastFrameTime;
  if (elapsed < targetFrameMs) return;
  const ticks = Math.min(Math.floor(elapsed / targetFrameMs), 4); // cap at 4 to avoid spiral
  lastFrameTime = now;

  for (let tick = 0; tick < ticks; tick++) {
    updateInput();
    gameTick();
  }

  // Update debug panel (HTML, outside canvas)
  updateDebugPanel(currentBattle, playerBag, player, gameMap, playerParty);

  // Render
  if (state === "splash") {
    renderSplash();
  } else if (state === "title_screen") {
    titleScreen.render();
  } else if (state === "main_menu") {
    clear();
    mainMenu.render();
  } else if (state === "oak_speech") {
    oakSpeech.render();
  } else if (state === "naming_screen") {
    namingScreen.render();
  } else if (state === "battle_transition") {
    // Render overworld underneath, then transition overlay on top
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    for (const npc of getScriptNpcs()) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    renderBattleTransitionOverlay();
  } else if (state === "battle") {
    currentBattle?.render();
  } else if (state === "pikachu_battle") {
    renderPikachuBattle();
  } else if (state === "evolution") {
    renderEvolution();
  } else if (state === "party_menu") {
    partyMenu.render();
  } else if (state === "item_menu") {
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    startMenu.render();
    itemMenu.render();
  } else if (state === "shop") {
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    shopMenu.render();
  } else if (state === "pc") {
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    pcMenu.render();
  } else if (state === "pokecenter_pc") {
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    pokecenterPcMenu.render();
  } else if (state === "blackboard") {
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    blackboardMenu.render();
    textBox.render();
  } else if (state === "trainer_card") {
    clear();
    trainerCard.render();
  } else if (state === "option_menu") {
    clear();
    optionMenu.render();
  } else if (state === "save_menu") {
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    startMenu.render();
    saveMenu.render();
  } else if (state === "dex") {
    clear();
    pokedexMenu.render();
  } else if (state === "town_map") {
    clear();
    townMap.render();
  } else if (state === "pikachu_emotion") {
    const camX = player.getCameraX();
    const camY = player.getCameraY();
    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) npc.render(camX, camY);
    for (const npc of getScriptNpcs()) npc.render(camX, camY);
    pikachuFollower.render(camX, camY);
    player.render(camX, camY);
    renderPikachuEmotionBox();
  } else if (state === "transition" && fadeAlpha >= 1) {
    // Fully faded out — draw white screen while loading
    clear();
    drawFadeOverlay(1);
  } else if (state !== "transition") {
    // Camera follows player at fixed screen offset (no clamping — border blocks shown at edges)
    const camX = player.getCameraX();
    const camY = player.getCameraY();

    clear();
    gameMap.render(camX, camY);
    for (const npc of npcs) {
      npc.render(camX, camY);
      gameMap.renderGrassOverlay(npc.x, npc.y, camX, camY);
    }
    for (const npc of getScriptNpcs()) {
      npc.render(camX, camY);
      gameMap.renderGrassOverlay(npc.x, npc.y, camX, camY);
    }
    if (pikachuFollower.visible) {
      pikachuFollower.render(camX, camY);
      gameMap.renderGrassOverlay(pikachuFollower.x, pikachuFollower.y, camX, camY);
    }
    player.render(camX, camY);
    gameMap.renderGrassOverlay(player.x, player.y, camX, camY);
    renderPokecenterHeal(camX, camY, npcs);
    renderScriptExclamation(camX, camY, player, npcs);
    if (state === "start_menu") {
      startMenu.render();
    }

    textBox.render();
    renderScriptYesNo();
  }

  // FPS display toast
  if (fpsDisplayTimer > 0) {
    fpsDisplayTimer--;
    const ctx = getCtx();
    const s = getScale();
    const text = `FPS: ${targetFps}`;
    ctx.font = `${8 * s}px monospace`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const w = ctx.measureText(text).width + 6 * s;
    ctx.fillRect(2 * s, 2 * s, w, 10 * s);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, 5 * s, 9 * s);
  }

  // Draw fade overlay on top of everything (during fade-out or fade-in)
  if (fadeAlpha > 0) {
    drawFadeOverlay(fadeAlpha);
  }
}

/** Handle an action returned by the overworld controller. */
function handleOverworldAction(action: OverworldAction): void {
  switch (action.type) {
    case 'pikachuEmotion':
      startPikachuEmotion(playerParty);
      state = 'pikachu_emotion';
      break;
    case 'textbox':
      textBox.show(action.text);
      if (action.pendingTownMap) pendingTownMap = true;
      stateBeforeMenu = 'overworld';
      state = 'textbox';
      break;
    case 'script':
      startScript(action.commands);
      break;
    case 'openShop':
      shopMenu.show(action.shopItems, playerBag, playerMoney, (delta) => {
        playerMoney += delta;
      });
      state = 'shop';
      break;
    case 'openPc':
      startScript([
        { type: 'text', message: `${getPlayerName()} turned on\nthe PC.` },
        { type: 'callback', fn: () => { pcMenu.show(playerBag, pcItems); state = 'pc'; } },
      ]);
      break;
    case 'openPokecenterPc':
      startScript([
        { type: 'text', message: `${getPlayerName()} turned on\nthe PC.` },
        { type: 'callback', fn: () => {
          pokecenterPcMenu.show(playerBag, pcItems, playerParty, pcBoxes, currentPcBox, deserializeBoxed);
          state = 'pokecenter_pc';
        } },
      ]);
      break;
    case 'openBlackboard':
      blackboardMenu.show(textBox, getSchoolBlackboardConfig());
      state = 'blackboard';
      break;
    case 'startBattle':
      startBattle(action.pokemon);
      break;
    case 'startTrainerBattle':
      markDefeated(action.npcId);
      startTrainerBattle(action.trainerClass, action.partyIndex, action.trainerName);
      break;
    case 'warp':
      // Play door sound: indoor maps start with uppercase letter after prefix
      // Outdoor maps: PalletTown, Route1, ViridianCity, etc.
      // Indoor maps: RedsHouse1F, OaksLab, ViridianPokecenter, etc.
      // On real GB: SFX_GO_INSIDE when entering building, SFX_GO_OUTSIDE when exiting
      playSFX(isOutdoorMap(action.destMap) ? 'go_outside' : 'go_inside');
      warpToMap(action.destMap, action.destWarpId);
      break;
    case 'connectToMap':
      connectToMap(action.destMap, action.dir, action.offset);
      break;
    case 'trainerApproach':
      state = 'trainer_approach';
      break;
  }
}

/** Start a scripted cutscene — thin wrapper around script controller. */
function startScript(commands: ScriptCommand[]): void {
  initScript(commands);
  ow.doorExitStep = false; // prevent stale auto-step after script ends
  state = "script";
}

/** Find an NPC by ID (checks both map NPCs and script-created NPCs). */
function findNpc(id: string): Npc | undefined {
  return lookupNpc(id, npcs);
}

/** Check for story triggers when entering a map. */
function checkMapEntryScripts(): void {
  if (currentMapName === "OaksLab" && !hasFlag("GOT_STARTER")) {
    if (hasFlag("OAK_ASKED_TO_CHOOSE_MON")) {
      // Mid-scene: Oak already spoke, player needs to interact with ball
      startScript(buildOaksLabAwaitBallScript());
    } else if (hasFlag("FOLLOWED_OAK_INTO_LAB")) {
      // Player just entered lab — run full intro cutscene
      startScript(buildOaksLabIntroScript(findNpc));
    }
  }

  // Viridian Mart: parcel quest on first visit
  if (currentMapName === "ViridianMart" && !hasFlag("GOT_OAKS_PARCEL")) {
    startScript(buildViridianMartParcelScript());
  }
}

init().catch((err) => {
  console.error("Failed to initialize:", err);
  const msg = err instanceof Error ? err.message : String(err);
  document.body.innerHTML = `<pre style="color:white;padding:20px">Error: ${msg}\n\nMake sure the dev server is running</pre>`;
});
