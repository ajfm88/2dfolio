// No ROM: guard the A5b caller census against committed maps/programs and runtime sources.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import ts from 'typescript';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
import '../story/small_text_handlers';
import '../story/lab_text_handlers';
import { getTextHandler } from '../story/text_handlers';
import type { MapData } from '../core/types';
import type { TextProgramsFile } from '../rom/extractors/text_programs';

const src = resolve(__dirname, '..');
const data = resolve(src, '../data');
const file: TextProgramsFile = JSON.parse(readFileSync(resolve(data, 'text_programs.json'), 'utf8'));
const maps: MapData[] = readdirSync(resolve(data, 'maps')).filter(n => n.endsWith('.json'))
  .map(n => JSON.parse(readFileSync(resolve(data, 'maps', n), 'utf8')));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}
function ast(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}
function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node); ts.forEachChild(node, child => walk(child, visit));
}

describe('A5b text caller census tripwires', () => {
  it('every unhandled plain current-map call has only text and FAR operations, recursively', () => {
    let checked = 0;
    function textOnly(label: string, context: string, parents: string[] = []): void {
      expect(parents, `${context}: recursive FAR ${label}`).not.toContain(label);
      const ops = file.programs[label]; expect(ops, `${context}: missing ${label}`).toBeDefined();
      for (const op of ops) {
        if (op.op === 'far') textOnly(op.program, context, [...parents, label]);
        else expect(op.op, `${context}: ${label} must run as a handler/program, not flattened dialogue`).toBe('text');
      }
    }
    for (const map of maps) {
      for (const [table, calls] of Object.entries(file.textPointers)) {
        if (table !== `${map.name}_TextPointers` && table !== `${map.name}_TextPointers2`) continue;
        const reachable = new Set([...map.npcs, ...map.signs].map(object => object.textId));
        calls.forEach((call, index) => {
          if (!reachable.has(index + 1)) return;
          if (getTextHandler(map.name, index + 1) || (call.call !== 'text' && call.call !== 'printText')) return;
          textOnly(call.program, `${table}:${index + 1}`); checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('every object on a map using awaitInteraction resolves to a handler or a plain call', () => {
    const awaits = new Set<string>();
    for (const path of sources(src)) walk(ast(path), node => {
      if (!ts.isPropertyAssignment(node) || node.name.getText() !== 'type'
        || !ts.isStringLiteral(node.initializer) || node.initializer.text !== 'awaitInteraction') return;
      // Current map builders live in story/<snake_case_map>.ts. New ownership must be explicit.
      const stem = basename(path, '.ts').replace(/_/g, '').toLowerCase();
      const map = maps.find(m => m.name.toLowerCase() === stem);
      expect(map, `awaitInteraction emitter ${relative(src, path)} needs a current map census`).toBeDefined();
      awaits.add(map!.name);
    });
    expect([...awaits]).toContain('OaksLab');
    for (const name of awaits) {
      const map = maps.find(m => m.name === name)!;
      expect(map.npcs.length).toBeGreaterThan(0);
      for (const npc of map.npcs) {
        const call = file.textPointers[`${name}_TextPointers`]?.[(npc.textId ?? 0) - 1];
        expect(!!getTextHandler(name, npc.textId) || call?.call === 'text' || call?.call === 'printText',
          `${name}:${npc.id} (${npc.textId}) would reach the dead free-move NPC fallback`).toBe(true);
      }
    }
  });

  it('getText calls remain only in the approved A5c consumers', () => {
    const allowed = new Set(['text/game_text.ts', 'battle/battle.ts', 'battle/effects.ts',
      'battle/catch_demo_screen.ts', 'menus/party_menu.ts']);
    const callers = new Set<string>();
    for (const path of sources(src)) walk(ast(path), node => {
      // AST inspection excludes comments, declarations and test literals.
      if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'getText') return;
      const name = relative(src, path).replace(/\\/g, '/');
      expect(allowed.has(name), `${name}: migrate the new getText caller to a source program`).toBe(true);
      callers.add(name);
    });
    expect([...callers].sort()).toEqual([...allowed].filter(n => n !== 'text/game_text.ts').sort());
  });
});
