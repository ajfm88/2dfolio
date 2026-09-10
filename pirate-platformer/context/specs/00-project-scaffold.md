# Unit 00: Project Scaffold

## Goal

Scaffold the Coral Corsairs project so that `npm run dev` serves a page whose canvas
fills the viewport with no letterboxing at any window size, clears to the sky colour,
and logs a stable tick count. `npm run build` passes. Every folder boundary from
`2-architecture.md` exists and is tracked by git.

## Design

No visible UI beyond a sky-coloured canvas — this unit is pure infrastructure. The
page background outside the canvas is `--ink` (`#33323d`). The canvas fills the
viewport edge to edge.

All CSS custom properties from `3-ui-context.md` are declared on `:root`. The
`--ui-scale` variable is computed by JavaScript on load and on resize. Pixelify Sans
is self-hosted with `font-display: swap`.

## Implementation

### Git and project init

- `git init` in the repository root.
- `.gitignore`:
  ```
  node_modules/
  dist/
  reference/
  ```
  `public/assets/` is intentionally **not** ignored — it will be generated in
  Unit 01 and committed so the game works without the art pack.
- `npm init -y`.
- Install `vite` as a devDependency.
- Add scripts to `package.json`:
  - `"dev": "vite"`
  - `"build": "vite build"`
  - `"preview": "vite preview"`

### Folder skeleton

Create every directory from `2-architecture.md` with a `.gitkeep` in each empty one:

```
src/core/
src/level/
src/data/
src/game/
src/maker/
src/ui/styles/
src/storage/
tools/
public/fonts/
public/assets/
```

### `vite.config.js`

Minimal config, vanilla JS. No special plugins.

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coral Corsairs</title>
</head>
<body>
  <div id="app">
    <canvas id="game"></canvas>
    <div id="ui"></div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

### `src/settings.js`

Named exports only. Values from `2-architecture.md`:

```js
export const TILE = 32;
export const VIEW_H = 360;
export const VIEW_W_MIN = 512;
export const VIEW_W_MAX = 768;
export const ANIM_FPS = 10;
export const FIXED_DT = 1 / 60;

export const Z = {
  bg: 0,
  clouds: 1,
  bgTiles: 2,
  bgDecor: 3,
  main: 5,
  water: 6,
  fg: 7,
  fx: 8,
};
```

### `src/types.js`

Empty shell — a header comment noting that shared `@typedef` declarations will be
added in Unit 03. No content yet.

### Self-hosted Pixelify Sans

- Download `PixelifySans-Medium.woff2` into `public/fonts/`.
- Declare `@font-face` in `base.css` with `font-display: swap`.

### `src/ui/styles/base.css`

All colour tokens from `3-ui-context.md` as CSS custom properties on `:root`.
Typography variables `--font-ui`, `--font-code`, and the four font-size steps
(`--fs-xl` through `--fs-sm`), each multiplied by `--ui-scale`.

Reset:
- `html, body`: margin 0, `overflow: hidden`, `overscroll-behavior: none`,
  `background: var(--ink)`.
- `*`: `box-sizing: border-box`.
- `#app`: fixed position, inset 0, display flex.
- `#game`: flex 1, `display: block`, `image-rendering: pixelated`,
  `touch-action: none`.
- `#ui`: fixed position, inset 0, `z-index: 1`, `pointer-events: none`.
- Font: `font-family: var(--font-ui)`.
- No `border-radius` anywhere.

### `src/main.js`

1. Import `./ui/styles/base.css`.
2. Grab `<canvas id="game">` and its 2D context.
3. Viewport sizing:
   - Virtual height is always `VIEW_H` (360).
   - Virtual width = `clamp(round(VIEW_H * displayAspect), VIEW_W_MIN, VIEW_W_MAX)`.
   - `pixelScale = min(floor(min(deviceWidth / virtualWidth, deviceHeight / VIEW_H)), 2)`.
     Capped at 2 for memory.
   - Canvas backing store = `virtualWidth * pixelScale` × `VIEW_H * pixelScale`.
   - Canvas CSS size = 100% of `#app`.
   - `ctx.imageSmoothingEnabled = false`.
4. Resize handler:
   - Recalculates virtual width, pixel scale and canvas backing store.
   - Sets `--ui-scale` on `:root`:
     `clamp(1, floor(min(vw / 480, vh / 320)), 3)`.
5. Fixed-timestep loop:
   - `requestAnimationFrame` callback.
   - Accumulator receives `(timestamp - lastTimestamp) / 1000`, clamped to 200 ms.
   - While accumulator >= `FIXED_DT`, run `update(FIXED_DT)` and subtract. Cap at 5
     iterations.
   - After updates: `render()` — fill canvas with `#ddc6a1` (sky).
   - A tick counter logs ticks/second to the console once per second (for
     verification; removable later).

## Dependencies

- `vite` (devDependency) — dev server and production bundler.

## Verify when done

- [ ] `npm run dev` serves a page with no errors.
- [ ] The canvas fills the viewport edge to edge at any window size — no scrollbars,
      no letterboxing, no gap.
- [ ] Canvas clears to sky colour (`#ddc6a1`) every frame.
- [ ] Console logs a stable ~60 ticks per second.
- [ ] Resizing the browser window recalculates viewport dimensions and `--ui-scale`
      without errors.
- [ ] `npm run build` passes with no errors.
- [ ] Pixelify Sans loads (visible in DevTools → Fonts or by adding a temporary
      text element).
- [ ] No console errors or warnings during a normal run.
- [ ] Every folder from `2-architecture.md` exists and is tracked by git.
- [ ] `jsconfig.json` is present with `checkJs: true`.
