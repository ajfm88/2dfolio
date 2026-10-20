// Literal ROM tables, symbols 1c:4be8, 4dd7, 4e09, 4e74..4ea4.
// ROM-only tests guard these constants; no runtime ROM import or generated asset.
export const FLASH_SCREEN_PALETTES = [0xf9, 0xfe, 0xff, 0xfe, 0xf9, 0xe4, 0x90, 0x40, 0, 0x40, 0x90, 0xe4, 1] as const;
export const CIRCLE_DATA = [
  [2, 3, 5, 4, 9, 255],
  [1, 1, 2, 2, 4, 2, 4, 2, 3, 255],
  [2, 1, 3, 1, 4, 1, 4, 1, 4, 1, 3, 1, 2, 1, 1, 1, 1, 255],
  [4, 1, 4, 0, 3, 1, 3, 0, 2, 1, 2, 0, 1, 255],
  [4, 0, 3, 0, 3, 0, 2, 0, 2, 0, 1, 0, 1, 0, 1, 255],
] as const;
export type HalfCircleEntry = readonly [quadrantX: 0 | 1, data: number, x: number, y: number];
export const HALF_CIRCLE_1: readonly HalfCircleEntry[] = [
  [1, 0, 18, 6], [1, 1, 19, 3], [1, 2, 18, 0], [1, 3, 14, 0], [1, 4, 10, 0],
  [0, 4, 9, 0], [0, 3, 5, 0], [0, 2, 1, 0], [0, 1, 0, 3], [0, 0, 1, 6],
];
export const HALF_CIRCLE_2: readonly HalfCircleEntry[] = [
  [0, 0, 1, 11], [0, 1, 0, 14], [0, 2, 1, 17], [0, 3, 5, 17], [0, 4, 9, 17],
  [1, 4, 10, 17], [1, 3, 14, 17], [1, 2, 18, 17], [1, 1, 19, 14], [1, 0, 18, 11],
];
