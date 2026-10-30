import { refreshPartyMirror, partyRecordToPokemon } from './battle_party_codec';
// Checkpoint-07b: copy of the checked04b harness with world setup replaced by the bridge.
// The original tests, ledger rig and all snapshots remain untouched.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import type { GameButton } from '../core';
import { setPlayerName } from '../core/player_state';
import { initItemNames } from '../items';
import { PartyMenu } from '../menus/party_menu';
import { resetListStateForEmptySlot } from '../list_state';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { soundFinished } from '../audio/sound_wait';
import { lowHealthAlarm, setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { rig as audioRig, sfxData, musicData } from '../test/audio_rig';
import { A, BattleState, battleContext, POKEDEX_ORDER } from './battle_state';
import { D } from './battle_end_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { BattleRandomState } from './battle_random_state';
import { getMove, getAllLoadedMoveIds, loadBattleData } from './data';
import { writeBattleInputs, readBattleOutputs, loadBattleBridgeData } from './battle_bridge';
import { battleWorld } from '../test/battle_world_fixture';
import { installTrainerSpecies, trainerPicName, speciesInternalId } from './battle_trainer_party';
import { getMoveRecord, loadBattleMoveData } from './battle_move_data';
import { loadStatEffectData, statModifierUpEffect } from './battle_effects_stats';
import { composedJumpMoveEffect } from './battle_effects_registry';
import { loadBattleItemSounds, bindBattleItems, type BattleItemHost } from './battle_items';
import { registerShortBattleItemBodies } from './battle_item_bodies';
import { registerBallBattleItemBody } from './battle_item_ball';
import { loadTrainerAIItemNames, trainerAIBuilder } from './battle_trainer_ai';
import { bindLearnMove, type LearnMoveHost } from './learn_move';
import { initBattleCommon, type BattleStartHost, type BattleCommonExit } from './battle_start';
import { INIT, setupBattleBeforeTransition } from './battle_init';
import * as init from './battle_init';
import * as menu from './battle_menu';
import * as moves from './move_selection_menu';
import * as twoOption from './battle_two_option';
import * as selection from './battle_math';
import * as damage from './battle_damage_asm';
import * as hit from './battle_hit';
import * as rng from './battle_random';
import * as faint from './battle_faint';
import * as endings from './battle_end';
import * as loops from './battle_loop';
import * as send from './battle_send_out';
import * as enemySend from './battle_enemy_send_out';
import * as slides from './battle_slides';
import * as helpers from './battle_end_helpers';
import type { TrainerMoveSelection } from './battle_math';
import type { Program } from './battle_menu_context';
import type { TurnPorts } from './battle_turn';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';

let sounds: BattleItemHost['sounds'];
const dispose: (() => void)[] = [];
beforeAll(async () => {
  await loadBattleData(); await loadBattleBridgeData(); await loadBattleMoveData(); await loadTextPrograms(); await loadStatEffectData();
  await initTextSystem(); await loadTrainerAIItemNames(); sounds = await loadBattleItemSounds();
  initItemNames(await (await fetch('item_names.json')).json());
});
beforeEach(() => {
  vi.clearAllMocks(); resetListStateForEmptySlot(); setPlayerName('ASH'); setTextSpeed('fast');
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setLowHealthChannel5(0);
});
afterEach(() => { dispose.splice(0).reverse().forEach(f => f()); vi.restoreAllMocks(); });

type Action = 'fight' | 'ball' | 'bait' | 'rock' | 'run';
interface Case {
  trainer?: number; species?: number; level?: number; leadFainted?: boolean; allFainted?: boolean; labLoss?: boolean;
  type?: number; speed?: number; balls?: number; actions?: Action[]; escapeDraws?: number[];
  itemDraws?: number[]; initialAnger?: number; initialBait?: number;
  reserveSpecies?: string; staleCurSpeciesOnRock?: boolean;
}
interface Event { at: number; name: string; data: unknown }
const ramLedger = (mem: Uint8Array) => Object.fromEntries(Array.from(mem.entries()).filter(([, value]) => value !== 0).map(([address, value]) => [address.toString(16), value.toString(16)]));
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

function history(o: Case = {}) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost<BattleCommonExit>(s, undefined, audio.update), video = driver.video, screen = video.screen;
  const ctx = battleContext(s), party = new PartyMenu();
  const events: Event[] = [], frames: string[] = [], texts: string[] = [];
  let buffer1 = screen.cells;
  const textMaps: { label: string; cells: typeof buffer1; buffer: typeof buffer1 }[] = [];
  const sentSpecies: { party: number; battle: number; base: number[] }[] = [];
  const mark = (name: string, data: unknown = null) => events.push({ at: time, name, data });
  let time = 0, phase = 'text', rngPhase = 'dv', inItem = false, inAI = false, menuCount = 0;
  let action: Action = 'fight', nextRoll = 0, carry: 0 | 1 = 0, secondDIV = false;
  const dvs = [0x16, 0x47], escapeDraws = [...(o.escapeDraws ?? [0])], itemDraws = [...(o.itemDraws ?? [])];
  const keys = (values: GameButton[]) => {
    vi.mocked(isHeld).mockImplementation(k => values.includes(k));
    vi.mocked(isPassPressed).mockImplementation(k => values.includes(k));
  };
  const random = new BattleRandomState(() => {
    if (secondDIV) { secondDIV = false; return 0; }
    secondDIV = true; return (nextRoll - s.hRandomAdd - carry) & 255;
  });
  random.hRandomAdd = 5; random.hRandomSub = 0x90;
  const raw = rng.random, battleRandom = rng.battleRandom;
  vi.spyOn(rng, 'battleRandom').mockImplementation(state => {
    carry = state.wLinkState < 4 ? 1 : 0;
    nextRoll = rngPhase === 'dv' ? dvs.shift()! : rngPhase === 'crit' || rngPhase === 'range' ? 255 : 0;
    expect(nextRoll, `unplanned BattleRandom ${rngPhase}`).toBeDefined();
    const value = battleRandom(state); mark('BattleRandom', { phase: rngPhase, value }); return value;
  });
  vi.spyOn(rng, 'random').mockImplementation((state, carryIn) => {
    carry = carryIn;
    const tag = inItem ? 'item' : inAI ? 'ai' : 'safari-escape';
    nextRoll = inItem ? itemDraws.shift() ?? (action === 'ball' ? 150 : 3) : inAI ? 255 : escapeDraws.shift() ?? 0;
    const value = raw(state, carryIn); mark('Random', { phase: tag, carry: carryIn, value }); return value;
  });
  installTrainerSpecies(s); s.movePP = id => getMoveRecord(id)[5];
  // New bridge entry replaces 04b's manual world/party WRAM seeding. The mirror is a test fixture until07c.
  const world=battleWorld({opponent:o.trainer?200+o.trainer:0xa5,mapName:o.trainer?'ViridianForest':'Route1'});
  writeBattleInputs(s,world);refreshPartyMirror(s);
  s.mem[INIT.wMapPalOffset]=7;s.mem[INIT.wLetterPrintingDelayFlags]=0xa7;s.mem[INIT.hTileAnimations]=1;
  ctx.bag=world.bag.map(stack=>({...stack}));
  const originalInit = init.initBattleAfterTransition;
  vi.spyOn(init, 'initBattleAfterTransition').mockImplementation(function* (...args) {
    yield* originalInit(...args); mark('init.return', { scanMemory: hash([...s.mem.slice(0xd8a4, 0xe000)]) });
    // Explicit synthetic Safari controls, applied only after the real loader; normal histories use unmodified data.
    if (o.speed !== undefined) s.wEnemyMonSpeed = o.speed;
    if (o.initialAnger !== undefined) s.mem[I.wSafariEscapeFactor] = o.initialAnger;
    if (o.initialBait !== undefined) s.mem[I.wSafariBaitFactor] = o.initialBait;
  });
  const originalMenu = menu.displayBattleMenu;
  vi.spyOn(menu, 'displayBattleMenu').mockImplementation(function* (...args) {
    const old = phase; phase = 'menu';
    action = o.actions?.[menuCount] ?? (s.wBattleType === 3 ? 'run' : s.wBattleType ? 'run' : 'fight'); menuCount++;
    if (menuCount > 15) throw new Error('history exceeded fifteen menu entries');
    mark('menu', { count: menuCount, action, hp: s.readBE(D.wPartyMons + 1), fought: s.mem[D.wPartyFoughtCurrentEnemyFlags] });
    const result = yield* originalMenu(...args); phase = old; return result;
  });
  const originalMoves = moves.moveSelectionMenu;
  vi.spyOn(moves, 'moveSelectionMenu').mockImplementation(function* (...args) {
    const old = phase; phase = 'moves'; const result = yield* originalMoves(...args); phase = old; return result;
  });
  const originalTwo = twoOption.displayTwoOptionMenu;
  vi.spyOn(twoOption, 'displayTwoOptionMenu').mockImplementation(function* (...args) {
    const old = phase; phase = 'yesNo'; const result = yield* originalTwo(...args); phase = old; return result;
  });
  const select = selection.selectEnemyMove;
  vi.spyOn(selection, 'selectEnemyMove').mockImplementation((...args) => { rngPhase = 'select'; select(...args); rngPhase = 'turn'; });
  const crit = damage.criticalHitTest, range = damage.randomizeDamage, accuracy = hit.moveHitTest;
  vi.spyOn(damage, 'criticalHitTest').mockImplementation(state => { rngPhase = 'crit'; crit(state); rngPhase = 'turn'; });
  vi.spyOn(damage, 'randomizeDamage').mockImplementation(state => { rngPhase = 'range'; range(state); rngPhase = 'turn'; });
  vi.spyOn(hit, 'moveHitTest').mockImplementation(state => { rngPhase = 'hit'; const r = accuracy(state); rngPhase = 'turn'; return r; });
  const host: BattleStartHost & LearnMoveHost = {
    screen, tiles: video.tiles, audio: bridge, partyView: party,
    renderTiles: { sprites: { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4) } },
    pokeballTiles: PNG.sync.read(readFileSync(resolve(__dirname, '../../static/gfx/battle/balls.png'))),
    trainerAppeared: { id: 0xe9, data: sfxData('trainer_appeared') },
    faintFall: { id: 0x9e, data: sfxData('faint_fall') }, faintThud: { id: 0x95, data: sfxData('faint_thud') },
    runSound: { id: 0x97, data: sfxData('run') }, swapSound: { id: 0xae, data: sfxData('swap') },
    printText: function* (label: string, bindings?: TextBindings, options?: TextRunnerOptions) {
      const eager = bindings ? Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(bindings))
        .filter(([, d]) => 'value' in d).map(([key, d]) => [key, d.value as unknown])) : null;
      textMaps.push({ label, cells: screen.cells, buffer: buffer1 });
      texts.push(label); mark('text', { label, bindings: eager });
      yield* driver.printText(label, bindings, options);
      mark('text.return', { label, rows: [14, 16].map(y => Array.from({ length: 18 }, (_, i) => screen.at(i + 1, y)).join('')) });
    },
    saveScreenTilesToBuffer1() { mark('save1'); buffer1 = screen.cells; video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer1() { mark('load1'); video.loadScreenTilesFromBuffer1(); },
    saveScreenTilesToBuffer2() { video.saveScreenTilesToBuffer2(); }, loadScreenTilesFromBuffer2() { video.loadScreenTilesFromBuffer2(); },
    getMove(id) { const key = getAllLoadedMoveIds().find(k => getMove(k)!.id === id)!; return { ...getMove(key)!, name: key }; },
    readJoypad() {
      let pressed: GameButton[] = ['a'];
      if (phase === 'menu' && ctx.joy7 !== 1) {
        const wanted = s.wBattleType === 2 ? { ball: 0, rock: 1, bait: 2, run: 3, fight: 0 }[action] : action === 'run' ? 3 : 0;
        const right = ctx.cursor.topX === (s.wBattleType === 2 ? 13 : 15);
        pressed = right !== (wanted >= 2) ? [right ? 'left' : 'right'] : ctx.currentMenuItem !== wanted % 2 ? ['down'] : ['a'];
      } else if (phase === 'yesNo') pressed = ['b'];
      keys(pressed);
    },
    pressSound() { bridge.play({ id: 0x90, data: sfxData('press_ab') }); },
    waitForSound: function* () { while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced'; },
    playSound(name) { bridge.play({ id: 0x97, data: sfxData(name) }); }, runOdds: menu.cartridgeRunOdds,
    frontPicture: state => `front/${POKEDEX_ORDER[state.wCurPartySpecies - 1]}`,
    backPicture: state => `back/${POKEDEX_ORDER[state.wBattleMonSpecies2 - 1]}`,
    trainerPicture: state => trainerPicName(state)!,
    voice: { getAlarm: lowHealthAlarm, setAlarm: setLowHealthAlarm, cry: id => mark('cry', id), clip: id => mark('clip', id) },
    updateSprites() {}, sendingOutMon: (state, x, y) => mark('sendCue', [state.hWhoseTurn, x, y]),
    pikachuEntrance: () => mark('pikachuCue'), slidePlayerOff() {}, enemySlideOff: () => mark('enemySlideCue'),
    marowakAnimation: function* () { throw new Error('unexpected Marowak'); },
    animation: function* (state) { mark('animationCue', [state.wAnimationID, state.wAnimationType]); },
    stopAllMusic() { audio.fade.requests.stopAllMusic(); },
    playVictoryMusic(name, bank) { mark('music', name); bridge.audioBank = bridge.savedAudioBank = bank; audio.music.play(musicData(name)); },
    printEndBattleText: function* () { mark('endTextHandOff'); },
    readScrollJoypad: () => isPassPressed('a') ? 1 : 0,
    learnMove: function* () { throw new Error('unbound LearnMove'); },
    useItem: function* () { throw new Error('unbound items'); },
    partyMenu: function* () { throw new Error('unexpected voluntary party menu'); },
    evolutionAfterBattle: function* () { mark('evolution', s.mem[D.wCanEvolveFlags]); },
  };
  bindLearnMove(host, host);
  const presentation = { animation: host.animation, hideSubstitute: function* () {}, reshowSubstitute: function* () {} };
  const env = { ...presentation, host, screen, animationSubstitute: function* () {}, animationTransformMon: function* () {}, moveMenu: { ctx, host } };
  const itemHost: BattleItemHost = { ...host, sounds };
  dispose.push(registerShortBattleItemBodies({ ...presentation, loadScreenTilesFromBuffer1: () => host.loadScreenTilesFromBuffer1() }));
  dispose.push(registerBallBattleItemBody({ video, animation: host.animation,
    addPartyMon: function* () { throw new Error('unexpected catch'); }, sendNewMonToBox: function* () { throw new Error('unexpected box'); },
    showPokedexData: function* () { throw new Error('unexpected dex'); } }));
  const useItem = bindBattleItems(s, itemHost);
  host.useItem = function* (context) {
    inItem = true; mark('item', context.curItem); yield* useItem(context); inItem = false;
    if (o.staleCurSpeciesOnRock && context.curItem === 'SAFARI_ROCK') s.wCurSpecies = speciesInternalId('PIKACHU');
    mark('item.return', { item: context.curItem, catchRate: s.wEnemyMonActualCatchRate, bait: s.mem[I.wSafariBaitFactor], anger: s.mem[I.wSafariEscapeFactor] });
  };
  const ai = trainerAIBuilder({ screen, items: itemHost, text: host, sendOut: host, ...presentation });
  const ports: TurnPorts = { ...presentation, jumpMoveEffect: composedJumpMoveEffect(env),
    statModifierUpEffect: state => statModifierUpEffect(state, env),
    substituteBreak: function* () {}, shake: function* () {},
    trainerAI: function* (state) { inAI = true; const result = yield* ai(state); inAI = false; return result; },
    switchEnemyMon: function* () { throw new Error('link unsupported'); } };
  vi.mocked(playSFX).mockImplementation(async name => { bridge.play({ id: name === 'get_item1' ? 0x86 : 0x90, data: sfxData(bridge.resolveTextSound(name)) }); });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  const play = bridge.play.bind(bridge);
  vi.spyOn(bridge, 'play').mockImplementation(sound => { mark('sound', { id: sound.id, frequency: bridge.frequencyModifier, tempo: bridge.tempoModifier }); return play(sound); });
  const pal = screen.setPalBattle.bind(screen), black = screen.setPalBattleBlack.bind(screen);
  vi.spyOn(screen, 'setPalBattle').mockImplementation(function* (input) { mark('palette', input); yield* pal(input); });
  vi.spyOn(screen, 'setPalBattleBlack').mockImplementation(function* () { mark('palette.black'); yield* black(); });
  const wrap = <T extends unknown[], R>(fn: (...args: T) => Program<R>, name: string) => function* (...args: T): Program<R> {
    mark(name); const result = yield* fn(...args); mark(`${name}.return`, result); return result;
  };
  const enemyOriginal = enemySend.enemySendOutFirstMon;
  vi.spyOn(enemySend, 'enemySendOutFirstMon').mockImplementation(wrap(enemyOriginal, 'enemySend'));
  const sendOriginal = send.sendOutMon;
  vi.spyOn(send, 'sendOutMon').mockImplementation(function* (...args) {
    sentSpecies.push({ party: s.wCurPartySpecies, battle: s.wBattleMonSpecies2, base: [...s.mem.slice(A.wMonHBaseStats, A.wMonHBaseStats + 5)] });
    mark('playerSend', { slot: s.wPlayerMonNumber, fought: s.mem[D.wPartyFoughtCurrentEnemyFlags], exp: s.mem[D.wPartyGainExpFlags] });
    yield* sendOriginal(...args);
  });
  const slide = slides.slideTrainerPicOffScreen;
  vi.spyOn(slides, 'slideTrainerPicOffScreen').mockImplementation(function* (...args) {
    mark('slide', { x: args[2], y: args[3], amount: args[4] }); yield* slide(...args); mark('slide.return');
  });
  const blackoutOriginal = faint.handlePlayerBlackOut, endOriginal = endings.endOfBattle, loopOriginal = loops.battleLoop;
  vi.spyOn(faint, 'handlePlayerBlackOut').mockImplementation(wrap(blackoutOriginal, 'blackout'));
  const faintOriginal = faint.handlePlayerMonFainted;
  vi.spyOn(faint, 'handlePlayerMonFainted').mockImplementation(wrap(faintOriginal, 'playerFaint'));
  vi.spyOn(endings, 'endOfBattle').mockImplementation(wrap(endOriginal, 'end'));
  vi.spyOn(loops, 'battleLoop').mockImplementation(wrap(loopOriginal, 'loop'));
  const alive = helpers.anyPartyAlive;
  vi.spyOn(helpers, 'anyPartyAlive').mockImplementation(state => { mark('alive'); return alive(state); });
  const saved = setupBattleBeforeTransition(s, random); rngPhase = 'turn';
  const initial = { ram: ramLedger(s.mem), draws: [...events], saved };
  const trainer: TrainerMoveSelection | undefined = o.trainer ? {
    get enemy() { return { ...s.partyMons[0]!, moves: Array.from({ length: 4 }, (_, i) => s.mem[A.wEnemyMonMoves + i]).filter(Boolean).map(id => {
      const key = getAllLoadedMoveIds().find(k => getMove(k)!.id === id)!; return { id: key, pp: 35, maxPp: 35 };
    }) }; }, player: s.partyMons[0]!, aiModifiers: [],
  } : undefined;
  const drive = () => {
    let previous = Buffer.from(s.mem);
    driver.start(initBattleCommon(s, saved, ctx, host, ports, trainer));
    for (; !driver.done && time < 8000;) {
      time++;
      keys(time % 2 ? [] : video.textBox.isWaitingForInput ? ['b'] : ['a']);
      const frame = driver.step();
      const now = Buffer.from(s.mem), changes: string[] = [];
      if (!now.equals(previous)) for (let i = 0; i < now.length; i++) if (now[i] !== previous[i]) changes.push(`${i.toString(16)}=${now[i].toString(16)}`);
      previous = now;
      frames.push(`${time}:${frame} bg${textBgTransfer.nextPortion}/${Number(textBgTransfer.enabled)}/${screen.transferDestination.toString(16)} tiles=${hash(screen.cells)} shown=${hash(screen.visibleCells)} ram=${changes.join(',')}`);
    }
    expect(driver.done, JSON.stringify(events.slice(-10))).toBe(true);
    random.detach(s); mark('detached', [random.hRandomAdd, random.hRandomSub]);
    return { initial, events, frames, audio: audio.synth.log, result: driver.result,
      final: { ram: ramLedger(s.mem), cells: screen.cells, oam: Array.from({ length: 40 }, (_, i) => screen.shadowOam(i)),
        random: [random.hRandomAdd, random.hRandomSub], party: s.partyMons } };
  };
  return { s, ctx, driver, host, events, texts, textMaps, sentSpecies, frames, drive, random, get menuCount() { return menuCount; } };
}

it('bridge Route1 win: post-EndOfBattle EXP, seen Rattata, owned and money unchanged', () => {
  const h=history();expect(readBattleOutputs(h.s).party[0].exp).toBe(8000);
  h.drive();const out=readBattleOutputs(h.s);
  expect(h.driver.result?.exit).toBe('end');expect(h.s.wIsInBattle).toBe(0);
  expect(h.events.filter(e=>e.name==='end.return')).toHaveLength(1);
  expect(out.party[0].exp).toBe(8024);expect(h.s.partyMons[0]).toEqual(partyRecordToPokemon(out.party[0]));expect(out.seen).toEqual([19,25]);expect(out.owned).toEqual([25]);
  expect(out.money).toBe(3000);expect(out.battleResult).toBe(0);expect(out.canEvolveFlags).toBe(0);
  expect('eventFlags' in out).toBe(false);
});
it('bridge Bug Catcher win: outcome includes the real prize and reads money after EndOfBattle', () => {
  const h=history({trainer:2});expect(readBattleOutputs(h.s).money).toBe(3000);
  h.drive();const out=readBattleOutputs(h.s);
  expect(h.events.filter(e=>e.name==='end.return')).toHaveLength(1);expect(h.texts).toContain('MoneyForWinningText');
  expect(out.money).toBe(3070);expect(out.battleResult).toBe(0);expect(out.owned).toEqual([25]);
});
