import { refreshPartyMon } from './battle_party_codec';
import { decodeBattleText } from './battle_text_codec';
// Unused caught-mon homes. pret e89ead15 engine/pokemon/add_mon.asm:1-283,
// engine/menus/naming_screen.asm:1-53, engine/items/item_effects.asm:2931-3113.
// No live caller. The box object mirror waits for A5c3f.
import { I } from './battle_item_state';
import { calcExperience } from './battle_calc_experience';
import { flagAction } from './battle_end_helpers';
import type { BattleItemHost } from './battle_items';
import { getMonHeader, getMonName, writeMonMoves } from './battle_loaders';
import type { Program } from './battle_menu_context';
import type { BattleMenuScreen } from './battle_menu_screen';
import { getMoveRecord, BattleUnsupportedState } from './battle_move_data';
import { displayTwoOptionMenu, type TwoOptionHost } from './battle_two_option';
import { getAllLoadedMoveIds, getMove, getSpeciesById } from './data';
import { createVolatiles } from './volatiles';
import {
  A, indexToPokedex, NAME_LENGTH, NUM_MOVES, NUM_STATS, PARTY_LENGTH, PARTYMON_STRUCT_LENGTH,
  POKEDEX_ORDER, WILD_BATTLE, type BattleState,
} from './battle_state';
import type { BattleMove, BattlePokemon, StatExperience, StatusCondition } from './types';

const NAME_MON_SCREEN = 2;
const KADABRA = 0x26;
const TWISTEDSPOON_GSC = 0x60;
const BOXMON_STRUCT_LENGTH = 0x21;
const TWO_OPTION_MENU = 0x14;
const PAR = 1 << 6;
const FRZ = 1 << 5;
const BRN = 1 << 4;
const PSN = 1 << 3;

export interface CaughtMonEnvironment {
  state: BattleState;
  host: BattleItemHost;
  menu: TwoOptionHost;
  video: BattleMenuScreen;
  /** DisplayNamingScreen hand-off. Species is the internal id; type is wNamingScreenType. */
  displayNamingScreen(species: number, type: number, destination: number): Program;
}

function copy11(state: BattleState, src: number, dest: number): void {
  state.mem.copyWithin(dest, src, src + NAME_LENGTH);
}

/** item_effects.asm:2941-2949. Carry each species byte one place down, including the old $FF. */
function shiftSpeciesList(state: BattleState, list: number, species: number): void {
  let carried = species & 255;
  for (let at = list; ; at++) {
    const next = state.mem[at];
    state.mem[at] = carried;
    carried = next;
    if (state.mem[at] === 0xff) return;
  }
}

/** item_effects.asm:2957-2981. `copies` entries, last first, each moved one slot down. */
function shiftDown(state: BattleState, base: number, stride: number, copies: number): void {
  for (let index = copies - 1; index >= 0; index--) {
    const src = base + index * stride;
    state.mem.copyWithin(src + stride, src, src + stride);
  }
}

function moveName(id: number): string {
  const name = getAllLoadedMoveIds().find(key => getMove(key)?.id === id);
  if (!name) throw new Error(`move ${id}`);
  return name;
}

function statusOf(byte: number): { status: StatusCondition; sleepTurns: number } {
  if (byte & PAR) return { status: 'PAR', sleepTurns: 0 };
  if (byte & FRZ) return { status: 'FRZ', sleepTurns: 0 };
  if (byte & BRN) return { status: 'BRN', sleepTurns: 0 };
  if (byte & PSN) return { status: 'PSN', sleepTurns: 0 };
  if (byte & 7) return { status: 'SLP', sleepTurns: byte & 7 };
  return { status: null, sleepTurns: 0 };
}

/** Pure. Reads the party bytes just written. Draws no Random. Box level stays 0 in the bytes. */
export function battlePokemonFromPartyBytes(state: BattleState, index: number): BattlePokemon {
  const base = A.wPartyMons + index * PARTYMON_STRUCT_LENGTH;
  const internal = state.mem[base];
  const moves: BattleMove[] = [];
  for (let i = 0; i < NUM_MOVES; i++) {
    const id = state.mem[base + 8 + i];
    if (id === 0) continue;
    const pp = state.mem[base + 29 + i];
    moves.push({ id: moveName(id), pp, maxPp: pp });
  }
  const attack = state.readBE(base + 36);
  const defense = state.readBE(base + 38);
  const speed = state.readBE(base + 40);
  const special = state.readBE(base + 42);
  const status = statusOf(state.mem[base + 4]);
  const statExp: StatExperience = [state.readBE(base + 17), state.readBE(base + 19), state.readBE(base + 21),
    state.readBE(base + 23), state.readBE(base + 25)];
  const dex = POKEDEX_ORDER[internal - 1] ?? 0;
  const species = getSpeciesById(dex);
  if (!species) throw new Error(`no species for dex ${dex}`);
  return {
    species,
    nickname: decodeBattleText(state.mem, A.wPartyMonNicks + index * NAME_LENGTH),
    level: state.mem[base + 33],
    currentHp: state.readBE(base + 1),
    maxHp: state.readBE(base + 34),
    attack, defense, speed, special, moves,
    statStages: { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 },
    status: status.status,
    atkDV: state.mem[base + 27] >> 4, defDV: state.mem[base + 27] & 0xf,
    spdDV: state.mem[base + 28] >> 4, spcDV: state.mem[base + 28] & 0xf,
    exp: state.mem[base + 14] * 0x10000 + state.readBE(base + 15),
    statExp, sleepTurns: status.sleepTurns, toxicCounter: 0, badlyPoisoned: false,
    volatiles: createVolatiles(),
    originalStats: { attack, defense, speed, special },
    otName: decodeBattleText(state.mem, A.wPartyMonOT + index * NAME_LENGTH),
    otId: state.readBE(base + 12),
  };
}

/** add_mon.asm:254-282. DE enters on the second DV; the first inc de lands on PP. */
export function writePartyMovePP(state: BattleState, moves: number, secondDv: number): void {
  let de = secondDv;
  for (let i = 0; i < NUM_MOVES; i++) {
    const id = state.mem[moves + i];
    let pp = 0;
    if (id !== 0) {
      state.setBytes(I.wMoveData, getMoveRecord(id), 6);
      pp = state.mem[I.wMoveData + 5];
    }
    state.mem[++de] = pp;
  }
}

/**
 * naming_screen.asm:1-49. HL is `destination`.
 * The YES/NO menu restores its own 5×6 tiles. The NO path does not load Buffer 1,
 * so the wild HUD clear stays. AskName never writes wTwoOptionMenuID.
 */
export function* askName(state: BattleState, env: CaughtMonEnvironment, destination: number): Program {
  env.video.saveScreenTilesToBuffer1();
  if (state.wIsInBattle === WILD_BATTLE) {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 11; x++) env.video.tiles.clear(x, y);
  }
  state.wNamedObjectIndex = state.wCurPartySpecies;
  getMonName(state, state.species(state.wNamedObjectIndex));
  yield* env.host.printText('DoYouWantToNicknameText', { nameBuffer: decodeBattleText(state.mem, A.wNameBuffer) });
  state.mem[I.wTextBoxID] = TWO_OPTION_MENU;
  yield* displayTwoOptionMenu(state, env.menu, 14, 7, 8, 15);
  if (state.wCurrentMenuItem === 0) {
    const sprites = state.mem[I.wUpdateSpritesEnabled];
    state.mem[I.wUpdateSpritesEnabled] = 0;
    state.mem[I.wNamingScreenType] = NAME_MON_SCREEN;
    yield* env.displayNamingScreen(state.wCurPartySpecies, state.mem[I.wNamingScreenType], destination);
    env.video.loadScreenTilesFromBuffer1();
    state.mem[I.wUpdateSpritesEnabled] = sprites;
    if (state.mem[A.wStringBuffer] !== 0x50) return;
  }
  copy11(state, A.wNameBuffer, destination);
}

/**
 * add_mon.asm:1-252. Player, wild-battle branch only (wMonDataLocation 0, wIsInBattle 1).
 * Naming runs before the struct is filled. Carry is set on the success return; the ball ignores it.
 */
export function* addPartyMon(state: BattleState, env: CaughtMonEnvironment): Program<{ carry: boolean }> {
  if ((state.wMonDataLocation & 0xf) !== 0) throw new BattleUnsupportedState('enemy party');
  if (state.wIsInBattle === 0) throw new BattleUnsupportedState('not in battle');
  if (state.wIsInBattle !== WILD_BATTLE) throw new BattleUnsupportedState('trainer battle');
  const count = (state.mem[I.wPartyCount] + 1) & 255;
  if (count > PARTY_LENGTH) return { carry: false };
  state.mem[I.wPartyCount] = count;
  state.mem[I.hNewPartyLength] = count;
  const index = count - 1;
  state.mem[I.wPartyCount + count] = state.wCurPartySpecies;
  state.mem[I.wPartyCount + count + 1] = 0xff;
  copy11(state, A.wPlayerName, A.wPartyMonOT + index * NAME_LENGTH);
  state.mem[I.wNamingScreenType] = NAME_MON_SCREEN;
  yield* askName(state, env, A.wPartyMonNicks + index * NAME_LENGTH);
  state.wCurSpecies = state.wCurPartySpecies;
  getMonHeader(state, state.wCurSpecies);
  const base = A.wPartyMons + index * PARTYMON_STRUCT_LENGTH;
  state.mem[base] = state.mem[A.wMonHIndex];
  state.wPokedexNum = state.wCurPartySpecies;
  indexToPokedex(state);
  const bit = (state.wPokedexNum - 1) & 255;
  state.mem[I.wUnusedAlreadyOwnedFlag] = flagAction(state, I.wPokedexOwned, 2, bit);
  flagAction(state, I.wPokedexOwned, 1, bit);
  flagAction(state, A.wPokedexSeen, 1, bit);
  state.writeBE(base + 1, state.wEnemyMonHP);
  state.mem[base + 3] = 0;
  state.mem[base + 4] = state.wEnemyMonStatus;
  state.mem[base + 5] = state.mem[A.wMonHTypes];
  state.mem[base + 6] = state.mem[A.wMonHTypes + 1];
  state.mem[base + 7] = state.mem[A.wMonHCatchRate];
  if (state.wCurPartySpecies === KADABRA) state.mem[base + 7] = TWISTEDSPOON_GSC;
  state.mem[base + 27] = state.mem[A.wEnemyMonDVs];
  state.mem[base + 28] = state.mem[A.wEnemyMonDVs + 1];
  for (let i = 0; i < NUM_MOVES; i++) state.mem[base + 8 + i] = state.mem[A.wMonHMoves + i];
  state.mem[I.wLearningMovesFromDayCare] = 0;
  writeMonMoves(state, base + 8);
  state.writeBE(base + 12, state.readBE(A.wPlayerID));
  const exp = calcExperience(state, state.wCurEnemyLevel);
  state.mem[base + 14] = (exp >>> 16) & 255;
  state.writeBE(base + 15, exp);
  for (let i = 0; i < NUM_STATS * 2; i++) state.mem[base + 17 + i] = 0;
  writePartyMovePP(state, base + 8, base + 28);
  state.mem[base + 33] = state.wCurEnemyLevel;
  state.mem.copyWithin(base + 34, A.wEnemyMonMaxHP, A.wEnemyMonMaxHP + NUM_STATS * 2);
  refreshPartyMon(state, index);
  return { carry: true };
}

/** item_effects.asm:2931-3113. Front insertion. Bytes only; no pcBoxes mirror. */
export function* sendNewMonToBox(state: BattleState, env: CaughtMonEnvironment): Program {
  const count = (state.mem[I.wBoxCount] + 1) & 255;
  state.mem[I.wBoxCount] = count;
  state.wCurSpecies = state.wCurPartySpecies;
  shiftSpeciesList(state, I.wBoxSpecies, state.wCurPartySpecies);
  getMonHeader(state, state.wCurSpecies);
  const old = count - 1;
  if (old !== 0) shiftDown(state, I.wBoxMonOT, NAME_LENGTH, old);
  copy11(state, A.wPlayerName, I.wBoxMon1OT);
  if (old !== 0) shiftDown(state, I.wBoxMonNicks, NAME_LENGTH, old);
  state.mem[I.wNamingScreenType] = NAME_MON_SCREEN;
  yield* askName(state, env, I.wBoxMon1Nick);
  if (old !== 0) shiftDown(state, I.wBoxMons, BOXMON_STRUCT_LENGTH, old);
  state.mem[I.wEnemyMonBoxLevel] = state.wEnemyMonLevel;
  state.mem.copyWithin(I.wBoxMons, A.wEnemyMonSpecies, A.wEnemyMonDVs);
  const dest = I.wBoxMons + (A.wEnemyMonDVs - A.wEnemyMonSpecies);
  state.mem[dest] = state.mem[A.wPlayerID];
  state.mem[dest + 1] = state.mem[A.wPlayerID + 1];
  const exp = calcExperience(state, state.wCurEnemyLevel);
  state.mem[dest + 2] = (exp >>> 16) & 255;
  state.mem[dest + 3] = (exp >>> 8) & 255;
  state.mem[dest + 4] = exp & 255;
  for (let i = 0; i < NUM_STATS * 2; i++) state.mem[dest + 5 + i] = 0;
  state.mem[dest + 15] = state.mem[A.wEnemyMonDVs];
  state.mem[dest + 16] = state.mem[A.wEnemyMonDVs + 1];
  for (let i = 0; i < NUM_MOVES; i++) state.mem[dest + 17 + i] = state.mem[A.wEnemyMonPP + i];
  if (state.wCurPartySpecies === KADABRA) state.mem[I.wBoxMons + 7] = TWISTEDSPOON_GSC;
}

/** The ball's two storage ports. wMonDataLocation stays whatever the ball wrote. */
export function ballHomes(env: CaughtMonEnvironment): {
  addPartyMon(): Program;
  sendNewMonToBox(): Program;
} {
  return {
    // Program<void> for the ball. The direct addPartyMon still returns carry.
    addPartyMon: function* () { yield* addPartyMon(env.state, env); },
    sendNewMonToBox: () => sendNewMonToBox(env.state, env),
  };
}

/** Bytes of box slot n, plus the parallel species, OT and nickname. No object mirror. */
export function readBoxSlot(state: BattleState, index: number): {
  species: number; bytes: number[]; ot: number[]; nick: number[];
} {
  const base = I.wBoxMons + index * BOXMON_STRUCT_LENGTH;
  const name = index * NAME_LENGTH;
  return {
    species: state.mem[I.wBoxSpecies + index],
    bytes: [...state.mem.subarray(base, base + BOXMON_STRUCT_LENGTH)],
    ot: [...state.mem.subarray(I.wBoxMonOT + name, I.wBoxMonOT + name + NAME_LENGTH)],
    nick: [...state.mem.subarray(I.wBoxMonNicks + name, I.wBoxMonNicks + name + NAME_LENGTH)],
  };
}
