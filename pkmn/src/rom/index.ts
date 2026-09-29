// ROM extraction public API
// Orchestrates all extractors and provides the extracted data

import { BinaryReader, sha1 } from './binary_reader';
import { ROM_SHA1, ROM_SIZE } from './rom_offsets';
import { extractMoves } from './extractors/moves';
import { extractTypeChart } from './extractors/types';
import { extractPokemon } from './extractors/pokemon';
import { extractTrainers } from './extractors/trainers';
import { extractAllWild } from './extractors/wild';
import { extractAllBlocksets } from './extractors/blocksets';
import { extractCollisionTiles } from './extractors/collision';
import { extractPokedex } from './extractors/pokedex';
import { extractAllMaps } from './extractors/maps';
import { extractMusic, extractSfx, extractWaveSamples, extractNoiseInstruments } from './extractors/audio';
import { extractFontGraphics, extractTilesetGraphics, extractAllAdditionalGraphics } from './extractors/graphics';
import { extractAllPokemonSprites } from './extractors/sprites';
import { readMoveNames, readItemNames, readItemDisplayNames, readTrainerClassNames, readPokemonInternalNames } from './extractors/text';
import { extractGameText } from './extractors/game_text';
import type { ExtractedData } from './data_provider';

export { installRomData } from './data_provider';

export interface ExtractionProgress {
  step: string;
  current: number;
  total: number;
}

/**
 * Validate that an ArrayBuffer is the expected ROM.
 * Returns null on success, or an error message string.
 */
export async function validateRom(buffer: ArrayBuffer): Promise<string | null> {
  if (buffer.byteLength !== ROM_SIZE) {
    return `Wrong file size: expected ${ROM_SIZE} bytes, got ${buffer.byteLength}`;
  }
  const hash = await sha1(buffer);
  if (hash !== ROM_SHA1) {
    return 'Unsupported ROM file.';
  }
  return null;
}

// Music tracks to extract (all that have existing JSON ground truth + extras from ROM)
const MUSIC_TRACKS = [
  'titlescreen', 'yellowintro', 'routes1', 'routes2', 'pallettown',
  'cities1', 'pokecenter', 'gym', 'dungeon2', 'oakslab',
  'wildbattle', 'trainerbattle', 'defeatedwildmon', 'defeatedtrainer',
  'meetprofoak',
  // Additional tracks available in ROM:
  'routes3', 'routes4', 'cities2', 'celadon', 'cinnabar', 'vermilion',
  'lavender', 'ssanne', 'meetrival', 'museumguy', 'safarizone', 'pkmnhealed',
  'indigoplateau', 'gymleaderbattle', 'finalbattle', 'defeatedgymleader',
  'credits', 'halloffame', 'jigglypuffsong', 'bikeriding', 'surfing',
  'gamecorner', 'dungeon1', 'dungeon3', 'cinnabarmansion', 'pokemontower',
  'silphco', 'meetevilttrainer', 'meetfemaletrainer', 'meetmaletrainer',
  'surfingpikachu', 'pokefluteinbattle',
];

// SFX to extract (matching existing data/audio/sfx/ ground truth)
const SFX_NAMES = [
  'press_ab', 'start_menu', 'collision', 'go_inside', 'go_outside',
  'save', 'purchase', 'swap', 'withdraw_deposit', 'cut',
  'denied', 'enter_pc', 'fly', 'get_item1', 'get_item2', 'get_key_item',
  'go_inside', 'go_outside', 'heal_hp', 'heal_machine', 'intro_hip',
  'intro_lunge', 'intro_whoosh', 'ledge', 'level_up', 'mon_faint',
  'not_very_effective', 'poke_ball', 'poke_ball_shake', 'pokedex_rating',
  'press_ab', 'push_boulder', 'switch', 'super_effective', 'tink',
  'turn_off_pc', 'turn_on_pc', '59', 'arrow_tiles',
];

/**
 * Extract all game data from the ROM.
 * Calls onProgress during extraction for UI updates.
 */
export async function extractRom(
  buffer: ArrayBuffer,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractedData> {
  const rom = new BinaryReader(buffer);
  const data: ExtractedData = {
    jsonData: {},
    imageData: {},
    binaryData: {},
  };

  const totalSteps = 14;
  let step = 0;
  const progress = (label: string) => {
    onProgress?.({ step: label, current: step, total: totalSteps });
    step++;
  };

  // ── Build name lookup tables from ROM (once) ──
  progress('Reading name tables...');
  const moveNames = readMoveNames(rom);
  const itemNames = readItemNames(rom);
  const trainerClassNames = readTrainerClassNames(rom);
  const pokemonInternalNames = readPokemonInternalNames(rom);

  // ── Item display names (for runtime use) ──
  data.jsonData['item_names.json'] = readItemDisplayNames(rom);

  // ── Game text (dialogue & UI strings) ──
  data.jsonData['game_text.json'] = extractGameText(rom);

  // ── JSON data extractors ──

  progress('Extracting Pokemon data...');
  data.jsonData['pokemon.json'] = extractPokemon(rom, moveNames, itemNames);

  progress('Extracting move data...');
  data.jsonData['moves.json'] = extractMoves(rom, moveNames);

  progress('Extracting type chart...');
  data.jsonData['type_chart.json'] = extractTypeChart(rom);

  progress('Extracting trainer data...');
  data.jsonData['trainers.json'] = extractTrainers(rom, pokemonInternalNames, moveNames, trainerClassNames);

  progress('Extracting wild encounters...');
  const wildData = extractAllWild(rom, pokemonInternalNames);
  for (const [mapName, encounters] of Object.entries(wildData)) {
    data.jsonData[`wild/${mapName}.json`] = encounters;
  }

  progress('Extracting blocksets & collision...');
  const blocksets = extractAllBlocksets(rom);
  for (const [name, blocks] of Object.entries(blocksets)) {
    data.jsonData[`blockset_${name}.json`] = blocks;
  }
  data.jsonData['collision_tiles.json'] = extractCollisionTiles(rom);

  // Town map data is static coordinate data (tilemap + location positions).
  // Not extracted from ROM — embedded as static import for production mode.
  data.jsonData['town_map.json'] = (await import('./town_map_data')).default;

  progress('Extracting Pokedex & maps...');
  data.jsonData['pokedex.json'] = extractPokedex(rom, pokemonInternalNames);

  const maps = extractAllMaps(rom);
  for (const [mapName, mapData] of Object.entries(maps)) {
    data.jsonData[`maps/${mapName}.json`] = mapData;
  }

  progress('Extracting audio data...');
  // Wave samples and noise instruments
  data.jsonData['audio/wave_samples.json'] = extractWaveSamples(rom);
  data.jsonData['audio/noise_instruments.json'] = extractNoiseInstruments(rom);

  // Music tracks
  for (const track of MUSIC_TRACKS) {
    const musicData = extractMusic(rom, track);
    if (musicData) {
      data.jsonData[`audio/music/${track}.json`] = musicData;
    }
  }

  // SFX
  const sfxSet = new Set(SFX_NAMES);
  for (const sfxName of sfxSet) {
    const sfxData = extractSfx(rom, sfxName);
    if (sfxData) {
      data.jsonData[`audio/sfx/${sfxName}.json`] = sfxData;
    }
  }

  // ── Graphics extractors ──

  progress('Decoding font & tilesets...');
  data.imageData['/gfx/font/font.png'] = extractFontGraphics(rom);

  const tilesetImages = extractTilesetGraphics(rom);
  for (const [url, img] of Object.entries(tilesetImages)) {
    data.imageData[url] = img;
  }

  progress('Decompressing Pokemon sprites...');
  const spriteImages = extractAllPokemonSprites(rom);
  for (const [url, img] of Object.entries(spriteImages)) {
    data.imageData[url] = img;
  }

  progress('Extracting UI, overworld & trainer graphics...');
  const additionalGfx = extractAllAdditionalGraphics(rom);
  for (const [url, img] of Object.entries(additionalGfx.images)) {
    data.imageData[url] = img;
  }
  for (const [url, bin] of Object.entries(additionalGfx.binaries)) {
    data.binaryData[url] = bin;
  }

  progress('Extraction complete');

  return data;
}
