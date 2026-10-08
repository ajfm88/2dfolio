// Overworld pace per the ASM (A6a, DECISIONS #36).
//
// The overworld loop runs one pass every two frames (home/overworld.asm OverworldLoop
// calls DelayFrame twice), and everything that moves in the overworld advances once
// per pass:
//   - the player 2 px (_AdvancePlayerSprite doubles the step vector): 8 passes a step;
//   - an NPC 1 px per UpdateSprites (movement.asm TryWalking: a 16-count walk
//     counter), after a start pass that moves nothing: 17 passes a step;
//   - Yellow's fast NPC codes $04–$07 (Func_5288 → status 4, Func_5357): 2 px, counter 8;
//   - an NPC walking in step with the player (DoScriptedNPCMovement): 2 px, 8 a step;
//   - Pikachu 2 px, or 4 px catching up (pikachu_follow.asm).
// Text, script waits, fades, audio and battles keep counting frames.
//
// This module is pure (no DOM): the classes that draw (Player, Npc, PikachuFollower)
// run these state machines, and walk_pace.test.ts pins them to the ASM's counts.

import type { Direction } from '../core';

export const FRAMES_PER_PASS = 2;
export const STEP_PX = 16;

/** Counts frames into overworld passes. */
export class PassClock {
  private frame = 0;
  private held = 0;

  /** One frame. True when a pass runs on it: the second frame of each pair. */
  tick(): boolean {
    if (this.held > 0) {
      this.held--;
      return false;
    }
    this.frame = (this.frame + 1) % FRAMES_PER_PASS;
    return this.frame === 0;
  }

  /** `jp OverworldLoop`: the next pass runs two frames from now. */
  reset(): void {
    this.frame = 0;
    this.held = 0;
  }

  /** A DelayFrames inside a pass (Delay3 after a ledge hop) holds the next one back. */
  delay(frames: number): void {
    this.held += frames;
  }
}

/**
 * A sprite's walking animation (movement.asm Func_5274): the intra-frame counter counts
 * updates, and the animation frame (0–3) advances when it wraps. Func_5274 wraps every
 * 4 updates; Pikachu's GetPikachuWalkingAnimationSpeed every 2 or 5.
 */
export class WalkAnim {
  intra = 0;
  frame = 0;

  tick(period = 4): void {
    this.intra++;
    if (this.intra >= period) {
      this.intra = 0;
      this.frame = (this.frame + 1) & 3;
    }
  }

  /** Pikachu's counters as the ASM keeps them (GetPikachuWalkingAnimationSpeed, the idle
   *  antics): the intra counter is a byte compared for equality, so a value left above
   *  `period` by an interrupted antic counts on until it wraps past 255. */
  tickExact(period: number): void {
    this.intra = (this.intra + 1) & 0xff;
    if (this.intra === period) {
      this.intra = 0;
      this.frame = (this.frame + 1) & 3;
    }
  }

  reset(): void {
    this.intra = 0;
    this.frame = 0;
  }
}

/**
 * data/sprites/facings.asm: animation frames 0–3 show stand, walk, stand, walk. Facing up
 * or down, frame 3 is the walking frame x-flipped (WalkingDown2 / WalkingUp2), so the feet
 * alternate; left and right use the same walking frame twice.
 */
export function walkFrame(direction: Direction, frame: number): { walking: boolean; mirrored: boolean } {
  return {
    walking: (frame & 1) === 1,
    mirrored: frame === 3 && (direction === 'up' || direction === 'down'),
  };
}

/** GetPikachuWalkingAnimationSpeed: at happiness 80 or more Pikachu's frame advances every
 *  2 updates, below that every 5 (ComparePikachuHappinessTo80). */
export function pikachuAnimPeriod(happiness: number): number {
  return happiness >= 80 ? 2 : 5;
}

/** PlayerJumpingYScreenCoords, as offsets from the player's screen Y ($3C), one per pass of
 *  the hop's two steps (player_animations.asm _HandleMidJump). */
export const HOP_Y_OFFSETS: readonly number[] = [
  0x38, 0x36, 0x34, 0x32, 0x31, 0x30, 0x30, 0x30,
  0x31, 0x32, 0x33, 0x34, 0x36, 0x38, 0x3c, 0x3c,
].map(y => y - 0x3c);

/** _HandleMidJump .finishedJump: Delay3 once the hop has landed. */
export const HOP_LANDING_FRAMES = 3;

/** A sprite's rest after a step or a blocked try (CanWalkOntoTile .impassable,
 *  UpdateSpriteInWalkingAnimation .initNextMovementCounter): the delay byte is
 *  random & $7f, counted down as a byte, so 0 waits 256 updates: 1–127 or 256. */
export function npcRestPasses(randomByte: number): number {
  const d = randomByte & 0x7f;
  return d === 0 ? 256 : d;
}

/** Movement byte 1 of an ordinary sprite (a script runs on top of it). */
export type NpcMovement1 = 'stay' | 'walk';
/** Movement byte 2: a fixed facing, NONE / ANY_DIR, or an axis. */
export type NpcMovement2 = Direction | 'none' | 'any' | 'up_down' | 'left_right';

/**
 * UpdateNPCSprite .randomMovement → .determineDirection: the direction an attempt tries,
 * from one random byte. A fixed byte-2 facing ignores the byte (it is still drawn).
 *   byte    NONE/ANY  UP_DOWN  LEFT_RIGHT
 *   00–3f   down      down     left
 *   40–7f   up        up       right
 *   80–bf   left      up       left
 *   c0–ff   right     down     right
 */
export function npcDirection(randomByte: number, movement2: NpcMovement2): Direction {
  if (movement2 === 'up' || movement2 === 'down' || movement2 === 'left' || movement2 === 'right') {
    return movement2;
  }
  const r = randomByte & 0xff;
  if (r < 0x40) return movement2 === 'left_right' ? 'left' : 'down';
  if (r < 0x80) return movement2 === 'left_right' ? 'right' : 'up';
  if (r < 0xc0) return movement2 === 'up_down' ? 'up' : 'left';
  return movement2 === 'up_down' ? 'down' : 'right';
}

/**
 * CanWalkOntoTile's displacement bytes (initialized to 8 each): a step up or left fails
 * when its byte is zero; down and right add as unsigned bytes (255 wraps to 0). Yellow
 * removed Red/Blue's limit of 5, so there is no other bound. Null when the step fails.
 */
export function npcDisplacement(
  disp: { x: number; y: number }, dir: Direction,
): { x: number; y: number } | null {
  let { x, y } = disp;
  if (dir === 'up') { if (y === 0) return null; y--; }
  if (dir === 'down') y = (y + 1) & 0xff;
  if (dir === 'left') { if (x === 0) return null; x--; }
  if (dir === 'right') x = (x + 1) & 0xff;
  return { x, y };
}

function delta(dir: Direction, px: number): { dx: number; dy: number } {
  return {
    dx: dir === 'left' ? -px : dir === 'right' ? px : 0,
    dy: dir === 'up' ? -px : dir === 'down' ? px : 0,
  };
}

// ── The player ───────────────────────────────────────────────────────────

/** What the map says about a step (CollisionCheckOnLand / HandleLedges). */
export type StepCheck = 'walk' | 'hop' | 'blocked';

/**
 * The player's walk as home/overworld.asm runs it, one call per pass. `updateSprites`
 * stands for UpdateSprites (the NPCs and Pikachu), called where the loop calls it:
 *   - mid-step: .moveAhead → UpdateSprites → AdvancePlayerSprite;
 *   - no direction pressed: .noDirectionButtonsPressed → UpdateSprites;
 *   - a direction other than the last stop direction while wCheckFor180DegreeTurn is set
 *     (a pass with nothing pressed sets it, only a turn clears it): the turning pass,
 *     which skips UpdateSprites;
 *   - otherwise .noDirectionChange → UpdateSprites → collision → the step starts and its
 *     first 2 px go in the same pass.
 * The next step starts in the pass after one ends, so holding a direction walks 8 passes
 * a step with no gap.
 */
export class PlayerWalk {
  /** The sprite's facing (wSpritePlayerStateData1FacingDirection), set by UpdateSprites. */
  facing: Direction = 'down';
  readonly anim = new WalkAnim();

  moving = false;
  hopping = false;
  ledge = false;
  landingPending = false;
  landedPass = false;
  /** Func_fcc08: an ordinary step start, or either half of a hop. */
  startedFollowStep = false;
  /** Pixels into the current movement. */
  progress = 0;
  /** Index into HOP_Y_OFFSETS on the pass just run (-1 before the first moving pass). */
  hopPass = -1;
  /** The direction of the current movement. */
  stepDir: Direction = 'down';

  // Set by the pass just run
  startedStep = false;
  finishedStep = false;
  collided = false;
  turned = false;
  /** The hop's first pass: HandleLedges armed it, and the ledge tile still collided. */
  armedHop = false;
  startedHop = false;
  landedHop = false;

  /** wPlayerMovingDirection */
  private movingDir: Direction | null = null;
  /** wPlayerLastStopDirection (none at a new game) */
  private lastStopDir: Direction | null = null;
  /** wCheckFor180DegreeTurn: set on a pass with nothing pressed */
  private checkFor180 = true;
  private hopArmed = false;

  private distance = STEP_PX;

  /** Pixels moved by the pass just run. */
  dx = 0;
  dy = 0;

  /** wSpritePlayerStateData1X/YStepVector, read by sprite collisions: JoypadOverworld
   *  clears them on a standing pass, a pressed direction sets them before UpdateSprites,
   *  and they keep the step's direction while it walks. */
  vx = 0;
  vy = 0;

  /** wPikachuCollisionCounter: a turn arms 8; a pass with nothing pressed and every
   *  moving pass (.moveAhead2) clear it; CollisionCheckOnLand counts it down. */
  pikachuCollisionCounter = 0;

  /**
   * One pass. `input` is the direction held (or simulated); `simulated` skips the turn
   * (BIT_SCRIPTED_MOVEMENT_STATE → .noDirectionChange); `check` asks the map.
   */
  pass(
    input: Direction | null,
    simulated: boolean,
    check: (dir: Direction) => StepCheck,
    updateSprites: () => void,
  ): void {
    this.startedStep = false;
    this.startedFollowStep = false;
    this.landedPass = false;
    this.finishedStep = false;
    this.collided = false;
    this.turned = false;
    this.armedHop = false;
    this.startedHop = false;
    this.landedHop = false;
    this.dx = 0;
    this.dy = 0;

    // _HandleMidJump .finishedJump: one extra UpdateSprites, then Delay3.
    if (this.landingPending) {
      this.spriteUpdate();
      updateSprites();
      this.landingPending = false;
      this.landedPass = true;
      return;
    }
    this.finishLanding();

    // Mid-step (or mid-hop): UpdateSprites, then AdvancePlayerSprite
    if (this.moving) {
      this.startedFollowStep = this.hopping && this.progress === STEP_PX;
      this.spriteUpdate();
      updateSprites();
      this.pikachuCollisionCounter = 0;
      this.advance();
      return;
    }

    // JoypadOverworld, then the direction handling sets the step vector
    this.setVector(this.hopArmed ? this.stepDir : input);

    // HandleLedges simulated the hop's two presses: they start now, whatever is held
    if (this.hopArmed) {
      this.hopArmed = false;
      this.movingDir = this.stepDir;
      this.spriteUpdate();
      updateSprites();
      this.pikachuCollisionCounter = 0;
      this.moving = true;
      this.hopping = true;
      this.startedStep = true;
      this.startedFollowStep = true;
      this.startedHop = true;
      this.distance = STEP_PX * 2;
      this.progress = 0;
      this.hopPass = -1;
      this.advance();
      return;
    }

    // .noDirectionButtonsPressed: UpdateSprites first, then the stop is recorded
    if (input === null) {
      this.spriteUpdate();
      updateSprites();
      this.pikachuCollisionCounter = 0;
      this.checkFor180 = true;
      if (this.movingDir) {
        this.lastStopDir = this.movingDir;
        this.movingDir = null;
      }
      return;
    }

    // .handleDirectionButtonPress: turning from a standstill takes this pass (no
    // UpdateSprites; the sprite shows the new facing at the next one)
    if (!simulated && this.checkFor180 && input !== this.lastStopDir) {
      this.checkFor180 = false;
      this.movingDir = input;
      this.turned = true;
      this.pikachuCollisionCounter = 8;
      return;
    }

    // .noDirectionChange
    this.movingDir = input;
    this.spriteUpdate();
    updateSprites();
    const result = check(input);
    if (result === 'blocked') {
      this.collided = true;
      return;
    }
    this.stepDir = input;
    if (result === 'hop') {
      // HandleLedges sets up two simulated presses, but CheckTilePassable still finds
      // the ledge tile in front: this pass is a collision, and the hop starts next pass
      this.hopArmed = true;
      this.ledge = true;
      this.armedHop = true;
      return;
    }
    this.moving = true;
    this.hopping = false;
    this.startedStep = true;
    this.startedFollowStep = true;
    this.distance = STEP_PX;
    this.progress = 0;
    this.pikachuCollisionCounter = 0;
    this.advance();
  }

  private setVector(dir: Direction | null): void {
    this.vx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    this.vy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  }

  /** Moving, an armed hop, or awaiting its landing pass. */
  get busy(): boolean {
    return this.moving || this.hopArmed || this.landingPending;
  }

  /** Landing continuation, also used when a script completes its simulated push. */
  finishLanding(): void {
    if (!this.landingPending && !this.moving && !this.hopArmed) this.ledge = false;
  }

  /** Start a step with no pass logic (PlayerStepOutFromDoor is a simulated press). */
  forceStep(dir: Direction, updateSprites: () => void): void {
    this.pass(dir, true, () => 'walk', updateSprites);
  }

  /** Drop any movement (warps and connections reposition the player). */
  cancel(): void {
    this.moving = false;
    this.hopping = false;
    this.hopArmed = false;
    this.ledge = false;
    this.landingPending = false;
    this.landedPass = false;
    this.startedFollowStep = false;
    this.armedHop = false;
    this.startedHop = false;
    this.landedHop = false;
    this.progress = 0;
    this.hopPass = -1;
  }

  /** The hop's screen-Y offset on the pass just run. */
  get hopOffset(): number {
    return this.hopping && this.hopPass >= 0 ? HOP_Y_OFFSETS[this.hopPass] : 0;
  }

  /** UpdatePlayerSprite: the facing follows wPlayerMovingDirection while standing, and
   *  the walk animation runs whenever a direction is pressed or a step is under way. */
  private spriteUpdate(): void {
    if (this.moving) {
      this.anim.tick();
      return;
    }
    if (this.movingDir) {
      this.facing = this.movingDir;
      this.anim.tick();
    } else {
      this.anim.reset();
    }
  }

  private advance(): void {
    const d = delta(this.stepDir, 2);
    this.dx = d.dx;
    this.dy = d.dy;
    this.progress += 2;
    if (this.hopping) this.hopPass++;
    // HandleLedges simulates two ordinary steps. Each half checks transitions,
    // even though the jump animation continues through the midpoint.
    if (this.progress % STEP_PX === 0) this.finishedStep = true;
    if (this.progress >= this.distance) {
      this.moving = false;
      this.finishedStep = true;
      if (this.hopping) {
        this.hopping = false;
        this.hopPass = -1;
        this.landedHop = true;
        this.landingPending = true;
      }
    }
  }
}

// ── NPCs ─────────────────────────────────────────────────────────────────

/** How a scripted NPC step moves (engine/overworld/movement.asm, Yellow's Func_5288). */
export type NpcWalkMode = 'normal' | 'fast';

export interface NpcStepPlan {
  dir: Direction;
  mode: NpcWalkMode;
}

/** UpdateNPCSprite's movement status. */
type NpcStatus = 'init' | 'ready' | 'moving' | 'resting';

export interface NpcPassContext {
  /** wWalkCounter ≠ 0: a ready sprite can't try anything while the player is mid-step. */
  playerWalking: boolean;
  /** A random byte (hRandomAdd). */
  random: () => number;
  /** CanWalkOntoTile past its STAY check: the terrain, the screen edge and the sprite
   *  collision mask, read after the try has set the facing and step vector. */
  canWalk: (dir: Direction) => boolean;
}

/**
 * An NPC's movement as UpdateNPCSprite runs it, one call per UpdateSprites.
 *   - init: InitializeSpriteStatus (ready, displacement bytes 8 and 8), no try;
 *   - resting: UpdateSpriteMovementDelay counts the delay byte down, showing the standing
 *     frame; reaching zero only makes the sprite ready;
 *   - ready: once the player stands, a scripted step or an ordinary try (TryWalking). A try
 *     draws a direction byte even for STAY and fixed facings, faces that way and sets the
 *     step vector before CanWalkOntoTile decides. STAY always fails: a random rest follows,
 *     so a NONE sprite turns in place and a fixed one returns to its facing;
 *   - moving: UpdateSpriteInWalkingAnimation (or Func_5357 for the fast codes); an
 *     ordinary step ends with a random rest.
 * A scripted walk begins with one resting pass (UpdateSpriteMovementDelay makes a
 * scripted sprite ready on its next update) and ends one pass after its last pixel, when
 * the $ff terminator is read: movement byte 1 becomes STAY, the sprite stays ready, and its
 * next ordinary update is a try. Walking in step with the player (DoScriptedNPCMovement)
 * is a separate path: an init pass, then 2 px a pass, 8 passes a step, never waiting; it
 * then holds the sprite, as UpdateNonPlayerSprite keeps routing it there.
 */
export class NpcWalk {
  facing: Direction;
  readonly anim = new WalkAnim();
  status: NpcStatus = 'init';
  /** The live movement bytes (the map's, until a script or a battle changes them). */
  movement1: NpcMovement1;
  movement2: NpcMovement2;
  /** SPRITESTATEDATA2_MOVEMENTDELAY */
  delay = 0;
  /** SPRITESTATEDATA2_X/YDISPLACEMENT */
  dispX = 8;
  dispY = 8;
  /** SPRITESTATEDATA1_X/YSTEPVECTOR, read by sprite collisions. A try writes them; a
   *  failed try and an ordinary step's end clear them; a scripted step keeps them. */
  vx = 0;
  vy = 0;
  /** Set when a scripted walk has read its terminator. */
  scriptDone = false;
  /** How many scripted steps have started. */
  stepsStarted = 0;

  private counter = 0;
  private px = 1;
  private stepDir: Direction = 'down';
  private script: NpcStepPlan[] | null = null;
  private inStep: { steps: Direction[]; index: number; counter: number; started: boolean } | null = null;
  private heldAfterInStep = false;

  /** Pixels moved by the pass just run. */
  dx = 0;
  dy = 0;
  /** A step started on the pass just run (its map position changed). */
  startedStep = false;

  constructor(facing: Direction, movement1: NpcMovement1, movement2: NpcMovement2) {
    this.facing = facing;
    this.movement1 = movement1;
    this.movement2 = movement2;
  }

  /** WALK: ordinary tries may translate. */
  get wanders(): boolean { return this.movement1 === 'walk'; }

  /** A fixed movement-byte-2 facing, which every try returns to. */
  get fixedFacing(): Direction | null {
    const m = this.movement2;
    return m === 'up' || m === 'down' || m === 'left' || m === 'right' ? m : null;
  }

  get isMoving(): boolean {
    return this.status === 'moving' || (this.inStep !== null && this.inStep.started && this.inStep.index < this.inStep.steps.length);
  }

  get scripted(): boolean { return this.script !== null || this.inStep !== null; }
  /** DoScriptedNPCMovement writes its image on every update, including mid-step. */
  get inStepAnimation(): boolean { return this.inStep !== null; }

  /** The animation frame to draw. Walking in step, AdvanceScriptedNPCAnimFrameCounter
   *  reads offset $8, SPRITESTATEDATA1_ANIMFRAMECOUNTER: the same frame, advancing every
   *  4 updates (pret's comment there says "intra-animation frame counter", which is 7). */
  get displayFrame(): number {
    return this.anim.frame;
  }

  /** InitializeSpriteStatus: ready, displacement bytes 8 and 8. */
  initialize(): void {
    this.status = 'ready';
    this.dispX = 8;
    this.dispY = 8;
  }

  /** SetSpriteMovementBytesToFF: STAY, NONE. Status, delay, facing and displacement are
   *  untouched; the next try turns at random. */
  stayAndFaceAnyDirection(): void {
    this.movement1 = 'stay';
    this.movement2 = 'none';
  }

  /**
   * MoveSprite: walk these steps. The terminator turns the sprite into STAY.
   *
   * `keepStatus` is MoveSprite_ itself (home/pathfinding.asm): it leaves the movement status
   * alone, so a ready sprite steps on its next update, a resting one is made ready first
   * and a moving one finishes its step (the trainer walk-up, A1c). Without it the sprite is
   * put to rest for one update first, which matches the cutscenes ported so far (Pallet's
   * Oak gets MovementStatus $2 after ShowObject); the other callers wait for the J2 audit.
   */
  startScript(steps: NpcStepPlan[], keepStatus = false): void {
    this.inStep = null;
    this.heldAfterInStep = false;
    this.script = steps;
    this.stepsStarted = 0;
    this.scriptDone = false;
    if (keepStatus) return;
    this.status = 'resting';
    this.delay = 1;
  }

  /** DoScriptedNPCMovement: walk these steps in step with the player. */
  startInStep(steps: Direction[]): void {
    this.script = null;
    this.heldAfterInStep = false;
    this.stepsStarted = 0;
    this.scriptDone = false;
    this.inStep = { steps, index: 0, counter: 8, started: false };
  }

  /** One UpdateSprites (after CheckSpriteAvailability, which the caller runs). */
  pass(ctx: NpcPassContext): void {
    this.dx = 0;
    this.dy = 0;
    this.startedStep = false;

    if (this.inStep) {
      this.inStepPass();
      return;
    }
    if (this.heldAfterInStep) return;

    switch (this.status) {
      case 'init':
        this.initialize();
        return;

      case 'resting':
        this.anim.frame = 0; // NotYetMoving
        // A scripted sprite's delay is forced to zero: ready on this update
        if (this.script) {
          this.status = 'ready';
          return;
        }
        this.delay = (this.delay - 1) & 0xff;
        if (this.delay === 0) this.status = 'ready';
        return;

      case 'ready': {
        if (ctx.playerWalking) return;
        if (this.script) {
          if (this.stepsStarted >= this.script.length) {
            // The terminator: movement byte 1 becomes STAY; no random byte, still ready
            this.script = null;
            this.scriptDone = true;
            this.movement1 = 'stay';
            return;
          }
          const plan = this.script[this.stepsStarted++];
          this.beginStep(plan.dir, plan.mode === 'fast' ? 2 : 1);
          return;
        }
        // .randomMovement: the direction byte, then TryWalking (Func_5337 first)
        const dir = npcDirection(ctx.random(), this.movement2);
        this.facing = dir;
        this.setVector(dir);
        const next = this.movement1 === 'walk' && ctx.canWalk(dir)
          ? npcDisplacement({ x: this.dispX, y: this.dispY }, dir)
          : null;
        if (!next) {
          // CanWalkOntoTile .impassable
          this.status = 'resting';
          this.setVector(null);
          this.delay = ctx.random() & 0x7f;
          return;
        }
        this.dispX = next.x;
        this.dispY = next.y;
        this.beginStep(dir, 1);
        return;
      }

      case 'moving': {
        this.anim.tick();
        const d = delta(this.stepDir, this.px);
        this.dx = d.dx;
        this.dy = d.dy;
        this.counter--;
        if (this.counter <= 0) {
          if (this.script) {
            this.status = 'ready';
          } else {
            // .initNextMovementCounter
            this.status = 'resting';
            this.delay = ctx.random() & 0x7f;
            this.setVector(null);
          }
        }
        return;
      }
    }
  }

  /** TryWalking (or Func_5288's fast set): facing, vector, map position, counter, no
   *  pixel yet. */
  private beginStep(dir: Direction, px: number): void {
    this.stepDir = dir;
    this.facing = dir;
    this.setVector(dir);
    this.px = px;
    this.counter = STEP_PX / px;
    this.status = 'moving';
    this.startedStep = true;
  }

  private setVector(dir: Direction | null): void {
    this.vx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    this.vy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  }

  private inStepPass(): void {
    const s = this.inStep!;
    if (!s.started) {
      // InitScriptedNPCMovement
      s.started = true;
      this.anim.tick();
      return;
    }
    if (s.index >= s.steps.length) {
      this.inStep = null;
      this.scriptDone = true;
      this.heldAfterInStep = true;
      return;
    }
    const dir = s.steps[s.index];
    if (s.counter === 8) {
      this.startedStep = true;
      this.stepsStarted++;
    }
    this.stepDir = dir;
    this.facing = dir;
    const d = delta(dir, 2);
    this.dx = d.dx;
    this.dy = d.dy;
    this.anim.tick();
    s.counter--;
    if (s.counter === 0) {
      s.counter = 8;
      s.index++;
    }
  }
}
