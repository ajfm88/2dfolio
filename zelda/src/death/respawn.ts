import {
  LINK_START_Y,
  RESPAWN_HEALTH,
  RESPAWN_LINK_X,
  RESPAWN_SCREEN_COL,
  RESPAWN_SCREEN_ROW,
} from '../core/constants.js';
import { Direction } from '../core/types.js';

export interface RespawnParams {
  readonly screenRow: number;
  readonly screenCol: number;
  readonly linkX: number;
  readonly linkY: number;
  readonly linkDirection: Direction;
  readonly health: number;
}

// Z_07.asm:1442 InitMode3_Sub1
export function computeRespawnParams(currentLevel: number): RespawnParams {
  if (currentLevel > 0) {
    // TODO(H1): dungeon respawn — use LevelInfo_StartRoomId for dungeon entrance
  }

  return {
    screenRow: RESPAWN_SCREEN_ROW,
    screenCol: RESPAWN_SCREEN_COL,
    linkX: RESPAWN_LINK_X,
    linkY: LINK_START_Y,
    linkDirection: Direction.Up,
    health: RESPAWN_HEALTH,
  };
}
