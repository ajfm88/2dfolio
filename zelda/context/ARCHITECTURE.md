# ARCHITECTURE — how the pieces fit

Two trees, one direction of flow. **Nothing ever writes back into the C# tree.**

```
ladxhd_updated-main/ladxhd_game_source_code/ProjectZ.Core/   ← SPEC (read-only)
_fixtest/.../ProjectZ.Core/{Content,Data}                    ← ASSETS (read-only)
                    │
                    │  npm run assets   (build-time, one direction)
                    ▼
zelda-links-awakening-ts/
├── public/assets/          generated — gitignored, never hand-edited
├── src/
│   ├── core/               loop, time, input, math, binary readers
│   ├── formats/            .map .ani .atlas .lng .data .zScript parsers
│   ├── render/             WebGL2 batcher, camera, shaders
│   ├── world/              map loading, transitions, collision
│   ├── objects/            entities: player, things, enemies, NPCs, bosses
│   ├── ui/                 HUD, menus, pages, dialogue
│   ├── audio/              Web Audio graph, GB sound emulation
│   └── save/               SaveData model, IndexedDB
└── tests/                  vitest + golden fixtures
```

## The reference tree (what you are reimplementing)

`ProjectZ.Core` — **110,243 lines across 631 files**. Measured 2026-08-01:

| Subsystem | Files | Lines | Notes |
|---|---|---|---|
| `InGame/GameObjects` | 454 | 72,013 | **65% of the engine.** The roster. |
| ↳ `Enemies` | 109 | 18,272 | |
| ↳ `Things` | 139 | 13,639 | interactables: grass, pots, chests, doors |
| ↳ `NPCs` | 47 | 9,830 | |
| ↳ `Bosses` | 30 | 7,254 | |
| ↳ `MidBoss` | 26 | 6,912 | |
| ↳ `Base` | 55 | 4,129 | component model — **read this first** |
| ↳ `Dungeon` | 26 | 2,919 | |
| ↳ `Effects` / `Identifiers` | 16 | 749 | |
| `InGame/Overlay` | 24 | 6,363 | HUD, dialogue boxes |
| `InGame/Things` | 19 | 5,986 | shared systems |
| `InGame/Pages` | 28 | 5,123 | menus |
| `InGame/SaveLoad` | 14 | 2,734 | **the format spec** |
| `InGame/Map` | 6 | 2,286 | |
| `GbsPlayer` | 9 | 2,218 | Game Boy sound emulator |
| `InGame/Interface` | 13 | 1,928 | |
| `Base` | 20 | 1,775 | |
| `InGame/Controls` | 6 | 1,281 | |
| `InGame/Screens` | 6 | 1,289 | |
| `InGame/GameSystems` | 6 | 935 | map transition, map show |
| `InGame/Audio` | 2 | 669 | |

**The shape of the work:** two thirds is the object roster — hundreds of small,
independent behaviors. That is why the plan has 90 slices and why they parallelize
cleanly. The genuinely hard parts are small and known: the format parsers, the
shader translation, the threading model, and the GB audio emulator.

## Asset inventory (verified 2026-08-01)

`Content/` — 225 files, 25.7 MB. `Data/` — 852 files, 9.8 MB. Zero corrupt.

| Ext | Count | Browser-ready? | Spec lives in |
|---|---|---|---|
| `.png` | 228 + 31 | ✅ direct | — |
| `.wav` | 164 | ✅ direct (convert to `.ogg`) | — |
| `.ani` | 285 | ❌ parser | `Animator.cs`, `AnimatorSaveLoad.cs` |
| `.data` | 133 | ❌ parser | `MusicPlayer.cs`, map sidecars |
| `.map` | 131 | ❌ parser | `SaveLoadMap.cs` (16,987 b) |
| `.lng` | 33 | ❌ parser | `Language.cs` (8,525 b) |
| `.atlas` | 20 + 1 | ❌ parser | `DictAtlasEntry.cs` |
| `.txt` | 17 | ❌ parser | — |
| `.fx` | 20 | ❌ **translate to GLSL** | `Content/Shader/` |
| `.zScript` | 1 | ❌ lexer + parser | `DialogPathLoader.cs` |
| `.gbs` | 1 | ❌ GB sound emu | `GbsPlayer/` |
| `.spritefont`/`.fnt`/`.ttf` | 7 | ⚠ bitmap font extraction | — |

**Only the PNGs and WAVs are free.** Everything else needs a parser written from
the C# loader. There is no library for any of these formats — they are bespoke to
this engine.

## Boundaries and invariants

1. **The C# tree is read-only.** It is the spec. Never edit, never delete.
2. **`_fixtest/assets_original/` is the only copy** of the corrected migration
   inputs. Losing it means re-downloading v1.0.0 and redoing the CRLF repair.
3. **`public/assets/` is generated.** `npm run assets` must be idempotent and
   re-runnable from scratch. Never hand-edit its output.
4. **Parsers are pure.** Bytes in, plain objects out. No rendering, no globals, no
   DOM. This is what makes them testable against golden fixtures in Node.
5. **Formats are verified against the C# writer, not guessed.** Every parser slice
   cites the C# file it was derived from.
6. **`.xnb` is never used.** Compiled MonoGame content is platform-locked; DirectX
   `.xnb` embed HLSL bytecode a browser cannot execute. Source assets only.

## Known hard parts (do not discover these late)

**Threading.** The C# engine uses four real OS threads — `MusicPlayer.cs:46`,
`GbsPlayer.cs:205`, `MapTransitionSystem.cs:396`, `MapShowSystem.cs:137`. The
browser has none of that. The two map-loading threads become async/coroutines
(slice E2); the audio threads become an `AudioWorklet` (slice L5).

**Shaders.** 20 `.fx` files are HLSL. WebGL2 needs GLSL ES 3.00. These are simple
2D post-effects — blurs, tints, wobble, a pixel grid — so translation is
mechanical, but it is 20 separate translations (slices C7–C9).

**GB sound emulation.** `GbsPlayer/` is a real Game Boy CPU + APU:
`GameBoyCPUInstructions.cs` alone is 51,085 bytes, `Sound.cs` 29,643 bytes. This
powers the *classic* music mode. It is self-contained and **deferrable** — ship
streamed audio first (L1–L2), emulate later (L3–L5).

**Platform-locked C# to ignore.** `Game1.cs` uses `System.Windows.Forms` (lines
57, 263, 828–914) and `DllImport("SDL2")` (168–171) for windowing. Browser
equivalents are the canvas and the Fullscreen API. Do not port these literally.

## Reference material, ranked

1. **`ProjectZ.Core/`** — the implementation. Authoritative for all behavior.
2. **`CHANGELOG.md`** (169 KB) — *why* behavior is the way it is. Hundreds of
   entries of the form "fix X to match the original game." When a behavior looks
   arbitrary, search here before assuming it is a bug.
3. **`MANUAL.md`** — player-facing feature list; good for scoping menus.
4. **`ANDROID.md`** — the closest existing port to a browser target (OpenGL ES, no
   WinForms, touch input). Useful when a desktop assumption blocks you.
