# Battle System Architecture

## Data Files

- `pokemon.json` (151 species), `moves.json` (165 moves), `type_chart.json`, `trainers.json` (47 classes, 396 parties), `wild/*.json`

## Stat Calculation (Gen 1)

- HP = `floor(((base+DV)*2*level)/100) + level + 10`
- Other stats = `floor(((base+DV)*2*level)/100) + 5`

## Damage Formula

`floor(((2*level/5+2)*power*atk/def)/50+2)` x STAB(1.5) x type effectiveness x random(217-255)/255

## Type Split

Types 0x00-0x08 are Physical (use Attack/Defense), types 0x14+ are Special (use Special/Special).

## Encounter Flow

After each step, check `isGrassTile()` -> random vs grassRate -> select slot -> create wild Pokemon -> start battle.

## Battle States

Wild battle flow:
`intro -> choose_action -> choose_move -> execute_turn -> player_move/enemy_move -> check_faint -> victory/defeat -> gain_exp -> [learn_move_prompt -> learn_move_select -> learn_move_confirm] -> end`

Trainer battle flow:
`trainer_intro -> choose_action -> ... (same as above) -> [forced_switch -> switching_in] -> ... -> end`

Additional states:
- `choose_item` — bag menu open to select an item
- `throw_ball` — pokeball throw animation/text (wild battles only)
- `choose_pokemon` — party menu for voluntary switch
- `forced_switch` — party menu after player mon fainted (no cancel)
- `switching_out` — "Come back, X!" text phase
- `switching_in` — "Go! X!" text phase
- `run_away` — "Got away safely!" (wild battles only)
- `run_failed` — failed to escape, enemy gets a free turn
- `blackout` — "X is out of useable POKéMON!" / "X blacked out!" when entire party faints

## Turn Order

Compare Speed (Quick Attack has priority). Both sides attack per turn unless one faints.

## Badge Stat Boosts (Gen 1)

`applyBadgeStatBoosts()` in `damage.ts` multiplies player stats by 1.125x per badge (Boulder→Atk, Thunder→Def, Soul→Spd, Volcano→Spc). Applied at: battle init, switch-in, level-up, and after any stat stage change (Gen 1 bug: reapplies ALL badge boosts, not just the changed stat). Badges passed from `main.ts` into `Battle` constructor.

## 1/256 Miss Glitch

Gen 1 accuracy always runs the RNG check — even 100% accuracy moves go through `floor(random*256) >= threshold` where threshold=255, giving a 1/256 miss chance. No moves are exempt (Swift uses `skipAccuracy` which bypasses the check entirely).

## Move Learning Flow

When a Pokemon levels up with a full moveset (4 moves), the battle enters an interactive flow: `learn_move_prompt` (yes/no: delete a move?) → `learn_move_select` (pick move to forget) → `learn_move_confirm` (abandon learning?). Uses `forceLearnMove()` in `experience.ts` to replace a specific slot.

## Evolution

Post-battle evolution is handled by `evolution.ts`. `checkEvolutions()` finds level-based candidates (item evolutions are skipped post-battle, naturally excluding Pikachu). `applyEvolution()` changes species, recalculates stats, preserves HP delta, auto-renames if nickname matched old species. The `'evolution'` game state in `main.ts` handles the animation (sprite alternation) and B-button cancel.

## Whiteout/Blackout

When all party Pokemon faint: money halved, party fully healed, warp to `lastBlackoutMap` (default: PalletTown, updated on Pokecenter heal via `onPokecenterHeal` callback). Positions defined in `BLACKOUT_POSITIONS` in `main.ts`.

## Trainer Battles

No catching/running. Trainer AI uses 3 modifier functions per class. Money = baseMoney x last enemy level.

## Battle Transitions

- Trainer = clockwise spiral of black tiles
- Wild = 3 white flashes + horizontal stripes

## Wild Intro Phases

`slide_in` (wild from LEFT, Red from RIGHT) -> `colorize` -> `appeared_text` -> `send_player` (Red slides LEFT off) -> `send_pokemon` (Pokemon slides in from LEFT, only after Red gone) -> `go_text`

## Trainer Intro Phases

`slide_in` -> `colorize` -> `pokeballs_text` -> `send_enemy` -> `send_enemy_text` -> `send_player` -> `send_player_text`

## Silhouettes

Canvas `source-atop` compositing for all-black sprite versions, `globalAlpha` for colorize blend.

## Player Trainer Sprite

`loadPlayerTrainerSprite()` loads Red's backsprite (`/gfx/player/redb.png`) for wild intros.

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `battle.ts` | 2333 | Main battle state machine |
| `battle_ui.ts` | 822 | HUD, action menu, trainer intros |
| `effects.ts` | 1051 | Move effects (stat changes, screens, leech seed, etc.) |
| `damage.ts` | 328 | Damage formula, type effectiveness |
| `status.ts` | 250 | Sleep, freeze, burn, paralysis, poison |
| `experience.ts` | 169 | XP gain, leveling |
| `data.ts` | 157 | JSON data loading |
| `types.ts` | 134 | TypeScript interfaces |
| `trainer_ai.ts` | 213 | Trainer move selection |
| `catch.ts` | 105 | Catch rate formula |
| `evolution.ts` | 94 | Post-battle evolution check & apply |
| `volatiles.ts` | 77 | Substitute, confusion, etc. |
| `run.ts` | 57 | Wild battle escape logic (Gen 1 TryRunningFromBattle) |
| `encounter.ts` | 45 | Wild encounter selection |
