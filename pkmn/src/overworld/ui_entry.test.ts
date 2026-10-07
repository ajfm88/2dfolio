// A6c review R-1/R-2: the UpdateSprites a text box or menu runs as it opens
// (DisplayTextIDInit), with the boxes captured from the real UI drawing.

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import type { Direction } from '../core';
import { Player } from './player';
import { GameMap } from './map';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { UiEntry, overworldUiOpen, fontLoadedUpdateSprites, openOverworldUi } from './ui_entry';
import {
  renderPikachuEmotionBox, startPikachuEmotion, clearPikachuEmotion, pikachuEmotionPhase,
  pikachuEmotionNumber, tickPikachuEmotionEntry, EMOTION_MOVEMENTS,
} from '../pikachu/pikachu_emotion';
import { restorePikachuHappiness } from '../pikachu/pikachu_happiness';
import { loadPikachuMovementData } from '../pikachu/pikachu_movement_data';
import type { BattlePokemon } from '../battle';
import { captureUi, initRenderer } from '../renderer/renderer';
import { uiTiles } from '../renderer/ui_tiles';
import { StartMenu } from '../menus/start_menu';
import { loadGameText } from '../text/game_text';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: vi.fn(() => false) }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => false }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSfxPlaying: () => false }));

beforeAll(async () => {
  await loadGameText();
  await loadPikachuMovementData();
  // The portrait's face images load in the background; here they never arrive
  vi.stubGlobal('Image', class { onload: unknown = null; onerror: unknown = null; src = ''; });
  const ctx2d = () => ({ imageSmoothingEnabled: true, fillStyle: '', fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() });
  const screen = { width: 0, height: 0, style: {}, getContext: ctx2d };
  vi.stubGlobal('document', { getElementById: () => screen, createElement: () => ({ width: 0, height: 0, getContext: ctx2d }) });
  vi.stubGlobal('window', { innerWidth: 480, innerHeight: 432, addEventListener: vi.fn() });
  initRenderer();
});
afterEach(() => { uiTiles.clear(); clearPikachuEmotion(); });

/** The player standing at (128, 128) = step (8, 8), Pikachu spawned behind `facing`
 *  with a retained two-step command, 258 standing passes: mid-bounce. */
function scene(facing: Direction) {
  const player = new Player();
  player.setTilePosition(16, 16);
  const gameMap = new GameMap();
  vi.spyOn(gameMap, 'isGrassTile').mockReturnValue(false);
  const pikachu = new PikachuFollower();
  pikachu.visible = true;
  pikachu.spawn(player.x, player.y, facing);
  pikachu.clearBuffer();
  pikachu.appendFollowCommand(facing === 'left' ? 7 : 5);
  const ctx = { playerWalking: false, playerMapStep: { x: 8, y: 8 }, playerFacing: 'down' as const, random: () => 0 };
  for (let i = 0; i < 258; i++) pikachu.updateSprite(ctx);
  return { player, gameMap, pikachu };
}

/** Open START as the game does: draw it into the UI layer, then UpdateSprites. */
function openStart(s: ReturnType<typeof scene>): void {
  const menu = new StartMenu();
  menu.show(false, 'RED'); // six items: the box is 80 × 112 at the right edge
  captureUi(() => menu.render());
  fontLoadedUpdateSprites(s.player, s.gameMap, uiTiles.tileAt, s.pikachu);
}

describe('which states open UI over the map', () => {
  it('text boxes, START and the boxes reached through text; not full-screen menus', () => {
    for (const st of ['textbox', 'start_menu', 'pikachu_emotion', 'shop', 'pc', 'pokecenter_pc', 'blackboard', 'item_menu', 'save_menu']) {
      expect(overworldUiOpen(st, false)).toBe(true);
    }
    for (const st of ['party_menu', 'dex', 'trainer_card', 'option_menu', 'town_map', 'battle', 'transition']) {
      expect(overworldUiOpen(st, true)).toBe(false);
    }
    expect(overworldUiOpen('script', true)).toBe(true);
    expect(overworldUiOpen('script', false)).toBe(false);
    expect(overworldUiOpen('overworld', false)).toBe(false);
  });

  it('fires once per opening: not on the frames the menu stays up, again after closing', () => {
    const entry = new UiEntry();
    expect(entry.opened(false)).toBe(false);
    expect(entry.opened(true)).toBe(true);
    for (let i = 0; i < 30; i++) expect(entry.opened(true)).toBe(false);
    expect(entry.opened(false)).toBe(false);
    expect(entry.opened(true)).toBe(true);
  });
});

describe('opening START over a bouncing Pikachu', () => {
  it('beside the menu (covered by its real box): hidden and frozen, bounce kept', () => {
    const s = scene('left'); // Pikachu right of the player, X + 2 in column 10
    expect(s.pikachu.antic).toBe('bounce');
    openStart(s);
    expect(uiTiles.tileAt(10, 6)).toBe(0x60);
    expect(s.pikachu.imageVisible).toBe(false);
    expect(s.pikachu.antic).toBe('bounce');
    expect(s.pikachu.screenOffset).toEqual({ x: -2, y: -4 });
    expect(s.pikachu.followCommand).toBe(7);
  });

  it('clear of the menu: back to ready, standing on its map position, reseeded', () => {
    const s = scene('down'); // Pikachu above the player, left of the menu
    openStart(s);
    expect(s.pikachu.imageVisible).toBe(true);
    expect(s.pikachu.antic).toBeNull();
    expect(s.pikachu.screenOffset).toEqual({ x: 0, y: 0 });
    expect([s.pikachu.x, s.pikachu.y]).toEqual([128, 112]);
    expect(s.pikachu.followCommand).toBe(1);
  });
});

describe('talking to Pikachu with the real portrait box (A6c re-review R-3)', () => {
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;

  /** Pikachu standing on side `side` of the player, facing `facing`, image shown. */
  function beside(side: Direction, facing: Direction) {
    const player = new Player();
    player.setTilePosition(16, 16);
    player.direction = side; // the player faces Pikachu
    const gameMap = new GameMap();
    vi.spyOn(gameMap, 'isGrassTile').mockReturnValue(false);
    const pikachu = new PikachuFollower();
    pikachu.visible = true;
    pikachu.spawn(player.x, player.y, OPPOSITE[side]); // spawn puts it behind that facing
    pikachu.updateSprite({ playerWalking: false, playerMapStep: { x: 8, y: 8 }, playerFacing: side });
    pikachu.direction = facing;
    return { player, gameMap, pikachu };
  }
  const ordinary = (s: ReturnType<typeof beside>) => s.pikachu.updateSprite({
    playerWalking: false, playerMapStep: { x: 8, y: 8 }, playerFacing: s.player.direction, random: () => 0,
  });

  /** Talking to Pikachu: the A press sets bit 7, the emotion starts, and main.ts's
   *  opening runs the bare-map update (no border yet). */
  function talk(s: ReturnType<typeof beside>, party: BattlePokemon[] = []): void {
    s.pikachu.requestFacePlayer();
    startPikachuEmotion(party);
    openOverworldUi('pikachu_emotion', s.player, s.gameMap, s.pikachu, () => { captureUi(renderPikachuEmotionBox); });
  }
  const entryDeps = (s: ReturnType<typeof beside>) => ({
    follower: s.pikachu,
    player: s.player,
    inGrass: () => false,
    captureBorder: () => { captureUi(renderPikachuEmotionBox); },
    coveredUpdate: () => fontLoadedUpdateSprites(s.player, s.gameMap, uiTiles.tileAt, s.pikachu),
  });
  /** Frames from the first tick to the portrait; `each` sees every frame. */
  function toPortrait(s: ReturnType<typeof beside>, each?: () => void): number {
    let frames = 0;
    while (pikachuEmotionPhase() !== 'portrait') {
      tickPikachuEmotionEntry(entryDeps(s));
      each?.();
      if (++frames > 500) throw new Error('no portrait');
    }
    return frames;
  }

  it.each(['up', 'down', 'left', 'right'] as const)(
    "from the %s: turns on the bare map, hides under the portrait's border, reappears turned", side => {
      restorePikachuHappiness(120, 128); // emotion 1: no movement
      const s = beside(side, side === 'up' ? 'left' : 'up');
      talk(s);
      expect(pikachuEmotionNumber()).toBe(1);
      expect(s.pikachu.direction).toBe(OPPOSITE[side]);
      expect(s.pikachu.imageVisible).toBe(true); // no border at the opening
      expect(uiTiles.tileAt(6, 5)).not.toBe(0x60);
      // the border, Delay3, its UpdateSprites, Delay3
      expect(toPortrait(s)).toBe(1 + 6);
      expect(uiTiles.tileAt(6, 5)).toBe(0x60); // the portrait's real box, (48, 40) 56 × 56
      expect(s.pikachu.imageVisible).toBe(false); // every adjacent footprint is under it
      clearPikachuEmotion();
      uiTiles.clear(); // closed: CloseTextDisplay reloads the map view
      ordinary(s);
      expect(s.pikachu.imageVisible).toBe(true);
      expect(s.pikachu.direction).toBe(OPPOSITE[side]);
      // An unrelated text later changes nothing about the facing
      s.player.direction = side === 'up' ? 'down' : 'up';
      openOverworldUi('textbox', s.player, s.gameMap, s.pikachu, () => { uiTiles.cover(0, 96, 160, 48); });
      expect(s.pikachu.direction).toBe(OPPOSITE[side]);
    });

  it("the border's update comes 3 frames after the box, the portrait 3 after that", () => {
    restorePikachuHappiness(120, 128);
    const s = beside('right', 'up');
    talk(s);
    const hidden: boolean[] = [];
    toPortrait(s, () => hidden.push(!s.pikachu.imageVisible));
    expect(hidden).toEqual([false, false, false, true, true, true, true]);
  });

  it('the turn sets the countdown to 0: the next glance is 256 ordinary updates away', () => {
    restorePikachuHappiness(120, 128);
    const s = beside('right', 'up');
    talk(s);
    toPortrait(s);
    clearPikachuEmotion();
    uiTiles.clear();
    for (let i = 0; i < 255; i++) ordinary(s);
    expect(s.pikachu.direction).toBe('left');
    ordinary(s); // byte 0 → down
    expect(s.pikachu.direction).toBe('down');
  });
});

describe("the emotion's movement prelude (A6e)", () => {
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
  function beside(side: Direction) {
    const player = new Player();
    player.setTilePosition(16, 16);
    player.direction = side;
    const gameMap = new GameMap();
    vi.spyOn(gameMap, 'isGrassTile').mockReturnValue(false);
    const pikachu = new PikachuFollower();
    pikachu.visible = true;
    pikachu.spawn(player.x, player.y, OPPOSITE[side]);
    pikachu.updateSprite({ playerWalking: false, playerMapStep: { x: 8, y: 8 }, playerFacing: side });
    return { player, gameMap, pikachu };
  }
  function session(happiness: number, mood: number, render = 0) {
    restorePikachuHappiness(happiness, mood);
    const s = beside('right');
    s.pikachu.requestFacePlayer();
    startPikachuEmotion([]);
    openOverworldUi('pikachu_emotion', s.player, s.gameMap, s.pikachu, () => { captureUi(renderPikachuEmotionBox); });
    const buffer = [s.pikachu.followCommand, s.pikachu.followBufferLength];
    const trace: string[] = [];
    let frames = 0;
    while (pikachuEmotionPhase() !== 'portrait') {
      tickPikachuEmotionEntry({
        follower: s.pikachu, player: s.player, inGrass: () => false,
        captureBorder: () => { captureUi(renderPikachuEmotionBox); },
        coveredUpdate: () => fontLoadedUpdateSprites(s.player, s.gameMap, uiTiles.tileAt, s.pikachu),
      });
      for (let r = 0; r < render; r++) captureUi(renderPikachuEmotionBox); // what rendering does
      trace.push(`${pikachuEmotionPhase()} ${s.pikachu.x},${s.pikachu.y} ${s.pikachu.imageVisible} ${uiTiles.tileAt(6, 5)}`);
      if (++frames > 500) throw new Error('no portrait');
    }
    const result = { s, frames, trace, buffer, emotion: pikachuEmotionNumber() };
    clearPikachuEmotion();
    uiTiles.clear();
    return result;
  }

  it('the five emotions that move, each call its own Apply', () => {
    expect(EMOTION_MOVEMENTS).toEqual({
      4: ['emotion_fd230'], 6: ['emotion_fd21e'], 7: ['emotion_fd224', 'emotion_fd224'],
      9: ['emotion_fd218'], 13: ['emotion_fd21e'],
    });
  });

  it('emotion 13: 67 movement frames on the bare map before the border, then the portrait', () => {
    const t = session(40, 150); // happiness ≤ 50, mood 129–210 → 13
    expect(t.emotion).toBe(13);
    expect(t.frames).toBe(1 + 67 + 6);
    const prelude = t.trace.slice(0, 67);
    expect(prelude.every(line => line.startsWith('prelude') && line.endsWith('true 0'))).toBe(true);
    // a direct Apply: no follow refresh
    expect([t.s.pikachu.followCommand, t.s.pikachu.followBufferLength]).toEqual(t.buffer);
  });

  it('emotion 7: two calls of 35 frames each, then the border', () => {
    const t = session(180, 128); // happiness ≤ 200, mood 128 → 7
    expect(t.emotion).toBe(7);
    expect(t.frames).toBe(1 + 35 + 35 + 6);
  });

  it('emotions 4, 6 and 9 run theirs; 1 and the status emotions run none', () => {
    expect(session(150, 128)).toMatchObject({ emotion: 4, frames: 1 + 67 + 6 });
    expect(session(40, 128)).toMatchObject({ emotion: 6, frames: 1 + 67 + 6 });
    expect(session(90, 20)).toMatchObject({ emotion: 9, frames: 1 + 69 + 6 });
    expect(session(120, 128)).toMatchObject({ emotion: 1, frames: 1 + 6 });
    restorePikachuHappiness(40, 150);
    const asleep = { species: { id: 25 }, status: 'SLP' } as unknown as BattlePokemon;
    startPikachuEmotion([asleep]);
    expect(pikachuEmotionNumber()).toBe(11);
  });

  it('rendering between ticks never changes the prelude or the border', () => {
    const quiet = session(180, 128, 0);
    const busy = session(180, 128, 3);
    expect(busy.trace).toEqual(quiet.trace);
    expect(busy.frames).toBe(quiet.frames);
  });
});
