// Cartridge TM/HM tables. No runtime item or teaching behavior in checkpoint-01.
// pret engine/items/tms.asm, data/moves/tmhm_moves.asm,
// engine/items/tm_prices.asm and data/items/tm_prices.asm.
import type { BinaryReader } from '../binary_reader';
import { NUM_MOVES, TECHNICAL_MACHINES, TECHNICAL_MACHINE_PRICES } from '../rom_offsets';

export interface MachineData {
  /** TM01-TM50, HM01-HM05; raw move IDs from TechnicalMachines. */
  moves: number[];
  /** TM01-TM50 prices in thousands; HMs have no price entry. */
  prices: number[];
}

const NUM_TMS = 50;
const NUM_HMS = 5;

export function extractMachines(rom: BinaryReader): MachineData {
  const rawMoves = rom.readBytes(TECHNICAL_MACHINES, NUM_TMS + NUM_HMS + 1);
  if (rawMoves.length !== NUM_TMS + NUM_HMS + 1 || rawMoves[NUM_TMS + NUM_HMS] !== 0xff)
    throw new Error('TechnicalMachines: missing terminator');
  const moves = [...rawMoves.slice(0, NUM_TMS + NUM_HMS)];
  if (moves.some(id => id < 1 || id > NUM_MOVES))
    throw new Error('TechnicalMachines: invalid move ID');

  const packedPrices = rom.readBytes(TECHNICAL_MACHINE_PRICES, NUM_TMS / 2);
  if (packedPrices.length !== NUM_TMS / 2)
    throw new Error('TechnicalMachinePrices: truncated table');
  // nybble_array stores the first TM in the high nybble of each pair. In
  // GetMachinePrice the odd item index is swapped before the high-nybble mask.
  const prices = [...packedPrices].flatMap(byte => [byte >> 4, byte & 0x0f]);
  if (prices.some(price => price < 1 || price > 5))
    throw new Error('TechnicalMachinePrices: invalid price');
  return { moves, prices };
}
