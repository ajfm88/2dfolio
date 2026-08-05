import { SCREEN_WIDTH, SCREEN_HEIGHT } from './core/constants.js';
import { GameLoop } from './core/game-loop.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

function scaleCanvas(): void {
  const scaleX = Math.floor(window.innerWidth / SCREEN_WIDTH);
  const scaleY = Math.floor(window.innerHeight / SCREEN_HEIGHT);
  const scale = Math.max(1, Math.min(scaleX, scaleY));
  canvas.style.width = `${SCREEN_WIDTH * scale}px`;
  canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
}

scaleCanvas();
window.addEventListener('resize', scaleCanvas);

let frameCount = 0;

const loop = new GameLoop({
  update(_dt: number) {
    frameCount++;
  },

  render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(0, 0, SCREEN_WIDTH, 64);

    ctx.fillStyle = '#fcbcb0';
    ctx.font = '10px monospace';
    ctx.fillText('THE LEGEND OF ZELDA', 56, 20);

    ctx.fillStyle = '#7c7c7c';
    ctx.fillRect(0, 64, SCREEN_WIDTH, SCREEN_HEIGHT - 64);

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`Frame: ${frameCount}`, 8, 140);
    ctx.fillText('A1 scaffold OK — canvas + loop running', 8, 158);
  },
});

loop.start();
