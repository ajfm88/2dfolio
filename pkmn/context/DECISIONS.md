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
    - **New Phase V (V1–V5) rebuilds the lost work before Phase A**: V1 Route 2 + Forest, V2 Pewter City, V3 Pewter Gym + Museum, V4 Diglett's Cave + Route 3, V5 recovered fixes (PSYCHIC #10, SFX, sim FPS O-5). Reason: Phase A's verify steps need Route 2, the Forest and Brock. The plan grows from 29 to **34** milestones.
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

---

## Open — not decided, needs the user

**O-2. Does the randomizer pool include Crystal's animated GIFs?** (2026-09-05) The user said "one of the 6 (or 7?) sprites". The 6 are settled (#23). A 7th would be `pokemonGen2/Gen2/crystal/animated/` — 252 GIFs, dex 0001–0251. It is a real option but a different feature: frame playback, not a static swap, and #6's scope freeze rejected it on the grounds that "Yellow never had that". Not blocking — X1 is dead last. Decide when X1 starts.

**O-1. ~~Route B: build the ROM from pret source at build time.~~** ✅ **RESOLVED 2026-07-29 — superseded by #14, then by #18.** First a real dump made RGBDS unnecessary; then the user decided to eliminate the ROM entirely, making this doubly moot.
