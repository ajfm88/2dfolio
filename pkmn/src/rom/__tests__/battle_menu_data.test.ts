// A5c2 CP2: SFX_Run and the bank-1/battle-bank press sound, independently read from ROM.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractSfx, SFX_HEADERS } from '../extractors/audio';
import { rig } from '../../test/audio_rig';
import { soundFinished } from '../../audio/sound_wait';
import type { SfxData, SfxCommand } from '../../audio/sfx_engine';

const ROM_PATH = process.env.ROM_PATH;
let rom: Buffer;
let reader: BinaryReader;
beforeAll(() => {
  if (!ROM_PATH) return;
  rom = readFileSync(ROM_PATH);
  reader = new BinaryReader(Uint8Array.from(rom).buffer);
});
const offset = (bank: number, addr: number) => bank * 0x4000 + (addr & 0x3fff);

// Source fixture: audio/sfx/run.asm, every noise_note length/volume/fade/NR43 operand.
const RUN_NOTES = [
  [2, 6, 1, 35], [2, 10, 1, 51], [2, 12, 1, 51], [2, 5, 1, 17],
  [2, 15, 1, 51], [2, 4, 1, 17], [2, 12, 1, 51], [2, 3, 1, 17],
  [2, 8, 1, 51], [2, 3, 1, 17], [8, 4, 1, 51],
];

// Independent small ROM decoder: this body has only noise_note ($2n) and sound_ret ($ff).
// Neither SFX_HEADERS nor the production decoder supplies the pointer or operands.
function rawRun(): SfxData {
  const commands: SfxCommand[] = [];
  let at = offset(8, 0x43fb);
  for (let count = 0; count < 12; count++) {
    const opcode = rom[at++];
    if (opcode === 0xff) { commands.push({ cmd: 'sound_ret' }); return { channels: [{ id: 8, commands }] }; }
    expect(opcode & 0xf0).toBe(0x20);
    const envelope = rom[at++];
    commands.push({ cmd: 'noise_note', length: opcode & 15, volume: envelope >> 4, fade: envelope & 15, param: rom[at++] });
  }
  throw new Error('RUN did not terminate after its eleven notes');
}

describe.skipIf(!ROM_PATH)('A5c2 CP2 battle-menu audio ROM pins', () => {
  it('pins RUN to the battle-only header, channel 8 and body 08:43fb', () => {
    expect(SFX_HEADERS.run).toEqual({ bank: 8, addr: 0x41c5 });
    const at = offset(8, 0x41c5);
    expect([...rom.subarray(at, at + 3)]).toEqual([0x07, 0xfb, 0x43]);
    expect((0x41c5 - 0x4000) / 3).toBe(0x97);
    expect(extractSfx(reader, 'run')!.channels.map(c => c.id)).toEqual([8]);
  });

  it('matches every RUN command to the source fixture and independent ROM decode', () => {
    const expected = [...RUN_NOTES.map(([length, volume, fade, param]) => ({ cmd: 'noise_note', length, volume, fade, param })),
      { cmd: 'sound_ret' }];
    const raw = rawRun();
    expect(raw.channels[0].commands).toEqual(expected);
    expect(extractSfx(reader, 'run')).toEqual(raw);
  });

  it('keeps RUN JSON and its static mirror identical to independent ROM commands', () => {
    const path = 'audio/sfx/run.json';
    const data = readFileSync(resolve(__dirname, '../../../data', path), 'utf8');
    expect(data).toBe(JSON.stringify(rawRun(), null, 2) + '\n');
    expect(readFileSync(resolve(__dirname, '../../../static', path), 'utf8')).toBe(data);
  });

  it('ends RUN on update 40, with independently decoded notes starting on 1,4,…,31', () => {
    // Ten length2 notes last 3 updates each; final length8 lasts 9; sound_ret on update40.
    for (const data of [rawRun(), extractSfx(reader, 'run')!]) {
      const r = rig(); r.sfx.play(data);
      r.run(39);
      expect(r.sfx.isPlaying()).toBe(true);
      expect(soundFinished(r.sfx, r.music, 0)).toBe(false);
      expect(r.synth.at('noise')).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31]);
      expect(r.synth.log.filter(w => w.m === 'noise').map(w => w.a))
        .toEqual(RUN_NOTES.map(([, volume, fade, param]) => [param, volume, fade]));
      r.update();
      expect(r.sfx.isPlaying()).toBe(false);
      expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
    }
  });

  it('pins both press_ab headers and compares their complete 19-byte bodies', () => {
    const bodies: Buffer[] = [];
    for (const [bank, body] of [[2, 0x4400], [8, 0x4361]]) {
      const header = offset(bank, 0x41b0);
      expect(rom[header]).toBe(4); // one channel, CHAN5
      expect(rom.readUInt16LE(header + 1)).toBe(body);
      const at = offset(bank, body);
      bodies.push(rom.subarray(at, at + 19));
    }
    // duty_cycle 2, four square_note commands, sound_ret (audio/sfx/press_ab_{1,2}.asm).
    expect([...bodies[0]]).toEqual([0xec, 2, 0x20, 0x91, 0xc0, 7, 0x20, 0x81, 0xd0, 7,
      0x20, 0x91, 0xc0, 7, 0x2c, 0xa1, 0xd0, 7, 0xff]);
    expect(bodies[1]).toEqual(bodies[0]);
  });
});
