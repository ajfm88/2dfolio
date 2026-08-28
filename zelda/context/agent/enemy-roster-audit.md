# Enemy Roster Audit (G5)

> The point of G5 is that "the roster is complete" becomes a **verifiable claim**.
> This table is the authority. It maps every NES object type from
> `Z_07.asm:5321 UpdateObject_JumpTable` (index = type ID) to its status here.
> Every combat enemy that is not implemented names *why* and *which future slice
> owns it*. Cross-checked against `spawn-manager.ts createEnemyByType`,
> `SpikeTrap.createTraps`, and `dungeon-statues.ts`.

**Last audited:** 2026-08-26 (G5). **Result:** every non-boss combat enemy is
implemented. All remaining types are bosses (→ Phase I) or non-combat
NPCs/specials (→ later content slices), each parked below.

## Implemented (combat enemies)

| ID(s) | NES type | File / owner |
|---|---|---|
| $01/$02 | Lynel (blue/red) | `lynel.ts` (G2) |
| $03/$04 | Moblin | `moblin.ts` (G2) |
| $05/$06 | Goriya | `goriya.ts` + `goriya-boomerang.ts` (G3) |
| $07–$0A | Octorok | `octorok.ts` (G2) |
| $0B/$0C | Darknut (red/blue, parry) | `darknut.ts` (G4a) |
| $0D/$0E | Tektite | `tektite.ts` (G2) |
| $0F/$10 | Leever (blue/red) | `leever.ts` (G2) |
| $11 | Zora (fireball) | `zora.ts` (G2) |
| $12 | Vire (splits → 2 Keese) | `vire.ts` (G4a) |
| $13 | Zol (splits → 2 Gels) | `zol.ts` (G3) |
| $14/$15 | Gel | `gel.ts` (G3) |
| $16 | Pols Voice | `pols-voice.ts` (G4a) |
| $17 | Like-Like | `like-like.ts` (G4b) |
| $1A | Peahat | `peahat.ts` (G2) |
| $1B–$1D | Keese | `keese.ts` (G3) |
| $1E | Armos | `armos.ts` (G2) |
| $21/$22 | Ghini / Flying Ghini | `ghini.ts` (G2) |
| $23/$24 | Wizzrobe (blue/red, MagicShot) | `wizzrobe.ts` (G4b) |
| $27 | Wallmaster (grab→entrance) | `wallmaster.ts` (G4b) |
| $28 | Rope | `rope.ts` (G3) |
| $2A | Stalfos | `stalfos.ts` (G3) |
| $2B–$2D | Bubble (sword-jinx) | `bubble.ts` (G4a) |
| $30 | Gibdo | `gibdo.ts` (G4a) |
| $3A/$3B | Lanmola (red/blue) | `lanmola.ts` (G4b) |

## Implemented (hazards / non-Enemy combat objects)

| ID(s) | NES type | File / owner |
|---|---|---|
| $49/$4A | Spike Trap (6/4 traps) | `spike-trap.ts` (H1b) — invulnerable, no HP |
| — (room $23/$24) | Statue fireballs | `dungeon-statues.ts` (G5) — feeds EnemyProjectile pipeline |
| $53–$5C | Monster shots / arrow / boomerang / fireball | `enemy-projectile.ts`, `goriya-boomerang.ts` — per-type visuals + shield rules (G5) |

## Deferred → Phase I (bosses)

These are the multi-part boss AIs. They belong with the boss slices, not the
enemy roster. Sprite layouts for all seven already exist in `sprites.json` (B5).

| ID(s) | Boss |
|---|---|
| $18 / $38 / $39 | Digdogger (+ children) |
| $31/$32 | Dodongo |
| $33/$34 | Gohma |
| $3C | Manhandla |
| $3D | Aquamentus (first boss, unblocks H2) |
| $3E | Ganon |
| $41 | Moldorm |
| $42–$46 | Gleeok (+ heads) |
| $25/$26 | Patra child | 
| $47/$48 | Patra |
| $3F | GuardFire (boss-room fire; NES `PersonFireballsEnabled` statue pattern 2) |
| $40 | StandingFire (lit boss-room fire) |

## Deferred → later content slices (non-combat)

| ID(s) | Type | Why deferred / owner |
|---|---|---|
| $1F/$20 | BoulderSet / Boulder | Overworld mountain hazard near Lynels. Not a boss — **named G5 stretch, cut for scope**; owner: a future overworld-hazard slice. |
| $2E | Whirlwind | Transport that warps Link between levels — a travel mechanic, not combat. Owner: warp/travel slice. |
| $2F | Pond Fairy | Heals Link — NPC. Owner: NPC/heal slice. |
| $35 | Rupee Stash | Money room contents. Owner: dungeon-content slice. |
| $36 | Grumble | Hungry Goriya NPC (eats bait to pass). Owner: NPC slice. |
| $37 | Zelda | Rescue NPC (endgame). Owner: endgame slice. |
| $4B–$52 | Underworld Person | Old Man / Old Woman / Moblin NPCs. Owner: dungeon-NPC slice. |

## How to re-verify

1. Open `Z_07.asm:5321` — the jump table is the type→handler spine (index 0 = $00).
2. Every non-`DoNothing`, non-boss, non-NPC handler above the `$53` shot block
   must map to a row in the **Implemented** tables here.
3. `spawn-manager.ts createEnemyByType` is the runtime mirror: every `case` there
   corresponds to an Implemented row; its `default` returns the generic walker.
