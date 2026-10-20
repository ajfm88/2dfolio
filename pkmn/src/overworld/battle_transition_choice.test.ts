import { beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BattleTransitionData } from '../rom/extractors/battle_transitions';
import { battleTransitionLevels, battleTransitionOamSlots, battleTransitionSurvivors,
  chooseBattleTransition, getBattleTransitionData, isDungeonMap, loadBattleTransitionData,
  oakPikachuLeadLevel, rivalNameProbeBytes } from './battle_transition_choice';
import type { TransitionSpriteSlot } from './battle_transition_choice';

const file: BattleTransitionData = JSON.parse(readFileSync(resolve(__dirname, '../../data/battle_transitions.json'), 'utf8'));
beforeAll(async () => { await loadBattleTransitionData(); });

it('loads only the new file through fetch and reports missing assets', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await loadBattleTransitionData();
  expect(fetcher).toHaveBeenCalledWith('battle_transitions.json');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(getBattleTransitionData()).toEqual(file);
  fetcher.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
  await expect(loadBattleTransitionData()).rejects.toThrow('HTTP 404');
  fetcher.mockRestore();
});

it.each([
  [false, 7, 5, 12, 0, 'doubleCircle', 1], [true, 7, 5, 40, 1, 'spiral', 1],
  [false, 8, 5, 33, 2, 'circle', 0], [true, 8, 5, 40, 3, 'spiral', 0],
  [false, 7, 5, 51, 4, 'horizontalStripes', 1], [true, 7, 5, 51, 5, 'shrink', 1],
  [false, 8, 5, 51, 6, 'verticalStripes', 0], [true, 8, 5, 51, 7, 'split', 0],
] as const)('choice trainer=%s enemy=%i lead=%i map=%i -> %i %s', (opponentIsTrainer, enemyLevel, leadLevel, mapId, id, kind, spiralDirection) => {
  expect(chooseBattleTransition({ opponentIsTrainer, enemyLevel, leadLevel, mapId }))
    .toEqual({ id, kind, spiralDirection });
});

it.each([0, 1, 251, 252, 253, 254, 255])('compares lead %i + 3 as an 8-bit addition', level => {
  const threshold = (level + 3) & 255;
  expect(chooseBattleTransition({ opponentIsTrainer: true, enemyLevel: threshold, leadLevel: level, mapId: 40 }).id).toBe(3);
  if (threshold > 0) expect(chooseBattleTransition({ opponentIsTrainer: true, enemyLevel: threshold - 1, leadLevel: level, mapId: 40 }).id).toBe(1);
});

it('keeps every inclusive dungeon boundary, and the cartridge missing-maps bug', () => {
  const independentDungeonIds = new Set([51, 82, 192, 232]);
  for (const [start, end] of [[59, 61], [95, 118], [141, 151], [207, 228]])
    for (let id = start; id <= end; id++) independentDungeonIds.add(id);
  for (let id = 0; id < 256; id++) expect(isDungeonMap(id, file), `map ${id}`).toBe(independentDungeonIds.has(id));
  expect(Object.keys(file.mapIds).filter(name => isDungeonMap(file.mapIds[name], file))).toEqual(['ViridianForest']);
  // Diglett's Cave, Power Plant, Seafoam B1F and Silph 9F are deliberately missed.
  for (const id of [197, 83, 159, 233]) expect(isDungeonMap(id, file)).toBe(false);
});

it('uses the first living lead and LAST trainer member, with no level sorting', () => {
  const levels = battleTransitionLevels([{ currentHp: 0, level: 80 }, { currentHp: 1, level: 5 },
    { currentHp: 30, level: 99 }], [{ level: 100 }, { level: 7 }], { player: 'YELLOW', rival: 'BLUE' });
  expect(levels).toEqual({ leadLevel: 5, enemyLevel: 7 });
  expect(chooseBattleTransition({ ...levels, opponentIsTrainer: true, mapId: 51 }).kind).toBe('shrink');
  expect(battleTransitionLevels([{ currentHp: 1, level: 2 }], 5, { player: 'ASH', rival: 'GARY' }))
    .toEqual({ leadLevel: 2, enemyLevel: 5 });
  expect(() => battleTransitionLevels([], [], { player: '', rival: '' })).toThrow('empty trainer party');
  expect(() => battleTransitionLevels([{ currentHp: 0, level: 5 }], 5, { player: '', rival: '' })).toThrow('living party');
});

it.each([
  ['YELLOW', 'BLUE', [128, 145], 12], ['ASH', 'GARY', [142, 135], 12], ['JACK', 'JOHN', [17, 70], 12],
  ['YELLOW', 'Ab', [0, 0], 0], ['Ab', 'Ab', [0, 0], 0],
  ['ABCDEFG', 'Ab', [134, 80], 12], ['ABCDEF', 'Ab', [80, 0], 12],
  ['ABCDE', 'Ab', [0, 0], 0], ['YELLOW', 'Abcdef', [80, 0], 12],
  ['YELLOW', 'Abcdefg', [166, 80], 12], ['abcdefg', 'ABC', [166, 80], 12],
  ['12345!?', 'A', [230, 80], 12], ['abcdef ', 'A', [127, 80], 12],
] as const)('Oak empty-party probe player=%s rival=%s', (player, rival, bytes, leadLevel) => {
  expect(rivalNameProbeBytes(player, rival)).toEqual(bytes);
  expect(oakPikachuLeadLevel(player, rival)).toBe(leadLevel);
  const levels = battleTransitionLevels([], 5, { player, rival });
  expect(chooseBattleTransition({ ...levels, opponentIsTrainer: false, mapId: 0 }).kind)
    .toBe(leadLevel === 0 ? 'circle' : 'doubleCircle');
});

const slot = (index: number, visible = true, occupied = true): TransitionSpriteSlot => ({ slot: index, visible, occupied });
it('wild steps clear blocks 1–9; scripted wild battles keep Oak or the old man by rank', () => {
  const pallet = [slot(0), slot(1), slot(2, false), slot(3), slot(15)];
  expect(battleTransitionSurvivors(pallet, 0)).toEqual([0]);
  expect(battleTransitionSurvivors(pallet, 1)).toEqual([0, 1]);
  const city = Array.from({ length: 9 }, (_, index) => slot(index, [0, 4, 8].includes(index)));
  expect(battleTransitionSurvivors([...city, slot(15)], 8)).toEqual([0, 2]);
  expect(battleTransitionOamSlots([...city, slot(15)])).toEqual([0, 4, 8, 15]);
});

it('counts hidden, unused and unavailable target slots as the ASM does, rather than picking the target identity', () => {
  const table = [slot(0), slot(1, false), slot(2, true, false), slot(3, false), slot(4), slot(15)];
  expect(battleTransitionSurvivors(table, 3)).toEqual([0, 2]); // slot 2 has IMAGEINDEX 0 despite no picture
  expect(battleTransitionOamSlots(table)).toEqual([0, 4, 15]);
  expect(battleTransitionSurvivors([slot(0), slot(1, false), slot(2)], 1)).toEqual([0, 1]);
  expect(battleTransitionSurvivors([slot(0), slot(2)], 2)).toEqual([0, 2]); // absent slot 1 is zero-filled
});

it('caps shadow OAM at ten blocks, includes Pikachu last, and uses a byte register', () => {
  const table = Array.from({ length: 16 }, (_, i) => slot(i));
  expect(battleTransitionOamSlots([...table].reverse())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(battleTransitionSurvivors(table, 9)).toEqual([0, 9]);
  expect(battleTransitionSurvivors(table, 10)).toEqual([0]);
  expect(battleTransitionSurvivors(table, 15)).toEqual([0]);
  expect(battleTransitionSurvivors(table, 256)).toEqual([0]);
  expect(battleTransitionOamSlots([slot(15), slot(2), slot(0), slot(1, false)])).toEqual([0, 2, 15]);
});
