// V2b's approved gap: V3 must resolve the east edge before Brock can be beaten.
import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import type { MapData } from '../core/types';

const src = resolve(__dirname, '..');
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? ['rom', 'test'].includes(entry.name) ? [] : sources(path)
      : path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

it('BEAT_BROCK cannot become settable before Pewter has a named east connection to Route3', () => {
  const paths = sources(src), program = ts.createProgram(paths, { target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true });
  const checker = program.getTypeChecker(), setters: string[] = [];
  const literal = (node: ts.Node): string | undefined => {
    const type = checker.getTypeAtLocation(node);
    return type.isStringLiteral() ? type.value : undefined;
  };
  for (const path of paths) {
    const source = program.getSourceFile(path)!;
    const found = (node: ts.Node) => setters.push(`${relative(src, path)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    function walk(node: ts.Node): void {
      if (ts.isCallExpression(node)) {
        const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
        let symbol = checker.getSymbolAtLocation(name);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        if (symbol?.name === 'setFlag' && node.arguments[0] && literal(node.arguments[0]) === 'BEAT_BROCK') found(node);
      } else if (ts.isObjectLiteralExpression(node)) {
        const props = node.properties.filter(ts.isPropertyAssignment);
        const type = props.find(p => p.name.getText(source).replace(/['"]/g, '') === 'type');
        const flag = props.find(p => p.name.getText(source).replace(/['"]/g, '') === 'flag');
        if (type && flag && literal(type.initializer) === 'setFlag' && literal(flag.initializer) === 'BEAT_BROCK') found(node);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  const pewter: MapData = JSON.parse(readFileSync(resolve(src, '../data/maps/PewterCity.json'), 'utf8'));
  const route3 = pewter.connections.some(c => c.direction === 'east' && c.mapName === 'Route3');
  expect(route3 || setters.length === 0,
    `V3 must resolve the post-Brock east edge before these BEAT_BROCK setters are reachable: ${setters.join(', ')}`).toBe(true);
});
