// NES-faithful item drop algorithm from Z_04.asm SetUpDroppedItem
import type { DropTables } from '../../data/item-types.js';

export class DropEngine {
  private worldKillCycle = 0;        // 0-9, mod 10 ($052A)
  private consecutiveNonDrops = 0;   // help drop counter ($0050)
  private totalKillCount = 0;        // kills since last drop ($0627)

  // Called when an enemy dies. Returns NES item ID to drop, or null.
  rollDrop(enemyType: number, tables: DropTables): number | null {
    // Step 1: no-drop list (Z_04.asm NoDropMonsterTypes)
    if (tables.noDropMonsterTypes.includes(enemyType)) return null;

    // Step 2: determine drop group (0-3)
    let group = 3;
    for (let g = 0; g < tables.dropItemMonsterTypes.length; g++) {
      if (tables.dropItemMonsterTypes[g]?.includes(enemyType)) {
        group = g;
        break;
      }
    }

    // Advance kill cycle (mod 10) per Z_07.asm UpdateMetaObjectEnd
    const col = this.worldKillCycle;
    this.worldKillCycle = (this.worldKillCycle + 1) % 10;

    this.totalKillCount++;

    // Step 3: help drop — 16 kills forces fairy
    if (this.totalKillCount >= 16) {
      this.totalKillCount = 0;
      this.consecutiveNonDrops = 0;
      return 0x23; // fairy
    }

    // Step 4: random vs drop rate (Z_04.asm)
    const rate = tables.dropItemRates[group];
    if (rate === undefined) return null;
    const rng = Math.floor(Math.random() * 256);

    if (rng >= rate) {
      this.consecutiveNonDrops++;
      // Step 5: help drop — 10 consecutive non-drops
      if (this.consecutiveNonDrops >= 10) {
        this.consecutiveNonDrops = 0;
        // NES: HelpDropValue alternates 0 (5 rupees) and non-zero (bomb)
        return (col & 1) ? 0x00 : 0x0f;
      }
      return null;
    }

    // Step 6: look up the drop table
    const table = tables.dropItemTable[group];
    if (!table) return null;
    const itemId = table[col];
    if (itemId === undefined) return null;

    this.consecutiveNonDrops = 0;
    return itemId;
  }

  reset(): void {
    this.worldKillCycle = 0;
    this.consecutiveNonDrops = 0;
    this.totalKillCount = 0;
  }
}
