# Architecture Context

Short version for orientation. The full subsystem table, asset inventory and
known hard parts live in `../ARCHITECTURE.md`.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Game engine | TypeScript (strict) + **WebGL2** | Full reimplementation, not emulation |
| Build/dev | Vite | Dev server, bundling, `public/` static serving |
| Asset pipeline | Node + `tsx` | Build-time source assets → browser-ready (`npm run assets`) |
| Tests | vitest | Format parsers vs golden fixtures; gameplay units |
| Audio | Web Audio API + `AudioWorklet` | SFX, music streaming, later GB emulation |
| Storage | IndexedDB | Save slots (the C# writes files) |
| Reference | `ProjectZ.Core` C# (110,243 lines) | Authoritative for all behavior |

Canvas 2D is **not** the target — the original leans on 20 shader effects, and
WebGL2 is what makes those tractable (`../DECISIONS.md` #6).

## Data flow

```
ProjectZ.Core/*.cs          ──read by a human──►  src/**/*.ts
  (spec, never compiled)                          (hand-written)

Content/ + Data/            ──npm run assets──►   public/assets/
  (source assets, read-only)                      (generated, gitignored)
                                                        │
                                                   fetch() at runtime
                                                        ▼
                                              browser @ 127.0.0.1:5173
```

One direction only. Nothing writes back into the reference trees.

## Layer boundaries

```
src/core/     loop, time, input, math, BinaryReader     ← depends on nothing
src/formats/  .map .ani .atlas .lng .data .zScript      ← depends on core only
src/render/   batcher, textures, camera, shaders        ← depends on core
src/world/    map loading, transitions, collision       ← depends on formats+render
src/objects/  player, things, enemies, NPCs, bosses     ← depends on world
src/ui/       HUD, menus, pages, dialogue               ← depends on render+formats
src/audio/    Web Audio graph, GB emulation             ← depends on core
src/save/     SaveData, IndexedDB                       ← depends on objects
```

Dependencies point **downward only**. A parser importing from `render/` is a bug.

## Invariants

1. **`src/formats/` is pure.** `(bytes: Uint8Array) => ParsedThing`. No DOM, no
   fetch, no globals. This is what lets parsers be tested in Node against fixtures,
   and it is the single most important structural rule in the project.
2. **The C# tree and `_fixtest/` are read-only.** Spec and assets. Never edit.
3. **`public/assets/` is generated.** Never hand-edit; `npm run assets` must
   reproduce it from scratch, idempotently.
4. **Binary I/O only for the bespoke formats.** CRLF is load-bearing in `.map`,
   `.atlas`, `.mgcb`, `.fx`, `.spritefont` and `.txt` — see `../DECISIONS.md` #5.
5. **No `SharedArrayBuffer`.** Threading is replaced by async and an
   `AudioWorklet`, not by emulating OS threads (`../DECISIONS.md` #7).

## What replaces what

The C# makes desktop assumptions that have no browser equivalent. Do not port
these literally:

| C# | Where | Browser replacement |
|---|---|---|
| `System.Windows.Forms` windowing | `Game1.cs:57,263,828–914` | canvas + Fullscreen API |
| `DllImport("SDL2")` | `Game1.cs:168–171` | — (drop entirely) |
| Map-loading `Thread` | `MapTransitionSystem.cs:396`, `MapShowSystem.cs:137` | async / coroutine (slice E2) |
| Audio `Thread` | `MusicPlayer.cs:46`, `GbsPlayer.cs:205` | `AudioWorklet` (slice L5) |
| `NativeFileDialogSharp` | `SaveLoadMap.cs:8`, `DataMapSerializer.cs:5` | — (editor only, out of scope) |
| Filesystem save games | `SaveGameSaveLoad.cs`, `SaveManager.cs` | IndexedDB (slice M1) |
| `.xnb` compiled content | MonoGame pipeline | our own `npm run assets` |

## Useful cross-reference

The upstream **Android** head (`ProjectZ.Android`, plus `ANDROID.md`) is the
closest existing port to a browser target: OpenGL ES instead of DirectX, no
WinForms, touch input, no filesystem assumptions. When a desktop assumption in
`Core` blocks you, check how the Android build handles it before inventing an
answer.
