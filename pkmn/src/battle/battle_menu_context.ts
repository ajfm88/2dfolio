import type { TileSurface, MenuCursorState } from '../menus/tile_surface';
import type { TextBindings } from '../text/text_runner';
import type { BattleScreen } from './battle_screen';
import type { BattleHudMon, PlayerHudMon } from './battle_hud';
import type { ListEntry } from '../menus/list_menu';

export type Frame = 'serviced' | 'held' | 'session';
export type Program<T = void> = Generator<Frame, T, void>;
export interface MoveMenuFlags { zero: boolean }
export interface BattleMenuFlags { carry: boolean }
export interface MenuMove {
  id: number;
  name: string;
  type: string;
  pp: number;
  power: number;
  accuracy: number;
  effect: string;
}
export interface MenuMonMoves { moves: number[]; pp: number[] }

/** Raw WRAM-shaped data. The active battle copy and party slot deliberately do not alias. */
export interface BattleMenuContext {
  moveMenuType: 0 | 1 | 2;
  battleMoves: number[];
  battlePP: number[];
  enemyMoves: number[];
  party: MenuMonMoves[];
  playerMonNumber: number;
  whichPokemon: number;
  playerMoveListIndex: number;
  menuItemToSwap: number;
  currentMenuItem: number;
  numMovesMinusOne: number;
  movesString: string;
  playerDisabledMove: number;
  transformed: boolean;
  playerSelectedMove: number;
  playerMove: MenuMove | null;
  moveData: MenuMove | null;
  maxPP: number;
  battleMenuCurrentPP: number;
  whoseTurn: number;
  monDataLocation: number;
  usingPPUp: number;
  ppUpCountAndMaxPP: number;
  cursor: MenuCursorState;
}

export interface MoveMenuHost {
  tiles: TileSurface;
  getMove(id: number): MenuMove;
  readJoypad(): void;
  pressSound(): void;
  printText(program: string, bindings?: TextBindings): Program;
  loadScreenTilesFromBuffer1(): void;
}

/** Other routines stay ports; CP4/CP5 extend the context with their own WRAM fields. */
export interface BattleMenuPorts {
  useItem(ctx: BattleMenuContext): Program;
  switchPlayerMon(ctx: BattleMenuContext): Program;
  loadEnemyPicVariant(kind: 'substitute' | 'minimize'): Program;
  drawHudsAndHpBars(ctx: BattleMenuContext): Program;
  waitForSound(): Program;
  runOdds(playerSpeed: number, enemySpeed: number, attempts: number): boolean;
}

/** CP4 specialization keeps CP3's existing contexts and tests valid without optional WRAM bytes. */
export interface BattleActionContext extends BattleMenuContext {
  battleType: 0 | 1 | 2 | 3 | 4;
  isInBattle: number;
  ghostBattle: boolean;
  numRunAttempts: number;
  actionResultOrTookBattleTurn: number;
  battleResult: number;
  forcePlayerToChooseMon: number;
  capturedMonSpecies: number;
  escapedFromBattle: number;
  usingTrappingMove: boolean;
  playerNumAttacksLeft: number;
  numSafariBalls: number;
  playerName: number[];
  linkEnemyTrainerName: number[];
  playerSpeed: number;
  enemySpeed: number;
  curItem: string;
  itemIndex: number;
  itemName: string;
  pseudoItemID: number;
  menuWatchMovingOutOfBounds: number;
  joy7: number;
  bag: ListEntry[];
  playerHud: PlayerHudMon;
  enemyHud: BattleHudMon;
  partySpecies: number;
  enemySpecies2: number;
}

export interface BattleActionHost {
  screen: BattleScreen;
  tiles: TileSurface;
  readJoypad(): void;
  pressSound(): void;
  printText(program: string, bindings?: TextBindings): Program;
  loadScreenTilesFromBuffer1(): void;
  saveScreenTilesToBuffer1(): void;
  loadScreenTilesFromBuffer2(): void;
  saveScreenTilesToBuffer2(): void;
  useItem(ctx: BattleActionContext): Program;
  /** null tail-jumps back to this caller's menu loop without nesting another generator. */
  partyMenu(ctx: BattleActionContext): Program<BattleMenuFlags | null>;
  playSound(name: string): void;
  waitForSound(): Program;
  runOdds(playerSpeed: number, enemySpeed: number, attempts: number): boolean;
}

export function* delayFrames(count: number): Program {
  for (let frame = 0; frame < count; frame++) yield 'serviced';
}
