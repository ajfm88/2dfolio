// Recorder/Flute — Z_07.asm:2500 WieldFlute, Z_01.asm:1893 SummonWhirlwind
// Multi-phase effect: 152f gameplay freeze → pond-drying OR whirlwind teleport.

import {
  FLUTE_POND_CYCLE_INTERVAL,
  FLUTE_POND_CYCLE_STEPS,
  FLUTE_POND_STAIRS_STEP,
  FLUTE_POND_WALKABLE_STEP,
  FLUTE_TIMER,
  WHIRLWIND_CATCH_THRESHOLD,
  WHIRLWIND_DEST_ROOMS,
  WHIRLWIND_DEST_YS,
  nesScreenYToPlayArea,
  WHIRLWIND_DROP_X,
  WHIRLWIND_EXIT_X,
  WHIRLWIND_SPEED,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';

export enum RecorderPhase {
  Tune             = 0,
  PondDrying       = 1,
  WhirlwindSource  = 2,
  TransitionPending = 3,
  WhirlwindDest    = 4,
  Done             = 5,
}

enum PostTunePath {
  PondSecret,
  Whirlwind,
  NothingDungeonOnly,
}

// Z_01.asm:1959 AdvanceTeleportingLevelIndex
function advanceIndex(index: number, facing: Direction): number {
  const increment = (facing === Direction.Right || facing === Direction.Down) ? 1 : -1;
  return (index + increment) & 0x07;
}

function findWhirlwindDestination(
  startIndex: number,
  facing: Direction,
  triforce: number,
): { destIndex: number } | null {
  if (triforce === 0) return null;

  let idx = advanceIndex(startIndex, facing);
  for (let i = 0; i < 8; i++) {
    if (triforce & (1 << idx)) {
      return { destIndex: idx };
    }
    idx = advanceIndex(idx, facing);
  }
  return null;
}

export class RecorderEffect {
  private _phase = RecorderPhase.Tune;
  private _tuneTimer = FLUTE_TIMER;
  private readonly _postTunePath: PostTunePath;

  // Pond-drying state
  private _pondCycle = 0;
  private _pondFrameCounter = 0;
  private _waterWalkable = false;
  private _revealStairs = false;
  private _revealConsumed = false;

  // Whirlwind state
  private _whirlwindX = 0;
  private _whirlwindY = 0;
  private _linkCaught = false;
  private _destIndex = -1;
  private _frameCount = 0;

  // Persistent index updated across flute uses
  readonly updatedTeleportIndex: number;

  constructor(
    screenId: number,
    linkFacing: Direction,
    triforce: number,
    teleportIndex: number,
    fluteSecretRoomIds: readonly number[],
    linkY: number,
  ) {
    this._whirlwindY = linkY;

    // Q1 rule: only room 66 ($42) is a flute secret in Quest 1
    const isSecretRoom = screenId === 66 && fluteSecretRoomIds.includes(screenId);

    if (isSecretRoom) {
      this._postTunePath = PostTunePath.PondSecret;
      this.updatedTeleportIndex = teleportIndex;
    } else {
      const dest = findWhirlwindDestination(teleportIndex, linkFacing, triforce);
      if (dest) {
        this._postTunePath = PostTunePath.Whirlwind;
        this._destIndex = dest.destIndex;
        this.updatedTeleportIndex = dest.destIndex;
      } else {
        this._postTunePath = PostTunePath.NothingDungeonOnly;
        this.updatedTeleportIndex = teleportIndex;
      }
    }
  }

  get phase(): RecorderPhase { return this._phase; }
  get isDone(): boolean { return this._phase === RecorderPhase.Done; }
  get linkCaught(): boolean { return this._linkCaught; }
  get whirlwindX(): number { return this._whirlwindX; }
  get whirlwindY(): number { return this._whirlwindY; }
  get waterWalkable(): boolean { return this._waterWalkable; }

  get revealStairs(): boolean {
    if (this._revealStairs && !this._revealConsumed) {
      this._revealConsumed = true;
      return true;
    }
    return false;
  }

  get destinationScreenId(): number {
    return WHIRLWIND_DEST_ROOMS[this._destIndex] ?? 0;
  }

  get destinationLinkY(): number {
    return nesScreenYToPlayArea(WHIRLWIND_DEST_YS[this._destIndex] ?? 0x8D);
  }

  get isWhirlwindPhase(): boolean {
    return this._phase === RecorderPhase.WhirlwindSource ||
           this._phase === RecorderPhase.WhirlwindDest;
  }

  startDestinationPhase(linkY: number): void {
    this._phase = RecorderPhase.WhirlwindDest;
    this._whirlwindX = 0;
    this._whirlwindY = linkY;
    this._linkCaught = true;
  }

  update(linkX: number, linkY: number): void {
    this._frameCount++;

    switch (this._phase) {
      case RecorderPhase.Tune:
        this.updateTune();
        break;
      case RecorderPhase.PondDrying:
        this.updatePondDrying();
        break;
      case RecorderPhase.WhirlwindSource:
        this.updateWhirlwindSource(linkX, linkY);
        break;
      case RecorderPhase.WhirlwindDest:
        this.updateWhirlwindDest();
        break;
      default:
        break;
    }
  }

  render(renderer: Renderer): void {
    if (!this.isWhirlwindPhase) return;

    const ctx = renderer.ctx;
    const x = this._whirlwindX;
    const y = this._whirlwindY;

    // Whirlwind placeholder: cycling colored column
    const paletteCycle = this._frameCount & 0x03;
    const colors = ['#aaddff', '#88bbee', '#6699dd', '#4477cc'];
    const color = colors[paletteCycle]!;

    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y - 8, 12, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, y - 4, 6, 16);
    // Swirl marks
    const swirl = (this._frameCount >> 1) & 0x03;
    ctx.fillStyle = '#cceeff';
    ctx.fillRect(x + 3 + swirl, y - 2, 3, 2);
    ctx.fillRect(x + 9 - swirl, y + 6, 3, 2);
  }

  private updateTune(): void {
    this._tuneTimer--;
    if (this._tuneTimer <= 0) {
      switch (this._postTunePath) {
        case PostTunePath.PondSecret:
          this._phase = RecorderPhase.PondDrying;
          this._pondCycle = 1;
          this._pondFrameCounter = 0;
          break;
        case PostTunePath.Whirlwind:
          this._phase = RecorderPhase.WhirlwindSource;
          this._whirlwindX = 0;
          break;
        case PostTunePath.NothingDungeonOnly:
          this._phase = RecorderPhase.Done;
          break;
      }
    }
  }

  private updatePondDrying(): void {
    this._pondFrameCounter++;
    if (this._pondFrameCounter < FLUTE_POND_CYCLE_INTERVAL) return;
    this._pondFrameCounter = 0;

    if (this._pondCycle >= FLUTE_POND_CYCLE_STEPS) {
      this._phase = RecorderPhase.Done;
      return;
    }

    if (this._pondCycle >= FLUTE_POND_WALKABLE_STEP) {
      this._waterWalkable = true;
    }

    if (this._pondCycle === FLUTE_POND_STAIRS_STEP) {
      this._revealStairs = true;
    }

    this._pondCycle++;
  }

  private updateWhirlwindSource(linkX: number, linkY: number): void {
    this._whirlwindX += WHIRLWIND_SPEED;

    if (!this._linkCaught) {
      const dx = Math.abs(this._whirlwindX - linkX);
      const dy = Math.abs(this._whirlwindY - linkY);
      if (dx <= WHIRLWIND_CATCH_THRESHOLD && dy <= WHIRLWIND_CATCH_THRESHOLD) {
        this._linkCaught = true;
      }
    }

    if (this._whirlwindX >= WHIRLWIND_EXIT_X) {
      this._phase = RecorderPhase.TransitionPending;
    }
  }

  private updateWhirlwindDest(): void {
    this._whirlwindX += WHIRLWIND_SPEED;

    if (this._whirlwindX >= WHIRLWIND_DROP_X) {
      this._linkCaught = false;
      this._phase = RecorderPhase.Done;
    }
  }
}
