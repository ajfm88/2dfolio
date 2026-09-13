export const GameMode = Object.freeze({
  // Front-end states (J1). Boot starts at Title.
  Title: 0,
  FileSelect: 1,
  Register: 2,
  Elimination: 3,
  Gameplay: 4,
  DeathAnimation: 5,
  GameOver: 6,
  CaveTransition: 7,
  CaveInterior: 8,
  DungeonGameplay: 9,
  DungeonTransition: 10,
  DungeonTriforceGet: 11,
  ZeldaRescue: 12
});

export function gameModeName(mode) {
  for (const [name, value] of Object.entries(GameMode)) {
    if (value === mode) return name;
  }
  return '?';
}
