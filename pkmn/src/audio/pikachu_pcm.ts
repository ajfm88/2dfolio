// Pikachu's voice: the numbers behind PlayPikachuSoundClip (audio/pikachu_pcm.asm) and PlayPikachuPCM
// (home/pikachu_cries.asm). A clip is 1-bit PCM, eight samples a byte, most significant bit first. Each sample is
// one write of the wave channel's output level ($20 or $00) over a wave pattern of all $F, and the loop spends
// the same 45 machine cycles between two writes inside a byte and across two bytes (note 113 §2.2).

/** The CPU's machine cycles in a second (4,194,304 Hz / 4). */
export const MACHINE_CYCLES_PER_SECOND = 1_048_576;
/** One LCD frame: 154 lines of 114 machine cycles. */
export const MACHINE_CYCLES_PER_FRAME = 17_556;
/** From one `ldh [rAUD3LEVEL], a` to the next. */
export const PCM_CYCLES_PER_SAMPLE = 45;
/** About 23,301.7 Hz. */
export const PIKACHU_PCM_HZ = MACHINE_CYCLES_PER_SECOND / PCM_CYCLES_PER_SAMPLE;

/** audio/pikachu_cries/pikachu_cry_N.json: the table's row index, the length word, the played bytes in hex. */
export interface PikachuClipFile { id: number; length: number; samples: string }

export interface PikachuClip { id: number; bytes: Uint8Array }

/** A committed clip file as bytes. `number` is pret's (PikachuCryN is row N - 1). */
export function decodePikachuClip(file: PikachuClipFile, number: number): PikachuClip {
  if (file.id !== number - 1) throw new Error(`Pikachu clip ${number}: the file holds id ${file.id}`);
  if (!/^(?:[0-9a-f]{2})+$/.test(file.samples) || file.samples.length !== file.length * 2)
    throw new Error(`Pikachu clip ${number}: ${file.length} bytes expected`);
  const bytes = new Uint8Array(file.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(file.samples.slice(i * 2, i * 2 + 2), 16);
  return { id: file.id, bytes };
}

/** The real VBlanks that come due while a clip of `bytes` bytes plays with interrupts off. */
export function clipMissedVBlanks(bytes: number): number {
  return Math.floor(bytes * 8 * PCM_CYCLES_PER_SAMPLE / MACHINE_CYCLES_PER_FRAME);
}

/** The frames with no VBlank at all: every missed one but the last, which `ei` services late. */
export function clipFrozenFrames(bytes: number): number {
  return Math.max(0, clipMissedVBlanks(bytes) - 1);
}
