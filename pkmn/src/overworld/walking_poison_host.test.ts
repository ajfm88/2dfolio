// A3 checkpoint-03: live walking poison through the step host and main's frame program.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} }, localStorage: { getItem: () => null } }));
import { BattleState } from '../battle/battle_state';
import { readBattleOutputs, writeBattleInputs } from '../battle/battle_bridge';
import { D } from '../battle/battle_end_state';
import { createPokemon } from '../battle/data';
import { battleWorld } from '../test/battle_world_fixture';
import type { BattlePokemon } from '../battle';
import type { GameButton } from '../core';
import { isCpuFrozen } from '../core/cpu_freeze';
import { getMapScript, setMapScript } from '../events';
import * as audio from '../audio';
import { getPikachuHappiness, getPikachuMood, restorePikachuHappiness } from '../pikachu/pikachu_happiness';
import { dmgShadeMapping } from '../renderer/palette_shades';
import { getActivePalette, getPaletteColors } from '../renderer';
import { handleStepComplete } from './overworld_controller';
import { TRAINER_SCRIPT } from './map_trainers';
import type { TextBox } from '../text/textbox';
import { frameNow, host, loadMainBattleRig, output, resetMainBattleRig, until, world } from '../test/main_battle_rig';
import { pinOverworldRandom } from '../test/overworld_random_pin';
import { loadGame, restoreParty } from '../save';
import { getRepelSteps, setRepelSteps } from './repel';
import { readdirSync } from 'node:fs';
import { joyIgnore } from '../input/joy_ignore';

const live = host as typeof host & {
  readonly walkingPoisonBgp: number | undefined;
  readonly mapName: string;
  readonly textBox: TextBox;
  renderWalkingPoison(): void;
  renderBlackout(): void;
  handleBlackoutWarp(battle?: boolean): void;
  readonly blackout: { frame: number; phase: string; screen: { bgp: number; obp0: number; obp1: number } | null } | null;
  writeSave(): void;
};

beforeAll(() => loadMainBattleRig());
beforeEach(() => { resetMainBattleRig(); pinOverworldRandom(255); setRepelSteps(0); });
afterEach(() => { vi.restoreAllMocks(); });

function mon(id: number, hp: number, nickname?: string, starter = false, poisoned = true): BattlePokemon {
  const pokemon = createPokemon(id, 20, nickname)!;
  pokemon.currentHp = hp;
  pokemon.status = poisoned && hp > 0 ? 'PSN' : null;
  pokemon.otName = starter ? 'ASH' : 'BLUE';
  pokemon.otId = starter ? 0 : 1;
  return pokemon;
}

async function stand(party: BattlePokemon[], map = 'RedsHouse2F', x = 3, y = 3): Promise<void> {
  await world(map, x, y, party);
  host.ow.encounterCooldown = 8;
  host.ow.justWarped = false;
  host.ow.doorExitStep = false;
}

function buttons(extra: () => GameButton[] = () => []): GameButton[] {
  if (host.state === 'walking_poison' && live.textBox.isWaitingForInput && frameNow() % 2 === 0) return ['a'];
  return extra();
}

function walkable(dir: GameButton): boolean {
  const move = dir === 'left' ? -16 : dir === 'right' ? 16 : 0;
  const moveY = dir === 'up' ? -16 : dir === 'down' ? 16 : 0;
  return host.gameMap.isWalkable(
    Math.round((host.player.x + move) / 8), Math.round((host.player.y + moveY) / 8));
}

async function step(preferred?: 'up' | 'down' | 'left' | 'right', finish = true): Promise<void> {
  const open = (['down', 'up', 'left', 'right'] as const).filter(walkable);
  const dir = preferred && open.includes(preferred) ? preferred : open[0];
  if (!dir) throw new Error(`nowhere to walk at ${host.player.tileX},${host.player.tileY}`);
  const done = host.player.stepsCompleted + 1;
  until(() => host.player.stepsCompleted >= done || host.state !== 'overworld', () => [dir], 80);
  if (host.player.stepsCompleted < done && host.state === 'overworld') {
    throw new Error(`no step ${dir} at ${host.player.tileX},${host.player.tileY}`);
  }
  if (finish && host.state === 'walking_poison') until(() => host.state !== 'walking_poison', buttons, 4000);
}

function boxText(): string {
  if (!live.textBox.active) return '';
  return live.textBox.saveScreen().buffer.join('');
}

function pixel(x: number, y: number): number[] {
  const data = output.context.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

describe('walking poison through the live step', () => {
  it('renders FadePal4 through FadePal1 with separate BG and OBJ registers', async () => {
    await stand([mon(19, 10, undefined, false, false)]);
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    live.handleBlackoutWarp();
    const triples = [[0xe4, 0xd0, 0xe0], [0xf9, 0xe4, 0xe4], [0xfe, 0xfe, 0xf8], [0xff, 0xff, 0xff]];
    const images: Uint8ClampedArray[] = [];
    for (let frame = 0; frame < 32; frame++) {
      live.renderBlackout();
      const screen = live.blackout!.screen!;
      expect([screen.bgp, screen.obp0, screen.obp1]).toEqual(triples[Math.floor(frame / 8)]);
      if (frame % 8 === 0) images.push(output.context.getImageData(0, 0, 160, 144).data);
      host.gameTick();
    }
    expect(images[0]).not.toEqual(images[1]);
    const last = images[3], black = getPaletteColors(getActivePalette())[3];
    expect([...last.slice(0, 3)]).toEqual(black);
    await live.finishFade();
  });

  it('fades the cleared battle screen through the battle-black palette', async () => {
    await stand([mon(19, 10, undefined, false, false)]);
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    live.handleBlackoutWarp(true);
    live.renderBlackout();
    expect(pixel(20, 20).slice(0, 3)).toEqual(getPaletteColors('PAL_BLACK')[0]);
    for (let frame = 0; frame < 8; frame++) host.gameTick();
    live.renderBlackout();
    expect(pixel(20, 20).slice(0, 3)).toEqual(getPaletteColors('PAL_BLACK')[1]);
    await live.finishFade();
  });

  it('clears the Pikachu collision counter in the shared blackout reset', async () => {
    await stand([mon(19, 10, undefined, false, false)]);
    host.player.direction = 'down';
    until(() => host.player.pikachuCollisionCounter === 8, () => ['left'], 20);
    live.handleBlackoutWarp();
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    await live.finishFade();
    expect(host.player.pikachuCollisionCounter).toBe(0);
  });
  it('suspends the actual step for Repel expiry and resumes without decrementing again', async () => {
    await stand([mon(19, 10, undefined, false, false)]);
    host.ow.encounterCooldown = 0;
    setRepelSteps(1);
    await step(undefined, false);
    expect(host.state).toBe('walking_poison');
    expect(getRepelSteps()).toBe(0);
    until(() => live.textBox.isWaitingForInput, () => [], 400);
    expect(boxText()).toContain("REPEL's effect");
    expect(boxText()).toContain('wore off.');
    until(() => host.state === 'overworld', buttons, 4000);
    expect(getRepelSteps()).toBe(0);
  });
  it('uses the fainted first slot level and allows encounters with an empty party', async () => {
    const fainted = mon(19, 0, undefined, false, false);
    await world('Route1', 5, 5, [fainted, createPokemon(16, 1)!]);
    vi.spyOn(host.gameMap, 'isGrassTile').mockReturnValue(true);
    pinOverworldRandom(0);
    setRepelSteps(4);
    expect(handleStepComplete(host.overworldDeps(), host.ow)?.type).not.toBe('startBattle');
    expect(getRepelSteps()).toBe(3);
    host.playerParty.length = 0;
    expect(handleStepComplete(host.overworldDeps(), host.ow)?.type).toBe('startBattle');
    expect(getRepelSteps()).toBe(2);
  });
  it('damages on counter 0 only, including the wrap from 0 to 255', async () => {
    const pokemon = mon(19, 10);
    await stand([pokemon]);
    host.ow.stepCounter = 4;
    for (const counter of [3, 2, 1]) {
      await step();
      expect(host.state).toBe('overworld');
      expect(host.ow.stepCounter).toBe(counter);
      expect(pokemon.currentHp).toBe(10);
    }
    await step();
    expect(host.ow.stepCounter).toBe(0);
    expect(pokemon.currentHp).toBe(9);
    expect(pokemon.status).toBe('PSN');
    host.ow.stepCounter = 0;
    const before = pokemon.currentHp;
    await step();
    expect(host.ow.stepCounter).toBe(255);
    expect(pokemon.currentHp).toBe(before);
  });

  it('applies walking happiness before the faint, then clip 4 and PSNFNT once', async () => {
    pinOverworldRandom(1);
    restorePikachuHappiness(90, 0x80);
    const starter = mon(25, 1, 'SPARKY', true);
    await stand([starter, mon(16, 20, undefined, false, false)]);
    host.ow.stepCounter = 1;
    const lead: boolean[] = [];
    let closed = -1;
    let firstFreeze = -1;
    until(() => host.state === 'walking_poison', () => [walkable('up') ? 'up' : 'left'], 80);
    expect(starter.currentHp).toBe(0);
    expect(starter.status).toBeNull();
    expect(getPikachuHappiness()).toBe(92);
    expect(getPikachuMood()).toBe(0x80);
    until(() => {
      const frozen = isCpuFrozen();
      if (live.textBox.active && live.textBox.isWaitingForInput) expect(boxText()).toContain('SPARKY');
      if (closed < 0 && !live.textBox.active) closed = frameNow();
      if (closed >= 0 && firstFreeze < 0) {
        lead.push(frozen);
        if (frozen) firstFreeze = frameNow();
      }
      return getPikachuHappiness() === 87;
    }, buttons, 4000);
    expect(lead.slice(0, 3)).toEqual([false, false, false]);
    expect(firstFreeze).toBe(closed + 3);
    expect(getPikachuMood()).toBe(0x62);
    expect(host.playerParty[1].currentHp).toBe(20);
  });

  it('a non-starter Pikachu faints with text only', async () => {
    pinOverworldRandom(254);
    restorePikachuHappiness(90, 0x70);
    const other = mon(25, 1, 'WILD', false);
    await stand([other, mon(16, 20, undefined, false, false)]);
    host.ow.stepCounter = 1;
    until(() => live.textBox.active && live.textBox.isWaitingForInput, () => [walkable('up') ? 'up' : 'left'], 400);
    expect(boxText()).toContain('WILD');
    expect(getPikachuHappiness()).toBe(90);
    expect(getPikachuMood()).toBe(0x71);
    expect(isCpuFrozen()).toBe(false);
    until(() => host.state === 'overworld', buttons, 4000);
    expect(isCpuFrozen()).toBe(false);
    expect(getPikachuHappiness()).toBe(90);
    expect(other.status).toBeNull();
  });

  it('PrintText waits three frames after its box before the first letter', async () => {
    const pokemon = mon(19, 1, 'RAT');
    await stand([pokemon, mon(16, 20, undefined, false, false)]);
    host.ow.stepCounter = 1;
    let gap = 0;
    until(() => {
      if (host.state !== 'walking_poison' || !live.textBox.active) return false;
      if (boxText().includes('R')) return true;
      if (live.textBox.phase === 'printing') gap++;
      return false;
    }, () => [walkable('up') ? 'up' : 'left'], 400);
    expect(gap).toBe(3);
  });

  it('hides a starter that faints from its own faint text onward', async () => {
    const first = mon(19, 1, 'RAT');
    const starter = mon(25, 1, 'PIKA', true);
    const survivor = mon(16, 8, 'BIRD');
    await stand([first, starter, survivor]);
    host.pikachuFollower.visible = true;
    host.ow.stepCounter = 1;
    until(() => live.textBox.active && boxText().includes('RAT'), () => [walkable('up') ? 'up' : 'left'], 400);
    expect(host.pikachuFollower.visible).toBe(true);
    expect(starter.currentHp).toBe(1);
    until(() => starter.currentHp === 0 && live.textBox.active && !boxText().includes('RAT'), buttons, 4000);
    expect(host.pikachuFollower.visible).toBe(false);
    until(() => host.state === 'overworld', buttons, 4000);
    expect(host.pikachuFollower.visible).toBe(false);
    expect(starter.status).toBeNull();
    expect(survivor).toMatchObject({ currentHp: 7, status: 'PSN' });
  });

  it('keeps the later poisoned slot unchanged until the first faint text closes', async () => {
    const first = mon(19, 1, 'RAT');
    const second = mon(25, 5, 'PIKA', true);
    await stand([first, second]);
    host.pikachuFollower.visible = true;
    host.ow.stepCounter = 1;
    until(() => live.textBox.active && live.textBox.isWaitingForInput, () => [walkable('up') ? 'up' : 'left'], 400);
    expect(boxText()).toContain('RAT');
    expect(second.currentHp).toBe(5);
    expect(second.status).toBe('PSN');
    expect(host.pikachuFollower.visible).toBe(true);
    until(() => second.currentHp === 4, buttons, 4000);
    expect(live.textBox.active).toBe(false);
    expect(first.currentHp).toBe(0);
  });

  it('inverts only the BG for five frames, then requests poisoned', async () => {
    const pokemon = mon(19, 8);
    await stand([pokemon, mon(16, 20)]);
    host.ow.stepCounter = 1;
    const play = vi.spyOn(audio, 'playSFX');
    const shots: { bgp: number | undefined; sprite: number[]; map: number[] }[] = [];
    until(() => {
      if (host.state !== 'walking_poison') return play.mock.calls.some(call => call[0] === 'poisoned');
      live.renderWalkingPoison();
      shots.push({ bgp: live.walkingPoisonBgp, sprite: pixel(70, 62), map: pixel(2, 2) });
      return false;
    }, () => [walkable('up') ? 'up' : 'left'], 200);
    expect(shots.map(shot => shot.bgp)).toEqual([0xe4, 0x1b, 0x1b, 0x1b, 0x1b, 0x1b]);
    const normal = shots[0], inverted = shots[1];
    expect(inverted.map).not.toEqual(normal.map);
    expect(inverted.sprite).toEqual(normal.sprite);
    const palette = getPaletteColors(getActivePalette());
    const index = palette.findIndex(colour => colour.every((channel, i) => channel === normal.map[i]));
    expect(palette[dmgShadeMapping(0x1b)[index]]).toEqual(inverted.map.slice(0, 3));
    const sfxAt = play.mock.invocationCallOrder[play.mock.calls.findIndex(call => call[0] === 'poisoned')];
    expect(sfxAt).toBeGreaterThan(0);
    expect(host.state).not.toBe('walking_poison');
  });

  it('blackout text precedes the shared reset and does not run the step warp or end the trainer', async () => {
    host.money = 3000;
    host.ow.seenByTrainer = true;
    setMapScript('ViridianForest', TRAINER_SCRIPT.END_BATTLE);
    const pokemon = mon(19, 1, 'RAT');
    await stand([pokemon], 'RedsHouse1F', 7, 2);
    host.ow.encounterCooldown = 0;
    host.ow.stepCounter = 1;
    pinOverworldRandom(0);
    until(() => live.textBox.active && boxText().includes('RAT'), () => ['up'], 400);
    expect(host.state).toBe('walking_poison');
    expect(live.mapName).toBe('RedsHouse1F');
    expect(host.money).toBe(3000);
    expect(pokemon.currentHp).toBe(0);
    until(() => host.state === 'transition', buttons, 4000);
    expect(boxText()).not.toContain('RAT');
    expect(host.money).toBe(3000);
    expect(pokemon.currentHp).toBe(0);
    expect(pokemon.status).toBeNull();
    expect(host.ow.seenByTrainer).toBe(true);
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    await live.finishFade();
    expect(host.money).toBe(1500);
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
    expect(host.ow.seenByTrainer).toBe(false);
    expect(live.mapName).toBe('PalletTown');
  });

  it('places a healed starter on the special landing and allows the next door check', async () => {
    const starter = mon(25, 1, 'SPARKY', true);
    await stand([starter]);
    host.ow.stepCounter = 1;
    await step(undefined, false);
    until(() => host.state === 'transition', buttons, 4000);
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    await live.finishFade();
    expect(host.pikachuFollower.visible).toBe(true);
    expect([host.pikachuFollower.x, host.pikachuFollower.y]).toEqual([host.player.x, host.player.y]);
    expect(host.ow.justWarped).toBe(false);
    expect(host.ow.pikachuDeferredSpawn).toBe(false);
    until(() => host.state === 'transition', () => ['up'], 100);
    expect(host.ow.standingOnWarp).toBe(false);
  });

  it('an already-fainted party blackouts on a non-damage step with no faint text', async () => {
    host.money = 100;
    const pokemon = mon(19, 0);
    pokemon.status = null;
    await stand([pokemon]);
    host.ow.stepCounter = 2;
    await step(undefined, false);
    expect(host.ow.stepCounter).toBe(1);
    expect(host.state).toBe('walking_poison');
    until(() => boxText().includes('blacked'), buttons, 2000);
    expect(boxText()).not.toContain('fainted!');
    until(() => host.state === 'transition', buttons, 2000);
    expect(host.money).toBe(100);
    expect(pokemon.currentHp).toBe(0);
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    await live.finishFade();
    expect(host.money).toBe(50);
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
  });

  it('still reaches a wild encounter after the poison effect in that pass', async () => {
    pinOverworldRandom(0);
    const pokemon = mon(19, 8);
    await world('Route1', 5, 5, [pokemon, mon(16, 20)]);
    host.ow.encounterCooldown = 0;
    host.ow.justWarped = false;
    host.ow.doorExitStep = false;
    let landing: GameButton | null = null;
    for (let y = 0; y < host.gameMap.height * 4 && !landing; y++) {
      for (let x = 0; x < host.gameMap.width * 4 && !landing; x++) {
        host.player.setTilePosition(x, y);
        if (!host.gameMap.isGrassTile(x, y)) continue;
        const dir = (['down', 'up', 'left', 'right'] as const).find(candidate => {
          const dx = candidate === 'left' ? -2 : candidate === 'right' ? 2 : 0;
          const dy = candidate === 'up' ? -2 : candidate === 'down' ? 2 : 0;
          return host.gameMap.isGrassTile(x + dx, y + dy) && walkable(candidate);
        });
        if (dir) landing = dir;
      }
    }
    if (!landing) throw new Error('no grass step on Route 1');
    host.ow.stepCounter = 1;
    until(() => host.state === 'battle_transition' || host.state === 'battle', () => [landing], 400);
    expect(pokemon.currentHp).toBe(7);
  });

  it('keeps the damaged HP and a cleared faint status in the save', async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
      removeItem: (key: string) => { stored.delete(key); },
    });
    const fainted = mon(19, 1, 'RAT');
    const other = mon(16, 12);
    await stand([fainted, other]);
    host.ow.stepCounter = 1;
    until(() => host.state === 'overworld' && fainted.currentHp === 0, () => host.state === 'walking_poison' ? buttons() : [walkable('up') ? 'up' : 'left'], 4000);
    expect(fainted.status).toBeNull();
    expect(other).toMatchObject({ currentHp: 11, status: 'PSN' });
    live.writeSave();
    const restored = restoreParty(loadGame()!);
    expect(restored[0]).toMatchObject({ currentHp: 0, status: null });
    expect(restored[1]).toMatchObject({ currentHp: 11, status: 'PSN' });
  });

  it('leaves simulated, scripted and ledge steps undamaged', async () => {
    const pokemon = mon(19, 6);
    await stand([pokemon]);
    host.ow.stepCounter = 1;
    expect(handleStepComplete(host.overworldDeps(), host.ow, true)).toBeNull();
    expect(pokemon.currentHp).toBe(6);
    expect(host.ow.stepCounter).toBe(1);
    host.startScript([{ type: 'pushPlayer', direction: 'down' }]);
    until(() => host.state === 'overworld', () => [], 200);
    expect(pokemon.currentHp).toBe(6);
    expect(host.ow.stepCounter).toBe(1);
  });
});

describe('battle-loss blackout uses the same reset and still ends the trainer', () => {
  it('bounds wild-loss map scripts to the six loaded maps with wild data', () => {
    const maps = new Set(readdirSync('data/maps').filter(name => name.endsWith('.json')));
    const wild = readdirSync('data/wild').filter(name => maps.has(name)).sort();
    expect(wild).toEqual(['DiglettsCave.json', 'Route1.json', 'Route2.json', 'Route22.json', 'Route3.json', 'ViridianForest.json']);
  });
  it('a wild loss in Forest runs the sight script and completes its bubble before blackout', async () => {
    const pokemon = mon(19, 0);
    await world('ViridianForest', 27, 33, [pokemon]);
    const state = new BattleState();
    writeBattleInputs(state, battleWorld({ party: host.playerParty, pcBoxes: host.boxes, bag: host.bag.items, money: host.money }));
    state.wBattleResult = 1;
    host.session = { tick() {}, done: true,
      finish: () => ({ outcome: readBattleOutputs(state), exit: 'blackout', blackoutCarry: true }),
    } as unknown as typeof host.session;
    host.gameTick();
    expect(host.state).toBe('emotion_bubble');
    expect(getMapScript('ViridianForest')).toBe(TRAINER_SCRIPT.START_BATTLE);
    expect(host.ow.seenByTrainer).toBe(true);
    for (let frame = 0; frame < 60; frame++) {
      expect(host.state).toBe('emotion_bubble');
      host.gameTick();
    }
    host.gameTick();
    expect(host.state).toBe('transition');
    expect(host.ow.engagedNpc).not.toBeNull();
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    await live.finishFade();
    expect(host.ow.seenByTrainer).toBe(false);
    expect(joyIgnore()).toBe('none');
    expect(getMapScript('ViridianForest')).toBe(TRAINER_SCRIPT.START_BATTLE);
  });
  it('runs the trainer script before fading, then halves money and heals after the audio stops', async () => {
    const pokemon = mon(19, 4);
    await world('ViridianForest', 5, 5, [pokemon]);
    host.money = 2000;
    host.ow.seenByTrainer = true;
    setMapScript('ViridianForest', TRAINER_SCRIPT.END_BATTLE);
    const state = new BattleState();
    writeBattleInputs(state, battleWorld({
      party: host.playerParty, pcBoxes: host.boxes, bag: host.bag.items, money: host.money,
    }));
    state.mem[D.wCanEvolveFlags] = 0;
    state.wBattleResult = 1;
    host.session = {
      tick() {}, done: true,
      finish: () => ({ outcome: readBattleOutputs(state), exit: 'blackout', blackoutCarry: true }),
    } as unknown as typeof host.session;
    host.gameTick();
    expect(pokemon.currentHp).toBe(4);
    expect(pokemon.status).toBe('PSN');
    expect(host.money).toBe(2000);
    expect(host.ow.seenByTrainer).toBe(false);
    expect(host.state).toBe('transition');
    vi.spyOn(audio, 'isAudioFadingOut').mockReturnValue(false);
    await live.finishFade();
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
    expect(pokemon.status).toBeNull();
    expect(host.money).toBe(1000);
  });

  it.each([0, 1, 9, 10])('waits for audio before restoring HP, status and PP and halving $%i', async money => {
    const pokemon = mon(19, 4);
    pokemon.moves[0].pp = 0;
    host.playerParty.push(pokemon);
    host.money = money;
    const state = new BattleState();
    writeBattleInputs(state, battleWorld({ party: host.playerParty, pcBoxes: host.boxes, bag: host.bag.items, money }));
    state.wBattleResult = 1;
    host.session = {
      tick() {}, done: true,
      finish: () => ({ outcome: readBattleOutputs(state), exit: 'blackout', blackoutCarry: true }),
    } as unknown as typeof host.session;
    let fading = true;
    vi.spyOn(audio, 'isAudioFadingOut').mockImplementation(() => fading);
    host.gameTick();
    const transition = live.finishFade();
    await vi.waitFor(() => expect(audio.isAudioFadingOut).toHaveBeenCalled());
    expect(host.money).toBe(money);
    expect(pokemon).toMatchObject({ currentHp: 4, status: 'PSN' });
    expect(pokemon.moves[0].pp).toBe(0);
    fading = false;
    await transition;
    expect(host.money).toBe(Math.floor(money / 2));
    expect(pokemon).toMatchObject({ currentHp: pokemon.maxHp, status: null });
    expect(pokemon.moves[0].pp).toBe(pokemon.moves[0].maxPp);
  });
});
