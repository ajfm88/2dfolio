// Dungeon secret triggers — Z_05.asm CheckSecretTrigger_JumpTable
// Each room has a secretTrigger value (0-7) that gates actions on conditions.

export interface SecretTriggerResult {
  readonly shuttersOpen: boolean;
  readonly stairsRevealed: boolean;
  readonly itemActivated: boolean;
}

const NO_TRIGGER: SecretTriggerResult = {
  shuttersOpen: false,
  stairsRevealed: false,
  itemActivated: false,
};

export function checkSecretTrigger(
  trigger: number,
  allDead: boolean,
  pushComplete: boolean,
  _bossDefeated: boolean,
): SecretTriggerResult {
  switch (trigger) {
    case 0:
      return NO_TRIGGER;

    case 1: // AllDead — kill all enemies to open shutters
    case 7: // AllDead + item appears
      if (!allDead) return NO_TRIGGER;
      return {
        shuttersOpen: true,
        stairsRevealed: false,
        itemActivated: trigger === 7,
      };

    case 2: // Ringleader — slot-1 kill triggers mass kill (handled in main.ts)
      return NO_TRIGGER;

    case 3: // LastBoss — boss defeated opens shutters + reveals item
      if (!_bossDefeated) return NO_TRIGGER;
      return { shuttersOpen: true, stairsRevealed: false, itemActivated: true };

    case 4: // BlockDoor — push block opens shutters
      if (!pushComplete) return NO_TRIGGER;
      return { shuttersOpen: true, stairsRevealed: false, itemActivated: false };

    case 5: // BlockStairs — push block reveals stairs at ($D0, $60)
      if (!pushComplete) return NO_TRIGGER;
      return { shuttersOpen: false, stairsRevealed: true, itemActivated: false };

    case 6: // MoneyOrLife — old man gone opens shutters (deferred)
      return NO_TRIGGER;

    default:
      return NO_TRIGGER;
  }
}
