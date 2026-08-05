# Code Standards

## General

- **The C# is the spec.** Before writing a subsystem, open the matching
  `ProjectZ.Core` file and match its behavior exactly. Do not invent mechanics,
  do not "improve" timings, do not simplify a state machine because it looks
  over-complicated. It usually encodes a fix — check `CHANGELOG.md`.
- **Fix root causes.** If parsed data does not load, the parser is wrong. Do not
  patch the consumer to tolerate bad data.
- **One concern per file.** One parser per format. One entity per file, mirroring
  the C# layout so cross-referencing stays cheap.
- **Small, verifiable steps.** Parse one format, validate against all its files,
  move on. Every slice ends with something demonstrable.

## TypeScript

- **Strict everything:** `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`. `npm run typecheck` clean at every stop point.
- **No `any`.** Use `unknown` and narrow. A parser returning `any` defeats the
  entire point of phase B.
- **No non-null `!` on parsed data.** Parsed input is untrusted; narrow properly.
- **Prefer plain objects and functions.** The C# is deeply OO because C# is.
  Entities and systems warrant classes; parsed data structures do not.
- **`readonly` on parsed output.** Parsers return frozen data; mutation belongs to
  the runtime layer.
- **Typed arrays for hot paths.** Tile grids, vertex buffers and audio buffers are
  `Uint8Array`/`Int32Array`/`Float32Array`, never `number[]`.

## Parsers (`src/formats/`) — the strictest rules in the project

1. **Pure.** `(bytes: Uint8Array) => ParsedThing`. No DOM, no fetch, no globals,
   no side effects.
2. **Cite the source.** Every parser file opens with a comment naming the C# file
   and line range it was derived from. Example:
   `// Derived from ProjectZ.Core/InGame/SaveLoad/SaveLoadMap.cs:112-268`
3. **Never guess.** If the format is unclear, read more C#. Do not infer structure
   from a hex dump and hope. Guessing is the single most likely way this project
   stalls.
4. **Parse everything.** The gate is "all N files of this type parse," not "the one
   I tested parses." 285 `.ani` means 285.
5. **Read bytes, not text.** CRLF is load-bearing (`../DECISIONS.md` #5). Never
   route a bespoke format through a string round-trip.
6. **Fail loudly.** Throw with offset and expected-vs-actual on malformed input.
   Silent fallbacks hide corruption until it surfaces somewhere unrelated.

## Naming

- **Mirror the C# names.** If the C# calls it `ObjAnimatedTile`, so do we. If a
  field is `CurrentAnimationIndex`, keep the concept — `currentAnimationIndex` in
  TS casing. Renaming things to feel nicer costs you every future lookup.
- Files: `kebab-case.ts`. Types and classes: `PascalCase`. Functions and
  variables: `camelCase`. Constants: `SCREAMING_SNAKE`.
- Parsers are named for their format: `src/formats/map.ts`, `ani.ts`, `atlas.ts`.

## Testing

- **Golden fixtures** for parsers: a small committed sample of real asset bytes
  plus expected parsed output. The harness lands in slice A7.
- **The "all files parse" test** is the real gate for each B slice. Wire it as a
  test so it stays enforced as the parser evolves.
- **Spot-check something awkward.** Not the simplest case that happens to work — a
  map with a sidecar `.data`, a boss with multiple phases, a derivative language
  file. The easy case passing proves very little.
- Gameplay tests go where behavior is deterministic: collision resolution, damage
  and knockback math, inventory state, save round-trips. Do not chase coverage on
  rendering.

## Comments

- Comment **why**, not what. The what is in the C# you are transcribing.
- When you match a non-obvious C# behavior, say so and cite it. The next agent
  will otherwise "simplify" it back out.
- When `CHANGELOG.md` explains a behavior, quote the one relevant line. That is
  what stops a future session from treating a deliberate fix as a bug.

## Things that will bite you

- **CRLF.** Covered above and in `../DECISIONS.md` #5. It cost two sessions once
  already.
- **Depth sorting.** The C# has explicit depth semantics; sprites drawn in naive
  order will look subtly wrong everywhere and obviously wrong nowhere.
- **Fixed timestep.** Gameplay logic assumes a fixed update rate. Do not
  multiply movement by a variable delta and hope it matches.
- **Tileset image width is load-bearing** in engines of this shape — tiles-per-row
  is derived from it. Verify against the C# before resizing or repacking any
  tileset PNG.
