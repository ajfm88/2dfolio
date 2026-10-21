// BGMapAttributes_Battle (data/cgb/bg_map_attributes.asm). Both BG maps copy this one block.
// File offset of the 2f:6960 symbol: bank 0x2f, address 0x6960.

export const BATTLE_ATTRIBUTE_ROM_OFFSET = 0x2f * 0x4000 + (0x6960 - 0x4000);

/** 16-byte header. Count $23 means (n+1) × 16 = 576 bytes. The word is the BG1 source displacement. */
export const BATTLE_ATTRIBUTE_HEADER: readonly number[] = [
  0x23, 0x0d, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

function row(cells: readonly number[]): number[] {
  if (cells.length !== 20) throw new Error('battle attribute row must cover the visible 20 columns');
  return [...cells, ...Array<number>(12).fill(0)];
}

const enemy = row([0, ...Array<number>(10).fill(1), ...Array<number>(9).fill(3)]);
const pics = row([...Array<number>(9).fill(2), 0, 0, ...Array<number>(9).fill(3)]);
const player = row([...Array<number>(9).fill(2), ...Array<number>(11).fill(0)]);
const text = row(Array<number>(20).fill(2));

/** 18 × 32. Columns 20–31 are the cleared off-screen cells. Visible cells match note 66 §2.3. */
export const BATTLE_BG_ATTRIBUTES: readonly number[] = [
  ...Array<number[]>(4).fill(enemy),
  ...Array<number[]>(3).fill(pics),
  ...Array<number[]>(5).fill(player),
  ...Array<number[]>(6).fill(text),
].flat();

if (BATTLE_BG_ATTRIBUTES.length !== 18 * 32) throw new Error('battle attribute map must be 18 rows by 32 columns');
