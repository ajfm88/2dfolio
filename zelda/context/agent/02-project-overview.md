# zelda — Link's Awakening DX HD in the browser, native TypeScript

## Overview

A personal hobby project (never distributed) that reimplements *The Legend of
Zelda: Link's Awakening DX HD* as pure browser TypeScript. Unlike the previous
project on this context system, **the engine does not exist yet** — it is being
written from scratch against a C# reference implementation.

**As of 2026-08-01:**

- Asset pipeline solved: 225 `Content` + 852 `Data` files migrated to v2.0.2 and
  verified clean.
- C# reference secured: 631 files, 110,243 lines.
- **Zero TypeScript written.** `zelda-links-awakening-ts/` is empty.
- Scope agreed: **90 atomic slices, ~3 months.**

## What we are building

`npm run dev` → open `http://127.0.0.1:5173/` → play the game. No .NET, no
MonoGame, no WASM runtime, no emulator. TypeScript, WebGL2 and Web Audio only.

Target is **feature parity with v2.0.2**, the final upstream release: the full
overworld and eight dungeons, both camera modes (modern and Classic screen-based
scrolling), the complete item set, the achievements system, and 11 languages.

## Where it came from

Three generations of provenance:

1. An anonymous developer released a MonoGame PC port on itch.io. Taken down, but
   the release included source.
2. `bighead.0` forked and maintained it on GitLab through **v2.0.2** — hundreds of
   accuracy fixes, five platform heads (Windows, Linux, macOS, Android), a 169 KB
   changelog. Upstream is now finished; v2.0.2 is the last release.
3. This project: C# → TypeScript, desktop → browser.

Upstream ships **without assets** to avoid distributing Nintendo's copyrighted
work. Recovering them meant applying 457 binary patches to a pristine v1.0.0
install — a process that failed initially and needed real diagnosis
(`../DECISIONS.md` #5).

## Success criteria

| # | Criterion |
|---|---|
| 1 | Full playthrough start → credits in a browser, no crashes |
| 2 | Behavioral parity with the C# original; documented deviations only |
| 3 | 60 fps stable on the user's machine |
| 4 | `npm run typecheck` and `npm test` clean at every stop point |
| 5 | Assets reproducible from scratch via `npm run assets` |
| 6 | Any agent can claim a slice and finish it in one session |

## Scope boundaries

**In:** the game. Both cameras, all items, all eight dungeons, menus, save/load,
achievements, audio.

**Out — permanently:** publishing or hosting of any kind (`../DECISIONS.md` #1).
This runs on localhost and nowhere else. The assets are Nintendo's; a public URL
would distribute them.

**Out — for now:** the level editor, mod support (`.lahdmod`/`.lahdpak`), touch
and mobile controls, and Game Boy sound-chip emulation (parked as slices L3–L5 so
it cannot block the critical path — streamed audio ships first).

## Why this is tractable despite 110k lines

Two thirds of the engine (`GameObjects/`, 454 files, 72,013 lines) is the object
roster: hundreds of small, independent behaviors — an Octorok, a pot, a chest, a
switch. These are individually simple and highly parallel, which is what makes 90
small slices a sensible shape for the work.

The genuinely hard parts are narrow and already identified: the bespoke asset
parsers (phase B), 20 HLSL shaders needing GLSL translation (C7–C9), replacing
four OS threads with async and an AudioWorklet (E2, L5), and a Game Boy CPU+APU
emulator (L3–L5, parked). Nothing else is research — it is transcription.
