// Low-level binary reader for Pokemon Yellow ROM

export class BinaryReader {
  private view: DataView;
  private bytes: Uint8Array;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  get length(): number {
    return this.bytes.length;
  }

  readByte(offset: number): number {
    return this.bytes[offset];
  }

  readWord(offset: number): number {
    // Little-endian 16-bit (Z80 convention)
    return this.view.getUint16(offset, true);
  }

  readWordBE(offset: number): number {
    // Big-endian 16-bit (used by tempo command)
    return this.view.getUint16(offset, false);
  }

  readBytes(offset: number, length: number): Uint8Array {
    return this.bytes.slice(offset, offset + length);
  }

  readSignedByte(offset: number): number {
    return this.view.getInt8(offset);
  }

  /** Resolve a bank:address pointer pair to a ROM file offset */
  resolvePointer(bank: number, addr: number): number {
    return bank * 0x4000 + (addr & 0x3FFF);
  }

  /** Read a 2-byte pointer at the given offset and resolve it with the given bank */
  readPointer(offset: number, bank: number): number {
    const addr = this.readWord(offset);
    return this.resolvePointer(bank, addr);
  }
}

/** Compute SHA1 hash of an ArrayBuffer using Web Crypto API */
export async function sha1(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
