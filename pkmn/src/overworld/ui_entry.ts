// The moment a text box or menu opens over the map (A6c review R-1/R-2).
//
// DisplayTextIDInit (engine/menus/display_text_id_init.asm) draws the box, sets
// BIT_FONT_LOADED, then calls UpdateSprites once. In that update Pikachu is hidden if
// the box covers it, and otherwise goes back to ready (Func_fc76a), or turns to the
// player when talked to (Func_fc745). The engine runs it once per opening, in the tick
// the UI opened, from the boxes that UI draws — never from how often frames render.

import type { Player } from './player';
import type { GameMap } from './map';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import { uiTiles } from '../renderer/ui_tiles';

/** States that draw a box or menu over the map. Full-screen menus (party, Pokédex,
 *  trainer card, options, town map) are not here: returning from one redraws the START
 *  menu, which runs UpdateSprites again (start_menu.asm RedisplayStartMenu). */
const UI_STATES: ReadonlySet<string> = new Set([
  'textbox', 'start_menu', 'pikachu_emotion', 'shop', 'pc', 'pokecenter_pc', 'blackboard',
  'item_menu', 'save_menu',
]);

/** States where the map runs with an optional text box on top (script text). */
const MAP_STATES: ReadonlySet<string> = new Set(['overworld', 'script', 'emotion_bubble']);

/** A text box or menu is up over the map. */
export function overworldUiOpen(state: string, textBoxActive: boolean): boolean {
  return UI_STATES.has(state) || (MAP_STATES.has(state) && textBoxActive);
}

/** Reports each opening once (closed → open). */
export class UiEntry {
  private open = false;

  opened(open: boolean): boolean {
    const rising = open && !this.open;
    this.open = open;
    return rising;
  }
}

/**
 * UpdateSprites with the font loaded, for the sprites this engine models there: Pikachu.
 * `tileAt` holds the UI the opening just drew. (NPCs' NotYetMoving there is not ported;
 * their whole-sprite hiding stays at render, as in A6b.)
 */
export function fontLoadedUpdateSprites(
  player: Player,
  gameMap: GameMap,
  tileAt: (tx: number, ty: number) => number,
  pikachuFollower?: PikachuFollower,
): void {
  if (!pikachuFollower?.visible) return;
  pikachuFollower.fontLoadedUpdate({
    playerWalking: player.isMoving,
    playerMapStep: { x: player.mapStepX, y: player.mapStepY },
    playerFacing: player.direction,
    ui: { playerX: player.x, playerY: player.y, tileAt },
    inGrass: gameMap.isGrassTile(pikachuFollower.tileX, pikachuFollower.tileY),
  });
}

let openingSpriteUpdates = true;

/**
 * Whether a box opening runs DisplayTextIDInit's UpdateSprites. A script that prints
 * several texts inside one DisplayTextID (the Pokécenter's PrintText calls) turns it off
 * after its first box, and on again at its end. The boxes are still captured.
 */
export function setOpeningSpriteUpdates(enabled: boolean): void {
  openingSpriteUpdates = enabled;
}

/**
 * One opening, in source order. `captureLayer` draws the state's UI layer and registers
 * its tiles (main.ts: `captureUi(drawUiLayer)`).
 *   - Usually DisplayTextIDInit draws the box, then runs UpdateSprites.
 *   - Talking to Pikachu (`pikachu_emotion`): InitializePikachuTextID sets
 *     wAutoTextBoxDrawingControl, so DisplayTextIDInit draws no border and its
 *     UpdateSprites sees the bare map — the face-player turn happens there. The portrait's
 *     border comes later (PlacePikapicTextBoxBorder), with another UpdateSprites.
 * Closing needs nothing here: the box leaves the tile map (CloseTextDisplay) and the next
 * ordinary pass sees Pikachu again.
 */
export function openOverworldUi(
  state: string,
  player: Player,
  gameMap: GameMap,
  pikachuFollower: PikachuFollower | undefined,
  captureLayer: () => void,
): void {
  if (!pikachuFollower?.visible) return;
  if (!openingSpriteUpdates) {
    captureLayer();
    return;
  }
  if (state === 'pikachu_emotion') {
    // No border yet: the movement prelude and then the portrait's own border follow
    // (pikachu/pikachu_emotion.ts tickPikachuEmotionEntry)
    fontLoadedUpdateSprites(player, gameMap, () => 0, pikachuFollower);
    return;
  }
  captureLayer();
  fontLoadedUpdateSprites(player, gameMap, uiTiles.tileAt, pikachuFollower);
}
