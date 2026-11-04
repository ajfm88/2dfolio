// The overworld's hRandomAdd / hRandomSub (home/random.asm; engine/math/random.asm:1-14). DECISIONS #91.
// main installs its page-lifetime BattleRandomState here; a battle attaches the same two bytes to its
// BattleState and returns them when it ends, so there is one owner for the whole page.
import { BattleRandomState } from '../battle/battle_random_state';

/** What the overworld reads and calls. BattleRandomState is the production owner; tests may pin one. */
export interface OverworldRandomOwner {
  readonly hRandomAdd: number;
  readonly hRandomSub: number;
  readonly carry: 0 | 1;
  random(carryIn: 0 | 1): number;
}

let owner: OverworldRandomOwner | null = null;

export function installOverworldRandom(random: OverworldRandomOwner): void { owner = random; }

/** Before main installs its owner (module tests): a free-running stand-in DIV, HRAM cleared as at boot. */
export function currentOverworldRandom(): OverworldRandomOwner {
  if (!owner) { let div = 0; owner = new BattleRandomState(() => div++ & 0xff); }
  return owner;
}

/** home/random.asm Random, with the caller's incoming carry for Random_'s ADC. Returns hRandomAdd. */
export function overworldRandom(carryIn: 0 | 1): number { return currentOverworldRandom().random(carryIn); }

/** The two bytes as the last Random left them. TryDoWildEncounter reads both without calling Random. */
export function overworldRandomBytes(): { hRandomAdd: number; hRandomSub: number } {
  const random = currentOverworldRandom();
  return { hRandomAdd: random.hRandomAdd, hRandomSub: random.hRandomSub };
}

/** Random_'s exit carry: its SBC's borrow (AddPartyMon's second call inherits it). */
export function overworldRandomCarry(): 0 | 1 { return currentOverworldRandom().carry; }
