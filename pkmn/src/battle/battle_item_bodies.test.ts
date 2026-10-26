import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isHeld, isPassPressed } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { setLowHealthAlarm, setLowHealthChannel5, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { BattleState, encodeText, isGhostBattle, LINK_STATE_BATTLING } from './battle_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { loadStatEffectData } from './battle_effects_stats';
import { BATTLE_ITEM_POINTERS, useItem, type BattleItemHost } from './battle_items';
import { itemUseXAccuracy, itemUseGuardSpec, itemUseDireHit, itemUseXStat, itemUsePokeDoll,
  registerShortBattleItemBodies, SHORT_ITEM_CONSTANTS, type ShortItemEnvironment } from './battle_item_bodies';
import type { Frame, Program } from './battle_menu_context';
import * as happiness from './battle_pikachu';
import * as loaders from './battle_loaders';
import * as random from './battle_random';
import { criticalHitTest } from './battle_damage_asm';

const disposers: (() => void)[] = [];
beforeAll(async () => { await loadStatEffectData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthChannel5(0); setLowHealthAlarmDisabled(false);
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false);
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

function rig(id: number, name: string, starter = 0) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(s, undefined, audio.update), video = driver.video;
  const bag = [{ id: 'POTION', count: 3 }, { id: 'POTION', count: 4 }, { id: BATTLE_ITEM_POINTERS[id - 1].item, count: 2 }];
  s.setBag([{ id: 20, quantity: 3 }, { id: 20, quantity: 4 }, { id, quantity: 2 }]);
  s.mem[I.wCurItem] = id; s.wWhichPokemon = 2; s.wPlayerMonNumber = 0;
  // DisplayListMenuID already formed this absolute bag index (1+1), not the active party index.
  s.wCurrentMenuItem = 1; s.mem[I.wListScrollOffset] = 1;
  s.wIsInBattle = 1; s.wBattleType = 0; s.wPlayerBattleStatus2 = 0x90; s.hWhoseTurn = 1;
  s.mem[I.wPikachuHappiness] = 99; s.mem[I.wPikachuMood] = 0x80;
  s.writeBE(I.wPlayerID, 0x1234); s.mem.set(encodeText('ASHXY@'), I.wPlayerName);
  for (let slot = 0; slot < 3; slot++) {
    const at = I.wPartyMons + 44 * slot; s.mem[at] = slot === starter ? 0x54 : 0x24;
    s.writeBE(at + 12, 0x1234); s.mem.set(encodeText('ASHXY@'), I.wPartyMonOT + 11 * slot);
  }
  s.mem.set(encodeText('PIKA@'), I.wBattleMonNick); s.mem.set(encodeText('FOE@'), I.wEnemyMonNick);
  s.mem.set(encodeText(`${name}@`), I.wStringBuffer);
  s.wPlayerMoveNum = 33; s.wPlayerMoveEffect = 0x4c; s.wObtainedBadges = 0x55;
  s.mem.fill(7, I.wPlayerMonStatMods, I.wPlayerMonStatMods + 8);
  for (let i = 0; i < 4; i++) {
    s.writeBE(I.wPlayerMonUnmodifiedLevel + 3 + i * 2, 100);
    s.writeBE(I.wBattleMonAttack + i * 2, 112);
    s.writeBE(I.wEnemyMonAttack + i * 2, 100);
  }
  s.wEnemyMonActualCatchRate = 100; s.mem[I.wSafariBaitFactor] = 10; s.mem[I.wSafariEscapeFactor] = 20;
  s.readDIV = () => { throw new Error('unexpected RNG'); }; s.random = () => { throw new Error('unexpected state.random'); };
  let at = 0, pressed = false, used = 0;
  const events: unknown[] = [], frames: Frame[] = [], draws: number[] = [];
  function state() { return { slot: s.wWhichPokemon, flags: s.wPlayerBattleStatus2, happiness: s.mem[I.wPikachuHappiness],
    result: s.wActionResultOrTookBattleTurn, move: [s.wPlayerMoveNum, s.wPlayerMoveEffect],
    bag: [...s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)].map(byte => byte.toString(16).padStart(2, '0')).join(' '),
    mirror: bag.map(stack => `${stack.id}:${stack.count}`).join(', ') }; }
  function mark(event: string, data?: unknown) { events.push({ at, event, data, state: state() }); }
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge, bag,
    sounds: new Map([[0x8e, { id: 0x8e, data: sfxData('heal_ailment') }]]),
    printText: function* (label, bindings, options) {
      mark(`print:${label}`); yield* driver.printText(label, bindings, options);
      mark(`end:${label}`, [14, 16].map(y => Array.from({ length: 18 }, (_, x) =>
        String(video.screen.at(x + 1, y) ?? ' ')).join('').trimEnd()));
    },
    waitForSound: function* () { throw new Error('short items must not wait for sound'); },
    readScrollJoypad() { mark('scroll', pressed); return pressed ? 1 : 0; },
  };
  const env: ShortItemEnvironment = {
    loadScreenTilesFromBuffer1() { mark('load1'); video.loadScreenTilesFromBuffer1(); },
    animation: function* (state) { expect(state).toBe(s); mark('MoveAnimation', [s.wAnimationID, s.wAnimationType, s.hWhoseTurn]); },
    hideSubstitute: function* () { throw new Error('unexpected substitute hide'); },
    reshowSubstitute: function* () { throw new Error('unexpected substitute show'); },
  };
  const modify = happiness.modifyPikachuHappiness;
  const happy = vi.spyOn(happiness, 'modifyPikachuHappiness').mockImplementation((state, event) => {
    mark('happiness', [event, state.wWhichPokemon]); modify(state, event);
  });
  const apply = loaders.applyBadgeStatBoosts;
  const badges = vi.spyOn(loaders, 'applyBadgeStatBoosts').mockImplementation(state => { mark('badges'); apply(state); });
  const play = bridge.play.bind(bridge);
  const sound = vi.spyOn(bridge, 'play').mockImplementation(data => { mark('sound', data.id); return play(data); });
  video.saveScreenTilesToBuffer1();
  disposers.push(registerShortBattleItemBodies(env));
  function seedRandom(bytes: number[], tag: string) {
    draws.push(...bytes); let second = false;
    s.readDIV = () => {
      if (!second) {
        if (used >= draws.length) throw new Error('unexpected Random draw');
        second = true; return (draws[used] - s.hRandomAdd) & 255;
      }
      second = false; expect(s.hRandomAdd).toBe(draws[used]); mark(`Random:${tag}`, draws[used++]); return 0;
    };
  }
  function start(program: Program = useItem(s, host)) { driver.start(program); }
  function step() {
    pressed = at % 2 === 0;
    vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
    vi.mocked(isPassPressed).mockImplementation(key => pressed && key === 'b');
    at++; const frame = driver.step(); if (frame) frames.push(frame);
  }
  function finish() { for (let i = 0; !driver.done && i < 2000; i++) step(); expect(driver.done).toBe(true); expect(used).toBe(draws.length); }
  function ledger() { return { events, frames: frames.reduce<Record<string, number>>((out, f) => ({ ...out, [f]: (out[f] ?? 0) + 1 }), {}),
    final: { ...state(), catchRate: s.wEnemyMonActualCatchRate, factors: [s.mem[I.wSafariBaitFactor], s.mem[I.wSafariEscapeFactor]],
      mods: [...s.mem.slice(I.wPlayerMonStatMods, I.wPlayerMonStatMods + 8)],
      stats: [0, 2, 4, 6].map(i => s.readBE(I.wBattleMonAttack + i)), escaped: s.wEscapedFromBattle } }; }
  return { s, audio, bridge, driver, video, host, env, bag, events, frames, happy, badges, sound, seedRandom, start, step, finish, ledger, time: () => at };
}

describe('short body registration, flags and happiness', () => {
  it.each([{ slot: 2, gain: 1 }, { slot: 0, gain: 0 }])('X Accuracy uses the absolute bag index with starter at$slot', ({ slot, gain }) => {
    const r = rig(0x2e, 'X ACCURACY', slot); r.start(); r.finish();
    expect(r.s.wPlayerBattleStatus2).toBe(0x91); expect(r.s.mem[I.wPikachuHappiness]).toBe(99 + gain);
    expect(r.happy).toHaveBeenCalledWith(r.s, 3); expect(r.s.wWhichPokemon).toBe(2);
    expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]); expect(r.sound).toHaveBeenCalledTimes(1);
    expect(r.ledger()).toMatchSnapshot();
  });
  it.each([{ id: 0x37, name: 'GUARD SPEC.', bit: 2 }, { id: 0x3a, name: 'DIRE HIT', bit: 4 }])
  ('$name uses the active starter, restores the slot and spends repeated uses', ({ id, name, bit }) => {
    const r = rig(id, name); r.s.wPlayerBattleStatus2 |= bit;
    r.start(); r.finish();
    expect(r.s.wPlayerBattleStatus2).toBe(0x90 | bit); expect(r.s.mem[I.wPikachuHappiness]).toBe(100);
    expect(r.s.wWhichPokemon).toBe(2); expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('Dire Hit reaches CriticalHitTest with the Focus Energy quarter-rate bug', () => {
    const r = rig(0x3a, 'DIRE HIT'); r.start(); r.finish();
    r.s.hWhoseTurn = 0; r.s.wBattleMonSpecies = 0x54; r.s.wPlayerMoveNum = 33; r.s.wPlayerMovePower = 40;
    r.s.species = () => ({ name: 'PIKACHU', base: [35, 55, 40, 100, 50], type1: 23, type2: 23,
      catchRate: 190, baseExp: 82, moves: [33, 0, 0, 0], learnset: [] });
    const draw = vi.spyOn(random, 'battleRandom').mockReturnValue(2); // RLC3 ->16; ordinary50 versus pumped12.
    criticalHitTest(r.s); expect(r.s.wCriticalHitOrOHKO).toBe(0);
    r.s.wPlayerBattleStatus2 &= ~4; criticalHitTest(r.s); expect(r.s.wCriticalHitOrOHKO).toBe(1);
    expect(draw).toHaveBeenCalledTimes(2);
  });
  it.each([{ id: 0x2e, body: itemUseXAccuracy }, { id: 0x37, body: itemUseGuardSpec }, { id: 0x3a, body: itemUseDireHit }])
  ('body$id refuses outside battle before flags, happiness or removal', ({ id, body }) => {
    const r = rig(id, 'TEST'); r.s.wIsInBattle = 0; r.s.wActionResultOrTookBattleTurn = 1;
    r.start(body(r.s, r.host)); r.finish();
    expect(r.s.wPlayerBattleStatus2).toBe(0x90); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
    expect(r.happy).not.toHaveBeenCalled(); expect(r.sound).not.toHaveBeenCalled(); expect(r.bag[2].count).toBe(2);
  });
});

describe('X stat items compose the real StatModifierUpEffect', () => {
  it.each([{ id: 0x41, name: 'X ATTACK', index: 0 }, { id: 0x42, name: 'X DEFEND', index: 1 },
    { id: 0x43, name: 'X SPEED', index: 2 }, { id: 0x44, name: 'X SPECIAL', index: 3 }])
  ('$name spends before animation and reapplies every badge boost on success', ({ id, name, index }) => {
    const r = rig(id, name); r.start(); r.finish();
    expect(r.s.mem[I.wPlayerMonStatMods + index]).toBe(8);
    expect([0, 2, 4, 6].map(i => r.s.readBE(I.wBattleMonAttack + i))).toEqual([0, 1, 2, 3].map(i => i === index ? 168 : 126));
    expect([r.s.wPlayerMoveNum, r.s.wPlayerMoveEffect, r.s.wWhichPokemon]).toEqual([33, 0x4c, 2]);
    expect(r.s.mem[I.wPikachuHappiness]).toBe(100); expect(r.badges).toHaveBeenCalledOnce();
    expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]); expect(r.ledger()).toMatchSnapshot();
  });
  it.each(['stage13', 'stat999'])('%s consumes the item, prints failure, changes no stat and still rewards the active starter', kind => {
    const r = rig(0x41, 'X ATTACK');
    if (kind === 'stage13') r.s.mem[I.wPlayerMonStatMods] = 13; else r.s.writeBE(I.wBattleMonAttack, 999);
    const stage = r.s.mem[I.wPlayerMonStatMods], stats = r.s.mem.slice(I.wBattleMonAttack, I.wBattleMonAttack + 8);
    r.start(); r.finish();
    expect(r.bag[2].count).toBe(1); expect(r.s.mem[I.wPlayerMonStatMods]).toBe(stage);
    expect(r.s.mem.slice(I.wBattleMonAttack, I.wBattleMonAttack + 8)).toEqual(stats);
    expect(r.badges).not.toHaveBeenCalled(); expect(r.s.mem[I.wPikachuHappiness]).toBe(100);
    expect([r.s.wPlayerMoveNum, r.s.wPlayerMoveEffect, r.s.wWhichPokemon]).toEqual([33, 0x4c, 2]);
    expect(r.ledger()).toMatchSnapshot();
  });
  it('a field X stat returns result2 after NotTime without touching the saved move or bag', () => {
    const r = rig(0x41, 'X ATTACK'); r.s.wIsInBattle = 0;
    r.start(itemUseXStat(r.s, r.host, r.env)); r.finish();
    expect(r.s.wActionResultOrTookBattleTurn).toBe(2); expect(r.bag[2].count).toBe(2);
    expect([r.s.wPlayerMoveNum, r.s.wPlayerMoveEffect]).toEqual([33, 0x4c]); expect(r.happy).not.toHaveBeenCalled();
  });
  it('successful stat-up keeps the opposite-side burn and paralysis penalties from the shared owner', () => {
    const r = rig(0x41, 'X ATTACK'); r.s.wEnemyMonStatus = 0x50;
    r.start(); r.finish(); expect(r.s.wEnemyMonAttack).toBe(50); expect(r.s.wEnemyMonSpeed).toBe(25);
    expect(r.s.wBattleMonAttack).toBe(168); expect(r.badges).toHaveBeenCalledOnce();
  });
});

describe('Poke Doll keeps the wild-only guard without catch gates', () => {
  it.each([{ name: 'ordinary', map: 1, species: 1 }, { name: 'Tower ghost', map: 0x90, species: 0x19 },
    { name: 'Marowak', map: 0x93, species: 0x91 }])('$name escapes and spends the doll', ({ map, species }) => {
    const r = rig(0x33, 'POKé DOLL'); r.s.wIsInBattle = 1; r.s.wEnemyMonSpecies2 = species;
    r.s.wEnemyMonSpecies = r.s.wCurOpponent = species;
    r.s.wCurMap = map;
    if (map !== 1) r.s.mem.set(encodeText('GHOST@'), I.wEnemyMonNick);
    expect(isGhostBattle(r.s)).toBe(map !== 1); // Real Tower state, no Silph Scope in either bag representation.
    r.start(); r.finish(); expect(r.s.wEscapedFromBattle).toBe(1); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
    expect(r.bag[2].count).toBe(1); expect(r.happy).not.toHaveBeenCalled(); expect(r.ledger()).toMatchSnapshot();
  });
  it('trainer refusal goes through the registered dispatcher and also guards direct body entry', () => {
    const r = rig(0x33, 'POKé DOLL'); r.s.wIsInBattle = 2;
    r.start(); r.finish(); expect(r.s.wActionResultOrTookBattleTurn).toBe(0); expect(r.s.wEscapedFromBattle).toBe(0);
    expect(r.bag[2].count).toBe(2); expect(r.sound).not.toHaveBeenCalled(); expect(r.happy).not.toHaveBeenCalled();
    r.start(itemUsePokeDoll(r.s, r.host)); r.finish(); expect(r.bag[2].count).toBe(2);
  });
});

describe('Safari Bait/Rock Random loop and timing', () => {
  it.each([{ id: 0x15, name: 'BAIT', tag: 'bait', anim: 0xca, rate: 50, factors: [15, 0] },
    { id: 0x16, name: 'ROCK', tag: 'rock', anim: 0xc9, rate: 200, factors: [0, 25] }])
  ('$name rejects5/7 before4, adds5, cues animation and waits70 serviced frames', ({ id, name, tag, anim, rate, factors }) => {
    const r = rig(id, name); r.seedRandom([0xfd, 0xff, 0xfc], tag);
    r.start(); r.finish();
    expect(r.s.wEnemyMonActualCatchRate).toBe(rate); expect([r.s.mem[I.wSafariBaitFactor], r.s.mem[I.wSafariEscapeFactor]]).toEqual(factors);
    expect([r.s.wAnimationID, r.s.wAnimationType, r.s.hWhoseTurn]).toEqual([anim, 0, 0]);
    expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 2]); expect(r.sound).not.toHaveBeenCalled(); expect(r.happy).not.toHaveBeenCalled();
    const animation = (r.events as { at: number; event: string }[]).find(event => event.event === 'MoveAnimation')!;
    expect(r.time() - animation.at).toBe(70); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
    expect(r.ledger()).toMatchSnapshot();
  });
  it.each([{ id: 0x15, name: 'BAIT', cell: I.wSafariBaitFactor }, { id: 0x16, name: 'ROCK', cell: I.wSafariEscapeFactor }])
  ('$name saturates its factor; Rock also saturates its catch-rate double', ({ id, name, cell }) => {
    const r = rig(id, name); r.s.mem[cell] = 254; r.s.wEnemyMonActualCatchRate = 200;
    r.seedRandom([4], name); r.start(); r.finish();
    expect(r.s.mem[cell]).toBe(255); expect(r.s.wEnemyMonActualCatchRate).toBe(id === 0x16 ? 255 : 100);
    expect(r.s.mem[id === 0x15 ? I.wSafariEscapeFactor : I.wSafariBaitFactor]).toBe(0);
  });
  it('Bait reduces catch rate1 to0 and adds1 for masked draw0, without a minimum catch rate', () => {
    const r = rig(0x15, 'BAIT'); r.s.wEnemyMonActualCatchRate = 1;
    r.seedRandom([0], 'bait'); r.start(); r.finish(); expect(r.s.wEnemyMonActualCatchRate).toBe(0);
    expect(r.s.mem[I.wSafariBaitFactor]).toBe(11);
  });
  it('Random uses clear incoming carry and two DIV reads even with a link-state byte', () => {
    const r = rig(0x15, 'BAIT'); r.s.wLinkState = LINK_STATE_BATTLING;
    r.s.hRandomAdd = 254; r.s.hRandomSub = 1; const div = [6, 3];
    r.s.readDIV = vi.fn(() => { const n = div.shift(); if (n === undefined) throw new Error('extra DIV'); return n; });
    r.start(); r.finish();
    expect(r.s.hRandomAdd).toBe(4); expect(r.s.hRandomSub).toBe(253); expect(r.s.readDIV).toHaveBeenCalledTimes(2);
    expect(r.s.mem[I.wSafariBaitFactor]).toBe(15); expect(r.s.wLinkBattleRandomNumberListIndex).toBe(0);
  });
});

it('short item animation/event/effect constants match pret declarations', () => {
  const file = (name: string) => readFileSync(resolve(__dirname, '../../../refs/pokeyellow/constants', name), 'utf8');
  function constants(text: string) {
    let value = 0; const out: Record<string, number> = {};
    for (const raw of text.split('\n')) {
      const line = raw.replace(/;.*/, '').trim(), start = /^const_def(?:\s+(\$[\da-f]+|\d+))?$/i.exec(line);
      if (start) value = start[1] ? start[1].startsWith('$') ? parseInt(start[1].slice(1), 16) : Number(start[1]) : 0;
      const name = /^const (\w+)$/.exec(line); if (name) out[name[1]] = value++;
    }
    return out;
  }
  const moves = constants(file('move_constants.asm'));
  expect(SHORT_ITEM_CONSTANTS.XSTATITEM_ANIM).toBe(moves.XSTATITEM_ANIM);
  expect(SHORT_ITEM_CONSTANTS.ROCK_ANIM).toBe(moves.ROCK_ANIM); expect(SHORT_ITEM_CONSTANTS.BAIT_ANIM).toBe(moves.BAIT_ANIM);
  expect(SHORT_ITEM_CONSTANTS.USEDXITEM).toBe(constants(file('pikachu_emotion_constants.asm')).PIKAHAPPY_USEDXITEM);
  expect(SHORT_ITEM_CONSTANTS.ATTACK_UP1_EFFECT).toBe(constants(file('move_effect_constants.asm')).ATTACK_UP1_EFFECT);
  expect(SHORT_ITEM_CONSTANTS.X_ATTACK).toBe(constants(file('item_constants.asm')).X_ATTACK);
});

// Checkpoint-04b item0: additions only; preserve all checkpoint-04 cases and ledgers.
it('Bait clears a nonzero animation type before the animation hand-off', () => {
  const r = rig(0x15, 'BAIT'); r.s.wAnimationType = 6;
  r.seedRandom([0], 'bait'); r.start(); r.finish();
  expect(r.s.wAnimationType).toBe(0);
  expect((r.events as { event: string; data: unknown }[]).find(event => event.event === 'MoveAnimation')?.data).toEqual([0xca, 0, 0]);
});
it('Rock clears a nonzero animation type before the animation hand-off', () => {
  const r = rig(0x16, 'ROCK'); r.s.wAnimationType = 3;
  r.seedRandom([0], 'rock'); r.start(); r.finish();
  expect(r.s.wAnimationType).toBe(0);
  expect((r.events as { event: string; data: unknown }[]).find(event => event.event === 'MoveAnimation')?.data).toEqual([0xc9, 0, 0]);
});
