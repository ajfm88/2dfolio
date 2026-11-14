// V3 checkpoint-03a (notes/88-v3-plan.md §32): the gym guide, the statues and the Jr. Trainer. 03b (§36): Brock. 05 (§45): his win.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { host, loadMainBattleRig, resetMainBattleRig, until, mon, frameNow, tick } from '../test/main_battle_rig';
import { getActiveScript } from '../script/script_controller';
import { clearFlag, getMapScript, setFlag, setMapScript } from '../events';
import { TOGGLE, isObjectHidden, isToggledOff } from '../overworld/toggleable_objects';
import { TextBox } from '../text';
import { getTextProgramData } from '../text/program_data';
import { TRAINER_MAPS, TRAINER_SCRIPT } from '../overworld/map_trainers';
import { Bag } from '../items';
import type { MapData } from '../core/types';
import type { ScriptCommand } from '../script/types';
import type { TextHandlerContext } from './text_handlers';
import { interactionDisplay } from './hidden_events';
import * as audio from '../audio';
import * as overworld from '../overworld';
import { hasFlag } from '../events';
import { getTextHandler } from './text_handlers';
import { getTrainerClass } from '../battle';
import { pewterGymBrockPostBattle } from './pewter_gym';
import { A } from '../battle/battle_state';
import { joyIgnore, setJoyIgnore } from '../input/joy_ignore';
import { getAllItemIds } from '../items';

const ctx = (flags: string[] = [], party: TextHandlerContext['party'] = []): TextHandlerContext => ({ hasFlag: f => flags.includes(f),
  bag: new Bag(), ownedCount: 0, facing: 'up', step: { x: 7, y: 11 }, party });
const programs = (commands: ScriptCommand[]) => commands.map(c => c.type === 'printText' ? c.program : c.type);
const choice = (commands: ScriptCommand[]) => {
  const c = commands[2]; if (c.type !== 'yesNoChoice') throw new Error('Expected YES/NO'); return c;
};
const map = () => JSON.parse(readFileSync('data/maps/PewterGym.json', 'utf8')) as MapData & { hiddenEvents: object[] };
const shelf = { tileset: 'GYM', tileTwoAbove: 0 };
const NAMES = { gymCityName: 'PEWTER CITY', gymLeaderName: 'BROCK' };

beforeAll(() => loadMainBattleRig());
// Through the registry, so the game's own import chain is what registers it (the rig loads main).
const pewterGymGuideText = (c: TextHandlerContext): ScriptCommand[] => getTextHandler('PewterGym', 3)!(c);

describe('PewterGymGuideText', () => {
  beforeEach(() => setFlag('BATTLED_RIVAL_IN_OAKS_LAB'));
  afterEach(() => clearFlag('BATTLED_RIVAL_IN_OAKS_LAB'));
  it('with the badge: only the post-battle line', () => {
    expect(programs(pewterGymGuideText(ctx(['BADGE_1'], [mon()])))).toEqual(['displayOpen', 'PewterGymGuidePostBattleText', 'displayClose']);
  });
  it('asks first; YES with no starter alive: "Let\'s get happening", then the advice', () => {
    const flow = pewterGymGuideText(ctx());
    expect(programs(flow)).toEqual(['displayOpen', 'PewterGymGuidePreAdviceText', 'yesNoChoice', 'displayClose']);
    expect(programs(choice(flow).yes)).toEqual(['PewterGymGuideBeginAdviceText', 'PewterGymGuideAdviceText']);
  });
  it('YES with the starter alive: only the Pikachu line', () => {
    expect(programs(choice(pewterGymGuideText(ctx([], [mon()]))).yes)).toEqual(['PewterGymGuyPikachuText']);
  });
  it.each([false, true])('NO: "It\'s a free service", then the advice, whatever the party (starter %s)', starter => {
    expect(programs(choice(pewterGymGuideText(ctx([], starter ? [mon()] : []))).no)).toEqual(['PewterGymGuideFreeServiceText', 'PewterGymGuideAdviceText']);
  });
  it('a fainted starter counts as no starter', () => {
    const fainted = mon(); fainted.currentHp = 0;
    expect(programs(choice(pewterGymGuideText(ctx([], [fainted]))).yes)).toEqual(['PewterGymGuideBeginAdviceText', 'PewterGymGuideAdviceText']);
  });
  it('every program is extracted', () => {
    for (const name of ['PreAdvice', 'BeginAdvice', 'Advice', 'FreeService', 'PostBattle'])
      expect(getTextProgramData().programs[`PewterGymGuide${name}Text`], name).toBeDefined();
    expect(getTextProgramData().programs.PewterGymGuyPikachuText).toBeDefined();
  });
});

describe('GymStatues in Pewter Gym (gym_statues.asm)', () => {
  it.each([[[], 'GymStatueText1'], [['BADGE_1'], 'GymStatueText2']] as const)('flags %j: %s, with the names in the two RAM strings', (flags, program) => {
    expect(interactionDisplay({ scriptId: 'PEWTER_GYM_STATUES' }, ctx([...flags]), shelf)).toEqual([{ type: 'displayOpen', autoBox: true },
      { type: 'printText', box: 'keep', program, bindings: NAMES }, { type: 'displayClose', outerWait: true }]);
    expect(getTextProgramData().programs[program]).toBeDefined();
  });
  it('the map lists both, facing up only', () => {
    expect(map().hiddenEvents).toEqual([3, 6].map(x => ({ x, y: 10, scriptId: 'PEWTER_GYM_STATUES', facing: 'up' })));
  });
});

describe('Pewter Gym through main', () => {
  const hold = () => (frameNow() % 8 < 4 ? ['a' as const] : []);
  beforeEach(() => { resetMainBattleRig(); setFlag('BATTLED_RIVAL_IN_OAKS_LAB'); setMapScript('PewterGym', TRAINER_SCRIPT.DEFAULT); });
  afterEach(() => { host.reset(); clearFlag('BATTLED_RIVAL_IN_OAKS_LAB'); setMapScript('PewterGym', TRAINER_SCRIPT.DEFAULT); vi.restoreAllMocks(); });
  async function stand(x: number, y: number, direction: 'up' | 'left') {
    host.playerParty.push(mon());
    await host.handleWarpLoad('PewterGym', 0, { x, y }); await host.finishFade(); host.state = 'overworld';
    host.ow.justWarped = false; host.ow.doorExitStep = false; host.player.direction = direction;
  }
  it('the statue reads from below, with both names', async () => {
    const prints = vi.spyOn(TextBox.prototype, 'print');
    await stand(3, 11, 'up');
    until(() => prints.mock.calls.length > 0, hold, 200);
    expect(prints.mock.calls[0][0]).toEqual({ program: 'GymStatueText1' });
    expect(prints.mock.calls[0][1]).toMatchObject({ bindings: NAMES });
  });
  it('the statue says nothing from the side', async () => {
    await stand(4, 10, 'left');
    const start = frameNow();
    until(() => frameNow() >= start + 40, hold, 41);
    expect(host.state).toBe('overworld');
  });
  it('the guide runs the handler on map text 3', async () => {
    await stand(7, 11, 'up');
    until(() => host.state !== 'overworld', hold, 200);
    expect(host.state).toBe('script');
    expect(getActiveScript()!.commands.map(c => c.type)).toEqual(['displayOpen', 'printText', 'yesNoChoice', 'displayClose']);
  });
  it('the Jr. Trainer: in the object list, on a trainer map, and he spots the player 4 tiles right', async () => {
    expect(map().npcs.map(n => n.id)).toEqual(['brock', 'cooltrainer_m', 'gym_guide']);
    expect(map().npcs[1]).toMatchObject({ trainerClass: 'JR_TRAINER_M', trainerParty: 0, sightRange: 5, direction: 'right',
      endBattleTextLabels: { win: 'PewterGymCooltrainerMEndBattleText', lose: 'PewterGymCooltrainerMEndBattleText' } });
    expect(TRAINER_MAPS.has('PewterGym')).toBe(true);
    await stand(7, 6, 'left');
    until(() => getMapScript('PewterGym') === TRAINER_SCRIPT.START_BATTLE, () => [], 60);
    expect(host.ow.engagedNpc?.data.id).toBe('cooltrainer_m');
  });
  it('the battle he starts is JR_TRAINER_M', async () => {
    await stand(7, 6, 'left');
    until(() => host.state === 'battle', () => (frameNow() % 4 === 0 ? ['a'] : []), 3000);
    expect(host.session!.state.wCurOpponent).toBe(getTrainerClass('JR_TRAINER_M')!.id + 200);
  });
  describe('Brock (PewterGymBrockText)', () => {
    const END = 'PewterGymBrockReceivedBoulderBadgeText';
    const brock = () => getTextHandler('PewterGym', 1)!(ctx());
    const WGYM = 0xd05b;
    const setJoyIgnoreNone = () => setJoyIgnore('none');
    const settleAfterTalk = () => until(() => host.state === 'overworld' && !getActiveScript(), pulse, 8000);
    const pulse = () => (frameNow() % 4 === 0 ? ['a' as const] : []);
    async function talk(fighter = mon()) {
      host.playerParty.push(fighter);
      await host.handleWarpLoad('PewterGym', 0, { x: 4, y: 2 }); await host.finishFade(); host.state = 'overworld';
      host.ow.justWarped = false; host.ow.doorExitStep = false; host.player.direction = 'up';
      until(() => host.state === 'script', hold, 200);
    }
    const brockNpc = () => host.overworldDeps().npcs.find(n => n.data.id === 'brock')!;
    it('his commands: the text, the meet music, the post-battle script, the close, then the battle as gym leader 1', () => {
      expect(getTextHandler('PewterGym', 1)).toBeDefined();
      const flow = brock();
      expect(programs(flow)).toEqual(['displayOpen', 'PewterGymBrockText.PreBattleText', 'callback', 'setMapScript', 'displayClose', 'startBattle']);
      expect(flow[0]).toEqual({ type: 'displayOpen', autoBox: true });
      expect(flow[3]).toEqual({ type: 'setMapScript', map: 'PewterGym', state: TRAINER_SCRIPT.BROCK_POST_BATTLE });
      expect(flow[4]).toEqual({ type: 'displayClose', outerWait: true });
      expect(flow[5]).toEqual({ type: 'startBattle', trainerClass: 'BROCK', partyIndex: 0, gymLeaderNo: 1, endBattleLabels: { win: END, lose: END } });
      expect(getTextProgramData().programs['PewterGymBrockText.PreBattleText']).toBeDefined();
      expect(getTextProgramData().programs[END]).toBeDefined();
    });
    it('stands in the room as a talk-only object: no class, no sight', () => {
      const data = map().npcs[0];
      expect([data.id, data.textId, data.x, data.y, data.direction]).toEqual(['brock', 1, 4, 1, 'down']);
      expect(data.trainerClass).toBeUndefined(); expect(data.sightRange).toBeUndefined();
    });
    it('the meet music starts at the end of his text, before the battle, and the battle is BROCK as gym leader 1', async () => {
      const music = vi.spyOn(audio, 'playMusic');
      await talk();
      const stop = vi.spyOn(audio, 'stopMusic');
      until(() => host.state !== 'script' || music.mock.calls.length > 0, pulse, 3000);
      expect(music.mock.calls.map(c => c[0])).toEqual(['meetmaletrainer']);
      expect(stop).toHaveBeenCalledTimes(1); // StopAllMusic, before the tune
      expect(stop.mock.invocationCallOrder[0]).toBeLessThan(music.mock.invocationCallOrder[0]);
      expect(host.state).toBe('script');
      expect(getMapScript('PewterGym')).toBe(TRAINER_SCRIPT.BROCK_POST_BATTLE);
      until(() => host.state === 'battle', pulse, 3000);
      expect(host.session!.state.wCurOpponent).toBe(getTrainerClass('BROCK')!.id + 200);
      expect(host.session!.state.mem[WGYM]).toBe(1);
    });
    it('the gym-leader battle music plays', async () => {
      const music = vi.spyOn(audio, 'playBattleMusic');
      await talk();
      until(() => host.state === 'battle', pulse, 3000);
      expect(music).toHaveBeenCalledWith(expect.objectContaining({ gymLeaderNo: 1 }));
    });
    it('a loss blacks out, resets the script, and leaves no badge or event', async () => {
      const weak = mon(25, 2); weak.currentHp = 1;
      await talk(weak);
      until(() => host.state === 'battle', pulse, 3000);
      until(() => host.state !== 'battle', pulse, 15000);
      expect(getMapScript('PewterGym')).toBe(TRAINER_SCRIPT.DEFAULT);
      expect(hasFlag('BEAT_BROCK')).toBe(false); expect(hasFlag('BADGE_1')).toBe(false);
    });
    async function win(fighter = mon(25, 100)) {
      await talk(fighter);
      until(() => host.state === 'battle', pulse, 3000);
      const log = host.session!.textLog;
      until(() => host.state !== 'battle', pulse, 15000);
      until(() => host.state === 'overworld', () => [], 600);
      return log;
    }
    const settled = () => host.state === 'overworld' && !getActiveScript() && getMapScript('PewterGym') === TRAINER_SCRIPT.DEFAULT;
    /** Bounded and asserted, so a reward that never starts fails as an assertion rather than the rig's drive bound. */
    const settle = () => { for (let i = 0; i < 8000 && !settled(); i++) tick(pulse()); expect(getMapScript('PewterGym')).toBe(TRAINER_SCRIPT.DEFAULT); expect(settled()).toBe(true); };
    const fillBag = () => { for (const id of getAllItemIds().slice(0, 20)) host.bag.add(id); };
    const printed = (prints: { mock: { calls: unknown[][] } }) => prints.mock.calls.map(c => (c[0] as { program: string }).program);
    it('the reward, in the ASM\'s order, on plain DisplayTextID texts 4, 5 and 6', () => {
      const flow = pewterGymBrockPostBattle();
      expect(joyIgnore()).toBe('dpad');
      expect(programs(flow)).toEqual(['displayOpen', 'PewterGymBrockWaitTakeThisText', 'displayClose', 'setFlag', 'giveItem', 'setFlag', 'hideObject', 'updateSprites',
        'hideObject', 'updateSprites', 'clearFlag', 'clearFlag', 'setTrainerBeaten', 'joyIgnore', 'setMapScript', 'overworldLoop']);
      expect(flow[0]).toEqual({ type: 'displayOpen', autoBox: true, spriteIndex: 4 });
      expect(flow[1]).toEqual({ type: 'printText', program: 'PewterGymBrockWaitTakeThisText', box: 'keep' });
      expect(flow[2]).toEqual({ type: 'displayClose', outerWait: true });
      expect(flow[3]).toEqual({ type: 'setFlag', flag: 'BEAT_BROCK' });
      const give = flow[4]; if (give.type !== 'giveItem') throw new Error('Expected giveItem');
      expect(give.itemId).toBe('TM34');
      expect(give.successCommands).toEqual([{ type: 'displayOpen', autoBox: true, spriteIndex: 5 }, { type: 'printText', program: 'PewterGymReceivedTM34Text', box: 'keep' },
        { type: 'displayClose', outerWait: true }, { type: 'setFlag', flag: 'GOT_TM34' }]);
      expect(give.failCommands).toEqual([{ type: 'displayOpen', autoBox: true, spriteIndex: 6 }, { type: 'printText', program: 'PewterGymTM34NoRoomText', box: 'keep' },
        { type: 'displayClose', outerWait: true }]);
      expect(flow.slice(5)).toEqual([{ type: 'setFlag', flag: 'BADGE_1' }, { type: 'hideObject', toggle: 0x05 }, { type: 'updateSprites', fontLoaded: false },
        { type: 'hideObject', toggle: 0x23 }, { type: 'updateSprites', fontLoaded: false }, { type: 'clearFlag', flag: '1ST_ROUTE22_RIVAL_BATTLE' },
        { type: 'clearFlag', flag: 'ROUTE22_RIVAL_WANTS_BATTLE' }, { type: 'setTrainerBeaten', npcId: 'cooltrainer_m' }, { type: 'joyIgnore', mask: 'none' },
        { type: 'setMapScript', map: 'PewterGym', state: TRAINER_SCRIPT.DEFAULT }, { type: 'overworldLoop', resumeInput: true }]);
      for (const name of ['PewterGymBrockWaitTakeThisText', 'PewterGymReceivedTM34Text', 'PewterGymTM34NoRoomText', 'PewterGymBrockText.PostBattleAdviceText'])
        expect(getTextProgramData().programs[name], name).toBeDefined();
      setJoyIgnoreNone();
    });
    it('a win: his end text, then TM34, the badge, the toggles and the events, and no more battles', async () => {
      setFlag('1ST_ROUTE22_RIVAL_BATTLE'); setFlag('ROUTE22_RIVAL_WANTS_BATTLE');
      const prints = vi.spyOn(TextBox.prototype, 'print'), recorded = vi.spyOn(overworld, 'recordDefeated');
      const log = await win();
      expect(log.some(entry => entry.label === 'TrainerEndBattleText')).toBe(true); // PrintEndBattleText, END by the labels above
      expect(getMapScript('PewterGym')).toBe(TRAINER_SCRIPT.BROCK_POST_BATTLE);
      prints.mockClear();
      settle();
      expect(printed(prints)).toEqual(['PewterGymBrockWaitTakeThisText', 'PewterGymReceivedTM34Text']);
      for (const flag of ['BEAT_BROCK', 'GOT_TM34', 'BADGE_1']) expect(hasFlag(flag), flag).toBe(true);
      for (const flag of ['1ST_ROUTE22_RIVAL_BATTLE', 'ROUTE22_RIVAL_WANTS_BATTLE']) expect(hasFlag(flag), flag).toBe(false);
      expect(host.bag.getCount('TM34')).toBe(1);
      expect([isToggledOff(TOGGLE.GYM_GUY), isToggledOff(TOGGLE.ROUTE_22_RIVAL_1)]).toEqual([true, true]); // $23 is OFF from New Game and stays off
      expect(host.overworldDeps().npcs.find(n => n.data.id === 'cooltrainer_m')!.data.defeated).toBe(true);
      expect(recorded).toHaveBeenCalledWith('PewterGym', 'cooltrainer_m', expect.any(Set)); // the saved beaten set
      expect(brockNpc().data.defeated).toBeFalsy(); // he has no trainer header
      expect(joyIgnore()).toBe('none');
    });
    it('a win with a full bag: the no-room text, no GOT_TM34, and everything else still happens', async () => {
      host.bag.items.splice(0); fillBag();
      const prints = vi.spyOn(TextBox.prototype, 'print');
      await win(); prints.mockClear(); settle();
      expect(printed(prints)).toEqual(['PewterGymBrockWaitTakeThisText', 'PewterGymTM34NoRoomText']);
      expect(hasFlag('BEAT_BROCK')).toBe(true); expect(hasFlag('BADGE_1')).toBe(true); expect(hasFlag('GOT_TM34')).toBe(false);
      expect(host.bag.getCount('TM34')).toBe(0);
      expect(isObjectHidden('PewterCity', 5)).toBe(true);
    });
    it('after the win he gives only his advice, through PrintText', () => {
      const flow = getTextHandler('PewterGym', 1)!(ctx(['BEAT_BROCK', 'GOT_TM34']));
      expect(programs(flow)).toEqual(['displayOpen', 'PewterGymBrockText.PostBattleAdviceText', 'displayClose']);
      expect(flow[1]).toEqual({ type: 'printText', program: 'PewterGymBrockText.PostBattleAdviceText' });
    });
    it('beaten without TM34: the reward runs nested in his display, which then closes without a wait', () => {
      const flow = getTextHandler('PewterGym', 1)!(ctx(['BEAT_BROCK']));
      expect(flow[0]).toEqual({ type: 'displayOpen', autoBox: true });
      expect(flow[1]).toEqual({ type: 'displayOpen', autoBox: true, spriteIndex: 4, windowUp: true });
      expect(flow[flow.length - 1]).toEqual({ type: 'displayClose', outerWait: false, reload: 'full' });
      expect(flow[flow.length - 2]).toEqual({ type: 'setMapScript', map: 'PewterGym', state: TRAINER_SCRIPT.DEFAULT });
      const give = flow.find(c => c.type === 'giveItem'); if (give?.type !== 'giveItem') throw new Error('Expected giveItem');
      expect(give.successCommands![2]).toEqual({ type: 'displayCloseInPlace', outerWait: true });
      expect(give.failCommands![2]).toEqual({ type: 'displayCloseInPlace', outerWait: true });
      expect(flow.some(c => c.type === 'overworldLoop')).toBe(false); // jp OverworldLoop, not back into this pass
    });
    it('talking to him with room in the bag gives TM34 at last, and the game carries on', async () => {
      setFlag('BEAT_BROCK'); setFlag('BADGE_1');
      const prints = vi.spyOn(TextBox.prototype, 'print');
      await talk();
      settleAfterTalk();
      expect(printed(prints)).toEqual(['PewterGymBrockWaitTakeThisText', 'PewterGymReceivedTM34Text']);
      expect(hasFlag('GOT_TM34')).toBe(true); expect(host.bag.getCount('TM34')).toBe(1);
      expect(host.state).toBe('overworld');
    });
    it('the next battle has the Boulder Badge\'s Attack boost on the battle copy', async () => {
      await win(); settle();
      host.startTrainerBattle('BUG_CATCHER', 0, { endBattleLabels: { win: END, lose: END } });
      until(() => host.state === 'battle', pulse, 3000);
      until(() => host.session!.state.wBattleMonAttack > 0, pulse, 6000); // the send-out's LoadBattleMonFromParty
      const s = host.session!.state, attack = s.readBE(A.wPartyMons + 36);
      expect(s.wObtainedBadges).toBe(1);
      expect(s.wBattleMonAttack).toBe(attack + (attack >> 3));
    });
    it('after the win Pewter\'s guide is gone and his east trigger is silent', async () => {
      await win(); settle();
      await host.handleWarpLoad('PewterCity', 0, { x: 36, y: 17 }); await host.finishFade(); host.state = 'overworld';
      host.ow.justWarped = false; host.ow.doorExitStep = false;
      const start = frameNow();
      until(() => frameNow() >= start + 40, () => [], 41);
      expect(host.state).toBe('overworld');
      expect(host.overworldDeps().npcs.find(n => n.data.id === 'youngster')!.hidden).toBe(true);
    });
  });
  it('GIOVANNI outside his Gym is an ordinary trainer: wGymLeaderNo is written only by the Gym scripts', async () => {
    const music = vi.spyOn(audio, 'playBattleMusic');
    await stand(7, 11, 'up');
    host.startTrainerBattle('GIOVANNI', 0, { endBattleLabels: { win: 'PewterGymBrockReceivedBoulderBadgeText', lose: 'PewterGymBrockReceivedBoulderBadgeText' } });
    until(() => host.state === 'battle', () => [], 3000);
    expect(music).toHaveBeenCalledWith({ curOpponent: getTrainerClass('GIOVANNI')!.id + 200, gymLeaderNo: 0 });
    expect(host.session!.state.mem[0xd05b]).toBe(0);
  });
  it('5 tiles right is in his range of 5, but he is off the screen there, so he does not see the player', async () => {
    await stand(8, 6, 'left');
    const start = frameNow();
    until(() => frameNow() >= start + 30, () => [], 31);
    expect(getMapScript('PewterGym')).toBe(TRAINER_SCRIPT.DEFAULT);
  });
});
