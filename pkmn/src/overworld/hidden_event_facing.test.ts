// V5c checkpoint-06 (note 93 §26): CheckForHiddenEvent matches coordinates only. A hidden event's `facing` is
// its routine's own test; a routine that returns early ends the interaction (no bookshelf, sign or sprite).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Player } from './player';
import { GameMap } from './map';
import { Npc } from './npc';
import { isPassPressed } from '../input';
import type { Direction, MapData } from '../core';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: () => false,
  isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn(), readJoypad: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSfxPlaying: () => false, isSoundFinished: () => true }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(), getActivePalette: () => 'PALLET',
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadTilesetTransparent: async () => ({ width: 128 }),
  obpMapping: (reg: number) => [0, 1, 2, 3].map(c => (reg >> (2 * c)) & 3), loadSprite: async () => ({ height: 96 }),
  loadSpriteMapped: async () => ({ width: 8, height: 16 }) }));

const DATA = resolve(__dirname, '../../data');
const REFS = resolve(__dirname, '../../../refs/pokeyellow');
const mapJson = (name: string): MapData => JSON.parse(readFileSync(resolve(DATA, `maps/${name}.json`), 'utf8')) as MapData;
const MAPS = readdirSync(resolve(DATA, 'maps')).map(file => file.replace('.json', ''));

async function scene(name: string): Promise<{ gameMap: GameMap; player: Player }> {
  const gameMap = new GameMap();
  await gameMap.load(name);
  return { gameMap, player: new Player() };
}
/** Stand on a step, face a direction and press A. The step must be one the player can stand on. */
function press(s: { gameMap: GameMap; player: Player }, x: number, y: number, facing: Direction, npcs: Npc[] = []) {
  expect(s.gameMap.isWalkable(x * 2, y * 2), `(${x},${y}) is walkable`).toBe(true);
  s.player.setTilePosition(x * 2, y * 2);
  s.player.direction = facing;
  return s.player.checkInteraction(s.gameMap, npcs);
}

/** Face an event from a side no map lets the player stand on: only the step in front is forced. */
function pressFacing(s: { gameMap: GameMap; player: Player }, eventX: number, eventY: number, facing: Direction, npcs: Npc[] = []) {
  s.player.direction = facing;
  const spy = vi.spyOn(s.player, 'getFacingTile').mockReturnValue({ tx: eventX * 2, ty: eventY * 2 });
  try { return s.player.checkInteraction(s.gameMap, npcs); } finally { spy.mockRestore(); }
}

beforeEach(() => { vi.mocked(isPassPressed).mockImplementation(key => key === 'a'); });

// ── the data against pret ───────────────────────────────────────────────────

/** The routines on today's maps that test the player's facing themselves, and what they require. */
const FACING_ROUTINES: Record<string, Direction> = {
  OpenPokemonCenterPC: 'up', GymStatues: 'up', DisplayOakLabEmailText: 'up', PrintBenchGuyText: 'left',
};
const MAP_CONSTANTS: Record<string, string> = {
  REDS_HOUSE_2F: 'RedsHouse2F', BLUES_HOUSE: 'BluesHouse', OAKS_LAB: 'OaksLab', VIRIDIAN_CITY: 'ViridianCity',
  VIRIDIAN_POKECENTER: 'ViridianPokecenter', VIRIDIAN_SCHOOL_HOUSE: 'ViridianSchoolHouse', VIRIDIAN_FOREST: 'ViridianForest',
  MUSEUM_1F: 'Museum1F', PEWTER_GYM: 'PewterGym', PEWTER_POKECENTER: 'PewterPokecenter',
};
function pretEvents(): Record<string, { x: number; y: number; routine: string }[]> {
  const out: Record<string, { x: number; y: number; routine: string }[]> = {};
  let current: string | undefined;
  for (const line of readFileSync(resolve(REFS, 'data/events/hidden_events.asm'), 'utf8').split(/\r?\n/)) {
    const head = /^\thidden_events_for (\w+)/.exec(line);
    if (head) { current = head[1]; out[current] = []; continue; }
    const row = /^\thidden_(?:event|text_predef)\s+(\d+),\s+(\d+),\s+(\w+),/.exec(line);
    if (row && current) out[current].push({ x: Number(row[1]), y: Number(row[2]), routine: row[3] });
  }
  return out;
}
/** A routine's body: from its label to the next top-level label. */
function routineBody(routine: string): string {
  const dir = resolve(REFS, 'engine/events/hidden_events');
  const sources = [...readdirSync(dir).map(file => resolve(dir, file)), resolve(REFS, 'engine/events/hidden_items.asm')];
  for (const file of sources) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const start = lines.findIndex(line => new RegExp(`^${routine}::?$`).test(line));
    if (start < 0) continue;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex(line => /^\w+::?$/.test(line));
    return rest.slice(0, end < 0 ? undefined : end).join('\n');
  }
  throw new Error(`routine ${routine} not found`);
}

describe('hidden-event data', () => {
  const pret = pretEvents();

  it("every ROM hidden event on today's maps is in the data at pret's coordinates, in pret's order", () => {
    for (const map of MAPS) {
      const constant = Object.keys(MAP_CONSTANTS).find(key => MAP_CONSTANTS[key] === map);
      const ours = (mapJson(map).hiddenEvents ?? []).map(e => `${e.x},${e.y}`);
      if (map === 'RedsHouse1F') continue; // the TV: a bg_event the port keeps as two hidden-event rows (below)
      expect([map, ours]).toEqual([map, constant ? pret[constant].map(e => `${e.x},${e.y}`) : []]);
    }
    expect(Object.keys(MAP_CONSTANTS).every(constant => constant in pret)).toBe(true);
    expect('REDS_HOUSE_1F' in pret).toBe(false);
  });

  it('`facing` is present exactly where the routine tests the facing, with the facing it requires', () => {
    const seen = new Set<string>();
    for (const [constant, map] of Object.entries(MAP_CONSTANTS)) {
      const ours = mapJson(map).hiddenEvents ?? [];
      pret[constant].forEach((event, i) => {
        seen.add(event.routine);
        expect([map, event.routine, ours[i].facing]).toEqual([map, event.routine, FACING_ROUTINES[event.routine]]);
      });
    }
    // and the table is the ASM's: a routine reads the facing byte if and only if it is listed
    for (const routine of seen) {
      expect([routine, /wSpritePlayerStateData1FacingDirection/.test(routineBody(routine))])
        .toEqual([routine, routine in FACING_ROUTINES]);
    }
    expect([...seen].filter(routine => routine in FACING_ROUTINES).sort()).toEqual(Object.keys(FACING_ROUTINES).sort());
    for (const routine of ['OpenPokemonCenterPC', 'GymStatues', 'DisplayOakLabEmailText']) {
      expect(routineBody(routine)).toMatch(/cp SPRITE_FACING_UP\n\tret nz/);
    }
    // PrintBenchGuyText compares with its table's byte: SPRITE_FACING_LEFT on every row
    const bench = readFileSync(resolve(REFS, 'data/events/bench_guys.asm'), 'utf8').split(/\r?\n/).filter(line => /^\tbench_guy_text /.test(line));
    expect(bench.length).toBeGreaterThan(0);
    expect(bench.every(line => /,\s+SPRITE_FACING_LEFT,/.test(line))).toBe(true);
  });

  it("Red's house TV keeps two rows without a facing: RedsHouse1FTVText reads the facing itself", () => {
    expect((mapJson('RedsHouse1F').hiddenEvents ?? []).map(e => [e.x, e.y, e.facing])).toEqual([[3, 1, undefined], [3, 1, undefined]]);
  });
});

// ── the lookup and the routines ─────────────────────────────────────────────

describe('CheckForHiddenEvent', () => {
  it('takes the first row when hidden events share a step', async () => {
    const s = await scene('RedsHouse1F');
    const rows = s.gameMap.mapData!.hiddenEvents!;
    expect(rows.map(e => [e.x, e.y])).toEqual([[3, 1], [3, 1]]);
    expect(s.gameMap.getHiddenEventAt(3, 1)).toBe(rows[0]);
  });

  it("Red's PC answers any facing: OpenRedsPC has no facing test (only the step below can be stood on)", async () => {
    const s = await scene('RedsHouse2F');
    expect(press(s, 0, 2, 'up')).toEqual({ scriptId: 'RED_PC' });
    for (const facing of ['down', 'left', 'right'] as const) expect(pressFacing(s, 0, 1, facing)).toEqual({ scriptId: 'RED_PC' });
  });

  it("Blue's House: a bookcase reads from the side too", async () => {
    const s = await scene('BluesHouse');
    expect(press(s, 1, 2, 'up')).toEqual({ program: 'BookcaseText', preDialogue: true });
    expect(press(s, 2, 1, 'left')).toEqual({ program: 'BookcaseText', preDialogue: true });
    expect(press(s, 6, 1, 'right')).toEqual({ program: 'BookcaseText', preDialogue: true });
  });

  it("Oak's e-mail from the side: the routine returns, and nothing else answers, not even a sprite on that step", async () => {
    const s = await scene('OaksLab');
    const onDesk = new Npc({ id: 'witness', sprite: 'girl', x: 1, y: 1, movement: 'stay', dialogue: 'hello' });
    expect(press(s, 1, 2, 'up', [onDesk])).toEqual({ program: 'OakLabEmailText', preDialogue: true });
    for (const facing of ['down', 'left', 'right'] as const) expect(pressFacing(s, 1, 1, facing, [onDesk])).toBeNull();
    // the same sprite answers where no hidden event is in front
    onDesk.x = 3 * 16; onDesk.y = 2 * 16;
    expect(press(s, 3, 3, 'up', [onDesk])).toMatchObject({ npc: onDesk });
  });

  it('the Pokécenter PC and the Gym statues answer facing up only, and a wrong facing ends the interaction', async () => {
    const center = await scene('ViridianPokecenter');
    expect(press(center, 13, 4, 'up')).toEqual({ scriptId: 'POKECENTER_PC' });
    expect(press(center, 12, 3, 'right')).toBeNull();
    for (const facing of ['down', 'left'] as const) expect(pressFacing(center, 13, 3, facing)).toBeNull();
    const gym = await scene('PewterGym');
    expect(press(gym, 3, 11, 'up')).toEqual({ scriptId: 'PEWTER_GYM_STATUES' });
    expect(press(gym, 4, 10, 'left')).toBeNull();
    expect(press(gym, 2, 10, 'right')).toBeNull();
  });

  it.each(['ViridianPokecenter', 'PewterPokecenter'])('%s: the bench guy answers from the right; no other side can be stood on', async map => {
    const s = await scene(map);
    expect(press(s, 1, 4, 'left')).toMatchObject({ program: `${map === 'ViridianPokecenter' ? 'ViridianCity' : 'PewterCity'}PokecenterBenchGuyText` });
    // PrintBenchGuyText's wrong-facing loop is the cartridge's bug (it loops without `inc hl`); it is not ported.
    // This fails if a map ever lets the player face the bench guy from above or below.
    expect([s.gameMap.isWalkable(0, 3 * 2), s.gameMap.isWalkable(0, 5 * 2)]).toEqual([false, false]);
  });

  it("Red's house TV is found from every side", async () => {
    const s = await scene('RedsHouse1F');
    expect(press(s, 3, 2, 'up')).toEqual({ scriptId: 'REDSHOUSE1F_TV' });
    expect(press(s, 4, 1, 'left')).toEqual({ scriptId: 'REDSHOUSE1F_TV' });
    expect(press(s, 2, 1, 'right')).toEqual({ scriptId: 'REDSHOUSE1F_TV' });
    expect(pressFacing(s, 3, 1, 'down')).toEqual({ scriptId: 'REDSHOUSE1F_TV' });
  });
});
