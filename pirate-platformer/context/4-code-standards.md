# Code Standards

## General

- Keep modules small and single-purpose. A file that needs a table of contents is
  two files.
- Fix root causes. Do not add a flag, a guard or a `setTimeout` to paper over a bug
  whose cause has not been found.
- Dependencies point inward: `ui` → `game`/`maker` → `level` → `core`. Never the
  reverse. `core/` imports nothing from the project except `settings.js`.
- Do not mix concerns in one module. Rendering, simulation, serialisation and DOM
  are four different jobs.
- Delete dead code immediately. Do not comment it out "for later" — git has it.
- No `TODO` comments without a matching entry in `7-current-issues.md`.

## JavaScript

This project is **JavaScript, not TypeScript**. Type safety comes from JSDoc plus
`jsconfig.json` with `checkJs: true`, which gives editor diagnostics with no build
step and no migration.

- Target ES2022. Native modules only — no CommonJS, no bundler-specific syntax.
- `const` by default, `let` when reassigned, **never `var`**.
- Annotate every exported function and class with JSDoc: `@param`, `@returns`.
  Internal helpers need annotation only where the type is not obvious.
- Shared shapes live as `@typedef` in `src/types.js` and are imported with
  `@import` or `{import('../types.js').LevelData}`. Do not redeclare a shape in two
  files.
- No `any`-equivalent escape hatches. If a type cannot be expressed, narrow the
  value at the boundary instead.
- Validate unknown external input — parsed JSON, share codes, `localStorage` reads,
  URL params — at the boundary before anything downstream trusts it.
- Prefer plain objects and arrays over `Map`/`Set` in hot paths; prefer `Map` for
  keyed lookups that are built once and read many times.

## Modules and Imports

- **Named exports only. No default exports.** Renaming stays greppable and imports
  stay consistent.
- **No barrel files.** No `index.js` that re-exports a folder. They hide the
  dependency graph and defeat tree shaking.
- **No `import * as`.** This is the explicit rejection of the reference projects'
  `from settings import *` — the single biggest readability cost in the Python
  source. Import exactly what is used.
- Import paths are relative within `src/` and always carry the `.js` extension.
- Import order, separated by blank lines: engine (`core/`), shared level modules
  (`level/`), data (`data/`), local siblings. No other grouping rules.

## Naming

| Thing                        | Convention               | Example                     |
| ---------------------------- | ------------------------ | --------------------------- |
| Files and folders            | kebab-case               | `play-scene.js`             |
| Classes                      | PascalCase               | `LevelModel`, `Crabby`      |
| Functions, variables         | camelCase                | `encodeLevel`, `tileIndex`  |
| Engine constants             | SCREAMING_SNAKE          | `TILE`, `VIEW_H`            |
| Tuning values                | camelCase in an object   | `tuning.jumpVelocity`       |
| Entity kind ids              | snake_case strings       | `'palm_back'`, `'crabby'`   |
| CSS classes                  | BEM-ish, kebab-case      | `.panel--paper`, `.btn`     |
| Test files                   | `<module>.test.js`       | `codec.test.js`             |

One entity class per file; the file name is the class name in kebab-case.

## Constants

- Engine and layout constants — `TILE`, `VIEW_H`, `VIEW_W_MIN`, `VIEW_W_MAX`,
  `ANIM_FPS`, `FIXED_DT`, `Z` — live in `src/settings.js` and nowhere else.
- Gameplay numbers — speeds, gravity, jump height, timers, damage, coin values —
  live in `src/data/tuning.js` and nowhere else.
- Per-entity numbers — hitbox size, sprite offset, clip names — live in that
  entity's entry in `src/data/palette.js` or as static fields on its class.
- **A raw number in `game/`, `maker/` or `level/` is a bug** unless it is `0`, `1`,
  `-1`, `2` used as a divisor for a midpoint, or an array index.
- Hitbox sizes and sprite offsets are **measured from the sprite's idle frame's
  opaque bounds**, never guessed. Record the measurement in a comment next to the
  value, e.g. `// idle frame 64x40, art at x20 y4 w24 h28`.

## Engine Contracts

Every simulated object implements exactly this shape:

```js
/** @param {World} world @param {{c:number, r:number}} cell */
constructor(world, cell) {}
update(dt) {}          // dt is always FIXED_DT; never touches ctx or document
draw(ctx, cam) {}      // never mutates state
hitbox                 // {x, y, w, h} in world pixels
z                      // draw layer from settings.Z
```

- `update(dt)` receives the fixed timestep. It must not read `performance.now()`,
  `Date.now()` or the rAF delta. Timers count down in seconds against `dt`.
- `draw(ctx, cam)` must not mutate anything, including `frameIndex`. Advance
  animation in `update`.
- Every object snapshots `oldRect` at the top of `update` before moving, so the
  collision resolver can compare old and new edges.
- Behaviour is selected by explicit capability fields — `solid`, `semiSolid`,
  `damages`, `stompable`, `carries` — never by `instanceof` or
  `constructor.name`.

## Rendering

- Round draw destinations with `Math.round`, **never `| 0` or `~~`** — those
  truncate toward zero and jitter by one pixel whenever the camera offset is
  negative.
- Draw only what intersects the camera rect. Iterate the visible cell range, not
  the whole grid.
- **No allocation in the per-frame path.** No object or array literals, no closures,
  no `.map`/`.filter`/`.reduce` inside `update` or `draw` loops. Use module-level
  scratch objects and plain `for` loops. Mobile GC pauses are the main frame-time
  risk in this project.
- Rectangles are plain `{ x, y, w, h }` objects with helpers in `core/rect.js`.
  No `Rect` class — allocation cost is not worth the ergonomics.
- One `ctx.save()`/`restore()` pair per frame at most. Set transform once.

## Input

- All keyboard, mouse, touch and pen input goes through `src/core/input.js`.
  **No `addEventListener` anywhere in `game/`, `maker/` or scene code.**
- Use **Pointer Events** only. No separate mouse and touch paths, no
  `TouchEvent` handlers.
- Elements that receive drags set `touch-action: none` in CSS, not by calling
  `preventDefault` on every move.
- The input module exposes edge-triggered state (`pressed`, `released`) as well as
  held state, so gameplay never has to track "was down last frame" itself.
- **Never trigger `alert`, `confirm` or `prompt`.** Use a DOM dialog component.

## DOM and CSS

- The canvas renders the world only. Every panel, button, label and control is DOM.
- Only `src/ui/`, `core/input.js` and `core/viewport.js` may touch `document`.
- Build DOM with small factory functions in `src/ui/dom.js`. No template-string
  `innerHTML` with interpolated user data — set `textContent` instead.
- CSS lives in `src/ui/styles/`, one file per screen or component, imported from
  the module that owns it.
- Use the tokens from `3-ui-context.md`. **No hardcoded hex values, no
  `border-radius`, no magic pixel sizes** — every dimension is a
  `calc(<base> * var(--ui-scale))`.
- Every interactive element is at least 44 × 44 CSS pixels and has a
  `:focus-visible` style.
- Edge-anchored elements pad with `env(safe-area-inset-*)`.

## Data and Storage

- Only `src/storage/` touches `localStorage`, and only through
  `safe-storage.js`, which wraps every access in try/catch and falls back to an
  in-memory map. Private browsing must degrade, never throw.
- Levels are stored already-compressed, as share codes, never as raw JSON.
- Serialisation lives only in `src/level/codec.js`. Nothing else calls
  `JSON.stringify` on a level.
- `src/level/schema.js` validates on every load and **throws with a message naming
  the offending field**. Scenes catch at their boundary and show a toast. Never
  coerce invalid level data into something that "mostly works".
- Quota exhaustion is surfaced to the user with a clear message and a way to free
  space, never swallowed.

## Async

- `await` appears only in boot, asset loading, clipboard access and compression.
  **The game loop is entirely synchronous.**
- No promise chains in `update`. If something must happen later, it is a timer in
  fixed-timestep seconds.
- Every `await` on an external API — clipboard, `CompressionStream`, `fetch` — is
  wrapped in try/catch with a user-visible fallback.

## Testing

- `vitest`, with tests colocated as `<module>.test.js`.
- **Tested**: `level/codec.js` (round-trip fidelity, malformed input),
  `level/autotile.js` (all 16 masks, grid edges), `level/schema.js` (every
  validation rule), `game/physics.js` (each resolution case), and any pure helper.
- **Not tested**: rendering, DOM, scenes, audio. These are verified by running the
  game, which is what the per-unit verification checklist is for.
- A bug fixed in a tested module gets a regression test in the same commit.

## Patterns Rejected From the Reference Projects

The Python projects are excellent references, but these specific patterns are
deliberately not ported:

| Reference pattern                                                          | What we do instead                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `from settings import *` (every file)                                       | Explicit named imports                                           |
| Frame-dependent gravity (`PirateMaker/28_finish/sprites.py apply_gravity`)  | Fixed 1/60 timestep accumulator                                  |
| A long `match`/`case` over integer ids in `level.py build_level`            | Registry lookup in `data/palette.js`                             |
| Animation frames ordered by OS directory walk                               | Explicit frame counts in the generated atlas manifest            |
| Free-floating objects with pixel offsets (`CanvasObject.distance_to_origin`) | Everything grid-snapped                                          |
| `pygame.sprite.Group` implicit iteration order                              | Explicit `z` sort, stable and declared in `settings.Z`           |
| Module-level mutable globals                                                | Dependencies passed into constructors                            |
| Canvas-drawn menus and buttons (`PirateMaker/28_finish/menu.py`)            | DOM UI                                                           |

## File Organization

- `src/core/` — loop, viewport, camera, input, atlas, sprite, audio, rect, rng.
  Engine only; no game knowledge.
- `src/level/` — `model.js`, `codec.js`, `autotile.js`, `schema.js`, `render.js`.
  Shared by both modes.
- `src/data/` — `palette.js`, `themes.js`, `tuning.js`, `atlas.json` (generated),
  `campaign/*.json`. Declarative; no logic beyond factory references.
- `src/game/` — `play-scene.js`, `world.js`, `physics.js`, `player.js`,
  `entities/`, `hazards/`, `collectibles.js`.
- `src/maker/` — `maker-scene.js`, `commands.js`, `tools.js`, `validate.js`,
  `grid-overlay.js`.
- `src/ui/` — `dom.js`, `screens/`, `components/`, `styles/`.
- `src/storage/` — `safe-storage.js`, `levels.js`, `progress.js`,
  `settings-store.js`.
- `tools/` — Node-only build scripts. Never imported by `src/`.
- `public/assets/` — generated. **Never hand-edited.**

## Formatting

- 2-space indentation. The Python references use tabs; we do not.
- Single quotes, semicolons, trailing commas in multiline literals.
- 100 column soft limit.
- Comments explain **why**, not what. When porting a non-obvious algorithm, cite the
  source: `// ported from Super-Pirate-World code_complete/player.py semi_collision`.
