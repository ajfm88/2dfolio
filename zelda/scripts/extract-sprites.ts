import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const Z01_ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_01.asm');
const Z04_ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_04.asm');
const Z07_ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_07.asm');
const OUTPUT_PATH = resolve(__dirname, '../src/data/sprites.json');

// --- ASM parsing ---

function parseByteSection(asmText: string, label: string): number[] {
  const lines = asmText.split('\n');
  const bytes: number[] = [];
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === `${label}:` || trimmed.startsWith(`${label}:`)) {
      capturing = true;
      continue;
    }

    if (capturing) {
      if (trimmed.startsWith('.BYTE')) {
        const dataStr = trimmed.slice(5).split(';')[0]!;
        const values = dataStr.split(',').map(v => {
          const s = v.trim();
          if (s.startsWith('$')) return parseInt(s.slice(1), 16);
          return parseInt(s, 10);
        });
        bytes.push(...values);
      } else if (trimmed === '' || trimmed.startsWith(';')) {
        continue;
      } else {
        break;
      }
    }
  }

  return bytes;
}

function extractAndValidate(asm: string, label: string, expectedLength: number): number[] {
  const data = parseByteSection(asm, label);
  if (data.length !== expectedLength) {
    throw new Error(`${label}: expected ${expectedLength} bytes, got ${data.length}`);
  }
  return data;
}

// --- Core animation tables (Z_01.asm) ---

function extractCoreAnimation(z01: string) {
  console.log('Extracting core animation tables from Z_01.asm...');

  const objAnimations = extractAndValidate(z01, 'ObjAnimations', 127);
  const objAnimFrameHeap = extractAndValidate(z01, 'ObjAnimFrameHeap', 204);
  const objAnimAttrHeap = extractAndValidate(z01, 'ObjAnimAttrHeap', 204);

  return {
    objAnimations,
    objAnimFrameHeap,
    objAnimAttrHeap,
    walkingAnimCounterReset: 6,
  };
}

// --- Sprite system metadata (Z_01.asm) ---

function extractSpriteSystem(z01: string) {
  console.log('Extracting sprite system metadata...');

  const spriteOffsets = extractAndValidate(z01, 'SpriteOffsets', 41);
  const spriteRelativeExtents = extractAndValidate(z01, 'SpriteRelativeExtents', 2);

  return { spriteOffsets, spriteRelativeExtents };
}

// --- Object type attributes (Z_07.asm) ---

function extractObjectTypeToAttributes(z07: string): number[] {
  console.log('Extracting ObjectTypeToAttributes from Z_07.asm...');
  return extractAndValidate(z07, 'ObjectTypeToAttributes', 95);
}

// --- Link sprites (Z_07.asm) ---

function extractLinkSprites(z07: string) {
  console.log('Extracting Link sprite tables...');

  const headTiles = extractAndValidate(z07, 'LinkHeadTiles', 4);
  const headMagicShieldTiles = extractAndValidate(z07, 'LinkHeadMagicShieldTiles', 4);

  return { headTiles, headMagicShieldTiles };
}

// --- Item sprite system (Z_01.asm) ---

function extractItemSprites(z01: string) {
  console.log('Extracting item sprite tables...');

  const frameOffsets = extractAndValidate(z01, 'Anim_ItemFrameOffsets', 37);
  const frameTiles = extractAndValidate(z01, 'Anim_ItemFrameTiles', 48);
  const slotToPaletteOffsetsOrValues = extractAndValidate(z01, 'ItemSlotToPaletteOffsetsOrValues', 32);

  return { frameOffsets, frameTiles, slotToPaletteOffsetsOrValues };
}

// --- Weapon/projectile data (Z_07.asm) ---

function extractWeaponSprites(z07: string) {
  console.log('Extracting weapon/projectile tables...');

  const rDirectionToWeaponFrame = extractAndValidate(z07, 'RDirectionToWeaponFrame', 4);
  const rDirectionToWeaponBaseAttribute = extractAndValidate(z07, 'RDirectionToWeaponBaseAttribute', 4);
  const rDirectionToOffsetsX = extractAndValidate(z07, 'RDirectionToOffsetsX', 4);
  const rDirectionToOffsetsY = extractAndValidate(z07, 'RDirectionToOffsetsY', 4);
  const playerToWeaponOffsetsX = extractAndValidate(z07, 'PlayerToWeaponOffsetsX', 16);
  const playerToWeaponOffsetsY = extractAndValidate(z07, 'PlayerToWeaponOffsetsY', 16);
  const swordShotSpreadBaseAttr = extractAndValidate(z07, 'SwordShotSpreadBaseAttr', 4);

  return {
    rDirectionToWeaponFrame,
    rDirectionToWeaponBaseAttribute,
    rDirectionToOffsetsX,
    rDirectionToOffsetsY,
    playerToWeaponOffsetsX,
    playerToWeaponOffsetsY,
    swordShotSpreadBaseAttr,
  };
}

// --- Boomerang animation (Z_07.asm) ---

function extractBoomerangAnimation(z07: string) {
  console.log('Extracting boomerang animation...');

  const frameCycle = extractAndValidate(z07, 'BoomerangFrameCycle', 9);
  const baseSpriteAttrCycle = extractAndValidate(z07, 'BoomerangBaseSpriteAttrCycle', 9);

  return { frameCycle, baseSpriteAttrCycle };
}

// --- Bomb cloud offsets (Z_07.asm) ---

function extractBombCloudOffsets(z07: string) {
  console.log('Extracting bomb cloud offsets...');

  const offsetsY1 = extractAndValidate(z07, 'BombCloudOffsetsY1', 3);
  const offsetsX1 = extractAndValidate(z07, 'BombCloudOffsetsX1', 3);
  const offsetsY2 = extractAndValidate(z07, 'BombCloudOffsetsY2', 3);
  const offsetsX2 = extractAndValidate(z07, 'BombCloudOffsetsX2', 3);

  return { offsetsY1, offsetsX1, offsetsY2, offsetsX2 };
}

// --- Boss sprites (Z_04.asm) ---

function extractAquamentusSprites(z04: string) {
  console.log('  Aquamentus...');
  return {
    tiles: extractAndValidate(z04, 'AquamentusTiles', 12),
    spriteOffsetsY: extractAndValidate(z04, 'AquamentusSpriteOffsetsY', 6),
    spriteOffsetsX: extractAndValidate(z04, 'AquamentusSpriteOffsetsX', 6),
  };
}

function extractDodongoSprites(z04: string) {
  console.log('  Dodongo...');
  return {
    frameImages: extractAndValidate(z04, 'DodongoFrameImages', 10),
    frameHFlips: extractAndValidate(z04, 'DodongoFrameHFlips', 10),
    frameImagesBloated: extractAndValidate(z04, 'DodongoFrameImagesBloated', 10),
    frameHFlipsBloated: extractAndValidate(z04, 'DodongoFrameHFlipsBloated', 10),
  };
}

function extractDigdoggerSprites(z04: string) {
  console.log('  Digdogger...');
  return {
    spriteOffsetsX: extractAndValidate(z04, 'DigdoggerSpriteOffsetsX', 4),
    spriteOffsetsY: extractAndValidate(z04, 'DigdoggerSpriteOffsetsY', 4),
    spriteAttrs: extractAndValidate(z04, 'DigdoggerSpriteAttrs', 4),
  };
}

function extractGleeokSprites(z04: string) {
  console.log('  Gleeok...');
  return {
    bodyTiles0: extractAndValidate(z04, 'GleeokBodyTiles0', 6),
    bodyTiles1: extractAndValidate(z04, 'GleeokBodyTiles1', 6),
    bodyTiles2: extractAndValidate(z04, 'GleeokBodyTiles2', 6),
    bodyBaseTileOffsets: extractAndValidate(z04, 'GleeokBodyBaseTileOffsets', 4),
  };
}

function extractGanonSprites(z04: string) {
  console.log('  Ganon...');
  return {
    frameImages: extractAndValidate(z04, 'GanonFrameImages', 24),
    spriteOffsetsX: extractAndValidate(z04, 'GanonSpriteOffsetsX', 4),
    spriteOffsetsY: extractAndValidate(z04, 'GanonSpriteOffsetsY', 4),
    spriteHFlips: extractAndValidate(z04, 'GanonSpriteHFlips', 4),
    burstDirs: extractAndValidate(z04, 'GanonBurstDirs', 8),
    burstTiles: extractAndValidate(z04, 'GanonBurstTiles', 10),
    burstSpriteAttrs: extractAndValidate(z04, 'GanonBurstSpriteAttrs', 10),
  };
}

function extractPatraData(z04: string) {
  console.log('  Patra...');
  return {
    childStartAngles: extractAndValidate(z04, 'PatraChildStartAngles', 7),
    sines: extractAndValidate(z04, 'PatraSines', 16),
  };
}

function extractManhandlaSprites(z04: string) {
  console.log('  Manhandla...');
  return {
    baseFrameImagesAndAttrs: extractAndValidate(z04, 'ManhandlaBaseFrameImagesAndAttrs', 5),
    segmentOffsetsX: extractAndValidate(z04, 'ManhandlaSegmentOffsetsX', 2),
    segmentOffsetsY: extractAndValidate(z04, 'ManhandlaSegmentOffsetsY', 5),
  };
}

function extractBossSprites(z04: string) {
  console.log('Extracting boss sprite tables...');
  return {
    aquamentus: extractAquamentusSprites(z04),
    dodongo: extractDodongoSprites(z04),
    digdogger: extractDigdoggerSprites(z04),
    gleeok: extractGleeokSprites(z04),
    ganon: extractGanonSprites(z04),
    patra: extractPatraData(z04),
    manhandla: extractManhandlaSprites(z04),
  };
}

// --- Enemy animation timing (Z_04.asm) ---

function extractEnemyAnimTiming(z04: string) {
  console.log('Extracting enemy animation timing...');

  const blueLeeverStateAnimTimes = extractAndValidate(z04, 'BlueLeeverStateAnimTimes', 6);
  const redLeeverStateAnimTimes = extractAndValidate(z04, 'RedLeeverStateAnimTimes', 6);

  const wallmaster = {
    dirsAndAttrsLeft: extractAndValidate(z04, 'WallmasterDirsAndAttrsLeft', 16),
    dirsAndAttrsRight: extractAndValidate(z04, 'WallmasterDirsAndAttrsRight', 16),
    dirsAndAttrsTop: extractAndValidate(z04, 'WallmasterDirsAndAttrsTop', 16),
    dirsAndAttrsBottom: extractAndValidate(z04, 'WallmasterDirsAndAttrsBottom', 16),
    initialXs: extractAndValidate(z04, 'WallmasterInitialXs', 2),
    initialYs: extractAndValidate(z04, 'WallmasterInitialYs', 2),
  };

  return { blueLeeverStateAnimTimes, redLeeverStateAnimTimes, wallmaster };
}

// --- Main ---

function main() {
  console.log('=== Sprite Animation Data Extraction ===\n');

  const z01 = readFileSync(Z01_ASM_PATH, 'utf-8');
  const z04 = readFileSync(Z04_ASM_PATH, 'utf-8');
  const z07 = readFileSync(Z07_ASM_PATH, 'utf-8');

  const output = {
    coreAnimation: extractCoreAnimation(z01),
    objectTypeToAttributes: extractObjectTypeToAttributes(z07),
    spriteSystem: extractSpriteSystem(z01),
    link: extractLinkSprites(z07),
    items: extractItemSprites(z01),
    weapons: extractWeaponSprites(z07),
    boomerang: extractBoomerangAnimation(z07),
    bombCloud: extractBombCloudOffsets(z07),
    bosses: extractBossSprites(z04),
    enemyAnimTiming: extractEnemyAnimTiming(z04),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`\nWrote ${OUTPUT_PATH}`);

  const totalArrays = [
    output.coreAnimation.objAnimations,
    output.coreAnimation.objAnimFrameHeap,
    output.coreAnimation.objAnimAttrHeap,
    output.objectTypeToAttributes,
    output.spriteSystem.spriteOffsets,
    output.spriteSystem.spriteRelativeExtents,
    output.link.headTiles,
    output.link.headMagicShieldTiles,
    output.items.frameOffsets,
    output.items.frameTiles,
    output.items.slotToPaletteOffsetsOrValues,
    ...Object.values(output.weapons),
    output.boomerang.frameCycle,
    output.boomerang.baseSpriteAttrCycle,
    ...Object.values(output.bombCloud),
  ];
  const totalBytes = totalArrays.reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Total bytes extracted (core + items + weapons + effects): ${totalBytes}`);
  console.log('Done.');
}

main();
