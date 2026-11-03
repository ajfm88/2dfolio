// core.asm DisplayBattleMenu, BagWasSelected/UseBagItem, and TryRunningFromBattle. Unused until A5c3.
import { isPassPressed } from '../input';
import type { GameButton } from '../core';
import { MenuInput } from '../menus/menu_input';
import { ListMenu } from '../menus/list_menu';
import { placeMenuCursor, placeUnfilledArrowMenuCursor, placeString, textBoxBorder, writeNumber } from '../menus/tile_surface';
import { getBattleAndStartSavedMenuItem, setBattleAndStartSavedMenuItem, getBagSavedMenuItem,
  setBagSavedMenuItem, getListScrollOffset, setListScrollOffset, setCurrentMenuItem } from '../list_state';
import { getItemName } from '../items';
import { textBgTransfer } from '../text/bg_transfer';
import { applyHudAlarm, lowHealthAlarm, isLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { drawPlayerHudAndHpBar, drawEnemyHudAndHpBar } from './battle_hud';
import { A, type BattleState } from './battle_state';
import { multiply, divide } from './battle_arithmetic';
import { battleRandom } from './battle_random';
import { delayFrames } from './battle_menu_context';
import { loadHudTilePatterns } from './battle_slides';
import type { BattleActionContext, BattleActionHost, BattleMenuFlags, Program } from './battle_menu_context';

const KEYS: readonly GameButton[] = ['a', 'b', 'select', 'start', 'right', 'left', 'up', 'down'];

export type HudContext = Pick<BattleActionContext, 'playerHud' | 'enemyHud' | 'partySpecies' | 'enemySpecies2' | 'pokedexNum'>;
type HudHost = Pick<BattleActionHost, 'screen'>;

function* hudPalette(ctx: HudContext, host: HudHost): Program {
  ctx.pokedexNum = ctx.enemySpecies2;
  yield* host.screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
    playerBar: ctx.playerHud.barColor as 0 | 1 | 2, enemyBar: ctx.enemyHud.barColor as 0 | 1 | 2 });
}

export function* drawPlayerHudProgram(ctx: HudContext, host: HudHost): Program {
  const player = drawPlayerHudAndHpBar(host.screen, { ...ctx.playerHud,
    alarm: lowHealthAlarm(), alarmDisabled: isLowHealthAlarmDisabled() });
  ctx.playerHud.barColor = player.barColor;
  if (player.paletteRequest) yield* hudPalette(ctx, host);
  applyHudAlarm(player.alarm, player.clearChan5);
}

export function* drawEnemyHudProgram(ctx: HudContext, host: HudHost): Program {
  const enemy = drawEnemyHudAndHpBar(host.screen, ctx.enemyHud);
  ctx.enemyHud.barColor = enemy.barColor;
  if (enemy.paletteRequest) yield* hudPalette(ctx, host);
}

export function* drawHudsAndHpBars(ctx: HudContext, host: HudHost): Program {
  yield* drawPlayerHudProgram(ctx, host);
  yield* drawEnemyHudProgram(ctx, host);
}

export function drawBattleMenuTemplate(ctx: BattleActionContext, host: BattleActionHost): void {
  const safari = ctx.battleType === 2;
  textBoxBorder(host.tiles, safari ? 0 : 8, 12, 4, safari ? 18 : 10);
  placeString(host.tiles, safari ? 2 : 10, 14,
    safari ? 'BALL×       BAIT<NEXT>THROW ROCK  RUN' : 'FIGHT \uE001\uE002<NEXT>ITEM  RUN');
}

function* menuInput(ctx: BattleActionContext, host: BattleActionHost, watched: readonly GameButton[]): Program<GameButton[]> {
  const cursor = ctx.cursor;
  placeMenuCursor(host.tiles, cursor);
  const input = new MenuInput({ watched, maxItem: 1, topX: cursor.topX, topY: 14,
    item: ctx.currentMenuItem, watchOutOfBounds: false });
  for (;;) {
    yield 'serviced';
    let fresh: GameButton[] = [];
    const hit = input.update(() => { host.readJoypad(); fresh = KEYS.filter(key => isPassPressed(key)); }, () => host.pressSound());
    ctx.currentMenuItem = input.item;
    if (hit) return hit;
    if (fresh.length) { cursor.item = input.item; placeMenuCursor(host.tiles, cursor); }
  }
}

function swapDemoName(ctx: BattleActionContext): void {
  ctx.linkEnemyTrainerName = ctx.playerName.slice(0, 11);
  // NAME_LENGTH copies beyond @ as written. OLD MAN@ is immediately followed by PROF.OAK@.
  const bytes = (text: string) => [...text].map(c => c === '@' ? 0x50 : c === ' ' ? 0x7f : c === '.' ? 0xe8 : c.charCodeAt(0) - 65 + 0x80);
  const source = bytes('OLD MAN@PROF.OAK@');
  if (ctx.battleType === 1) ctx.playerName = source.slice(0, 11);
  else {
    // The two bytes after PROF.OAK@ are ld a,[wBattleAndStartSavedMenuItem] (opcode/address low).
    ctx.playerName = [...bytes('PROF.OAK@'), 0xfa, 0x2d]; // ROM 0f:4fef +9: fa 2d cc
  }
}

export function* displayBattleMenu(ctx: BattleActionContext, host: BattleActionHost): Program<BattleMenuFlags> {
  for (;;) {
    host.loadScreenTilesFromBuffer1();
    if (ctx.battleType === 0) {
      yield* drawHudsAndHpBars(ctx, host);
      yield* host.printText('PrintEmptyString.emptyString');
      host.saveScreenTilesToBuffer1();
    }
    drawBattleMenuTemplate(ctx, host);
    let selected: number;
    if (ctx.battleType === 1 || ctx.battleType === 4) {
      swapDemoName(ctx);
      host.tiles.put(9, 14, '▶'); yield* delayFrames(20);
      host.tiles.put(9, 14, ' '); host.tiles.put(9, 16, '▶'); yield* delayFrames(20);
      host.tiles.put(9, 16, '▷'); selected = 2;
    } else {
      const saved = getBattleAndStartSavedMenuItem();
      let right = saved >= 2;
      ctx.currentMenuItem = right ? saved - 2 : saved;
      ctx.cursor.lastItem = ctx.currentMenuItem;
      for (;;) {
        const safari = ctx.battleType === 2;
        const x = safari ? (right ? 13 : 1) : (right ? 15 : 9);
        const other = safari ? (right ? 1 : 13) : (right ? 9 : 15);
        host.tiles.put(other, 14, ' '); host.tiles.put(other, 16, ' ');
        if (safari) writeNumber(host.tiles, 7, 14, ctx.numSafariBalls, { digits: 2, leadingZeroes: false });
        Object.assign(ctx.cursor, { topX: x, topY: 14, rowStep: 2, item: ctx.currentMenuItem });
        const keys = yield* menuInput(ctx, host, right ? ['a', 'left'] : ['a', 'right']);
        ctx.cursor.item = ctx.currentMenuItem;
        if (keys.includes(right ? 'left' : 'right')) { right = !right; continue; }
        ctx.currentMenuItem += right ? 2 : 0;
        placeUnfilledArrowMenuCursor(host.tiles, ctx.cursor);
        selected = ctx.currentMenuItem;
        break;
      }
      if (ctx.battleType === 3 && selected !== 3) { yield* host.printText('DisplayBattleMenu.RunAwayText'); continue; }
      if (ctx.battleType !== 3) setBattleAndStartSavedMenuItem(selected);
      if (ctx.battleType !== 2) selected = selected === 1 ? 2 : selected === 2 ? 1 : selected;
    }
    if (selected === 0) {
      if (ctx.battleType === 2) { ctx.curItem = 'SAFARI_BALL'; return (yield* useBagItem(ctx, host))!; }
      ctx.numRunAttempts = 0; host.loadScreenTilesFromBuffer1(); return { carry: false };
    }
    if (selected === 2) {
      host.saveScreenTilesToBuffer2();
      if (ctx.battleType === 2) { ctx.curItem = 'SAFARI_BAIT'; return (yield* useBagItem(ctx, host))!; }
      const result = yield* bagWasSelected(ctx, host);
      if (result) return result;
      continue;
    }
    if (selected === 1) {
      host.saveScreenTilesToBuffer2();
      if (ctx.battleType === 2) { ctx.curItem = 'SAFARI_ROCK'; return (yield* useBagItem(ctx, host))!; }
      const result = yield* host.partyMenu(ctx);
      if (result) return result;
      continue;
    }
    const result = yield* battleMenuRunWasSelected(ctx, host);
    if (result) return result;
  }
}

/** null means the caller must redisplay the battle menu (cancel or trainer RUN refusal). */
export function* bagWasSelected(ctx: BattleActionContext, host: BattleActionHost): Program<BattleMenuFlags | null> {
  for (;;) {
    host.loadScreenTilesFromBuffer1();
    if (ctx.battleType === 0) yield* drawHudsAndHpBars(ctx, host);
    const demo = ctx.battleType === 1 || ctx.battleType === 4;
    const list = new ListMenu(host.tiles, { kind: 'items', entries: demo ? [{ id: 'POKE_BALL', count: 1 }] : ctx.bag,
      item: getBagSavedMenuItem(), offset: getListScrollOffset(), simulatedInput: ctx.battleType !== 0 }, textBgTransfer);
    ctx.joy7 = 1; ctx.menuWatchMovingOutOfBounds = 1; ctx.menuItemToSwap = 0;
    let choice;
    do {
      yield 'serviced';
      choice = list.update(() => host.readJoypad(), () => host.pressSound());
      setCurrentMenuItem(list.item); setListScrollOffset(list.offset); ctx.currentMenuItem = list.item;
    } while (!choice);
    setBagSavedMenuItem(list.item);
    ctx.joy7 = 0; ctx.menuWatchMovingOutOfBounds = 0; ctx.menuItemToSwap = 0;
    if (choice.type === 'cancelled') return null;
    ctx.curItem = choice.id; ctx.itemIndex = choice.index;
    const result = yield* useBagItem(ctx, host);
    if (result) return result;
  }
}

export function* useBagItem(ctx: BattleActionContext, host: BattleActionHost): Program<BattleMenuFlags | null> {
  ctx.itemName = getItemName(ctx.curItem); ctx.pseudoItemID = 0;
  yield* host.useItem(ctx);
  yield* loadHudTilePatterns(host.screen);
  for (let i = 0; i < 40; i++) host.screen.setOam(i, { x: 0, y: 0, tile: 0, attributes: 0 });
  ctx.currentMenuItem = 0;
  if (ctx.battleType !== 2) {
    if (!ctx.actionResultOrTookBattleTurn) return null;
    if (ctx.usingTrappingMove) {
      ctx.playerNumAttacksLeft = (ctx.playerNumAttacksLeft - 1) & 0xff;
      if (ctx.playerNumAttacksLeft === 0) ctx.usingTrappingMove = false;
    }
  }
  if (ctx.capturedMonSpecies) {
    normalPalette(host); ctx.capturedMonSpecies = 0; ctx.battleResult = 2; return { carry: true };
  }
  if (ctx.battleType !== 2) {
    host.loadScreenTilesFromBuffer1(); yield* drawHudsAndHpBars(ctx, host); yield* delayFrames(3);
  }
  normalPalette(host); return { carry: false };
}

function normalPalette(host: BattleActionHost): void { host.screen.bgp = 0xe4; host.screen.obp0 = 0xd0; }

/** core.asm:1560–1607. CPU-only odds; the caller already incremented the byte attempt. */
export function battleRunOdds(state: BattleState): boolean {
  const player = state.wBattleMonSpeed, enemy = state.wEnemyMonSpeed;
  // StringCmp's two-byte unsigned comparison, including equality.
  if (player >= enemy) return true;
  const h = state.mem.subarray(A.hProduct, A.hProduct + 10);
  h[1] = 0; h[2] = player >>> 8; h[3] = player & 0xff; h[4] = 32;
  multiply(h);
  h[0] = h[2]; h[1] = h[3]; // the low product word becomes the two-byte dividend
  // hEnemySpeed has no existing state cell; retain the source word locally.
  const divisor = (enemy >>> 2) & 0xff;
  if (divisor === 0) return true;
  h[4] = divisor;
  if (divide(h, 2)) throw new Error('RUN divide froze');
  if (h[2] !== 0) return true;
  let c = state.wNumRunAttempts;
  for (;;) {
    c = (c - 1) & 0xff;
    if (c === 0) break;
    const sum = h[3] + 30;
    h[3] = sum & 0xff;
    if (sum > 255) return true;
  }
  return h[3] >= battleRandom(state);
}

export function* tryRunningFromBattle(ctx: BattleActionContext,
  host: Pick<BattleActionHost, 'printText' | 'saveScreenTilesToBuffer1' | 'loadScreenTilesFromBuffer1' | 'waitForSound' | 'playSound' | 'runOdds'>): Program<BattleMenuFlags> {
  let escape = ctx.ghostBattle || ctx.battleType === 2 || ctx.battleType === 3;
  if (!escape && ctx.isInBattle !== 1) {
    yield* host.printText('NoRunningText'); ctx.forcePlayerToChooseMon = 1;
    host.saveScreenTilesToBuffer1(); return { carry: false };
  }
  if (!escape) {
    ctx.numRunAttempts = (ctx.numRunAttempts + 1) & 0xff;
    host.loadScreenTilesFromBuffer1();
    escape = host.runOdds(ctx.playerSpeed, ctx.enemySpeed, ctx.numRunAttempts);
  }
  if (!escape) {
    ctx.actionResultOrTookBattleTurn = 1;
    yield* host.printText('CantEscapeText'); ctx.forcePlayerToChooseMon = 1;
    host.saveScreenTilesToBuffer1(); return { carry: false };
  }
  ctx.battleResult = 2;
  yield* host.waitForSound(); host.playSound('run');
  yield* host.printText('GotAwayText');
  yield* host.waitForSound(); host.saveScreenTilesToBuffer1(); return { carry: true };
}

export function* battleMenuRunWasSelected(ctx: BattleActionContext, host: BattleActionHost): Program<BattleMenuFlags | null> {
  host.loadScreenTilesFromBuffer1(); ctx.currentMenuItem = 3;
  const result = yield* tryRunningFromBattle(ctx, host);
  ctx.forcePlayerToChooseMon = 0;
  return result.carry || ctx.actionResultOrTookBattleTurn ? result : null;
}
