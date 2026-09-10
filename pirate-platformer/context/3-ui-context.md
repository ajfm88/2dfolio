# UI Context

## Theme

Warm, sun-bleached pirate pixel art. Carved wood frames, parchment panels, rope and
brass, sitting over a hazy tropical sky and a slate-blue sea. Everything is drawn
from the Pixelfrog **Treasure Hunters — Wood and Paper UI** kit, so the DOM chrome
and the canvas world read as one piece.

**There is one theme. No light mode, no dark mode, no user theming.** The palette
below is sampled from the actual sprite files, not invented — every colour here
appears in the art, so DOM panels sit against canvas art without a seam.

Two rules that hold everywhere:

- `#33323d` is the universal outline. Every sprite in the pack is outlined in it,
  so every border, divider and text shadow in the DOM uses it too.
- Pixels are never smoothed. `image-rendering: pixelated` on every sprite-backed
  element, `imageSmoothingEnabled = false` on the canvas.

## Colors

All colours are CSS custom properties on `:root`. **No hardcoded hex values in
component CSS.** If a colour is needed that is not in this table, add it here first.

### Surfaces and frame

| Role                        | CSS Variable        | Value     | Where it comes from     |
| --------------------------- | ------------------- | --------- | ----------------------- |
| Universal outline / ink      | `--ink`             | `#33323d` | every sprite outline    |
| Wood frame, mid             | `--wood`            | `#ae7764` | board frames            |
| Wood frame, warm highlight  | `--wood-light`      | `#b77357` | board bevels            |
| Wood frame, deep shadow     | `--wood-dark`       | `#833f4c` | board shadow edge       |
| Rope / strap red            | `--strap`           | `#985252` | board corner straps     |
| Strap shadow                | `--strap-dark`      | `#a04f45` | board corner straps     |
| Panel face, yellow board    | `--board`           | `#daab76` | Yellow Board            |
| Panel face highlight        | `--board-light`     | `#e7cd8d` | Yellow Button           |
| Parchment page              | `--paper`           | `#eebd8a` | Yellow Paper            |
| Parchment highlight         | `--paper-light`     | `#f7e0b3` | Yellow Paper            |
| Parchment shadow            | `--paper-dark`      | `#e09170` | Yellow Paper            |
| Stone / neutral control     | `--stone`           | `#949fa5` | Mobile Buttons          |
| Stone shadow                | `--stone-dark`      | `#777d8d` | Mobile Buttons          |
| Stone highlight             | `--stone-light`     | `#a7b8ba` | Mobile Buttons          |

### Accent and state

| Role                     | CSS Variable       | Value     | Where it comes from   |
| ------------------------ | ------------------ | --------- | --------------------- |
| Primary accent (green)   | `--accent`         | `#639d6d` | Green Board, grass    |
| Accent dark              | `--accent-dark`    | `#407769` | Green Board           |
| Accent light             | `--accent-light`   | `#7ab17a` | Green Button          |
| Text on parchment        | `--text`           | `#33323d` | Big Text outline      |
| Display / heading text   | `--text-display`   | `#dd8f61` | Big Text fill         |
| Muted text               | `--text-muted`     | `#8a6a5c` | derived from `--wood` |
| Error / damage           | `--danger`         | `#dc4949` | Life Bars, red        |
| Success / confirm        | `--success`        | `#4fbd65` | Life Bars, green      |
| Warning / treasure       | `--warning`        | `#f7ec9b` | Life Bars, yellow     |
| Info / water             | `--info`           | `#66a2d8` | Life Bars, blue       |
| Scrim behind dialogs     | `--scrim`          | `#33323dcc` | `--ink` at 80%      |

### World palette (canvas, mirrored as CSS vars for loading screens)

| Role              | CSS Variable       | Value     |
| ----------------- | ------------------ | --------- |
| Sky               | `--sky`            | `#ddc6a1` |
| Sea               | `--sea`            | `#92a9ce` |
| Horizon line      | `--horizon`        | `#f5f1de` |
| Horizon band      | `--horizon-band`   | `#d1aa9d` |
| Grass             | `--grass`          | `#639d6d` |
| Rock, light       | `--rock-light`     | `#9197b0` |
| Rock, mid         | `--rock`           | `#716b8e` |
| Rock, dark        | `--rock-dark`      | `#5a4e73` |

The page background outside the canvas is `--ink`, so letterbox bars (only ever seen
in the optional crisp-scale mode) read as an intentional frame.

## Typography

| Role                   | Font                                              | Variable        |
| ---------------------- | ------------------------------------------------- | --------------- |
| All UI text, headings  | Pixelify Sans (OFL 1.1), self-hosted woff2         | `--font-ui`     |
| Share codes, ids       | `ui-monospace, SFMono-Regular, Menlo, monospace`   | `--font-code`   |

- Full stack: `--font-ui: "Pixelify Sans", "Trebuchet MS", system-ui, sans-serif`.
- The font is **self-hosted** in `public/fonts/`, loaded with `font-display: swap`.
  Do not link to Google Fonts at runtime — the game must work offline.
- Do **not** use `runescape_uf.ttf` from `reference/super-pirate-world/graphics/ui/`. Its
  redistribution licence is unclear; Pixelify Sans is OFL and safe.
- The kit's bitmap fonts (Big Text, 36 glyphs at 10 × 11; Small Text, 52 glyphs at
  5 × 6) are uppercase-and-digits only. They are **not** used for UI text. They may
  be used later for in-canvas flourishes such as a score popup.

| Scale     | Size (at `--ui-scale: 1`) | Use                              |
| --------- | ------------------------- | -------------------------------- |
| `--fs-xl` | 24px                      | Title screen wordmark            |
| `--fs-lg` | 18px                      | Screen headings, dialog titles   |
| `--fs-md` | 14px                      | Buttons, level card names, body  |
| `--fs-sm` | 11px                      | Labels, hints, metadata          |

All sizes multiply by `--ui-scale`. Line height is `1.4` everywhere; letter-spacing
is `0` — pixel fonts already carry their own spacing.

## UI Scale

One integer variable drives every dimension so the chrome stays crisp and stays
reachable across a phone, a tablet and a desktop monitor.

```
--ui-scale: 1 | 2 | 3
```

Set once on `:root` by `src/ui/dom.js` on load and on resize:

```
uiScale = clamp(1, floor(min(vw / 480, vh / 320)), 3)
```

It is an **integer** so nine-slice borders land on whole source pixels. Every padding,
gap, border width, icon size and font size is `calc(<base> * var(--ui-scale))`.

## Border Radius

**There is no border radius anywhere.** Corners come from the nine-slice sprites.
Any `border-radius` in a stylesheet is a bug.

## Component Library

There is no third-party component library. Components are hand-written in
`src/ui/components/` and styled with the generated nine-slice sprites.

### Nine-slice panels

The kit ships boards and papers as 16 tiles of 32 × 32 arranged 4 × 4. The asset
build composites each into a single 128 × 128 PNG, which `border-image` slices at 32.

| Component        | Source                          | Slice | Border width                    |
| ---------------- | ------------------------------- | ----- | ------------------------------- |
| `.panel--board`  | `/assets/ui/board-yellow.png`   | 32    | `calc(16px * var(--ui-scale))`  |
| `.panel--green`  | `/assets/ui/board-green.png`    | 32    | `calc(16px * var(--ui-scale))`  |
| `.panel--paper`  | `/assets/ui/paper-yellow.png`   | 32    | `calc(16px * var(--ui-scale))`  |
| `.btn`           | `/assets/ui/button-yellow.png`  | 14    | `calc(7px * var(--ui-scale))`   |
| `.btn--primary`  | `/assets/ui/button-green.png`   | 14    | `calc(7px * var(--ui-scale))`   |

```css
.panel {
  border-style: solid;
  border-width: calc(16px * var(--ui-scale));
  border-image: url("/assets/ui/board-yellow.png") 32 fill /
                calc(16px * var(--ui-scale)) / 0 round;
  image-rendering: pixelated;
  border-radius: 0;
}
```

Use `round`, never `repeat` or `stretch` — `round` scales edge tiles to whole
multiples, which is the only mode that keeps pixel art from tearing mid-tile.

### Buttons

- Three variants: `.btn` (yellow, default), `.btn--primary` (green, one per screen),
  `.btn--ghost` (no frame, underlined label, for Cancel).
- States: rest, `:hover` (translate `-1px` on Y), `:active` (translate `+1px`, swap
  to the pressed nine-slice), `:disabled` (60% opacity, no pointer events),
  `:focus-visible` (2px `--paper-light` outline offset by 2px).
- **Minimum hit area is 44 × 44 CSS pixels** on every interactive element, enforced
  with `min-block-size` and `min-inline-size`, regardless of visual size.

### Life bar

Hearts use `Life Bars/Big Bars` (4 frames at 32 × 32) as `<img>` elements in a row,
one per heart, swapping frame on damage. Not canvas-drawn — the HUD is DOM.

### Form controls

- Text inputs (level name, share code paste) sit on `.panel--paper` with an inset
  `--ink` border. Native `<input>` — never a canvas-drawn caret.
- The share-code field uses `--font-code`, `readonly` on export, and pairs with a
  Copy button that reports success inline for 1.5 s.
- Sliders (music, sfx) are native `<input type="range">` restyled with the kit's
  Sliders sprites for the thumb.

## Layout Patterns

- **App shell**: `#app` is a fixed-position flex container filling the viewport.
  `#game` (the canvas) fills it; `#ui` is a sibling layer at `z-index: 1` with
  `pointer-events: none`, and each mounted panel re-enables pointer events on itself.
- **Safe areas**: every edge-anchored element pads with
  `env(safe-area-inset-*)`. Notches and home indicators must never cover a control.
- **Title**: centred column — banner wordmark, then `Play` and `Make` as two large
  stacked `.btn--primary` / `.btn`, then a small settings icon button.
- **Level select**: sticky header with two tabs (Campaign · My Levels) on a
  `.panel--board`, then a scrolling grid of level cards — 2 columns under 600px,
  3 under 900px, 4 above. Each card is a `.panel--paper` with name, theme, best
  time, and a Play / Edit / Share row.
- **Play HUD**: hearts top-left, coin count top-right, level name centred and fading
  after 2 s, pause button top-right below the coins. All anchored, never centred on
  a fixed coordinate.
- **Touch controls**: a directional cluster bottom-left and a jump button
  bottom-right, both at least 64px at `--ui-scale: 1`, `touch-action: none`,
  `user-select: none`. Shown only when a touch pointer has been seen, or when the
  control setting is forced to touch.
- **Maker**: a top bar (Back · Undo · Redo · Play · Menu) and a bottom palette bar —
  a row of category tabs above a horizontally scrolling strip of tool buttons. The
  canvas keeps the full viewport behind both bars; the left and right edges stay
  clear so a thumb can pan without hitting chrome.
- **Dialogs**: centred `.panel--board`, `max-inline-size: 480px`, over a `--scrim`
  backdrop. Focus is trapped; Escape and a backdrop tap both close.
- **Toasts**: bottom-centre `.panel--paper`, auto-dismiss at 2.5 s, one at a time.

## Icons

- No icon font, no SVG icon library.
- Directional and action glyphs come from `Wood and Paper UI/Mobile Buttons`
  (8 frames at 28 × 28), packed by the asset build into `/assets/ui/icons.png`.
- Small inline glyphs come from `Small Text/Small Icons` (25 frames at 8 × 6).
- Icons render as `<img>` or as a `background-position` offset into the packed
  sheet, always with `image-rendering: pixelated`, sized in `--ui-scale` multiples.
- Palette buttons in the maker use the entity's own `icon` clip from
  `src/data/palette.js` — never a separate hand-made icon.

## Motion

- Mode and level transitions use the expanding-circle wipe drawn on the canvas,
  ported from `reference/pirate-maker/28_finish/main.py:105`. DOM panels fade to match.
- DOM motion is limited to 120 ms `ease-out` opacity and small translate. No
  spring physics, no layout animation.
- Under `@media (prefers-reduced-motion: reduce)`, DOM transitions drop to 0 ms and
  the circle wipe becomes a 100 ms cross-fade.
