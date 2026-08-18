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
import { BitmapFont } from './ui/bitmap-font.js';
import { HudRenderer } from './ui/hud.js';
import { OverworldManager } from './world/overworld-manager.js';
import { CurtainEffect } from './world/curtain-effect.js';
import { CaveRoom, type CaveContents } from './world/cave-room.js';
import { Link } from './objects/player/link.js';

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
let caveWalkIntoFrames = 0; // frames of Link walking into the dark opening before curtain

interface ItemsData {
  readonly caveContents: readonly CaveContents[];
}

async function init(): Promise<void> {
  try {
    assets = await loadAllAssets((loaded, total) => {
      loadProgress = { loaded, total };
    });

    const [owResp, itemsResp] = await Promise.all([
      fetch('/src/data/overworld.json'),
      fetch('/src/data/items.json'),
    ]);
    const overworldData = (await owResp.json()) as OverworldData;
    const itemsData = (await itemsResp.json()) as ItemsData;
    caveContentsData = [...itemsData.caveContents];

    tileRenderer.init(assets.maps.overworldMap);
    linkSheet = new SpriteSheet({
      image: assets.sprites.link,
      columns: LINK_SHEET_COLUMNS,
      spacingX: SPRITE_SPACING,
      spacingY: SPRITE_SPACING,
      autoDetectTransparency: true,
    });
    hudRenderer = new HudRenderer(
      assets.ui.hud,
      assets.sprites.font,
      assets.sprites.treasuresFull,
    );
    font = new BitmapFont(assets.sprites.font);
    link = new Link();
    overworld = new OverworldManager(overworldData, tileRenderer, 7, 7);
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

function startCaveInterior(): void {
  if (!assets || !link || !font || !overworld || pendingCaveIndex === null) return;

  const contents = caveContentsData[pendingCaveIndex];
  if (!contents) return;

  caveRoom = new CaveRoom(
    assets.maps.caveMap,
    assets.sprites.items,
    assets.sprites.npcs,
    font,
    contents,
    overworld.currentScreen.id,
  );
  caveRoom.initLink(link);
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

function updateGameplay(): void {
  if (!link || !overworld) return;

  if (overworld.isTransitioning) {
    overworld.updateTransition(link);
    return;
  }

  const result = link.update(input, overworld.collisionMap, overworld.currentScreen);
  if (result.screenEdge !== null) {
    overworld.tryTransition(result.screenEdge, link);
  }

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

function updateCaveInterior(): void {
  if (!link || !caveRoom) return;

  // Curtain opening animation at start
  if (curtainEffect && !curtainEffect.done) {
    curtainEffect.update();
    return;
  }
  curtainEffect = null;

  // Process Link movement input within cave
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

  // Handle item pickup — for sword cave, give Link the sword
  if (caveRoom.itemPickedUp) {
    const contents = caveContentsData[0]; // TODO: track which cave we're in
    if (contents) {
      const mainItem = contents.items[1];
      if (mainItem === 1) {
        link.setHasSword(true);
      }
    }
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
      hudRenderer.render(renderer, {
        rupees: 0,
        keys: 0,
        bombs: 0,
        hasMagicKey: false,
        health: link ? link.health : 6,
        maxHealth: link ? link.maxHealth : 6,
        bItem: null,
        aItem: null,
        mapRow: overworld ? overworld.screenRow : 7,
        mapCol: overworld ? overworld.screenCol : 7,
        isOverworld: gameMode !== GameMode.CaveInterior,
        levelNumber: 0,
      });
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
    } else if (overworld.isTransitioning) {
      overworld.renderTransition(renderer);

      if (linkSheet && link) {
        const off = overworld.getNewScreenOffset();
        link.render(renderer, linkSheet, off.x, off.y);
      }
    } else {
      overworld.renderScreen(renderer);
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
