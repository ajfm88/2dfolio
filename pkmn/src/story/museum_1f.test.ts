// V3 checkpoint-02a (notes/88-v3-plan.md §16): Museum1F_Script's trigger and Museum1FPrintScientist1Text.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, tick, until, mon, frameNow } from '../test/main_battle_rig';
import * as audio from '../audio';
import * as menuRender from '../menus/menu_render';
import { renderScriptMenu } from '../script/script_controller';
import { getMapScript, hasFlag, clearFlag, setMapScript } from '../events';
import { museum1FScientist1Text, museum1FScript, Museum1FScript } from './museum_1f';
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
