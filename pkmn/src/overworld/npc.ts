import type { Direction, NpcData } from '../core';
import { TILE_SIZE } from '../core';
import { drawSprite, loadSprite, drawExclamationBubble } from '../renderer';

// Same sprite frame layout as player (16x96 sprite sheets)
interface FrameSet { stand: number; walk: number }

const FRAMES: Record<Direction, FrameSet> = {
  down:  { stand: 0,  walk: 48 },
  up:    { stand: 16, walk: 64 },
  left:  { stand: 32, walk: 80 },
  right: { stand: 32, walk: 80 }, // drawn flipped
};

const STEP_SIZE = 16;   // pixels per step (2 tiles)
const WALK_SPEED = 2;   // 2 pixels per frame (matching player and assembly)

// Random walk: wait 60-180 frames between steps
const WALK_DELAY_MIN = 60;
const WALK_DELAY_MAX = 180;

export class Npc {
  readonly data: NpcData;
  x: number;
  y: number;
  direction: Direction = 'down';
  private spriteSheet: HTMLCanvasElement | null = null;

  // Movement state
  private isMoving = false;
  private moveProgress = 0;
  private targetX = 0;
  private targetY = 0;
  private walkTimer = 0;
  private stepCount = 0;

  // Trainer approach state
  approaching = false;        // true while walking toward the player
  showExclamation = false;    // true while "!" is displayed
  private exclamationTimer = 0;
  private approachTargetX = 0;
  private approachTargetY = 0;
  approachDone = false;       // set when trainer arrives next to player

  // Scripted movement state
  private scriptedPath: Direction[] = [];
  private scriptedPathIndex = 0;
  scriptedMoveDone = false;
  hidden = false;             // if true, skip rendering and updates
  useWalkFrame = false;       // if true, show walk frame (used for nurse bow)

  /** The NPC's resting direction (from map data). Restored after interaction. */
  readonly defaultDirection: Direction;

  // Post-interaction restore: countdown before turning back to default direction
  private restoreTimer = 0;

  // Starting position for walk range bounding (assembly: XDISPLACEMENT/YDISPLACEMENT)
  private startX: number;
  private startY: number;
  private static readonly MAX_WALK_RANGE = 2 * STEP_SIZE; // max 2 steps from start

  constructor(data: NpcData) {
    this.data = data;
    // NPC coords are in 16px step units
    this.x = data.x * STEP_SIZE;
    this.y = data.y * STEP_SIZE;
    this.startX = this.x;
    this.startY = this.y;
    this.defaultDirection = data.direction ?? 'down';
    this.direction = this.defaultDirection;
    this.walkTimer = WALK_DELAY_MIN + Math.floor(Math.random() * (WALK_DELAY_MAX - WALK_DELAY_MIN));
  }

  async load(): Promise<void> {
    this.spriteSheet = await loadSprite(`/gfx/sprites/${this.data.sprite}.png`);
  }

  get tileX(): number { return Math.round(this.x / TILE_SIZE); }
  get tileY(): number { return Math.round(this.y / TILE_SIZE); }
  /** Tile position being moved to (or current if stationary). Used for collision reservation. */
  get claimedTileX(): number { return this.isMoving ? Math.round(this.targetX / TILE_SIZE) : this.tileX; }
  get claimedTileY(): number { return this.isMoving ? Math.round(this.targetY / TILE_SIZE) : this.tileY; }

  /** Turn to face the player for interaction. */
  faceDirection(dir: Direction): void {
    this.direction = dir;
  }

  /** Schedule restoring the NPC's default facing direction after a delay. */
  restoreDirection(): void {
    // ~2 seconds at 60fps, matching the original game's sprite update cycle
    this.restoreTimer = 120;
  }

  update(isWalkable: (tx: number, ty: number) => boolean, playerTileX: number, playerTileY: number, allNpcs?: Npc[], pikachuTile?: { x: number; y: number }): void {
    if (this.hidden) return;

    // Post-interaction: count down then restore default facing direction
    if (this.restoreTimer > 0) {
      this.restoreTimer--;
      if (this.restoreTimer <= 0) {
        this.direction = this.defaultDirection;
      }
    }

    if (this.isMoving) {
      this.moveProgress += WALK_SPEED;
      const t = Math.min(this.moveProgress / STEP_SIZE, 1);

      const dx = this.direction === 'left' ? STEP_SIZE :
                 this.direction === 'right' ? -STEP_SIZE : 0;
      const dy = this.direction === 'up' ? STEP_SIZE :
                 this.direction === 'down' ? -STEP_SIZE : 0;
      const startX = this.targetX + dx;
      const startY = this.targetY + dy;

      this.x = startX + (this.targetX - startX) * t;
      this.y = startY + (this.targetY - startY) * t;

      if (this.moveProgress >= STEP_SIZE) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.isMoving = false;
        this.moveProgress = 0;
        this.stepCount++;
      }
      return;
    }

    if (this.data.movement !== 'walk') return;

    this.walkTimer--;
    if (this.walkTimer > 0) return;

    // Pick random direction respecting walkDir constraint
    const constraint = this.data.walkDir ?? 'any';
    let dirs: Direction[];
    if (constraint === 'up_down') dirs = ['up', 'down'];
    else if (constraint === 'left_right') dirs = ['left', 'right'];
    else dirs = ['up', 'down', 'left', 'right'];

    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const dx = dir === 'left' ? -STEP_SIZE : dir === 'right' ? STEP_SIZE : 0;
    const dy = dir === 'up' ? -STEP_SIZE : dir === 'down' ? STEP_SIZE : 0;

    this.direction = dir;
    const newX = this.x + dx;
    const newY = this.y + dy;
    const targetTileX = Math.round(newX / TILE_SIZE);
    const targetTileY = Math.round(newY / TILE_SIZE);

    // Bound check: don't walk too far from starting position
    if (Math.abs(newX - this.startX) > Npc.MAX_WALK_RANGE ||
        Math.abs(newY - this.startY) > Npc.MAX_WALK_RANGE) {
      this.walkTimer = WALK_DELAY_MIN + Math.floor(Math.random() * (WALK_DELAY_MAX - WALK_DELAY_MIN));
      return;
    }

    // Check collision with map tiles
    if (!isWalkable(targetTileX, targetTileY)) {
      this.walkTimer = WALK_DELAY_MIN + Math.floor(Math.random() * (WALK_DELAY_MAX - WALK_DELAY_MIN));
      return;
    }

    // Check collision with player (2x2 tile sprites)
    const hitsPlayer = Math.abs(targetTileX - playerTileX) < 2 &&
                       Math.abs(targetTileY - playerTileY) < 2;
    if (hitsPlayer) {
      this.walkTimer = WALK_DELAY_MIN + Math.floor(Math.random() * (WALK_DELAY_MAX - WALK_DELAY_MIN));
      return;
    }

    // Check collision with other NPCs (2x2 tile sprites)
    if (allNpcs) {
      const hitsNpc = allNpcs.some(other => {
        if (other === this || other.hidden) return false;
        return Math.abs(targetTileX - other.claimedTileX) < 2 &&
               Math.abs(targetTileY - other.claimedTileY) < 2;
      });
      if (hitsNpc) {
        this.walkTimer = WALK_DELAY_MIN + Math.floor(Math.random() * (WALK_DELAY_MAX - WALK_DELAY_MIN));
        return;
      }
    }

    // Check collision with Pikachu follower (2x2 tile sprite)
    if (pikachuTile) {
      if (Math.abs(targetTileX - pikachuTile.x) < 2 &&
          Math.abs(targetTileY - pikachuTile.y) < 2) {
        this.walkTimer = WALK_DELAY_MIN + Math.floor(Math.random() * (WALK_DELAY_MAX - WALK_DELAY_MIN));
        return;
      }
    }

    this.targetX = newX;
    this.targetY = newY;
    this.isMoving = true;
    this.moveProgress = 0;

    this.walkTimer = WALK_DELAY_MIN + Math.floor(Math.random() * (WALK_DELAY_MAX - WALK_DELAY_MIN));
  }

  /** Check if player is in this trainer's line of sight. */
  isPlayerInSight(playerTileX: number, playerTileY: number): boolean {
    if (!this.data.trainerClass || this.data.defeated || this.approaching || this.approachDone) return false;
    const range = this.data.sightRange ?? 0;
    if (range <= 0) return false;

    // NPC occupies 2x2 tiles; check along facing direction from center
    const nTx = this.tileX;
    const nTy = this.tileY;

    for (let step = 1; step <= range; step++) {
      let checkX = nTx;
      let checkY = nTy;
      switch (this.direction) {
        case 'up':    checkY -= step * 2; break;
        case 'down':  checkY += step * 2; break;
        case 'left':  checkX -= step * 2; break;
        case 'right': checkX += step * 2; break;
      }
      // Player occupies 2x2 tiles; check if any tile overlaps
      if (Math.abs(checkX - playerTileX) < 2 && Math.abs(checkY - playerTileY) < 2) {
        return true;
      }
    }
    return false;
  }

  /** Start the trainer approach sequence: show "!" then walk toward player. */
  startApproach(playerX: number, playerY: number): void {
    this.approaching = true;
    this.showExclamation = true;
    this.exclamationTimer = 40; // ~0.67s for "!" display

    // Target: one step away from the player (in the trainer's facing direction toward player)
    // Calculate where to stop (one step before player position)
    const dx = playerX - this.x;
    const dy = playerY - this.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal approach
      this.direction = dx > 0 ? 'right' : 'left';
      this.approachTargetX = dx > 0 ? playerX - STEP_SIZE : playerX + STEP_SIZE;
      this.approachTargetY = this.y;
    } else {
      // Vertical approach
      this.direction = dy > 0 ? 'down' : 'up';
      this.approachTargetX = this.x;
      this.approachTargetY = dy > 0 ? playerY - STEP_SIZE : playerY + STEP_SIZE;
    }
  }

  /** Update the trainer approach (call each frame while approaching). */
  updateApproach(): void {
    if (!this.approaching) return;

    // Phase 1: show exclamation mark
    if (this.showExclamation) {
      this.exclamationTimer--;
      if (this.exclamationTimer <= 0) {
        this.showExclamation = false;
      }
      return;
    }

    // Phase 2: walk toward the player
    if (this.isMoving) {
      this.moveProgress += WALK_SPEED;
      const t = Math.min(this.moveProgress / STEP_SIZE, 1);

      const dx = this.direction === 'left' ? STEP_SIZE :
                 this.direction === 'right' ? -STEP_SIZE : 0;
      const dy = this.direction === 'up' ? STEP_SIZE :
                 this.direction === 'down' ? -STEP_SIZE : 0;
      const startX = this.targetX + dx;
      const startY = this.targetY + dy;

      this.x = startX + (this.targetX - startX) * t;
      this.y = startY + (this.targetY - startY) * t;

      if (this.moveProgress >= STEP_SIZE) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.isMoving = false;
        this.moveProgress = 0;
      }
      return;
    }

    // Check if we've arrived
    if (Math.abs(this.x - this.approachTargetX) < 2 &&
        Math.abs(this.y - this.approachTargetY) < 2) {
      this.x = this.approachTargetX;
      this.y = this.approachTargetY;
      this.approaching = false;
      this.approachDone = true;
      return;
    }

    // Take next step toward target
    const dx = this.approachTargetX - this.x;
    const dy = this.approachTargetY - this.y;

    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      this.direction = dx > 0 ? 'right' : 'left';
      this.targetX = this.x + (dx > 0 ? STEP_SIZE : -STEP_SIZE);
      this.targetY = this.y;
    } else if (dy !== 0) {
      this.direction = dy > 0 ? 'down' : 'up';
      this.targetX = this.x;
      this.targetY = this.y + (dy > 0 ? STEP_SIZE : -STEP_SIZE);
    }

    this.isMoving = true;
    this.moveProgress = 0;
  }

  /** Start a scripted walk along a list of directions. */
  startScriptedMove(path: Direction[]): void {
    this.scriptedPath = path;
    this.scriptedPathIndex = 0;
    this.scriptedMoveDone = false;
    // Reset any stale movement state from previous walks
    this.isMoving = false;
    this.moveProgress = 0;
  }

  /** Update scripted movement (call each frame while in script state). */
  updateScriptedMove(): void {
    if (this.scriptedMoveDone) return;

    if (this.isMoving) {
      this.moveProgress += WALK_SPEED;
      const t = Math.min(this.moveProgress / STEP_SIZE, 1);
      const dx = this.direction === 'left' ? STEP_SIZE :
                 this.direction === 'right' ? -STEP_SIZE : 0;
      const dy = this.direction === 'up' ? STEP_SIZE :
                 this.direction === 'down' ? -STEP_SIZE : 0;
      const startX = this.targetX + dx;
      const startY = this.targetY + dy;
      this.x = startX + (this.targetX - startX) * t;
      this.y = startY + (this.targetY - startY) * t;

      if (this.moveProgress >= STEP_SIZE) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.isMoving = false;
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
    const dx = dir === 'left' ? -STEP_SIZE : dir === 'right' ? STEP_SIZE : 0;
    const dy = dir === 'up' ? -STEP_SIZE : dir === 'down' ? STEP_SIZE : 0;
    this.targetX = this.x + dx;
    this.targetY = this.y + dy;
    this.isMoving = true;
    this.moveProgress = 0;
  }

  render(cameraX: number, cameraY: number): void {
    if (!this.spriteSheet || this.hidden) return;

    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY - 4; // -4px offset matches original GB sprite positioning
    const frame = FRAMES[this.direction];
    const flipX = this.direction === 'right';

    // Static sprites (e.g. gambler_asleep) are 16×16 with only one frame
    const isStatic = this.spriteSheet.height < 32;

    let frameY: number;
    if (isStatic) {
      frameY = 0;
    } else if (this.isMoving) {
      const phase = Math.floor(this.moveProgress / (STEP_SIZE / 4));
      frameY = (phase === 1 || phase === 3) ? frame.walk : frame.stand;
    } else if (this.useWalkFrame) {
      frameY = frame.walk;
    } else {
      frameY = frame.stand;
    }

    drawSprite(this.spriteSheet, 0, frameY, screenX, screenY, isStatic ? false : flipX);

    // Draw "!" emote above trainer during approach
    if (this.showExclamation) {
      drawExclamationBubble(screenX, screenY);
    }
  }
}

/** Load all NPCs for a map from its data. */
export async function loadNpcs(npcDataList: NpcData[]): Promise<Npc[]> {
  const npcs = npcDataList.map(d => new Npc(d));
  await Promise.all(npcs.map(n => n.load()));
  return npcs;
}
