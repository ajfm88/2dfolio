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
import { OLD_MAN_PIC_BACK } from '../rom_offsets';

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

    // Reference PNG for pixel comparison (only available if the pret disassembly
    // is cloned into refs/ — see pull-refs.sh at the workspace root)
    const pngPath = resolve(__dirname, '../../../../refs/pokeyellow/gfx/pokemon/front/pikachu.png');
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

  it('should decompress the old man back pic matching the reference PNG', () => {
    // OldManPicBack (3d:4441, gfx/battle/oldmanb.pic) — the catch demo's "player" (V1d)
    const result = decompressSprite(rom, OLD_MAN_PIC_BACK);

    // Back pics are 4x4 tiles = 32x32 pixels
    expect(result.width).toBe(32);
    expect(result.height).toBe(32);
    const pixels = tiles2bppToPixels(result.tiles2bpp, 4, 4);

    const pngPath = resolve(__dirname, '../../../../refs/pokeyellow/gfx/battle/oldmanb.png');
    if (!existsSync(pngPath)) return; // Skip if no reference PNG available
    const png = PNG.sync.read(readFileSync(pngPath));
    expect([png.width, png.height]).toEqual([32, 32]);

    let mismatches = 0;
    for (let i = 0; i < 32 * 32; i++) {
      if (png.data[i * 4] !== pixels[i]) mismatches++;
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
    const extracted = extractMap(rom, 'PalletTown', itemNames, trainerClassNames);
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
    const extracted = extractMap(rom, 'RedsHouse1F', itemNames, trainerClassNames);
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
    const extracted = extractMap(rom, 'ViridianCity', itemNames, trainerClassNames);
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

  // Every extracted map (upstream's 12 + V1's 7)
  const ALL_MAP_NAMES = [
    'PalletTown', 'ViridianCity', 'Route1', 'Route22',
    'RedsHouse1F', 'RedsHouse2F', 'BluesHouse', 'OaksLab',
    'ViridianPokecenter', 'ViridianMart', 'ViridianSchoolHouse', 'ViridianNicknameHouse',
    'Route2', 'Route2Gate', 'Route2TradeHouse', 'DiglettsCaveRoute2',
    'ViridianForest', 'ViridianForestSouthGate', 'ViridianForestNorthGate',
  ];

  it('should extract all 19 maps', () => {
    const all = extractAllMaps(rom, itemNames, trainerClassNames);
    expect(Object.keys(all).sort()).toEqual([...ALL_MAP_NAMES].sort());
  });

  // Deep comparison of every map against ground truth
  for (const mapName of ALL_MAP_NAMES) {
    it(`should match ${mapName}.json completely`, () => {
      const extracted = extractMap(rom, mapName, itemNames, trainerClassNames);
      const expected = loadJson<Record<string, unknown>>(`maps/${mapName}.json`);

      expect(extracted).not.toBeNull();

      // Compare the full JSON representation to catch any field differences
      const extractedJson = JSON.parse(JSON.stringify(extracted));
      expect(extractedJson).toEqual(expected);
    });
  }
});

// V1 (notes/v1-plan.md). The expected values are transcribed from the pret ASM —
// data/maps/objects/*.asm, text/*.asm, data/trainers/parties.asm — not taken from
// the extractor, so a wrong offset or a misread trainer header fails here.
describe('V1 maps: Route 2 + Viridian Forest', () => {
  const V1_MAPS = [
    'Route2', 'Route2Gate', 'Route2TradeHouse', 'DiglettsCaveRoute2',
    'ViridianForest', 'ViridianForestSouthGate', 'ViridianForestNorthGate',
  ];
  const map = (name: string) => extractMap(rom, name, itemNames, trainerClassNames)!;
  const npc = (mapName: string, id: string) => map(mapName).npcs.find(n => n.id === id)!;

  it('reads every Forest trainer from its own trainer header', () => {
    // [id, class, 0-based party, before battle, end of battle, after battle]
    const trainers: [string, string, number, string, string, string][] = [
      ['youngster2', 'BUG_CATCHER', 0,
        "Hey! You have\nPOKéMON! Come on!\nLet's battle 'em!",
        "No!\nCATERPIE can't\ncut it!",
        "Ssh! You'll scare\nthe bugs away!"],
      ['youngster3', 'BUG_CATCHER', 1,
        "Yo! You can't jam\nout if you're a\nPOKéMON trainer!",
        'Huh?\nI ran out of\nPOKéMON!',
        "Darn! I'm going\nto catch some\nstronger ones!"],
      ['youngster4', 'BUG_CATCHER', 2,
        "Hey, wait up!\nWhat's the hurry?",
        "I\ngive! You're good\nat this!",
        "Sometimes, you\ncan find stuff on\nthe ground!\fI'm looking for\nthe stuff I\ndropped!"],
      ['cooltrainer_f', 'LASS', 18,
        'Hi, do you have a\nPIKACHU?',
        'Oh no,\nreally?',
        'I looked forever,\nbut I never found\na PIKACHU here!'],
      ['youngster5', 'BUG_CATCHER', 14,
        "I'm gonna be the\nbest. You just\ncan't beat me!",
        'After\nall I did...',
        'A METAPOD is cool\nbecause its\nattack is its\ndefense!'],
    ];
    for (const [id, trainerClass, party, before, end, after] of trainers) {
      const n = npc('ViridianForest', id);
      expect(n.trainerClass).toBe(trainerClass);
      expect(n.trainerParty).toBe(party);
      expect(n.dialogue).toBe(before);
      expect(n.endBattleText).toBe(end);
      expect(n.afterBattleText).toBe(after);
    }

    // The 0-based party indexes land on the Forest's parties (parties.asm:
    // BugCatcherData #1 and LassData #19 are commented "; Viridian Forest")
    const classes = loadJson<Record<string, { parties: { species: string; level: number }[][] }>>('trainers.json');
    expect(classes.BUG_CATCHER.parties[0]).toEqual([
      { species: 'CATERPIE', level: 7 }, { species: 'CATERPIE', level: 7 },
    ]);
    expect(classes.LASS.parties[18]).toEqual([
      { species: 'NIDORAN_F', level: 6 }, { species: 'NIDORAN_M', level: 6 },
    ]);
  });

  it('gives non-trainer NPCs no trainer fields', () => {
    for (const id of ['youngster1', 'youngster6']) {
      const n = npc('ViridianForest', id);
      expect(n.trainerClass).toBeUndefined();
      expect(n.endBattleText).toBeUndefined();
      expect(n.dialogue).not.toBe('');
    }
  });

  it('marks item balls with their item and no dialogue', () => {
    const balls: [string, string, string][] = [
      ['Route2', 'moon_stone', 'MOON_STONE'],
      ['Route2', 'hp_up', 'HP_UP'],
      ['ViridianForest', 'potion1', 'POTION'],
      ['ViridianForest', 'potion2', 'POTION'],
      ['ViridianForest', 'poke_ball', 'POKE_BALL'],
    ];
    for (const [mapName, id, item] of balls) {
      const n = npc(mapName, id);
      expect(n.item).toBe(item);
      expect(n.object).toBe(true);
      expect(n.dialogue).toBe('');
    }
  });

  it("keeps Blue's house objects' text despite their stray item byte", () => {
    // objects/BluesHouse.asm: Daisy and the Town Map end in ", 0" — item-flagged, item 0
    for (const n of map('BluesHouse').npcs) {
      expect(n.item).toBeUndefined();
      expect(n.dialogue).not.toBe('');
    }
  });

  it('emits no dialogue for NPCs whose text comes from an engine script', () => {
    expect(npc('Route2Gate', 'oaks_aide').dialogue).toBe('');       // OaksAideScript (V1b)
    expect(npc('Route2TradeHouse', 'gameboy_kid').dialogue).toBe(''); // in-game trade (A4)
  });

  it("reproduces Yellow's bug: the LEAVING VIRIDIAN FOREST sign prints TRAINER TIPS 1", () => {
    const signs = map('ViridianForest').signs;
    const at = (x: number, y: number) => signs.find(s => s.x === x && s.y === y)!.text;
    const tips1 = 'TRAINER TIPS\fIf you want to\navoid battles,\nstay away from\ngrassy areas!';
    expect(at(24, 40)).toBe(tips1);
    expect(at(2, 1)).toBe(tips1);
    expect(signs.every(s => s.text.length > 0)).toBe(true);
  });

  it('connects Viridian north to Route 2, and Route 2 only south until Pewter exists', () => {
    expect(map('ViridianCity').connections).toContainEqual({ direction: 'north', mapName: 'Route2', offset: 5 });
    expect(map('Route2').connections).toEqual([{ direction: 'south', mapName: 'ViridianCity', offset: -5 }]);
  });

  it('resolves gate and house exits (LAST_MAP) to Route 2, and no warp to an unknown map', () => {
    // Route2Gate opens onto Route 2 at both ends; the others have one 2-tile exit
    const exitsToRoute2: Record<string, number> = {
      Route2Gate: 4, Route2TradeHouse: 2, DiglettsCaveRoute2: 2,
      ViridianForestSouthGate: 2, ViridianForestNorthGate: 2,
    };
    for (const [m, count] of Object.entries(exitsToRoute2)) {
      expect(map(m).warps.filter(w => w.destMap === 'Route2').length).toBe(count);
    }
    for (const m of V1_MAPS) {
      for (const w of map(m).warps) expect(w.destMap).not.toMatch(/^UnknownMap_/);
    }
  });

  it('puts the Forest hidden items where hidden_events.asm has them', () => {
    expect(map('ViridianForest').hiddenEvents).toEqual([
      { x: 1, y: 18, item: 'POTION', flag: 'HIDDEN_ITEM_VIRIDIAN_FOREST_POTION' },
      { x: 16, y: 42, item: 'ANTIDOTE', flag: 'HIDDEN_ITEM_VIRIDIAN_FOREST_ANTIDOTE' },
    ]);
  });

  it('matches the ASM object lists: ids, positions, movement and facing', () => {
    const objectsDir = resolve(__dirname, '../../../../refs/pokeyellow/data/maps/objects');
    if (!existsSync(objectsDir)) return; // needs refs/ (pull-refs.sh)
    for (const m of V1_MAPS) {
      const asm = readFileSync(resolve(objectsDir, `${m}.asm`), 'utf-8');
      // NPC id rule: the const_export name minus the map prefix, lowercased
      const prefix = m.toUpperCase() + '_';
      const ids = [...asm.matchAll(/const_export (\w+)/g)].map(c => c[1].slice(prefix.length).toLowerCase());
      const objects = [...asm.matchAll(/object_event\s+(\d+),\s*(\d+),\s*\w+,\s*(\w+),\s*(\w+)/g)];
      const npcs = map(m).npcs;
      expect(npcs.map(n => n.id)).toEqual(ids);
      expect(npcs.length).toBe(objects.length);
      objects.forEach(([, x, y, movement, dir], i) => {
        const n = npcs[i];
        expect([n.x, n.y]).toEqual([Number(x), Number(y)]);
        expect(n.movement).toBe(movement === 'WALK' ? 'walk' : 'stay');
        const faces = ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir) ? dir.toLowerCase() : undefined;
        const walks = dir === 'UP_DOWN' || dir === 'LEFT_RIGHT' ? dir.toLowerCase() : undefined;
        expect(n.direction).toBe(movement === 'STAY' ? faces : undefined);
        expect(n.walkDir).toBe(movement === 'WALK' ? walks : undefined);
      });
    }
  });
});
