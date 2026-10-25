// Unused turn ports. pret e89ead15 core.asm:5167–5182,6142–6173.
import { EFFECT_NAMES, TYPE_NAMES } from '../rom/constants';
import { getAllLoadedMoveIds, getMove, loadBattleData } from './data';
import { incrementMovePP } from './battle_loaders';
import { A, charmapByte, encodeText, NAME_BUFFER_LENGTH, STRUGGLE, type BattleState } from './battle_state';

/** Outside the legal-state boundary ruled in note 68 §11.15 answer 3; never a cartridge miss. */
export class BattleUnsupportedState extends Error {
  constructor(message: string) { super(message); this.name = 'BattleUnsupportedState'; }
}

interface MoveRecord { bytes: readonly number[]; nameOffset: number }
const records = new Map<number, MoveRecord>();
let nameBytes: number[] = [];
const nameGlyphs = new Map<number, string>();

/** Explicit startup for the unused port; uses the loaded move cache and committed display names. */
export async function loadBattleMoveData(): Promise<void> {
  await loadBattleData();
  const response = await fetch('move_names.json');
  if (!response.ok) throw new Error(`move names: HTTP ${response.status}`);
  const names = await response.json() as Record<string, string>;
  nameBytes = []; records.clear(); nameGlyphs.clear();
  const keys = getAllLoadedMoveIds().sort((a, b) => getMove(a)!.id - getMove(b)!.id);
  for (const key of keys) {
    const move = getMove(key)!;
    const name = names[key];
    for (const glyph of name) nameGlyphs.set(charmapByte(glyph), glyph);
    const type = Number(Object.keys(TYPE_NAMES).find(byte => TYPE_NAMES[Number(byte)] === move.type));
    records.set(move.id, { nameOffset: nameBytes.length,
      // data/moves/moves.asm:1–9: accuracy uses the percent macro (floor, not round).
      bytes: [move.id, EFFECT_NAMES.indexOf(move.effect), move.power, type, Math.floor(move.accuracy * 255 / 100), move.pp] });
    nameBytes.push(...encodeText(`${name}@`));
  }
}

function record(moveId: number): MoveRecord {
  if (!Number.isInteger(moveId) || moveId < 1 || moveId > STRUGGLE) {
    throw new BattleUnsupportedState(`unsupported move id ${moveId}`);
  }
  const move = records.get(moveId);
  if (!move) throw new Error('battle move data not loaded');
  return move;
}

/** Raw six-byte Moves record, shared by the unused LearnMove FarCopyData path. */
export function getMoveRecord(moveId: number): readonly number[] { return record(moveId).bytes; }

function moveAddress(state: BattleState): number {
  return state.hWhoseTurn === 0 ? A.wPlayerMoveNum : A.wEnemyMoveNum;
}

/** home/names.asm:129–141, names2.asm:11–103; copy_string.asm:2–14. */
function loadMoveNameBuffer(state: BattleState, moveId: number, move: MoveRecord): void {
  state.wNameListType = 2; state.wNameListIndex = moveId; state.wPredefBank = 0x2f;
  state.wNamedObjectIndex = moveId; // GetName's write, also the MoveGrammar cell.
  // GetName copies 20 bytes, including following names. The Move Names section's tail is zero-filled.
  state.setBytes(A.wNameBuffer, nameBytes.slice(move.nameOffset, move.nameOffset + NAME_BUFFER_LENGTH), NAME_BUFFER_LENGTH);
}

/** CopyToStringBuffer (home/copy_string.asm:2–14), separate from GetMoveName. */
export function copyMoveNameToStringBuffer(state: BattleState): void {
  for (let i = 0; i < NAME_BUFFER_LENGTH; i++) {
    const byte = state.mem[A.wNameBuffer + i];
    state.mem[A.wStringBuffer + i] = byte;
    if (byte === 0x50) break; // CopyString stops after @; leave the rest of the destination alone.
  }
}

function copyMoveName(state: BattleState, moveId: number, move: MoveRecord): void {
  loadMoveNameBuffer(state, moveId, move); copyMoveNameToStringBuffer(state);
}

/** home/names.asm:129–141. GetMoveName alone does not call CopyToStringBuffer. */
export function getMoveName(state: BattleState): void {
  const id = state.wNamedObjectIndex;
  loadMoveNameBuffer(state, id, record(id));
}

/** GetName's MOVE_NAME entry: caller supplies list index/type/bank, rather than NamedObjectIndex. */
export function getName(state: BattleState): void {
  const id = state.wNameListIndex;
  loadMoveNameBuffer(state, id, record(id));
}

/** core.asm:6142–6173. Debug/test-battle override deliberately excluded (§11.15). No PP write. */
export function getCurrentMove(state: BattleState): void {
  const id = state.hWhoseTurn === 0 ? state.wPlayerSelectedMove : state.wEnemySelectedMove;
  const move = record(id);
  state.wNameListIndex = id;
  state.setBytes(moveAddress(state), move.bytes, 6);
  copyMoveName(state, id, move);
}

/** core.asm:5167–5182. Caller supplies selected ID; selected/UsedMove bytes stay caller-owned. Returns NZ. */
export function reloadMoveData(state: BattleState, moveId: number): void {
  const move = record(moveId);
  state.wNamedObjectIndex = moveId;
  state.setBytes(moveAddress(state), move.bytes, 6);
  incrementMovePP(state); // Original slot, both copies, including transformed; no second PP implementation.
  copyMoveName(state, moveId, move);
}

/** Live binding for TX_RAM wStringBuffer. Glyphs are the committed MoveNames alphabet. */
export function moveNameBinding(state: BattleState, address: number = A.wStringBuffer): string {
  let name = '';
  for (let i = 0; i < NAME_BUFFER_LENGTH; i++) {
    const byte = state.mem[address + i];
    if (byte === 0x50) break;
    const glyph = nameGlyphs.get(byte);
    if (glyph === undefined) throw new BattleUnsupportedState(`unsupported move-name byte ${byte}`);
    name += glyph;
  }
  return name;
}
