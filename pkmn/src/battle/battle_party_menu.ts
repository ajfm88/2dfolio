// core.asm PartyMenuOrRockOrRun's party branch. Unused until A5c3.
import type { BattlePokemon } from './types';
import type { BattleActionContext, BattleActionHost, BattleMenuFlags, Program } from './battle_menu_context';
import { PartyMenu } from '../menus/party_menu';
import { StatusScreenSession } from '../menus/status_screen';
import { MenuInput } from '../menus/menu_input';
import { placeMenuCursor, placeUnfilledArrowMenuCursor, textBoxBorder, placeString } from '../menus/tile_surface';
import type { MenuCursorState } from '../menus/tile_surface';

export interface BattlePartyContext extends BattleActionContext {
  partyMons: BattlePokemon[];
  battleMonNick: string;
  firstMonsNotOutYet: number;
  enemyHasSubstitute: boolean;
  enemyMinimized: boolean;
  enemySpecies: number;
  enemyPicture: string;
  curPartySpecies: number;
  curSpecies: number;
  battleMonSpecies2: number;
}

export type BattleStatusSession = Pick<StatusScreenSession, 'frame' | 'render' | 'paletteWhite' | 'tiles'>;
export interface BattlePartyHost extends BattleActionHost {
  partyView: PartyMenu;
  statusView: BattleStatusSession | null;
  createStatusScreen?(mon: BattlePokemon, options: { syncRead: boolean }): BattleStatusSession;
  loadEnemyPicVariant(kind: 'substitute' | 'minimize'): Program;
  switchPlayerMon(ctx: BattlePartyContext): Program;
}

/** Compose the unused host's CP4 party port; never touches the running game. */
export function bindBattlePartyMenu(ctx: BattlePartyContext, host: BattlePartyHost): void {
  host.partyMenu = () => partyMenuOrRockOrRun(ctx, host);
}

export function drawBattlePartySubmenu(party: PartyMenu): MenuCursorState {
  const tiles = party.choiceOverlay;
  textBoxBorder(tiles, 11, 11, 5, 7);
  placeString(tiles, 13, 12, 'SWITCH<NEXT>STATS<NEXT>CANCEL');
  const cursor: MenuCursorState = { topX: 12, topY: 12, item: 0, lastItem: 0, tileBehind: ' ', location: null };
  placeMenuCursor(tiles, cursor);
  return cursor;
}

/** FillMemory, not a rectangle: row11 x11..19, then all of rows12..17. */
export function clearBattlePartySubmenu(party: PartyMenu): void {
  const start = 11 + 11 * 20;
  for (let i = 0; i < 129; i++) party.choiceOverlay.put((start + i) % 20, Math.floor((start + i) / 20), ' ');
}

function clearSprites(host: BattlePartyHost): void {
  for (let i = 0; i < 40; i++) host.screen.setOam(i, { x: 0, y: 0, tile: 0, attributes: 0 });
}
function white(host: BattlePartyHost): void { host.screen.bgp = host.screen.obp0 = host.screen.obp1 = 0; }
function normal(host: BattlePartyHost): void { host.screen.bgp = 0xe4; host.screen.obp0 = 0xd0; }
function* hudCopies(host: BattlePartyHost): Program {
  for (const _frame of host.screen.loadHudTilePatterns()) { void _frame; yield 'serviced'; }
}
function* palette(ctx: BattlePartyContext, host: BattlePartyHost): Program {
  yield* host.screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
    playerBar: ctx.playerHud.barColor as 0 | 1 | 2, enemyBar: ctx.enemyHud.barColor as 0 | 1 | 2 });
}

export function* partyMenuOrRockOrRun(ctx: BattlePartyContext, host: BattlePartyHost): Program<BattleMenuFlags | null> {
  const party = host.partyView;
  let full = true;
  for (;;) {
    ctx.monDataLocation = 0; ctx.menuItemToSwap = 0; ctx.menuWatchMovingOutOfBounds = 0;
    if (full) {
      host.loadScreenTilesFromBuffer1();
      const forceChoose = !!ctx.forcePlayerToChooseMon; ctx.forcePlayerToChooseMon = 0;
      party.openBattleChoice(ctx.partyMons, { forceChoose });
    } else party.goBackToChoice();
    let choice;
    do {
      // Session frames advance their own BG tick after the yield; host skips BattleScreen.vblank.
      yield 'session';
      choice = party.frameBattleChoice(() => host.readJoypad(), () => host.pressSound());
    } while (!choice);
    if (choice.kind === 'cancelled') {
      clearSprites(host); white(host); yield* hudCopies(host);
      host.loadScreenTilesFromBuffer2(); yield* palette(ctx, host); normal(host);
      return null; // jp DisplayBattleMenu: caller redisplays without generator recursion.
    }
    ctx.whichPokemon = choice.slot;
    ctx.curPartySpecies = ctx.battleMonSpecies2 = ctx.partyMons[choice.slot].species.id;
    const cursor = drawBattlePartySubmenu(party);
    ctx.currentMenuItem = 0;
    const input = new MenuInput({ watched: ['a', 'b'], maxItem: 2, topX: 12, topY: 12 });
    let hit;
    do {
      yield 'session'; party.presentBattleChoice();
      hit = input.update(() => host.readJoypad(), () => host.pressSound());
      ctx.currentMenuItem = input.item; cursor.item = input.item;
      if (!hit) placeMenuCursor(party.choiceOverlay, cursor);
    } while (!hit);
    if (!hit.includes('b')) {
      placeUnfilledArrowMenuCursor(party.choiceOverlay, cursor);
      if (input.item === 2) {
        clearSprites(host); white(host); yield* hudCopies(host);
        host.loadScreenTilesFromBuffer2(); yield* palette(ctx, host); normal(host);
        return null; // Same tail jump for submenu CANCEL.
      }
      if (input.item === 1) {
        ctx.monDataLocation = 0; clearSprites(host);
        const mon = ctx.partyMons[ctx.whichPokemon];
        const status = host.createStatusScreen?.(mon, { syncRead: false }) ?? new StatusScreenSession(mon, { syncRead: false });
        host.statusView = status;
        for (;;) {
          yield 'session';
          if (status.frame(() => host.readJoypad()) === 'done') break;
        }
        // StatusScreen owns Q+3's VBlank. Reload starts as CPU work at that same boundary.
        host.statusView = null; ctx.whoseTurn = 1; white(host);
        if (ctx.enemyHasSubstitute) yield* host.loadEnemyPicVariant('substitute');
        else if (ctx.enemyMinimized) yield* host.loadEnemyPicVariant('minimize');
        else {
          ctx.curPartySpecies = ctx.curSpecies = ctx.enemySpecies;
          for (const _frame of host.screen.copyFront(ctx.enemyPicture)) { void _frame; yield 'serviced'; }
        }
        full = true; continue;
      }
      if (ctx.whichPokemon === ctx.playerMonNumber) {
        yield* party.printBattleChoiceText('AlreadyOutText', { battleMonNick: ctx.battleMonNick });
      } else if (ctx.partyMons[ctx.whichPokemon].currentHp === 0) {
        if (ctx.firstMonsNotOutYet === 0) yield* party.printBattleChoiceText('NoWillText');
      } else {
        ctx.actionResultOrTookBattleTurn = 1;
        white(host); clearSprites(host); yield* hudCopies(host);
        host.loadScreenTilesFromBuffer1(); yield* palette(ctx, host); normal(host);
        yield* host.switchPlayerMon(ctx);
        return { carry: false }; // SwitchPlayerMon owns the current-item2 write.
      }
    }
    clearBattlePartySubmenu(party); full = false;
  }
}
