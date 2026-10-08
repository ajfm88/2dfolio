// A1c: trainer sight through the overworld controller (notes/20-a1c-plan.md §1, §5).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { Player } from './player';
import { Npc } from './npc';
import { GameMap } from './map';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import { createOverworldState, runMapScript, updateOverworld, finishTrainerEngage, seenStartPressed } from './overworld_controller';
import type { OverworldAction, OverworldDeps, OverworldState } from './overworld_controller';
import { TRAINER_SCRIPT, endTrainerBattle } from './map_trainers';
import type { NpcWalk } from './walk_pace';
import { EmotionBubble, EMOTION_BUBBLE_FRAMES } from './emotion_bubble';
import { isHeld, isPassPressed } from '../input';
import { joyIgnore, setJoyIgnore } from '../input/joy_ignore';
import { updateSprites } from './sprites';
import { loadBattleData, createPokemon } from '../battle';
import { loadGameText } from '../text/game_text';
import { getMapScript, restoreFlags, restoreMapScripts } from '../events';
import type { Direction, NpcData } from '../core';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: vi.fn(() => false), readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSfxPlaying: () => false }));
vi.mock('../renderer', () => ({ loadSprite: vi.fn(async () => ({ height: 96 })), drawSprite: vi.fn(), drawExclamationBubble: vi.fn(), drawShadowUnderSprites: vi.fn() }));

const FOREST = 'ViridianForest';

beforeAll(async () => { await loadBattleData(); await loadGameText(); });
beforeEach(() => {
  restoreFlags([]);
  restoreMapScripts({});
  setJoyIgnore('none');
  vi.mocked(isHeld).mockReturnValue(false);
  vi.mocked(isPassPressed).mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

/** A Forest-like map, everything walkable, no grass; the player at step (x, y). */
function forest(x: number, y: number, facing: Direction = 'down'): OverworldDeps {
  const player = new Player();
  player.setTilePosition(x * 2, y * 2);
  player.direction = facing;
  const gameMap = new GameMap();
  gameMap.mapData = { name: FOREST, width: 20, height: 30, tileset: 'FOREST', blocks: [], borderBlock: 0, connections: [], warps: [], signs: [], npcs: [] };
  vi.spyOn(gameMap, 'isWalkable').mockReturnValue(true);
  vi.spyOn(gameMap, 'isGrassTile').mockReturnValue(false);
  vi.spyOn(gameMap, 'getTileAt').mockReturnValue(0x01);
  vi.spyOn(gameMap, 'getSignAt').mockReturnValue(null);
  vi.spyOn(gameMap, 'getHiddenEventAt').mockReturnValue(null);
  vi.spyOn(gameMap, 'getBookshelfText').mockReturnValue(null);
  return {
    player, gameMap, npcs: [], pikachuFollower: new PikachuFollower(), playerBag: new Bag(),
    playerParty: [createPokemon('PIKACHU', 5)!], currentMapName: FOREST, findNpc: () => undefined,
  };
}

function trainer(id: string, x: number, y: number, direction: Direction, sightRange: number, over: Partial<NpcData> = {}): Npc {
  return new Npc({
    id, sprite: 'youngster', x, y, movement: 'stay', direction, dialogue: 'Hey!',
    trainerClass: 'BUG_CATCHER', trainerParty: 0, sightRange, endBattleText: 'No!', afterBattleText: 'Ssh!', ...over,
  });
}

/** One overworld pass as main.ts runs it: RunMapScript on a standing pass, then the pass. */
function pass(deps: OverworldDeps, ow: OverworldState): OverworldAction | null {
  if (!deps.player.isMoving && !deps.player.isLanding) {
    const action = runMapScript(deps, ow);
    if (action) return action;
  }
  return updateOverworld(deps, ow);
}

/** Passes until an action comes back (or `limit` passes). */
function untilAction(deps: OverworldDeps, ow: OverworldState, limit = 60): { action: OverworldAction | null; passes: number } {
  for (let i = 1; i <= limit; i++) {
    const action = pass(deps, ow);
    if (action) return { action, passes: i };
  }
  return { action: null, passes: limit };
}

const hold = (dir: Direction | null): void => {
  vi.mocked(isHeld).mockImplementation(b => b === dir);
};

describe('the pop-in quirk at the window edge (youngster5: (13,17), facing right, sight 4)', () => {
  it('walking left from (18,17) without stopping: spotted at (16,17), 3 away, 2 steps', () => {
    const deps = forest(18, 17);
    const y5 = trainer('youngster5', 13, 17, 'right', 4);
    deps.npcs.push(y5);
    const ow = createOverworldState();
    for (let i = 0; i < 3; i++) expect(pass(deps, ow)).toBeNull(); // 5 left: off the window
    hold('left');
    const { action } = untilAction(deps, ow);
    expect(deps.player.mapStepX).toBe(16);
    expect(action).toEqual({ type: 'trainerEngage', npc: y5, steps: 2, facing: 'right' });
  });

  it('one step to (17,17), then letting go: spotted a pass later, 4 away, 3 steps', () => {
    const deps = forest(18, 17);
    deps.npcs.push(trainer('youngster5', 13, 17, 'right', 4));
    const ow = createOverworldState();
    pass(deps, ow);
    hold('left');
    for (let i = 0; i < 9; i++) expect(pass(deps, ow)).toBeNull(); // a turn, then the step
    expect(deps.player.mapStepX).toBe(17);
    hold(null);
    expect(pass(deps, ow)).toBeNull(); // the latch: still $ff at this check; refreshed after
    const action = pass(deps, ow);
    expect(action).toMatchObject({ type: 'trainerEngage', steps: 3 });
    expect(deps.player.mapStepX).toBe(17);
  });

  it('entering the line from (17,16): the trainer is already visible, spotted on arrival', () => {
    const deps = forest(17, 16);
    deps.npcs.push(trainer('youngster5', 13, 17, 'right', 4));
    const ow = createOverworldState();
    pass(deps, ow);
    hold('down');
    const { action } = untilAction(deps, ow);
    expect(deps.player.mapStepY).toBe(17);
    expect(action).toMatchObject({ type: 'trainerEngage', steps: 3 });
  });

  it('a trainer on the right (window edge 5) spots a walking player at its full 4', () => {
    const deps = forest(24, 33);
    deps.npcs.push(trainer('youngster2', 30, 33, 'left', 4));
    const ow = createOverworldState();
    pass(deps, ow);
    hold('right');
    const { action } = untilAction(deps, ow);
    expect(deps.player.mapStepX).toBe(26);
    expect(action).toMatchObject({ type: 'trainerEngage', steps: 3, facing: 'left' });
  });
});

describe('where sight runs (RunMapScript on standing passes)', () => {
  it('never at step end or mid-step: only the next standing pass\'s map script engages', () => {
    const deps = forest(24, 33);
    deps.npcs.push(trainer('youngster2', 30, 33, 'left', 4));
    const ow = createOverworldState();
    pass(deps, ow);
    hold('right');
    for (let i = 0; i < 40; i++) {
      // the pass itself (step end included) never engages
      const moving = deps.player.isMoving;
      if (moving) expect(runMapScript(deps, ow)).toBeNull(); // isBusy
      const a = moving ? updateOverworld(deps, ow) : pass(deps, ow);
      if (a) {
        expect(a.type).toBe('trainerEngage');
        expect(moving).toBe(false);
        return;
      }
    }
    throw new Error('never spotted');
  });

  it('not on a map\'s first pass: new sprites start with image $ff', () => {
    const deps = forest(16, 17);
    deps.npcs.push(trainer('youngster5', 13, 17, 'right', 4));
    const ow = createOverworldState();
    expect(runMapScript(deps, ow)).toBeNull();
    updateOverworld(deps, ow); // its UpdateSprites refreshes the image
    expect(runMapScript(deps, ow)).toMatchObject({ type: 'trainerEngage', steps: 2 });
  });

  it('after a battle, EnterMap\'s UpdateSprites shows a just-entered trainer for the first pass', () => {
    // Stepped from (18,17) to (17,17) and a wild battle started at that step end: the
    // trainer is still latched. EnterMap's UpdateSprites (main.ts enterMapAfterBattle)
    // refreshes it, so the first pass back engages.
    const deps = forest(18, 17);
    deps.npcs.push(trainer('youngster5', 13, 17, 'right', 4));
    const ow = createOverworldState();
    pass(deps, ow);
    deps.player.setTilePosition(34, 34); // now (17,17), image still $ff
    expect(runMapScript(deps, ow)).toBeNull();
    updateSprites(deps.npcs, deps.gameMap, deps.player, deps.pikachuFollower);
    expect(runMapScript(deps, ow)).toMatchObject({ type: 'trainerEngage', steps: 3 });
  });

  it('beaten trainers and sight 0 never engage; header (slot) order picks the first', () => {
    const deps = forest(16, 17);
    const beaten = trainer('a', 14, 17, 'right', 4, { defeated: true });
    const lass = trainer('b', 15, 17, 'right', 0);
    const first = trainer('c', 16, 19, 'up', 4);
    const second = trainer('d', 13, 17, 'right', 4);
    deps.npcs.push(beaten, lass, first, second);
    const ow = createOverworldState();
    updateOverworld(deps, ow);
    expect(runMapScript(deps, ow)).toMatchObject({ type: 'trainerEngage', npc: first, steps: 1, facing: 'up' });
  });

  it('only on maps whose script is the trainer trio', () => {
    const deps = forest(16, 17);
    deps.currentMapName = 'Route2';
    deps.npcs.push(trainer('youngster5', 13, 17, 'right', 4));
    const ow = createOverworldState();
    updateOverworld(deps, ow);
    expect(runMapScript(deps, ow)).toBeNull();
  });
});

describe('the trainer script: CheckFightingMapTrainers → DisplayEnemyTrainerTextAndStartBattle → EndTrainerBattle', () => {
  /** Spotted by youngster5 at 3 (2 steps), with the trainer's movement status set first. */
  function spotted(status: 'resting' | 'readyAfterBubble'): { deps: OverworldDeps; ow: OverworldState; y5: Npc; engage: { npc: Npc; steps: number; facing: Direction } } {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const deps = forest(16, 17);
    const y5 = trainer('youngster5', 13, 17, 'right', 4);
    deps.npcs.push(y5);
    const ow = createOverworldState();
    updateOverworld(deps, ow);
    const action = runMapScript(deps, ow);
    expect(action?.type).toBe('trainerEngage');
    const walk = y5.movement as NpcWalk;
    walk.status = 'resting';
    // EmotionBubble's UpdateSprites is the trainer's last ordinary update before MoveSprite_
    walk.delay = status === 'resting' ? 100 : 1;
    const a = action as Extract<OverworldAction, { type: 'trainerEngage' }>;
    return { deps, ow, y5, engage: { npc: a.npc, steps: a.steps, facing: a.facing } };
  }

  /** The end of the bubble: its UpdateSprites and the walk-up, then the rest of the pass. */
  function bubbleEnds(s: ReturnType<typeof spotted>): void {
    finishTrainerEngage(s.deps, s.engage);
    expect(updateOverworld(s.deps, s.ow)).toBeNull();
  }

  it('spotting: BIT_SEEN_BY_TRAINER, the script at 1; the walk masks every button', () => {
    const s = spotted('resting');
    expect(s.ow.seenByTrainer).toBe(true);
    expect(s.ow.engagedNpc).toBe(s.y5);
    expect(getMapScript(FOREST)).toBe(TRAINER_SCRIPT.START_BATTLE);
    expect(joyIgnore()).toBe('none'); // set after the bubble
    finishTrainerEngage(s.deps, s.engage);
    expect(joyIgnore()).toBe('all');
    expect(s.y5.movement.scripted).toBe(true);
  });

  it('a resting trainer: lead-in, two steps of 17 passes, the terminator, then the text (T+133)', () => {
    const s = spotted('resting');
    bubbleEnds(s); // T+61: both UpdateSprites; the second is the lead-in
    expect(s.y5.x).toBe(13 * 16);
    const { action, passes } = untilAction(s.deps, s.ow);
    // passes at T+63, T+65, …: the text comes on pass 36 → T+61 + 2 × 36 = T+133
    expect(passes).toBe(36);
    expect(action).toEqual({ type: 'trainerText', npc: s.y5 });
    expect(s.y5.mapStepX).toBe(15); // next to the player at (16,17)
    expect(s.y5.direction).toBe('right');
    expect(getMapScript(FOREST)).toBe(TRAINER_SCRIPT.END_BATTLE);
    expect(joyIgnore()).toBe('none');
  });

  it('a trainer ready at MoveSprite_ starts at once: the text one pass earlier (T+131)', () => {
    const s = spotted('readyAfterBubble');
    bubbleEnds(s);
    const { action, passes } = untilAction(s.deps, s.ow);
    expect(passes).toBe(35);
    expect(action?.type).toBe('trainerText');
  });

  it('adjacent (youngster4: sight 1): no walk, only the d-pad masked, the text next pass', () => {
    const deps = forest(1, 18);
    const y4 = trainer('youngster4', 2, 18, 'left', 1);
    deps.npcs.push(y4);
    const ow = createOverworldState();
    updateOverworld(deps, ow);
    const a = runMapScript(deps, ow) as Extract<OverworldAction, { type: 'trainerEngage' }>;
    expect(a).toMatchObject({ type: 'trainerEngage', steps: 0 });
    finishTrainerEngage(deps, a);
    expect(joyIgnore()).toBe('dpad');
    expect(y4.movement.scripted).toBe(false);
    updateOverworld(deps, ow);
    expect(runMapScript(deps, ow)).toEqual({ type: 'trainerText', npc: y4 });
  });

  it('EndTrainerBattle takes the first pass after the battle; the next trainer looks on the second', () => {
    const s = spotted('resting');
    bubbleEnds(s);
    untilAction(s.deps, s.ow); // → the text, then the battle
    s.y5.data.defeated = true; // the battle-finish handler
    const other = trainer('youngster9', 16, 19, 'up', 4);
    s.deps.npcs.push(other);
    updateSprites(s.deps.npcs, s.deps.gameMap, s.deps.player, s.deps.pikachuFollower); // EnterMap's
    expect(runMapScript(s.deps, s.ow)).toBeNull(); // EndTrainerBattle
    expect(s.ow.seenByTrainer).toBe(false);
    expect(getMapScript(FOREST)).toBe(TRAINER_SCRIPT.DEFAULT);
    updateOverworld(s.deps, s.ow);
    expect(runMapScript(s.deps, s.ow)).toMatchObject({ type: 'trainerEngage', npc: other });
  });

  it('talking to an unbeaten trainer also leaves the script at 2 (TalkToTrainer)', () => {
    const deps = forest(2, 17, 'down');
    const y4 = trainer('youngster4', 2, 18, 'left', 1);
    deps.npcs.push(y4);
    vi.mocked(isPassPressed).mockImplementation(b => b === 'a');
    expect(updateOverworld(deps, createOverworldState())).toEqual({ type: 'talkToTrainer', npc: y4 });
    expect(getMapScript(FOREST)).toBe(TRAINER_SCRIPT.END_BATTLE);
  });

  it('a loss resets everything (AllPokemonFainted runs EndTrainerBattle before the blackout)', () => {
    const s = spotted('resting');
    finishTrainerEngage(s.deps, s.engage);
    endTrainerBattle(FOREST, s.ow);
    expect(getMapScript(FOREST)).toBe(TRAINER_SCRIPT.DEFAULT);
    expect(s.ow.seenByTrainer).toBe(false);
    expect(s.ow.engagedNpc).toBeNull();
    expect(joyIgnore()).toBe('none');
  });
});

describe('during the walk-up', () => {
  it('the trainer walks through Pikachu (scripted steps skip CanWalkOntoTile)', () => {
    const deps = forest(16, 17, 'right');
    const y5 = trainer('youngster5', 13, 17, 'right', 4);
    deps.npcs.push(y5);
    const pika = deps.pikachuFollower;
    pika.visible = true;
    pika.spawn(deps.player.x, deps.player.y, 'right'); // behind the player: (15,17)
    expect(pika.tileX).toBe(30);
    const ow = createOverworldState();
    updateOverworld(deps, ow);
    const a = runMapScript(deps, ow) as Extract<OverworldAction, { type: 'trainerEngage' }>;
    finishTrainerEngage(deps, a);
    updateOverworld(deps, ow);
    expect(untilAction(deps, ow).action?.type).toBe('trainerText');
    expect(y5.mapStepX).toBe(15);
  });

  it('another NPC keeps moving', () => {
    const deps = forest(16, 17);
    const y5 = trainer('youngster5', 13, 17, 'right', 4);
    const walker = new Npc({ id: 'w', sprite: 'youngster', x: 18, y: 15, movement: 'stay', dialogue: '' });
    deps.npcs.push(y5, walker);
    const ow = createOverworldState();
    updateOverworld(deps, ow);
    const a = runMapScript(deps, ow) as Extract<OverworldAction, { type: 'trainerEngage' }>;
    finishTrainerEngage(deps, a);
    walker.startScriptedMove(['up']);
    for (let i = 0; i < 20; i++) pass(deps, ow);
    expect(walker.mapStepY).toBe(14);
  });
});

describe('BIT_SEEN_BY_TRAINER with an adjacent trainer (only the d-pad is masked)', () => {
  function adjacent(): { deps: OverworldDeps; ow: OverworldState; y4: Npc } {
    const deps = forest(1, 18, 'down');
    const y4 = trainer('youngster4', 2, 18, 'left', 1);
    deps.npcs.push(y4);
    const ow = createOverworldState();
    updateOverworld(deps, ow);
    const a = runMapScript(deps, ow) as Extract<OverworldAction, { type: 'trainerEngage' }>;
    finishTrainerEngage(deps, a);
    vi.mocked(isPassPressed).mockImplementation(b => b === 'a');
    return { deps, ow, y4 };
  }

  it('A at a sign: .displayDialogue runs UpdateSprites, then the bit stops it', () => {
    const { deps, ow } = adjacent();
    vi.mocked(deps.gameMap.getSignAt).mockReturnValue('TRAINER TIPS');
    const spy = vi.spyOn(deps.pikachuFollower, 'updateSprite');
    deps.pikachuFollower.visible = true;
    expect(updateOverworld(deps, ow)).toBeNull();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('A at a sprite: nothing opens', () => {
    const { deps, ow } = adjacent();
    deps.npcs.push(new Npc({ id: 'kid', sprite: 'youngster', x: 1, y: 19, movement: 'stay', dialogue: 'hi' }));
    expect(updateOverworld(deps, ow)).toBeNull();
  });

  it('A at a hidden item: found before the gate, so it runs', () => {
    const { deps, ow } = adjacent();
    vi.mocked(deps.gameMap.getHiddenEventAt).mockReturnValue({ x: 1, y: 19, item: 'POTION', flag: 'HIDDEN_X' } as never);
    expect(updateOverworld(deps, ow)?.type).toBe('script');
  });

  it('START runs only the UpdateSprites (seenStartPressed)', () => {
    const { deps } = adjacent();
    const spy = vi.spyOn(deps.pikachuFollower, 'updateSprite');
    deps.pikachuFollower.visible = true;
    seenStartPressed(deps);
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('EmotionBubble', () => {
  it('holds 61 frames over its sprite, then ends once', () => {
    const b = new EmotionBubble();
    const npc = trainer('t', 1, 1, 'down', 1);
    expect(b.tick()).toBe(false);
    b.start(npc);
    let frames = 0;
    while (!b.tick()) {
      frames++;
      expect(b.showing).toBe(npc);
    }
    expect(frames + 1).toBe(EMOTION_BUBBLE_FRAMES);
    expect(b.showing).toBeNull();
    expect(b.tick()).toBe(false);
  });
});
