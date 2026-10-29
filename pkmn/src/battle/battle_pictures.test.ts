import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { monFrontBox, ghostPictureBox, trainerPictureBox, backPictureBox, trainerPictureFile, loadBattleRenderTiles, pictureRGBA } from './battle_pictures';
import { browserPictureDecoder } from './battle_picture_decode';
import { renderBattleScreen, type RawImage, type BattleRenderTiles } from './battle_screen_render';
import { BattleHost } from './battle_host';
import { BattleState, A, POKEDEX_ORDER, encodeText } from './battle_state';
import { D } from './battle_end_state';
import { INIT, loadPlayerBackPic, setupBattleBeforeTransition, initBattleAfterTransition, type BattleInitHost } from './battle_init';
import { loadMonBackPic } from './battle_slides';
import { BattleAudio } from './battle_audio';
import { BattleRandomState } from './battle_random_state';
import { rig, sfxData } from '../test/audio_rig';
import { isHeld, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { textBgTransfer } from '../text/bg_transfer';
import { lowHealthAlarm, setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { soundFinished } from '../audio/sound_wait';
import { installTrainerSpecies } from './battle_trainer_party';
import { createPokemon, loadBattleData } from './data';
import { partySlotFromPokemon, writePartySlot } from './battle_loaders';
import { getMoveRecord, loadBattleMoveData } from './battle_move_data';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { setPlayerName } from '../core/player_state';
import type { Program } from './battle_menu_context';

const STATIC = resolve(__dirname, '../../static');
const decode = async (file: string): Promise<RawImage> => PNG.sync.read(readFileSync(resolve(STATIC, file)));
const raw = (file: string) => PNG.sync.read(readFileSync(resolve(STATIC, file)));
const rgba = (image: RawImage, x: number, y: number) => Array.from({ length: 4 }, (_, c) => image.data[(y * image.width + x) * 4 + c]);
const pixel = (pixels: Uint8ClampedArray, x: number, y: number) => [...pixels.slice((y * 160 + x) * 4, (y * 160 + x) * 4 + 4)];
const index = (gray: number) => (255 - gray) / 85;
const hash = (data: ArrayLike<number>) => createHash('sha256').update(Uint8Array.from(data)).digest('hex');
let tilePromise: Promise<BattleRenderTiles> | undefined;
const pictureTiles = () => tilePromise ??= loadBattleRenderTiles(decode);
beforeAll(async () => { await loadBattleData(); await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.clearAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast'); setPlayerName('ASH');
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setLowHealthChannel5(0);
});
afterEach(() => vi.restoreAllMocks());
function run(s: BattleState, program: Program) {
  const driver = new BattleHost(s); driver.start(program); let frames = 0;
  while (!driver.done && frames < 1000) { driver.step(); frames++; }
  expect(driver.done).toBe(true); return frames;
}
function expectedFront(image: RawImage, left: number, top: number): RawImage {
  const data = new Uint8ClampedArray(56 * 56 * 4).fill(255);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++)
    for (let c = 0; c < 4; c++) data[((top + y) * 56 + left + x) * 4 + c] = image.data[(y * image.width + x) * 4 + c];
  return { width: 56, height: 56, data };
}
function expectedBack(image: RawImage): RawImage {
  const data = new Uint8ClampedArray(56 * 56 * 4);
  // Hand-derived surviving source rectangle: 28 rows, 24 pixels from the first three columns +4 from the last.
  for (let sy = 0; sy < 28; sy++) for (let sx = 0; sx < 28; sx++)
    for (const dy of [0, 1]) for (const dx of [0, 1]) for (let c = 0; c < 4; c++)
      data[((sy * 2 + dy) * 56 + sx * 2 + dx) * 4 + c] = image.data[(sy * 32 + sx) * 4 + c];
  return { width: 56, height: 56, data };
}

describe('checkpoint-06 committed pictures', () => {
  it.each([[1, 40, 8, 16], [2, 48, 8, 8], [3, 56, 0, 0]])('front dex%i: source%i square at (%i,%i), exact pixels and white margins', async (dex, size, left, top) => {
    const image = await decode(`gfx/sprites/front/${dex}.png`); expect(image.width).toBe(size); expect(image.height).toBe(size);
    const box = monFrontBox(image); expect(box).toEqual(expectedFront(image, left, top));
    let foreground = 0;
    for (let y = 0; y < 56; y++) for (let x = 0; x < 56; x++) {
      const inside = x >= left && x < left + size && y >= top && y < top + size;
      expect(rgba(box, x, y)).toEqual(inside ? rgba(image, x - left, y - top) : [255, 255, 255, 255]);
      if (box.data[(y * 56 + x) * 4] < 255) foreground++;
    }
    expect(foreground).toBeGreaterThan(0);
  });
  it('ghost is forced66 at (8,8), with a known source pixel and exact margins', () => {
    const image = raw('gfx/battle/ghost.png'); let box: RawImage;
    expect(() => { box = ghostPictureBox(image); }).not.toThrow();
    expect(box!).toEqual(expectedFront(image, 8, 8)); expect(rgba(box!, 33, 8)).toEqual([170, 170, 170, 255]);
  });
  it('trainer is forced77: Bug Catcher fills the box without using a stale55 mon header', () => {
    const image = raw('gfx/trainers/bugcatcher.png'), box = trainerPictureBox(image);
    expect(box).toEqual(expectedFront(image, 0, 0)); expect(rgba(box, 25, 9)).toEqual([0, 0, 0, 255]);
  });
  it('synthetic small trainer buffer is rejected rather than inferring55 placement from its PNG size', () => {
    expect(() => trainerPictureBox(raw('gfx/sprites/front/1.png'))).toThrow('picture dimensions disagree');
  });
  it.each(['gfx/player/redb.png', 'gfx/sprites/back/25.png'])('back %s keeps exactly the upper-left28x28, then doubles', file => {
    const image = raw(file), box = backPictureBox(image); expect(image.width).toBe(32); expect(image.height).toBe(32);
    expect(box).toEqual(expectedBack(image));
    for (const [x, y] of [[0, 0], [27, 0], [0, 27], [27, 27], [13, 0]]) {
      expect(rgba(box, x * 2, y * 2)).toEqual(rgba(image, x, y));
      expect(rgba(box, x * 2 + 1, y * 2 + 1)).toEqual(rgba(image, x, y));
    }
  });
  it('all47 trainer rows resolve to committed files, including CHIEF scientist alias', () => {
    const rows = Object.values(JSON.parse(readFileSync(resolve(STATIC, 'trainers.json'), 'utf8'))) as { id: number; pic: string }[];
    expect(rows).toHaveLength(47);
    for (const row of rows) { expect(trainerPictureFile(row.id)).toBe(row.pic); expect(existsSync(resolve(STATIC, 'gfx/trainers', trainerPictureFile(row.id)))).toBe(true); }
    expect(trainerPictureFile(27)).toBe('scientist.png'); expect(() => trainerPictureFile(0)).toThrow('no trainer picture row');
  });
  it('Jessie & James override begins at trainerNo2A', () => {
    expect(trainerPictureFile(30, 0x29)).toBe('rocket.png'); expect(trainerPictureFile(30, 0x2a)).toBe('jessiejames.png');
    expect(trainerPictureFile(30, 0x2b)).toBe('jessiejames.png');
  });
  it('sprite00..30 own the scaled back box, and all21 translated head OAM entries read column-major tiles', async () => {
    const tiles = await pictureTiles();
    const s = new BattleState(), driver = new BattleHost(s), screen = driver.video.screen;
    driver.start(loadPlayerBackPic(s, screen)); let frames = 0; while (!driver.done && frames < 100) { frames++; driver.step(); }
    expect(frames).toBe(14);
    expect(Array.from({ length: 49 }, (_, i) => screen.spriteSlot(i))).toEqual(Array.from({ length: 49 }, (_, tile) => ({ picture: 'redb', tile })));
    expect(screen.spriteSlot(0x31)).toBeNull();
    for (let col = 0; col < 7; col++) for (let row = 0; row < 3; row++) {
      const entry = screen.shadowOam(col * 3 + row);
      expect(entry).toEqual({ x: 0xa0 + col * 8, y: 0x38 + row * 8, tile: col * 7 + row, attributes: 2 });
      // Synthetic scanout translation only: the source grid starts mostly outside the visible160px screen.
      screen.setOam(col * 3 + row, { ...entry, x: entry.x - 0x98 });
    }
    screen.bgp = screen.obp0 = 0xe4; screen.wy = 144; screen.vblank();
    const output = renderBattleScreen(screen, tiles), expected = expectedBack(raw('gfx/player/redb.png'));
    for (let y = 0; y < 24; y++) for (let x = 0; x < 56; x++) {
      const value = index(expected.data[(y * 56 + x) * 4]);
      expect(pixel(output, x, 40 + y)).toEqual([...screen.objPalette(2)[value], 255]);
    }
    // An owned tile never reads an unrelated legacy sheet, even if the caller omitted its picture binding.
    const missing = renderBattleScreen(screen, { ...tiles, pictures: new Map(),
      sprites: { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4) } });
    expect(pixel(missing, 26, 40)).toEqual([...screen.bgPalette(0)[0], 255]);
  });
  it('the send-out mon back loader also fills the independent sprite owner in14 frames', () => {
    const s = new BattleState(), screen = new BattleHost(s).video.screen; s.wBattleMonSpecies2 = 0x54;
    expect(run(s, loadMonBackPic(s, screen, 'back/25'))).toBe(14);
    expect(screen.spriteSlot(48)).toEqual({ picture: 'back/25', tile: 48 }); expect(screen.backSlot(0x61)).toEqual({ picture: 'back/25', tile: 48 });
  });
  it('synthetic flipped front combines per-tile reversed pixels with the existing reversed tilemap columns', async () => {
    const r = await route1Frame(true), screen = r.screen;
    for (let i = 0; i < 49; i++) expect(screen.at(18 - Math.floor(i / 7), i % 7)).toBe(i);
    expect(screen.pictureFlipped(0)).toBe(true);
    expect(screen.spriteSlot(0)).toEqual({ picture: 'redb', tile: 0 });
    expect(screen.pictureFlipped(0, true)).toBe(true); // checkpoint-07a item0: Claude's mutation b.
    const normal = expectedFront(raw('gfx/sprites/front/19.png'), 8, 16);
    for (let y = 0; y < 56; y++) for (let x = 0; x < 56; x++) {
      const value = index(normal.data[(y * 56 + 55 - x) * 4]); expect(pixel(r.opening!, 96 + x, y)).toEqual([...screen.bgPalette(3)[value], 255]);
    }
  });
  it('synthetic flipped back reverses source nibbles before scaling and swaps output nibbles after scaling', () => {
    const image = raw('gfx/player/redb.png'), actual = backPictureBox(image, true);
    // One source ABCD group becomes BB AA DD CC after reverse4, duplicate2 and output SWAP.
    const sourceOrder = [1, 1, 0, 0, 3, 3, 2, 2];
    for (let y = 0; y < 56; y++) for (let group = 0; group < 7; group++) for (let x = 0; x < 8; x++)
      expect(rgba(actual, group * 8 + x, y)).toEqual(rgba(image, group * 4 + sourceOrder[x], Math.floor(y / 2)));
  });
  it('browser fake canvas and pngjs use the identical RGBA conversion for every required file', async () => {
    const tiles = await pictureTiles();
    const canvasDecoder = browserPictureDecoder({ image: async file => raw(file) as unknown as CanvasImageSource & { width: number; height: number },
      canvas: () => { let image: RawImage; return { width: 0, height: 0, getContext: () => ({ drawImage: (value: RawImage) => { image = value; }, getImageData: () => image }) } as unknown as HTMLCanvasElement; } });
    const fromBrowser = await loadBattleRenderTiles(canvasDecoder); expect(tiles.pictures.size).toBe(352);
    const sameImage = (a: RawImage, b: RawImage) => {
      expect([a.width, a.height]).toEqual([b.width, b.height]);
      expect(Buffer.from(Uint8Array.from(a.data)).equals(Buffer.from(Uint8Array.from(b.data)))).toBe(true);
    };
    for (const name of ['font', 'extra', 'hud1', 'hud2', 'hud3', 'sprites'] as const) sameImage(fromBrowser[name], tiles[name]);
    for (const name of ['pictures', 'flippedPictures'] as const) {
      expect([...fromBrowser[name]!.keys()].sort()).toEqual([...tiles[name]!.keys()].sort());
      for (const [key, image] of tiles[name]!) sameImage(fromBrowser[name]!.get(key)!, image);
    }
    const input = { width: 8, height: 1, data: Uint8ClampedArray.from([0, 63, 64, 127, 128, 191, 192, 255].flatMap(gray => [gray, gray, gray, 255])) };
    expect(Array.from(pictureRGBA(input).data).filter((_, i) => i % 4 === 0)).toEqual([0, 0, 85, 85, 170, 170, 255, 255]);
    for (let tile = 0; tile < 4; tile++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      expect(rgba(tiles.sprites, ((0x31 + tile) % 16) * 8 + x, Math.floor((0x31 + tile) / 16) * 8 + y)).toEqual(rgba(raw('gfx/battle/balls.png'), tile * 8 + x, y));
  });
});

async function route1Frame(flipped = false) {
  const tiles = await pictureTiles();
  const s = new BattleState(), audio = rig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(s, undefined, audio.update), screen = driver.video.screen;
  installTrainerSpecies(s); s.movePP = id => getMoveRecord(id)[5];
  const mon = createPokemon('PIKACHU', 5, 'PIKACHU', { atk: 9, def: 8, spd: 8, spc: 8 })!;
  mon.otName = 'ASH'; mon.otId = 0x1234; s.partyMons[0] = mon; s.mem[D.wPartyCount] = 1; s.setBytes(D.wPartySpecies, [0x54, 255], 2);
  writePartySlot(s, 'player', 0, partySlotFromPokemon(mon)); s.setBytes(A.wPlayerName, encodeText('ASH@'), 11); s.writeBE(A.wPlayerID, 0x1234);
  s.wCurOpponent = 0xa5; s.wCurEnemyLevel = 3; s.wCurMap = 0x0c;
  const random = new BattleRandomState(() => 0); setupBattleBeforeTransition(s, random); s.mem[INIT.wSpriteFlipped] = Number(flipped);
  let opening: Uint8ClampedArray | undefined; let frame = 0;
  const host: BattleInitHost = { screen, audio: bridge, renderTiles: { sprites: tiles.sprites }, pokeballTiles: raw('gfx/battle/balls.png'),
    trainerAppeared: { id: 0xe9, data: sfxData('trainer_appeared') }, frontPicture: state => `front/${POKEDEX_ORDER[state.wCurPartySpecies - 1]}`,
    saveScreenTilesToBuffer1: () => driver.video.saveScreenTilesToBuffer1(), loadScreenTilesFromBuffer1: () => driver.video.loadScreenTilesFromBuffer1(),
    printText: function* (program, bindings) { yield* driver.printText(program, bindings); if (program === 'WildMonAppearedText') opening = renderBattleScreen(screen, { ...tiles, sprites: host.renderTiles.sprites }); },
    waitForSound: function* () { while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced'; },
    voice: { getAlarm: lowHealthAlarm, setAlarm: setLowHealthAlarm, cry() {}, clip() {} }, marowakAnimation: function* () { throw new Error('unexpected Marowak'); },
  };
  vi.mocked(playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); }); vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  driver.start(initBattleAfterTransition(s, host));
  while (!driver.done && frame < 3000) {
    const down = frame % 2 === 0; vi.mocked(isHeld).mockImplementation(() => down); vi.mocked(isPassPressed).mockImplementation(() => down);
    driver.step(); frame++;
  }
  expect(driver.done).toBe(true); expect(opening).toBeDefined(); random.detach(s);
  return { frame, opening: opening!, screen, s, final: renderBattleScreen(screen, { ...tiles, sprites: host.renderTiles.sprites }) };
}
it('Route1 real04 opening frame: enemy, Red back, HUD and party ball pixels before snapshots', async () => {
  const tiles = await pictureTiles();
  const { frame, opening, screen, final } = await route1Frame();
  // Captured after WildMonAppearedText completes, before common ClearSprites removes the party balls.
  expect(rgba(tiles.pictures.get('front/19')!, 38, 16)).toEqual([0, 0, 0, 255]);
  expect(pixel(opening, 134, 16)).toEqual([...screen.bgPalette(3)[3], 255]);
  expect(pixel(opening, 34, 40)).toEqual([...screen.bgPalette(2)[3], 255]);
  expect(screen.spriteSlot(0)).toEqual({ picture: 'redb', tile: 0 });
  expect(pixel(opening, 147, 80)).toEqual([...screen.bgPalette(0)[3], 255]);
  expect(pixel(opening, 91, 81)).toEqual([...screen.objPalette(0)[3], 255]);
  expect({ frame, opening: hash(opening), final: hash(final) }).toMatchSnapshot();
}, 20000);
