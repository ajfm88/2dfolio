// WRAM-shaped battle state. One cell per address; ASM names are accessors onto that cell.
// Layout: ram/wram.asm, macros/ram.asm, notes/68 aliases.json. pret pin e89ead15.
import { charToTile } from '../text/charmap';
import type { ListEntry } from '../menus/list_menu';
import type { MenuCursorState } from '../menus/tile_surface';
import type { BattleHudMon, PlayerHudMon } from './battle_hud';
import type { MenuMove } from './battle_menu_context';
import type { BattlePartyContext } from './battle_party_menu';
import type { BattlePokemon } from './types';
import { battleRandom } from './battle_random';

export const NAME_LENGTH = 11;
export const NAME_BUFFER_LENGTH = 20;
export const PARTY_LENGTH = 6;
export const PARTYMON_STRUCT_LENGTH = 0x2c;
export const NUM_MOVES = 4;
export const NUM_STATS = 5;
export const NUM_STAT_MODS = 8;
export const MAX_STAT_VALUE = 999;

export const WILD_BATTLE = 1;
export const TRAINER_BATTLE = 2;
export const LINK_STATE_BATTLING = 0x04;
export const SILPH_SCOPE = 0x48;
export const POKEMON_TOWER_1F = 0x8e;
export const POKEMON_TOWER_7F = 0x94;
export const RESTLESS_SOUL = 0x91;
export const MON_GHOST = 0xb8;
export const STRUGGLE = 165;
export const ATKDEFDV_TRAINER = 0x98;
export const SPDSPCDV_TRAINER = 0x88;

/** GhostPic CPU address. init_battle.asm:74 stores low then high; ROM file $F60A5 is `01 20 69`. */
export const GHOST_PIC = 0x6920;

const PAR = 1 << 6;
const BRN = 1 << 4;
const FRZ = 1 << 5;
const PSN = 1 << 3;
const TRANSFORMED = 1 << 3;
const USING_TRAPPING_MOVE = 1 << 5;
const HAS_SUBSTITUTE_UP = 1 << 4;

export const A = {
  // pret ram/wram.asm:624,656,1020,1089,1946,2087; symbols 573535d7.
  wTotalPayDayMoney: 0xcce5,
  wPlayerMonMinimized: 0xccf7,
  wChargeMoveNum: 0xcd3d,
  wPayDayMoney: 0xcd6d, // Three BCD bytes alias wNameBuffer / wBattleMenuCurrentPP.
  wOptions: 0xd354,
  wUnknownSerialFlag_d499: 0xd498,
  wBattleMonSpecies: 0xd013,
  wBattleMonPartyPos: 0xd016,
  wBattleMonStatus: 0xd017,
  wBattleMonType1: 0xd018,
  wBattleMonType2: 0xd019,
  wBattleMonCatchRate: 0xd01a,
  wBattleMonMoves: 0xd01b,
  wBattleMonDVs: 0xd01f,
  wBattleMonLevel: 0xd021,
  wBattleMonPP: 0xd02c,
  wEnemyMonSpecies: 0xcfe4,
  wEnemyMonPartyPos: 0xcfe7,
  wEnemyMonStatus: 0xcfe8,
  wEnemyMonType1: 0xcfe9,
  wEnemyMonType2: 0xcfea,
  wEnemyMonCatchRate: 0xcfeb,
  wEnemyMonMoves: 0xcfec,
  wEnemyMonDVs: 0xcff0,
  wEnemyMonLevel: 0xcff2,
  wEnemyMonPP: 0xcffd,
  wEnemyMonBaseStats: 0xd001,
  wEnemyMonActualCatchRate: 0xd006,
  wEnemyMonBaseExp: 0xd007,
  wBattleMonNick: 0xd008,
  wEnemyMonNick: 0xcfd9,
  wBattleMonSpecies2: 0xcfd8,
  wEnemyMonSpecies2: 0xcfd7,
  wCurSpecies: 0xd0b4,
  wNameListIndex: 0xd0b4,
  wNameListType: 0xd0b5,
  wPredefBank: 0xd0b6,
  wCurPartySpecies: 0xcf90,
  wCurItem: 0xcf90,
  wCurListMenuItem: 0xcf90,
  wWhichPokemon: 0xcf91,
  wPlayerMonNumber: 0xcc2f,
  hWhoseTurn: 0xfff3,
  hSerialConnectionStatus: 0xffaa,
  wIsInBattle: 0xd056,
  wBattleType: 0xd059,
  wLinkState: 0xd12a,
  wCurEnemyLevel: 0xd126,
  wCurOpponent: 0xd058,
  wCurMap: 0xd35d,
  wObtainedBadges: 0xd355,
  wPlayerBattleStatus1: 0xd061,
  wPlayerBattleStatus2: 0xd062,
  wPlayerBattleStatus3: 0xd063,
  wEnemyBattleStatus1: 0xd066,
  wEnemyBattleStatus2: 0xd067,
  wEnemyBattleStatus3: 0xd068,
  wPlayerStatsToDouble: 0xd05f,
  wPlayerStatsToHalve: 0xd060,
  wEnemyStatsToDouble: 0xd064,
  wEnemyStatsToHalve: 0xd065,
  wCriticalHitOrOHKO: 0xd05d,
  wMoveMissed: 0xd05e,
  wDamageMultipliers: 0xd05a,
  wLowHealthAlarm: 0xd082,
  // wram.asm:654,1140–1146,1225–1231,1295,1482–1495. HP bar words are LE.
  wLowHealthAlarmDisabled: 0xccf6,
  wHPBarMaxHP: 0xcee9,
  wHPBarOldHP: 0xceeb,
  wHPBarNewHP: 0xceed,
  wHPBarDelta: 0xceef,
  wHPBarTempHP: 0xcef0,
  wHPBarHPDifference: 0xcefd,
  wHPBarType: 0xcf93,
  wPlayerHPBarColor: 0xcf1c,
  wEnemyHPBarColor: 0xcf1d,
  wPlayerToxicCounter: 0xd06b,
  wEnemyToxicCounter: 0xd070,
  hRandomAdd: 0xffd3,
  hRandomSub: 0xffd4,
  wLinkBattleRandomNumberList: 0xd147,
  wLinkBattleRandomNumberListIndex: 0xccde,
  wSerialExchangeNybbleReceiveData: 0xcc3e,
  wEnemyDisabledMove: 0xd071,
  wBuffer: 0xcee9,
  hJoy7: 0xffb7,
  // wram.asm:589-604; encouragement, spare, two substitute bytes, debug, spare, then menu type.
  wAILayer2Encouragement: 0xccd5,
  wPlayerSubstituteHP: 0xccd7,
  wEnemySubstituteHP: 0xccd8,
  wMoveMenuType: 0xccdb,
  wMenuItemToSwap: 0xcc35,
  wCurrentMenuItem: 0xcc26,
  wPlayerMoveListIndex: 0xcc2e,
  wEnemyMoveListIndex: 0xcce2,
  wPlayerSelectedMove: 0xccdc,
  wEnemySelectedMove: 0xccdd,
  wPlayerMoveNum: 0xcfd1,
  wPlayerMoveEffect: 0xcfd2,
  wPlayerMovePower: 0xcfd3,
  wPlayerMoveType: 0xcfd4,
  wPlayerMoveAccuracy: 0xcfd5,
  wPlayerMoveMaxPP: 0xcfd6,
  wEnemyMoveNum: 0xcfcb,
  wEnemyMoveEffect: 0xcfcc,
  wEnemyMovePower: 0xcfcd,
  wEnemyMoveType: 0xcfce,
  wEnemyMoveAccuracy: 0xcfcf,
  wEnemyMoveMaxPP: 0xcfd0,
  wPlayerUsedMove: 0xccf1,
  wEnemyUsedMove: 0xccf2,
  wMonIsDisobedient: 0xcced,
  wMoveDidntMiss: 0xccf4, // wram.asm:647, immediately after wEnemyMonMinimized.
  wNumMovesMinusOne: 0xcd6c,
  wPlayerDisabledMove: 0xd06c,
  // ram/wram.asm:1478–1498, 635–636; existing union cells stay shared.
  wPlayerConfusedCounter: 0xd06a,
  wEnemyConfusedCounter: 0xd06f,
  wEnemyNumAttacksLeft: 0xd06e,
  wPlayerDisabledMoveNumber: 0xccee,
  wEnemyDisabledMoveNumber: 0xccef,
  wMaxMenuItem: 0xcc28,
  // wEscapedFromBattle $D077 +1, money union3, then wAnimationID (wram.asm:1517–1530).
  wAnimationID: 0xd07b,
  // wObtainedBadges $D355, unused badges1, letter flags1, then player ID (wram.asm:1948–1954).
  wPlayerID: 0xd358,
  // party_struct/box_struct: MON_OTID=$0C; $D16A+$0C (macros/ram.asm:17).
  wPartyMon1OTID: 0xd176,
  wMonDataLocation: 0xcc49,
  wNumRunAttempts: 0xd11f,
  wBattleResult: 0xcf0b,
  wForcePlayerToChooseMon: 0xd11e,
  wCapturedMonSpecies: 0xd11b,
  wFirstMonsNotOutYet: 0xd11c,
  wEscapedFromBattle: 0xd077,
  wPlayerNumAttacksLeft: 0xd069,
  wNumSafariBalls: 0xda46,
  wActionResultOrTookBattleTurn: 0xcd6a,
  wPseudoItemID: 0xd151,
  wMenuWatchMovingOutOfBounds: 0xcc37,
  wAnimationType: 0xcc5b,
  wBoostExpByExpAll: 0xcc5b,
  wNamedObjectIndex: 0xd11d,
  wTypeEffectiveness: 0xd11d,
  wMoveType: 0xd11d,
  wUsingPPUp: 0xd11d,
  wMaxPP: 0xd11d,
  wMoveGrammar: 0xd11d,
  wCalculateWhoseStats: 0xd11d,
  wPokeBallCaptureCalcTemp: 0xd11d,
  wPokeBallAnimData: 0xd11d,
  wPokedexNum: 0xd11d,
  wBattleMenuCurrentPP: 0xcd6d,
  wPPUpCountAndMaxPP: 0xcd73,
  wGainBoostedExp: 0xcf4c,
  wPlayerNumHits: 0xd073,
  wEnemyNumHits: 0xcd05,
  wEnemyMonMinimized: 0xccf3,
  wMonHSpriteDim: 0xd0c1,
  wPlayerMonUnmodifiedLevel: 0xcd0f,
  wEnemyMonUnmodifiedLevel: 0xcd23,
  wPlayerMonStatMods: 0xcd1a,
  wPlayerMonAccuracyMod: 0xcd1e,
  wPlayerMonEvasionMod: 0xcd1f,
  wEnemyMonStatMods: 0xcd2e,
  wEnemyMonAccuracyMod: 0xcd32,
  wEnemyMonEvasionMod: 0xcd33,
  wPartyMons: 0xd16a,
  wPartyMonNicks: 0xd2b4,
  wEnemyMons: 0xd8a3,
  wEnemyMonNicks: 0xd9ed,
  wPlayerName: 0xd157,
  wLinkEnemyTrainerName: 0xd886,
  wNameBuffer: 0xcd6d,
  wStringBuffer: 0xcf4a,
  wNumBagItems: 0xd31c,
  wBagItems: 0xd31d,
  wPokedexSeen: 0xd309,
  wMonHIndex: 0xd0b7,
  wMonHBaseStats: 0xd0b8,
  wMonHTypes: 0xd0bd,
  wMonHCatchRate: 0xd0bf,
  wMonHBaseEXP: 0xd0c0,
  wMonHMoves: 0xd0c6,
  wBattleMonHP: 0xd014,
  wBattleMonMaxHP: 0xd022,
  wBattleMonAttack: 0xd024,
  wBattleMonDefense: 0xd026,
  wBattleMonSpeed: 0xd028,
  wBattleMonSpecial: 0xd02a,
  wEnemyMonHP: 0xcfe5,
  wEnemyMonMaxHP: 0xcff3,
  wEnemyMonAttack: 0xcff5,
  wEnemyMonDefense: 0xcff7,
  wEnemyMonSpeed: 0xcff9,
  wEnemyMonSpecial: 0xcffb,
  wDamage: 0xd0d6,
  wTransformedEnemyMonOriginalDVs: 0xcceb,
} as const;

export type BattleByteName = keyof typeof A;

export interface SpeciesHeader {
  name: string;
  base: readonly [number, number, number, number, number];
  type1: number;
  type2: number;
  catchRate: number;
  baseExp: number;
  moves: readonly [number, number, number, number];
  learnset: readonly { level: number; move: number }[];
}

const WORD_BE: Record<string, number> = {
  wBattleMonHP: A.wBattleMonHP,
  wBattleMonMaxHP: A.wBattleMonMaxHP,
  wBattleMonAttack: A.wBattleMonAttack,
  wBattleMonDefense: A.wBattleMonDefense,
  wBattleMonSpeed: A.wBattleMonSpeed,
  wBattleMonSpecial: A.wBattleMonSpecial,
  wEnemyMonHP: A.wEnemyMonHP,
  wEnemyMonMaxHP: A.wEnemyMonMaxHP,
  wEnemyMonAttack: A.wEnemyMonAttack,
  wEnemyMonDefense: A.wEnemyMonDefense,
  wEnemyMonSpeed: A.wEnemyMonSpeed,
  wEnemyMonSpecial: A.wEnemyMonSpecial,
  wDamage: A.wDamage,
  // core.asm:3658–3688,6044–6074; experience.asm:95–100: high byte first.
  wPlayerBideAccumulatedDamage: A.wPlayerNumHits,
  wEnemyBideAccumulatedDamage: A.wEnemyNumHits,
  wExpAmountGained: A.wStringBuffer,
};

type ByteProps = { [K in BattleByteName]: number };
type WordProps = {
  wBattleMonHP: number; wBattleMonMaxHP: number; wBattleMonAttack: number; wBattleMonDefense: number;
  wBattleMonSpeed: number; wBattleMonSpecial: number; wEnemyMonHP: number; wEnemyMonMaxHP: number;
  wEnemyMonAttack: number; wEnemyMonDefense: number; wEnemyMonSpeed: number; wEnemyMonSpecial: number;
  wDamage: number; wPlayerBideAccumulatedDamage: number; wEnemyBideAccumulatedDamage: number;
  wExpAmountGained: number;
};

export interface BattleState extends ByteProps, WordProps {}

/** PokedexOrder national-dex bytes, internal id 1 at index 0. dex_order.asm + pokedex_constants.asm. */
export const POKEDEX_ORDER: readonly number[] = [
  112, 115, 32, 35, 21, 100, 34, 80, 2, 103, 108, 102, 88, 94, 29, 31,
  104, 111, 131, 59, 151, 130, 90, 72, 92, 123, 120, 9, 127, 114, 0, 0,
  58, 95, 22, 16, 79, 64, 75, 113, 67, 122, 106, 107, 24, 47, 54, 96,
  76, 0, 126, 0, 125, 82, 109, 0, 56, 86, 50, 128, 0, 0, 0, 83,
  48, 149, 0, 0, 0, 84, 60, 124, 146, 144, 145, 132, 52, 98, 0, 0,
  0, 37, 38, 25, 26, 0, 0, 147, 148, 140, 141, 116, 117, 0, 0, 27,
  28, 138, 139, 39, 40, 133, 136, 135, 134, 66, 41, 23, 46, 61, 62, 13,
  14, 15, 0, 85, 57, 51, 49, 87, 0, 0, 10, 11, 12, 68, 0, 55,
  97, 42, 150, 143, 129, 0, 0, 89, 0, 99, 91, 0, 101, 36, 110, 53,
  105, 0, 93, 63, 65, 17, 18, 121, 1, 3, 73, 0, 118, 119, 0, 0,
  0, 0, 77, 78, 19, 20, 33, 30, 74, 137, 142, 0, 81, 0, 0, 4,
  7, 5, 8, 6, 0, 0, 0, 0, 43, 44, 45, 69, 70, 71,
];

export function charmapByte(ch: string): number {
  if (ch === '@') return 0x50;
  if (ch === ' ') return 0x7f;
  const tile = charToTile(ch);
  if (tile < 0) throw new Error(`uncharmapped ${ch}`);
  return (tile + 0x80) & 0xff;
}

export function encodeText(text: string): number[] {
  return [...text].map(charmapByte);
}

export function liveBytes(mem: Uint8Array, addr: number, length: number): number[] {
  const dummy: number[] = [];
  return new Proxy(dummy, {
    get(_target, prop) {
      if (prop === 'length') return length;
      if (prop === 'slice') {
        return (start?: number, end?: number) => {
          const from = start ?? 0;
          const to = end ?? length;
          const out: number[] = [];
          for (let i = from; i < to; i++) out.push(mem[addr + i] ?? 0);
          return out;
        };
      }
      if (prop === Symbol.iterator) {
        return function* () {
          for (let i = 0; i < length; i++) yield mem[addr + i];
        };
      }
      if (typeof prop === 'string' && /^(0|[1-9]\d*)$/.test(prop)) {
        const index = Number(prop);
        if (index >= 0 && index < length) return mem[addr + index];
      }
      return undefined;
    },
    set(_target, prop, value) {
      if (typeof prop === 'string' && /^(0|[1-9]\d*)$/.test(prop)) {
        const index = Number(prop);
        if (index >= 0 && index < length) {
          mem[addr + index] = (value as number) & 0xff;
          return true;
        }
      }
      return false;
    },
  });
}

export function writeBytes(mem: Uint8Array, addr: number, values: readonly number[], length: number): void {
  for (let i = 0; i < length; i++) mem[addr + i] = (values[i] ?? 0) & 0xff;
}

export function decodeNick(mem: Uint8Array, addr: number): string {
  let text = '';
  for (let i = 0; i < NAME_LENGTH; i++) {
    const byte = mem[addr + i];
    if (byte === 0x50 || byte === 0) break;
    if (byte === 0x7f) text += ' ';
    else if (byte >= 0x80 && byte <= 0x99) text += String.fromCharCode(65 + byte - 0x80);
    else text += '?';
  }
  return text;
}

function installByte(self: BattleState, mem: Uint8Array, name: string, addr: number): void {
  Object.defineProperty(self, name, {
    configurable: true,
    enumerable: true,
    get: () => mem[addr],
    set: (value: number) => { mem[addr] = value & 0xff; },
  });
}

export class BattleState {
  readonly mem = new Uint8Array(0x10000);
  random: () => number = () => battleRandom(this);
  private divider = 0;
  /** Deterministic rDIV stand-in, replaceable by the eventual host or a test. */
  readDIV: () => number = () => (this.divider++ & 0xff);
  /** Mirrors the player party. BattlePokemon has no box-level field; the raw slot does. */
  partyMons: (BattlePokemon | null)[] = [null, null, null, null, null, null];
  /** Recorded by InitWildBattle. The picture itself is drawn in A5e. */
  frontPic: 'none' | 'ghost' | 'mon' = 'none';
  /** Species passed to LoadMonFrontSprite. Ghost writes MON_GHOST here, then restores $CF90. */
  frontPicSpecies = 0;
  /** Injected header table. Keys are internal species ids. */
  species: (id: number) => SpeciesHeader = () => {
    throw new Error('no species table');
  };
  movePP: (id: number) => number = () => 0;

  constructor() {
    for (const name of Object.keys(A) as BattleByteName[]) installByte(this, this.mem, name, A[name]);
    for (const [name, addr] of Object.entries(WORD_BE)) {
      Object.defineProperty(this, name, {
        configurable: true,
        enumerable: true,
        get: () => this.readBE(addr),
        set: (value: number) => this.writeBE(addr, value),
      });
    }
  }

  readBE(addr: number): number {
    return ((this.mem[addr] << 8) | this.mem[addr + 1]) & 0xffff;
  }

  writeBE(addr: number, value: number): void {
    this.mem[addr] = (value >> 8) & 0xff;
    this.mem[addr + 1] = value & 0xff;
  }

  bytes(addr: number, length: number): number[] {
    return liveBytes(this.mem, addr, length);
  }

  setBytes(addr: number, values: readonly number[], length: number): void {
    writeBytes(this.mem, addr, values, length);
  }

  /** GetQuantityOfItemInBag. Z when the quantity comes back 0. */
  quantityInBag(itemId: number): number {
    let hl = A.wNumBagItems;
    for (let guard = 0; guard < 21; guard++) {
      hl++;
      const id = this.mem[hl++];
      if (id === 0xff) return 0;
      if (id === (itemId & 0xff)) return this.mem[hl];
    }
    return 0;
  }

  setBag(items: readonly { id: number; quantity: number }[]): void {
    this.mem[A.wNumBagItems] = items.length & 0xff;
    let cursor = A.wBagItems;
    for (const item of items) {
      this.mem[cursor++] = item.id & 0xff;
      this.mem[cursor++] = item.quantity & 0xff;
    }
    this.mem[cursor] = 0xff;
  }
}

/** IndexToPokedex: internal id in wPokedexNum becomes the national dex number in the same byte. */
export function indexToPokedex(state: BattleState): void {
  const index = (state.wPokedexNum - 1) & 0xff;
  state.wPokedexNum = POKEDEX_ORDER[index] ?? 0;
}

/** FlagAction FLAG_SET on wPokedexSeen. c is the already-decremented dex bit. */
export function setSeenFlag(state: BattleState, bit: number): void {
  const byte = (bit >> 3) & 0xff;
  const mask = 1 << (bit & 7);
  state.mem[A.wPokedexSeen + byte] |= mask;
}

/** IsGhostBattle. True means the Z return: it is a ghost. */
export function isGhostBattle(state: BattleState): boolean {
  if (((state.wIsInBattle - 1) & 0xff) !== 0) return false;
  const map = state.wCurMap;
  if (map < POKEMON_TOWER_1F || map > POKEMON_TOWER_7F) return false;
  if (state.quantityInBag(SILPH_SCOPE) === 0) return true;
  return false;
}

function bit(getByte: () => number, setByte: (value: number) => void, mask: number): { get: () => boolean; set: (value: boolean) => void } {
  return {
    get: () => (getByte() & mask) !== 0,
    set: (value: boolean) => setByte(value ? getByte() | mask : getByte() & ~mask),
  };
}

/** A5c2's three contexts as one view. Plain-object fixtures do not go through this. */
export function battleContext(state: BattleState): BattlePartyContext {
  const local = {
    movesString: '',
    playerMove: null as MenuMove | null,
    moveData: null as MenuMove | null,
    cursor: { topX: 0, topY: 0, item: 0, lastItem: 0, tileBehind: ' ', location: null } as MenuCursorState,
    curItem: '',
    itemIndex: 0,
    itemName: '',
    bag: [] as ListEntry[],
    playerHud: { nickname: '', level: 0, status: 0, hp: 0, maxHp: 0, barColor: 0, alarm: 0, alarmDisabled: false } as PlayerHudMon,
    enemyHud: { nickname: '', level: 0, status: 0, hp: 0, maxHp: 0, barColor: 0 } as BattleHudMon,
    enemyPicture: '',
  };
  const party = Array.from({ length: PARTY_LENGTH }, (_, slot) => {
    const base = A.wPartyMons + slot * PARTYMON_STRUCT_LENGTH;
    return {
      get moves() { return liveBytes(state.mem, base + 8, NUM_MOVES); },
      set moves(values: number[]) { writeBytes(state.mem, base + 8, values, NUM_MOVES); },
      get pp() { return liveBytes(state.mem, base + 29, NUM_MOVES); },
      set pp(values: number[]) { writeBytes(state.mem, base + 29, values, NUM_MOVES); },
    };
  });
  const view: Record<string, unknown> = {};
  const bind = (name: string, get: () => unknown, set?: (value: unknown) => void) => {
    Object.defineProperty(view, name, set ? { get, set, enumerable: true } : { get, enumerable: true });
  };
  const raw = (prop: string, name: BattleByteName) => {
    bind(prop, () => state[name], value => { state[name] = value as number; });
  };
  raw('moveMenuType', 'wMoveMenuType');
  bind('battleMoves', () => liveBytes(state.mem, A.wBattleMonMoves, NUM_MOVES), value => writeBytes(state.mem, A.wBattleMonMoves, value as number[], NUM_MOVES));
  bind('battlePP', () => liveBytes(state.mem, A.wBattleMonPP, NUM_MOVES), value => writeBytes(state.mem, A.wBattleMonPP, value as number[], NUM_MOVES));
  bind('enemyMoves', () => liveBytes(state.mem, A.wEnemyMonMoves, NUM_MOVES), value => writeBytes(state.mem, A.wEnemyMonMoves, value as number[], NUM_MOVES));
  bind('party', () => party);
  raw('playerMonNumber', 'wPlayerMonNumber');
  raw('whichPokemon', 'wWhichPokemon');
  raw('playerMoveListIndex', 'wPlayerMoveListIndex');
  raw('menuItemToSwap', 'wMenuItemToSwap');
  raw('currentMenuItem', 'wCurrentMenuItem');
  raw('numMovesMinusOne', 'wNumMovesMinusOne');
  bind('movesString', () => local.movesString, value => { local.movesString = value as string; });
  raw('playerDisabledMove', 'wPlayerDisabledMove');
  const transformed = bit(() => state.wPlayerBattleStatus3, value => { state.wPlayerBattleStatus3 = value; }, TRANSFORMED);
  bind('transformed', transformed.get, value => transformed.set(value as boolean));
  raw('playerSelectedMove', 'wPlayerSelectedMove');
  bind('playerMove', () => local.playerMove, value => { local.playerMove = value as MenuMove | null; });
  bind('moveData', () => local.moveData, value => { local.moveData = value as MenuMove | null; });
  raw('maxPP', 'wMaxPP');
  raw('battleMenuCurrentPP', 'wBattleMenuCurrentPP');
  raw('whoseTurn', 'hWhoseTurn');
  raw('monDataLocation', 'wMonDataLocation');
  raw('usingPPUp', 'wUsingPPUp');
  raw('ppUpCountAndMaxPP', 'wPPUpCountAndMaxPP');
  bind('cursor', () => local.cursor, value => { local.cursor = value as MenuCursorState; });
  raw('battleType', 'wBattleType');
  raw('isInBattle', 'wIsInBattle');
  bind('ghostBattle', () => isGhostBattle(state));
  raw('numRunAttempts', 'wNumRunAttempts');
  raw('actionResultOrTookBattleTurn', 'wActionResultOrTookBattleTurn');
  raw('battleResult', 'wBattleResult');
  raw('forcePlayerToChooseMon', 'wForcePlayerToChooseMon');
  raw('capturedMonSpecies', 'wCapturedMonSpecies');
  raw('escapedFromBattle', 'wEscapedFromBattle');
  const trapping = bit(() => state.wPlayerBattleStatus1, value => { state.wPlayerBattleStatus1 = value; }, USING_TRAPPING_MOVE);
  bind('usingTrappingMove', trapping.get, value => trapping.set(value as boolean));
  raw('playerNumAttacksLeft', 'wPlayerNumAttacksLeft');
  raw('numSafariBalls', 'wNumSafariBalls');
  bind('playerName', () => liveBytes(state.mem, A.wPlayerName, NAME_LENGTH), value => writeBytes(state.mem, A.wPlayerName, value as number[], NAME_LENGTH));
  bind('linkEnemyTrainerName', () => liveBytes(state.mem, A.wLinkEnemyTrainerName, NAME_LENGTH), value => writeBytes(state.mem, A.wLinkEnemyTrainerName, value as number[], NAME_LENGTH));
  bind('playerSpeed', () => state.wBattleMonSpeed, value => { state.wBattleMonSpeed = value as number; });
  bind('enemySpeed', () => state.wEnemyMonSpeed, value => { state.wEnemyMonSpeed = value as number; });
  bind('curItem', () => local.curItem, value => { local.curItem = value as string; });
  bind('itemIndex', () => local.itemIndex, value => { local.itemIndex = value as number; });
  bind('itemName', () => local.itemName, value => { local.itemName = value as string; });
  raw('pseudoItemID', 'wPseudoItemID');
  raw('menuWatchMovingOutOfBounds', 'wMenuWatchMovingOutOfBounds');
  raw('joy7', 'hJoy7');
  bind('bag', () => local.bag, value => { local.bag = value as ListEntry[]; });
  bind('playerHud', () => local.playerHud, value => { local.playerHud = value as PlayerHudMon; });
  bind('enemyHud', () => local.enemyHud, value => { local.enemyHud = value as BattleHudMon; });
  // SET_PAL_BATTLE reads wBattleMonSpecies, then the party slot at wPlayerMonNumber. Not $CF90.
  bind('partySpecies', () => {
    if (state.wBattleMonSpecies === 0) return 0;
    const slot = state.wPlayerMonNumber;
    const species = state.mem[A.wPartyMons + slot * PARTYMON_STRUCT_LENGTH];
    return species === 0 ? 0 : POKEDEX_ORDER[species - 1];
  });
  bind('enemySpecies2', () => state.wEnemyMonSpecies2 === 0 ? 0 : POKEDEX_ORDER[state.wEnemyMonSpecies2 - 1]);
  raw('pokedexNum', 'wPokedexNum');
  bind('partyMons', () => state.partyMons, value => { state.partyMons = value as (BattlePokemon | null)[]; });
  bind('battleMonNick', () => decodeNick(state.mem, A.wBattleMonNick), value => {
    writeBytes(state.mem, A.wBattleMonNick, encodeText(`${value as string}@`), NAME_LENGTH);
  });
  raw('firstMonsNotOutYet', 'wFirstMonsNotOutYet');
  const substitute = bit(() => state.wEnemyBattleStatus2, value => { state.wEnemyBattleStatus2 = value; }, HAS_SUBSTITUTE_UP);
  bind('enemyHasSubstitute', substitute.get, value => substitute.set(value as boolean));
  bind('enemyMinimized', () => state.wEnemyMonMinimized !== 0, value => { state.wEnemyMonMinimized = (value as boolean) ? 1 : 0; });
  raw('enemySpecies', 'wEnemyMonSpecies');
  bind('enemyPicture', () => local.enemyPicture, value => { local.enemyPicture = value as string; });
  raw('curPartySpecies', 'wCurPartySpecies');
  raw('curSpecies', 'wCurSpecies');
  raw('battleMonSpecies2', 'wBattleMonSpecies2');
  return view as unknown as BattlePartyContext;
}

export { PAR, BRN, FRZ, PSN, TRANSFORMED };
