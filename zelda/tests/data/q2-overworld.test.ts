import { describe, it, expect } from 'vitest';
import q2Json from '../../src/data/q2-overworld.json';
import type { Q2OverworldData } from '../../src/data/q2-overworld-types.js';

const data = q2Json as Q2OverworldData;

const override = (screen: number) =>
  data.screenOverrides.find(o => o.screen === screen);

describe('Q2 overworld patches — Z_06.asm:239 @PatchQ2Rooms', () => {
  it('has all 15 attribute writes', () => {
    expect(data.patches).toHaveLength(15);
  });

  it('writes 8 bytes sourced from the AttrsB replacement tables', () => {
    // 8 table-driven writes, but one of them lands in AttrsC (see below).
    const tableDriven = data.patches.filter(p => p.table === 'B' || p.table === 'C');
    expect(tableDriven).toHaveLength(8);
  });

  it('keeps every patch inside the 128-screen range', () => {
    for (const patch of data.patches) {
      expect(patch.screen).toBeGreaterThanOrEqual(0);
      expect(patch.screen).toBeLessThan(128);
    }
  });

  // Offset $8B (139) overruns the 128-byte AttrsB plane. AttrsB ($68FE) and AttrsC
  // ($697E) are contiguous, so the write lands on AttrsC + 11 — screen 11's monster
  // list, not an AttrsB screen. This is original-ROM behaviour, not a bug to fix.
  it('remaps the $8B overrun onto AttrsC screen 11', () => {
    const attrsC = data.patches.filter(p => p.table === 'C');
    expect(attrsC).toHaveLength(1);
    expect(attrsC[0]).toEqual({ table: 'C', screen: 11, value: 0x2F });
    expect(override(11)?.monsterListId).toBe(0x2F & 0x3F);
  });
});

describe('Q2 overworld patches — decoded screen overrides', () => {
  // Cave index = (AttrsB & $FC) >> 2; values 1-9 are dungeon entrances
  // (Z_05.asm:7369 HandleWarpOW). This is how dungeons 2, 3 and 4 move in Quest 2.
  it('moves dungeon entrances to screens 52, 60 and 69', () => {
    expect(override(52)?.caveIndex).toBe(3);
    expect(override(60)?.caveIndex).toBe(2);
    expect(override(69)?.caveIndex).toBe(4);
    for (const screen of [52, 60, 69]) {
      expect(override(screen)?.isDungeon).toBe(true);
    }
  });

  it('leaves the remaining AttrsB screens as caves', () => {
    for (const screen of [14, 15, 34, 116]) {
      const o = override(screen);
      expect(o?.isDungeon).toBe(false);
      expect(o!.caveIndex!).toBeGreaterThanOrEqual(16);
    }
  });

  it('decodes AttrsD tile-layout changes', () => {
    expect(override(11)?.uniqueRoomId).toBe(59);
    expect(override(60)?.uniqueRoomId).toBe(59);
    expect(override(116)?.uniqueRoomId).toBe(26);
    // $7B and $5A both have bit 6 set, so all three screens gain a push block.
    expect(override(11)?.pushBlock).toBe(true);
    expect(override(116)?.pushBlock).toBe(true);
  });

  it('decodes AttrsF secret bits for screens 60 and 116', () => {
    // Both become questSecret 0 ("visible in both quests"), which L2a4 must apply
    // on top of secrets.json's questSecretByScreen.
    expect(override(60)?.questSecret).toBe(0);
    expect(override(116)?.questSecret).toBe(0);
    expect(override(60)?.secretTrigger).toBe(1);
    expect(override(116)?.secretTrigger).toBe(0);
  });

  it('lists screen overrides in ascending screen order', () => {
    const screens = data.screenOverrides.map(o => o.screen);
    expect(screens).toEqual([...screens].sort((a, b) => a - b));
  });
});
