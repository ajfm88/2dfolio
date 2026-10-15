import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { rivalAlternateStart } from './rival_start';
import { musicData, rig } from '../test/audio_rig';
import type { MusicCommand } from './music_engine';
import { getRegisterValue } from './frequency_table';
import { perfectPitchRegister } from './sound_channel';

const source = resolve(__dirname, '../../../refs/pokeyellow/audio/music/meetrival.asm');
const pitches = ['C_', 'C#', 'D_', 'D#', 'E_', 'F_', 'F#', 'G_', 'G#', 'A_', 'A#', 'B_'];
function sourcePrefix(id: number): MusicCommand[] {
  const section = readFileSync(source, 'utf8').split(`Music_MeetRival_Ch${id}_AlternateStart::`)[1].split('sound_loop')[0];
  return section.split('\n').flatMap(line => {
    const m = line.trim().match(/^(\w+)\s*(.*)$/); if (!m) return [];
    const [, cmd, args] = m; const values = args.split(',').map(x => x.trim()); const n = values.map(Number);
    if (cmd === 'toggle_perfect_pitch') return [{ cmd }];
    if (cmd === 'tempo' || cmd === 'duty_cycle' || cmd === 'octave') return [{ cmd, value: n[0] }];
    if (cmd === 'volume') return [{ cmd, left: n[0], right: n[1] }];
    if (cmd === 'vibrato') return [{ cmd, delay: n[0], depth: n[1], rate: n[2] }];
    if (cmd === 'note_type') return [{ cmd, speed: n[0], volume: n[1], fade: n[2] }];
    if (cmd === 'note') return [{ cmd, pitch: pitches.indexOf(values[0]), length: n[1] }];
    if (cmd === 'rest') return [{ cmd, length: n[0] }];
    throw new Error(`unexpected alternate-start ASM ${line}`);
  });
}
describe('Music_RivalAlternateStart facade adapter', () => {
  it.skipIf(!existsSync(source))('all three prefixes match independently parsed ASM and retain the committed main loops', () => {
    const normal = musicData('meetrival'); const changed = rivalAlternateStart(normal);
    for (const channel of changed.channels) {
      const prefix = sourcePrefix(channel.id); const entry = channel.commands[0].target!;
      expect(channel.commands.slice(entry, entry + prefix.length)).toEqual(prefix);
      const original = normal.channels.find(c => c.id === channel.id)!;
      const body = channel.commands.slice(1).map(c => c.target === undefined ? c : { ...c, target: c.target - 1 });
      expect(body).toEqual(original.commands);
      expect(channel.commands[entry + prefix.length]).toMatchObject({ cmd: 'sound_loop', count: 0,
        target: original.commands.find(c => c.cmd === 'sound_loop' && c.count === 0)!.target! + 1 });
    }
  });
  it('plays the alternate first notes and loops without mutating the normal track', () => {
    const normal = musicData('meetrival'); const before = JSON.stringify(normal);
    const audio = rig(rivalAlternateStart(normal)); audio.update();
    expect(audio.music.getChannel(1)?.octave).toBe(3);
    expect(audio.music.getChannel(2)?.octave).toBe(3);
    expect(audio.music.getChannel(3)?.octave).toBe(4);
    expect(audio.music.getChannel(1)?.freqReg).toBe(perfectPitchRegister(getRegisterValue(2, 3))); // D_, perfect pitch
    expect(audio.music.getChannel(2)?.freqReg).toBe(getRegisterValue(7, 3)); // G_
    expect(audio.music.getChannel(3)?.freqReg).toBe(getRegisterValue(7, 4)); // G_
    audio.run(4000); expect(audio.music.getChannel(1)?.active).toBe(true);
    expect(JSON.stringify(normal)).toBe(before);
  });
});
