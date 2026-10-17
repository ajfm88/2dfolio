import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { momText, tvText, daisyText, gamblerText, caterpillarText, girlText } from './small_text_handlers';
import { getTextHandler, getTextScript } from './text_handlers';
import type { TextHandlerContext } from './text_handlers';
import { buildViridianMartParcelScript } from './viridian_mart';
import { buildSleepingOldManScript, buildGymLockedScript, buildOldMan1Script, buildOldMan2Script } from './viridian_city';
import { potionSampleScript } from '../overworld/item_pickup';
import type { ScriptCommand } from '../script/types';
import { Bag } from '../items';
import { getTextProgramData, loadTextPrograms } from '../text/program_data';
import { initTextSystem, TextBox, setTextSpeed } from '../text/textbox';
import { initScript, updateScript, getActiveScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { isHeld, isPassPressed, syncJoypadRead } from '../input';
import { hasFlag, restoreFlags, restoreHiddenObjects, getAllHiddenObjects } from '../events';
import { applyStoryNpcState } from '../overworld/story_state';
import { mapCloseFrames } from '../overworld/sprite_sets';
import type { MapData } from '../core/types';
import type { MapSpriteSetsFile } from '../rom/extractors/map_sprite_sets';
import { loadBattleData, createPokemon } from '../battle';
import { updateOverworld, createOverworldState } from '../overworld/overworld_controller';
import { PikachuFollower } from '../pikachu/pikachu_follower';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: () => false,
  isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn(), readJoypad: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true,
  playMusic: async () => {}, isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));

const dataDir = resolve(__dirname, '../../data');
const sets = JSON.parse(readFileSync(resolve(dataDir, 'map_sprite_sets.json'), 'utf8')) as MapSpriteSetsFile;
const map = (name: string): MapData => JSON.parse(readFileSync(resolve(dataDir, `maps/${name}.json`), 'utf8'));
const ctx = (...flags: string[]): TextHandlerContext => ({ hasFlag: f => flags.includes(f), bag: new Bag(),
  ownedCount: 1, facing: 'up', step: { x: 18, y: 10 }, party: [] });
function all(commands: ScriptCommand[]): ScriptCommand[] {
  return commands.flatMap(c => [c, ...(c.type === 'giveItem' ? [...all(c.successCommands ?? []), ...all(c.failCommands ?? [])]
    : c.type === 'yesNoChoice' ? [...all(c.yes), ...all(c.no)] : [])]);
}
const programs = (commands: ScriptCommand[]) => all(commands).filter(c => c.type === 'printText').map(c => c.program);
const first = (commands: ScriptCommand[]) => programs(commands)[0];
beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); await loadBattleData(); });
beforeEach(() => { restoreFlags([]); restoreHiddenObjects([]); vi.clearAllMocks();
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false); setTextSpeed('fast'); });

describe('small handlers from the cartridge branches', () => {
  it.each([
    ['Mom wake', () => momText(ctx()), 'RedsHouse1FPrintMomText.WakeUpText'],
    ['Mom rest', () => momText(ctx('GOT_STARTER')), 'RedsHouse1FMomYouShouldRestText'],
    ['TV front', () => tvText(ctx()), 'RedsHouse1FPrintTVText.StandByMeMovieText'],
    ['TV back', () => tvText({ ...ctx(), facing: 'down' }), 'RedsHouse1FPrintTVText.WrongSideText'],
    ['Daisy before dex', () => daisyText(ctx()), 'BluesHouseDaisyRivalAtLabText'],
    ['Daisy offer', () => daisyText(ctx('GOT_POKEDEX')), 'BluesHouseDaisyOfferMapText'],
    ['Daisy map received', () => daisyText(ctx('GOT_TOWN_MAP')), 'BluesHouseDaisyUseMapText'],
    ['Route 1 first', () => potionSampleScript(false), 'Route1PrintYoungster1Text.MartSampleText'],
    ['Route 1 again', () => potionSampleScript(true), 'Route1PrintYoungster1Text.AlsoGotPokeballsText'],
    ['Girl before dex', () => girlText(ctx()), 'ViridianCityPrintGirlText.HasntHadHisCoffeeYetText'],
    ['Girl after dex', () => girlText(ctx('GOT_POKEDEX')), 'ViridianCityPrintGirlText.WhenIGoShopText'],
    ['Old man 2 completed', () => getTextHandler('ViridianCity', 8)!(ctx('COMPLETED_CATCH_TRAINING')), 'ViridianCityOldMan2Text.LosingMyTouchText'],
  ] as const)('%s selects its source program', (_name, build, program) => {
    const commands = build(); expect(first(commands)).toBe(program);
    expect(commands[0]).toEqual({ type: 'displayOpen', autoBox: true });
    expect(commands[commands.length - 1]).toEqual({ type: 'displayClose', outerWait: true });
  });
  it.each([[], ['BADGE_1'], Array.from({ length: 7 }, (_, i) => `BADGE_${i + 1}`),
    Array.from({ length: 8 }, (_, i) => `BADGE_${i + 1}`), ['BEAT_VIRIDIAN_GYM_GIOVANNI']].map(flags => [flags]))('gambler tests exact badge mask and Giovanni flag (%j)', flags => {
    const returned = flags.length === 7 || flags.includes('BEAT_VIRIDIAN_GYM_GIOVANNI');
    expect(first(gamblerText(ctx(...flags)))).toBe(`ViridianCityPrintGambler1Text.${returned ? 'GymLeaderReturnedText' : 'GymAlwaysClosedText'}`);
  });
  it('Mom heals between rest and looking great without recording the Pokécenter blackout map', () => {
    const heal = vi.fn(); const commands = momText({ ...ctx('GOT_STARTER'), onHeal: heal });
    expect(commands.map(c => c.type)).toEqual(['displayOpen', 'printText', 'fadeOut', 'healParty', 'healJingle', 'fadeIn', 'printText', 'displayClose']);
    expect(programs(commands)).toEqual(['RedsHouse1FMomYouShouldRestText', 'RedsHouse1FMomLookingGreatText']);
    expect(commands.some(c => c.type === 'callback')).toBe(false);
    expect(heal).not.toHaveBeenCalled();
  });
  it('Daisy gives, hides, prints with the binding/jingle, then flags; full bag only prints the failure', () => {
    const give = daisyText(ctx('GOT_POKEDEX'))[2]; if (give.type !== 'giveItem') throw new Error('Expected give');
    expect(give).toEqual({ type: 'giveItem', itemId: 'TOWN_MAP', successCommands: [
      { type: 'hideObject', map: 'BluesHouse', npcId: 'town_map' },
      { type: 'printText', program: 'GotMapText', bindings: { stringBuffer: 'TOWN MAP' } },
      { type: 'setFlag', flag: 'GOT_TOWN_MAP' }], failCommands: [{ type: 'printText', program: 'BluesHouseDaisyBagFullText' }] });
  });
  it('Mart has two direct displays, LEFT/UP/UP, Delay3, and gives only after the second close', () => {
    const commands = buildViridianMartParcelScript();
    expect(commands.map(c => c.type)).toEqual(['displayOpen', 'printText', 'displayClose', 'movePlayer', 'wait',
      'displayOpen', 'printText', 'displayClose', 'giveItem', 'setFlag']);
    expect(commands[3]).toEqual({ type: 'movePlayer', path: ['left', 'up', 'up'] });
    expect(commands[4]).toEqual({ type: 'wait', frames: 3 });
    expect(commands[6]).toEqual({ type: 'printText', program: 'ViridianMartClerkParcelQuestText', box: 'keep' });
    expect(commands[8]).toEqual({ type: 'giveItem', itemId: 'OAKS_PARCEL' });
    const parcel = getTextProgramData().programs._ViridianMartClerkParcelQuestText;
    expect(parcel.some(op => op.op === 'text' && op.text.includes("OAK's PARCEL!"))).toBe(true);
  });
  it('caterpillar question enters the menu directly and its two branches use source programs', () => {
    expect(programs(caterpillarText())).toEqual(['ViridianCityPrintYoungster2Text.YouWantToKnowAboutText',
      'ViridianCityPrintYoungster2Text.CaterpieAndWeedleDescriptionText', 'ViridianCityPrintYoungster2Text.OkThenText']);
    expect(caterpillarText().map(c => c.type)).toEqual(['displayOpen', 'printText', 'yesNoChoice', 'displayClose']);
  });
  it('all migrated builders are free of legacy text and reference extracted programs', () => {
    const flows = [momText(ctx()), momText(ctx('GOT_STARTER')), tvText(ctx()), daisyText(ctx('GOT_POKEDEX')),
      potionSampleScript(false), potionSampleScript(true), gamblerText(ctx()), girlText(ctx()), caterpillarText(),
      buildViridianMartParcelScript(), buildSleepingOldManScript(true), buildGymLockedScript(), buildOldMan1Script(), buildOldMan2Script(true, ctx().step)];
    for (const flow of flows) {
      expect(all(flow).map(c => c.type)).not.toContain('text');
      for (const label of programs(flow)) expect(getTextProgramData().programs[label], label).toBeDefined();
    }
  });
  it('censuses every current handler/script NPC and sign as migrated or explicitly deferred', () => {
    const excluded: Record<string, string> = {
      'Route2:1': 'A5b4 pickup', 'Route2:2': 'A5b4 pickup', 'Route2Gate:1': 'A2 Aide', 'Route2TradeHouse:2': 'A4 trade',
      'ViridianCity:6': 'A2 TM42', 'ViridianForest:2': 'A5b4 trainer', 'ViridianForest:3': 'A5b4 trainer',
      'ViridianForest:4': 'A5b4 trainer', 'ViridianForest:5': 'A5b4 trainer', 'ViridianForest:6': 'A5b4 trainer',
      'ViridianForest:7': 'A5b4 pickup', 'ViridianForest:8': 'A5b4 pickup', 'ViridianForest:9': 'A5b4 pickup',
      'ViridianNicknameHouse:3': 'J2 cry', 'ViridianPokecenter:4': 'Cable club receptionist: link features need a user decision', 'ViridianPokecenter:5': 'J2 cry' };
    const seen: string[] = [];
    for (const file of readdirSync(resolve(dataDir, 'maps'))) {
      const m = map(file.replace(/\.json$/, '')); const calls = getTextProgramData().textPointers[`${m.name}_TextPointers`];
      for (const object of [...m.npcs, ...m.signs]) {
        const call = calls[object.textId! - 1];
        if (call?.call !== 'handler' && call?.call !== 'script') continue;
        const key = `${m.name}:${object.textId}`; seen.push(key);
        const registered = call.call === 'handler' ? getTextHandler(m.name, object.textId) : getTextScript(call.script);
        expect(!!registered !== !!excluded[key], key).toBe(true);
      }
    }
    expect(seen).toHaveLength(30); expect(Object.keys(excluded).every(k => seen.includes(k))).toBe(true);
    expect(getTextHandler('RedsHouse1F', 2)).toBeDefined(); // TV is a hidden event, not a map sign.
  });
  it.each(['branch', 'Mart give order', 'healing jingle'])('detects an in-memory %s mutation', mutation => {
    if (mutation === 'branch') {
      const wrong = girlText({ ...ctx(), hasFlag: () => true });
      expect(() => expect(first(wrong)).toBe('ViridianCityPrintGirlText.HasntHadHisCoffeeYetText')).toThrow();
    } else if (mutation === 'Mart give order') {
      const wrong = buildViridianMartParcelScript(); const give = wrong.splice(8, 1)[0]; wrong.unshift(give);
      expect(() => expect(wrong.map(c => c.type).lastIndexOf('displayClose')).toBeLessThan(wrong.findIndex(c => c.type === 'giveItem'))).toThrow();
    } else {
      const wrong = momText(ctx('GOT_STARTER')).filter(c => c.type !== 'healJingle');
      expect(() => expect(wrong.map(c => c.type)).toContain('healJingle')).toThrow();
    }
  });
});

function scene(name: string): ScriptDeps {
  const gameMap = new GameMap(); gameMap.mapData = map(name);
  const player = new Player(); player.setTilePosition(8, 10);
  const npcs = gameMap.mapData.npcs.map(n => new Npc({ ...n }));
  const textBox = new TextBox({ closeFrames: () => mapCloseFrames(sets, name, { x: player.mapStepX, y: player.mapStepY }), updateSprites: vi.fn() });
  return { gameMap, player, npcs, textBox, playerBag: new Bag(), playerParty: [], restoreMapMusic: vi.fn() };
}
describe('small handler frame/side-effect contracts', () => {
  it.each([
    ['Mom', 'RedsHouse1F', () => momText(ctx()), 23, 9],
    ['TV', 'RedsHouse1F', () => tvText({ ...ctx(), facing: 'down' }), 23, 9],
    ['Daisy', 'BluesHouse', () => daisyText(ctx()), 23, 9],
    ['Route1', 'Route1', () => potionSampleScript(true), 23, 23],
    ['Mart', 'ViridianMart', () => buildViridianMartParcelScript().slice(0, 3), 20, 13],
    ['Gambler', 'ViridianCity', () => gamblerText(ctx()), 23, 23],
    ['Girl', 'ViridianCity', () => girlText(ctx()), 23, 23],
    ['Sleepy', 'ViridianCity', () => buildSleepingOldManScript(false).slice(0, 3), 23, 23],
    ['OldMan2', 'ViridianCity', () => getTextHandler('ViridianCity', 8)!(ctx('COMPLETED_CATCH_TRAINING')), 23, 23],
  ] as const)('%s has source first-write and close timing', (_name, name, build, glyph, cost) => {
    const deps = scene(name); initScript(build()); updateScript(deps, false);
    let firstRead = -1, closeStart = -1, closeEnd = -1;
    for (let t = 1; t < 1600 && getActiveScript(); t++) {
      vi.mocked(isHeld).mockImplementation(b => b === 'b' && t % 2 === 0 && deps.textBox.isWaitingForInput);
      const reads = vi.mocked(syncJoypadRead).mock.calls.length; updateScript(deps, false);
      if (firstRead < 0 && vi.mocked(syncJoypadRead).mock.calls.length > reads) firstRead = t;
      if (closeStart < 0 && deps.textBox.closing) closeStart = t;
      if (closeStart >= 0 && !deps.textBox.active && closeEnd < 0) closeEnd = t;
    }
    expect(firstRead).toBe(glyph); expect(closeEnd - closeStart).toBe(cost); expect(getActiveScript()).toBeNull();
  });
  it.each([false, true])('Daisy preserves give/hide/flag order and bag-full branch (full=%s)', full => {
    const deps = scene('BluesHouse');
    if (full) deps.playerBag.items = Array.from({ length: 20 }, (_, i) => ({ id: `ITEM_${i}`, count: 1 }));
    initScript(daisyText(ctx('GOT_POKEDEX'))); updateScript(deps, false);
    let given = -1, flagged = -1;
    for (let t = 1; t < 1600 && getActiveScript(); t++) {
      vi.mocked(isHeld).mockImplementation(b => b === 'b' && t % 2 === 0 && deps.textBox.isWaitingForInput);
      updateScript(deps, false);
      if (deps.playerBag.getCount('TOWN_MAP') && given < 0) {
        given = t; expect(getAllHiddenObjects()).toContain('BluesHouse:town_map'); expect(hasFlag('GOT_TOWN_MAP')).toBe(false);
      }
      if (hasFlag('GOT_TOWN_MAP') && flagged < 0) flagged = t;
    }
    expect(deps.playerBag.getCount('TOWN_MAP')).toBe(full ? 0 : 1);
    expect(full ? given === -1 && flagged === -1 : given > 23 && flagged > given).toBe(true);
    expect(getAllHiddenObjects()).toEqual(full ? [] : ['BluesHouse:town_map']);
  });
  it('dispatches Mom from text ID at talk time and leaves her generated dialogue unchanged', () => {
    const deps = scene('RedsHouse1F'); const mom = deps.npcs[0]; const original = mom.data.dialogue;
    applyStoryNpcState('RedsHouse1F', deps.npcs); expect(mom.data.dialogue).toBe(original);
    vi.spyOn(deps.player, 'checkInteraction').mockReturnValue({ npc: mom });
    const result = updateOverworld({ ...deps, currentMapName: 'RedsHouse1F', pikachuFollower: new PikachuFollower(), findNpc: () => mom }, createOverworldState());
    expect(result?.type).toBe('script'); if (result?.type !== 'script') throw new Error('Expected script');
    expect(first(result.commands)).toBe('RedsHouse1FPrintMomText.WakeUpText');
  });
  it('routes both TV sides to the registry from the actual hidden-event coordinates', () => {
    const deps = scene('RedsHouse1F'); vi.mocked(isPassPressed).mockImplementation(b => b === 'a');
    deps.player.setTilePosition(6, 4); deps.player.direction = 'up';
    expect(deps.player.checkInteraction(deps.gameMap, [])).toEqual({ scriptId: 'REDSHOUSE1F_TV' });
    deps.player.setTilePosition(6, 0); deps.player.direction = 'down';
    expect(deps.player.checkInteraction(deps.gameMap, [])).toEqual({ scriptId: 'REDSHOUSE1F_TV' });
  });
  it('Mom really restores HP/status/PP after the rest text and before looking great', async () => {
    const deps = scene('RedsHouse1F'); const mon = createPokemon('Pikachu', 5)!;
    mon.currentHp = 1; mon.status = 'PSN'; mon.moves[0].pp = 0; deps.playerParty.push(mon);
    let blackoutMap = 'ViridianCity';
    const recordBlackout = vi.fn(() => { blackoutMap = 'PalletTown'; });
    initScript(momText({ ...ctx('GOT_STARTER'), onHeal: recordBlackout })); updateScript(deps, false);
    for (let t = 1; t < 1600 && getActiveScript(); t++) {
      vi.mocked(isHeld).mockImplementation(b => b === 'b' && t % 2 === 0 && deps.textBox.isWaitingForInput);
      updateScript(deps, false); await Promise.resolve();
    }
    expect(mon.currentHp).toBe(mon.maxHp); expect(mon.status).toBeNull(); expect(mon.moves[0].pp).toBe(mon.moves[0].maxPp);
    expect(deps.restoreMapMusic).toHaveBeenCalledOnce(); expect(getActiveScript()).toBeNull();
    expect(recordBlackout).not.toHaveBeenCalled(); expect(blackoutMap).toBe('ViridianCity');
  });
});
