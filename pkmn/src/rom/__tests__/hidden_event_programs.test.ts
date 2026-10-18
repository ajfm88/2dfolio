// A5b7g2 CP1 (notes/54-a5b7g-plan.md §5.2): each hidden event's predef program, derived
// independently from refs/pokeyellow's hidden-event table and routines, against the committed
// maps and text_programs.json. No ROM needed; returns early without the refs clone (as A1a/A5b1).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TextProgramsFile } from '../extractors/text_programs';

const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA = resolve(__dirname, '../../../data');
const programs = (JSON.parse(readFileSync(resolve(DATA, 'text_programs.json'), 'utf8')) as TextProgramsFile).programs;
/** The committed map fields this test reads (the extractor's MapHiddenEvent adds `program`). */
const maps: { name: string; hiddenEvents?: { x: number; y: number; program?: string; scriptId?: string }[] }[] =
  readdirSync(resolve(DATA, 'maps')).filter(n => n.endsWith('.json'))
    .map(n => JSON.parse(readFileSync(resolve(DATA, 'maps', n), 'utf8')));
const refs = (path: string): string => readFileSync(resolve(REFS, path), 'utf8');
/** RedsHouse2F → REDS_HOUSE_2F */
const mapConstant = (name: string): string => name.replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase();

/** A routine's body in engine/events/hidden_events/, up to the next blank line. */
function routine(label: string): string {
  const dir = resolve(REFS, 'engine/events/hidden_events');
  for (const file of readdirSync(dir)) {
    const lines = readFileSync(resolve(dir, file), 'utf8').split(/\r?\n/);
    const start = lines.findIndex(l => l === `${label}:` || l === `${label}::`);
    if (start < 0) continue;
    const end = lines.findIndex((l, i) => i > start && l.trim() === '');
    return lines.slice(start, end < 0 ? undefined : end).join('\n');
  }
  throw new Error(`routine ${label} not found`);
}

/** The predef a plain routine prints, or a marker for the routines that aren't plain prints. */
function predefOf(label: string, map: string): string | null {
  if (label === 'PrintBenchGuyText') {
    const row = refs('data/events/bench_guys.asm').split(/\r?\n/)
      .map(l => l.match(/bench_guy_text\s+(\w+),\s*\w+,\s*(\w+)/)).find(m => m?.[1] === map);
    return row ? row[2] : null;
  }
  const body = routine(label);
  const jumps = [...body.matchAll(/\btx_pre(?:_jump)?\s+(\w+)/g)].map(m => m[1]);
  // tx_pre_id branches (DisplayOakLabRightPoster) aren't one program: CP2 dispatches a handler.
  if (/\btx_pre_id\b/.test(body)) return null;
  return jumps.length === 1 ? jumps[0] : null;
}

describe('hidden-event predef programs (A5b7g2 CP1)', () => {
  it('every current map hidden event that prints one predef carries that program', () => {
    if (!existsSync(REFS)) return;
    const table = refs('data/events/hidden_events.asm').split(/\r?\n/);
    let checked = 0;
    for (const map of maps) {
      const constant = mapConstant(map.name);
      const start = table.findIndex(l => l.trim() === `hidden_events_for ${constant}`);
      if (start < 0) continue;
      for (let i = start + 1; !table[i].includes('db -1'); i++) {
        const m = table[i].match(/hidden_event\s+(\d+),\s*(\d+),\s*(\w+)/);
        if (!m) continue;
        const [x, y, label] = [Number(m[1]), Number(m[2]), m[3]];
        if (['HiddenItems', 'OpenRedsPC', 'OpenPokemonCenterPC'].includes(label)) continue;
        const event = map.hiddenEvents?.find(e => e.x === x && e.y === y);
        expect(event, `${map.name} (${x},${y}) ${label}`).toBeDefined();
        const predef = predefOf(label, constant);
        if (label === 'DisplayOakLabRightPoster') {
          expect(predef).toBeNull();
          expect(event!.scriptId).toBe('OAKS_LAB_RIGHT_POSTER');
          expect(event!.program).toBeUndefined();
          continue;
        }
        expect(event!.program, `${map.name} (${x},${y}) ${label}`).toBe(predef);
        checked++;
      }
    }
    expect(checked).toBe(9); // Blue's House ×3, Lab left poster and e-mail ×2, SNES, Viridian + Pewter benches
  });

  it('every committed hidden-event program and every bookshelf predef target is extracted', () => {
    for (const map of maps) for (const event of map.hiddenEvents ?? []) {
      if (event.program) expect(programs[event.program], `${map.name}: ${event.program}`).toBeDefined();
    }
    // BookshelfTileIDs' plain predefs, and the PrintText targets of its two text_asm routines.
    for (const label of ['PokemonStuffText', 'ElevatorText', 'PokemonBooksText', 'DiglettSculptureText',
      'IndigoPlateauStatuesText1', 'IndigoPlateauStatuesText2', 'IndigoPlateauStatuesText3',
      'SaveOptionText', 'StrengthsAndWeaknessesText']) expect(programs[label], label).toBeDefined();
    if (!existsSync(REFS)) return;
    const shelves = [...refs('data/tilesets/bookshelf_tile_ids.asm').matchAll(/bookshelf_tile\s+\w+,\s*\$\w+,\s*(\w+)/g)]
      .map(m => m[1]);
    for (const label of new Set(shelves)) {
      if (label === 'TownMapText') continue; // A5b6 handler
      const body = routine(label);
      const targets = /text_asm/.test(body) ? [...body.matchAll(/ld hl, (\w+)/g)].map(m => m[1]) : [label];
      for (const target of targets) expect(programs[target], `${label} → ${target}`).toBeDefined();
    }
  });
});
