# A5b2 review — map sprite-set extraction

**2026-10-09 · Codex/Sol · reviewed commit `156d02c` against `notes/26-a5b2-plan.md` and pret Yellow.**

## Verdict

**A5b2 passes review.** The committed extractor and both generated JSON copies agree with the owner's ROM and the source ASM. The file remains data only; no runtime loader or visible behavior was added. A5b3 is the next implementation increment and remains unassigned. A5b4 was not started.

## Finding N-1 — emitted middle sprite sets lack an independent source assertion (P3, nonblocking)

`game/src/rom/__tests__/map_sprite_sets.test.ts` compares the emitted `spriteSets` rows for sets 1 and 10 against source-derived rows, but does not do that for sets 2–9. Its separate 110-byte table check proves the ROM input matches the ASM, not that every emitted row preserves those bytes in order. The generated-data equality tests compare output to the same extractor.

In an isolated archive, I swapped the second and third entries of emitted set 3 in a copy of the extractor and changed both generated JSON mirrors to match. The complete ROM suite still passed **988/988**. The committed set 3 is correct: an independent audit of every emitted set against the source ASM found no mismatch.

**Follow-up:** extend the source fixture to loop over all ten sets and compare each emitted eleven-ID row with its corresponding slice of the independently parsed source table. This can accompany A5b3 or another small correction; it does not hold A5b2 sign-off because the actual emitted data was independently checked and is not yet consumed by the game.

## Verification

- Directly compared the committed JSON against pret ASM and the owner ROM: all **37** outdoor selectors, **12** split rows including unused `$f8`, **110** set entries, **82** picture classes, **75** canonical sprite IDs, **19** current map IDs and their object-picture/close fixtures. Route 20's branch constants and repeated set values match.
- Checked the extractor's pointer and opcode context, domain guards, map/picture registries, dual pipeline registration, and absence of a runtime reference to the JSON in the production bundle. In-memory ROM mutations were rejected for wrong pointer/opcode/size, picture class and split values, Route 20 order/repetition, and truncated table data.
- `npm run typecheck` and `npm run build` passed. With `ROM_PATH=pokeyellow.gbc`, **988/988** tests passed. Without it, **888 passed / 100 skipped**. A tracked-file archive with neither ROM nor refs had **887 passed / 101 skipped**; the additional skip is an older ASM-dependent item-pickup test.
- `npm run setup pokeyellow.gbc` ran twice. Each run preserved all **859** parent generated files byte-for-byte and yielded the same **861** path/hash manifest. The only additions were the two identical 10,573-byte `map_sprite_sets.json` mirrors. The ROM file was unchanged. Temporary archive and mutation probes were removed.

No browser play-test was needed for this extraction-only slice. The next runtime behavior is planned for A5b4.
