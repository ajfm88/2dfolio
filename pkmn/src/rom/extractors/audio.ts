// Extract audio data from ROM → same format as data/audio/*.json
// Handles music tracks, SFX, wave samples, and noise instruments.
//
// Binary command encoding (from macros/scripts/audio.asm):
//   0x00-0xAF: note — dn pitch, length-1  (pitch = high nibble, length-1 = low nibble)
//   0xB0-0xBF: drum_note — $B0 | (length-1), followed by instrument byte
//   0xC0-0xCF: rest — $C0 | (length-1)
//   0xD0-0xDF: note_type — $D0 | speed, followed by volume|fade nibble byte
//              (on ch4, this is drum_speed — just $D0 | speed, no extra byte)
//   0xE0-0xE7: octave — $E0 | (8-octave)
//   0xE8: toggle_perfect_pitch
//   0xEA: vibrato — delay byte, then depth|rate nibble byte
//   0xEB: pitch_slide — (length-1) byte, then dn(8-octave, pitch)
//   0xEC: duty_cycle — duty byte
//   0xED: tempo — 2-byte big-endian
//   0xEE: stereo_panning — dn(left, right)
//   0xF0: volume — dn(left, right)
//   0xF8: execute_music
//   0xFC: duty_cycle_pattern — packed byte
//   0xFD: sound_call — 2-byte LE address
//   0xFE: sound_loop — count byte, 2-byte LE address
//   0xFF: sound_ret
//
// SFX-specific:
//   0x10: pitch_sweep — dn(length, shift) with signed magnitude for shift
//   0x20-0x2F: square_note/noise_note — $20 | length, dn(volume, fade), then:
//              square_note: 2-byte LE frequency
//              noise_note: 1-byte param

import { BinaryReader } from '../binary_reader';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AudioCommand {
  cmd: string;
  [key: string]: unknown;
}

export interface ChannelData {
  id: number;
  commands: AudioCommand[];
}

export interface MusicData {
  channels: ChannelData[];
}

export interface NoiseInstrument {
  steps: {
    length: number;
    volume: number;
    fade: number;
    param: number;
  }[];
}

// ── Music header constants ──────────────────────────────────────────────────

// Map music track names to their symbol addresses (bank:addr from pokeyellow.sym)
// Only bank 2 music tracks listed (bank 8, 0x1f, 0x20 have different headers)
const MUSIC_HEADERS: Record<string, { bank: number; addr: number }> = {
  // Bank 2 (SFX_Headers_1)
  pallettown:     { bank: 0x02, addr: 0x422e },
  pokecenter:     { bank: 0x02, addr: 0x4237 },
  gym:            { bank: 0x02, addr: 0x4240 },
  cities1:        { bank: 0x02, addr: 0x4249 },
  cities2:        { bank: 0x02, addr: 0x4255 },
  celadon:        { bank: 0x02, addr: 0x425e },
  cinnabar:       { bank: 0x02, addr: 0x4267 },
  vermilion:      { bank: 0x02, addr: 0x4270 },
  lavender:       { bank: 0x02, addr: 0x427c },
  ssanne:         { bank: 0x02, addr: 0x4288 },
  meetprofoak:    { bank: 0x02, addr: 0x4291 },
  meetrival:      { bank: 0x02, addr: 0x429a },
  museumguy:      { bank: 0x02, addr: 0x42a3 },
  safarizone:     { bank: 0x02, addr: 0x42af },
  pkmnhealed:     { bank: 0x02, addr: 0x42b8 },
  routes1:        { bank: 0x02, addr: 0x42c1 },
  routes2:        { bank: 0x02, addr: 0x42cd },
  routes3:        { bank: 0x02, addr: 0x42d9 },
  routes4:        { bank: 0x02, addr: 0x42e5 },
  indigoplateau:  { bank: 0x02, addr: 0x42f1 },

  // Bank 8 (SFX_Headers_2)
  gymleaderbattle:  { bank: 0x08, addr: 0x42be },
  trainerbattle:    { bank: 0x08, addr: 0x42c7 },
  wildbattle:       { bank: 0x08, addr: 0x42d0 },
  finalbattle:      { bank: 0x08, addr: 0x42d9 },
  defeatedtrainer:  { bank: 0x08, addr: 0x42e2 },
  defeatedwildmon:  { bank: 0x08, addr: 0x42eb },
  defeatedgymleader:{ bank: 0x08, addr: 0x42f4 },
  pokefluteinbattle:{ bank: 0x08, addr: 0x59cf },

  // Bank 0x1f (SFX_Headers_3)
  titlescreen:      { bank: 0x1f, addr: 0x4249 },
  credits:          { bank: 0x1f, addr: 0x4255 },
  halloffame:       { bank: 0x1f, addr: 0x425e },
  oakslab:          { bank: 0x1f, addr: 0x4267 },
  jigglypuffsong:   { bank: 0x1f, addr: 0x4270 },
  bikeriding:       { bank: 0x1f, addr: 0x4276 },
  surfing:          { bank: 0x1f, addr: 0x4282 },
  gamecorner:       { bank: 0x1f, addr: 0x428b },
  yellowintro:      { bank: 0x1f, addr: 0x4294 },
  dungeon1:         { bank: 0x1f, addr: 0x429d },
  dungeon2:         { bank: 0x1f, addr: 0x42a9 },
  dungeon3:         { bank: 0x1f, addr: 0x42b5 },
  cinnabarmansion:  { bank: 0x1f, addr: 0x42c1 },
  pokemontower:     { bank: 0x1f, addr: 0x42cd },
  silphco:          { bank: 0x1f, addr: 0x42d6 },
  meeteviltrainer:  { bank: 0x1f, addr: 0x42df },
  meetfemaletrainer:{ bank: 0x1f, addr: 0x42e8 },
  meetmaletrainer:  { bank: 0x1f, addr: 0x42f1 },

  // Bank 0x20 (SFX_Headers_4)
  surfingpikachu:   { bank: 0x20, addr: 0x41cb },
  meetjessiejames:  { bank: 0x20, addr: 0x41d4 },
  yellowunusedsong: { bank: 0x20, addr: 0x41dd },
  gbprinter:        { bank: 0x20, addr: 0x41e9 },
};

// SFX headers: map SFX names to their symbol addresses
// All SFX headers exist in multiple banks (1-4), we use bank 2 by default
// (SFX_Headers_1) since it's the most complete
const SFX_HEADERS: Record<string, { bank: number; addr: number }> = {
  press_ab:         { bank: 0x02, addr: 0x41b0 },
  start_menu:       { bank: 0x02, addr: 0x41ad },
  collision:        { bank: 0x02, addr: 0x421c },
  go_inside:        { bank: 0x02, addr: 0x4207 },
  go_outside:       { bank: 0x02, addr: 0x421f },
  save:             { bank: 0x02, addr: 0x4222 },
  purchase:         { bank: 0x02, addr: 0x4216 },
  swap:             { bank: 0x02, addr: 0x420a },
  withdraw_deposit: { bank: 0x02, addr: 0x4201 },
  cut:              { bank: 0x02, addr: 0x4204 },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function bankOffset(bank: number, addr: number): number {
  return bank * 0x4000 + (addr & 0x3FFF);
}

/** Decode signed magnitude fade value from a nibble (0-15).
 *  Bit 3 = sign (1=negative), bits 2-0 = magnitude.
 *  A value of 8 (0b1000) = negative 0 = effectively 0.
 */
function decodeFade(nibble: number): number {
  if (nibble & 0x08) {
    // Negative: magnitude is bits 2-0
    return -(nibble & 0x07);
  }
  return nibble;
}

// ── Wave Samples ────────────────────────────────────────────────────────────

/**
 * Extract wave sample data from ROM.
 * Returns an array of 5 waveforms, each an array of 32 nibble values.
 * Matches data/audio/wave_samples.json format.
 */
export function extractWaveSamples(rom: BinaryReader): number[][] {
  // Audio1_WavePointers is at 02:5a16, which is a table of 8 pointers (dw)
  // wave0 through wave5 (with wave5 duplicated for 6 and 7)
  // The actual waveform data starts at wave0 = 02:5a26
  const WAVE_POINTERS = bankOffset(0x02, 0x5a16);
  const WAVE_BANK = 0x02;
  const NUM_WAVES = 5; // Only 5 unique waveforms (wave0-wave4) in the JSON

  const waves: number[][] = [];

  for (let i = 0; i < NUM_WAVES; i++) {
    // Read pointer from the table
    const ptrAddr = rom.readWord(WAVE_POINTERS + i * 2);
    const dataOffset = bankOffset(WAVE_BANK, ptrAddr);

    // Each waveform is 16 bytes = 32 nibbles
    const nibbles: number[] = [];
    for (let j = 0; j < 16; j++) {
      const byte = rom.readByte(dataOffset + j);
      nibbles.push((byte >> 4) & 0x0F);
      nibbles.push(byte & 0x0F);
    }
    waves.push(nibbles);
  }

  return waves;
}

// ── Noise Instruments ───────────────────────────────────────────────────────

/**
 * Extract noise instrument data from ROM.
 * Returns an array of 19 instruments.
 * Matches data/audio/noise_instruments.json format.
 */
export function extractNoiseInstruments(rom: BinaryReader): NoiseInstrument[] {
  // Noise instruments are at SFX_Noise_Instrument01_1 through _19_1
  // Each is a header: channel_count 1, channel 8, <addr>
  // The channel data is noise_note commands terminated by sound_ret
  const BANK = 0x02;
  const instruments: NoiseInstrument[] = [];

  for (let i = 1; i <= 19; i++) {
    // SFX_Noise_Instrument01_1 starts at 02:4003, each header is 3 bytes
    const headerOffset = bankOffset(BANK, 0x4003 + (i - 1) * 3);

    // Read header: first byte = dn(num_channels << 2, channel_id - 1), then dw address
    // const headerByte = rom.readByte(headerOffset);
    const chAddr = rom.readWord(headerOffset + 1);
    const dataOffset = bankOffset(BANK, chAddr);

    const steps: { length: number; volume: number; fade: number; param: number }[] = [];
    let pos = dataOffset;

    while (true) {
      const byte = rom.readByte(pos);

      if (byte === 0xFF) {
        // sound_ret — end of instrument
        break;
      }

      if ((byte & 0xF0) === 0x20) {
        // noise_note: $20 | length, then dn(volume, fade), then param byte
        const length = byte & 0x0F;
        const volFade = rom.readByte(pos + 1);
        const volume = (volFade >> 4) & 0x0F;
        const fadeRaw = volFade & 0x0F;
        const param = rom.readByte(pos + 2);

        steps.push({
          length,
          volume,
          fade: fadeRaw, // Store raw nibble — gen_music.js stores the unsigned value
          param,
        });
        pos += 3;
      } else {
        // Unknown byte, skip
        pos++;
      }
    }

    instruments.push({ steps });
  }

  return instruments;
}

// ── Music Track Extraction ──────────────────────────────────────────────────

/**
 * Parse a music header and extract channel count + channel pointers.
 */
function parseMusicHeader(rom: BinaryReader, bank: number, addr: number): { id: number; dataAddr: number }[] {
  const offset = bankOffset(bank, addr);

  // First byte: dn(num_channels << 2, channel_id - 1)
  const firstByte = rom.readByte(offset);
  const numChannels = ((firstByte >> 4) >> 2) + 1;
  const firstChId = (firstByte & 0x0F) + 1;
  const firstChAddr = rom.readWord(offset + 1);

  const channels: { id: number; dataAddr: number }[] = [];
  channels.push({ id: firstChId, dataAddr: firstChAddr });

  // Remaining channels (3 bytes each)
  for (let i = 1; i < numChannels; i++) {
    const entryOffset = offset + 3 + (i - 1) * 3;
    const chByte = rom.readByte(entryOffset);
    const chId = (chByte & 0x0F) + 1;
    const chDataAddr = rom.readWord(entryOffset + 1);
    channels.push({ id: chId, dataAddr: chDataAddr });
  }

  return channels;
}

/**
 * Decode commands from a channel's binary data.
 *
 * Strategy: decode the entire channel as a single sequential stream.
 * The gen_music.js reads all ASM lines in file order and produces a flat
 * command array. Subroutine code appears inline after the main body.
 * We replicate this by reading from the start address forward, not stopping
 * at intermediate sound_ret commands that end subroutines, until we've
 * consumed all code referenced by sound_call/sound_loop.
 *
 * @param isNoiseChannel - true if this is channel 4 (noise), which uses drum_speed instead of note_type
 * @param isSfx - true if decoding SFX data (enables square_note, noise_note, pitch_sweep commands)
 */
function decodeChannelCommands(
  rom: BinaryReader,
  bank: number,
  startAddr: number,
  isNoiseChannel: boolean,
  isSfx: boolean = false,
): AudioCommand[] {
  // Two-pass approach:
  // Pass 1: Decode sequentially from startAddr, collecting all commands and
  //         tracking the furthest address referenced by sound_call or sound_loop.
  //         Keep reading past sound_ret as long as there are referenced addresses
  //         ahead that haven't been reached yet.
  // Pass 2: Resolve target addresses to command indices.

  const commands: AudioCommand[] = [];
  const cmdAddrs: number[] = [];    // bank-relative address of each command
  let pos = bankOffset(bank, startAddr);

  // Track the maximum ROM offset we need to decode to
  // (furthest sound_call/sound_loop target + its code)
  let maxTargetRomPos = pos; // At minimum, decode the start

  while (true) {
    const bankAddr = (pos & 0x3FFF) | 0x4000;
    cmdAddrs.push(bankAddr);

    const byte = rom.readByte(pos);

    if (byte === 0xFF) {
      // sound_ret
      commands.push({ cmd: 'sound_ret' });
      pos += 1;

      // Should we keep going? Only if there are referenced addresses
      // that we haven't reached yet, OR if the very next byte is also
      // a sound_ret (trailing "unused" sound_ret in ASM source).
      if (pos <= maxTargetRomPos) {
        continue; // More code to decode after this sound_ret
      }
      // Check for trailing sound_ret bytes (the ASM source often has
      // "sound_ret ; unused" after the last reachable code in a channel)
      if (rom.readByte(pos) === 0xFF) {
        // Include the trailing sound_ret
        cmdAddrs.push((pos & 0x3FFF) | 0x4000);
        commands.push({ cmd: 'sound_ret' });
        pos += 1;
      }
      break; // We've consumed everything
    }

    if (byte === 0xFE) {
      // sound_loop: count byte, 2-byte LE address
      const count = rom.readByte(pos + 1);
      const targetAddr = rom.readWord(pos + 2);
      commands.push({ cmd: 'sound_loop', count, target: 0, _targetAddr: targetAddr });

      // Update maxTarget if this target is ahead of current position
      const targetRomPos = bankOffset(bank, targetAddr);
      if (targetRomPos > maxTargetRomPos) {
        maxTargetRomPos = targetRomPos;
      }
      pos += 4;
      continue;
    }

    if (byte === 0xFD) {
      // sound_call: 2-byte LE address
      const targetAddr = rom.readWord(pos + 1);
      commands.push({ cmd: 'sound_call', target: 0, _targetAddr: targetAddr });

      const targetRomPos = bankOffset(bank, targetAddr);
      if (targetRomPos > maxTargetRomPos) {
        maxTargetRomPos = targetRomPos;
      }
      pos += 3;
      continue;
    }

    if (byte === 0xFC) {
      const packed = rom.readByte(pos + 1);
      commands.push({
        cmd: 'duty_cycle_pattern',
        d0: (packed >> 6) & 0x03,
        d1: (packed >> 4) & 0x03,
        d2: (packed >> 2) & 0x03,
        d3: packed & 0x03,
      });
      pos += 2;
      continue;
    }

    if (byte === 0xF8) {
      commands.push({ cmd: 'execute_music' });
      pos += 1;
      continue;
    }

    if (byte === 0xF0) {
      const volByte = rom.readByte(pos + 1);
      commands.push({ cmd: 'volume', left: (volByte >> 4) & 0x0F, right: volByte & 0x0F });
      pos += 2;
      continue;
    }

    if (byte === 0xEE) {
      const panByte = rom.readByte(pos + 1);
      commands.push({ cmd: 'stereo_panning', left: (panByte >> 4) & 0x0F, right: panByte & 0x0F });
      pos += 2;
      continue;
    }

    if (byte === 0xED) {
      const tempoVal = rom.readWordBE(pos + 1);
      commands.push({ cmd: 'tempo', value: tempoVal });
      pos += 3;
      continue;
    }

    if (byte === 0xEC) {
      const duty = rom.readByte(pos + 1);
      commands.push({ cmd: 'duty_cycle', value: duty });
      pos += 2;
      continue;
    }

    if (byte === 0xEB) {
      const lenMinus1 = rom.readByte(pos + 1);
      const octPitch = rom.readByte(pos + 2);
      const octave = 8 - ((octPitch >> 4) & 0x0F);
      const pitch = octPitch & 0x0F;
      commands.push({ cmd: 'pitch_slide', length: lenMinus1 + 1, octave, pitch });
      pos += 3;
      continue;
    }

    if (byte === 0xEA) {
      const delay = rom.readByte(pos + 1);
      const depthRate = rom.readByte(pos + 2);
      commands.push({
        cmd: 'vibrato',
        delay,
        depth: (depthRate >> 4) & 0x0F,
        rate: depthRate & 0x0F,
      });
      pos += 3;
      continue;
    }

    if (byte === 0xE8) {
      commands.push({ cmd: 'toggle_perfect_pitch' });
      pos += 1;
      continue;
    }

    if (byte >= 0xE0 && byte <= 0xE7) {
      const octave = 8 - (byte & 0x07);
      commands.push({ cmd: 'octave', value: octave });
      pos += 1;
      continue;
    }

    if ((byte & 0xF0) === 0xD0) {
      const speed = byte & 0x0F;
      if (isNoiseChannel) {
        commands.push({ cmd: 'drum_speed', speed });
        pos += 1;
      } else {
        const volFade = rom.readByte(pos + 1);
        const volume = (volFade >> 4) & 0x0F;
        const fadeRaw = volFade & 0x0F;
        commands.push({ cmd: 'note_type', speed, volume, fade: fadeRaw });
        pos += 2;
      }
      continue;
    }

    if ((byte & 0xF0) === 0xC0) {
      const length = (byte & 0x0F) + 1;
      commands.push({ cmd: 'rest', length });
      pos += 1;
      continue;
    }

    if ((byte & 0xF0) === 0xB0 && isNoiseChannel) {
      const length = (byte & 0x0F) + 1;
      const instrument = rom.readByte(pos + 1);
      commands.push({ cmd: 'drum_note', instrument, length });
      pos += 2;
      continue;
    }

    // SFX-only commands
    if (isSfx && byte === 0x10) {
      const paramByte = rom.readByte(pos + 1);
      const length = (paramByte >> 4) & 0x0F;
      const shiftRaw = paramByte & 0x0F;
      let shift: number;
      if (shiftRaw & 0x08) {
        shift = -(shiftRaw & 0x07);
        if ((shiftRaw & 0x07) === 0) {
          shift = 8;
        }
      } else {
        shift = shiftRaw;
      }
      commands.push({ cmd: 'pitch_sweep', length, shift });
      pos += 2;
      continue;
    }

    if (isSfx && byte >= 0x20 && byte <= 0x2F) {
      const length = byte & 0x0F;
      const volFade = rom.readByte(pos + 1);
      const volume = (volFade >> 4) & 0x0F;
      const fadeRaw = volFade & 0x0F;

      if (isNoiseChannel) {
        const param = rom.readByte(pos + 2);
        commands.push({ cmd: 'noise_note', length, volume, fade: fadeRaw, param });
        pos += 3;
      } else {
        const frequency = rom.readWord(pos + 2);
        commands.push({ cmd: 'square_note', length, volume, fade: fadeRaw, frequency });
        pos += 4;
      }
      continue;
    }

    if (byte < 0xC0) {
      const pitch = (byte >> 4) & 0x0F;
      const length = (byte & 0x0F) + 1;
      commands.push({ cmd: 'note', pitch, length });
      pos += 1;
      continue;
    }

    // Unknown/unhandled byte — safety bail
    pos += 1;
  }

  // Build address → command index map
  const addrToIdx = new Map<number, number>();
  for (let i = 0; i < cmdAddrs.length; i++) {
    addrToIdx.set(cmdAddrs[i], i);
  }

  // Resolve sound_call and sound_loop targets
  for (const cmd of commands) {
    if (cmd._targetAddr !== undefined) {
      const targetAddr = cmd._targetAddr as number;
      const targetIdx = addrToIdx.get(targetAddr);
      if (targetIdx !== undefined) {
        cmd.target = targetIdx;
      } else {
        cmd.target = 0;
      }
      delete cmd._targetAddr;
    }
  }

  return commands;
}

/**
 * Extract a single music track from ROM.
 * Returns data matching data/audio/music/<name>.json format.
 */
export function extractMusic(rom: BinaryReader, trackName: string): MusicData | null {
  const header = MUSIC_HEADERS[trackName.toLowerCase()];
  if (!header) return null;

  const channelInfos = parseMusicHeader(rom, header.bank, header.addr);
  const channels: ChannelData[] = [];

  for (const info of channelInfos) {
    const isNoiseChannel = info.id === 4;
    const commands = decodeChannelCommands(rom, header.bank, info.dataAddr, isNoiseChannel);
    channels.push({ id: info.id, commands });
  }

  return { channels };
}

// ── SFX Extraction ──────────────────────────────────────────────────────────

/**
 * Extract a single SFX from ROM.
 * Returns data matching data/audio/sfx/<name>.json format.
 */
export function extractSfx(rom: BinaryReader, sfxName: string): MusicData | null {
  const header = SFX_HEADERS[sfxName.toLowerCase()];
  if (!header) return null;

  const channelInfos = parseMusicHeader(rom, header.bank, header.addr);
  const channels: ChannelData[] = [];

  for (const info of channelInfos) {
    // SFX channels are 5-8. Channel 8 = noise
    const isNoiseChannel = info.id === 8;
    const commands = decodeChannelCommands(rom, header.bank, info.dataAddr, isNoiseChannel, true);
    channels.push({ id: info.id, commands });
  }

  return { channels };
}

// Suppress unused function warning
void decodeFade;

