# TA Game Mechanic Notes
* There is no concept of multiple chains running at the same time on a single board.
* Combo size is not based on blocks that are necessarily touching. All that matters is that the blocks pop on the same frame.
* Combo size text is shown on the left most block on the high row composing the combo, e.g. top block of a 'plus'.

## Combo and Chain Mechanics
* Register all clears of on a frame as a single combo
* Discern if clear was the result of a player input. These can start a chain, but will not directly add to the ongoing chain

```
Proposal:

boolean chaining:
 Sets to true after any block clears
 Sets false when all are true:
  - There are no falling blocks
  - No blocks are popping
  - No trash is clearing

int chainCounter:
 Set to 1 when we first pop blocks and chaining was false
 Increments on a frame when blocks pop
 Does not increment if block was moved into place by a swap and clears that frame
```