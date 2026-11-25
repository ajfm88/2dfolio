import { expect, it } from 'vitest';
import { A, BattleState } from './battle_state';
import { calcStats } from './battle_calc_stats';
import { applyBadgeStatBoosts, loadBattleMonFromParty } from './battle_loaders';
import { calculateModifiedStat } from './battle_math';
import { writePartySlot, type PartySlot } from '../test/party_slot_fixture';

// home/move_mon.asm CalcStats; core.asm LoadBattleMonFromParty,
// CalculateModifiedStat and ApplyBadgeStatBoosts. All values are BE words.
it('carries a trained >255 party stat through the battle copy and a stage change', () => {
  const s = new BattleState();
  s.species = () => ({ name: 'RHYDON', base: [105, 130, 120, 40, 45], type1: 5, type2: 5,
    catchRate: 60, baseExp: 204, moves: [1, 0, 0, 0], learnset: [] });
  const party: PartySlot = { species: 1, hp: 300, boxLevel: 100, status: 0x10, type1: 5, type2: 5,
    catchRate: 60, moves: [1, 0, 0, 0], dvs: [0xff, 0xff], pp: [35, 0, 0, 0], level: 100,
    maxHp: 1, attack: 1, defense: 1, speed: 1, special: 1, nickname: 'RHYDON',
    otId: 0, otName: 'RED', exp: 0, statExp: [65535, 65535, 65535, 65535, 65535] };
  writePartySlot(s, 'player', 0, party);
  s.setBytes(A.wMonHBaseStats, [105, 130, 120, 40, 45], 5);
  s.wCurEnemyLevel = 100;
  calcStats(s, 1, A.wPartyMons + 16, A.wPartyMons + 34);
  // Attack = 2*(130+15) + floor(255/4) + 5 = 358.
  expect(s.readBE(A.wPartyMons + 36)).toBe(358);
  s.wObtainedBadges = 1;
  loadBattleMonFromParty(s);
  expect(s.readBE(A.wPlayerMonUnmodifiedLevel + 3)).toBe(358);
  // Burn first: floor(358/2)=179; Boulder adds floor(179/8)=22.
  expect(s.wBattleMonAttack).toBe(201);
  s.mem[A.wPlayerMonStatMods] = 8;
  s.wCalculateWhoseStats = 0;
  calculateModifiedStat(s, 0);
  expect(s.wBattleMonAttack).toBe(537); // 358 * 15 / 10
  applyBadgeStatBoosts(s);
  expect(s.wBattleMonAttack).toBe(604); // 537 + floor(537/8)
  expect(s.readBE(A.wPartyMons + 36)).toBe(358);
});
