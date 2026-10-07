// A6c: the follower wired to its idle machine (pikachu_follower.ts, pikachu_idle.ts)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Direction } from '../core';
import { PikachuFollower } from './pikachu_follower';
import type { PikachuSpriteContext } from './pikachu_follower';
import { restorePikachuHappiness } from './pikachu_happiness';
import { drawSprite } from '../renderer';
import { UiTiles, uiTiles } from '../renderer/ui_tiles';
import { drawShadowUnderSprites } from '../renderer';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PikachuMovementData } from '../rom/extractors/pikachu_movement';

vi.mock('../renderer', () => ({
  loadSprite: vi.fn(async () => ({ height: 96 })), drawSprite: vi.fn(), drawShadowUnderSprites: vi.fn(),
}));

const movementData: PikachuMovementData = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/pikachu_movement.json'), 'utf8'),
);

/** Tick a movement call to its return; the number of frames it took. */
function runMovement(p: PikachuFollower): number {
  let frames = 1;
  while (!p.tickMovement()) frames++;
  return frames;
}

beforeEach(() => {
  vi.mocked(drawSprite).mockClear();
  restorePikachuHappiness(90, 128);
});

/** Player standing at step (sx, sy). */
const at = (sx: number, sy: number, over: Partial<PikachuSpriteContext> = {}): PikachuSpriteContext => ({
  playerWalking: false, playerMapStep: { x: sx, y: sy }, playerFacing: 'down', random: () => 0, ...over,
});

async function follower(): Promise<PikachuFollower> {
  const p = new PikachuFollower();
  await p.loadSprite();
  p.visible = true;
  return p;
}

/** The last drawSprite call: [sheet, sx, frameY, screenX, screenY, flip]. */
const lastDraw = () => { const calls = vi.mocked(drawSprite).mock.calls; return calls[calls.length - 1]; };

describe('spawn and the first update', () => {
  it('hidden until the first UpdateSprites (Func_fc793), then drawn standing', async () => {
    const p = await follower();
    p.spawn(160, 160, 'down'); // behind = one step above
    p.render(0, 0);
    expect(drawSprite).not.toHaveBeenCalled();
    p.updateSprite(at(10, 10));
    p.render(0, 0);
    expect(drawSprite).toHaveBeenCalledOnce();
    expect(p.followCommand).toBe(1); // seed: down, toward the player
  });

  it("stays hidden on the player's tile until the player's map position moves on", async () => {
    const p = await follower();
    p.spawnAtState(160, 160, 'down', 0);
    p.updateSprite(at(10, 10));
    expect(p.imageVisible).toBe(false);
    expect(p.followCommand).toBe(0);
    // The player steps down: the queued target is Pikachu's own tile (nothing to execute)
    p.appendFollowCommand(1);
    p.updateSprite(at(10, 10, { playerWalking: true }));
    expect(p.imageVisible).toBe(false);
    p.updateSprite(at(10, 11));
    expect(p.imageVisible).toBe(true);
    expect(p.isMoving).toBe(false);
  });

  it('off the sprite window nothing runs and the image is hidden', async () => {
    const p = await follower();
    p.spawn(160, 160, 'down');
    p.updateSprite(at(10, 10));
    p.updateSprite(at(10, 20));
    expect(p.imageVisible).toBe(false);
  });
});

describe('the retained follow command', () => {
  it('a corner: Pikachu moves right to the old tile, but the retained command is up', async () => {
    const p = await follower();
    p.spawn(160, 160, 'right'); // behind = one step left
    expect(p.followCommand).toBe(4);
    p.appendFollowCommand(2);
    p.updateSprite(at(10, 10, { playerWalking: true, playerFacing: 'up' }));
    expect(p.direction).toBe('right');
    expect(p.followCommand).toBe(2);
  });

  it('a finished move faces the player by map position, while its image keeps the move', async () => {
    const p = await follower();
    p.spawn(160, 160, 'right');
    p.updateSprite(at(10, 10));
    p.appendFollowCommand(2);
    // Pikachu starts a pass after the player, so it lands after wYCoord changed
    for (let i = 0; i < 7; i++) p.updateSprite(at(10, 10, { playerWalking: true }));
    p.updateSprite(at(10, 9));
    expect(p.isMoving).toBe(false);
    expect(p.direction).toBe('up'); // toward the player: Pikachu (10, 10), player (10, 9)
    p.render(0, 0);
    expect(lastDraw()[5]).toBe(true); // image still the last move: facing right (flipped)
  });

  it('with commands still queued, a finished move faces the newest one', async () => {
    const p = await follower();
    p.spawn(160, 160, 'down');
    p.appendFollowCommand(1);
    for (let i = 0; i < 7; i++) p.updateSprite(at(10, 10, { playerWalking: true }));
    p.appendFollowCommand(4);
    p.updateSprite(at(10, 11, { playerWalking: true }));
    expect(p.isMoving).toBe(false);
    expect(p.direction).toBe('right');
  });

  it('clearing the buffer drops the command; a direct movement call invents none', async () => {
    const p = await follower();
    p.spawn(160, 160, 'down');
    p.appendFollowCommand(7);
    p.clearBuffer();
    expect(p.followCommand).toBe(0);
    p.startMovement(movementData, movementData.programs.viridianStepAside, false, { x: 160, y: 160 });
    runMovement(p);
    expect(p.followCommand).toBe(0);
  });
});

describe('idle and antics through the follower', () => {
  /** Pikachu one step above a standing player, with a retained ledge command. */
  async function waitingAtLedge(byte: number): Promise<PikachuFollower> {
    const p = await follower();
    p.spawn(160, 160, 'down');
    p.clearBuffer();
    p.appendFollowCommand(5);
    const random = vi.fn(() => byte);
    for (let i = 0; i < 256; i++) p.updateSprite(at(10, 10, { random }));
    return p;
  }

  it('the 256th idle update starts an antic for a retained two-step command', async () => {
    const p = await waitingAtLedge(0);
    expect(p.antic).toBe('bounce');
  });

  it('the bounce moves the drawn sprite and its collision pixels, never its map position', async () => {
    const p = await waitingAtLedge(0);
    p.render(0, 0);
    const x0 = lastDraw()[3];
    const y0 = lastDraw()[4];
    p.updateSprite(at(10, 10)); // index 15: (-2, -1)
    expect([p.x, p.y]).toEqual([160, 144]);
    expect(p.screenOffset).toEqual({ x: -1, y: -2 });
    p.render(0, 0);
    expect([lastDraw()[3], lastDraw()[4]]).toEqual([x0 - 1, y0 - 2]);
    const sprite = p.collisionSprite(160, 160);
    expect([sprite.x, sprite.y]).toEqual([0x40 - 1, 0x3c - 16 - 2]);
  });

  it('a walking player aborts the bounce: no offset left, and the queued step follows', async () => {
    const p = await waitingAtLedge(0);
    p.updateSprite(at(10, 10));
    p.appendFollowCommand(1);
    p.updateSprite(at(10, 10, { playerWalking: true }));
    expect(p.antic).toBeNull();
    expect(p.screenOffset).toEqual({ x: 0, y: 0 });
    p.updateSprite(at(10, 10, { playerWalking: true }));
    expect(p.isMoving).toBe(true);
  });

  it('a movement call takes Pikachu as it is: the antic waits and keeps its own offset', async () => {
    const p = await waitingAtLedge(0);
    p.updateSprite(at(10, 10)); // the bounce's first offset: (-1, -2)
    const before = { x: p.x, y: p.y, offset: p.screenOffset, map: [p.mapStepX, p.mapStepY] };
    p.startMovement(movementData, [0x00, 0x3f], false, { x: 160, y: 160 }); // init only: reads the drawn pixels
    expect(runMovement(p)).toBe(3);
    expect(p.antic).toBe('bounce');
    expect([p.x, p.y, p.screenOffset, [p.mapStepX, p.mapStepY]]).toEqual([before.x, before.y, before.offset, before.map]);
  });

  it('hiding Pikachu or respawning it leaves no antic or offset', async () => {
    const p = await waitingAtLedge(0);
    p.updateSprite(at(10, 10));
    p.visible = false;
    expect(p.antic).toBeNull();
    expect(p.screenOffset).toEqual({ x: 0, y: 0 });
    const q = await waitingAtLedge(3);
    q.spawn(160, 160, 'down');
    expect(q.antic).toBeNull();
  });

  it('the spin draws each new facing', async () => {
    const p = await waitingAtLedge(3);
    const facings: Direction[] = [];
    for (let i = 0; i < 31; i++) {
      p.updateSprite(at(10, 10));
      p.render(0, 0);
      const [, , frameY, , , flip] = lastDraw();
      facings.push(frameY === 0 ? 'down' : frameY === 16 ? 'up' : flip ? 'right' : 'left');
    }
    expect(new Set(facings)).toEqual(new Set(['down', 'left', 'up', 'right']));
    expect(p.antic).toBeNull();
  });
});

describe('UI over Pikachu (A6c review R-1, R-2)', () => {
  /** The review's fixture: player at (128, 128) = step (8, 8), Pikachu beside it (spawned
   *  behind `facing`), a retained two-step command, 258 updates: the bounce at index 14. */
  async function bouncing(facing: Direction, command: number, byte = 0): Promise<PikachuFollower> {
    const p = await follower();
    p.spawn(128, 128, facing);
    p.clearBuffer();
    p.appendFollowCommand(command);
    for (let i = 0; i < 258; i++) p.updateSprite(at(8, 8, { random: () => byte }));
    return p;
  }
  const covered = (x: number, y: number, w: number, h: number) => {
    const tiles = new UiTiles();
    tiles.cover(x, y, w, h);
    return { playerX: 128, playerY: 128, tileAt: tiles.tileAt };
  };
  const START = (): ReturnType<typeof covered> => covered(80, 0, 80, 112);
  const TEXT_BOX = (): ReturnType<typeof covered> => covered(0, 96, 160, 48);
  const fontLoaded = (ui: ReturnType<typeof covered>, over: Partial<PikachuSpriteContext> = {}) =>
    ({ ...at(8, 8), ui, ...over });

  afterEach(() => uiTiles.clear());

  it('beside START, a bouncing Pikachu is not drawn at all (whole-sprite hiding)', async () => {
    const p = await bouncing('left', 7);
    expect(p.antic).toBe('bounce');
    expect(p.screenOffset).toEqual({ x: -2, y: -4 });
    uiTiles.cover(80, 0, 80, 112);
    p.render(64, 68); // native X 78: X + 2 is column 10, under START
    expect(drawSprite).not.toHaveBeenCalled();
    uiTiles.clear();
    p.render(64, 68);
    expect(lastDraw()).toEqual([expect.anything(), 0, 32, 78, 52, false]);
  });

  it('a covered pass hides the image and freezes everything: no RNG, no offset change', async () => {
    const p = await bouncing('left', 7);
    const random = vi.fn(() => 0);
    p.updateSprite(at(8, 8, { random, ui: START() }));
    expect(p.imageVisible).toBe(false);
    expect(p.collisionSprite(128, 128).available).toBe(false);
    expect(p.screenOffset).toEqual({ x: -2, y: -4 });
    expect(p.antic).toBe('bounce');
    expect(random).not.toHaveBeenCalled();
    // The font-loaded update stops at the same check: the antic survives the menu
    p.fontLoadedUpdate(fontLoaded(START()));
    expect([p.antic, p.screenOffset]).toEqual(['bounce', { x: -2, y: -4 }]);
    // Menu closed: the bounce goes on where it stopped, but asm_fc87f never redraws the
    // image, so IMAGEINDEX stays $ff until the bounce ends and idle draws it again
    p.updateSprite(at(8, 8));
    expect(p.screenOffset).toEqual({ x: -3, y: -2 });
    expect(p.imageVisible).toBe(false);
    for (let i = 0; i < 13; i++) p.updateSprite(at(8, 8));
    expect(p.antic).toBeNull();
    expect(p.imageVisible).toBe(false);
    p.updateSprite(at(8, 8));
    expect(p.imageVisible).toBe(true);
  });

  it.each([[0, 'bounce'], [1, 'walkInPlace'], [2, 'shuffle'], [3, 'spin']] as const)(
    'an uncovered %s ends when a text box opens: standing, on its map position, reseeded',
    async (byte, antic) => {
      const p = await bouncing('down', 5, byte); // Pikachu above the player, clear of the box
      expect(p.antic).toBe(antic);
      p.fontLoadedUpdate(fontLoaded(TEXT_BOX()));
      expect(p.antic).toBeNull();
      expect(p.screenOffset).toEqual({ x: 0, y: 0 });
      expect([p.x, p.y]).toEqual([128, 112]);
      expect(p.followCommand).toBe(1); // RefreshPikachuFollow: down, toward the player
      expect(p.imageVisible).toBe(true);
      p.render(64, 68);
      const [, , frameY] = lastDraw();
      expect([0, 16, 32]).toContain(frameY); // a standing frame
      // Countdown zero and a single-step command: the next glance is 256 updates away
      const random = vi.fn(() => 0);
      for (let i = 0; i < 255; i++) p.updateSprite(at(8, 8, { random }));
      expect(random).not.toHaveBeenCalled();
      p.updateSprite(at(8, 8, { random }));
      expect(random).toHaveBeenCalledOnce();
      expect(p.antic).toBeNull();
    });

  it('a move under way is finished on the map position and the queue dropped', async () => {
    const p = await follower();
    p.spawn(128, 128, 'right'); // Pikachu left of the player
    p.updateSprite(at(8, 8));
    p.appendFollowCommand(2);
    for (let i = 0; i < 3; i++) p.updateSprite(at(8, 8, { playerWalking: true }));
    expect(p.isMoving).toBe(true);
    p.fontLoadedUpdate(fontLoaded(TEXT_BOX(), { playerMapStep: { x: 8, y: 7 } }));
    expect(p.isMoving).toBe(false);
    expect([p.x, p.y]).toEqual([128, 128]);
    expect(p.followBufferLength).toBe(1);
    expect(p.followCommand).toBe(2); // toward the player one step above
  });

  it('talked to (bit 7): turns to face the player instead, countdown 0, or $80 in grass', async () => {
    const p = await follower();
    p.spawn(128, 128, 'down'); // above the player
    p.clearBuffer();
    p.appendFollowCommand(5);
    p.requestFacePlayer();
    p.fontLoadedUpdate(fontLoaded(TEXT_BOX(), { playerFacing: 'up' }));
    expect(p.direction).toBe('down');
    expect(p.followCommand).toBe(5); // Func_fc745 does not refresh the buffer
    const random = vi.fn(() => 1);
    for (let i = 0; i < 255; i++) p.updateSprite(at(8, 8, { random }));
    expect(random).not.toHaveBeenCalled();

    const q = await follower();
    q.spawn(128, 128, 'down');
    q.requestFacePlayer();
    q.fontLoadedUpdate({ ...fontLoaded(TEXT_BOX(), { playerFacing: 'up' }), inGrass: true });
    const r = vi.fn(() => 0x0c);
    for (let i = 0; i < 127; i++) q.updateSprite(at(8, 8, { random: r }));
    expect(r).not.toHaveBeenCalled();
    q.updateSprite(at(8, 8, { random: r }));
    expect(q.direction).toBe('right');
  });

  it('a talk request a box covers waits, then the first uncovered ordinary pass serves it', async () => {
    const p = await follower();
    p.spawn(128, 128, 'left'); // right of the player, under START
    p.updateSprite(at(8, 8));
    p.direction = 'up';
    p.requestFacePlayer();
    const random = vi.fn(() => 0);
    p.fontLoadedUpdate(fontLoaded(START(), { playerFacing: 'right', random }));
    p.updateSprite(at(8, 8, { playerFacing: 'right', random, ui: START() }));
    expect(p.direction).toBe('up');
    expect(p.imageVisible).toBe(false);
    p.updateSprite(at(8, 8, { playerFacing: 'right', random }));
    expect(p.direction).toBe('left');
    expect(p.imageVisible).toBe(true);
    // That pass was Func_fc745 only (no idle count); the countdown starts from 0
    for (let i = 0; i < 255; i++) p.updateSprite(at(8, 8, { random }));
    expect(random).not.toHaveBeenCalled();
    p.updateSprite(at(8, 8, { random }));
    expect(random).toHaveBeenCalledOnce();
  });

  it("on the player's tile the font-loaded update leaves it hidden", async () => {
    const p = await follower();
    p.spawnAtState(128, 128, 'down', 0);
    p.fontLoadedUpdate(fontLoaded(TEXT_BOX()));
    expect(p.imageVisible).toBe(false);
    expect(p.followCommand).toBe(0);
  });
});


describe('native step commands (A6d)', () => {
  it.each(['down', 'up', 'left', 'right'] as const)('appends %s and toggles the two hop halves literally', async dir => {
    const p = await follower();
    const command = ['down', 'up', 'left', 'right'].indexOf(dir) + 1;
    p.playerStepStarted(dir, false);
    expect([p.followCommand, p.followBufferLength]).toEqual([command, 1]);
    p.clearBuffer();
    p.playerStepStarted(dir, true);
    expect([p.followCommand, p.followBufferLength]).toEqual([command + 4, 1]);
    p.playerStepStarted(dir, true);
    expect(p.followBufferLength).toBe(1);
    p.clearBuffer();
    p.playerStepStarted(dir, true); // cut here, bit 6 stays set
    p.spawn(160, 160, dir); // refresh does not reset the toggle
    const seed = p.followCommand;
    p.playerStepStarted(dir, true); // next hop half 1 only clears it
    expect([p.followCommand, p.followBufferLength]).toEqual([seed, 1]);
    p.playerStepStarted(dir, true); // half 2 now appends
    expect([p.followCommand, p.followBufferLength]).toEqual([command + 4, 2]);
  });
  it.each([[2, 2], [3, 4]])('with %i appended walks the first update is %ipx', async (queued, speed) => {
    const p = await follower();
    p.spawn(160, 160, 'down');
    for (let i = 0; i < queued; i++) p.playerStepStarted('down', false);
    p.updateSprite(at(10, 10, { playerWalking: true }));
    expect(p.y).toBe(144 + speed);
  });
  it('even with a backlog a hop takes eight updates, targeting two tiles at once', async () => {
    const p = await follower();
    p.spawn(160, 160, 'down');
    p.clearBuffer();
    p.appendFollowCommand(5);
    for (let i = 0; i < 3; i++) p.appendFollowCommand(1);
    for (let i = 1; i <= 8; i++) {
      p.updateSprite(at(10, 12, { playerWalking: true }));
      expect(p.y).toBe(144 + i * 4);
      expect(p.mapStepY).toBe(11);
      expect(p.isMoving).toBe(i < 8);
    }
  });
  it('the boundary: screen bytes in, world pixels out, a wrap landing where the screen byte says', async () => {
    const p = await follower();
    p.spawn(160 + 170, 160, 'left'); // behind = one step right: world X 346 = screen X 250 (player at 160, 160)
    p.updateSprite(at(10, 10));
    p.direction = 'right';
    p.startMovement(movementData, [0x00, 0x01, 0x62, 0x3f], false, { x: 160, y: 160 });
    while (!p.tickMovement());
    // 250 → 254, 2, 6 on screen: world X = 6 − $40 + 160
    expect([p.x, p.y]).toEqual([102, 160]);
    expect([p.mapStepX, p.mapStepY]).toEqual([22, 10]); // a relative move: the map is untouched
  });

  it('the nurse hop: an integer arc with its shadow, the map at the end, follow commands untouched', async () => {
    const p = await follower();
    p.spawn(160, 160, 'down'); // one step above the player, buffer [down]
    p.updateSprite(at(10, 10));
    p.startMovement(movementData, movementData.programs.nurse2, false, { x: 160, y: 160 });
    expect(p.movementActive).toBe(true);
    for (let i = 0; i < 4; i++) p.tickMovement(); // init, look up: the hop's first update
    expect([p.x, p.y]).toEqual([161, 144 - 1 - 1]); // 1 px right, 1 px up, arc −1
    p.render(0, 0);
    expect(lastDraw()[4]).toBe(p.y - 4); // the drawn sprite is the jumping one
    p.renderMovementShadow(0, 0, []);
    expect(drawShadowUnderSprites).toHaveBeenCalledWith(expect.anything(), 161, 143 + 8, []);
    expect([p.mapStepX, p.mapStepY]).toEqual([10, 9]);
    while (!p.tickMovement());
    expect([p.x, p.y, p.mapStepX, p.mapStepY, p.movementActive]).toEqual([176, 128, 11, 8, false]);
    expect([p.followBufferLength, p.followCommand]).toEqual([1, 1]);
  });
});
