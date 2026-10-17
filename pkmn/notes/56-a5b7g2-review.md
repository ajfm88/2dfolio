# A5b7g2 review: hidden events and bookshelves as source programs

**2026-10-16 · Claude · Passes, no required fix.**

Reviewed:
- CP1 `a6b609f` (Claude, data; reviewed here against the ROM checks recorded in note 54 §12);
- CP2 by Grok, in four commits: data `8fd0111`, builder `13fd2f6`, bookshelves `269d8c2`, tests `09df736`.

Plan: `notes/54-a5b7g-plan.md` §5, DECISIONS #60.

## 1. Gates (re-run by the reviewer)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run build` | clean |
| ROM suite (two runs) | **1604/1604**, 89 files, both runs |
| No-ROM suite | **1474 pass / 130 skip** |
| `git diff --check a6b609f..HEAD` | clean |
| Working tree | clean before and after the mutation runs |

## 2. What I checked against the ASM

- **`PrintBookshelfText`** (`engine/events/hidden_events/bookshelves.asm`):
  - facing UP only, the one tile at screen (8,7) = `(tileX, tileY − 1)`;
  - no match falls through to signs and sprites;
  - a hidden event in front still wins, because the bookshelf check is in the `else` of the
    hidden-event branch.

  `BOOKSHELF_TILES` now maps to the predef labels of `data/tilesets/bookshelf_tile_ids.asm`, row for row.
  `FOREST_GATE` is rightly absent.
- **Grok's tileset finding is right:** `map_header OaksLab, OAKS_LAB, DOJO`. So the Lab's real shelf is
  DOJO $1D (gym blockset), not the LAB $28 row the plan's play-test assumed. The LAB row stays in the
  table for any future LAB-tileset map.
- **Plain predefs:** `displayTextID([printText {box: 'keep'}])` with the default `autoBox: true` and outer
  wait: border +4, first glyph +20, as `EnableAutoTextBoxDrawing` + `PrintPredefTextID` give.
- **`BookOrSculptureText`:** a new box (+23); Diglett only for MANSION with tile $38 at screen (8,6) =
  `(tileX, tileY − 2)`.
- **`IndigoPlateauStatues`:** Text1, then Text2 when `wXCoord` is odd, else Text3, each in a new box.
- **`DisplayOakLabRightPoster`:** `cp 2; jr c` → < 2 owned keeps `SaveOptionText`. The extractor now gives
  (5,0) `scriptId: 'OAKS_LAB_RIGHT_POSTER'`; setup diff is `OaksLab.json` and its mirror only.
- **One builder,** `interactionDisplay` (`story/hidden_events.ts`), is used by `handleInteraction` and the
  Lab's free movement (through `startFreeDisplay`). The last `textBox.show` fallback and the free-move
  `text` sub-state are gone, and free-move script ids now dispatch. The TV, notebook, blackboard, PCs and
  Town Map keep their handlers. Red's House 1F's two text-only entries still route to the TV handler.
- **The BIT_SEEN_BY_TRAINER gate** (`foundBeforeDialogue`) includes the new `program` interaction.
- **Note 55 follow-ups:** N-1 fixed (`textBox.active && textBox.displaySession` on the `pikachuFacing`
  restore); N-2 (the guard's Delay3, 3 frames with no read) and N-3 (the borderless free-move NPC opening)
  are now asserted.
- **The census tripwire** no longer allows `overworld/map.ts`. `getText` is left only in battle, the catch
  demo and the battle-mode party prompt (A5c).

## 3. Mutations

Grok's five (any facing, the second tile, books at +20, owned threshold 1, free-move script ids ignored)
were caught. My nine, against the full suite:

| # | Mutation | Result |
|---|---|---|
| 1 | statues' parity swapped | caught |
| 2 | Diglett on any tileset | caught |
| 3 | plain predef in a new box (+23) | caught |
| 4 | poster threshold `<= 2` | caught |
| 5 | plain predef without the auto border | caught |
| 6 | `foundBeforeDialogue` drops `program` | **survived** (N-1) |
| 7 | TV routed to a missing handler | **survived** (N-2) |
| 8 | hidden-event program loses to a shelf | caught |
| 9 | free-move program interactions ignored | caught |

## 4. Notes (none blocks)

- **N-1:** the seen-by-trainer gate for `program` events has no test. It only matters with an adjacent
  trainer facing the player while a program hidden event is in front, which no current map has.
  `map_trainers.test.ts` covers the gate for other finds; add a `program` case there when a map makes it
  reachable, or in J2.
- **N-2:** the TV's routing through `interactionDisplay` has no test. Breaking it makes the TV do nothing,
  silently. One assertion fixes it: A on Red's House 1F (3,1) facing up yields the TV handler's commands.
  Add it with the next slice that touches `story/` (the healing machine).
- **Play-test expectation:** shelves now read only facing up. That's the cartridge's rule, so a shelf that
  used to answer from the side is now silent. Blue's House bookcases are hidden events, not shelves; their
  `facing` filter stays V5 (note 19 N-2).

## 5. Play-test (user)

This is note 54 §8 for g2, with the Lab shelf corrected. It also covers g1's F-1 check.
Controls: **Z = A, X = B.**

1. **Oak's Lab, before choosing a starter:** both posters and the e-mail show a box (F-1). The right
   poster says the SAVE line.
2. **After you own 2 Pokémon** (catch one on Route 1): the right poster says "All POKéMON types have
   strong and weak points…".
3. **Lab shelves, Red's House 1F shelf, the Route 2 gate shelf:** text only when facing **up**. The books
   text starts a beat later than a sign's.
4. **Viridian Mart / Pokécenter shelves:** "Wow! Tons of POKéMON stuff!", facing up only.
5. **Blue's House Town Map:** facing up only.
6. **Unchanged:** the Pokécenter bench (facing left), the SNES, Blue's bookcases, the TV.
