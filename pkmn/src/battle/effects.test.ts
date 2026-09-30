import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  isNonDamagingEffect, isAlwaysHappenEffect, shouldSkipAccuracy,
  isLockedIntoMove, canChooseMove, isMoveDisabled,
  checkVolatilePreTurn, applyVolatileEndOfTurn,
  handleSubstitute, handleHaze, handleLeechSeed, handleScreen, handleMist,
  handleFocusEnergy, handleConfusion, handleHeal, handleTransform,
  handleConversion, handleMimic, handleDisable,
  selectMetronomeMove, selectMirrorMove,
  handleSplash, handleSwitchAndTeleport,
  handleOHKO, handleSuperFang, handleBideStart, handleCounter,
  handleHyperBeam, handleRecoil, handleDrain, handleExplode, handlePayDay,
  rollMultiHitCount,
  handleRageStart, handleRageHit,
  handleThrashStart, handleTrappingStart,
  handleChargeTurn,
  handleFlinchSideEffect, handleConfusionSideEffect,
  handleJumpKickCrash,
  checkSubstitute, isBlockedByMist, getEffectiveTypes,
} from './effects';
import { loadBattleData } from './data';
import { makePokemon, mockRandomFixed, mockRandom, restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
});

afterEach(() => {
  restoreRandom();
});

// ──────── Effect classification queries ────────

describe('isNonDamagingEffect', () => {
  it('returns true for RESIDUAL_EFFECTS_1', () => {
    expect(isNonDamagingEffect('SUBSTITUTE_EFFECT')).toBe(true);
    expect(isNonDamagingEffect('HAZE_EFFECT')).toBe(true);
    expect(isNonDamagingEffect('LEECH_SEED_EFFECT')).toBe(true);
    expect(isNonDamagingEffect('TRANSFORM_EFFECT')).toBe(true);
    expect(isNonDamagingEffect('SPLASH_EFFECT')).toBe(true);
    expect(isNonDamagingEffect('SLEEP_EFFECT')).toBe(true);
    expect(isNonDamagingEffect('CONFUSION_EFFECT')).toBe(true);
    expect(isNonDamagingEffect('REFLECT_EFFECT')).toBe(true);
  });

  it('returns false for damaging effects', () => {
    expect(isNonDamagingEffect('NO_ADDITIONAL_EFFECT')).toBe(false);
    expect(isNonDamagingEffect('HYPER_BEAM_EFFECT')).toBe(false);
    expect(isNonDamagingEffect('RECOIL_EFFECT')).toBe(false);
  });
});

describe('isAlwaysHappenEffect', () => {
  it('returns true for always-happen effects', () => {
    expect(isAlwaysHappenEffect('DRAIN_HP_EFFECT')).toBe(true);
    expect(isAlwaysHappenEffect('EXPLODE_EFFECT')).toBe(true);
    expect(isAlwaysHappenEffect('RECOIL_EFFECT')).toBe(true);
    expect(isAlwaysHappenEffect('HYPER_BEAM_EFFECT')).toBe(true);
    expect(isAlwaysHappenEffect('PAY_DAY_EFFECT')).toBe(true);
  });

  it('returns false for non-always effects', () => {
    expect(isAlwaysHappenEffect('SLEEP_EFFECT')).toBe(false);
    expect(isAlwaysHappenEffect('NO_ADDITIONAL_EFFECT')).toBe(false);
  });
});

describe('shouldSkipAccuracy', () => {
  it('returns true only for SWIFT_EFFECT', () => {
    expect(shouldSkipAccuracy('SWIFT_EFFECT')).toBe(true);
  });

  it('returns false for everything else', () => {
    expect(shouldSkipAccuracy('NO_ADDITIONAL_EFFECT')).toBe(false);
    expect(shouldSkipAccuracy('HYPER_BEAM_EFFECT')).toBe(false);
  });
});

describe('isLockedIntoMove', () => {
  it('returns lastMoveUsed when rage is true', () => {
    const pkmn = makePokemon({ volatileOverrides: { rage: true, lastMoveUsed: 'RAGE' } });
    expect(isLockedIntoMove(pkmn)).toBe('RAGE');
  });

  it('returns lastMoveUsed when thrashing > 0', () => {
    const pkmn = makePokemon({ volatileOverrides: { thrashing: 2, lastMoveUsed: 'THRASH' } });
    expect(isLockedIntoMove(pkmn)).toBe('THRASH');
  });

  it('returns BIDE when bide is active', () => {
    const pkmn = makePokemon({ volatileOverrides: { bide: { turnsLeft: 2, damage: 0 } } });
    expect(isLockedIntoMove(pkmn)).toBe('BIDE');
  });

  it('returns charging move when charging', () => {
    const pkmn = makePokemon({ volatileOverrides: { charging: 'FLY' } });
    expect(isLockedIntoMove(pkmn)).toBe('FLY');
  });

  it('returns lastMoveUsed when usingBinding > 0', () => {
    const pkmn = makePokemon({ volatileOverrides: { usingBinding: 3, lastMoveUsed: 'WRAP' } });
    expect(isLockedIntoMove(pkmn)).toBe('WRAP');
  });

  it('returns null when not locked', () => {
    const pkmn = makePokemon();
    expect(isLockedIntoMove(pkmn)).toBeNull();
  });
});

describe('canChooseMove', () => {
  it('returns true when not locked', () => {
    expect(canChooseMove(makePokemon())).toBe(true);
  });

  it('returns false when locked', () => {
    const pkmn = makePokemon({ volatileOverrides: { rage: true, lastMoveUsed: 'RAGE' } });
    expect(canChooseMove(pkmn)).toBe(false);
  });
});

describe('isMoveDisabled', () => {
  it('returns true when disabled.moveIndex matches', () => {
    const pkmn = makePokemon({ volatileOverrides: { disabled: { moveIndex: 1, turnsLeft: 3 } } });
    expect(isMoveDisabled(pkmn, 1)).toBe(true);
  });

  it('returns false for other indices', () => {
    const pkmn = makePokemon({ volatileOverrides: { disabled: { moveIndex: 1, turnsLeft: 3 } } });
    expect(isMoveDisabled(pkmn, 0)).toBe(false);
    expect(isMoveDisabled(pkmn, 2)).toBe(false);
  });

  it('returns false when disabled is null', () => {
    const pkmn = makePokemon();
    expect(isMoveDisabled(pkmn, 0)).toBe(false);
  });
});

// ──────── checkVolatilePreTurn ────────

describe('checkVolatilePreTurn', () => {
  describe('flinch', () => {
    it('prevents action and clears flinch flag', () => {
      const pkmn = makePokemon({ volatileOverrides: { flinch: true } });
      const opponent = makePokemon();
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(false);
      expect(result.skipTurn).toBe(true);
      expect(pkmn.volatiles.flinch).toBe(false);
      expect(result.messages[0][0]).toContain('flinched!');
    });
  });

  describe('recharging', () => {
    it('prevents action and clears recharging flag', () => {
      const pkmn = makePokemon({ volatileOverrides: { recharging: true } });
      const opponent = makePokemon();
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(false);
      expect(result.skipTurn).toBe(true);
      expect(pkmn.volatiles.recharging).toBe(false);
    });
  });

  describe('disable counter', () => {
    it('decrements turnsLeft each turn', () => {
      const pkmn = makePokemon({ volatileOverrides: { disabled: { moveIndex: 0, turnsLeft: 3 } } });
      const opponent = makePokemon();
      checkVolatilePreTurn(pkmn, opponent);
      expect(pkmn.volatiles.disabled!.turnsLeft).toBe(2);
    });

    it('clears disabled when turnsLeft reaches 0', () => {
      const pkmn = makePokemon({ volatileOverrides: { disabled: { moveIndex: 0, turnsLeft: 1 } } });
      const opponent = makePokemon();
      checkVolatilePreTurn(pkmn, opponent);
      expect(pkmn.volatiles.disabled).toBeNull();
    });
  });

  describe('bide', () => {
    it('stores energy while turnsLeft > 0', () => {
      const pkmn = makePokemon({ volatileOverrides: { bide: { turnsLeft: 2, damage: 10 } } });
      const opponent = makePokemon();
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(false);
      expect(pkmn.volatiles.bide!.turnsLeft).toBe(1);
    });

    it('releases 2x accumulated damage on turn 0', () => {
      const pkmn = makePokemon({ volatileOverrides: { bide: { turnsLeft: 1, damage: 30 } } });
      const opponent = makePokemon({ currentHp: 100 });
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(false);
      expect(pkmn.volatiles.bide).toBeNull();
      expect(opponent.currentHp).toBe(40); // 100 - 60
    });

    it('"But it failed!" if 0 damage accumulated', () => {
      const pkmn = makePokemon({ volatileOverrides: { bide: { turnsLeft: 1, damage: 0 } } });
      const opponent = makePokemon({ currentHp: 100 });
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(opponent.currentHp).toBe(100); // no damage
      expect(result.messages.some(m => m.includes('But it failed!'))).toBe(true);
    });
  });

  describe('thrashing', () => {
    it('forces lastMoveUsed as the move', () => {
      const pkmn = makePokemon({ volatileOverrides: { thrashing: 2, lastMoveUsed: 'THRASH' } });
      const opponent = makePokemon();
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(true);
      expect(result.forcedMoveId).toBe('THRASH');
    });

    it('applies confusion on last turn', () => {
      const pkmn = makePokemon({ volatileOverrides: { thrashing: 1, lastMoveUsed: 'THRASH' } });
      const opponent = makePokemon();
      mockRandomFixed(0.5); // confusion turns = floor(0.5*4)+2 = 4
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.forcedMoveId).toBe('THRASH');
      expect(pkmn.volatiles.confusion).toBe(4);
    });
  });

  describe('binding', () => {
    it('continues forcing lastMoveUsed', () => {
      const pkmn = makePokemon({ volatileOverrides: { usingBinding: 2, lastMoveUsed: 'WRAP' } });
      const opponent = makePokemon({ volatileOverrides: { binding: 2 } });
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(true);
      expect(result.forcedMoveId).toBe('WRAP');
    });

    it('clears opponent binding on end', () => {
      const pkmn = makePokemon({ volatileOverrides: { usingBinding: 1, lastMoveUsed: 'WRAP' } });
      const opponent = makePokemon({ volatileOverrides: { binding: 1 } });
      checkVolatilePreTurn(pkmn, opponent);
      expect(opponent.volatiles.binding).toBe(0);
    });
  });

  describe('charging', () => {
    it('returns charged move as forcedMoveId', () => {
      const pkmn = makePokemon({ volatileOverrides: { charging: 'FLY', invulnerable: true } });
      const opponent = makePokemon();
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(true);
      expect(result.forcedMoveId).toBe('FLY');
      expect(pkmn.volatiles.charging).toBeNull();
      expect(pkmn.volatiles.invulnerable).toBe(false);
    });
  });

  describe('rage', () => {
    it('forces lastMoveUsed', () => {
      const pkmn = makePokemon({ volatileOverrides: { rage: true, lastMoveUsed: 'RAGE' } });
      const opponent = makePokemon();
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(true);
      expect(result.forcedMoveId).toBe('RAGE');
    });
  });

  describe('confusion', () => {
    it('decrements counter and snaps out at 0', () => {
      const pkmn = makePokemon({ volatileOverrides: { confusion: 1 } });
      const opponent = makePokemon();
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(true);
      expect(pkmn.volatiles.confusion).toBe(0);
      expect(result.messages[0][0]).toContain('snapped');
    });

    it('50% chance to hit self', () => {
      const pkmn = makePokemon({
        volatileOverrides: { confusion: 3 },
        level: 50, attack: 100, defense: 50, currentHp: 200, maxHp: 200,
      });
      const opponent = makePokemon();
      // confusion self-hit: random < 0.5 → hit self
      // damage random: (floor(random*39)+217)
      mockRandom([0.1, 0.5]); // 0.1 < 0.5 → self-hit, damage rand
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(false);
      expect(pkmn.currentHp).toBeLessThan(200);
    });

    it('50% chance to act normally', () => {
      const pkmn = makePokemon({ volatileOverrides: { confusion: 3 }, currentHp: 100 });
      const opponent = makePokemon();
      mockRandomFixed(0.9); // 0.9 >= 0.5 → act normally
      const result = checkVolatilePreTurn(pkmn, opponent);
      expect(result.canAct).toBe(true);
      expect(pkmn.currentHp).toBe(100); // no self-damage
    });
  });
});

// ──────── applyVolatileEndOfTurn ────────

describe('applyVolatileEndOfTurn', () => {
  it('Leech Seed drains maxHP/16 and heals opponent', () => {
    const pkmn = makePokemon({ volatileOverrides: { leechSeed: true }, maxHp: 160, currentHp: 160 });
    const opponent = makePokemon({ maxHp: 100, currentHp: 80 });
    const result = applyVolatileEndOfTurn(pkmn, opponent);
    expect(result.damage).toBe(10); // 160/16
    expect(pkmn.currentHp).toBe(150);
    expect(opponent.currentHp).toBe(90); // healed by 10
  });

  it('minimum drain is 1', () => {
    const pkmn = makePokemon({ volatileOverrides: { leechSeed: true }, maxHp: 10, currentHp: 10 });
    const opponent = makePokemon({ maxHp: 100, currentHp: 90 });
    const result = applyVolatileEndOfTurn(pkmn, opponent);
    expect(result.damage).toBe(1); // floor(10/16)=0 → 1
  });

  it('Gen 1 bug: Leech Seed uses toxic counter multiplier', () => {
    const pkmn = makePokemon({
      volatileOverrides: { leechSeed: true },
      maxHp: 160, currentHp: 160,
      badlyPoisoned: true, toxicCounter: 3,
    });
    const opponent = makePokemon({ maxHp: 100, currentHp: 50 });
    const result = applyVolatileEndOfTurn(pkmn, opponent);
    // base drain = 10, × 3 = 30
    expect(result.damage).toBe(30);
    expect(pkmn.currentHp).toBe(130);
  });

  it('returns fainted: true when HP reaches 0', () => {
    const pkmn = makePokemon({ volatileOverrides: { leechSeed: true }, maxHp: 160, currentHp: 5 });
    const opponent = makePokemon({ maxHp: 100, currentHp: 90 });
    const result = applyVolatileEndOfTurn(pkmn, opponent);
    expect(result.fainted).toBe(true);
    expect(pkmn.currentHp).toBe(0);
  });

  it('no drain if not seeded', () => {
    const pkmn = makePokemon({ maxHp: 160, currentHp: 160 });
    const opponent = makePokemon();
    const result = applyVolatileEndOfTurn(pkmn, opponent);
    expect(result.damage).toBe(0);
  });
});

// ──────── Individual effect handlers ────────

describe('handleSubstitute', () => {
  it('creates substitute with HP = maxHP/4', () => {
    const pkmn = makePokemon({ maxHp: 200, currentHp: 200 });
    const result = handleSubstitute(pkmn);
    expect(result.failed).toBe(false);
    expect(pkmn.volatiles.substitute).toBe(50);
    expect(pkmn.currentHp).toBe(150);
  });

  it('fails if substitute already exists', () => {
    const pkmn = makePokemon({ volatileOverrides: { substitute: 25 } });
    const result = handleSubstitute(pkmn);
    expect(result.failed).toBe(true);
  });

  it('fails if currentHP <= cost', () => {
    const pkmn = makePokemon({ maxHp: 200, currentHp: 50 });
    const result = handleSubstitute(pkmn);
    expect(result.failed).toBe(true);
    expect(pkmn.currentHp).toBe(50); // unchanged
  });

  it('exactly at cost also fails (not strictly greater)', () => {
    const pkmn = makePokemon({ maxHp: 100, currentHp: 25 });
    // cost = floor(100/4) = 25, currentHp <= cost → fail
    const result = handleSubstitute(pkmn);
    expect(result.failed).toBe(true);
  });
});

describe('handleHaze', () => {
  it('resets stat stages for both Pokemon', () => {
    const attacker = makePokemon({
      statStages: { attack: 2, defense: -1, speed: 0, special: 3, accuracy: 0, evasion: -2 },
    });
    const defender = makePokemon({
      statStages: { attack: -3, defense: 2, speed: 1, special: 0, accuracy: 1, evasion: 0 },
    });
    handleHaze(attacker, defender);
    expect(attacker.statStages).toEqual({ attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 });
    expect(defender.statStages).toEqual({ attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 });
  });

  it('restores original stats for both', () => {
    const attacker = makePokemon({ attack: 25, originalStats: { attack: 50, defense: 50, speed: 50, special: 50 } });
    const defender = makePokemon({ defense: 100, originalStats: { attack: 50, defense: 50, speed: 50, special: 50 } });
    handleHaze(attacker, defender);
    expect(attacker.attack).toBe(50);
    expect(defender.defense).toBe(50);
  });

  it('clears DEFENDER status only (Gen 1 bug)', () => {
    const attacker = makePokemon({ status: 'BRN' });
    const defender = makePokemon({ status: 'PAR' });
    handleHaze(attacker, defender);
    expect(attacker.status).toBe('BRN'); // NOT cleared
    expect(defender.status).toBeNull();  // cleared
  });

  it('clears volatiles for both', () => {
    const attacker = makePokemon({
      volatileOverrides: { confusion: 3, leechSeed: true, reflect: true, substitute: 25 },
    });
    const defender = makePokemon({
      volatileOverrides: { mist: true, focusEnergy: true, lightScreen: true },
    });
    handleHaze(attacker, defender);
    expect(attacker.volatiles.confusion).toBe(0);
    expect(attacker.volatiles.leechSeed).toBe(false);
    expect(attacker.volatiles.reflect).toBe(false);
    expect(attacker.volatiles.substitute).toBe(0);
    expect(defender.volatiles.mist).toBe(false);
    expect(defender.volatiles.focusEnergy).toBe(false);
    expect(defender.volatiles.lightScreen).toBe(false);
  });
});

describe('handleLeechSeed', () => {
  it('Grass-type defender is immune', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ speciesOverrides: { type1: 'GRASS', type2: 'GRASS' } });
    const result = handleLeechSeed(attacker, defender);
    expect(result.failed).toBe(true);
  });

  it('already seeded fails', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ volatileOverrides: { leechSeed: true } });
    const result = handleLeechSeed(attacker, defender);
    expect(result.failed).toBe(true);
  });

  it('successfully seeds non-Grass defender', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ speciesOverrides: { type1: 'FIRE', type2: 'FIRE' } });
    const result = handleLeechSeed(attacker, defender);
    expect(result.failed).toBe(false);
    expect(defender.volatiles.leechSeed).toBe(true);
  });
});

describe('handleScreen', () => {
  it('Reflect sets reflect=true', () => {
    const pkmn = makePokemon();
    handleScreen(pkmn, 'REFLECT_EFFECT');
    expect(pkmn.volatiles.reflect).toBe(true);
  });

  it('Reflect fails if already active', () => {
    const pkmn = makePokemon({ volatileOverrides: { reflect: true } });
    const result = handleScreen(pkmn, 'REFLECT_EFFECT');
    expect(result.failed).toBe(true);
  });

  it('Light Screen sets lightScreen=true', () => {
    const pkmn = makePokemon();
    handleScreen(pkmn, 'LIGHT_SCREEN_EFFECT');
    expect(pkmn.volatiles.lightScreen).toBe(true);
  });

  it('Light Screen fails if already active', () => {
    const pkmn = makePokemon({ volatileOverrides: { lightScreen: true } });
    const result = handleScreen(pkmn, 'LIGHT_SCREEN_EFFECT');
    expect(result.failed).toBe(true);
  });
});

describe('handleMist', () => {
  it('sets mist=true', () => {
    const pkmn = makePokemon();
    handleMist(pkmn);
    expect(pkmn.volatiles.mist).toBe(true);
  });

  it('fails if already active', () => {
    const pkmn = makePokemon({ volatileOverrides: { mist: true } });
    const result = handleMist(pkmn);
    expect(result.failed).toBe(true);
  });
});

describe('handleFocusEnergy', () => {
  it('sets focusEnergy=true', () => {
    const pkmn = makePokemon();
    handleFocusEnergy(pkmn);
    expect(pkmn.volatiles.focusEnergy).toBe(true);
  });

  it('fails if already active', () => {
    const pkmn = makePokemon({ volatileOverrides: { focusEnergy: true } });
    const result = handleFocusEnergy(pkmn);
    expect(result.failed).toBe(true);
  });
});

describe('handleConfusion', () => {
  it('substitute blocks confusion', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ volatileOverrides: { substitute: 25 } });
    const result = handleConfusion(attacker, defender);
    expect(result.substituteBlocked).toBe(true);
  });

  it('already confused fails', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ volatileOverrides: { confusion: 3 } });
    const result = handleConfusion(attacker, defender);
    expect(result.failed).toBe(true);
  });

  it('sets confusion to 2-5 turns', () => {
    const attacker = makePokemon();
    const defender = makePokemon();
    mockRandomFixed(0.75); // floor(0.75*4)+2 = 5
    handleConfusion(attacker, defender);
    expect(defender.volatiles.confusion).toBe(5);
  });
});

describe('handleHeal', () => {
  describe('REST', () => {
    it('heals to full HP and sets sleep for 2 turns', () => {
      const pkmn = makePokemon({ maxHp: 200, currentHp: 50 });
      handleHeal(pkmn, 'REST');
      expect(pkmn.currentHp).toBe(200);
      expect(pkmn.status).toBe('SLP');
      expect(pkmn.sleepTurns).toBe(2);
    });

    it('restores stats from originalStats (clears burn/par mods)', () => {
      const pkmn = makePokemon({
        maxHp: 200, currentHp: 50,
        attack: 25, speed: 12,
        originalStats: { attack: 50, defense: 50, speed: 50, special: 50 },
      });
      handleHeal(pkmn, 'REST');
      expect(pkmn.attack).toBe(50);
      expect(pkmn.speed).toBe(50);
    });

    it('fails at full HP', () => {
      const pkmn = makePokemon({ maxHp: 200, currentHp: 200 });
      const result = handleHeal(pkmn, 'REST');
      expect(result.failed).toBe(true);
    });
  });

  describe('RECOVER / SOFTBOILED', () => {
    it('heals 50% maxHP', () => {
      const pkmn = makePokemon({ maxHp: 200, currentHp: 100 });
      handleHeal(pkmn, 'RECOVER');
      expect(pkmn.currentHp).toBe(200); // 100 + 100 = 200, capped at maxHp
    });

    it('caps at maxHP', () => {
      const pkmn = makePokemon({ maxHp: 200, currentHp: 180 });
      handleHeal(pkmn, 'SOFTBOILED');
      expect(pkmn.currentHp).toBe(200); // 180 + 100 = 280, capped at 200
    });

    it('fails at full HP', () => {
      const pkmn = makePokemon({ maxHp: 200, currentHp: 200 });
      const result = handleHeal(pkmn, 'RECOVER');
      expect(result.failed).toBe(true);
    });
  });
});

describe('handleTransform', () => {
  it('copies stats, moves, types, stat stages', () => {
    const attacker = makePokemon({ attack: 50, defense: 50 });
    const defender = makePokemon({
      attack: 120, defense: 80, speed: 90, special: 110,
      moves: [
        { id: 'THUNDERBOLT', pp: 15, maxPp: 15 },
        { id: 'SURF', pp: 15, maxPp: 15 },
      ],
      statStages: { attack: 2, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 },
      speciesOverrides: { type1: 'ELECTRIC', type2: 'ELECTRIC' },
    });
    handleTransform(attacker, defender);
    expect(attacker.attack).toBe(120);
    expect(attacker.defense).toBe(80);
    expect(attacker.moves).toHaveLength(2);
    expect(attacker.moves[0].pp).toBe(5); // 5 PP each
    expect(attacker.statStages.attack).toBe(2);
    expect(attacker.volatiles.transformed).toBe(true);
  });

  it('fails if defender is invulnerable', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ volatileOverrides: { invulnerable: true } });
    const result = handleTransform(attacker, defender);
    expect(result.failed).toBe(true);
  });
});

describe('handleConversion', () => {
  it('copies defender types', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ speciesOverrides: { type1: 'WATER', type2: 'ICE' } });
    handleConversion(attacker, defender);
    expect(attacker.volatiles.convertedType1).toBe('WATER');
    expect(attacker.volatiles.convertedType2).toBe('ICE');
  });
});

describe('handleMimic', () => {
  it('copies random opponent move', () => {
    const attacker = makePokemon({
      moves: [{ id: 'MIMIC', pp: 10, maxPp: 10 }],
    });
    const defender = makePokemon({
      moves: [{ id: 'THUNDERBOLT', pp: 15, maxPp: 15 }],
    });
    mockRandomFixed(0);
    handleMimic(attacker, defender);
    expect(attacker.moves[0].id).toBe('THUNDERBOLT');
    expect(attacker.volatiles.mimicSlot).toBe(0);
    expect(attacker.volatiles.mimicOriginal).toBe('MIMIC');
  });

  it('fails if defender has no moves', () => {
    const attacker = makePokemon({ moves: [{ id: 'MIMIC', pp: 10, maxPp: 10 }] });
    const defender = makePokemon({ moves: [] });
    const result = handleMimic(attacker, defender);
    expect(result.failed).toBe(true);
  });

  it('fails if attacker has no MIMIC move', () => {
    const attacker = makePokemon({ moves: [{ id: 'TACKLE', pp: 35, maxPp: 35 }] });
    const defender = makePokemon();
    const result = handleMimic(attacker, defender);
    expect(result.failed).toBe(true);
  });
});

describe('handleDisable', () => {
  it('disables random move with PP>0', () => {
    const attacker = makePokemon();
    const defender = makePokemon({
      moves: [
        { id: 'TACKLE', pp: 35, maxPp: 35 },
        { id: 'GROWL', pp: 40, maxPp: 40 },
      ],
    });
    mockRandom([0.5, 0.5]); // slot selection, turn count
    handleDisable(attacker, defender);
    expect(defender.volatiles.disabled).not.toBeNull();
    expect(defender.volatiles.disabled!.turnsLeft).toBeGreaterThanOrEqual(1);
    expect(defender.volatiles.disabled!.turnsLeft).toBeLessThanOrEqual(8);
  });

  it('fails if already disabled', () => {
    const attacker = makePokemon();
    const defender = makePokemon({
      volatileOverrides: { disabled: { moveIndex: 0, turnsLeft: 3 } },
    });
    const result = handleDisable(attacker, defender);
    expect(result.failed).toBe(true);
  });

  it('fails if substitute blocks', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ volatileOverrides: { substitute: 25 } });
    const result = handleDisable(attacker, defender);
    expect(result.substituteBlocked).toBe(true);
  });

  it('fails if no moves have PP', () => {
    const attacker = makePokemon();
    const defender = makePokemon({
      moves: [{ id: 'TACKLE', pp: 0, maxPp: 35 }],
    });
    const result = handleDisable(attacker, defender);
    expect(result.failed).toBe(true);
  });
});

describe('selectMetronomeMove', () => {
  it('returns a valid move name', () => {
    const move = selectMetronomeMove();
    expect(typeof move).toBe('string');
    expect(move).not.toBe('METRONOME');
    expect(move).not.toBe('STRUGGLE');
  });
});

describe('selectMirrorMove', () => {
  it('returns opponent lastMoveUsed', () => {
    const opponent = makePokemon({ volatileOverrides: { lastMoveUsed: 'THUNDERBOLT' } });
    expect(selectMirrorMove(opponent)).toBe('THUNDERBOLT');
  });

  it('returns null if no last move', () => {
    const opponent = makePokemon();
    expect(selectMirrorMove(opponent)).toBeNull();
  });

  it('returns null if last move was MIRROR_MOVE', () => {
    const opponent = makePokemon({ volatileOverrides: { lastMoveUsed: 'MIRROR_MOVE' } });
    expect(selectMirrorMove(opponent)).toBeNull();
  });
});

describe('handleSplash', () => {
  it('returns "No effect!" message', () => {
    const result = handleSplash();
    expect(result.messages[0]).toContain('No effect!');
  });
});

describe('handleSwitchAndTeleport', () => {
  it('trainer battle: fails', () => {
    const attacker = makePokemon();
    const defender = makePokemon();
    const result = handleSwitchAndTeleport(attacker, defender, true, true);
    expect(result.failed).toBe(true);
  });

  it('wild battle, player: ends battle with "Got away safely!"', () => {
    const attacker = makePokemon();
    const defender = makePokemon();
    const result = handleSwitchAndTeleport(attacker, defender, false, true);
    expect(result.endBattle).toBe(true);
    expect(result.messages[0]).toContain('Got away safely!');
  });

  it('wild battle, enemy: ends battle with flee message', () => {
    const attacker = makePokemon();
    const defender = makePokemon();
    const result = handleSwitchAndTeleport(attacker, defender, false, false);
    expect(result.endBattle).toBe(true);
  });
});

describe('handleOHKO', () => {
  it('slower attacker misses', () => {
    const attacker = makePokemon({ speed: 30 });
    const defender = makePokemon({ speed: 50 });
    const result = handleOHKO(attacker, defender);
    expect(result.missed).toBe(true);
  });

  it('faster attacker: damage=65535, defender HP=0', () => {
    const attacker = makePokemon({ speed: 100 });
    const defender = makePokemon({ speed: 50, currentHp: 200 });
    const result = handleOHKO(attacker, defender);
    expect(result.damage).toBe(65535);
    expect(defender.currentHp).toBe(0);
  });
});

describe('handleSuperFang', () => {
  it('damage = 50% current HP', () => {
    const defender = makePokemon({ currentHp: 80 });
    const result = handleSuperFang(defender);
    expect(result.damage).toBe(40);
  });

  it('minimum damage is 1', () => {
    const defender = makePokemon({ currentHp: 1 });
    const result = handleSuperFang(defender);
    expect(result.damage).toBe(1); // max(1, floor(1/2)) = max(1, 0) = 1
  });
});

describe('handleBideStart', () => {
  it('creates bide with 2-3 turns', () => {
    const pkmn = makePokemon();
    mockRandomFixed(0); // floor(0*2)+2 = 2
    handleBideStart(pkmn);
    expect(pkmn.volatiles.bide).not.toBeNull();
    expect(pkmn.volatiles.bide!.turnsLeft).toBe(2);
    expect(pkmn.volatiles.bide!.damage).toBe(0);
  });

  it('fails if already in bide', () => {
    const pkmn = makePokemon({ volatileOverrides: { bide: { turnsLeft: 2, damage: 0 } } });
    const result = handleBideStart(pkmn);
    expect(result.failed).toBe(true);
  });
});

describe('handleCounter', () => {
  it('returns 2x lastDamageReceived for Normal/Fighting moves', () => {
    const attacker = makePokemon({ volatileOverrides: { lastDamageReceived: 30 } });
    const defender = makePokemon({
      currentHp: 100,
      volatileOverrides: { lastMoveUsed: 'TACKLE' }, // NORMAL type
    });
    const result = handleCounter(attacker, defender);
    expect(result.damage).toBe(60);
    expect(defender.currentHp).toBe(40);
  });

  it('fails if no last move', () => {
    const attacker = makePokemon({ volatileOverrides: { lastDamageReceived: 30 } });
    const defender = makePokemon();
    const result = handleCounter(attacker, defender);
    expect(result.failed).toBe(true);
  });

  it('fails if last move type not NORMAL or FIGHTING', () => {
    const attacker = makePokemon({ volatileOverrides: { lastDamageReceived: 30 } });
    const defender = makePokemon({ volatileOverrides: { lastMoveUsed: 'THUNDERBOLT' } }); // ELECTRIC
    const result = handleCounter(attacker, defender);
    expect(result.failed).toBe(true);
  });

  it('fails if lastDamageReceived is 0', () => {
    const attacker = makePokemon({ volatileOverrides: { lastDamageReceived: 0 } });
    const defender = makePokemon({
      currentHp: 100,
      volatileOverrides: { lastMoveUsed: 'TACKLE' },
    });
    const result = handleCounter(attacker, defender);
    expect(result.failed).toBe(true);
  });
});

describe('handleHyperBeam', () => {
  it('sets recharging=true if defender survived', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ currentHp: 50 });
    handleHyperBeam(attacker, defender);
    expect(attacker.volatiles.recharging).toBe(true);
  });

  it('Gen 1 bug: no recharge if KO', () => {
    const attacker = makePokemon();
    const defender = makePokemon({ currentHp: 0 });
    handleHyperBeam(attacker, defender);
    expect(attacker.volatiles.recharging).toBe(false);
  });
});

describe('handleRecoil', () => {
  it('25% recoil for normal recoil moves', () => {
    const pkmn = makePokemon({ currentHp: 100 });
    const result = handleRecoil('TAKE_DOWN', pkmn, 40);
    expect(result.recoilDamage).toBe(10); // 40/4
    expect(pkmn.currentHp).toBe(90);
  });

  it('50% recoil for STRUGGLE', () => {
    const pkmn = makePokemon({ currentHp: 100 });
    const result = handleRecoil('STRUGGLE', pkmn, 40);
    expect(result.recoilDamage).toBe(20); // 40/2
    expect(pkmn.currentHp).toBe(80);
  });

  it('minimum recoil is 1', () => {
    const pkmn = makePokemon({ currentHp: 100 });
    const result = handleRecoil('TAKE_DOWN', pkmn, 2);
    expect(result.recoilDamage).toBe(1); // max(1, floor(2/4))
  });

  it('no recoil if damage=0', () => {
    const pkmn = makePokemon({ currentHp: 100 });
    const result = handleRecoil('TAKE_DOWN', pkmn, 0);
    expect(result.recoilDamage).toBe(0);
    expect(pkmn.currentHp).toBe(100);
  });
});

describe('handleDrain', () => {
  it('heals 50% of damage dealt (min 1)', () => {
    const attacker = makePokemon({ maxHp: 200, currentHp: 150 });
    const defender = makePokemon();
    const result = handleDrain(attacker, defender, 40, false);
    expect(result.healAmount).toBe(20);
    expect(attacker.currentHp).toBe(170);
  });

  it('capped at maxHP', () => {
    const attacker = makePokemon({ maxHp: 200, currentHp: 195 });
    const defender = makePokemon();
    handleDrain(attacker, defender, 40, false);
    expect(attacker.currentHp).toBe(200);
  });

  it('Dream Eater message differs', () => {
    const attacker = makePokemon({ maxHp: 200, currentHp: 100 });
    const defender = makePokemon();
    const result = handleDrain(attacker, defender, 40, true);
    expect(result.messages[0]).toContain('Dream was eaten!');
  });
});

describe('handleExplode', () => {
  it('sets attacker currentHp=0, selfFaint=true', () => {
    const pkmn = makePokemon({ currentHp: 100 });
    const result = handleExplode(pkmn);
    expect(pkmn.currentHp).toBe(0);
    expect(result.selfFaint).toBe(true);
  });
});

describe('handlePayDay', () => {
  it('accumulates level*2 money', () => {
    const pkmn = makePokemon({ level: 30 });
    const result = handlePayDay(pkmn);
    expect(result.payDayMoney).toBe(60);
    expect(pkmn.volatiles.payDayMoney).toBe(60);
  });
});

describe('rollMultiHitCount', () => {
  it('returns 2 for rolls 0-2', () => {
    for (const r of [0, 0.125, 0.25]) {
      mockRandomFixed(r);
      expect(rollMultiHitCount()).toBe(2);
      restoreRandom();
    }
  });

  it('returns 3 for rolls 3-5', () => {
    mockRandomFixed(0.5); // floor(0.5*8) = 4
    expect(rollMultiHitCount()).toBe(3);
  });

  it('returns 4 for roll 6', () => {
    mockRandomFixed(0.75); // floor(0.75*8) = 6
    expect(rollMultiHitCount()).toBe(4);
  });

  it('returns 5 for roll 7', () => {
    mockRandomFixed(0.875); // floor(0.875*8) = 7
    expect(rollMultiHitCount()).toBe(5);
  });
});

describe('handleRageStart / handleRageHit', () => {
  it('rageStart sets rage=true', () => {
    const pkmn = makePokemon();
    handleRageStart(pkmn);
    expect(pkmn.volatiles.rage).toBe(true);
  });

  it('rageHit increments attack stage by 1', () => {
    const pkmn = makePokemon({ volatileOverrides: { rage: true } });
    const result = handleRageHit(pkmn);
    expect(pkmn.statStages.attack).toBe(1);
    expect(result).not.toBeNull();
  });

  it('rageHit caps at +6', () => {
    const pkmn = makePokemon({
      volatileOverrides: { rage: true },
      statStages: { attack: 6, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 },
    });
    const result = handleRageHit(pkmn);
    expect(result).toBeNull();
    expect(pkmn.statStages.attack).toBe(6);
  });

  it('rageHit returns null if not in rage', () => {
    const pkmn = makePokemon();
    expect(handleRageHit(pkmn)).toBeNull();
  });
});

describe('handleThrashStart', () => {
  it('sets thrashing to 2-3 turns', () => {
    const pkmn = makePokemon();
    mockRandomFixed(0); // floor(0*2)+2 = 2
    handleThrashStart(pkmn);
    expect(pkmn.volatiles.thrashing).toBe(2);
  });
});

describe('handleTrappingStart', () => {
  it('sets binding on both attacker and defender', () => {
    const attacker = makePokemon();
    const defender = makePokemon();
    mockRandomFixed(0); // rollMultiHitCount: floor(0*8)=0 → 2
    handleTrappingStart(attacker, defender);
    expect(attacker.volatiles.usingBinding).toBe(2);
    expect(defender.volatiles.binding).toBe(2);
  });
});

describe('handleChargeTurn', () => {
  it('sets charging and skipDamage', () => {
    const pkmn = makePokemon();
    const result = handleChargeTurn(pkmn, 'SOLAR_BEAM', false);
    expect(pkmn.volatiles.charging).toBe('SOLAR_BEAM');
    expect(result.skipDamage).toBe(true);
    expect(pkmn.volatiles.invulnerable).toBe(false);
  });

  it('FLY sets invulnerable=true', () => {
    const pkmn = makePokemon();
    handleChargeTurn(pkmn, 'FLY', true);
    expect(pkmn.volatiles.invulnerable).toBe(true);
    expect(pkmn.volatiles.charging).toBe('FLY');
  });

  it('DIG sets invulnerable=true', () => {
    const pkmn = makePokemon();
    handleChargeTurn(pkmn, 'DIG', true);
    expect(pkmn.volatiles.invulnerable).toBe(true);
  });

  it('non-Fly/Dig do NOT set invulnerable', () => {
    const pkmn = makePokemon();
    handleChargeTurn(pkmn, 'SKULL_BASH', false);
    expect(pkmn.volatiles.invulnerable).toBe(false);
  });

  it('correct messages per move', () => {
    const fly = handleChargeTurn(makePokemon(), 'FLY', true);
    expect(fly.messages[0][0]).toContain('flew up');

    const dig = handleChargeTurn(makePokemon(), 'DIG', true);
    expect(dig.messages[0][0]).toContain('dug a');

    const solar = handleChargeTurn(makePokemon(), 'SOLARBEAM', false);
    expect(solar.messages[0].join(' ')).toContain('sunlight');

    const sky = handleChargeTurn(makePokemon(), 'SKY_ATTACK', false);
    expect(sky.messages[0][0]).toContain('glowing');

    const skull = handleChargeTurn(makePokemon(), 'SKULL_BASH', false);
    expect(skull.messages[0].join(' ')).toContain('head');

    const razor = handleChargeTurn(makePokemon(), 'RAZOR_WIND', false);
    expect(razor.messages[0].join(' ')).toContain('whirlwind');
  });
});

describe('handleFlinchSideEffect', () => {
  it('only triggers if attacker moved first', () => {
    const defender = makePokemon();
    mockRandomFixed(0);
    const result = handleFlinchSideEffect('FLINCH_SIDE_EFFECT2', defender, false);
    expect(result).toBeNull();
    expect(defender.volatiles.flinch).toBe(false);
  });

  it('substitute blocks flinch', () => {
    const defender = makePokemon({ volatileOverrides: { substitute: 25 } });
    mockRandomFixed(0);
    const result = handleFlinchSideEffect('FLINCH_SIDE_EFFECT2', defender, true);
    expect(result).toBeNull();
  });

  it('10% chance for FLINCH_SIDE_EFFECT1', () => {
    const defender = makePokemon();
    mockRandomFixed(0); // floor(0*256) = 0 < 26 → flinch
    handleFlinchSideEffect('FLINCH_SIDE_EFFECT1', defender, true);
    expect(defender.volatiles.flinch).toBe(true);
  });

  it('30% chance for FLINCH_SIDE_EFFECT2', () => {
    const defender = makePokemon();
    mockRandomFixed(0.2); // floor(0.2*256) = 51 < 77 → flinch
    handleFlinchSideEffect('FLINCH_SIDE_EFFECT2', defender, true);
    expect(defender.volatiles.flinch).toBe(true);
  });

  it('does not flinch when random exceeds threshold', () => {
    const defender = makePokemon();
    mockRandomFixed(0.5); // floor(0.5*256) = 128 >= 77 → no flinch
    handleFlinchSideEffect('FLINCH_SIDE_EFFECT2', defender, true);
    expect(defender.volatiles.flinch).toBe(false);
  });
});

describe('handleConfusionSideEffect', () => {
  it('substitute blocks', () => {
    const defender = makePokemon({ volatileOverrides: { substitute: 25 } });
    mockRandomFixed(0);
    const result = handleConfusionSideEffect(defender);
    expect(result).toBeNull();
  });

  it('already confused: no effect', () => {
    const defender = makePokemon({ volatileOverrides: { confusion: 3 } });
    mockRandomFixed(0);
    const result = handleConfusionSideEffect(defender);
    expect(result).toBeNull();
  });

  it('10% chance applies confusion', () => {
    const defender = makePokemon();
    // Need two randoms: threshold check and confusion turns
    mockRandom([0, 0.5]); // 0 < 26/256 → trigger, confusion = floor(0.5*4)+2 = 4
    const result = handleConfusionSideEffect(defender);
    expect(result).not.toBeNull();
    expect(defender.volatiles.confusion).toBe(4);
  });
});

describe('handleJumpKickCrash', () => {
  it('deals 1 HP crash damage', () => {
    const pkmn = makePokemon({ currentHp: 100 });
    const result = handleJumpKickCrash(pkmn);
    expect(pkmn.currentHp).toBe(99);
    expect(result.recoilDamage).toBe(1);
    expect(result.messages[0].join(' ')).toContain('crashed');
  });
});

describe('checkSubstitute', () => {
  it('absorbs damage and reduces substitute HP', () => {
    const defender = makePokemon({ volatileOverrides: { substitute: 50 } });
    const { absorbed, messages } = checkSubstitute(defender, 30);
    expect(absorbed).toBe(true);
    expect(defender.volatiles.substitute).toBe(20);
    expect(messages).toHaveLength(0); // no break message
  });

  it('breaks substitute when HP <= 0', () => {
    const defender = makePokemon({ volatileOverrides: { substitute: 30 } });
    const { absorbed, messages } = checkSubstitute(defender, 50);
    expect(absorbed).toBe(true);
    expect(defender.volatiles.substitute).toBe(0);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('SUBSTITUTE faded!');
  });

  it('no substitute: absorbed=false', () => {
    const defender = makePokemon();
    const { absorbed } = checkSubstitute(defender, 30);
    expect(absorbed).toBe(false);
  });

  it('0 damage: absorbed=false', () => {
    const defender = makePokemon({ volatileOverrides: { substitute: 50 } });
    const { absorbed } = checkSubstitute(defender, 0);
    expect(absorbed).toBe(false);
  });
});

describe('isBlockedByMist', () => {
  it('blocks stat-lowering when mist active', () => {
    const defender = makePokemon({ volatileOverrides: { mist: true } });
    expect(isBlockedByMist(defender, -1)).toBe(true);
    expect(isBlockedByMist(defender, -2)).toBe(true);
  });

  it('does NOT block stat-raising', () => {
    const defender = makePokemon({ volatileOverrides: { mist: true } });
    expect(isBlockedByMist(defender, 1)).toBe(false);
  });

  it('does NOT block when mist is false', () => {
    const defender = makePokemon();
    expect(isBlockedByMist(defender, -1)).toBe(false);
  });
});

describe('getEffectiveTypes', () => {
  it('returns species types when no conversion', () => {
    const pkmn = makePokemon({ speciesOverrides: { type1: 'WATER', type2: 'ICE' } });
    const types = getEffectiveTypes(pkmn);
    expect(types.type1).toBe('WATER');
    expect(types.type2).toBe('ICE');
  });

  it('returns converted types when set', () => {
    const pkmn = makePokemon({
      speciesOverrides: { type1: 'NORMAL', type2: 'NORMAL' },
      volatileOverrides: { convertedType1: 'FIRE', convertedType2: 'FLYING' },
    });
    const types = getEffectiveTypes(pkmn);
    expect(types.type1).toBe('FIRE');
    expect(types.type2).toBe('FLYING');
  });

  it('partial conversion: only one type overridden', () => {
    const pkmn = makePokemon({
      speciesOverrides: { type1: 'WATER', type2: 'ICE' },
      volatileOverrides: { convertedType1: 'FIRE' },
    });
    const types = getEffectiveTypes(pkmn);
    expect(types.type1).toBe('FIRE');
    expect(types.type2).toBe('ICE'); // not overridden
  });
});
