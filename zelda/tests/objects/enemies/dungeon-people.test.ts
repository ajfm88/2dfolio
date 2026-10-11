import { describe, it, expect } from 'vitest';
import type { EnemyUpdateContext } from '../../../src/objects/enemies/enemy.js';
import { PersonTextbox, personTextLines, textboxLineX } from '../../../src/objects/enemies/person-textbox.js';
import {
  UnderworldPerson,
  UnderworldPersonLifeOrMoney,
  payWithHeartContainer,
  personGroup,
  personTextSelector,
} from '../../../src/objects/enemies/underworld-person.js';
import { Grumble } from '../../../src/objects/enemies/grumble.js';
import { RupeeStash, createRupeeStash } from '../../../src/objects/enemies/rupee-stash.js';
import { PERSON_BLOCK_LINK_Y, PERSON_X, PERSON_Y, type PersonRoomContext } from '../../../src/objects/enemies/room-person.js';
import { Direction } from '../../../src/core/types.js';
import { DAMAGE_TABLE } from '../../../src/core/damage-tables.js';
import { DungeonStatues } from '../../../src/world/dungeon-statues.js';

const ctx: EnemyUpdateContext = {
  collision: { isRectWalkable: () => true } as unknown as import('../../../src/world/collision.js').TileCollisionMap,
  screen: { id: 0, tiles: [] } as unknown as import('../../../src/data/overworld-types.js').OverworldScreen,
  linkX: 120,
  linkY: 100,
};

function room(level: number, extra: Partial<PersonRoomContext> = {}): PersonRoomContext {
  return { level, itemTaken: false, triforce: 0, ...extra };
}

function run(e: { update: (c: EnemyUpdateContext) => void }, frames: number): void {
  for (let i = 0; i < frames; i++) e.update(ctx);
}

describe('PersonTextbox (Z_01.asm UpdatePersonState_Textbox)', () => {
  it('looks up PersonText by selector / 2', () => {
    expect(personTextLines(0x24)).toEqual(['GRUMBLE,GRUMBLE!!!']);
    expect(personTextLines(0x26)[0]).toBe('EASTMOST PENNINSULA');
  });

  it('types the first character at once, then one every 6 frames', () => {
    const box = new PersonTextbox(['AB', 'C']);
    expect(box.tick()).toBe(true);
    for (let i = 0; i < 5; i++) expect(box.tick()).toBe(false);
    expect(box.tick()).toBe(true);
    expect(box.visibleLines()).toEqual(['AB']);
    for (let i = 0; i < 6; i++) box.tick();
    expect(box.done).toBe(true);
    expect(box.visibleLines()).toEqual(['AB', 'C']);
  });

  it('honours a start delay ($A for complex people)', () => {
    const box = new PersonTextbox(['A'], 0x0a);
    for (let i = 0; i < 9; i++) expect(box.tick()).toBe(false);
    expect(box.tick()).toBe(true);
  });

  it('centres a line in the 24-column box starting at column 4', () => {
    expect(textboxLineX('X'.repeat(24))).toBe(32);
    expect(textboxLineX('X'.repeat(20))).toBe(48);
  });

  it('clear() blanks the lines', () => {
    const box = new PersonTextbox(['A']);
    box.tick();
    box.clear();
    expect(box.visibleLines()).toEqual([]);
  });
});

describe('Dungeon person text tables (InitUnderworldPersonA/B/C)', () => {
  it('groups levels like the ROM jump table', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(personGroup)).toEqual(
      ['A', 'A', 'B', 'B', 'A', 'B', 'A', 'B', 'C'],
    );
  });

  it.each([
    // [level, type, first line] — the Q1 rooms that hold these people.
    [1, 0x4c, 'EASTMOST PENNINSULA'],
    [2, 0x4b, 'DODONGO DISLIKES SMOKE!'],
    [3, 0x4b, 'DID YOU GET THE SWORD'],
    [4, 0x4e, 'WALK INTO THE'],
    [5, 0x4d, 'SECRET POWER IS SAID'],
    [5, 0x4e, 'DIGDOGGER HATES'],
    [6, 0x4c, 'THERE ARE SECRETS WHERE'],
    [6, 0x4d, 'AIM AT THE EYES'],
    [7, 0x4f, "I BET YOU'D LIKE"],
    [7, 0x50, "THERE'S A SECRET IN"],
    [8, 0x4f, 'SPECTACLE ROCK IS'],
    [9, 0x4b, 'ONES WHO DOES NOT HAVE'],
  ] as const)('L%i type $%s says "%s"', (level, type, first) => {
    const selector = personTextSelector(type, level);
    expect(selector).not.toBeNull();
    expect(personTextLines(selector!)[0]).toBe(first);
  });
});

describe('UnderworldPerson', () => {
  it('stands at ($78, $80) with no spawn cloud and never touches Link', () => {
    const p = new UnderworldPerson(0x4c);
    expect(p.x).toBe(PERSON_X);
    expect(p.y).toBe(PERSON_Y);
    expect(p.isActive).toBe(true);
    expect(p.isSpawning).toBe(false);
    expect(p.touchesLink).toBe(false);
    expect(PERSON_BLOCK_LINK_Y).toBe(0x8e - 0x3d);
  });

  it('halts Link until its text is fully typed', () => {
    const p = new UnderworldPerson(0x4b);
    p.setup(room(3));
    expect(p.haltsLink).toBe(true);
    // 61 characters: the first on frame 1, then one every 6 → the last on frame 361.
    run(p, 360);
    expect(p.haltsLink).toBe(true);
    run(p, 1);
    expect(p.textbox!.done).toBe(true);
    expect(p.haltsLink).toBe(false);
    expect(p.blocksLink).toBe(true);
  });

  it('a hit only flags PersonFireballsEnabled — no damage, no knockback', () => {
    const p = new UnderworldPerson(0x4b);
    p.setup(room(3));
    expect(p.takeDamage(0x40, Direction.Up)).toBe(false);
    expect(p.isActive).toBe(true);
    expect(p.consumeStruck()).toBe(true);
    expect(p.consumeStruck()).toBe(false);
    p.stun();
    expect(p.consumeStruck()).toBe(true);
  });

  it('Level 9 gatekeeper with all eight pieces opens the shutters and vanishes', () => {
    const p = new UnderworldPerson(0x4b);
    p.setup(room(9, { triforce: 0xff }));
    expect(p.opensShutters).toBe(true);
    expect(p.isActive).toBe(false);
    const q = new UnderworldPerson(0x4b);
    q.setup(room(9, { triforce: 0x7f }));
    expect(q.opensShutters).toBe(false);
    expect(q.isActive).toBe(true);
  });

  describe('bomb-capacity man ($4F in a table-A level)', () => {
    function talked(): UnderworldPerson {
      const p = new UnderworldPerson(0x4f);
      p.setup(room(7));
      run(p, 0x0a + 6 * 40);
      expect(p.textbox!.done).toBe(true);
      return p;
    }

    it('offers "-100" on row 22', () => {
      const p = talked();
      expect(p.sellsBombCapacity).toBe(true);
      expect(p.priceTexts).toEqual([{ x: 104, text: '-100' }]);
    });

    it('sells only when Link stands exactly on X $78 within 6px of Y $98 with 100 rupees', () => {
      const p = talked();
      const onRupeeY = 0x98 - 0x3d;
      expect(p.tryBombCapacitySale(0x70, onRupeeY, 255)).toBe(false);
      expect(p.tryBombCapacitySale(0x78, onRupeeY + 6, 255)).toBe(false);
      expect(p.tryBombCapacitySale(0x78, onRupeeY, 99)).toBe(false);
      expect(p.tryBombCapacitySale(0x78, onRupeeY + 5, 100)).toBe(true);
      expect(p.tryBombCapacitySale(0x78, onRupeeY, 255)).toBe(false); // once only
      run(p, 0x40);
      expect(p.isActive).toBe(false);
    });

    it('is gone if the offer was already taken', () => {
      const p = new UnderworldPerson(0x4f);
      p.setup(room(7, { itemTaken: true }));
      expect(p.isActive).toBe(false);
    });

    it('in a table-B level the same type is only a hint', () => {
      const p = new UnderworldPerson(0x4f);
      p.setup(room(8, { itemTaken: true }));
      expect(p.isActive).toBe(true);
      expect(p.sellsBombCapacity).toBe(false);
    });
  });
});

describe('UnderworldPersonLifeOrMoney ($51)', () => {
  it('takes the heart container, or 50 rupees if Link has them', () => {
    const p = new UnderworldPersonLifeOrMoney();
    p.setup(room(1));
    run(p, 0x0a + 6 * 40);
    const y = 0x98 - 0x3d;
    expect(p.tryChoice(0x98, y, 49)).toBeNull();
    expect(p.tryChoice(0x98, y, 50)).toBe('money');
    const q = new UnderworldPersonLifeOrMoney();
    q.setup(room(1));
    run(q, 0x0a + 6 * 40);
    expect(q.tryChoice(0x58, y, 0)).toBe('life');
  });

  it('heart-container payment (@PayWithHeartContainer)', () => {
    expect(payWithHeartContainer(16, 16)).toEqual({ health: 14, maxHealth: 14 });
    expect(payWithHeartContainer(6, 6)).toEqual({ health: 1, maxHealth: 6 });
  });
});

describe('Grumble ($36)', () => {
  it('says GRUMBLE and ignores food until the text is done', () => {
    const g = new Grumble();
    g.setup(room(7));
    expect(g.textbox!.lines).toEqual(['GRUMBLE,GRUMBLE!!!']);
    expect(g.offerFood(true)).toBe(false);
    run(g, 6 * 20);
    expect(g.offerFood(false)).toBe(false);
    expect(g.offerFood(true)).toBe(true);
    expect(g.haltsLink).toBe(true);
  });

  it('takes the bait and leaves after $40 frames', () => {
    const g = new Grumble();
    g.setup(room(7));
    run(g, 6 * 20);
    g.offerFood(true);
    run(g, 0x3f);
    expect(g.isActive).toBe(true);
    expect(g.consumeFinished()).toBe(false);
    run(g, 1);
    expect(g.isActive).toBe(false);
    expect(g.consumeFinished()).toBe(true);
    expect(g.haltsLink).toBe(false);
  });

  it('stays away once fed', () => {
    const g = new Grumble();
    g.setup(room(7, { itemTaken: true }));
    expect(g.isActive).toBe(false);
    expect(g.blocksLink).toBe(false);
  });
});

describe('RupeeStash ($35)', () => {
  it('lays out ten rupees in the RupeeStashXs/Ys diamond', () => {
    const rupees = createRupeeStash(0);
    expect(rupees).toHaveLength(10);
    expect(rupees.map((r) => r.x)).toEqual([0x78, 0x70, 0x80, 0x60, 0x70, 0x80, 0x90, 0x70, 0x80, 0x78]);
    expect(rupees[0]!.y).toBe(0x70 - 0x3d);
    expect(rupees.every((r) => !r.vulnerable && !r.touchesLink && r.isActive)).toBe(true);
  });

  it('is taken when Link is within 8px on both axes, and vanishes at once', () => {
    const r = new RupeeStash(0x78, 0x40, 0);
    expect(r.isTouchedBy(0x78 + 9, 0x40)).toBe(false);
    expect(r.isTouchedBy(0x78 + 8, 0x40 - 8)).toBe(true);
    r.collect();
    expect(r.isDead).toBe(true);
    expect(r.isTouchedBy(0x78, 0x40)).toBe(false);
  });
});

describe('No contact damage for people and money (Z_01.asm ObjTypeToDamagePoints)', () => {
  it('$35-$37 and $4B-$52 are 0', () => {
    for (const t of [0x35, 0x36, 0x37, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52]) {
      expect(DAMAGE_TABLE[t]).toBe(0);
    }
    expect(DAMAGE_TABLE[0x41]).toBe(0x80);
  });
});

describe('DungeonStatues pattern 2 (PersonFireballsEnabled)', () => {
  it('switches a plain room to the two bonfire shooters', () => {
    const statues = new DungeonStatues(38);
    expect(statues.active).toBe(false);
    statues.enablePersonFireballs();
    expect(statues.active).toBe(true);
    expect(statues.pattern).toBe(2);
    // Fire every shooter: timers start at most $F0 frames out.
    const shots = [];
    for (let i = 0; i < 0x200 && shots.length < 2; i++) shots.push(...statues.update(120, 100));
    expect(shots.length).toBeGreaterThanOrEqual(2);
    const xs = new Set(shots.map((s) => s.x));
    expect([...xs].every((x) => x === 0x48 || x === 0xa8)).toBe(true);
  });
});
