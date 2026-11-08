// A5e checkpoint-06b (note 81): the OAM sub-animation player, live since checkpoint-07.
// pret b452f2ab engine/battle/animations.asm: DrawFrameBlock 3-188, PlayAnimation 191-293, LoadSubanimation
// 295-372, LoadMoveAnimationTiles 375-392, PlaySubanimation 619-683, AnimationCleanOAM 685-695,
// DoSpecialEffectByAnimationId 700-718, DoBallTossSpecialEffects 724-777, DoBallShakeSpecialEffects 779-811,
// DoPoofSpecialEffects 813-818. Only battle_animations.json's IDs play (DECISIONS #94, #99); anything else throws
// BattleUnsupportedState. A5f checkpoint-02 (note 87): the ball effects, unused until checkpoint-03 binds `ball`.
import type { BattleState } from './battle_state';
import type { BattleScreen } from './battle_screen';
import type { BattleAudio, BattleSfx } from './battle_audio';
import type { BattleRenderTiles, RawImage } from './battle_screen_render';
import type {
  BattleAnimationData, FrameBlock, Subanimation,
} from '../rom/extractors/battle_animations';
import { delayFrames, type Program } from './battle_menu_context';
import { BattleUnsupportedState } from './battle_move_data';
import { MOVE_ANIM } from './battle_move_anim';
import { I } from './battle_item_state';

/** pret ram/wram.asm; pokeyellow.sym 573535d. Several alias live variables (note 81 §5.2). */
export const SUBANIM = {
  wTempTilesetNumTiles: 0xd07c, // = wPartyMenuTypeOrMessageID
  wBaseCoordX: 0xd080, wBaseCoordY: 0xd081, wFBTileCounter: 0xd083, wSubAnimFrameDelay: 0xd085,
  wSubAnimCounter: 0xd086, wNumFBTiles: 0xd088,
  wSubAnimTransform: 0xd08a, // = wSlideMonDelay
  wSubAnimAddrPtr: 0xd093, wSubAnimSubEntryAddr: 0xd095,
  wFBDestAddr: 0xd09b, // high byte first
  wFBMode: 0xd09d,
  wWhichBattleAnimTileset: 0xd09e, // = wSlideMonUpBottomRowLeftTile and others
  wBattleObjPalID: 0xdef4,
  hROMBankTemp: 0xff8b, // = hBaseTileID
} as const;

/** constants/move_animation_constants.asm and move_constants.asm. */
export const SUBANIMTYPE = { NORMAL: 0, HVFLIP: 1, HFLIP: 2, COORDFLIP: 3, REVERSE: 4, ENEMY: 5 } as const;
const TOSS_ANIM = 0xc1, SHAKE_ANIM = 0xc2, POOF_ANIM = 0xc3, GREATTOSS_ANIM = 0xc5, ULTRATOSS_ANIM = 0xc6;
const GROWL = 0x2d;
const GREAT_BALL = 3; // constants/item_constants.asm: MASTER_BALL 1, ULTRA_BALL 2, GREAT_BALL 3, POKE_BALL 4
const TRAINER_BATTLE = 2;
/** wPokeBallAnimData's "can't be caught" value: a ghost (item_effects.asm:146-149,174-180). */
const GHOST_ANIM_DATA = 0x10;
/** data/battle_anims/special_effects.asm: AnimationIdSpecialEffects' IDs, in table order (IsInArray's array).
 *  An ID outside it has no special effect (BLOCKBALL_ANIM). */
export const SPECIAL_EFFECT_IDS: readonly number[] = [
  0x05, 0x0c, 0x19, 0x1d, 0x27, 0x2d, 0x32, 0x3b, 0x3d, 0x3f, 0x55, 0x73, 0x78, 0x93, 0x99, 0x9d, 0xaa, 0xab, 0xac,
  TOSS_ANIM, SHAKE_ANIM, POOF_ANIM, GREATTOSS_ANIM, ULTRATOSS_ANIM,
];
const SHADOW_OAM = 0xc300;
const BASE_TILE = 0x31;
const OAM_XFLIP = 0x20;
const OAM_YFLIP = 0x40;

export interface SubanimationHost {
  screen: BattleScreen;
  audio: Pick<BattleAudio, 'play'>;
  /** The session's shared $8000 atlas, replaced (never mutated) as VBlank copies land. */
  renderTiles: Pick<BattleRenderTiles, 'sprites'>;
  /** Decoded gfx/battle/move_anim_0.png (MoveAnimationTiles0). */
  moveAnimationTiles: RawImage;
  ballPoof: BattleSfx;
  animations: BattleAnimationData;
  /** A5f: the toss's and the shake's Audio 2 sounds (SFX_BALL_TOSS $91, SFX_TINK $8C). Their effects throw without them. */
  ball?: { toss: BattleSfx; tink: BattleSfx };
}

const word = (state: BattleState, at: number): number => state.mem[at] | state.mem[at + 1] << 8;
function setWord(state: BattleState, at: number, value: number): void {
  state.mem[at] = value & 0xff; state.mem[at + 1] = value >> 8 & 0xff;
}

/** PlayAnimation (animations.asm:191-293): sub-animation commands only. */
export function* playAnimation(state: BattleState, host: SubanimationHost): Program {
  state.mem[SUBANIM.hROMBankTemp] = 0;
  state.mem[SUBANIM.wSubAnimTransform] = 0;
  const id = state.wAnimationID;
  const animation = host.animations.animations.find(entry => entry.id === id);
  if (!animation) throw new BattleUnsupportedState(`animation $${id.toString(16)} has no traced data (#94)`);
  for (const command of animation.commands) {
    state.mem[SUBANIM.wSubAnimFrameDelay] = command.delay;
    state.mem[SUBANIM.wWhichBattleAnimTileset] = command.tileset;
    state.mem[MOVE_ANIM.wAnimSoundID] = 0xff; // NO_MOVE - 1: the only sound byte the data allows.
    const sub = host.animations.subanimations.find(entry => entry.id === command.subanimation);
    if (!sub) throw new BattleUnsupportedState(`subanimation ${command.subanimation} has no data`);
    setWord(state, SUBANIM.wSubAnimAddrPtr, sub.pointer);
    const saved = host.screen.obp0;
    host.screen.obp0 = state.mem[MOVE_ANIM.wAnimPalette]; // UpdateCGBPal_OBP0 takes no frames.
    yield* loadMoveAnimationTiles(state, host);
    loadSubanimation(state, sub);
    yield* playSubanimation(state, host, sub);
    host.screen.obp0 = saved;
  }
}

/** LoadMoveAnimationTiles (375-392): CopyVideoData to vSprites tile $31; the tiles stay afterwards. */
export function* loadMoveAnimationTiles(state: BattleState, host: SubanimationHost): Program {
  const which = state.mem[SUBANIM.wWhichBattleAnimTileset];
  const tileset = host.animations.tilesets.find(entry => entry.id === which);
  if (!tileset) throw new BattleUnsupportedState(`move animation tileset ${which} has no data`);
  state.mem[SUBANIM.wTempTilesetNumTiles] = tileset.tiles;
  const atlas = host.renderTiles.sprites, source = host.moveAnimationTiles;
  const across = atlas.width >>> 3, sourceAcross = source.width >>> 3;
  if (atlas.width * atlas.height < (BASE_TILE + tileset.tiles) * 64 || source.width * source.height < tileset.tiles * 64)
    throw new BattleUnsupportedState('move animation sprite atlas');
  let data: ArrayLike<number> = atlas.data;
  for (const _ of host.screen.copyVideoData(tileset.tiles, index => {
    const tile = BASE_TILE + index;
    const copy = new Uint8ClampedArray(data); // copy-on-write: an atlas, once published, never changes
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) for (let c = 0; c < 4; c++) {
      const from = ((Math.floor(index / sourceAcross) * 8 + y) * source.width + (index % sourceAcross) * 8 + x) * 4 + c;
      const to = ((Math.floor(tile / across) * 8 + y) * atlas.width + (tile % across) * 8 + x) * 4 + c;
      copy[to] = source.data[from];
    }
    // Publish each tile as VBlank lands it (8 per frame): the renderer caches decoded tiles by image identity.
    data = copy;
    host.renderTiles.sprites = { width: atlas.width, height: atlas.height, data: copy };
  })) { void _; yield 'serviced'; }
}

/** LoadSubanimation (295-372), including GetSubanimationTransform1/2 and the reverse start. */
export function loadSubanimation(state: BattleState, sub: Subanimation): void {
  if (word(state, SUBANIM.wSubAnimAddrPtr) !== sub.pointer) throw new BattleUnsupportedState('wSubAnimAddrPtr mismatch');
  const count = sub.entries.length;
  state.mem[SUBANIM.wSubAnimCounter] = count;
  const enemyTurn = state.hWhoseTurn !== 0;
  const transform = sub.type === SUBANIMTYPE.ENEMY
    ? (enemyTurn ? SUBANIMTYPE.NORMAL : SUBANIMTYPE.HFLIP)
    : (enemyTurn ? sub.type : SUBANIMTYPE.NORMAL);
  state.mem[SUBANIM.wSubAnimTransform] = transform;
  let offset = 0;
  if (transform === SUBANIMTYPE.REVERSE) {
    // `dec a` then a do-while: one entry runs the loop 256 times.
    let a = (count - 1) & 0xff;
    do { offset += 3; a = (a - 1) & 0xff; } while (a !== 0);
  }
  setWord(state, SUBANIM.wSubAnimSubEntryAddr, (sub.address + 1 + offset) & 0xffff);
}

/** PlaySubanimation (619-683). */
export function* playSubanimation(state: BattleState, host: SubanimationHost, sub: Subanimation): Program {
  if (state.mem[MOVE_ANIM.wAnimSoundID] !== 0xff) throw new BattleUnsupportedState('move sounds are #94');
  state.mem[SUBANIM.wFBDestAddr] = SHADOW_OAM >> 8; state.mem[SUBANIM.wFBDestAddr + 1] = SHADOW_OAM & 0xff;
  for (;;) {
    const at = word(state, SUBANIM.wSubAnimSubEntryAddr) - (sub.address + 1);
    if (at % 3 !== 0 || at < 0 || at / 3 >= sub.entries.length) throw new BattleUnsupportedState('subentry outside its data');
    const entry = sub.entries[at / 3];
    const block = host.animations.frameBlocks.find(fb => fb.id === entry.frameBlock);
    const base = host.animations.baseCoords.find(bc => bc.id === entry.baseCoord);
    if (!block || !base) throw new BattleUnsupportedState('frame block or base coordinate has no data');
    state.mem[SUBANIM.wBaseCoordY] = base.y;
    state.mem[SUBANIM.wBaseCoordX] = base.x;
    state.mem[SUBANIM.wFBMode] = entry.mode;
    yield* drawFrameBlock(state, host.screen, block);
    yield* doSpecialEffectByAnimationId(state, host);
    const counter = (state.mem[SUBANIM.wSubAnimCounter] - 1) & 0xff;
    state.mem[SUBANIM.wSubAnimCounter] = counter;
    if (counter === 0) return;
    const step = state.mem[SUBANIM.wSubAnimTransform] === SUBANIMTYPE.REVERSE ? -3 : 3;
    setWord(state, SUBANIM.wSubAnimSubEntryAddr, (word(state, SUBANIM.wSubAnimSubEntryAddr) + step) & 0xffff);
  }
}

/** pret home/clear_sprites.asm:1-9. */
function clearSprites(screen: BattleScreen): void {
  for (let slot = 0; slot < 40; slot++) screen.setOam(slot, { y: 0, x: 0, tile: 0, attributes: 0 });
}

/** DrawFrameBlock (3-188): all four transforms and modes 00-04. */
export function* drawFrameBlock(state: BattleState, screen: BattleScreen, block: FrameBlock): Program {
  const m = state.mem;
  m[SUBANIM.wNumFBTiles] = block.tiles.length;
  let dest = m[SUBANIM.wFBDestAddr] << 8 | m[SUBANIM.wFBDestAddr + 1];
  m[SUBANIM.wFBTileCounter] = 0;
  const baseY = m[SUBANIM.wBaseCoordY], baseX = m[SUBANIM.wBaseCoordX];
  for (const tile of block.tiles) {
    m[SUBANIM.wFBTileCounter] = (m[SUBANIM.wFBTileCounter] + 1) & 0xff;
    m[SUBANIM.wBattleObjPalID] = 2;
    const transform = m[SUBANIM.wSubAnimTransform];
    let y: number, x: number, flags: number;
    if (transform === SUBANIMTYPE.HVFLIP) {
      y = (136 - ((baseY + tile.y) & 0xff)) & 0xff;
      x = (168 - ((baseX + tile.x) & 0xff)) & 0xff;
      flags = tile.flags === 0 ? OAM_YFLIP | OAM_XFLIP : tile.flags === OAM_XFLIP ? OAM_YFLIP
        : tile.flags === OAM_YFLIP ? OAM_XFLIP : 0;
    } else if (transform === SUBANIMTYPE.HFLIP) {
      y = (baseY + tile.y + 40) & 0xff;
      x = (168 - ((baseX + tile.x) & 0xff)) & 0xff;
      flags = tile.flags ^ OAM_XFLIP;
    } else if (transform === SUBANIMTYPE.COORDFLIP) {
      y = (((136 - baseY) & 0xff) + tile.y) & 0xff;
      x = (((168 - baseX) & 0xff) + tile.x) & 0xff;
      flags = tile.flags;
    } else {
      y = (baseY + tile.y) & 0xff;
      x = (baseX + tile.x) & 0xff;
      flags = tile.flags;
    }
    if (x >= 88) m[SUBANIM.wBattleObjPalID] = (m[SUBANIM.wBattleObjPalID] + 1) & 0xff;
    const index = (dest - SHADOW_OAM) / 4;
    if (!Number.isInteger(index) || index < 0 || index >= 40) throw new BattleUnsupportedState('frame block past shadow OAM');
    screen.setOam(index, { y, x, tile: (tile.tile + BASE_TILE) & 0xff, attributes: m[SUBANIM.wBattleObjPalID] | flags });
    dest += 4;
  }
  const mode = m[SUBANIM.wFBMode];
  const advance = () => { m[SUBANIM.wFBDestAddr + 1] = dest & 0xff; m[SUBANIM.wFBDestAddr] = dest >> 8; };
  if (mode === 2) { advance(); return; }
  yield* delayFrames(m[SUBANIM.wSubAnimFrameDelay]);
  if (mode === 3) { advance(); return; }
  if (mode === 4) return;
  if (state.wAnimationID !== GROWL) { yield* delayFrames(1); clearSprites(screen); } // AnimationCleanOAM
  m[SUBANIM.wFBDestAddr] = SHADOW_OAM >> 8; m[SUBANIM.wFBDestAddr + 1] = SHADOW_OAM & 0xff;
}

/** DoSpecialEffectByAnimationId (700-718): IsInArray over the table, then the ID's routine. An ID the table lacks has
 *  none; a listed ID whose routine isn't ported (the attack and trade animations) throws (#94). */
function* doSpecialEffectByAnimationId(state: BattleState, host: SubanimationHost): Program {
  const id = state.wAnimationID;
  if (!SPECIAL_EFFECT_IDS.includes(id)) return;
  if (id === POOF_ANIM) { doPoofSpecialEffects(state, host); return; }
  if (id === TOSS_ANIM || id === GREATTOSS_ANIM || id === ULTRATOSS_ANIM) { doBallTossSpecialEffects(state, host); return; }
  if (id === SHAKE_ANIM) { yield* doBallShakeSpecialEffects(state, host); return; }
  throw new BattleUnsupportedState(`special effects for $${id.toString(16)} are #94`);
}

/** DoPoofSpecialEffects (813-818): the sound after the poof's second frame block. */
function doPoofSpecialEffects(state: BattleState, host: SubanimationHost): void {
  if (state.mem[SUBANIM.wSubAnimCounter] === 5) host.audio.play(host.ballPoof);
}

function ballSounds(host: SubanimationHost): { toss: BattleSfx; tink: BattleSfx } {
  if (!host.ball) throw new BattleUnsupportedState('the ball sub-animation sounds are not bound');
  return host.ball;
}

/** DoBallTossSpecialEffects (724-777): the Master/Ultra Ball flash, the toss sound, the trainer battle's shorter toss. */
function doBallTossSpecialEffects(state: BattleState, host: SubanimationHost): void {
  const m = state.mem, sounds = ballSounds(host);
  // cp ULTRA_BALL + 1: a Master or Ultra Ball complements OBP0 colours 1 and 2. UpdateCGBPal_OBP0 takes no frames.
  if (m[I.wCurItem] < GREAT_BALL) host.screen.obp0 ^= 0x3c;
  if (m[SUBANIM.wSubAnimCounter] === 11) host.audio.play(sounds.toss);
  if (state.wIsInBattle === TRAINER_BATTLE) {
    if (m[SUBANIM.wSubAnimCounter] === 3) m[SUBANIM.wSubAnimCounter] = 2; // one frame block shorter
    return;
  }
  if (m[I.wPokeBallAnimData] !== GHOST_ANIM_DATA) return;
  const counter = m[SUBANIM.wSubAnimCounter];
  if (counter === 3 || counter === 2 || counter === 1)
    throw new BattleUnsupportedState('the ghost dodge (AnimCopyRowRight, rAUD1SWEEP) waits for the Pokémon Tower phase (#101)');
}

/** DoBallShakeSpecialEffects (779-811): the tink and 40 frames at each shake's start; restart while shakes remain. */
function* doBallShakeSpecialEffects(state: BattleState, host: SubanimationHost): Program {
  const m = state.mem, sounds = ballSounds(host);
  if (m[SUBANIM.wSubAnimCounter] === 4) {
    host.audio.play(sounds.tink);
    yield* delayFrames(40);
  }
  if (((m[SUBANIM.wSubAnimCounter] - 1) & 0xff) !== 0) return;
  m[I.wNumShakes] = (m[I.wNumShakes] - 1) & 0xff;
  if (m[I.wNumShakes] === 0) return;
  // 4 subentries of 3 bytes back, and 5: the subentry count plus one, decremented by PlaySubanimation.
  setWord(state, SUBANIM.wSubAnimSubEntryAddr, (word(state, SUBANIM.wSubAnimSubEntryAddr) - 4 * 3) & 0xffff);
  m[SUBANIM.wSubAnimCounter] = 5;
}
