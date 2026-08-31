# Path forward: TypeScript → vanilla JS

**Status: not started. Do this after the game is feature-complete (Phase L done),
not mid-development.** The strict TS setup (`noUncheckedIndexedAccess` +
`strict`) is currently catching real bugs in the NES data-decoding paths
(packed hitpoint tables, sprite/tile offset lookups). Stripping types removes
that net, so do it once there's no more boss/dungeon logic left to write
against.

## Why

Portfolio consistency. Every other project in this monorepo is plain JS; this
one reads as an outlier because of the `.ts` extension and type annotations,
not because of anything functional. TypeScript is fully erased at build time
already (Vite/esbuild strip it with zero runtime cost) — so this is a
presentation decision, not a technical one. Decided 2026-08-30.

## Scope

- `src/` — 103 files, ~15.7k lines
- `tests/` — 75 files, ~11.6k lines
- `scripts/extract-*.ts` — 7 disassembly-parsing scripts (run via `tsx`,
  produce the committed JSON data — these need converting too, not just
  `src/`)
- Config: `tsconfig.json` (delete), `vite.config.ts` → `vite.config.js`,
  `vitest.config.ts` → `vitest.config.js`, `eslint.config.js` (swap TS parser
  for plain JS), `package.json` devDependencies (drop `typescript`,
  `typescript-eslint`, `tsx`)

## The one real gotcha: enums

Everything else in this codebase is pure type-level syntax (interfaces,
`type`, `: number` annotations, `readonly`, generics, non-null `!`) — it
exists only at compile time and a type-stripping tool can just blank it out,
leaving valid formatted JS behind. No JSX, no decorators, no constructor
parameter-property shorthand — this codebase is clean on all of those.

`enum` is the exception. Unlike the above, `enum X { A, B }` compiles to an
actual runtime object (an IIFE with forward+reverse mapping), so it isn't
pure type syntax — a blind stripper either errors on it or leaves broken
output.

There are **33 enum declarations**, all small sequential state-machine enums
(`EnemyState`, `LinkState`, `SwordState`, `DState`, `TrapState`, etc. — full
list was enumerated during the 2026-08-30 planning pass, search
`grep -rn "^export enum\|^\s*enum " src` to regenerate it). They're all the
same shape:

```ts
enum FooState { A, B, C }
```

Hand-convert (or script, since the shape is uniform) each one to a frozen
object literal before running the stripper:

```js
const FooState = Object.freeze({ A: 0, B: 1, C: 2 });
```

Do this pass first, across all 33 files, before touching anything else.

## Recommended process

1. **Enums first.** Convert all 33 `enum` blocks to frozen const objects by
   hand or with a small regex-driven script (uniform shape makes this
   mechanical). Run `npm run typecheck` after — should still pass, since the
   frozen object is structurally compatible with existing usages that
   reference `.A`/`.B` members. Fix any place that relied on enum-specific
   behavior (reverse mapping, `typeof EnemyState` type usage) — check with a
   compile pass, since those are the spots regex conversion won't catch.
2. **Strip everything else** with a tool that *blanks* type syntax rather
   than transpiling it, to preserve exact formatting/comments/line numbers so
   the result still reads as hand-written JS (e.g. `ts-blank-space`) — not
   `tsc`'s own emit, which reformats and can inject helpers.
3. **Rename** `.ts` → `.js` across `src/`, `tests/`, `scripts/`.
4. **Update configs** per the Scope list above.
5. **Run the full test suite** (`npm test`) and `npm run dev` — confirm
   nothing regressed. There's no typecheck gate anymore, so this pass is the
   only safety net; be thorough.
6. **Optional, skip unless you want it:** re-add type-checking invisibly via
   JSDoc + `checkJs` in a `jsconfig.json` (`tsc --noEmit` against `.js`
   files, no `.ts` extension, no build step). Only worth it if you decide
   losing `noUncheckedIndexedAccess` on the table-lookup code is a real
   ongoing risk rather than an acceptable one-time cost. Considered and
   deferred in favor of a blind strip on 2026-08-30 — revisit only if the
   blind strip turns up more indexing bugs than expected during step 5.

## What NOT to do

- Don't do this before Phases H–L are finished — you'll be writing new boss/
  dungeon/save logic without the indexing guardrails that have been catching
  bugs all along.
- Don't use a transpile-and-emit approach (`tsc` build output) as the final
  artifact — it won't read as hand-written JS, which defeats the actual goal
  here.
