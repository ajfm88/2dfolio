// Verified against run.test.ts before deletion; thereafter an enabled-replacement record.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
interface Row { line: number; title: string; disposition: 'replace' | 'correct'; rule: string; file: string; test: string }
const row = (line: number, title: string, disposition: Row['disposition'], rule: string, test: string): Row =>
  ({ line, title, disposition, rule, file: 'battle_run.test.ts', test });
const RUN: Row[] = [
  row(11, 'always escapes when player speed > enemy speed', 'replace', 'core.asm:1560–1566 StringCmp returns NC for player greater, with no BattleRandom', 'player faster escapes without a BattleRandom draw'),
  row(17, 'always escapes when player speed equals enemy speed', 'replace', 'core.asm:1560–1566 StringCmp returns NC on equality, with no BattleRandom', 'equal speeds escape without a BattleRandom draw'),
  row(21, 'always escapes when enemy speed is 0-3 (divisor becomes 0)', 'replace', 'core.asm:1577–1589 shifted low divisor zero escapes without a BattleRandom', 'enemy speeds zero through three escape without a BattleRandom draw'),
  row(26, 'always escapes when (enemySpeed / 4) mod 256 is 0', 'replace', 'core.asm:1577–1589 retains only shifted A; speed1024 produces low zero', 'enemy speed1024 discards the shifted high byte and escapes without a draw'),
  row(33, 'succeeds when random value is below escape factor', 'correct', 'core.asm:1604–1608 compares one BattleRandom byte with NC success, never Math.random', 'compare below the factor escapes with exactly one BattleRandom draw'),
  row(43, 'succeeds when random value equals escape factor', 'correct', 'core.asm:1604–1608 CP/JR NC escapes on quotient equal to BattleRandom byte', 'compare equal to the factor escapes with exactly one BattleRandom draw'),
  row(49, 'fails when random value exceeds escape factor', 'correct', 'core.asm:1604–1613 larger BattleRandom fails, consumes the turn and prints CantEscapeText', 'compare above the factor fails with exactly one BattleRandom draw'),
  row(57, 'adds 30 per additional attempt', 'replace', 'core.asm:1594–1602 DEC C before ADD30 gives no bonus for first attempt', 'each earlier attempt adds exactly30 before the compare'),
  row(67, 'auto-escapes when bonus overflows past 255', 'replace', 'core.asm:1596–1602 stores low byte then escapes on carry without random', 'the addition carry escapes without a BattleRandom draw'),
  row(75, 'auto-escapes when quotient exceeds 255', 'replace', 'core.asm:1590–1593 Divide b2 stores quotient high; nonzero high escapes draw-free', 'a quotient above255 escapes without a BattleRandom draw'),
  row(81, 'fails with very slow player against fast enemy on first attempt', 'correct', 'core.asm:1594–1613 first attempt keeps q6, below pinned BattleRandom255', 'a very slow first attempt fails against random255'),
];
interface Case { line: number; title: string; disabled: boolean }
function cases(file: string): Case[] {
  const path = resolve(__dirname, file), sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: Case[] = [];
  function visit(node: ts.Node, blocked = false): void {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(sf);
      const disabled = blocked || /\.(skip|todo|only|skipIf|runIf)\b/.test(expression);
      if (/^(it|test)(?:\.|\(|$)/.test(expression)) {
        const title = node.arguments[0];
        if (title && ts.isStringLiteralLike(title)) out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, title: title.text, disabled });
      }
      if (/^describe(?:\.|\(|$)/.test(expression)) blocked = disabled;
    }
    ts.forEachChild(node, child => visit(child, blocked));
  }
  visit(sf); return out;
}

it('records all eleven original RUN cases, verified before deletion and absent after retirement', () => {
  expect(RUN).toHaveLength(11); expect(new Set(RUN.map(r => r.line)).size).toBe(11);
  if (process.env.PKMN_VERIFY_OLD_RUN === '1') {
    expect(cases('run.test.ts').map(({ line, title }) => ({ line, title })))
      .toEqual(RUN.map(({ line, title }) => ({ line, title })));
  } else {
    expect(existsSync(resolve(__dirname, 'run.test.ts'))).toBe(false);
    expect(existsSync(resolve(__dirname, 'run.ts'))).toBe(false);
    const menu = ts.createSourceFile('battle_menu.ts', readFileSync(resolve(__dirname, 'battle_menu.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
    expect(menu.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === 'cartridgeRunOdds')).toBe(false);
  }
});
it('every RUN manifest row names one enabled replacement and its ASM rule', () => {
  for (const r of RUN) {
    const found = cases(r.file).filter(c => c.title === r.test);
    expect(found, `run.test.ts:${r.line} -> ${r.file}: ${r.test}`).toHaveLength(1);
    expect(found[0].disabled).toBe(false);
    expect(['replace', 'correct']).toContain(r.disposition); expect(r.rule.length).toBeGreaterThan(25);
  }
});
