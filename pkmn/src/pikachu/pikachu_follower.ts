import type { Direction } from '../core';
import { TILE_SIZE } from '../core';
import { drawSprite, loadSprite, drawShadowUnderSprites } from '../renderer';
import type { SpriteDraw } from '../renderer';
import { hasFlag } from '../events';
import type { BattlePokemon } from '../battle';
import { spawnPlacement, type PikachuSpawnState } from './pikachu_spawn';
import { getPikachuHappiness } from './pikachu_happiness';
import { WalkAnim, walkFrame, pikachuAnimPeriod } from '../overworld/walk_pace';
import { inSpriteWindow, pikachuCovered } from '../overworld/sprite_visibility';
import { uiTiles } from '../renderer/ui_tiles';
import { screenPixels, PIKACHU_SLOT, PLAYER_SCREEN_X, PLAYER_SCREEN_Y } from '../overworld/sprite_collision';
import type { CollisionSprite } from '../overworld/sprite_collision';
import { PikachuIdle, seedFollowCommand, followEndFacing, followCommandFor, commandFacing } from './pikachu_idle';
import { PikachuFollowBuffer } from './follow_buffer';
import type { PikachuImageUpdate } from './pikachu_idle';
import { PikachuMovementRun, createPikachuMovementWork, SPRITE_FACING } from './pikachu_movement';
import type { PikachuMovementData } from '../rom/extractors/pikachu_movement';

interface FrameSet { stand: number; walk: number }

const FRAMES: Record<Direction, FrameSet> = {
  down:  { stand: 0,  walk: 48 },
  up:    { stand: 16, walk: 64 },
  left:  { stand: 32, walk: 80 },
  right: { stand: 32, walk: 80 }, // drawn flipped
};

const STEP_SIZE = 16;       // pixels per step (2 tiles)
/** MAPX/MAPY count from the map's 4-step border. */
const MAP_BORDER = 4;
// Per overworld pass (two frames), pikachu_follow.asm: NormalPikachuFollow adds the step
// vector twice for 8 updates, FastPikachuFollow four times for 4
const NORMAL_SPEED = 2;
const FAST_SPEED = 4;

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

/** The random byte the idle routines read (hRandomAdd). */
const randomByte = (): number => Math.floor(Math.random() * 256);

/** SPRITE_FACING_* → direction. */
const FACING_DIRECTION: Record<number, Direction> = { 0x0: 'down', 0x4: 'up', 0x8: 'left', 0xc: 'right' };

/** The movement interpreter's WRAM (wPikaSpriteX/Y, offsets, timers): one per game, kept
 *  between calls as the cartridge keeps it. */
const movementWork = createPikachuMovementWork();

/** What one UpdateSprites gives Pikachu. */
export interface PikachuSpriteContext {
  /** wWalkCounter ≠ 0. */
  playerWalking: boolean;
  /** wXCoord / wYCoord, which change at the end of a step. */
  playerMapStep: { x: number; y: number };
  /** wSpritePlayerStateData1FacingDirection */
  playerFacing: Direction;
  /** A random byte (tests inject one). */
  random?: () => number;
  /** UI tiles on screen ($60+ means a box), with the player's world pixels to place
   *  Pikachu's footprint. Ordinary overworld passes have no UI and leave this out. */
  ui?: PikachuUiTiles;
  /** Pikachu's lower-left tile is the map's grass tile (the GRASSPRIORITY byte that
   *  WillPikachuSpawnOnTheScreen leaves in A, read by Func_fc745). */
  inGrass?: boolean;
}

export interface PikachuUiTiles {
  playerX: number;
  playerY: number;
  tileAt: (tx: number, ty: number) => number;
}

/** The UpdateSprites DisplayTextIDInit runs once a text box or menu is up. */
export interface PikachuFontLoadedContext extends PikachuSpriteContext {
  ui: PikachuUiTiles;
}

/**
 * Pikachu following the player through Yellow's retained command buffer (A6d), with its
 * own map position (MAPX/MAPY) beside its pixels: following moves the map position as a
 * move starts, the movement interpreter as each absolute command ends.
 *
 * Three update paths:
 *   - updateSprite: UpdateSprites (SpawnPikachu_), with the screen check, the follow moves,
 *     idling (pikachu_idle.ts) and the antics;
 *   - fontLoadedUpdate: the same routine once a text box or menu is up (BIT_FONT_LOADED):
 *     the screen check, then Func_fc745 (talked to) or Func_fc76a (back to ready);
 *   - startMovement / tickMovement: ApplyPikachuMovementData (pikachu_movement.ts), a
 *     blocking call that moves only Pikachu, one tick per game frame.
 */
export class PikachuFollower {
  x = 0;
  y = 0;

  private spriteSheet: HTMLCanvasElement | null = null;
  private shadowSheet: HTMLCanvasElement | null = null;
  /** MAPX / MAPY in steps. */
  private mapX = 0;
  private mapY = 0;
  private moving = false;
  /** The move's remaining updates (WALKANIMATIONCOUNTER) and pixels per update. */
  private moveUpdates = 0;
  private moveSpeed = NORMAL_SPEED;
  private fastMode = false;
  private hopping = false;     // a two-step follow command (5–8): flat, 4 px an update
  private readonly anim = new WalkAnim();
  private readonly idle = new PikachuIdle();
  private shown = false;

  /** The live facing (wSpritePikachuStateData1FacingDirection). */
  private facing: Direction = 'down';
  /** IMAGEINDEX: what UpdatePikachuWalkingSprite last drew; $ff while hidden. */
  private imageShown = false;
  private imageFacing: Direction = 'down';
  private imageFrame = 0;
  /** X/YSTEPVECTOR, for sprite collisions: set while a move is under way. */
  private vx = 0;
  private vy = 0;
  /** Movement status bit 7 (BIT_FACE_PLAYER): talked to, not yet turned. */
  private facePlayerPending = false;

  private readonly followBuffer = new PikachuFollowBuffer();
  private hopToggle = false;
  /** ApplyPikachuMovementData under way, and its latched GRASSPRIORITY. */
  private movement: PikachuMovementRun | null = null;
  private movementGrass = false;
  /** The player's world pixels as the call started: where screen ($40, $3c) is. */
  private movementAnchor = { x: 0, y: 0 };

  get followCommand(): number { return this.followBuffer.newest; }
  get followBufferLength(): number { return this.followBuffer.length; }

  async loadSprite(): Promise<void> {
    this.spriteSheet = await loadSprite('/gfx/sprites/pikachu.png');
    this.shadowSheet = await loadSprite('/gfx/overworld/shadow.png');
  }

  /** Whether Pikachu is out following (ShouldPikachuSpawn). Hiding it ends any antic. */
  get visible(): boolean { return this.shown; }
  set visible(v: boolean) {
    if (!v) {
      this.idle.reset();
      this.facePlayerPending = false;
      this.movement = null;
    }
    this.shown = v;
  }

  /** The facing. Setting it (a script, talking to Pikachu) also redraws the image. */
  get direction(): Direction { return this.facing; }
  set direction(dir: Direction) {
    this.facing = dir;
    this.imageFacing = dir;
  }

  /** IMAGEINDEX ≠ $ff: drawn, and seen by sprite collisions. */
  get imageVisible(): boolean { return this.imageShown; }

  /** The bounce's screen offset (never the map position). */
  get screenOffset(): { x: number; y: number } {
    return { x: this.idle.offsetX, y: this.idle.offsetY };
  }

  /** The antic under way, if any. */
  get antic(): string | null { return this.idle.antic; }

  /** Pikachu's map position in steps (MAPX/MAPY). */
  get mapStepX(): number { return this.mapX; }
  get mapStepY(): number { return this.mapY; }

  /** Func_fcc08 / Func_fcc64. Bit 6 survives refreshes and interrupted hops. */
  playerStepStarted(dir: Direction, ledge: boolean): void {
    if (ledge) {
      this.hopToggle = !this.hopToggle;
      if (!this.hopToggle) return;
    }
    this.followBuffer.append(followCommandFor(dir, ledge));
  }

  /** AppendPikachuFollowCommandToBuffer: the newest command, which stays retained once
   *  everything before it has executed. */
  appendFollowCommand(command: number): void {
    this.followBuffer.append(command);
  }

  /** Talking to Pikachu: IsSpriteInFrontOfPlayer sets its movement status bit 7
   *  (BIT_FACE_PLAYER). The next update that finds Pikachu on screen serves it
   *  (Func_fc745), whether the font is loaded or not. */
  requestFacePlayer(): void {
    this.facePlayerPending = true;
  }

  /**
   * UpdateSprites (SpawnPikachu_). Unless WillPikachuSpawnOnTheScreen passes, nothing
   * runs and the image is hidden. A pending face-player request takes the update
   * (Func_fc745). An antic under way takes the update; otherwise a
   * follow move continues or starts (Func_fc7aa), taking its first move in the same
   * update, so following runs 8 passes a step with no gap; with nothing to execute Pikachu
   * idles in the same call (Func_fc803).
   */
  updateSprite(ctx: PikachuSpriteContext): void {
    if (!this.onScreen(ctx)) return;
    if (this.facePlayerPending) {
      this.facePlayer(ctx, false);
      return;
    }
    const idleCtx = {
      playerWalking: ctx.playerWalking,
      overlapsPlayer: this.mapStepX === ctx.playerMapStep.x && this.mapStepY === ctx.playerMapStep.y,
      followCommand: this.followCommand,
      random: ctx.random ?? randomByte,
    };
    const sprite = { facing: this.facing, anim: this.anim };
    if (this.idle.antic) {
      const image = this.idle.anticUpdate(sprite, idleCtx);
      this.facing = sprite.facing;
      this.applyImage(image);
      return;
    }
    if (!this.moving && !this.startNextMove()) {
      const image = this.idle.idle(sprite, idleCtx);
      this.facing = sprite.facing;
      this.applyImage(image);
      return;
    }
    this.advanceMove();
    if (!this.moving) {
      // ComputePikachuFacingDirection: the live facing only; the image keeps the last move
      this.facing = followEndFacing(
        this.followBuffer.newestQueued !== 0, this.followBuffer.newestQueued,
        { x: this.mapStepX, y: this.mapStepY }, ctx.playerMapStep, ctx.playerFacing,
      );
    }
  }

  /**
   * SpawnPikachu_ with the font loaded: the UpdateSprites DisplayTextIDInit runs after
   * drawing a text box or the START menu (engine/menus/display_text_id_init.asm), and the
   * Pokécenter runs before Pikachu walks to the nurse. A covered or off-window Pikachu is
   * only hidden and keeps everything as it was. Otherwise, if it was talked to,
   * Func_fc745 turns it to face the player; else Func_fc76a puts it back to ready: the
   * standing image, its screen position back on its map position (which ends a bounce
   * and finishes a move), the countdown at zero, and the follow command refreshed.
   */
  fontLoadedUpdate(ctx: PikachuFontLoadedContext): void {
    if (!this.onScreen(ctx)) return;
    if (this.facePlayerPending) {
      this.facePlayer(ctx, true);
      return;
    }
    const overlaps = this.mapStepX === ctx.playerMapStep.x && this.mapStepY === ctx.playerMapStep.y;
    this.anim.intra = 0;
    this.anim.frame = 0;
    // Func_fc76a
    this.applyImage(overlaps ? 'hidden' : 'refresh');
    if (!ctx.playerWalking) {
      // InitializeSpriteScreenPosition: pixels from the map position (ends a move)
      this.x = this.mapX * STEP_SIZE;
      this.y = this.mapY * STEP_SIZE;
      this.moving = false;
      this.hopping = false;
      this.moveUpdates = 0;
      this.idle.offsetX = 0;
      this.idle.offsetY = 0;
    }
    this.idle.antic = null;
    this.idle.counter = 0;
    // RefreshPikachuFollow
    this.refreshFollow(ctx.playerMapStep);
  }

  /**
   * ApplyPikachuMovementData: Pikachu's sprite data goes to the interpreter as it is —
   * pixels, facing, image, counters and map position — and the first command iteration
   * runs now. Nothing else about Pikachu changes: its follow buffer, hop toggle, idle state
   * and a move under way are left for the next ordinary update. The cartridge keeps an
   * antic's bounce in YPIXELS and the bounce later subtracts its own last offset, so the
   * interpreter sees the pixels with the offset and they come back without it.
   * The interpreter works in the cartridge's bytes: screen pixels (the player, who stands
   * still through the call, at $40/$3c) and map steps + 4, each wrapping at 256; they are
   * converted here, both ways. `inGrass` is Pikachu's GRASSPRIORITY at the call.
   */
  startMovement(
    data: PikachuMovementData, program: readonly number[], inGrass: boolean,
    player: { x: number; y: number },
  ): void {
    this.movementAnchor = { x: player.x, y: player.y };
    const screen = screenPixels(this.x, this.y, player.x, player.y, this.idle.offsetX, this.idle.offsetY);
    this.movement = new PikachuMovementRun(data, program, {
      x: screen.x, y: screen.y,
      facing: SPRITE_FACING[this.facing],
      image: this.imageShown ? SPRITE_FACING[this.imageFacing] | (this.imageFrame & 3) : 0xff,
      intra: this.anim.intra, anim: this.anim.frame,
      mapX: (this.mapX + MAP_BORDER) & 0xff, mapY: (this.mapY + MAP_BORDER) & 0xff,
      grass: inGrass,
    }, movementWork);
    this.applyMovement();
  }

  /** World pixels for the interpreter's screen pixels (the camera is fixed during a call). */
  private worldX(screenX: number): number { return screenX - PLAYER_SCREEN_X + this.movementAnchor.x; }
  private worldY(screenY: number): number { return screenY - PLAYER_SCREEN_Y + this.movementAnchor.y; }

  /** One game frame of the call. True on the frame it returns (the run is released). */
  tickMovement(): boolean {
    const run = this.movement;
    if (!run) return true;
    const done = run.tick();
    this.applyMovement();
    if (done) this.movement = null;
    return done;
  }

  /** A movement call is under way (it blocks its caller). */
  get movementActive(): boolean { return this.movement !== null; }
  /** Pikachu holds slot 0: drawn above the NPCs and the player. */
  get movementSwapped(): boolean { return this.movement?.swapped ?? false; }
  /** GRASSPRIORITY during a call: latched at the call, zero while the shadow shows. Null
   *  outside a call (the follower's tile decides). */
  get movementGrassPriority(): boolean | null { return this.movement ? this.movementGrass : null; }

  /** Application cleanup (a warp, a new game, a replaced script): drop the call. */
  cancelMovement(): void {
    this.movement = null;
  }

  /** The interpreter's shadow (OAM 36/37) at its base position, under every sprite pixel. */
  renderMovementShadow(cameraX: number, cameraY: number, sprites: readonly SpriteDraw[]): void {
    const run = this.movement;
    if (!run?.shadow || !this.shadowSheet) return;
    drawShadowUnderSprites(this.shadowSheet, this.worldX(run.baseX) - cameraX, this.worldY(run.baseY) - cameraY + 8, sprites);
  }

  /** Place Pikachu 1 step behind the player. */
  spawn(playerX: number, playerY: number, playerDir: Direction): void {
    const behind = OPPOSITE[playerDir];
    const dx = behind === 'left' ? -STEP_SIZE : behind === 'right' ? STEP_SIZE : 0;
    const dy = behind === 'up' ? -STEP_SIZE : behind === 'down' ? STEP_SIZE : 0;
    this.x = playerX + dx;
    this.y = playerY + dy;
    this.direction = playerDir;
    this.refresh(playerX, playerY);
  }

  /** Place Pikachu after a warp, for a Yellow spawn state (pikachu_spawn.ts). On the
   *  player's tile (states 0/3) it stays hidden until the player steps off. */
  spawnAtState(playerX: number, playerY: number, playerDir: Direction, state: PikachuSpawnState): void {
    const { dx, dy, facing } = spawnPlacement(state, playerDir);
    this.x = playerX + dx * STEP_SIZE;
    this.y = playerY + dy * STEP_SIZE;
    this.direction = facing;
    this.refresh(playerX, playerY);
  }

  /** ClearPikachuFollowCommandBuffer. */
  clearBuffer(): void {
    this.followBuffer.clear();
  }

  /** RefreshPikachuFollow: seed the retained command from native map coordinates. */
  refreshFollow(playerMapStep: { x: number; y: number }): void {
    this.clearBuffer();
    const command = seedFollowCommand({ x: this.mapStepX, y: this.mapStepY }, playerMapStep);
    if (command !== 0) this.followBuffer.append(command);
  }

  /** DisablePikachuOverworldSpriteDrawing: IMAGEINDEX = $ff. */
  hideImage(): void {
    this.imageShown = false;
  }

  /** SetSpriteFacingDirection on Pikachu's slot: the live facing only, no redraw. */
  setLiveFacing(dir: Direction): void {
    this.facing = dir;
  }

  /** SpriteFunc_34a1 on Pikachu's slot: its standing image written straight to IMAGEINDEX. */
  showStandingImage(dir: Direction): void {
    this.imageShown = true;
    this.imageFacing = dir;
    this.imageFrame = 0;
  }

  /** A script placing Pikachu directly ends any antic. */
  stopIdle(): void {
    this.idle.reset();
  }

  get tileX(): number { return Math.round(this.x / TILE_SIZE); }
  get tileY(): number { return Math.round(this.y / TILE_SIZE); }

  /** Whether Pikachu is currently mid-step. */
  get isMoving(): boolean { return this.moving; }


  /** Slot 15 of the sprite table, at its screen pixels including the bounce. */
  collisionSprite(playerX: number, playerY: number): CollisionSprite {
    const p = screenPixels(this.x, this.y, playerX, playerY, this.idle.offsetX, this.idle.offsetY);
    return { slot: PIKACHU_SLOT, available: this.imageShown, x: p.x, y: p.y, vx: this.vx, vy: this.vy };
  }

  render(cameraX: number, cameraY: number): void {
    if (!this.spriteSheet || !this.visible || !this.imageShown) return;

    const screenX = this.x - cameraX + this.idle.offsetX;
    // -4px offset matches original GB sprite positioning
    const screenY = this.y - cameraY - 4 + this.idle.offsetY;
    // Whole-sprite hiding under UI from the first frame a box is drawn (screenY + 4 is
    // YPIXELS; the camera's own 4 px, A6b F-1, is left alone)
    if (pikachuCovered(screenX, screenY + 4, uiTiles.tileAt)) return;
    const frame = FRAMES[this.imageFacing];
    // The walking frames per data/sprites/facings.asm (the second one mirrored up/down)
    const { walking, mirrored } = walkFrame(this.imageFacing, this.imageFrame);
    const frameY = walking ? frame.walk : frame.stand;
    const flipX = (this.imageFacing === 'right') !== mirrored;
    drawSprite(this.spriteSheet, 0, frameY, screenX, screenY, flipX);
  }

  /** Func_fc793 after a spawn: the buffer refreshed with the command toward the player,
   *  ready, the countdown at zero, the image hidden until the next update. */
  private refresh(playerX: number, playerY: number): void {
    this.mapX = Math.round(this.x / STEP_SIZE);
    this.mapY = Math.round(this.y / STEP_SIZE);
    this.movement = null;
    this.moving = false;
    this.hopping = false;
    this.moveUpdates = 0;
    this.vx = 0;
    this.vy = 0;
    this.idle.reset();
    this.imageShown = false;
    this.facePlayerPending = false;
    this.refreshFollow({ x: Math.round(playerX / STEP_SIZE), y: Math.round(playerY / STEP_SIZE) });
  }

  /**
   * Func_fc745: bit 7 cleared, the countdown set to A (WillPikachuSpawnOnTheScreen's grass
   * priority byte: 0, or $80 on grass), facing opposite the player, animation counters
   * cleared, then UpdatePikachuWalkingSprite (with the font loaded it hides an
   * overlapping Pikachu). The ASM keeps an antic's status here; ending it avoids indexing
   * Pointer_fc8d6 with that countdown (and this engine's tile-based talk check can reach
   * a bouncing Pikachu, so the offset goes too).
   */
  private facePlayer(ctx: PikachuSpriteContext, fontLoaded: boolean): void {
    this.facePlayerPending = false;
    this.idle.reset();
    this.idle.counter = ctx.inGrass ? 0x80 : 0;
    this.facing = OPPOSITE[ctx.playerFacing];
    this.anim.intra = 0;
    this.anim.frame = 0;
    const overlaps = this.mapStepX === ctx.playerMapStep.x && this.mapStepY === ctx.playerMapStep.y;
    this.applyImage(fontLoaded && overlaps ? 'hidden' : 'refresh');
  }

  /** WillPikachuSpawnOnTheScreen: inside the sprite window and not under UI. When it
   *  fails the image is hidden and nothing else changes. */
  private onScreen(ctx: PikachuSpriteContext): boolean {
    let ok = inSpriteWindow(this.mapStepX, this.mapStepY, ctx.playerMapStep.x, ctx.playerMapStep.y);
    if (ok && ctx.ui) {
      const p = screenPixels(this.x, this.y, ctx.ui.playerX, ctx.ui.playerY, this.idle.offsetX, this.idle.offsetY);
      ok = !pikachuCovered(p.x, p.y, ctx.ui.tileAt);
    }
    if (!ok) this.imageShown = false;
    return ok;
  }

  /**
   * Func_fc7aa: start the next queued move. False when nothing can execute. The map
   * position moves now (AddPikachuStepVector, twice for a hop); the pixels follow by the
   * step vector each update (NormalPikachuFollow 8 × 2 px, FastPikachuFollow 4 × 4 px,
   * Func_fca0a 8 × 4 px).
   */
  private startNextMove(): boolean {
    const command = this.followBuffer.pop();
    if (command === null) return false;
    this.hopping = command >= 5;
    this.fastMode = !this.hopping && this.followBuffer.fast;
    this.facing = commandFacing(command);
    this.vx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0;
    this.vy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0;
    const steps = this.hopping ? 2 : 1;
    this.mapX += this.vx * steps;
    this.mapY += this.vy * steps;
    this.moveSpeed = this.hopping || this.fastMode ? FAST_SPEED : NORMAL_SPEED;
    this.moveUpdates = this.fastMode ? 4 : 8;
    this.moving = true;
    return true;
  }

  /** One update of the move under way, then UpdatePikachuWalkingSprite. At the end the
   *  shared countdown is zero and the step vector is reset. */
  private advanceMove(): void {
    this.x += this.vx * this.moveSpeed;
    this.y += this.vy * this.moveSpeed;
    this.anim.tickExact(pikachuAnimPeriod(getPikachuHappiness()));
    this.applyImage('refresh');

    if (--this.moveUpdates <= 0) {
      this.moving = false;
      this.hopping = false;
      this.moveUpdates = 0;
      this.vx = 0;
      this.vy = 0;
      this.idle.counter = 0;
    }
  }

  /** Write the interpreter's sprite fields back (GetCoordsForPikachuShadow's results). */
  private applyMovement(): void {
    const s = this.movement!.sprite;
    this.x = this.worldX(s.x) - this.idle.offsetX;
    this.y = this.worldY(s.y) - this.idle.offsetY;
    this.facing = FACING_DIRECTION[s.facing & 0xc];
    this.imageShown = s.image !== 0xff;
    if (this.imageShown) {
      this.imageFacing = FACING_DIRECTION[s.image & 0xc];
      this.imageFrame = s.image & 3;
    }
    this.anim.intra = s.intra;
    this.anim.frame = s.anim;
    this.mapX = s.mapX - MAP_BORDER;
    this.mapY = s.mapY - MAP_BORDER;
    this.movementGrass = s.grass;
  }

  private applyImage(update: PikachuImageUpdate): void {
    if (update === 'hidden') {
      this.imageShown = false;
    } else if (update === 'refresh') {
      this.imageShown = true;
      this.imageFacing = this.facing;
      this.imageFrame = this.anim.frame;
    }
  }
}

/** Check if Pikachu should be following the player. */
export function shouldPikachuFollow(party: BattlePokemon[]): boolean {
  if (!hasFlag('BATTLED_RIVAL_IN_OAKS_LAB')) return false;
  // Assembly: IsStarterPikachuAliveInOurParty — searches entire party
  return party.some(mon => mon.species.id === 25 && mon.currentHp > 0);
}
