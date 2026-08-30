import { describe, it, expect } from 'vitest';
import { DungeonCollisionMap } from '../../src/world/dungeon-collision.js';
import { RoomFlags } from '../../src/world/room-flags.js';
import type { CellarConnection, UniqueRoom } from '../../src/data/dungeon-types.js';
import type { OverworldScreen } from '../../src/data/overworld-types.js';

const squareTable = [176, 116, 148, 180, 112, 104, 244, 36];

const dummyScreen = {
  id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles: [],
} as unknown as OverworldScreen;

function makeTunnelCellarRoom(): UniqueRoom {
  // Layout 0 (tunnel): stairs at cols 3 and 12, floor in passage, walls on edges
  const tiles: number[][] = [];
  for (let r = 0; r < 7; r++) {
    const row: number[] = [];
    for (let c = 0; c < 16; c++) {
      if ((r === 3 && c === 3) || (r === 3 && c === 12)) {
        row.push(0); // stairs
      } else if (c >= 4 && c <= 11) {
        row.push(1); // floor (walkable)
      } else {
        row.push(3); // wall
      }
    }
    tiles.push(row);
  }
  return { id: 62, tiles };
}

describe('DungeonCollisionMap.forCellar', () => {
  it('stairs tile (index 0) is forced walkable despite high squareTable value', () => {
    const cellar = makeTunnelCellarRoom();
    const col = DungeonCollisionMap.forCellar(cellar, squareTable);

    // Stairs at inner (3,3) → grid (5,3) → pixel (48+8, 80+8) = (56, 88)
    expect(col.isPositionWalkable(dummyScreen, 56, 88)).toBe(true);
    // Stairs at inner (3,12) → grid (5,12) → pixel (192+8, 80+8) = (200, 88)
    expect(col.isPositionWalkable(dummyScreen, 200, 88)).toBe(true);
  });

  it('floor tiles are walkable in cellar', () => {
    const cellar = makeTunnelCellarRoom();
    const col = DungeonCollisionMap.forCellar(cellar, squareTable);

    // Floor at inner (3,6) → grid (5,6) → pixel (96+8, 80+8) = (104, 88)
    expect(col.isPositionWalkable(dummyScreen, 104, 88)).toBe(true);
  });

  it('wall tiles are not walkable in cellar', () => {
    const cellar = makeTunnelCellarRoom();
    const col = DungeonCollisionMap.forCellar(cellar, squareTable);

    // Wall at inner (0,0) → grid (2,0) → pixel (8, 32+8) = (8, 40)
    expect(col.isPositionWalkable(dummyScreen, 8, 40)).toBe(false);
  });

  it('border rows are not walkable', () => {
    const cellar = makeTunnelCellarRoom();
    const col = DungeonCollisionMap.forCellar(cellar, squareTable);

    // Row 0,1 are border (above cellar tiles)
    expect(col.isPositionWalkable(dummyScreen, 128, 8)).toBe(false);
  });
});

describe('Cellar connection data', () => {
  const tunnelConn: CellarConnection = {
    cellarRoomId: 7,
    leftDest: 100,
    rightDest: 6,
    exitPos: 105,
    layoutIndex: 0,
  };

  const treasureConn: CellarConnection = {
    cellarRoomId: 4,
    leftDest: 5,
    rightDest: 5,
    exitPos: 152,
    layoutIndex: 1,
  };

  it('tunnel cellar connects two different rooms', () => {
    expect(tunnelConn.leftDest).not.toBe(tunnelConn.rightDest);
  });

  it('treasure cellar connects same room on both sides', () => {
    expect(treasureConn.leftDest).toBe(treasureConn.rightDest);
  });

  it('exit position unpacks correctly — tunnel', () => {
    const x = tunnelConn.exitPos & 0xF0; // 105 & 0xF0 = 96
    const y = (tunnelConn.exitPos & 0x0F) << 4; // (105 & 0x0F) << 4 = 9 << 4 = 144
    expect(x).toBe(96);
    expect(y).toBe(144);
  });

  it('exit position unpacks correctly — treasure', () => {
    const x = treasureConn.exitPos & 0xF0; // 152 & 0xF0 = 144
    const y = (treasureConn.exitPos & 0x0F) << 4; // (152 & 0x0F) << 4 = 8 << 4 = 128
    expect(x).toBe(144);
    expect(y).toBe(128);
  });
});

describe('RoomFlags — room-cleared bit', () => {
  it('room is not cleared by default', () => {
    const flags = new RoomFlags();
    expect(flags.isRoomCleared(42)).toBe(false);
  });

  it('sets and reads the room-cleared bit', () => {
    const flags = new RoomFlags();
    flags.setRoomCleared(42);
    expect(flags.isRoomCleared(42)).toBe(true);
    expect(flags.getFlags(42) & 0x40).toBe(0x40);
  });

  it('room-cleared does not affect other bits', () => {
    const flags = new RoomFlags();
    flags.setSecretFound(10);
    flags.setVisited(10);
    flags.setRoomCleared(10);
    expect(flags.isSecretFound(10)).toBe(true);
    expect(flags.isVisited(10)).toBe(true);
    expect(flags.isRoomCleared(10)).toBe(true);
    expect(flags.getFlags(10)).toBe(0x80 | 0x40 | 0x20);
  });

  it('room-cleared does not affect other rooms', () => {
    const flags = new RoomFlags();
    flags.setRoomCleared(50);
    expect(flags.isRoomCleared(49)).toBe(false);
    expect(flags.isRoomCleared(51)).toBe(false);
  });
});
