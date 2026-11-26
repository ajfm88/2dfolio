import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Bag, getAllItemIds } from '../items';
import { getTextProgramData } from '../text/program_data';
import { getTextHandler } from './text_handlers';
import type { TextHandlerContext } from './text_handlers';
import type { ScriptCommand } from '../script/types';
import { host, loadMainBattleRig, resetMainBattleRig, until, frameNow } from '../test/main_battle_rig';
import { getActiveScript } from '../script/script_controller';
import { hasFlag } from '../events';
import { route2GateOaksAideText, viridianCityFisherText } from './machine_gifts';

const ctx = (ownedCount: number, flags: string[] = []): TextHandlerContext => ({
  hasFlag: flag => flags.includes(flag), bag: new Bag(), ownedCount,
  facing: 'up', step: { x: 0, y: 0 }, party: [],
});
const prints = (commands: ScriptCommand[] = []) => commands.flatMap(c => c.type === 'printText' ? [c.program] : []);
const choice = (commands: ScriptCommand[]) => {
  const command = commands.find(c => c.type === 'yesNoChoice');
  if (command?.type !== 'yesNoChoice') throw new Error('missing Aide choice');
  return command;
};
const gift = (commands: ScriptCommand[]) => {
  const command = commands.find(c => c.type === 'giveItem');
  if (command?.type !== 'giveItem') throw new Error('missing gift');
  return command;
};

describe('A2 machine gifts', () => {
  it('Aide counts owned species: NO, nine, ten, and repeat have the cartridge branches', () => {
    const nine = route2GateOaksAideText(ctx(9));
    expect(prints(nine)).toEqual(['OaksAideHiText']);
    expect(prints(choice(nine).no)).toEqual(['OaksAideComeBackText']);
    expect(prints(choice(nine).yes)).toEqual(['OaksAideUhOhText']);
    const ten = route2GateOaksAideText(ctx(10));
    expect(prints(choice(ten).yes)).toEqual(['OaksAideHereYouGoText']);
    const result = gift(choice(ten).yes);
    expect(result.itemId).toBe('HM05');
    expect(prints(result.successCommands)).toEqual(['OaksAideGotItemText', 'Route2GateOaksAideText.FlashExplanationText']);
    expect(result.successCommands).toContainEqual({ type: 'setFlag', flag: 'GOT_HM05' });
    expect(prints(result.failCommands)).toEqual(['OaksAideNoRoomText']);
    expect(result.failCommands?.some(c => c.type === 'setFlag')).toBe(false);
    expect(prints(route2GateOaksAideText(ctx(10, ['GOT_HM05'])))).toEqual(['Route2GateOaksAideText.FlashExplanationText']);
    const hi = ten[1];
    expect(hi).toMatchObject({ type: 'printText', bindings: {
      oaksAideRequirement: 10, oaksAideOwnedCount: 10, oaksAideRewardItemName: 'HM05',
    } });
  });

  it('fisherman gives TM42 once; full bag keeps the gift available', () => {
    const first = viridianCityFisherText(ctx(0));
    expect(prints(first)).toEqual(['ViridianCityPrintFisherText.YouCanHaveThisText']);
    const result = gift(first);
    expect(result.itemId).toBe('TM42');
    expect(prints(result.successCommands)).toEqual(['ViridianCityPrintFisherText.ReceivedTM42Text']);
    expect(result.successCommands).toContainEqual({ type: 'setFlag', flag: 'GOT_TM42' });
    expect(prints(result.failCommands)).toEqual(['ViridianCityPrintFisherText.TM42NoRoomText']);
    expect(result.failCommands?.some(c => c.type === 'setFlag')).toBe(false);
    expect(prints(viridianCityFisherText(ctx(0, ['GOT_TM42'])))).toEqual(['ViridianCityPrintFisherText.TM42ExplanationText']);
  });

  it('each gift text is extracted and the item sounds belong to the received text programs', () => {
    const p = getTextProgramData().programs;
    for (const name of ['Hi', 'UhOh', 'ComeBack', 'HereYouGo', 'GotItem', 'NoRoom']) {
      expect(p[`OaksAide${name}Text`]).toBeDefined();
      expect(p[`_OaksAide${name}Text`]).toBeDefined();
    }
    expect(p.OaksAideGotItemText).toContainEqual({ op: 'sound', sound: 'get_item1' });
    expect(p['ViridianCityPrintFisherText.ReceivedTM42Text']).toContainEqual({ op: 'sound', sound: 'get_item2' });
    expect(p._OaksAideHiText).toContainEqual({ op: 'decimal', binding: 'oaksAideRequirement', bytes: 1, digits: 3 });
  });

  beforeAll(() => loadMainBattleRig());
  it.each([
    ['Route2Gate', 1, 3, 'down', 1],
    ['ViridianCity', 6, 24, 'up', 6],
  ] as const)('%s NPC text %i reaches the registered handler through the field', async (map, x, y, direction, id) => {
    resetMainBattleRig();
    const data = JSON.parse(readFileSync(`data/maps/${map}.json`, 'utf8'));
    expect(data.npcs.some((n: { textId: number }) => n.textId === id)).toBe(true);
    expect(getTextHandler(map, id)).toBeDefined();
    await host.handleWarpLoad(map, 0, { x, y }); await host.finishFade(); host.state = 'overworld';
    host.ow.justWarped = false; host.ow.doorExitStep = false; host.player.direction = direction;
    until(() => host.state === 'script', () => ['a'], 200);
    expect(getActiveScript()?.commands[1]).toMatchObject({ type: 'printText',
      program: map === 'Route2Gate' ? 'OaksAideHiText' : 'ViridianCityPrintFisherText.YouCanHaveThisText' });
  });

  it.each([
    ['Route2Gate', 'HM05', 'GOT_HM05', 10],
    ['ViridianCity', 'TM42', 'GOT_TM42', 0],
  ] as const)('%s full bag leaves %s available, then a second attempt gives it once', async (map, item, flag, owned) => {
    resetMainBattleRig();
    await host.handleWarpLoad(map, 0); await host.finishFade(); host.state = 'overworld';
    const build = () => map === 'Route2Gate' ? route2GateOaksAideText(ctx(owned, hasFlag(flag) ? [flag] : []))
      : viridianCityFisherText(ctx(owned, hasFlag(flag) ? [flag] : []));
    const pulse = () => frameNow() % 4 === 0 ? ['a' as const] : [];
    for (const id of getAllItemIds().slice(0, 20)) host.bag.add(id);
    host.startScript(build());
    until(() => !getActiveScript() && host.state === 'overworld', pulse, 8000);
    expect(host.bag.getCount(item)).toBe(0);
    expect(hasFlag(flag)).toBe(false);
    host.bag.items.splice(0);
    host.startScript(build());
    until(() => !getActiveScript() && host.state === 'overworld', pulse, 8000);
    expect(host.bag.getCount(item)).toBe(1);
    expect(hasFlag(flag)).toBe(true);
    expect(prints(build())).toEqual([map === 'Route2Gate' ?
      'Route2GateOaksAideText.FlashExplanationText' : 'ViridianCityPrintFisherText.TM42ExplanationText']);
  });
});
