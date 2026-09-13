// Tile object manager for overworld secrets — Z_04.asm:3569-3795, Z_05.asm:5924-5958
// Detects tile objects (square indices 38-43) in the screen tile grid,
// manages bomb/fire/push interactions, and handles secret reveal.

import { TILE_SIZE } from '../core/constants.js';
import { Direction } from '../core/types.js';

import {
  TILE_OBJ_ROCK,
  TILE_OBJ_ROCK_WALL,
  TILE_OBJ_TREE,
  TILE_OBJ_GRAVESTONE,
  TILE_OBJ_SQUARE_INDICES,
  SQUARE_INDEX_CAVE_ENTRANCE,
  SQUARE_INDEX_STAIRS
} from '../data/secret-types.js';

const COLLISION_THRESHOLD = 0x10; // 16px — Z_04.asm:3819 CheckTileObjWeaponCollision
const PUSH_DISTANCE = 16;
const PUSH_TIMER_THRESHOLD = 16;

// RockPushDirections from Z_04.asm:3566 — $08=Up, $04=Down
const ROCK_PUSH_DIR_UP = 0x08;
const ROCK_PUSH_DIR_DOWN = 0x04;

const PushState = Object.freeze({
  Idle: 0,
  Moving: 1,
  Done: 2
});

export class TileObjectManager {
   _tileObject = null;
   _secretRevealed = false;
   _pushState = PushState.Idle;
   _pushTimer = 0;
   _pushDirection = Direction.Up;
   _pushOffset = 0;
   _pendingReveal = null;

  // Tile overrides for this screen (grid index → replacement square index)
    _tileOverrides = new Map();

  get tileObject() { return this._tileObject; }
  get secretRevealed() { return this._secretRevealed; }
  get tileOverrides() { return this._tileOverrides; }

  consumePendingReveal() {
    const ev = this._pendingReveal;
    this._pendingReveal = null;
    return ev;
  }

  initForScreen(
    screen,
    roomFlags,
    secretsData,
  ) {
    this._tileObject = null;
    this._secretRevealed = false;
    this._pushState = PushState.Idle;
    this._pushTimer = 0;
    this._pushOffset = 0;
    this._pendingReveal = null;
    this._tileOverrides.clear();

    // Check quest mismatch — if this screen's secret doesn't apply to Q1, skip
    const questSecret = secretsData.questSecretByScreen[screen.id];
    if (questSecret !== undefined && questSecret !== 0) {
      // questSecret 1 = Q1 only (quest number 0), 2 = Q2 only (quest number 1)
      // SecretQuestNumbers from Z_04.asm:3822: [0, 0, 1]
      // For Q1 (quest=0): questSecret=1 → SecretQuestNumbers[1]=0 → matches quest 0 ✓
      //                    questSecret=2 → SecretQuestNumbers[2]=1 → doesn't match quest 0 ✗
      if (questSecret === 2) {
        return; // Q2-only secret, skip in Q1
      }
    }

    // Scan tile grid for the first tile object (square indices 38-43)
    for (let row = 0; row < screen.tiles.length; row++) {
      const rowData = screen.tiles[row];
      if (!rowData) continue;
      for (let col = 0; col < rowData.length; col++) {
        const squareIndex = rowData[col];
        if (squareIndex === undefined) continue;
        const tileObjType = TILE_OBJ_SQUARE_INDICES[squareIndex];
        if (tileObjType !== undefined) {
          // Skip Armos types — they're enemy triggers, not secrets (G2)
          if (tileObjType === 0x66 || tileObjType === 0x67) continue;

          this._tileObject = {
            type: tileObjType,
            col,
            row,
            x: col * TILE_SIZE,
            y: row * TILE_SIZE
          };

          // If secret already found, pre-reveal the tile
          if (roomFlags.isSecretFound(screen.id)) {
            this._secretRevealed = true;
            this._pushState = PushState.Done;
            const revealIndex = this.getRevealSquareIndex(tileObjType);
            if (revealIndex !== null) {
              this.applyTileReveal(screen, revealIndex, secretsData);
            }
          }

          return; // NES only supports one tile object per screen
        }
      }
    }
  }

  update(
    screen,
    link,
    bombs,
    fires,
    roomFlags,
    secretsData,
  ) {
    if (!this._tileObject || this._secretRevealed) return;

    switch (this._tileObject.type) {
      case TILE_OBJ_ROCK_WALL:
        this.updateRockWall(screen, bombs, roomFlags, secretsData);
        break;
      case TILE_OBJ_TREE:
        this.updateTree(screen, fires, roomFlags, secretsData);
        break;
      case TILE_OBJ_ROCK:
      case TILE_OBJ_GRAVESTONE:
        this.updateRockOrGravestone(screen, link, roomFlags, secretsData);
        break;
    }
  }

  render(ctx) {
    if (!this._tileObject) return;

    // Only render during push animation (sliding rock/gravestone)
    if (this._pushState === PushState.Moving) {
      const obj = this._tileObject;
      if (obj.type === TILE_OBJ_GRAVESTONE) {
        ctx.fillStyle = '#909090';
      } else {
        ctx.fillStyle = '#b88050';
      }
      ctx.fillRect(obj.x, obj.y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(obj.x, obj.y + TILE_SIZE - 2, TILE_SIZE, 2);
    }
  }

  // --- Rock wall (bombable) ---

   updateRockWall(
    screen,
    bombs,
    roomFlags,
    secretsData,
  ) {
    const obj = this._tileObject;
    const midX = obj.x + 8;
    const midY = obj.y + 8;

    for (const bomb of bombs) {
      if (!bomb.isDetonating) continue;
      const bx = bomb.x + 8;
      const by = bomb.y + 8;
      if (Math.abs(bx - midX) < COLLISION_THRESHOLD &&
          Math.abs(by - midY) < COLLISION_THRESHOLD) {
        this.revealSecret(screen, SQUARE_INDEX_CAVE_ENTRANCE, roomFlags, secretsData);
        return;
      }
    }
  }

  // --- Tree (burnable) ---

   updateTree(
    screen,
    fires,
    roomFlags,
    secretsData,
  ) {
    const obj = this._tileObject;
    const midX = obj.x + 8;
    const midY = obj.y + 8;

    for (const fire of fires) {
      if (!fire.isStanding) continue;
      const fx = fire.x + 8;
      const fy = fire.y + 8;
      if (Math.abs(fx - midX) < COLLISION_THRESHOLD &&
          Math.abs(fy - midY) < COLLISION_THRESHOLD) {
        this.revealSecret(screen, SQUARE_INDEX_STAIRS, roomFlags, secretsData);
        return;
      }
    }
  }

  // --- Rock / Gravestone (pushable) ---

   updateRockOrGravestone(
    screen,
    link,
    roomFlags,
    secretsData,
  ) {
    switch (this._pushState) {
      case PushState.Idle:
        this.updatePushIdle(link);
        break;
      case PushState.Moving:
        this.updatePushMoving(screen, roomFlags, secretsData);
        break;
    }
  }

   updatePushIdle(link) {
    const obj = this._tileObject;

    // Rock requires Power Bracelet; gravestone doesn't
    if (obj.type === TILE_OBJ_ROCK && !link.hasBracelet) {
      this._pushTimer = 0;
      return;
    }

    // Vertical push only — X positions must match exactly (Z_04.asm:3590)
    if (link.posX !== obj.x) {
      this._pushTimer = 0;
      return;
    }

    // Determine push direction from relative Y position
    // Link Y + 3 offset per Z_04.asm:3598
    const linkAdjY = link.posY + 3;
    const dy = linkAdjY - obj.y;
    let pushDirBit;
    let pushDir;

    if (dy > 0 && dy < 0x11) {
      // Link is below the object → push block Up (Z_04.asm: Y=0, RockPushDirections[0]=$08=Up)
      pushDirBit = ROCK_PUSH_DIR_UP;
      pushDir = Direction.Up;
    } else if (dy < 0 && -dy < 0x11) {
      // Link is above the object → push block Down (Z_04.asm: Y=1, RockPushDirections[1]=$04=Down)
      pushDirBit = ROCK_PUSH_DIR_DOWN;
      pushDir = Direction.Down;
    } else {
      this._pushTimer = 0;
      return;
    }

    // Input direction must have vertical component matching push direction
    // RockPushDirections: index 0 = Up ($08), index 1 = Down ($04)
    const vertInputBit = link.facing === Direction.Up ? ROCK_PUSH_DIR_UP :
                         link.facing === Direction.Down ? ROCK_PUSH_DIR_DOWN : 0;

    if (vertInputBit !== pushDirBit || !link.isMoving) {
      this._pushTimer = 0;
      return;
    }

    this._pushTimer++;
    if (this._pushTimer >= PUSH_TIMER_THRESHOLD) {
      this._pushDirection = pushDir;
      this._pushState = PushState.Moving;
      this._pushOffset = 0;

      // Replace the original position with a floor tile
      const gridIdx = obj.row * 16 + obj.col;
      // Square index 0 = ground ($24) — use the base walkable tile
      this._tileOverrides.set(gridIdx, 0);
    }
  }

   updatePushMoving(
    screen,
    roomFlags,
    secretsData,
  ) {
    const obj = this._tileObject;

    // 1px/frame slide
    if (this._pushDirection === Direction.Up) {
      obj.y--;
    } else {
      obj.y++;
    }

    this._pushOffset++;
    if (this._pushOffset >= PUSH_DISTANCE) {
      this._pushState = PushState.Done;

      // Place rock/gravestone tile at the new position
      const newRow = Math.floor(obj.y / TILE_SIZE);
      const newCol = obj.col;
      if (newRow >= 0 && newRow < 11 && newCol >= 0 && newCol < 16) {
        const destGridIdx = newRow * 16 + newCol;
        // Use the original square index for the destination tile
        const origSquareIdx = screen.tiles[obj.row]?.[obj.col];
        if (origSquareIdx !== undefined) {
          this._tileOverrides.set(destGridIdx, origSquareIdx);
        }
      }

      // Reveal stairs at the secret position
      this.revealSecret(screen, SQUARE_INDEX_STAIRS, roomFlags, secretsData);
    }
  }

  // Z_07.asm:5925 RevealPondStairs — flute reveals stairs without a tile object
  revealFluteSecret(
    screen,
    roomFlags,
    secretsData,
  ) {
    this._secretRevealed = true;
    roomFlags.setSecretFound(screen.id);

    const posIndex = secretsData.shortcutPositionIndexByScreen[screen.id] ?? 0;
    const pos = secretsData.shortcutPositions[posIndex];
    if (pos) {
      const stairsCol = Math.floor(pos.x / TILE_SIZE);
      const stairsRow = Math.floor(pos.y / TILE_SIZE);
      const gridIdx = stairsRow * 16 + stairsCol;
      this._tileOverrides.set(gridIdx, SQUARE_INDEX_STAIRS);
      this._pendingReveal = {
        screenId: screen.id,
        tileCol: stairsCol,
        tileRow: stairsRow,
        revealedSquareIndex: SQUARE_INDEX_STAIRS,
        stairsX: pos.x,
        stairsY: pos.y
      };
    }
  }

  // --- Shared reveal logic ---

   revealSecret(
    screen,
    revealSquareIndex,
    roomFlags,
    secretsData,
  ) {
    this._secretRevealed = true;
    roomFlags.setSecretFound(screen.id);
    this.applyTileReveal(screen, revealSquareIndex, secretsData);
  }

   applyTileReveal(
    screen,
    revealSquareIndex,
    secretsData,
  ) {
    const obj = this._tileObject;

    if (revealSquareIndex === SQUARE_INDEX_CAVE_ENTRANCE) {
      // Bombable wall → reveal cave entrance at the tile object's position
      const gridIdx = obj.row * 16 + obj.col;
      this._tileOverrides.set(gridIdx, revealSquareIndex);
      this._pendingReveal = {
        screenId: screen.id,
        tileCol: obj.col,
        tileRow: obj.row,
        revealedSquareIndex: revealSquareIndex
      };
    } else {
      // Tree/rock/gravestone → reveal stairs at the secret position
      const posIndex = secretsData.shortcutPositionIndexByScreen[screen.id] ?? 0;
      const pos = secretsData.shortcutPositions[posIndex];
      if (pos) {
        const stairsCol = Math.floor(pos.x / TILE_SIZE);
        const stairsRow = Math.floor(pos.y / TILE_SIZE);
        const gridIdx = stairsRow * 16 + stairsCol;
        this._tileOverrides.set(gridIdx, revealSquareIndex);
        this._pendingReveal = {
          screenId: screen.id,
          tileCol: stairsCol,
          tileRow: stairsRow,
          revealedSquareIndex: revealSquareIndex,
          stairsX: pos.x,
          stairsY: pos.y
        };
      }
    }
  }

   getRevealSquareIndex(tileObjType) {
    switch (tileObjType) {
      case TILE_OBJ_ROCK_WALL: return SQUARE_INDEX_CAVE_ENTRANCE;
      case TILE_OBJ_TREE:
      case TILE_OBJ_ROCK:
      case TILE_OBJ_GRAVESTONE:
        return SQUARE_INDEX_STAIRS;
      default: return null;
    }
  }
}
