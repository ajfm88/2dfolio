import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealingMachineSession } from './healing_machine';
import type { HealingMachineAudio } from './healing_machine';
import { GameMap } from './map';
import { rig, musicData, sfxData } from '../test/audio_rig';
import { loadSpriteMapped, obpMapping } from '../renderer';

const ctx = vi.hoisted(() => ({ save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
  drawImage: vi.fn(), globalAlpha: 1 }));
vi.mock('../renderer', async original => ({ ...await original<typeof import('../renderer')>(),
  getActivePalette: () => 'VIRIDIAN', getScale: () => 1, getCtx: () => ctx,
  loadTileset: async () => ({ width: 128 }), loadTilesetTransparent: async () => ({ width: 128 }),
  loadSpriteMapped: vi.fn(async (_url, mapping, palette) => ({ mapping, palette })),
}));
beforeEach(() => { vi.clearAllMocks(); ctx.globalAlpha = 1; });

function scene(n: number, savedObp1 = 0xe0) {
  const audio = rig(musicData('pokecenter'));
  let frame = 0;
  const calls: { name: string; frame: number }[] = [];
  const port: HealingMachineAudio = {
    preloadMusic: vi.fn(name => { calls.push({ name: `preload:${name}`, frame }); }),
    fadeOutAndStopMusic: vi.fn(control => { calls.push({ name: `fade:${control}`, frame }); audio.fade.fadeOutAndStopMusic(control); }),
    isAudioFadingOut: () => audio.fade.isFadingOut(),
    playSFX: name => { calls.push({ name, frame }); audio.sfx.play(sfxData(name)); },
    playMusic: name => { calls.push({ name, frame }); audio.music.play(musicData(name)); },
    isMusicChannelActive: id => audio.music.getChannel(id)?.active ?? false,
  };
  const machine = new HealingMachineSession(n, port, savedObp1);
  return { machine, audio, port, calls, step() { frame++; audio.update(); return machine.frame(); } };
}

describe('AnimateHealingMachine: real fade/SFX/music in lockstep', () => {
  it('loads both OBJ variants before a Pokécenter map finishes loading', async () => {
    let release!: (image: HTMLCanvasElement) => void;
    const image = new Promise<HTMLCanvasElement>(resolve => { release = resolve; });
    vi.mocked(loadSpriteMapped).mockImplementationOnce(() => image).mockImplementationOnce(() => image);
    let ready = false;
    const map = new GameMap(); const pending = map.load('ViridianPokecenter').then(() => { ready = true; });
    await vi.waitFor(() => expect(loadSpriteMapped).toHaveBeenCalledTimes(2));
    expect(ready).toBe(false);
    release({ width: 8, height: 16 } as HTMLCanvasElement); await pending;
    expect(ready).toBe(true);
    expect(loadSpriteMapped).toHaveBeenCalledWith('/gfx/overworld/heal_machine.png', [0, 0, 2, 3], 'VIRIDIAN');
    expect(loadSpriteMapped).toHaveBeenCalledWith('/gfx/overworld/heal_machine.png', [0, 2, 0, 3], 'VIRIDIAN');
  });

  it.each([1, 6])('%i party members: every render, call and return matches the source anchors', async n => {
    const s = scene(n); await Promise.resolve();
    const j = 41 + 30 * n, done = j + 168;
    const firstVisible = [2, ...Array.from({ length: n }, (_, k) => 42 + 30 * k)];
    expect(s.calls).toEqual([{ name: 'preload:pkmnhealed', frame: 0 }]);
    s.machine.render(); expect(ctx.drawImage).not.toHaveBeenCalled();
    for (let f = 1; f <= j + 170; f++) {
      expect(s.step(), `return at H+${f}`).toBe(f < done ? 'busy' : 'done');
      ctx.drawImage.mockClear();
      const count = f >= j + 170 ? 0 : firstVisible.filter(t => f >= t).length;
      s.machine.render(); s.machine.render(); // Rendering twice cannot advance DMA or flashes.
      expect(ctx.drawImage, `H+${f}`).toHaveBeenCalledTimes(count * 2);
      const flashed = f >= j && f < j + 80 && Math.floor((f - j) / 10) % 2 === 0;
      for (const [image] of ctx.drawImage.mock.calls) {
        expect(image.mapping, `palette at H+${f}`).toEqual(obpMapping(flashed ? 0xc8 : 0xe0));
      }
      expect(ctx.globalAlpha).toBe(1);
    }
    expect(s.calls).toEqual([
      { name: 'preload:pkmnhealed', frame: 0 }, { name: 'fade:4', frame: 1 },
      ...Array.from({ length: n }, (_, k) => ({ name: 'healing_machine', frame: 41 + 30 * k })),
      { name: 'pkmnhealed', frame: j },
    ]);
    expect(loadSpriteMapped).toHaveBeenCalledWith('/gfx/overworld/heal_machine.png', [0, 0, 2, 3], 'VIRIDIAN');
    expect(loadSpriteMapped).toHaveBeenCalledWith('/gfx/overworld/heal_machine.png', [0, 2, 0, 3], 'VIRIDIAN');
  });

  it('uses all seven source positions, alternate X flips and OAM order', async () => {
    const s = scene(6); await Promise.resolve();
    for (let t = 1; t <= 192; t++) s.step();
    vi.clearAllMocks(); s.machine.render();
    expect(ctx.translate.mock.calls).toEqual([[44, 16], [40, 23], [56, 23], [40, 28], [56, 28], [40, 33], [56, 33]]);
    expect(ctx.scale.mock.calls).toEqual([[-1, 1], [-1, 1], [-1, 1]]);
    expect(ctx.drawImage.mock.calls.map(call => call.slice(1))).toEqual([
      [0, 0, 8, 8, 0, 0, 8, 8], ...Array(6).fill([0, 8, 8, 8, 0, 0, 8, 8]),
    ]);
    expect(ctx.save).toHaveBeenCalledTimes(7); expect(ctx.restore).toHaveBeenCalledTimes(7);
  });

  it('waits for CHAN1, including a changed jingle length, instead of hardcoding 136 or isPlaying', async () => {
    const s = scene(1); await Promise.resolve();
    let active = true;
    s.port.isMusicChannelActive = () => active;
    for (let t = 1; t <= 71 + 200; t++) expect(s.step()).toBe('busy');
    active = false;
    expect(s.step()).toBe('busy'); // CHAN1 return begins DelayFrames 32
    for (let t = 1; t < 32; t++) expect(s.step()).toBe('busy');
    expect(s.step()).toBe('done');
  });

  it('unready audio skips both audio waits while retaining ball, flash and tail delays', () => {
    const s = scene(1);
    s.port.fadeOutAndStopMusic = vi.fn(); s.port.isAudioFadingOut = () => false;
    s.port.playMusic = () => {}; s.port.isMusicChannelActive = () => false;
    // H+1 ball, H+31 jingle attempt, 80 flash + 32 tail -> H+143.
    for (let t = 1; t < 143; t++) expect(s.step()).toBe('busy');
    expect(s.step()).toBe('done');
  });

  it('a late load cannot let the jingle wait return before playback has started', async () => {
    const s = scene(1);
    let loaded!: () => void;
    s.port.playMusic = () => new Promise<void>(resolve => { loaded = resolve; });
    s.port.isMusicChannelActive = () => false;
    for (let t = 1; t <= 240; t++) expect(s.step()).toBe('busy');
    loaded(); await Promise.resolve();
    expect(s.step()).toBe('busy');
    for (let t = 1; t < 32; t++) expect(s.step()).toBe('busy');
    expect(s.step()).toBe('done');
  });

  it('guards the unreachable zero-party loop without drawing or playing audio', () => {
    const s = scene(0);
    expect(s.machine.frame()).toBe('done'); s.machine.render();
    expect(s.calls).toEqual([]); expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('restores the saved OBP1 in the return tick, before the retained OAM disappears', async () => {
    const s = scene(1, 0xc8); await Promise.resolve();
    for (let t = 1; t < 239; t++) s.step();
    expect(s.step()).toBe('done');
    for (let t = 0; t < 2; t++) {
      ctx.drawImage.mockClear(); s.machine.render();
      expect(ctx.drawImage).toHaveBeenCalledTimes(2);
      expect(ctx.drawImage.mock.calls[0][0].mapping).toEqual([0, 2, 0, 3]);
      s.step();
    }
    ctx.drawImage.mockClear(); s.machine.render(); expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
