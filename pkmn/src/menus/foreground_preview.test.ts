import {describe,expect,it} from 'vitest';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {GB_FPS} from '../core/tick_clock';
import {DISPLAY_FRAME_DOTS} from './intro_display_clock';
import {
  ForegroundPreviewController,PREVIEW_PHASE,PREVIEW_SKIP,PreviewInput,PreviewSession,
  type PreviewFrame,type PreviewScheduler,type PreviewStatus,
} from '../../scripts/foreground_preview';

// Note 137: the development preview's host seams, tested with an injected scheduler, clock and render sink (the real canvas and
// controls are the browser smoke check). The pixel expectations below are written from the scene's rules (marker (1,1) = 1; the
// L's pixels (x,2), (x,3), (x+1,3) = 2; empty corner (x+1,2)), not read from the preview's renderer.
const FRAME_MS=1000/GB_FPS;
const SKIP=PREVIEW_SKIP;
const F=DISPLAY_FRAME_DOTS;
type Cb=(now:number)=>void;

class Sched implements PreviewScheduler{
  next=1;pending=new Map<number,Cb>();all:Cb[]=[];cancelled=0;
  request(cb:Cb):number{const h=this.next++;this.pending.set(h,cb);this.all.push(cb);return h;}
  cancel(h:number):void{if(this.pending.delete(h))this.cancelled++;}
  fire(now:number):boolean{
    const first=this.pending.entries().next().value as [number,Cb]|undefined;
    if(!first)return false;
    this.pending.delete(first[0]);first[1](now);return true;
  }
}
interface Host{ctrl:ForegroundPreviewController;sched:Sched;frames:PreviewFrame[];statuses:PreviewStatus[];t0:number;clock:{t:number}}
function host(o:{inputAt?:(dot:number)=>number;t0?:number;fps?:number}={}):Host{
  const sched=new Sched(),frames:PreviewFrame[]=[],statuses:PreviewStatus[]=[],clock={t:o.t0??1000};
  const ctrl=new ForegroundPreviewController({scheduler:sched,now:()=>clock.t,inputAt:o.inputAt,fps:o.fps,
    sink:{present:f=>frames.push(f),status:s=>statuses.push(s)}});
  return {ctrl,sched,frames,statuses,t0:clock.t,clock};
}
/** Fire the scheduled callback every `per` frames (a display of 1/per the cadence) until the run stops or `limit` callbacks. */
function pump(h:Host,per=1,limit=400):number{
  let k=0;const base=h.clock.t;
  for(;k<limit;k++){
    h.clock.t=base+(k+1)*per*FRAME_MS+0.01;
    if(!h.sched.fire(h.clock.t))break;
  }
  return k;
}
const at=(r:Uint8Array,x:number,y:number)=>r[y*16+x];
const storesOf=(c:ForegroundPreviewController,field:string)=>c.session!.runner.events.filter(e=>e.kind==='store'&&e.owner==='foreground'&&e.field===field).map(e=>(e as {value:number}).value);
const last=<T,>(a:readonly T[]):T=>a[a.length-1];

describe('Start and natural exit',()=>{
  it('runs one session to its end, presents a final frame, stops scheduling, releases once',()=>{
    const h=host();
    h.ctrl.start();
    expect(h.statuses).toEqual([{state:'running'}]);
    expect(h.frames).toHaveLength(1);                     // the initial frame, before any dot
    expect([...h.frames[0].raster].every(v=>v===0)).toBe(true);
    pump(h);
    expect(h.statuses).toEqual([{state:'running'},{state:'completed'}]);
    expect(h.ctrl.sessions).toBe(1);expect(h.ctrl.releases).toBe(1);
    expect(h.sched.pending.size).toBe(0);expect(h.ctrl.scheduled).toBe(false);
    const f=last(h.frames);
    expect(f.finished).toBe(true);
    expect([f.stage,f.completed,f.services]).toEqual([3,6,7]);          // stages 1..3, six waits, one cleanup service
    expect(f.audio).toEqual({setup:2,movie:5});                          // readiness is stored at stage 2's entry (iteration 2)
    const e=h.ctrl.session!.runner.events;
    expect(e.filter(x=>x.kind==='finish')).toHaveLength(1);
    expect(storesOf(h.ctrl,'fCleanup').filter(v=>v===1)).toHaveLength(1);
    expect(storesOf(h.ctrl,'fFinished')).toEqual([0,1]);
    // the final frame's pixels from the rules: L at X=8 (the exit stage holds it), marker kept, the old positions empty
    expect([at(f.raster,1,1),at(f.raster,8,2),at(f.raster,8,3),at(f.raster,9,3)]).toEqual([1,2,2,2]);
    expect([at(f.raster,9,2),at(f.raster,2,2),at(f.raster,4,2),at(f.raster,6,2)]).toEqual([0,0,0,0]);
    expect(h.ctrl.session!.cpu.ie).toBe(0);                              // the saved IE is restored by the timed cleanup
  });
  it('a stage progression is visible across the run: positions 2, 4, 6, 8 follow the iterations',()=>{
    const h=host();h.ctrl.start();pump(h);
    const seen=new Map<number,number>();                                  // completed -> L anchor X seen at that count
    for(const f of h.frames){for(let x=0;x<14;x++)if(at(f.raster,x,2)===2&&at(f.raster,x,3)===2)seen.set(f.completed,x);}
    expect(seen.get(1)).toBe(2);expect(seen.get(3)).toBe(4);expect(seen.get(4)).toBe(6);expect(seen.get(5)).toBe(8);
  });
});

describe('Skip around a VBlank sample',()=>{
  it('held at entry leaves playback running to its natural end',()=>{
    const h=host();h.ctrl.setHeld(SKIP);h.ctrl.start();pump(h);
    expect(last(h.statuses)).toEqual({state:'completed'});
    expect(last(h.frames).completed).toBe(6);
  });
  it('held at entry, released, then a fresh press: the next eligible poll skips, and the timed cleanup still runs',()=>{
    const h=host();h.ctrl.setHeld(SKIP);h.ctrl.start();
    h.clock.t=h.t0+3*FRAME_MS+0.01;h.sched.fire(h.clock.t);
    h.ctrl.setHeld(0);                                                    // released
    h.clock.t=h.t0+4*FRAME_MS+0.01;h.sched.fire(h.clock.t);
    expect(h.ctrl.status).toBe('running');
    h.ctrl.skip();                                                        // fresh press
    expect(h.ctrl.input.peek()).toBe(SKIP);
    const skippedAt=last(h.frames).elapsed;
    pump(h);
    expect(last(h.statuses)).toEqual({state:'skipped'});
    const f=last(h.frames),e=h.ctrl.session!.runner.events;
    expect(f.completed).toBeLessThan(6);
    expect(storesOf(h.ctrl,'fFinished')).toEqual([0,2]);
    expect(storesOf(h.ctrl,'fCleanup')).toEqual([0,1]);
    expect(h.ctrl.session!.cpu.ie).toBe(0);
    expect(e.filter(x=>x.kind==='finish')).toHaveLength(1);
    expect(f.elapsed).toBeGreaterThan(skippedAt);                          // it did not stop at the click: the foreground polled later
    expect(h.ctrl.releases).toBe(1);
    expect(h.ctrl.input.peek()).toBe(0);                                  // input released
    h.ctrl.skip();expect(h.ctrl.input.peek()).toBe(0);                    // a click after the end stays out of the next session
  });
});

describe('two animation cadences',()=>{
  // a fresh press at dot 150,000, held from there: the same dot-indexed schedule for every run
  const sched=(dot:number)=>dot>=150000?SKIP:0;
  const run=(per:number)=>{const h=host({inputAt:sched});h.ctrl.start();pump(h,per);return h;};
  it('program traces and sampled raster states agree at common emulated checkpoints',()=>{
    const a=run(1),b=run(3);
    expect(a.ctrl.session!.runner.events).toEqual(b.ctrl.session!.runner.events);
    expect(a.ctrl.session!.runner.observe()).toEqual(b.ctrl.session!.runner.observe());
    expect(last(a.statuses)).toEqual({state:'skipped'});
    // frame j of the slow cadence is frame 3j of the fast one; both stop at their own final frame
    for(let j=0;3*j<a.frames.length&&j<b.frames.length;j++){
      const x=a.frames[3*j],y=b.frames[j];
      if(x.finished||y.finished)break;
      expect(y.deadline).toBe(x.deadline);expect(y.deadline).toBe(PREVIEW_PHASE+3*j*F);
      expect(y.elapsed).toBe(x.elapsed);
      expect(y.raster).toEqual(x.raster);
      expect([y.stage,y.completed,y.services,y.audio]).toEqual([x.stage,x.completed,x.services,x.audio]);
    }
  });
  it('instruction overshoot is carried: the deadline is absolute (phase + k frames) while the runner passes it',()=>{
    const a=run(1);
    const running=a.frames.slice(0,-1);
    running.forEach((f,k)=>expect(f.deadline).toBe(PREVIEW_PHASE+k*F));
    const over=running.slice(1).map(f=>f.elapsed-f.deadline);
    expect(over.some(d=>d>0)).toBe(true);                                 // some frame ends past its deadline
    expect(Math.max(...over)).toBeLessThan(F);                            // a HALT is one step to the next VBlank: never more than a frame
    expect(over.every(d=>d>=0)).toBe(true);                               // never short of it
  });
});

describe('the shadow store and the exact DMA latch',()=>{
  it('a render before the latch sees the earlier object; after the latch, the captured bytes; presenting changes nothing',()=>{
    const session=new PreviewSession(new PreviewInput());
    const r=session.runner;
    const countOf=(field:string)=>r.events.filter(e=>e.kind==='store'&&e.owner==='foreground'&&e.field===field).length;
    const stepUntil=(pred:()=>boolean)=>{for(let i=0;i<200000&&!pred();i++)r.step();if(!pred())throw new Error('bound');};
    // iteration 2 writes X = 4 (+8 = 12) after the iteration-1 service has latched X = 2 (+8 = 10)
    stepUntil(()=>countOf('shadowOam.1')===3);
    expect(r.observe().shadowOam[1]).toBe(12);expect(r.visibleOam[1]).toBe(10);
    const before=session.snapshot(0);
    expect([at(before.raster,2,2),at(before.raster,4,2)]).toEqual([2,0]); // the shadow store is not drawn yet
    // the next service starts its DMA, then latches at start + 642
    const latches=()=>r.events.filter(e=>e.kind==='oam-latch').length;
    const n=latches();
    stepUntil(()=>latches()===n+1);
    const latch=r.events.filter(e=>e.kind==='oam-latch').pop()!;
    expect(latch).toMatchObject({kind:'oam-latch'});
    expect((latch as {dot:number;completion:number}).dot).toBe((latch as {completion:number}).completion);
    expect(r.visibleOam[1]).toBe(12);
    const after=session.snapshot(0);
    expect([at(after.raster,2,2),at(after.raster,4,2),at(after.raster,4,3),at(after.raster,5,3)]).toEqual([0,2,2,2]);
    // presentation is read-only
    const obs=JSON.stringify(r.observe()),events=JSON.stringify(r.events),elapsed=r.elapsed,v=session.audio.version;
    session.snapshot(0);session.snapshot(0);
    expect(JSON.stringify(r.observe())).toBe(obs);expect(JSON.stringify(r.events)).toBe(events);
    expect([r.elapsed,session.audio.version]).toEqual([elapsed,v]);
    expect(session.snapshot(0).raster===session.snapshot(0).raster).toBe(false);   // a fresh buffer each time
  });
});

describe('replay and late callbacks',()=>{
  it('anchors Start and Replay to their own wall-clock time at 3 fps',()=>{
    const {ctrl,sched,clock}=host({fps:3,t0:200});
    ctrl.start();
    expect(ctrl.absoluteDeadline).toBe(4);

    clock.t=340;
    expect(sched.fire(340)).toBe(true);
    const earlyStartDeadline=ctrl.absoluteDeadline;
    clock.t=534;
    expect(sched.fire(534)).toBe(true);
    expect([earlyStartDeadline,ctrl.absoluteDeadline]).toEqual([4,4+F]);

    clock.t=1000;
    ctrl.start();
    expect(ctrl.sessions).toBe(2);
    expect(ctrl.absoluteDeadline).toBe(4);

    clock.t=1140;
    expect(sched.fire(1140)).toBe(true);
    const earlyReplayDeadline=ctrl.absoluteDeadline;
    clock.t=1334;
    expect(sched.fire(1334)).toBe(true);
    expect([earlyReplayDeadline,ctrl.absoluteDeadline]).toEqual([4,4+F]);
  });

  it('restart after a skip and after a natural exit: a fresh session each time, no state carried',()=>{
    const h=host();h.ctrl.start();
    h.clock.t=h.t0+2*FRAME_MS+0.01;h.sched.fire(h.clock.t);h.ctrl.skip();pump(h);
    expect(last(h.statuses)).toEqual({state:'skipped'});
    const first=h.ctrl.session!;
    h.clock.t+=5000;h.ctrl.start();                                       // Replay: new pacing timebase
    // identity by boolean: toBe on two objects deep-compares them on mismatch, which would drain a runner's generator
    expect(h.ctrl.session===first).toBe(false);
    expect([h.ctrl.session!.elapsed,h.ctrl.absoluteDeadline]).toEqual([PREVIEW_PHASE,PREVIEW_PHASE]);
    expect(h.ctrl.session!.state.read('fIter')).toBe(0);
    pump(h);
    expect(last(h.statuses)).toEqual({state:'completed'});
    expect(storesOf(h.ctrl,'fStage').filter(v=>v>0)).toEqual([1,2,3]);   // from stage zero
    const second=h.ctrl.session!;
    h.clock.t+=5000;h.ctrl.start();pump(h);                               // Replay after a natural exit
    expect(h.ctrl.sessions).toBe(3);expect(h.ctrl.releases).toBe(3);
    expect(h.ctrl.session===second).toBe(false);
    expect(last(h.statuses)).toEqual({state:'completed'});
    expect(last(h.frames).completed).toBe(6);
  });
  it('a stale callback from a finished or replaced session cannot advance the new one or overwrite its frame',()=>{
    const h=host();h.ctrl.start();
    const oldCallback=h.sched.all[0];
    h.clock.t+=3*FRAME_MS;h.ctrl.start();                                 // replaced while its first callback is still pending
    expect(h.sched.cancelled).toBe(1);
    const session=h.ctrl.session!,elapsed=session.elapsed,frames=h.frames.length,obs=JSON.stringify(session.runner.observe());
    oldCallback(h.clock.t+10*FRAME_MS);                                   // the browser fires it anyway
    expect(session.elapsed).toBe(elapsed);expect(h.frames).toHaveLength(frames);
    expect(JSON.stringify(session.runner.observe())).toBe(obs);
    // and after a natural exit, a leftover callback of that session is dead too
    pump(h);
    const done=h.ctrl.session!,finalFrames=h.frames.length,callbacks=h.sched.all.slice();
    h.clock.t+=3000;h.ctrl.start();
    const fresh=h.ctrl.session!;
    for(const cb of callbacks.slice(0,-1))cb(h.clock.t+20*FRAME_MS);
    expect(fresh.elapsed).toBe(PREVIEW_PHASE);expect(fresh===done).toBe(false);
    expect(h.frames.length).toBe(finalFrames+1);                          // only the new session's initial frame
  });
  it('unmount cancels the chain and releases the live session once',()=>{
    const h=host();h.ctrl.start();pump(h,1,3);
    h.ctrl.unmount();
    expect(h.sched.pending.size).toBe(0);expect(h.ctrl.releases).toBe(1);expect(h.ctrl.status).toBe('idle');
    h.ctrl.unmount();expect(h.ctrl.releases).toBe(1);
  });
});

describe('isolation',()=>{
  const root=resolve(__dirname,'..','..');
  it('no production file imports the preview; the dev page is not an input of the production build',()=>{
    const src=resolve(root,'src'),owners:string[]=[];
    function walk(folder:string):void{for(const x of readdirSync(folder,{withFileTypes:true})){
      const p=resolve(folder,x.name);if(x.isDirectory())walk(p);
      else if(x.name.endsWith('.ts')&&!x.name.endsWith('.test.ts')&&/foreground_preview/.test(readFileSync(p,'utf8')))owners.push(relative(src,p));
    }}
    walk(src);expect(owners).toEqual([]);
    expect(readFileSync(resolve(root,'index.html'),'utf8')).not.toMatch(/preview|foreground/i);
    expect(readFileSync(resolve(root,'vite.config.ts'),'utf8')).not.toMatch(/rollupOptions|foreground|dev\//);
    expect(existsSync(resolve(root,'dev/foreground-preview.html'))).toBe(true);
    expect(readFileSync(resolve(root,'dev/foreground-preview.html'),'utf8')).toContain('/scripts/foreground_preview.ts');
  });
  it('importing the host touches no DOM (this suite runs in a node environment)',()=>{
    expect(typeof (globalThis as {document?:unknown}).document).toBe('undefined');
  });
});
