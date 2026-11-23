import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {IntroDisplayClock,INTRO_OAM_BYTES} from './intro_display_clock';
import {IntroCpu} from './intro_cpu';
import {introDelayFrameSteps,type IntroForegroundStep,type IntroHelperReply,type IntroHelperSources} from './intro_helper_timing';
import {introForegroundProgram,type IntroProgramExit,type IntroProgramHooks} from './intro_foreground_program';
import {
  IntroForegroundRunner,IntroSharedState,introQuietSharedFields,
  type IntroAudioOwner,type IntroAudioPredictor,type IntroRunnerEvent,
} from './intro_foreground_runner';

// Note 136. Part 1: the program's lifecycle order over scripted hooks (no clock). Part 2: the VBlank predictor selector and the
// audio forecast checks, with a synthetic owner whose two predictors cost 60 (setup) and 90 (movie) M-cycles, and a readiness
// field `aReady` (0 = nothing published, 1 = a partial publication, 2 = ready). Dots are absolute from the LCD enable.
type Gen=Generator<IntroForegroundStep,void,IntroHelperReply>;
type Make=(sources:IntroHelperSources)=>Gen;
const nop=(cycles:number,op='nop'):IntroForegroundStep=>({cycles,op});
const ldh=(field:string):IntroForegroundStep=>({cycles:3,op:`ldh a,[${field}]`,read:{field,trailingDots:4}});
const st=(field:string,value:number,cycles=3):IntroForegroundStep=>({cycles,op:`ld [${field}],a`,store:{field,trailingDots:4,value}});
const only=<K extends IntroRunnerEvent['kind']>(e:readonly IntroRunnerEvent[],k:K)=>e.filter((x):x is Extract<IntroRunnerEvent,{kind:K}>=>x.kind===k);

// ---- part 1: the order, with no clock --------------------------------------------------------------------------------
function scripted(lengths:number[],inputs:number[],log:string[]):IntroProgramHooks{
  let at=0;
  const tag=(name:string):IntroForegroundStep=>{log.push(name);return nop(1,name);};
  return {
    input:{
      skipMask:0x08,
      *seed(){log.push('seed');yield nop(1,'seed');return inputs[at++];},
      *poll(){log.push('poll');yield nop(1,'poll');return inputs[at++];},
      *branch(fresh){log.push(fresh?'branch:skip':'branch:go');yield nop(1,'branch');},
    },
    stageLengths:lengths,
    *setup(){yield tag('setup');},
    *enterStage(stage){yield tag(`enter${stage}`);},
    *work(i,stage){yield tag(`work${i}.${stage}`);},
    *wait(i){yield tag(`wait${i}`);},
    *commit(n){yield tag(`commit${n}`);},
    *cleanup(reason:IntroProgramExit){yield tag(`cleanup:${reason}`);},
  };
}
function drain(gen:Gen):number{let n=0;for(let r=gen.next();!r.done;r=gen.next(0))n++;return n;}

describe('the lifecycle order (scripted hooks)',()=>{
  it('natural: setup, seed, then poll/branch/enter/work/wait/commit per iteration, enters at 0, 2, 5, cleanup(completed) last; no poll after the last wait',()=>{
    const log:string[]=[];
    drain(introForegroundProgram(scripted([2,3,1],[0,0,0,0,0,0,0],log)));
    const expected=['setup','seed'];
    for(let i=0;i<6;i++){
      expected.push('poll','branch:go');
      if(i===0)expected.push('enter0');if(i===2)expected.push('enter1');if(i===5)expected.push('enter2');
      expected.push(`work${i}.${i<2?0:i<5?1:2}`,`wait${i}`,`commit${i+1}`);
    }
    expected.push('cleanup:completed');
    expect(log).toEqual(expected);
    expect(log.filter(x=>x==='poll')).toHaveLength(6);
  });
  it('held at entry, then released, then a fresh press: the skip is only on the fresh press and before the stage side effects',()=>{
    const log:string[]=[];
    // seed held; poll0 still held (not fresh); poll1 released; poll2 pressed (fresh): iteration 2 is where stage 1 would enter
    drain(introForegroundProgram(scripted([2,3,1],[0x08,0x08,0,0x08],log)));
    expect(log.slice(-4)).toEqual(['commit2','poll','branch:skip','cleanup:skipped']);
    expect(log.filter(x=>x.startsWith('enter'))).toEqual(['enter0']);
    expect(log.filter(x=>x.startsWith('work'))).toHaveLength(2);
    expect(log.filter(x=>x.startsWith('cleanup'))).toEqual(['cleanup:skipped']);
  });
  it('a held press never skips; the poll order is before the stage entry (the entry after a skip never appears)',()=>{
    const log:string[]=[];
    drain(introForegroundProgram(scripted([1,1],[0x08,0x08,0x08,0x08],log)));
    expect(log.filter(x=>x==='branch:skip')).toEqual([]);
    expect(log.indexOf('poll')).toBeLessThan(log.indexOf('enter0'));
    expect(log[log.length-1]).toBe('cleanup:completed');
  });
  it('local progress: a second run over the same hooks starts at stage zero; the program adds no steps of its own',()=>{
    const log:string[]=[];
    const hooks=scripted([1],[0,0,0,0],log);
    const steps=drain(introForegroundProgram(hooks));
    // every yielded step is one of the hooks' own: setup, seed, poll, branch, enter, work, wait, commit, cleanup = 9
    expect(steps).toBe(9);
    log.length=0;
    drain(introForegroundProgram(hooks));
    expect(log[0]).toBe('setup');expect(log.filter(x=>x.startsWith('enter'))).toEqual(['enter0']);
  });
  it('refuses an empty or non-positive schedule and a bad mask',()=>{
    expect(()=>drain(introForegroundProgram(scripted([],[0],[])))).toThrow(RangeError);
    expect(()=>drain(introForegroundProgram(scripted([0],[0],[])))).toThrow(RangeError);
    const hooks=scripted([1],[0],[]);
    expect(()=>drain(introForegroundProgram({...hooks,input:{...hooks.input,skipMask:0}}))).toThrow(RangeError);
  });
});

// ---- part 2: audio predictor selection --------------------------------------------------------------------------------
const BLANK=new Uint8Array(INTRO_OAM_BYTES);
const COST:Record<IntroAudioPredictor,number>={setup:60,movie:90};
class Audio implements IntroAudioOwner{
  version=0;
  readonly updates:[number,IntroAudioPredictor][]=[];
  constructor(private readonly cost:Record<IntroAudioPredictor,number>=COST){}
  forecast(p:IntroAudioPredictor):number{return this.cost[p];}
  update(p:IntroAudioPredictor):void{this.updates.push([this.version,p]);this.version++;}
}
const display=(o:{lcdc?:number;advance?:number;pending?:number}={})=>{
  const d=new IntroDisplayClock({scx:0,wy:144,wx:7,lcdc:o.lcdc??0xe3,oam:BLANK,mode0Enabled:false,pending:o.pending??0});
  if(o.advance)d.advance(o.advance);return d;
};
const select=(calls?:number[])=>(s:IntroSharedState):IntroAudioPredictor=>{calls?.push(1);return s.read('aReady')>=2?'movie':'setup';};
function rig(o:{d:IntroDisplayClock;ie:number;ime:boolean;make:Make;audio?:Audio;selector?:boolean|number[];predictor?:IntroAudioPredictor}){
  const cpu=new IntroCpu(o.d,{ie:o.ie,ime:o.ime});
  const state=new IntroSharedState({...introQuietSharedFields(),hWY:144,aReady:0,fIter:0});
  const audio=o.audio??new Audio();
  const runner=new IntroForegroundRunner({cpu,state,audio,
    selectVblankPredictor:o.selector?select(Array.isArray(o.selector)?o.selector:undefined):undefined,vblankPredictor:o.predictor,fullHandlerTrace:false},o.make);
  return {cpu,state,audio,runner};
}

describe('VBlank readiness: the service selects its predictor at handler entry',()=>{
  const wit=(storeFirst:boolean)=>{
    const filler=nop(3,'filler');
    const r=rig({d:display({advance:65656}),ie:1,ime:true,selector:true,make:()=>(function*():Gen{
      if(storeFirst){yield st('aReady',2);yield filler;}else{yield filler;yield st('aReady',2);}
    })()});
    r.runner.runToEnd();return r;
  };
  it('store at 65,656 (effect 65,664, ends 65,668): the service dispatched at 65,668 uses the ready predictor',()=>{
    const r=wit(true),e=r.runner.events;
    expect(only(e,'store')[0]).toEqual({kind:'store',owner:'foreground',dot:65664,field:'aReady',value:2});
    expect(only(e,'interrupt')).toEqual([{kind:'interrupt',vector:'vblank',start:65668,end:65688,pendingBefore:1,pendingAfter:0}]);
    expect(only(e,'audio')).toEqual([expect.objectContaining({owner:'vblank',predictor:'movie',cycles:90})]);
    expect(r.audio.updates).toEqual([[0,'movie']]);
  });
  it('the equal-cost swap (filler first): the same dispatch happens before the store, so the old predictor is used',()=>{
    const r=wit(false),e=r.runner.events;
    expect(only(e,'interrupt')).toEqual([{kind:'interrupt',vector:'vblank',start:65668,end:65688,pendingBefore:1,pendingAfter:0}]);
    expect(only(e,'audio')).toEqual([expect.objectContaining({owner:'vblank',predictor:'setup',cycles:60})]);
    const store=only(e,'store').find(x=>x.owner==='foreground')!;
    expect(store.dot).toBeGreaterThan(only(e,'insn').find(x=>x.op==='reti')!.end);   // the store ran after the handler
    expect(r.audio.updates).toEqual([[0,'setup']]);
  });
  it('services before a partial publication, between it and readiness, and after readiness select old, old, new, new',()=>{
    const calls:number[]=[];
    const hooks=(lengths:number[]):IntroProgramHooks=>({
      input:{skipMask:8,*seed(){yield ldh('hJoyInput');return 0;},*poll(){yield ldh('hJoyInput');return 0;},*branch(){yield nop(3,'jr');}},
      stageLengths:lengths,
      *setup(){yield nop(1);},*enterStage(){yield nop(1);},
      *work(i){if(i===1)yield st('aReady',1);if(i===2)yield st('aReady',2);},   // partial publication, then readiness
      *wait(){yield* introDelayFrameSteps();},*commit(n){yield st('fIter',n);},
      *cleanup(){yield* introDelayFrameSteps();},
    });
    const r=rig({d:display({advance:4}),ie:1,ime:true,selector:calls,make:()=>introForegroundProgram(hooks([3]))});
    r.runner.runToEnd();
    const audio=only(r.runner.events,'audio').filter(x=>x.owner==='vblank');
    expect(audio.map(x=>[x.predictor,x.cycles])).toEqual([['setup',60],['setup',60],['movie',90],['movie',90]]);
    expect(r.audio.updates.map(u=>u[1])).toEqual(['setup','setup','movie','movie']);
    expect(calls).toHaveLength(4);                                        // evaluated once per service, at its entry
    expect(r.state.read('aReady')).toBe(2);
  });
  it('without a selector the fixed predictor still applies (the existing option)',()=>{
    const r=rig({d:display({advance:65656}),ie:1,ime:true,predictor:'setup',make:()=>(function*():Gen{yield st('aReady',2);yield nop(3);})()});
    r.runner.runToEnd();
    expect(only(r.runner.events,'audio')[0]).toMatchObject({predictor:'setup',cycles:60});
  });
});

describe('an audio forecast authorizes only its own predictor and its own version',()=>{
  const lcdOff=()=>display({lcdc:0x63});
  it('equal cost for both predictors: a forecast for one cannot authorize an update for the other',()=>{
    const r=rig({d:lcdOff(),ie:0,ime:false,audio:new Audio({setup:100,movie:100}),make:sources=>(function*():Gen{
      const cycles=sources.audioCycles('setup');
      yield {kind:'audio',cycles,predictor:'movie',slot:'x',routine:'Audio1_UpdateMusic'};
    })()});
    expect(()=>r.runner.runToEnd()).toThrow(/predictor differs/);
    expect(r.audio.updates).toEqual([]);
    const ok=rig({d:lcdOff(),ie:0,ime:false,audio:new Audio({setup:100,movie:100}),make:sources=>(function*():Gen{
      yield {kind:'audio',cycles:sources.audioCycles('movie'),predictor:'movie',slot:'x',routine:'Audio1_UpdateMusic'};
    })()});
    ok.runner.runToEnd();
    expect(ok.audio.updates).toEqual([[0,'movie']]);
  });
  it('a forecast taken before an intervening update is stale even for the right predictor',()=>{
    const r=rig({d:display({lcdc:0x63,pending:1}),ie:1,ime:false,selector:true,make:sources=>(function*():Gen{
      const early=sources.audioCycles('setup');
      yield {cycles:1,op:'ei',ei:true};yield nop(1);yield {cycles:1,op:'di',di:true};      // a VBlank service updates the audio in between
      yield {kind:'audio',cycles:early,predictor:'setup',slot:'x',routine:'Audio1_UpdateMusic'};
    })()});
    expect(()=>r.runner.runToEnd()).toThrow(/stale/);
  });
});

describe('the program is test-only',()=>{
  it('no production file imports it',()=>{
    const root=resolve(__dirname,'..'),owners:string[]=[];
    function walk(folder:string):void{for(const x of readdirSync(folder,{withFileTypes:true})){
      const p=resolve(folder,x.name);if(x.isDirectory())walk(p);
      else if(x.name.endsWith('.ts')&&!x.name.endsWith('.test.ts')&&/intro_foreground_program|introForegroundProgram/.test(readFileSync(p,'utf8')))
        owners.push(relative(root,p).replace(/\\/g,'/'));
    }}
    walk(root);expect(owners).toEqual(['menus/intro_foreground_program.ts']);
  });
});
