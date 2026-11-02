import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

function productionGraph() {
  const offenders: string[] = [], extractors: string[] = [];
  const src = resolve(__dirname,'..'), visited = new Set<string>(), chains = new Map<string,string[]>();
  function walk(file:string, chain:string[], names:Set<string> = new Set(['*'])):void {
    const key=file+'|'+[...names].sort().join(',');
    if(visited.has(key))return;visited.add(key);
    if(!chains.has(file))chains.set(file,[...chain,file]);
    const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
    const follow=(specifier:ts.Expression|undefined,wanted:Set<string>)=>{
      if(!specifier||!ts.isStringLiteralLike(specifier))return;
      if(specifier.text.startsWith('node:')||['fs','path','url'].includes(specifier.text)) {
        offenders.push([...chain,file,specifier.text].map(p=>p.startsWith(src)?p.slice(src.length+1).replace(/\\/g,'/'):p).join(' -> '));
      }
      if(!specifier.text.startsWith('.'))return;
      const base=resolve(dirname(file),specifier.text);
      const target=[base+'.ts',base+'.tsx',resolve(base,'index.ts'),...(base.endsWith('.ts')?[base]:[]),
        ...(base.endsWith('.js')?[base.slice(0,-3)+'.ts']:[])].find(existsSync);
      if(target) {
        const normalized=target.replace(/\\/g,'/');
        if(normalized.includes('/rom/extractors/') &&
          (normalized!==resolve(src,'rom/extractors/text.ts').replace(/\\/g,'/') ||
           [...wanted].some(name=>name!=='decodeTextByte') || wanted.size===0)) {
          extractors.push([...chain,file,target+' ['+[...wanted].join(', ')+']'].map(p=>p.slice(src.length+1).replace(/\\/g,'/')).join(' -> '));
        }
        walk(target,[...chain,file],wanted);
      }
      else if(!/\.[a-z0-9]+$/i.test(base.split('?')[0]))throw new Error(`unresolved import ${file}: ${specifier.text}`);
    };
    function visit(node:ts.Node):void {
      if(ts.isImportDeclaration(node)){
        const clause=node.importClause;if(clause?.isTypeOnly)return;
        const wanted=new Set<string>();if(clause?.name)wanted.add('default');
        if(clause?.namedBindings){
          if(ts.isNamespaceImport(clause.namedBindings))wanted.add('*');
          else clause.namedBindings.elements.filter(e=>!e.isTypeOnly).forEach(e=>wanted.add((e.propertyName??e.name).text));
        }
        if(!clause||wanted.size)follow(node.moduleSpecifier,wanted);
        return;
      }
      if(ts.isExportDeclaration(node)&&node.moduleSpecifier){
        if(node.isTypeOnly)return;
        const wanted=new Set<string>();
        if(node.exportClause&&ts.isNamedExports(node.exportClause)){
          node.exportClause.elements.filter(e=>!e.isTypeOnly&&(names.has('*')||names.has(e.name.text)))
            .forEach(e=>wanted.add((e.propertyName??e.name).text));
        }else names.forEach(name=>wanted.add(name));
        // Resolve only the requested runtime exports of barrels. Unused Battle
        // re-exports are erased by the bundler, just like type-only imports.
        if(wanted.size)follow(node.moduleSpecifier,wanted);return;
      }
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)follow(node.arguments[0],new Set(['*']));
      ts.forEachChild(node,visit);
    }
    visit(source);
  }
  walk(resolve(src,'main.ts'),[]);
  return { src, chains, offenders, extractors };
}

it('the production graph reaches the session and live adapter, but cannot reach the old Battle', () => {
  const {src,chains}=productionGraph();
  expect(chains.has(resolve(src,'battle/battle_session.ts'))).toBe(true);
  expect(chains.has(resolve(src,'battle/battle_live.ts'))).toBe(true);
  expect(chains.get(resolve(src,'battle/battle.ts'))).toBeUndefined();
  if(process.env.PKMN_SWITCH_AUDIT){
    const old=['battle','battle_ui','effects','damage','status','volatiles','experience','run','catch','trainer_ai','trainer_flow'];
    writeFileSync(process.env.PKMN_SWITCH_AUDIT,JSON.stringify(Object.fromEntries(old.map(name=>
      [name,chains.get(resolve(src,'battle',name+'.ts'))?.map(file=>file.slice(src.length+1).replace(/\\/g,'/'))??null])),null,2)+'\n');
  }
});

it('the production runtime graph has no Node-only imports', () => {
  const {offenders}=productionGraph();
  expect(offenders, offenders.join('\n')).toEqual([]);
});

it('runtime extractor imports name only decodeTextByte from text', () => {
  const {extractors}=productionGraph();
  expect(extractors,extractors.join('\n')).toEqual([]);
});
