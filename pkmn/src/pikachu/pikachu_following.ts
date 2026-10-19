// wPikachuOverworldStateFlags bit 1: DisablePikachuFollowingPlayer.
// Not saved: the flag can only be set in PewterPokecenter (where bit 4 is already
// clear), so every warp out or CONTINUE runs enablePikachuFollowing() before
// the player can save. The cartridge stores it in WRAM (wMainDataStart…End) and
// SaveData carries it, but CONTINUE's LoadMapData always re-enables it first.
let followingDisabled = false;

export function isPikachuFollowingDisabled(): boolean { return followingDisabled; }

export function disablePikachuFollowing(): void { followingDisabled = true; }

/** Called by every warp map load (NOT after a battle or blackout — F-1), by
 *  loadSavedGame (CONTINUE), and by startNewGame. Mirrors SchedulePikachuSpawnForAfterText
 *  which enablePikachuFollowingPlayer unless BIT_BATTLE_OVER_OR_BLACKOUT is set. */
export function enablePikachuFollowing(): void { followingDisabled = false; }
