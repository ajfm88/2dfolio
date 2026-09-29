// ROM extraction verification tests
// Compares ROM-extracted data against existing ground-truth JSON files

import { describe as _describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PNG } from 'pngjs';
import { BinaryReader } from '../binary_reader';
import { extractMoves } from '../extractors/moves';
import { extractTypeChart } from '../extractors/types';
import { extractPokemon } from '../extractors/pokemon';
import { extractTrainers } from '../extractors/trainers';
import { extractWild, extractAllWild } from '../extractors/wild';
import { extractBlockset, extractAllBlocksets } from '../extractors/blocksets';
import { extractCollisionTiles } from '../extractors/collision';
import { extractPokedex } from '../extractors/pokedex';
import { decompressSprite } from '../sprite_decompress';
import { extractMusic, extractSfx, extractWaveSamples, extractNoiseInstruments } from '../extractors/audio';
import { extractMap, extractAllMaps } from '../extractors/maps';
import { readMoveNames, readItemNames, readTrainerClassNames, readPokemonInternalNames } from '../extractors/text';

const ROM_PATH = process.env.ROM_PATH;
const DATA_DIR = resolve(__dirname, '../../../data');

// Skip all ROM extraction tests when no ROM is available
const describe = _describe.skipIf(!ROM_PATH);

function loadJson<T>(filename: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, filename), 'utf-8'));
}

let rom: BinaryReader;
let moveNames: string[];
let itemNames: Record<number, string>;
let trainerClassNames: string[];
let pokemonInternalNames: Record<number, string>;

beforeAll(() => {
  if (!ROM_PATH) return; // Tests will be skipped via describe.skipIf below
  const buffer = readFileSync(ROM_PATH);
  rom = new BinaryReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

  // Build name lookup tables from ROM (once for all tests)
  moveNames = readMoveNames(rom);
  itemNames = readItemNames(rom);
  trainerClassNames = readTrainerClassNames(rom);
  pokemonInternalNames = readPokemonInternalNames(rom);
});

describe('Move extraction', () => {
  it('should match moves.json exactly', () => {
    const extracted = extractMoves(rom, moveNames);
    const expected = loadJson<Record<string, unknown>>('moves.json');

    // Check we have the same keys
    const extractedKeys = Object.keys(extracted).sort();
    const expectedKeys = Object.keys(expected).sort();
    expect(extractedKeys).toEqual(expectedKeys);

    // Check each move matches
    for (const key of expectedKeys) {
      expect(extracted[key]).toEqual(expected[key]);
    }
  });
});

describe('Type chart extraction', () => {
  it('should match type_chart.json exactly', () => {
    const extracted = extractTypeChart(rom);
    const expected = loadJson<unknown[]>('type_chart.json');

    expect(extracted.length).toBe(expected.length);
    expect(extracted).toEqual(expected);
  });
});

describe('Pokemon extraction', () => {
  it('should match pokemon.json exactly', () => {
    const extracted = extractPokemon(rom, moveNames, itemNames);
    const expected = loadJson<(unknown | null)[]>('pokemon.json');

    expect(extracted.length).toBe(expected.length);
    expect(extracted[0]).toBeNull();

    for (let i = 1; i <= 151; i++) {
      const ext = extracted[i];
      const exp = expected[i] as Record<string, unknown>;

      if (!ext || !exp) {
        expect(ext).toEqual(exp);
        continue;
      }

      // Compare field by field for better error messages
      expect(ext.id).toBe(exp.id);
      expect(ext.name).toBe(exp.name);
      expect(ext.hp).toBe(exp.hp);
      expect(ext.attack).toBe(exp.attack);
      expect(ext.defense).toBe(exp.defense);
      expect(ext.speed).toBe(exp.speed);
      expect(ext.special).toBe(exp.special);
      expect(ext.type1).toBe(exp.type1);
      expect(ext.type2).toBe(exp.type2);
      expect(ext.catchRate).toBe(exp.catchRate);
      expect(ext.baseExp).toBe(exp.baseExp);
      expect(ext.startMoves).toEqual(exp.startMoves);
      expect(ext.growthRate).toBe(exp.growthRate);
      expect(ext.learnset).toEqual(exp.learnset);
      expect(ext.evolutions).toEqual(exp.evolutions);
    }
  });
});

describe('Trainer extraction', () => {
  it('should match trainers.json exactly', () => {
    const extracted = extractTrainers(rom, pokemonInternalNames, moveNames, trainerClassNames);
    const expected = loadJson<Record<string, unknown>>('trainers.json');

    // Check we have the same keys
    const extractedKeys = Object.keys(extracted).sort();
    const expectedKeys = Object.keys(expected).sort();
    expect(extractedKeys).toEqual(expectedKeys);

    // Check each trainer class matches
    for (const key of expectedKeys) {
      const ext = extracted[key];
      const exp = expected[key] as Record<string, unknown>;

      expect(ext.id).toBe(exp.id);
      expect(ext.displayName).toBe(exp.displayName);
      expect(ext.baseMoney).toBe(exp.baseMoney);
      expect(ext.aiModifiers).toEqual(exp.aiModifiers);

      const extParties = ext.parties;
      const expParties = exp.parties as unknown[][];
      expect(extParties.length).toBe(expParties.length);

      for (let p = 0; p < expParties.length; p++) {
        expect(extParties[p]).toEqual(expParties[p]);
      }
    }
  });
});

describe('Wild encounter extraction', () => {
  it('should extract Route1 wild data matching ground truth', () => {
    const extracted = extractWild(rom, 'Route1', pokemonInternalNames);
    const expected = loadJson<Record<string, unknown>>('wild/Route1.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.grassRate).toBe(expected.grassRate);
    expect(extracted!.grass).toEqual(expected.grass);
    expect(extracted!.waterRate).toBe(expected.waterRate);
    expect(extracted!.water).toEqual(expected.water);
  });

  it('should extract Route22 wild data matching ground truth', () => {
    const extracted = extractWild(rom, 'Route22', pokemonInternalNames);
    const expected = loadJson<Record<string, unknown>>('wild/Route22.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.grassRate).toBe(expected.grassRate);
    expect(extracted!.grass).toEqual(expected.grass);
    expect(extracted!.waterRate).toBe(expected.waterRate);
    expect(extracted!.water).toEqual(expected.water);
  });

  it('should extract all wild encounter maps', () => {
    const all = extractAllWild(rom, pokemonInternalNames);
    // Should have at least Route1, Route22, ViridianForest
    expect(all['Route1']).toBeDefined();
    expect(all['Route22']).toBeDefined();
    expect(all['ViridianForest']).toBeDefined();
    // Each entry should have valid structure
    for (const data of Object.values(all)) {
      expect(data.grassRate).toBeGreaterThanOrEqual(0);
      expect(data.waterRate).toBeGreaterThanOrEqual(0);
      if (data.grassRate > 0) expect(data.grass.length).toBe(10);
      if (data.waterRate > 0) expect(data.water.length).toBe(10);
    }
  });
});

describe('Blockset extraction', () => {
  const BLOCKSET_FILES: Record<string, string> = {
    'overworld': 'blockset_overworld.json',
    'reds_house': 'blockset_reds_house.json',
    'lab': 'blockset_lab.json',
    'gym': 'blockset_gym.json',
    'forest': 'blockset_forest.json',
    'pokecenter': 'blockset_pokecenter.json',
    'gate': 'blockset_gate.json',
    'house': 'blockset_house.json',
  };

  for (const [name, file] of Object.entries(BLOCKSET_FILES)) {
    it(`should match ${file} exactly`, () => {
      const extracted = extractBlockset(rom, name);
      const expected = loadJson<number[][]>(file);

      expect(extracted).not.toBeNull();
      expect(extracted!.length).toBe(expected.length);

      for (let i = 0; i < expected.length; i++) {
        expect(extracted![i]).toEqual(expected[i]);
      }
    });
  }

  it('should extract all unique blocksets', () => {
    const all = extractAllBlocksets(rom);
    expect(Object.keys(all).length).toBe(20); // 20 unique blocksets
  });
});

describe('Collision tile extraction', () => {
  it('should match collision_tiles.json exactly', () => {
    const extracted = extractCollisionTiles(rom);
    const expected = loadJson<Record<string, number[]>>('collision_tiles.json');

    // Check same keys
    const extractedKeys = Object.keys(extracted);
    const expectedKeys = Object.keys(expected);
    expect(extractedKeys).toEqual(expectedKeys);

    // Check each tileset's collision tiles match
    for (const key of expectedKeys) {
      expect(extracted[key]).toEqual(expected[key]);
    }
  });
});

describe('Pokedex extraction', () => {
  it('should match pokedex.json exactly', () => {
    const extracted = extractPokedex(rom, pokemonInternalNames);
    const expected = loadJson<(Record<string, unknown> | null)[]>('pokedex.json');

    expect(extracted.length).toBe(expected.length);
    expect(extracted[0]).toBeNull();

    for (let i = 1; i <= 151; i++) {
      const ext = extracted[i];
      const exp = expected[i];

      if (!ext || !exp) {
        expect(ext).toEqual(exp);
        continue;
      }

      // Compare field by field for better error messages
      expect(ext.id).toBe(exp.id);
      expect(ext.species).toBe(exp.species);
      expect(ext.heightFeet).toBe(exp.heightFeet);
      expect(ext.heightInches).toBe(exp.heightInches);
      expect(ext.weight).toBe(exp.weight);
      expect(ext.description).toEqual(exp.description);
      expect(ext.locations).toEqual(exp.locations);
    }
  });
});

describe('Sprite decompression', () => {
  // 2bpp shade values: shade 0 → 255 (white), 1 → 170, 2 → 85, 3 → 0 (black)
  const SHADE_2BPP = [255, 170, 85, 0];

  /** Convert 2bpp tile data to a flat array of grayscale pixel values (row-major). */
  function tiles2bppToPixels(
    data: Uint8Array,
    widthTiles: number,
    heightTiles: number,
  ): number[] {
    const width = widthTiles * 8;
    const height = heightTiles * 8;
    const pixels = new Array<number>(width * height);

    for (let tileY = 0; tileY < heightTiles; tileY++) {
      for (let tileX = 0; tileX < widthTiles; tileX++) {
        const tileIndex = tileY * widthTiles + tileX;
        const tileBase = tileIndex * 16;

        for (let row = 0; row < 8; row++) {
          const lo = data[tileBase + row * 2];
          const hi = data[tileBase + row * 2 + 1];

          for (let col = 0; col < 8; col++) {
            const bit = 7 - col;
            const shade = ((hi >> bit) & 1) << 1 | ((lo >> bit) & 1);
            const px = (tileY * 8 + row) * width + (tileX * 8 + col);
            pixels[px] = SHADE_2BPP[shade];
          }
        }
      }
    }

    return pixels;
  }

  it('should decompress Pikachu front sprite matching the reference PNG', () => {
    // PikachuPicFront is at 0b:4d55 (from pokeyellow.sym)
    const pikachuOffset = 0x0b * 0x4000 + (0x4d55 & 0x3FFF); // = 0x2cd55

    const result = decompressSprite(rom, pikachuOffset);

    // Pikachu is 5x5 tiles = 40x40 pixels
    expect(result.width).toBe(40);
    expect(result.height).toBe(40);
    expect(result.tiles2bpp.length).toBe(5 * 5 * 16); // 25 tiles * 16 bytes

    // Convert to pixels
    const pixels = tiles2bppToPixels(result.tiles2bpp, 5, 5);

    // Reference PNG for pixel comparison (only available if pokeyellow disassembly is cloned alongside)
    const pngPath = resolve(__dirname, '../../../../gfx/pokemon/front/pikachu.png');
    if (!existsSync(pngPath)) return; // Skip if no reference PNG available
    const pngBuffer = readFileSync(pngPath);
    const png = PNG.sync.read(pngBuffer);

    expect(png.width).toBe(40);
    expect(png.height).toBe(40);

    // Compare pixel by pixel
    let mismatches = 0;
    let firstMismatch = '';
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        const idx = y * 40 + x;
        // PNG is grayscale (mode L), stored as RGBA in pngjs
        const pngGray = png.data[idx * 4]; // R channel = grayscale value
        const decompGray = pixels[idx];

        if (pngGray !== decompGray) {
          mismatches++;
          if (!firstMismatch) {
            firstMismatch = `pixel (${x},${y}): expected ${pngGray}, got ${decompGray}`;
          }
        }
      }
    }

    expect(mismatches).toBe(0);
  });
});

describe('Audio: Wave samples extraction', () => {
  it('should match wave_samples.json exactly', () => {
    const extracted = extractWaveSamples(rom);
    const expected = loadJson<number[][]>('audio/wave_samples.json');

    expect(extracted.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(extracted[i]).toEqual(expected[i]);
    }
  });
});

describe('Audio: Noise instruments extraction', () => {
  it('should match noise_instruments.json exactly', () => {
    const extracted = extractNoiseInstruments(rom);
    const expected = loadJson<{ steps: { length: number; volume: number; fade: number; param: number }[] }[]>('audio/noise_instruments.json');

    expect(extracted.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(extracted[i].steps.length).toBe(expected[i].steps.length);
      for (let j = 0; j < expected[i].steps.length; j++) {
        expect(extracted[i].steps[j]).toEqual(expected[i].steps[j]);
      }
    }
  });
});

describe('Audio: Music extraction', () => {
  it('should match pallettown.json exactly', () => {
    const extracted = extractMusic(rom, 'pallettown');
    const expected = loadJson<{ channels: { id: number; commands: Record<string, unknown>[] }[] }>('audio/music/pallettown.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.channels.length).toBe(expected.channels.length);

    for (let ch = 0; ch < expected.channels.length; ch++) {
      const extCh = extracted!.channels[ch];
      const expCh = expected.channels[ch];

      expect(extCh.id).toBe(expCh.id);
      expect(extCh.commands.length).toBe(expCh.commands.length);

      for (let c = 0; c < expCh.commands.length; c++) {
        expect(extCh.commands[c]).toEqual(expCh.commands[c]);
      }
    }
  });

  it('should match routes1.json exactly', () => {
    const extracted = extractMusic(rom, 'routes1');
    const expected = loadJson<{ channels: { id: number; commands: Record<string, unknown>[] }[] }>('audio/music/routes1.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.channels.length).toBe(expected.channels.length);

    for (let ch = 0; ch < expected.channels.length; ch++) {
      const extCh = extracted!.channels[ch];
      const expCh = expected.channels[ch];

      expect(extCh.id).toBe(expCh.id);
      expect(extCh.commands.length).toBe(expCh.commands.length);

      for (let c = 0; c < expCh.commands.length; c++) {
        expect(extCh.commands[c]).toEqual(expCh.commands[c]);
      }
    }
  });
});

describe('Audio: SFX extraction', () => {
  it('should match press_ab.json exactly', () => {
    const extracted = extractSfx(rom, 'press_ab');
    const expected = loadJson<{ channels: { id: number; commands: Record<string, unknown>[] }[] }>('audio/sfx/press_ab.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.channels.length).toBe(expected.channels.length);

    for (let ch = 0; ch < expected.channels.length; ch++) {
      const extCh = extracted!.channels[ch];
      const expCh = expected.channels[ch];

      expect(extCh.id).toBe(expCh.id);
      expect(extCh.commands.length).toBe(expCh.commands.length);

      for (let c = 0; c < expCh.commands.length; c++) {
        expect(extCh.commands[c]).toEqual(expCh.commands[c]);
      }
    }
  });

  it('should match collision.json exactly', () => {
    const extracted = extractSfx(rom, 'collision');
    const expected = loadJson<{ channels: { id: number; commands: Record<string, unknown>[] }[] }>('audio/sfx/collision.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.channels.length).toBe(expected.channels.length);

    for (let ch = 0; ch < expected.channels.length; ch++) {
      const extCh = extracted!.channels[ch];
      const expCh = expected.channels[ch];

      expect(extCh.id).toBe(expCh.id);
      expect(extCh.commands.length).toBe(expCh.commands.length);

      for (let c = 0; c < expCh.commands.length; c++) {
        expect(extCh.commands[c]).toEqual(expCh.commands[c]);
      }
    }
  });
});

describe('Map extraction', () => {
  it('should match PalletTown.json exactly', () => {
    const extracted = extractMap(rom, 'PalletTown');
    const expected = loadJson<Record<string, unknown>>('maps/PalletTown.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.name).toBe(expected.name);
    expect(extracted!.width).toBe(expected.width);
    expect(extracted!.height).toBe(expected.height);
    expect(extracted!.tileset).toBe(expected.tileset);
    expect(extracted!.connections).toEqual(expected.connections);
    expect(extracted!.blocks).toEqual(expected.blocks);
    expect(extracted!.borderBlock).toBe(expected.borderBlock);
    expect(extracted!.warps).toEqual(expected.warps);
    expect(extracted!.signs).toEqual(expected.signs);
    expect(extracted!.npcs).toEqual(expected.npcs);
  });

  it('should match RedsHouse1F.json exactly', () => {
    const extracted = extractMap(rom, 'RedsHouse1F');
    const expected = loadJson<Record<string, unknown>>('maps/RedsHouse1F.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.name).toBe(expected.name);
    expect(extracted!.width).toBe(expected.width);
    expect(extracted!.height).toBe(expected.height);
    expect(extracted!.tileset).toBe(expected.tileset);
    expect(extracted!.connections).toEqual(expected.connections);
    expect(extracted!.blocks).toEqual(expected.blocks);
    expect(extracted!.borderBlock).toBe(expected.borderBlock);
    expect(extracted!.warps).toEqual(expected.warps);
    expect(extracted!.signs).toEqual(expected.signs);
    expect((extracted as unknown as Record<string, unknown>).hiddenEvents).toEqual((expected as unknown as Record<string, unknown>).hiddenEvents);
    expect(extracted!.npcs).toEqual(expected.npcs);
  });

  it('should match ViridianCity.json exactly', () => {
    const extracted = extractMap(rom, 'ViridianCity');
    const expected = loadJson<Record<string, unknown>>('maps/ViridianCity.json');

    expect(extracted).not.toBeNull();
    expect(extracted!.name).toBe(expected.name);
    expect(extracted!.width).toBe(expected.width);
    expect(extracted!.height).toBe(expected.height);
    expect(extracted!.tileset).toBe(expected.tileset);
    expect(extracted!.connections).toEqual(expected.connections);
    expect(extracted!.blocks).toEqual(expected.blocks);
    expect(extracted!.borderBlock).toBe(expected.borderBlock);
    expect(extracted!.warps).toEqual(expected.warps);
    expect(extracted!.signs).toEqual(expected.signs);
    expect((extracted as unknown as Record<string, unknown>).hiddenEvents).toEqual((expected as unknown as Record<string, unknown>).hiddenEvents);
    expect(extracted!.npcs).toEqual(expected.npcs);
  });

  it('should extract all 12 demo maps', () => {
    const all = extractAllMaps(rom);
    const mapNames = Object.keys(all);
    expect(mapNames.length).toBe(12);

    const expected = [
      'PalletTown', 'ViridianCity', 'Route1', 'Route22',
      'RedsHouse1F', 'RedsHouse2F', 'BluesHouse', 'OaksLab',
      'ViridianPokecenter', 'ViridianMart', 'ViridianSchoolHouse', 'ViridianNicknameHouse',
    ];
    for (const name of expected) {
      expect(all[name]).toBeDefined();
    }
  });

  // Deep comparison of all 12 maps against ground truth
  const ALL_MAP_NAMES = [
    'PalletTown', 'ViridianCity', 'Route1', 'Route22',
    'RedsHouse1F', 'RedsHouse2F', 'BluesHouse', 'OaksLab',
    'ViridianPokecenter', 'ViridianMart', 'ViridianSchoolHouse', 'ViridianNicknameHouse',
  ];

  for (const mapName of ALL_MAP_NAMES) {
    it(`should match ${mapName}.json completely`, () => {
      const extracted = extractMap(rom, mapName);
      const expected = loadJson<Record<string, unknown>>(`maps/${mapName}.json`);

      expect(extracted).not.toBeNull();

      // Compare the full JSON representation to catch any field differences
      const extractedJson = JSON.parse(JSON.stringify(extracted));
      expect(extractedJson).toEqual(expected);
    });
  }
});
