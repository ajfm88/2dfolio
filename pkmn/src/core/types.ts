// Shared type definitions for the entire game

export interface MapConnection {
  direction: 'north' | 'south' | 'east' | 'west';
  mapName: string;
  offset: number;
}

export interface WarpData {
  x: number;
  y: number;
  destMap: string;
  destWarpId: number;
}

export interface SignData {
  x: number;
  y: number;
  text: string;
}

export interface NpcData {
  id: string;
  sprite: string;      // filename without extension, e.g. "oak" → /gfx/sprites/oak.png
  x: number;           // tile x (in 2-tile units, same as map object coords)
  y: number;           // tile y
  movement: 'stay' | 'walk';
  walkDir?: 'any' | 'up_down' | 'left_right';  // constraint for walk movement (default: 'any')
  direction?: Direction;
  dialogue: string;    // auto-wrapped to text box width
  // Trainer NPC fields (optional)
  trainerClass?: string;    // e.g. "BROCK", "YOUNGSTER"
  trainerParty?: number;    // party index (0-based) within the trainer class
  trainerName?: string;     // display name override
  sightRange?: number;      // how many steps (16px) the trainer can see (default 0 = talk only)
  defeated?: boolean;        // set to true after losing to player
  shopItems?: string[];      // mart inventory (item IDs)
  object?: boolean;           // inanimate object (item on table, etc.) — doesn't face player
}

export interface HiddenEvent {
  x: number;           // step coords (same as signs)
  y: number;
  text?: string;       // text to display (omit for item events)
  item?: string;       // hidden item ID (e.g., "POTION") — gives item on interaction
  flag?: string;       // event flag to track collection (item is gone once set)
  facing?: Direction;  // required player facing direction (omit = any)
  scriptId?: string;   // triggers a named script instead of simple text (e.g., "VIRIDIAN_SCHOOL_NOTEBOOK")
}

export interface MapData {
  name: string;
  width: number;
  height: number;
  tileset: string;
  connections: MapConnection[];
  blocks: number[];
  borderBlock: number;
  warps: WarpData[];
  signs: SignData[];
  npcs: NpcData[];
  hiddenEvents?: HiddenEvent[];
}

/** A blockset: array of blocks, each block is 16 tile IDs (4x4 grid) */
export type Blockset = number[][];

/** Collision data: tileset name -> array of walkable tile IDs */
export type CollisionData = Record<string, number[]>;

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameButton = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';
