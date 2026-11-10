// V3 checkpoint-02c (notes/88-v3-plan.md §28): museum_fossils.asm and DisplayMonFrontSpriteInBox.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { host, loadMainBattleRig, resetMainBattleRig, tick, until, mon, frameNow } from '../test/main_battle_rig';
import { getActiveScript, renderScriptMenu } from '../script/script_controller';
import { captureNative, drawTile, fillRect, loadTileset } from '../renderer/renderer';
import { uiTiles } from '../renderer/ui_tiles';
import type { RasterCanvas } from '../test/raster_canvas';
import { clearFlag, setFlag } from '../events';
import { MonSpritePopup, MON_POPUP_PICTURE } from '../script/mon_sprite_popup';
import { BgTransfer } from '../text/bg_transfer';
import { TextBox } from '../text';
import { getTextProgramData } from '../text/program_data';
import { getHiddenEventScript } from './hidden_events';

const AERODACTYL = { url: '/gfx/sprites/front/fossilaerodactyl.png', dimensions: 0x77 };
const KABUTOPS = { url: '/gfx/sprites/front/fossilkabutops.png', dimensions: 0x66 };

function popup(picture = AERODACTYL) {
  const transfer = new BgTransfer();
  const covered: number[] = [];
  const object = new MonSpritePopup(picture, transfer, tileAt => covered.push(tileAt(8, 9)));
  return { object, transfer, covered };
}
const frames = (p: MonSpritePopup, n: number, pressed = () => false) => { for (let i = 0; i < n; i++) expect(p.frame(pressed)).toBe(false); };

describe('AerodactylFossil and KabutopsFossil (museum_fossils.asm)', () => {
  it.each([['AERODACTYL_FOSSIL', AERODACTYL, 'AerodactylFossilText'], ['KABUTOPS_FOSSIL', KABUTOPS, 'KabutopsFossilText']] as const)(
    '%s: the pop-up, then the predef text in an automatic box with the outer wait', (id, picture, program) => {
      expect(getHiddenEventScript(id)).toEqual([{ type: 'monSpritePopup', picture }, { type: 'displayOpen', autoBox: true },
        { type: 'printText', program, box: 'keep' }, { type: 'displayClose', outerWait: true }]);
    });
  it('the map lists both at the ASM coordinates, for any facing', () => {
    const map = JSON.parse(readFileSync('data/maps/Museum1F.json', 'utf8')) as { hiddenEvents: object[] };
    expect(map.hiddenEvents).toEqual([{ x: 2, y: 3, scriptId: 'AERODACTYL_FOSSIL' }, { x: 2, y: 6, scriptId: 'KABUTOPS_FOSSIL' }]);
  });
});

describe('DisplayMonFrontSpriteInBox (museum_fossils2.asm), frame by frame', () => {
  it('Delay3, then the box and UpdateSprites; the automatic transfer is off for the seven-frame tile copy', () => {
    const { object, transfer, covered } = popup();
    expect(transfer.enabled).toBe(true);
    frames(object, 2);
    expect(object.boxDrawn).toBe(false); expect(covered).toEqual([]);
    frames(object, 1);
    expect(object.boxDrawn).toBe(true); expect(covered).toEqual([0x60]);
    expect(transfer.enabled).toBe(false);
    expect(object.tiles.at(6, 4)).toBe('┌'); expect(object.tiles.at(14, 13)).toBe('┘');
    frames(object, 6);
    expect(transfer.enabled).toBe(false);
    expect(object.tiles.visibleAt(6, 4)).toBeNull();
    expect(object.tiles.at(7, 5)).toBe(' ');
  });
  it('the picture lands as the copy returns; the box and the picture then transfer by thirds', () => {
    const { object, transfer } = popup();
    frames(object, 10);
    expect(transfer.enabled).toBe(true);
    expect(object.tiles.at(7, 5)).toBe(MON_POPUP_PICTURE);
    expect(object.tiles.visibleAt(7, 5)).toBeNull();
    frames(object, 1);
    expect(object.tiles.visibleAt(6, 4)).toBe('┌'); expect(object.tiles.visibleAt(7, 5)).toBe(MON_POPUP_PICTURE);
    expect(object.tiles.visibleAt(7, 6)).toBeNull();
    frames(object, 1);
    expect(object.tiles.visibleAt(7, 11)).toBe(MON_POPUP_PICTURE); expect(object.tiles.visibleAt(6, 12)).toBeNull();
    frames(object, 1);
    expect(object.tiles.visibleAt(14, 13)).toBe('┘');
  });
  it('places $77 at (7,5) and centres $66 by the SRL floor, bottom-aligned; the box row under the picture stays blank', () => {
    const seven = popup(AERODACTYL).object; frames(seven, 10);
    expect(seven.tiles.at(7, 5)).toBe(MON_POPUP_PICTURE); expect(seven.tiles.at(13, 11)).toBe(MON_POPUP_PICTURE);
    expect(seven.tiles.at(7, 12)).toBe(' ');
    expect(seven.sheetTile(7, 5)).toBe(0); expect(seven.sheetTile(13, 11)).toBe(48);
    expect(seven.sheetTile(13, 5)).toBe(6); expect(seven.sheetTile(7, 6)).toBe(7); // the sheet runs left to right, then down
    const six = popup(KABUTOPS).object; frames(six, 10);
    expect(six.tiles.at(7, 5)).toBe(' '); expect(six.tiles.at(8, 5)).toBe(' '); expect(six.tiles.at(7, 6)).toBe(' ');
    expect(six.tiles.at(8, 6)).toBe(MON_POPUP_PICTURE); expect(six.tiles.at(13, 11)).toBe(MON_POPUP_PICTURE);
    expect(six.sheetTile(8, 6)).toBe(0); expect(six.sheetTile(13, 11)).toBe(35);
  });
  it('reads the joypad only from the frame the wait starts, and a press restores, then Delay3 and returns', () => {
    const { object } = popup();
    const pressed = vi.fn(() => false);
    frames(object, 9, pressed);
    expect(pressed).not.toHaveBeenCalled();
    frames(object, 1, pressed);
    expect(pressed).toHaveBeenCalledTimes(1);
    frames(object, 3, pressed); // every third transferred
    expect(object.tiles.visibleAt(7, 5)).toBe(MON_POPUP_PICTURE);
    frames(object, 1, () => true);
    expect(object.tiles.at(7, 5)).toBeNull();
    expect(object.tiles.visibleAt(7, 5)).toBe(MON_POPUP_PICTURE);
    frames(object, 1);
    expect(object.tiles.visibleAt(7, 6)).toBeNull(); // the next third, the middle
    expect(object.tiles.visibleAt(7, 5)).toBe(MON_POPUP_PICTURE);
    frames(object, 1);
    expect(object.tiles.visibleAt(14, 13)).toBeNull();
    expect(object.frame(() => false)).toBe(true);
    expect(object.tiles.visibleAt(7, 5)).toBeNull();
  });
});

describe('the fossils through main', () => {
  const hold = () => (frameNow() % 8 < 4 ? ['a' as const] : []);
  const ticks = (n: number, keys: ('a' | 'b')[] = []) => { for (let i = 0; i < n; i++) tick(keys); };
  beforeAll(() => loadMainBattleRig());
  beforeEach(() => { resetMainBattleRig(); clearFlag('BATTLED_RIVAL_IN_OAKS_LAB'); });
  afterEach(() => { host.player.imageDisabled = false; host.reset(); vi.restoreAllMocks(); });
  async function lookAt(x: number, y: number) {
    host.playerParty.push(mon());
    await host.handleWarpLoad('Museum1F', 0, { x, y }); await host.finishFade(); host.state = 'overworld';
    host.ow.justWarped = false; host.ow.doorExitStep = false; host.player.direction = 'up';
    until(() => host.state === 'script', hold, 200);
  }
  it.each([[2, 4, 'AerodactylFossilText'], [2, 7, 'KabutopsFossilText']])('from (%i,%i): hides the player, gives Pikachu the box tiles, and shows the player as %s opens', async (x, y, program) => {
    const prints = vi.spyOn(TextBox.prototype, 'print');
    const pikachu = vi.spyOn(host.pikachuFollower, 'updateSprite');
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB');
    await lookAt(x, y);
    expect(getActiveScript()!.commands[0].type).toBe('monSpritePopup');
    expect(host.player.imageDisabled).toBe(false);
    ticks(3, ['a']);
    expect(host.player.imageDisabled).toBe(true);
    const update = pikachu.mock.calls[pikachu.mock.calls.length - 1][0];
    expect(update.ui?.tileAt(8, 9)).toBe(0x60); expect(update.ui?.tileAt(8, 3)).toBe(0); // SpawnPikachu_'s footprint test sees the box
    expect(prints).not.toHaveBeenCalled();
    ticks(7, ['a']); // held since the look, so never a new press
    expect(host.state).toBe('script');
    expect(host.player.imageDisabled).toBe(true);
    ticks(1); ticks(1, ['b']); // the press
    ticks(2);
    expect(host.player.imageDisabled).toBe(true);
    expect(prints).not.toHaveBeenCalled();
    ticks(1);
    expect(host.player.imageDisabled).toBe(false);
    expect(getActiveScript()!.commands[getActiveScript()!.index].type).toBe('displayOpen');
    until(() => prints.mock.calls.length > 0, () => [], 60);
    expect(prints.mock.calls[0][0]).toEqual({ program });
    expect(getTextProgramData().programs[program]).toBeDefined();
    until(() => host.state === 'overworld', (() => { let n = 0; return () => (n++ % 8 === 0 ? ['a' as const] : []); })(), 3000);
    expect(host.player.imageDisabled).toBe(false);
  });
  it('paints each picture cell from its own tile, and keeps NPCs under the box hidden until the text opens', async () => {
    await lookAt(2, 4);
    const covered = () => { uiTiles.clear(); renderScriptMenu(); return [uiTiles.tileAt(6, 4), uiTiles.tileAt(14, 13), uiTiles.tileAt(5, 4), uiTiles.tileAt(15, 13)]; };
    ticks(2, ['a']);
    expect(covered()).toEqual([0, 0, 0, 0]);
    ticks(1, ['a']);
    expect(covered()).toEqual([0x60, 0x60, 0, 0]);
    ticks(10, ['a']); // every third is on the screen
    await new Promise(resolve => setTimeout(resolve, 0)); // the picture's fetch, for rendering only
    const sheet = await loadTileset(AERODACTYL.url);
    const cell = (draw: () => void, x: number, y: number): string => {
      const canvas = captureNative(draw) as unknown as RasterCanvas; const out: number[] = [];
      for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) out.push(...canvas.pixel(x * 8 + px, y * 8 + py));
      return out.join(',');
    };
    const white = () => fillRect(0, 0, 160, 144, 0);
    const tile = (id: number, x: number, y: number) => () => { white(); drawTile(sheet, id, x * 8, y * 8); };
    const paint = () => { white(); renderScriptMenu(); };
    expect(cell(tile(18, 11, 7), 11, 7)).not.toBe(cell(white, 11, 7)); // really a drawn tile
    expect(cell(tile(18, 11, 7), 11, 7)).not.toBe(cell(tile(30, 11, 7), 11, 7));
    expect(cell(paint, 11, 7)).toBe(cell(tile(18, 11, 7), 11, 7)); // column 4, row 2
    expect(cell(paint, 10, 8)).toBe(cell(tile(24, 10, 8), 10, 8)); // column 3, row 3
    ticks(1); ticks(1, ['b']); ticks(2);
    expect(covered()).toEqual([0x60, 0x60, 0, 0]); // the restored screen: UpdateSprites hasn't run again
    ticks(1);
    expect(covered()).toEqual([0, 0, 0, 0]);
  });
});
