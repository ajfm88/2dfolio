// Production session: shared menus, scoped item bodies and catch homes. Live since A5c3f checkpoint-09b.
import { getBattleAudioEngines, loadSfx, setMasterVolume } from '../audio';
import { setNoAudioFadeOut } from '../audio/audio_flags';
import { soundFinished } from '../audio/sound_wait';
import { musicIdentity, SFX_IDS } from '../audio/sound_ids';
import { lowHealthAlarm, setLowHealthAlarm } from '../audio/low_health_alarm';
import * as input from '../input';
import { isPassPressed } from '../input';
import type { TextDisplayHost } from '../text/textbox';
import { BattleAudio, type BattleSfx } from './battle_audio';
import { A, BattleState, battleContext, charmapByte, indexToPokedex, NAME_BUFFER_LENGTH, NAME_LENGTH, POKEDEX_ORDER } from './battle_state';
import { BattleScreen } from './battle_screen';
import { BattleHost } from './battle_host';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleRandomState } from './battle_random_state';
import { RANDOM_CYCLES } from './battle_random_cycles';
import { writeBattleInputs, readBattleOutputs, readBagEntries, loadBattleBridgeData, battleMapNames, W_STATUS_FLAGS3, type BattleWorld } from './battle_bridge';
import { refreshPartyMirror } from './battle_party_codec';
import { setupBattleBeforeTransition, INIT } from './battle_init';
import { initBattleCommon, type BattleStartHost, type BattleCommonExit } from './battle_start';
import { installTrainerSpecies, saveTrainerName, trainerPicName } from './battle_trainer_party';
import { decodeBattleText } from './battle_text_codec';
import { loadTrainerSpeciesData } from './battle_trainer_data';
import { getAllLoadedMoveIds, getMove } from './data';
import { getMoveRecord, moveDisplayName, moveMenuNameSource, BattleUnsupportedState } from './battle_move_data';
import { loadStatEffectData, statModifierUpEffect } from './battle_effects_stats';
import { loadTrainerAIItemNames, trainerAI, type TrainerAIEnvironment } from './battle_trainer_ai';
import { bindBattleItems, loadBattleItemSounds, BATTLE_ITEM_SOUND_ASSETS, type BattleItemHost } from './battle_items';
import { composedJumpMoveEffect } from './battle_effects_registry';
import { bindLearnMove, type LearnMoveHost } from './learn_move';
import { moveAnimation, shakeHorizontallyFast } from './battle_move_anim';
import { playAnimation, type SubanimationHost } from './battle_subanimation';
import { animationSubstitute, animationMinimizeMon, animationTransformMon, hideSubstituteShowMonAnim,
  reshowSubstituteAnim, animateSubstituteBreaking, type PicVariantHost } from './battle_pic_variants';
import { tossBallAnimation } from './battle_ball_animation';
import { battleRunOdds } from './battle_menu';
import { loadBattleRenderTiles, type PictureDecoder } from './battle_pictures';
import { browserPictureDecoder } from './battle_picture_decode';
import { renderBattleScreen, type RawImage, type BattleRenderTiles } from './battle_screen_render';
import type { BattleAnimationData } from '../rom/extractors/battle_animations';
import { IntroRasterCapture } from './battle_intro_raster';
import type { TurnPorts } from './battle_turn';
import { delayFrames, type Program } from './battle_menu_context';
import { NamingScreen, loadEdTile } from '../menus/naming_screen';
import { PokedexMenu } from '../menus/pokedex';
import { loadPartyIcons } from '../menus/party_icons';
import { addPartyMon, sendNewMonToBox, type CaughtMonEnvironment } from './battle_add_mon';
import { getMonName, getMonHeader } from './battle_loaders';
import { flagAction } from './battle_end_helpers';
import { I } from './battle_item_state';
import { D } from './battle_end_state';
import { loadHudTilePatterns, animationSlideMonOff, animationSlideEnemyMonOff } from './battle_slides';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';
import { PartyMenu } from '../menus/party_menu';
import { StatusScreenSession } from '../menus/status_screen';
import type { BattlePartyHost } from './battle_party_menu';
import { bindPlayerSwitch, bindStateBattlePartyMenu, sendingOutMon, pikachuEntrance } from './battle_send_out';
import { registerShortBattleItemBodies } from './battle_item_bodies';
import { registerFluteBattleItemBody } from './battle_item_flute';
import { registerMedicineBattleItemBody } from './battle_item_medicine';
import { createMedicineItemEnvironment } from './battle_item_medicine_env';
import { registerPPBattleItemBody } from './battle_item_pp';
import { registerBallBattleItemBody } from './battle_item_ball';
import type { SfxData } from '../audio/sfx_engine';
import type { BattlePokemon } from './types';
import type { TextBox } from '../text/textbox';

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
  damage: 0xa6, super_effective: 0xb0, not_very_effective: 0xa7, ball_poof: 0x93,
  ball_toss: 0x91, tink: 0x8c } as const; // A5f checkpoint-03: SFX_BALL_TOSS, SFX_TINK (Audio 2)
interface SessionData { renderTiles: BattleRenderTiles; pokeballTiles: RawImage; mapTilesets: ReadonlyMap<string, string>;
  moveAnimationTiles: RawImage; monsterSprite: RawImage; animations: BattleAnimationData;
  sounds: ReadonlyMap<string, BattleSfx>; itemSounds: ReadonlyMap<number, BattleSfx>; flute: SfxData }
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
    const animations = fetch('battle_animations.json').then(async response => {
      if (!response.ok) throw new Error(`battle_animations.json: HTTP ${response.status}`);
      return await response.json() as BattleAnimationData;
    });
    const [renderTiles, itemSounds, sounds, mapTilesets, , , , moveAnimationTiles, animationData, monsterSprite] = await Promise.all([
      pictures, loadBattleItemSounds(), Promise.all(names.map(async name => {
        const value = await loadSfx(name); if (!value) throw new Error(`session sound ${name}`);
        const id = HOST_SOUNDS[name as keyof typeof HOST_SOUNDS] ?? SFX_IDS.get_item1;
        return [name, { id, data: value }] as const;
      })),
      maps, loadTrainerSpeciesData(),
      // This checked loader also calls loadBattleMoveData; invoking it separately would load twice.
      loadStatEffectData(), loadTrainerAIItemNames(),
      decode('gfx/battle/move_anim_0.png'), animations, decode('gfx/sprites/monster.png'),
    ]);
    const flute = await loadSfx('pokeflute_in_battle');
    if (!flute) throw new Error('session flute stream missing');
    const soundsByName = new Map<string, BattleSfx>(sounds);
    for (const [id, name] of BATTLE_ITEM_SOUND_ASSETS) {
      if (name === 'caught_mon' || name === 'dex_page_added') soundsByName.set(name, itemSounds.get(id)!);
    }
    data = { renderTiles, pokeballTiles: balls!, sounds: soundsByName, itemSounds, mapTilesets: new Map(mapTilesets), flute,
      moveAnimationTiles, monsterSprite, animations: animationData };
  })();
}
/** O-45.2's stand-in screens, loaded once beside the session data. PokedexMenu.load fetches per instance,
 * so every session shares this one page. Only a catch's homes read it. */
const standInPokedex = new PokedexMenu();
let standInsLoaded = false;
let standInLoading: Promise<void> | undefined;
export function loadBattleStandInData(): Promise<void> {
  return standInLoading ??= Promise.all([standInPokedex.load(), loadEdTile(), loadPartyIcons()]).then(() => { standInsLoaded = true; });
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
export type BattleForeground = 'battle' | 'party' | 'partyItem' | 'status' | 'naming' | 'pokedex';
/** DisplayListMenuID reads cartridge bag bytes; every other context cell retains its existing owner. */
export function bagBackedContext(context: ReturnType<typeof battleContext>, state: BattleState): ReturnType<typeof battleContext> {
  return new Proxy(context, {
    get: (target, key) => key === 'bag' ? readBagEntries(state) : Reflect.get(target, key),
    set: (target, key, value) => {
      if (key === 'bag') throw new Error('battle bag is a read-only view of cartridge bytes');
      return Reflect.set(target, key, value);
    },
  });
}
/** home/trainers.asm:357–372, GetSavedEndBattleTextPointer. */
export function getSavedEndBattleTextPointer(state: BattleState, labels: NonNullable<BattleWorld['endBattleText']>): string {
  return state.wBattleResult === 0 ? labels.win : labels.lose;
}
/** SaveTrainerName's @-terminated wNameBuffer can contain the full20-byte name window. */
export function trainerEndNameBuffer(state: BattleState): string {
  return decodeBattleText(state.mem, A.wNameBuffer, NAME_BUFFER_LENGTH);
}
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
  // Composed pictures and animation atlases belong to this session, never the page asset cache.
  const renderTiles = { ...assets.renderTiles, pictures: new Map(assets.renderTiles.pictures) };
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
  const textHost: TextDisplayHost = { closeFrames: () => 7, updateSprites() {},
    sound: battleTextSoundOwner(audio, owners, assets.sounds) };
  const video = new BattleMenuScreen(new BattleScreen(), textHost);
  // BattleTransition_BlackScreen; init_battle.asm:39/64. The transition runs on the overworld renderer,
  // so the battle screen receives its final registers here.
  video.screen.bgp = video.screen.obp0 = video.screen.obp1 = 0xff;
  const driver = new BattleHost<BattleCommonExit>(state, video);
  const introCapture = new IntroRasterCapture(() => renderBattleScreen(video.screen, renderTiles));
  let introRaster: IntroRasterCapture | null = null;
  const screen = video.screen, rawContext = battleContext(state);
  // home/list_menu.asm: DisplayListMenuID reads the live count and entries at each opening.
  const ctx = bagBackedContext(rawContext, state);
  let foreground: BattleForeground = 'battle';
  class SessionPartyMenu extends PartyMenu {
    override show(mons: BattlePokemon[]): void { super.show(mons); foreground = 'party'; }
    override showForItem(mons: BattlePokemon[], box?: TextBox): void {
      super.showForItem(mons, box); foreground = 'partyItem';
    }
  }
  const party = new SessionPartyMenu(textHost);
  const textLog: { label: string; complete: boolean }[] = [];
  const handoffs = { trainerEnvironment: 0, other: 0 };
  const pictures: PicVariantHost = { screen, renderTiles, monsterSprite: assets.monsterSprite,
    minimizedMonSprite: assets.animations.minimizedMonSprite,
    frontPicture: s => `front/${POKEDEX_ORDER[s.wCurPartySpecies - 1]}`,
    backPicture: s => `back/${POKEDEX_ORDER[s.wBattleMonSpecies2 - 1]}` };
  const hideSubstitute = (s: BattleState) => hideSubstituteShowMonAnim(s, pictures);
  const reshowSubstitute = (s: BattleState) => reshowSubstituteAnim(s, pictures);
  // The checked TrainerAI owns wild/link returns; only trainer branches read these live owners.
  const trainerEnvironment: TrainerAIEnvironment = {
    screen,
    get items() { handoffs.trainerEnvironment++; return { ...host, sounds: assets.itemSounds }; },
    get text() { handoffs.trainerEnvironment++; return host; },
    get sendOut() { handoffs.trainerEnvironment++; return host; },
    animation: s => host.animation(s),
    hideSubstitute,
    reshowSubstitute,
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
  // All four are replaced by the checked binders below, before a session can start.
  const unboundPort = function* (): Program<never> { throw new Error('battle session port not bound'); };
  const host: BattleStartHost & LearnMoveHost & BattlePartyHost = {
    screen, tiles: video.tiles, audio,
    introScanout: introCapture,
    bindRaster(timing) { driver.bindRaster(timing); introRaster = timing ? introCapture : null; },
    partyView: party, statusView: null,
    createStatusScreen(mon, options) {
      return new StatusScreenSession(mon, { ...options, page2Name: () => {
        const id = POKEDEX_ORDER.indexOf(mon.species.id) + 1;
        state.wNamedObjectIndex = id; getMonName(state, state.species(id));
        return decodeBattleText(state.mem, A.wNameBuffer);
      } });
    },
    loadEnemyPicVariant: kind => kind === 'substitute' ? animationSubstitute(state, pictures) : animationMinimizeMon(state, pictures),
    renderTiles, pokeballTiles: assets.pokeballTiles,
    trainerAppeared: sound('trainer_appeared'), faintFall: sound('faint_fall'), faintThud: sound('faint_thud'),
    runSound: sound('run'), swapSound: sound('swap'),
    printText: function* (label: string, bindings?: TextBindings, options?: TextRunnerOptions) {
      const entry = { label, complete: false }; textLog.push(entry);
      yield* driver.printText(label, bindings, options); entry.complete = true;
    },
    saveScreenTilesToBuffer1: () => video.saveScreenTilesToBuffer1(),
    loadScreenTilesFromBuffer1: () => { foreground = 'battle'; video.loadScreenTilesFromBuffer1(); },
    saveScreenTilesToBuffer2: () => video.saveScreenTilesToBuffer2(),
    loadScreenTilesFromBuffer2: () => { foreground = 'battle'; video.loadScreenTilesFromBuffer2(); },
    ...moveMenuNameSource(state),
    getMove(id) { const key = getAllLoadedMoveIds().find(key => getMove(key)!.id === id);
      if (!key) throw new BattleUnsupportedState(`move ${id}`); return { ...getMove(key)!, name: moveDisplayName(id) }; },
    readJoypad: input.readJoypad,
    readScrollJoypad() {
      input.readJoypad(); return (isPassPressed('a') ? 1 : 0) | (isPassPressed('b') ? 2 : 0);
    },
    pressSound: () => { audio.play(sound('press_ab')); },
    waitForSound: function* () { while (!soundFinished(owners.sfx, owners.music, 0)) yield 'serviced'; },
    playSound: name => { audio.play(sound(name)); }, runOdds: () => battleRunOdds(state),
    frontPicture: s => `front/${POKEDEX_ORDER[s.wCurPartySpecies - 1]}`,
    backPicture: s => `back/${POKEDEX_ORDER[s.wBattleMonSpecies2 - 1]}`,
    trainerPicture: s => trainerPicName(s)!,
    voice: { getAlarm: lowHealthAlarm, setAlarm: setLowHealthAlarm,
      cry() { /* J2 silent cry cue. */ }, clip() { /* J2 PCM cue; caller retains its three frames. */ } },
    updateSprites() { /* UpdateSprites returns: init sets wUpdateSpritesEnabled=$FF (home/update_sprites.asm:1-4). */ },
    sendingOutMon: (s, x, y) => sendingOutMon(s, host, x, y), pikachuEntrance: s => pikachuEntrance(s, host),
    slidePlayerOff: s => animationSlideMonOff(s, screen), enemySlideOff: s => animationSlideEnemyMonOff(s, screen),
    marowakAnimation: function* () { throw new BattleUnsupportedState('unreachable Marowak'); },
    animation: s => {
      // A5f checkpoint-03: one PlayAnimation host for the send-out poof and TossBallAnimation's sub-animations.
      const subanimation: SubanimationHost = { screen, audio, renderTiles, moveAnimationTiles: assets.moveAnimationTiles,
        ballPoof: sound('ball_poof'), animations: assets.animations, ball: { toss: sound('ball_toss'), tink: sound('tink') } };
      return moveAnimation(s, { screen, audio,
        sounds: { damage: sound('damage'), superEffective: sound('super_effective'), notVeryEffective: sound('not_very_effective') },
        waitForSound: host.waitForSound, tossBall: state => tossBallAnimation(state, { screen, audio, faintThud: host.faintThud,
          // playBallAnimation has stored wAnimationID (animations.asm:2810-2814).
          ballSubanimation: function* () { yield* playAnimation(state, subanimation); } }),
        subanimation });
    },
    stopAllMusic: () => { owners.banks.stopAllMusic(); },
    playVictoryMusic(name) { const identity = musicIdentity(name);
      if (!identity) throw new BattleUnsupportedState(`victory music ${name}`); owners.banks.playMusic(identity); },
    // home/trainers.asm:334–355. The bridge retains labels instead of ROM pointers.
    printEndBattleText: function* (s) {
      const enabled = s.mem[W_STATUS_FLAGS3] & 0x80;
      s.mem[W_STATUS_FLAGS3] &= ~0x80;
      if (!enabled) return;
      saveTrainerName(s);
      yield* host.printText('TrainerEndBattleText', { nameBuffer: trainerEndNameBuffer(s) }, {
        asmContinuations: { TrainerEndBattleText: function* () { return getSavedEndBattleTextPointer(s, world.endBattleText!); } },
      });
      // SetEnemyTrainerToStayAndFaceAnyDirection: live map sprite, checkpoint-09's owner.
      yield* host.waitForSound();
    },
    evolutionAfterBattle: function* () { /* 09 applies the outcome's retained evolution flags. */ },
    learnMove: unboundPort, useItem: unboundPort, partyMenu: unboundPort, switchPlayerMon: unboundPort,
  };
  bindLearnMove(host, host);
  bindPlayerSwitch(state, host, host);
  bindStateBattlePartyMenu(state, host);
  const itemHost: BattleItemHost = { ...host, sounds: assets.itemSounds };
  const itemPresentation = { screen, video, partyView: party, readJoypad: host.readJoypad, pressSound: host.pressSound };
  const medicine = createMedicineItemEnvironment(state, itemPresentation);
  const disposers: (() => void)[] = [];
  const disposeItems = () => { disposers.splice(0).reverse().forEach(dispose => dispose()); };
  const boundUseItem = bindBattleItems(state, itemHost);
  // home/fade.asm GBPalWhiteOut / GBPalNormal; home/copy2.asm ClearScreen; home/clear_sprites.asm.
  const white = () => { screen.bgp = screen.obp0 = screen.obp1 = 0; };
  const normal = () => { screen.bgp = 0xe4; screen.obp0 = 0xd0; };
  const clearScreen = function* (): Program {
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, ' ');
    yield* delayFrames(3);
  };
  const clearSprites = () => { for (let i = 0; i < 40; i++) screen.setOam(i, { y: 0, x: 0, tile: 0, attributes: 0 }); };
  const naming = new NamingScreen(), pokedex = standInPokedex;
  const requireStandIns = () => { if (!standInsLoaded) throw new BattleUnsupportedState('stand-in screens not loaded'); };
  let standIn: 'naming' | 'pokedex' | null = null;
  /** naming_screen.asm:83-187, NAME_MON_SCREEN. The keyboard between entry and exit is O-45.2's stand-in. */
  const displayNamingScreen = function* (species: number, type: number, destination: number): Program {
    if (type !== 2) throw new BattleUnsupportedState(`naming screen type ${type}`);
    requireStandIns();
    state.mem[D.wStatusFlags5] |= 1 << 6;
    white(); yield* delayFrames(3); yield* clearScreen();
    // PrintNamingText: GetMonName into wNameBuffer.
    state.wNamedObjectIndex = species; getMonName(state, state.species(species));
    state.mem[A.wStringBuffer] = 0x50; state.mem[D.wAnimCounter] = 0;
    naming.show('nickname', { speciesName: decodeBattleText(state.mem, A.wNameBuffer), dex: POKEDEX_ORDER[species - 1],
      pressSound: host.pressSound });
    normal(); standIn = 'naming';
    for (;;) { yield 'session'; host.readJoypad(); if (naming.update() === 'done') break; }
    standIn = null;
    // .submitNickname: the cells the keyboard wrote, then NAME_LENGTH bytes to the caller's HL.
    naming.stringBuffer.forEach((ch, i) => { if (ch !== null) state.mem[A.wStringBuffer + i] = charmapByte(ch); });
    state.mem.copyWithin(destination, A.wStringBuffer, A.wStringBuffer + NAME_LENGTH);
    white(); yield* delayFrames(3); yield* clearScreen(); clearSprites(); normal();
    state.mem[D.wAnimCounter] = 0; state.mem[D.wStatusFlags5] &= ~(1 << 6);
    yield* loadHudTilePatterns(screen);
  };
  /** pokedex.asm:438-480, ShowPokedexData from the battle. The page itself is O-45.2's stand-in; cries are J2's. */
  const showPokedexData = function* (): Program {
    requireStandIns();
    white(); yield* delayFrames(3); yield* clearScreen();
    state.mem[D.wStatusFlags2] |= 1 << 1; setNoAudioFadeOut(true); setMasterVolume(3, 3);
    const animations = state.mem[INIT.hTileAnimations]; state.mem[INIT.hTileAnimations] = 0;
    white();
    const species = state.wPokedexNum; state.wCurPartySpecies = species;
    // DrawDexEntryOnScreen: GetMonName, IndexToPokedex (restored), the owned test, GetMonHeader.
    state.wNamedObjectIndex = species; getMonName(state, state.species(species));
    indexToPokedex(state); const dex = state.wPokedexNum;
    const owned = flagAction(state, I.wPokedexOwned, 2, (dex - 1) & 255) !== 0;
    state.wPokedexNum = species; state.wCurSpecies = species; getMonHeader(state, species);
    pokedex.showData(dex, { owned, pressSound: host.pressSound });
    yield* delayFrames(3); normal(); standIn = 'pokedex';
    for (;;) { yield 'session'; host.readJoypad(); if (pokedex.update() === 'closed') break; }
    standIn = null;
    state.mem[INIT.hTileAnimations] = animations;
    white(); yield* clearScreen(); normal();
    state.mem[D.wStatusFlags2] &= ~(1 << 1); setNoAudioFadeOut(false); setMasterVolume(7, 7);
  };
  const caught: CaughtMonEnvironment = { state, host: itemHost, menu: host, video, displayNamingScreen };
  host.useItem = function* (context) {
    // Registers are page-global, but these closures belong only to this use. Also clean up a partial registration.
    try {
      disposers.push(registerShortBattleItemBodies({ animation: host.animation,
        hideSubstitute, reshowSubstitute,
        loadScreenTilesFromBuffer1: host.loadScreenTilesFromBuffer1 }));
      disposers.push(registerFluteBattleItemBody({ sfx: owners.sfx, streams: assets.flute,
        loadScreenTilesFromBuffer2: host.loadScreenTilesFromBuffer2 }));
      disposers.push(registerMedicineBattleItemBody(medicine));
      disposers.push(registerPPBattleItemBody({ ...itemPresentation, moveMenu: host }));
      disposers.push(registerBallBattleItemBody({ video, animation: host.animation,
        addPartyMon: function* () { yield* addPartyMon(state, caught); },
        sendNewMonToBox: function* () { yield* sendNewMonToBox(state, caught); }, showPokedexData }));
      yield* boundUseItem(context);
    } finally { disposeItems(); }
  };
  const presentation = { animation: host.animation,
    hideSubstitute, reshowSubstitute };
  const env = { ...presentation, host, screen, moveMenu: { ctx, host },
    animationSubstitute: (s: BattleState) => animationSubstitute(s, pictures),
    animationTransformMon: (s: BattleState) => animationTransformMon(s, pictures) };
  const ports: TurnPorts = { ...presentation, jumpMoveEffect: composedJumpMoveEffect(env),
    statModifierUpEffect: s => statModifierUpEffect(s, env), trainerAI: boundTrainerAI,
    switchEnemyMon: function* () { throw new BattleUnsupportedState('link'); },
    substituteBreak: s => animateSubstituteBreaking(s, pictures), shake: (s, b) => shakeHorizontallyFast(s, screen, b) };
  let started = false, finished = false, aborted = false;
  return {
    state, screen, video, party, textLog, trainerAILog, handoffs,
    get renderTiles() { return renderTiles; },
    get statusView() { return host.statusView; },
    get foreground(): BattleForeground { return host.statusView ? 'status' : standIn ?? foreground; },
    naming, pokedex,
    /** The bound turn port is also observable for the trainer-environment boundary proof. */
    trainerAI: boundTrainerAI,
    animation: host.animation,
    get introRaster() { return introRaster; },
    get pendingFrame() { return driver.pendingFrame; },
    get done() { return started && driver.done; },
    start() {
      if (aborted) throw new Error('session aborted');
      if (started) throw new Error('session already started'); started = true;
      driver.start(initBattleCommon(state, saved, ctx, host, ports));
    },
    tick() { if (aborted) throw new Error('session aborted'); if (!started) throw new Error('session not started'); return driver.step(); },
    finish() {
      if (aborted) throw new Error('session aborted');
      if (!started || !driver.done || finished) throw new Error('session is not ready to finish');
      const result = driver.result!;
      // The faint loop encodes HandlePlayerBlackOut's carry in its exit (battle_faint.ts).
      const output = { outcome: readBattleOutputs(state), exit: result.exit, blackoutCarry: result.blackoutCarry ?? (result.exit === 'blackout') };
      disposeItems(); deps.random.detach(state); audio.dispose(); finished = true; return output;
    },
    abort() {
      if (aborted || finished) throw new Error('session cannot abort');
      if (standIn === 'pokedex' || host.statusView) {
        state.mem[D.wStatusFlags2] &= ~(1 << 1);
        setNoAudioFadeOut(false); setMasterVolume(7, 7);
      }
      disposeItems(); deps.random.detach(state); audio.dispose(); aborted = true;
    },
  };
}
