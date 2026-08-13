import { LINK_SHEET_COLUMNS, PLAY_AREA_HEIGHT, SCREEN_WIDTH, SPRITE_SPACING } from './core/constants.js';
import { DebugOverlay } from './core/debug-overlay.js';
import { FpsCounter } from './core/fps-counter.js';
import { GameLoop } from './core/game-loop.js';
import { Action, InputManager } from './core/input.js';
import { Direction } from './core/types.js';
import { Renderer } from './render/renderer.js';
import { SpriteSheet, WalkAnimationController, directionToSpriteCol } from './render/sprite-renderer.js';
import { TileRenderer, getScreenByCoord } from './render/tile-renderer.js';
import { loadAllAssets, type LoadedAssets } from './data/asset-manifest.js';
import type { OverworldData, OverworldScreen } from './data/overworld-types.js';
import { HudRenderer } from './ui/hud.js';
import { ScreenTransition } from './world/screen-transition.js';

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
let overworldData: OverworldData | null = null;
let currentScreen: OverworldScreen | null = null;
let screenRow = 7;
let screenCol = 7;
let linkSheet: SpriteSheet | null = null;
const linkWalkAnim = new WalkAnimationController();
let linkDirection = Direction.Down;
let linkX = 120;
let linkY = 80;
let hudRenderer: HudRenderer | null = null;
let transition: ScreenTransition | null = null;

async function init(): Promise<void> {
  try {
    assets = await loadAllAssets((loaded, total) => {
      loadProgress = { loaded, total };
    });

    const resp = await fetch('/src/data/overworld.json');
    overworldData = (await resp.json()) as OverworldData;

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
    currentScreen = getScreenByCoord(overworldData, screenRow, screenCol) ?? null;
  } catch (err: unknown) {
    loadError = err instanceof Error ? err.message : String(err);
  }
}

void init();

function startTransition(direction: Direction): void {
  if (!overworldData || !currentScreen || transition) return;
  const oldScreen = currentScreen;
  const dRow = direction === Direction.Up ? -1 : direction === Direction.Down ? 1 : 0;
  const dCol = direction === Direction.Left ? -1 : direction === Direction.Right ? 1 : 0;
  screenRow = ((screenRow + dRow) % 8 + 8) % 8;
  screenCol = ((screenCol + dCol) % 16 + 16) % 16;
  const newScreen = getScreenByCoord(overworldData, screenRow, screenCol);
  if (!newScreen) return;
  currentScreen = newScreen;
  linkDirection = direction;
  transition = new ScreenTransition(direction, oldScreen, newScreen);
}

function renderDebugOverlay(): void {
  const ctx = renderer.ctx;
  const screenId = currentScreen ? currentScreen.id : -1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, renderer.playAreaWidth, 12);

  ctx.font = '8px monospace';
  ctx.fillStyle = '#0f0';
  ctx.fillText(
    `FPS:${fpsCounter.fps} F:${frameCount} Screen:${screenId} (${screenRow},${screenCol}) E:0`,
    2,
    9,
  );

  const states = input.getAllActionStates();
  const x = 150;
  let y = 24;
  const lineHeight = 12;

  ctx.fillStyle = '#fff';
  ctx.fillText('INPUT', x, y);
  y += lineHeight;

  for (const [action, state] of states) {
    const h = state.held ? 'H' : '.';
    const p = state.justPressed ? 'P' : '.';
    const r = state.justReleased ? 'R' : '.';

    if (state.justPressed) {
      ctx.fillStyle = '#ff0';
    } else if (state.held) {
      ctx.fillStyle = '#0f0';
    } else if (state.justReleased) {
      ctx.fillStyle = '#f44';
    } else {
      ctx.fillStyle = '#666';
    }

    ctx.fillText(`${action.padEnd(8)} [${h}${p}${r}]`, x, y);
    y += lineHeight;
  }
}

const loop = new GameLoop({
  update(_dt: number) {
    input.update();
    frameCount++;

    if (transition) {
      transition.update();
      linkWalkAnim.tick();
      if (transition.done) {
        linkX = 120;
        linkY = 80;
        transition = null;
      }
      return;
    }

    if (input.isJustPressed(Action.Up)) startTransition(Direction.Up);
    else if (input.isJustPressed(Action.Down)) startTransition(Direction.Down);
    else if (input.isJustPressed(Action.Left)) startTransition(Direction.Left);
    else if (input.isJustPressed(Action.Right)) startTransition(Direction.Right);

    if (input.isHeld(Action.Up)) linkDirection = Direction.Up;
    else if (input.isHeld(Action.Down)) linkDirection = Direction.Down;
    else if (input.isHeld(Action.Left)) linkDirection = Direction.Left;
    else if (input.isHeld(Action.Right)) linkDirection = Direction.Right;

    const isMoving = input.isHeld(Action.Up) || input.isHeld(Action.Down) ||
      input.isHeld(Action.Left) || input.isHeld(Action.Right);
    if (isMoving) {
      linkWalkAnim.tick();
    } else {
      linkWalkAnim.reset();
    }
  },

  render() {
    fpsCounter.tick(performance.now());
    renderer.clear();

    if (hudRenderer) {
      hudRenderer.render(renderer, {
        rupees: 0,
        keys: 0,
        bombs: 0,
        hasMagicKey: false,
        health: 6,
        maxHealth: 6,
        bItem: null,
        aItem: null,
        mapRow: screenRow,
        mapCol: screenCol,
        isOverworld: true,
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
    } else if (!assets || !overworldData || !currentScreen) {
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
    } else if (transition) {
      const ctx = renderer.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT);
      ctx.clip();

      const oldOff = transition.getOldScreenOffset();
      ctx.save();
      ctx.translate(oldOff.x, oldOff.y);
      tileRenderer.renderScreen(renderer, transition.oldScreen);
      ctx.restore();

      const newOff = transition.getNewScreenOffset();
      ctx.save();
      ctx.translate(newOff.x, newOff.y);
      tileRenderer.renderScreen(renderer, transition.newScreen);
      ctx.restore();

      ctx.restore();

      if (linkSheet) {
        const col = directionToSpriteCol(linkDirection);
        const frameIndex = linkWalkAnim.currentStep * LINK_SHEET_COLUMNS + col;
        linkSheet.drawFrame(renderer, frameIndex, linkX + newOff.x, linkY + newOff.y);
      }
    } else {
      tileRenderer.renderScreen(renderer, currentScreen);
      if (linkSheet) {
        const col = directionToSpriteCol(linkDirection);
        const frameIndex = linkWalkAnim.currentStep * LINK_SHEET_COLUMNS + col;
        linkSheet.drawFrame(renderer, frameIndex, linkX, linkY);
      }
    }

    if (debug.enabled) {
      renderDebugOverlay();
    }

    renderer.endPlayArea();
  },
});

loop.start();
