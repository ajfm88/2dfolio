#!/usr/bin/env tsx
// Extract game data from a Pokemon Yellow ROM into data/ for development and testing.
// Usage: npx tsx scripts/extract_dev_data.ts <path-to-rom.gbc>
//
// This reuses the same extractors as the browser ROM extraction system,
// producing identical JSON output for use by the dev server and test suite.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';
import { BinaryReader } from '../src/rom/binary_reader';
import { ROM_SHA1, ROM_SIZE } from '../src/rom/rom_offsets';
import { extractMoves } from '../src/rom/extractors/moves';
import { extractTypeChart } from '../src/rom/extractors/types';
import { extractPokemon } from '../src/rom/extractors/pokemon';
import { extractTrainers } from '../src/rom/extractors/trainers';
import { extractAllWild } from '../src/rom/extractors/wild';
import { extractAllBlocksets } from '../src/rom/extractors/blocksets';
import { extractCollisionTiles } from '../src/rom/extractors/collision';
import { extractPokedex } from '../src/rom/extractors/pokedex';
import { extractAllMaps } from '../src/rom/extractors/maps';
import { extractMusic, extractSfx, extractWaveSamples, extractNoiseInstruments } from '../src/rom/extractors/audio';
import { readMoveNames, readItemNames, readItemDisplayNames, readTrainerClassNames, readPokemonInternalNames } from '../src/rom/extractors/text';
import { extractGameText } from '../src/rom/extractors/game_text';
import townMapData from '../src/rom/town_map_data';

const DATA_DIR = resolve(__dirname, '../data');

// Music and SFX lists (matching src/rom/index.ts)
const MUSIC_TRACKS = [
  'titlescreen', 'yellowintro', 'routes1', 'routes2', 'pallettown',
  'cities1', 'pokecenter', 'gym', 'dungeon2', 'oakslab',
  'wildbattle', 'trainerbattle', 'defeatedwildmon', 'defeatedtrainer',
  'meetprofoak',
  'routes3', 'routes4', 'cities2', 'celadon', 'cinnabar', 'vermilion',
  'lavender', 'ssanne', 'meetrival', 'museumguy', 'safarizone', 'pkmnhealed',
  'indigoplateau', 'gymleaderbattle', 'finalbattle', 'defeatedgymleader',
  'credits', 'halloffame', 'jigglypuffsong', 'bikeriding', 'surfing',
  'gamecorner', 'dungeon1', 'dungeon3', 'cinnabarmansion', 'pokemontower',
  'silphco', 'meetevilttrainer', 'meetfemaletrainer', 'meetmaletrainer',
  'surfingpikachu', 'pokefluteinbattle',
];

const SFX_NAMES = [
  'press_ab', 'start_menu', 'collision', 'go_inside', 'go_outside',
  'save', 'purchase', 'swap', 'withdraw_deposit', 'cut',
  'denied', 'enter_pc', 'fly', 'get_item1', 'get_item2', 'get_key_item',
  'heal_hp', 'heal_machine', 'intro_hip',
  'intro_lunge', 'intro_whoosh', 'ledge', 'level_up', 'mon_faint',
  'not_very_effective', 'poke_ball', 'poke_ball_shake', 'pokedex_rating',
  'push_boulder', 'switch', 'super_effective', 'tink',
  'turn_off_pc', 'turn_on_pc', '59', 'arrow_tiles',
  'heal_ailment', 'poisoned', 'shrink',
  'teleport_exit1', 'teleport_enter1', 'teleport_exit2', 'teleport_enter2',
  'ss_anne_horn', 'trade_machine', 'safari_zone_pa',
];

function writeJson(relPath: string, data: unknown): void {
  const fullPath = resolve(DATA_DIR, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
}

// ── Main ──

const romPath = process.argv[2];
if (!romPath) {
  console.error('Usage: npx tsx scripts/extract_dev_data.ts <path-to-rom.gbc>');
  process.exit(1);
}

console.log(`Reading ROM: ${romPath}`);
const buffer = readFileSync(romPath);

if (buffer.byteLength !== ROM_SIZE) {
  console.error(`Wrong file size: expected ${ROM_SIZE} bytes, got ${buffer.byteLength}`);
  process.exit(1);
}

const hash = createHash('sha1').update(buffer).digest('hex');
if (hash !== ROM_SHA1) {
  console.error(`SHA1 mismatch: expected ${ROM_SHA1}, got ${hash}`);
  process.exit(1);
}

console.log('ROM validated. Extracting data...\n');

const rom = new BinaryReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

// Build name lookup tables
const moveNames = readMoveNames(rom);
const itemNames = readItemNames(rom);
const trainerClassNames = readTrainerClassNames(rom);
const pokemonInternalNames = readPokemonInternalNames(rom);

// Create output directory
mkdirSync(DATA_DIR, { recursive: true });

// Extract all JSON data (mirrors src/rom/index.ts lines 95-167)
let count = 0;

writeJson('item_names.json', readItemDisplayNames(rom)); count++;
writeJson('game_text.json', extractGameText(rom)); count++;
writeJson('pokemon.json', extractPokemon(rom, moveNames, itemNames)); count++;
writeJson('moves.json', extractMoves(rom, moveNames)); count++;
writeJson('type_chart.json', extractTypeChart(rom)); count++;
writeJson('trainers.json', extractTrainers(rom, pokemonInternalNames, moveNames, trainerClassNames)); count++;

const wildData = extractAllWild(rom, pokemonInternalNames);
for (const [mapName, encounters] of Object.entries(wildData)) {
  writeJson(`wild/${mapName}.json`, encounters); count++;
}

const blocksets = extractAllBlocksets(rom);
for (const [name, blocks] of Object.entries(blocksets)) {
  writeJson(`blockset_${name}.json`, blocks); count++;
}

writeJson('collision_tiles.json', extractCollisionTiles(rom)); count++;
writeJson('town_map.json', townMapData); count++;
writeJson('pokedex.json', extractPokedex(rom, pokemonInternalNames)); count++;

const maps = extractAllMaps(rom);
for (const [mapName, mapData] of Object.entries(maps)) {
  writeJson(`maps/${mapName}.json`, mapData); count++;
}

writeJson('audio/wave_samples.json', extractWaveSamples(rom)); count++;
writeJson('audio/noise_instruments.json', extractNoiseInstruments(rom)); count++;

for (const track of MUSIC_TRACKS) {
  const musicData = extractMusic(rom, track);
  if (musicData) {
    writeJson(`audio/music/${track}.json`, musicData); count++;
  }
}

const sfxSet = new Set(SFX_NAMES);
for (const sfxName of sfxSet) {
  const sfxData = extractSfx(rom, sfxName);
  if (sfxData) {
    writeJson(`audio/sfx/${sfxName}.json`, sfxData); count++;
  }
}

console.log(`Done! Extracted ${count} files to data/`);
