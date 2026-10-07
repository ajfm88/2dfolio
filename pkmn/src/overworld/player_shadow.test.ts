import { it, expect, vi, afterEach } from 'vitest';
import { Player } from './player';
import { GameMap } from './map';
import { loadSprite } from '../renderer';

const mock = vi.hoisted(() => {
  const draws: { args: unknown[]; operation: string }[] = [];
  const ctx = {
    globalCompositeOperation: 'source-over', clearRect: vi.fn(), save: vi.fn(),
    restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    drawImage: vi.fn((...args: unknown[]) => { draws.push({ args, operation: ctx.globalCompositeOperation }); }),
  };
  return { ctx, draws, screen: { drawImage: vi.fn() }, sheet: {}, shadow: {} };
});
vi.mock('../renderer', () => ({
  loadSprite: vi.fn(async (url: string) => url.endsWith('shadow.png') ? mock.shadow : mock.sheet),
  drawSprite: vi.fn(), getCtx: () => mock.screen, getScale: () => 3,
}));
vi.mock('../input', () => ({ isHeld: () => false, isPassPressed: () => false }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSfxPlaying: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); mock.draws.length = 0; });

it('loads the shadow with the player palette; mirrors two tiles and punches out the player frame', async () => {
  const canvas = { width: 0, height: 0, getContext: () => mock.ctx };
  vi.stubGlobal('document', { createElement: () => canvas });
  const player = new Player();
  player.x = player.y = 128;
  await player.loadSprite();
  expect(loadSprite).toHaveBeenCalledWith('/gfx/overworld/shadow.png');
  player.renderLedgeShadow(64, 68);
  expect(mock.screen.drawImage).not.toHaveBeenCalled();
  const map = new GameMap();
  vi.spyOn(map, 'isWalkable').mockReturnValue(false);
  vi.spyOn(map, 'isLedge').mockReturnValue(true);
  player.update(map, [], 'right'); // armed, image faces right
  player.renderLedgeShadow(64, 68);
  expect([canvas.width, canvas.height]).toEqual([16, 8]);
  expect(mock.draws.slice(0, 2).map(d => d.args)).toEqual([[mock.shadow, 0, 0], [mock.shadow, 0, 0]]);
  expect(mock.ctx.translate).toHaveBeenNthCalledWith(1, 16, 0); // second tile at +8, mirrored
  expect(mock.ctx.scale).toHaveBeenNthCalledWith(1, -1, 1);
  expect(mock.ctx.translate).toHaveBeenNthCalledWith(2, 16, 0); // player uses the same right flip
  expect(mock.draws[2]).toEqual({ args: [mock.sheet, 0, 32, 16, 16, 0, -12, 16, 16], operation: 'destination-out' });
  expect(mock.screen.drawImage).toHaveBeenCalledWith(canvas, 64 * 3, 68 * 3, 48, 24);
  player.update(map, [], null); // first moving pass, offset -4
  mock.draws.length = 0;
  player.renderLedgeShadow(64, 68);
  expect(mock.draws[2].args[6]).toBe(-16);
  for (let i = 0; i < 15; i++) player.update(map, [], null);
  expect(player.isLanding).toBe(true);
  player.update(map, [], null);
  expect(player.ledgeHopFlag).toBe(true);
  expect(player.takeFrameDelay()).toBe(1);
  player.finishLanding();
  mock.screen.drawImage.mockClear();
  player.renderLedgeShadow(64, 68);
  expect(mock.screen.drawImage).not.toHaveBeenCalled();
  player.update(map, [], 'right');
  player.cancelMovement();
  expect([player.ledgeHopFlag, player.isLanding, player.takeFrameDelay()]).toEqual([false, false, 0]);
});
