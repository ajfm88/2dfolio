// V3 checkpoint-04: Route 3, its finite north boundary and Pewter's east connection.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { MapData } from '../core/types';
import type { Direction } from '../core';
import { host, loadMainBattleRig, resetMainBattleRig, world, tick, until } from '../test/main_battle_rig';
import * as audio from '../audio';
import { getMapPalette } from '../renderer/palettes';
import { getTextProgramData } from '../text/program_data';
import { getActiveScript } from '../script/script_controller';
import { setFlag, hasFlag } from '../events';
import { TRAINER_MAPS } from './map_trainers';
import { trainerEngages } from './trainer_sight';
import { inSpriteWindow } from './sprite_visibility';
import { getTrainerClass } from '../battle';
import { A, PARTYMON_STRUCT_LENGTH, POKEDEX_ORDER } from '../battle/battle_state';
import { D } from '../battle/battle_end_state';
import { W_TRAINER_NO } from '../battle/battle_trainer_party';

const map = (name = 'Route3'): MapData => JSON.parse(readFileSync(`data/maps/${name}.json`, 'utf8'));
const trainers = [
  ['youngster1', 10, 6, 'right', 'BUG_CATCHER', 3, 2],
  ['youngster2', 14, 4, 'down', 'YOUNGSTER', 0, 3],
  ['cooltrainer_f1', 16, 9, 'left', 'LASS', 0, 2],
  ['youngster3', 19, 5, 'down', 'BUG_CATCHER', 4, 1],
  ['cooltrainer_f2', 23, 4, 'left', 'LASS', 1, 4],
  ['youngster4', 22, 9, 'left', 'YOUNGSTER', 1, 3],
  ['youngster5', 24, 6, 'right', 'BUG_CATCHER', 5, 3],
  ['cooltrainer_f3', 33, 10, 'up', 'LASS', 2, 2],
] as const;
// data/trainers/parties.asm: Route 3's actual parties, as [national dex number, level].
const parties: Record<string, readonly (readonly [number, number])[]> = {
  youngster1: [[10, 10], [13, 10], [10, 10]],
  youngster2: [[19, 11], [23, 11]],
  cooltrainer_f1: [[16, 9], [16, 9]],
  youngster3: [[13, 9], [14, 9], [10, 9], [11, 9]],
  cooltrainer_f2: [[19, 10], [32, 10]],
  youngster4: [[21, 14]],
  youngster5: [[10, 11], [11, 11]],
  cooltrainer_f3: [[39, 14]],
};

beforeAll(() => loadMainBattleRig());
beforeEach(() => resetMainBattleRig());
afterEach(() => vi.restoreAllMocks());

describe('Route 3 (V3 checkpoint-04)', () => {
  it('has its cartridge dimensions, border, sign and both Pewter connection offsets', () => {
    const data = map();
    expect([data.width, data.height, data.tileset, data.borderBlock]).toEqual([35, 9, 'OVERWORLD', 0x2c]);
    expect(data.warps).toEqual([]);
    expect(data.signs.map(s => [s.textId, s.x, s.y])).toEqual([[10, 59, 9]]);
    expect(data.connections).toEqual([{ direction: 'west', mapName: 'PewterCity', offset: -4 }]);
    expect(map('PewterCity').connections).toContainEqual({ direction: 'east', mapName: 'Route3', offset: 4 });
  });
  it('keeps all nine objects and all eight trainer headers in cartridge order', () => {
    const data = map();
    expect(data.npcs).toHaveLength(9);
    expect([data.npcs[0].id, data.npcs[0].x, data.npcs[0].y, data.npcs[0].sprite]).toEqual(['super_nerd', 57, 11, 'super_nerd']);
    expect(data.npcs.slice(1).map(n => [n.id, n.x, n.y, n.direction, n.trainerClass, n.trainerParty, n.sightRange])).toEqual(trainers);
    expect(data.npcs.map(n => n.textId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(TRAINER_MAPS.has('Route3')).toBe(true);
    for (const npc of data.npcs.slice(1)) {
      expect(npc.movement).toBe('stay');
      expect(npc.endBattleTextLabels?.win).toBe(npc.endBattleTextLabels?.lose);
      expect(npc.endBattleText).not.toBe(''); expect(npc.afterBattleText).not.toBe('');
    }
  });
  it('extracts every text program, the direct NPC and sign, and eight trainer handlers', () => {
    const file = getTextProgramData(), calls = file.textPointers.Route3_TextPointers;
    expect(calls).toHaveLength(10);
    expect(calls[0]).toEqual({ call: 'text', program: 'Route3SuperNerdText' });
    expect(calls[9]).toEqual({ call: 'text', program: 'Route3SignText' });
    expect(calls.slice(1, 9).map(c => c.call)).toEqual(Array(8).fill('handler'));
    for (const [name] of trainers) {
      const title = name[0].toUpperCase() + name.slice(1).replace(/_f/, 'F');
      for (const suffix of ['Battle', 'EndBattle', 'AfterBattle']) {
        expect(file.programs[`Route3${title}${suffix}Text`]).toBeDefined();
        expect(file.programs[`_Route3${title}${suffix}Text`]).toBeDefined();
      }
    }
    for (const label of ['Route3SuperNerdText', '_Route3Text1', 'Route3SignText', '_Route3SignText']) expect(file.programs[label]).toBeDefined();
  });
  it('loads routes3 music, the route palette, wild data and the safe debug destination', async () => {
    const music = vi.spyOn(audio, 'playDefaultMusicFadeOutCurrent');
    await world('Route3', 4, 9);
    tick(); // The warp's pending map-music request runs after the door sound.
    expect(getMapPalette('Route3')).toBe('ROUTE');
    expect(music.mock.calls.map(c => c[0])).toContain('routes3');
    expect(readFileSync('src/debug.ts', 'utf8')).toContain("map: 'Route3', warpId: 0, stepPos: { x: 4, y: 9 }");
    expect(host.gameMap.isWalkable(8, 18)).toBe(true);
    const wild = JSON.parse(readFileSync('data/wild/Route3.json', 'utf8'));
    expect(wild.grassRate).toBe(20);
  });
  it('omits unextracted Route4 and blocks every north exit with native border tiles', async () => {
    await world('Route3', 59, 1);
    expect(host.gameMap.getConnection('north')).toBeNull();
    for (let x = 0; x < 70; x++) {
      expect(host.gameMap.getTileAt(x * 2, -1)).toBe(0x11);
      expect(host.gameMap.isWalkable(x * 2, -2)).toBe(false);
    }
  });
  it('proves every ledge midpoint candidate is already seen at its source, before input can start a hop', async () => {
    await world('Route3', 4, 9);
    const seen = (x: number, y: number, n: MapData['npcs'][number]): boolean => trainerEngages({
      x: (0x40 + (n.x - x) * 16) & 255, y: (0x3c + (n.y - y) * 16) & 255,
      facing: n.direction as Direction, engageDistance: n.sightRange! * 16,
      onScreen: inSpriteWindow(n.x, n.y, x, y),
    });
    const candidates: unknown[] = []; let hops = 0;
    const deltas = [['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const;
    for (let y = 0; y < 18; y++) for (let x = 0; x < 70; x++) for (const [d, dx, dy] of deltas) {
      if (!host.gameMap.isLedge(x * 2, y * 2, d)) continue;
      hops++;
      for (const n of map().npcs.slice(1)) if (seen(x + dx, y + dy, n)) {
        candidates.push([x, y, d, n.id]);
        expect(seen(x, y, n), `${n.id} at hop (${x},${y})`).toBe(true);
        // The only candidate source is path, so no wild battle can return here with script 2.
        expect(host.gameMap.isGrassTile(x * 2, y * 2)).toBe(false);
        expect(map().npcs.every(other => Math.abs(other.x - x) + Math.abs(other.y - y) !== 1)).toBe(true);
      }
    }
    expect(hops).toBe(36);
    expect(candidates).toEqual([[14, 6, 'down', 'youngster2']]);
  });
  it('the midpoint candidate is engaged through main before held DOWN can start the source hop', async () => {
    await world('Route3', 14, 6);
    host.player.direction = 'down';
    for (let f = 0; f < 8 && host.state === 'overworld'; f++) tick(['down']);
    expect(host.state).toBe('emotion_bubble');
    expect(host.ow.engagedNpc?.data.id).toBe('youngster2');
    expect([host.player.mapStepX, host.player.mapStepY]).toEqual([14, 6]);
    expect(host.player.isBusy).toBe(false);
  });
  it.each(['west', 'east'] as const)('walks the actual %s connection through main, preserving facing and follower', async direction => {
    setFlag('BEAT_BROCK'); // Test-only: checkpoint-05 owns the production setter.
    await world(direction === 'west' ? 'Route3' : 'PewterCity', direction === 'west' ? 0 : 39, direction === 'west' ? 9 : 17);
    host.player.direction = direction === 'west' ? 'left' : 'right';
    const key = host.player.direction;
    for (let f = 0; f < 80 && host.state !== 'transition'; f++) tick([key]);
    for (let n = 0; n < 80 && host.state === 'transition'; n++) await Promise.resolve();
    expect(host.gameMap.mapData?.name).toBe(direction === 'west' ? 'PewterCity' : 'Route3');
    expect([host.player.x, host.player.y]).toEqual(direction === 'west' ? [624, 272] : [0, 144]);
    expect(host.player.direction).toBe(key); expect(host.player.isBusy).toBe(false);
    expect(host.pikachuFollower.visible).toBe(true);
    expect([host.pikachuFollower.x, host.pikachuFollower.y, host.pikachuFollower.direction])
      .toEqual(direction === 'west' ? [640, 272, 'left'] : [-16, 144, 'right']);
    expect([host.pikachuFollower.mapStepX, host.pikachuFollower.mapStepY])
      .toEqual(direction === 'west' ? [40, 17] : [-1, 9]);
    expect(host.overworldDeps().npcs.map(n => n.data.id))
      .toEqual(map(direction === 'west' ? 'PewterCity' : 'Route3').npcs.map(n => n.id));
  });
  it('keeps the pre-Brock east guide active', async () => {
    await world('PewterCity', 35, 17);
    expect(hasFlag('BEAT_BROCK')).toBe(false);
    until(() => host.state === 'script', () => [], 8);
    expect(getActiveScript()?.commands.some(c => c.type === 'printText' && c.program === 'PewterCityYoungsterText.YoureATrainerFollowMeText')).toBe(true);
  });
  it.each(trainers)('starts $0 as its own trainer battle through main', async (id, x, y, direction, trainerClass, party) => {
    const [dx, dy] = direction === 'right' ? [1, 0] : direction === 'left' ? [-1, 0] : direction === 'down' ? [0, 1] : [0, -1];
    await world('Route3', x + dx, y + dy);
    until(() => host.state === 'battle');
    expect(host.overworldDeps().npcs.find(n => n.data.id === id)?.data.trainerParty).toBe(party);
    expect(host.session!.state.mem[0xd058]).toBe(getTrainerClass(trainerClass)!.id + 200);
    const mem = host.session!.state.mem;
    expect(mem[W_TRAINER_NO]).toBe(party + 1);
    expect(Array.from({ length: mem[D.wEnemyPartyCount] }, (_, i) => {
      const base = A.wEnemyMons + i * PARTYMON_STRUCT_LENGTH;
      return [POKEDEX_ORDER[mem[base] - 1], mem[base + 33]];
    })).toEqual(parties[id]);
  });
});
