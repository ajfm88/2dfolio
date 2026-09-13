# JS Migration Plan — TypeScript to Vanilla JavaScript

> **Audience:** Grok 4.6 (or any LLM agent). This document is a complete,
> self-contained plan for converting the `zelda-nes-ts/` codebase from
> TypeScript to plain vanilla JavaScript. Read it top to bottom before
> touching any file.
>
> **Execution (2026-09-10):** three slices, Vite only (no ESLint, no tests).
> **N1 ✅** fresh export + 39 enums. **N2 ✅** strip types. **N3 ✅** rename `.ts` → `.js`
> and play L1. `zelda-nes-js/` is frozen. Do not recopy from `-ts`.

## What this project is

A ground-up reimplementation of *The Legend of Zelda* (NES, 1986) as a
browser game. It runs on localhost with Vite, Canvas 2D, and Web Audio.
**122 source files**, **91 test files**, **~21,500 lines of source**,
**~13,500 lines of tests**. The TypeScript source lives under
`zelda-nes-ts/`.

The game is fully playable (Q1 winnable end-to-end, 1313 tests passing).
The TypeScript is erased at build time by Vite/esbuild — it has zero runtime
cost. This migration is purely cosmetic: `.ts` → `.js`, strip types, keep
identical runtime behavior.

## Migration strategy

**`zelda-nes-ts/` stays untouched.** It is the living codebase where
development continues (Second Quest slices L2a3–L2b remain). The JS
migration creates a **new folder called `zelda-nes-js/`** as a clean,
standalone vanilla JS copy. Think of it as an export, not a destructive
rename.

The internal structure must mirror the TS version exactly — same `src/`
subdirectory layout:

```
zelda-nes-js/
├── public/assets/         (sprites, tiles, audio — copied as-is)
├── src/
│   ├── audio/             audio-manager.js
│   ├── core/              collision-utils.js, constants.js, etc.
│   ├── data/              asset-manifest.js, cave-data.js, *.json
│   ├── death/             death-animation.js, game-over-screen.js, etc.
│   ├── objects/
│   │   ├── enemies/       all 42 enemy .js files
│   │   ├── items/         raft.js, recorder.js, stepladder.js
│   │   ├── pickups/       item-pickup.js
│   │   ├── player/        inventory.js, link.js, shield.js, sword.js, etc.
│   │   ├── projectiles/   enemy-projectile.js
│   │   └── weapons/       arrow.js, bomb.js, boomerang.js, etc.
│   ├── render/            renderer.js, tile-renderer.js, etc.
│   ├── save/              save-manager.js
│   ├── ui/                hud.js, inventory-screen.js, title-screen.js, etc.
│   ├── world/             collision.js, dungeon-manager.js, etc.
│   └── main.js
├── index.html
├── vite.config.js
├── package.json
├── package-lock.json
└── netlify.toml
```

No `scripts/`, no `tests/`, no `tsconfig.json`, no ESLint. Just the game plus Vite.

**Setup (Windows):** robocopy `src/` and `public/` from `zelda-nes-ts/`, copy
`index.html` and `netlify.toml`, write a Vite-only `package.json`, copy
`vite.config.ts` → `vite.config.js`. Do not copy `node_modules`, `tests/`,
or `scripts/`. Then work entirely inside `zelda-nes-js/`. Never touch
`zelda-nes-ts/`.

## What to delete (inside the new JS folder)

**Delete first, before converting anything:**

| What | Why |
|---|---|
| `scripts/` (8 extract scripts + `scripts/tsconfig.json`) | Parse the NES disassembly into committed JSON in `src/data/`. Already run; JSON is committed. Not part of the game, not referenced by `src/`. |
| `tests/` (91 files, ~13,500 lines) | The TS folder keeps the canonical test suite. This JS copy is a clean portfolio export — no test runner, no test tooling. |
| `tsconfig.json` | TypeScript config. No longer needed. |
| All `extract:*` scripts from `package.json` | Gone with `scripts/`. |
| `"typecheck"` script from `package.json` | No more `tsc`. |
| `"test"` and `"test:watch"` scripts from `package.json` | Gone with `tests/`. |
| `"lint"` script and `eslint.config.js` | TS folder keeps lint. JS export is Vite only. |

**devDependencies to remove from `package.json`:**
- `typescript`
- `typescript-eslint`
- `tsx` (only used to run extract scripts)
- `vitest` (gone with tests)
- `eslint`

**Do NOT delete:**
- `netlify.toml` — owner will remove it later
- `public/` — game assets
- `src/data/*.json` — game data (committed output of the extract scripts)

After these deletions, the folder contains: `src/`, `public/`, `index.html`,
`vite.config.js`, `package.json`, `package-lock.json`, and `netlify.toml`.

## The codebase at a glance

### TypeScript features actually used

| Feature | Count | Complexity |
|---|---|---|
| **Enums** | **39** (src only) | The only runtime TS construct. Must be hand-converted |
| Interfaces | 90 | Pure type-level — delete entirely |
| Type aliases (`type X = ...`) | 17 | Pure type-level — delete entirely |
| Type annotations (`: number`, `: string`, etc.) | ~every line | Strip |
| Access modifiers (`private`/`protected`/`public`) | 816 uses | Strip (fields stay, keyword goes) |
| `readonly` | 520 uses | Strip |
| `as` type assertions | 37 | Strip |
| `import type` / `import { type ... }` | 162 | Delete the import or remove `type` keyword |
| Non-null assertions (`!`) | ~6 | Strip the `!` |
| Type guard functions (`x is Type`) | 4 in `main.ts`, 1 in `save-manager.ts` | Change return type annotation to nothing |
| Generics (`<T>`) | ~7 uses | Strip the angle brackets |
| `keyof typeof` | 6 in `asset-manifest.ts`, 1 in `dungeon-manager.ts` | Strip |
| Classes (`class X extends Y`) | 100 | **Keep as-is** — ES6 classes are valid JS |
| `extends` | 44 uses | Keep — valid JS |

### TypeScript features NOT used (no work needed)

- No `abstract` classes
- No `implements`
- No `namespace`
- No decorators
- No constructor parameter properties (checked — only 1 match, and it's just
  a `readonly` annotation on a normal parameter, not a shorthand)
- No `.d.ts` declaration files
- No `satisfies`
- No `declare` statements
- No JSX/TSX
- No generic classes

## The plan: 4 phases

### Phase 1 — Convert all 39 enums to frozen const objects

**This is the only phase that changes runtime behavior and must be done
first, before any type-stripping.**

TypeScript `enum` compiles to an IIFE that produces a real runtime object.
A type-stripper will either error on it or leave broken syntax. Convert each
one to a frozen plain object.

There are **3 categories** of enum in this codebase:

#### Category A: Sequential enums (24 enums)

These use default auto-incrementing values (0, 1, 2, ...).

```typescript
// BEFORE
export enum GameMode {
  Title,        // 0
  FileSelect,   // 1
  Gameplay,     // 2
  // ...
}

// AFTER
export const GameMode = Object.freeze({
  Title: 0,
  FileSelect: 1,
  Gameplay: 2,
  // ...
});
```

**Full list of sequential enums (24):**

| File | Enum name |
|---|---|
| `src/core/game-mode.ts` | `GameMode` |
| `src/core/types.ts` | `Direction` |
| `src/death/death-animation.ts` | `DeathPhase` |
| `src/death/game-over-screen.ts` | `GameOverOption` |
| `src/objects/enemies/armos.ts` | `ArmosPhase` |
| `src/objects/enemies/dodongo.ts` | `DState` |
| `src/objects/enemies/enemy.ts` | `EnemyState` |
| `src/objects/enemies/flyer-enemy.ts` | `FlyingState` |
| `src/objects/enemies/ganon.ts` | `GanonScenePhase` |
| `src/objects/enemies/ganon.ts` | `GanonCombatState` |
| `src/objects/enemies/goriya-boomerang.ts` | `Phase` |
| `src/objects/enemies/leever.ts` | `BurrowerState` |
| `src/objects/enemies/patra.ts` | `PatraFlyingState` |
| `src/objects/enemies/peahat.ts` | `FlyingState` |
| `src/objects/enemies/spike-trap.ts` | `TrapState` |
| `src/objects/enemies/tektite.ts` | `TektitePhase` |
| `src/objects/enemies/zelda-npc.ts` | `ZeldaState` |
| `src/objects/enemies/zora.ts` | `ZoraState` |
| `src/objects/items/recorder.ts` | `PostTunePath` |
| `src/objects/player/link.ts` | `LinkState` |
| `src/objects/player/sword.ts` | `SwordState` |
| `src/ui/ending-screen.ts` | `EndingPhase` |
| `src/ui/inventory-slide.ts` | `SlidePhase` |
| `src/ui/title-screen.ts` | `TitlePhase` |
| `src/world/push-block.ts` | `PushBlockState` |
| `src/world/tile-object.ts` | `PushState` |

#### Category B: Explicit hex/numeric value enums (13 enums)

These have explicit NES-matching values. **Preserve the exact values.**

```typescript
// BEFORE
export enum BombState {
  Idle = 0x11,
  Fuse = 0x12,
  Detonating = 0x13,
  Exploding = 0x14,
  Dead = 0x15,
}

// AFTER
export const BombState = Object.freeze({
  Idle: 0x11,
  Fuse: 0x12,
  Detonating: 0x13,
  Exploding: 0x14,
  Dead: 0x15,
});
```

**Full list of explicit-value enums (13):**

| File | Enum name | Values |
|---|---|---|
| `src/objects/player/shield.ts` | `ProjectileType` | 0x53–0x5c (NES type IDs) |
| `src/objects/weapons/arrow.ts` | `ArrowState` | 0x00, 0x10, 0x20 |
| `src/objects/weapons/bomb.ts` | `BombState` | 0x11–0x15 |
| `src/objects/weapons/boomerang.ts` | `BoomerangState` | 0x00, 0x10–0x50 |
| `src/objects/weapons/candle-fire.ts` | `FireState` | 0x00, 0x21, 0x22 |
| `src/objects/weapons/food.ts` | `FoodState` | 0x00, 0x80–0x82 |
| `src/objects/weapons/magic-rod.ts` | `RodState` | 0x00–0x05 |
| `src/objects/weapons/magic-shot.ts` | `MagicShotState` | 0x00, 0x80 |
| `src/objects/projectiles/enemy-projectile.ts` | `ProjectileState` | sequential 0/1/2 (Flying, Deflected, Dead) — **not** hex |
| `src/objects/items/raft.ts` | `RaftState` | Idle=0, MovingDown=1, MovingUp=2 |
| `src/objects/items/recorder.ts` | `RecorderPhase` | 0–5 |
| `src/objects/items/stepladder.ts` | `LadderState` | Done=0, Approaching=1, OnLadder=2 |

#### Category C: String enum (1 enum)

```typescript
// BEFORE
export enum Action {
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right',
  Attack = 'attack',
  Item = 'item',
  Start = 'start',
  Select = 'select',
}

// AFTER
export const Action = Object.freeze({
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Attack: 'attack',
  Item: 'item',
  Start: 'start',
  Select: 'select',
});
```

#### Important: no reverse mapping used

I checked — **no code in this codebase uses TypeScript enum reverse mapping**
(e.g., `Direction[0]` to get `"Up"`). All usage is forward only
(`Direction.Up`). This means the `Object.freeze()` conversion is a clean
1:1 swap with no behavioral difference.

#### Enum conversion process

For each enum:
1. Read the enum declaration
2. Convert to `const X = Object.freeze({ ... });`
3. If the enum was `export enum`, make it `export const`
4. If the enum was NOT exported (local to the file), keep it as `const`
5. **Do NOT change any code that references enum members** — `BombState.Fuse`
   works identically on a frozen object

---

### Phase 2 — Strip all type-only syntax from `src/` (122 files)

This is the bulk of the work by file count, but it's mechanical. For each
`.ts` file in `src/`, remove:

1. **`import type` statements** — delete the entire line
   ```typescript
   import type { Rect, Vec2 } from '../core/types';  // DELETE
   ```

2. **`type` keyword inside mixed imports** — remove only the `type` keyword
   ```typescript
   // BEFORE
   import { type Rect, Direction } from '../core/types';
   // AFTER
   import { Direction } from '../core/types';
   ```
   If the import has ONLY type members, delete the whole import.

3. **Interface declarations** — delete the entire block
   ```typescript
   export interface ActionState {    // DELETE
     held: boolean;                  // DELETE
     justPressed: boolean;           // DELETE
     justReleased: boolean;          // DELETE
   }                                 // DELETE
   ```

4. **Type alias declarations** — delete the entire line
   ```typescript
   export type SpriteAssetKey = keyof typeof SPRITE_ASSETS;  // DELETE
   ```

5. **Type annotations on variables, parameters, and return types** — strip
   ```typescript
   // BEFORE
   private _x: number = 0;
   // AFTER
   _x = 0;

   // BEFORE
   update(dt: number): void {
   // AFTER
   update(dt) {

   // BEFORE
   getPosition(): Vec2 {
   // AFTER
   getPosition() {
   ```

6. **Access modifiers** — strip `private`, `protected`, `public`
   ```typescript
   // BEFORE
   private _health = 6;
   protected _x = 0;
   public getHitbox(): Rect { ... }
   // AFTER
   _health = 6;
   _x = 0;
   getHitbox() { ... }
   ```
   Note: the `_` prefix naming convention stays — it's just a naming style,
   not TS syntax.

7. **`readonly`** — strip the keyword
   ```typescript
   // BEFORE
   private readonly _data: number[];
   // AFTER
   _data;
   ```
   (Or keep `_data = []` if it had an initializer.)

8. **Type assertions (`as X`)** — strip
   ```typescript
   // BEFORE
   const entries = Object.entries(manifest) as [keyof T, string][];
   // AFTER
   const entries = Object.entries(manifest);
   ```

9. **Non-null assertions (`!`)** — strip the `!`
   ```typescript
   // BEFORE
   this._canvas!.getContext('2d');
   // AFTER
   this._canvas.getContext('2d');
   ```

10. **Generic type parameters** — strip angle brackets
    ```typescript
    // BEFORE
    new Set<Action>();
    new Map<string, number>();
    new WeakSet<Bomb>();
    // AFTER
    new Set();
    new Map();
    new WeakSet();
    ```

11. **Type guard return annotations** — strip the `: x is Type` part
    ```typescript
    // BEFORE
    (e): e is Ganon => e instanceof Ganon,
    // AFTER
    (e) => e instanceof Ganon,
    ```

12. **`as const` assertions** — strip
    ```typescript
    // BEFORE
    const SPEEDS = [0x80, 0x78, 0x70] as const;
    // AFTER
    const SPEEDS = [0x80, 0x78, 0x70];
    ```

#### Files that are PURE types (delete entirely)

These files contain only interfaces, type aliases, and no runtime code:

- `src/core/types.ts` — **EXCEPT** the `Direction` enum (already converted
  in Phase 1) and any exported constants. Check if it has runtime exports
  (`Vec2`, `Rect` are interfaces → delete; `Direction` is an enum → keep).
  If only the Direction const remains, keep the file with just that.
- `src/data/dungeon-types.ts` — all interfaces, delete
- `src/data/overworld-types.ts` — all interfaces, delete
- `src/data/enemy-spawn-types.ts` — all interfaces, delete
- `src/data/item-types.ts` — check for runtime constants vs. pure types
- `src/data/sprite-types.ts` — all interfaces, delete
- `src/data/cave-text-types.ts` — check for runtime constants
- `src/data/secret-types.ts` — **HAS runtime constants** (tile object types,
  square index mappings). Keep the file, strip only the types
- `src/data/q2-overworld-types.ts` — check for runtime constants

**Before deleting a types file:** grep for imports of that file across the
entire `src/` tree. If any non-type import exists (a constant, a function),
the file has runtime exports and must be kept (with types stripped). If all
imports are `import type`, they'll be deleted in step 1 and the file can go.

#### Special file: `src/data/asset-manifest.ts`

This file uses `keyof typeof` for 6 type aliases. Delete the type aliases.
The `loadImageGroup` function uses `<T extends Record<string, string>>` as
a generic — simplify to a plain function:

```typescript
// BEFORE
async function loadImageGroup<T extends Record<string, string>>(
  manifest: T,
  basePath: string,
): Promise<Record<keyof T, HTMLImageElement>> {
  const entries = Object.entries(manifest) as [keyof T, string][];
  const result = {} as Record<keyof T, HTMLImageElement>;
  // ...
}

// AFTER
async function loadImageGroup(manifest, basePath) {
  const entries = Object.entries(manifest);
  const result = {};
  // ...
}
```

---

### Phase 3 — Rename `.ts` → `.js` and fix imports

1. **Rename all remaining `src/*.ts` files to `.js`**
2. **Do not rewrite import specifiers.** This codebase already uses `.js`
   extensions (`import { Link } from '../objects/player/link.js'`). After
   rename those paths become true. Do not strip `.js` and do not add a
   second extension.
3. **Fix `index.html`:**
   ```html
   <!-- BEFORE -->
   <script type="module" src="/src/main.ts"></script>
   <!-- AFTER -->
   <script type="module" src="/src/main.js"></script>
   ```

PowerShell rename:
```powershell
Get-ChildItem -Path src -Filter *.ts -Recurse | ForEach-Object {
  Rename-Item $_.FullName ($_.FullName -replace '\.ts$', '.js')
}
```

---

### Phase 4 — Update config files and dependencies

#### `vite.config.ts` → `vite.config.js`

Rename and keep content identical (it's already valid JS aside from the
`.ts` extension):

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'ES2022',
  },
});
```

#### ESLint — do not keep it

`zelda-nes-ts/` keeps lint/tests. The JS export is Vite only. Delete
`eslint.config.js`; do not add `@eslint/js`.

#### `package.json` — final state

**Remove devDependencies:**
- `typescript`
- `typescript-eslint`
- `tsx`
- `vitest`
- `eslint`

**Keep / add:**
- `vite`

**Final scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Changes:
- `"build"` drops `tsc &&` (no more typecheck gate)
- `"typecheck"` and `"lint"` removed entirely
- All `extract:*` scripts removed (scripts folder deleted)
- `"test"` and `"test:watch"` removed (tests folder deleted)

**Run `npm install`** after updating `package.json` to clean up
`node_modules` and regenerate the lockfile.

#### `netlify.toml` — leave as-is

The owner will delete it later. The `npm run build` command still works
(it now runs `vite build` instead of `tsc && vite build`).

---

## Verification checklist

After all 4 phases, run these in order:

- [ ] `npm run dev` — game loads at localhost, title screen appears
- [ ] Play through at least the first dungeon (give yourself items with
      the browser console: open devtools, type `__zelda.giveDungeon()`)
- [ ] `npm run build` — production build succeeds, `dist/` contains the
      bundled output
- [ ] `npx vite preview` — production build plays correctly

## Traps and edge cases

### 1. The `as const` arrays

Several files use `as const` for NES data tables:

```typescript
const QSPEED_FRACS_X = [0x80, 0x78, 0x70, 0x68, 0x60, 0x4C, 0x36, 0x20, 0x00] as const;
```

Just strip `as const` — the array becomes mutable in theory but nothing
mutates it (the `readonly` modifier that `as const` implied was a
compile-time check, not a runtime freeze).

### 2. Type-only files with runtime constants mixed in

`src/data/secret-types.ts` exports both interfaces AND runtime constants
(like `SQUARE_INDEX_CAVE_ENTRANCE`). Don't delete these files — strip the
types, keep the constants.

**Audit each `*-types.ts` file before deleting.** Grep for its name in
`src/` imports: if any import is NOT `import type`, it has runtime exports.

### 3. The `Direction` enum lives in `types.ts`

`src/core/types.ts` exports `Direction` (an enum, converted in Phase 1),
plus `Vec2` and `Rect` (interfaces, deleted in Phase 2). After Phase 2 the
file will contain only the `Direction` const. **Don't delete it** — many
files import `Direction` from there. You could optionally rename it to
`direction.js` but that changes every import path, which is unnecessary
churn.

### 4. `import type` vs regular `import`

Some files mix them:
```typescript
import { Direction } from '../core/types';
import type { Vec2, Rect } from '../core/types';
```

Delete the `import type` line. Keep the `import { Direction }` line.

If a file imports ONLY types from a module:
```typescript
import type { OverworldScreen } from './overworld-types';
```
Delete the entire line. If `overworld-types.ts` has been deleted (Phase 2),
this prevents a broken import.

### 5. Classes are fine

ES6 classes are valid JavaScript. `class Link extends Entity { ... }` works.
The only things to strip are annotations on methods/fields and the access
modifiers. Class field declarations without initializers need care:

```typescript
// BEFORE (TS)
class Foo {
  private _bar: number;
  constructor(bar: number) { this._bar = bar; }
}

// AFTER (JS) - class fields are valid in ES2022
class Foo {
  _bar;
  constructor(bar) { this._bar = bar; }
}
```

Or remove the field declaration entirely and just assign in the constructor.
Either works in ES2022 (which this project targets).

### 6. No `allowJs` shortcut

Do NOT try to add `allowJs: true` to tsconfig and rename incrementally. The
goal is to remove TypeScript entirely, not to maintain two languages. Do it
all at once.

## Recommended execution order for agents

Three slices (user, 2026-09-10). Do not batch them.

1. **N1** — Refresh `zelda-nes-js/` from `zelda-nes-ts/` (src + public +
   html + netlify, no tests/scripts/node_modules). Vite-only `package.json`.
   Convert all 39 enums. `npm run dev` → title screen. Files stay `.ts`.
2. **N2** — Strip types directory by directory:
   `core/` → `data/` → `render/` → `world/` → `objects/` → `ui/` →
   `audio/` → `save/` → `death/` → `main.ts`. Delete pure-type files.
   Title still loads.
3. **N3** — Rename `.ts` → `.js` (PowerShell `Rename-Item`), point
   `index.html` at `main.js`. `npm run build` + play L1 with
   `__zelda.giveDungeon()`.

**Estimated scope:** ~122 source files to convert + config updates. The enum
conversion (N1) is the only part that requires thought; N2 is pattern-based
deletion; N3 is rename + play.

## File inventory

### Source files to convert (122) — `src/`

```
src/audio/audio-manager.ts
src/core/collision-utils.ts
src/core/constants.ts
src/core/damage-tables.ts
src/core/debug-overlay.ts
src/core/fps-counter.ts
src/core/game-loop.ts
src/core/game-mode.ts
src/core/input.ts
src/core/types.ts
src/data/asset-manifest.ts
src/data/cave-data.ts
src/data/cave-text-types.ts
src/data/dungeon-entrance-data.ts
src/data/dungeon-types.ts
src/data/enemy-spawn-types.ts
src/data/item-sprites.ts
src/data/item-types.ts
src/data/overworld-types.ts
src/data/q2-overworld-types.ts
src/data/secret-types.ts
src/data/sprite-types.ts
src/death/death-animation.ts
src/death/game-over-screen.ts
src/death/respawn.ts
src/main.ts
src/objects/enemies/aquamentus.ts
src/objects/enemies/armos.ts
src/objects/enemies/bubble.ts
src/objects/enemies/darknut.ts
src/objects/enemies/digdogger.ts
src/objects/enemies/dodongo.ts
src/objects/enemies/drop-engine.ts
src/objects/enemies/enemy.ts
src/objects/enemies/enemy-collision.ts
src/objects/enemies/flyer-enemy.ts
src/objects/enemies/ganon.ts
src/objects/enemies/gel.ts
src/objects/enemies/ghini.ts
src/objects/enemies/gibdo.ts
src/objects/enemies/gleeok.ts
src/objects/enemies/gohma.ts
src/objects/enemies/goriya.ts
src/objects/enemies/goriya-boomerang.ts
src/objects/enemies/guard-fire.ts
src/objects/enemies/jelly-enemy.ts
src/objects/enemies/keese.ts
src/objects/enemies/lanmola.ts
src/objects/enemies/leever.ts
src/objects/enemies/like-like.ts
src/objects/enemies/lynel.ts
src/objects/enemies/manhandla.ts
src/objects/enemies/moblin.ts
src/objects/enemies/octorok.ts
src/objects/enemies/patra.ts
src/objects/enemies/peahat.ts
src/objects/enemies/pols-voice.ts
src/objects/enemies/rope.ts
src/objects/enemies/spawn-manager.ts
src/objects/enemies/spike-trap.ts
src/objects/enemies/stalfos.ts
src/objects/enemies/tektite.ts
src/objects/enemies/vire.ts
src/objects/enemies/walker-enemy.ts
src/objects/enemies/wallmaster.ts
src/objects/enemies/wizzrobe.ts
src/objects/enemies/zelda-npc.ts
src/objects/enemies/zol.ts
src/objects/enemies/zora.ts
src/objects/items/raft.ts
src/objects/items/recorder.ts
src/objects/items/stepladder.ts
src/objects/pickups/item-pickup.ts
src/objects/player/inventory.ts
src/objects/player/link.ts
src/objects/player/shield.ts
src/objects/player/sword.ts
src/objects/player/sword-beam.ts
src/objects/projectiles/enemy-projectile.ts
src/objects/weapons/arrow.ts
src/objects/weapons/bomb.ts
src/objects/weapons/boomerang.ts
src/objects/weapons/candle-fire.ts
src/objects/weapons/food.ts
src/objects/weapons/magic-rod.ts
src/objects/weapons/magic-shot.ts
src/render/boss-sprite-data.ts
src/render/canvas-layout.ts
src/render/dungeon-renderer.ts
src/render/enemy-sprite-data.ts
src/render/link-tint.ts
src/render/projectile-sprite-data.ts
src/render/renderer.ts
src/render/sprite-renderer.ts
src/render/tile-renderer.ts
src/render/transparency.ts
src/save/save-manager.ts
src/ui/bitmap-font.ts
src/ui/elimination.ts
src/ui/ending-screen.ts
src/ui/file-select-screen.ts
src/ui/heart-meter.ts
src/ui/hud.ts
src/ui/inventory-screen.ts
src/ui/inventory-slide.ts
src/ui/name-board.ts
src/ui/name-registration.ts
src/ui/tint-utils.ts
src/ui/title-screen.ts
src/ui/touch-controls.ts
src/world/cave-room.ts
src/world/collision.ts
src/world/curtain-effect.ts
src/world/dungeon-collision.ts
src/world/dungeon-manager.ts
src/world/dungeon-secrets.ts
src/world/dungeon-statues.ts
src/world/overworld-manager.ts
src/world/push-block.ts
src/world/room-flags.ts
src/world/screen-transition.ts
src/world/tile-object.ts
```

### Files to delete

```
scripts/                          (entire folder — 8 extract scripts + tsconfig)
tests/                            (entire folder — 91 test files)
tsconfig.json                     (TypeScript config)
```

### Config files to update

| File | Action |
|---|---|
| `vite.config.ts` | Rename to `.js`, content unchanged |
| `eslint.config.js` | Delete (no lint in the JS export) |
| `package.json` | Vite only: `dev` / `build` / `preview` |
| `index.html` | Change `main.ts` to `main.js` (N3) |
| `netlify.toml` | Leave as-is (owner deletes later) |
