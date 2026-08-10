import { describe, it, expect } from 'vitest';
import spritesJson from '../../src/data/sprites.json';
import type { SpriteData } from '../../src/data/sprite-types.js';

const data = spritesJson as SpriteData;

describe('Sprite data — core animation tables', () => {
  it('objAnimations has 127 entries', () => {
    expect(data.coreAnimation.objAnimations).toHaveLength(127);
  });

  it('objAnimFrameHeap has 204 entries', () => {
    expect(data.coreAnimation.objAnimFrameHeap).toHaveLength(204);
  });

  it('objAnimAttrHeap has 204 entries', () => {
    expect(data.coreAnimation.objAnimAttrHeap).toHaveLength(204);
  });

  it('frame and attr heaps have the same length', () => {
    expect(data.coreAnimation.objAnimFrameHeap.length)
      .toBe(data.coreAnimation.objAnimAttrHeap.length);
  });

  it('all objAnimations values are in range 0-255', () => {
    for (const val of data.coreAnimation.objAnimations) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it('all heap values are in range 0-255', () => {
    for (const val of data.coreAnimation.objAnimFrameHeap) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
    for (const val of data.coreAnimation.objAnimAttrHeap) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it('spot-check: Link walking base = 0, Link attacking base = 8', () => {
    expect(data.coreAnimation.objAnimations[0]).toBe(0x00);
    expect(data.coreAnimation.objAnimations[1]).toBe(0x08);
  });

  it('walkingAnimCounterReset is 6', () => {
    expect(data.coreAnimation.walkingAnimCounterReset).toBe(6);
  });
});

describe('Sprite data — objectTypeToAttributes', () => {
  it('has 95 entries', () => {
    expect(data.objectTypeToAttributes).toHaveLength(95);
  });

  it('all values are in range 0-255', () => {
    for (const val of data.objectTypeToAttributes) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it('index 0 (Link/None) is 0xFF', () => {
    expect(data.objectTypeToAttributes[0]).toBe(0xFF);
  });
});

describe('Sprite data — sprite system', () => {
  it('spriteOffsets has 41 entries', () => {
    expect(data.spriteSystem.spriteOffsets).toHaveLength(41);
  });

  it('spriteOffsets[0] is 0x60', () => {
    expect(data.spriteSystem.spriteOffsets[0]).toBe(0x60);
  });

  it('spriteRelativeExtents is [8, 0]', () => {
    expect(data.spriteSystem.spriteRelativeExtents).toEqual([0x08, 0x00]);
  });
});

describe('Sprite data — Link sprites', () => {
  it('headTiles matches disassembly', () => {
    expect(data.link.headTiles).toEqual([0x02, 0x06, 0x08, 0x0A]);
  });

  it('headMagicShieldTiles matches disassembly', () => {
    expect(data.link.headMagicShieldTiles).toEqual([0x80, 0x54, 0x60, 0x60]);
  });
});

describe('Sprite data — item sprites', () => {
  it('frameOffsets has 37 entries', () => {
    expect(data.items.frameOffsets).toHaveLength(37);
  });

  it('frameTiles has 48 entries', () => {
    expect(data.items.frameTiles).toHaveLength(48);
  });

  it('slotToPaletteOffsetsOrValues has 32 entries', () => {
    expect(data.items.slotToPaletteOffsetsOrValues).toHaveLength(32);
  });

  it('frameTiles[0] is 0x20 (wooden sword tile)', () => {
    expect(data.items.frameTiles[0]).toBe(0x20);
  });

  it('all frameOffsets values are valid indices into frameTiles', () => {
    for (const val of data.items.frameOffsets) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(data.items.frameTiles.length);
    }
  });
});

describe('Sprite data — weapon sprites', () => {
  it('rDirectionToWeaponFrame matches disassembly', () => {
    expect(data.weapons.rDirectionToWeaponFrame).toEqual([0x00, 0x00, 0x01, 0x01]);
  });

  it('rDirectionToWeaponBaseAttribute matches disassembly', () => {
    expect(data.weapons.rDirectionToWeaponBaseAttribute).toEqual([0x00, 0x80, 0x00, 0x00]);
  });

  it('rDirectionToOffsetsX has 4 entries', () => {
    expect(data.weapons.rDirectionToOffsetsX).toHaveLength(4);
  });

  it('rDirectionToOffsetsY has 4 entries', () => {
    expect(data.weapons.rDirectionToOffsetsY).toHaveLength(4);
  });

  it('playerToWeaponOffsetsX has 16 entries', () => {
    expect(data.weapons.playerToWeaponOffsetsX).toHaveLength(16);
  });

  it('playerToWeaponOffsetsY has 16 entries', () => {
    expect(data.weapons.playerToWeaponOffsetsY).toHaveLength(16);
  });

  it('swordShotSpreadBaseAttr matches disassembly', () => {
    expect(data.weapons.swordShotSpreadBaseAttr).toEqual([0x40, 0xC0, 0x80, 0x00]);
  });
});

describe('Sprite data — boomerang animation', () => {
  it('frameCycle has 9 entries', () => {
    expect(data.boomerang.frameCycle).toHaveLength(9);
  });

  it('baseSpriteAttrCycle has 9 entries', () => {
    expect(data.boomerang.baseSpriteAttrCycle).toHaveLength(9);
  });

  it('frameCycle[8] is 3 (the final unique frame)', () => {
    expect(data.boomerang.frameCycle[8]).toBe(3);
  });

  it('baseSpriteAttrCycle[8] is 1', () => {
    expect(data.boomerang.baseSpriteAttrCycle[8]).toBe(1);
  });
});

describe('Sprite data — bomb cloud offsets', () => {
  it('each offset array has 3 entries', () => {
    expect(data.bombCloud.offsetsY1).toHaveLength(3);
    expect(data.bombCloud.offsetsX1).toHaveLength(3);
    expect(data.bombCloud.offsetsY2).toHaveLength(3);
    expect(data.bombCloud.offsetsX2).toHaveLength(3);
  });

  it('all values are in range 0-255', () => {
    const allOffsets = [
      ...data.bombCloud.offsetsY1, ...data.bombCloud.offsetsX1,
      ...data.bombCloud.offsetsY2, ...data.bombCloud.offsetsX2,
    ];
    for (const val of allOffsets) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });
});

describe('Sprite data — boss: Aquamentus', () => {
  it('tiles has 12 entries (2 frames × 6 tiles)', () => {
    expect(data.bosses.aquamentus.tiles).toHaveLength(12);
  });

  it('spriteOffsetsY has 6 entries', () => {
    expect(data.bosses.aquamentus.spriteOffsetsY).toHaveLength(6);
  });

  it('spriteOffsetsX has 6 entries', () => {
    expect(data.bosses.aquamentus.spriteOffsetsX).toHaveLength(6);
  });

  it('first tile is 0xCC', () => {
    expect(data.bosses.aquamentus.tiles[0]).toBe(0xCC);
  });
});

describe('Sprite data — boss: Dodongo', () => {
  it('all 4 arrays have 10 entries each', () => {
    expect(data.bosses.dodongo.frameImages).toHaveLength(10);
    expect(data.bosses.dodongo.frameHFlips).toHaveLength(10);
    expect(data.bosses.dodongo.frameImagesBloated).toHaveLength(10);
    expect(data.bosses.dodongo.frameHFlipsBloated).toHaveLength(10);
  });
});

describe('Sprite data — boss: Digdogger', () => {
  it('each array has 4 entries', () => {
    expect(data.bosses.digdogger.spriteOffsetsX).toHaveLength(4);
    expect(data.bosses.digdogger.spriteOffsetsY).toHaveLength(4);
    expect(data.bosses.digdogger.spriteAttrs).toHaveLength(4);
  });

  it('spriteAttrs matches disassembly', () => {
    expect(data.bosses.digdogger.spriteAttrs).toEqual([0x03, 0x03, 0x83, 0x83]);
  });
});

describe('Sprite data — boss: Gleeok', () => {
  it('body tile arrays have 6 entries each', () => {
    expect(data.bosses.gleeok.bodyTiles0).toHaveLength(6);
    expect(data.bosses.gleeok.bodyTiles1).toHaveLength(6);
    expect(data.bosses.gleeok.bodyTiles2).toHaveLength(6);
  });

  it('bodyBaseTileOffsets has 4 entries', () => {
    expect(data.bosses.gleeok.bodyBaseTileOffsets).toHaveLength(4);
  });

  it('bodyBaseTileOffsets matches disassembly', () => {
    expect(data.bosses.gleeok.bodyBaseTileOffsets).toEqual([0x06, 0x00, 0x06, 0x0C]);
  });
});

describe('Sprite data — boss: Ganon', () => {
  it('frameImages has 24 entries (6 frames × 4 body parts)', () => {
    expect(data.bosses.ganon.frameImages).toHaveLength(24);
  });

  it('spriteOffsetsX and Y have 4 entries each', () => {
    expect(data.bosses.ganon.spriteOffsetsX).toHaveLength(4);
    expect(data.bosses.ganon.spriteOffsetsY).toHaveLength(4);
  });

  it('spriteHFlips has 4 entries', () => {
    expect(data.bosses.ganon.spriteHFlips).toHaveLength(4);
  });

  it('burstDirs has 8 entries', () => {
    expect(data.bosses.ganon.burstDirs).toHaveLength(8);
  });

  it('burstTiles has 10 entries', () => {
    expect(data.bosses.ganon.burstTiles).toHaveLength(10);
  });

  it('burstSpriteAttrs has 10 entries', () => {
    expect(data.bosses.ganon.burstSpriteAttrs).toHaveLength(10);
  });
});

describe('Sprite data — boss: Patra', () => {
  it('childStartAngles has 7 entries', () => {
    expect(data.bosses.patra.childStartAngles).toHaveLength(7);
  });

  it('sines has 16 entries', () => {
    expect(data.bosses.patra.sines).toHaveLength(16);
  });

  it('sines[0] is 0 and sines[8] is 0x80', () => {
    expect(data.bosses.patra.sines[0]).toBe(0x00);
    expect(data.bosses.patra.sines[8]).toBe(0x80);
  });
});

describe('Sprite data — boss: Manhandla', () => {
  it('baseFrameImagesAndAttrs has 5 entries', () => {
    expect(data.bosses.manhandla.baseFrameImagesAndAttrs).toHaveLength(5);
  });

  it('segmentOffsetsX has 2 entries', () => {
    expect(data.bosses.manhandla.segmentOffsetsX).toHaveLength(2);
  });

  it('segmentOffsetsY has 5 entries', () => {
    expect(data.bosses.manhandla.segmentOffsetsY).toHaveLength(5);
  });
});

describe('Sprite data — enemy animation timing', () => {
  it('blueLeeverStateAnimTimes matches disassembly', () => {
    expect(data.enemyAnimTiming.blueLeeverStateAnimTimes)
      .toEqual([0x10, 0x0B, 0x01, 0x05, 0x01, 0x0B]);
  });

  it('redLeeverStateAnimTimes matches disassembly', () => {
    expect(data.enemyAnimTiming.redLeeverStateAnimTimes)
      .toEqual([0x10, 0x08, 0x08, 0x05, 0x08, 0x08]);
  });

  it('wallmaster dirsAndAttrs arrays each have 16 entries', () => {
    expect(data.enemyAnimTiming.wallmaster.dirsAndAttrsLeft).toHaveLength(16);
    expect(data.enemyAnimTiming.wallmaster.dirsAndAttrsRight).toHaveLength(16);
    expect(data.enemyAnimTiming.wallmaster.dirsAndAttrsTop).toHaveLength(16);
    expect(data.enemyAnimTiming.wallmaster.dirsAndAttrsBottom).toHaveLength(16);
  });

  it('wallmaster initialXs matches disassembly', () => {
    expect(data.enemyAnimTiming.wallmaster.initialXs).toEqual([0x00, 0xF0]);
  });

  it('wallmaster initialYs matches disassembly', () => {
    expect(data.enemyAnimTiming.wallmaster.initialYs).toEqual([0x3D, 0xDD]);
  });
});
