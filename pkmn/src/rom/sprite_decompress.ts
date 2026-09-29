// Gen 1 Pokemon sprite decompression
// Faithfully ported from home/uncompress.asm
//
// Gen 1 sprites are stored as compressed 1bpp data in two chunks (one per bitplane).
// The decompressor reads a bitstream, supports RLE for zero runs, and applies
// delta decoding and/or XOR post-processing depending on the "unpack mode".

import { BinaryReader } from './binary_reader';

// ── Bit-level input stream ──────────────────────────────────────

class BitReader {
  private rom: BinaryReader;
  private offset: number;
  private currentByte = 0;
  private bitsRemaining = 0;

  constructor(rom: BinaryReader, offset: number) {
    this.rom = rom;
    this.offset = offset;
  }

  /** Read the next full byte from the stream (used for the header byte). */
  readByte(): number {
    const b = this.rom.readByte(this.offset);
    this.offset++;
    this.bitsRemaining = 0;
    return b;
  }

  /** Read a single bit from the stream (MSB first within each byte). */
  readBit(): number {
    if (this.bitsRemaining === 0) {
      this.currentByte = this.rom.readByte(this.offset);
      this.offset++;
      this.bitsRemaining = 8;
    }
    this.bitsRemaining--;
    const bit = (this.currentByte >> 7) & 1;
    this.currentByte = (this.currentByte << 1) & 0xFF;
    return bit;
  }
}

// ── Length encoding offset table ────────────────────────────────
// LengthEncodingOffsetList: the nth entry is (2^n) - 1 + 1 = 2^n
// Wait — assembly says "dw %0000000000000001" for entry 0.
// That's 1 = 2^0. Entry 1 is 3 = 2^1 + 1. Actually 2^(n+1) - 1.
// No: entry 0 = 1, entry 1 = 3, entry 2 = 7. These are 2^(n+1) - 1.
// But indexing starts at 0 consecutive ones. After 0 ones (just the terminating 0),
// we read 1 bit. The offset is 1. So minimum run length = 1 + 0 = 1.
// After 1 one, we read 2 bits. Offset = 3. So range is 3..6.
// This gives unique representation of all positive integers.
const LENGTH_ENCODING_OFFSETS = [
  1, 3, 7, 0xF,
  0x1F, 0x3F, 0x7F, 0xFF,
  0x1FF, 0x3FF, 0x7FF, 0xFFF,
  0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF,
];

// ── Delta decode tables (not flipped) ───────────────────────────
// DecodeNybble0Table: used when last decoded value has bit0 = 0
// DecodeNybble1Table: used when last decoded value has bit0 = 1
// Each entry byte: high nybble = result for even input, low nybble = result for odd input
const DECODE_NYBBLE_0_TABLE = [0x01, 0x32, 0x76, 0x45, 0xFE, 0xCD, 0x89, 0xBA];
const DECODE_NYBBLE_1_TABLE = [0xFE, 0xCD, 0x89, 0xBA, 0x01, 0x32, 0x76, 0x45];

// ── Main export ─────────────────────────────────────────────────

/**
 * Decompress a Gen 1 Pokemon sprite from ROM.
 *
 * @param rom BinaryReader for the ROM
 * @param offset ROM file offset where the compressed sprite data begins
 * @returns width/height in pixels, and row-major 2bpp tile data
 */
export function decompressSprite(
  rom: BinaryReader,
  offset: number,
): { width: number; height: number; tiles2bpp: Uint8Array } {
  const bits = new BitReader(rom, offset);

  // Step 1: Header byte — high nybble = width in tiles, low nybble = height in tiles
  const header = bits.readByte();
  const heightTiles = header & 0x0F;
  const widthTiles = (header >> 4) & 0x0F;
  const widthPixels = widthTiles * 8;
  const heightPixels = heightTiles * 8;

  const bufferSize = widthTiles * heightPixels;
  const buffer1 = new Uint8Array(bufferSize);
  const buffer2 = new Uint8Array(bufferSize);

  // Step 2: Initial bit determines which buffer gets the first chunk
  //   bit=0: first chunk → buffer1, second → buffer2
  //   bit=1: first chunk → buffer2, second → buffer1
  const initialBit = bits.readBit();
  const firstBuffer = initialBit === 0 ? buffer1 : buffer2;
  const secondBuffer = initialBit === 0 ? buffer2 : buffer1;

  // Step 3: Decompress first chunk
  decompressChunk(bits, firstBuffer, widthPixels, heightPixels);

  // Step 4: Read unpack mode (between the two chunks)
  //   0   → mode 0
  //   1 0 → mode 1
  //   1 1 → mode 2
  const modeBit0 = bits.readBit();
  let unpackMode: number;
  if (modeBit0 === 0) {
    unpackMode = 0;
  } else {
    const modeBit1 = bits.readBit();
    unpackMode = modeBit1 + 1;
  }

  // Step 5: Decompress second chunk
  decompressChunk(bits, secondBuffer, widthPixels, heightPixels);

  // Step 6: Post-processing based on unpack mode
  applyUnpackMode(unpackMode, initialBit, buffer1, buffer2, widthTiles, heightPixels);

  // Step 7: Convert column-major 1bpp buffers to row-major 2bpp tile data
  const tiles2bpp = interleaveBuffers(buffer1, buffer2, widthTiles, heightTiles);

  return { width: widthPixels, height: heightPixels, tiles2bpp };
}

// ── Chunk decompression ─────────────────────────────────────────

/**
 * Decompress one 1bpp chunk from the bitstream into a buffer.
 * Data is written 2 bits at a time, column-major, with 4 bit-offset passes per column.
 */
function decompressChunk(
  bits: BitReader,
  buffer: Uint8Array,
  widthPixels: number,
  heightPixels: number,
): void {
  // State matching assembly wram variables
  let curPosY = 0;      // row within current column
  let curPosX = 0;      // column position in pixels (increments by 8)
  let bitOffset = 3;    // 3→2→1→0 per column, then wraps to 3
  let outputPtr = 0;    // current write position in buffer
  let outputPtrCached = 0; // start of current column

  /** Write 2 bits at the current position and bit offset. */
  function writeBits(value: number): void {
    let shifted: number;
    switch (bitOffset) {
      case 3: // rrc e; rrc e — bits to positions 7-6
        shifted = ((value << 6) | (value >> 2)) & 0xFF;
        break;
      case 2: // swap e — bits to positions 5-4
        shifted = (value << 4) & 0xFF;
        break;
      case 1: // sla e; sla e — bits to positions 3-2
        shifted = (value << 2) & 0xFF;
        break;
      default: // offset 0 — bits stay at positions 1-0
        shifted = value & 0x03;
        break;
    }
    buffer[outputPtr] |= shifted;
  }

  /** Advance to the next write position. Returns false if chunk is complete. */
  function moveToNext(): boolean {
    curPosY++;
    if (curPosY < heightPixels) {
      outputPtr++;
      return true;
    }

    // Current column done for this bit offset
    curPosY = 0;

    if (bitOffset > 0) {
      bitOffset--;
      outputPtr = outputPtrCached;
      return true;
    }

    // All 4 bit offsets done for this column
    bitOffset = 3;
    curPosX += 8;

    if (curPosX >= widthPixels) {
      return false; // all columns done
    }

    // Advance to next column (assembly does: inc hl then StoreSpriteOutputPointer)
    outputPtr = outputPtrCached + heightPixels;
    outputPtrCached = outputPtr;
    return true;
  }

  // Main decompression loop
  const firstBit = bits.readBit();
  let readingData = firstBit === 1;

  for (;;) {
    if (readingData) {
      // Read pairs of non-zero data bits until 00
      for (;;) {
        const bit1 = bits.readBit();
        const bit0 = bits.readBit();
        const value = (bit1 << 1) | bit0;

        if (value === 0) {
          readingData = false;
          break;
        }

        writeBits(value);
        if (!moveToNext()) return;
      }
    }

    // Read RLE-encoded zero run
    // Count consecutive 1-bits to determine the length field width
    let consecutiveOnes = 0;
    while (bits.readBit() === 1) {
      consecutiveOnes++;
    }

    const lengthOffset = LENGTH_ENCODING_OFFSETS[consecutiveOnes];

    // Read (consecutiveOnes + 1) bits as the count
    const numBits = consecutiveOnes + 1;
    let count = 0;
    for (let i = 0; i < numBits; i++) {
      count = (count << 1) | bits.readBit();
    }

    let totalZeros = count + lengthOffset;

    while (totalZeros > 0) {
      writeBits(0);
      if (!moveToNext()) return;
      totalZeros--;
    }

    readingData = true;
  }
}

// ── Delta (differential) decoding ───────────────────────────────

/**
 * Delta-decode a buffer in place (not-flipped variant).
 *
 * Traverses the buffer in the same order as SpriteDifferentialDecode:
 * for each row (0..heightPixels-1), process each column (0..widthTiles-1).
 * The column stride is heightPixels.
 *
 * For each byte: decode high nybble, then low nybble.
 * The last decoded value resets to 0 at each new row.
 */
function deltaDecode(
  buffer: Uint8Array,
  widthTiles: number,
  heightPixels: number,
): void {
  let lastDecoded = 0;

  for (let row = 0; row < heightPixels; row++) {
    for (let col = 0; col < widthTiles; col++) {
      const idx = col * heightPixels + row;
      const byte = buffer[idx];

      const highIn = (byte >> 4) & 0x0F;
      const decodedHigh = decodeDeltaNybble(highIn, lastDecoded);
      lastDecoded = decodedHigh;

      const lowIn = byte & 0x0F;
      const decodedLow = decodeDeltaNybble(lowIn, lastDecoded);
      lastDecoded = decodedLow;

      buffer[idx] = (decodedHigh << 4) | decodedLow;
    }

    lastDecoded = 0;
  }
}

/**
 * Decode a single nybble using differential decode tables (not-flipped).
 * Matches DifferentialDecodeNybble in assembly.
 */
function decodeDeltaNybble(input: number, lastDecoded: number): number {
  const tableIndex = input >> 1;
  const selectLow = input & 1;

  // Choose table based on bit 0 of last decoded value
  const table = (lastDecoded & 1) === 0
    ? DECODE_NYBBLE_0_TABLE
    : DECODE_NYBBLE_1_TABLE;

  const entry = table[tableIndex];

  // Even input (selectLow=0) → high nybble; odd input → low nybble
  return selectLow === 0
    ? (entry >> 4) & 0x0F
    : entry & 0x0F;
}

// ── Unpack modes ────────────────────────────────────────────────

/**
 * Apply post-processing based on unpack mode and initial bit.
 *
 * After both chunks, wSpriteLoadFlags bit0 = initialBit XOR 1
 * (flipped once between chunks, not flipped back).
 *
 * ResetSpriteBufferPointers checks bit0:
 *   bit0=0 → output=buffer2, cached=buffer1
 *   bit0=1 → output=buffer1, cached=buffer2
 *
 * So: initialBit=0 → bit0=1 → output=buffer1, cached=buffer2
 *     initialBit=1 → bit0=0 → output=buffer2, cached=buffer1
 *
 * Mode 0: delta(buffer1), delta(buffer2)
 * Mode 1: delta(output), cached ^= output
 * Mode 2: delta(cached), delta(output), cached ^= output
 */
function applyUnpackMode(
  mode: number,
  initialBit: number,
  buffer1: Uint8Array,
  buffer2: Uint8Array,
  widthTiles: number,
  heightPixels: number,
): void {
  // Determine output/cached based on flag state after decompression
  const output = initialBit === 0 ? buffer1 : buffer2;
  const cached = initialBit === 0 ? buffer2 : buffer1;

  if (mode === 0) {
    deltaDecode(buffer1, widthTiles, heightPixels);
    deltaDecode(buffer2, widthTiles, heightPixels);
  } else if (mode === 1) {
    deltaDecode(output, widthTiles, heightPixels);
    xorBuffers(cached, output);
  } else {
    // Mode 2
    deltaDecode(cached, widthTiles, heightPixels);
    deltaDecode(output, widthTiles, heightPixels);
    xorBuffers(cached, output);
  }
}

/** XOR dest buffer with source buffer: dest[i] ^= source[i] */
function xorBuffers(dest: Uint8Array, source: Uint8Array): void {
  for (let i = 0; i < dest.length; i++) {
    dest[i] ^= source[i];
  }
}

// ── Buffer interleaving ─────────────────────────────────────────

/**
 * Convert two column-major 1bpp buffers into row-major 2bpp tile data.
 * buffer1 = low bitplane, buffer2 = high bitplane.
 *
 * Column-major layout: column c has bytes [c*h .. c*h + h-1], h = heightPixels.
 * Each byte = one row of 8 pixels in 1bpp.
 *
 * Row-major 2bpp: tiles left-to-right, top-to-bottom.
 * Each tile = 16 bytes (8 rows x 2 bytes: low plane, high plane).
 */
function interleaveBuffers(
  buffer1: Uint8Array,
  buffer2: Uint8Array,
  widthTiles: number,
  heightTiles: number,
): Uint8Array {
  const heightPixels = heightTiles * 8;
  const totalTiles = widthTiles * heightTiles;
  const result = new Uint8Array(totalTiles * 16);

  for (let tileY = 0; tileY < heightTiles; tileY++) {
    for (let tileX = 0; tileX < widthTiles; tileX++) {
      const tileIndex = tileY * widthTiles + tileX;
      const tileBase = tileIndex * 16;

      for (let row = 0; row < 8; row++) {
        const bufIdx = tileX * heightPixels + tileY * 8 + row;
        result[tileBase + row * 2] = buffer1[bufIdx];
        result[tileBase + row * 2 + 1] = buffer2[bufIdx];
      }
    }
  }

  return result;
}
