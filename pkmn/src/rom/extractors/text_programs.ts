// Text programs (A5b, notes/23-a5b-plan.md §3.2 and §4.1, DECISIONS #45): the command
// streams TextCommandProcessor runs (home/text.asm), read from the ROM as data so the
// engine can run each caller's real text calls. Opcodes: macros/scripts/text.asm.
//
// Each program is listed by its pret label (rom/text_program_symbols.ts). A `far` op
// names its child program, which must be listed too. Decoding stops at text_end, at
// text_asm (the rest is code, ported by hand), or at a string ending in <DONE>/<PROMPT>
// (DoneText returns from that program level). RAM operands are bound to named inputs,
// never to addresses. Anything unknown fails extraction.
//
// `textPointers` is the call contract for every map text ID (DisplayTextID, home/text_script.asm):
// a TX_SCRIPT_* byte, a program run directly, a text_asm wrapper whose only work is one inner
// PrintText (Yellow's `farcall <Map>Print<Name>Text`), or a hand-ported handler.

import { BinaryReader } from '../binary_reader';
import { decodeProgramString } from './text';
import type { TextRow } from './text';
import { TEXT_POINTER_TABLES, TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';

/** What a RAM operand holds when the program runs (the caller supplies it). */
export type TextBinding = 'stringBuffer' | 'nameBuffer' | 'boxNumString' | 'money' | 'coins' | 'hpDifference';

/** A sound command's effect (TextCommandSounds, home/text.asm). */
export type TextSound = 'get_item1' | 'caught_mon' | 'pokedex_rating' | 'get_item2' | 'get_key_item' | 'dex_page_added';

export type TextOp =
  /** TX_START: a string through PlaceString (A5a's encoding). */
  | { op: 'text'; text: string }
  /** TX_FAR: run the child program, then continue here. */
  | { op: 'far'; program: string }
  /** TX_RAM: a string from RAM. */
  | { op: 'ram'; binding: TextBinding }
  /** TX_BCD: PrintBCDNumber; `bytes` and the print flags from the operand byte. */
  | { op: 'bcd'; binding: TextBinding; bytes: number; leadingZeroes: boolean; leftAlign: boolean; moneySign: boolean }
  /** TX_NUM: PrintNumber, left-aligned (TextCommand_NUM sets BIT_LEFT_ALIGN). */
  | { op: 'decimal'; binding: TextBinding; bytes: number; digits: number }
  /** TX_MOVE: the cursor to a tile of the screen. */
  | { op: 'move'; row: number; col: number }
  /** TX_BOX: TextBoxBorder at (row, col), `height` × `width` inside. */
  | { op: 'box'; row: number; col: number; height: number; width: number }
  /** TX_LOW: the cursor to (1, 16). */
  | { op: 'low' }
  /** TX_PROMPT_BUTTON: ▼ and ManualTextScroll, no ProtectedDelay3. */
  | { op: 'promptButton' }
  /** TX_SCROLL: two ScrollTextUpOneLine, cursor (1, 16). */
  | { op: 'scroll' }
  /** TX_START_ASM: the rest is code (a TypeScript handler). */
  | { op: 'asm' }
  /** TX_PAUSE: one Joypad read; 30 frames unless A/B is held. */
  | { op: 'pause' }
  /** A TX_SOUND_*: PlaySound, then WaitForSoundToFinish. */
  | { op: 'sound'; sound: TextSound }
  /** A cry command: PlayCry, which waits for the cry itself (WaitForSoundToFinish,
   *  home/pokemon.asm), so the program blocks until it ends. Playback is J2. */
  | { op: 'cry'; species: 'PIKACHU' | 'PIDGEOT' | 'DEWGONG' }
  /** TX_DOTS: `count` × (…, Joypad, 10 frames unless A/B is held). */
  | { op: 'dots'; count: number }
  /** TX_WAIT_BUTTON: ManualTextScroll with no arrow. */
  | { op: 'waitButton' };

/** label → its commands. */
export type TextPrograms = Record<string, TextOp[]>;

/** DisplayTextID's TX_SCRIPT_* routines, chosen by a text's first byte. */
export type TextScript = 'mart' | 'pokecenterNurse' | 'playersPc' | 'billsPc' | 'pokecenterPc'
  | 'vendingMachine' | 'prizeVendor' | 'cableClubReceptionist';

/** How DisplayTextID runs one map text ID. */
export type MapTextCall =
  /** The first byte is a TX_SCRIPT_*: DisplayTextID jumps to that routine. */
  | { call: 'script'; script: TextScript }
  /** PrintText_NoCreatingTextBox runs `program` (a trailing `asm` op continues in code). */
  | { call: 'text'; program: string }
  /** text_asm; farcall/callfar F; jp TextScriptEnd — F is exactly ld hl, P; call PrintText; ret. */
  | { call: 'printText'; program: string }
  /** Any other text_asm: a TypeScript handler. */
  | { call: 'handler' };

/** text_programs.json. */
export interface TextProgramsFile {
  programs: TextPrograms;
  /** A TextPointers table (pret's label) → its texts in ID order (index 0 = text ID 1). */
  textPointers: Record<string, MapTextCall[]>;
}

// RAM operands (pokeyellow.sym) → the named input the caller binds.
const BINDINGS: Record<number, TextBinding> = {
  0xCF4A: 'stringBuffer',  // wStringBuffer
  0xCD6D: 'nameBuffer',    // wNameBuffer
  0xCD3D: 'boxNumString',  // wBoxNumString
  0xFF9F: 'money',         // hMoney
  0xFFA0: 'coins',         // hCoins
  0xCEFD: 'hpDifference',  // wHPBarHPDifference (PotionText)
};

const SOUNDS: Record<number, TextSound> = {
  0x0B: 'get_item1', 0x0E: 'pokedex_rating', 0x0F: 'get_item1', 0x10: 'get_item2',
  0x11: 'get_key_item', 0x12: 'caught_mon', 0x13: 'dex_page_added',
};
const CRIES: Record<number, 'PIKACHU' | 'PIDGEOT' | 'DEWGONG'> = { 0x14: 'PIKACHU', 0x15: 'PIDGEOT', 0x16: 'DEWGONG' };

const SCRIPTS: Record<number, TextScript> = {
  0xFE: 'mart', 0xFF: 'pokecenterNurse', 0xFC: 'playersPc', 0xFD: 'billsPc', 0xF9: 'pokecenterPc',
  0xF5: 'vendingMachine', 0xF7: 'prizeVendor', 0xF6: 'cableClubReceptionist',
};

// Home-bank routines (pokeyellow.sym)
const BANKSWITCH = 0x3E84;
const PRINT_TEXT = 0x3C36;
const TEXT_SCRIPT_END = 0x23D2;

const W_TILE_MAP = 0xC3A0;
const SCREEN_WIDTH = 20;

function fileOffset(bank: number, addr: number): number {
  return bank === 0 ? addr : bank * 0x4000 + (addr & 0x3FFF);
}

function binding(addr: number, at: string): TextBinding {
  const b = BINDINGS[addr];
  if (!b) throw new Error(`Unbound text RAM operand $${addr.toString(16)} in ${at}`);
  return b;
}

function tile(addr: number, at: string): { row: number; col: number } {
  const i = addr - W_TILE_MAP;
  if (i < 0 || i >= SCREEN_WIDTH * 18) throw new Error(`Text cursor $${addr.toString(16)} off the tile map in ${at}`);
  return { row: Math.floor(i / SCREEN_WIDTH), col: i % SCREEN_WIDTH };
}

/**
 * The one program a text_asm wrapper prints, if printing it is all the wrapper does: the code
 * after text_asm, read as ld b / ld hl / jp / jr / call Bankswitch / call PrintText, reaches
 * jp TextScriptEnd with exactly one PrintText — inline, or in a far function that is exactly
 * `ld hl, P; call PrintText; ret`. Any other instruction makes it a handler (null).
 */
function printTextWrapper(rom: BinaryReader, bank: number, p: number): { bank: number; addr: number } | null {
  let b: number | null = null;
  let hl: number | null = null;
  let printed: { bank: number; addr: number } | null = null;
  const print = (pb: number, addr: number): boolean => {
    if (printed) return false;
    printed = { bank: addr < 0x4000 ? 0 : pb, addr };
    return true;
  };
  for (let steps = 0; steps < 16; steps++) {
    const op = rom.readByte(p);
    const nn = rom.readWord(p + 1);
    if (op === 0x06) { b = rom.readByte(p + 1); p += 2; continue; }   // ld b, n
    if (op === 0x21) { hl = nn; p += 3; continue; }                     // ld hl, nn
    if (op === 0x18) { p += 2 + ((rom.readByte(p + 1) << 24) >> 24); continue; } // jr
    if (op === 0xC3 && nn === TEXT_SCRIPT_END) return printed;         // jp TextScriptEnd
    if (op === 0xC3 && nn >= 0x4000) { p = fileOffset(bank, nn); continue; } // jp, same bank
    if (op === 0xCD && nn === PRINT_TEXT && hl !== null) {             // call PrintText
      if (!print(bank, hl)) return null;
      hl = null; p += 3; continue;
    }
    if (op === 0xCD && nn === BANKSWITCH && b !== null && hl !== null) { // farcall / callfar
      const f = fileOffset(b, hl);
      const inner = rom.readWord(f + 1);
      if (rom.readByte(f) !== 0x21 || rom.readByte(f + 3) !== 0xCD || rom.readWord(f + 4) !== PRINT_TEXT
        || rom.readByte(f + 6) !== 0xC9 || !print(b, inner)) return null;
      b = hl = null; p += 3; continue;
    }
    return null;
  }
  return null;
}

/** Extract every listed program and the call contract of every map text. */
export function extractTextPrograms(rom: BinaryReader): TextProgramsFile {
  const programs = extractPrograms(rom);
  const byAddress = new Map<string, string>();
  for (const [label, bank, addr] of TEXT_PROGRAM_SYMBOLS) byAddress.set(`${bank}:${addr}`, label);
  const listed = (bank: number, addr: number, at: string): string => {
    const label = byAddress.get(`${addr < 0x4000 ? 0 : bank}:${addr}`);
    if (!label) throw new Error(`${at}: no listed program at ${bank.toString(16)}:${addr.toString(16)}`);
    return label;
  };

  const textPointers: Record<string, MapTextCall[]> = {};
  for (const [table, bank, tableAddr, count] of TEXT_POINTER_TABLES) {
    textPointers[table] = [];
    for (let id = 1; id <= count; id++) {
      const at = `${table} text ${id}`;
      const addr = rom.readWord(fileOffset(bank, tableAddr) + (id - 1) * 2);
      const p = fileOffset(addr < 0x4000 ? 0 : bank, addr);
      const first = rom.readByte(p);
      let call: MapTextCall;
      if (SCRIPTS[first]) call = { call: 'script', script: SCRIPTS[first] };
      else if (first !== 0x08) call = { call: 'text', program: listed(bank, addr, at) };
      else {
        const target = printTextWrapper(rom, bank, p + 1);
        call = target ? { call: 'printText', program: listed(target.bank, target.addr, at) } : { call: 'handler' };
      }
      textPointers[table].push(call);
    }
  }
  return { programs, textPointers };
}

/** Every listed program. A child reached from two places must agree on its starting row. */
function extractPrograms(rom: BinaryReader): TextPrograms {
  const byAddress = new Map<string, string>();
  for (const [label, bank, addr] of TEXT_PROGRAM_SYMBOLS) byAddress.set(`${bank}:${addr}`, label);
  const where = new Map(TEXT_PROGRAM_SYMBOLS.map(([label, bank, addr]) => [label, { bank, addr }]));

  const programs: TextPrograms = {};
  const startRows = new Map<string, TextRow>();
  const endRows = new Map<string, TextRow>();
  const active = new Set<string>();

  /** Decode a program from `row`; returns the row it leaves the cursor on. */
  const decode = (label: string, row: TextRow): TextRow => {
    const known = startRows.get(label);
    if (known !== undefined && !active.has(label)) {
      if (known !== row) throw new Error(`${label} is reached on text rows ${known} and ${row}`);
      return endRows.get(label)!;
    }
    if (active.has(label)) throw new Error(`text_far cycle through ${label}`);
    active.add(label);
    startRows.set(label, row);
    const { bank, addr } = where.get(label)!;
    const ops: TextOp[] = [];
    let p = fileOffset(bank, addr);
    const limit = p + 4000;
    loop: while (p < limit) {
      const op = rom.readByte(p++);
      switch (op) {
        case 0x00: { // TX_START
          const s = decodeProgramString(rom, p, row);
          ops.push({ op: 'text', text: s.text });
          p += s.length;
          row = s.endRow;
          if (s.end !== 'string') break loop;
          break;
        }
        case 0x01: ops.push({ op: 'ram', binding: binding(rom.readWord(p), label) }); p += 2; break;
        case 0x02: {
          const flags = rom.readByte(p + 2);
          ops.push({ op: 'bcd', binding: binding(rom.readWord(p), label), bytes: flags & 0x1F,
            leadingZeroes: (flags & 0x80) !== 0, leftAlign: (flags & 0x40) !== 0, moneySign: (flags & 0x20) !== 0 });
          p += 3;
          break;
        }
        case 0x03: {
          const t = tile(rom.readWord(p), label);
          ops.push({ op: 'move', ...t });
          row = t.row === 14 ? 1 : t.row === 16 ? 2 : null;
          p += 2;
          break;
        }
        case 0x04: {
          const t = tile(rom.readWord(p), label);
          ops.push({ op: 'box', ...t, height: rom.readByte(p + 2), width: rom.readByte(p + 3) });
          p += 4;
          break;
        }
        case 0x05: ops.push({ op: 'low' }); row = 2; break;
        case 0x06: ops.push({ op: 'promptButton' }); break;
        case 0x07: ops.push({ op: 'scroll' }); row = 2; break;
        case 0x08: ops.push({ op: 'asm' }); break loop;
        case 0x09: {
          const n = rom.readByte(p + 2);
          ops.push({ op: 'decimal', binding: binding(rom.readWord(p), label), bytes: n >> 4, digits: n & 0x0F });
          p += 3;
          break;
        }
        case 0x0A: ops.push({ op: 'pause' }); break;
        case 0x0C: ops.push({ op: 'dots', count: rom.readByte(p++) }); break;
        case 0x0D: ops.push({ op: 'waitButton' }); break;
        case 0x17: { // TX_FAR
          const target = rom.readWord(p);
          const targetBank = rom.readByte(p + 2);
          p += 3;
          const child = byAddress.get(`${targetBank}:${target}`);
          if (!child) throw new Error(`${label}: text_far to unlisted $${targetBank.toString(16)}:${target.toString(16)}`);
          ops.push({ op: 'far', program: child });
          row = decode(child, row);
          break;
        }
        case 0x50: break loop; // TX_END
        default:
          if (SOUNDS[op]) { ops.push({ op: 'sound', sound: SOUNDS[op] }); break; }
          if (CRIES[op]) { ops.push({ op: 'cry', species: CRIES[op] }); break; }
          throw new Error(`${label}: unknown text command $${op.toString(16)} at ROM $${(p - 1).toString(16)}`);
      }
    }
    if (p >= limit) throw new Error(`${label}: text program runs past 4000 bytes`);
    active.delete(label);
    programs[label] = ops;
    endRows.set(label, row);
    return row;
  };

  // Roots start on the first text row (PrintText's (1, 14)); children only through their callers.
  for (const [label, , , root] of TEXT_PROGRAM_SYMBOLS) if (root) decode(label, 1);
  for (const [label, , , root] of TEXT_PROGRAM_SYMBOLS) {
    if (!root && !programs[label]) throw new Error(`${label} is listed as a FAR child but no listed program reaches it`);
  }
  // Output in label order, so the JSON is stable.
  return Object.fromEntries(Object.keys(programs).sort().map(k => [k, programs[k]]));
}
