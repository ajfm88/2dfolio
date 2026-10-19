// Vitest's main-entry transform exposes bindings without running browser init.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} }, localStorage: { getItem: () => null } });
});
vi.mock('./audio', () => ({ setMasterVolume: vi.fn(), tickAudio: vi.fn(), playSFX: vi.fn(), playMusic: vi.fn(),
  stopMusic: vi.fn(), isSoundFinished: () => true }));
vi.mock('./debug', () => ({ isNoClip: () => false, isNoEncounters: () => true, consumeDebugWarp: () => null }));
vi.mock('./renderer', () => ({ getMonsterPalette: () => 'YELLOWMON', drawFadeOverlay: vi.fn(), fillRect: vi.fn(),
  drawTile: vi.fn(), drawSprite: vi.fn(), getScale: () => 1, getCtx: () => ({ drawImage() {} }),
  getActivePalette: () => 'PALLET', setActivePalette: vi.fn(), getMapPalette: () => 'PALLET',
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }),
  loadTilesetTransparent: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }),
  loadBattleSprite: async () => ({ width: 56 }), captureUi: (draw: () => void) => { draw(); return () => {}; } }));
import * as main from './main';
import * as overworld from './overworld';
import * as input from './input';
import { initScript } from './script';
import type { ScriptCommand } from './script';
import type { Player } from './overworld/player';
import type { GameMap } from './overworld/map';
import type { PikachuFollower } from './pikachu';
import { Npc } from './overworld/npc';
import { restoreFlags } from './events';
import { setJoyIgnore } from './input/joy_ignore';

const host = (main as unknown as { mainTest: {
  reset(): void; gameTick(): void; startScript(commands: ScriptCommand[]): void;
  readonly state: string; player: Player; gameMap: GameMap; pikachuFollower: PikachuFollower; mapNpcs: Npc[];
} }).mainTest;
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); host.reset(); initScript([]); restoreFlags(['GOT_POKEDEX']); setJoyIgnore('none');
  for (const key of ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'] as const) input.setKey(key, false);
  input.updateInput(); input.syncJoypadRead(); host.pikachuFollower.visible = false;
  while (host.player.isBusy) host.player.simulatedPass(null, false, () => {}, host.gameMap, []);
  // Give every case the same native last-stop direction, independent of the prior case.
  for (let p = 0; p < 8; p++) host.player.simulatedPass('down', false, () => {}, host.gameMap, []);
  host.player.x = 160; host.player.y = 160; host.player.direction = 'down';
  host.gameMap.mapData = { name: 'TestEscort', width: 20, height: 20, tileset: 'OVERWORLD', connections: [],
    blocks: Array<number>(400).fill(0), borderBlock: 0, warps: [], signs: [], npcs: [] };
  host.gameMap.blockset = [Array<number>(16).fill(0x2c)]; host.gameMap.collisionTiles = new Set([0x2c]);
});
afterEach(() => { initScript([]); vi.restoreAllMocks(); });
const movement = (): ScriptCommand => ({ type: 'npcMovementScript', npcId: 'guide', guidePath: ['right'],
  joypad: { entries: [0, 0x10], index: 2 } });
function guide(): Npc {
  const npc = new Npc({ id: 'guide', sprite: 'youngster', x: 10, y: 9, movement: 'stay', direction: 'down', dialogue: '' });
  host.mapNpcs = [npc]; return npc;
}

describe('native movement through main dispatch and pass clock', () => {
  it('map-script dispatch consumes entry 1 now; each completed simulated step reaches the transition checks once', () => {
    const npc = guide(), update = vi.spyOn(npc, 'update'), done = vi.fn();
    const stepEnd = vi.spyOn(overworld, 'handleStepComplete').mockReturnValue(null);
    const mapScript = vi.spyOn(overworld, 'runMapScript').mockReturnValue({ type: 'script', commands: [movement(), { type: 'callback', fn: done }] });
    host.gameTick(); expect(host.player.x).toBe(160); expect(mapScript).not.toHaveBeenCalled();
    host.gameTick(); expect(host.state).toBe('script'); expect(host.player.x).toBe(162); expect(update).toHaveBeenCalledOnce();
    for (let frame = 3; frame <= 16; frame++) {
      host.gameTick(); expect(host.player.x).toBe(160 + 2 * Math.floor(frame / 2));
    }
    expect(stepEnd).toHaveBeenCalledOnce(); expect(stepEnd).toHaveBeenCalledWith(expect.objectContaining({ player: host.player }), expect.anything(), true);
    expect(host.player.stepWasSimulated).toBe(true); expect(done).not.toHaveBeenCalled();
    host.gameTick(); host.gameTick(); // final NO_INPUT
    expect(done).not.toHaveBeenCalled(); expect(update).toHaveBeenCalledTimes(9);
    host.gameTick(); host.gameTick(); expect(done).toHaveBeenCalledOnce(); expect(update).toHaveBeenCalledTimes(9);
  });
  it.each([0, 1])('explicit OverworldLoop waits two frames with old parity %i in main', parity => {
    const npc = guide(), update = vi.spyOn(npc, 'update');
    vi.spyOn(overworld, 'runMapScript').mockReturnValue(null);
    host.gameTick(); host.gameTick(); // establish a running pass clock
    if (parity) host.gameTick();
    update.mockClear();
    host.startScript([{ type: 'callback', fn: () => {} }, { type: 'overworldLoop', updateSprites: true }, movement(),
      { type: 'displayOpen', spriteUpdate: false }]); // migrated-prefix dispatch primes the continuation at T
    expect(update).toHaveBeenCalledOnce(); expect(host.player.x).toBe(160);
    host.gameTick(); expect(update).toHaveBeenCalledOnce(); expect(host.player.x).toBe(160);
    host.gameTick(); expect(update).toHaveBeenCalledTimes(2); expect(host.player.x).toBe(162);
    host.gameTick(); expect(update).toHaveBeenCalledTimes(2); expect(host.player.x).toBe(162);
    host.gameTick(); expect(update).toHaveBeenCalledTimes(3); expect(host.player.x).toBe(164);
  });
  it.each([0, 1])('RESET resumes ordinary input this tick and restarts the pair (old parity %i)', parity => {
    const npc = guide(), update = vi.spyOn(npc, 'update');
    vi.spyOn(overworld, 'runMapScript').mockReturnValue(null);
    host.gameTick(); host.gameTick();
    if (parity) host.gameTick();
    update.mockClear();
    const read = vi.spyOn(input, 'readJoypad'); setJoyIgnore('all'); input.setKey('down', true);
    host.startScript([{ type: 'joyIgnore', mask: 'none' }, { type: 'overworldLoop', resumeInput: true }]);
    host.gameTick(); // T: end RESET, JoypadOverworld, ordinary player pass
    expect(host.state).toBe('overworld'); expect(read).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce(); expect(host.player.y).toBe(162); expect(host.player.stepWasSimulated).toBe(false);
    host.gameTick(); expect(host.player.y).toBe(162); expect(update).toHaveBeenCalledOnce();
    host.gameTick(); expect(host.player.y).toBe(164); expect(update).toHaveBeenCalledTimes(2);
  });
});
