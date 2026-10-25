// note70 §9.1.11. Individual assertions migrate; the legacy files/helpers stay until A5c3f.
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';

type Disposition = 'replace' | 'correct' | 'keep';
interface Row { line:number; title:string; disposition:Disposition; file:string; test:string; rule:string; helper:string }
const growth='rate %i matches the integer polynomial with 24-bit wraps, levels 0..255';
const search='CalcLevelFromExperience loads the selected header and accepts equality without a level-100 cap';
const send='battle_send_out.test.ts';
function row(line:number,title:string,disposition:Disposition,file:string,test:string,rule:string,helper:string):Row {
  return {line,title,disposition,file,test,rule,helper};
}
const EXP:Row[]=[
  row(17,'level 1 returns 0 for all growth rates','correct','battle_calc_experience.test.ts','keeps level-one and level-zero underflows instead of the live helper policy','experience.asm:31–137; raw underflows, field policy survives','totalExpForLevel'),
  row(24,'MEDIUM_FAST level 100 = 1,000,000','replace','battle_calc_experience.test.ts',growth,'growth_rates.asm:15; rate0 L100','totalExpForLevel'),
  row(28,'FAST level 100 = 800,000','replace','battle_calc_experience.test.ts',growth,'growth_rates.asm:19; rate4 L100','totalExpForLevel'),
  row(32,'SLOW level 100 = 1,250,000','replace','battle_calc_experience.test.ts',growth,'growth_rates.asm:20; rate5 L100','totalExpForLevel'),
  row(36,'MEDIUM_FAST level 10 = 1000','replace','battle_calc_experience.test.ts',growth,'growth_rates.asm:15; rate0 L10','totalExpForLevel'),
  row(40,'FAST level 10 = 800','replace','battle_calc_experience.test.ts',growth,'growth_rates.asm:19; rate4 L10','totalExpForLevel'),
  row(44,'SLOW level 10 = 1250','replace','battle_calc_experience.test.ts',growth,'growth_rates.asm:20; rate5 L10','totalExpForLevel'),
  row(48,'MEDIUM_SLOW level 10','replace','battle_calc_experience.test.ts',growth,'experience.asm:39–58; rate3 floors cubic before square','totalExpForLevel'),
  row(57,'level 100 returns 0','keep','experience.test.ts','level 100 returns 0','field StatusScreen/debug: expToNextLevel policy remains','expToNextLevel'),
  row(61,'returns positive value for normal level','keep','experience.test.ts','returns positive value for normal level','field StatusScreen/debug: expToNextLevel policy remains','expToNextLevel'),
  row(71,'0 exp = level 1','replace','battle_calc_experience.test.ts',search,'experience.asm:6–28; starts at2, returns1','calcLevelFromExp'),
  row(75,'exact threshold = that level','replace','battle_calc_experience.test.ts',search,'experience.asm:13–27; equality accepted','calcLevelFromExp'),
  row(80,'one below threshold = previous level','replace','battle_calc_experience.test.ts',search,'experience.asm:13–27; first excess ends search','calcLevelFromExp'),
  row(84,'huge exp = level 100','correct',send,'loads growth byte %i and caps EXP at the matching level100 polynomial','battle/experience.asm:108–142 caps legal award; raw search has no100 clamp','calcLevelFromExp'),
  row(92,'wild: floor(baseExp * level / 7)','replace',send,'applies sequential integer boosts $traded/$trainer with printed gain $gained','battle/experience.asm:57–68,93–105; division BEFORE multiplication','calcExpGain'),
  row(101,'trainer: 1.5x multiplier','replace',send,'applies sequential integer boosts $traded/$trainer with printed gain $gained','battle/experience.asm:69–88,334–346; trade then trainer, floor twice','calcExpGain'),
  row(110,'minimum 1','correct','battle_whole.test.ts','zero EXP still adds stat experience and prints zero without a minimum-one award','battle/experience.asm:24–68; no minimum1','calcExpGain'),
  row(122,'no level up when insufficient exp','replace',send,'unchanged level updates EXP/stat-exp only, without any level-up text, stats wait or evolution bit','battle/experience.asm:155–162; no level change','gainExperience'),
  row(129,'single level up recalculates stats','replace',send,'independently calculates all five party stats and applies the max-HP difference with a 16-bit wrap','battle/experience.asm:175–204; five stat-exp stats and HP delta','gainExperience'),
  row(140,'multiple level ups at once','correct',send,'levels a reserve once at the final level, preserves box level/active data and restores curEnemyLevel','battle/experience.asm:158–170,248–267; one final-level block','gainExperience'),
  row(148,'exp capped at level 100 exp','replace',send,'loads growth byte %i and caps EXP at the matching level100 polynomial','battle/experience.asm:108–142; 24-bit EXP cap','gainExperience'),
  row(159,'sets exp to exact amount for current level','keep','experience.test.ts','sets exp to exact amount for current level','field constructors/save/debug/script still initialize EXP','initExperience'),
  row(169,'move learned normally when moveset has space','replace',send,'uses the first empty slot%i without asking, resets its PP Ups and copies the exact six-byte record','learn_move.asm:12–55,92–96; base PP and B1','gainExperience'),
  row(191,'returns pendingMoves when moveset is full','correct',send,'NO to abandonment restarts the full DontAbandonLearning scan/question and saves Buffer1 only once','learn_move.asm:19–35,76–110; real questions replace invented queue','gainExperience'),
  row(214,'duplicate moves are silently skipped','replace',send,'a first matching move already in move slot%i ends the whole same-level scan','evos_moves.asm:351–357; first exact-level duplicate terminates','gainExperience'),
  row(236,'replaces the move at the specified index','replace',send,'refuses HM%i and restarts WhichMoveToForget with cursor0, then permits an ordinary move','learn_move.asm:39–73,157–180; HM rejection and basePP; battle.ts still calls forceLearnMove','forceLearnMove'),
];
const TRAINER:Row[]=[
  row(19,'plays the male track for any class not on a list','keep','trainer_flow.test.ts','plays the male track for any class not on a list','home/trainers.asm:381–425; main overworld encounter','meetMusicFor'),
  row(25,'plays the female track for FemaleTrainerList','keep','trainer_flow.test.ts','plays the female track for FemaleTrainerList','encounter_types.asm; main overworld encounter','meetMusicFor'),
  row(31,'plays the evil track for EvilTrainerList','keep','trainer_flow.test.ts','plays the evil track for EvilTrainerList','encounter_types.asm; evil before female','meetMusicFor'),
  row(37,'plays nothing for the rivals or a gym leader','keep','trainer_flow.test.ts','plays nothing for the rivals or a gym leader','home/trainers.asm:381–397; main overworld encounter','meetMusicFor'),
  row(45,'is defeatedtrainer, or defeatedgymleader for a gym leader or RIVAL3','replace',send,'rehosts trainer victory for $trainer/$gym','core.asm:930–947; main and new faint still consume victoryMusicFor','victoryMusicFor'),
  row(54,'puts "NAME: " in front of the first line and pages two lines at a time','correct','battle_whole.test.ts','trainer end text keeps the source prefix cursor through its selected program','home/trainers.asm:334–379; retained printer replaces array surrogate','endBattleTextPages'),
  row(61,'starts a new page at a paragraph break','keep','trainer_flow.test.ts','starts a new page at a paragraph break','legacy battle/catch-demo still use array pages until switch-over','battleTextPages'),
  row(65,"keeps every map trainer's prefixed first line within the text box",'keep','trainer_flow.test.ts',"keeps every map trainer's prefixed first line within the text box",'home/trainers.asm:374–379; preserve five-trainer map census until equivalent program coverage','endBattleTextPages'),
  row(83,'moves one tile left every 4 frames, from tile 19 to tile 14','replace','battle_slides.test.ts','trainer return is palette2 held+3 serviced, copy7, then six4-frame growing columns from19 to14','scroll_draw_trainer_pic.asm:4–32; real palette/copy/BG thirds','picScrollX'),
  row(94,'runs music → defeated → pic scroll → 40 frames → end text → money','replace','battle_whole.test.ts','trainer win accepts SHIFT, sends the enemy before the player, and awards money after end text','core.asm:929–963; actual loop and end Programs','victorySequence'),
  row(110,'skips only the end text when none was saved','correct','battle_whole.test.ts','end-text flag is consumed even for an empty source and does not replay on the next call','home/trainers.asm:334–355; flag gate replaces empty-string proxy','victorySequence'),
  row(119,'prints only the blackout text against a map trainer','replace',send,'ordinary blackout uses black palette, text, clears only bike bit and then all logical cells, returning carry','core.asm:1189–1204; palette/bike/carry','lossSequence'),
  row(125,"shows RIVAL1's pic and win text, with no blackout in Oak's Lab",'replace','battle_whole.test.ts','RIVAL1 loss in Oaks Lab scrolls the trainer and returns without blackout','core.asm:1172–1188; real KO, loop and end','lossSequence'),
  row(135,'blacks out after the RIVAL1 text anywhere else','replace',send,'Rival1 special prefix on map$map returns carry$carry','core.asm:1175–1204; Lab gate then black palette','lossSequence'),
  row(141,'treats a wild battle like a map trainer','replace','battle_whole.test.ts','ordinary blackout follows an actual enemy KO and skips evolution','core.asm:1175–1177,1189–1204; actual wild loss','lossSequence'),
  row(149,'resolves every trainer class to an exported pic','keep','trainer_flow.test.ts','resolves every trainer class to an exported pic','init_battle.asm:143–158; live battle_ui asset mapping survives','trainerPicName'),
  row(161,'is Flareon after a win and Vaporeon after a loss','keep','trainer_flow.test.ts','is Flareon after a win and Vaporeon after a loss','scripts/OaksLab.asm; story/oaks_lab.ts caller survives','rivalStarterAfterLabBattle'),
];

interface Case {line:number;title:string;disabled:boolean}
function source(file:string){return ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);}
function cases(file:string):Case[]{
  const sf=source(resolve(__dirname,file)),out:Case[]=[];
  function visit(node:ts.Node):void{
    if(ts.isCallExpression(node)){
      const expression=node.expression.getText(sf);
      if(/^(it|test)(?:\.(?:each|skip|only|skipIf|runIf)(?:\([\s\S]*\))?)*$/.test(expression)){
        const title=node.arguments[0];
        if(title&&ts.isStringLiteralLike(title))out.push({line:sf.getLineAndCharacterOfPosition(node.getStart()).line+1,
          title:title.text,disabled:/\.(skip|only|skipIf|runIf)/.test(expression)});
      }
    }
    ts.forEachChild(node,visit);
  }visit(sf);return out;
}

/** Every direct legacy import/call and barrel re-export, with aliases resolved. Field consumers must survive. */
function callers(){
  const root=resolve(__dirname,'..'),out:string[]=[];
  const helpers=new Set([...EXP,...TRAINER].map(r=>r.helper).concat(
    ['PIC_SCROLL_FRAMES','PIC_SCROLL_FINAL_X','AFTER_PIC_SCROLL_DELAY','BATTLE_TEXT_WIDTH','RIVAL_STARTER']));
  function walk(dir:string){for(const file of readdirSync(dir,{withFileTypes:true})){
    const path=resolve(dir,file.name);
    if(file.isDirectory()){if(file.name!=='test'&&file.name!=='__snapshots__')walk(path);continue;}
    if(!file.name.endsWith('.ts')||file.name.endsWith('.test.ts'))continue;
    const sf=source(path),imports=new Map<string,string>();
    if(path===resolve(root,'battle/experience.ts')||path===resolve(root,'battle/trainer_flow.ts'))
      for(const helper of helpers)imports.set(helper,helper);
    for(const node of sf.statements){
      if(!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))||!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
      const target=resolve(dirname(path),node.moduleSpecifier.text);
      if(!['battle','battle/index','battle/experience','battle/trainer_flow'].some(x=>target===resolve(root,x)))continue;
      const named=ts.isImportDeclaration(node)?node.importClause?.namedBindings:node.exportClause;
      if(named&&(ts.isNamedImports(named)||ts.isNamedExports(named)))for(const spec of named.elements){
        const original=spec.propertyName?.text??spec.name.text;
        if(helpers.has(original)){
          imports.set(spec.name.text,original);
          out.push(`${relative(root,path).replace(/\\/g,'/')} ${ts.isExportDeclaration(node)?'exports':'imports'} ${original}`);
        }
      }
    }
    function visit(node:ts.Node):void{
      if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&imports.has(node.expression.text))
        out.push(`${relative(root,path).replace(/\\/g,'/')} calls ${imports.get(node.expression.text)}`);
      ts.forEachChild(node,visit);
    }visit(sf);
  }}walk(root);return out.sort();
}

describe('checkpoint-08b executable retirement manifests',()=>{
  it.each([{file:'experience.test.ts',rows:EXP,count:26},{file:'trainer_flow.test.ts',rows:TRAINER,count:17}])
  ('$file has exactly $count individually accounted cases and unique enabled replacement titles',({file,rows,count})=>{
    const original=cases(file);expect(original).toHaveLength(count);expect(rows).toHaveLength(count);
    expect(original.map(({line,title})=>({line,title}))).toEqual(rows.map(({line,title})=>({line,title})));
    expect(new Set(rows.map(r=>r.line)).size).toBe(count);
    for(const r of rows){
      const replacements=cases(r.file).filter(c=>c.title===r.test);
      expect(replacements,`${file}:${r.line} -> ${r.file}: ${r.test}`).toHaveLength(1);
      expect(replacements[0].disabled).toBe(false);expect(r.rule.length).toBeGreaterThan(20);
      if(r.disposition==='keep')expect(r.file).toBe(file);
      else expect(r.file).not.toBe(file);
    }
  });
  it('keeps every surviving legacy helper import, call and export visible to the switch-over',()=>{
    const actual=callers();expect(actual).toMatchSnapshot();
    for(const helper of ['totalExpForLevel','expToNextLevel','initExperience','forceLearnMove','meetMusicFor',
      'victoryMusicFor','battleTextPages','endBattleTextPages','trainerPicName','rivalStarterAfterLabBattle'])
      expect(actual.some(s=>s.includes(`calls ${helper}`)),helper).toBe(true);
    expect(EXP.filter(r=>r.disposition==='keep')).toHaveLength(3);
    expect(TRAINER.filter(r=>r.disposition==='keep')).toHaveLength(8);
  });
});
