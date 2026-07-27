// VS-mode character sprite sheet, ripped by Angelglory (original art
// (c) Nintendo / Intelligent Systems). Credit Angelglory and Nintendo.

import { stageById, randomStages } from './stages.js';

const SHEET_URL = 'assets/vs_char_sprites.png';
const SHEET_BG = [0, 64, 128];
const PORTRAIT_SIZE = 32;

const CHARACTERS = [
  { id: 'yoshi',     name: 'Yoshi',            portrait: { x: 105, y: 9 },   stageId: 'forest' },
  { id: 'lakitu',    name: 'Lakitu',           portrait: { x: 105, y: 54 },  stageId: 'sky' },
  { id: 'bumpty',    name: 'Bumpty',           portrait: { x: 105, y: 102 }, stageId: null },
  // The 2nd-row-left cell is Poochy's: the character painted into it is plainly
  // the cream-and-tan dog, not a fish. It was mis-assigned to Lunge Fish, who in
  // fact has no stage on this sheet.
  { id: 'poochy',    name: 'Poochy',           portrait: { x: 105, y: 142 }, stageId: 'jungle' },
  { id: 'wiggler',   name: 'Flying Wiggler',   portrait: { x: 105, y: 187 }, stageId: null },
  { id: 'froggy',    name: 'Froggy',           portrait: { x: 105, y: 230 }, stageId: 'lilypad' },
  { id: 'blargg',    name: 'Gargantua Blargg', portrait: { x: 105, y: 274 }, stageId: 'cave' },
  { id: 'lungefish', name: 'Lunge Fish',       portrait: { x: 105, y: 320 }, stageId: null },
  { id: 'raven',     name: 'Raphael Raven',    portrait: { x: 105, y: 370 }, stageId: 'moon' },
  { id: 'hookbill',  name: 'Hookbill',         portrait: { x: 106, y: 415 }, stageId: null },
  { id: 'piranha',   name: 'Naval Piranha',    portrait: { x: 106, y: 465 }, stageId: null },
  { id: 'kamek',     name: 'Kamek',            portrait: { x: 106, y: 517 }, stageId: null },
  { id: 'bowser',    name: 'Bowser',           portrait: { x: 106, y: 573 }, stageId: null },
];

// VS-mode pose sprites, one file per character per state, supplied by the user
// in src/assets/char_ind_sprites/. These already carry alpha (and their own drop
// shadows), so unlike the sheets they need no colour-keying -- they are used as
// plain <img> elements, which also means the two animated ones (Yoshi's idle gif
// and attacking webp) animate for free.
//
// Names are otherwise regular; the two exceptions are Yoshi (IdleA / Attacking)
// and Bowser, whose idle file is not prefixed like the rest.
const VS_SPRITE_DIR = 'assets/char_ind_sprites/';
const VS_SPRITES = {
  yoshi:     { idle: 'TetrisAttackSNES-YoshiVsIdleA.gif', attacking: 'TetrisAttackSNES-YoshiVsAttacking.webp', hit: 'TetrisAttackSNES-YoshiVsHit.png', defeated: 'TetrisAttackSNES-YoshiVsDefeat.png', victorious: 'TetrisAttackSNES-YoshiVsVictory.png' },
  lakitu:    { idle: 'TetrisAttackSNES-LakituVsIdle.png', attacking: 'TetrisAttackSNES-LakituVsAttack.png', hit: 'TetrisAttackSNES-LakituVsHit.png', defeated: 'TetrisAttackSNES-LakituVsDefeat.png', victorious: 'TetrisAttackSNES-LakituVsVictory.png' },
  bumpty:    { idle: 'TetrisAttackSNES-BumptyVsIdle.png', attacking: 'TetrisAttackSNES-BumptyVsAttack.png', hit: 'TetrisAttackSNES-BumptyVsHit.png', defeated: 'TetrisAttackSNES-BumptyVsDefeat.png', victorious: 'TetrisAttackSNES-BumptyVsVictory.png' },
  poochy:    { idle: 'TetrisAttackSNES-PoochyVsIdle.png', attacking: 'TetrisAttackSNES-PoochyVsAttack.png', hit: 'TetrisAttackSNES-PoochyVsHit.png', defeated: 'TetrisAttackSNES-PoochyVsDefeat.png', victorious: 'TetrisAttackSNES-PoochyVsVictory.png' },
  wiggler:   { idle: 'TetrisAttackSNES-FlyingWigglerVsIdle.png', attacking: 'TetrisAttackSNES-FlyingWigglerVsAttack.png', hit: 'TetrisAttackSNES-FlyingWigglerVsHit.png', defeated: 'TetrisAttackSNES-FlyingWigglerVsDefeat.png', victorious: 'TetrisAttackSNES-FlyingWigglerVsVictory.webp' },
  froggy:    { idle: 'TetrisAttackSNES-FroggyVsIdle.png', attacking: 'TetrisAttackSNES-FroggyVsAttack.png', hit: 'TetrisAttackSNES-FroggyVsHit.png', defeated: 'TetrisAttackSNES-FroggyVsDefeat.png', victorious: 'TetrisAttackSNES-FroggyVsVictory.webp' },
  blargg:    { idle: 'TetrisAttackSNES-GargantuaBlarggVsIdle.png', attacking: 'TetrisAttackSNES-GargantuaBlarggVsAttack.png', hit: 'TetrisAttackSNES-GargantuaBlarggVsHit.png', defeated: 'TetrisAttackSNES-GargantuaBlarggVsDefeat.png', victorious: 'TetrisAttackSNES-GargantuaBlarggVsVictory.webp' },
  lungefish: { idle: 'TetrisAttackSNES-LungeFishVsIdle.png', attacking: 'TetrisAttackSNES-LungeFishVsAttack.webp', hit: 'TetrisAttackSNES-LungeFishVsHit.png', defeated: 'TetrisAttackSNES-LungeFishVsDefeat.png', victorious: 'TetrisAttackSNES-LungeFishVsVictory.png' },
  raven:     { idle: 'TetrisAttackSNES-RaphaelTheRavenVsIdle.png', attacking: 'TetrisAttackSNES-RaphaelTheRavenVsAttack.png', hit: 'TetrisAttackSNES-RaphaelTheRavenVsHit.png', defeated: 'TetrisAttackSNES-RaphaelTheRavenVsDefeat.png', victorious: 'TetrisAttackSNES-RaphaelTheRavenVsVictory.png' },
  hookbill:  { idle: 'TetrisAttackSNES-HookbillTheKoopaVsIdle.png', attacking: 'TetrisAttackSNES-HookbillTheKoopaVsAttack.png', hit: 'TetrisAttackSNES-HookbillTheKoopaVsHit.png', defeated: 'TetrisAttackSNES-HookbillTheKoopaVsDefeat.png', victorious: 'TetrisAttackSNES-HookbillTheKoopaVsVictory.png' },
  piranha:   { idle: 'TetrisAttackSNES-NavalPiranhaVsIdle.png', attacking: 'TetrisAttackSNES-NavalPiranhaVsAttack.png', hit: 'TetrisAttackSNES-NavalPiranhaVsHit.png', defeated: 'TetrisAttackSNES-NavalPiranhaVsDefeat.png', victorious: 'TetrisAttackSNES-NavalPiranhaVsVictory.webp' },
  kamek:     { idle: 'TetrisAttackSNES-KamekVsIdle.png', attacking: 'TetrisAttackSNES-KamekVsAttack.png', hit: 'TetrisAttackSNES-KamekVsHit.png', defeated: 'TetrisAttackSNES-KamekVsDefeat.webp', victorious: 'TetrisAttackSNES-KamekVsVictory.png' },
  bowser:    { idle: 'BowserTASNES.png', attacking: 'TetrisAttackSNES-BowserVsAttack.png', hit: 'TetrisAttackSNES-BowserVsHit.webp', defeated: 'TetrisAttackSNES-BowserVsDefeat.png', victorious: 'TetrisAttackSNES-BowserVsVictory.png' },
};

// URL for a character's pose, falling back to idle for an unknown state.
function vsSpriteUrl(charId, state) {
  const poses = VS_SPRITES[charId];
  if (!poses) return null;
  return VS_SPRITE_DIR + (poses[state] || poses.idle);
}

// Warm the browser cache with every pose a character can strike, so swapping
// src mid-match is instant. Without this the first combo -- and the victory
// pose, which is set on the very last frame drawn -- would pop in a beat late.
// The Image objects are kept alive because a browser may evict anything it
// holds no reference to.
const vsPreloaded = new Map();

function preloadVsSprites(charId) {
  if (!charId || vsPreloaded.has(charId)) return;
  const poses = VS_SPRITES[charId];
  if (!poses) return;
  vsPreloaded.set(charId, Object.values(poses).map((file) => {
    const img = new Image();
    img.src = VS_SPRITE_DIR + file;
    return img;
  }));
}

const sheet = new Image();
sheet.src = SHEET_URL;

let portraitCache = null;

function buildPortraits() {
  if (portraitCache) return portraitCache;
  if (!sheet.complete || sheet.naturalWidth === 0) return null;

  try {
    portraitCache = CHARACTERS.map((char) => {
      const c = document.createElement('canvas');
      c.width = PORTRAIT_SIZE;
      c.height = PORTRAIT_SIZE;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sheet,
        char.portrait.x, char.portrait.y, PORTRAIT_SIZE, PORTRAIT_SIZE,
        0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE,
      );
      const img = ctx.getImageData(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === SHEET_BG[0] && d[i + 1] === SHEET_BG[1] && d[i + 2] === SHEET_BG[2]) {
          d[i + 3] = 0;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    });
  } catch (e) {
    portraitCache = null;
  }
  return portraitCache;
}

function charStage(char) {
  if (char && char.stageId) return stageById(char.stageId);
  return randomStages(1)[0];
}

function randomCharacter(excludeId) {
  const pool = excludeId
    ? CHARACTERS.filter((c) => c.id !== excludeId)
    : CHARACTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export { CHARACTERS, PORTRAIT_SIZE, sheet, buildPortraits, charStage, randomCharacter, vsSpriteUrl, preloadVsSprites, VS_SPRITES };
