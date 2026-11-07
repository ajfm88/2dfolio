// A5e checkpoint-05 (note 80): the battle-animation data for the traced presentation IDs only.
// PlayAnimation / LoadSubanimation / PlaySubanimation / DrawFrameBlock / LoadMoveAnimationTiles
// (engine/battle/animations.asm) read these tables. Attack move animations are a later slice (DECISIONS #94):
// an ID outside PRESENTATION_ANIMATIONS is never read, and a command or field the traced IDs don't use throws.
import { BinaryReader } from '../binary_reader';
import {
  ATTACK_ANIMATION_POINTERS, SUBANIMATION_POINTERS, FRAME_BLOCK_POINTERS, FRAME_BLOCK_BASE_COORDS,
  MOVE_ANIMATION_TILES_POINTERS, MOVE_ANIM_TILES_0, ANIMATION_MINIMIZE_MON, MINIMIZED_MON_SPRITE, symToOffset,
} from '../rom_offsets';

/** constants/move_constants.asm: the animation IDs this extractor reads. */
export const PRESENTATION_ANIMATIONS: Record<string, number> = { POOF_ANIM: 0xc3 };

const FIRST_SE_ID = 0xc0;       // constants/move_animation_constants.asm
const NO_SOUND = 0xff;          // battle_anim's `NO_MOVE - 1`
const MAX_SUBANIMTYPE = 5;      // SUBANIMTYPE_NORMAL … SUBANIMTYPE_ENEMY
const MAX_FRAMEBLOCKMODE = 4;   // FRAMEBLOCKMODE_00 … FRAMEBLOCKMODE_04
const MAX_COMMANDS = 16;
const MAX_FRAMEBLOCK_TILES = 40; // the OAM's 40 entries
const ANIM_BANK = 0x1e;

export interface BattleAnimationCommand {
  /** wWhichBattleAnimTileset: the command byte's top two bits. */
  tileset: number;
  /** wSubAnimFrameDelay: the command byte's low six bits. */
  delay: number;
  /** wAnimSoundID: always NO_MOVE - 1 ($FF), no sound, for the traced IDs. */
  sound: null;
  /** The SubanimationPointers index. */
  subanimation: number;
}
export interface BattleAnimation { id: number; name: string; commands: BattleAnimationCommand[] }
export interface SubanimationEntry { frameBlock: number; baseCoord: number; mode: number }
/** The header byte is (type << 5) | count; `entries.length` is the count. `pointer` is the CPU address of its
 * SubanimationPointers entry (the value PlayAnimation stores in wSubAnimAddrPtr); `address` is the CPU address of
 * its header byte (LoadSubanimation stores address + 1 in wSubAnimSubEntryAddr). Both are in bank $1E. */
export interface Subanimation { id: number; pointer: number; address: number; type: number; entries: SubanimationEntry[] }
/** One OAM entry in the order DrawFrameBlock reads it: Y offset, X offset, tile (before + $31), flags. */
export interface FrameBlockTile { y: number; x: number; tile: number; flags: number }
export interface FrameBlock { id: number; tiles: FrameBlockTile[] }
export interface BaseCoord { id: number; y: number; x: number }
export interface MoveAnimationTileset { id: number; tiles: number }
export interface BattleAnimationData {
  animations: BattleAnimation[];
  subanimations: Subanimation[];
  frameBlocks: FrameBlock[];
  baseCoords: BaseCoord[];
  tilesets: MoveAnimationTileset[];
  /** A5e checkpoint-08a: MinimizedMonSprite's 1bpp rows (engine/battle/animations.asm:1832-1841), as
   *  AnimationMinimizeMon and HideSubstituteShowMonAnim copy them into wTempPic, each byte to both bitplanes. */
  minimizedMonSprite: number[];
}

/** The CPU address a pointer-table entry holds. */
function pointerValue(rom: BinaryReader, table: number, index: number, what: string): number {
  const at = table + index * 2;
  const addr = rom.readByte(at) | rom.readByte(at + 1) << 8;
  if (addr < 0x4000 || addr > 0x7fff) throw new Error(`${what} ${index}: pointer $${addr.toString(16)} is outside bank $1e`);
  return addr;
}
function pointer(rom: BinaryReader, table: number, index: number, what: string): number {
  return symToOffset(ANIM_BANK, pointerValue(rom, table, index, what));
}
/** A bank-$1E file offset as the CPU sees it in the switchable bank. */
const cpuAddress = (offset: number): number => 0x4000 | (offset & 0x3fff);

export function extractBattleAnimations(rom: BinaryReader): BattleAnimationData {
  const animations: BattleAnimation[] = [];
  const subanimations = new Map<number, Subanimation>();
  const frameBlocks = new Map<number, FrameBlock>();
  const baseCoords = new Map<number, BaseCoord>();
  const tilesets = new Map<number, MoveAnimationTileset>();

  for (const [name, id] of Object.entries(PRESENTATION_ANIMATIONS).sort((a, b) => a[1] - b[1])) {
    let p = pointer(rom, ATTACK_ANIMATION_POINTERS, id - 1, name);
    const commands: BattleAnimationCommand[] = [];
    for (;;) {
      const op = rom.readByte(p);
      if (op === 0xff) break;
      if (commands.length === MAX_COMMANDS) throw new Error(`${name}: missing terminator`);
      if (op >= FIRST_SE_ID) throw new Error(`${name}: special effect $${op.toString(16)} is not a traced presentation command`);
      const sound = rom.readByte(p + 1);
      if (sound !== NO_SOUND) throw new Error(`${name}: move sound $${sound.toString(16)} belongs to the attack-animation slice (#94)`);
      commands.push({ tileset: op >> 6, delay: op & 0x3f, sound: null, subanimation: rom.readByte(p + 2) });
      p += 3;
    }
    if (commands.length === 0) throw new Error(`${name}: no commands`);
    animations.push({ id, name, commands });
    for (const { tileset, subanimation } of commands) {
      if (!tilesets.has(tileset)) tilesets.set(tileset, readTileset(rom, tileset));
      if (!subanimations.has(subanimation)) subanimations.set(subanimation, readSubanimation(rom, subanimation));
    }
  }
  for (const sub of subanimations.values()) {
    for (const { frameBlock, baseCoord } of sub.entries) {
      if (!frameBlocks.has(frameBlock)) frameBlocks.set(frameBlock, readFrameBlock(rom, frameBlock));
      if (!baseCoords.has(baseCoord)) {
        const at = FRAME_BLOCK_BASE_COORDS + baseCoord * 2;
        baseCoords.set(baseCoord, { id: baseCoord, y: rom.readByte(at), x: rom.readByte(at + 1) });
      }
    }
  }
  const sorted = <T extends { id: number }>(m: Map<number, T>): T[] => [...m.values()].sort((a, b) => a.id - b.id);
  return {
    animations, subanimations: sorted(subanimations), frameBlocks: sorted(frameBlocks),
    baseCoords: sorted(baseCoords), tilesets: sorted(tilesets), minimizedMonSprite: readMinimizedMonSprite(rom),
  };
}

/** AnimationMinimizeMon (animations.asm:1808-1830) names the data and its length: at +16, `ld de, MinimizedMonSprite`
 *  then `ld c, MinimizedMonSpriteEnd - MinimizedMonSprite`. Both are read from that code, never assumed. */
const MINIMIZE_CODE_OFFSET = 16;
const MINIMIZED_MON_SPRITE_ROWS = 5; // the source's 8x5 partial tile
function readMinimizedMonSprite(rom: BinaryReader): number[] {
  const at = ANIMATION_MINIMIZE_MON + MINIMIZE_CODE_OFFSET;
  if (rom.readByte(at) !== 0x11 || rom.readByte(at + 3) !== 0x0e)
    throw new Error('AnimationMinimizeMon: ld de / ld c are not where they were traced');
  const pointer = rom.readByte(at + 1) | rom.readByte(at + 2) << 8;
  if (symToOffset(ANIM_BANK, pointer) !== MINIMIZED_MON_SPRITE)
    throw new Error(`AnimationMinimizeMon: sprite pointer $${pointer.toString(16)} is not MinimizedMonSprite`);
  const length = rom.readByte(at + 4);
  if (length !== MINIMIZED_MON_SPRITE_ROWS) throw new Error(`MinimizedMonSprite: ${length} rows, not ${MINIMIZED_MON_SPRITE_ROWS}`);
  return Array.from(rom.readBytes(MINIMIZED_MON_SPRITE, length));
}

function readSubanimation(rom: BinaryReader, id: number): Subanimation {
  const address = pointerValue(rom, SUBANIMATION_POINTERS, id, 'subanimation');
  const p = symToOffset(ANIM_BANK, address);
  const header = rom.readByte(p);
  const type = header >> 5, count = header & 0x1f;
  if (type > MAX_SUBANIMTYPE) throw new Error(`subanimation ${id}: invalid type ${type}`);
  if (count === 0) throw new Error(`subanimation ${id}: no frame blocks`);
  const entries: SubanimationEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = p + 1 + i * 3;
    const mode = rom.readByte(at + 2);
    if (mode > MAX_FRAMEBLOCKMODE) throw new Error(`subanimation ${id}: invalid frame block mode ${mode}`);
    entries.push({ frameBlock: rom.readByte(at), baseCoord: rom.readByte(at + 1), mode });
  }
  return { id, pointer: cpuAddress(SUBANIMATION_POINTERS) + id * 2, address, type, entries };
}

function readFrameBlock(rom: BinaryReader, id: number): FrameBlock {
  const p = pointer(rom, FRAME_BLOCK_POINTERS, id, 'frame block');
  const count = rom.readByte(p);
  if (count === 0 || count > MAX_FRAMEBLOCK_TILES) throw new Error(`frame block ${id}: invalid tile count ${count}`);
  const tiles: FrameBlockTile[] = [];
  for (let i = 0; i < count; i++) {
    const at = p + 1 + i * 4;
    tiles.push({ y: rom.readByte(at), x: rom.readByte(at + 1), tile: rom.readByte(at + 2), flags: rom.readByte(at + 3) });
  }
  return { id, tiles };
}

/** MoveAnimationTilesPointers rows are count, pointer, $ff. Only tileset 0 is traced; it must be the PNG's source. */
function readTileset(rom: BinaryReader, id: number): MoveAnimationTileset {
  if (id !== 0) throw new Error(`tileset ${id} is not traced (only MoveAnimationTiles0 has a committed PNG)`);
  const at = MOVE_ANIMATION_TILES_POINTERS + id * 4;
  const addr = rom.readByte(at + 1) | rom.readByte(at + 2) << 8;
  if (symToOffset(ANIM_BANK, addr) !== MOVE_ANIM_TILES_0) throw new Error(`tileset ${id}: pointer is not MoveAnimationTiles0`);
  if (rom.readByte(at + 3) !== 0xff) throw new Error(`tileset ${id}: missing padding`);
  return { id, tiles: rom.readByte(at) };
}
