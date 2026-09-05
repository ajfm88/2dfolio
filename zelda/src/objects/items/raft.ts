// Raft — Z_04.asm:3863 UpdateDock
// Auto-activates at dock positions in rooms $3F and $55.
// Halts Link and carries him across water at 1px/frame.

import {
  RAFT_ARRIVAL_Y,
  RAFT_DEPARTURE_Y,
  RAFT_MIDPOINT_Y,
  RAFT_SPRITE_OFFSET_Y,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Link } from '../player/link.js';
import type { Renderer } from '../../render/renderer.js';
import { drawItemSprite, getProcessedItemsCanvas } from '../../data/item-sprites.js';

export enum RaftState {
  Idle      = 0,
  MovingDown = 1,
  MovingUp  = 2,
}

export interface RaftUpdateResult {
  readonly shouldTransitionUp: boolean;
}

const NO_TRANSITION: RaftUpdateResult = { shouldTransitionUp: false };

export class Raft {
  private readonly _dockX: number;
  private _state = RaftState.Idle;
  private _raftY = 0;

  constructor(dockX: number) {
    this._dockX = dockX;
  }

  get state(): RaftState { return this._state; }
  get dockX(): number { return this._dockX; }
  get isMoving(): boolean { return this._state !== RaftState.Idle; }

  update(link: Link): RaftUpdateResult {
    if (this._state === RaftState.Idle) {
      if (link.posX !== this._dockX) return NO_TRANSITION;

      if (link.posY === RAFT_ARRIVAL_Y) {
        this._state = RaftState.MovingDown;
        this._raftY = link.posY + RAFT_SPRITE_OFFSET_Y;
        link.halted = true;
        link.setDirection(Direction.Down);
        return NO_TRANSITION;
      }

      if (link.posY === RAFT_DEPARTURE_Y) {
        this._state = RaftState.MovingUp;
        this._raftY = link.posY + RAFT_SPRITE_OFFSET_Y;
        link.halted = true;
        link.setDirection(Direction.Up);
        return NO_TRANSITION;
      }

      return NO_TRANSITION;
    }

    if (this._state === RaftState.MovingDown) {
      link.setPosition(link.posX, link.posY + 1);
      this._raftY = link.posY + RAFT_SPRITE_OFFSET_Y;

      if (link.posY >= RAFT_MIDPOINT_Y) {
        this._state = RaftState.Idle;
        link.halted = false;
      }
      return NO_TRANSITION;
    }

    // MovingUp
    link.setPosition(link.posX, link.posY - 1);
    this._raftY = link.posY + RAFT_SPRITE_OFFSET_Y;

    if (link.posY <= RAFT_ARRIVAL_Y) {
      this._state = RaftState.Idle;
      link.halted = false;
      return { shouldTransitionUp: true };
    }
    return NO_TRANSITION;
  }

  render(renderer: Renderer, linkX: number): void {
    if (this._state === RaftState.Idle) return;
    const itemsCanvas = getProcessedItemsCanvas();
    if (itemsCanvas) {
      drawItemSprite(renderer.ctx, itemsCanvas, 0x0c, linkX, this._raftY);
    } else {
      renderer.ctx.fillStyle = '#8b5e14';
      renderer.ctx.fillRect(linkX, this._raftY, 16, 16);
    }
  }
}
