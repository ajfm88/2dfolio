import { describe, expect, it, vi } from 'vitest';
import { Player } from './player';
import { GameMap } from './map';
import { runStepEnd } from './step_end';
vi.mock('../input', () => ({ isHeld: () => false, isPassPressed: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSfxPlaying: () => false }));
vi.mock('../renderer', () => ({ drawSprite: vi.fn() }));
describe('GetSimulatedInput land-collision gate', () => {
  it('nonzero index bypasses walls and sprite masks, with no turning pass', () => {
    const p = new Player(), map = new GameMap();
    const terrain = vi.spyOn(map, 'isWalkable').mockReturnValue(false);
    p.spriteCollisions = 0xff;
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) p.simulatedPass('right', false, () => seen.push(p.x), map, []);
    expect(seen).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(terrain).not.toHaveBeenCalled();
    expect(p.x).toBe(16); expect(p.justFinishedStep).toBe(true); expect(p.justTurned).toBe(false);
    const stages: string[] = [];
    runStepEnd(p.stepWasSimulated, s => { stages.push(s); return null; });
    expect(stages).toEqual(['warp', 'connection']);
  });
  it('the zero-index direction performs normal collision, while null still updates sprites', () => {
    const p = new Player(), map = new GameMap(); const sprites = vi.fn();
    vi.spyOn(map, 'isWalkable').mockReturnValue(false); vi.spyOn(map, 'isLedge').mockReturnValue(false);
    p.simulatedPass('left', true, sprites, map, []);
    expect(p.justCollided).toBe(true); expect(p.x).toBe(0); expect(p.justTurned).toBe(false);
    p.simulatedPass(null, true, sprites, map, []);
    expect(sprites).toHaveBeenCalledTimes(2); expect(p.startedFollowStep).toBe(false);
  });
});
