import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapAutoTextBox, applyMapAutoTextBox } from './auto_text_box';
import { buildMartScript } from '../story/mart';
import { displayTextID } from '../story/text_handlers';
import { getMapPalette } from '../renderer/palettes';
import { TextBox } from './textbox';
import { initScript, updateScript } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Bag } from '../items';
import type { MapData } from '../core/types';

vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false,
  isPassPressed: () => false, readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true,
  playMusic: vi.fn(async () => {}), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ height: 96 }) }));

const root = resolve(__dirname, '../..');
const ASM = resolve(root, '../refs/pokeyellow');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('map no-auto-text-box set (V2a CP3)', () => {
  it('is exactly the two maps whose scripts store BIT_NO_AUTO_TEXT_BOX every pass', () => {
    const maps = ['OaksLab', 'PewterMart', 'ViridianMart', 'PewterCity', 'ViridianPokecenter', 'PewterPokecenter'];
    expect(maps.filter(m => !mapAutoTextBox(m))).toEqual(['OaksLab', 'PewterMart']);
    for (const m of ['OaksLab', 'PewterMart'])
      expect(readFileSync(resolve(ASM, `scripts/${m}.asm`), 'utf8')).toMatch(/ld a, 1 << BIT_NO_AUTO_TEXT_BOX\s+ld \[wAutoTextBoxDrawingControl\], a/);
    expect(readFileSync(resolve(ASM, 'scripts/ViridianMart.asm'), 'utf8')).not.toContain('BIT_NO_AUTO_TEXT_BOX');
  });
  it('gives only the first displayOpen of a handler or script the map default', () => {
    const body = [...displayTextID([]), ...displayTextID([])];
    const opens = (cmds: typeof body) => cmds.flatMap(c => (c.type === 'displayOpen' ? [c.autoBox] : []));
    expect(opens(applyMapAutoTextBox(body, 'PewterMart'))).toEqual([false, true]);
    expect(applyMapAutoTextBox(body, 'ViridianMart')).toBe(body);
  });
  it('reaches the Mart clerk script', () => {
    expect(applyMapAutoTextBox(buildMartScript(['POTION']), 'PewterMart')[0]).toEqual({ type: 'displayOpen', autoBox: false });
    expect(applyMapAutoTextBox(buildMartScript(['POTION']), 'ViridianMart')[0]).toEqual({ type: 'displayOpen' });
  });
});

describe('a running script resolves a bare displayOpen by the current map', () => {
  function scene(name: string): ScriptDeps {
    const gameMap = new GameMap();
    gameMap.mapData = { name, width: 4, height: 4, tileset: 'OVERWORLD', blocks: [], borderBlock: 0, connections: [],
      warps: [], signs: [], npcs: [] } as unknown as MapData;
    return { textBox: new TextBox(), player: new Player(), gameMap, npcs: [], playerBag: new Bag(), playerParty: [], restoreMapMusic: vi.fn() };
  }
  it.each([['PewterMart', false], ['OaksLab', false], ['ViridianMart', true]] as const)('%s → autoBox %s', (name, expected) => {
    const deps = scene(name); const open = vi.spyOn(deps.textBox, 'open');
    initScript([{ type: 'displayOpen' }, { type: 'wait', frames: 1 }]); updateScript(deps, false);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ autoBox: expected }));
  });
  it('keeps an explicit true, as bookshelves do', () => {
    const deps = scene('OaksLab'); const open = vi.spyOn(deps.textBox, 'open');
    initScript([{ type: 'displayOpen', autoBox: true }, { type: 'wait', frames: 1 }]); updateScript(deps, false);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ autoBox: true }));
  });
});

describe('Pewter runtime tables (V2a CP3)', () => {
  const maps = ['PewterCity', 'PewterNidoranHouse', 'PewterMart', 'PewterSpeechHouse', 'PewterPokecenter'];
  it('all five maps take the PEWTER palette', () => {
    for (const m of maps) expect(getMapPalette(m)).toBe('PEWTER');
  });
  it('main.ts: only Pewter City is outdoor; music follows data/maps/songs.asm', () => {
    const main = source('src/main.ts');
    const outdoor = main.match(/const OUTDOOR_MAPS = new Set\(\[([\s\S]*?)\]\)/)![1];
    expect(outdoor).toContain("'PewterCity'");
    for (const m of maps.slice(1)) expect(outdoor).not.toContain(`'${m}'`);
    const songs = readFileSync(resolve(ASM, 'data/maps/songs.asm'), 'utf8');
    const expected: Record<string, string> = { MUSIC_CITIES1: 'cities1', MUSIC_POKECENTER: 'pokecenter' };
    for (const m of maps) {
      const cart = songs.match(new RegExp(`db (MUSIC_[A-Z0-9_]+), BANK[(][A-Za-z0-9_]+[)] ; ${m.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}$`, 'm'))![1];
      expect(main.match(new RegExp(`^[ ]*${m}:[ ]*'([^']+)'`, 'm'))?.[1]).toBe(expected[cart]);
    }
  });
  it('debug warps: Pewter City at (13,26) plus the Pokécenter, Mart and both houses', () => {
    const debug = source('src/debug.ts');
    expect(debug).toMatch(/map: 'PewterCity',\s+warpId: 0, stepPos: \{ x: 13, y: 26 \}/);
    for (const m of maps.slice(1)) expect(debug).toMatch(new RegExp(`map: '${m}',[ ]*warpId: 0`));
  });
  it('main.ts passes the map default to START', () => {
    expect(source('src/main.ts')).toContain('startMenu.open(hasFlag(\'GOT_POKEDEX\'), getPlayerName(), mapAutoTextBox(currentMapName))');
  });
});
