# DECISIONS — settled choices and why

Don't relitigate without new information. Add new entries at the bottom, dated.

1. **Base project = `pokemon-yellow-typescript-main`** (2026-07-27). It has the complete engine (battle, menus, audio, save, 375 tests). `pokered.ts-main` was the user's original focus but only has generated map scaffolding — archived. Disassemblies are reference/source data only.
2. **No ROM, ever, at runtime** (2026-07-27). User has no dump handy (original cartridge only). All data generated at build time from `pokeyellow-master`'s readable ASM + pre-decoded PNGs. Hobby project, never distributed — using pret's public disassembly assets locally is fine.
3. **Serve real static files; don't reimplement the fetch-override** (2026-07-27). Engine consumers (`fetchJson`, `loadImage`) already fall back to plain network/file loading. Vite `publicDir` + files at the contract paths = zero interception code.
4. **Keep `src/rom/` in place, unused** (2026-07-27). It's the schema authority and a possible future feature (real cartridge dump → ROM mode). Deleting buys nothing.
5. **12-map parity before world expansion** (2026-07-27). Match the existing demo scope first so "playable, ROM-free" lands early; each further map is an incremental repeat.
6. **Randomizer is cosmetic-only** (2026-07-27). ⚠ *The "per-species, seeded per save" part is **superseded by #22** — the roll is per battle encounter and nothing is persisted. The Gen 2 exclusion below is **amended by #23**. Read #21–#23 first; what survives here is the cosmetic-only guarantee and the chokepoint.* Remap consulted only inside `loadPokemonSprites`; battle logic untouched; pool = `pkmn-sprites/` multi-gen sheets. Party-list category icons intentionally not remapped. Chosen over per-instance `displaySpeciesId` for minimal surface area.

    **Amended 2026-07-30:** User supplied a full individual-sprite tree under
    `pkmn-sprites/pokemonGen{1,2}/` (dex-numbered PNGs, fronts/backs, Gen2 shiny,
    Crystal animated GIFs). **That tree is the preferred randomizer source.**
    Mega-sheets at `pkmn-sprites/*.png` are optional/legacy. Sheet slicing is no
    longer the default P6-1 plan. Layout inventory lives in
    `STATUS.md` Notes.

    **Scope freeze for Yellow recreation (2026-07-30):** Finish authentic
    Pokemon Yellow ROM-free first. Until that ships:
    - Battle art = **static PNG only** (no GIF frame playback — Yellow never had that).
    - **Shinies ignored.** ~~Gen 2 art ignored~~ → **amended by #23**: Gen 2 *art* (gold/silver/crystal, dex 1–151) is now in the pool; Gen 2 *content* (Johto dex, Unown) stays out.
    - Crystal animated GIFs + broader multi-gen randomizer are **post-Yellow /
      possible post-game backlog**, not P6 v1 requirements.
    - Gray monochrome stays out (user deleted). Gen1 individual folders under
      `pkmn-sprites/pokemonGen1/` may feed a later randomizer; they do not block
      Phases 4–5.
7. **Audio deferred to stretch** (2026-07-27). Needs an ASM music-command parser; the engine's `channels[].commands[]` JSON format is already defined, so it's "write a parser" later, not a redesign — and it must not block playability.
8. **Six-file context system at `pkmn/` root** (2026-07-27). CLAUDE.md (rules) + context/{PROJECT,ARCHITECTURE,PLAN,PROGRESS,DECISIONS,CONVENTIONS}.md carry state across sessions. *(Superseded in part by #11 — the live log is now `context/STATUS.md`; renamed by #19.)*
9. **`pokered-master` and `pokered.ts-main` deleted** (2026-07-27). Neither contained logic absent from yellow-ts + pokeyellow-master; both re-downloadable (pret/pokered, mattbruv/pokered.ts). Before deletion, pokered.ts-main's sole asset — the Python map parsers (`blocks.py`/`maps.py`/`map_ts.py`/`setup.py`, verified working `.bst` 16-bytes-per-block and map-header-ASM parsing) — was salvaged to `reference/pokered-ts-map-scripts/` as Phase 3 reference. *⚠ 2026-09-22: that salvage was not carried into this workspace and is gone; `refs/pokeyellow` + the ROM extractors cover the need (#26).*

10. **PSYCHIC: generate the asymmetric type chart** (2026-07-29). *Resolves the open question that blocked Phase 2.*

    Evidence: `damage.ts:getTypeEffectiveness()` compares chart strings with raw `===` — against the move's `type` (which is `PSYCHIC_TYPE`, from `TYPE_NAMES[24]`) on the attacker side, and against the species' `type1`/`type2` (which `pokemon.ts` converts to `PSYCHIC`) on the defender side. Nothing normalizes between them. The ROM extractor writes `PSYCHIC_TYPE` on *both* sides, so **the ROM path itself never applies a matchup where Psychic is the defender** — Bug isn't super-effective against Psychic mons, Psychic doesn't resist Psychic.

    Three options: bug-compatible (`PSYCHIC_TYPE` both sides), `PSYCHIC` both sides (the *worst* option — it fixes defenders but breaks every Psychic attack), and asymmetric. **Chosen: asymmetric** — `attacker: 'PSYCHIC_TYPE'`, `defender: 'PSYCHIC'`, so both sides match.

    **Confirmed empirically 2026-07-29** against the real extracted `type_chart.json`: the chart carries `PSYCHIC_TYPE` on both sides, `moves.json` gives `PSYCHIC_M` type `PSYCHIC_TYPE`, and `pokemon.json` gives Alakazam `type1: PSYCHIC`. Four chart rows are therefore dead in the running game — Bug→Psychic 2×, Fighting→Psychic 0.5×, Psychic→Psychic 0.5×, Ghost→Psychic 0×. This is a fidelity bug introduced by the TypeScript port (the original compares numeric type IDs, where attack and defence share ID 24), not a Gen 1 quirk to preserve.

    Since #14, this is a **post-processing step on extracted output** rather than a generator behavior: patch `extractTypeChart`'s result in the pipeline, never hand-edit `data/`. Keep Ghost→Psychic at 0 — *that* one is the authentic Gen 1 bug. The change makes `type_chart.json` deviate from literal ROM bytes, so the corresponding assertion in `src/rom/__tests__/extraction.test.ts` may need updating alongside it.

    *⚠ 2026-09-22: the implementation (P2-3) was lost with the old copy (#26). The decision stands. The bug was re-confirmed on vanilla upstream the same day, with the same evidence as above. Rebuild in **V5**.*

11. **One file is THE live handoff log** (now `context/STATUS.md`) (2026-07-29). The project is built in small increments by whichever agent is available (Claude, Grok, GPT). One file records live state — current phase, ordered work queue, open questions, session log — and every agent reads it first and updates it last. `context/HISTORY.md` is the archive of older session entries. Rationale: two competing "current state" files guarantee drift, and the failure mode being defended against is an agent starting from scratch while the user pays twice.

12. **Work is decomposed into numbered single-sitting units** (2026-07-29). P2-1 … P7-3 in PLAN.md, mirrored as a claimable queue in the tracker. One unit per session, no batching. Rationale: matches how the user actually funds the project, and makes an interrupted session recoverable by a different agent.

13. **Reuse `MAP_METADATA` rather than re-curating it** (2026-07-29). `src/rom/extractors/maps.ts` already contains hand-curated per-map NPC ids, ROM-index filters, connection ordering and sign ordering that are *not* derivable from the ASM — they encode the demo's specific NPC subset and ordering. Phase 3 lifts that table into shared data the generator consumes instead of rebuilding the curation. Re-deriving it would silently change NPC identity strings that `src/story/` scripts depend on.

14. **The user's own cartridge dump is the build-time data source** (2026-07-29). *This supersedes the ASM-parsing approach and closes O-1 below.* The user dumped their own retail cartridge with a hardware dumper. The file — `game/pokeyellow.gbc`, 1,048,576 bytes, SHA1 `cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1` — matches both `src/rom/rom_offsets.ts` and pret's `roms.sha1` for `Pokemon Yellow (UE) [C][!]`. `npm run setup pokeyellow.gbc` emitted 156 files and brought the test suite from unrunnable to **375/375 passing**, including the 41 extraction ground-truth tests.

    **This does not change what gets shipped.** The ROM is a build-time input; the game still loads plain static JSON + PNG, the upload screen still gets deleted, and playing still requires no ROM. Decision #2's real constraint was "the user has no dump" — that is now false, and #2's runtime guarantee is untouched.

    Kept out of version control by the existing `.gitignore` (`*.gbc`, `*.gb`). Personal use only, consistent with the project's never-distributed status.

15. **ASM generators parked, not deleted** (2026-07-29). `scripts/gen/{asm_source,gen_moves,gen_types}.ts` stay in the tree; PLAN units P2-4 … P2-11 are cancelled. Their only value was independence from a dump, which #14 removes. They become relevant again only if we later want to *modify* game data rather than reproduce it (a romhack-style change is far easier to express as an ASM-source edit than as a binary patch). Reversible: the roadmap for them is preserved in git-less form in PLAN.md's "Parked" section. *⚠ 2026-09-22: `scripts/gen/` and that PLAN section are gone with the old copy (#26). Not rebuilt; if romhack-style data edits are ever wanted, this becomes a new decision.*

16. **Static layout: `static/` is Vite `publicDir`; `data/` stays for vitest** (2026-07-30). Resolves the open questions on publicDir name and dual copies.

    - **`data/`** — JSON only, produced by `npm run setup`. Vitest mock fetch reads here (`src/test/setup.ts`). Unchanged contract.
    - **`static/`** — Vite `publicDir`. Setup writes `static/gfx/**` (PNGs + title `.tilemap`s), then **mirrors `data/` → `static/`** so the browser can `fetch('pokemon.json')` and load `/gfx/...` without ROM injection.
    - **Why two dirs:** tests hard-exit without `data/`; the browser needs a single public root that also holds graphics. One mirrored copy at setup end is simpler than dual-writing every JSON path.
    - **`base`** originally kept as GH-pages-style `/pokemon-yellow-typescript/`;
      **superseded by #17** (`base: '/'`).
    - **Legacy root `gfx/`** removed by setup if present; assets live only under `static/gfx/`. Both `data/` and `static/` are gitignored.

    *⚠ 2026-09-22: the layout decision stands; its implementation (P5-1) was lost (#26). Rebuilt in R1a (setup writes `static/`) and R1b (`publicDir: 'static'`). "Both gitignored" is superseded by #18: both are committed in R1c.*

17. **Deploy targets: local first; Netlify only after full product — not GitHub Pages** (2026-07-30).
    User: will not host on GH Pages; play locally. Vite `base` is **`'/'`**.
    Absolute `/gfx/**` and relative JSON fetches work without a path prefix.
    `resolveAssetUrl()` stays as a thin helper if a subpath is ever needed.
    *⚠ 2026-09-22: upstream still has `base: '/pokemon-yellow-typescript/'` and no `resolveAssetUrl()`. Both were in the lost copy only (#26). R1b sets `base: '/'`; add a helper only if a subpath is ever really needed.*

    **Amended same day:** Netlify/hosting is **DEAD LAST**. Do not work on
    deploy until the user considers the product fully working (SFX, randomizer,
    polish as they want). Until then local `npx vite` only. When eventually
    wanted: `npm run setup` + `npm run build`, publish `dist/`.

18. **Extracted data committed; ROM for development only** (2026-08-04). *Complements #14.* The ROM (`pokeyellow.gbc`, user's own cartridge dump) is used during development to extract data via `npm run setup pokeyellow.gbc`. The extracted output (JSON + PNG in `data/` and `static/`) is committed to the repo. The final product runs from these committed static files — no ROM, no extraction step needed.

    **Development workflow:** add maps to `EXTRACTABLE_MAPS`, re-run `npm run setup pokeyellow.gbc`, commit the new output. The ROM stays gitignored; only the extracted data is committed.

    **`src/rom/` stays:** the ROM extractors remain as both the extraction system and the schema authority (DECISIONS #4). They are actively used during development.

    **Plan restructured:** 90 slices → **29 slices** (R1–X2). Phase R (1 slice) commits all extracted data. Phases A–I follow game story order with bigger milestone-oriented slices.

19. **Context system flattened to one level; `CLAUDE.md` is the entry point** (2026-09-05). *Extends #8 and #11.* The nested `context/agent/` onboarding pack (`00-readme` … `06-ui-context`) is removed. It duplicated the top-level knowledge base — `agent/02` restated `PROJECT.md`, `agent/03` restated `ARCHITECTURE.md`, `agent/04`/`05` restated `CONVENTIONS.md` — which is the same two-copies-drift failure #11 was written to prevent, one level down.

    **New layout (7 files, flat):**

    | File | Role |
    |---|---|
    | `STATUS.md` | the live handoff log — read first, update last (was `agent/01-progress-tracker.md`) |
    | `PROJECT.md` | what and why; goals, non-goals, success criteria (absorbed `agent/02`) |
    | `ARCHITECTURE.md` | data pipeline, contract, invariants, rendering/asset rules (absorbed `agent/03` + `agent/06`) |
    | `PLAN.md` | the 29-slice roadmap (R1–X2) |
    | `DECISIONS.md` | this file |
    | `CONVENTIONS.md` | session contract, code standards, naming traps, verification (absorbed `agent/04` + `agent/05`) |
    | `HISTORY.md` | archived session entries (was `PROGRESS.md`) |

    `PROGRESS.md` → `HISTORY.md` removes the last naming collision: "PROGRESS" and "progress-tracker" were two different files meaning opposite things (archive vs live), which is exactly what #11 had to spend a paragraph disambiguating.

    Root `CLAUDE.md` absorbed `agent/00-readme.md` and now carries the reading
    order, so the numbered filename prefixes are no longer needed. The
    third-party context-engineering article (`context/README.md`) is parked as
    `context/_reference-article.md` — it is human background reading, not project
    state, and a file named `README.md` inside `context/` read as an entry point
    it never was.

20. **Workspace layout: `game/` + gitignored `refs/`; five reference repos on pinned branches** (2026-09-05). *Extends #1, #2, #9.*

    The root is the git repo. Reference material is not vendored into it — it lives in `refs/`, a **gitignored** directory of clones refreshed by `./pull-refs.sh`. Renames: `pokemon-yellow-typescript-main/` → **`game/`**, `pokeyellow-master/` → **`refs/pokeyellow/`**, and the salvaged pokered.ts map scripts (#9) belong under **`notes/`** if still wanted — `refs/` is for clones only. New `notes/` holds our own spec notes and comparisons.

    **`game/` is a copy, not a remote.** Upstream is `gididaf/pokemon-yellow-typescript`; we cannot push back to it, so its files were copied into this repo and we own them from here. No upstream merges.

    **The five refs, each pinned to the branch it actually develops on** — `origin/master` is wrong for most of them, which is the whole reason the branch is recorded here:

    | Dir | Repo | Branch | Role |
    |---|---|---|---|
    | `refs/pokeyellow/` | pret/pokeyellow | `master` | the disassembly — ground truth (pret still uses master) |
    | `refs/gen1recomp/` | bryanthaboi/gen1recomp | **`dev`** | Lua full-game + `gen1_faithful` |
    | `refs/oldamber/` | spiritsnails/oldamber | `main` | full Red/Blue in C — matters past Viridian |
    | `refs/engine/` | pkmn/engine | `main` | battle oracle |
    | `refs/dmg/` | pkmn/dmg | `main` | one-move damage math |

    **Precedence:** where a reference disagrees with `refs/pokeyellow/`, the disassembly wins. It is the cartridge; the others are implementations of it, valuable for behavior that is hard to read out of ASM.

    **Why gitignored:** they are large, they are not ours, and they must stay pristine to be trustworthy as a spec. Anything learned from them gets written into `notes/` or the context files, never into the clone. `pull-refs.sh` also clones what is missing, so it doubles as first-time setup.

    Root `README.md` added: layout, setup, and credit to all six upstream projects.

21. **The vision, stated by the user** (2026-09-05). *Amends #5, #6 and the 2026-07-30 scope freeze. New information from the user — not a relitigation.*

    **What this project is:** a local-only, **1:1 replica of vanilla Pokemon Yellow** in TypeScript/JavaScript, built on top of `gididaf/pokemon-yellow-typescript` because that author already did so much of the work. We are porting/remaking the original game, not designing one. Nothing about gameplay, balance, text, maps or mechanics is ours to change. The repos in `refs/` are the reference for getting it right.

    **Sprites are vanilla Yellow**, from ROM extraction. That is the baseline for the entire build.

    **Clarified 2026-09-06:** the sprite randomizer is **not part of the core deliverable**. User: *"the sprite randomizer could be LATER down the line, we can just start with yellow sprites and work on those for 700 or 800 slices."* It stays Phase X1, dead last — after the game is beatable (I2) and audited (J2), realistically year two, and it is fine if it never happens. Build everything on vanilla ROM sprites; `pkmn-sprites/` is untouched until X1. Do not let it influence engine or asset work before then. The research in #22–#23 is banked so the eventual session is cheap, not because it is near.

    **Scale:** the user expects this to be **very ambitious — one to two years, on the order of 700–800 sessions.** User: *"I am not expecting a port of Yellow to TypeScript in 2 weeks."* The 29 slices in `PLAN.md` are *milestones*, not sessions. See the note at the top of that file.

22. **Randomizer is per-encounter, not per-save-seeded** (2026-09-05). *This supersedes the "seeded per save" half of #6. New information from the user.*

    User's words: "sprites from pkmn-sprites randomized **every battle** — I find a Rattata in the wild and the game randomly selects one of the 6 sprites and shows it to me."

    So the roll happens **per battle encounter**, not once per save. Two concrete consequences for X1:

    - **No seed in `SaveData`.** #6's plan to persist a seed (and X1's old "same seed → same visuals" acceptance test) is dropped. There is nothing to persist; each encounter rolls fresh.
    - **The sprite cache is now a trap.** `battle_ui.ts:54-55` caches by `speciesName`, which would freeze the first-rolled variant for the rest of the session — the exact opposite of the intent. The variant must be part of the cache key, or the randomized path must bypass that cache.

    Unchanged from #6: the roll is **cosmetic only** and consulted inside `loadPokemonSprites` (`battle_ui.ts:75-98`). Species, stats, types and moves are untouched — the randomizer never influences battle logic. Party-list category icons still not remapped.

23. **The randomizer pool is 6 static sets, Gen 2 art now included** (2026-09-05). *Amends the 2026-07-30 scope freeze in #6, which excluded Gen 2 art.*

    Measured directly in `pkmn-sprites/`, not assumed. Every one of the six sets covers dex **0001–0151** with a matching `back/`, so any Gen 1 species has exactly **6 front + 6 back** variants:

    | Set | Path | Front | Back |
    |---|---|---|---|
    | Red/Blue | `pokemonGen1/Gen1/red-blue/` | 40×40 | 32×32 |
    | Red/Green | `pokemonGen1/Gen1/red-green/` | 40×40 | 32×32 |
    | Yellow | `pokemonGen1/Gen1/yellow/` | 40×40 | 32×32 |
    | Gold | `pokemonGen2/Gen2/gold/` | 40×40 | **48×48** |
    | Silver | `pokemonGen2/Gen2/silver/` | 40×40 | **48×48** |
    | Crystal | `pokemonGen2/Gen2/crystal/` | 40×40 | **48×48** |

    Filenames are zero-padded 4-digit dex numbers (`0019.png` = Rattata), *not* species names — different from both pret and the engine's own `/gfx/sprites/front/25.png` convention.

    **Gen 2 art is in scope for the randomizer pool** (the user's "6 sprites" only reaches 6 by counting gold/silver/crystal). This does not reopen anything else that freeze covered: Gen 2 *content* — Johto dex, Unown, Gen 2 mechanics — stays out. This is skins for the 151, nothing more.

    **Two gotchas measured, not assumed:**
    - **Fronts are all 40×40** — matching what the engine already expects. Free.
    - **Gen 2 backs are 48×48, the engine expects 32×32.** Scaling or cropping is needed for gold/silver/crystal backs, or those three sets contribute fronts only.

    Still out: **shinies** (the `shiny/` folders exist in all three Gen 2 sets — deliberately unused) and gray monochrome (user deleted it).

24. **The git repo is local-only — never pushed anywhere** (2026-09-22). User: *"i dont want this pushed to ANYWHERE, just local."*

    `git init` ran at the `pkmn/` root on 2026-09-22 (branch `master`) with **no remote configured**, and it stays that way. No `git remote add`, no `git push`, no hosted repo (GitHub, GitLab, etc.), no `gh repo create`. Commits are a local history only. Hard rule #9 in `CLAUDE.md`.

    `pull-refs.sh` is unaffected: it *fetches* the clones in `refs/`, which are separate repos and are gitignored here. Deploying a built game (X2, Netlify) is a separate, dead-last question that needs the user's go-ahead when the time comes. This rule does not settle it either way.

25. **What git tracks: `game/` yes, the ROM no, `pkmn-sprites/` no** (2026-09-22). *Amends #20.*

    The user's concern: the ROM (`game/pokeyellow.gbc`) must never end up in git or on GitHub. A root `rom/` folder was tried briefly the same day, then dropped. The setup script and tests expect the ROM inside `game/`, so moving it would mean changing the tooling for no real gain. User: *"move the rom back to game/ … since \*.gbc is gitignored anyways."*

    **Settled:**
    - The ROM stays at **`game/pokeyellow.gbc`**, SHA1 re-verified after the round trip (same as #14). It is kept out of git by the root `.gitignore`'s **`*.gbc` / `*.gb`** patterns. Never weaken those patterns.
    - **`game/` is tracked**, so the code and extracted data (R1) are versioned as planned.
    - **`pkmn-sprites/` is gitignored** at the user's request, replacing its old "committed" label. It stays read-only and user-curated.
    - `refs/` stays ignored (#20). The repo stays local-only (#24).

26. **The July–August code is lost; rebuild it as Phase V, split R1, commit every slice** (2026-09-22). *New information, not a relitigation. Amends #12, #18 and the plan in #21.*

    **What happened.** When `gididaf/pokemon-yellow-typescript` was copied into `game/` on 2026-09-22, it was vanilla upstream (`main` @ `05faa114`): 12 maps, ROM upload gate, `publicDir: false`, no PNG export, 10 SFX, the PSYCHIC bug. The modified copy that the 2026-07-27 → 2026-08-04 sessions built (30 maps, gate deleted, `static/` PNGs, PSYCHIC fix, 49 SFX, `scripts/gen/`, the smoke and maps-only scripts) is not on disk. The user confirmed **no copy exists anywhere**. Nothing from those sessions had been committed to this repo. Their **knowledge** survives in the context files; their **code** does not.

    **Decided with the user:**
    - **R1 splits into three slices**: R1a export graphics (setup writes `static/` PNGs + tilemaps + JSON mirror, reusing the browser's own `extractRom()`), R1b run the browser from files (`publicDir: 'static'`, `base: '/'`, delete the gate), R1c commit the data (with a fresh-clone proof). Reason: upstream extracts in the browser, so no PNG exists on disk yet. That is more than one sitting, and the three steps separate extractor work from engine work (CONVENTIONS *Scoping rules*).
    - **New Phase V (V1–V5) rebuilds the lost work before Phase A**: V1 Route 2 + Forest, V2 Pewter City, V3 Pewter Gym + Museum, V4 Diglett's Cave + Route 3, V5 recovered fixes (PSYCHIC #10, SFX, sim FPS O-5). Reason: Phase A's verify steps need Route 2, the Forest and Brock. The plan grows from 29 to **34** milestones. *⚠ Corrected 2026-09-22 (same day): the real counts are **28 → 33**. "29" had been one too many since 2026-08-04 (the plan had R1 + 27 rows A1–X2), and "34" was 29 + 5. R1 counts once.*
    - **Phase A re-scoped** to what upstream actually lacks. Upstream already has whiteout, badge stat boosts, hidden items and the trainer line-of-sight engine. Missing: item balls, `sightRange` data, TM/HM, poison/Repel/Escape Rope.
    - **Commit locally at the end of every slice** (user standing instruction). Baseline commit `9bf2d7d` = docs + vanilla upstream. Never pushed (#24).
    - Upstream's `game/CLAUDE.md` was transcribed into root `CLAUDE.md` → *Engine reference* and deleted.

    **Consequence for the docs:** any claim of "30 maps", "395 tests", "gate deleted", "PSYCHIC implemented" or "49 SFX" describes lost code. The real baseline is 12 maps / 375 tests. `HISTORY.md` → *Prior work — code lost* maps each lost item to the slice that rebuilds it.

27. **The game keeps running when the tab is unfocused** (2026-09-22, during R1b). *User request, new; not a relitigation.*

    User, after tabbing away froze the game and its music: *"if the game is unfocused, it should continue executing as usual."*

    **Why it froze:** upstream drives every tick (logic, input, `tickAudio()`) from `requestAnimationFrame`. Browsers stop rAF in hidden tabs, and the loop caps catch-up at 4 ticks, so the game simply stopped.

    **Chosen:** `main.ts` splits the tick step into `runDueTicks()`. rAF still calls it and then renders, exactly as before while visible. `startBackgroundTicker()` adds an inline Web Worker firing every 8 ms; worker timers aren't throttled like main-thread timers in background tabs. It calls `runDueTicks()` only when rAF has been idle for more than 100 ms, so the two never double-tick. Rendering waits for rAF. `input.ts` releases all held keys on window `blur`, because the keyups are lost while unfocused and a stuck key would keep the player walking in the background. The `p` pause still stops everything. **User-verified** 2026-09-22: music and game continue in a background tab.

    **Not a game change.** This is how the browser host behaves, not game content, and it matches the hardware: a Game Boy doesn't pause when you look away. Rejected: driving ticks from the audio callback, which fails before the audio unlock click and while `p`-paused. Also rejected: plain `setInterval` on the main thread, which is throttled to ≥1 s in background tabs.

    **Caveat:** browsers may still freeze a **silent** background tab after several minutes (tab freezing / energy saver). Tabs playing audio are exempt.

28. **Upstream's `game/LICENSE` is removed** (2026-09-22). *User decision.*

    The user deleted `game/LICENSE` (upstream's MIT license, "Copyright (c) 2025 Gidi Daf") from the working copy. Asked whether to keep it, the user said *"pls leave LICENSE alone"* and then *"i want it gone"*. The deletion was committed with R1c. **Don't restore it.**

    Context recorded for completeness: MIT asks that the copyright notice accompany copies of the software. This project is personal and never distributed (#24), and the root `README.md` still credits `gididaf/pokemon-yellow-typescript` by name and link. If the project is ever shared or published (X2), revisit this first.

    Also on 2026-09-22 (R1c): `data/` and `static/` became tracked, and the root `.gitattributes` pins text to LF and marks PNG/tilemap/ROM binary. This amends #25's list of what git tracks.

29. **V1 plan approved: five slices, A1 right after V1, new slice A4 for trades** (2026-09-22). *The user's answers to the plan in `notes/02-v1-plan.md` (STATUS O-6). User: "the split is perfect, and go ahead with all 6 recommendations".*

    - **V1 is split into five slices:**
      - V1a: extract the 7 maps and their trainer data (extraction only).
      - V1b: make them playable — music, palettes, debug warps, Pikachu spawning, Oak's Aide.
      - V1c: trainer battles as `home/trainers.asm` does them.
      - V1d: the catch-demo battle type.
      - V1e: the real Viridian old man, which removes the demo gate.

      This keeps extraction and engine work in separate slices. The one deliberate mix is V1e: adding OLD_MAN2 and deleting `VIRIDIAN_OLDMAN_DEMO` must land together with the engine code that uses them, because either change alone would visibly break Viridian City.
    - **A1 (item balls + trainer sight) moves to right after V1**, before V2. Its verify needs nothing past V1, it builds on V1c's trainer flow, and every map from Pewter on is then built with sight and item balls already working.
    - **V1d rebuilds Oak's Pikachu catch** (`pikachu_battle.ts`) as the catch demo shared by `BATTLE_TYPE_OLD_MAN` and `BATTLE_TYPE_PIKACHU`. The intro gains the ASM's simulated FIGHT → ITEM → POKé BALL menu input.
    - **Route 22's fake Blue is removed in V1e.** It is upstream's second demo gate, with invented "end of the demo" text (`maps.ts:329`). The real Route 22 rival battle stays in I1.
    - **New slice A4: in-game trades** (`DoInGameTradeDialogue`). Route 2's trade house has the first one, but it asks for a Clefairy, and the player can't have one before Mt. Moon (B1). The plan grows to **34** milestones.
    - **Texts with runtime values** (`text_ram`, `text_decimal`; Oak's Aide first) are transcribed in the engine with ASM citations, which is what upstream already does for this kind of text. Teaching the extractor those two text commands is logged as a later improvement.

30. **V1b: Oak's Aide moves to A2; the player keeps their facing through warps; door SFX waits for V5** (2026-09-22). *The user's answer to `notes/03-v1b-plan.md` §3: "go", accepting all three recommendations.*

    - **Oak's Aide (Route2Gate, HM05) moves from V1b to A2.** The bag has no TM/HM items at all: `item_names.json` holds only the 97 `ItemNames` entries. Giving HM05 needs the machine names and the `TechnicalMachines` table, which A2 builds anyway for Brock's TM34. A flood fill also shows the Aide can't be reached before Cut. Until A2 he is inert, like the trade kid.
    - **The player keeps their facing through warps.** The ASM never resets it on a warp: `ResetPlayerSpriteData` runs only at Continue and new game. Upstream forced `down` after every warp, which turned the player around when leaving a gate northward and fed Pikachu's spawn rules the wrong facing. Visible on existing maps too: the player now faces up after entering a building, as in the original.
    - **Door SFX:** the ASM picks go-inside or go-outside from the tile under the player (`PlayMapChangeSound`); upstream picks by destination map. This is fixed everywhere in V5's SFX slice rather than special-cased for the Forest in V1b.

31. **V1c: fix the Oak's Lab loss, record the rival's starter, fix the meet-music typo, add A5** (2026-09-23). *The user's answer to `notes/04-v1c-plan.md` §3: "go", accepting all four recommendations.*

    - **The Oak's Lab loss is fixed in V1c.** When RIVAL1 wipes your party, the ASM clears the top of the screen, scrolls his pic in, waits 40 frames and prints `_Rival1WinText`. In `OAKS_LAB` there is no blackout: `HandlePlayerBlackOut` returns early and `.battleOccurred` skips the faint check. The lab script then heals the party and carries on. Upstream sent this loss through its generic blackout, which halved the money, warped the player, and left the lab script unfinished.
    - **The rival's starter (`wRivalStarter`) is recorded from V1c on.** It is saved as `rivalStarter`, next to the rival's name: 2 = FLAREON after a lab win, 3 = VAPOREON after a loss (`OaksLabRivalEndBattleScript`). The rival's team in every later rival battle depends on it: Route 22, Pokémon Tower 2F, Silph Co 7F, the Champion. Saves made before V1c don't have it, so the Route 22 slice picks a fallback.
    - **The `meetevilttrainer` typo is fixed in V1c**, not V5. It was in both music name lists; the fix gives 47 tracks. V1c implements `PlayTrainerMusic` whole, so the evil-trainer track has to exist.
    - **New slice A5, "Battle presentation per the ASM"**, queued right after A1 and before V2. It covers three things:
      - all 8 battle transitions and the ASM's choice between them, keeping the dungeon-list bug (`battle_transitions.asm`);
      - enemy pic positions: 5×5 front pics are centred at tile 13 (`LoadUncompressedSpriteData`), and the trainer intro pic sits at tile 12;
      - battle text that types out and scrolls on `cont`.

      Until A5, map-trainer battles keep upstream's instant cut rather than borrowing the spiral: the Forest's correct transition is Shrink or Split, so the spiral would be just as wrong. The plan grows to **35** milestones.

32. **V1d: the catch demo is its own module, follows the ASM, and gets "PROF.OAK" from the ROM** (2026-09-24). *The user's answer to `notes/05-v1d-plan.md` §3: "go", accepting all four recommendations.*

    - **The demo lives beside `Battle`, not inside it:** `battle/catch_demo.ts` (the rules, pure and tested) and `battle/catch_demo_screen.ts` (upstream's `pikachu/pikachu_battle.ts`, moved and generalized). `Battle` assumes a player Pokémon, and Oak's catch runs with an empty party. Folding both battle types into it would also touch every normal battle.
    - **The old man's side is checked by unit tests plus a temporary, uncommitted hook** for the agent's browser check. No debug-overlay button: that would grow upstream's non-vanilla tooling before J2. The user first sees the old man's demo in V1e.
    - **All 8 departures in upstream's Pikachu catch are fixed** (`notes/05-v1d-plan.md` §1.3): the simulated menu and bag, the HUD after "appeared!", 20 frames before the throw, the "used" text kept up, the pic hidden after the poof with the HUD kept, the caught text waiting for A, the battle engine's own name string, and the instant white at the end.
    - **"PROF.OAK" is extracted** as `BATTLE_PROF_OAK_NAME` (`DisplayBattleMenu.profOakName`, 0f:4fef), next to V1a's `BATTLE_OLD_MAN_NAME`.

33. **The game ticks at the Game Boy's frame rate, 59.7275 Hz** (2026-09-25). *Resolves O-5. User: "pls match the game boy 59.7".*

    - **Default rate:** `GB_FPS = 4194304 / 70224` (one LCD frame is 70224 cycles of the 4.194304 MHz clock), in `src/core/tick_clock.ts`. Upstream's default was 50. The audio clock already ran at 59.7275.
    - **The loop keeps its leftover time.** Upstream's `runDueTicks` reset its timestamp to `now` on every call, throwing away the remainder, so the rate was capped by the display refresh. Its "50 fps" ran **30** ticks/s at 60 Hz, 40 at 120 Hz, 48 at 144 Hz and 240 Hz, and 41.6 on the background worker. A plain 59.7 would still have run at 30 on a 60 Hz display, because 16.67 ms is just under one 16.74 ms tick. `TickClock` carries the remainder, the way `tickAudio()` already did. It still runs at most 4 ticks per call, and drops the backlog after a longer gap (pause, frozen tab), as before.
    - **Measured** in the user's Chrome (240 Hz display): **59.70 ticks/s over 20 s**, where upstream's loop gave 48. That means the game had been running at about 80% of Game Boy speed there.
    - **`-` / `+` keep working.** They step through multiples of 5 (10–200) with the Game Boy rate as one more stop between 55 and 60, so it can always be reached again. A rate saved in `localStorage` (`p151-f`) still wins. The keys themselves stay upstream's non-vanilla tooling for J2 to decide.

34. **V1e: map scripts keep their state in the save; the Gym-door quirk is kept; V1e is one slice** (2026-09-25). *The user's answer to `notes/06-v1e-plan.md` §4 was "do v1e as one slice" (Q3). Q1 and Q2 weren't addressed, so they took the recommended defaults. The user then play-tested V1e and said "it all works as intended".*

    - **`w<Map>CurScript` is saved per map** (`events.ts` `getMapScript` / `setMapScript`, `SaveData.mapScripts`). Only the resting values are saved (Viridian: 0 `DEFAULT`, 1 `AFTER_POKEDEX`, 2 `POST_CATCH_TRAINING`), because the other states run with input locked and are one command list each. A new game clears them (`init_player_data.asm`). Saves without the field get Viridian's state from `GOT_POKEDEX` / `COMPLETED_CATCH_TRAINING`. The rejected alternative was upstream's flags-only style, which can't reproduce the quirk below. Later maps with script state (Pewter, Route 22, Cerulean…) should reuse this.
    - **The Gym-door quirk is kept (Hard rule 7).** The Gym's push-back sends the city to `POST_CATCH_TRAINING` from any state, which turns off the (19,9) old-man check. Touch the Gym door before the demo and you can walk north, before the Pokédex without one. The Pokédex re-arms the check (state 1), and so does talking to the sleeping man (his text handler ends in state 0). Browser-checked: the Gym door, a save with `ViridianCity: 2`, then walking to (19,3) with no Pokédex.
    - **One slice**, data and engine together, as #29 already allowed for V1e.
    - **Pushes are simulated joypad steps.** The ASM's one-step push-backs are `StartSimulatingJoypadStates` presses. They skip the turning frame (`.noDirectionChange`), and they still collide and hop ledges, because `GetSimulatedInput` has already brought the index to 0 by the time `CollisionCheckOnLand` runs. So at the Gym door the player **hops the ledge** at y = 9 down to (32,10). The new `pushPlayer` script command feeds a simulated direction into `player.update` rather than moving the player directly the way `movePlayer` does.

35. **A1 splits into three slices; new milestone A6 (overworld pace) goes first** (2026-09-27). *The user's answer to `notes/07-a1-plan.md` §4 (STATUS O-8): "yes, pls do walking speed first, lol, that was bugging me a lot". That takes all six recommendations, with decision 2's "A6 first" alternative.*

    - **A6 "Overworld pace per the ASM" is a new milestone (36 in all), and it runs first**, before A1a. The ASM's overworld loop takes two frames per pass, so a player step takes 16 frames and an NPC step 32. Upstream moves both one step per 8 ticks, and since #33 a tick is one frame, so the player and Pikachu walk at 2× and NPCs at 4×. A6 gets its own probe and plan (`notes/08-a6-plan.md`). *⚠ Refined by the A6 probe (#36): a normal NPC step is **34** frames — a start pass, then 16 × 1 px.*
    - **A1 is three slices, in this order after A6:**
      - A1a: music-mode SFX and the two item jingles (`get_item1`, `get_item2`). The other music-mode SFX stay in V5.
      - A1b: item balls, plus the hidden-item pickup.
      - A1c: trainer sight, built on A6's loop.
    - **The hidden-item pickup is fixed in A1b.** The text comes before `GiveItem`, `SFX_GET_ITEM_2` plays, the box closes by itself, and a full bag shows "But, <PLAYER> has no more room for other items!".
    - **`addToInventory` gets `AddItemToInventory_`'s 99-per-slot rule** in A1b. Past 99, the rest goes into a new slot if there's room, and otherwise the whole add fails.
    - **Picked-up balls are saved as `hiddenObjects`**, a list of `Map:npcId` keys that mirrors the ASM's toggleable-object flags. Later `HideObject` users reuse it.
    - **Small data changes go with their engine slice:** the jingle decoder fix and headers in A1a, `sightRange` in A1c. Each regenerated diff must show only that change. This is an exception to CONVENTIONS' "don't mix extraction and engine", as in #29 (V1e) and #31 (V1c).

36. **A6 splits into four slices, runs on 2-frame passes, and goes first** (2026-09-27). *The user's answer to `notes/08-a6-plan.md` §4 (STATUS O-9): "go", taking all four recommendations.*

    - **Four slices**, back to back, then A1a–c:
      - A6a: the pace — the player, Pikachu, the three NPC walking modes, the walk animations, the ledge jump table, and every cutscene walk.
      - A6b: the order inside a pass, sprite pop-in, NPCs keeping their facing after a talk, the turn encounter roll and the 3-step cooldown.
      - A6c: NPC wandering and turning.
      - A6d: the ledge-hop shadow and Pikachu's hop.
    - **The overworld runs on the ASM's pass.** One pass is 2 frames (`OverworldLoop` → `DelayFrame` ×2), and every mover advances once per pass: 2 px for the player, 1 px for a normal NPC. So positions change every 2 frames, as on the Game Boy. Rejected: halving the speeds per frame, which is smoother than the original and needs fractional pixels for NPCs. Text, script waits, fades, audio and battles keep counting frames (#33).
    - **Cutscene walks are ported with their ASM mode and concurrency in A6a**, not only re-timed. The modes are normal NPC steps, Yellow's fast codes, and walking in step with the player. Wrong paths or texts found on the way are logged, not fixed.

37. **A6b takes all four plan decisions; Sol 6.1 implements it and Claude reviews** (2026-10-01). *The user's answer to `notes/08-a6-plan.md` §5.4 (STATUS O-10): "mark those 4 decisions as yes".*

    - **Map triggers run in a per-pass map-script hook**, on every standing pass and before the joypad read, as `JoypadOverworld` → `RunMapScript` does. Pallet's, Viridian's and the Oak's Lab triggers move there, on their ASM conditions (Pallet: `wYCoord == 0`, no facing check). Trainer sight joins the hook in A1c.
    - **Pikachu's walking happiness and mood are fixed in A6b** (`UpdatePikachuHappinessAndMood`): the step counter resets on map entry, the bonus is a 50% roll every 256 steps, and every step moves the mood 1 toward 128.
    - **The fixed-facing NPC turn-back moves from A6c into A6b.** STAY NPCs run the ASM's status 1 ↔ 2 cycle, so a talked-to NPC turns back to its map facing after a random 1–256-pass delay. Random turning for `NONE` facing, the wander limits and beaten trainers spinning stay in A6c.
    - **Sprites under a text box or menu are hidden whole in A6b** (`CheckSpriteAvailability`'s tile check), together with the window rule and the pop-in.
    - **Who does what:** the user assigned the implementation to Sol 6.1, with Claude reviewing the diff before A6b is called done. This is the project's multi-agent setup (#11) used within a single slice.

---

38. **A6d uses the native follow buffer; scripted Pikachu movement becomes A6e**
    (2026-10-04). *The user asked Codex to read and implement `notes/12-a6d-plan.md`,
    accepting its three recommendations (O-11).*

    - A6d ports the ROM ledge shadow, extra landing UpdateSprites and Yellow's follow
      buffer for all following, including the retained command and hop-half toggle.
      Only `static/gfx/overworld/shadow.png` changes in generated output (#35 exception).
    - `ApplyPikachuMovementData` stays a separate A6e slice. A6 has five slices;
      the milestone count stays 36. Scripted targets retain their approximation in A6d.
    - Hop-midpoint map scripts and trainer sight after landing stay in A1c.
    - Codex implements, Claude reviews, then the user play-tests. The updated handoff
      (`530363c`) drops a separate A6c re-review: Claude's A6d review also covers R-3
      on `9897020`; the user can play-test both slices together.

39. **A6e is one slice: the whole movement interpreter, bounded emotion and nurse work**
    (2026-10-04). *The user asked Claude to plan and implement Codex's `notes/14-a6e-plan.md`
    ("pls ultrathink, plan and implement this plan"), taking its three recommendations
    (O-12).*

    - One A6e slice with three verified checkpoints (`0a89455`, `1a7231f`, `89f620b`).
      `pikachu_movement.json` is the slice's one generated-data addition (#35 exception).
    - The interpreter is complete for `$00–$3e`; the callers are today's maps' four:
      Viridian's step-aside, the nurse, Oak's Lab's missing step after "GRAMPS!", and the
      emotion preludes (4, 6, 7, 9, 13). The scripted target queue and its sine arc are gone.
    - Emotion work stops at the movement and the portrait's border; cries, bubbles and the
      exit sequence stay in V5 / J2. Nurse work ports the outer routine's Pikachu calls and
      waits; the healing machine's internals keep their audit homes.
    - Corrections found while implementing (detail in the plan's *Implementation result*):
      Viridian's program is read at `3c:5a0a` (the `ld hl` operand), not `3c:5e2b`; spawn
      state 5 only places a starter that wasn't out.
    - Who reviews A6e is the user's call; the user then play-tests.

40. **A1a takes all seven plan decisions; Claude implements it** (2026-10-06). *The user's
    answer to `notes/16-a1a-plan.md` §9 (O-13): "I reply yes for all of them", and "implement
    the plan yourself".*

    - One shared channel interpreter (`audio/sound_channel.ts`) for the music and for
      music-mode SFX channels.
    - The cartridge's SFX/music hand-off, for every SFX:
      - music channels before SFX channels in each update;
      - a suppressed music channel only counts;
      - after the SFX, silence until the music's next note or rest;
      - the wave pattern reloaded at every note.

      Upstream's mid-note restore goes. `press_ab` over music sounds different as a result.
    - The exact rules in shared code, so the music changes too:
      - separate SFX tempo, channel by id;
      - perfect pitch;
      - vibrato with rate 0;
      - the wave channel at 65536/(2048−x), an octave below today;
      - `MultiplyAdd`'s note arithmetic.
    - Channel 8's occupancy by drum hits, with the drop rule, so `isSoundFinished()` is
      exact.
    - A `_playSFX(name)` console helper beside upstream's `_audioEngine` / `_sfxEngine`, for
      the ear test before A1b. J2 decides it with the rest of the debug tooling.
    - The `static_export` timeout rides with A1a.
    - One slice in four checkpoints. The two jingle JSON files ride with it (#35's
      exception).
    - **Who:** the user asked Claude to implement its own plan. The user picks the
      reviewer.

41. **A1b: Sol implements, Claude reviews; decisions 1–5 take the recommended defaults**
    (2026-10-06). *The user's answer to `notes/18-a1b-plan.md` §9 (O-14): "let me have sol
    implement" and "u will review their work". Decisions 1–5 weren't addressed, so they take
    the recommendations, as in #34.*

    - Scope as the plan's §3–§6: `AddItemToInventory_`'s exact rule (the first-overflow
      quirk kept), removal by slot (`RemoveItemFromInventory_`; `remove(id)` stays
      `RemoveItemByID`), and the shop, PC and `restoreBag` callers.
    - The ASM's interaction order: hidden events → bookshelf → signs → NPCs; a found hidden
      item falls through to signs and NPCs.
    - Route 1's Potion sample is ported in A1b: the ASM texts, the flag set before the give
      (a full bag loses the Potion), `get_item1`, the `prompt` ending.
    - The free-move hidden-item branch in `script_controller.ts` is deleted.
    - The global text-box ending finding (`done` closes silently on A's release; `prompt`'s
      ▼; `Delay3`, `para`'s 20 frames, the two-step `cont` scroll) goes to **A5**, renamed
      "Battle and text presentation per the ASM". A1b's primitives are the building blocks.
    - **Who:** Sol (Codex) implements; Claude reviews (`notes/19-a1b-review.md`).

42. **Root `CLAUDE.md` stays a short entry point; the engine reference moved out**
    (2026-10-06). *Extends #19 and #26. The user asked after Claude Code warned that
    `CLAUDE.md` was over its 40k-character limit (45.9k): "why is claude.md so large? can
    we move some of its contents to the context files?"*

    - **Why it grew:** it was 25k characters on 2026-09-22. Every slice since then added
      1–4k:
      - a *Where things stand* paragraph;
      - a *Testing* bullet;
      - subsystem detail in the *Engine reference*.

      Claude Code loads the file into every session, so each slice made every later
      session cost more.
    - **Moved, verbatim apart from heading levels:**
      - module map, game state machine, data conventions, ROM extraction system →
        `ARCHITECTURE.md` → *Engine reference*;
      - overworld movement pitfalls → `game/src/overworld/ARCHITECTURE.md`;
      - audio → `game/src/audio/ARCHITECTURE.md` (new);
      - the Pikachu happiness tables → `game/src/pikachu/ARCHITECTURE.md`;
      - testing → `CONVENTIONS.md` → *The test suite*, regrouped into how it runs, by area
        and per slice.
    - **Merged, not copied:** the battle mechanics. `game/src/battle/ARCHITECTURE.md`
      already had most of them; it gained Focus Energy, the faint slide, the move-learning
      text, the evolution animation and the blackout details. Two stale facts were
      corrected against the code:
      - the faint slide is 7 rows (`PIC_HEIGHT`), not 8;
      - the blackout destination is `lastBlackoutWarp`; `BLACKOUT_POSITIONS` no longer
        exists.
    - *Where things stand* shrank to one paragraph. STATUS.md and PROJECT.md already held
      the detail.
    - **The rule from now on** (CONVENTIONS, session contract step 5):
      - **Keeps:** rules, reading order, commands, the house rule, a short state paragraph
        and a table of where each engine topic lives.
      - **A slice changes it only for:** the test baseline, plus a milestone's line when one
        finishes.
      - **Target:** about 15k characters.
    - The context system is still seven flat files (#19). The subsystem docs were already
      where per-module detail lives.

43. **A1c takes all seven plan decisions; Claude implements** (2026-10-06). *The
    user's answer to `notes/20-a1c-plan.md` §9 (O-15): "go".*

    - **The hop-midpoint `RunMapScript` moves to V4.** This narrows #38. The midpoint hook and
      the cartridge's mid-hop stranding (plan §1.8) wait for the first map that can reach them.
      A1c adds tripwire tests that fail when an OVERWORLD map gets a trainer with sight, or when
      `TRAINER_MAPS` drifts from pret's scripts. Sight after the landing and N-3 are fixed in
      A1c.
    - **Only the walk-up starts with `MoveSprite_`'s status rule.** The default `startScript`
      keeps its forced resting pass. That pass matches Pallet's explicit `$2`, and the other
      callers wait for the J2 cutscene audit.
    - **`EnterMap`'s `UpdateSprites` runs on every battle return that doesn't black out**
      (wild, trainer, script, catch demo).
    - **The Forest's trainer phase is `w<Map>CurScript`**, kept with `setMapScript` (#34).
    - **Pallet's and Oak's Lab's "!" bubbles move to V5.** A1c builds the shared `EmotionBubble`.
    - **One slice, four checkpoints** (plan §6), each committed locally.
    - **Who:** at first Sol was to implement and Claude to review. The user then asked Claude to
      implement it ("pls implement yourself"). The user picks the reviewer; then the user
      play-tests (plan §7).

44. **A5 takes all nine plan decisions; Sol implements A5a, Claude reviews**
    (2026-10-06). The user answered yes to all decisions in `notes/21-a5-plan.md`
    and asked Sol to implement.

    - A5a → A5b → A5c → A5d → A5e → A5f, each separately planned and verified.
    - Keep `\n`; encode control tokens only where necessary, plus trailing `<PROMPT>`.
      `game_text.json` terminators wait for A5b.
    - Contractions are single tiles; decode the missing ellipsis, quotes and PK/MN glyphs.
    - Model bottom-third BG transfers; phase remains approximate until other UI uses it.
    - Blink defaults to 30 frames on / 30 off, pending measured evidence.
    - Exact CloseTextDisplay reload cost and trailing UpdateSprites belong to A5b.
    - Species display names belong to V5; normal wild catch stays A5f.
    - Sol implements A5a in four locally committed checkpoints; Claude reviews,
      then the user play-tests. No push.

45. **A5b takes plan decisions 1–4; Claude implements, Sol reviews** (2026-10-06). *The user's
    answer to `notes/23-a5b-plan.md` §8 (O-17): "go and yes to all 1 through 4 as recommended".
    Decision 5 was left unanswered. The user had already said "sol will check your work
    afterwards", so Claude implements and Sol reviews.*

    - **Seven increments, A5b1–A5b7** (plan §6), data before wiring, each committed and logged on
      its own. Extractor edits and engine wiring never share a checkpoint.
    - **Two new extracted JSONs:** `text_programs.json` (strict text-command programs, FAR
      chains resolved, stopping at `text_asm`) and `map_sprite_sets.json`. `game_text.json` keeps
      its strings and the approved control encoding.
    - **Only the required key-item and PC sounds are added now;** the already-extracted menu sounds
      get wired; other audio stays in V5.
    - **Pokémon cries stay in J2.** Oak's speech keeps the cry as a declared cue, and the missing
      playback and wait are logged as a gap.
    - **Who:** Claude implements, Sol reviews, then the user play-tests.

## Open — not decided, needs the user


**O-2. Does the randomizer pool include Crystal's animated GIFs?** (2026-09-05) The user said "one of the 6 (or 7?) sprites". The 6 are settled (#23). A 7th would be `pokemonGen2/Gen2/crystal/animated/` — 252 GIFs, dex 0001–0251. It is a real option but a different feature: frame playback, not a static swap, and #6's scope freeze rejected it on the grounds that "Yellow never had that". Not blocking — X1 is dead last. Decide when X1 starts.

**O-1. ~~Route B: build the ROM from pret source at build time.~~** ✅ **RESOLVED 2026-07-29 — superseded by #14, then by #18.** First a real dump made RGBDS unnecessary; then the user decided to eliminate the ROM entirely, making this doubly moot.
