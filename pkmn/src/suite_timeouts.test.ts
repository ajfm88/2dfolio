// The timing-tests slice (DECISIONS #90): one suite-wide timeout, set in vitest.config.ts.
import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const src = __dirname;
const VITEST_CALLS = ['it', 'test', 'describe', 'beforeAll', 'beforeEach', 'afterAll', 'afterEach'];

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? testFiles(path) : path.endsWith('.test.ts') ? [path] : [];
  });
}

/** `it.each(...)(...)`, `it.skip(...)` and `describe.only(...)` all root at the bare vitest identifier. */
function callRoot(node: ts.Expression): ts.Expression {
  while (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node) || ts.isTaggedTemplateExpression(node))
    node = ts.isCallExpression(node) ? node.expression : ts.isTaggedTemplateExpression(node) ? node.tag : node.expression;
  return node;
}

it('the suite has one timeout, vitest.config\'s 30 s: no case, suite or hook overrides it', ({ task }) => {
  expect(task.timeout).toBe(30_000);
  const offenders: string[] = [];
  for (const file of testFiles(src)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && node.arguments.length >= 2) {
        const root = callRoot(node.expression);
        if (ts.isIdentifier(root) && VITEST_CALLS.includes(root.text)) {
          const last = node.arguments[node.arguments.length - 1];
          const options = node.arguments.some(arg => ts.isObjectLiteralExpression(arg)
            && arg.properties.some(p => p.name !== undefined && p.name.getText(source) === 'timeout'));
          if (ts.isNumericLiteral(last) || options)
            offenders.push(`${relative(src, file).replace(/\\/g, '/')}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(offenders).toEqual([]);
});
