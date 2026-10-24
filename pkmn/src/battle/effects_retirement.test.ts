// A5c3c checkpoint-07b. The retirement manifest is test data (note 69 §10.19).
// It is not on the production import graph. effects.ts and effects.test.ts stay until A5c3f.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

interface RetirementRow {
  line: number;
  title: string;
  suite: 'prior' | 'dispatch' | 'status' | 'stats' | 'turns' | 'hp' | 'composed';
  disposition: string;
  file: string;
  test: string;
}

/** 139 rows. `title` is the effects.test.ts `it(` literal. `test` is the replacement's source title. */
const ROWS: RetirementRow[] = [
  { line: 35, title: "returns true for RESIDUAL_EFFECTS_1", suite: "dispatch", disposition: "correct: sleep is R2, classify by execution stage", file: "battle_effects_composed.test.ts", test: "effect 0x$hex $stage" },
  { line: 46, title: "returns false for damaging effects", suite: "dispatch", disposition: "correct: sleep is R2, classify by execution stage", file: "battle_effects_composed.test.ts", test: "effect 0x$hex $stage" },
  { line: 54, title: "returns true for always-happen effects", suite: "dispatch", disposition: "correct: Hyper Beam is final, not always", file: "battle_effects_composed.test.ts", test: "effect 0x$hex $stage" },
  { line: 62, title: "returns false for non-always effects", suite: "dispatch", disposition: "correct: Hyper Beam is final, not always", file: "battle_effects_composed.test.ts", test: "effect 0x$hex $stage" },
  { line: 69, title: "returns true only for SWIFT_EFFECT", suite: "prior", disposition: "mapped", file: "battle_hit.test.ts", test: "Swift bypasses Substitute, invulnerability, Mist, modifiers and writes" },
  { line: 73, title: "returns false for everything else", suite: "prior", disposition: "mapped", file: "battle_hit.test.ts", test: "invulnerability misses before X Accuracy" },
  { line: 80, title: "returns lastMoveUsed when rage is true", suite: "prior", disposition: "mapped: use ordered cartridge flags, not lastMoveUsed abstraction", file: "battle_turn.test.ts", test: "Rage beats flinch clearing, charging, menu and enemy trapping" },
  { line: 85, title: "returns lastMoveUsed when thrashing > 0", suite: "prior", disposition: "mapped: use ordered cartridge flags, not lastMoveUsed abstraction", file: "battle_turn_status.test.ts", test: "Thrash count%i decrements; final attack adds silent confusion only at zero" },
  { line: 90, title: "returns BIDE when bide is active", suite: "prior", disposition: "mapped: use ordered cartridge flags, not lastMoveUsed abstraction", file: "battle_turn_status.test.ts", test: "Bide hold uses shared BE damage and hit-count alias, no SavingEnergyText or RNG" },
  { line: 95, title: "returns charging move when charging", suite: "prior", disposition: "mapped: use ordered cartridge flags, not lastMoveUsed abstraction", file: "battle_execute.test.ts", test: "charge release reloads only the player, clears both bits, and bypasses obedience" },
  { line: 100, title: "returns lastMoveUsed when usingBinding > 0", suite: "prior", disposition: "mapped: use ordered cartridge flags, not lastMoveUsed abstraction", file: "battle_execute.test.ts", test: "trapping continuation enters animation with cached damage and no level swap or RNG" },
  { line: 105, title: "returns null when not locked", suite: "prior", disposition: "mapped: use ordered cartridge flags, not lastMoveUsed abstraction", file: "battle_turn_status.test.ts", test: "normal continuation has no text, frame, RNG or PP effects" },
  { line: 112, title: "returns true when not locked", suite: "prior", disposition: "mapped: selection/continuation ownership", file: "battle_turn.test.ts", test: "cancel restores Buffer1, draws HUDs and repeats readback before choosing again" },
  { line: 116, title: "returns false when locked", suite: "prior", disposition: "mapped: selection/continuation ownership", file: "battle_turn.test.ts", test: "%s skips the chooser at its exact gate" },
  { line: 123, title: "returns true when disabled.moveIndex matches", suite: "prior", disposition: "mapped: packed slot plus disabled-number semantics", file: "battle_turn_status.test.ts", test: "selected disabled ID blocks after confusion but before paralysis, clears charging only" },
  { line: 128, title: "returns false for other indices", suite: "prior", disposition: "mapped: packed slot plus disabled-number semantics", file: "battle_turn_status.test.ts", test: "a disabled different ID does not block" },
  { line: 134, title: "returns false when disabled is null", suite: "prior", disposition: "mapped: packed slot plus disabled-number semantics", file: "battle_turn_status.test.ts", test: "disable byte %i ticks/expires before confusion, then same action continues" },
  { line: 144, title: "prevents action and clears flinch flag", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "flinch clears its bit before text, before recharge/disable/confusion" },
  { line: 156, title: "prevents action and clears recharging flag", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "recharge clears its bit, retaining Rage and later counters" },
  { line: 167, title: "decrements turnsLeft each turn", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "disable byte %i ticks/expires before confusion, then same action continues" },
  { line: 174, title: "clears disabled when turnsLeft reaches 0", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "disable byte %i ticks/expires before confusion, then same action continues" },
  { line: 183, title: "stores energy while turnsLeft > 0", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "Bide hold uses shared BE damage and hit-count alias, no SavingEnergyText or RNG" },
  { line: 191, title: "releases 2x accumulated damage on turn 0", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "Bide accumulation and flag clear precede its text, while doubling/alias clearing follow it" },
  { line: 200, title: "\"But it failed!\" if 0 damage accumulated", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "Bide release accumulator%i wraps, clears aliases, returns miss/apply entry" },
  { line: 210, title: "forces lastMoveUsed as the move", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "Thrash count%i decrements; final attack adds silent confusion only at zero" },
  { line: 218, title: "applies confusion on last turn", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "Thrash count%i decrements; final attack adds silent confusion only at zero" },
  { line: 229, title: "continues forcing lastMoveUsed", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "trapping count%i returns animation entry even on zero, preserving damage/flag" },
  { line: 237, title: "clears opponent binding on end", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn.test.ts", test: "cleanup trapping counters %i/%i only after both actors" },
  { line: 246, title: "returns charged move as forcedMoveId", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_execute.test.ts", test: "charge release reloads only the player, clears both bits, and bypasses obedience" },
  { line: 258, title: "forces lastMoveUsed", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_execute.test.ts", test: "Rage continuation enters announce and skips PP through existing Rage guard" },
  { line: 268, title: "decrements counter and snaps out at 0", suite: "prior", disposition: "mapped: checked status continuation, not monolithic pre-turn", file: "battle_turn_status.test.ts", test: "a zero confusion counter wraps to255 and still rolls" },
  { line: 277, title: "50% chance to hit self", suite: "prior", disposition: "correct: self-hit uses R>=128, not legacy float R<0.5; no damage-range draw", file: "battle_turn_status.test.ts", test: "confusion boundary %i is drawn after its text/animation; self-hit skips PAR" },
  { line: 291, title: "50% chance to act normally", suite: "prior", disposition: "correct: self-hit uses R>=128, not legacy float R<0.5; no damage-range draw", file: "battle_turn_status.test.ts", test: "confusion boundary %i is drawn after its text/animation; self-hit skips PAR" },
  { line: 305, title: "Leech Seed drains maxHP/16 and heals opponent", suite: "prior", disposition: "correct: residual occurs after each action, use real Toxic counter/order", file: "battle_residual.test.ts", test: "seed alone flips animation and heal-bar turns, heals first, then prints" },
  { line: 314, title: "minimum drain is 1", suite: "prior", disposition: "correct: residual occurs after each action, use real Toxic counter/order", file: "battle_residual.test.ts", test: "maxHP%i uses base damage%i and leaves the opposite side untouched" },
  { line: 321, title: "Gen 1 bug: Leech Seed uses toxic counter multiplier", suite: "prior", disposition: "correct: residual occurs after each action, use real Toxic counter/order", file: "battle_residual.test.ts", test: "Toxic counter%i increments before additions; BC%i retained on overkill" },
  { line: 334, title: "returns fainted: true when HP reaches 0", suite: "prior", disposition: "correct: residual occurs after each action, use real Toxic counter/order", file: "battle_residual.test.ts", test: "seed overkill heals full BC rather than the one HP actually lost" },
  { line: 342, title: "no drain if not seeded", suite: "prior", disposition: "correct: residual occurs after each action, use real Toxic counter/order", file: "battle_residual.test.ts", test: "other status2 flags do not trigger seed" },
  { line: 353, title: "creates substitute with HP = maxHP/4", suite: "hp", disposition: "mapped: cost is floor(max/4); no simulator +1", file: "battle_effects_hp.test.ts", test: "HP$old/$max cost$cost accepts equality/zero and pins one-byte truncation" },
  { line: 361, title: "fails if substitute already exists", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "already present waits50 first, then HasSubstituteText, without scratch/HP/HUD/animation writes" },
  { line: 367, title: "fails if currentHP <= cost", suite: "hp", disposition: "invented for equality fixture: cost=HP succeeds and leaves 0 HP", file: "battle_effects_hp.test.ts", test: "HP$old/$max cost$cost accepts equality/zero and pins one-byte truncation" },
  { line: 374, title: "exactly at cost also fails (not strictly greater)", suite: "hp", disposition: "invented: exact-cost Substitute succeeds", file: "battle_effects_hp.test.ts", test: "HP$old/$max cost$cost accepts equality/zero and pins one-byte truncation" },
  { line: 383, title: "resets stat stages for both Pokemon", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "Haze full WRAM map: eight mods/stats each, target cure/selection, four Disable cells, exact masks and every untouched byte" },
  { line: 395, title: "restores original stats for both", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "Haze full WRAM map: eight mods/stats each, target cure/selection, four Disable cells, exact masks and every untouched byte" },
  { line: 403, title: "clears DEFENDER status only (Gen 1 bug)", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "Haze removes both numeric penalties without curing the user status or reapplying penalties/badges" },
  { line: 411, title: "clears volatiles for both", suite: "stats", disposition: "correct: preserve Substitute; only listed volatile bits clear", file: "battle_effects_stats_volatile.test.ts", test: "Haze full WRAM map: eight mods/stats each, target cure/selection, four Disable cells, exact masks and every untouched byte" },
  { line: 430, title: "Grass-type defender is immune", suite: "status", disposition: "mapped: include HIT before type/seed gate", file: "battle_effects_status.test.ts", test: "Leech Seed %s failure calls HIT first and waits 50" },
  { line: 437, title: "already seeded fails", suite: "status", disposition: "mapped: include HIT before type/seed gate", file: "battle_effects_status.test.ts", test: "Leech Seed %s failure calls HIT first and waits 50" },
  { line: 444, title: "successfully seeds non-Grass defender", suite: "status", disposition: "mapped: include HIT before type/seed gate", file: "battle_effects_status.test.ts", test: "Leech Seed passes Substitute, sets SEEDED before its type-zero current animation and prints WasSeededText" },
  { line: 454, title: "Reflect sets reflect=true", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "success ignores target already-set=%s, touches only user bit, before type0 animation" },
  { line: 460, title: "Reflect fails if already active", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "already-set failure is unconditional with MoveDidntMiss%i and its exact wait; no animation/write" },
  { line: 466, title: "Light Screen sets lightScreen=true", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "success ignores target already-set=%s, touches only user bit, before type0 animation" },
  { line: 472, title: "Light Screen fails if already active", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "already-set failure is unconditional with MoveDidntMiss%i and its exact wait; no animation/write" },
  { line: 480, title: "sets mist=true", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "success ignores target already-set=%s, touches only user bit, before type0 animation" },
  { line: 486, title: "fails if already active", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "already-set failure is unconditional with MoveDidntMiss%i and its exact wait; no animation/write" },
  { line: 494, title: "sets focusEnergy=true", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "success ignores target already-set=%s, touches only user bit, before type0 animation" },
  { line: 500, title: "fails if already active", suite: "stats", disposition: "mapped", file: "battle_effects_stats_volatile.test.ts", test: "already-set failure is unconditional with MoveDidntMiss%i and its exact wait; no animation/write" },
  { line: 508, title: "substitute blocks confusion", suite: "status", disposition: "mapped: include HIT and byte-masked duration", file: "battle_effects_status.test.ts", test: "primary confusion checks Substitute before HIT" },
  { line: 515, title: "already confused fails", suite: "status", disposition: "mapped: include HIT and byte-masked duration", file: "battle_effects_status.test.ts", test: "already-confused primary waits 50 and conditionally prints (MoveDidntMiss=%i)" },
  { line: 522, title: "sets confusion to 2-5 turns", suite: "status", disposition: "mapped: include HIT and byte-masked duration", file: "battle_effects_status.test.ts", test: "primary confusion sets its bit before duration draw %i and animates" },
  { line: 533, title: "heals to full HP and sets sleep for 2 turns", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "Rest previous status%i waits first, writes2, prints before HP/bar changes, preserves toxic/penalties/roster" },
  { line: 541, title: "restores stats from originalStats (clears burn/par mods)", suite: "hp", disposition: "invented: Rest never restores Attack/Speed penalties", file: "battle_effects_hp.test.ts", test: "Rest previous status%i waits first, writes2, prints before HP/bar changes, preserves toxic/penalties/roster" },
  { line: 552, title: "fails at full HP", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "Rest at full HP fails before sleep or its text" },
  { line: 560, title: "heals 50% maxHP", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "move$move HP$old/$max ->$next uses half max, type0 refresh, real bar then HUDs" },
  { line: 566, title: "caps at maxHP", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "move$move HP$old/$max ->$next uses half max, type0 refresh, real bar then HUDs" },
  { line: 572, title: "fails at full HP", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "carry test HP$old/$max fails with wait50 then unconditional printer, no writes" },
  { line: 581, title: "copies stats, moves, types, stat stages", suite: "hp", disposition: "mapped: add DVs, eight mods, zero slots and PP", file: "battle_effects_hp.test.ts", test: "%s" },
  { line: 601, title: "fails if defender is invulnerable", suite: "hp", disposition: "invented: target invulnerability ignored; player tests its own status1", file: "battle_effects_hp.test.ts", test: "player turn ignores the target INVULNERABLE bit" },
  { line: 610, title: "copies defender types", suite: "hp", disposition: "mapped: write live type bytes", file: "battle_effects_hp.test.ts", test: "copies two target type bytes, then the current-move animation" },
  { line: 620, title: "copies random opponent move", suite: "hp", disposition: "correct: non-link player chooses via menu; link/enemy random by slot", file: "battle_effects_hp.test.ts", test: "Mimic menu writes the saved slot after Down then A" },
  { line: 634, title: "fails if defender has no moves", suite: "hp", disposition: "invented: no all-zero-moves friendly failure; random path can loop", file: "battle_effects_hp.test.ts", test: "Mimic side %i throws before a draw when every target move is zero" },
  { line: 641, title: "fails if attacker has no MIMIC move", suite: "hp", disposition: "invented: no requirement to own a Mimic-named move", file: "battle_effects_hp.test.ts", test: "Mimic menu writes the saved slot after Down then A" },
  { line: 650, title: "disables random move with PP>0", suite: "hp", disposition: "correct: non-link enemy target ignores PP; selected PP byte is raw", file: "battle_effects_hp.test.ts", test: "non-link Disable ignores PP, rejects empty slots, and packs the accepted slot" },
  { line: 665, title: "fails if already disabled", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "Disable side %i spends the hit draw when the target is already disabled" },
  { line: 674, title: "fails if substitute blocks", suite: "hp", disposition: "invented: Disable passes Substitute", file: "battle_effects_hp.test.ts", test: "retire-L674: fails if substitute blocks — reject legacy rule" },
  { line: 681, title: "fails if no moves have PP", suite: "hp", disposition: "correct: PP exhaustion fails only on enemy turn/player link", file: "battle_effects_hp.test.ts", test: "masked-OR zero fails after one accepted draw and does not draw a duration" },
  { line: 692, title: "returns a valid move name", suite: "prior", disposition: "mapped: byte rejection sampler", file: "battle_execute.test.ts", test: "Metronome animates before rejected draws then reloads; called move starts at charge check" },
  { line: 701, title: "returns opponent lastMoveUsed", suite: "prior", disposition: "mapped", file: "battle_execute.test.ts", test: "Mirror success re-enters charge check, repeats text, and compensates original-slot PP" },
  { line: 706, title: "returns null if no last move", suite: "prior", disposition: "mapped", file: "battle_execute.test.ts", test: "Mirror Move failure writes opposing UsedMove%i into selected and exits Done" },
  { line: 711, title: "returns null if last move was MIRROR_MOVE", suite: "prior", disposition: "mapped", file: "battle_execute.test.ts", test: "Mirror Move failure writes opposing UsedMove%i into selected and exits Done" },
  { line: 718, title: "returns \"No effect!\" message", suite: "hp", disposition: "mapped: NoEffectText program", file: "battle_effects_hp.test.ts", test: "Splash prints No effect" },
  { line: 725, title: "trainer battle: fails", suite: "turns", disposition: "mapped", file: "battle_effects_turns.test.ts", test: "trainer/non-wild state%i Roar waits50 then IsUnaffected, never HIT/RNG or state changes" },
  { line: 732, title: "wild battle, player: ends battle with \"Got away safely!\"", suite: "turns", disposition: "invented text/unconditional rule: wild can fail; Teleport uses RanFromBattleText", file: "battle_effects_turns.test.ts", test: "wild lower-level move%i accepted9 fails after rejected draws, unconditional Teleport failure both sides" },
  { line: 740, title: "wild battle, enemy: ends battle with flee message", suite: "turns", disposition: "correct: level check/rejection sample, not automatic wild success", file: "battle_effects_turns.test.ts", test: "wild lower-level move%i records rejected255 and61; accepted10 equals target>>2 and succeeds" },
  { line: 749, title: "slower attacker misses", suite: "turns", disposition: "mapped", file: "battle_effects_turns.test.ts", test: "OHKO live speed %i versus%i preserves full-word borrow/tie and slow FF sentinel" },
  { line: 756, title: "faster attacker: damage=65535, defender HP=0", suite: "turns", disposition: "correct: OHKO handler sets damage/flag; caller applies HP", file: "battle_effects_turns.test.ts", test: "OHKO live speed %i versus%i preserves full-word borrow/tie and slow FF sentinel" },
  { line: 766, title: "damage = 50% current HP", suite: "prior", disposition: "mapped: ApplyAttack computes half-HP damage then applies it", file: "battle_apply.test.ts", test: "Super Fang current HP %i yields actual damage %i independently of power and max HP" },
  { line: 772, title: "minimum damage is 1", suite: "prior", disposition: "mapped: ApplyAttack computes half-HP damage then applies it", file: "battle_apply.test.ts", test: "Super Fang current HP %i yields actual damage %i independently of power and max HP" },
  { line: 780, title: "creates bide with 2-3 turns", suite: "turns", disposition: "mapped", file: "battle_effects_turns.test.ts", test: "Bide R%i sets flag, clears both effects and both accumulator bytes before the roll" },
  { line: 789, title: "fails if already in bide", suite: "turns", disposition: "invented: Bide setter has no already-active failure gate", file: "battle_effects_turns.test.ts", test: "retire-L789: fails if already in bide — reject legacy rule" },
  { line: 797, title: "returns 2x lastDamageReceived for Normal/Fighting moves", suite: "prior", disposition: "correct: shared wDamage and move data, not per-mon lastDamageReceived", file: "battle_hit.test.ts", test: "Counter shared damage %i doubles/saturates %i, then the named hit draw" },
  { line: 808, title: "fails if no last move", suite: "prior", disposition: "correct: shared wDamage and move data, not per-mon lastDamageReceived", file: "battle_hit.test.ts", test: "Counter early rejection %s keeps shared cached fields/damage" },
  { line: 815, title: "fails if last move type not NORMAL or FIGHTING", suite: "prior", disposition: "correct: shared wDamage and move data, not per-mon lastDamageReceived", file: "battle_hit.test.ts", test: "Counter early rejection %s keeps shared cached fields/damage" },
  { line: 822, title: "fails if lastDamageReceived is 0", suite: "prior", disposition: "correct: shared wDamage and move data, not per-mon lastDamageReceived", file: "battle_hit.test.ts", test: "Counter early rejection %s keeps shared cached fields/damage" },
  { line: 834, title: "sets recharging=true if defender survived", suite: "composed", disposition: "mapped: invocation gates are executor work", file: "battle_effects_turns.test.ts", test: "id%i sets only user flag%i even when already set" },
  { line: 841, title: "Gen 1 bug: no recharge if KO", suite: "composed", disposition: "mapped: invocation gates are executor work", file: "battle_execute.test.ts", test: "ordinary KO skips Done, Rage and any final side effect, preserving action byte" },
  { line: 850, title: "25% recoil for normal recoil moves", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "damage$damage move$move HP$old ->$next leaves Damage/rosters/HUDs alone" },
  { line: 857, title: "50% recoil for STRUGGLE", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "damage$damage move$move HP$old ->$next leaves Damage/rosters/HUDs alone" },
  { line: 864, title: "minimum recoil is 1", suite: "hp", disposition: "mapped", file: "battle_effects_hp.test.ts", test: "damage$damage move$move HP$old ->$next leaves Damage/rosters/HUDs alone" },
  { line: 870, title: "no recoil if damage=0", suite: "hp", disposition: "invented raw-handler behavior: zero damage recoil becomes 1 if invoked", file: "battle_effects_hp.test.ts", test: "damage$damage move$move HP$old ->$next leaves Damage/rosters/HUDs alone" },
  { line: 879, title: "heals 50% of damage dealt (min 1)", suite: "hp", disposition: "mapped: mutate wDamage and use HP/HUD Programs", file: "battle_effects_hp.test.ts", test: "damage$damage HP$old/$max ->$next leaves halved wDamage and syncs player after both real HUDs" },
  { line: 887, title: "capped at maxHP", suite: "hp", disposition: "mapped: mutate wDamage and use HP/HUD Programs", file: "battle_effects_hp.test.ts", test: "damage$damage HP$old/$max ->$next leaves halved wDamage and syncs player after both real HUDs" },
  { line: 894, title: "Dream Eater message differs", suite: "hp", disposition: "mapped: mutate wDamage and use HP/HUD Programs", file: "battle_effects_hp.test.ts", test: "Dream Eater is selected from the live effect after HUDs (changed=%s)" },
  { line: 903, title: "sets attacker currentHp=0, selfFaint=true", suite: "turns", disposition: "mapped: zero HP/status and clear Seed", file: "battle_effects_turns.test.ts", test: "Explode clears only user HP/status/SEEDED, preserving the intervening byte and roster" },
  { line: 912, title: "accumulates level*2 money", suite: "turns", disposition: "mapped: byte double plus three-byte BCD alias", file: "battle_effects_turns.test.ts", test: "Pay Day level%i doubles with eight-bit wrap and preserves every other byte/alias" },
  { line: 921, title: "returns 2 for rolls 0-2", suite: "turns", disposition: "correct: conditional second byte draw, not one uniform 0..7 roll", file: "battle_effects_turns.test.ts", test: "multi-hit samples $draws takes the second byte only when first masked value>=2" },
  { line: 929, title: "returns 3 for rolls 3-5", suite: "turns", disposition: "correct: conditional second byte draw, not one uniform 0..7 roll", file: "battle_effects_turns.test.ts", test: "multi-hit samples $draws takes the second byte only when first masked value>=2" },
  { line: 934, title: "returns 4 for roll 6", suite: "turns", disposition: "correct: conditional second byte draw, not one uniform 0..7 roll", file: "battle_effects_turns.test.ts", test: "multi-hit samples $draws takes the second byte only when first masked value>=2" },
  { line: 939, title: "returns 5 for roll 7", suite: "turns", disposition: "correct: conditional second byte draw, not one uniform 0..7 roll", file: "battle_effects_turns.test.ts", test: "multi-hit samples $draws takes the second byte only when first masked value>=2" },
  { line: 946, title: "rageStart sets rage=true", suite: "composed", disposition: "mapped: direct stat-up and its penalty bugs", file: "battle_effects_turns.test.ts", test: "id%i sets only user flag%i even when already set" },
  { line: 952, title: "rageHit increments attack stage by 1", suite: "composed", disposition: "mapped: direct stat-up and its penalty bugs", file: "battle_effects_stats.test.ts", test: "Rage uses the real direct stat-up with flipped turn, zero move, Rose, badges and original-attacker penalties" },
  { line: 959, title: "rageHit caps at +6", suite: "composed", disposition: "mapped: direct stat-up and its penalty bugs", file: "battle_effects_stats.test.ts", test: "Rage gate max=%s returns before flip/stat-up/text" },
  { line: 969, title: "rageHit returns null if not in rage", suite: "composed", disposition: "mapped: direct stat-up and its penalty bugs", file: "battle_effects_stats.test.ts", test: "Rage gate max=%s returns before flip/stat-up/text" },
  { line: 976, title: "sets thrashing to 2-3 turns", suite: "turns", disposition: "mapped: (R&1)+2", file: "battle_effects_turns.test.ts", test: "Thrash even masked byte stores duration2" },
  { line: 985, title: "sets binding on both attacker and defender", suite: "turns", disposition: "invented target counter: only user trapping state written", file: "battle_effects_turns.test.ts", test: "Trapping samples $draws clears target recharge before roll and stores1-4 on user only" },
  { line: 996, title: "sets charging and skipDamage", suite: "turns", disposition: "mapped: flags, animation type/ID and text_asm suffix", file: "battle_effects_turns.test.ts", test: "effect$id move$move has correct animation, invulnerability and suffix $suffix" },
  { line: 1004, title: "FLY sets invulnerable=true", suite: "turns", disposition: "mapped: flags, animation type/ID and text_asm suffix", file: "battle_effects_turns.test.ts", test: "effect$id move$move has correct animation, invulnerability and suffix $suffix" },
  { line: 1011, title: "DIG sets invulnerable=true", suite: "turns", disposition: "mapped: flags, animation type/ID and text_asm suffix", file: "battle_effects_turns.test.ts", test: "effect$id move$move has correct animation, invulnerability and suffix $suffix" },
  { line: 1017, title: "non-Fly/Dig do NOT set invulnerable", suite: "turns", disposition: "mapped: flags, animation type/ID and text_asm suffix", file: "battle_effects_turns.test.ts", test: "effect$id move$move has correct animation, invulnerability and suffix $suffix" },
  { line: 1023, title: "correct messages per move", suite: "turns", disposition: "mapped: flags, animation type/ID and text_asm suffix", file: "battle_effects_turns.test.ts", test: "effect$id move$move has correct animation, invulnerability and suffix $suffix" },
  { line: 1045, title: "only triggers if attacker moved first", suite: "status", disposition: "invented handler gate: no moved-first check; next selection clears late flinch", file: "battle_effects_status.test.ts", test: "retire-L1045: only triggers if attacker moved first — reject legacy rule" },
  { line: 1053, title: "substitute blocks flinch", suite: "status", disposition: "mapped: byte thresholds 26/77", file: "battle_effects_status.test.ts", test: "Substitute blocks flinch before link recharge clearing and any roll" },
  { line: 1060, title: "10% chance for FLINCH_SIDE_EFFECT1", suite: "status", disposition: "mapped: byte thresholds 26/77", file: "battle_effects_status.test.ts", test: "link%i success=%s clears recharge at the correct point" },
  { line: 1067, title: "30% chance for FLINCH_SIDE_EFFECT2", suite: "status", disposition: "mapped: byte thresholds 26/77", file: "battle_effects_status.test.ts", test: "link%i success=%s clears recharge at the correct point" },
  { line: 1074, title: "does not flinch when random exceeds threshold", suite: "status", disposition: "mapped: byte thresholds 26/77", file: "battle_effects_status.test.ts", test: "link%i success=%s clears recharge at the correct point" },
  { line: 1083, title: "substitute blocks", suite: "status", disposition: "invented: secondary confusion passes Substitute", file: "battle_effects_status.test.ts", test: "secondary confusion R24 passes Substitute and invulnerability without HIT, rolls duration and does not animate" },
  { line: 1090, title: "already confused: no effect", suite: "status", disposition: "mapped: threshold 25, duration (R&3)+2", file: "battle_effects_status.test.ts", test: "already-confused secondary rolls chance but not duration and stays silent" },
  { line: 1097, title: "10% chance applies confusion", suite: "status", disposition: "mapped: threshold 25, duration (R&3)+2", file: "battle_effects_status.test.ts", test: "secondary confusion R24 passes Substitute and invulnerability without HIT, rolls duration and does not animate" },
  { line: 1108, title: "deals 1 HP crash damage", suite: "prior", disposition: "mapped: checked crash application, not effect-table dispatch", file: "battle_apply.test.ts", test: "Jump Kick shared damage %i -> crash %i on own HP after text/shake" },
  { line: 1118, title: "absorbs damage and reduces substitute HP", suite: "prior", disposition: "correct: exact-zero doll HP remains active until borrow; preserve damage text/effect flow", file: "battle_apply.test.ts", test: "Substitute HP %i damage %i -> byte%i survives%s, damage never capped" },
  { line: 1126, title: "breaks substitute when HP <= 0", suite: "prior", disposition: "correct: exact-zero doll HP remains active until borrow; preserve damage text/effect flow", file: "battle_apply.test.ts", test: "Substitute HP %i damage %i -> byte%i survives%s, damage never capped" },
  { line: 1135, title: "no substitute: absorbed=false", suite: "prior", disposition: "correct: exact-zero doll HP remains active until borrow; preserve damage text/effect flow", file: "battle_apply.test.ts", test: "ordinary hit applies first, animates correct HP bar then draws both live HUDs" },
  { line: 1141, title: "0 damage: absorbed=false", suite: "prior", disposition: "correct: use raw byte application and borrower semantics, no abstract early return", file: "battle_apply.test.ts", test: "damage 0 bypasses a Substitute and leaves all scratch words untouched, drawing HUDs only" },
  { line: 1149, title: "blocks stat-lowering when mist active", suite: "prior", disposition: "correct: primary down only through HIT, not all side-effect drops", file: "battle_hit.test.ts", test: "Mist allows outside effect $%i; X Accuracy changes no bytes" },
  { line: 1155, title: "does NOT block stat-raising", suite: "prior", disposition: "correct: primary down only through HIT, not all side-effect drops", file: "battle_hit.test.ts", test: "Mist allows outside effect $%i; X Accuracy changes no bytes" },
  { line: 1160, title: "does NOT block when mist is false", suite: "prior", disposition: "correct: primary down only through HIT, not all side-effect drops", file: "battle_hit.test.ts", test: "range effect $%i is allowed without target Mist" },
  { line: 1167, title: "returns species types when no conversion", suite: "hp", disposition: "correct: live two type bytes, not partial overlay/fallback", file: "battle_effects_hp.test.ts", test: "target INVULNERABLE fails with no copy and no animation" },
  { line: 1174, title: "returns converted types when set", suite: "hp", disposition: "correct: live two type bytes, not partial overlay/fallback", file: "battle_effects_hp.test.ts", test: "copies two target type bytes, then the current-move animation" },
  { line: 1184, title: "partial conversion: only one type overridden", suite: "hp", disposition: "invented representation: no partial one-type overlay; both live bytes copied", file: "battle_effects_hp.test.ts", test: "retire-L1184: partial conversion: only one type overridden — reject legacy rule" },
];

/** The five A5c3c family files. A prior row's file is none of these. */
const FAMILY = new Set([
  'battle_effects_status.test.ts',
  'battle_effects_stats.test.ts',
  'battle_effects_stats_volatile.test.ts',
  'battle_effects_turns.test.ts',
  'battle_effects_hp.test.ts',
]);

/** A retire-L case lives in the suite its row names. Stats accepts either stats file. */
const SUITE_FILES: Record<Exclude<RetirementRow['suite'], 'prior'>, readonly string[]> = {
  dispatch: ['battle_effects.test.ts'],
  status: ['battle_effects_status.test.ts'],
  stats: ['battle_effects_stats.test.ts', 'battle_effects_stats_volatile.test.ts'],
  turns: ['battle_effects_turns.test.ts'],
  hp: ['battle_effects_hp.test.ts'],
  composed: ['battle_effects_composed.test.ts'],
};

const EXPECTED = { prior: 52, dispatch: 4, status: 14, stats: 12, turns: 20, hp: 31, composed: 6 } as const;

function calleeName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) return expr.expression.text + '.' + expr.name.text;
  if (ts.isCallExpression(expr)) {
    const inner = calleeName(expr.expression);
    return inner === null ? null : inner + '()';
  }
  return null;
}

function sourceFile(file: string): ts.SourceFile {
  const path = resolve(__dirname, file);
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}

interface CallInfo { line: number; callee: string; title: string | null }

/** Direct `it(` / `test(`, plus `it.each(...)(title)`. A template title (`${...}`) is recorded as null. */
function callInfos(sf: ts.SourceFile): CallInfo[] {
  const out: CallInfo[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node.expression);
      if (callee === 'it' || callee === 'test' || callee === 'it.each()' || callee === 'test.each()') {
        const arg = node.arguments[0];
        const title = arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) ? arg.text : null;
        out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, callee, title });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

it('the old effects suite matches the 139-row manifest', () => {
  const calls = callInfos(sourceFile('effects.test.ts'));
  expect(calls.filter(call => call.callee === 'test' || call.callee === 'test.each()')).toEqual([]);
  const its = calls.filter(call => call.callee === 'it');
  expect(its.every(call => call.title !== null)).toBe(true);
  const got = its.map(call => ({ line: call.line, title: call.title }));
  expect(new Set(got.map(row => row.line + '\0' + row.title)).size).toBe(139);
  expect(got).toEqual(ROWS.map(row => ({ line: row.line, title: row.title })));
});

it('every replacement title is a unique plain it in its file', () => {
  const plain = new Map<string, string[]>();
  function titles(file: string): string[] {
    const cached = plain.get(file);
    if (cached) return cached;
    const found = callInfos(sourceFile(file))
      .filter(call => (call.callee === 'it' || call.callee === 'it.each()') && call.title !== null)
      .map(call => call.title as string);
    plain.set(file, found);
    return found;
  }
  const problems: string[] = [];
  for (const row of ROWS) {
    const base = row.file.split(/[/\\]/).pop() ?? row.file;
    const hits = titles(row.file).filter(title => title === row.test).length;
    if (hits !== 1) problems.push('L' + row.line + ' ' + row.file + ' has ' + hits + ' plain its titled ' + JSON.stringify(row.test));
    if (row.suite === 'prior' && FAMILY.has(base)) problems.push('L' + row.line + ' prior file is a family test: ' + base);
    if (row.test.startsWith('retire-L')) {
      const allowed = SUITE_FILES[row.suite as Exclude<RetirementRow['suite'], 'prior'>];
      if (!allowed || !allowed.includes(base)) problems.push('L' + row.line + ' retire-L file ' + base + ' is not suite ' + row.suite);
    }
  }
  expect(problems).toEqual([]);
});

it('dispositions tally by suite to the section 9.6 breakdown', () => {
  const tally: Record<string, number> = {};
  for (const row of ROWS) tally[row.suite] = (tally[row.suite] ?? 0) + 1;
  expect(ROWS).toHaveLength(139);
  expect(tally).toEqual(EXPECTED);
});
