import {
  LINK_SHEET_COLUMNS,
  PLAY_AREA_HEIGHT,
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
  SCREEN_WIDTH,
  SPRITE_SPACING,
} from './core/constants.js';
import { rectsOverlap } from './core/collision-utils.js';
import { DebugOverlay } from './core/debug-overlay.js';
import { FpsCounter } from './core/fps-counter.js';
import { GameLoop } from './core/game-loop.js';
import { InputManager } from './core/input.js';
import { Direction } from './core/types.js';
import { Renderer } from './render/renderer.js';
import { SpriteSheet } from './render/sprite-renderer.js';
import { TileRenderer, getScreenByCoord } from './render/tile-renderer.js';
import { loadAllAssets, type LoadedAssets } from './data/asset-manifest.js';
import type { OverworldData, OverworldScreen } from './data/overworld-types.js';
import { HudRenderer } from './ui/hud.js';
import { ScreenTransition } from './world/screen-transition.js';
import { TileCollisionMap, createCollisionMap } from './world/collision.js';
import { Link } from './objects/player/link.js';
import { canShieldBlock, ProjectileType, ShieldDeflection } from './objects/player/shield.js';
import { EnemyProjectile } from './objects/projectiles/enemy-projectile.js';
import { PushBlock } from './world/push-block.js';

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
let hudRenderer: HudRenderer | null = null;
let transition: ScreenTransition | null = null;
let link: Link | null = null;
let collisionMap: TileCollisionMap | null = null;

// D3 demo objects — shield deflection + push block
const enemyProjectiles: EnemyProjectile[] = [];
const deflections: ShieldDeflection[] = [];
let demoPushBlock: PushBlock | null = null;
let projectileSpawnTimer = 0;
const DEMO_SPAWN_INTERVAL = 90;

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
    collisionMap = createCollisionMap(overworldData);
    link = new Link();
    currentScreen = getScreenByCoord(overworldData, screenRow, screenCol) ?? null;
    demoPushBlock = new PushBlock(128, 64);
  } catch (err: unknown) {
    loadError = err instanceof Error ? err.message : String(err);
  }
}

void init();

function startTransition(direction: Direction): void {
  if (!overworldData || !currentScreen || transition || !link) return;
  const oldScreen = currentScreen;
  const dRow = direction === Direction.Up ? -1 : direction === Direction.Down ? 1 : 0;
  const dCol = direction === Direction.Left ? -1 : direction === Direction.Right ? 1 : 0;
  screenRow = ((screenRow + dRow) % 8 + 8) % 8;
  screenCol = ((screenCol + dCol) % 16 + 16) % 16;
  const newScreen = getScreenByCoord(overworldData, screenRow, screenCol);
  if (!newScreen) return;
  currentScreen = newScreen;

  // Place Link at the opposite edge of the new screen (NES-faithful entry)
  switch (direction) {
    case Direction.Right:
      link.setPosition(SCREEN_EDGE_LEFT, link.posY);
      break;
    case Direction.Left:
      link.setPosition(SCREEN_EDGE_RIGHT, link.posY);
      break;
    case Direction.Down:
      link.setPosition(link.posX, SCREEN_EDGE_TOP);
      break;
    case Direction.Up:
      link.setPosition(link.posX, SCREEN_EDGE_BOTTOM);
      break;
  }
  link.setDirection(direction);

  transition = new ScreenTransition(direction, oldScreen, newScreen);
}

function renderDebugOverlay(): void {
  const ctx = renderer.ctx;
  const screenId = currentScreen ? currentScreen.id : -1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, renderer.playAreaWidth, 12);

  ctx.font = '8px monospace';
  ctx.fillStyle = '#0f0';
  const lx = link ? link.posX : 0;
  const ly = link ? link.posY : 0;
  ctx.fillText(
    `FPS:${fpsCounter.fps} F:${frameCount} Screen:${screenId} (${screenRow},${screenCol}) Link:(${lx},${ly}) E:0`,
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
      if (link) link.tickAnimation();
      if (transition.done) {
        transition = null;
      }
      return;
    }

    if (link && collisionMap && currentScreen) {
      const result = link.update(input, collisionMap, currentScreen);
      if (result.screenEdge !== null) {
        startTransition(result.screenEdge);
      }

      // Spawn demo projectiles periodically
      projectileSpawnTimer++;
      if (projectileSpawnTimer >= DEMO_SPAWN_INTERVAL) {
        projectileSpawnTimer = 0;
        const spawnY = link.posY + 4;
        enemyProjectiles.push(
          new EnemyProjectile(SCREEN_WIDTH - 16, spawnY, Direction.Left, ProjectileType.Rock),
        );
      }

      // Update projectiles and check shield collision
      for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = enemyProjectiles[i]!;
        proj.update();
        if (!proj.isActive()) {
          enemyProjectiles.splice(i, 1);
          continue;
        }
        if (proj.isFlying() && rectsOverlap(proj.getHitbox(), link.getCollisionRect())) {
          if (link.hasShield && canShieldBlock(link.facing, proj.direction, proj.type, link.hasMagicShield, link.isIdle)) {
            deflections.push(new ShieldDeflection(proj.x, proj.y, link.facing));
            proj.deflect(link.facing);
          } else {
            proj.deactivate();
          }
        }
      }

      // Update deflection effects
      for (let i = deflections.length - 1; i >= 0; i--) {
        deflections[i]!.update();
        if (!deflections[i]!.isActive()) {
          deflections.splice(i, 1);
        }
      }

      // Update push block
      if (demoPushBlock) {
        demoPushBlock.update(link, true);
      }
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

      if (linkSheet && link) {
        const newOff2 = transition.getNewScreenOffset();
        link.render(renderer, linkSheet, newOff2.x, newOff2.y);
      }
    } else {
      tileRenderer.renderScreen(renderer, currentScreen);
      if (demoPushBlock) {
        demoPushBlock.render(renderer);
      }
      for (const proj of enemyProjectiles) {
        proj.render(renderer);
      }
      for (const defl of deflections) {
        defl.render(renderer);
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
