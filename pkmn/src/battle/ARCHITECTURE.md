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
`trainer_intro -> choose_action -> ... (same as above) -> [forced_switch -> switching_in] -> ... -> gain_exp -> trainer_end -> end`
(a loss: `defeat -> trainer_end -> [blackout] -> end`)

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
- `trainer_end` — runs a `trainer_flow.ts` step list: texts, the trainer pic scrolling back in, delays (V1c)

## Turn Order

Compare Speed (Quick Attack has priority). Both sides attack per turn unless one faints.

## Badge Stat Boosts (Gen 1)

`applyBadgeStatBoosts()` in `damage.ts` multiplies player stats by 1.125x per badge (Boulder→Atk, Thunder→Def, Soul→Spd, Volcano→Spc). Applied at: battle init, switch-in, level-up, and after any stat stage change (Gen 1 bug: reapplies ALL badge boosts, not just the changed stat). Badges passed from `main.ts` into `Battle` constructor.

## 1/256 Miss Glitch

Gen 1 accuracy always runs the RNG check — even 100% accuracy moves go through `floor(random*256) >= threshold` where threshold=255, giving a 1/256 miss chance. No moves are exempt (Swift uses `skipAccuracy` which bypasses the check entirely).

## Focus Energy Bug

Focus Energy divides the crit rate by 4 instead of multiplying it (`srl` instead of `sla`; `damage.ts`).

## Faint

`SlideDownFaintedMonPic`: the fainted mon's pic slides down 7 rows (`PIC_HEIGHT`), 2 frames a row; the HUD clears after.

## Move Learning Flow

When a Pokemon levels up with a full moveset (4 moves), the move waits in `pendingMoves` and the battle enters an interactive flow: `learn_move_prompt` (yes/no: delete a move?) → `learn_move_select` (pick move to forget) → `learn_move_confirm` (abandon learning?). Uses `forceLearnMove()` in `experience.ts` to replace a specific slot. Text from `data/text/text_7.asm`; B / NO loops back to the full TryingToLearn text.

## Evolution

Post-battle evolution is handled by `evolution.ts`. `checkEvolutions()` finds level-based candidates (item evolutions are skipped post-battle, naturally excluding Pikachu). `applyEvolution()` changes species, recalculates stats, preserves HP delta, auto-renames if nickname matched old species, and updates the Pokédex. The `'evolution'` game state in `main.ts` handles the animation (the 8-cycle accelerating sprite alternation of `engine/movie/evolution.asm`) and B-button cancel.

## Whiteout/Blackout

When all party Pokemon faint: the `SET_PAL_BATTLE_BLACK` filter, "out of useable POKéMON!" / "blacked out!", money halved, party fully healed. `handleBlackoutWarp()` in `main.ts` warps to the last Pokécenter door and steps the player out below it. The destination is `lastBlackoutWarp` (saved; default PalletTown, updated on Pokecenter heal via the `onPokecenterHeal` callback).

## Trainer Battles

No catching/running. Trainer AI uses 3 modifier functions per class. Money = baseMoney x last enemy level.

**Two ways in** (`home/trainers.asm`): talking to an unbeaten trainer (V1c), or its sight
(A1c: the map script, "!", the walk-up; `src/overworld/ARCHITECTURE.md` → *Trainer sight*).
Both end in `engageTrainer` → the before-battle text → `startTrainerBattle`.
Since A5a the map text uses DisplayTextID / nested PrintText; talk meet music runs
when the string returns, then a silent fresh A/B wait and A release precede battle.
Battle text itself awaits A5c. `battleTextPages()` strips the map extractor's
`<PROMPT>` / `<DONE>` and converts cursor tokens to newlines for the old renderer.

**Since V1c the end of a trainer battle follows the ASM** (`trainer_flow.ts`, unit-tested;
`Battle` runs its steps in the `trainer_end` state):
- **Win** (`TrainerBattleVictory`): fanfare → "RED defeated / BUG CATCHER!" → the trainer
  pic scrolls in from the right (`_ScrollTrainerPicAfterBattle`: 6 steps × 4 frames, ending
  at x = 112 with its last column off-screen) → 40 frames → "BUG CATCHER: " + the saved
  end-battle text → "RED got ¥… / for winning!". The end text comes from
  `setupTrainerBattle(..., { endBattleText })`; without one only that step is skipped.
- **The fanfare waits for the whole party.** `onVictory` fires at the faint only in wild
  battles (`FaintEnemyPokemon .wild_win`); a trainer's plays at the start of the win
  sequence (`victoryMusicFor`: `defeatedgymleader` for gym leaders and RIVAL3).
- **Loss** (`HandlePlayerBlackOut`): the blackout text only — the trainer's saved lose text
  is never printed. Against RIVAL1 the enemy side is cleared, his pic scrolls in, 40
  frames, `_Rival1WinText`; in Oak's Lab there's no blackout (`playerLost` instead of
  `isBlackout`), elsewhere the blackout follows.
- **Trainer pics load by class key** (`trainerPicName('BUG_CATCHER')` → `bugcatcher`), not
  by display name: "BUG CATCHER" has no file, and before V1c that hung the game on the
  battle's first frame for 11 classes.

## Catch demo (V1d)

`BATTLE_TYPE_OLD_MAN` (the Viridian old man) and `BATTLE_TYPE_PIKACHU` (Oak's catch in Pallet
Town) are one demo, run beside `Battle` rather than inside it (DECISIONS #32): `Battle`
assumes a player Pokémon, and Oak's catch has an empty party. Detail and ASM sources:
`notes/05-v1d-plan.md`.

- `catch_demo.ts` — the rules as tested data: `catchDemoCaught` (PIKACHU always; OLD_MAN
  unless `INITIAL_CATCH_TRAINING` is set, `ItemUseBall`), `catchDemoBackPic`
  (`oldmanb` / `prof.oakb`), `CATCH_DEMO_BAG` (one POKé BALL), `tossBallAnims` (4 or 6),
  and `catchDemoSteps`: "Wild X appeared!" (A) → HUD + 40 frames → ▶ FIGHT 20 → ▶ ITEM
  20 + 10 frozen → bag 3 → ▶ POKé BALL 20 → "OLD MAN used / POKé BALL!" 20 → the toss
  animations → the result text (A).
- `catch_demo_screen.ts` — upstream's `pikachu/pikachu_battle.ts`, moved and generalized:
  loads the enemy by dex with its own palette and the back pic by battle type, keeps
  upstream's slide-in and toss/poof/shake drawing (their exact ASM timings are A5 / later),
  and walks the steps.
- A script starts it with `{ type: 'catchDemo', battleType, species, level }` (what the ASM
  scripts set). `main.ts` marks the enemy seen (`LoadEnemyMonData`), plays wildbattle, runs
  the wild transition, then the `catch_demo` state; at the end: instant white, fade in, the
  script resumes. No ball is used, nothing joins the party, no evolution or mood update
  (`wBattleResult = 2`).

## Battle Transitions

- Trainer = clockwise spiral of black tiles — only scripted battles (Oak's Lab rival) use
  it; map-trainer battles cut straight in until A5
- Wild = 3 white flashes + horizontal stripes
- The ASM picks one of 8 transitions (trainer / stronger enemy / dungeon map); A5
  implements them (DECISIONS #31, `notes/04-v1c-plan.md` §1.6)

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
| `trainer_flow.ts` | 164 | V1c: meet/victory music choice, end-text pages, win/loss step lists, pic scroll, trainer pic names |
| `catch.ts` | 105 | Catch rate formula |
| `catch_demo.ts` | 111 | V1d: the catch demo's rules and step list (old man + Oak's Pikachu) |
| `catch_demo_screen.ts` | 626 | V1d: runs and draws the catch demo (was `pikachu/pikachu_battle.ts`) |
| `evolution.ts` | 94 | Post-battle evolution check & apply |
| `volatiles.ts` | 77 | Substitute, confusion, etc. |
| `run.ts` | 57 | Wild battle escape logic (Gen 1 TryRunningFromBattle) |
| `encounter.ts` | 45 | Wild encounter selection |
