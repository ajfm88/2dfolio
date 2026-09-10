/** Declarative clip list for `npm run assets`. Paths are posix, relative to PACK_ROOT. */

export const PACK_ROOT = 'reference/treasure-hunters';
export const AUDIO_ROOT = 'reference/super-pirate-world/audio';

/**
 * UI kit assembly diagrams. Not game art. Only legal way a Sprites/ file
 * leaves the 1195 coverage denominator.
 */
export const coverageExcludes = [
  'Wood and Paper UI/Sprites/Big Banner/Big Banner (guide).png',
  'Wood and Paper UI/Sprites/Green Board/Green Board (guide).png',
  'Wood and Paper UI/Sprites/Green Button/Green Button (guide).png',
  'Wood and Paper UI/Sprites/Inventory/Inventory (guide).png',
  'Wood and Paper UI/Sprites/Orange Paper/Orange Paper (guide).png',
  'Wood and Paper UI/Sprites/Small Banner/Small Banner (guide).png',
  'Wood and Paper UI/Sprites/Yellow Board/Yellow Board (guide).png',
  'Wood and Paper UI/Sprites/Yellow Button/Yellow Button (guide).png',
  'Wood and Paper UI/Sprites/Yellow Paper/Yellow Paper (guide).png',
];

const CAPTAIN =
  'Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword';
const DUST = 'Captain Clown Nose/Sprites/Dust Particles';
const CREW = 'The Crusty Crew/Sprites';
const TRAPS = 'Shooter Traps/Sprites';
const LOOT = 'Pirate Treasure/Sprites';
const ISLAND = 'Palm Tree Island/Sprites';
const SHIP_WATER = 'Merchant Ship/Sprites/Water/Water';
const UI = 'Wood and Paper UI/Sprites';

/**
 * @param {string} id
 * @param {string} dir
 * @param {number} fw
 * @param {number} fh
 * @param {number} n
 * @param {{ match?: RegExp, dest?: string, fps?: number }} [extra]
 */
function strip(id, dir, fw, fh, n, extra = {}) {
  return { id, kind: 'strip', dir, fw, fh, n, fps: extra.fps ?? 10, ...extra };
}

/**
 * @param {string} id
 * @param {string} src
 * @param {string} dest
 */
function copy(id, src, dest) {
  return { id, kind: 'copy', src, dest };
}

/**
 * @param {string} id
 * @param {string} dir
 * @param {number} tile
 * @param {string} dest
 */
function nineslice(id, dir, tile, dest) {
  return { id, kind: 'nineslice', dir, tile, dest };
}

/**
 * @param {string} name kebab id prefix
 * @param {string} folder pack folder under CREW
 * @param {{ fw: number, fh: number, effect: [number, number], counts: number[] }} spec
 */
function walker(name, folder, spec) {
  const base = `${CREW}/${folder}`;
  const [efw, efh] = spec.effect;
  const c = spec.counts;
  const body = (id, sub, n) => strip(`${name}/${id}`, `${base}/${sub}`, spec.fw, spec.fh, n);
  return [
    body('idle', '01-Idle', c[0]),
    body('run', '02-Run', c[1]),
    body('anticipation', '06-Anticipation', c[2]),
    body('attack', '07-Attack', c[3]),
    body('hit', '08-Hit', c[4]),
    body('dead-hit', '09-Dead Hit', c[5]),
    body('dead-ground', '10-Dead Ground', c[6]),
    strip(`${name}/attack-effect`, `${base}/11-Attack Effect`, efw, efh, c[7]),
  ];
}

export const clips = [
  // Player — unarmed Captain
  strip('player/idle', `${CAPTAIN}/01-Idle`, 64, 40, 5),
  strip('player/run', `${CAPTAIN}/02-Run`, 64, 40, 6),
  strip('player/jump', `${CAPTAIN}/03-Jump`, 64, 40, 3),
  strip('player/fall', `${CAPTAIN}/04-Fall`, 64, 40, 1),
  strip('player/ground', `${CAPTAIN}/05-Ground`, 64, 40, 2),
  strip('player/hit', `${CAPTAIN}/06-Hit`, 64, 40, 4),
  strip('player/dead-hit', `${CAPTAIN}/07-Dead Hit`, 64, 40, 4),
  strip('player/dead-ground', `${CAPTAIN}/08-Dead Ground`, 64, 40, 4),

  // Dust — mixed folder, prefix match
  strip('fx/dust-jump', DUST, 52, 20, 6, { match: /^Jump / }),
  strip('fx/dust-fall', DUST, 52, 20, 5, { match: /^Fall / }),
  strip('fx/dust-run', DUST, 52, 20, 5, { match: /^Run / }),

  // Walkers
  ...walker('crabby', 'Crabby', {
    fw: 72, fh: 32, effect: [118, 24],
    counts: [9, 6, 3, 4, 4, 4, 4, 3],
  }),
  ...walker('tooth', 'Fierce Tooth', {
    fw: 34, fh: 30, effect: [22, 24],
    counts: [8, 6, 3, 5, 4, 4, 4, 3],
  }),
  ...walker('star', 'Pink Star', {
    fw: 34, fh: 30, effect: [16, 12],
    counts: [8, 6, 3, 4, 4, 4, 4, 4],
  }),

  // Shooters
  strip('cannon/idle', `${TRAPS}/Cannon/Cannon Idle`, 40, 26, 1),
  strip('cannon/fire', `${TRAPS}/Cannon/Cannon Fire`, 40, 26, 6),
  strip('cannon/fire-effect', `${TRAPS}/Cannon/Cannon Fire Effect`, 20, 28, 6),
  strip('cannon/ball', `${TRAPS}/Cannon/Cannon Ball Idle`, 16, 16, 1),
  strip('cannon/ball-explode', `${TRAPS}/Cannon/Cannon Ball Explosion`, 54, 60, 7),
  strip('cannon/ball-dead', `${TRAPS}/Cannon/Cannon Ball Destroyed`, 16, 16, 3),
  strip('seashell/idle', `${TRAPS}/Seashell/Seashell Idle`, 48, 38, 1),
  strip('seashell/fire', `${TRAPS}/Seashell/Seashell Fire`, 48, 38, 6),
  strip('pearl/idle', `${TRAPS}/Seashell/Pearl Idle`, 16, 16, 1),
  strip('pearl/dead', `${TRAPS}/Seashell/Pearl Destroyed`, 16, 16, 3),

  // Treasure
  strip('coin/gold', `${LOOT}/Gold Coin`, 16, 16, 4),
  strip('coin/silver', `${LOOT}/Silver Coin`, 16, 16, 4),
  strip('diamond/red', `${LOOT}/Red Diamond`, 24, 24, 4),
  strip('diamond/green', `${LOOT}/Green Diamond`, 24, 24, 4),
  strip('diamond/blue', `${LOOT}/Blue Diamond`, 24, 24, 4),
  strip('skull/idle', `${LOOT}/Golden Skull`, 24, 28, 8),
  strip('potion/red', `${LOOT}/Red Potion`, 13, 17, 7),
  strip('potion/blue', `${LOOT}/Blue Potion`, 13, 17, 7),
  strip('fx/coin', `${LOOT}/Coin Effect`, 16, 16, 3),
  strip('fx/diamond', `${LOOT}/Diamond Effect`, 24, 24, 4),
  strip('fx/potion', `${LOOT}/Potion Effect`, 16, 39, 4),
  strip('fx/skull', `${LOOT}/Skull Effect`, 24, 28, 5),

  // Island tiles and objects
  copy('tiles/island', `${ISLAND}/Terrain/Terrain (32x32).png`, 'tiles/island.png'),
  copy(
    'tiles/island-platforms',
    `${ISLAND}/Front Palm Trees/Front Palm Bottom and Grass (32x32).png`,
    'tiles/island-platforms.png',
  ),
  copy('spikes', `${ISLAND}/Objects/Spikes/Spikes.png`, 'sprites/spikes.png'),
  strip('flag', `${ISLAND}/Objects/Flag`, 34, 93, 9, { match: /^Flag / }),
  strip('palm/front', `${ISLAND}/Front Palm Trees`, 39, 32, 4, {
    match: /^Front Palm Tree Top /,
  }),
  strip('palm/back', `${ISLAND}/Back Palm Trees`, 64, 64, 4, {
    match: /^Back Palm Tree Regular /,
  }),
  strip('palm/back-left', `${ISLAND}/Back Palm Trees`, 51, 53, 4, {
    match: /^Back Palm Tree Left /,
  }),
  strip('palm/back-right', `${ISLAND}/Back Palm Trees`, 52, 53, 4, {
    match: /^Back Palm Tree Right /,
  }),

  // Parallax
  copy('bg/image', `${ISLAND}/Background/BG Image.png`, 'sprites/bg-image.png'),
  copy('bg/clouds-big', `${ISLAND}/Background/Big Clouds.png`, 'sprites/clouds-big.png'),
  copy('bg/cloud-1', `${ISLAND}/Background/Small Cloud 1.png`, 'sprites/cloud-1.png'),
  copy('bg/cloud-2', `${ISLAND}/Background/Small Cloud 2.png`, 'sprites/cloud-2.png'),
  copy('bg/cloud-3', `${ISLAND}/Background/Small Cloud 3.png`, 'sprites/cloud-3.png'),
  copy('bg/sky-tile', `${ISLAND}/Background/Additional Sky.png`, 'sprites/sky-tile.png'),
  copy('bg/water-tile', `${ISLAND}/Background/Additional Water.png`, 'sprites/water-tile.png'),
  strip('water/top', `${SHIP_WATER}/Top`, 96, 32, 4),
  copy('water/body-wide', `${SHIP_WATER}/Bottom/1.png`, 'sprites/water-body-wide.png'),
  strip('fx/reflect-big', `${ISLAND}/Background`, 170, 10, 4, {
    match: /^Water Reflect Big /,
  }),
  strip('fx/reflect-mid', `${ISLAND}/Background`, 53, 3, 4, {
    match: /^Water Reflect Medium /,
  }),
  strip('fx/reflect-small', `${ISLAND}/Background`, 35, 3, 4, {
    match: /^Water Reflect Small /,
  }),

  // UI nine-slices
  nineslice('ui/board-yellow', `${UI}/Yellow Board`, 32, 'ui/board-yellow.png'),
  nineslice('ui/board-green', `${UI}/Green Board`, 32, 'ui/board-green.png'),
  nineslice('ui/paper-yellow', `${UI}/Yellow Paper`, 32, 'ui/paper-yellow.png'),
  nineslice('ui/button-yellow', `${UI}/Yellow Button`, 14, 'ui/button-yellow.png'),
  nineslice('ui/button-green', `${UI}/Green Button`, 14, 'ui/button-green.png'),

  // UI strips
  strip('ui/hearts', `${UI}/Life Bars/Big Bars`, 32, 32, 4, { dest: 'ui/hearts.png' }),
  strip('ui/icons', `${UI}/Mobile Buttons/Mobile Buttons`, 28, 28, 8, {
    dest: 'ui/icons.png',
  }),
  strip('ui/small-icons', `${UI}/Small Text/Small Icons`, 8, 6, 25, {
    dest: 'ui/small-icons.png',
  }),
  strip('ui/sliders', `${UI}/Sliders`, 12, 12, 10, { dest: 'ui/sliders.png' }),
];

export const audio = [
  { src: 'coin.wav', dest: 'audio/coin.wav' },
  { src: 'jump.wav', dest: 'audio/jump.wav' },
  { src: 'damage.wav', dest: 'audio/damage.wav' },
  { src: 'pearl.wav', dest: 'audio/pearl.wav' },
  { src: 'attack.wav', dest: 'audio/attack.wav' },
  { src: 'hit.wav', dest: 'audio/hit.wav' },
  { src: 'starlight_city.mp3', dest: 'audio/starlight_city.mp3' },
];
