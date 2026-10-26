// A5c3e checkpoint-03: raw dispatcher/tail contracts; presentation uses the real retained printer below.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { isHeld, isPassPressed } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthChannel5, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { getBagSavedMenuItem, getCurrentMenuItem, getListScrollOffset, getSavedListScrollOffset,
  setBagSavedMenuItem, setCurrentMenuItem, setListScrollOffset, setSavedListScrollOffset } from '../list_state';
import { initItemNames } from '../items';
import { loadBattleData } from './data';
import { loadBattleMoveData } from './battle_move_data';
import { BattleState, battleContext, encodeText } from './battle_state';
import { D } from './battle_end_state';
import { I, itemCells } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { useBagItem } from './battle_menu';
import type { BattleActionHost, Program } from './battle_menu_context';
import { BATTLE_ITEM_POINTERS, CARD_KEY_COMPARED_BYTE, bindBattleItems, func_e4bf,
  itemUseFailed, itemUseNoEffect, itemUseNotTime, itemUseNotYoursToUse,
  loadBattleItemSounds, playBattleItemSound, playSoundWaitForCurrent,
  printItemUseTextAndRemoveItem, registerBattleItemBody, removeItemFromInventory, removeUsedItem,
  useItem, type BattleItemHost } from './battle_items';

beforeAll(async () => {
  await loadBattleData(); await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem();
  initItemNames({ TOWN_MAP: 'TOWN MAP' });
});
beforeEach(() => {
  vi.clearAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthChannel5(0); setLowHealthAlarmDisabled(false);
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false);
});

function rig() {
  const state = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  state.wIsInBattle = 1; state.random = () => { throw new Error('unexpected item RNG'); };
  const driver = new BattleHost<unknown>(state, undefined, audio.update), video = driver.video;
  const events: { at: number; event: string; result: number; rows?: string[] }[] = [];
  const pages: string[][] = [];
  const textRows = () => [14, 16].map(y => Array.from({ length: 18 }, (_, x) =>
    String(video.screen.at(x + 1, y) ?? ' ')).join('').trimEnd());
  let at = 0, scrollPressed = false;
  const mark = (event: string, rows?: string[]) => events.push({ at, event, result: state.wActionResultOrTookBattleTurn, rows });
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge,
    sounds: new Map([[0x9a, 'caught_mon'], [0x98, 'dex_page_added'], [0x8e, 'heal_ailment'], [0x8d, 'heal_hp']]
      .map(([id, name]) => [Number(id), { id: Number(id), data: sfxData(String(name)) }])),
    printText: function* (label, bindings, options) {
      mark(`print:${label}`); yield* driver.printText(label, bindings, options);
      mark(`end:${label}`, textRows());
    },
    waitForSound: function* () { mark('waitSound'); while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced'; mark('soundFinished'); },
    readScrollJoypad() { mark('scroll'); return scrollPressed ? 1 : 0; },
  };
  const play = vi.spyOn(bridge, 'play');
  function start(program: Program<unknown>) { driver.start(program); }
  function step(press = false) {
    if (video.textBox.isWaitingForInput) {
      const rows = textRows();
      if (JSON.stringify(pages[pages.length - 1]) !== JSON.stringify(rows)) pages.push(rows);
    }
    scrollPressed = press;
    vi.mocked(isHeld).mockImplementation(key => press && key === 'b');
    vi.mocked(isPassPressed).mockImplementation(key => press && key === 'b');
    at++; driver.step();
  }
  function finish() {
    let n = 0;
    while (!driver.done && n < 2000) { step(n % 2 === 1); n++; }
    expect(driver.done, 'program must complete on the real host').toBe(true);
    return n;
  }
  return { state, audio, bridge, driver, video, events, pages, host, play, start, step, finish };
}
function drain(program: Program): void {
  for (let n = 0; n < 100; n++) if (program.next().done) return;
  throw new Error('unexpected wait in CPU-only fixture');
}
function spyPrinter(r: ReturnType<typeof rig>) {
  const printed: [string, number][] = [];
  r.host.printText = function* (label) { printed.push([label, r.state.wActionResultOrTookBattleTurn]); };
  return printed;
}

describe('UseItem_ pointer census and refusal entry ordering', () => {
  const bodies = new Set([1, 2, 3, 4, 8, ...Array.from({ length: 18 }, (_, i) => 11 + i).filter(id => id <= 22),
    46, 51, 52, 53, 54, 55, 58, 60, 61, 62, 65, 66, 67, 68, 73, 80, 81, 82, 83]);
  it.each(Array.from({ length: 83 }, (_, i) => i + 1))('dispatches cartridge item %i without inventing a body', id => {
    const r = rig(), printed = spyPrinter(r); r.state.mem[I.wCurItem] = id;
    r.state.setBag([{ id, quantity: 2 }, { id, quantity: 7 }]);
    r.state.mem[I.wUnusedCardKeyGateID] = 9; r.video.tiles.put(8, 11, 0x18);
    const before = r.state.mem.slice();
    if (bodies.has(id) || id === 7 || id === 9) {
      expect(() => drain(useItem(r.state, r.host))).toThrow(id === 7 ? 'surfboard' : id === 9 ? 'pokedex' : 'unregistered battle item body');
      expect(r.state.wActionResultOrTookBattleTurn).toBe(1); expect(printed).toEqual([]);
    } else {
      drain(useItem(r.state, r.host));
      expect(printed).toEqual([[id === 70 ? 'ItemUseNotYoursToUseText' : 'ItemUseNotTimeText', 0]]);
    }
    const writes = [...before.keys()].filter(at => before[at] !== r.state.mem[at]);
    expect(writes).toEqual(id === 48 ? [I.wTileInFrontOfPlayer, I.wUnusedCardKeyGateID].sort((a,b) => a-b)
      : r.state.wActionResultOrTookBattleTurn === 0 ? [] : [I.wActionResultOrTookBattleTurn]);
    expect(r.play).not.toHaveBeenCalled();
  });
  it('writes result1 before reading the item id, even for an unsupported entry', () => {
    const r = rig(), mem = r.state.mem; mem[I.wCurItem] = 84; r.state.wActionResultOrTookBattleTurn = 99;
    Object.defineProperty(r.state, 'mem', { value: new Proxy(mem, { get(target, key) {
      if (key === String(I.wCurItem)) expect(mem[I.wActionResultOrTookBattleTurn]).toBe(1);
      return Reflect.get(target, key, target);
    } }) });
    expect(() => drain(useItem(r.state, r.host))).toThrow('battle item 84');
  });
  it.each([0, 84, 128, 194, 195])('rejects out-of-table id %i after the success initialization', id => {
    const r = rig(); r.state.mem[I.wCurItem] = id;
    expect(() => drain(useItem(r.state, r.host))).toThrow(`battle item ${id}`);
    expect(r.state.wActionResultOrTookBattleTurn).toBe(1);
  });
  it.each([196, 197, 200, 201, 250, 251, 255])('TM/HM branch refuses id %i, starting exactly at C4', id => {
    const r = rig(), printed = spyPrinter(r); r.state.mem[I.wCurItem] = id;
    drain(useItem(r.state, r.host)); expect(printed).toEqual([['ItemUseNotTimeText', 0]]);
  });
  it('keeps the table and all83 rows frozen, with the Repel CPU-register values', () => {
    expect(Object.isFrozen(BATTLE_ITEM_POINTERS)).toBe(true);
    expect(BATTLE_ITEM_POINTERS.every(Object.isFrozen)).toBe(true);
    expect(BATTLE_ITEM_POINTERS.filter(row => 'registerB' in row).map(row => [row.id, 'registerB' in row && row.registerB]))
      .toEqual([[30, 100], [56, 200], [57, 250]]);
  });
  it('Poke Doll refuses a trainer before asking for its unregistered wild body', () => {
    const r = rig(), printed = spyPrinter(r); r.state.wIsInBattle = 2; r.state.mem[I.wCurItem] = 0x33;
    drain(useItem(r.state, r.host)); expect(printed).toEqual([['ItemUseNotTimeText', 0]]);
  });
  it('registry invokes the exact label once and rejects duplicate registration', () => {
    const r = rig(); r.state.mem[I.wCurItem] = 0x14;
    const body = vi.fn(function* (s: BattleState) { expect(s.wActionResultOrTookBattleTurn).toBe(1); yield 'serviced' as const; });
    const unregister = registerBattleItemBody('ItemUseMedicine', body);
    try {
      expect(() => registerBattleItemBody('ItemUseMedicine', body)).toThrow('duplicate');
      r.start(useItem(r.state, r.host)); expect(body).toHaveBeenCalledWith(r.state, r.host); r.finish();
    } finally { unregister(); }
    expect(() => drain(useItem(r.state, r.host))).toThrow('unregistered');
  });
  it.each([[0, 8, 11, 0x18], [4, 8, 7, 0x24], [8, 6, 9, 0x5e], [12, 10, 9, 0x18]])
  ('Card Key facing%i fetches (%i,%i) tile %i but compares the ROM opcode', (facing, x, y, tile) => {
    const r = rig(), printed = spyPrinter(r); r.state.mem[I.wCurItem] = 0x30;
    r.state.mem[I.wXCoord] = 23; r.state.mem[I.wYCoord] = 42;
    r.state.mem[I.wUnusedCardKeyGateID] = 77; r.state.mem[I.wSpritePlayerStateData1FacingDirection] = facing;
    r.video.tiles.put(x, y, tile);
    drain(useItem(r.state, r.host));
    expect(CARD_KEY_COMPARED_BYTE).toBe(0xcd); expect(r.state.mem[I.wTileInFrontOfPlayer]).toBe(tile);
    expect(r.state.mem[I.wUnusedCardKeyGateID]).toBe(0); expect(printed).toEqual([['ItemUseNotTimeText', 0]]);
    expect([r.state.mem[I.wXCoord], r.state.mem[I.wYCoord]]).toEqual([23, 42]);
  });
  it('Card Key reads the cartridge tile for a glyph on the shared battle surface', () => {
    const r = rig(); spyPrinter(r); r.state.mem[I.wCurItem] = 0x30; r.video.tiles.put(8, 11, 'A');
    drain(useItem(r.state, r.host)); expect(r.state.mem[I.wTileInFrontOfPlayer]).toBe(0x80);
  });
});

describe('RemoveItemFromInventory raw battle bag', () => {
  it.each([
    { quantities: [1], slot: 0, bytes: [0, 255, 0, 255], max: 93, list: 0 },
    { quantities: [5, 1], slot: 1, bytes: [1, 20, 5, 255, 0, 255], max: 93, list: 1 },
    { quantities: [5, 1, 7], slot: 1, bytes: [2, 20, 5, 20, 7, 255, 7, 255], max: 2, list: 2 },
    { quantities: [5, 3, 7], slot: 1, bytes: [3, 20, 5, 20, 2, 20, 7, 255], max: 93, list: 92 },
  ])('slot$slot quantities$quantities preserves duplicates, slot and source menu thresholds', entry => {
    const r = rig(), s = r.state, bag = entry.quantities.map(count => ({ id: 'POTION', count }));
    const retained = bag[0];
    s.setBag(entry.quantities.map(quantity => ({ id: 20, quantity }))); s.wWhichPokemon = entry.slot;
    for (const name of ['wListScrollOffset', 'wCurrentMenuItem', 'wBagSavedMenuItem', 'wSavedListScrollOffset'] as const) s.mem[I[name]] = 91;
    setBagSavedMenuItem(91); setCurrentMenuItem(91); setListScrollOffset(91); setSavedListScrollOffset(91);
    s.mem[I.wMaxMenuItem] = 93; s.mem[I.wListCount] = 92; s.mem[I.wItemQuantity] = 1;
    removeItemFromInventory(s, bag);
    expect([...s.mem.slice(I.wNumBagItems, I.wNumBagItems + entry.bytes.length)]).toEqual(entry.bytes);
    expect(s.mem[I.wMaxItemQuantity]).toBe(entry.quantities[entry.slot] - 1);
    expect(s.wWhichPokemon).toBe(entry.slot); expect(s.mem[I.wMaxMenuItem]).toBe(entry.max); expect(s.mem[I.wListCount]).toBe(entry.list);
    const remaining = entry.quantities[entry.slot] > 1;
    expect([getBagSavedMenuItem(), getCurrentMenuItem(), getListScrollOffset(), getSavedListScrollOffset()]).toEqual(Array(4).fill(remaining ? 91 : 0));
    expect(bag.map(stack => stack.count)).toEqual(entry.quantities.flatMap((n, i) => i === entry.slot ? n > 1 ? [n - 1] : [] : [n]));
    if (entry.slot) expect(bag[0]).toBe(retained);
  });
  it('subtraction wraps at a byte and RemoveUsedItem supplies quantity1', () => {
    const r = rig(); r.state.setBag([{ id: 20, quantity: 0 }]); r.state.mem[I.wItemQuantity] = 9;
    removeUsedItem(r.state, r.host);
    expect(r.state.mem[I.wItemQuantity]).toBe(1); expect(r.state.mem[I.wBagItems + 1]).toBe(255);
    expect(r.state.mem[I.wNumBagItems]).toBe(1);
  });
});

describe('shared tails through the real retained text/video host', () => {
  it.each([
    { name: 'NoEffect', tail: itemUseNoEffect, result: 0 },
    { name: 'NotTime', tail: itemUseNotTime, result: 0 },
    { name: 'NotYours', tail: itemUseNotYoursToUse, result: 0 },
    { name: 'Func_e4bf', tail: func_e4bf, result: 2 },
  ])('$name writes result$result before PrintText and retains the cartridge text', ({ name, tail, result }) => {
    const r = rig(); r.state.wActionResultOrTookBattleTurn = 99;
    r.start(tail(r.state, r.host)); expect(r.events[0].result).toBe(result); r.finish();
    expect({ events: r.events, pages: r.pages }).toMatchSnapshot(name); expect(r.play).not.toHaveBeenCalled();
  });
  it('ItemUseFailed clears before an arbitrary printer entry, with no yielded gap', () => {
    const r = rig(), printed = spyPrinter(r); r.state.wActionResultOrTookBattleTurn = 99;
    expect(itemUseFailed(r.state, r.host, 'ItemUseNoEffectText').next().done).toBe(true);
    expect(printed).toEqual([['ItemUseNoEffectText', 0]]);
  });
  it('ItemUseText00 finishes before heal_ailment; scroll wait removes only after input and never waits for audio', () => {
    const r = rig(), s = r.state;
    s.setBag([{ id: 20, quantity: 1 }]); s.setBytes(I.wStringBuffer, encodeText('POTION@'), 13);
    r.start(printItemUseTextAndRemoveItem(s, r.host));
    for (let n = 0; !r.play.mock.calls.length && n < 500; n++) r.step(false);
    expect(r.play.mock.calls.map(([sound]) => sound.id)).toEqual([0x8e]);
    expect(r.driver.done).toBe(false); expect(s.mem[I.wNumBagItems]).toBe(1);
    expect(r.events.filter(e => e.event.startsWith('end:'))).toMatchSnapshot('item use text');
    const frame = r.audio.synth.update; r.step(true);
    expect(r.driver.done).toBe(true); expect(s.mem[I.wNumBagItems]).toBe(0);
    expect(soundFinished(r.audio.sfx, r.audio.music, 0)).toBe(false);
    expect(r.audio.synth.update).toBe(frame + 1); expect(r.events.some(e => e.event === 'waitSound')).toBe(false);
  });
  it('A5c2 UseBagItem calls the new binding, prints a refusal and returns to the bag on the real host', () => {
    const r = rig(), ctx = battleContext(r.state); ctx.curItem = 'TOWN_MAP'; ctx.itemIndex = 1;
    r.state.setBag([{ id: 20, quantity: 2 }, { id: 5, quantity: 1 }]);
    const before = r.state.mem.slice(I.wNumBagItems, I.wNumBagItems + 6);
    const action: BattleActionHost = {
      ...r.host, screen: r.video.screen, useItem: bindBattleItems(r.state, r.host),
      readJoypad() {}, pressSound() { throw new Error('unexpected press'); },
      saveScreenTilesToBuffer1() { r.video.saveScreenTilesToBuffer1(); },
      loadScreenTilesFromBuffer1() { r.video.loadScreenTilesFromBuffer1(); },
      saveScreenTilesToBuffer2() { r.video.saveScreenTilesToBuffer2(); },
      loadScreenTilesFromBuffer2() { r.video.loadScreenTilesFromBuffer2(); },
      partyMenu: function* () { throw new Error('unexpected party menu'); },
      playSound() { throw new Error('unexpected sound'); }, runOdds() { throw new Error('unexpected odds'); },
    };
    r.start(useBagItem(ctx, action)); r.finish();
    expect(r.driver.result).toBe(null); expect(r.state.mem[I.wCurItem]).toBe(5); expect(r.state.wWhichPokemon).toBe(1);
    expect(ctx.actionResultOrTookBattleTurn).toBe(0); expect([...r.state.mem.slice(I.wNumBagItems, I.wNumBagItems + 6)]).toEqual([...before]);
    expect(r.events).toMatchSnapshot('UseBagItem refusal');
  });
});

describe('battle item Audio 2 adapter', () => {
  it('preloads only committed JSON and rejects lookups outside Audio 2', async () => {
    const r = rig(), sounds = await loadBattleItemSounds();
    expect([...sounds.keys()]).toEqual([0x9a, 0x98, 0x8d, 0x8e]);
    expect(sounds.get(0x9a)?.data).toEqual(sfxData('caught_mon'));
    r.bridge.audioBank = 2; expect(() => playBattleItemSound({ ...r.host, sounds }, 0x9a)).toThrow('battle item sound 2:154');
    r.bridge.audioBank = 8; expect(() => playBattleItemSound(r.host, 0xff)).toThrow('battle item sound 8:255');
  });
  it.each([[0x9a, [5, 6, 7], 145], [0x98, [5, 6], 33]] as const)
  ('id%i waits for the old sound, starts the extracted streams and returns without a postwait', (id, channels, duration) => {
    const r = rig(); playBattleItemSound(r.host, 0x8e);
    r.start(playSoundWaitForCurrent(r.host, id)); expect(r.play).toHaveBeenCalledTimes(1);
    let n = 0; while (!r.driver.done && n++ < 100) r.step();
    expect(n).toBe(27); expect(r.play.mock.calls.map(([sound]) => sound.id)).toEqual([0x8e, id]);
    expect(channels.map(ch => r.bridge.channelId(ch))).toEqual(channels.map(() => id));
    const at = r.audio.synth.update; r.audio.run(duration - 1); expect(soundFinished(r.audio.sfx, r.audio.music, 0)).toBe(false);
    r.audio.run(1); expect(soundFinished(r.audio.sfx, r.audio.music, 0)).toBe(true);
    expect(r.audio.synth.update - at).toBe(duration); expect(r.audio.synth.log.some(write => write.m === 'freq0')).toBe(true);
  });
});

it('every added item cell is a byte alias at its pinned pret symbol address, including all shared names', () => {
  const symbols = execFileSync('git', ['-C', resolve(__dirname, '../../../refs/pokeyellow'), 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8' });
  const s = new BattleState(), cells = itemCells(s);
  for (const [name, address] of Object.entries(I).filter(([name]) => !(name in D))) {
    expect(symbols).toMatch(new RegExp(`^00:${address.toString(16)} ${name}$`, 'm'));
    cells[name as keyof typeof I] = 0x1ab; expect(s.mem[address]).toBe(0xab);
    s.mem[address] = 0x78; expect(cells[name as keyof typeof I]).toBe(0x78);
  }
  const note = readFileSync(resolve(__dirname, '../../../notes/71-a5c3e-plan.md'), 'utf8').split('#### 10.1.18')[1].split('#### 10.1.19')[0];
  for (const [, name, hex] of note.matchAll(/\| `(\w+)` \/ `\$([0-9A-F]+)`/g)) {
    expect(I[name as keyof typeof I], name).toBe(parseInt(hex, 16));
    expect(symbols).toMatch(new RegExp(`^00:${hex.toLowerCase()} ${name}$`, 'm'));
  }
  for (const [, name] of note.matchAll(/`([wh]\w+)`/g)) {
    expect(I, `shared alias ${name}`).toHaveProperty(name);
  }
  cells.wPPRestoreItem = 31; expect(cells.wChargeMoveNum).toBe(31); expect(cells.wNumShakes).toBe(31);
  cells.wPokedexOwned = 44; expect(cells.wMainDataStart).toBe(44);
});

// Checkpoint-04 item0: additions only; checkpoint-03's cases/snapshots stay frozen.
it('exhausting a bag stack resets each of the four raw menu bytes', () => {
  const r = rig(), s = r.state;
  s.setBag([{ id: 20, quantity: 1 }]);
  s.mem[I.wListScrollOffset] = 11; s.mem[I.wCurrentMenuItem] = 12;
  s.mem[I.wBagSavedMenuItem] = 13; s.mem[I.wSavedListScrollOffset] = 14;
  removeUsedItem(s, r.host);
  expect(s.mem[I.wListScrollOffset]).toBe(0);
  expect(s.mem[I.wCurrentMenuItem]).toBe(0);
  expect(s.mem[I.wBagSavedMenuItem]).toBe(0);
  expect(s.mem[I.wSavedListScrollOffset]).toBe(0);
});
it('Card Key with invalid facing1 stores that facing byte as the fetched tile', () => {
  const r = rig(), printed = spyPrinter(r);
  r.state.mem[I.wCurItem] = 0x30; r.state.mem[I.wSpritePlayerStateData1FacingDirection] = 1;
  r.state.mem[I.wTileInFrontOfPlayer] = 99;
  drain(useItem(r.state, r.host));
  expect(r.state.mem[I.wTileInFrontOfPlayer]).toBe(1);
  expect(printed).toEqual([['ItemUseNotTimeText', 0]]);
});
it('the bag binding writes exact HM01/HM05/TM01/TM50 cartridge ids before their refusal', () => {
  const r = rig(), printed = spyPrinter(r), ctx = battleContext(r.state);
  const binding = bindBattleItems(r.state, r.host);
  for (const [item, id] of [['HM01', 0xc4], ['HM05', 0xc8], ['TM01', 0xc9], ['TM50', 0xfa]] as const) {
    ctx.curItem = ctx.itemName = item;
    drain(binding(ctx));
    expect(r.state.mem[I.wCurItem], item).toBe(id);
    expect(r.state.wActionResultOrTookBattleTurn).toBe(0);
  }
  expect(printed).toEqual(Array(4).fill(['ItemUseNotTimeText', 0]));
});
