// NES inventory model mirroring RAM layout $0656-$067E (Variables.inc)

export const SELECTABLE_SLOT_COUNT = 9;

export class Inventory {
  // $0656 SelectedItemSlot (0-8)
  selectedBSlot = 0;

  // Graded items
  sword = 0;      // $0657: 0=none, 1=wood, 2=white, 3=magic
  arrow = 0;      // $0659: 0=none, 1=wood, 2=silver
  candle = 0;     // $065B: 0=none, 1=blue, 2=red
  ring = 0;       // $0662: 0=none, 1=blue, 2=red
  potion = 0;     // $065E: 0=none, 1=blue(2 uses), 2=red(1 use)
  letter = 0;     // $0666: 0=none, 1=have, 2=used/delivered

  // Boolean items — separate wood/magic boomerang per NES ($0674/$0675)
  woodBoomerang = false;
  magicBoomerang = false;
  bow = false;        // $065A
  flute = false;      // (stored in $065C area)
  food = false;       // $065D
  wand = false;       // $065F (magic rod)
  raft = false;       // $0660
  book = false;       // $0661
  ladder = false;     // $0663
  magicKey = false;   // $0664
  bracelet = false;   // $0665
  magicShield = false; // $0676

  // Per-dungeon bitmasks
  compass = 0;    // $0667: bits 0-7 for levels 1-8
  map = 0;        // $0668
  compass9 = false; // $0669
  map9 = false;     // $066A
  triforce = 0;     // $0671: bits 0-7

  // Z_05.asm FindAndSelectOccupiedItemSlot: checks if a selectable slot is occupied
  hasSelectableItem(slot: number): boolean {
    switch (slot) {
      case 0: return this.woodBoomerang || this.magicBoomerang;
      case 1: return true; // bombs always "selectable" if you have any
      case 2: return this.bow && this.arrow > 0;
      case 3: return false; // bow is never independently selectable
      case 4: return this.candle > 0;
      case 5: return this.flute;
      case 6: return this.food;
      case 7: return this.potion > 0 || this.letter >= 1;
      case 8: return this.wand;
      default: return false;
    }
  }

  // Maps selectedBSlot to NES item ID for HUD B-slot sprite
  getEquippedBItemId(): number | null {
    if (!this.hasSelectableItem(this.selectedBSlot)) return null;
    switch (this.selectedBSlot) {
      case 0: return this.magicBoomerang ? 0x1e : 0x1d;
      case 1: return 0x00; // bomb
      case 2: return this.arrow >= 2 ? 0x09 : 0x08;
      case 3: return 0x0a; // bow (shouldn't be selected)
      case 4: return this.candle >= 2 ? 0x07 : 0x06;
      case 5: return 0x05; // flute
      case 6: return 0x04; // food/bait
      case 7:
        if (this.potion > 0) return this.potion >= 2 ? 0x20 : 0x1f;
        return 0x15; // letter fallback
      case 8: return 0x10; // wand
      default: return null;
    }
  }

  // NES item ID for A-slot (sword) sprite
  getSwordItemId(): number | null {
    if (this.sword <= 0) return null;
    return this.sword; // 1=wood(0x01), 2=white(0x02), 3=magic(0x03)
  }
}
