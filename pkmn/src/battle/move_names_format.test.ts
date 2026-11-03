import { afterEach, beforeAll, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { battleLedger } from '../test/battle_ledger_rig';
import { A, BattleState, battleContext, encodeText } from './battle_state';
import { D } from './battle_end_state';
import { loadBattleMoveData, moveMenuNameSource } from './battle_move_data';
import { loadBattleData, getAllLoadedMoveIds, getMove } from './data';
import { battleGlyphTile } from './battle_screen';
import { formatMovesString } from './move_selection_menu';
import { decodeBattleText } from './battle_text_codec';
beforeAll(async () => { await loadBattleData(); await loadBattleMoveData(); });
afterEach(() => vi.restoreAllMocks());

it('all 165 committed MoveNames render, and the ledger host returns those same names', () => {
  const names = JSON.parse(readFileSync('data/move_names.json', 'utf8')) as Record<string, string>;
  expect(Object.keys(names)).toHaveLength(165);
  const rig = battleLedger();
  try {
    expect(getAllLoadedMoveIds()).toHaveLength(165);
    for (const key of getAllLoadedMoveIds()) {
      const name = names[key];
      expect(() => [...name].forEach(glyph => battleGlyphTile(glyph)), key).not.toThrow();
      expect(rig.host.getMove(getMove(key)!.id).name, key).toBe(name);
    }
  } finally { rig.dispose(); }
});

it('FormatMovesString runs GetName for each move and writes its exact WRAM cells without frames', () => {
  const state = new BattleState(), types: number[] = [];
  const type = Object.getOwnPropertyDescriptor(state, 'wNameListType')!;
  Object.defineProperty(state, 'wNameListType', { ...type, set(value: number) { types.push(value); type.set!.call(state, value); } });
  state.mem.fill(0xcc, D.wMovesString, D.wMovesString + 64);
  const ctx = battleContext(state);
  const result = formatMovesString(ctx, [84, 21, 98, 86], moveMenuNameSource(state));
  expect(result).toBeUndefined(); // CPU-only routine: no yielded frame.
  expect(state.wNameListIndex).toBe(86);
  expect(state.wNameListType).toBe(2); expect(state.wPredefBank).toBe(0x2f);
  // Observe caller writes as well as the port's final value: GetName itself normalizes type2.
  expect(types).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
  expect(A.wMovesString).toBe(D.wMovesString);
  expect(decodeBattleText(state.mem, A.wNameBuffer, 20)).toBe('THUNDER WAVE');
  expect([...state.mem.slice(A.wNameBuffer, A.wNameBuffer + 13)]).toEqual(encodeText('THUNDER WAVE@'));
  expect(state.wNumMovesMinusOne).toBe(3);
  const bytes = encodeText('THUNDERSHOCK').concat(0x4e, encodeText('SLAM'), 0x4e,
    encodeText('QUICK ATTACK'), 0x4e, encodeText('THUNDER WAVE'), 0x4e, 0x50);
  expect([...state.mem.slice(D.wMovesString, D.wMovesString + bytes.length)]).toEqual(bytes);
  expect(state.mem[D.wMovesString + bytes.length]).toBe(0xcc);
  expect(ctx.movesString).toBe('THUNDERSHOCK<NEXT>SLAM<NEXT>QUICK ATTACK<NEXT>THUNDER WAVE<NEXT>@');
});
