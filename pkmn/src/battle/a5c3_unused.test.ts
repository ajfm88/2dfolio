import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('the running production import graph cannot reach the unused A5c3 ports', () => {
  const src = resolve(__dirname, '..');
  const forbidden = new Set([
    'battle_items', 'battle_item_state', 'battle_item_bodies', 'battle_item_ball', 'battle_flute_audio', 'battle_item_flute', 'battle_item_medicine', 'battle_item_medicine_env', 'battle_item_pp',
    'battle_end_state', 'battle_end_helpers', 'battle_pikachu', 'battle_voice_cues', 'battle_two_option', 'battle_slides', 'battle_audio', 'battle_send_out', 'battle_enemy_send_out',
    'battle_calc_stats', 'battle_calc_experience', 'battle_experience', 'learn_move', 'battle_faint', 'battle_end', 'battle_loop',
    'battle_effects_registry', 'battle_effects_hp', 'battle_effects_turns', 'battle_effects_stats', 'battle_effects_status', 'battle_screen_binding', 'battle_effects', 'battle_move_data', 'battle_turn_text', 'battle_turn_status', 'battle_obedience',
    'battle_hp', 'battle_residual', 'battle_hud_state', 'battle_arithmetic',
    'battle_damage_asm', 'battle_hit', 'battle_apply', 'battle_execute', 'battle_execute_helpers', 'battle_turn',
  ].map(name => resolve(src, 'battle', `${name}.ts`)));
  const visited = new Set<string>();
  const reachable: string[] = [];
  function walk(file: string, chain: string[]): void {
    if (visited.has(file)) return;
    visited.add(file);
    if (forbidden.has(file)) reachable.push([...chain, file].join(' -> '));
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function follow(specifier: ts.Expression | undefined): void {
      if (!specifier || !ts.isStringLiteralLike(specifier) || !specifier.text.startsWith('.')) return;
      const base = resolve(dirname(file), specifier.text);
      const target = [base + '.ts', base + '.tsx', resolve(base, 'index.ts'),
        ...(base.endsWith('.ts') || base.endsWith('.tsx') ? [base] : []),
        ...(base.endsWith('.js') ? [base.slice(0, -3) + '.ts'] : [])].find(existsSync);
      if (target) walk(target, [...chain, file]);
      else if (!/\.[a-z0-9]+$/i.test(base)) throw new Error(`unresolved relative import: ${file} -> ${specifier.text}`);
    }
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) follow(node.moduleSpecifier);
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) follow(node.arguments[0]);
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) follow(node.moduleReference.expression);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  walk(resolve(src, 'main.ts'), []);
  expect(visited.size).toBeGreaterThan(1);
  expect(reachable).toEqual([]);
});
