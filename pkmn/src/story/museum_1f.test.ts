// V3 checkpoint-02a (notes/88-v3-plan.md §16): Museum1F_Script's trigger and Museum1FPrintScientist1Text.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, tick, until, mon, frameNow } from '../test/main_battle_rig';
import * as audio from '../audio';
import * as menuRender from '../menus/menu_render';
import { renderScriptMenu, getActiveScript } from '../script/script_controller';
import { isObjectHidden, restoreHiddenObjects, setFlag } from '../events';
import { museum2FHikerText } from './small_text_handlers';
import { restorePikachuHappiness } from '../pikachu/pikachu_happiness';
import type { BattlePokemon } from '../battle';
import { TextBox } from '../text';
import { captureNative, fillRect } from '../renderer/renderer';
import type { RasterCanvas } from '../test/raster_canvas';
import { getMapScript, hasFlag, clearFlag, setMapScript } from '../events';
import { museum1FScientist1Text, museum1FScientist2Text, museum1FScript, Museum1FScript } from './museum_1f';
import { moneyBoxLayout } from '../menus/pokemart';
import { getTextProgramData } from '../text/program_data';
import { Bag } from '../items';
import type { ScriptCommand } from '../script/types';
import type { TextHandlerContext } from './text_handlers';

const ctx = (x: number, y: number, flags: string[] = []): TextHandlerContext => ({ hasFlag: f => flags.includes(f),
  bag: new Bag(), ownedCount: 0, facing: 'up', step: { x, y }, party: [] });
const programs = (commands: ScriptCommand[]): string[] => commands.flatMap(c => c.type === 'printText' ? [c.program]
  : c.type === 'yesNoChoice' ? [...programs(c.yes), ...programs(c.no)]
  : c.type === 'ifEnoughMoney' ? [...programs(c.yes), ...programs(c.no)] : []);
const T = 'Museum1FPrintScientist1Text.';
const pulse = (key: 'a' | 'b') => () => (frameNow() % 4 === 0 ? [key] : []);

beforeAll(() => loadMainBattleRig()); // the text programs and the real game

describe('DisplayMoneyBox as a script box (text_box.asm)', () => {
  it('draws the Mart geometry with PrintBCDNumber at (12,1): leading zeroes skipped, ¥ before the first digit', () => {
    expect(moneyBoxLayout(3000)).toEqual({ x: 11, y: 0, width: 9, height: 3, labels: [{ x: 13, y: 0, text: 'MONEY' },
      { x: 14, y: 1, text: '¥' }, { x: 15, y: 1, text: '3' }, { x: 16, y: 1, text: '0' }, { x: 17, y: 1, text: '0' }, { x: 18, y: 1, text: '0' }] });
    expect(moneyBoxLayout(0).labels.slice(1)).toEqual([{ x: 17, y: 1, text: '¥' }, { x: 18, y: 1, text: '0' }]);
  });
});

describe('Museum1FPrintScientist1Text branches (Museum1F_2.asm:1-99)', () => {
  it.each([[13, 4], [12, 3]])('behind the counter at (%i,%i): the amber question, YES → lab, NO → tree sap', (x, y) => {
    const [, first, choice] = museum1FScientist1Text(ctx(x, y));
    expect(first).toEqual({ type: 'printText', program: T + 'DoYouKnowWhatAmberIsText' });
    if (choice.type !== 'yesNoChoice') throw new Error('Expected YES/NO');
    expect(programs(choice.yes)).toEqual([T + 'TheresALabSomewhereText']);
    expect(programs(choice.no)).toEqual([T + 'AmberIsFossilizedTreeSapText']);
  });
  it.each([[9, 4], [10, 4], [11, 4]])('row 4 at (%i,4) without a ticket: MONEY box, the question, buy or refuse', (x, y) => {
    const commands = museum1FScientist1Text(ctx(x, y));
    expect(commands.map(c => c.type)).toEqual(['displayOpen', 'moneyBox', 'printText', 'yesNoChoice']);
    const choice = commands[3]; if (choice.type !== 'yesNoChoice') throw new Error('Expected YES/NO');
    const [money] = choice.yes; if (money.type !== 'ifEnoughMoney') throw new Error('Expected HasEnoughMoney');
    expect(money.amount).toBe(50);
    expect(money.yes.map(c => c.type)).toEqual(['printText', 'setFlag', 'subtractMoney', 'moneyBox', 'sound', 'setMapScript', 'displayClose']);
    expect(money.no.map(c => c.type)).toEqual(['printText', 'printText', 'updateSprites', 'displayClose', 'pushPlayer']);
    expect(choice.no.map(c => c.type)).toEqual(['printText', 'updateSprites', 'displayClose', 'pushPlayer']);
    for (const label of programs(commands)) expect(getTextProgramData().programs[label], label).toBeDefined();
  });
  it('Museum1F_Script triggers on (9,4) and (10,4) in DEFAULT only', () => {
    setMapScript('Museum1F', Museum1FScript.DEFAULT);
    expect([[9, 4], [10, 4], [11, 4], [10, 5], [8, 4]].map(([x, y]) => museum1FScript(ctx(x, y)) !== null)).toEqual([true, true, false, false, false]);
    setMapScript('Museum1F', Museum1FScript.NOOP);
    expect(museum1FScript(ctx(10, 4))).toBeNull();
    setMapScript('Museum1F', Museum1FScript.DEFAULT);
  });
  it('row 4 with the ticket, or anywhere else: plenty of time / the other side', () => {
    expect(programs(museum1FScientist1Text(ctx(10, 4, ['BOUGHT_MUSEUM_TICKET'])))).toEqual([T + 'TakePlentyOfTimeText']);
    expect(programs(museum1FScientist1Text(ctx(12, 5)))).toEqual([T + 'GoToOtherSideText']);
    expect(programs(museum1FScientist1Text(ctx(12, 5, ['BOUGHT_MUSEUM_TICKET'])))).toEqual([T + 'TakePlentyOfTimeText']);
  });
});

describe('the ticket through main (Museum1F_Script on (9,4)/(10,4))', () => {
  beforeEach(() => { resetMainBattleRig(); clearFlag('BOUGHT_MUSEUM_TICKET'); });
  afterEach(() => { host.reset(); vi.restoreAllMocks(); });
  async function stepOntoTrigger(money: number) {
    host.playerParty.push(mon()); host.money = money;
    await host.handleWarpLoad('Museum1F', 0, { x: 10, y: 5 }); await host.finishFade(); host.state = 'overworld';
    host.ow.justWarped = false; host.ow.doorExitStep = false;
    expect(museum1FScript(ctx(10, 5))).toBeNull();
    until(() => host.state === 'script', () => ['up'], 200);
    expect([host.player.mapStepX, host.player.mapStepY]).toEqual([10, 4]);
  }
  it('"MONEY" replaces the border tiles at (13,0)-(17,0); the border resumes on both sides (MONEY_BOX_TEMPLATE)', async () => {
    await stepOntoTrigger(3000);
    for (let i = 0; i < 30; i++) tick();
    const cell = (draw: () => void, col: number): string => {
      const canvas = captureNative(draw) as unknown as RasterCanvas; const out: number[] = [];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out.push(...canvas.pixel(col * 8 + x, y));
      return out.join(',');
    };
    const emptyBox = () => menuRender.drawBox(11 * 8, 0, 9 * 8, 3 * 8);
    const lettersOnWhite = () => { fillRect(0, 0, 160, 144, 0); menuRender.drawText('MONEY', 13 * 8, 0); };
    const blank = cell(() => fillRect(0, 0, 160, 144, 0), 13);
    for (let col = 13; col <= 17; col++) {
      expect(cell(lettersOnWhite, col)).not.toBe(blank); // the font is really loaded: each cell holds a letter
      expect(cell(lettersOnWhite, col)).not.toBe(cell(emptyBox, col));
      expect(cell(renderScriptMenu, col)).toBe(cell(lettersOnWhite, col));
    }
    for (const col of [12, 18]) expect(cell(renderScriptMenu, col)).toBe(cell(emptyBox, col));
  });
  it.each([[3000, 2950], [50, 0]] as const)('YES with ¥%i (HasEnoughMoney: equal is enough): ¥50 paid, the ticket, SFX_PURCHASE, NOOP', async (money, after) => {
    const sfx = vi.spyOn(audio, 'playSFX'), box = vi.spyOn(menuRender, 'drawBox');
    await stepOntoTrigger(money);
    for (let i = 0; i < 30; i++) tick();
    renderScriptMenu(); expect(box).toHaveBeenLastCalledWith(11 * 8, 0, 9 * 8, 3 * 8); // the MONEY box is up
    until(() => host.state !== 'script', pulse('a'), 2000);
    box.mockClear(); renderScriptMenu(); expect(box).not.toHaveBeenCalled(); // CloseTextDisplay took it with the text
    expect(host.money).toBe(after); expect(hasFlag('BOUGHT_MUSEUM_TICKET')).toBe(true);
    expect(sfx.mock.calls.map(([name]) => name)).toContain('purchase');
    expect(getMapScript('Museum1F')).toBe(Museum1FScript.NOOP);
    expect([host.player.mapStepX, host.player.mapStepY]).toEqual([10, 4]);
    for (let i = 0; i < 60; i++) tick();
    expect(host.state).toBe('overworld');
  });
  it.each([['NO', 3000, 'b'], ['too little money', 30, 'a']] as const)('%s: "Come again", one step ↓, no charge', async (_, money, key) => {
    await stepOntoTrigger(money);
    until(() => host.state !== 'script', pulse(key), 2000);
    for (let i = 0; i < 40; i++) tick();
    expect(host.money).toBe(money); expect(hasFlag('BOUGHT_MUSEUM_TICKET')).toBe(false);
    expect(getMapScript('Museum1F')).toBe(Museum1FScript.DEFAULT);
    expect([host.player.mapStepX, host.player.mapStepY]).toEqual([10, 5]);
  });
});

describe('the Old Amber scientist (Museum1FPrintScientist2Text) and the 2F hiker (Museum2FHikerText)', () => {
  const A = 'Museum1FPrintScientist2Text.';
  const hold = () => (frameNow() % 8 < 4 ? ['a' as const] : []); // the overworld reads the joypad on standing passes, every second frame
  const amberNpc = () => host.overworldDeps().npcs.find(n => n.data.id === 'old_amber')!;
  beforeEach(() => { resetMainBattleRig(); clearFlag('GOT_OLD_AMBER'); clearFlag('BATTLED_RIVAL_IN_OAKS_LAB'); restoreHiddenObjects([]); });
  afterEach(() => { host.reset(); restoreHiddenObjects([]); vi.restoreAllMocks(); });
  async function talkToScientist() {
    host.playerParty.push(mon());
    await host.handleWarpLoad('Museum1F', 0, { x: 15, y: 3 }); await host.finishFade(); host.state = 'overworld';
    host.ow.justWarped = false; host.ow.doorExitStep = false; host.player.direction = 'up';
    until(() => host.state === 'script', hold, 200);
  }

  it('runs the ASM order: first text, GiveItem, SetEvent, HideObject, its UpdateSprites, the received text', () => {
    const flow = museum1FScientist2Text(ctx(15, 3));
    expect(flow.map(c => c.type)).toEqual(['displayOpen', 'printText', 'giveItem', 'displayClose']);
    expect(flow[1]).toEqual({ type: 'printText', program: A + 'TakeThisToAPokemonLabText' });
    expect(flow[2]).toEqual({ type: 'giveItem', itemId: 'OLD_AMBER',
      successCommands: [{ type: 'setFlag', flag: 'GOT_OLD_AMBER' }, { type: 'hideObject', map: 'Museum1F', npcId: 'old_amber' },
        { type: 'updateSprites' }, { type: 'printText', program: A + 'ReceivedOldAmberText' }],
      failCommands: [{ type: 'printText', program: A + 'YouDontHaveSpaceText' }] });
    for (const name of ['TakeThisToAPokemonLab', 'ReceivedOldAmber', 'GetTheOldAmberCheck', 'YouDontHaveSpace'])
      expect(getTextProgramData().programs[`${A}${name}Text`], name).toBeDefined();
  });
  it('after the gift he only says to get it checked', () => {
    const flow = museum1FScientist2Text(ctx(15, 3, ['GOT_OLD_AMBER']));
    expect(flow.map(c => c.type)).toEqual(['displayOpen', 'printText', 'displayClose']);
    expect(flow[1]).toEqual({ type: 'printText', program: A + 'GetTheOldAmberCheckText' });
  });
  it('gives the amber through main: the flag, the bag, the display gone at once, and still gone after leaving', async () => {
    const prints = vi.spyOn(TextBox.prototype, 'print');
    await talkToScientist();
    until(() => hasFlag('GOT_OLD_AMBER'), pulse('a'), 4000);
    expect(amberNpc().hidden).toBe(true); expect(isObjectHidden('Museum1F', 'old_amber')).toBe(true);
    expect(host.bag.getCount('OLD_AMBER')).toBe(1);
    // GiveItem through UpdateSprites cost no frame: the received text has already started in this tick.
    expect(prints.mock.calls[prints.mock.calls.length - 1][0]).toEqual({ program: A + 'ReceivedOldAmberText' });
    until(() => host.state !== 'script', pulse('a'), 2000);
    await host.handleWarpLoad('PewterCity', 0); await host.finishFade();
    await host.handleWarpLoad('Museum1F', 0, { x: 15, y: 3 }); await host.finishFade();
    expect(amberNpc().hidden).toBe(true);
  });
  it('keeps the amber on a full bag: no-space text, no flag, no item, and he asks again', async () => {
    for (let i = 0; i < 20; i++) expect(host.bag.add(`ITEM_${i}`)).toBe(true);
    await talkToScientist();
    until(() => host.state !== 'script', pulse('a'), 6000);
    expect(hasFlag('GOT_OLD_AMBER')).toBe(false); expect(host.bag.getCount('OLD_AMBER')).toBe(0);
    expect(amberNpc().hidden).toBeFalsy(); expect(isObjectHidden('Museum1F', 'old_amber')).toBe(false);
  });

  const hiker = (party: BattlePokemon[]) => museum2FHikerText({ ...ctx(12, 6), party }).flatMap(c => c.type === 'printText' ? [c.program] : []);
  it.each([[100, 2], [101, 3], [255, 3], [0, 2]])('hiker, the starter alive at happiness %i: text %i (cp 101)', (happiness, line) => {
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB'); restorePikachuHappiness(happiness, 0x80);
    expect(hiker([mon()])).toEqual([`Museum2FHikerText${line}`]);
    expect(getTextProgramData().programs[`Museum2FHikerText${line}`]).toBeDefined();
  });
  it('hiker, no starter alive in the party: text 1, whatever the happiness', () => {
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB'); restorePikachuHappiness(200, 0x80);
    const fainted = mon(); fainted.currentHp = 0;
    expect(hiker([])).toEqual(['Museum2FHikerText1']);
    expect(hiker([mon(1)])).toEqual(['Museum2FHikerText1']);
    expect(hiker([fainted])).toEqual(['Museum2FHikerText1']);
    expect(getTextProgramData().programs['Museum2FHikerText1']).toBeDefined();
  });
  it('hiker through the talk path: map text 5 runs the handler on an auto-box map', async () => {
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB'); restorePikachuHappiness(101, 0x80); host.playerParty.push(mon());
    await host.handleWarpLoad('Museum2F', 0, { x: 12, y: 6 }); await host.finishFade(); host.state = 'overworld';
    host.ow.justWarped = false; host.ow.doorExitStep = false; host.player.direction = 'up';
    until(() => host.state === 'script', hold, 200);
    const script = getActiveScript()!;
    expect(script.commands.filter(c => c.type === 'printText')).toEqual([{ type: 'printText', program: 'Museum2FHikerText3' }]);
    expect(script.commands[0]).toMatchObject({ type: 'displayOpen', autoBox: true });
  });
});
