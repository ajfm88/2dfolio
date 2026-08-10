export interface CoreAnimation {
  readonly objAnimations: readonly number[];
  readonly objAnimFrameHeap: readonly number[];
  readonly objAnimAttrHeap: readonly number[];
  readonly walkingAnimCounterReset: number;
}

export interface SpriteSystem {
  readonly spriteOffsets: readonly number[];
  readonly spriteRelativeExtents: readonly number[];
}

export interface LinkSprites {
  readonly headTiles: readonly number[];
  readonly headMagicShieldTiles: readonly number[];
}

export interface ItemSprites {
  readonly frameOffsets: readonly number[];
  readonly frameTiles: readonly number[];
  readonly slotToPaletteOffsetsOrValues: readonly number[];
}

export interface WeaponSprites {
  readonly rDirectionToWeaponFrame: readonly number[];
  readonly rDirectionToWeaponBaseAttribute: readonly number[];
  readonly rDirectionToOffsetsX: readonly number[];
  readonly rDirectionToOffsetsY: readonly number[];
  readonly playerToWeaponOffsetsX: readonly number[];
  readonly playerToWeaponOffsetsY: readonly number[];
  readonly swordShotSpreadBaseAttr: readonly number[];
}

export interface BoomerangAnimation {
  readonly frameCycle: readonly number[];
  readonly baseSpriteAttrCycle: readonly number[];
}

export interface BombCloudOffsets {
  readonly offsetsY1: readonly number[];
  readonly offsetsX1: readonly number[];
  readonly offsetsY2: readonly number[];
  readonly offsetsX2: readonly number[];
}

export interface AquamentusSprites {
  readonly tiles: readonly number[];
  readonly spriteOffsetsY: readonly number[];
  readonly spriteOffsetsX: readonly number[];
}

export interface DodongoSprites {
  readonly frameImages: readonly number[];
  readonly frameHFlips: readonly number[];
  readonly frameImagesBloated: readonly number[];
  readonly frameHFlipsBloated: readonly number[];
}

export interface DigdoggerSprites {
  readonly spriteOffsetsX: readonly number[];
  readonly spriteOffsetsY: readonly number[];
  readonly spriteAttrs: readonly number[];
}

export interface GleeokSprites {
  readonly bodyTiles0: readonly number[];
  readonly bodyTiles1: readonly number[];
  readonly bodyTiles2: readonly number[];
  readonly bodyBaseTileOffsets: readonly number[];
}

export interface GanonSprites {
  readonly frameImages: readonly number[];
  readonly spriteOffsetsX: readonly number[];
  readonly spriteOffsetsY: readonly number[];
  readonly spriteHFlips: readonly number[];
  readonly burstDirs: readonly number[];
  readonly burstTiles: readonly number[];
  readonly burstSpriteAttrs: readonly number[];
}

export interface PatraData {
  readonly childStartAngles: readonly number[];
  readonly sines: readonly number[];
}

export interface ManhandlaSprites {
  readonly baseFrameImagesAndAttrs: readonly number[];
  readonly segmentOffsetsX: readonly number[];
  readonly segmentOffsetsY: readonly number[];
}

export interface WallmasterData {
  readonly dirsAndAttrsLeft: readonly number[];
  readonly dirsAndAttrsRight: readonly number[];
  readonly dirsAndAttrsTop: readonly number[];
  readonly dirsAndAttrsBottom: readonly number[];
  readonly initialXs: readonly number[];
  readonly initialYs: readonly number[];
}

export interface BossSprites {
  readonly aquamentus: AquamentusSprites;
  readonly dodongo: DodongoSprites;
  readonly digdogger: DigdoggerSprites;
  readonly gleeok: GleeokSprites;
  readonly ganon: GanonSprites;
  readonly patra: PatraData;
  readonly manhandla: ManhandlaSprites;
}

export interface EnemyAnimTiming {
  readonly blueLeeverStateAnimTimes: readonly number[];
  readonly redLeeverStateAnimTimes: readonly number[];
  readonly wallmaster: WallmasterData;
}

export interface SpriteData {
  readonly coreAnimation: CoreAnimation;
  readonly objectTypeToAttributes: readonly number[];
  readonly spriteSystem: SpriteSystem;
  readonly link: LinkSprites;
  readonly items: ItemSprites;
  readonly weapons: WeaponSprites;
  readonly boomerang: BoomerangAnimation;
  readonly bombCloud: BombCloudOffsets;
  readonly bosses: BossSprites;
  readonly enemyAnimTiming: EnemyAnimTiming;
}
