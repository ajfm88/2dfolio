import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {IntroDisplayClock,INTRO_OAM_BYTES} from './intro_display_clock';
import {IntroCpu} from './intro_cpu';
import {introLcdcSteps,introVBlankSteps,type IntroHandlerStep} from './intro_handler_timing';
import {introDelayFrameSteps,type IntroForegroundStep,type IntroHelperReply,type IntroHelperSources} from './intro_helper_timing';
import {
  IntroForegroundRunner,IntroSharedState,introQuietSharedFields,
  type IntroAudioOwner,type IntroRunnerEvent,
} from './intro_foreground_runner';

// Checkpoint 1 of note 134. Every timeline below is hand-calculated in absolute dots from the LCD-enable write (the
// display clock's 0; the first VBlank request is dot 65,662). Costs are synthetic. The native evidence is the checkpoint-2a
// CPU probe's saved vectors (intro_cpu_reference.json, SameBoy CGB-E), reused for the vector-sample witness.
type Gen=Generator<IntroForegroundStep,void,IntroHelperReply>;
type Make=(sources:IntroHelperSources)=>Gen;

const BLANK=new Uint8Array(INTRO_OAM_BYTES);
function display(o:{lcdc?:number;mode0?:boolean;pending?:number;advance?:number;oam?:ArrayLike<number>}={}){
  const d=new IntroDisplayClock({scx:0,wy:144,wx:7,lcdc:o.lcdc??0xe3,oam:o.oam??BLANK,mode0Enabled:o.mode0??false,pending:o.pending??0});
  if(o.advance)d.advance(o.advance);
  return d;
}
class FakeAudio implements IntroAudioOwner{
  version=0;
  readonly updates:[number,string][]=[];
  constructor(private readonly costs:number[]){}
  forecast():number{return this.costs[Math.min(this.version,this.costs.length-1)];}
  update(predictor:string):void{this.updates.push([this.version,predictor]);this.version++;}
}
function rig(o:{ie:number;ime:boolean;display?:IntroDisplayClock;fields?:Record<string,number>;costs?:number[];stream:Make;
  joypad?:()=>number;gdma?:(which:1|2)=>void;full?:boolean}){
  const d=o.display??display();
  const cpu=new IntroCpu(d,{ie:o.ie,ime:o.ime});
  const audio=new FakeAudio(o.costs??[100]);
  const state=new IntroSharedState({...introQuietSharedFields(),...o.fields});
  const runner=new IntroForegroundRunner({cpu,state,audio,joypad:o.joypad,gdma:o.gdma,fullHandlerTrace:o.full},o.stream);
  return {d,cpu,audio,state,runner};
}

const nop=(cycles=1,op='nop'):IntroForegroundStep=>({cycles,op});
const ldh=(field:string):IntroForegroundStep=>({cycles:3,op:`ldh a,[${field}]`,read:{field,trailingDots:4}});
const st=(field:string,value:number,cycles=3,trailingDots=4):IntroForegroundStep=>({cycles,op:`ld [${field}],a`,store:{field,trailingDots,value}});
const ei:IntroForegroundStep={cycles:1,op:'ei',ei:true};
const di:IntroForegroundStep={cycles:1,op:'di',di:true};
const last=<T,>(items:readonly T[]):T=>items[items.length-1];
const only=<K extends IntroRunnerEvent['kind']>(events:readonly IntroRunnerEvent[],kind:K)=>events.filter((e):e is Extract<IntroRunnerEvent,{kind:K}>=>e.kind===kind);
const handlerEffects=(events:readonly IntroRunnerEvent[])=>only(events,'effect').filter(x=>x.name!=='oam-dma-start');

describe('vector sample: a request during a dispatch, against the native probe (note 130)',()=>{
  interface Row{eiDot:number;ifAtEi:number;steps:(string|number)[][];end:number;ifAfter:number}
  const rows:Row[]=JSON.parse(readFileSync(resolve(__dirname,'__fixtures__/intro_cpu_reference.json'),'utf8')).sections.vector;
  it.each(rows.map(r=>[r.eiDot,r] as const))('EI at %i',(dot,row)=>{
    const d=display({mode0:true});d.advance(4);d.writePending(0);d.advance(dot-4);
    expect(d.pending).toBe(row.ifAtEi);
    const {runner}=rig({ie:3,ime:false,display:d,stream:function*():Gen{yield ei;yield nop();for(;;)yield nop(3,'jr');}});
    for(let guard=0;guard<20000&&!only(runner.events,'interrupt').some(e=>e.vector==='vblank');guard++)runner.step();
    runner.step(); // the VBlank handler's `jp VBlank`
    const got=runner.events.flatMap((e):(string|number)[][]=>{
      if(e.kind==='interrupt')return [['dispatch',e.start,e.end-e.start,e.vector==='vblank'?1:2,e.pendingAfter]];
      if(e.kind==='insn'&&e.op==='reti')return [['reti',e.start,e.end-e.start]];
      return [];
    });
    expect(got).toEqual(row.steps.map(s=>s[0]==='dispatch'?s.slice(0,5):s.slice(0,3)));
    expect(runner.elapsed).toBe(row.end);
    expect(runner.cpu.display.pending).toBe(row.ifAfter);
  });
  it('the request that loses the vector sample stays pending after the dispatch',()=>{
    // EI at 65640: the VBlank (65662) lands 14 dots into a dispatch that started at 65648 and takes the vector from a pending STAT
    const row=rows.find(r=>r.eiDot===65640)!;
    const d=display({mode0:true});d.advance(4);d.writePending(0);d.advance(row.eiDot-4);
    const {runner}=rig({ie:3,ime:false,display:d,stream:function*():Gen{yield ei;yield nop();for(;;)yield nop(3,'jr');}});
    runner.run(3);
    expect(only(runner.events,'interrupt')).toEqual([{kind:'interrupt',vector:'vblank',start:65648,end:65668,pendingBefore:2,pendingAfter:2}]);
    expect(runner.cpu.display.pending).toBe(2); // STAT still pending
  });
});

describe('DelayFrame composed with the real handlers',()=>{
  const delay=():Make=>()=>introDelayFrameSteps();
  const readsOf=(events:readonly IntroRunnerEvent[])=>only(events,'read').map(e=>[e.dot,e.value]);

  it('a request inside the HALT itself: HALT reruns before the flag is read',()=>{
    // ld a,1 (8) + ldh [flag],a (12): HALT at 65,660, VBlank at 65,662 is inside (h, h+4]
    const {runner}=rig({ie:1,ime:true,display:display({advance:65640}),stream:delay(),fields:{hVBlankOccurred:0}});
    runner.runToEnd();
    const e=runner.events;
    const halts=only(e,'halt');
    expect(halts[0]).toEqual({kind:'halt',start:65660,end:65664,result:'retry'});
    expect(only(e,'interrupt')[0]).toEqual({kind:'interrupt',vector:'vblank',start:65664,end:65684,pendingBefore:1,pendingAfter:0});
    expect(halts[1].result).toBe('woke');
    expect(halts[1].start).toBeGreaterThan(65684);
    // the flag was cleared by the first service; the only read happens after the second HALT woke and was serviced
    const firstRead=only(e,'read')[0];
    expect(e.indexOf(firstRead)).toBeGreaterThan(e.indexOf(halts[1]));
    expect(e.indexOf(firstRead)).toBeGreaterThan(e.indexOf(only(e,'interrupt')[1]));
    expect(firstRead.value).toBe(0);
    expect(runner.done).toBe(true);
  });
  it('a request during the idle wait: the continuation resumes after the HALT',()=>{
    // HALT at 65,640; VBlank 22 dots later: wake at 65,664 (24 dots: ceil), dispatch with the 4-dot exit: 24 dots
    const {runner}=rig({ie:1,ime:true,display:display({advance:65620}),stream:delay(),fields:{hVBlankOccurred:0}});
    runner.runToEnd();
    const e=runner.events;
    expect(only(e,'halt')).toEqual([{kind:'halt',start:65640,end:65664,result:'woke'}]);
    expect(only(e,'interrupt')[0]).toEqual({kind:'interrupt',vector:'vblank',start:65664,end:65688,pendingBefore:1,pendingAfter:0});
    expect(readsOf(e)).toHaveLength(1);
    expect(readsOf(e)[0][1]).toBe(0);
    expect(e.indexOf(only(e,'read')[0])).toBeGreaterThan(e.indexOf(only(e,'interrupt')[0]));
  });
  it('a STAT-only wake leaves the wait flag set, and a later VBlank makes forward progress',()=>{
    // LCD on at 0, STAT on every line. ld a,1 / store: HALT at 20; the first mode-0 request is dot 252 (232 dots, a multiple of 4)
    const {runner}=rig({ie:3,ime:true,display:display({mode0:true}),stream:delay(),fields:{hVBlankOccurred:0}});
    runner.runToEnd();
    const e=runner.events;
    expect(e.slice(0,6).map(x=>x.kind)).toEqual(['insn','store','insn','halt','interrupt','insn']);
    expect(only(e,'halt')[0]).toEqual({kind:'halt',start:20,end:252,result:'woke'});
    expect(only(e,'interrupt')[0]).toEqual({kind:'interrupt',vector:'stat',start:252,end:276,pendingBefore:2,pendingAfter:0});
    // LCDC handler: 18 cycles to the RETI (72 dots), RETI 16 dots; then ldh a,[flag] (read 4 dots before its end) = 1
    expect(only(e,'insn').find(x=>x.op==='reti')).toEqual({kind:'insn',owner:'stat',start:348,end:364,cycles:4,op:'reti'});
    expect(only(e,'read')[0]).toEqual({kind:'read',owner:'foreground',dot:372,field:'hVBlankOccurred',value:1});
    // and a (4), jr nz taken (12): the same HALT again at 392
    expect(only(e,'halt')[1].start).toBe(392);
    const vb=only(e,'interrupt').findIndex(x=>x.vector==='vblank');
    expect(vb).toBeGreaterThan(100);
    expect(only(e,'interrupt').slice(0,vb).every(x=>x.vector==='stat')).toBe(true);
    expect(only(e,'read').slice(0,-1).every(x=>x.value===1)).toBe(true);
    expect(last(only(e,'read')).value).toBe(0);
    expect(only(e,'effect').filter(x=>x.name==='clear-vblank-occurred').map(x=>x.owner)).toEqual(['vblank']);
    expect(runner.done).toBe(true);
  });
});

describe('IF and IE as read/modify/write',()=>{
  const rmwIf=():Make=>function*():Gen{
    const v=(yield ldh('rIF')) as number;
    yield nop(1,'and a');
    yield st('rIF',v&~1,3,3);
  };
  it('reads IF at the trailing dot and a request before the write point is cleared by the stale value',()=>{
    // ldh a,[rIF] 65,640..65,652 (read 65,648); and a ..65,656; ldh [rIF],a 65,656..65,668, effect 65,665; VBlank 65,662 is earlier
    const {runner,d}=rig({ie:1,ime:false,display:display({advance:65640}),stream:rmwIf()});
    runner.runToEnd();
    expect(runner.events).toEqual([
      {kind:'read',owner:'foreground',dot:65648,field:'rIF',value:0xe0},
      {kind:'insn',owner:'foreground',start:65640,end:65652,cycles:3,op:'ldh a,[rIF]'},
      {kind:'insn',owner:'foreground',start:65652,end:65656,cycles:1,op:'and a'},
      {kind:'store',owner:'foreground',dot:65665,field:'rIF',value:0xe0},
      {kind:'insn',owner:'foreground',start:65656,end:65668,cycles:3,op:'ld [rIF],a'},
      {kind:'finish',dot:65668},
    ]);
    expect(d.pending).toBe(0);
  });
  it('a request in the last three dots of the store survives it',()=>{
    // same program 4 dots earlier: effect at 65,661, VBlank 65,662 arrives after it
    const {runner,d}=rig({ie:1,ime:false,display:display({advance:65636}),stream:rmwIf()});
    runner.runToEnd();
    expect(only(runner.events,'store')[0].dot).toBe(65661);
    expect(d.pending).toBe(1);
  });
  it('IE restored after a request arrived while it was clear: the next boundary dispatches',()=>{
    // ldh a,[rIE] 65,620..65,632 (read 65,628 = 1); ldh [rIE],0 ..65,644 (effect 65,640); a 6-cycle filler ..65,668
    // (VBlank 65,662 inside it: IE is clear, so no dispatch at 65,668); ldh [rIE],1 ..65,680; dispatch at the boundary
    const {runner}=rig({ie:1,ime:true,display:display({advance:65620}),stream:function*():Gen{
      const ie=(yield ldh('rIE')) as number;
      yield st('rIE',ie&~1);
      yield nop(6,'filler');
      yield st('rIE',ie);
      yield nop();
    }});
    runner.run(3);
    expect(only(runner.events,'interrupt')).toEqual([]);
    expect(runner.observe()).toMatchObject({elapsed:65668,ie:0,pending:1,ime:true});
    runner.run(2);
    expect(only(runner.events,'interrupt')).toEqual([{kind:'interrupt',vector:'vblank',start:65680,end:65700,pendingBefore:1,pendingAfter:0}]);
    expect(only(runner.events,'store').map(s=>[s.dot,s.field,s.value])).toEqual([[65640,'rIE',0],[65676,'rIE',1]]);
  });
  it('two instructions of equal cost with swapped effects give different ordered traces',()=>{
    const run=(a:[string,number],b:[string,number])=>{
      const {runner}=rig({ie:0,ime:false,display:display({lcdc:0x63}),stream:function*():Gen{yield st(a[0],a[1]);yield st(b[0],b[1]);}});
      runner.runToEnd();
      return runner;
    };
    const one=run(['hFrameCounter',5],['hJoyInput',6]),two=run(['hJoyInput',6],['hFrameCounter',5]);
    expect(one.elapsed).toBe(24);expect(two.elapsed).toBe(24);
    expect(only(one.events,'store').map(s=>[s.dot,s.field,s.value])).toEqual([[8,'hFrameCounter',5],[20,'hJoyInput',6]]);
    expect(only(two.events,'store').map(s=>[s.dot,s.field,s.value])).toEqual([[8,'hJoyInput',6],[20,'hFrameCounter',5]]);
    expect(one.events).not.toEqual(two.events);
  });
});

describe('reads sample at their trailing dot, not at the instruction edges',()=>{
  it('LY: a read whose effect dot is 452 sees line 1, one at 448 still sees 0',()=>{
    // LY becomes 1 at dot 452 (456 - 4). ldh is 12 dots, the read 4 before its end.
    const at=(advance:number)=>{
      const {runner}=rig({ie:0,ime:false,display:display({advance}),stream:function*():Gen{yield ldh('rLY');}});
      runner.runToEnd();return only(runner.events,'read')[0];
    };
    expect(at(444)).toEqual({kind:'read',owner:'foreground',dot:452,field:'rLY',value:1});
    expect(at(440)).toEqual({kind:'read',owner:'foreground',dot:448,field:'rLY',value:0});
  });
  it('STAT mode: the first line leaves mode 0 for mode 3 at dot 79',()=>{
    const at=(advance:number)=>{
      const {runner}=rig({ie:0,ime:false,display:display({advance}),stream:function*():Gen{yield ldh('rSTAT');}});
      runner.runToEnd();return only(runner.events,'read')[0];
    };
    expect(at(72)).toMatchObject({dot:80,value:3}); // start 72 would read 0
    expect(at(64)).toMatchObject({dot:72,value:0});
  });
  it('read event precedes instruction event in the trace for a read instruction',()=>{
    // For a 3-cycle read (12 dots), read effect at end-4=8, instruction end=12
    const {runner}=rig({ie:0,ime:false,display:display({advance:0}),stream:function*():Gen{yield ldh('rLY');}});
    runner.runToEnd();
    const reads=only(runner.events,'read');
    const insns=only(runner.events,'insn').filter(x=>x.owner==='foreground');
    expect(reads.length).toBe(1);
    expect(insns.length).toBe(1);
    expect(reads[0].dot).toBeLessThan(insns[0].end);
    // Also verify ordering in the full event array
    const readIdx=runner.events.findIndex(x=>x.kind==='read');
    const insnIdx=runner.events.findIndex(x=>x.kind==='insn' && x.owner==='foreground');
    expect(readIdx).toBeLessThan(insnIdx);
  });
});

describe('EI then RET with a request pending',()=>{
  it('the RET is the whole delay slot; the request runs after it',()=>{
    // LCD off, VBlank already pending. ei 0..4; ret 4..20; boundary 20: IME is on, dispatch 20..40
    const {runner}=rig({ie:1,ime:false,display:display({lcdc:0x63,pending:1}),stream:function*():Gen{yield ei;yield {cycles:4,op:'ret',control:'ret'};yield nop();}});
    runner.runToEnd();
    const e=runner.events;
    expect(e.slice(0,3)).toEqual([
      {kind:'insn',owner:'foreground',start:0,end:4,cycles:1,op:'ei'},
      {kind:'insn',owner:'foreground',start:4,end:20,cycles:4,op:'ret'},
      {kind:'interrupt',vector:'vblank',start:20,end:40,pendingBefore:1,pendingAfter:0},
    ]);
    const reti=only(e,'insn').find(x=>x.op==='reti')!;
    expect(last(only(e,'insn').filter(x=>x.owner==='foreground'))).toEqual({kind:'insn',owner:'foreground',start:reti.end,end:reti.end+4,cycles:1,op:'nop'});
  });
});

describe('a GDMA stall and two audio calls under DI, then EI and one instruction',()=>{
  it('matches the hand-calculated timeline: 65,656 -> 67,708 -> 67,736 -> 67,780 -> 67,784 -> 67,788 -> 67,808',()=>{
    const calls:number[]=[];
    const {runner,audio,d}=rig({ie:1,ime:false,display:display({advance:65656}),costs:[7,11,100],gdma:w=>calls.push(w),full:true,stream:sources=>(function*():Gen{
      yield {kind:'gdma',dots:2052,which:1};
      yield {kind:'audio',cycles:sources.audioCycles('setup'),predictor:'setup',slot:'a',routine:'Audio1_UpdateMusic'};
      yield {kind:'audio',cycles:sources.audioCycles('movie'),predictor:'movie',slot:'b',routine:'Audio1_UpdateMusic'};
      yield ei;yield nop();yield nop();
    })()});
    runner.run(5);
    expect(runner.events).toEqual([
      {kind:'gdma',owner:'foreground',start:65656,end:67708,which:1},
      {kind:'audio',owner:'foreground',start:67708,end:67736,cycles:7,predictor:'setup'},
      {kind:'audio',owner:'foreground',start:67736,end:67780,cycles:11,predictor:'movie'},
      {kind:'insn',owner:'foreground',start:67780,end:67784,cycles:1,op:'ei'},
      {kind:'insn',owner:'foreground',start:67784,end:67788,cycles:1,op:'nop'},
    ]);
    expect(d.pending).toBe(1);               // the VBlank (65,662) arrived inside the stall, still pending before dispatch
    expect(runner.step()).toBe('interrupt');
    expect(last(runner.events)).toEqual({kind:'interrupt',vector:'vblank',start:67788,end:67808,pendingBefore:1,pendingAfter:0});
    expect(runner.step()).toBe('handler'); // the vector's jp
    expect(last(runner.events)).toEqual({kind:'insn',owner:'vblank',start:67808,end:67824,cycles:4});
    expect(calls).toEqual([1]);               // once
    expect(audio.updates).toEqual([[0,'setup'],[1,'movie']]); // each call forecast and updated on its own
  });
  it('refuses an aggregate with IME on or an EI pending',()=>{
    for(const first of [[],[ei]]){
      const {runner}=rig({ie:0,ime:first.length===0,display:display({lcdc:0x63}),stream:function*():Gen{yield* first;yield {kind:'gdma',dots:100,which:2};}});
      expect(()=>runner.runToEnd()).toThrow(/IME effectively off/);
      expect(last(runner.events)).toMatchObject({kind:'fault'});
    }
  });
  it('an audio call needs the forecast of its own state: stale and missing forecasts fail',()=>{
    // the stream forecasts early, then an interrupt services an audio update before the call runs
    const stale=rig({ie:1,ime:false,display:display({lcdc:0x63,pending:1}),costs:[7,11],stream:sources=>(function*():Gen{
      const early=sources.audioCycles('setup');
      yield ei;yield nop();yield di;
      yield {kind:'audio',cycles:early,predictor:'setup',slot:'x',routine:'Audio1_UpdateMusic'};
    })()});
    expect(()=>stale.runner.runToEnd()).toThrow(/stale/);
    const missing=rig({ie:0,ime:false,display:display({lcdc:0x63}),stream:()=>(function*():Gen{
      yield {kind:'audio',cycles:7,predictor:'setup',slot:'x',routine:'Audio1_UpdateMusic'};
    })()});
    expect(()=>missing.runner.runToEnd()).toThrow(/without a fresh forecast/);
    const reused=rig({ie:0,ime:false,display:display({lcdc:0x63}),costs:[7],stream:sources=>(function*():Gen{
      const cycles=sources.audioCycles('setup');
      yield {kind:'audio',cycles,predictor:'setup',slot:'x',routine:'Audio1_UpdateMusic'};
      yield {kind:'audio',cycles,predictor:'setup',slot:'y',routine:'Audio1_UpdateMusic'};
    })()});
    expect(()=>reused.runner.runToEnd()).toThrow(/without a fresh forecast/);
  });
});

describe('VBlank service on the shared state',()=>{
  const reads=['hFrameCounter','hVBlankCopySize','hVBlankOccurred','hJoyInput'];
  const after=():Make=>function*():Gen{for(const f of reads)yield ldh(f);};
  const walkEffects=(steps:Iterable<IntroHandlerStep>,from:number)=>{
    let t=from;const out:[string,number][]=[];
    for(const s of steps){if(s.effect)out.push([s.effect,t+s.cycles*4-4]);t+=s.cycles*4;}
    return out;
  };
  it('runs each effect at its marked operation, and the next foreground reads observe the result',()=>{
    const fields={hFrameCounter:3,hVBlankCopySize:2,hVBlankOccurred:1};
    const {runner}=rig({ie:1,ime:true,display:display({lcdc:0x63,pending:1}),fields,joypad:()=>0x24,stream:after()});
    runner.runToEnd();
    const e=runner.events;
    const dispatch=only(e,'interrupt')[0];
    const want=walkEffects(introVBlankSteps({...introQuietSharedFields(),...fields} as never,100),dispatch.end);
    expect(want.map(w=>w[0])).toEqual(['consume-copy','sample-joypad','clear-vblank-occurred','decrement-frame-counter']);
    expect(handlerEffects(e).map(x=>[x.name,x.dot,x.field,x.value])).toEqual([
      ['consume-copy',want[0][1],'hVBlankCopySize',0],
      ['sample-joypad',want[1][1],'hJoyInput',0x24],
      ['clear-vblank-occurred',want[2][1],'hVBlankOccurred',0],
      ['decrement-frame-counter',want[3][1],'hFrameCounter',2],
    ]);
    expect(handlerEffects(e).every(x=>x.owner==='vblank'&&x.dot<=only(e,'insn').find(i=>i.op==='reti')!.start)).toBe(true);
    expect(only(e,'read').map(r=>[r.field,r.value])).toEqual([['hFrameCounter',2],['hVBlankCopySize',0],['hVBlankOccurred',0],['hJoyInput',0x24]]);
    expect(only(e,'read')[0].dot).toBeGreaterThan(only(e,'insn').find(i=>i.op==='reti')!.end);
  });
  it('zero paths: nothing to clear, decrement or consume',()=>{
    const {runner}=rig({ie:1,ime:true,display:display({lcdc:0x63,pending:1}),joypad:()=>0x24,stream:after()});
    runner.runToEnd();
    expect(handlerEffects(runner.events).map(x=>x.name)).toEqual(['sample-joypad']);
    expect(only(runner.events,'read').map(r=>r.value)).toEqual([0,0,0,0x24]);
  });
  it('the handler gets exactly the foreground state at the dispatch, and the generator is not resumed before the RETI',()=>{
    const seen:number[]=[];
    let stateRef!:IntroSharedState;
    const {runner,state}=rig({ie:1,ime:true,display:display({lcdc:0x63,pending:1}),fields:{hFrameCounter:3},stream:function*():Gen{
      yield nop();
      seen.push(stateRef.read('hFrameCounter')); // sampled when the generator resumes
      yield nop();
    }});
    stateRef=state;
    expect(runner.step()).toBe('interrupt');
    expect(seen).toEqual([]);
    runner.runToEnd();
    expect(seen).toEqual([2]);
  });
});

describe('shadow OAM, the DMA snapshot and the OAM the display scans',()=>{
  it('snapshots at the DMA start, keeps later shadow writes out, and latches at the completion boundary',()=>{
    // ld [shadow0],a 65,690..65,698 (10); ldh [rDMA],a ..65,710 (effect 65,706 = start); ld [shadow0],a ..65,718 (20, effect 65,714)
    // 27 six-cycle fillers: boundaries 65,742 ... 66,366; completion 65,706 + 642 = 66,348, first boundary at/after it: 66,366
    const {runner,d}=rig({ie:0,ime:false,display:display({advance:65690}),stream:function*():Gen{
      yield st('shadowOam.0',10,2);yield st('rDMA',0xc3);yield st('shadowOam.0',20,2);
      for(let i=0;i<27;i++)yield nop(6,'filler');
    }});
    runner.run(3);
    expect(runner.observe()).toMatchObject({elapsed:65718});
    expect(runner.observe().shadowOam[0]).toBe(20);
    expect(runner.observe().dmaSnapshot![0]).toBe(10);
    expect(runner.observe().visibleOam[0]).toBe(0);
    expect(only(runner.events,'effect')).toEqual([{kind:'effect',owner:'foreground',dot:65706,name:'oam-dma-start'}]);
    runner.run(26);
    expect(runner.elapsed).toBe(66342);
    expect(runner.observe().visibleOam[0]).toBe(0); // 66,342 < 66,348
    runner.step();
    expect(runner.elapsed).toBe(66366);
    expect(runner.observe()).toMatchObject({dmaSnapshot:null});
    expect(runner.observe().visibleOam[0]).toBe(10);
    expect(runner.observe().shadowOam[0]).toBe(20);
    expect(only(runner.events,'oam-latch')).toEqual([{kind:'oam-latch',completion:66348,dot:66348}]);
    expect(d.elapsed).toBe(66366);
  });
  it('a second DMA while one runs is refused',()=>{
    const {runner}=rig({ie:0,ime:false,display:display({advance:65690}),stream:function*():Gen{yield st('rDMA',0xc3);yield st('rDMA',0xc3);}});
    expect(()=>runner.runToEnd()).toThrow(/another is running/);
  });
  it('the VBlank handler starts its own DMA from the shadow OAM at its rDMA store',()=>{
    const {runner}=rig({ie:1,ime:true,display:display({lcdc:0x63,pending:1}),stream:function*():Gen{yield nop();}});
    runner.state.shadowOam[3]=77;
    runner.run(2);
    expect(runner.inHandler).toBe(true);
    runner.runToEnd();
    expect(only(runner.events,'effect').filter(x=>x.name==='oam-dma-start')).toHaveLength(1);
    expect(only(runner.events,'oam-latch')).toHaveLength(1);
    expect(runner.visibleOam[3]).toBe(77);
  });
});

describe('LCD off and on',()=>{
  it('no request while it is off, absolute dots keep running, the new epoch starts at the enabling write',()=>{
    const fill=(n:number)=>{const out:IntroForegroundStep[]=[];for(let i=0;i<n;i++)out.push(nop(6,'filler'));return out;};
    const {runner,d}=rig({ie:1,ime:false,stream:function*():Gen{
      yield* fill(42);                // to 1,008
      yield st('rLCDC',0x63);        // effect at 1,016: LCD off, before the first VBlank
      yield* fill(2917);              // 70,008 dots off
      yield st('rLCDC',0xe3);        // the enabling write
      for(;;)yield nop(6,'filler');
    }});
    runner.runUntil(1100);
    expect(d.lcdOn).toBe(false);
    expect(only(runner.events,'store')[0]).toEqual({kind:'store',owner:'foreground',dot:1016,field:'rLCDC',value:0x63});
    runner.runUntil(65800);
    expect(d.pending).toBe(0);expect(d.readLy()).toBe(0);
    runner.runUntil(70000);
    expect(d.pending).toBe(0);
    runner.runUntil(72000);
    const on=only(runner.events,'store').find(s=>s.value===0xe3)!;
    expect(on.dot).toBeGreaterThan(71000);          // absolute dots advanced through the off span
    expect(d.lcdOn).toBe(true);
    expect(d.pending).toBe(0);
    runner.runUntil(on.dot+65600);
    expect(d.pending).toBe(0);                       // first VBlank 65,662 after the enabling write
    runner.runUntil(on.dot+65690);
    expect(d.pending).toBe(1);
    expect(d.sinceEnable).toBe(runner.elapsed-on.dot);
  });
});

describe('faults surface in the trace',()=>{
  it('HALT with IME off is refused and recorded; the runner stays failed',()=>{
    const {runner}=rig({ie:1,ime:false,display:display({lcdc:0x63}),stream:function*():Gen{yield {cycles:1,op:'halt',halt:true};}});
    expect(()=>runner.step()).toThrow(/HALT with IME off/);
    expect(last(runner.events)).toEqual({kind:'fault',dot:0,message:expect.stringMatching(/HALT with IME off/)});
    expect(()=>runner.step()).toThrow(/HALT with IME off/);
  });
  it('a guarded display domain (an SCX store during mode 3) surfaces',()=>{
    const {runner}=rig({ie:0,ime:false,display:display({advance:90}),stream:function*():Gen{yield st('rSCX',3);}});
    expect(()=>runner.step()).toThrow(/SCX change/);
    expect(only(runner.events,'fault')).toHaveLength(1);
  });
  it('undeclared shared reads and writes are refused, never defaulted',()=>{
    const r1=rig({ie:0,ime:false,display:display({lcdc:0x63}),stream:function*():Gen{yield ldh('hNope');}});
    expect(()=>r1.runner.runToEnd()).toThrow(/not declared/);
    expect(()=>r1.state.write('hNope',1,'foreground')).toThrow(/not declared/);
  });
});

describe('pause and resume',()=>{
  // gdma (DI) -> two audio calls -> EI, NOP -> VBlank service -> two reads of the shared state -> end
  const scenario=()=>{
    const calls:number[]=[];
    const r=rig({ie:1,ime:false,display:display({advance:65656}),costs:[7,11,100],fields:{hFrameCounter:3,hJoyInput:0},joypad:()=>0x24,
      gdma:w=>calls.push(w),stream:sources=>(function*():Gen{
        yield {kind:'gdma',dots:2052,which:1};
        yield {kind:'audio',cycles:sources.audioCycles('setup'),predictor:'setup',slot:'a',routine:'Audio1_UpdateMusic'};
        yield {kind:'audio',cycles:sources.audioCycles('movie'),predictor:'movie',slot:'b',routine:'Audio1_UpdateMusic'};
        yield ei;yield nop();
        yield ldh('hFrameCounter');yield ldh('hJoyInput');
      })()});
    return {...r,calls};
  };
  const whole=()=>{const s=scenario();s.runner.runToEnd();return s;};
  it('after a dispatch the handler is owed, nothing has run, and the generator has not been resumed',()=>{
    const s=scenario();
    s.runner.run(6);
    expect(s.runner.inHandler).toBe(true);
    expect(last(s.runner.events)).toMatchObject({kind:'interrupt',end:67808});
    expect(s.state.read('hFrameCounter')).toBe(3);
    expect(only(s.runner.events,'read')).toEqual([]);
    s.runner.runToEnd();
    expect(s.runner.observe()).toEqual(whole().runner.observe());
  });
  it('after a read effect was returned as a completed step, the next step sees the handler-free state',()=>{
    const s=scenario();
    while(only(s.runner.events,'read').length<1)s.runner.step();
    expect(last(s.runner.events)).toMatchObject({kind:'insn',op:'ldh a,[hFrameCounter]'});
    expect(only(s.runner.events,'read')).toHaveLength(1);
    s.runner.runToEnd();
    expect(only(s.runner.events,'read').map(r=>[r.field,r.value])).toEqual([['hFrameCounter',2],['hJoyInput',0x24]]);
    expect(s.runner.events).toEqual(whole().runner.events);
  });
  it('after a finished aggregate its effect has run once, however the run is cut',()=>{
    const s=scenario();
    s.runner.step();
    expect(s.runner.observe().elapsed).toBe(67708);
    expect(s.calls).toEqual([1]);
    s.runner.step();expect(s.audio.updates).toEqual([[0,'setup']]);
    s.runner.runToEnd();
    expect(s.calls).toEqual([1]);
    expect(s.audio.updates.map(u=>u[1])).toEqual(['setup','movie','movie']); // the VBlank handler's own update
  });
  it('one-step, chunked and runUntil drives agree on clocks, events and state',()=>{
    const ref=whole();
    const stepwise=scenario();
    for(;!stepwise.runner.done;){stepwise.runner.observe();stepwise.runner.step();}
    const chunked=scenario();
    for(let size=1;!chunked.runner.done;size=size%7+1){chunked.runner.run(size);chunked.runner.observe();}
    const timed=scenario();
    for(let dot=65700;!timed.runner.done;dot+=37)timed.runner.runUntil(dot);
    for(const other of [stepwise,chunked,timed]){
      expect(other.runner.events).toEqual(ref.runner.events);
      expect(other.runner.observe()).toEqual(ref.runner.observe());
    }
  });
});

describe('the runner is unused by the game',()=>{
  it('no production file imports it',()=>{
    const root=resolve(__dirname,'..'),owners:string[]=[];
    function walkDir(folder:string):void{for(const e of readdirSync(folder,{withFileTypes:true})){
      const p=resolve(folder,e.name);if(e.isDirectory())walkDir(p);
      else if(e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')&&/intro_foreground_runner|IntroForegroundRunner/.test(readFileSync(p,'utf8')))
        owners.push(relative(root,p).replace(/\\/g,'/'));
    }}
    walkDir(root);expect(owners).toEqual(['audio/intro_entry_audio.ts','menus/intro_foreground_runner.ts']);
  });
  it('introLcdcSteps stays the zero-pointer stream the runner uses',()=>{
    expect([...introLcdcSteps(0)].map(s=>s.cycles)).toEqual([4,4,3,1,3,3,4]);
  });
});
