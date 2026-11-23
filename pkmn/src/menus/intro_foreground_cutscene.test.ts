import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {IntroDisplayClock,INTRO_OAM_BYTES} from './intro_display_clock';
import {IntroCpu} from './intro_cpu';
import {introDelayFrameSteps,type IntroForegroundStep,type IntroHelperReply,type IntroHelperSources} from './intro_helper_timing';
import {introForegroundProgram,type IntroProgramExit} from './intro_foreground_program';
import {
  IntroForegroundRunner,IntroSharedState,introQuietSharedFields,
  type IntroAudioOwner,type IntroRunnerEvent,
} from './intro_foreground_runner';

// Checkpoint 2 of note 134: an ORIGINAL test-only cutscene driven through the reviewed runner. Nothing here is Pokemon
// Yellow's opening: a 16x8 indexed raster, one background tile with a marker at (1,1), one three-pixel L sprite, three
// stages of 2 / 3 / 1 completed iterations (entered after 0, 2 and 5 completed; natural exit after 6), a raw-input skip.
// All dots are absolute from the LCD-enable write; the first VBlank request is 65,662 and frames are 70,224 apart.
// The scenario's expected values below are derived from the schedule and the rules, not read back from the runner.
type Gen=Generator<IntroForegroundStep,void,IntroHelperReply>;
type Make=(sources:IntroHelperSources)=>Gen;

const SKIP=0x08;
const W=16,H=8;
const STAGE_AT:Record<number,number>={0:1,2:2,5:3};   // completed iterations -> stage entered
const POS_X=[2,2,4,6,8,8];                              // the L's anchor X during iteration 0..5 (Y is always 2)
const FRAME=70224;
const FIXTURE_FIELDS=['fSavedIE','fAudioActive','fInit','fIter','fStage','fCleanup','fFinished','fPrev','hVBlankCopySize','rIE'];

// ---- the raster: tiles and renderer ---------------------------------------------------------------------------------
function tile(pixels:[number,number][],index:number):Uint8Array{const t=new Uint8Array(64);for(const [x,y] of pixels)t[y*8+x]=index;return t;}
const BG_TILE=tile([[1,1]],1);          // marker index 1, background 0
const L_TILE=tile([[0,0],[0,1],[1,1]],2); // sprite index 2; (1,0) is the empty corner
const COPY_DONE=(events:readonly IntroRunnerEvent[])=>events.some(e=>e.kind==='effect'&&e.name==='consume-copy');
/** Reads only: visible OAM (what the display scans) and the events so far. Never advances anything. */
function render(runner:IntroForegroundRunner):Uint8Array{
  const out=new Uint8Array(W*H);
  if(COPY_DONE(runner.events))for(let y=0;y<8;y++)for(let x=0;x<8;x++)out[y*W+x]=BG_TILE[y*8+x];
  const oam=runner.visibleOam,sx=oam[1]-8,sy=oam[0]-16;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const px=sx+x,py=sy+y;
    if(L_TILE[y*8+x]&&px>=0&&px<W&&py>=0&&py<H)out[py*W+px]=L_TILE[y*8+x];
  }
  return out;
}
const at=(r:Uint8Array,x:number,y:number)=>r[y*W+x];

// ---- rig -------------------------------------------------------------------------------------------------------------
class FakeAudio implements IntroAudioOwner{
  version=0;
  forecast():number{return 100;}
  update():void{this.version++;}
}
const BLANK=new Uint8Array(INTRO_OAM_BYTES);
function display(o:{lcdc?:number;mode0?:boolean;pending?:number;advance?:number}={}){
  const d=new IntroDisplayClock({scx:0,wy:144,wx:7,lcdc:o.lcdc??0xe3,oam:BLANK,mode0Enabled:o.mode0??false,pending:o.pending??0});
  if(o.advance)d.advance(o.advance);
  return d;
}
/** The independent raw-input oracle: value at `dot` given the initial value and the transitions. */
const schedule=(initial:number,changes:[number,number][]=[])=>(dot:number)=>{
  let v=initial;for(const [t,x] of changes)if(t<=dot)v=x;return v;
};
const fixtureFields=()=>({hWY:144,fSavedIE:0,fAudioActive:0,fInit:0,fIter:0,fStage:0,fCleanup:0,fFinished:0,fPrev:0});
function build(o:{phase:number;ie:number;ime?:boolean;pending?:number;mode0?:boolean;raw:(dot:number)=>number;make:Make;
  state?:IntroSharedState;cpu?:IntroCpu;audio?:FakeAudio;visibleOam?:ArrayLike<number>}){
  const d=o.cpu?.display??display({advance:o.phase,mode0:o.mode0,pending:o.pending});
  const cpu=o.cpu??new IntroCpu(d,{ie:o.ie,ime:o.ime??true});
  const audio=o.audio??new FakeAudio();
  const state=o.state??new IntroSharedState({...introQuietSharedFields(),...fixtureFields(),hJoyInput:o.raw(o.phase)});
  const runner=new IntroForegroundRunner({cpu,state,audio,joypad:()=>o.raw(cpu.elapsed),visibleOam:o.visibleOam},o.make);
  return {d,cpu,audio,state,runner};
}

// ---- the program -----------------------------------------------------------------------------------------------------
const nop=(cycles=1,op='nop'):IntroForegroundStep=>({cycles,op});
const ldh=(field:string):IntroForegroundStep=>({cycles:3,op:`ldh a,[${field}]`,read:{field,trailingDots:4}});
const st=(field:string,value:number,cycles=3,trailingDots=4):IntroForegroundStep=>({cycles,op:`ld [${field}],a`,store:{field,trailingDots,value}});
/** The scene, driven by the reusable foreground program (note 136): this file supplies only the original scene's timed
 *  operations. `lengths` is the stage schedule (iterations per stage). */
function scene(lengths:readonly number[]=[2,3,1]):Make{
  return ()=>{
    let saved=0;
    const ops={
      input:{
        skipMask:SKIP,
        *seed():Generator<IntroForegroundStep,number,IntroHelperReply>{      // seed "previous" from the held state at entry
          const prev=(yield ldh('hJoyInput')) as number;yield st('fPrev',prev);return prev;
        },
        *poll():Generator<IntroForegroundStep,number,IntroHelperReply>{      // reads only the VBlank-latched byte
          const cur=(yield ldh('hJoyInput')) as number;
          yield nop(2,'and SKIP');yield st('fPrev',cur);return cur;
        },
        *branch(fresh:boolean):Gen{yield fresh?nop(2,'jr nz,.skip'):nop(3,'jr');},
      },
      stageLengths:lengths,
      *setup():Gen{
        saved=(yield ldh('rIE')) as number;                // save IE
        yield st('fSavedIE',saved);
        yield st('rIE',saved|1);                            // enable VBlank for the fixture
        yield st('hVBlankCopySize',1);                      // request one synthetic tile copy
        yield st('fAudioActive',1);                         // fixture-owned audio resource
        yield st('shadowOam.2',1,2);yield st('shadowOam.3',0,2);
        yield st('fInit',1);                                // initialization: once; zeroes every fixture-owned counter
        for(const f of ['fIter','fStage','fCleanup','fFinished'])yield st(f,0);
      },
      *enterStage(stage:number):Gen{yield st('fStage',stage+1);},
      *work(iteration:number):Gen{yield st('shadowOam.1',POS_X[iteration]+8,2);yield st('shadowOam.0',2+16,2);},
      *wait():Gen{yield* introDelayFrameSteps();},
      *commit(done:number):Gen{yield st('fIter',done);},
      *cleanup(reason:IntroProgramExit):Gen{                // both exits: one more frame, then release
        yield st('fCleanup',1);
        yield* introDelayFrameSteps();
        yield st('hVBlankCopySize',0);yield st('fAudioActive',0);yield st('rIE',saved);
        yield st('fFinished',reason==='skipped'?2:1);
      },
    };
    return introForegroundProgram(ops);
  };
}

// ---- helpers over a finished (or partly run) trace ------------------------------------------------------------------
const stores=(events:readonly IntroRunnerEvent[],field?:string)=>events.filter((e):e is Extract<IntroRunnerEvent,{kind:'store'}>=>e.kind==='store'&&e.owner==='foreground'&&(field===undefined?FIXTURE_FIELDS.includes(e.field):e.field===field));
const only=<K extends IntroRunnerEvent['kind']>(events:readonly IntroRunnerEvent[],kind:K)=>events.filter((e):e is Extract<IntroRunnerEvent,{kind:K}>=>e.kind===kind);
const values=(events:readonly IntroRunnerEvent[],field:string)=>stores(events,field).map(e=>e.value);
const samples=(events:readonly IntroRunnerEvent[])=>only(events,'effect').filter(e=>e.name==='sample-joypad');
const polls=(events:readonly IntroRunnerEvent[])=>only(events,'read').filter(e=>e.owner==='foreground'&&e.field==='hJoyInput');
const vblanks=(events:readonly IntroRunnerEvent[])=>only(events,'interrupt').filter(e=>e.vector==='vblank');
const last=<T,>(items:readonly T[]):T=>items[items.length-1];
/** Index of the first differing event (or length mismatch), -1 if equal: a readable failure instead of a huge diff. */
function firstDifference(a:readonly unknown[],b:readonly unknown[]):number{
  const n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++)if(JSON.stringify(a[i])!==JSON.stringify(b[i]))return i;
  return -1;
}
function until(runner:IntroForegroundRunner,pred:()=>boolean,guard=2_000_000):void{
  for(let i=0;i<guard&&!pred();i++)runner.step();
  if(!pred())throw new Error('until: not reached');
}
function natural(phase:number,raw=schedule(0),o:{ie?:number;mode0?:boolean;make?:Make}={}){
  const r=build({phase,ie:o.ie??0,mode0:o.mode0,raw,make:o.make??scene()});
  r.runner.runToEnd();return r;
}

/** Everything a skip at poll `p` (0-based; p = 6 means no skip) must leave behind. */
function expectLifecycle(r:ReturnType<typeof natural>,p:number,saved=0){
  const e=r.runner.events;
  const started=Math.min(p,6);                              // iterations whose body ran (a skipped poll starts none)
  const completed=started;                                  // a skipped iteration never waits
  expect(values(e,'fInit')).toEqual([1]);                   // initialization once
  expect(values(e,'fIter')).toEqual([0,...Array.from({length:completed},(_,i)=>i+1)]);
  // a stage entry at poll t is suppressed exactly when the skip is at poll t
  expect(values(e,'fStage').filter(v=>v>0)).toEqual([0,2,5].filter(t=>t<started).map(t=>STAGE_AT[t]));
  expect(stores(e,'shadowOam.1').map(x=>x.value)).toEqual(Array.from({length:started},(_,i)=>POS_X[i]+8));
  const cleanup=stores(e,'fCleanup').filter(c=>c.value===1);
  expect(cleanup).toHaveLength(1);                          // cleanup once, in this order, after the last iteration
  expect(stores(e).filter(x=>e.indexOf(x)>e.indexOf(cleanup[0])).map(x=>[x.field,x.value]))
    .toEqual([['hVBlankCopySize',0],['fAudioActive',0],['rIE',saved],['fFinished',p>=6?1:2]]);
  expect(stores(e,'fAudioActive').filter(x=>x.value===0)).toHaveLength(1);
  expect(only(e,'finish')).toHaveLength(1);
  expect(last(e).kind).toBe('finish');
  expect(r.cpu.ie).toBe(saved);
  const f=r.runner.observe().fields;
  expect([f.hVBlankCopySize,f.fAudioActive,f.fFinished,f.fIter,f.fCleanup]).toEqual([0,0,p>=6?1:2,completed,1]);
  expect(vblanks(e).length).toBe(completed+1);              // one service per wait, plus the cleanup frame
}

// ---------------------------------------------------------------------------------------------------------------------
describe.each([4,80])('natural lifecycle from display phase %i',phase=>{
  const r=natural(phase);
  const e=r.runner.events;
  it('runs the three stages (entered after 0, 2 and 5 completed iterations) and exits after 6',()=>{
    expect(values(e,'fStage').filter(v=>v>0)).toEqual([1,2,3]);
    expect(values(e,'fIter')).toEqual([0,1,2,3,4,5,6]);
    // stage entries sit between the right completions, derived from event order
    const order=stores(e).filter(s=>s.field==='fStage'&&s.value>0||s.field==='fIter'&&s.value>0).map(s=>`${s.field}${s.value}`);
    expect(order).toEqual(['fStage1','fIter1','fIter2','fStage2','fIter3','fIter4','fIter5','fStage3','fIter6']);
    expect(values(e,'fInit')).toEqual([1]);
    expect(values(e,'fFinished')).toEqual([0,1]);
  });
  it('time and iterations are separate: one service per wait, 70,224 dots apart, plus one cleanup frame',()=>{
    const v=vblanks(e);
    expect(v).toHaveLength(7);
    expect(v.map((x,i)=>i?x.start-v[i-1].start:0).slice(1)).toEqual(Array(6).fill(FRAME));
    expect(v[0].start).toBeGreaterThanOrEqual(65662);expect(v[0].start).toBeLessThan(65662+24);
    expect(only(e,'interrupt')).toHaveLength(7);              // no STAT: mode-0 requests are disabled
    expect(r.runner.elapsed).toBeGreaterThan(v[6].end);
    expect(last(values(e,'fIter'))).toBe(6);
  });
  it('handler effects: the copy once on the first service, one joypad sample per service, the flag cleared each time',()=>{
    const names=only(e,'effect').filter(x=>x.name!=='oam-dma-start').map(x=>x.name);
    expect(names).toEqual(['consume-copy',...Array(7).fill(0).flatMap(()=>['sample-joypad','clear-vblank-occurred'])]);
  });
  it('polls read the byte latched by the previous sample (the raw oracle), separate from the sample events',()=>{
    const s=samples(e),p=polls(e);
    expect(s).toHaveLength(7);expect(p).toHaveLength(7);       // the seed read + polls of iterations 0..5
    p.forEach((read,i)=>{                                      // read 0 is the entry seed; read i>0 is the poll of iteration i-1
      expect(read.value).toBe(0);
      if(i>0)expect(read.dot).toBeLessThan(s[i-1].dot);        // before the service that ends its own iteration
      if(i>1)expect(read.dot).toBeGreaterThan(s[i-2].dot);     // after the previous service's sample
    });
  });
  it('final return: IE restored, copy and audio released once, one finish event, a further step changes nothing',()=>{
    expectLifecycle(r,6);
    const before=JSON.stringify(r.runner.events),obs=JSON.stringify(r.runner.observe());
    expect(r.runner.step()).toBe('done');expect(r.runner.step()).toBe('done');
    expect(JSON.stringify(r.runner.events)).toBe(before);expect(JSON.stringify(r.runner.observe())).toBe(obs);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('pixels follow the visible OAM',()=>{
  const phase=4;
  /** Run until the fIter store of `n` completed iterations has happened (the service of iteration n-1 has finished). */
  const afterCompleted=(n:number)=>{
    const r=build({phase,ie:0,raw:schedule(0),make:scene()});
    until(r.runner,()=>values(r.runner.events,'fIter').includes(n));
    return r;
  };
  it('nothing is drawn before the first service',()=>{
    const r=build({phase,ie:0,raw:schedule(0),make:scene()});
    r.runner.run(5);
    const img=render(r.runner);
    expect([...img].every(v=>v===0)).toBe(true);
  });
  it.each([[1,2],[2,2],[3,4],[4,6],[5,8],[6,8]])('after %i completed iterations the L is at X=%i',(n,x)=>{
    const r=afterCompleted(n),img=render(r.runner);
    expect(at(img,1,1)).toBe(1);                                  // the marker survives (copy consumed on the first service)
    expect([at(img,x,2),at(img,x,3),at(img,x+1,3)]).toEqual([2,2,2]);
    expect(at(img,x+1,2)).toBe(0);                                // the L's empty corner shows the background
    const previous=n>1?POS_X[n-2]:null;
    if(previous!==null&&previous!==x)expect([at(img,previous,2),at(img,previous,3),at(img,previous+1,3)]).toEqual([0,0,0]); // vacated
    expect([...img].filter(v=>v===2)).toHaveLength(3);
  });
  it('a shadow update that straddles the next DMA snapshot is not drawn until that snapshot latches',()=>{
    const r=afterCompleted(2);                                    // visible X byte = 2+8
    until(r.runner,()=>stores(r.runner.events,'shadowOam.1').length===3); // iteration 2 wrote X=4 (+8 = 12)
    const o=r.runner.observe();
    expect([o.shadowOam[1],o.visibleOam[1]]).toEqual([12,10]);
    const stale=render(r.runner);
    expect([at(stale,2,2),at(stale,4,2)]).toEqual([2,0]);          // drawn from visible OAM: still the old position
    until(r.runner,()=>values(r.runner.events,'fIter').includes(3));
    const fresh=render(r.runner);
    expect([at(fresh,2,2),at(fresh,4,2)]).toEqual([0,2]);
    expect(r.runner.observe().visibleOam[1]).toBe(12);
  });
  it('rendering twice leaves dots, state, audio version and events untouched',()=>{
    const r=afterCompleted(3);
    const snap=()=>JSON.stringify({o:r.runner.observe(),e:r.runner.events,a:r.audio.version,d:r.runner.elapsed});
    const before=snap(),a=render(r.runner),b=render(r.runner);
    expect(snap()).toBe(before);
    expect(a).toEqual(b);expect(a).not.toBe(b);                   // independent buffers
    a[0]=9;expect(render(r.runner)[0]).not.toBe(9);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe.each([4,80])('input and skipping from display phase %i',phase=>{
  const base=natural(phase),S=samples(base.runner.events).map(s=>s.dot); // the service-sample dots of this phase
  const run=(raw:(dot:number)=>number,o:{ie?:number;mode0?:boolean}={})=>natural(phase,raw,o);
  it('services start 70,224 apart; the joypad sample sits at the same offset in each, 520 dots later in the first (it also copies the tile)',()=>{
    const v=vblanks(base.runner.events);
    expect(v.slice(1).map((x,i)=>x.start-v[i].start)).toEqual(Array(6).fill(FRAME));
    const offset=S.map((d,i)=>d-v[i].end);
    expect(offset.slice(1).every(o=>o===offset[1])).toBe(true);
    expect(offset[0]-offset[1]).toBe(520);                 // 8 tile pairs x 8 cycles... one tile's copy loop, 130 cycles
  });
  // a press that arrives during iteration k's wait is latched at that wait's sample and seen by the NEXT poll: skip at poll k+1
  it.each([0,1,2,3,4])('a fresh press during iteration %i\'s wait skips at the next poll, before its stage entry',k=>{
    const raw=schedule(0,[[S[k]-5000,SKIP]]);
    const r=run(raw);
    expectLifecycle(r,k+1);
    const p=polls(r.runner.events),s=samples(r.runner.events);
    expect(p.map(x=>x.value)).toEqual([0,...Array(k+1).fill(0),SKIP]); // the seed, polls 0..k, then poll k+1 sees the press
    expect(last(p).dot).toBeGreaterThan(s[k].dot);
    expect(s[k].value).toBe(SKIP);                                    // the sample caught the raw press
  });
  it('a press during the last wait is too late: the natural exit wins and there is no skip',()=>{
    const r=run(schedule(0,[[S[5]-5000,SKIP]]));
    expectLifecycle(r,6);
    expect(values(r.runner.events,'fFinished')).toEqual([0,1]);
  });
  it('a press right after a sample is not seen by the next poll, only by the one after it',()=>{
    const r=run(schedule(0,[[S[1]+1000,SKIP]]));                      // after service 1's sample, before service 2's
    expectLifecycle(r,3);                                             // latched at service 2, polled at poll 3
    const s=samples(r.runner.events);
    expect(s[1].value).toBe(0);expect(s[2].value).toBe(SKIP);
    expect(polls(r.runner.events).map(x=>x.value)).toEqual([0,0,0,0,SKIP]);
  });
  it('held on entry: no skip until a release and a fresh press',()=>{
    const held=run(schedule(SKIP));
    expectLifecycle(held,6);                                          // still held at every poll: never fresh
    expect(polls(held.runner.events).map(x=>x.value)).toEqual(Array(7).fill(SKIP));
    expect(values(held.runner.events,'fPrev')[0]).toBe(SKIP);         // seeded from the held state
    const re=run(schedule(SKIP,[[S[0]-5000,0],[S[1]-5000,SKIP]]));   // released in wait 0, re-pressed in wait 1
    expectLifecycle(re,2);
    expect(polls(re.runner.events).map(x=>x.value)).toEqual([SKIP,SKIP,0,SKIP]);
  });
  it('repeated presses during cleanup do not trigger a second exit',()=>{
    const raw=schedule(0,[[S[0]-5000,SKIP],[S[0]+3000,0],[S[0]+8000,SKIP],[S[0]+20000,0],[S[0]+30000,SKIP]]);
    const r=run(raw);
    expectLifecycle(r,1);
    expect(samples(r.runner.events).map(s=>s.value)).toEqual([SKIP,SKIP]); // cleanup frame's sample still sees the held press
    expect(only(r.runner.events,'finish')).toHaveLength(1);
    expect(values(r.runner.events,'fCleanup')).toEqual([0,1]);
  });
  it('an early skip followed by a fresh run leaves no state behind',()=>{
    const first=build({phase,ie:0,raw:schedule(0,[[S[0]-5000,SKIP]]),make:scene()});
    first.runner.runToEnd();expectLifecycle(first,1);
    // the same state, CPU, display and audio keep going: init zeroes every fixture-owned counter
    const second=build({phase,ie:0,raw:schedule(0),make:scene(),state:first.state,cpu:first.cpu,audio:first.audio,visibleOam:first.runner.visibleOam});
    second.runner.runToEnd();
    expect(first.state).toBe(second.state);
    const e=second.runner.events;
    expect(values(e,'fStage').filter(v=>v>0)).toEqual([1,2,3]);
    expect(values(e,'fIter')).toEqual([0,1,2,3,4,5,6]);
    const f=second.runner.observe().fields;
    expect([f.hVBlankCopySize,f.fAudioActive,f.fFinished,f.fIter,f.fCleanup,f.fInit]).toEqual([0,0,1,6,1,1]);
    expect(second.cpu.ie).toBe(0);
    expect(only(e,'finish')).toHaveLength(1);
  });
  it('an IF VBlank request supplied at entry (inside VBlank, where a service is in the measured domain) is serviced as soon as the fixture enables it',()=>{
    // outside VBlank the handler's SCX/DMA writes would be refused by the display clock, so the stale request is staged at 65,700
    const r=build({phase:65700,ie:0,pending:1,raw:schedule(0),make:scene()});
    r.runner.runToEnd();
    const iv=only(r.runner.events,'interrupt')[0];
    const enable=r.runner.events.find(x=>x.kind==='store'&&x.field==='rIE')! as Extract<IntroRunnerEvent,{kind:'store'}>;
    expect(iv.start).toBe(enable.dot+4);                              // the boundary right after the IE store instruction
    expect(iv.pendingBefore).toBe(1);
    expect(values(r.runner.events,'fIter')).toEqual([0,1,2,3,4,5,6]);
    expect(vblanks(r.runner.events)).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('a STAT service before a VBlank',()=>{
  const phase=80;
  const base=natural(phase,schedule(0),{ie:2,mode0:true});
  const S=samples(base.runner.events).map(s=>s.dot);
  it('STAT services run between VBlanks and the poll still reads only the VBlank-latched byte',()=>{
    const e=base.runner.events;
    expect(only(e,'interrupt').filter(x=>x.vector==='stat').length).toBeGreaterThan(600);
    expect(only(e,'interrupt').filter(x=>x.vector==='stat').every(x=>x.start>0)).toBe(true);
    expect(vblanks(e)).toHaveLength(7);
    expect(samples(e)).toHaveLength(7);                              // the STAT handler never samples input
    expectLifecycle(base,6,2);                                       // saved IE was 2: restored to 2
  });
  it('a press that starts and ends between two samples is never seen, STAT services notwithstanding',()=>{
    const raw=schedule(0,[[S[1]+20000,SKIP],[S[1]+30000,0]]);
    const r=natural(phase,raw,{ie:2,mode0:true});
    expectLifecycle(r,6,2);
    expect(polls(r.runner.events).every(x=>x.value===0)).toBe(true);
    expect(samples(r.runner.events).every(x=>x.value===0)).toBe(true);
  });
  it('a sustained press skips at the poll after its sample, with STAT services around it',()=>{
    const raw=schedule(0,[[S[1]-30000,SKIP]]);
    const r=natural(phase,raw,{ie:2,mode0:true});
    expectLifecycle(r,2,2);
    expect(polls(r.runner.events).map(x=>x.value)).toEqual([0,0,0,SKIP]);
    // a STAT service ran between the press and the sample that latched it
    const press=S[1]-30000,latched=samples(r.runner.events)[1].dot;
    expect(only(r.runner.events,'interrupt').some(x=>x.vector==='stat'&&x.start>press&&x.start<latched)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('equal-cost swap of the input poll and a filler changes the input the foreground sees',()=>{
  // LCD on, VBlank enabled, IME on, initial input clear, the raw press arrives before the first VBlank sample.
  // A: poll (3 cycles) at 65,652: the read takes effect at 65,660, before the request at 65,662; the instruction ends at
  //    65,664, the dispatch ends at 65,684; a 3-cycle filler follows the handler.
  // B: filler first (65,652..65,664), the same dispatch, then the poll after the handler's joypad sample.
  const wit=(swap:boolean)=>{
    const filler=nop(3,'filler');
    const r=build({phase:65652,ie:1,raw:schedule(0,[[65656,SKIP]]),make:()=>(function*():Gen{
      if(swap){yield filler;yield ldh('hJoyInput');}else{yield ldh('hJoyInput');yield filler;}
    })()});
    r.runner.runToEnd();return r;
  };
  it('poll-then-filler reads the old (clear) input before the handler',()=>{
    const e=wit(false).runner.events;
    expect(polls(e)).toEqual([{kind:'read',owner:'foreground',dot:65660,field:'hJoyInput',value:0}]);
    expect(only(e,'interrupt')[0]).toEqual({kind:'interrupt',vector:'vblank',start:65664,end:65684,pendingBefore:1,pendingAfter:0});
    expect(e.indexOf(polls(e)[0])).toBeLessThan(e.indexOf(only(e,'interrupt')[0]));
    expect(samples(e)[0].value).toBe(SKIP);                               // the sample still latches the press later
    const filler=only(e,'insn').filter(x=>x.owner==='foreground').find(x=>x.op==='filler')!;
    expect(filler.start).toBe(only(e,'insn').find(x=>x.op==='reti')!.end);
  });
  it('filler-then-poll, same instruction budget, reads the new press after the handler',()=>{
    const r=wit(true),e=r.runner.events;
    expect(only(e,'interrupt')[0]).toEqual({kind:'interrupt',vector:'vblank',start:65664,end:65684,pendingBefore:1,pendingAfter:0});
    const read=polls(e)[0],reti=only(e,'insn').find(x=>x.op==='reti')!;
    expect(read.value).toBe(SKIP);
    expect(read.dot).toBe(reti.end+12-4);
    expect(e.indexOf(read)).toBeGreaterThan(e.indexOf(samples(e)[0]));
    expect(e.indexOf(read)).toBeGreaterThan(e.indexOf(only(e,'interrupt')[0]));
    // the two programs execute the same instructions in a different order, with the same total foreground time
    const a=wit(false);
    const cost=(x:typeof a)=>only(x.runner.events,'insn').filter(i=>i.owner==='foreground').reduce((n,i)=>n+i.end-i.start,0);
    expect(cost(a)).toBe(cost(r));expect(cost(r)).toBe(24);
    expect(a.runner.elapsed).toBe(r.runner.elapsed);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('scan-safe DMA witness: rendering reads the visible OAM',()=>{
  // ld [shadow.1],a 65,690..65,698 (X byte 12, effect 65,694); ldh [rDMA],a ..65,710 (effect = start 65,706);
  // ld [shadow.1],a ..65,718 (X byte 16, effect 65,714: shadow only); 27 six-cycle fillers; completion 66,348, first boundary 66,366.
  it('the earlier X is captured by the snapshot, the later one waits for the next DMA',()=>{
    const r=build({phase:65690,ie:0,ime:false,raw:schedule(0),make:()=>(function*():Gen{
      yield st('shadowOam.1',12,2);yield st('rDMA',0xc3);yield st('shadowOam.1',16,2);
      for(let i=0;i<27;i++)yield nop(6,'filler');
    })()});
    r.state.shadowOam[0]=18;                                           // Y = 2 + 16
    r.runner.run(3);
    const dots=r.runner.elapsed;
    expect(dots).toBe(65718);
    const o=r.runner.observe();
    expect([o.shadowOam[1],o.dmaSnapshot![1],o.visibleOam[1]]).toEqual([16,12,0]);
    const before=render(r.runner);
    expect([at(before,4,2),at(before,8,2)]).toEqual([0,0]);            // nothing visible yet
    const snap=JSON.stringify(r.runner.observe());render(r.runner);expect(JSON.stringify(r.runner.observe())).toBe(snap);
    r.runner.run(26);expect(r.runner.elapsed).toBe(66342);              // still short of 66,348
    expect(r.runner.observe().visibleOam[1]).toBe(0);
    r.runner.step();expect(r.runner.elapsed).toBe(66366);
    const after=render(r.runner),o2=r.runner.observe();
    expect([o2.shadowOam[1],o2.dmaSnapshot,o2.visibleOam[1]]).toEqual([16,null,12]);
    expect([at(after,4,2),at(after,4,3),at(after,5,3)]).toEqual([2,2,2]);
    expect(at(after,8,2)).toBe(0);                                      // the shadow X (16 -> 8) is not drawn
    expect(only(r.runner.events,'oam-latch')).toEqual([{kind:'oam-latch',completion:66348,dot:66348}]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('chunking does not change the trace',()=>{
  const phases=[4,80];
  const raws:[string,(p:number)=>(d:number)=>number][]=[
    ['natural',()=>schedule(0)],
    ['press in wait 1',()=>schedule(0,[[65662+FRAME-5000,SKIP]])],
  ];
  it.each(phases.flatMap(p=>raws.map(([n,f])=>[p,n,f] as const)))('phase %i, %s: one-step, run(n) and runUntil agree on trace, state, raster',(phase,_n,mk)=>{
    const raw=mk(phase);
    const ref=build({phase,ie:0,raw,make:scene()});
    ref.runner.runToEnd();
    const finalImg=render(ref.runner);
    const drivers:((r:IntroForegroundRunner)=>void)[]=[
      r=>{for(;!r.done;){r.observe();r.step();}},
      r=>{for(let n=1;!r.done;n=n*3%1001+1)r.run(n);},
      r=>{for(let dot=phase;!r.done;dot+=9973)r.runUntil(dot);},
    ];
    for(const drive of drivers){
      const t=build({phase,ie:0,raw,make:scene()});
      drive(t.runner);
      expect(firstDifference(t.runner.events,ref.runner.events)).toBe(-1);
      expect(t.runner.observe()).toEqual(ref.runner.observe());
      expect(render(t.runner)).toEqual(finalImg);
      expect(t.audio.version).toBe(ref.audio.version);
    }
    // mid-run rasters agree too: at the 3rd completed iteration
    const a=build({phase,ie:0,raw,make:scene()}),b=build({phase,ie:0,raw,make:scene()});
    let steps=0;
    while(!a.runner.done&&!values(a.runner.events,'fIter').includes(3)){a.runner.step();steps++;} // or the run's end, if it skips first
    for(let left=steps;left>0;){const n=Math.min(37,left);const took=b.runner.run(n);if(took===0)break;left-=took;} // same steps, chunks of 37
    expect(render(b.runner)).toEqual(render(a.runner));
    expect(firstDifference(b.runner.events,a.runner.events)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('LCD off and on inside the fixture',()=>{
  it('no request while off across more than a frame; a new epoch at the enabling store; foreground iterations count separately',()=>{
    const group=function*(n:number,it:{v:number}):Gen{for(let i=0;i<n;i++)yield nop(6,'filler');it.v++;yield st('fIter',it.v);};
    const it0={v:0};
    const {runner,d}=build({phase:0,ie:1,ime:false,raw:schedule(0),make:()=>(function*():Gen{
      yield* group(42,it0);                      // to 1,008 + 12
      yield st('rLCDC',0x63);                    // LCD off before the first VBlank
      for(let i=0;i<3;i++)yield* group(1000,it0);// 72,000 dots off: more than one nominal frame
      yield st('rLCDC',0xe3);
      for(;;)yield* group(100,it0);
    })()});
    runner.runUntil(1100);
    const off=stores(runner.events,'rLCDC')[0];
    expect(off).toMatchObject({dot:1028,value:0x63});
    expect(d.lcdOn).toBe(false);
    runner.runUntil(30000);expect(d.pending).toBe(0);
    runner.runUntil(66000);expect(d.pending).toBe(0);                    // the old epoch's 65,662 never happened
    runner.runUntil(73200);expect(d.pending).toBe(0);
    const on=stores(runner.events,'rLCDC').find(s=>s.value===0xe3)!;
    expect(on.dot).toBeGreaterThan(off.dot+72000);
    expect(d.lcdOn).toBe(true);
    expect(values(runner.events,'fIter').slice(0,4)).toEqual([1,2,3,4]);   // 4 groups so far: iterations, not dots
    expect(runner.elapsed).toBeGreaterThan(73000);
    runner.runUntil(on.dot+65600);expect(d.pending).toBe(0);
    runner.runUntil(on.dot+65690);expect(d.pending).toBe(1);             // first request 65,662 after the enabling write
    expect(d.sinceEnable).toBe(runner.elapsed-on.dot);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('the program drives other schedules and hosts (note 136)',()=>{
  const phase=4;
  const tiny=[1,2];                                                   // entries after 0 and 1 completed; exit after 3
  const base=natural(phase,schedule(0),{make:scene(tiny)});
  const S=samples(base.runner.events).map(x=>x.dot);
  it('a different supplied schedule changes the boundaries and nothing else',()=>{
    const e=base.runner.events;
    const order=stores(e).filter(x=>x.field==='fStage'&&x.value>0||x.field==='fIter'&&x.value>0).map(x=>`${x.field}${x.value}`);
    expect(order).toEqual(['fStage1','fIter1','fStage2','fIter2','fIter3']);
    expect(stores(e,'shadowOam.1').map(x=>x.value)).toEqual([10,10,12]);
    expect(vblanks(e)).toHaveLength(4);                              // three waits plus the cleanup frame
    expect(only(e,'finish')).toHaveLength(1);
    expect(values(e,'fFinished')).toEqual([0,1]);
  });
  it('a fresh press at the poll that would enter stage 2 suppresses its entry and its work',()=>{
    const r=natural(phase,schedule(0,[[S[0]-5000,SKIP]]),{make:scene(tiny)});
    const e=r.runner.events;
    expect(values(e,'fStage').filter(v=>v>0)).toEqual([1]);          // stage 2 was due at the poll that saw the press
    expect(values(e,'fIter')).toEqual([0,1]);
    expect(stores(e,'shadowOam.1')).toHaveLength(1);                 // no iteration-1 work either
    expect(values(e,'fFinished')).toEqual([0,2]);
    expect(r.cpu.ie).toBe(0);
  });
  it('a natural finish then an early skip on one host: each cleanup runs once with its own reason, the second run starts at stage zero',()=>{
    const first=build({phase,ie:0,raw:schedule(0),make:scene(tiny)});
    first.runner.runToEnd();
    const start=first.runner.elapsed;
    const second=build({phase,ie:0,raw:schedule(0,[[start+1000,SKIP]]),make:scene(tiny),state:first.state,cpu:first.cpu,audio:first.audio});
    second.runner.runToEnd();
    expect(values(first.runner.events,'fFinished')).toEqual([0,1]);
    expect(values(second.runner.events,'fFinished')).toEqual([0,2]);
    expect(values(second.runner.events,'fStage').filter(v=>v>0)).toEqual([1]);
    expect(values(second.runner.events,'fIter')).toEqual([0,1]);
    for(const r of [first,second]){expect(only(r.runner.events,'finish')).toHaveLength(1);expect(stores(r.runner.events,'fCleanup').filter(x=>x.value===1)).toHaveLength(1);}
    expect(first.cpu.ie).toBe(0);
    expect(second.state.read('fFinished')).toBe(2);
  });
});

describe('DMA during a stage and during cleanup latches at the exact deadline (note 135 regressions kept)',()=>{
  it.each([4,80])('phase %i: one latch per service, completion = dot, inside each handler',phase=>{
    const r=natural(phase);
    const e=r.runner.events,latches=only(e,'oam-latch'),starts=only(e,'effect').filter(x=>x.name==='oam-dma-start');
    expect(latches).toHaveLength(7);                                  // six waits and the cleanup frame
    expect(starts).toHaveLength(7);
    latches.forEach((l,i)=>{
      expect(l.dot).toBe(l.completion);
      expect(l.completion).toBe(starts[i].dot+642);
      const service=vblanks(e)[i],reti=only(e,'insn').filter(x=>x.op==='reti')[i];
      expect(l.completion).toBeGreaterThan(service.end);
      expect(l.completion).toBeLessThan(reti.start);                  // within the service, before its RETI
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('the fixture is test-only',()=>{
  it('no production file imports the runner or this scene',()=>{
    const root=resolve(__dirname,'..'),owners:string[]=[];
    function walkDir(folder:string):void{for(const x of readdirSync(folder,{withFileTypes:true})){
      const p=resolve(folder,x.name);if(x.isDirectory())walkDir(p);
      else if(x.name.endsWith('.ts')&&!x.name.endsWith('.test.ts')&&/intro_foreground_cutscene/.test(readFileSync(p,'utf8')))
        owners.push(relative(root,p).replace(/\\/g,'/'));
    }}
    walkDir(root);expect(owners).toEqual([]);
  });
});
