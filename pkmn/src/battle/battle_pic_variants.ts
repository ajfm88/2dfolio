// A5e checkpoint-08b (note 83): the battle picture variants. Unused until checkpoint-08c wires them.
// pret b452f2ab engine/battle/animations.asm: AnimationSlideMonDown 1242-1257, AnimationFlashMonPic 1451-1457,
// AnimationShowMonPic 1464-1469, AnimationMinimizeMon 1808-1830, CopyTempPicToMonPic 1948-1957,
// AnimationSubstitute 2020-2062, HideSubstituteShowMonAnim 2064-2146, ReshowSubstituteAnim 2148-2151,
// AnimationTransformMon/ChangeMonPic 2165-2200, AnimateSubstituteBreaking 2214-2228, AnimationHideMonPic 2254-2280,
// GetMonSpriteTileMapPointerFromRowCount 2282-2307, CopyPicTiles/CopyTileIDs 2415-2468; home/pokemon.asm:98-137.
import { W_SPRITE_FLIPPED, indexToPokedex, type BattleState } from './battle_state';
import type { BattleScreen } from './battle_screen';
import type { BattleRenderTiles, RawImage } from './battle_screen_render';
import { delayFrames, type Program } from './battle_menu_context';
import { getMonHeader } from './battle_loaders';
import { animationSlideMonOff, loadMonBackPic, loadMonFrontSprite } from './battle_slides';
import { hudContext } from './battle_hud_state';
import { placePicture } from './battle_init';
import { D } from './battle_end_state';
import { textBgTransfer } from '../text/bg_transfer';

/** pret ram/wram.asm, ram/hram.asm; pokeyellow.sym 573535d. */
export const PIC_VARIANT = {
  wTempPic: 0xc6e8, // = wOverworldMap: the cartridge overwrites it, so the port does too
  wChangeMonPicEnemyTurnSpecies: 0xcee9, wChangeMonPicPlayerTurnSpecies: 0xceea,
  hBaseTileID: 0xff8b,
} as const;
const PIC_TILES = 49, TILE_BYTES = 16, PIC_BYTES = PIC_TILES * TILE_BYTES;
const FLY = 0x13, DIG = 0x5b, RHYDON = 0x01, NUM_POKEMON = 151;
const INVULNERABLE = 1 << 6, HAS_SUBSTITUTE_UP = 1 << 4;
const SHADES = [255, 170, 85, 0] as const;

export interface PicVariantHost {
  screen: BattleScreen;
  /** The session's shared tiles. Composed pictures are added by replacing `pictures`, never mutating it. */
  renderTiles: Pick<BattleRenderTiles, 'pictures'>;
  /** Decoded gfx/sprites/monster.png: MonsterSprite, two tiles wide, in ROM tile order. */
  monsterSprite: RawImage;
  /** battle_animations.json minimizedMonSprite (checkpoint-08a). */
  minimizedMonSprite: readonly number[];
  /** The session's existing name owners: front from wCurPartySpecies, back from wBattleMonSpecies2. */
  frontPicture(state: BattleState): string;
  backPicture(state: BattleState): string;
}

let composed = 0;
const playerTurn = (state: BattleState): boolean => state.hWhoseTurn === 0;

/** wTempPic's 784 bytes (column-major tiles, 2bpp) as a fresh 56x56 picture image. */
export function tempPicImage(state: BattleState): RawImage {
  const data = new Uint8ClampedArray(56 * 56 * 4);
  for (let tile = 0; tile < PIC_TILES; tile++) {
    const left = Math.floor(tile / 7) * 8, top = (tile % 7) * 8;
    for (let y = 0; y < 8; y++) {
      const lo = state.mem[PIC_VARIANT.wTempPic + tile * TILE_BYTES + y * 2];
      const hi = state.mem[PIC_VARIANT.wTempPic + tile * TILE_BYTES + y * 2 + 1];
      for (let x = 0; x < 8; x++) {
        const shade = SHADES[((hi >> (7 - x)) & 1) << 1 | ((lo >> (7 - x)) & 1)];
        const at = ((top + y) * 56 + left + x) * 4;
        data[at] = data[at + 1] = data[at + 2] = shade; data[at + 3] = 255;
      }
    }
  }
  return { width: 56, height: 56, data };
}

/** CopyTempPicToMonPic: CopyVideoData of PIC_SIZE tiles to vBackPic (player turn) or vFrontPic (enemy), 7 frames. */
export function* copyTempPicToMonPic(state: BattleState, host: PicVariantHost): Program {
  const key = `wTempPic#${++composed}`;
  host.renderTiles.pictures = new Map([...host.renderTiles.pictures, [key, tempPicImage(state)]]);
  const copy = playerTurn(state) ? host.screen.copyBack(key) : host.screen.copyFront(key);
  for (const _ of copy) { void _; yield 'serviced'; }
}

function clearTempPic(state: BattleState): void {
  state.mem.fill(0, PIC_VARIANT.wTempPic, PIC_VARIANT.wTempPic + PIC_BYTES);
}

/** CopyMonsterSpriteData: one MonsterSprite tile (2bpp from the committed PNG) to a wTempPic tile. */
function copyMonsterTile(state: BattleState, host: PicVariantHost, tile: number, x: number, y: number): void {
  const sheet = host.monsterSprite, across = sheet.width >>> 3;
  const at = PIC_VARIANT.wTempPic + (x * 7 + y) * TILE_BYTES;
  for (let row = 0; row < 8; row++) {
    let lo = 0, hi = 0;
    for (let col = 0; col < 8; col++) {
      const px = (tile % across) * 8 + col, py = Math.floor(tile / across) * 8 + row;
      const index = SHADES.indexOf(sheet.data[(py * sheet.width + px) * 4] as typeof SHADES[number]);
      if (index < 0) throw new Error('monster.png holds a non-Game Boy shade');
      lo |= (index & 1) << (7 - col); hi |= (index >> 1) << (7 - col);
    }
    state.mem[at + row * 2] = lo; state.mem[at + row * 2 + 1] = hi;
  }
}

/** The 5 MinimizedMonSprite rows at wTempPic + $194, each byte to both bitplanes. */
function writeMinimized(state: BattleState, host: PicVariantHost): void {
  let at = PIC_VARIANT.wTempPic + (7 * 3 + 4) * TILE_BYTES + TILE_BYTES / 4;
  for (const row of host.minimizedMonSprite) { state.mem[at++] = row; state.mem[at++] = row; }
}

/** CopyPicTiles over GetMonSpriteTileMapPointerFromRowCount: `rows` rows of MonTiles, 7 - rows lower. */
function copyPicTiles(state: BattleState, screen: BattleScreen, rows: number): void {
  const base = playerTurn(state) ? 0x31 : 0;
  state.mem[PIC_VARIANT.hBaseTileID] = base;
  const x = playerTurn(state) ? 1 : 12, y = (playerTurn(state) ? 5 : 0) + 7 - rows;
  textBgTransfer.enabled = false; // CopyTileIDs_NoBGTransfer
  for (let row = 0; row < rows; row++) for (let col = 0; col < 7; col++)
    screen.put(x + col, y + row, (base + row + 7 * col) & 255);
  textBgTransfer.enabled = true;
}

/** AnimationShowMonPic: CopyPicTiles, then Delay3. */
export function* animationShowMonPic(state: BattleState, screen: BattleScreen): Program {
  copyPicTiles(state, screen, 7);
  yield* delayFrames(3);
}

/** AnimationHideMonPic: ClearScreenArea 7x7 at the actor's picture. */
export function animationHideMonPic(state: BattleState, screen: BattleScreen): void {
  const x = playerTurn(state) ? 1 : 12, y = playerTurn(state) ? 5 : 0;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) screen.put(x + col, y + row, ' ');
}

/** AnimationSlideMonDown: seven steps, each drawn one row lower, held for Delay3, then cleared. */
export function* animationSlideMonDown(state: BattleState, screen: BattleScreen): Program {
  for (let rows = 7; rows > 0; rows--) {
    copyPicTiles(state, screen, rows);
    yield* delayFrames(3);
    animationHideMonPic(state, screen);
  }
}

/** LoadFrontSpriteByMonIndex (home/pokemon.asm:98-137), including the "Rhydon trap". */
function* loadFrontSpriteByMonIndex(state: BattleState, host: PicVariantHost, x: number, y: number): Program {
  const saved = state.wPokedexNum;
  state.wPokedexNum = state.wCurPartySpecies;
  indexToPokedex(state);
  const dex = state.wPokedexNum;
  state.wPokedexNum = saved;
  if (dex === 0 || dex > NUM_POKEMON) { state.wCurPartySpecies = RHYDON; return; }
  yield* loadMonFrontSprite(host.screen, host.frontPicture(state), state.mem[W_SPRITE_FLIPPED] !== 0);
  state.mem[D.hStartTileID] = 0;
  placePicture(state, host.screen, x, y);
  state.mem[W_SPRITE_FLIPPED] = 0;
}

/** ChangeMonPic: the player's back picture or the enemy's front picture, from the wChangeMonPic… cells. */
export function* changeMonPic(state: BattleState, host: PicVariantHost): Program {
  if (!playerTurn(state)) {
    state.wCurPartySpecies = state.wCurSpecies = state.mem[PIC_VARIANT.wChangeMonPicEnemyTurnSpecies];
    state.mem[W_SPRITE_FLIPPED] = 0;
    getMonHeader(state, state.wCurSpecies);
    yield* loadFrontSpriteByMonIndex(state, host, 12, 0);
    yield* setPalBattle(state, host.screen);
    return;
  }
  const saved = state.wBattleMonSpecies2;
  state.wBattleMonSpecies2 = state.wCurSpecies = state.mem[PIC_VARIANT.wChangeMonPicPlayerTurnSpecies];
  getMonHeader(state, state.wCurSpecies);
  yield* loadMonBackPic(state, host.screen, host.backPicture(state));
  copyPicTiles(state, host.screen, 7);
  state.wBattleMonSpecies2 = saved;
  yield* setPalBattle(state, host.screen);
}

/** ChangeMonPic's .done: RunPaletteCommand SET_PAL_BATTLE (the battle menu's sequence, battle_menu.ts hudPalette). */
function* setPalBattle(state: BattleState, screen: BattleScreen): Program {
  const ctx = hudContext(state);
  ctx.pokedexNum = ctx.enemySpecies2;
  yield* screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
    playerBar: ctx.playerHud.barColor as 0 | 1 | 2, enemyBar: ctx.enemyHud.barColor as 0 | 1 | 2 });
}

/** AnimationFlashMonPic: ChangeMonPic with the two current species (the actor's own picture again). */
export function* animationFlashMonPic(state: BattleState, host: PicVariantHost): Program {
  state.mem[PIC_VARIANT.wChangeMonPicPlayerTurnSpecies] = state.wBattleMonSpecies;
  state.mem[PIC_VARIANT.wChangeMonPicEnemyTurnSpecies] = state.wEnemyMonSpecies;
  yield* changeMonPic(state, host);
}

/** AnimationTransformMon: the actor's picture becomes the opponent's species. */
export function* animationTransformMon(state: BattleState, host: PicVariantHost): Program {
  state.mem[PIC_VARIANT.wChangeMonPicPlayerTurnSpecies] = state.wEnemyMonSpecies;
  state.mem[PIC_VARIANT.wChangeMonPicEnemyTurnSpecies] = state.wBattleMonSpecies;
  yield* changeMonPic(state, host);
}

/** AnimationSubstitute: the doll (MonsterSprite facing down for the enemy, up for the player). */
export function* animationSubstitute(state: BattleState, host: PicVariantHost): Program {
  clearTempPic(state);
  if (!playerTurn(state)) {
    copyMonsterTile(state, host, 0, 2, 4); copyMonsterTile(state, host, 1, 3, 4);
    copyMonsterTile(state, host, 2, 2, 5); copyMonsterTile(state, host, 3, 3, 5);
  } else {
    copyMonsterTile(state, host, 4, 3, 4); copyMonsterTile(state, host, 5, 4, 4);
    copyMonsterTile(state, host, 6, 3, 5); copyMonsterTile(state, host, 7, 4, 5);
  }
  yield* copyTempPicToMonPic(state, host);
  yield* animationShowMonPic(state, host.screen);
}

/** AnimationMinimizeMon: the black blob, Delay3, then shown. */
export function* animationMinimizeMon(state: BattleState, host: PicVariantHost): Program {
  clearTempPic(state);
  writeMinimized(state, host);
  yield* copyTempPicToMonPic(state, host);
  yield* delayFrames(3);
  yield* animationShowMonPic(state, host.screen);
}

/** HideSubstituteShowMonAnim: slide the doll away and bring the real (or minimized) mon back. */
export function* hideSubstituteShowMonAnim(state: BattleState, host: PicVariantHost): Program {
  const player = playerTurn(state);
  const minimized = player ? state.wPlayerMonMinimized : state.wEnemyMonMinimized;
  const status1 = player ? state.wPlayerBattleStatus1 : state.wEnemyBattleStatus1;
  const move = player ? state.wPlayerMoveNum : state.wEnemyMoveNum;
  const status2 = player ? state.wPlayerBattleStatus2 : state.wEnemyBattleStatus2;
  if (status2 & HAS_SUBSTITUTE_UP) yield* animationSlideMonOff(state, host.screen);
  else yield* animationSlideMonDown(state, host.screen);
  if ((status1 & INVULNERABLE) === 0 && (move === FLY || move === DIG)) {
    // .flyOrDig: the picture VRAM is reloaded, but nothing is placed on the tilemap.
    if ((player ? state.wPlayerMonMinimized : state.wEnemyMonMinimized) !== 0) {
      clearTempPic(state);
      writeMinimized(state, host);
      yield* copyTempPicToMonPic(state, host);
      return;
    }
    state.wCurPartySpecies = state.wCurSpecies = player ? state.wBattleMonSpecies : state.wEnemyMonSpecies;
    getMonHeader(state, state.wCurSpecies);
    if (player) yield* loadMonBackPic(state, host.screen, host.backPicture(state));
    else yield* loadMonFrontSprite(host.screen, host.frontPicture(state), state.mem[W_SPRITE_FLIPPED] !== 0);
    return;
  }
  if (minimized !== 0) { yield* animationMinimizeMon(state, host); return; }
  yield* animationFlashMonPic(state, host);
  yield* animationShowMonPic(state, host.screen);
}

/** ReshowSubstituteAnim: slide off, the doll, and AnimationShowMonPic once more. */
export function* reshowSubstituteAnim(state: BattleState, host: PicVariantHost): Program {
  yield* animationSlideMonOff(state, host.screen);
  yield* animationSubstitute(state, host);
  yield* animationShowMonPic(state, host.screen);
}

/** AnimateSubstituteBreaking: the minimized blob, or the mon's own picture again. */
export function* animateSubstituteBreaking(state: BattleState, host: PicVariantHost): Program {
  if ((playerTurn(state) ? state.wPlayerMonMinimized : state.wEnemyMonMinimized) !== 0) {
    yield* animationMinimizeMon(state, host);
    return;
  }
  yield* animationFlashMonPic(state, host);
  yield* animationShowMonPic(state, host.screen);
}
