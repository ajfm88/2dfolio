# Unit 03: Level Model and Codec

## Goal

The shared level format: in-memory `LevelModel`, schema validation that names the
offending field, RLE tile layers, JSON, and share codes (`z` deflate-raw and `u`
uncompressed). `npm test` passes. The Captain demo is unchanged.

## Design

No canvas work. This unit is pure data and tests.

`core/` stays independent. `level/` does not import `palette.js` (it does not
exist yet). Kind ids are validated as non-empty strings only.

## Implementation

### `src/types.js`

`@typedef`s: `Cell`, `LayerName`, `EntityRecord`, `DecorRecord`, `LevelData`.

### `src/level/schema.js`

`FORMAT = 1`. Limits: cols 40–400, rows 12–48, ≤ 400 entities, ≤ 2000 decor.
Defaults 160 × 24. `LevelError` with a `field` property. `validateLevel(unknown)`
throws on every rule in `2-architecture.md`. `createBlankLevel(opts)` produces a
valid empty level.

Do not check `k` against a kind registry.

### `src/level/model.js`

`LevelModel`: `Uint8Array` per layer (`terrain`, `platform`, `water`), entity and
decor arrays, spawn/goal markers. `tileIndex`, `get`, `set`, `inBounds`, `resize`
(copy overlap, drop OOB entities/decor, clamp spawn/goal).

### `src/level/codec.js`

Only module that `JSON.stringify`s a level. RLE encode/decode. `serialise` /
`deserialise`. `encodeShare` / `decodeShare` with prefix `z` (deflate-raw) or `u`
(uncompressed). Unknown prefix throws. Missing `CompressionStream` falls back to
`u`.

## Dependencies

- `vitest` (devDependency)

## Verify when done

- [ ] `npm test` passes.
- [ ] Cannon Cove fixture layers round-trip byte-for-byte.
- [ ] `{ compress: false }` share codes start with `u`; compressed with `z`.
- [ ] `format: 2` throws naming `format`.
- [ ] Short RLE throws naming the layer.
- [ ] `npm run build` passes; `/` is still the Unit 02 demo.
