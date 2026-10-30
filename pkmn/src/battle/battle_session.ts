// Unused production session. 08a/b own wild FIGHT/RUN and core fixes;08c supplies trainers and menus.
import { getBattleAudioEngines, loadSfx } from '../audio';
import { soundFinished } from '../audio/sound_wait';
import { musicIdentity, SFX_IDS } from '../audio/sound_ids';
import { lowHealthAlarm, setLowHealthAlarm } from '../audio/low_health_alarm';
import * as input from '../input';
import { isPassPressed } from '../input';
import { setTextSpeed, type TextDisplayHost } from '../text/textbox';
import { BattleAudio, type BattleSfx } from './battle_audio';
import { BattleState, battleContext, POKEDEX_ORDER } from './battle_state';
import { BattleScreen } from './battle_screen';
import { BattleHost } from './battle_host';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleRandomState } from './battle_random_state';
import { RANDOM_CYCLES } from './battle_random_cycles';
import { writeBattleInputs, readBattleOutputs, loadBattleBridgeData, battleMapNames, type BattleWorld } from './battle_bridge';
import { refreshPartyMirror } from './battle_party_codec';
import { setupBattleBeforeTransition, INIT } from './battle_init';
import { initBattleCommon, type BattleStartHost, type BattleCommonExit } from './battle_start';
import { installTrainerSpecies, trainerPicName } from './battle_trainer_party';
import { loadTrainerSpeciesData } from './battle_trainer_data';
import { getAllLoadedMoveIds, getMove } from './data';
import { getMoveRecord, BattleUnsupportedState } from './battle_move_data';
import { loadStatEffectData, statModifierUpEffect } from './battle_effects_stats';
import { loadTrainerAIItemNames, trainerAI, type TrainerAIEnvironment } from './battle_trainer_ai';
import { loadBattleItemSounds, BATTLE_ITEM_SOUND_ASSETS } from './battle_items';
import { composedJumpMoveEffect } from './battle_effects_registry';
import { bindLearnMove, type LearnMoveHost } from './learn_move';
import { moveAnimation } from './battle_move_anim';
import { cartridgeRunOdds } from './battle_menu';
import { loadBattleRenderTiles, type PictureDecoder } from './battle_pictures';
import { browserPictureDecoder } from './battle_picture_decode';
import type { RawImage, BattleRenderTiles } from './battle_screen_render';
import type { TurnPorts } from './battle_turn';
import type { Program } from './battle_menu_context';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';

function itemSoundId(name: 'caught_mon' | 'dex_page_added'): number {
  return BATTLE_ITEM_SOUND_ASSETS.find(row => row[1] === name)![0];
}
/** home/text.asm:552-559; same numeric86 selects Audio2's level-up data. Field table is untouched. */
export const BATTLE_TEXT_SOUND_IDS: Readonly<Record<string, number>> = Object.freeze({
  caught_mon: itemSoundId('caught_mon'), dex_page_added: itemSoundId('dex_page_added'),
  get_item1: SFX_IDS.get_item1, press_ab: SFX_IDS.press_ab,
});
const HOST_SOUNDS = { trainer_appeared: 0xe9, faint_fall: 0x9e, faint_thud: 0x95,
  run: SFX_IDS.run, swap: SFX_IDS.swap, press_ab: SFX_IDS.press_ab,
  damage: 0xa6, super_effective: 0xb0, not_very_effective: 0xa7 } as const;
interface SessionData { renderTiles: BattleRenderTiles; pokeballTiles: RawImage; mapTilesets: ReadonlyMap<string, string>;
  sounds: ReadonlyMap<string, BattleSfx>; itemSounds: ReadonlyMap<number, BattleSfx> }
let data: SessionData | undefined;
let loading: Promise<void> | undefined;
/** Browser image -> RawImage only; all picture construction remains in the checked picture owner. */
export const decodeBattleSessionPicture = browserPictureDecoder();
export function loadBattleSessionData(decode: PictureDecoder = decodeBattleSessionPicture): Promise<void> {
  return loading ??= (async () => {
    let balls: RawImage | undefined;
    const pictures = loadBattleRenderTiles(async file => {
      const image = await decode(file); if (file === 'gfx/battle/balls.png') balls = image; return image;
    });
    const names = [...new Set([...Object.keys(HOST_SOUNDS), 'level_up', 'get_item1'])];
    // Committed map JSON supplies tilesets without changing BattleWorld or duplicating its map inventory.
    const maps = loadBattleBridgeData().then(() => Promise.all(battleMapNames().map(async name => {
      const response = await fetch(`maps/${name}.json`);
      if (!response.ok) throw new Error(`battle map ${name}: HTTP ${response.status}`);
      const map = await response.json() as {tileset: string};return [name, map.tileset] as const;
    })));
    const [renderTiles, itemSounds, sounds, mapTilesets] = await Promise.all([
      pictures, loadBattleItemSounds(), Promise.all(names.map(async name => {
        const value = await loadSfx(name); if (!value) throw new Error(`session sound ${name}`);
        const id = HOST_SOUNDS[name as keyof typeof HOST_SOUNDS] ?? SFX_IDS.get_item1;
        return [name, { id, data: value }] as const;
      })),
      maps, loadTrainerSpeciesData(),
      // This checked loader also calls loadBattleMoveData; invoking it separately would load twice.
      loadStatEffectData(), loadTrainerAIItemNames(),
    ]);
    const soundsByName = new Map<string, BattleSfx>(sounds);
    for (const [id, name] of BATTLE_ITEM_SOUND_ASSETS) {
      if (name === 'caught_mon' || name === 'dex_page_added') soundsByName.set(name, itemSounds.get(id)!);
    }
    data = { renderTiles, pokeballTiles: balls!, sounds: soundsByName, itemSounds, mapTilesets: new Map(mapTilesets) };
  })();
}
export type SessionAudioOwners = ReturnType<typeof getBattleAudioEngines>;
export function battleTextSoundOwner(audio: BattleAudio, owners: SessionAudioOwners,
  sounds: ReadonlyMap<string, BattleSfx>): NonNullable<TextDisplayHost['sound']> {
  const play = audio.textSoundPort(name => {
    // Only data is remapped; the original command still supplies the sound ID.
    const original = name === 'level_up' ? 'get_item1' : name;
    const id = BATTLE_TEXT_SOUND_IDS[original], sound = sounds.get(name);
    if (id === undefined || !sound) throw new BattleUnsupportedState(`battle text sound ${name} bank ${audio.audioBank}`);
    audio.play({ id, data: sound.data });
  });
  return { play, beep: () => play('press_ab'), finished: () => soundFinished(owners.sfx, owners.music, 0) };
}
/** FF04 = floor(T/256)&255; T=70224*frames()+random-routine T-cycles.
 * main supplies its page-lifetime frame counter in09. No wall clock or saved HRAM.
 * Caller instructions between random calls and all other frame work are omitted. */
export function createSessionRandom(frames: () => number): BattleRandomState {
  let frame = -1, cycles = 0;
  const sync = () => { const next = frames(); if (next !== frame) { frame = next; cycles = 0; } };
  return new BattleRandomState(() => {
    sync(); const value = Math.floor((RANDOM_CYCLES.frame * frame + cycles) / 256) & 255;
    cycles += RANDOM_CYCLES.read; return value;
  }, elapsed => { sync(); cycles += elapsed; });
}
export interface BattleSessionDeps { random: BattleRandomState; audio?: () => SessionAudioOwners }
/** data/tilesets/tileset_headers.asm:12-36, one row per tileset.
 * TILEANIM_NONE=0, WATER=1, WATER_FLOWER=2 (constants/tileset_constants.asm). */
export const TILESET_ANIMATIONS: Readonly<Record<string, number>> = Object.freeze({
  OVERWORLD: 2, //12
  REDS_HOUSE_1: 0, //13
  MART: 0, //14
  FOREST: 1, //15
  REDS_HOUSE_2: 0, //16
  DOJO: 2, //17
  POKECENTER: 0, //18
  GYM: 2, //19
  HOUSE: 0, //20
  FOREST_GATE: 0, //21
  MUSEUM: 0, //22
  UNDERGROUND: 0, //23
  GATE: 0, //24
  SHIP: 1, //25
  SHIP_PORT: 1, //26
  CEMETERY: 0, //27
  INTERIOR: 0, //28
  CAVERN: 1, //29
  LOBBY: 0, //30
  MANSION: 0, //31
  LAB: 0, //32
  CLUB: 0, //33
  FACILITY: 1, //34
  PLATEAU: 1, //35
  BEACH_HOUSE: 0, //36
});
export function tilesetAnimations(tileset: string): number {
  if (!Object.prototype.hasOwnProperty.call(TILESET_ANIMATIONS, tileset)) throw new BattleUnsupportedState(`unknown tileset ${tileset}`);
  return TILESET_ANIMATIONS[tileset];
}
export function mapTileAnimations(map: string): number {
  const tileset = data?.mapTilesets.get(map);
  if (tileset === undefined) throw new BattleUnsupportedState(`unknown battle map ${map}`);
  return tilesetAnimations(tileset);
}
export function createBattleSession(world: BattleWorld, deps: BattleSessionDeps) {
  if (!data) throw new Error('battle session data not loaded');
  const assets = data;
  const state = new BattleState();
  installTrainerSpecies(state); state.movePP = id => getMoveRecord(id)[5];
  writeBattleInputs(state, world);
  refreshPartyMirror(state);
  // No live byte owners: ordinary maps are not Rock Tunnel (home/overworld.asm:473,512).
  state.mem[INIT.wMapPalOffset] = 0;
  // InitOptions (main_menu.asm:125-128): FAST_TEXT_DELAY bit0; PrintText temporarily sets bit1.
  state.mem[INIT.wLetterPrintingDelayFlags] = 1;
  state.mem[INIT.hTileAnimations] = mapTileAnimations(world.mapName);
  const saved = setupBattleBeforeTransition(state, deps.random);
  const owners = (deps.audio ?? getBattleAudioEngines)();
  const audio = new BattleAudio(owners.sfx, owners.music, owners.banks);
  const video = new BattleMenuScreen(new BattleScreen(), { closeFrames: () => 7, updateSprites() {},
    sound: battleTextSoundOwner(audio, owners, assets.sounds) });
  const driver = new BattleHost<BattleCommonExit>(state, video);
  const screen = video.screen, ctx = battleContext(state);
  const textLog: { label: string; complete: boolean }[] = [];
  const handoffs = { trainerEnvironment: 0, other: 0 };
  const unsupported08b = function* (): Program<never> { handoffs.other++; throw new BattleUnsupportedState('08b'); };
  const trainerUnavailable = (): never => { handoffs.trainerEnvironment++; throw new BattleUnsupportedState('08b'); };
  // §11.26: the checked TrainerAI owns the wild/link returns; every actual trainer dependency is08b.
  const trainerEnvironment: TrainerAIEnvironment = {
    get screen() { return trainerUnavailable(); }, get items() { return trainerUnavailable(); },
    get text() { return trainerUnavailable(); }, get sendOut() { return trainerUnavailable(); },
    get animation() { return trainerUnavailable(); }, get hideSubstitute() { return trainerUnavailable(); },
    get reshowSubstitute() { return trainerUnavailable(); },
  };
  const trainerAILog: { frames: number; carry?: boolean }[] = [];
  const boundTrainerAI: TurnPorts['trainerAI'] = function* (s) {
    const entry: { frames: number; carry?: boolean } = { frames: 0 }; trainerAILog.push(entry);
    const program = trainerAI(s, trainerEnvironment);
    for (;;) {
      const next = program.next();
      if (next.done) { entry.carry = next.value.carry; return next.value; }
      entry.frames++; yield next.value;
    }
  };
  const sound = (name: string): BattleSfx => {
    const value = assets.sounds.get(name); if (!value) throw new BattleUnsupportedState(`session sound ${name}`); return value;
  };
  const host: BattleStartHost & LearnMoveHost = {
    screen, tiles: video.tiles, audio,
    // 08c owns the shared PartyMenu instance; single-mon core cases never reach the chooser.
    partyView: { openBattleChoice: () => { throw new BattleUnsupportedState('08b'); },
      goBackToChoice: () => { throw new BattleUnsupportedState('08b'); },
      frameBattleChoice: () => { throw new BattleUnsupportedState('08b'); },
      printBattleChoiceText: unsupported08b },
    renderTiles: assets.renderTiles, pokeballTiles: assets.pokeballTiles,
    trainerAppeared: sound('trainer_appeared'), faintFall: sound('faint_fall'), faintThud: sound('faint_thud'),
    runSound: sound('run'), swapSound: sound('swap'),
    printText: function* (label: string, bindings?: TextBindings, options?: TextRunnerOptions) {
      const entry = { label, complete: false }; textLog.push(entry);
      yield* driver.printText(label, bindings, options); entry.complete = true;
    },
    saveScreenTilesToBuffer1: () => video.saveScreenTilesToBuffer1(),
    loadScreenTilesFromBuffer1: () => video.loadScreenTilesFromBuffer1(),
    saveScreenTilesToBuffer2: () => video.saveScreenTilesToBuffer2(),
    loadScreenTilesFromBuffer2: () => video.loadScreenTilesFromBuffer2(),
    getMove(id) { const key = getAllLoadedMoveIds().find(key => getMove(key)!.id === id);
      if (!key) throw new BattleUnsupportedState(`move ${id}`); return { ...getMove(key)!, name: key }; },
    readJoypad: input.readJoypad,
    readScrollJoypad() {
      input.readJoypad(); return (isPassPressed('a') ? 1 : 0) | (isPassPressed('b') ? 2 : 0);
    },
    pressSound: () => { audio.play(sound('press_ab')); },
    waitForSound: function* () { while (!soundFinished(owners.sfx, owners.music, 0)) yield 'serviced'; },
    playSound: name => { audio.play(sound(name)); }, runOdds: cartridgeRunOdds,
    frontPicture: s => `front/${POKEDEX_ORDER[s.wCurPartySpecies - 1]}`,
    backPicture: s => `back/${POKEDEX_ORDER[s.wBattleMonSpecies2 - 1]}`,
    trainerPicture: s => trainerPicName(s)!,
    voice: { getAlarm: lowHealthAlarm, setAlarm: setLowHealthAlarm,
      cry() { /* J2 silent cry cue. */ }, clip() { /* J2 PCM cue; caller retains its three frames. */ } },
    updateSprites() { /* A5e presentation cue. */ },
    sendingOutMon() { /* A5e presentation cue. */ }, pikachuEntrance() { /* A5e presentation cue. */ },
    slidePlayerOff() { /* A5e presentation cue. */ }, enemySlideOff() { /* A5e presentation cue. */ },
    marowakAnimation: function* () { throw new BattleUnsupportedState('unreachable Marowak'); },
    animation: s => moveAnimation(s, { screen, audio,
      sounds: { damage: sound('damage'), superEffective: sound('super_effective'), notVeryEffective: sound('not_very_effective') },
      waitForSound: host.waitForSound, tossBall: function* () { /* A5f toss cue. */ } }),
    stopAllMusic: () => { owners.banks.stopAllMusic(); },
    playVictoryMusic(name) { const identity = musicIdentity(name);
      if (!identity) throw new BattleUnsupportedState(`victory music ${name}`); owners.banks.playMusic(identity); },
    printEndBattleText: unsupported08b, learnMove: unsupported08b, useItem: unsupported08b, partyMenu: unsupported08b,
    evolutionAfterBattle: function* () { /* 09 applies the outcome's retained evolution flags. */ },
  };
  bindLearnMove(host, host);
  const presentation = { animation: host.animation,
    hideSubstitute: function* () { /* A5e presentation cue. */ }, reshowSubstitute: function* () { /* A5e presentation cue. */ } };
  const env = { ...presentation, host, screen, moveMenu: { ctx, host },
    animationSubstitute: function* () { /* A5e presentation cue. */ },
    animationTransformMon: function* () { /* A5e presentation cue. */ } };
  const ports: TurnPorts = { ...presentation, jumpMoveEffect: composedJumpMoveEffect(env),
    statModifierUpEffect: s => statModifierUpEffect(s, env), trainerAI: boundTrainerAI,
    switchEnemyMon: function* () { throw new BattleUnsupportedState('link'); },
    substituteBreak: function* () { /* A5e presentation cue. */ }, shake: function* () { /* A5e presentation cue. */ } };
  let started = false, finished = false;
  return {
    state, screen, video, textLog, trainerAILog, handoffs,
    /** The bound turn port is also observable for the trainer-environment boundary proof. */
    trainerAI: boundTrainerAI,
    animation: host.animation,
    get done() { return started && driver.done; },
    start() {
      if (started) throw new Error('session already started'); started = true;
      setTextSpeed(world.options.textSpeed === 'MID' ? 'medium' : world.options.textSpeed === 'FAST' ? 'fast' : 'slow');
      driver.start(initBattleCommon(state, saved, ctx, host, ports));
    },
    tick() { if (!started) throw new Error('session not started'); return driver.step(); },
    finish() {
      if (!started || !driver.done || finished) throw new Error('session is not ready to finish');
      const result = driver.result!;
      // The faint loop encodes HandlePlayerBlackOut's carry in its exit (battle_faint.ts).
      const output = { outcome: readBattleOutputs(state), exit: result.exit, blackoutCarry: result.blackoutCarry ?? (result.exit === 'blackout') };
      deps.random.detach(state); audio.dispose(); finished = true; return output;
    },
  };
}
