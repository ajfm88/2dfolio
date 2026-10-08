// A5b1: text programs (rom/extractors/text_programs.ts) against pret's source.
// The expected ops are built from the ASM macros (refs/pokeyellow), not from the
// extractor, so a wrong address, opcode or operand fails here.
import { describe as _describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { BinaryReader } from '../binary_reader';
import { extractTextPrograms } from '../extractors/text_programs';
import type { MapTextCall, TextOp, TextPrograms, TextProgramsFile } from '../extractors/text_programs';
import { TEXT_POINTER_TABLES, TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';

const ROM_PATH = process.env.ROM_PATH;
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA_DIR = resolve(__dirname, '../../../data');
const describe = _describe.skipIf(!ROM_PATH);

let file: TextProgramsFile;
let programs: TextPrograms;
beforeAll(() => {
  if (!ROM_PATH) return;
  const buffer = readFileSync(ROM_PATH);
  file = extractTextPrograms(new BinaryReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)));
  programs = file.programs;
});

// ── A small reader for pret's text macros (macros/scripts/text.asm) ──────────────

function asmFiles(dir: string): string[] {
  return readdirSync(resolve(REFS, dir), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? asmFiles(`${dir}/${e.name}`) : e.name.endsWith('.asm') ? [`${dir}/${e.name}`] : []);
}

/** Retail-build statements, with IF DEF(_DEBUG) resolved to its ELSE. */
function retail(file: string): string[] {
  const out: string[] = [];
  const cond: boolean[] = [];
  for (const raw of readFileSync(resolve(REFS, file), 'utf8').split('\n')) {
    const l = raw.replace(/;(?=(?:[^"]*"[^"]*")*[^"]*$).*$/, '').trim();
    if (!l) continue;
    if (/^IF\b/.test(l)) { cond.push(/_DEBUG/.test(l)); continue; }
    if (/^ELSE\b/.test(l)) { cond[cond.length - 1] = !cond[cond.length - 1]; continue; }
    if (/^ENDC\b/.test(l)) { cond.pop(); continue; }
    if (cond.includes(true)) continue;
    out.push(l);
  }
  return out;
}

/** Every retail statement of the source, in file order, and where each label starts. */
function statements(): { lines: string[]; at: Map<string, number> } {
  const lines: string[] = [];
  const at = new Map<string, number>();
  for (const file of ['text', 'data/text', 'data/items', 'scripts', 'engine', 'home'].flatMap(asmFiles)) {
    let global = '';
    for (const l of retail(file)) {
      const lab = /^(\.?\w+)(::?)?$/.exec(l);
      if (lab && (lab[2] || lab[1].startsWith('.'))) {
        if (!lab[1].startsWith('.')) global = lab[1];
        const name = lab[1].startsWith('.') ? global + lab[1] : lab[1];
        if (!at.has(name)) at.set(name, lines.length);
        lines.push(`${name}:`);
        continue;
      }
      lines.push(l);
    }
    lines.push('<eof>');
  }
  return { lines, at };
}

/** label → the statements after it (to the next label). */
function labelBodies(): Map<string, string[]> {
  const bodies = new Map<string, string[]>();
  for (const file of ['text', 'data/text', 'scripts', 'engine', 'home'].flatMap(asmFiles)) {
    let global = '';
    let cur: string[] | null = null;
    for (const l of retail(file)) {
      const lab = /^(\.?\w+)(::?)?$/.exec(l);
      if (lab && (lab[2] || lab[1].startsWith('.'))) {
        if (!lab[1].startsWith('.')) global = lab[1];
        const name = lab[1].startsWith('.') ? global + lab[1] : lab[1];
        cur = [];
        if (!bodies.has(name)) bodies.set(name, cur);
        continue;
      }
      cur?.push(l);
    }
  }
  return bodies;
}

const BINDINGS: Record<string, string> = {
  wStringBuffer: 'stringBuffer', wNameBuffer: 'nameBuffer', wBoxNumString: 'boxNumString',
  hMoney: 'money', hCoins: 'coins', wHPBarHPDifference: 'hpDifference',
};
const SOUNDS: Record<string, TextOp> = {
  sound_get_item_1: { op: 'sound', sound: 'get_item1' }, sound_get_item_1_duplicate: { op: 'sound', sound: 'get_item1' },
  sound_get_item_2: { op: 'sound', sound: 'get_item2' }, sound_get_key_item: { op: 'sound', sound: 'get_key_item' },
  sound_caught_mon: { op: 'sound', sound: 'caught_mon' }, sound_dex_page_added: { op: 'sound', sound: 'dex_page_added' },
  sound_pokedex_rating: { op: 'sound', sound: 'pokedex_rating' },
  sound_cry_pikachu: { op: 'cry', species: 'PIKACHU' }, sound_cry_pidgeot: { op: 'cry', species: 'PIDGEOT' },
  sound_cry_dewgong: { op: 'cry', species: 'DEWGONG' },
};
// String characters the charmap expands (constants/charmap.asm)
const EXPANSIONS: [string, string][] = [
  ['#', 'POKé'], ['<PKMN>', ''], ['<……>', '……'], ['<PC>', 'PC'], ['<TM>', 'TM'],
  ['<TRAINER>', 'TRAINER'], ['<ROCKET>', 'ROCKET'],
];
const expand = (s: string): string => EXPANSIONS.reduce((t, [a, b]) => t.split(a).join(b), s);

type Row = 1 | 2 | null;

/** Build one program's expected ops from its ASM, following text_far with the row. */
function expectedFrom(bodies: Map<string, string[]>) {
  const memo = new Map<string, { ops: TextOp[]; endRow: Row }>();
  const build = (label: string, startRow: Row): { ops: TextOp[]; endRow: Row } => {
    const hit = memo.get(label);
    if (hit) return hit;
    const body = bodies.get(label);
    if (!body) throw new Error(`no ASM for ${label}`);
    const ops: TextOp[] = [];
    let row = startRow;
    let str: string | null = null;
    const quoted = (l: string): string => {
      const m = /"(.*)"/.exec(l);
      return m ? m[1] : '';
    };
    /** Append quoted characters; an `@` ends the string. */
    const chars = (q: string): void => {
      const at = q.indexOf('@');
      str! += expand(at >= 0 ? q.slice(0, at) : q);
      if (at >= 0) { ops.push({ op: 'text', text: str! }); str = null; }
    };
    let done = false;
    for (const l of body) {
      if (done) break;
      const [cmd, ...rest] = l.split(/\s+/);
      const arg = rest.join(' ');
      if (str !== null) {
        if (cmd === 'line') { str += row === 1 ? '\n' : '<LINE>'; row = 2; chars(quoted(l)); continue; }
        if (cmd === 'next') { str += row === 1 ? '\n' : '<NEXT>'; row = row === 1 ? 2 : null; chars(quoted(l)); continue; }
        if (cmd === 'cont') { str += row === 2 ? '\n' : '<CONT>'; row = 2; chars(quoted(l)); continue; }
        if (cmd === 'para') { str += '\f'; row = 1; chars(quoted(l)); continue; }
        if (cmd === 'done') { ops.push({ op: 'text', text: str + '<DONE>' }); str = null; done = true; continue; }
        if (cmd === 'prompt') { ops.push({ op: 'text', text: str + '<PROMPT>' }); str = null; done = true; continue; }
        throw new Error(`${label}: '${l}' inside a string`);
      }
      switch (cmd) {
        case 'text': str = ''; chars(quoted(l)); break;
        case 'text_start': str = ''; break;
        case 'text_far': {
          const child = arg.trim();
          ops.push({ op: 'far', program: child });
          row = build(child, row).endRow;
          break;
        }
        case 'text_ram': ops.push({ op: 'ram', binding: BINDINGS[arg] as never }); break;
        case 'text_bcd': {
          const [addr, spec] = arg.split(/,\s*/);
          const parts = spec.split(/\s*\|\s*/);
          ops.push({ op: 'bcd', binding: BINDINGS[addr] as never, bytes: Number(parts[0]),
            leadingZeroes: parts.includes('LEADING_ZEROES'), leftAlign: parts.includes('LEFT_ALIGN'),
            moneySign: parts.includes('MONEY_SIGN') });
          break;
        }
        case 'text_decimal': {
          const [addr, bytes, digits] = arg.split(/,\s*/);
          ops.push({ op: 'decimal', binding: BINDINGS[addr] as never, bytes: Number(bytes), digits: Number(digits) });
          break;
        }
        case 'text_low': ops.push({ op: 'low' }); row = 2; break;
        case 'text_promptbutton': ops.push({ op: 'promptButton' }); break;
        case 'text_waitbutton': ops.push({ op: 'waitButton' }); break;
        case 'text_scroll': ops.push({ op: 'scroll' }); row = 2; break;
        case 'text_pause': ops.push({ op: 'pause' }); break;
        case 'text_dots': ops.push({ op: 'dots', count: Number(arg) }); break;
        case 'text_asm': ops.push({ op: 'asm' }); done = true; break;
        case 'text_end': done = true; break;
        default:
          if (SOUNDS[cmd]) { ops.push(SOUNDS[cmd]); break; }
          throw new Error(`${label}: unexpected '${l}'`);
      }
    }
    if (str !== null) throw new Error(`${label}: string not closed`);
    const result = { ops, endRow: row };
    memo.set(label, result);
    return result;
  };
  return build;
}

describe('Text programs (A5b1): every listed program against its ASM', () => {
  it('extracts every listed label, roots and FAR children', () => {
    expect(Object.keys(programs).sort()).toEqual(TEXT_PROGRAM_SYMBOLS.map(([l]) => l).sort());
  });

  it('matches the macros in pret\'s source, op for op', () => {
    if (!existsSync(REFS)) return;
    const build = expectedFrom(labelBodies());
    // Roots first (row 1), so each child is built from its caller's row, as the extractor does
    for (const [label, , , root] of TEXT_PROGRAM_SYMBOLS) if (root) build(label, 1);
    for (const [label] of TEXT_PROGRAM_SYMBOLS) {
      expect(programs[label], label).toEqual(build(label, 1).ops);
    }
  });

  it('text_programs.json matches the extractor', () => {
    expect(JSON.parse(readFileSync(resolve(DATA_DIR, 'text_programs.json'), 'utf8'))).toEqual(file);
  });

  it('classifies every map text as DisplayTextID runs it, read from the ASM', () => {
    if (!existsSync(REFS)) return;
    const { lines, at } = statements();
    const SCRIPT_MACROS: Record<string, string> = {
      script_mart: 'mart', script_pokecenter_nurse: 'pokecenterNurse', script_players_pc: 'playersPc',
      script_bills_pc: 'billsPc', script_pokecenter_pc: 'pokecenterPc', script_vending_machine: 'vendingMachine',
      script_prize_vendor: 'prizeVendor', script_cable_club_receptionist: 'cableClubReceptionist',
    };
    const globalOf = (i: number): string => {
      while (i >= 0 && !(lines[i].endsWith(':') && !lines[i].includes('.'))) i--;
      return lines[i].slice(0, -1);
    };
    const local = (name: string, i: number): string => name.startsWith('.') ? globalOf(i) + name : name;
    /** The wrapper's one printed label, walking ld b / ld hl / jp / jr / farcall / PrintText. */
    const wrapper = (start: number): string | null => {
      let hl: string | null = null;
      let printed: string | null = null;
      for (let i = start, steps = 0; steps < 16; steps++) {
        const l = lines[i];
        if (l.endsWith(':')) { i++; continue; }                     // fall through a label
        let m: RegExpExecArray | null;
        if (/^ld b, BANK\(\w+\)$/.test(l)) { i++; continue; }
        if ((m = /^ld hl, (\.?\w+)$/.exec(l))) { hl = local(m[1], i); i++; continue; }
        if (l === 'jp TextScriptEnd') return printed;
        if ((m = /^j[pr] (\.?\w+)$/.exec(l))) { i = at.get(local(m[1], i))!; continue; }
        if (l === 'call PrintText' && hl && !printed) { printed = hl; hl = null; i++; continue; }
        const far = /^(?:farcall|callfar) (\w+)$/.exec(l) ?? (l === 'call Bankswitch' && hl ? [l, hl] : null);
        if (far && !printed) {
          const f = at.get(far[1])!;
          const body = lines.slice(f + 1, f + 4);
          const inner = /^ld hl, (\.?\w+)$/.exec(body[0]);
          if (!inner || body[1] !== 'call PrintText' || body[2] !== 'ret') return null;
          printed = local(inner[1], f + 1);
          hl = null; i++; continue;
        }
        return null;
      }
      return null;
    };
    for (const [table, , , count] of TEXT_POINTER_TABLES) {
      const labels: string[] = [];
      for (let i = at.get(table)! + 1; /^(def_text_pointers|dw|dw_const|const_def)\b/.test(lines[i]); i++) {
        const def = /^const_def (\d+)$/.exec(lines[i]);
        if (def) expect(labels.length, table).toBe(Number(def[1]) - 1);
        const m = /^dw(?:_const)? (\w+)/.exec(lines[i]);
        if (m) labels.push(m[1]);
      }
      expect(labels.length, table).toBe(count);
      const expected: MapTextCall[] = labels.map(label => {
        const first = lines[at.get(label)! + 1].split(' ')[0];
        if (SCRIPT_MACROS[first]) return { call: 'script', script: SCRIPT_MACROS[first] } as MapTextCall;
        if (first !== 'text_asm') return { call: 'text', program: label };
        const printed = wrapper(at.get(label)! + 2);
        return printed ? { call: 'printText', program: printed } : { call: 'handler' };
      });
      expect(file.textPointers[table], table).toEqual(expected);
    }
  });

  it('pins map text calls the A5b callers rely on', () => {
    const t = file.textPointers;
    const forest = t.ViridianForest_TextPointers;
    // Gen 1 bug kept: the leaving sign loads the first trainer tips (ViridianForest.asm)
    expect(forest[15]).toEqual({ call: 'printText', program: 'ViridianForestPrintTrainerTips1Text.text' });
    expect(forest[10]).toEqual(forest[15]);
    expect(t.ViridianPokecenter_TextPointers[0]).toEqual({ call: 'script', script: 'pokecenterNurse' });
    expect(t.OaksLab_TextPointers[0]).toEqual({ call: 'handler' });
    expect(t.ViridianCity_TextPointers[11]).toEqual({ call: 'text', program: 'MartSignText' });
    // The Mart's parcel texts (IDs 4, 5) exist only in the first table
    expect(t.ViridianMart_TextPointers.length).toBe(5);
    expect(t.ViridianMart_TextPointers2.length).toBe(3);
    const calls = Object.values(t).flat();
    expect(calls.length).toBe(TEXT_POINTER_TABLES.reduce((n, e) => n + e[3], 0));
    for (const c of calls) if ('program' in c) expect(programs[c.program], c.program).toBeDefined();
  });

  it('lists every medicine result the item menu shows (PartyMenuItemUseMessagePointers)', () => {
    if (!existsSync(REFS)) return;
    const { lines, at } = statements();
    const table: string[] = [];
    for (let i = at.get('PartyMenuItemUseMessagePointers')! + 1; lines[i].startsWith('dw '); i++) table.push(lines[i].slice(3));
    // RareCandyText's item has no caller yet; every other entry is a current item_menu result
    expect(table.filter(l => l !== 'RareCandyText').sort()).toEqual([
      'AntidoteText', 'AwakeningText', 'BurnHealText', 'FullHealText', 'IceHealText', 'ParlyzHealText',
      'PotionText', 'ReviveText',
    ]);
    for (const label of table.filter(l => l !== 'RareCandyText')) expect(programs[label], label).toBeDefined();
  });

  it('pins a few programs the A5b callers rely on', () => {
    // Potion: the mon's name, then the HP restored, PrintNumber 2 bytes / 3 digits
    expect(programs._PotionText).toEqual([
      { op: 'ram', binding: 'nameBuffer' }, { op: 'text', text: '\nrecovered by ' },
      { op: 'decimal', binding: 'hpDifference', bytes: 2, digits: 3 }, { op: 'text', text: '!<DONE>' },
    ]);
    // Pallet: the warning is a FAR string, then the handler's code (EmotionBubble)
    expect(programs['PalletTownOakText.HeyWaitDontGoOutText']).toEqual([
      { op: 'far', program: '_PalletTownOakHeyWaitDontGoOutText' }, { op: 'asm' },
    ]);
    // A FAR child's <PROMPT> returns to its parent, which carries on
    expect(programs._FoundItemText).toEqual([
      { op: 'text', text: '<PLAYER> found\n' }, { op: 'ram', binding: 'stringBuffer' }, { op: 'text', text: '!' },
    ]);
    // A key-item sound follows its string in the same program
    const keyItems = Object.entries(programs).filter(([, ops]) => ops.some(o => o.op === 'sound' && o.sound === 'get_key_item'));
    expect(keyItems.length).toBeGreaterThan(0);
  });
});
