import type { Direction } from '../core';
import { TILE_SIZE } from '../core';
import { drawSprite, loadSprite, getCtx, getScale } from '../renderer';
import { isHeld, isPassPressed } from '../input';
import { GameMap } from './map';
import type { Npc } from './npc';
import { playSFX, isSfxPlaying } from '../audio';
import { isNoClip } from '../debug';
import { PlayerWalk, HOP_LANDING_FRAMES, FRAMES_PER_PASS, walkFrame } from './walk_pace';
import type { StepCheck } from './walk_pace';
import {
  collisionMask, spriteInFront, pikachuInFront, DIRECTION_BIT, PIKACHU_SLOT, PLAYER_SLOT,
  PLAYER_SCREEN_X, PLAYER_SCREEN_Y,
} from './sprite_collision';
import type { CollisionSprite } from './sprite_collision';

// Sprite frame layout in red.png (16x96):
// y=0:  Standing Down    y=48: Walking Down
// y=16: Standing Up      y=64: Walking Up
// y=32: Standing Left    y=80: Walking Left  (flip horizontally for Right)
interface FrameSet { stand: number; walk: number }

const FRAMES: Record<Direction, FrameSet> = {
  down:  { stand: 0,  walk: 48 },
  up:    { stand: 16, walk: 64 },
  left:  { stand: 32, walk: 80 },
  right: { stand: 32, walk: 80 }, // drawn flipped
};

const MOVE_DISTANCE = 16;  // pixels per step (2 tiles)

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

const noSprites = (): void => {};

/**
 * The player. Movement runs once per overworld pass (two frames) through PlayerWalk,
 * the ASM's loop (walk_pace.ts): 2 px a pass, 8 passes a step.
 */
export class Player {
  x = 0;
  y = 0;
  spriteSheet: HTMLCanvasElement | null = null;
  private shadowSheet: HTMLCanvasElement | null = null;
  private shadowCanvas: HTMLCanvasElement | null = null;

  /** True for the pass that completed a step. */
  justFinishedStep = false;

  /** True for the pass that completed a ledge hop. */
  wasHopping = false;

  /** True for the pass a step began (its first 2 px are already taken). */
  justStartedStep = false;

  /** True for the pass a ledge hop's movement began. */
  startedHop = false;

  /** True when the player pressed a direction but couldn't move (collision). */
  justCollided = false;
  /** NewBattle also runs on a turning pass. */
  justTurned = false;
  /** StepCountCheck skips simulated inputs, including both halves of a hop. */
  stepWasSimulated = false;
  stepWasHop = false;
  /** Lets script passes distinguish a new boundary from stale per-pass flags. */
  stepsCompleted = 0;

  /** Where the movement began; stable map coordinates and deferred spawn use this. */
  stepStartX = 0;
  stepStartY = 0;

  private readonly walk = new PlayerWalk();
  private frameDelay = 0;

  // Scripted movement state
  private scriptedPath: Direction[] = [];
  private scriptedPathIndex = 0;
  scriptedMoveDone = false;

  /** The facing the sprite shows (wSpritePlayerStateData1FacingDirection). */
  get direction(): Direction { return this.walk.facing; }
  set direction(dir: Direction) { this.walk.facing = dir; }

  async loadSprite(): Promise<void> {
    this.spriteSheet = await loadSprite('/gfx/sprites/red.png');
    this.shadowSheet = await loadSprite('/gfx/overworld/shadow.png');
  }

  setTilePosition(tileX: number, tileY: number): void {
    this.x = tileX * TILE_SIZE;
    this.y = tileY * TILE_SIZE;
  }

  get isMoving(): boolean { return this.walk.moving; }
  get isLanding(): boolean { return this.walk.landingPending; }
  get ledgeHopFlag(): boolean { return this.walk.ledge; }
  get startedFollowStep(): boolean { return this.walk.startedFollowStep; }
  finishLanding(): void { this.walk.finishLanding(); }
  /** Moving, an armed ledge hop, or awaiting its landing pass. */
  get isBusy(): boolean { return this.walk.busy; }
  get tileX(): number { return Math.round(this.x / TILE_SIZE); }
  get tileY(): number { return Math.round(this.y / TILE_SIZE); }
  /** wXCoord/wYCoord change at step end, never as the pixels interpolate. */
  get mapStepX(): number { return this.mapPosition('x') / MOVE_DISTANCE; }
  get mapStepY(): number { return this.mapPosition('y') / MOVE_DISTANCE; }

  /** wSpritePlayerStateData1CollisionData: the directions blocked by other sprites, set
   *  by UpdatePlayerSprite at the start of UpdateSprites, before the NPCs move. */
  spriteCollisions = 0;

  /** wPikachuCollisionCounter (walk_pace.ts PlayerWalk). */
  get pikachuCollisionCounter(): number { return this.walk.pikachuCollisionCounter; }

  /** Slot 0 of the sprite table: always at screen ($40, $3c). */
  collisionSprite(): CollisionSprite {
    return {
      slot: PLAYER_SLOT, available: true, x: PLAYER_SCREEN_X, y: PLAYER_SCREEN_Y,
      vx: this.walk.vx, vy: this.walk.vy,
    };
  }

  /** UpdatePlayerSprite → DetectCollisionBetweenSprites. */
  detectSpriteCollisions(table: readonly CollisionSprite[]): void {
    this.spriteCollisions = collisionMask(this.collisionSprite(), table);
  }

  /** Frames the next pass waits (Delay3 after a hop lands); read once. */
  takeFrameDelay(): number {
    const d = this.frameDelay;
    this.frameDelay = 0;
    return d;
  }

  /** Get the tile position the player is facing. */
  getFacingTile(): { tx: number; ty: number } {
    const dx = this.direction === 'left' ? -MOVE_DISTANCE : this.direction === 'right' ? MOVE_DISTANCE : 0;
    const dy = this.direction === 'up' ? -MOVE_DISTANCE : this.direction === 'down' ? MOVE_DISTANCE : 0;
    return {
      tx: Math.round((this.x + dx) / TILE_SIZE),
      ty: Math.round((this.y + dy) / TILE_SIZE),
    };
  }

  /** Check if player wants to interact (A button) and return the interacted NPC, sign text, or hidden item. */
  checkInteraction(gameMap: GameMap, npcs: Npc[]): { npc: Npc } | { text: string } | { item: string; flag: string } | { scriptId: string } | null {
    if (!isPassPressed('a') || this.isBusy) return null;

    const facing = this.getFacingTile();

    // Check NPCs (16x16 sprites occupy 2x2 tiles)
    const npcAt = (tx: number, ty: number): Npc | null => {
      for (const npc of npcs) {
        if (npc.hidden) continue;
        if (tx >= npc.tileX && tx < npc.tileX + 2 &&
            ty >= npc.tileY && ty < npc.tileY + 2) {
          return npc;
        }
      }
      return null;
    };

    let found = npcAt(facing.tx, facing.ty);

    // Counter tile: if no NPC at 1 step and that tile is not walkable, check 2 steps ahead
    if (!found && !gameMap.isWalkable(facing.tx, facing.ty)) {
      const dx = this.direction === 'left' ? -MOVE_DISTANCE : this.direction === 'right' ? MOVE_DISTANCE : 0;
      const dy = this.direction === 'up' ? -MOVE_DISTANCE : this.direction === 'down' ? MOVE_DISTANCE : 0;
      const farTx = Math.round((this.x + dx * 2) / TILE_SIZE);
      const farTy = Math.round((this.y + dy * 2) / TILE_SIZE);
      found = npcAt(farTx, farTy);
    }

    if (found) {
      if (!found.data.object) {
        found.faceDirection(OPPOSITE[this.direction]);
      }
      return { npc: found };
    }

    // Check signs (coords are in 16px step units)
    const stepX = Math.floor(facing.tx / 2);
    const stepY = Math.floor(facing.ty / 2);
    const signText = gameMap.getSignAt(stepX, stepY);
    if (signText) return { text: signText };

    // Check hidden events (tile-based interactions: TVs, PCs, bookshelves, hidden items)
    const hiddenEvent = gameMap.getHiddenEventAt(stepX, stepY, this.direction);
    if (hiddenEvent) {
      if (hiddenEvent.scriptId) {
        return { scriptId: hiddenEvent.scriptId };
      }
      if (hiddenEvent.item && hiddenEvent.flag) {
        return { item: hiddenEvent.item, flag: hiddenEvent.flag };
      }
      if (hiddenEvent.text) return { text: hiddenEvent.text };
    }

    // Check bookshelf tiles (generic tile-based text per tileset)
    // Check the tile directly adjacent to the sprite (1 tile ahead, not a full step)
    const adjTx = this.tileX + (this.direction === 'left' ? -1 : this.direction === 'right' ? 1 : 0);
    const adjTy = this.tileY + (this.direction === 'up' ? -1 : this.direction === 'down' ? 1 : 0);
    const bookshelfText = gameMap.getBookshelfText(adjTx, adjTy)
      ?? gameMap.getBookshelfText(facing.tx, facing.ty);
    if (bookshelfText) return { text: bookshelfText };

    return null;
  }

  /** Cancel any in-progress movement (used when repositioning player on map transitions). */
  cancelMovement(): void {
    this.walk.cancel();
    this.frameDelay = 0;
  }

  /** Start a scripted walk along a list of directions (simulated presses; like upstream,
   *  no collision). */
  startScriptedMove(path: Direction[]): void {
    this.scriptedPath = path;
    this.scriptedPathIndex = 0;
    this.scriptedMoveDone = path.length === 0;
    this.walk.cancel();
  }

  /** One step with no collision check (PlayerStepOutFromDoor's simulated DOWN press). */
  forceStep(dir: Direction, updateSprites: () => void = noSprites): void {
    this.runPass(dir, true, () => 'walk', updateSprites);
  }

  /** One pass of a scripted walk. `scriptedMoveDone` is set once the last step has ended. */
  updateScriptedMove(updateSprites: () => void = noSprites): void {
    if (this.scriptedMoveDone) return;
    let input: Direction | null = null;
    if (!this.walk.moving && this.scriptedPathIndex < this.scriptedPath.length) {
      input = this.scriptedPath[this.scriptedPathIndex];
    }
    this.runPass(input, true, () => 'walk', updateSprites);
    if (this.walk.startedStep) this.scriptedPathIndex++;
    if (!this.walk.moving && this.scriptedPathIndex >= this.scriptedPath.length) {
      this.scriptedMoveDone = true;
    }
  }

  /**
   * One overworld pass. `simulated` replaces the joypad (null = nothing pressed), as
   * StartSimulatingJoypadStates does: the step still goes through collision and
   * ledges, but a new direction takes no turning pass (.noDirectionChange).
   * `updateSprites` runs the NPCs and Pikachu where the ASM's loop calls UpdateSprites.
   * `sprites` is the live sprite table for the exact-front check (overworld/sprites.ts
   * spriteTable); without it the check sees the player and `npcs` only.
   */
  update(
    gameMap: GameMap,
    npcs: Npc[],
    simulated?: Direction | null,
    updateSprites: () => void = noSprites,
    sprites?: () => readonly CollisionSprite[],
  ): void {
    let input: Direction | null;
    if (this.isLanding) {
      input = null;
    } else if (simulated !== undefined) {
      input = simulated;
    } else if (isHeld('up')) input = 'up';
    else if (isHeld('down')) input = 'down';
    else if (isHeld('left')) input = 'left';
    else if (isHeld('right')) input = 'right';
    else input = null;

    const table = sprites ?? ((): CollisionSprite[] => [
      this.collisionSprite(),
      ...npcs.map((npc, i) => npc.collisionSprite(this.x, this.y, i + 1)),
    ]);
    this.runPass(input, simulated !== undefined, dir => this.checkStep(gameMap, table, dir), updateSprites);

    // CollisionCheckOnLand: SFX_COLLISION unless it's already the sound playing
    if (this.justCollided && !isSfxPlaying('collision')) playSFX('collision');
  }

  /**
   * CollisionCheckOnLand, HandleLedges: can the player step that way? First the mask
   * UpdatePlayerSprite took, then the sprite exactly in front (IsSpriteInFrontOfPlayer, at
   * the screen pixels after this pass's sprite updates). The following Pikachu there blocks
   * only while the turn-armed counter runs down, and never with B held. Then the terrain.
   */
  private checkStep(gameMap: GameMap, sprites: () => readonly CollisionSprite[], dir: Direction): StepCheck {
    if (isNoClip()) return 'walk';
    const moveDx = dir === 'left' ? -MOVE_DISTANCE : dir === 'right' ? MOVE_DISTANCE : 0;
    const moveDy = dir === 'up' ? -MOVE_DISTANCE : dir === 'down' ? MOVE_DISTANCE : 0;
    const targetTileX = Math.round((this.x + moveDx) / TILE_SIZE);
    const targetTileY = Math.round((this.y + moveDy) / TILE_SIZE);

    if (this.spriteCollisions & DIRECTION_BIT[dir]) return 'blocked';
    const front = spriteInFront(sprites(), dir);
    if (front) {
      if (front.slot !== PIKACHU_SLOT) return 'blocked';
      // CheckPikachuFollowingPlayer: the engine has no state where a following Pikachu
      // stops following without leaving the overworld, so it is always following here
      const gate = pikachuInFront(this.walk.pikachuCollisionCounter, isHeld('b'), false);
      this.walk.pikachuCollisionCounter = gate.counter;
      if (gate.blocked) return 'blocked';
    }

    // Check walkability (works for both in-bounds and connected map tiles).
    // For out-of-bounds tiles without a connection, getTileAt returns border block
    // which is typically not walkable, so this naturally prevents walking off edges.
    if (gameMap.isWalkable(targetTileX, targetTileY)) return 'walk';
    if (gameMap.isLedge(this.tileX, this.tileY, dir)) return 'hop';
    return 'blocked';
  }

  private runPass(input: Direction | null, simulated: boolean, check: (dir: Direction) => StepCheck, updateSprites: () => void): void {
    const startX = this.x;
    const startY = this.y;
    this.walk.pass(input, simulated, check, updateSprites);
    const w = this.walk;
    this.justStartedStep = w.startedStep;
    this.justFinishedStep = w.finishedStep;
    // The hop's first pass collides too, but SFX_LEDGE is the sound heard (V5 extracts it)
    this.justCollided = w.collided;
    this.justTurned = w.turned;
    this.stepWasSimulated = simulated || w.hopping || w.landedHop;
    this.stepWasHop = w.hopping || w.landedHop;
    if (w.finishedStep) this.stepsCompleted++;
    this.startedHop = w.startedHop;
    this.wasHopping = w.landedHop;
    if (w.startedStep) {
      this.stepStartX = startX;
      this.stepStartY = startY;
    }
    this.x += w.dx;
    this.y += w.dy;
    if (w.landedPass) this.frameDelay += HOP_LANDING_FRAMES - FRAMES_PER_PASS;
  }

  private mapPosition(axis: 'x' | 'y'): number {
    if (!this.walk.moving) return this[axis];
    const completed = Math.floor(this.walk.progress / MOVE_DISTANCE) * MOVE_DISTANCE;
    const dir = this.walk.stepDir;
    const d = axis === 'x' ? (dir === 'left' ? -1 : dir === 'right' ? 1 : 0)
      : (dir === 'up' ? -1 : dir === 'down' ? 1 : 0);
    return (axis === 'x' ? this.stepStartX : this.stepStartY) + d * completed;
  }

  // Original Game Boy: player sprite at screen (X=$40=64, Y=$3c=60)
  // PrepareOAMData adds OAM offsets (+8,+16), hardware subtracts them back
  getCameraX(): number { return this.x - 64; }
  getCameraY(): number { return this.y - 60; }

  render(cameraX: number, cameraY: number): void {
    if (!this.spriteSheet) return;

    const screenX = this.x - cameraX;
    // -4px offset matches original GB sprite positioning; a hop adds the jump table's Y
    const screenY = this.y - cameraY - 4 + this.walk.hopOffset;
    const frame = FRAMES[this.direction];
    const { walking, mirrored } = walkFrame(this.direction, this.walk.anim.frame);
    const frameY = walking ? frame.walk : frame.stand;
    const flipX = (this.direction === 'right') !== mirrored;

    drawSprite(this.spriteSheet, 0, frameY, screenX, screenY, flipX);
  }

  /** OAM 36/37: above all BG, below sprite pixels, including pixels hidden by grass.
   * Only the player can overlap: Pikachu is a step behind and NPCs cannot occupy it. */
  renderLedgeShadow(cameraX: number, cameraY: number): void {
    if (!this.walk.ledge || !this.shadowSheet || !this.spriteSheet) return;
    if (!this.shadowCanvas) {
      this.shadowCanvas = document.createElement('canvas');
      this.shadowCanvas.width = 16;
      this.shadowCanvas.height = 8;
    }
    const ctx = this.shadowCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 16, 8);
    ctx.drawImage(this.shadowSheet, 0, 0);
    ctx.save();
    ctx.translate(16, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.shadowSheet, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const frame = FRAMES[this.direction];
    const { walking, mirrored } = walkFrame(this.direction, this.walk.anim.frame);
    if ((this.direction === 'right') !== mirrored) {
      ctx.translate(16, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.spriteSheet, 0, walking ? frame.walk : frame.stand, 16, 16,
      0, -12 + this.walk.hopOffset, 16, 16);
    ctx.restore();
    const scale = getScale();
    getCtx().drawImage(this.shadowCanvas, (this.x - cameraX) * scale,
      (this.y - cameraY + 8) * scale, 16 * scale, 8 * scale);
  }
}
