export interface EnemySpawnScreen {
  readonly screenId: number;
  readonly monsterListId: number;
  readonly monsterCountIndex: number;
  readonly edgeSpawn: boolean;
}

export interface EnemySpawnData {
  readonly objectTypes: Readonly<Record<string, string>>;
  readonly objectLists: readonly (readonly number[])[];
  readonly spawnPositions: readonly (readonly number[])[];
  readonly overworldSpawns: readonly EnemySpawnScreen[];
  readonly overworldFoeCounts: readonly number[];
  /** Q1 AttrsA bit $08, Z_04.asm:1757 CheckZora; Q2 overrides belong to L2a4. */
  readonly overworldZoraScreens: readonly number[];
}
