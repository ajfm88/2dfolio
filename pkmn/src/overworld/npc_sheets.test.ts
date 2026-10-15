import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Npc } from './npc';
import { drawSprite, loadSprite } from '../renderer';
import { uiTiles } from '../renderer/ui_tiles';
vi.mock('../renderer', () => ({ loadSprite: vi.fn(async () => ({ width: 16, height: 16 })), drawSprite: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); uiTiles.clear(); });
async function ball() {
  const npc = new Npc({ id: 'ball', sprite: 'poke_ball', x: 5, y: 5, movement: 'stay', dialogue: '' });
  await npc.load();
  npc.update({ isWalkable: () => true, playerWalking: false, playerMapStep: { x: 5, y: 5 },
    playerX: 80, playerY: 80, slot: 1, sprites: () => [], random: () => 128 });
  return npc;
}
describe('PrepareOAMData still-sprite entry 0', () => {
  it.each(['up', 'down', 'left', 'right'] as const)('%s always draws row 0, unflipped, with either walk setting', async direction => {
    const npc = await ball(); npc.direction = direction;
    for (const walk of [false, true]) {
      npc.useWalkFrame = walk; npc.render(0, 0);
      expect(drawSprite).toHaveBeenLastCalledWith(expect.anything(), 0, 0, 80, 76, false);
    }
  });
  it('an oversized sheet is a load error', async () => {
    vi.mocked(loadSprite).mockResolvedValueOnce({ width: 16, height: 256 } as HTMLCanvasElement);
    await expect(ball()).rejects.toThrow('invalid sprite sheet height 256');
  });
  it('detects the in-memory old still-sheet misclassification reaching the facing row', async () => {
    const npc = await ball(); npc.direction = 'up';
    Reflect.set(npc, 'spriteSheet', { width: 16, height: 96 }); // models isStatic failing
    npc.render(0, 0);
    expect(() => expect(drawSprite).toHaveBeenLastCalledWith(expect.anything(), 0, 0, 80, 76, false)).toThrow();
  });
});
