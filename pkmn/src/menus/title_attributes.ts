// BGMapAttributes_TitleScreen (data/cgb/bg_map_attributes.asm), 2f:5de0. On CGB, SET_PAL_TITLE_SCREEN's block
// packet is not interpreted: LoadBGMapAttributes (engine/gfx/bg_map_attributes.asm) copies this table by VRAM DMA.
// The first 576 bytes after the 16-byte header go to vBGMap0's attributes; the header's word ($024d), added to the
// pointer three bytes in, selects the second block (+$250) for vBGMap1's. Each block is 18 rows of 32.

export const TITLE_ATTRIBUTE_ROM_OFFSET = 0x2f * 0x4000 + (0x5de0 - 0x4000);

/** Count $23 means (n + 1) × 16 = 576 bytes per map. The word is the vBGMap1 block's displacement. */
export const TITLE_ATTRIBUTE_HEADER: readonly number[] = [
  0x23, 0x4d, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

function row(cells: readonly number[]): number[] {
  if (cells.length !== 20) throw new Error('title attribute row must cover the visible 20 columns');
  return [...cells, ...Array<number>(12).fill(0)];
}

const logo = row(Array<number>(20).fill(0));
const pikachu = row(Array<number>(20).fill(2));
/** Row 8: the speech bubble's tail at columns 9–10 keeps the logo's palette (BlkPacket_Titlescreen's third block). */
const tail = row([...Array<number>(9).fill(2), 0, 0, ...Array<number>(9).fill(2)]);

/** vBGMap0: the logo rows on palette 0 (LOGO2), Pikachu and the copyright on palette 2 (MEWMON). */
export const TITLE_BG0_ATTRIBUTES: readonly number[] = [...Array<number[]>(8).fill(logo), tail, ...Array<number[]>(9).fill(pikachu)].flat();
/** vBGMap1 (the window): palette 2 throughout, with the same tail cells on its row 8. */
export const TITLE_BG1_ATTRIBUTES: readonly number[] = [...Array<number[]>(8).fill(pikachu), tail, ...Array<number[]>(9).fill(pikachu)].flat();

if (TITLE_BG0_ATTRIBUTES.length !== 18 * 32 || TITLE_BG1_ATTRIBUTES.length !== 18 * 32) {
  throw new Error('title attribute maps must be 18 rows by 32 columns');
}
