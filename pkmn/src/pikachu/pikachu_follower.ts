import type { Direction } from '../core';
import { TILE_SIZE } from '../core';
import { drawSprite, loadSprite } from '../renderer';
import { hasFlag } from '../events';
import type { BattlePokemon } from '../battle';

interface FrameSet { stand: number; walk: number }

const FRAMES: Record<Direction, FrameSet> = {
  down:  { stand: 0,  walk: 48 },
  up:    { stand: 16, walk: 64 },
  left:  { stand: 32, walk: 80 },
  right: { stand: 32, walk: 80 }, // drawn flipped
};

const STEP_SIZE = 16;       // pixels per step (2 tiles)
const NORMAL_SPEED = 2;     // 2px/frame (matches player, assembly: step vector * 2)
const FAST_SPEED = 4;       // 4px/frame (catch-up when far behind)
const BUFFER_CAPACITY = 16; // assembly: wPikachuFollowCommandBuffer is 16 bytes

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

/** A queued position that Pikachu should walk to. */
interface StepTarget {
  x: number;
  y: number;
  hop?: boolean;  // true = ledge hop (parabolic arc animation)
}

/** Compute the facing direction from a position delta. */
function directionFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

export class PikachuFollower {
  x = 0;
  y = 0;
  direction: Direction = 'down';
  visible = false;

  private spriteSheet: HTMLCanvasElement | null = null;
  private moving = false;
  private moveProgress = 0;
  private startX = 0;          // position when current step began
  private startY = 0;
  private targetX = 0;
  private targetY = 0;
  private fastMode = false;
  private hopping = false;     // true during ledge hop animation

  // Buffer of positions to walk to (player's previous positions)
  private positionBuffer: StepTarget[] = [];

  // Ledge hop: Pikachu waits at edge, hops on next player step
  private pendingLedgeHop: StepTarget | null = null;

  async loadSprite(): Promise<void> {
    this.spriteSheet = await loadSprite('/gfx/sprites/pikachu.png');
  }

  /**
   * Record where the player WAS before their step.
   * Called with the player's position BEFORE the step started.
   */
  recordPlayerPosition(prevX: number, prevY: number, newX: number, newY: number): void {
    if (this.positionBuffer.length >= BUFFER_CAPACITY) {
      // Pikachu is too far behind — teleport behind player
      const dir = directionFromDelta(newX - prevX, newY - prevY);
      this.spawn(newX, newY, dir);
      return;
    }
    // If Pikachu is waiting at a ledge edge, insert the hop step first
    if (this.pendingLedgeHop) {
      this.positionBuffer.push(this.pendingLedgeHop);
      this.pendingLedgeHop = null;
    }
    this.positionBuffer.push({ x: prevX, y: prevY });
  }

  /** Record that Pikachu should hop to this position on the next player step.
   *  Called when the player hops a ledge — Pikachu waits at the edge, then hops later. */
  setLedgeHopPending(hopX: number, hopY: number): void {
    this.pendingLedgeHop = { x: hopX, y: hopY, hop: true };
  }

  /** Update Pikachu's movement each frame. */
  update(): void {
    if (this.moving) {
      // During ledge hops, always use normal speed (matches assembly behavior)
      const speed = (this.fastMode && !this.hopping) ? FAST_SPEED : NORMAL_SPEED;
      this.moveProgress += speed;
      const t = Math.min(this.moveProgress / STEP_SIZE, 1);

      // Interpolate from stored start position to target (supports diagonal movement)
      this.x = this.startX + (this.targetX - this.startX) * t;
      this.y = this.startY + (this.targetY - this.startY) * t;

      if (this.moveProgress >= STEP_SIZE) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.moving = false;
        this.hopping = false;
        this.moveProgress = 0;
        // Don't return — fall through to start next step on the same frame
        // (matches player behavior: no 1-frame gap between steps).
      } else {
        return; // still mid-step
      }
    }

    // Not moving — pop next target position from buffer
    if (this.positionBuffer.length === 0) return;

    const target = this.positionBuffer.shift()!;
    this.fastMode = this.positionBuffer.length >= 1; // fast if more steps queued

    // Compute direction from current position to target
    const dx = target.x - this.x;
    const dy = target.y - this.y;

    // If already at target, skip
    if (dx === 0 && dy === 0) return;

    this.direction = directionFromDelta(dx, dy);
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = target.x;
    this.targetY = target.y;
    this.moving = true;
    this.hopping = !!target.hop;
    this.moveProgress = 0;
  }

  /** Place Pikachu 1 step behind the player. */
  spawn(playerX: number, playerY: number, playerDir: Direction): void {
    const behind = OPPOSITE[playerDir];
    const dx = behind === 'left' ? -STEP_SIZE : behind === 'right' ? STEP_SIZE : 0;
    const dy = behind === 'up' ? -STEP_SIZE : behind === 'down' ? STEP_SIZE : 0;
    this.x = playerX + dx;
    this.y = playerY + dy;
    this.direction = playerDir;
    this.clearBuffer();
    this.moving = false;
    this.moveProgress = 0;
  }

  /** Place Pikachu after a warp.
   *  'right'/'left': Pikachu beside player (assembly spawn states 1/6).
   *  null: Pikachu on top of player (hidden until player moves, state 0). */
  spawnAtWarp(playerX: number, playerY: number, playerDir: Direction, side: 'left' | 'right' | null): void {
    if (side === 'right') {
      this.x = playerX + STEP_SIZE;
      this.y = playerY;
    } else if (side === 'left') {
      this.x = playerX - STEP_SIZE;
      this.y = playerY;
    } else {
      this.x = playerX;
      this.y = playerY;
    }
    this.direction = playerDir;
    this.clearBuffer();
    this.moving = false;
    this.moveProgress = 0;
  }

  /** Clear the position buffer. */
  clearBuffer(): void {
    this.positionBuffer.length = 0;
    this.pendingLedgeHop = null;
  }

  get tileX(): number { return Math.round(this.x / TILE_SIZE); }
  get tileY(): number { return Math.round(this.y / TILE_SIZE); }

  /** Whether Pikachu is currently mid-step. */
  get isMoving(): boolean { return this.moving; }

  /** Number of queued positions remaining. */
  get bufferLength(): number { return this.positionBuffer.length; }

  /** Push a target position directly into the buffer (for scripted movement). */
  pushPosition(x: number, y: number, hop = false): void {
    this.positionBuffer.push({ x, y, hop });
  }

  render(cameraX: number, cameraY: number): void {
    if (!this.spriteSheet || !this.visible) return;

    const screenX = this.x - cameraX;
    let screenY = this.y - cameraY - 4; // -4px offset matches original GB sprite positioning
    const frame = FRAMES[this.direction];
    const flipX = this.direction === 'right';

    let frameY: number;
    if (this.moving) {
      const phase = Math.floor(this.moveProgress / (STEP_SIZE / 4));
      frameY = (phase === 1 || phase === 3) ? frame.walk : frame.stand;

      // Hop animation: parabolic vertical offset during ledge jump
      if (this.hopping) {
        const t = this.moveProgress / STEP_SIZE; // 0 → 1
        const hopHeight = -Math.sin(t * Math.PI) * 10; // up to 10px arc
        screenY += hopHeight;
      }
    } else {
      frameY = frame.stand;
    }

    drawSprite(this.spriteSheet, 0, frameY, screenX, screenY, flipX);
  }
}

/** Check if Pikachu should be following the player. */
export function shouldPikachuFollow(party: BattlePokemon[]): boolean {
  if (!hasFlag('BATTLED_RIVAL_IN_OAKS_LAB')) return false;
  // Assembly: IsStarterPikachuAliveInOurParty — searches entire party
  return party.some(mon => mon.species.id === 25 && mon.currentHp > 0);
}
