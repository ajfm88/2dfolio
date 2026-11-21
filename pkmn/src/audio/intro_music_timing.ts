// Movie-only Audio1_UpdateMusic cost, over the existing engine's semantic state. No ROM or opcode execution.
import type { MusicData, MusicCommand, MusicEngine } from './music_engine';
import type { SoundChannel } from './sound_channel';
const COMMANDS = new Set(['tempo','volume','duty_cycle','vibrato','note_type','octave','sound_ret','note','rest']);

/** Pure lookahead for the movie's linear, three-channel music with no SFX, mute, drums or pitch slides.
 * Call before the paired real update. Counts machine cycles from Audio1_UpdateMusic entry through RET;
 * incoming CALL, fade/alarm, interrupts and sample rendering are outside this native routine. */
export function introMusicUpdateCycles(music: MusicEngine, data: MusicData): number {
  if (music.audioControl?.getMute() || music.getChannel(4)?.active)
    throw new Error('Movie timing requires unmuted SFX-free three-channel music');
  const ids = data.channels.map(row => row.id);
  if (ids.length !== 3 || new Set(ids).size !== 3 || ids.some(id => id < 1 || id > 3))
    throw new Error('Movie timing requires pulse/pulse/wave music only');
  for (const row of data.channels) for (const command of row.commands)
    if (!COMMANDS.has(command.cmd)) throw new Error(`Unsupported movie music timing command: ${command.cmd}`);
  let cycles = 165; // ld c,0; eight inactive slot walks; final RET
  for (const row of data.channels) {
    if (row.id < 1 || row.id > 3) throw new Error('Movie timing requires pulse/pulse/wave music only');
    const channel = music.getChannel(row.id);
    if (!channel?.active) continue;
    if (channel.pitchSlideActive || channel.hasDutyPattern || channel.perfectPitch || channel.inCall || channel.isDrumChannel || channel.suppressed)
      throw new Error('Unsupported movie music timing state');
    cycles += 18 + (channel.noteDelayCounter === 1 ? nextNote(channel, row.commands) : waiting(channel));
  }
  return cycles;
}

/** The composition seam: forecast BEFORE advancing the real music engine, then charge exactly that native
 * work to the supplied clock. Valid only with SFX absent and no interrupts accepted during this routine
 * (a serviced VBlank or the movie's LCD-off counted passes). The caller owns all surrounding handler work. */
export function timedIntroMusicUpdate(
  music: MusicEngine, data: MusicData, clock: { advance(cycles: number): void },
): number {
  const cycles = introMusicUpdateCycles(music, data);
  music.tick();
  clock.advance(cycles);
  return cycles;
}

function waiting(c: SoundChannel): number {
  let cost = 14 + 19 + 11 + 12 + 10 + 11;
  if (c.vibratoDelayCounter !== 0) return cost + 17;
  cost += 11;
  if (c.vibratoExtents === 0) return cost + 14;
  cost += 11;
  if ((c.vibratoRates & 15) !== 0) return cost + 20;
  cost += 14 + 10;
  if (!c.vibratoDirection) cost += 18 + (c.freqLow + (c.vibratoExtents >> 4) > 255 ? 14 : 13);
  else cost += 17 + (c.freqLow < (c.vibratoExtents & 15) ? 17 : 16);
  return cost + 34;
}

/** MultiplyAdd's shift/add loop; its operand's set bits and highest bit determine its cost. */
function multiply(a: number): number {
  let cycles = 2;
  do { const bit = a & 1; a >>>= 1; cycles += (a ? 15 : 13) + bit; } while (a);
  return cycles + 4;
}
function nextNote(c: SoundChannel, commands: readonly MusicCommand[]): number {
  // engine_1.asm: ApplyMusicAffects's taken JP (15), PlayNextNote setup/CALL/RET (43).
  // Command constants count GetNextMusicByte (90), the sequential test chain, operands and the tail JP
  // back to sound_ret. They exclude the next command's fetch. A taken conditional JP is four cycles;
  // a failed JP is three (note_type / terminal sound_ret). No lookup depends on a song/frame position.
  let cost = 15 + 43, speed = c.noteSpeed, octave = c.octave;
  for (let pc = c.pc; pc < commands.length; pc++) {
    const cmd = commands[pc];
    switch (cmd.cmd) {
      case 'tempo': cost += 377; continue;
      case 'volume': cost += 271; continue;
      case 'duty_cycle': cost += 256; continue;
      case 'vibrato': cost += 380; continue;
      case 'note_type': cost += c.id === 3 ? 269 : 259; speed = cmd.speed!; continue;
      case 'octave': cost += 196; octave = cmd.value!; continue;
      case 'sound_ret': return cost + 157;
      case 'note': case 'rest': {
        // sound_ret's byte read and the native command-test chain down to note_length.
        cost += 198 + (cmd.cmd === 'note' && cmd.pitch === 2 ? 5 : 0);
        cost += 26 + multiply(speed) + 18 + 16 + multiply((cmd.length! * speed) & 255);
        cost += 1 + 1 + 3 + 2 + 2 + 1 + 3 + 2 + 2 + 3 + 2 + 3 + 2 + 3 + 2 + 3 + 3;
        if (cmd.cmd === 'rest') return cost + (c.id === 3 ? 52 : 75);
        cost += 10 + 17 + (32 + 12 * (octave - 1)) + 13 + 25;
        cost += 2 + 3 + 2 + 2 + 2 + 6 + 19 + 2 + 6 + (c.id === 3 ? 48 : 64) + 6 + 138 + 3 + 2 + 3 + 2 + 3 + 3;
        return cost + 3 + 2 + 2 + 6 + (c.id === 3 ? 293 : 59) + 4;
      }
      default: throw new Error(`Unsupported movie music timing command: ${cmd.cmd}`);
    }
  }
  throw new Error('Movie music command stream lacks a native return');
}
