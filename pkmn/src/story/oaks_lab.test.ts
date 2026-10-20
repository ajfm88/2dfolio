import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { labDisplay, labBallDisplay, labChooseSpeech, labSnatchDisplay, labGiftDisplay,
  buildOaksLabIntroScript, buildOaksLabBallScript, buildOaksLabAwaitBallScript,
  buildOaksLabRivalBattleScript, buildOaksLabPokedexScript, LAB_GUARD_PROGRAM } from './oaks_lab';
import { labOakText, labRivalText, labEeveeText } from './lab_text_handlers';
import type { TextHandlerContext } from './text_handlers';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { MapDialogue } from '../text/map_dialogue';
import { loadTextPrograms } from '../text/program_data';
import { initScript, updateScript, getActiveScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import type { ScriptCommand } from '../script/types';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { Bag } from '../items';
import { loadBattleData } from '../battle';
import { isHeld, isPassPressed, readJoypad, syncJoypadRead } from '../input';
import { playSFX, isSoundFinished, playMusic } from '../audio';
import { fillRect, drawTile } from '../renderer';
import { isNoMapMusic, setNoMapMusic } from '../audio/audio_flags';
import { uiTiles } from '../renderer/ui_tiles';
import { rig, sfxData } from '../test/audio_rig';
import type { Rig } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { restoreFlags, restoreHiddenObjects, setFlag, hasFlag } from '../events';
import { setJoyIgnore } from '../input/joy_ignore';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { applyStoryNpcState } from '../overworld/story_state';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: () => false,
  isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn(), readJoypad: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), stopMusic: vi.fn(),
  playMusic: vi.fn(async () => {}), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(), drawExclamationBubble: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));
const dataDir = resolve(__dirname, '../../data');
const labData = JSON.parse(readFileSync(resolve(dataDir, 'maps/OaksLab.json'), 'utf8'));
const context = (...flags: string[]): TextHandlerContext => ({ hasFlag: f => flags.includes(f), bag: new Bag(),
  ownedCount: 1, facing: 'up', step: { x: 4, y: 3 }, party: [] });
const prints = (commands: ScriptCommand[]) => commands.filter(c => c.type === 'printText').map(c => c.program);
const opening = (commands: ScriptCommand[]) => commands.find(c => c.type === 'displayOpen');
let audio: Rig;
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); });
beforeEach(() => { vi.clearAllMocks(); restoreFlags([]); restoreHiddenObjects([]); setJoyIgnore('none');
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false); setTextSpeed('fast');
  audio = rig(); vi.mocked(playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0)); });

function scene(): ScriptDeps {
  const gameMap = new GameMap(); gameMap.mapData = structuredClone(labData);
  const player = new Player(); player.setTilePosition(8, 6);
  const npcs = gameMap.mapData!.npcs.map(n => new Npc({ ...n }));
  const follower = new PikachuFollower(); follower.visible = true;
  return { gameMap, player, npcs, playerBag: new Bag(), playerParty: [], pikachuFollower: follower,
    textBox: new TextBox({ closeFrames: () => 15, updateSprites: vi.fn() }) };
}
function tick(deps: ScriptDeps, t: number, press = true, pass = false) {
  vi.mocked(isHeld).mockImplementation(b => press && b === 'b' && t % 2 === 0 && deps.textBox.isWaitingForInput);
  audio.update(); return updateScript(deps, pass);
}
function run(deps: ScriptDeps, commands: ScriptCommand[], limit = 5000) {
  initScript(commands); updateScript(deps, false);
  for (let t = 1; t < limit && getActiveScript(); t++) tick(deps, t);
  expect(getActiveScript()).toBeNull();
}
describe('Lab source program/envelope order', () => {
  it('choose speech turns sprite 1 (the rival) up and leaves Oak facing down (note 34 F-1)', () => {
    const turns = labChooseSpeech().filter(c => c.type === 'faceNpc');
    expect(turns).toEqual([{ type: 'faceNpc', npcId: 'rival', direction: 'up' }]);
  });
  it('all four default-music sites restore through the current map, whose Lab entry is oakslab (F-2)', () => {
    const intro = buildOaksLabIntroScript();
    const battle = buildOaksLabRivalBattleScript(7, 4, 5, 6);
    const dex = buildOaksLabPokedexScript(5, 3, () => undefined);
    expect([intro, battle, dex].map(commands => commands.filter(c => c.type === 'restoreMapMusic').length)).toEqual([1, 1, 2]);
    const main = readFileSync(resolve(__dirname, '../main.ts'), 'utf8');
    const labSong = main.match(/^\s*OaksLab:\s*'([^']+)'/m)?.[1];
    expect(labSong).toBe('oakslab');
    const deps = scene(); deps.restoreMapMusic = vi.fn(() => { playMusic(labSong!); });
    run(deps, [{ type: 'restoreMapMusic' }]);
    expect(deps.restoreMapMusic).toHaveBeenCalledOnce();
    expect(playMusic).toHaveBeenCalledWith('oakslab');
  });
  it('choose speech sets the asked flag first, has four borderless displays and three post-close Delay3s', () => {
    const commands = labChooseSpeech();
    expect(prints(commands)).toEqual(['OaksLabRivalFedUpWithWaitingText.Text', 'OaksLabOakChooseMonText.Text',
      'OaksLabRivalWhatAboutMeText.Text', 'OaksLabOakBePatientText.Text']);
    expect(commands.find(c => c.type === 'setFlag' && c.flag === 'OAK_ASKED_TO_CHOOSE_MON')).toBeDefined();
    expect(commands.findIndex(c => c.type === 'setFlag' && c.flag === 'OAK_ASKED_TO_CHOOSE_MON')).toBeLessThan(commands.findIndex(c => c.type === 'displayOpen'));
    expect(commands.filter(c => c.type === 'displayOpen').map(c => c.autoBox)).toEqual([false, false, false, false]);
    expect(commands.filter(c => c.type === 'wait').map(c => c.frames)).toEqual([3, 3, 3]);
    for (let i = 0; i < commands.length; i++) if (commands[i].type === 'wait') expect(commands[i - 1].type).toBe('displayClose');
  });
  it('snatch is five PrintTexts in one display, with one final outer wait', () => {
    const commands = labSnatchDisplay();
    expect(prints(commands)).toEqual(Array.from({ length: 5 }, (_, i) => `OaksLabRivalTakesText${i + 1}`));
    expect(commands.map(c => c.type)).toEqual(['displayOpen', ...Array(5).fill('printText'), 'displayClose']);
    expect(commands[6]).toEqual({ type: 'displayClose', outerWait: true });
  });
  it('gift text/jingle precedes AddPartyMon, drawing disable and flag; no outer wait or automatic advice', () => {
    const commands = labGiftDisplay();
    expect(commands.map(c => c.type)).toEqual(['displayOpen', 'printText', 'printText', 'addPokemon', 'hidePikachu', 'setFlag', 'displayClose']);
    expect(commands[2]).toEqual({ type: 'printText', program: 'OaksLabReceivedText', bindings: { nameBuffer: 'PIKACHU' } });
    expect(commands[6]).toEqual({ type: 'displayClose', outerWait: false });
    expect(prints(buildOaksLabBallScript())).not.toContain('OaksLabOak1Text.YourPokemonCanFightText');
    expect(prints(buildOaksLabIntroScript())).not.toContain('OaksLabOak1Text.YourPokemonCanFightText');
  });
  it('retains A6 ball push modes and paths; only the initial bubble/display envelope changes', () => {
    const commands = buildOaksLabBallScript();
    expect(commands[1]).toEqual({ type: 'emotionBubble', target: 'rival' });
    expect(commands.find(c => c.type === 'moveParallel')).toEqual({ type: 'moveParallel', npcId: 'rival',
      npcPath: ['down', 'right', 'right', 'right'], npcModes: ['normal', 'fast', 'fast', 'fast'],
      playerPath: ['right', 'right'], playerFromNpcStep: 4, spriteIndex: 1 });
    expect(commands.find(c => c.type === 'movePlayer')).toEqual({ type: 'movePlayer', path: ['left', 'down', 'left', 'left', 'left', 'up', 'up'] });
    expect(commands.find(c => c.type === 'hideNpc')).toEqual({ type: 'hideNpc', npcId: 'item_ball' });
  });
  it('parcel removes inside its first display, then enables automatic boxes for the direct Pokédex scene', () => {
    const commands = buildOaksLabPokedexScript(4, 3, () => undefined);
    expect(commands.slice(0, 4)).toEqual([{ type: 'displayOpen', autoBox: false },
      { type: 'printText', program: 'OaksLabOak1Text.DeliverParcelText' }, { type: 'removeItem', itemId: 'OAKS_PARCEL' },
      { type: 'displayClose', outerWait: true }]);
    expect(prints(commands)).toEqual(['OaksLabOak1Text.DeliverParcelText', 'OaksLabRivalGrampsText',
      'OaksLabRivalMyPokemonHasGrownStrongerText', 'OaksLabOakIHaveARequestText', 'OaksLabOakMyInventionPokedexText',
      'OaksLabOakGotPokedexText', 'OaksLabOakThatWasMyDreamText', 'OaksLabRivalLeaveItAllToMeText']);
    expect(commands.filter(c => c.type === 'displayOpen').map(c => c.autoBox)).toEqual([false, ...Array(7).fill(true)]);
    expect(commands.filter(c => c.type === 'wait').map(c => c.frames)).toEqual([1, 1, 1, 3, 3]);
    expect(commands.find(c => c.type === 'setFlag' && c.flag === 'GOT_POKEDEX')).toBeDefined();
    expect(commands.find(c => c.type === 'tryPikachuMovement')).toEqual({ type: 'tryPikachuMovement', caller: 'oaksLab' });
  });
  it('rival challenge/end retain movement and battle metadata, with four source displays', () => {
    const commands = buildOaksLabRivalBattleScript(7, 4, 4, 6);
    expect(prints(commands)).toEqual(['OaksLabRivalIllTakeYouOnText.Text', 'OaksLabRivalSmellYouLaterText.Text',
      'OaksLabPikachuDislikesPokeballsText1.Text', 'OaksLabPikachuDislikesPokeballsText2.Text']);
    expect(commands.find(c => c.type === 'startBattle')).toMatchObject({ trainerClass: 'RIVAL1', partyIndex: 0,
      endBattleProgram: 'OaksLabRivalIPickedTheWrongPokemonText' });
    expect(commands.find(c => c.type === 'wait')).toEqual({ type: 'wait', frames: 20 });
  });
  it('every migrated builder is free of legacy text/getText and exclamation commands', () => {
    const builders = [buildOaksLabIntroScript(), buildOaksLabAwaitBallScript(), buildOaksLabBallScript(),
      buildOaksLabRivalBattleScript(7, 4, 4, 6), buildOaksLabPokedexScript(4, 3, () => undefined)];
    for (const commands of builders) expect(commands.some(c => ['text', 'exclamation'].includes(c.type))).toBe(false);
    expect(readFileSync(resolve(__dirname, 'oaks_lab.ts'), 'utf8')).not.toContain('getText(');
  });
});
describe('Lab talk-time handler branches', () => {
  it.each([
    [[], 'GrampsIsntAroundText'], [['FOLLOWED_OAK_INTO_LAB_2'], 'IllGetABetterPokemonThanYou'],
    [['FOLLOWED_OAK_INTO_LAB_2', 'GOT_STARTER'], 'MyPokemonLooksStrongerText'],
  ] as const)('rival flags %j choose %s', (flags, suffix) => {
    expect(prints(labRivalText(context(...flags)))).toEqual([`OaksLabRivalText.${suffix}`]);
  });
  it.each([
    [[], 'GoAheadItsYours'], [['GOT_STARTER'], 'YourPokemonCanFightText'],
    [['BATTLED_RIVAL_IN_OAKS_LAB'], 'YouShouldTalkToIt'], [['GOT_POKEDEX'], 'PokemonAroundTheWorldText'],
  ] as const)('Oak flags %j choose %s', (flags, suffix) => {
    expect(prints(labOakText(context(...flags)))).toEqual([`OaksLabOak1Text.${suffix}`]);
  });
  it('Oak accepts a parcel only after battle; a Poké Ball in the bag takes the earlier source branch', () => {
    const ctx = context('BATTLED_RIVAL_IN_OAKS_LAB'); ctx.bag.add('OAKS_PARCEL');
    expect(prints(labOakText(ctx))[0]).toBe('OaksLabOak1Text.DeliverParcelText');
    ctx.bag.add('POKE_BALL'); expect(prints(labOakText(ctx))).toEqual(['OaksLabOak1Text.ComeSeeMeSometimesText']);
  });
  it.each([false, true])('Oak rating lead-in (flag=%s) closes without inventing the deferred rating screen', flag => {
    const ctx = context(...(flag ? ['PALLET_AFTER_GETTING_POKEBALLS'] : [])); ctx.ownedCount = flag ? 1 : 2;
    const commands = labOakText(ctx);
    expect(prints(commands)).toEqual(['OaksLabOak1Text.HowIsYourPokedexComingText']);
    expect(commands[commands.length - 1]).toEqual({ type: 'displayClose', outerWait: false });
  });
  it('ball before the choice prints its wrapper; asked ball opens borderless for the bubble and snatch', () => {
    expect(prints(labEeveeText(context()))).toEqual(['OaksLabEeveePokeBallText.Text']);
    expect(labEeveeText(context('OAK_ASKED_TO_CHOOSE_MON')).slice(0, 3)).toEqual(labBallDisplay());
  });
  it('dialogue swaps are removed while all Lab NPC visibility/position rules remain', () => {
    const deps = scene(); const texts = deps.npcs.map(n => n.data.dialogue);
    setFlag('GOT_STARTER'); applyStoryNpcState('OaksLab', deps.npcs);
    expect(deps.npcs.map(n => n.data.dialogue)).toEqual(texts);
    expect(deps.npcs.find(n => n.data.id === 'item_ball')!.hidden).toBe(true);
    const rival = deps.npcs.find(n => n.data.id === 'rival')!; expect([rival.x, rival.y]).toEqual([7 * 16, 4 * 16]);
  });
  it('Route 22 gift flags remain unsettable by current production scripts (I1 tripwire)', () => {
    function sources(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(resolve(dir, entry.name))
        : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [readFileSync(resolve(dir, entry.name), 'utf8')] : []);
    }
    const pattern = /(?:flag:\s*|setFlag\()['"](?:BEAT_ROUTE22_RIVAL_1ST_BATTLE|GOT_POKEBALLS_FROM_OAK)['"]/;
    expect(sources(resolve(__dirname, '..')).some(source => pattern.test(source))).toBe(false);
  });
});
describe('Lab runtime timing and side effects', () => {
  it('the plain PrintText wrapper has no border during its 20-frame init, writes at +23, and closes 15', () => {
    const deps = scene(); const box = deps.textBox; const dialogue = new MapDialogue(box);
    dialogue.show('', { autoBox: false, kind: 'printText', program: 'OaksLabGirlText.Text' });
    for (let t = 0; t < 20; t++) { vi.mocked(fillRect).mockClear(); box.render(); expect(fillRect).not.toHaveBeenCalled(); if (t < 19) dialogue.update(); }
    dialogue.update(); expect(syncJoypadRead).not.toHaveBeenCalled(); box.render(); expect(fillRect).toHaveBeenCalled();
    dialogue.update(); dialogue.update(); expect(syncJoypadRead).not.toHaveBeenCalled(); dialogue.update();
    expect(syncJoypadRead).toHaveBeenCalled();
    let close = -1, end = -1;
    for (let t = 24; t < 3000; t++) {
      vi.mocked(isHeld).mockImplementation(b => b === 'b' && t % 2 === 0 && box.isWaitingForInput); audio.update();
      if (dialogue.update()) { end = t; break; } if (close < 0 && box.closing) close = t;
    }
    expect(end - close).toBe(15);
  });
  it('the asked ball keeps its entire init/bubble borderless and closes only after 20 + 61 + 15', () => {
    const deps = scene(); initScript(labBallDisplay()); updateScript(deps, false);
    for (let t = 1; t < 96; t++) { tick(deps, t, false); vi.mocked(fillRect).mockClear(); uiTiles.clear(); deps.textBox.render();
      expect(fillRect).not.toHaveBeenCalled(); expect(uiTiles.tileAt(18, 16)).toBe(0); expect(deps.textBox.active).toBe(true); }
    expect(syncJoypadRead).toHaveBeenCalledTimes(1); tick(deps, 96, false); expect(deps.textBox.active).toBe(false);
  });
  it('the gift adds Pikachu only after the real key-item jingle returns, then hides the follower and closes 15', () => {
    const deps = scene(); initScript(labGiftDisplay()); updateScript(deps, false);
    let soundStart = -1, given = -1, close = -1, end = -1;
    for (let t = 1; t < 4000 && getActiveScript(); t++) {
      tick(deps, t);
      if (soundStart < 0 && vi.mocked(playSFX).mock.calls.some(c => c[0] === 'get_key_item')) soundStart = t;
      if (given < 0 && deps.playerParty.length) { given = t; expect(hasFlag('GOT_STARTER')).toBe(true); expect(deps.pikachuFollower!.visible).toBe(false); }
      if (close < 0 && deps.textBox.closing) close = t;
      if (close >= 0 && !deps.textBox.active && end < 0) end = t;
    }
    expect(given - soundStart).toBe(121); expect(given).toBe(close); expect(end - close).toBe(15);
    expect(deps.playerParty).toHaveLength(1); expect(deps.playerParty[0].species.id).toBe(25);
  });
  it('the five snatch programs share one display and one key-item jingle', () => {
    const deps = scene(); run(deps, labSnatchDisplay());
    expect(deps.textBox.displayRevision).toBe(1);
    expect(vi.mocked(playSFX).mock.calls.filter(c => c[0] === 'get_key_item')).toHaveLength(1);
  });
  it('zero-gap successive displays have separate revisions even when close and open share a CPU tick', () => {
    const deps = scene(); initScript([...labDisplay('OaksLabPikachuDislikesPokeballsText1.Text'), ...labDisplay('OaksLabPikachuDislikesPokeballsText2.Text')]);
    updateScript(deps, false); let seenSecond = false;
    for (let t = 1; t < 4000 && getActiveScript(); t++) { tick(deps, t);
      if (deps.textBox.displayRevision === 2) { seenSecond = true; expect(deps.textBox.active).toBe(true); break; } }
    expect(seenSecond).toBe(true);
  });
  it('free-movement Oak talk runs a nested handler and returns to the retained await, then ball A opens in that tick', () => {
    const deps = scene(); setFlag('OAK_ASKED_TO_CHOOSE_MON');
    const oak = deps.npcs.find(n => n.data.id === 'prof')!; const ball = deps.npcs.find(n => n.data.id === 'item_ball')!;
    const interact = vi.spyOn(deps.player, 'checkInteraction').mockReturnValue({ npc: oak });
    initScript(buildOaksLabAwaitBallScript()); updateScript(deps, false); updateScript(deps, true); interact.mockReturnValue(null);
    expect(deps.textBox.phase).toBe('opening');
    for (let t = 1; t < 3000 && deps.textBox.active; t++) tick(deps, t);
    const script = getActiveScript()!; expect(script.commands[script.index].type).toBe('awaitInteraction');
    expect(deps.textBox.active).toBe(false); interact.mockReturnValue({ npc: ball });
    updateScript(deps, true); expect(deps.textBox.phase).toBe('opening'); expect(deps.textBox.displayRevision).toBe(2);
  });
  it.each([[4, 0], [5, 0], [0, 1]])('free-movement hidden text at (%i,%i) draws its border and glyphs, then returns to the await (F-1)', (x, y) => {
    const deps = scene(); setFlag('OAK_ASKED_TO_CHOOSE_MON');
    const event = deps.gameMap.mapData!.hiddenEvents!.find(e => e.x === x && e.y === y)!;
    deps.player.setTilePosition(x * 2, (y + 1) * 2); deps.player.direction = 'up';
    initScript(buildOaksLabAwaitBallScript()); updateScript(deps, false);
    vi.mocked(isPassPressed).mockImplementation(key => key === 'a');
    updateScript(deps, true); vi.mocked(isPassPressed).mockReturnValue(false);
    expect(deps.textBox.phase).toBe('opening'); expect(deps.textBox.uiTileAt(0, 12)).toBe(0x60);
    for (let t = 1; t <= 3; t++) tick(deps, t, false);
    vi.mocked(fillRect).mockClear(); deps.textBox.render();
    expect(fillRect).toHaveBeenCalledWith(0, 96, 160, 48, 0);
    for (let t = 4; t <= 23; t++) tick(deps, t, false);
    const glyph = deps.textBox.saveScreen().buffer[41];
    expect(glyph).not.toBe(' ');
    if (event.text) expect(glyph).toBe(event.text[0]);
    vi.mocked(drawTile).mockClear(); deps.textBox.render();
    expect(vi.mocked(drawTile).mock.calls.some(call => call[2] === 8 && call[3] === 112)).toBe(true);
    for (let t = 24; t < 4000 && deps.textBox.active; t++) tick(deps, t);
    expect(deps.textBox.active).toBe(false);
    const script = getActiveScript()!; expect(script.commands[script.index].type).toBe('awaitInteraction');
    const ball = deps.npcs.find(n => n.data.id === 'item_ball')!;
    vi.spyOn(deps.player, 'checkInteraction').mockReturnValue({ npc: ball });
    updateScript(deps, true); expect(deps.textBox.phase).toBe('opening');
    expect(deps.textBox.displayRevision).toBe(2);
  });
  it('the real guard path prints its source program before forcing the one-step return', () => {
    const deps = scene(); deps.player.setTilePosition(8, 12);
    vi.spyOn(deps.player, 'checkInteraction').mockReturnValue(null); vi.spyOn(deps.player, 'update').mockImplementation(() => {});
    const finished = vi.spyOn(deps.player, 'justFinishedStep', 'get').mockReturnValue(true);
    initScript(buildOaksLabAwaitBallScript()); updateScript(deps, false); updateScript(deps, true); finished.mockReturnValue(false);
    expect(getActiveScript()!.commands.some(c => c.type === 'printText' && c.program === LAB_GUARD_PROGRAM)).toBe(true);
    expect(opening(getActiveScript()!.commands)).toEqual({ type: 'displayOpen', autoBox: false, spriteIndex: 10 });
    for (let t = 1; t < 4000 && deps.textBox.active; t++) tick(deps, t);
    expect(deps.textBox.active).toBe(false); expect(deps.player.scriptedMoveDone).toBe(false);
  });
  it('the guard step is followed by Delay3: three frames with no joypad read (N-2)', () => {
    const deps = scene(); deps.player.setTilePosition(8, 12);
    vi.spyOn(deps.player, 'checkInteraction').mockReturnValue(null);
    const update = vi.spyOn(deps.player, 'update').mockImplementation(() => {});
    const finished = vi.spyOn(deps.player, 'justFinishedStep', 'get').mockReturnValue(true);
    initScript(buildOaksLabAwaitBallScript()); updateScript(deps, false); updateScript(deps, true);
    finished.mockRestore(); update.mockRestore();
    for (let t = 1; t < 4000 && deps.textBox.active; t++) tick(deps, t);
    expect(deps.player.scriptedMoveDone).toBe(false);
    for (let i = 0; i < 40 && !deps.player.scriptedMoveDone; i++) updateScript(deps, i % 2 === 0);
    expect(deps.player.scriptedMoveDone).toBe(true);
    vi.mocked(readJoypad).mockClear();
    updateScript(deps, true); // the pass that notices the step and starts Delay3
    expect(readJoypad).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) updateScript(deps, true);
    expect(readJoypad).not.toHaveBeenCalled();
    updateScript(deps, true);
    expect(readJoypad).toHaveBeenCalled();
  });
  it('a free-movement Lab NPC opens borderless through the first 20 frames (N-3)', () => {
    const deps = scene(); setFlag('OAK_ASKED_TO_CHOOSE_MON');
    const girl = deps.npcs.find(n => n.data.id === 'girl')!;
    vi.spyOn(deps.player, 'checkInteraction').mockReturnValue({ npc: girl });
    initScript(buildOaksLabAwaitBallScript()); updateScript(deps, false); updateScript(deps, true);
    expect(getActiveScript()!.commands.find(c => c.type === 'displayOpen')).toEqual({ type: 'displayOpen', autoBox: false });
    for (let t = 1; t <= 18; t++) tick(deps, t, false);
    vi.mocked(fillRect).mockClear(); deps.textBox.render();
    expect(fillRect).not.toHaveBeenCalled();
  });
  it('battle metadata resolves its source program to the same legacy string until A5c', () => {
    const deps = scene(); initScript(buildOaksLabRivalBattleScript(4, 5, 4, 6)); updateScript(deps, false);
    let action;
    for (let t = 1; t < 4000; t++) { action = tick(deps, t); if (action?.type === 'startBattleTransition') break; }
    expect(action).toMatchObject({ type: 'startBattleTransition', endBattleText: 'WHAT?\nUnbelievable!\nI picked the\nwrong POKéMON!' });
  });
  it('detects an automatic border wrongly enabled in the ball display', () => {
    const wrong = labBallDisplay(); const open = wrong[0]; if (open.type === 'displayOpen') open.autoBox = true;
    const deps = scene(); initScript(wrong); updateScript(deps, false); vi.mocked(fillRect).mockClear();
    for (let t = 1; t < 4; t++) tick(deps, t, false); deps.textBox.render();
    expect(() => expect(fillRect).not.toHaveBeenCalled()).toThrow();
  });
  it('detects AddPartyMon moved before the gift programs', () => {
    const wrong = labGiftDisplay(); const mon = wrong.splice(3, 1)[0]; wrong.splice(1, 0, mon);
    const deps = scene(); initScript(wrong); updateScript(deps, false);
    for (let t = 1; t <= 20; t++) tick(deps, t, false);
    expect(() => expect(deps.playerParty).toHaveLength(0)).toThrow();
  });
});

describe('Map-music CP3: the Lab clears BIT_NO_MAP_MUSIC at OaksLabFollowedOakScript', () => {
  it('a callback clears the bit immediately before the intro restoreMapMusic', () => {
    const intro = buildOaksLabIntroScript();
    const i = intro.findIndex(c => c.type === 'restoreMapMusic');
    const before = intro[i - 1];
    expect(before.type).toBe('callback');
    setNoMapMusic(true); if (before.type === 'callback') before.fn();
    expect(isNoMapMusic()).toBe(false);
  });
});
