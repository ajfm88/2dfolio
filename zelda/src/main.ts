import { SCREEN_WIDTH, HUD_HEIGHT } from './core/constants.js';
import { GameLoop } from './core/game-loop.js';
import { Renderer } from './render/renderer.js';
import { loadAllAssets, type LoadedAssets } from './data/asset-manifest.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);

let frameCount = 0;
let loadProgress = { loaded: 0, total: 0 };
let assets: LoadedAssets | null = null;
let loadError: string | null = null;

loadAllAssets((loaded, total) => {
  loadProgress = { loaded, total };
})
  .then((result) => {
    assets = result;
  })
  .catch((err: unknown) => {
    loadError = err instanceof Error ? err.message : String(err);
  });

const loop = new GameLoop({
  update(_dt: number) {
    frameCount++;
  },

  render() {
    renderer.clear();

    renderer.fillRect(0, 0, SCREEN_WIDTH, HUD_HEIGHT, '#c84c0c');
    renderer.ctx.fillStyle = '#fcbcb0';
    renderer.ctx.font = '10px monospace';
    renderer.ctx.fillText('THE LEGEND OF ZELDA', 56, 20);

    renderer.beginPlayArea();

    if (loadError) {
      renderer.fillRect(0, 0, renderer.playAreaWidth, renderer.playAreaHeight, '#400');
      renderer.ctx.fillStyle = '#f88';
      renderer.ctx.font = '10px monospace';
      renderer.ctx.fillText('Asset load error:', 8, 40);
      renderer.ctx.fillText(loadError, 8, 56);
    } else if (!assets) {
      renderer.fillRect(0, 0, renderer.playAreaWidth, renderer.playAreaHeight, '#000');
      renderer.ctx.fillStyle = '#fff';
      renderer.ctx.font = '10px monospace';
      renderer.ctx.fillText(
        `Loading assets... ${loadProgress.loaded}/${loadProgress.total}`,
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
      const hue = (frameCount * 2) % 360;
      renderer.fillRect(
        0, 0,
        renderer.playAreaWidth, renderer.playAreaHeight,
        `hsl(${hue} 40% 25%)`,
      );

      renderer.ctx.drawImage(assets.sprites.link, 0, 0, 16, 16, 8, 8, 16, 16);
      renderer.ctx.drawImage(assets.tiles.overworld, 0, 0, 16, 16, 32, 8, 16, 16);

      renderer.ctx.fillStyle = '#fff';
      renderer.ctx.font = '10px monospace';
      renderer.ctx.fillText(`Frame: ${frameCount}`, 8, 48);
      renderer.ctx.fillText(`Assets loaded: ${loadProgress.total}/${loadProgress.total}`, 8, 64);
      renderer.ctx.fillText('A3 asset curation OK', 8, 80);
    }

    renderer.endPlayArea();
  },
});

loop.start();
