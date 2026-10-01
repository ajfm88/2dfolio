import type { Direction } from '../core';
import { TILE_SIZE } from '../core';
import { drawSprite, loadSprite } from '../renderer';
import { isHeld, isPressed } from '../input';
import { GameMap } from './map';
import type { Npc } from './npc';
import { playSFX } from '../audio';
import { isNoClip } from '../debug';

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

const WALK_SPEED = 2;      // 2 pixels per frame (assembly: step vector doubled via `add a`)
const MOVE_DISTANCE = 16;  // pixels per step (2 tiles)
const LEDGE_HOP_DISTANCE = 32; // 2 steps for ledge hop

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

export class Player {
  x = 0;
  y = 0;
  direction: Direction = 'down';
  spriteSheet: HTMLCanvasElement | null = null;

  /** True for exactly one frame after completing a step. */
  justFinishedStep = false;

  /** True for exactly one frame after completing a ledge hop. */
  wasHopping = false;

  /** True for exactly one frame when a step begins (before any movement). */
  justStartedStep = false;

  /** True for exactly one frame when a ledge hop begins. */
  startedHop = false;

  /** True when the player pressed a direction but couldn't move (collision). */
  justCollided = false;

  private moving = false;
  private moveProgress = 0;
  private targetX = 0;
  private targetY = 0;
  private stepCount = 0;
  private hopping = false;       // true during ledge hop
  private hopDistance = 0;        // total distance for current move
  private bumpTimer = 0;         // frames of "bumping" animation when walking into wall
  private bumping = false;       // true while playing bump animation

  // Scripted movement state
  private scriptedPath: Direction[] = [];
  private scriptedPathIndex = 0;
  scriptedMoveDone = false;

  async loadSprite(): Promise<void> {
    this.spriteSheet = await loadSprite('/gfx/sprites/red.png');
  }

  setTilePosition(tileX: number, tileY: number): void {
    this.x = tileX * TILE_SIZE;
    this.y = tileY * TILE_SIZE;
  }

  get isMoving(): boolean { return this.moving; }
  get tileX(): number { return Math.round(this.x / TILE_SIZE); }
  get tileY(): number { return Math.round(this.y / TILE_SIZE); }
  /** Tile position being moved to (or current if stationary). Used for collision reservation. */
  get claimedTileX(): number { return this.moving ? Math.round(this.targetX / TILE_SIZE) : this.tileX; }
  get claimedTileY(): number { return this.moving ? Math.round(this.targetY / TILE_SIZE) : this.tileY; }

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
    if (!isPressed('a') || this.moving) return null;

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
    this.moving = false;
    this.moveProgress = 0;
  }

  /** Start a scripted walk along a list of directions. */
  startScriptedMove(path: Direction[]): void {
    this.scriptedPath = path;
    this.scriptedPathIndex = 0;
    this.scriptedMoveDone = false;
    // Cancel any in-progress movement to prevent stale step bleeding into new path
    this.moving = false;
    this.moveProgress = 0;
  }

  /** Start a single forced step (no collision check, no input). Used for auto-step
   *  out of doors after warp, matching assembly PlayerStepOutFromDoor. */
  forceStep(dir: Direction): void {
    this.direction = dir;
    const moveDx = dir === 'left' ? -MOVE_DISTANCE : dir === 'right' ? MOVE_DISTANCE : 0;
    const moveDy = dir === 'up' ? -MOVE_DISTANCE : dir === 'down' ? MOVE_DISTANCE : 0;
    this.targetX = this.x + moveDx;
    this.targetY = this.y + moveDy;
    this.moving = true;
    this.hopping = false;
    this.hopDistance = MOVE_DISTANCE;
    this.moveProgress = 0;
  }

  /** Update scripted movement (call each frame while in script state). */
  updateScriptedMove(): void {
    if (this.scriptedMoveDone) return;

    if (this.moving) {
      this.moveProgress += WALK_SPEED;
      const dist = MOVE_DISTANCE;
      const t = Math.min(this.moveProgress / dist, 1);
      const dx = this.direction === 'left' ? dist :
                 this.direction === 'right' ? -dist : 0;
      const dy = this.direction === 'up' ? dist :
                 this.direction === 'down' ? -dist : 0;
      const startX = this.targetX + dx;
      const startY = this.targetY + dy;
      this.x = startX + (this.targetX - startX) * t;
      this.y = startY + (this.targetY - startY) * t;

      if (this.moveProgress >= dist) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.moving = false;
        this.moveProgress = 0;
      }
      return;
    }

    // Start next step
    if (this.scriptedPathIndex >= this.scriptedPath.length) {
      this.scriptedMoveDone = true;
      return;
    }

    const dir = this.scriptedPath[this.scriptedPathIndex++];
    this.direction = dir;
    const moveDx = dir === 'left' ? -MOVE_DISTANCE : dir === 'right' ? MOVE_DISTANCE : 0;
    const moveDy = dir === 'up' ? -MOVE_DISTANCE : dir === 'down' ? MOVE_DISTANCE : 0;
    this.targetX = this.x + moveDx;
    this.targetY = this.y + moveDy;
    this.moving = true;
    this.hopping = false;
    this.hopDistance = MOVE_DISTANCE;
    this.moveProgress = 0;
  }

  update(gameMap: GameMap, npcs: Npc[]): void {
    this.justFinishedStep = false;
    this.wasHopping = false;
    this.justCollided = false;
    this.justStartedStep = false;
    this.startedHop = false;

    // Advance bump animation timer (walking-in-place into wall)
    if (this.bumping) {
      this.bumpTimer++;
      // One full "step" cycle = MOVE_DISTANCE frames (16).
      // Replay collision SFX at each cycle boundary.
      if (this.bumpTimer >= MOVE_DISTANCE / WALK_SPEED) {
        this.bumpTimer = 0;
        playSFX('collision');
      }
    }

    if (this.moving) {
      this.moveProgress += WALK_SPEED;
      const dist = this.hopDistance;
      const t = Math.min(this.moveProgress / dist, 1);

      const dx = this.direction === 'left' ? dist :
                 this.direction === 'right' ? -dist : 0;
      const dy = this.direction === 'up' ? dist :
                 this.direction === 'down' ? -dist : 0;
      const startX = this.targetX + dx;
      const startY = this.targetY + dy;

      this.x = startX + (this.targetX - startX) * t;
      this.y = startY + (this.targetY - startY) * t;

      if (this.moveProgress >= dist) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.wasHopping = this.hopping;
        this.moving = false;
        this.hopping = false;
        this.moveProgress = 0;
        this.stepCount++;
        this.justFinishedStep = true;
        // Don't return — fall through to input check so the next step
        // starts on the same frame (matching assembly: wWalkCounter==0
        // falls through to movement check without a 1-frame gap).
      } else {
        return; // still mid-step, don't check input
      }
    }

    // Check for new movement input
    let moveDx = 0, moveDy = 0;
    let newDir: Direction | null = null;

    if (isHeld('up'))         { moveDy = -MOVE_DISTANCE; newDir = 'up'; }
    else if (isHeld('down'))  { moveDy = MOVE_DISTANCE;  newDir = 'down'; }
    else if (isHeld('left'))  { moveDx = -MOVE_DISTANCE; newDir = 'left'; }
    else if (isHeld('right')) { moveDx = MOVE_DISTANCE;  newDir = 'right'; }

    if (!newDir) {
      this.bumping = false;
      this.bumpTimer = 0;
      return;
    }

    if (newDir) {
      // Turn in place first — only walk if already facing this direction.
      // Assembly: direction change sets BIT_TURNING and loops back to OverworldLoop,
      // taking exactly 1 frame before the next movement check.
      if (this.direction !== newDir) {
        this.direction = newDir;
        return; // 1-frame turn, next frame will check movement
      }

      const newX = this.x + moveDx;
      const newY = this.y + moveDy;
      const targetTileX = Math.round(newX / TILE_SIZE);
      const targetTileY = Math.round(newY / TILE_SIZE);

      // Check NPC collision (NPCs occupy 2x2 tile area)
      // Use claimedTile to check where NPCs are heading, preventing walk-through races
      const hitsNpc = !isNoClip() && npcs.some(npc => {
        if (npc.hidden) return false;
        const npcTx = npc.claimedTileX;
        const npcTy = npc.claimedTileY;
        return targetTileX < npcTx + 2 && targetTileX + 2 > npcTx &&
               targetTileY < npcTy + 2 && targetTileY + 2 > npcTy;
      });

      if (hitsNpc) return;

      // Check walkability (works for both in-bounds and connected map tiles).
      // For out-of-bounds tiles without a connection, getTileAt returns border block
      // which is typically not walkable, so this naturally prevents walking off edges.
      const canWalk = isNoClip() || gameMap.isWalkable(targetTileX, targetTileY);

      if (canWalk) {
        this.bumping = false;
        this.bumpTimer = 0;
        this.targetX = newX;
        this.targetY = newY;
        this.moving = true;
        this.hopping = false;
        this.hopDistance = MOVE_DISTANCE;
        this.moveProgress = 0;
        this.justStartedStep = true;
      } else if (gameMap.isLedge(this.tileX, this.tileY, newDir)) {
        // Ledge hop: move 2 steps (32px) in the facing direction
        this.targetX = this.x + moveDx * 2;
        this.targetY = this.y + moveDy * 2;
        this.moving = true;
        this.hopping = true;
        this.hopDistance = LEDGE_HOP_DISTANCE;
        this.moveProgress = 0;
        this.justStartedStep = true;
        this.startedHop = true;
      } else {
        // Collision: tried to move but couldn't walk or hop.
        // On real GB, the player does a walking-in-place animation and the
        // collision sound plays once per step attempt (~16 frames).
        this.justCollided = true;
        if (!this.bumping) {
          this.bumping = true;
          this.bumpTimer = 0;
          playSFX('collision');
        }
      }
    }
  }

  // Original Game Boy: player sprite at screen (X=$40=64, Y=$3c=60)
  // PrepareOAMData adds OAM offsets (+8,+16), hardware subtracts them back
  getCameraX(): number { return this.x - 64; }
  getCameraY(): number { return this.y - 60; }

  render(cameraX: number, cameraY: number): void {
    if (!this.spriteSheet) return;

    const screenX = this.x - cameraX;
    let screenY = this.y - cameraY - 4; // -4px offset matches original GB sprite positioning
    const frame = FRAMES[this.direction];
    const flipX = this.direction === 'right';

    let frameY: number;
    if (this.moving) {
      const phase = Math.floor(this.moveProgress / (MOVE_DISTANCE / 4));
      frameY = (phase === 1 || phase === 3) ? frame.walk : frame.stand;

      // Hop animation: parabolic vertical offset during ledge jump
      if (this.hopping) {
        const t = this.moveProgress / this.hopDistance; // 0 → 1
        const hopHeight = -Math.sin(t * Math.PI) * 10; // up to 10px arc
        screenY += hopHeight;
      }
    } else if (this.bumping) {
      // Walking-in-place animation when bumping into a wall
      // Step has 4 phases over (MOVE_DISTANCE / WALK_SPEED) frames
      const framesPerStep = MOVE_DISTANCE / WALK_SPEED;
      const phase = Math.floor(this.bumpTimer / (framesPerStep / 4));
      frameY = (phase === 1 || phase === 3) ? frame.walk : frame.stand;
    } else {
      frameY = frame.stand;
    }

    drawSprite(this.spriteSheet, 0, frameY, screenX, screenY, flipX);
  }
}
