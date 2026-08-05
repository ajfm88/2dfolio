# DECISIONS — settled choices and why

Don't relitigate without new information. Add new entries at the bottom, dated.

1. **Localhost only, permanently — never published** (2026-08-01). The user
   confirmed this explicitly when scoping the port. The assets are Nintendo's
   copyrighted work; a public URL would serve them to anyone loading the page.
   Running locally is a different situation from distributing. This is a *scope*
   decision, not a deferral: there is no "deploy later" phase. Nothing in the
   codebase should assume a public origin, a CDN, or an analytics endpoint.

2. **Native TypeScript rewrite, not C#-to-WASM** (2026-08-01). Blazor/KNI was
   evaluated first and is genuinely viable — the upstream project already ships
   five platform heads off one shared `Core`, so a sixth is architecturally
   routine. The user chose a native TS/JS rewrite instead. Consequence, and it is
   a large one: the C# is no longer *build input*, it is the **specification**.
   ~110k lines get reimplemented by hand. This is why `ladxhd_game_source_code`
   is the single most important thing in the tree and must never be deleted.

3. **Source assets only — `.xnb` is never used** (2026-08-01). The v1.0.0
   [Windows-DirectX] release ships 207 compiled `.xnb` files. Those are
   platform-locked: DirectX `.xnb` embed compiled HLSL bytecode that WebGL cannot
   execute, and the format is MonoGame-version-specific. We use the *source*
   assets (`.png`, `.wav`, `.fx`, `.map`, …) and build our own pipeline. This is
   also why deleting `ladxhd_patcher_source_code` (512 MB of `.xnb.vcdiff`) was
   safe.

4. **`master`-fork C# source discarded; `ladxhd_updated-main` is the reference**
   (2026-08-01). Two C# trees existed. The `Links-Awakening-DX-HD-master` fork was
   .NET 6 / MonoGame 3.8.1.303, Windows-only, 565 files, no changelog — effectively
   v1.0.0 with build tweaks. `ladxhd_updated-main` is v2.0.2, .NET 8, MonoGame
   3.8.4.1, 631 files, multi-platform, with a 169 KB changelog. The old fork was
   deleted after its *assets* were preserved.

5. **The CRLF discovery — why migration failed and how it was fixed**
   (2026-08-01). Applying the 457 `.vcdiff` patches failed immediately: exit code
   2, one 0-byte output file. The cause was **not** the Migrater-2.0.0 /
   patches-2.0.2 version gap (a red herring, since disproven — that combination
   works). The `master` fork had been committed through git with text
   normalization, converting every CRLF to LF. Evidence: all 697 `Data` files
   differed byte-for-byte with same names; every size delta was negative and
   proportional to line count; `ui.png` had delta **0** (binaries untouched);
   `overworld.map` began `51 13 10` in the pristine copy vs `51 10` in the fork.

   **Fix:** take `Data` from the pristine v1.0.0 release, take `Content` from the
   fork (the release has only `.xnb`), and restore CRLF on the **25** text-extension
   files (`.mgcb`, `.fx`, `.spritefont`, `.atlas`, `.txt`). `Content.mgcb` goes
   36,160 → 37,526 bytes. Result: exit 0, 225 + 852 files, zero corrupt.

   The corrected inputs are preserved at `_fixtest/assets_original/`. **This is the
   only copy** — both source folders and both Desktop backup zips are gone.

   *Lesson worth keeping:* a mirrored git copy of a binary-asset tree is not a
   faithful copy. Check `.gitattributes` before trusting one.

6. **`.fx` shaders are translated to GLSL by hand, not cross-compiled**
   (2026-08-01). 20 HLSL files, all simple 2D post-effects. A toolchain
   (MojoShader/mgfxc) would be more machinery than the job needs, and produces
   output nobody can debug. Hand translation across three slices (C7–C9) yields
   readable GLSL we own. Revisit only if a shader turns out non-trivial.

7. **Threading becomes async + AudioWorklet, never SharedArrayBuffer**
   (2026-08-01). The C# engine uses four OS threads. WASM-style threading in the
   browser needs `SharedArrayBuffer`, which needs COOP/COEP headers — real
   complexity for a localhost hobby build. Instead: the two map-loading threads
   (`MapTransitionSystem.cs:396`, `MapShowSystem.cs:137`) become async/coroutines
   (slice E2), and audio (`MusicPlayer.cs:46`, `GbsPlayer.cs:205`) becomes an
   `AudioWorklet` (slice L5).

8. **Streamed audio first, GB emulation later** (2026-08-01). `GbsPlayer/` is a
   full Game Boy CPU + APU (`GameBoyCPUInstructions.cs` 51 KB, `Sound.cs` 29.6 KB)
   and exists only to drive *classic* music mode. Slices L3–L5 are parked so it
   cannot block the critical path. The game is fully playable with L1–L2.

9. **90 atomic slices over ~3 months** (2026-08-01, user). One slice per session,
   claimed from the tracker queue, finished and logged before stopping. When a
   slice proves too big, split it with a letter suffix (`H4a`, `H4b`) rather than
   silently expanding scope.

10. **Behavioral authority: C# source > CHANGELOG > intuition** (2026-08-01). The
    upstream project spent years fixing subtle divergences from the Game Boy
    original. Behavior that looks arbitrary usually is not — `CHANGELOG.md` has
    hundreds of entries explaining exactly why. Search it before "fixing" anything.
    Any deliberate deviation needs an entry here.

11. **v1 ships English + Spanish only** (2026-08-01, user). Resolves the former
    open question on language scope. The asset tree carries **11 languages across
    93 variant files** (70 `.png`, 20 `.lng`, 2 `.fnt`, 1 `.atlas`).

    **Keep:** English (the un-suffixed base assets, plus `eng.lng`,
    `achieve_eng.lng`, `dialog_eng.lng`) and Spanish (`esp` suffix — `esp.lng`,
    `achieve_esp.lng`, `dialog_esp.lng`, plus ~10 `_esp` PNGs).

    **Drop from v1:** `chn`, `deu`, `fre`, `ind`, `ita`, `por`, `pte`, `rus`, `swe`.

    **The loader stays generic.** This is an *asset-pipeline filter*, not a
    hard-coded two-language design. Adding a language later must be a one-line
    change to the allow-list in `npm run assets` plus re-running it — never a code
    change. Any parser or UI that assumes exactly two languages is a bug.

    Two useful consequences: dropping `chn` removes the CJK glyph work from slice
    B12 entirely (no `smallFont_chn*.fnt`, no wide-glyph atlas path), and it drops
    the only language-variant `.atlas` (`intro_chn.atlas`), so slice B1 handles a
    uniform set.

## Open questions for the user

- **`_fixtest` is a bad permanent name** for the asset home. Suggest renaming to
  `assets-v2.0.2/`. Not done unilaterally because `PLAN.md` slice A3 and several
  docs reference the path. Cheap to do before A3 starts; annoying after.
- **`context/README.md`** (33 KB) is the leftover third-party article from the
  Pokemon project. Nothing in the Zelda system references it. Delete?
- **Rendering target:** WebGL2 assumed throughout. WebGPU would be a defensible
  alternative but has no advantage for a 2D game and narrows browser support.
  Flag if you disagree before slice C1.
- ~~**Language scope**~~ — resolved 2026-08-01, see #11 (English + Spanish).
