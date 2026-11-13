// V5b checkpoint-01 (note 92). home/overworld.asm .battleOccurred → EnterMap → MapEntryAfterBattle: the battle
// has whited out; DelayFrames(10) holds white; LoadMapData requests the map song; GBFadeInFromWhite writes
// FadePal7, FadePal6, FadePal5 with DelayFrames(8) after each; EnterMap's UpdateSprites; `jp OverworldLoop`.
// Nothing moves and nothing reads the joypad until the first pass, two frames later.
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { host, loadMainBattleRig, resetMainBattleRig, tick, until, world, mon, frameNow, output } from './test/main_battle_rig';
import * as audio from './audio';
import * as input from './input';
import * as sprites from './overworld/sprites';
import { getActivePalette, getPaletteColors } from './renderer';
import type { GameButton } from './core';

const ret = host as typeof host & { readonly battleReturnBgp: number | null | undefined; renderBattleReturn(): void };

beforeAll(() => loadMainBattleRig());
beforeEach(resetMainBattleRig);
afterEach(() => { host.reset(); vi.restoreAllMocks(); });
const pulse = (): GameButton[] => frameNow() % 4 === 0 ? ['a'] : [];

/** Win a wild Pidgey on Route 1; returns the frame the session reported done (D). */
async function winWild(): Promise<number> {
  await world('Route1', 5, 5, [mon(25, 45)]);
  host.startBattle(mon(16, 2));
  until(() => host.state === 'battle');
  until(() => host.state !== 'battle', pulse);
  expect(host.state).toBe('battle_return');
  return frameNow();
}

/** One record per frame from D on: [state, bgp]. */
function trace(frames: number, pressed: GameButton[] = []): [string, number | null | undefined][] {
  const out: [string, number | null | undefined][] = [];
  for (let i = 0; i < frames; i++) { tick(pressed); out.push([host.state, ret.battleReturnBgp]); }
  return out;
}

it('ten white frames, then FadePal7, FadePal6 and FadePal5 for eight frames each, then the overworld', async () => {
  await winWild();
  expect(ret.battleReturnBgp).toBeNull(); // D: the first DelayFrame of the ten
  const rows = trace(34);
  const expected: [string, number | null | undefined][] = [
    ...Array.from({ length: 9 }, () => ['battle_return', null] as [string, null]),
    ...Array.from({ length: 8 }, () => ['battle_return', 0x40] as [string, number]),
    ...Array.from({ length: 8 }, () => ['battle_return', 0x90] as [string, number]),
    ...Array.from({ length: 8 }, () => ['battle_return', 0xe4] as [string, number]),
    ['overworld', undefined],
  ];
  expect(rows).toEqual(expected);
});

it('LoadMapData requests the map song at D+10, after UpdateMusic6Times; nothing before', async () => {
  const df = vi.spyOn(audio, 'playDefaultMusicFadeOutCurrent'), six = vi.spyOn(audio, 'updateMusic6Times');
  const d = await winWild();
  const at: number[] = [];
  df.mockImplementation((...args) => { at.push(frameNow()); void args; });
  expect(df).not.toHaveBeenCalled();
  trace(34);
  expect(at).toEqual([d + 10]);
  expect(df).toHaveBeenCalledExactlyOnceWith('routes1', true);
  expect(six.mock.invocationCallOrder[0]).toBeLessThan(df.mock.invocationCallOrder[0]);
});

it("EnterMap's UpdateSprites runs once, at D+34, and the first overworld pass reads the joypad at D+36", async () => {
  const d = await winWild();
  const update = vi.spyOn(sprites, 'updateSprites'), read = vi.spyOn(input, 'readJoypad');
  const updates: number[] = [], reads: number[] = [];
  update.mockImplementation(() => { updates.push(frameNow()); });
  read.mockImplementation(() => { reads.push(frameNow()); });
  trace(37, ['down']);
  expect(updates[0]).toBe(d + 34);
  expect(updates.filter(f => f < d + 36)).toEqual([d + 34]);
  expect(reads[0]).toBe(d + 36);
});

it('a held direction moves nothing until the first pass', async () => {
  await winWild();
  const before = { x: host.player.x, y: host.player.y };
  trace(35, ['down']);
  expect({ x: host.player.x, y: host.player.y }).toEqual(before);
  expect(host.player.isMoving).toBe(false);
});

it('the drawn frames: white, then only shades 0–1, then 0–2, then the unshaded scene', async () => {
  await winWild();
  const palette = getPaletteColors(getActivePalette()).map(c => c.join(','));
  const colours = (): Set<string> => {
    ret.renderBattleReturn();
    const data = output.pixels, seen = new Set<string>();
    for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return seen;
  };
  expect([...colours()]).toEqual(['255,255,255']);
  trace(9);
  expect(ret.battleReturnBgp).toBeNull();
  trace(1); expect(ret.battleReturnBgp).toBe(0x40);
  const p7 = colours();
  expect([...p7].every(c => c === palette[0] || c === palette[1])).toBe(true);
  expect(p7.has(palette[1])).toBe(true);
  trace(8); expect(ret.battleReturnBgp).toBe(0x90);
  const p6 = colours();
  expect([...p6].every(c => palette.slice(0, 3).includes(c))).toBe(true);
  expect(p6.has(palette[2])).toBe(true);
  trace(8); expect(ret.battleReturnBgp).toBe(0xe4);
  expect(colours().has(palette[3])).toBe(true);
});

it("a script's battle resumes the script in RunMapScript's pass, D+36", async () => {
  await world('ViridianCity', 18, 3, [mon(25, 20)]);
  const resumed: number[] = [];
  host.startScript([{ type: 'catchDemo', battleType: 'OLD_MAN', species: 'RATTATA', level: 5 }, { type: 'callback', fn: () => { resumed.push(frameNow()); } }]);
  until(() => host.state === 'battle');
  until(() => host.state !== 'battle', pulse);
  const d = frameNow();
  expect(host.state).toBe('battle_return');
  trace(37);
  expect(resumed.map(f => f - d)).toEqual([36]);
});
