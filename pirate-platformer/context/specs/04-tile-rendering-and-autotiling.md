# Unit 04: Tile Rendering and Autotiling

## Goal

Draw terrain, platform, and water from a `LevelModel` using 4-neighbour autotile.
A fixture level shows singles, columns, bars, masses, and a hole. Only visible
cells are drawn. Autotile tests cover all 16 masks including grid edges.

No parallax, physics, or second theme.

## Implementation

### `level/autotile.js`

Mask `N=1 E=2 S=4 W=8`. Out of bounds = absent. Closed form:

`col = (e && w) ? 1 : e ? 0 : w ? 2 : 4`
`row = (n && s) ? 1 : s ? 0 : n ? 2 : 4`

Matches the 16-entry table in `2-architecture.md`.

### `data/themes.js`

Island only: sheet `tiles/island`, origin (0,0), water `bg/water-tile`.
`getTheme(id)` falls back to island. Platform layer uses the same blob sheet.

### `level/render.js`

`drawTiles(ctx, cam, viewW, viewH, level, theme, atlas)` — visible range,
terrain then platform then water. Destinations `Math.round`. No alloc in the loop.

### Fixture + `main.js`

40×12 painted level. Replace the debug grid. Captain still walks without collision.

## Dependencies

None.

## Verify when done

- [ ] Fixture shows distinct autotile edges (not one repeated square).
- [ ] Hole in the mass has inner edges.
- [ ] Water on the bottom row; a platform row mid-air.
- [ ] Autotile tests: 16 masks + grid edges.
- [ ] `npm test` and `npm run build` pass.
