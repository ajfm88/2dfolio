import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rig, musicData, sfxData } from '../test/audio_rig';
import * as audioApi from '../audio';
import '../story/pewter_pokecenter'; // register PewterPokecenter:3
import { getTextHandler } from './text_handlers';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { initScript, updateScript as controllerUpdate, getActiveScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import { createPokemon, loadBattleData } from '../battle';
import { restoreFlags, setFlag } from '../events';
import { setJoyIgnore } from '../input/joy_ignore';
import { isHeld, isPassPressed } from '../input';
import { uiTiles } from '../renderer/ui_tiles';
import { enablePikachuFollowing, isPikachuFollowingDisabled } from '../pikachu/pikachu_following';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: () => false,
  readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
// Map-music CP3: playMusicNew (PN) is the entry for the PkmnHealed jingle; the same mock keeps every playMusic assertion intact.
vi.mock('../audio', () => { const playMusic = vi.fn(); return { playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), playMusic, playMusicNew: playMusic, isMusicChannelActive: vi.fn(() => false), preloadMusic: vi.fn(), fadeOutAndStopMusic: vi.fn(), isAudioFadingOut: vi.fn(() => false) }; });
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  getCtx: () => ({ save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn() }),
  getScale: () => 1, getActivePalette: () => 'VIRIDIAN', obpMapping: (reg: number) => [0, 1, 2, 3].map(c => (reg >> (2 * c)) & 3),
  loadSpriteMapped: async () => ({ width: 8, height: 16 }), loadFont: async () => ({ width: 128 }),
  loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }) }));

const dataDir = resolve(__dirname, '../../data');
const mapData = JSON.parse(readFileSync(resolve(dataDir, 'maps/PewterPokecenter.json'), 'utf8'));

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); });
let audio = rig();
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); restoreFlags([]); setFlag('BATTLED_RIVAL_IN_OAKS_LAB');
  enablePikachuFollowing(); setJoyIgnore('none'); setTextSpeed('fast'); uiTiles.clear();
  audio = rig(musicData('jigglypuffsong'));
  vi.mocked(audioApi.preloadMusic).mockResolvedValue();
  vi.mocked(audioApi.fadeOutAndStopMusic).mockImplementation(n => audio.fade.fadeOutAndStopMusic(n));
  vi.mocked(audioApi.isAudioFadingOut).mockImplementation(() => audio.fade.isFadingOut());
  vi.mocked(audioApi.playMusic).mockImplementation(async name => { audio.music.play(musicData(name)); });
  vi.mocked(audioApi.playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); });
  vi.mocked(audioApi.isMusicChannelActive).mockImplementation(id => audio.music.getChannel(id)?.active ?? false);
  vi.mocked(audioApi.isSoundFinished).mockReturnValue(true);
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false);
});
function updateScript(deps: ScriptDeps, isPass: boolean) { audio.update(); return controllerUpdate(deps, isPass); }

function scene(pikachu: 'none' | 'alive' | 'fainted' | 'status' = 'none') {
  const gameMap = new GameMap(); gameMap.mapData = structuredClone(mapData);
  const player = new Player(); player.setTilePosition(10, 6); player.direction = 'up';
  const npcs = gameMap.mapData!.npcs.map(n => new Npc({ ...n }));
  const mon = createPokemon(pikachu === 'none' ? 19 : 25, 5)!;
  if (pikachu === 'fainted') mon.currentHp = 0;
  if (pikachu === 'status') { mon.currentHp = 1; mon.status = 'PSN'; }
  const follower = new PikachuFollower(); follower.visible = pikachu === 'alive';
  if (follower.visible) follower.spawn(player.x, player.y, 'up');
  const textBox = new TextBox({ closeFrames: () => 17, updateSprites: () => {} });
  const deps: ScriptDeps = { gameMap, player, npcs, playerParty: [mon], playerBag: new Bag(),
    pikachuFollower: follower, textBox, restoreMapMusic: vi.fn() };
  return { deps, mon, follower, find: (id: string) => npcs.find(n => n.data.id === id) };
}

describe('PewterPokecenter Jigglypuff handler', () => {
  it.each([false, true])('traces print, song, writes, wait-only restore, Hold and close (pending sound/A=%s)', pending => {
    const s = scene('alive'); const box = s.deps.textBox;
    const npc = s.find('jigglypuff')!; npc.direction = 'left';
    const commands = getTextHandler('PewterPokecenter', 3)!({ hasFlag: () => false, bag: new Bag(), ownedCount: 0,
      facing: 'up', step: { x: 0, y: 0 }, party: s.deps.playerParty, findNpc: s.find });
    let frame = 0, firstGlyph = -1, end = -1, song = -1, exit = -1, restore = -1, close = -1;
    const writes: { frame: number; direction: string }[] = [];
    const polls: { frame: number; id: number; active: boolean }[] = [];
    const original = npc.showStandingImage.bind(npc);
    vi.spyOn(npc, 'showStandingImage').mockImplementation(direction => { writes.push({ frame, direction }); original(direction); });
    vi.mocked(audioApi.playMusic).mockImplementation(async name => {
      expect(name).toBe('jigglypuffsong'); song = frame; audio.music.play(musicData(name));
    });
    vi.mocked(audioApi.isMusicChannelActive).mockImplementation(id => {
      const active = audio.music.getChannel(id)?.active ?? false; polls.push({ frame, id, active }); return active;
    });
    vi.mocked(s.deps.restoreMapMusic!).mockImplementation(() => {
      restore = frame; expect(isPikachuFollowingDisabled()).toBe(false);
    });
    const finish = box.finish.bind(box);
    vi.spyOn(box, 'finish').mockImplementation(opts => {
      close = frame; expect(isPikachuFollowingDisabled()).toBe(true);
      expect(opts.outerWait).toBe(false); finish(opts);
    });
    const screen = () => Reflect.get(box, 'screen') as { buffer: string[] };
    initScript(commands); controllerUpdate(s.deps, false); // T=0, audio starts updating at T+1
    for (frame = 1; frame < 2000 && getActiveScript(); frame++) {
      if (song >= 0 && frame === song + 456 && pending) vi.mocked(audioApi.isSoundFinished).mockReturnValue(false);
      if (song >= 0 && frame === song + 463) vi.mocked(audioApi.isSoundFinished).mockReturnValue(true);
      // Hold A only after printing, then release it while B remains held.
      vi.mocked(isHeld).mockImplementation(k => pending && song >= 0 && frame >= song + 456 && frame < song + 467 && k === 'a');
      if (pending && song >= 0 && frame >= song + 467) vi.mocked(isHeld).mockImplementation(k => k === 'b');
      updateScript(s.deps, frame % 2 === 0);
      if (firstGlyph < 0 && screen().buffer[41] !== ' ') firstGlyph = frame;
      if (end < 0 && box.isTextComplete) end = frame;
      if (song >= 0 && exit < 0 && getActiveScript()?.commands[getActiveScript()!.index].type === 'wait') exit = frame;
      if (restore < 0) expect(isPikachuFollowingDisabled()).toBe(false);
      if (pending && song >= 0 && frame >= song + 456 && frame < song + 463) {
        expect(box.closing).toBe(false); expect(s.deps.restoreMapMusic).not.toHaveBeenCalled();
      }
      if (pending && close >= 0 && frame < song + 467) {
        expect(box.phase).toBe('holding'); expect(box.isWaitingForInput).toBe(false);
      }
    }
    expect(firstGlyph).toBe(23); expect(end).toBeGreaterThan(firstGlyph);
    expect(audioApi.fadeOutAndStopMusic).toHaveBeenCalledExactlyOnceWith(0);
    expect(song).toBe(end + 32);
    expect(writes).toEqual(Array.from({ length: 17 }, (_, k) => ({ frame: song + 24 * k,
      direction: ['left', 'up', 'right', 'down'][k % 4] })));
    expect(polls.filter(p => p.id === 1).map(p => p.frame)).toEqual(Array.from({ length: 17 }, (_, k) => song + 24 * (k + 1)));
    expect(polls.slice(-2)).toEqual([{ frame: song + 408, id: 1, active: false }, { frame: song + 408, id: 2, active: false }]);
    expect(exit).toBe(song + 408);
    expect(restore).toBe(song + 456 + (pending ? 7 : 0)); expect(close).toBe(restore);
    expect(s.deps.restoreMapMusic).toHaveBeenCalledOnce(); expect(audioApi.playMusic).toHaveBeenCalledOnce();
    expect(audioApi.playSFX).not.toHaveBeenCalled();
    expect(getActiveScript()).toBeNull(); expect(box.active).toBe(false);
    expect(frame - 1).toBe((pending ? song + 467 : close) + 17);
  });

  it('handler is registered for PewterPokecenter:3', () => {
    expect(getTextHandler('PewterPokecenter', 3)).toBeDefined();
  });

  it('produces 17 Jigglypuff image writes before exiting', () => {
    const s = scene('alive');
    const jigglypuff = s.find('jigglypuff');
    expect(jigglypuff).toBeDefined();
    const handler = getTextHandler('PewterPokecenter', 3)!;
    const commands = handler({ hasFlag: () => false, bag: new Bag(), ownedCount: 0,
      facing: 'up', step: { x: 0, y: 0 }, party: s.deps.playerParty,
      findNpc: s.find });
    const writes: string[] = [];
    const showOrig = jigglypuff!.showStandingImage.bind(jigglypuff!);
    vi.spyOn(jigglypuff!, 'showStandingImage').mockImplementation(dir => { writes.push(dir); showOrig(dir); });
    initScript(commands); updateScript(s.deps, false);
    for (let frame = 1; frame < 5000 && getActiveScript(); frame++) {
      vi.mocked(isPassPressed).mockReturnValue(false);
      updateScript(s.deps, frame % 2 === 0);
    }
    expect(writes).toHaveLength(17);
  });

  it('does not set DisablePikachuFollowing when starter has status', () => {
    const s = scene('status');
    const handler = getTextHandler('PewterPokecenter', 3)!;
    const commands = handler({ hasFlag: () => false, bag: new Bag(), ownedCount: 0,
      facing: 'up', step: { x: 0, y: 0 }, party: s.deps.playerParty, findNpc: s.find });
    initScript(commands); updateScript(s.deps, false);
    for (let frame = 1; frame < 5000 && getActiveScript(); frame++) {
      vi.mocked(isPassPressed).mockReturnValue(false);
      updateScript(s.deps, frame % 2 === 0);
    }
    expect(getActiveScript()).toBeNull(); expect(s.deps.textBox.active).toBe(false);
    expect(isPikachuFollowingDisabled()).toBe(false);
  });

  it('does not set DisablePikachuFollowing when starter is fainted', () => {
    const s = scene('fainted');
    const handler = getTextHandler('PewterPokecenter', 3)!;
    const commands = handler({ hasFlag: () => false, bag: new Bag(), ownedCount: 0,
      facing: 'up', step: { x: 0, y: 0 }, party: s.deps.playerParty, findNpc: s.find });
    initScript(commands); updateScript(s.deps, false);
    for (let frame = 1; frame < 5000 && getActiveScript(); frame++) {
      vi.mocked(isPassPressed).mockReturnValue(false);
      updateScript(s.deps, frame % 2 === 0);
    }
    expect(getActiveScript()).toBeNull(); expect(s.deps.textBox.active).toBe(false);
    expect(isPikachuFollowingDisabled()).toBe(false);
  });

  it('does not set DisablePikachuFollowing with no starter in party', () => {
    const s = scene('none');
    const handler = getTextHandler('PewterPokecenter', 3)!;
    const commands = handler({ hasFlag: () => false, bag: new Bag(), ownedCount: 0,
      facing: 'up', step: { x: 0, y: 0 }, party: s.deps.playerParty, findNpc: s.find });
    initScript(commands); updateScript(s.deps, false);
    for (let frame = 1; frame < 5000 && getActiveScript(); frame++) {
      vi.mocked(isPassPressed).mockReturnValue(false);
      updateScript(s.deps, frame % 2 === 0);
    }
    expect(getActiveScript()).toBeNull(); expect(s.deps.textBox.active).toBe(false);
    expect(isPikachuFollowingDisabled()).toBe(false);
  });

  it('sets DisablePikachuFollowing when starter is alive with no status', () => {
    const s = scene('alive');
    const handler = getTextHandler('PewterPokecenter', 3)!;
    const commands = handler({ hasFlag: () => false, bag: new Bag(), ownedCount: 0,
      facing: 'up', step: { x: 0, y: 0 }, party: s.deps.playerParty, findNpc: s.find });
    initScript(commands); updateScript(s.deps, false);
    for (let frame = 1; frame < 5000 && getActiveScript(); frame++) {
      vi.mocked(isPassPressed).mockReturnValue(false);
      updateScript(s.deps, frame % 2 === 0);
    }
    expect(getActiveScript()).toBeNull(); expect(s.deps.textBox.active).toBe(false);
    expect(isPikachuFollowingDisabled()).toBe(true);
  });
});
