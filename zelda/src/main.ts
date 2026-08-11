import { SCREEN_WIDTH, HUD_HEIGHT } from './core/constants.js';
import { DebugOverlay } from './core/debug-overlay.js';
import { FpsCounter } from './core/fps-counter.js';
import { GameLoop } from './core/game-loop.js';
import { Action, InputManager } from './core/input.js';
import { Renderer } from './render/renderer.js';
import { TileRenderer, getScreenByCoord } from './render/tile-renderer.js';
import { loadAllAssets, type LoadedAssets } from './data/asset-manifest.js';
import type { OverworldData, OverworldScreen } from './data/overworld-types.js';

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

async function init(): Promise<void> {
  try {
    assets = await loadAllAssets((loaded, total) => {
      loadProgress = { loaded, total };
    });

    const resp = await fetch('/src/data/overworld.json');
    overworldData = (await resp.json()) as OverworldData;

    tileRenderer.init(assets.maps.overworldMap);
    currentScreen = getScreenByCoord(overworldData, screenRow, screenCol) ?? null;
  } catch (err: unknown) {
    loadError = err instanceof Error ? err.message : String(err);
  }
}

void init();

function navigateScreen(dRow: number, dCol: number): void {
  if (!overworldData) return;
  screenRow = ((screenRow + dRow) % 8 + 8) % 8;
  screenCol = ((screenCol + dCol) % 16 + 16) % 16;
  currentScreen = getScreenByCoord(overworldData, screenRow, screenCol) ?? null;
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

    if (input.isJustPressed(Action.Up)) navigateScreen(-1, 0);
    if (input.isJustPressed(Action.Down)) navigateScreen(1, 0);
    if (input.isJustPressed(Action.Left)) navigateScreen(0, -1);
    if (input.isJustPressed(Action.Right)) navigateScreen(0, 1);
  },

  render() {
    fpsCounter.tick(performance.now());
    renderer.clear();

    renderer.fillRect(0, 0, SCREEN_WIDTH, HUD_HEIGHT, '#c84c0c');
    renderer.ctx.fillStyle = '#fcbcb0';
    renderer.ctx.font = '10px monospace';
    renderer.ctx.fillText('THE LEGEND OF ZELDA', 56, 20);

    const screenId = currentScreen ? currentScreen.id : -1;
    renderer.ctx.fillStyle = '#fcbcb0';
    renderer.ctx.font = '8px monospace';
    renderer.ctx.fillText(
      `Screen ${screenId} (${screenRow},${screenCol})  [Arrows to navigate]`,
      8,
      38,
    );

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
    } else {
      tileRenderer.renderScreen(renderer, currentScreen);
    }

    if (debug.enabled) {
      renderDebugOverlay();
    }

    renderer.endPlayArea();
  },
});

loop.start();
