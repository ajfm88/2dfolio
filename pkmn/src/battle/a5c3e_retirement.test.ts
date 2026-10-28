// Executable switch-over plan only. No old case or live caller is retired in A5c3e.
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface Row {line:number;title:string;disposition:'replace'|'correct'|'keep'|'delete'|'rename';rule:string;file:string;test:string;example?:string}
const row=(line:number,title:string,disposition:Row['disposition'],rule:string,file:string,test:string,example?:string):Row=>
  ({line,title,disposition,rule,file,test,...(example?{example}:{})});
const ball='battle_item_ball.test.ts',moves='battle_ai_moves.test.ts';
const worked='$name: exact worked-table draws and animation';
// note71 §10.1.19: retain supported outcomes, correct invented probability/PP rules.
const CATCH:Row[]=[
  row(11,'always catches','replace','item_effects.asm:189–211: Master consumes Rand1 and captures43, with no W math',ball,worked,'Master consumes draw'),
  row(20,'Poke Ball: rand1 range [0, 255]','replace','item_effects.asm:189–238: full-byte Poke Rand1, rate failure20 and no Rand2',ball,worked,'Poke miss0'),
  row(33,'FRZ/SLP subtract 25: underflow catches','replace','item_effects.asm:211–238: freeze/sleep subtract25 borrow captures before Rand2',ball,'status byte%s has its exact borrow threshold'),
  row(44,'BRN/PAR/PSN subtract 12: underflow catches','replace','item_effects.asm:211–238: other nonzero statuses subtract12 and borrow captures',ball,'status byte%s has its exact borrow threshold'),
  row(57,'rand1 > catchRate fails','replace','item_effects.asm:238–334: compute W, then adjusted Rand1>rate fails before Rand2',ball,worked,'Poke miss0'),
  row(70,'W > 255 catches immediately','replace','item_effects.asm:238–334: rate must pass first; W high skips Rand2',ball,worked,'W-high success'),
  row(84,'high z value gives 3 shakes','correct','item_effects.asm:381–434: Z>=70 gives63; replace unsupported old0..3 assertion with computedZ80',ball,worked,'Safari shake3'),
  row(100,'1 HP, sleeping, Ultra Ball: high catch chance','correct','item_effects.asm:189–211,238–334: raw-byte rejection, not floor(random*151); W high skips Rand2',ball,worked,'W-high success'),
];
const TRAINER:Row[]=[
  row(15,'single move: returns that move','replace','core.asm:3086–3176: even a single move consumes a band draw and rejects empty slots','battle_whole_trainer_ai.test.ts','T1 roll 32 refuses Potion'),
  row(23,'no PP moves: returns STRUGGLE','correct','core.asm:3086–3176: selection ignores PP; Struggle only for the sole disabled move','battle_math_fixes.test.ts','still uses Struggle for a sole disabled move, before invoking trainer scoring'),
  row(31,'0 PP moves heavily discouraged (score 50)','correct','trainer_ai.asm:18,191–257: disabled80, never PP50; inner scan ignores PP and Disable',moves,'counts a disabled 0-PP candidate and ignores a same-type damaging move'),
  row(46,'player has status: status moves get +5 score','replace','trainer_ai.asm:114–146: raw status, four zero-power effects and all six ReadMove bytes',moves,'adds 5 to Thunder Wave and Toxic, and not to a damaging or confusion move'),
  row(59,'player has no status: no modification','replace','trainer_ai.asm:114–116: zero status returns before any ReadMove',moves,'returns before ReadMove when the player status byte is 0'),
  row(75,'75% chance of no effect (random != 0)','correct','trainer_ai.asm:158–186: encouragement!=1 skips modification2, with no RNG',moves,'does nothing at encouragement 0 or 2, and does not ReadMove'),
  row(91,'25% chance: stat-mod moves get -1 score','correct','trainer_ai.asm:158–186: exactly encouragement1, two half-open effect ranges, no RNG',moves,'encourages the open ranges and rejects both upper bounds'),
  row(109,'super-effective gets -1 (encouraged)','replace','core.asm:5363–5406: first matching row20 encourages, including Yellow Dewgong exception',moves,'LORELEI Dewgong at $65 and $66'),
  row(122,'not-very-effective gets +1 if better move exists','replace','trainer_ai.asm:217–255: different-type damage or special effects count, even disabled0PP',moves,'counts a disabled 0-PP candidate and ignores a same-type damaging move'),
  row(137,'multiple modifiers applied in order','correct','trainer_ai.asm:37–54: actual class1/2/3 order; original fixture only ran3',moves,'POKEMANIAC on the encouragement turn'),
];
// note71 §10.15/§11.32: these six titles now describe unreachable modifier lists.
const STALE:Row[]=[
  row(107,'keeps every tied minimum, including 0-PP moves','delete','trainer_ai.asm:34–35,258–259: no class contains4; actual ties need a nonempty class',moves,'keeps every tied minimum and only the later lower score'),
  row(120,'the disabled score excludes that slot from a modified tie','rename','trainer_ai.asm:18,102–104: empty class returns raw moves after writing disabled80',moves,'an empty list returns the original moves, disabled score included'),
  row(127,'does not penalize a zero-PP move beside a positive-PP move in the scoring path','delete','trainer_ai.asm:102–104: PP unread, modification4 is never listed',moves,'counts a disabled 0-PP candidate and ignores a same-type damaging move'),
  row(134,'applies modifier 2 through the unchanged upstream body','delete','move_choices.asm: no lone2; encouragement byte, not random25 percent',moves,'encourages the open ranges and rejects both upper bounds'),
  row(141,'applies modifier 3 through the unchanged upstream body','delete','move_choices.asm: SAILOR is1,3; no lone3 class exists',moves,'SAILOR with the player paralysed'),
  row(148,'wraps scores as bytes during upstream writes, rather than after the whole dispatch','delete','trainer_ai.asm:37–54: actual class lists run each modification at most once; scores cannot wrap',moves,'every class list filters to the minimum non-empty slots'),
];

interface Case {line:number;title:string;disabled:boolean}
function source(file:string){return ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);}
function cases(file:string):Case[]{
  const sf=source(resolve(__dirname,file)),out:Case[]=[];
  function visit(node:ts.Node,blocked=false):void{
    if(ts.isCallExpression(node)){
      const expression=node.expression.getText(sf);
      const disabled=blocked||/\.(skip|todo|only|skipIf|runIf)\b/.test(expression);
      if(/^(it|test)(?:\.|\(|$)/.test(expression)){
        const title=node.arguments[0];
        if(title&&ts.isStringLiteralLike(title))out.push({line:sf.getLineAndCharacterOfPosition(node.getStart()).line+1,title:title.text,disabled});
      }
      if(/^describe(?:\.|\(|$)/.test(expression))blocked=disabled;
    }
    ts.forEachChild(node,child=>visit(child,blocked));
  }visit(sf);return out;
}

const SYMBOLS={attemptCatch:'delete',selectTrainerMove:'delete',applyTrainerMoveModifiers:'delete',
  loadTrainerData:'keep',getTrainerClass:'keep',TrainerMoveSelection:'keep'} as const;
// The class-data getters and their barrel exports serve main's story/encounter/sight setup.
// TrainerMoveSelection is the NEW byte-selector's model-check type, required by both real loop ports.
const CALLERS=[
  'battle/battle.ts imports attemptCatch delete',
  'battle/battle.ts imports selectTrainerMove delete',
  'battle/battle_loop.ts imports TrainerMoveSelection keep',
  'battle/battle_turn.ts imports TrainerMoveSelection keep',
  'battle/index.ts exports attemptCatch delete',
  'battle/index.ts exports getTrainerClass keep',
  'battle/index.ts exports loadTrainerData keep',
  'main.ts imports getTrainerClass keep',
  'main.ts imports loadTrainerData keep',
].sort();

function callers():string[]{
  const root=resolve(__dirname,'..'),files:string[]=[];
  function walk(dir:string):void{for(const ent of readdirSync(dir,{withFileTypes:true})){
    const path=resolve(dir,ent.name);
    if(ent.isDirectory()){if(!['test','__snapshots__'].includes(ent.name))walk(path);}
    else if(ent.name.endsWith('.ts')&&!ent.name.endsWith('.test.ts'))files.push(path);
  }}walk(root);
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,
    moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,noLib:true,types:[]});
  const checker=program.getTypeChecker(),out=new Set<string>();
  function add(file:string,kind:string,symbol:ts.Symbol|undefined):void{
    if(!symbol)return;
    if(symbol.flags&ts.SymbolFlags.Alias)symbol=checker.getAliasedSymbol(symbol);
    const name=symbol.name as keyof typeof SYMBOLS;if(!(name in SYMBOLS))return;
    const owner=name==='attemptCatch'?'catch.ts':name==='TrainerMoveSelection'?'battle_math.ts':'trainer_ai.ts';
    if(!symbol.declarations?.some(d=>resolve(d.getSourceFile().fileName)===resolve(__dirname,owner)))return;
    out.add(`${relative(root,file).replace(/\\/g,'/')} ${kind} ${name} ${SYMBOLS[name]}`);
  }
  for(const file of files){
    const sf=program.getSourceFile(file)!;
    function visit(node:ts.Node):void{
      if(ts.isImportSpecifier(node))add(file,'imports',checker.getSymbolAtLocation(node.name));
      if(ts.isExportSpecifier(node))add(file,'exports',checker.getSymbolAtLocation(node.name));
      // Resolve namespace access and aliases with the checker, rather than matching text names.
      if(ts.isPropertyAccessExpression(node))add(file,'imports',checker.getSymbolAtLocation(node.name));
      if(ts.isElementAccessExpression(node)&&node.argumentExpression&&ts.isStringLiteralLike(node.argumentExpression))
        add(file,'imports',checker.getTypeAtLocation(node.expression).getProperty(node.argumentExpression.text));
      if(ts.isVariableDeclaration(node)&&ts.isObjectBindingPattern(node.name)&&node.initializer)
        for(const binding of node.name.elements)add(file,'imports',checker.getTypeAtLocation(node.initializer).getProperty((binding.propertyName??binding.name).getText(sf)));
      if(ts.isExportDeclaration(node)&&!node.exportClause&&node.moduleSpecifier){
        const symbol=checker.getSymbolAtLocation(node.moduleSpecifier);
        if(symbol)for(const exported of checker.getExportsOfModule(symbol))add(file,'exports',exported);
      }
      ts.forEachChild(node,visit);
    }visit(sf);
  }
  return [...out].sort();
}

describe('A5c3e executable retirement manifests for A5c3f',()=>{
  it.each([{file:'catch.test.ts',rows:CATCH,count:8},{file:'trainer_ai.test.ts',rows:TRAINER,count:10}])
  ('$file accounts for all $count old cases and unique enabled replacement titles',({file,rows,count})=>{
    expect(cases(file).map(({line,title})=>({line,title}))).toEqual(rows.map(({line,title})=>({line,title})));
    expect(rows).toHaveLength(count);expect(new Set(rows.map(r=>r.line)).size).toBe(count);
    for(const r of rows)replacement(file,r);
  });
  it('records all six stale math titles for deletion or rename without editing them',()=>{
    expect(STALE).toHaveLength(6);
    for(const r of STALE){
      expect(cases('battle_math_fixes.test.ts').filter(c=>c.line===r.line&&c.title===r.title)).toHaveLength(1);
      expect(['delete','rename']).toContain(r.disposition);replacement('battle_math_fixes.test.ts',r);
    }
  });
  it('pins every non-test importer and barrel export, preserving the class-data getters',()=>{
    expect(callers()).toEqual(CALLERS);
    expect(SYMBOLS).toEqual({attemptCatch:'delete',selectTrainerMove:'delete',applyTrainerMoveModifiers:'delete',
      loadTrainerData:'keep',getTrainerClass:'keep',TrainerMoveSelection:'keep'});
  },20000);
});

function replacement(original:string,r:Row):void{
  const found=cases(r.file).filter(c=>c.title===r.test);
  expect(found,`${original}:${r.line} -> ${r.file}: ${r.test}`).toHaveLength(1);
  expect(found[0].disabled).toBe(false);expect(r.rule.length).toBeGreaterThan(25);
  if(r.example){
    const sf=source(resolve(__dirname,r.file)),names:string[]=[];
    function visit(node:ts.Node):void{
      if(ts.isPropertyAssignment(node)&&node.name.getText(sf)==='name'&&ts.isStringLiteralLike(node.initializer))names.push(node.initializer.text);
      ts.forEachChild(node,visit);
    }visit(sf);expect(names.filter(name=>name===r.example)).toHaveLength(1);
  }
  if(r.disposition==='keep')expect(r.file).toBe(original);else expect(r.file).not.toBe(original);
}
