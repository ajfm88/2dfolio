import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rig, musicData, sfxData } from '../test/audio_rig';
import * as audioApi from '../audio';
import { buildNurseScript } from './pokecenter';
import { getTextHandler } from './text_handlers';
import { getTextScript } from './text_handlers';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { initScript, updateScript as controllerUpdate, getActiveScript, renderHealingMachine } from '../script/script_controller';
import { textBgTransfer } from '../text/bg_transfer';
import type { ScriptDeps } from '../script/script_controller';
import type { ScriptCommand } from '../script/types';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import { createPokemon, loadBattleData } from '../battle';
import { hasFlag, restoreFlags, setFlag, getAllFlags } from '../events';
import { enablePikachuFollowing, disablePikachuFollowing } from '../pikachu/pikachu_following';
import { setJoyIgnore } from '../input/joy_ignore';
import { isHeld, isPassPressed, syncJoypadRead, readJoypad } from '../input';
import { uiTiles } from '../renderer/ui_tiles';
import { drawSprite } from '../renderer';
import * as uiEntry from '../overworld/ui_entry';
import { updateSprites } from '../overworld/sprites';
import { createOverworldState, updateOverworld } from '../overworld/overworld_controller';
import { loadPikachuMovementData } from '../pikachu/pikachu_movement_data';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: () => false,
  readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
// Map-music CP3: playMusicNew (PN) is the entry for the PkmnHealed jingle; the same mock keeps every playMusic assertion intact.
vi.mock('../audio', () => { const playMusic = vi.fn(); return { playSFX: vi.fn(), isSoundFinished: () => true, playMusic, playMusicNew: playMusic, isMusicChannelActive: vi.fn(() => false), preloadMusic: vi.fn(), fadeOutAndStopMusic: vi.fn(), isAudioFadingOut: vi.fn(() => false) }; });
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
const machineDraw = vi.hoisted(() => ({ save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn() }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  getCtx: () => machineDraw, getScale: () => 1,
  getActivePalette: () => 'VIRIDIAN', obpMapping: (reg: number) => [0, 1, 2, 3].map(c => (reg >> (2 * c)) & 3),
  loadSpriteMapped: async () => ({ width: 8, height: 16 }), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }) }));
let audio = rig();
function updateScript(deps: ScriptDeps, isPass: boolean) { audio.update(); return controllerUpdate(deps, isPass); }
const dataDir = resolve(__dirname, '../../data');
const mapData = JSON.parse(readFileSync(resolve(dataDir, 'maps/ViridianPokecenter.json'), 'utf8'));
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); await loadPikachuMovementData(); });
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); restoreFlags([]); setFlag('BATTLED_RIVAL_IN_OAKS_LAB'); enablePikachuFollowing();
  setJoyIgnore('none'); setTextSpeed('fast'); uiTiles.clear();
  audio = rig(musicData('pokecenter'));
  vi.mocked(audioApi.preloadMusic).mockResolvedValue();
  vi.mocked(audioApi.fadeOutAndStopMusic).mockImplementation(n => audio.fade.fadeOutAndStopMusic(n));
  vi.mocked(audioApi.isAudioFadingOut).mockImplementation(() => audio.fade.isFadingOut());
  vi.mocked(audioApi.playMusic).mockImplementation(async name => { audio.music.play(musicData(name)); });
  vi.mocked(audioApi.playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); });
  vi.mocked(audioApi.isMusicChannelActive).mockImplementation(id => audio.music.getChannel(id)?.active ?? false);
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false); });
function scene(pikachu: 'none' | 'alive' | 'fainted' = 'none') {
  const gameMap = new GameMap(); gameMap.mapData = structuredClone(mapData);
  const player = new Player(); player.setTilePosition(10, 6); player.direction = 'up';
  const npcs = gameMap.mapData!.npcs.map(n => new Npc({ ...n }));
  const mon = createPokemon(pikachu === 'none' ? 19 : 25, 5)!; mon.currentHp = pikachu === 'fainted' ? 0 : 1;
  const follower = new PikachuFollower(); follower.visible = pikachu === 'alive';
  if (follower.visible) follower.spawn(player.x, player.y, 'up'); else follower.direction = 'left';
  const close = vi.fn(() => updateSprites(npcs, gameMap, player, follower));
  const textBox = new TextBox({ closeFrames: () => 17, updateSprites: close });
  const deps: ScriptDeps = { gameMap, player, npcs, playerParty: [mon], playerBag: new Bag(),
    pikachuFollower: follower, textBox, restoreMapMusic: vi.fn() };
  return { deps, mon, follower, close, find: (id: string) => npcs.find(n => n.data.id === id) };
}
const last = <T>(items: T[]): T | undefined => items[items.length - 1];
function choice(commands: ScriptCommand[]) {
  const found = commands.find(c => c.type === 'yesNoChoice');
  if (found?.type !== 'yesNoChoice') throw new Error('missing nurse choice'); return found;
}
function flattened(commands: ScriptCommand[]): ScriptCommand[] {
  return commands.flatMap(c => [c, ...(c.type === 'yesNoChoice' ? [...flattened(c.yes), ...flattened(c.no)]
    : (c.type === 'ifStarterPikachu' || c.type === 'ifPewterPikachuAsleep') ? flattened(c.then) : [])]);
}
function trace(s: ReturnType<typeof scene>, answer: 'yes' | 'no' = 'yes', used = false,
  transform?: (commands: ScriptCommand[]) => ScriptCommand[]) {
  if (used) setFlag('USED_POKECENTER');
  let frame = 0, firstRead = -1, closing = -1, closeEnd = -1, menu = -1, firstMenuRead = -1;
  const printed: { program: string; frame: number; used: boolean }[] = [];
  const hidden: number[] = [], updates: { frame: number; tile: number }[] = [];
  const ticks: { frame: number; command: string | undefined; coverage: number; bow: boolean }[] = [];
  const onHeal = vi.fn(() => { expect(last(updates)?.tile).toBe(0x60); });
  const print = s.deps.textBox.print.bind(s.deps.textBox);
  vi.spyOn(s.deps.textBox, 'print').mockImplementation((source, options) => {
    if ('program' in source) printed.push({ program: source.program, frame, used: hasFlag('USED_POKECENTER') });
    print(source, options);
  });
  const hide = s.deps.textBox.hideDisplay.bind(s.deps.textBox);
  vi.spyOn(s.deps.textBox, 'hideDisplay').mockImplementation(() => { hidden.push(frame); hide(); });
  const update = uiEntry.fontLoadedUpdateSprites;
  vi.spyOn(uiEntry, 'fontLoadedUpdateSprites').mockImplementation((p, m, tileAt, follower) => {
    updates.push({ frame, tile: tileAt(0, 12) }); update(p, m, tileAt, follower);
  });
  const commands = buildNurseScript(s.find, onHeal);
  initScript(transform ? transform(commands) : commands); updateScript(s.deps, false);
  for (frame = 1; frame < 6000 && getActiveScript(); frame++) {
    const before = vi.mocked(syncJoypadRead).mock.calls.length;
    const oldMenuReads = vi.mocked(readJoypad).mock.calls.length;
    vi.mocked(isHeld).mockImplementation(k => k === 'b' && frame % 2 === 0 && s.deps.textBox.isWaitingForInput);
    vi.mocked(isPassPressed).mockImplementation(k => k === (answer === 'yes' ? 'a' : 'b'));
    updateScript(s.deps, frame % 2 === 0);
    if (firstRead < 0 && vi.mocked(syncJoypadRead).mock.calls.length > before) firstRead = frame;
    if (firstMenuRead < 0 && vi.mocked(readJoypad).mock.calls.length > oldMenuReads) firstMenuRead = frame;
    const script = getActiveScript();
    ticks.push({ frame, command: script?.commands[script.index].type, coverage: s.deps.textBox.uiTileAt(0, 12),
      bow: s.find('nurse')!.useWalkFrame });
    if (menu < 0 && script?.commands[script.index].type === 'yesNoChoice') menu = frame;
    if (closing < 0 && s.deps.textBox.closing) closing = frame;
    if (closing >= 0 && !s.deps.textBox.active) closeEnd = frame;
  }
  expect(getActiveScript()).toBeNull();
  return { printed, hidden, updates, ticks, onHeal, firstRead, closing, closeEnd, menu, firstMenuRead };
}
describe('DisplayPokemonCenterDialogue_ on one retained display', () => {
  it('source programs, pause ops and A6e waits stay ordered without legacy text', () => {
    const commands = buildNurseScript(() => undefined); const all = flattened(commands);
    expect(all.filter(c => c.type === 'printText').map(c => c.program)).toEqual([
      'LooksContentText', 'PokemonCenterWelcomeText', 'ShallWeHealYourPokemonText', 'NeedYourPokemonText', 'PokemonFightingFitText', 'PokemonCenterFarewellText']);
    expect(commands[0]).toEqual({ type: 'displayOpen' }); expect(commands[1]).toEqual({ type: 'pikachuFacing', action: 'save' });
    expect(last(commands)).toEqual({ type: 'displayClose', outerWait: true });
    expect(all.filter(c => c.type === 'displayHide')).toHaveLength(2);
    expect(all.some(c => ['text', 'yesNo', 'uiEntryUpdates'].includes(c.type))).toBe(false);
    expect(getTextPrograms().ShallWeHealYourPokemonText[0]).toEqual({ op: 'pause' });
    expect(getTextPrograms().PokemonCenterFarewellText[0]).toEqual({ op: 'pause' });
    expect(choice(commands).yes.filter(c => c.type === 'wait').map(c => c.frames)).toEqual([64, 6, 30, 6, 3, 40]);
    const sequence = choice(commands).yes.map(c => c.type);
    expect(sequence.slice(sequence.indexOf('healingMachine'), sequence.indexOf('healingMachine') + 4))
      .toEqual(['healingMachine', 'updateSprites', 'healParty', 'restoreMapMusic']);
  });
  it.each([1, 6])('%i members: the return tick updates, heals and restarts in order, retaining OAM for two renders', async n => {
    const s = scene();
    s.deps.npcs = []; // machine placement must work without a nurse lookup
    s.deps.playerParty = Array.from({ length: n }, (_, i) => {
      const mon = createPokemon(19, 5)!;
      mon.currentHp = i === n - 1 ? 0 : 1; mon.status = 'PSN'; mon.sleepTurns = 3;
      mon.toxicCounter = 5; mon.badlyPoisoned = true;
      for (const move of mon.moves) move.pp = 0;
      return mon;
    });
    const damaged = s.deps.playerParty.map(mon => [mon.currentHp, mon.status, mon.sleepTurns,
      mon.toxicCounter, mon.badlyPoisoned, ...mon.moves.map(move => move.pp)]);
    initScript([{ type: 'displayOpen' }, { type: 'healingMachine' }, { type: 'updateSprites' },
      { type: 'healParty' }, { type: 'restoreMapMusic' }, { type: 'wait', frames: 4 }]);
    updateScript(s.deps, false);
    for (let t = 1; t <= 20; t++) updateScript(s.deps, false); // H: command enters
    await Promise.resolve();
    const order: string[] = [];
    vi.spyOn(uiEntry, 'fontLoadedUpdateSprites').mockImplementation((_p, _m, tileAt) => {
      expect(tileAt(0, 12)).toBe(0x60);
      expect(s.deps.playerParty.map(mon => [mon.currentHp, mon.status, mon.sleepTurns,
        mon.toxicCounter, mon.badlyPoisoned, ...mon.moves.map(move => move.pp)])).toEqual(damaged);
      order.push('update');
    });
    s.deps.restoreMapMusic = vi.fn(() => {
      for (const mon of s.deps.playerParty) {
        expect(mon.currentHp).toBe(mon.maxHp); expect(mon.status).toBeNull();
        expect([mon.sleepTurns, mon.toxicCounter, mon.badlyPoisoned]).toEqual([0, 0, false]);
        expect(mon.moves.every(move => move.pp === move.maxPp)).toBe(true);
      }
      order.push('restore');
    });
    const transfer = vi.spyOn(textBgTransfer, 'tick');
    vi.mocked(syncJoypadRead).mockClear(); vi.mocked(readJoypad).mockClear();
    const done = 209 + 30 * n;
    for (let f = 1; f <= done + 2; f++) {
      transfer.mockClear(); updateScript(s.deps, false);
      expect(transfer, `one BG tick at H+${f}`).toHaveBeenCalledTimes(1);
      expect(syncJoypadRead).not.toHaveBeenCalled(); expect(readJoypad).not.toHaveBeenCalled();
      if (f < done) {
        expect(s.deps.playerParty.map(mon => [mon.currentHp, mon.status, mon.sleepTurns,
          mon.toxicCounter, mon.badlyPoisoned, ...mon.moves.map(move => move.pp)])).toEqual(damaged);
        expect(order).toEqual([]);
      } else {
        expect(order).toEqual(['update', 'restore']);
        machineDraw.drawImage.mockClear(); renderHealingMachine();
        expect(machineDraw.drawImage).toHaveBeenCalledTimes(f === done + 2 ? 0 : n + 1);
      }
    }
    expect(s.deps.restoreMapMusic).toHaveBeenCalledOnce();
  });
  it.each([false, true])('YES with no Pikachu: used=%s, one display, first write +23, close 17 and real healing', used => {
    const s = scene(); const t = trace(s, 'yes', used);
    expect(t.printed.map(p => p.program)).toEqual(['PokemonCenterWelcomeText', ...(!used ? ['ShallWeHealYourPokemonText'] : []),
      'NeedYourPokemonText', 'PokemonFightingFitText', 'PokemonCenterFarewellText']);
    expect(t.printed.slice(1).every(p => p.used)).toBe(true);
    expect(t.firstRead).toBe(23); expect(t.closeEnd - t.closing).toBe(17);
    expect(s.deps.textBox.displayRevision).toBe(1); expect(s.close).toHaveBeenCalledOnce();
    expect(t.firstMenuRead - t.menu).toBe(3);
    expect(t.printed.find(p => p.program === 'NeedYourPokemonText')!.frame - t.firstMenuRead).toBe(15);
    expect(t.onHeal).toHaveBeenCalledOnce(); expect(s.mon.currentHp).toBe(s.mon.maxHp);
    expect(t.hidden).toHaveLength(1); expect(s.deps.restoreMapMusic).toHaveBeenCalledOnce();
    const machine = t.ticks.filter(tick => tick.command === 'healingMachine');
    expect(machine.length).toBeGreaterThan(0); expect(machine.every(tick => tick.coverage === 0x60)).toBe(true);
    const bow = t.ticks.filter(tick => tick.bow); expect(bow).toHaveLength(40);
    expect(bow.every(tick => tick.coverage === 0)).toBe(true);
    expect(getAllFlags()).toContain('USED_POKECENTER');
  });
  it('NO sets first-use state, updates with box coverage, skips blackout and healing, then farewell and close', () => {
    const s = scene(); const t = trace(s, 'no');
    expect(t.printed.map(p => p.program)).toEqual(['PokemonCenterWelcomeText', 'ShallWeHealYourPokemonText', 'PokemonCenterFarewellText']);
    expect(t.onHeal).not.toHaveBeenCalled(); expect(s.mon.currentHp).toBe(1); expect(t.hidden).toHaveLength(0);
    expect(t.updates.map(u => u.tile)).toEqual([0x60, 0x60]); expect(t.closeEnd - t.closing).toBe(17);
    expect(hasFlag('USED_POKECENTER')).toBe(true); expect(s.deps.restoreMapMusic).not.toHaveBeenCalled();
  });
  it('healthy following Pikachu retains the actual 69-frame nurse program and both box hides', async () => {
    const s = scene('alive'); await s.follower.loadSprite();
    const start = vi.spyOn(s.follower, 'startMovement'); const tick = vi.spyOn(s.follower, 'tickMovement');
    const t = trace(s); expect(start).toHaveBeenCalledOnce(); expect(tick).toHaveBeenCalledTimes(69);
    expect(t.hidden).toHaveLength(2); expect(s.follower.visible).toBe(true); expect(s.follower.direction).toBe('up');
    expect(t.updates.some(u => u.tile === 0)).toBe(true);
  });
  it.each(['up', 'left', 'right'] as const)('fainted starter keeps slot facing %s, heals and spawns without the pre-heal walk', async facing => {
    const s = scene('fainted'); await s.follower.loadSprite(); s.follower.direction = facing;
    const start = vi.spyOn(s.follower, 'startMovement'); const t = trace(s);
    expect(start).not.toHaveBeenCalled(); expect(t.hidden).toHaveLength(1);
    expect(s.mon.currentHp).toBe(s.mon.maxHp); expect(s.follower.visible).toBe(true);
    expect([s.follower.x, s.follower.y, s.follower.direction]).toEqual([s.deps.player.x, s.deps.player.y - 16, facing]);
  });
  it('box hide retains the session, removes every covered tile, and a new PrintText returns after +3', () => {
    const s = scene(); const box = s.deps.textBox; box.open(); for (let t = 0; t < 20; t++) box.update();
    box.hideDisplay(); uiTiles.clear(); box.render(); expect(box.active).toBe(true); expect(box.uiTileAt(0, 12)).toBe(0);
    expect(uiTiles.tileAt(0, 12)).toBe(0); box.print({ text: 'A' });
    expect(box.uiTileAt(0, 12)).toBe(0x60); vi.mocked(syncJoypadRead).mockClear();
    box.update(); box.update(); expect(syncJoypadRead).not.toHaveBeenCalled(); box.update(); expect(syncJoypadRead).toHaveBeenCalled();
  });
  it.each([false, true])('farewell pause held=%s costs +3 or +33 before its first glyph', held => {
    const box = scene().deps.textBox; box.open(); for (let t = 0; t < 20; t++) box.update();
    vi.mocked(isHeld).mockImplementation(k => held && k === 'a'); box.print({ program: 'PokemonCenterFarewellText' });
    let glyph = -1; const screen = Reflect.get(box, 'screen') as { buffer: string[] };
    for (let t = 1; t < 50; t++) { box.update(); if (screen.buffer[41] !== ' ') { glyph = t; break; } }
    expect(glyph).toBe(held ? 3 : 33);
  });
  it('the machine consumes no Joypad reads; a held A survives to the next text', () => {
    const s = scene(); initScript([{ type: 'displayOpen' }, { type: 'healingMachine' },
      { type: 'printText', program: 'PokemonCenterFarewellText' }, { type: 'wait', frames: 1 }]);
    updateScript(s.deps, false); for (let t = 0; t < 20; t++) updateScript(s.deps, false);
    vi.mocked(syncJoypadRead).mockClear(); vi.mocked(isHeld).mockImplementation(k => k === 'a');
    for (let t = 0; t < 1000; t++) {
      const script = getActiveScript()!; if (script.commands[script.index].type === 'printText') break;
      updateScript(s.deps, false); expect(syncJoypadRead).not.toHaveBeenCalled();
    }
    const screen = Reflect.get(s.deps.textBox, 'screen') as { held: number; buffer: string[] };
    updateScript(s.deps, false); // PrintText now dispatches in the cartridge machine return tick
    updateScript(s.deps, false); updateScript(s.deps, false); updateScript(s.deps, false);
    expect(screen.buffer[41]).toBe('W'); expect(screen.held).toBe(1); // TEXT_A, pause skipped
  });
  it('saved facing changes on close start, while the drawn image waits for the trailing update', async () => {
    const s = scene('alive'); await s.follower.loadSprite(); const p = s.follower;
    p.direction = 'left'; updateSprites([], s.deps.gameMap, s.deps.player, p);
    initScript([{ type: 'displayOpen' }, { type: 'pikachuFacing', action: 'save' },
      { type: 'callback', fn: () => p.showStandingImage('down') },
      { type: 'pikachuFacing', action: 'restore' }, { type: 'displayClose', outerWait: false }]);
    updateScript(s.deps, false); for (let t = 0; t < 20; t++) updateScript(s.deps, false);
    expect(s.deps.textBox.closing).toBe(true); expect(p.direction).toBe('left');
    vi.mocked(drawSprite).mockClear(); p.render(0, 0); expect(last(vi.mocked(drawSprite).mock.calls)?.[2]).toBe(0);
    for (let t = 0; t < 17; t++) updateScript(s.deps, false);
    vi.mocked(drawSprite).mockClear(); p.render(0, 0); expect(last(vi.mocked(drawSprite).mock.calls)?.[2]).toBe(32);
  });
  it('dispatches the generated nurse script even when the NPC id is changed', () => {
    const s = scene(); const nurse = s.deps.npcs.find(n => n.data.id === 'nurse')!; nurse.data.id = 'renamed';
    vi.spyOn(s.deps.player, 'checkInteraction').mockReturnValue({ npc: nurse });
    const action = updateOverworld({ ...s.deps, currentMapName: 'ViridianPokecenter', findNpc: s.find,
      pikachuFollower: s.follower, onPokecenterHeal: vi.fn() }, createOverworldState());
    expect(action?.type).toBe('script'); if (action?.type !== 'script') throw new Error('missing nurse dispatch');
    expect(action.commands[0].type).toBe('displayOpen'); expect(getTextScript('pokecenterNurse')).toBeDefined();
  });
  it('Jigglypuff registration requires the nurse LooksContentText branch (V2c)', () => {
    // V2a extracts Pewter before the following-disabled state can be set; note 60 §5.
    if (getTextHandler('PewterPokecenter', 3)) {
      expect(flattened(buildNurseScript(() => undefined)).some(c => c.type === 'printText' && c.program === 'LooksContentText'),
        'add LooksContentText before enabling Jigglypuff').toBe(true);
    }
  });
  it('detects a NO blackout callback inserted in memory', () => {
    const onHeal = vi.fn(); const commands = buildNurseScript(() => undefined, onHeal);
    choice(commands).no.push({ type: 'callback', fn: onHeal });
    expect(() => expect(choice(commands).no.some(c => c.type === 'callback')).toBe(false)).toThrow();
  });

  describe('sleeping nurse paths on the real controller', () => {
    it.each(['alive', 'fainted', 'none'] as const)('Pewter + disabled returns LooksContentText with %s starter eligibility', pikachu => {
      disablePikachuFollowing();
      const s = scene(pikachu); s.deps.gameMap.mapData!.name = 'PewterPokecenter';
      const start = vi.spyOn(s.follower, 'startMovement');
      const hide = vi.spyOn(s.follower, 'hideImage');
      const stand = vi.spyOn(s.follower, 'showStandingImage');
      const t = trace(s);
      expect(t.printed.map(p => p.program)).toEqual(['LooksContentText']);
      expect(t.onHeal).not.toHaveBeenCalled(); expect(t.hidden).toEqual([]);
      expect(hasFlag('USED_POKECENTER')).toBe(false);
      expect(start).not.toHaveBeenCalled(); expect(hide).not.toHaveBeenCalled(); expect(stand).not.toHaveBeenCalled();
      expect(s.deps.textBox.active).toBe(false);
    });

    it('Pewter + enabled takes the regular welcome and heals', () => {
      const s = scene(); s.deps.gameMap.mapData!.name = 'PewterPokecenter';
      const t = trace(s);
      expect(t.printed[0].program).toBe('PokemonCenterWelcomeText');
      expect(t.printed.some(p => p.program === 'LooksContentText')).toBe(false);
      expect(t.onHeal).toHaveBeenCalledOnce();
    });

    it('Viridian + disabled heals, skipping the actual Pikachu walk, hide, return and stand commands', () => {
      disablePikachuFollowing(); const s = scene('alive');
      const start = vi.spyOn(s.follower, 'startMovement');
      const hide = vi.spyOn(s.follower, 'hideImage');
      const stand = vi.spyOn(s.follower, 'showStandingImage');
      // Observe command dispatch even for instantaneous commands that return in one tick.
      const ran: string[] = [];
      const mark = (commands: ScriptCommand[]): ScriptCommand[] => commands.flatMap(c => {
        if (c.type === 'ifStarterPikachu' || c.type === 'ifPewterPikachuAsleep') c.then = mark(c.then);
        if (c.type === 'yesNoChoice') { c.yes = mark(c.yes); c.no = mark(c.no); }
        return (['pikachuToNurse', 'hidePikachu', 'showPikachu', 'pikachuStandDown'].includes(c.type) || (c.type === 'faceNpc' && c.direction === 'up'))
          ? [{ type: 'callback' as const, fn: () => { ran.push(c.type); } }, c] : [c];
      });
      const t = trace(s, 'yes', false, mark);
      expect(t.printed.map(p => p.program)).toEqual(['PokemonCenterWelcomeText', 'ShallWeHealYourPokemonText',
        'NeedYourPokemonText', 'PokemonFightingFitText', 'PokemonCenterFarewellText']);
      expect(t.onHeal).toHaveBeenCalledOnce();
      expect(s.mon.currentHp).toBe(s.mon.maxHp);
      expect(ran).toEqual([]); expect(start).not.toHaveBeenCalled(); expect(hide).not.toHaveBeenCalled();
      expect(stand).not.toHaveBeenCalled(); expect(s.follower.visible).toBe(true);
      // No 64-frame nurseUp blocks before/after the machine either.
      expect(t.ticks.some(tick => tick.command === 'healingMachine')).toBe(true);
    });
  });
});

describe('Map-music CP3: the nurse own restoration entry', () => {
  it('the post-heal restoreMapMusic is the nurse entry (control 0, saved bank, last = new = map song)', () => {
    const s = scene(); trace(s);
    expect(s.deps.restoreMapMusic).toHaveBeenCalledExactlyOnceWith('nurse');
  });
});
