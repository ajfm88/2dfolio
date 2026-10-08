import type { Direction, NpcData } from '../core';
import { TILE_SIZE } from '../core';
import { drawSprite, loadSprite } from '../renderer';
import { NpcWalk, walkFrame } from './walk_pace';
import type { NpcStepPlan, NpcWalkMode, NpcMovement1, NpcMovement2 } from './walk_pace';
import { inSpriteWindow, spriteCovered, SpriteVisibility } from './sprite_visibility';
import { collisionMask, screenPixels, stepStaysOnScreen, DIRECTION_BIT } from './sprite_collision';
import type { CollisionSprite } from './sprite_collision';
import { uiTiles } from '../renderer/ui_tiles';

// Same sprite frame layout as player (16x96 sprite sheets)
interface FrameSet { stand: number; walk: number }

const FRAMES: Record<Direction, FrameSet> = {
  down:  { stand: 0,  walk: 48 },
  up:    { stand: 16, walk: 64 },
  left:  { stand: 32, walk: 80 },
  right: { stand: 32, walk: 80 }, // drawn flipped
};

const STEP_SIZE = 16;   // pixels per step (2 tiles)

/** The random byte UpdateNPCSprite reads (hRandomAdd). */
const randomByte = (): number => Math.floor(Math.random() * 256);

/** RivalIDs (engine/overworld/npc_movement_2.asm): the rival leaves after battling. */
const RIVAL_CLASSES = new Set(['RIVAL1', 'RIVAL2', 'RIVAL3']);

/**
 * SetEnemyTrainerToStayAndFaceAnyDirection's exceptions: not on Pokémon Tower 7F (its
 * Rockets leave), never the rival. Everyone else turns at random after losing.
 */
export function turnsAfterLosing(trainerClass: string | undefined, mapName: string): boolean {
  if (mapName === 'PokemonTower7F') return false;
  return trainerClass === undefined || !RIVAL_CLASSES.has(trainerClass);
}

/** What one UpdateSprites gives an NPC. */
export interface NpcUpdateContext {
  /** The map's terrain (_IsTilePassable reads the destination's lower-left tile). */
  isWalkable: (tx: number, ty: number) => boolean;
  /** wWalkCounter ≠ 0. */
  playerWalking: boolean;
  /** wXCoord / wYCoord, which change at the end of a step. */
  playerMapStep: { x: number; y: number };
  /** The player's world pixels: every sprite's screen pixels are relative to them. */
  playerX: number;
  playerY: number;
  /** This sprite's slot (map NPCs from 1, in map order). */
  slot: number;
  /** The live sprite table in slot order: earlier slots already updated this pass. */
  sprites: () => readonly CollisionSprite[];
  /** A random byte (tests inject one). */
  random?: () => number;
}

/**
 * An NPC. Movement runs once per overworld pass through NpcWalk, UpdateNPCSprite's state
 * machine (walk_pace.ts): 1 px a pass after a start pass, 17 passes a step.
 */
export class Npc {
  readonly data: NpcData;
  x: number;
  y: number;
  private spriteSheet: HTMLCanvasElement | null = null;

  private readonly walk: NpcWalk;
  private readonly visibility = new SpriteVisibility();
  private imageDirection: Direction;
  private imageFrame = 0;
  /** The map position the current step leads to (TryWalking moves it at the start). */
  private targetX = 0;
  private targetY = 0;

  hidden = false;             // if true, skip rendering and updates
  useWalkFrame = false;       // if true, show walk frame (used for nurse bow)

  /** The sprite's starting facing. */
  readonly defaultDirection: Direction;

  constructor(data: NpcData) {
    this.data = data;
    // NPC coords are in 16px step units
    this.x = data.x * STEP_SIZE;
    this.y = data.y * STEP_SIZE;
    this.defaultDirection = data.direction ?? 'down';
    this.imageDirection = this.defaultDirection;
    // The object_event movement bytes: a STAY/WALK byte, then a fixed facing, an axis, or
    // NONE (STAY) / ANY_DIR (WALK)
    const movement1: NpcMovement1 = data.movement === 'walk' ? 'walk' : 'stay';
    const axis = data.walkDir && data.walkDir !== 'any' ? data.walkDir : null;
    const movement2: NpcMovement2 = data.direction ?? axis ?? (movement1 === 'stay' ? 'none' : 'any');
    this.walk = new NpcWalk(this.defaultDirection, movement1, movement2);
    // EnterMap's UpdateSprites runs InitializeSpriteStatus before the first loop pass
    this.walk.initialize();
  }

  async load(): Promise<void> {
    this.spriteSheet = await loadSprite(`/gfx/sprites/${this.data.sprite}.png`);
  }

  /** The facing the sprite shows. */
  get direction(): Direction { return this.walk.facing; }
  set direction(dir: Direction) {
    this.walk.facing = dir;
    this.imageDirection = dir;
  }

  get tileX(): number { return Math.round(this.x / TILE_SIZE); }
  get tileY(): number { return Math.round(this.y / TILE_SIZE); }
  /** SPRITESTATEDATA2_MAPX/MAPY in steps: a step's destination from its start. */
  get mapStepX(): number { return Math.round((this.walk.isMoving ? this.targetX : this.x) / STEP_SIZE); }
  get mapStepY(): number { return Math.round((this.walk.isMoving ? this.targetY : this.y) / STEP_SIZE); }

  /** A scripted walk has read its terminator. */
  get scriptedMoveDone(): boolean { return this.walk.scriptDone; }

  /** How many steps of the scripted walk have started (wNPCNumScriptedSteps counts down from here). */
  get scriptedStepsStarted(): number { return this.walk.stepsStarted; }

  /** The live movement state (tests and the trainer hook read it). */
  get movement(): Readonly<NpcWalk> { return this.walk; }

  /** Turn to face the player for interaction. */
  faceDirection(dir: Direction): void {
    this.direction = dir;
    this.imageFrame = 0; // MakeNPCFacePlayer → NotYetMoving
  }

  /**
   * PrintEndBattleText → SetEnemyTrainerToStayAndFaceAnyDirection: after the player beats
   * this trainer, its live movement bytes become STAY/NONE, so it turns at random. Only
   * the sprite on the map now changes: a map load recreates it from the map's bytes.
   */
  stayAndFaceAnyDirection(mapName: string): void {
    if (turnsAfterLosing(this.data.trainerClass, mapName)) this.walk.stayAndFaceAnyDirection();
  }

  /** This sprite in DetectCollisionBetweenSprites' table. */
  collisionSprite(playerX: number, playerY: number, slot: number): CollisionSprite {
    const p = screenPixels(this.x, this.y, playerX, playerY);
    return {
      slot,
      available: !this.hidden && this.visibility.visible,
      x: p.x,
      y: p.y,
      vx: this.walk.vx,
      vy: this.walk.vy,
    };
  }

  /** One UpdateSprites for this NPC (UpdateNPCSprite). */
  update(ctx: NpcUpdateContext): void {
    const random = ctx.random ?? randomByte;
    // InitializeSpriteStatus comes before CheckSpriteAvailability, and leaves IMAGEINDEX $ff
    if (this.walk.status === 'init') {
      this.visibility.update(false, ctx.playerWalking);
      this.walk.pass({ playerWalking: ctx.playerWalking, random, canWalk: () => false });
      return;
    }
    if (this.hidden) return;
    const available = inSpriteWindow(this.mapStepX, this.mapStepY,
      ctx.playerMapStep.x, ctx.playerMapStep.y, this.walk.scripted);
    const inStepAnimation = this.walk.inStepAnimation;
    this.visibility.update(available, ctx.playerWalking && !inStepAnimation);
    if (!available) return; // invisible sprites don't advance movement or delay

    this.walk.pass({
      playerWalking: ctx.playerWalking,
      random,
      canWalk: dir => this.canWalk(dir, ctx),
    });
    if (this.walk.startedStep) {
      const d = stepDelta(this.walk.facing);
      this.targetX = this.x + d.dx;
      this.targetY = this.y + d.dy;
    }
    this.x += this.walk.dx;
    this.y += this.walk.dy;
    // CheckSpriteAvailability refreshes IMAGEINDEX only when wWalkCounter is zero.
    if (!ctx.playerWalking || inStepAnimation) {
      this.imageDirection = this.direction;
      this.imageFrame = this.walk.displayFrame;
    }
  }

  /** MoveSprite: walk `path`, each step normal (1 px a pass) or fast (Yellow's $04–$07).
   *  `modes` gives each step's mode; missing entries are normal. `keepStatus`: see
   *  NpcWalk.startScript (the trainer walk-up). */
  startScriptedMove(path: Direction[], modes?: NpcWalkMode[], keepStatus = false): void {
    const plan: NpcStepPlan[] = path.map((dir, i) => ({ dir, mode: modes?.[i] ?? 'normal' }));
    this.walk.startScript(plan, keepStatus);
  }

  /** DoScriptedNPCMovement: walk `path` in step with the player (2 px a pass). */
  startInStepMove(path: Direction[]): void {
    this.walk.startInStep(path);
  }

  /**
   * CanWalkOntoTile after its STAY check, for a try whose facing and step vector are set:
   * the destination's terrain, then the screen edge (from this sprite's screen pixels),
   * then the collision mask against the live sprite table. The displacement bytes are
   * NpcWalk's.
   */
  private canWalk(dir: Direction, ctx: NpcUpdateContext): boolean {
    const d = stepDelta(dir);
    if (!ctx.isWalkable(Math.round((this.x + d.dx) / TILE_SIZE), Math.round((this.y + d.dy) / TILE_SIZE))) {
      return false;
    }
    const self = this.collisionSprite(ctx.playerX, ctx.playerY, ctx.slot);
    if (!stepStaysOnScreen(self.x, self.y, dir)) return false;
    return (collisionMask(self, ctx.sprites()) & DIRECTION_BIT[dir]) === 0;
  }

  render(cameraX: number, cameraY: number): void {
    if (!this.spriteSheet || this.hidden || !this.visibility.visible) return;

    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY - 4; // -4px offset matches original GB sprite positioning
    // Upstream's camera draws the scene 4px above Yellow (A6b review F-1).
    // Convert to GB YPIXELS for the tile-footprint check; leave the camera for its own slice.
    if (spriteCovered(screenX, screenY + 4, uiTiles.tileAt)) return;
    const frame = FRAMES[this.imageDirection];

    // Static sprites (e.g. gambler_asleep) are 16×16 with only one frame
    const isStatic = this.spriteSheet.height < 32;

    let frameY: number;
    let flipX = this.imageDirection === 'right';
    if (isStatic) {
      frameY = 0;
      flipX = false;
    } else if (this.useWalkFrame) {
      frameY = frame.walk;
    } else {
      const { walking, mirrored } = walkFrame(this.imageDirection, this.imageFrame);
      frameY = walking ? frame.walk : frame.stand;
      flipX = flipX !== mirrored;
    }

    drawSprite(this.spriteSheet, 0, frameY, screenX, screenY, flipX);
  }
}

function stepDelta(dir: Direction): { dx: number; dy: number } {
  return {
    dx: dir === 'left' ? -STEP_SIZE : dir === 'right' ? STEP_SIZE : 0,
    dy: dir === 'up' ? -STEP_SIZE : dir === 'down' ? STEP_SIZE : 0,
  };
}

/** Load all NPCs for a map from its data. */
export async function loadNpcs(npcDataList: NpcData[]): Promise<Npc[]> {
  const npcs = npcDataList.map(d => new Npc(d));
  await Promise.all(npcs.map(n => n.load()));
  return npcs;
}
