import machineData from '../data/machine_data.json';
import compatibility from '../data/machine_compatibility.json';

/** Cartridge CanLearnTM: dex ID and move ID, not internal species or item IDs. */
export function canLearnTM(dex: number, moveId: number): boolean {
  if (!Number.isInteger(dex) || dex < 1 || dex >= compatibility.length ||
      !Number.isInteger(moveId) || moveId < 1 || moveId > 165) return false;
  const index = machineData.moves.indexOf(moveId);
  const bytes = compatibility[dex];
  return index >= 0 && bytes !== null && (bytes[index >> 3] & (1 << (index & 7))) !== 0;
}
