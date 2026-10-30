// Unused charmap boundary, separate from battle_bridge to avoid a BattleState/codec import cycle.
import { BattleUnsupportedState } from './battle_move_data';
import { decodeTextByte } from '../rom/extractors/text';

/** pret constants/charmap.asm:5-27,151-190; home/text.asm:49-59. @ terminates, max bounds the buffer.
 * The generic text decoder omits cursor glyphs and aliases F2 to '.', while encodeText uses a distinct DOT glyph.
 * Preserve those font-glyph identities here without changing the shared extractor. NULL is not a name terminator. */
export function decodeBattleText(mem: Uint8Array, addr: number, max = 11): string {
  let result = '';
  for (let i = 0; i < max; i++) {
    const byte = mem[addr + i];
    if (byte === 0x50) break;
    if (byte === 0) throw new BattleUnsupportedState('NULL text control (TextIDErrorText not ported)');
    if (byte === 0xec) result += '▷';
    else if (byte === 0xed) result += '▶';
    else if (byte === 0xee) result += '▼';
    else if (byte === 0xf2) result += '\uE006';
    else result += decodeTextByte(byte, addr + i);
  }
  return result;
}
