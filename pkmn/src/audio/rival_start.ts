// audio/alternate_tempo.asm Music_RivalAlternateStart overwrites CH1/2/3 entry pointers.
// The committed decoded stream already contains the alternate entry and its main-loop jump.
import type { MusicCommand, MusicData } from './music_engine';

const note = (pitch: number, length: number): MusicCommand => ({ cmd: 'note', pitch, length });
const rest = (length: number): MusicCommand => ({ cmd: 'rest', length });
const octave = (value: number): MusicCommand => ({ cmd: 'octave', value });
const prefixes: Record<number, MusicCommand[]> = {
  1: [{ cmd: 'tempo', value: 112 }, { cmd: 'volume', left: 7, right: 7 }, { cmd: 'duty_cycle', value: 3 },
    { cmd: 'vibrato', delay: 6, depth: 3, rate: 4 }, { cmd: 'toggle_perfect_pitch' },
    { cmd: 'note_type', speed: 12, volume: 11, fade: 3 }, octave(3),
    note(2, 1), rest(3), note(2, 1), rest(5), note(9, 2), note(7, 2), note(9, 2)],
  2: [{ cmd: 'duty_cycle', value: 3 }, { cmd: 'vibrato', delay: 10, depth: 2, rate: 6 },
    { cmd: 'note_type', speed: 12, volume: 12, fade: 7 }, octave(3),
    note(7, 1), rest(3), note(7, 1), rest(3), note(2, 1), rest(1), octave(4), note(2, 2), note(5, 2), note(6, 2)],
  3: [{ cmd: 'note_type', speed: 12, volume: 1, fade: 4 }, octave(4),
    note(7, 1), rest(3), note(7, 1), rest(3), note(7, 1), rest(1),
    note(7, 1), rest(1), note(7, 1), rest(1), note(7, 1), rest(1)],
};
export function rivalAlternateStart(data: MusicData): MusicData {
  return { channels: data.channels.map(channel => {
    const prefix = prefixes[channel.id];
    if (!prefix) throw new Error(`unexpected rival music channel ${channel.id}`);
    // Source-matched prefixes locate entrypoints in the extraction, not replacement music.
    const entries = channel.commands.flatMap((_, i) => prefix.every((command, j) =>
      JSON.stringify(channel.commands[i + j]) === JSON.stringify(command)) ? [i] : []);
    if (entries.length !== 1) throw new Error(`rival channel ${channel.id} alternate entry is ambiguous or missing`);
    const commands = channel.commands.map(command => command.target === undefined ? { ...command }
      : { ...command, target: command.target + 1 });
    // An instantaneous interpreter jump models Audio1_OverwriteChannelPointer, without an engine change.
    return { id: channel.id, commands: [{ cmd: 'sound_loop', count: 0, target: entries[0] + 1 }, ...commands] };
  }) };
}
