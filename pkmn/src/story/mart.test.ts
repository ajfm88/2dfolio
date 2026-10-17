import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMartScript } from './mart';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { initScript, updateScript, getActiveScript, getMartTiles } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag, BAG_ITEM_CAPACITY, getAllItemIds, isKeyItem } from '../items';
import { restoreFlags, setFlag } from '../events';
import { isHeld, isPassPressed, readJoypad, syncJoypadRead } from '../input';
import { createOverworldState, updateOverworld } from '../overworld/overworld_controller';
import type { OverworldDeps } from '../overworld/overworld_controller';
import {
  getBagSavedMenuItem, getListScrollOffset, getSavedListScrollOffset,
  setBagSavedMenuItem, setCurrentMenuItem, setListScrollOffset, setSavedListScrollOffset,
} from '../list_state';
import { isSoundFinished, playSFX } from '../audio';
import { YesNoMenu } from '../menus/yes_no_menu';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: () => false,
  readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), playMusic: vi.fn(), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }) }));

const mapData = JSON.parse(readFileSync(resolve(__dirname, '../../data/maps/ViridianMart.json'), 'utf8'));
const clerkItems = ['POKE_BALL', 'POTION', 'ANTIDOTE', 'PARALYZE_HEAL', 'BURN_HEAL'];

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => {
  vi.clearAllMocks();
  restoreFlags([]);
  setTextSpeed('fast');
  setListScrollOffset(0);
  setCurrentMenuItem(0);
  setBagSavedMenuItem(0);
  setSavedListScrollOffset(0);
  vi.mocked(isHeld).mockReturnValue(false);
  vi.mocked(isPassPressed).mockReturnValue(false);
  vi.mocked(isSoundFinished).mockImplementation(() => true);
  vi.mocked(playSFX).mockImplementation(() => Promise.resolve());
});

function release(): void {
  vi.mocked(isPassPressed).mockReturnValue(false);
  vi.mocked(isHeld).mockReturnValue(false);
}
function hold(button: 'a' | 'b' | 'up' | 'down' | 'select'): void {
  vi.mocked(isPassPressed).mockImplementation(key => key === button);
  vi.mocked(isHeld).mockImplementation(key => key === button);
}

function world(money = 3000, bag = new Bag()) {
  let cash = money;
  const gameMap = new GameMap();
  gameMap.mapData = structuredClone(mapData);
  const player = new Player();
  player.setTilePosition(2, 10);
  player.direction = 'left';
  const npcs = gameMap.mapData!.npcs.map(n => new Npc({ ...n }));
  const textBox = new TextBox({ closeFrames: () => 17, updateSprites: () => {} });
  const deps: ScriptDeps = {
    gameMap, player, npcs, playerParty: [], playerBag: bag, pikachuFollower: new PikachuFollower(),
    textBox, getMoney: () => cash, setMoney: amount => { cash = amount; },
  };
  const ow: OverworldDeps = {
    ...deps, pikachuFollower: deps.pikachuFollower!, currentMapName: 'ViridianMart',
    findNpc: id => npcs.find(n => n.data.id === id),
  };
  return { deps, ow, bag, money: () => cash };
}

function talk(flag: boolean) {
  const { ow } = world();
  if (flag) setFlag('OAK_GOT_PARCEL');
  hold('a');
  const action = updateOverworld(ow, createOverworldState());
  release();
  return action;
}

describe('DisplayPokemartDialogue on one retained display', () => {
  it('table 1 reminds you about Oak, and table 2 opens the mart with the clerk inventory', () => {
    const before = talk(false);
    expect(before?.type).toBe('script');
    if (before?.type !== 'script') return;
    expect(before.commands.some(c => c.type === 'pokemart')).toBe(false);
    expect(before.commands).toContainEqual({ type: 'printText', program: 'ViridianMartClerkSayHiToOakText', box: 'keep' });

    const after = talk(true);
    expect(after).toEqual({ type: 'script', commands: buildMartScript(clerkItems) });
  });

  it('A and B pressed together on BUY choose BUY, as DoBuySellQuitMenu tests A first (review F-1)', () => {
    const { deps } = world();
    const printed: string[] = [];
    const print = deps.textBox.print.bind(deps.textBox);
    vi.spyOn(deps.textBox, 'print').mockImplementation((source, options) => {
      if ('program' in source) printed.push(source.program);
      print(source, options);
    });
    let menu = -1;
    initScript(buildMartScript(clerkItems));
    updateScript(deps, true);
    for (let frame = 1; menu < 0 && frame < 2000; frame++) {
      updateScript(deps, frame % 2 === 0);
      if (getMartTiles()?.at(13, 0) === 'M') menu = frame;
    }
    expect(menu).toBeGreaterThan(0);
    release();
    updateScript(deps, false);
    updateScript(deps, true);
    vi.mocked(isPassPressed).mockImplementation(key => key === 'a' || key === 'b');
    vi.mocked(isHeld).mockImplementation(key => key === 'a' || key === 'b');
    updateScript(deps, false);
    release();
    expect(getMartTiles()?.at(1, 1)).toBe('▷');
    expect(printed).toEqual(['PokemartGreetingText', 'PokemartBuyingGreetingText']);
    expect(playSFX).toHaveBeenCalledTimes(1);
    expect(playSFX).toHaveBeenCalledWith('press_ab');
  });

  it('greeting at T+23, menus at G, thirds from G+1, read at G+3, then empty-bag SELL returns to BUY', () => {
    const { deps } = world();
    setListScrollOffset(4);
    const tick = vi.spyOn(textBgTransfer, 'tick');
    let frame = 0;
    let glyph = -1;
    let menu = -1;
    let buyAgain = -1;
    let arrowSeen = false;
    let tilesCleared = -1;
    let closeStarted = -1;
    let firstMenuRead = -1;
    const printed: string[] = [];
    const print = deps.textBox.print.bind(deps.textBox);
    vi.spyOn(deps.textBox, 'print').mockImplementation((source, options) => {
      if ('program' in source) printed.push(source.program);
      print(source, options);
    });
    const command = (): string | undefined => {
      const script = getActiveScript();
      return script ? script.commands[script.index].type : undefined;
    };
    const seeGlyph = (at: number) => {
      if (glyph >= 0 || !deps.textBox.active) return;
      if (deps.textBox.saveScreen().buffer.includes('H')) glyph = at;
    };
    const step = (button?: 'a' | 'b' | 'down') => {
      if (button) hold(button); else release();
      const beforeCmd = command();
      const ticks = tick.mock.calls.length;
      const joyBefore = vi.mocked(readJoypad).mock.calls.length;
      const syncBefore = vi.mocked(syncJoypadRead).mock.calls.length;
      updateScript(deps, frame % 2 === 0);
      if (beforeCmd === 'pokemart') {
        const joy = vi.mocked(readJoypad).mock.calls.length - joyBefore;
        const sync = vi.mocked(syncJoypadRead).mock.calls.length - syncBefore;
        // One VBlank. PrintLetterDelay reads again as the next letter starts, so a
        // letter frame can sync twice. The menu never reads on that same frame.
        expect(tick.mock.calls.length - ticks, `ticks at ${frame}`).toBe(1);
        expect(joy, `menu reads at ${frame}`).toBeLessThanOrEqual(1);
        expect(joy > 0 && sync > 0, `two joypad owners at ${frame}`).toBe(false);
      }
      seeGlyph(frame);
      if (menu < 0 && getMartTiles()?.at(13, 0) === 'M') {
        menu = frame;
        const tiles = getMartTiles();
        expect(getListScrollOffset()).toBe(0);
        expect(tiles?.at(1, 1)).toBe('▶');
        expect(tiles?.at(14, 1)).toBe('¥');
        expect(tiles?.visibleAt(13, 0) ?? null).toBeNull();
      }
      if (firstMenuRead < 0 && beforeCmd === 'pokemart' &&
          vi.mocked(readJoypad).mock.calls.length > joyBefore) firstMenuRead = frame;
      if (closeStarted < 0 && deps.textBox.closing) closeStarted = frame;
      if (tilesCleared < 0 && menu >= 0 && !getMartTiles()) tilesCleared = frame;
    };

    initScript(buildMartScript(clerkItems));
    step();
    for (frame = 1; frame < 4000 && getActiveScript(); frame++) {
      const phase = command();
      let button: 'a' | 'b' | 'down' | undefined;
      if (phase === 'pokemart' && menu >= 0 && !printed.includes('PokemartItemBagEmptyText')) {
        if (frame === menu + 3) button = 'down';
        else if (frame === menu + 6) button = 'a';
      } else if (printed.includes('PokemartAnythingElseText') && buyAgain >= 0 && frame === buyAgain + 3
          && !printed.includes('PokemartThankYouText')) {
        button = 'b';
      } else if (printed.includes('PokemartThankYouText') && deps.textBox.isWaitingForInput) {
        button = 'b';
      } else if (printed.includes('PokemartItemBagEmptyText') && deps.textBox.isWaitingForInput
          && !printed.includes('PokemartAnythingElseText')) {
        button = 'a';
      }
      const portion = textBgTransfer.nextPortion;
      step(button);
      if (frame === menu + 1 || frame === menu + 2 || frame === menu + 3) {
        const third = portion;
        const y0 = third * 6;
        let sample: [number, number] | null = null;
        for (let y = y0; y < y0 + 6 && !sample; y++) {
          for (let x = 0; x < 20; x++) if (getMartTiles()?.at(x, y)) { sample = [x, y]; break; }
        }
        if (sample) expect(getMartTiles()?.visibleAt(sample[0], sample[1])).toBe(getMartTiles()?.at(sample[0], sample[1]));
      }
      if (printed[printed.length - 1] === 'PokemartThankYouText' && getMartTiles()?.at(1, 1) === '▷') arrowSeen = true;
      if (buyAgain < 0 && printed.includes('PokemartAnythingElseText') && getMartTiles()?.at(1, 1) === '▶') buyAgain = frame;
    }

    expect(glyph).toBe(23);
    expect(menu).toBeGreaterThan(glyph);
    expect(firstMenuRead).toBe(menu + 3);
    expect(getMartTiles()).toBeNull();
    expect(printed).toEqual([
      'PokemartGreetingText', 'PokemartItemBagEmptyText', 'PokemartAnythingElseText', 'PokemartThankYouText',
    ]);
    expect(arrowSeen).toBe(true);
    expect(buyAgain).toBeGreaterThan(menu);
    expect(getListScrollOffset()).toBe(4);
    expect(closeStarted).toBeGreaterThan(0);
    expect(tilesCleared).toBe(closeStarted + 1);
    expect(playSFX).toHaveBeenCalledWith('press_ab');
    expect(getActiveScript()).toBeNull();
  });

  it('buys a POTION: price question, YES/NO, add before pay, new money at B′+11', () => {
    const show = vi.spyOn(YesNoMenu.prototype, 'show');
    let purchaseLeft = 0;
    vi.mocked(playSFX).mockImplementation(name => {
      if (name === 'purchase') purchaseLeft = 4;
      return Promise.resolve();
    });
    vi.mocked(isSoundFinished).mockImplementation(() => purchaseLeft === 0);
    const { deps, bag, money } = world();
    const printed: string[] = [];
    const print = deps.textBox.print.bind(deps.textBox);
    vi.spyOn(deps.textBox, 'print').mockImplementation((source, options) => {
      if ('program' in source) printed.push(source.program);
      print(source, options);
    });
    const tick = vi.spyOn(textBgTransfer, 'tick');
    let frame = 0;
    let menu = -1;
    let r = -1;
    let take = -1;
    let list = -1;
    let listRead = -1;
    let price = -1;
    let decided = -1;
    let paid = -1;
    let boughtDismiss: number | null = null;
    let sawArrow = false;
    let sawPotion = false;
    let sawPrice = false;
    const readsDuringSound: number[] = [];

    const step = (button?: 'a' | 'b' | 'down') => {
      if (purchaseLeft > 0) purchaseLeft--;
      if (button) hold(button); else release();
      const before = getActiveScript();
      const beforeCmd = before ? before.commands[before.index].type : undefined;
      const ticks = tick.mock.calls.length;
      const joyBefore = vi.mocked(readJoypad).mock.calls.length;
      const syncBefore = vi.mocked(syncJoypadRead).mock.calls.length;
      const sounds = vi.mocked(playSFX).mock.calls.length;
      updateScript(deps, frame % 2 === 0);
      if (beforeCmd === 'pokemart') {
        const joy = vi.mocked(readJoypad).mock.calls.length - joyBefore;
        const sync = vi.mocked(syncJoypadRead).mock.calls.length - syncBefore;
        expect(tick.mock.calls.length - ticks, `ticks ${frame}`).toBe(1);
        expect(joy > 0 && sync > 0, `two owners ${frame}`).toBe(false);
        if (purchaseLeft > 0) readsDuringSound.push(joy + sync);
      }
      if (menu < 0 && getMartTiles()?.at(13, 0) === 'M') menu = frame;
      if (r >= 0 && take < 0 && deps.textBox.saveScreen().buffer.includes('T')) take = frame;
      if (list < 0 && getMartTiles()?.at(4, 2) === '┌') {
        list = frame;
        // The buy menu's space is still showing. The list border waits for its third.
        expect(getMartTiles()?.visibleAt(4, 2)).not.toBe('┌');
        expect(textBgTransfer.enabled).toBe(false);
      }
      if (list >= 0 && frame < list + 11) expect(getMartTiles()?.visibleAt(4, 2)).not.toBe('┌');
      if (list >= 0 && frame === list + 13) expect(getMartTiles()?.visibleAt(4, 2)).toBe('┌');
      if (list >= 0 && listRead < 0 && vi.mocked(readJoypad).mock.calls.length > joyBefore) listRead = frame;
      if (price < 0 && printed.includes('PokemartTellBuyPriceText')) {
        price = frame;
        expect(getMartTiles()?.at(4, 12) ?? null).toBeNull();
        expect(vi.mocked(playSFX).mock.calls.length, 'quantity A is silent').toBe(sounds);
      }
      if (price >= 0 && decided < 0 && deps.textBox.isComplete && printed.includes('PokemartTellBuyPriceText')) {
        decided = frame;
      }
      const box = price >= 0 ? deps.textBox.saveScreen().buffer : null;
      const shown = box?.join('') ?? '';
      if (box && decided < 0 && shown.includes('POTION') && shown.includes('That will be')) sawPotion = true;
      if (box && box[98] === '▼') sawArrow = true;
      if (shown.includes('300') && shown.includes('OK?')) sawPrice = true;
      if (paid < 0 && money() !== 3000) paid = frame;
    };

    initScript(buildMartScript(clerkItems));
    step();
    for (frame = 1; frame < 4000 && boughtDismiss === null; frame++) {
      let button: 'a' | 'b' | 'down' | undefined;
      if (menu >= 0 && r < 0 && frame === menu + 3) button = 'a';
      else if (list >= 0 && frame === list + 16) button = 'down';
      else if (list >= 0 && frame === list + 19) button = 'a';
      else if (list >= 0 && frame === list + 20) button = 'a';
      else if (price >= 0 && decided < 0 && deps.textBox.isWaitingForInput && !printed.includes('PokemartBoughtItemText')) {
        button = 'a';
      } else if (decided >= 0 && frame === decided + 3 && money() === 3000) button = 'a';
      else if (printed.includes('PokemartBoughtItemText') && deps.textBox.isWaitingForInput) button = 'a';
      step(button);
      if (r < 0 && menu >= 0 && getMartTiles()?.at(1, 1) === '▷') r = frame;
      if (boughtDismiss === null && paid >= 0 && getMartTiles()?.at(15, 1) === '2') boughtDismiss = frame;
    }

    expect(r).toBe(menu + 3);
    expect(take).toBe(r + 3);
    expect(list).toBeGreaterThan(take);
    expect(listRead).toBe(list + 16);
    expect(textBgTransfer.enabled).toBe(false);
    expect(show).toHaveBeenCalledWith({ actualRead: true });
    expect(sawPotion).toBe(true);
    expect(sawArrow).toBe(true);
    expect(sawPrice).toBe(true);
    expect(paid).toBe(decided + 3 + 15);
    expect(bag.items).toEqual([{ id: 'POTION', count: 1 }]);
    expect(money()).toBe(2700);
    expect(readsDuringSound).toEqual([0, 0, 0, 0]);
    expect(playSFX).toHaveBeenCalledWith('purchase');
    expect(boughtDismiss).not.toBeNull();
    const dismissed = boughtDismiss ?? 0;
    expect(getMartTiles()?.at(15, 1)).toBe('2');
    expect(getMartTiles()?.visibleAt(15, 1)).toBe('3');
    for (let i = 1; i <= 10; i++) step();
    expect(textBgTransfer.enabled).toBe(true);
    expect(getMartTiles()?.visibleAt(15, 1)).toBe('3');
    for (let i = 0; i < 3; i++) step();
    expect(getMartTiles()?.visibleAt(15, 1)).toBe('2');
    expect(getListScrollOffset()).toBe(0);
    expect(frame).toBeGreaterThan(dismissed);
  });

  function openList(deps: ScriptDeps) {
    const printed: string[] = [];
    const print = deps.textBox.print.bind(deps.textBox);
    vi.spyOn(deps.textBox, 'print').mockImplementation((source, options) => {
      if ('program' in source) printed.push(source.program);
      print(source, options);
    });
    let menu = -1;
    let list = -1;
    const step = (frame: number, button?: 'a' | 'b' | 'down') => {
      if (button) hold(button); else release();
      updateScript(deps, frame % 2 === 0);
      if (menu < 0 && getMartTiles()?.at(13, 0) === 'M') menu = frame;
      if (list < 0 && getMartTiles()?.at(4, 2) === '┌') list = frame;
    };
    initScript(buildMartScript(clerkItems));
    step(0);
    let frame = 1;
    for (; list < 0 && frame < 2000; frame++) step(frame, menu >= 0 && frame === menu + 3 ? 'a' : undefined);
    return { printed, step, list, frame };
  }

  it('B on the quantity and B on YES/NO leave the bag, the money and the scroll offset', () => {
    const { deps, bag, money } = world();
    const run = openList(deps);
    const list = run.list;
    for (let frame = list + 1; frame < list + 16; frame++) run.step(frame);
    run.step(list + 16, 'a');
    expect(getMartTiles()?.at(8, 10)).toBe('×');
    run.step(list + 17, 'b');
    expect(bag.items).toEqual([]);
    expect(money()).toBe(3000);
    expect(run.printed).not.toContain('PokemartTellBuyPriceText');
    expect(getListScrollOffset()).toBe(0);
    expect(textBgTransfer.enabled).toBe(false);
    expect(getMartTiles()?.at(8, 10)).not.toBe('×');

    const second = world();
    const again = openList(second.deps);
    let decided = -1;
    let frame = again.list + 1;
    for (; decided < 0 && frame < again.list + 400; frame++) {
      const button = frame === again.list + 16 || frame === again.list + 17 ? 'a' as const
        : again.printed.includes('PokemartTellBuyPriceText') && second.deps.textBox.isWaitingForInput ? 'a' as const
        : undefined;
      again.step(frame, button);
      if (again.printed.includes('PokemartTellBuyPriceText') && second.deps.textBox.isComplete) decided = frame;
    }
    for (; frame < decided + 3; frame++) again.step(frame);
    again.step(decided + 3, 'b');
    expect(getMartTiles()?.at(8, 10)).toBe('×');
    for (let at = decided + 4; at <= decided + 18; at++) again.step(at);
    expect(second.money()).toBe(3000);
    expect(second.bag.items).toEqual([]);
    expect(playSFX).not.toHaveBeenCalledWith('purchase');
    expect(getMartTiles()?.at(8, 10)).not.toBe('×');
    expect(getListScrollOffset()).toBe(0);
  });

  it('keeps the list scroll and puts the cursor back on the top row', () => {
    const { deps } = world();
    const run = openList(deps);
    const list = run.list;
    const reads = () => vi.mocked(readJoypad).mock.calls.length;
    for (let frame = list + 1; frame < list + 16; frame++) run.step(frame);
    run.step(list + 16, 'down');
    run.step(list + 17);
    run.step(list + 18);
    run.step(list + 19, 'down');
    run.step(list + 20);
    run.step(list + 21);
    const before = reads();
    run.step(list + 22, 'down');
    expect(getListScrollOffset()).toBe(1);
    expect(reads()).toBe(before + 1);
    let nextRead = -1;
    for (let frame = list + 23; frame <= list + 29; frame++) {
      const button = frame === list + 28 ? 'a' as const : frame === list + 29 ? 'b' as const : undefined;
      const prior = reads();
      run.step(frame, button);
      if (nextRead < 0 && reads() > prior) nextRead = frame;
    }
    expect(nextRead).toBe(list + 28);
    expect(getListScrollOffset()).toBe(1);
    for (let at = list + 30; at <= list + 29 + 13; at++) run.step(at);
    expect(getMartTiles()?.at(5, 4)).toBe('▶');
    expect(getMartTiles()?.at(10, 4)).toBe('O');
  });

  it('refuses a POKé BALL when the money is short, then offers the menu again', () => {
    const { deps, bag, money } = world(100);
    const run = openList(deps);
    let decided = -1;
    let frame = run.list + 1;
    for (; decided < 0 && frame < run.list + 500; frame++) {
      let button: 'a' | undefined;
      if (frame === run.list + 16 || frame === run.list + 17) button = 'a';
      else if (run.printed.includes('PokemartTellBuyPriceText') && deps.textBox.isWaitingForInput) button = 'a';
      run.step(frame, button);
      if (run.printed.includes('PokemartTellBuyPriceText') && deps.textBox.isComplete) decided = frame;
    }
    for (; frame < decided + 3; frame++) run.step(frame);
    run.step(decided + 3, 'a');
    for (let at = decided + 4; at <= decided + 18; at++) run.step(at);
    expect(money()).toBe(100);
    expect(bag.items).toEqual([]);
    expect(run.printed).toContain('PokemartNotEnoughMoneyText');
    expect(playSFX).not.toHaveBeenCalledWith('purchase');
    let back = -1;
    for (let at = decided + 19; back < 0 && at < decided + 800; at++) {
      const waiting = run.printed.includes('PokemartNotEnoughMoneyText') && deps.textBox.isWaitingForInput
        && !run.printed.includes('PokemartAnythingElseText');
      run.step(at, waiting ? 'a' : undefined);
      if (run.printed.includes('PokemartAnythingElseText') && getMartTiles()?.at(1, 1) === '▶') back = at;
    }
    expect(back).toBeGreaterThan(decided);
    expect(money()).toBe(100);
  });

  it('a failed buy leaves the bag and the money, and the retry charges once', () => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: 99 }, ...Array.from({ length: BAG_ITEM_CAPACITY - 1 }, (_, i) => (
      { id: `ITEM_${i}`, count: 1 }))];
    const before = structuredClone(bag.items);
    const { deps, money } = world(3000, bag);
    const run = openList(deps);
    let decided = -1;
    let frame = run.list + 1;
    const pressBuy = (at: number) => at === run.list + 16 ? 'down' as const
      : at === run.list + 19 || at === run.list + 20 ? 'a' as const : undefined;
    for (; decided < 0 && frame < run.list + 500; frame++) {
      const button = pressBuy(frame) ?? (
        run.printed.includes('PokemartTellBuyPriceText') && deps.textBox.isWaitingForInput ? 'a' as const : undefined);
      run.step(frame, button);
      if (run.printed.includes('PokemartTellBuyPriceText') && deps.textBox.isComplete) decided = frame;
    }
    for (; frame < decided + 3; frame++) run.step(frame);
    run.step(decided + 3, 'a');
    for (let at = decided + 4; at <= decided + 18; at++) run.step(at);
    expect(bag.items).toEqual(before);
    expect(money()).toBe(3000);
    expect(run.printed).toContain('PokemartItemBagFullText');
    bag.items.pop();
    let menu = -1;
    for (let at = decided + 19; menu < 0 && at < decided + 900; at++) {
      const waiting = deps.textBox.isWaitingForInput && !run.printed.includes('PokemartAnythingElseText');
      run.step(at, waiting ? 'a' : undefined);
      if (run.printed.includes('PokemartAnythingElseText') && getMartTiles()?.at(1, 1) === '▶') menu = at;
    }
    expect(menu).toBeGreaterThan(0);
    let list2 = -1;
    let paid = -1;
    let decided2 = -1;
    for (let at = menu + 1; paid < 0 && at < menu + 900; at++) {
      let button: 'a' | 'down' | undefined;
      if (at === menu + 3) button = 'a';
      else if (list2 >= 0 && at === list2 + 16) button = 'down';
      else if (list2 >= 0 && (at === list2 + 19 || at === list2 + 20)) button = 'a';
      else if (decided2 >= 0 && at === decided2 + 3) button = 'a';
      else if (run.printed.filter(name => name === 'PokemartTellBuyPriceText').length > 1
          && deps.textBox.isWaitingForInput && money() === 3000) button = 'a';
      run.step(at, button);
      if (list2 < 0 && at > menu && getMartTiles()?.at(4, 2) === '┌') list2 = at;
      if (decided2 < 0 && list2 >= 0 && run.printed.filter(name => name === 'PokemartTellBuyPriceText').length > 1
          && deps.textBox.isComplete) decided2 = at;
      if (money() !== 3000) paid = at;
    }
    expect(bag.items[19]).toEqual({ id: 'POTION', count: 1 });
    expect(money()).toBe(2700);
    expect(paid).toBeGreaterThan(menu);
  });

  it('buys one more POTION onto a stack of 99', () => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: 99 }];
    const { deps, money } = world(3000, bag);
    const run = openList(deps);
    let decided = -1;
    let frame = run.list + 1;
    for (; decided < 0 && frame < run.list + 500; frame++) {
      const button = frame === run.list + 16 ? 'down' as const
        : frame === run.list + 19 || frame === run.list + 20 ? 'a' as const
        : run.printed.includes('PokemartTellBuyPriceText') && deps.textBox.isWaitingForInput ? 'a' as const
        : undefined;
      run.step(frame, button);
      if (run.printed.includes('PokemartTellBuyPriceText') && deps.textBox.isComplete) decided = frame;
    }
    for (; frame < decided + 3; frame++) run.step(frame);
    run.step(decided + 3, 'a');
    for (let at = decided + 4; at <= decided + 18; at++) run.step(at);
    expect(bag.items).toEqual([{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }]);
    expect(money()).toBe(2700);
  });

  function openSell(deps: ScriptDeps) {
    const printed: string[] = [];
    const print = deps.textBox.print.bind(deps.textBox);
    vi.spyOn(deps.textBox, 'print').mockImplementation((source, options) => {
      if ('program' in source) printed.push(source.program);
      print(source, options);
    });
    let menu = -1;
    let list = -1;
    const step = (frame: number, button?: 'a' | 'b' | 'up' | 'down' | 'select') => {
      if (button) hold(button); else release();
      updateScript(deps, frame % 2 === 0);
      if (menu < 0 && getMartTiles()?.at(13, 0) === 'M') menu = frame;
      if (list < 0 && getMartTiles()?.at(4, 2) === '┌') list = frame;
    };
    initScript(buildMartScript(clerkItems));
    step(0);
    let frame = 1;
    for (; list < 0 && frame < 2000; frame++) {
      const button = menu >= 0 && frame === menu + 3 ? 'down' as const
        : menu >= 0 && frame === menu + 6 ? 'a' as const : undefined;
      step(frame, button);
    }
    return { printed, step, list, frame };
  }

  it('refuses TOWN MAP, OAK\'s PARCEL and an HM, and shows no quantity box', () => {
    const refuse = (id: string, rowTimes: boolean) => {
      const bag = new Bag();
      bag.items = [{ id, count: 1 }];
      const { deps, money } = world(3000, bag);
      const run = openSell(deps);
      for (let frame = run.list + 1; frame <= run.list + 13; frame++) run.step(frame);
      if (rowTimes) expect(getMartTiles()?.at(14, 5)).not.toBe('×');
      expect(getMartTiles()?.at(8, 10)).not.toBe('×');
      let back = -1;
      for (let frame = run.list + 14; back < 0 && frame < run.list + 800; frame++) {
        const waiting = run.printed.includes('PokemartUnsellableItemText') && deps.textBox.isWaitingForInput
          && !run.printed.includes('PokemartAnythingElseText');
        const button = frame === run.list + 16 || waiting ? 'a' as const : undefined;
        run.step(frame, button);
        if (run.printed.includes('PokemartAnythingElseText') && getMartTiles()?.at(1, 1) === '▶') back = frame;
      }
      expect(back).toBeGreaterThan(run.list);
      expect(getMartTiles()?.at(8, 10)).not.toBe('×');
      expect(run.printed).toContain('PokemartUnsellableItemText');
      expect(run.printed).not.toContain('PokemartTellSellPriceText');
      expect(money()).toBe(3000);
      expect(bag.items).toEqual([{ id, count: 1 }]);
      expect(playSFX).not.toHaveBeenCalledWith('purchase');
    };
    refuse('TOWN_MAP', true);
    refuse('OAKS_PARCEL', true);
    refuse('HM01', false);
  });

  it('sells two POTION at half the total, redraws MONEY before the sound, and removes the count after it', () => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: 5 }];
    let purchaseLeft = 0;
    const readsDuringSound: number[] = [];
    vi.mocked(playSFX).mockImplementation(name => {
      if (name === 'purchase') {
        expect(getMartTiles()?.at(16, 1)).toBe('3');
        expect(bag.items).toEqual([{ id: 'POTION', count: 5 }]);
        purchaseLeft = 4;
      }
      return Promise.resolve();
    });
    vi.mocked(isSoundFinished).mockImplementation(() => purchaseLeft === 0);
    const { deps, money } = world(3000, bag);
    const run = openSell(deps);
    let decided = -1;
    let removed = -1;
    let soundsAtQuantity = -1;
    let sawHalf = false;
    const step = (frame: number, button?: 'a' | 'b' | 'up' | 'down') => {
      if (purchaseLeft > 0) purchaseLeft--;
      const joy = vi.mocked(readJoypad).mock.calls.length;
      const sync = vi.mocked(syncJoypadRead).mock.calls.length;
      const sounds = vi.mocked(playSFX).mock.calls.length;
      run.step(frame, button);
      if (frame === run.list + 18) soundsAtQuantity = vi.mocked(playSFX).mock.calls.length - sounds;
      if (purchaseLeft > 0) {
        readsDuringSound.push((vi.mocked(readJoypad).mock.calls.length - joy)
          + (vi.mocked(syncJoypadRead).mock.calls.length - sync));
      }
    };
    for (let frame = run.list + 1; removed < 0 && frame < run.list + 800; frame++) {
      let button: 'a' | 'up' | undefined;
      if (frame === run.list + 16) button = 'a';
      else if (frame === run.list + 17) button = 'up';
      else if (frame === run.list + 18) button = 'a';
      else if (decided >= 0 && frame === decided + 3) button = 'a';
      else if (run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isWaitingForInput
          && money() === 3000) button = 'a';
      step(frame, button);
      const shown = deps.textBox.saveScreen().buffer.join('');
      if (decided < 0 && run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isComplete) {
        decided = frame;
        sawHalf = shown.includes('300') && shown.includes('for that') && !shown.includes('600');
      }
      if (bag.items[0]?.count === 3) removed = frame;
    }
    expect(soundsAtQuantity).toBe(0);
    expect(sawHalf).toBe(true);
    expect(money()).toBe(3300);
    // Money changes at Y+15. The slot stays until the held purchase sound ends.
    expect(removed).toBe(decided + 18 + 4);
    expect(bag.items).toEqual([{ id: 'POTION', count: 3 }]);
    expect(readsDuringSound).toEqual([0, 0, 0, 0]);
    expect(playSFX).toHaveBeenCalledWith('purchase');
    expect(run.printed).not.toContain('PokemartBoughtItemText');
    expect(run.printed).toContain('PokemonSellingGreetingText');
    expect(getMartTiles()?.at(16, 1)).toBe('3');
    expect(textBgTransfer.enabled).toBe(false);
    for (let i = 1; i <= 10; i++) step(removed + i);
    expect(textBgTransfer.enabled).toBe(true);
    for (let i = 11; i <= 13; i++) step(removed + i);
    expect(getMartTiles()?.visibleAt(16, 1)).toBe('3');
  });

  it('sells the later POTION slot and leaves the earlier stack', () => {
    const bag = new Bag();
    bag.items = [
      { id: 'TOWN_MAP', count: 1 },
      { id: 'POTION', count: 99 },
      { id: 'POTION', count: 1 },
    ];
    const { deps, money } = world(3000, bag);
    const run = openSell(deps);
    let decided = -1;
    let removed = -1;
    for (let frame = run.list + 1; removed < 0 && frame < run.list + 800; frame++) {
      let button: 'a' | 'down' | undefined;
      if (frame === run.list + 16 || frame === run.list + 19) button = 'down';
      else if (frame === run.list + 22 || frame === run.list + 23) button = 'a';
      else if (decided >= 0 && frame === decided + 3) button = 'a';
      else if (run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isWaitingForInput
          && money() === 3000) button = 'a';
      run.step(frame, button);
      if (decided < 0 && run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isComplete) decided = frame;
      if (bag.items.length === 2) removed = frame;
    }
    expect(removed).toBe(decided + 18);
    expect(bag.items).toEqual([{ id: 'TOWN_MAP', count: 1 }, { id: 'POTION', count: 99 }]);
    expect(money()).toBe(3150);
    expect(run.printed).not.toContain('PokemartBoughtItemText');
  });

  it('caps a sale at 999999', () => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: 1 }];
    const { deps, money } = world(999999, bag);
    const run = openSell(deps);
    let decided = -1;
    for (let frame = run.list + 1; money() === 999999 && bag.items.length > 0 && frame < run.list + 800; frame++) {
      let button: 'a' | undefined;
      if (frame === run.list + 16 || frame === run.list + 17) button = 'a';
      else if (decided >= 0 && frame === decided + 3) button = 'a';
      else if (run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isWaitingForInput) button = 'a';
      run.step(frame, button);
      if (decided < 0 && run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isComplete) decided = frame;
    }
    expect(money()).toBe(999999);
    expect(bag.items).toEqual([]);
    expect(playSFX).toHaveBeenCalledWith('purchase');
    expect(run.printed).not.toContain('PokemartBoughtItemText');
  });

  it('selling the last item leaves CANCEL, and the next SELL says the bag is empty', () => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: 1 }];
    const { deps } = world(3000, bag);
    const run = openSell(deps);
    let decided = -1;
    let removed = -1;
    for (let frame = run.list + 1; removed < 0 && frame < run.list + 800; frame++) {
      let button: 'a' | undefined;
      if (frame === run.list + 16 || frame === run.list + 17) button = 'a';
      else if (decided >= 0 && frame === decided + 3) button = 'a';
      else if (run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isWaitingForInput) button = 'a';
      run.step(frame, button);
      if (decided < 0 && run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isComplete) decided = frame;
      if (bag.items.length === 0) removed = frame;
    }
    expect(removed).toBeGreaterThan(0);
    for (let frame = removed + 1; frame <= removed + 10; frame++) run.step(frame);
    expect(getMartTiles()?.at(6, 4)).toBe('C');
    expect(run.printed).not.toContain('PokemartItemBagEmptyText');
    let menu = -1;
    for (let frame = removed + 11; menu < 0 && frame < removed + 800; frame++) {
      const button = frame === removed + 16 ? 'b' as const
        : run.printed.includes('PokemartAnythingElseText') && deps.textBox.isWaitingForInput ? undefined
        : deps.textBox.isWaitingForInput && !run.printed.includes('PokemartAnythingElseText') ? 'a' as const
        : undefined;
      run.step(frame, button);
      if (run.printed.includes('PokemartAnythingElseText') && getMartTiles()?.at(1, 1) === '▶') menu = frame;
    }
    expect(menu).toBeGreaterThan(removed);
    let empty = -1;
    for (let frame = menu + 1; empty < 0 && frame < menu + 800; frame++) {
      const button = frame === menu + 3 ? 'down' as const
        : frame === menu + 6 ? 'a' as const
        : undefined;
      run.step(frame, button);
      if (run.printed.includes('PokemartItemBagEmptyText')) empty = frame;
    }
    expect(empty).toBeGreaterThan(menu);
    expect(bag.items).toEqual([]);
  });

  it('SELECT in the sell list swaps the bag order', () => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: 1 }, { id: 'ANTIDOTE', count: 1 }];
    const { deps } = world(3000, bag);
    const run = openSell(deps);
    const list = run.list;
    for (let frame = list + 1; frame < list + 16; frame++) run.step(frame);
    run.step(list + 16, 'select');
    for (let frame = list + 17; frame < list + 36; frame++) run.step(frame);
    expect(getMartTiles()?.at(5, 4)).not.toBe('▷');
    expect(bag.items.map(item => item.id)).toEqual(['POTION', 'ANTIDOTE']);
    run.step(list + 36);
    expect(getMartTiles()?.at(5, 4)).toBe('▷');
    for (let frame = list + 37; frame < list + 42; frame++) run.step(frame);
    run.step(list + 42, 'down');
    run.step(list + 43);
    run.step(list + 44);
    run.step(list + 45, 'select');
    for (let frame = list + 46; frame < list + 65; frame++) run.step(frame);
    expect(bag.items.map(item => item.id)).toEqual(['POTION', 'ANTIDOTE']);
    run.step(list + 65);
    expect(bag.items.map(item => item.id)).toEqual(['ANTIDOTE', 'POTION']);
    expect(playSFX).not.toHaveBeenCalledWith('purchase');
  });

  it('B on the quantity and B on YES/NO do not sell', () => {
    const stock = () => [
      { id: 'POTION', count: 1 },
      { id: 'ANTIDOTE', count: 1 },
      { id: 'BURN_HEAL', count: 1 },
      { id: 'AWAKENING', count: 1 },
    ];
    const bag = new Bag();
    bag.items = stock();
    const { deps, money } = world(3000, bag);
    const run = openSell(deps);
    const list = run.list;
    for (let frame = list + 1; frame < list + 16; frame++) run.step(frame);
    run.step(list + 16, 'down');
    run.step(list + 17);
    run.step(list + 18);
    run.step(list + 19, 'down');
    run.step(list + 20);
    run.step(list + 21);
    run.step(list + 22, 'down');
    expect(getListScrollOffset()).toBe(1);
    let next = -1;
    const reads = () => vi.mocked(readJoypad).mock.calls.length;
    for (let frame = list + 23; frame <= list + 29; frame++) {
      const button = frame === list + 28 ? 'a' as const : frame === list + 29 ? 'b' as const : undefined;
      const prior = reads();
      run.step(frame, button);
      if (next < 0 && reads() > prior) next = frame;
    }
    expect(next).toBe(list + 28);
    expect(money()).toBe(3000);
    expect(bag.items).toEqual(stock());
    expect(run.printed).not.toContain('PokemartTellSellPriceText');
    expect(getListScrollOffset()).toBe(1);
    for (let frame = list + 30; frame <= list + 29 + 13; frame++) run.step(frame);
    expect(getMartTiles()?.at(5, 4)).toBe('▶');
    expect(getMartTiles()?.at(6, 4)).toBe('A');

    const secondBag = new Bag();
    secondBag.items = [{ id: 'POTION', count: 2 }];
    const second = world(3000, secondBag);
    const again = openSell(second.deps);
    let decided = -1;
    let frame = again.list + 1;
    for (; decided < 0 && frame < again.list + 500; frame++) {
      const button = frame === again.list + 16 || frame === again.list + 17 ? 'a' as const
        : again.printed.includes('PokemartTellSellPriceText') && second.deps.textBox.isWaitingForInput ? 'a' as const
        : undefined;
      again.step(frame, button);
      if (again.printed.includes('PokemartTellSellPriceText') && second.deps.textBox.isComplete) decided = frame;
    }
    for (; frame < decided + 3; frame++) again.step(frame);
    again.step(decided + 3, 'b');
    for (let at = decided + 4; at <= decided + 18; at++) again.step(at);
    expect(second.money()).toBe(3000);
    expect(secondBag.items).toEqual([{ id: 'POTION', count: 2 }]);
    expect(playSFX).not.toHaveBeenCalledWith('purchase');
    expect(getListScrollOffset()).toBe(0);
  });

  it('selling a whole stack reopens the list at the top and leaves the saved offset at 0', () => {
    setListScrollOffset(4);
    setBagSavedMenuItem(2);
    setCurrentMenuItem(1);
    const bag = new Bag();
    bag.items = [
      { id: 'POTION', count: 1 },
      { id: 'ANTIDOTE', count: 1 },
      { id: 'BURN_HEAL', count: 1 },
      { id: 'AWAKENING', count: 1 },
    ];
    const { deps, money } = world(3000, bag);
    const run = openSell(deps);
    const list = run.list;
    for (let frame = list + 1; frame < list + 16; frame++) run.step(frame);
    run.step(list + 16, 'down');
    run.step(list + 17);
    run.step(list + 18);
    run.step(list + 19, 'down');
    run.step(list + 20);
    run.step(list + 21);
    run.step(list + 22, 'down');
    expect(getListScrollOffset()).toBe(1);

    let decided = -1;
    let removed = -1;
    for (let frame = list + 23; removed < 0 && frame < list + 900; frame++) {
      let button: 'a' | undefined;
      if (frame === list + 28 || frame === list + 29) button = 'a';
      else if (decided >= 0 && frame === decided + 3) button = 'a';
      else if (run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isWaitingForInput
          && money() === 3000) button = 'a';
      run.step(frame, button);
      if (decided < 0 && run.printed.includes('PokemartTellSellPriceText') && deps.textBox.isComplete) decided = frame;
      if (bag.items.length === 3) removed = frame;
    }
    expect(removed).toBeGreaterThan(0);
    expect(money()).toBe(3100);
    expect(getListScrollOffset()).toBe(0);
    expect(getSavedListScrollOffset()).toBe(0);
    expect(getBagSavedMenuItem()).toBe(0);
    for (let frame = removed + 1; frame <= removed + 10; frame++) run.step(frame);
    expect(getMartTiles()?.at(6, 4)).toBe('P');
    for (let frame = removed + 11; frame <= removed + 13; frame++) run.step(frame);
    expect(getMartTiles()?.at(5, 4)).toBe('▶');

    let menu = -1;
    for (let frame = removed + 14; menu < 0 && frame < removed + 900; frame++) {
      const button = frame === removed + 16 ? 'b' as const
        : run.printed.includes('PokemartAnythingElseText') && deps.textBox.isWaitingForInput
          && getMartTiles()?.at(1, 1) !== '▶' ? 'a' as const
        : undefined;
      run.step(frame, button);
      if (run.printed.includes('PokemartAnythingElseText') && getMartTiles()?.at(1, 1) === '▶') menu = frame;
    }
    expect(menu).toBeGreaterThan(removed);
    let done = -1;
    for (let frame = menu + 1; done < 0 && frame < menu + 800; frame++) {
      const button = frame === menu + 3 ? 'b' as const
        : run.printed.includes('PokemartThankYouText') && deps.textBox.isWaitingForInput ? 'b' as const
        : undefined;
      run.step(frame, button);
      if (!getActiveScript()) done = frame;
    }
    expect(done).toBeGreaterThan(menu);
    expect(getListScrollOffset()).toBe(0);
  });

  it('every item defined today matches its key-item flag', () => {
    const text = readFileSync(resolve(__dirname, '../../../refs/pokeyellow/data/items/key_items.asm'), 'utf8');
    const flags = new Map<string, boolean>();
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/dbit\s+(TRUE|FALSE)\s*;\s*(\w+)/);
      if (match) flags.set(match[2], match[1] === 'TRUE');
    }
    const alias: Record<string, string> = { PARALYZE_HEAL: 'PARLYZ_HEAL' };
    const definedTrue: string[] = [];
    for (const id of getAllItemIds()) {
      const name = alias[id] ?? id;
      expect(flags.has(name), name).toBe(true);
      expect(isKeyItem(id), id).toBe(flags.get(name));
      if (flags.get(name)) definedTrue.push(id);
    }
    expect(definedTrue).toEqual(['OAKS_PARCEL', 'TOWN_MAP']);
  });
});
