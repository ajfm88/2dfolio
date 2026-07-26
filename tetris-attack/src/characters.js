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
  { id: 'poochy',    name: 'Poochy',           portrait: { x: 105, y: 142 }, stageId: null },
  { id: 'wiggler',   name: 'Flying Wiggler',   portrait: { x: 105, y: 187 }, stageId: null },
  { id: 'froggy',    name: 'Froggy',           portrait: { x: 105, y: 230 }, stageId: 'lilypad' },
  { id: 'blargg',    name: 'Gargantua Blargg', portrait: { x: 105, y: 274 }, stageId: 'cave' },
  { id: 'lungefish', name: 'Lunge Fish',       portrait: { x: 105, y: 320 }, stageId: 'jungle' },
  { id: 'raven',     name: 'Raphael Raven',    portrait: { x: 105, y: 370 }, stageId: 'moon' },
  { id: 'hookbill',  name: 'Hookbill',         portrait: { x: 106, y: 415 }, stageId: null },
  { id: 'piranha',   name: 'Naval Piranha',    portrait: { x: 106, y: 465 }, stageId: null },
  { id: 'kamek',     name: 'Kamek',            portrait: { x: 106, y: 517 }, stageId: null },
  { id: 'bowser',    name: 'Bowser',           portrait: { x: 106, y: 573 }, stageId: null },
];

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

export { CHARACTERS, PORTRAIT_SIZE, sheet, buildPortraits, charStage, randomCharacter };
