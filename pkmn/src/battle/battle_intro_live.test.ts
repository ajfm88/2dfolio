// A5e checkpoint-04a. The corrected timing on the real host, printer and renderer. No ROM.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../renderer', () => ({
  getCtx: vi.fn(), getScale: () => 1, drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }),
}));
vi.mock('../input', () => ({
  isHeld: vi.fn(() => false), isPressed: vi.fn(() => false), isPassPressed: vi.fn(() => false),
  syncJoypadRead: vi.fn(), readJoypad: vi.fn(),
}));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
import { isHeld } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { uiTiles } from '../renderer/ui_tiles';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { setLowHealthAlarm, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { BattleState, WILD_BATTLE, encodeText } from './battle_state';
import { D } from './battle_end_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { BattleScreen, type BattleScreen as BattleScreenType } from './battle_screen';
import { type BattleInitHost } from './battle_init';
import { battleSilhouetteIntro } from './battle_intro_program';
import { BattleIntroTiming, INTRO_SCROLL, POST_VBLANK_LY, type IntroScanout } from './battle_intro_timing';
import { IntroRasterCapture, LCD_OFF_RGB } from './battle_intro_raster';
import { getPaletteColors } from '../renderer/palettes';
import { INTRO_LCD_OFF_FRAMES } from './battle_intro_program';
import { renderBattleScreen, type BattleRenderTiles, type RawImage } from './battle_screen_render';
import { backPictureBox, frontPictureBox } from './battle_pictures';
import type { Frame, Program } from './battle_menu_context';

const PIXELS = 160 * 144 * 4;
const ROW = 160 * 4;
const HEIGHT = 144;
const bridges: BattleAudio[] = [];
const noScan: IntroScanout = { to() {}, endFrame() {}, restart() {} };

beforeEach(() => {
  textBgTransfer.enabled = true; textBgTransfer.resetPortion(); textBgTransfer.enabled = false;
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false);
});
afterEach(() => {
  bridges.splice(0).forEach(bridge => bridge.dispose());
  vi.restoreAllMocks();
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
});

function png(file: string): RawImage {
  return PNG.sync.read(readFileSync(resolve(__dirname, '../../static/gfx', file)));
}
function pictures(): BattleRenderTiles {
  const map = new Map<string, RawImage>([['front/19', frontPictureBox(png('sprites/front/19.png'), 0x55)]]);
  for (const [key, file] of [['redb', 'player/redb.png'], ['oldmanb', 'battle/oldmanb.png'], ['prof.oakb', 'battle/prof.oakb.png']])
    map.set(key, backPictureBox(png(file)));
  return {
    font: png('font/font.png'), extra: png('font/font_battle_extra.png'),
    hud1: png('battle/battle_hud_1.png'), hud2: png('battle/battle_hud_2.png'), hud3: png('battle/battle_hud_3.png'),
    pictures: map, sprites: { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4).fill(255) },
  };
}

describe('A5e checkpoint-04a post-VBlank anchor', () => {
  it('anchors a serviced boundary at 146 and a held boundary at 144', () => {
    expect(POST_VBLANK_LY).toBe(146);
    const timing = new BattleIntroTiming(new BattleState(), new BattleScreen(), 0, noScan);
    timing.boundary('serviced');
    expect(timing.line).toBe(POST_VBLANK_LY);
    timing.boundary('held');
    expect(timing.line).toBe(144);
  });

  it.each([[64, 0], [96, 0], [145, 1]] as const)(
    'from the post-VBlank anchor, LY%i crosses %i frame', (line, count) => {
      const timing = new BattleIntroTiming(new BattleState(), new BattleScreen(), POST_VBLANK_LY, noScan);
      const seen: string[] = [];
      const run = timing.until(line);
      for (let next = run.next(); !next.done; next = run.next()) {
        expect(next.value).toBe('serviced');
        seen.push(next.value);
        if (next.value !== 'serviced') return;
        timing.boundary(next.value);
      }
      expect(seen).toHaveLength(count);
      expect(timing.line).toBe(line);
    });
});

describe('A5e checkpoint-04a host raster binding', () => {
  it('services DisableLCD\'s deferred VBlank once, copies the head and one BG third, then turns the LCD off', () => {
    const state = new BattleState();
    const host = new BattleHost(state);
    const screen = host.video.screen;
    const timing = new BattleIntroTiming(state, screen, POST_VBLANK_LY, noScan);
    textBgTransfer.enabled = true; textBgTransfer.resetPortion();
    for (let slot = 0; slot < 21; slot++) screen.setOam(slot, {
      y: 0x38 + (slot % 3) * 8, x: (0xa0 + slot * 2) & 255, tile: slot, attributes: 2,
    });
    const lcdDuring: boolean[] = [];
    const phaseAtStart: number[] = [];
    const original = screen.vblank.bind(screen);
    vi.spyOn(screen, 'vblank').mockImplementation((...args: Parameters<BattleScreenType['vblank']>) => {
      lcdDuring.push(screen.lcdOn);
      phaseAtStart.push(textBgTransfer.nextPortion);
      return original(...args);
    });
    host.bindRaster(timing);
    host.start((function* (): Program {
      yield 'serviced';
      yield* timing.disableLCD();
    })());
    const frames = [host.step(), host.step()];
    expect(frames).toEqual(['serviced', 'serviced']);
    expect(host.done).toBe(true);
    expect(lcdDuring).toEqual([true, true]);
    expect(phaseAtStart).toEqual([0, 1]);
    expect(textBgTransfer.nextPortion).toBe(2);
    for (let slot = 0; slot < 21; slot++) expect(screen.oam(slot)).toEqual(screen.shadowOam(slot));
    expect(screen.oam(0)).toEqual({ y: 0x38, x: 0xa0, tile: 0, attributes: 2 });
    expect(screen.lcdOn).toBe(false);
    expect(frames).not.toContain('held');
  });

  it('seals and latches before VBlank, so the scanout sees pre-DMA OAM and the pre-transfer third', () => {
    const state = new BattleState();
    const host = new BattleHost(state);
    const screen = host.video.screen;
    textBgTransfer.enabled = true; textBgTransfer.resetPortion();
    screen.put(0, 0, 'A');
    screen.setOam(0, { y: 16, x: 8, tile: 1, attributes: 2 });
    state.mem[INTRO_SCROLL.hSCX] = 22;
    state.mem[INTRO_SCROLL.hSCY] = 3;
    const seen: { oamY: number; phase: number; scx: number; visible: string | number | null }[] = [];
    const timing = new BattleIntroTiming(state, screen, POST_VBLANK_LY, {
      to() { seen.push({ oamY: screen.oam(0).y, phase: textBgTransfer.nextPortion, scx: screen.scx, visible: screen.visibleAt(0, 0) }); },
      endFrame() {}, restart() {},
    });
    let latchedBeforeDma = false;
    const original = screen.vblank.bind(screen);
    vi.spyOn(screen, 'vblank').mockImplementation((...args: Parameters<BattleScreenType['vblank']>) => {
      latchedBeforeDma = screen.scx === 22 && screen.oam(0).y === 0 && textBgTransfer.nextPortion === 0;
      return original(...args);
    });
    host.bindRaster(timing);
    host.start((function* (): Program { yield 'serviced'; })());
    expect(host.step()).toBe('serviced');
    expect(seen).toEqual([{ oamY: 0, phase: 0, scx: 0, visible: ' ' }]);
    expect(latchedBeforeDma).toBe(true);
    expect(screen.scx).toBe(22);
    expect(screen.scy).toBe(3);
    expect(screen.oam(0).y).toBe(16);
    expect(textBgTransfer.nextPortion).toBe(1);
    expect(screen.visibleAt(0, 0)).toBe('A');
  });

  it('passes a palette-held frame to boundary and does not run VBlank', () => {
    const state = new BattleState();
    const host = new BattleHost(state);
    const screen = host.video.screen;
    const timing = new BattleIntroTiming(state, screen, POST_VBLANK_LY, noScan);
    const boundary = vi.spyOn(timing, 'boundary');
    const vblank = vi.spyOn(host.video, 'vblank');
    host.bindRaster(timing);
    host.start((function* (): Program {
      yield* screen.setPalBattle({ partySpecies: 25, enemySpecies2: 19, playerBar: 0, enemyBar: 0 });
    })());
    expect(host.step()).toBe('held');
    expect(boundary).toHaveBeenCalledTimes(1);
    expect(boundary).toHaveBeenCalledWith('held');
    expect(vblank).not.toHaveBeenCalled();
    expect(timing.line).toBe(144);
  });

  it('refuses a session frame before any tick, a second binding and another screen', () => {
    const bare = new BattleHost(new BattleState());
    expect(() => bare.bindRaster(null)).not.toThrow();
    const state = new BattleState();
    const audio = vi.fn();
    const host = new BattleHost(state, undefined, audio);
    const other = new BattleIntroTiming(state, new BattleScreen(), POST_VBLANK_LY, noScan);
    expect(() => host.bindRaster(other)).toThrow('raster timing for another screen');
    const timing = new BattleIntroTiming(state, host.video.screen, POST_VBLANK_LY, noScan);
    host.bindRaster(timing);
    expect(() => host.bindRaster(timing)).toThrow('raster timing already bound');
    const boundary = vi.spyOn(timing, 'boundary');
    const vblank = vi.spyOn(host.video, 'vblank');
    host.start((function* (): Program { yield 'session'; })());
    expect(() => host.step()).toThrow('session frame during raster-timed intro');
    expect(boundary).not.toHaveBeenCalled();
    expect(vblank).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
  });

  it('a host that is bound and then unbound steps like a host that was never bound', () => {
    function trace(unbind: boolean): string[] {
      const state = new BattleState();
      const log: string[] = [];
      const host = new BattleHost(state, undefined, () => log.push('audio'));
      const original = host.video.vblank.bind(host.video);
      vi.spyOn(host.video, 'vblank').mockImplementation(() => { log.push('vblank'); original(); });
      if (unbind) {
        host.bindRaster(new BattleIntroTiming(state, host.video.screen, POST_VBLANK_LY, noScan));
        host.bindRaster(null);
      }
      host.start((function* (): Program {
        log.push('prime');
        yield 'serviced';
        log.push('after-serviced');
        yield 'held';
        log.push('after-held');
        yield 'session';
        log.push('after-session');
        yield 'serviced';
        log.push('done');
      })());
      const frames: string[] = [];
      while (!host.done) frames.push(String(host.step()));
      return [...log, ...frames.map(frame => `out:${frame}`)];
    }
    const unbound = trace(false);
    let bound: string[] | undefined;
    let error: unknown;
    try { bound = trace(true); } catch (caught) { error = caught; }
    expect(error, error instanceof Error ? error.message : '').toBeUndefined();
    expect(bound).toEqual(unbound);
    expect(unbound.filter(entry => entry === 'vblank')).toHaveLength(2);
    expect(unbound.filter(entry => entry.startsWith('out:'))).toEqual(['out:serviced', 'out:held', 'out:session', 'out:serviced']);
  });

  it('a dark frame calls boundary and skips VBlank and audio', () => {
    const state = new BattleState();
    const audio = vi.fn();
    const bound = new BattleHost(state, undefined, audio);
    const vblank = vi.spyOn(bound.video, 'vblank');
    const boundary = vi.fn();
    bound.video.screen.lcdOn = false;
    bound.bindRaster({ screen: bound.video.screen, boundary });
    bound.start((function* (): Program { yield 'dark'; })());
    expect(bound.pendingFrame).toBe('dark');
    expect(bound.step()).toBe('dark');
    expect(boundary).toHaveBeenCalledTimes(1);
    expect(boundary).toHaveBeenCalledWith('dark');
    expect(vblank).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
    const unboundAudio = vi.fn();
    const unbound = new BattleHost(new BattleState(), undefined, unboundAudio);
    const unboundVblank = vi.spyOn(unbound.video, 'vblank');
    unbound.start((function* (): Program { yield 'dark'; })());
    expect(unbound.step()).toBe('dark');
    expect(unboundVblank).not.toHaveBeenCalled();
    expect(unboundAudio).not.toHaveBeenCalled();
  });
});

describe('A5e checkpoint-04a raster capture', () => {
  it('copies each row once, in order, and endFrame, restart and to(200) follow the cursor', () => {
    let generation = 0;
    const render = () => {
      const gen = ++generation;
      const data = new Uint8ClampedArray(PIXELS);
      for (let y = 0; y < 144; y++) {
        const at = y * ROW;
        data[at] = y;
        data[at + 1] = gen;
      }
      return data;
    };
    const capture = new IntroRasterCapture(render);
    capture.to(10);
    capture.to(10);
    expect(generation).toBe(1);
    expect(capture.cursor).toBe(10);
    capture.to(40);
    expect(generation).toBe(2);
    const live = render();
    const composed = capture.compose(live);
    expect(composed).not.toBe(live);
    for (let y = 0; y < 10; y++) {
      expect(composed[y * ROW]).toBe(y);
      expect(composed[y * ROW + 1]).toBe(1);
    }
    for (let y = 10; y < 40; y++) {
      expect(composed[y * ROW]).toBe(y);
      expect(composed[y * ROW + 1]).toBe(2);
    }
    for (let y = 40; y < 144; y++) {
      expect(composed[y * ROW]).toBe(y);
      expect(composed[y * ROW + 1]).toBe(3);
    }
    capture.endFrame();
    expect(capture.cursor).toBe(0);
    capture.to(4);
    expect(capture.cursor).toBe(4);
    capture.restart();
    expect(capture.cursor).toBe(0);
    capture.to(200);
    expect(capture.cursor).toBe(144);
    expect(() => capture.to(143)).toThrow('intro capture went backwards');
  });

  it('keeps captured rows, takes the rest live, and returns live when the cursor is 0 or there is no renderer', () => {
    const live = new Uint8ClampedArray(PIXELS).fill(9);
    const empty = new IntroRasterCapture(() => new Uint8ClampedArray(PIXELS).fill(1));
    expect(empty.compose(live)).toBe(live);
    const book = new IntroRasterCapture(null);
    book.to(20);
    expect(book.cursor).toBe(20);
    expect(book.compose(live)).toBe(live);
    const render = () => {
      const data = new Uint8ClampedArray(PIXELS);
      for (let y = 0; y < 144; y++) data.fill(y, y * ROW, (y + 1) * ROW);
      return data;
    };
    const capture = new IntroRasterCapture(render);
    capture.to(12);
    const out = capture.compose(live);
    expect(out).not.toBe(live);
    const differ = (got: Uint8ClampedArray, want: Uint8ClampedArray) => got.findIndex((value, index) => value !== want[index]);
    expect(differ(out.subarray(0, 12 * ROW), render().subarray(0, 12 * ROW))).toBe(-1);
    expect(differ(out.subarray(12 * ROW), live.subarray(12 * ROW))).toBe(-1);
  });

  it('off and blank compose white, and endFrame after blank returns to on', () => {
    const live = new Uint8ClampedArray(PIXELS);
    live[0] = 1;
    const capture = new IntroRasterCapture(() => live);
    capture.off();
    const off = capture.compose(live);
    expect(off).not.toBe(live);
    expect(off.findIndex(value => value !== 255)).toBe(-1);
    capture.restart();
    const blank = capture.compose(live);
    expect(blank.findIndex(value => value !== 255)).toBe(-1);
    capture.endFrame();
    expect(capture.compose(live)).toBe(live);
    expect([...LCD_OFF_RGB]).toEqual([...getPaletteColors('PAL_BLACK')[0]]);
  });
});

describe('A5e checkpoint-04a presented intro', () => {
  beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
  beforeEach(() => { setTextSpeed('fast'); uiTiles.clear(); vi.mocked(isHeld).mockReturnValue(false); });

  function runLive(pixels: boolean): {
    before: Frame[]; opening: string; done: boolean; screen: BattleScreenType;
    presented: Uint8ClampedArray[]; sealed: Uint8ClampedArray[];
    special: { presented: Uint8ClampedArray; preTail: Uint8ClampedArray; live: Uint8ClampedArray } | null;
  } {
    const state = new BattleState();
    const audio = audioRig();
    const bridge = new BattleAudio(audio.sfx, audio.music);
    bridges.push(bridge);
    const driver = new BattleHost(state, undefined, audio.update);
    const screen = driver.video.screen;
    state.wBattleType = 0;
    state.wIsInBattle = WILD_BATTLE;
    state.wCurMap = 0x0c;
    state.wEnemyMonSpecies2 = 0xa5;
    state.wCurPartySpecies = 0xa5;
    state.mem[D.wPartyCount] = 1;
    state.setBytes(D.wPartySpecies, [0x54, 255], 2);
    state.writeBE(D.wPartyMons + 1, 20);
    state.setBytes(D.wEnemyMonNick, encodeText('RATTATA@'), 11);
    const tiles = pictures();
    screen.lcdOn = false;
    screen.copyFront('front/19').next();
    screen.setPalBattleBlack().next();
    screen.lcdOn = true;
    for (let col = 0; col < 7; col++) for (let row = 0; row < 7; row++) screen.put(12 + col, row, col * 7 + row);
    for (let x = 0; x < 11; x++) screen.put(x, 0, 'A');
    textBgTransfer.enabled = true;
    screen.vblank(); screen.vblank(); screen.vblank();
    textBgTransfer.resetPortion();
    textBgTransfer.enabled = false;
    const render = () => renderBattleScreen(screen, tiles);
    const capture = new IntroRasterCapture(pixels ? render : null);
    const sealed: Uint8ClampedArray[] = [];
    let preTail: Uint8ClampedArray | undefined;
    let to96 = 0;
    const scanout: IntroScanout = pixels ? {
      to(line) {
        const before = capture.cursor;
        capture.to(line);
        if (capture.cursor === HEIGHT && before < HEIGHT) sealed.push(capture.compose(new Uint8ClampedArray(PIXELS)));
        if (line === 96) {
          to96 += 1;
          if (to96 === 72) preTail = render().slice();
        }
      },
      endFrame() { capture.endFrame(); },
      restart() { capture.restart(); },
      off() { capture.off(); },
    } : capture;
    const timing = new BattleIntroTiming(state, screen, POST_VBLANK_LY, scanout);
    let opening = '';
    let textStarted = false;
    const host: BattleInitHost = {
      screen, audio: bridge, trainerAppeared: { id: 0xe9, data: sfxData('trainer_appeared') },
      renderTiles: tiles, pokeballTiles: png('battle/balls.png'), frontPicture: () => 'front/19',
      saveScreenTilesToBuffer1() {}, loadScreenTilesFromBuffer1() {},
      marowakAnimation: function* () { throw new Error('unexpected tower'); },
      printText: function* (program, bindings) {
        textStarted = true;
        opening = program;
        yield* driver.printText(program, bindings);
      },
      waitForSound: function* () { yield 'serviced'; },
      voice: { getAlarm: () => 0, setAlarm() {}, cry() {}, clip() {} },
      introScanout: scanout, bindRaster(timing) { driver.bindRaster(timing); },
    };
    driver.bindRaster(timing);
    driver.start(battleSilhouetteIntro(state, host, timing));
    const before: Frame[] = [];
    const presented: Uint8ClampedArray[] = [];
    let special: { presented: Uint8ClampedArray; preTail: Uint8ClampedArray; live: Uint8ClampedArray } | null = null;
    let down = false;
    for (let guard = 0; !driver.done && guard < 1500; guard++) {
      down = driver.video.textBox.isWaitingForInput ? !down : false;
      vi.mocked(isHeld).mockImplementation(key => down && key === 'b');
      const started = textStarted;
      const kind = driver.step();
      if (kind === null) break;
      if (!started) before.push(kind);
      if (!pixels) continue;
      const live = render();
      const frame = capture.compose(live);
      presented.push(frame);
      if (!special && screen.wy === 0 && capture.cursor === 96 && preTail)
        special = { presented: frame, preTail, live };
    }
    return { before, opening, done: driver.done, screen, presented, sealed, special };
  }

  it('every presented intro frame equals the next seal, or is white while the LCD is off or skipped', () => {
    const run = runLive(true);
    expect(run.done).toBe(true);
    const white = (buf: Uint8ClampedArray) => buf.every(value => value === 255);
    const whites: number[] = [];
    for (let i = 0; i < run.presented.length; i++) if (white(run.presented[i])) whites.push(i);
    const dark0 = run.before.indexOf('dark');
    // The deferred-VBlank step, then the two dark ticks. Their presents are the three white frames.
    expect(whites).toEqual([dark0 - 1, dark0, dark0 + 1]);
    expect(run.before[dark0 - 1]).toBe('serviced');
    expect(run.before[dark0 + 1]).toBe('dark');
    expect(run.sealed.length).toBe(run.presented.length - 2);
    let darksBefore = 0;
    for (let i = 0; i < run.presented.length - 1; i++) {
      if (i < run.before.length && run.before[i] === 'dark') darksBefore++;
      if (white(run.presented[i])) continue;
      const want = run.sealed[i + 1 - darksBefore];
      const got = run.presented[i];
      const at = got.findIndex((value, index) => value !== want[index]);
      expect(at, `frame ${i} of ${run.presented.length}`).toBe(-1);
    }
  });

  it('the last iteration presents the pre-tail slide above the open window', () => {
    const run = runLive(true);
    expect(run.special).not.toBeNull();
    const upper = 96 * ROW;
    const { presented, preTail, live } = run.special!;
    const differ = (got: Uint8ClampedArray, want: Uint8ClampedArray) => got.findIndex((value, index) => value !== want[index]);
    expect(differ(presented.subarray(0, upper), preTail.subarray(0, upper))).toBe(-1);
    expect(differ(presented.subarray(0, upper), live.subarray(0, upper))).toBeGreaterThanOrEqual(0);
    expect(differ(presented.subarray(upper), live.subarray(upper))).toBe(-1);
  });

  it('wild type 0 takes 97 serviced and 2 held before the real opening text', () => {
    const run = runLive(false);
    const serviced = run.before.filter(frame => frame === 'serviced').length;
    const held = run.before.filter(frame => frame === 'held').length;
    const dark = run.before.filter(frame => frame === 'dark').length;
    // back pic 14, deferred VBlank 1, dark pair, Delay3, DelayFrame, 71 loop crossings, Delay3, palette 3 + ball copy; held is the palette's 2.
    expect(run.done, run.before.join(' ')).toBe(true);
    expect(run.opening).toBe('WildMonAppearedText');
    expect(serviced, run.before.join(' ')).toBe(97);
    expect(held, run.before.join(' ')).toBe(2);
    expect(dark, run.before.join(' ')).toBe(2);
    expect(run.before).toHaveLength(101);
    const shown = Array.from({ length: 18 * 20 }, (_, i) => String(run.screen.at(i % 20, Math.floor(i / 20)) ?? '')).join('');
    expect(shown).toContain('RATTATA');
    expect(shown).toContain('appeared');
  });

  it('yields exactly two dark frames directly after the deferred VBlank', () => {
    expect(INTRO_LCD_OFF_FRAMES).toBe(2);
    const run = runLive(false);
    const darks = run.before.flatMap((frame, index) => frame === 'dark' ? [index] : []);
    // 14 back-pic yields, then the deferred VBlank, then the dark pair.
    expect(darks).toEqual([15, 16]);
    expect(run.before[14]).toBe('serviced');
  });
});
