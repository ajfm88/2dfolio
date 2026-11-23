import {describe,expect,it} from 'vitest';
import {IntroDisplayClock,INTRO_OAM_BYTES} from './intro_display_clock';
import {IntroCpu} from './intro_cpu';
import type {IntroForegroundStep,IntroHelperReply} from './intro_helper_timing';
import {IntroForegroundRunner,IntroSharedState,introQuietSharedFields,type IntroAudioOwner,type IntroRunnerEvent} from './intro_foreground_runner';

// Note 135: the OAM DMA latch is scheduled on the display clock at the true completion dot (start + 642). All dots are
// absolute from the LCD-enable write (the clock's 0). The next visible scan after the first frame starts at 70,221
// (line 0 of frame 1: 70,224 - 3); the existing guard refuses a latch within 12 dots of it.
type Gen=Generator<IntroForegroundStep,void,IntroHelperReply>;
const BLANK=new Uint8Array(INTRO_OAM_BYTES);
const oamOf=(y:number,x:number)=>{const o=new Uint8Array(INTRO_OAM_BYTES);o[0]=y;o[1]=x;return o;};
const clock=(o:{lcdc?:number;mode0?:boolean;advance?:number}={})=>{
  const d=new IntroDisplayClock({scx:0,wy:144,wx:7,lcdc:o.lcdc??0x83,oam:BLANK,mode0Enabled:o.mode0??true,pending:0});
  if(o.advance)d.advance(o.advance);return d;
};
class Audio implements IntroAudioOwner{version=0;forecast(){return 100;}update(){this.version++;}}
const nop=(cycles:number,op='filler'):IntroForegroundStep=>({cycles,op});
const st=(field:string,value:number,cycles=3):IntroForegroundStep=>({cycles,op:`ld [${field}],a`,store:{field,trailingDots:4,value}});
function rig(d:IntroDisplayClock,make:()=>Gen,o:{ie?:number;ime?:boolean;shadow?:[number,number]}={}){
  const cpu=new IntroCpu(d,{ie:o.ie??0,ime:o.ime??false});
  const state=new IntroSharedState({...introQuietSharedFields()});
  if(o.shadow){state.shadowOam[0]=o.shadow[0];state.shadowOam[1]=o.shadow[1];}
  const runner=new IntroForegroundRunner({cpu,state,audio:new Audio()},()=>make());
  return {cpu,state,runner,d};
}
const only=<K extends IntroRunnerEvent['kind']>(e:readonly IntroRunnerEvent[],k:K)=>e.filter((x):x is Extract<IntroRunnerEvent,{kind:K}>=>x.kind===k);
const lastOf=<T,>(a:readonly T[]):T=>a[a.length-1];
/** rDMA store at 69,556 (effect 69,564), 26 six-cycle fillers, a two-cycle filler: the boundary at 70,200. */
function* approach():Gen{
  yield st('rDMA',0xc3);
  for(let i=0;i<26;i++)yield nop(6);
  yield nop(2);
}

describe('the reproduced regression: DMA completes at 70,206, the scan starts at 70,221, the instruction ends at 70,224',()=>{
  const run=(object:boolean)=>{
    const d=clock({advance:69556});
    const r=rig(d,function*(){yield* approach();yield nop(6,'crossing');},{shadow:object?[16,40]:undefined});
    r.runner.run(28);                               // store + 26 fillers + the two-cycle filler
    return r;
  };
  it('latches at the exact dot inside the crossing instruction; the scan sees the new OAM; STAT is 11 dots later than blank',()=>{
    const r=run(true),d=r.d;
    expect(r.runner.elapsed).toBe(70200);
    expect(only(r.runner.events,'effect')).toEqual([{kind:'effect',owner:'foreground',dot:69564,name:'oam-dma-start'}]);
    expect(only(r.runner.events,'oam-latch')).toEqual([]);
    expect(d.oamDma).toMatchObject({start:69564,completion:70206});
    d.writePending(0);                               // stale line-143 STAT requests
    r.runner.step();                                 // the crossing instruction, one runner step
    const e=r.runner.events;
    expect(r.runner.elapsed).toBe(70224);
    expect(only(e,'oam-latch')).toEqual([{kind:'oam-latch',completion:70206,dot:70206}]);
    expect(e.indexOf(only(e,'oam-latch')[0])).toBeLessThan(e.indexOf(only(e,'insn').find(x=>x.op==='crossing')!));
    expect(only(e,'insn').find(x=>x.op==='crossing')).toMatchObject({start:70200,end:70224});
    expect([...d.oam.slice(0,2)]).toEqual([16,40]);
    expect(d.oamDma).toBeNull();
    d.advance(260);expect(d.elapsed).toBe(70484);expect(d.pending).toBe(0);
    d.advance(1);expect(d.pending).toBe(2);          // 70,485
  });
  it('the blank-OAM control raises STAT at 70,474',()=>{
    const r=run(false),d=r.d;
    d.writePending(0);r.runner.step();
    d.advance(249);expect(d.elapsed).toBe(70473);expect(d.pending).toBe(0);
    d.advance(1);expect(d.pending).toBe(2);
  });
});

describe('lookahead and HALT account for the pending transfer without changing live state',()=>{
  const at200=(object:boolean)=>{
    const d=clock({advance:69556});
    const r=rig(d,function*(){yield* approach();},{shadow:object?[16,40]:undefined});
    r.runner.run(28);d.writePending(0);return r;
  };
  it('STAT lookahead from 70,200 is 285 with the object and 274 blank; twice leaves everything untouched',()=>{
    const r=at200(true),d=r.d;
    const snap=()=>JSON.stringify({t:d.elapsed,p:d.pending,dma:d.oamDma&&{...d.oamDma,oam:[...d.oamDma.oam]},oam:[...d.oam],e:r.runner.events});
    const before=snap();
    expect(d.dotsUntilRequest(2)).toBe(285);
    expect(d.dotsUntilRequest(2)).toBe(285);
    expect(snap()).toBe(before);
    expect(at200(false).d.dotsUntilRequest(2)).toBe(274);
  });
  it('HALT on the object case wakes at 70,488, the first CPU boundary at or after 70,485 (blank: 70,476)',()=>{
    const go=(object:boolean)=>{
      const d=clock({advance:69556});d.writePending(0);
      const r=rig(d,function*(){yield* approach();yield {cycles:1,op:'halt',halt:true};},{ie:2,ime:true,shadow:object?[16,40]:undefined});
      r.runner.run(29);return r;
    };
    const a=go(true),e=a.runner.events;
    expect(only(e,'halt')).toEqual([{kind:'halt',start:70200,end:70488,result:'woke'}]);
    expect(only(e,'oam-latch')).toEqual([{kind:'oam-latch',completion:70206,dot:70206}]);
    expect(e.indexOf(only(e,'oam-latch')[0])).toBeLessThan(e.indexOf(only(e,'halt')[0]));
    expect(only(go(false).runner.events,'halt')[0].end).toBe(70476);
  });
});

describe('genuinely unsafe timing still throws, scheduled or direct',()=>{
  const scheduled=(completion:number)=>{
    const d=clock({advance:completion-642});
    d.startOamDma(oamOf(16,40));
    d.advance(642);return d;
  };
  it('completion at scan - 12 (70,209) is accepted; scan - 11 (70,210) and the scan dot itself throw',()=>{
    expect([...scheduled(70209).oam.slice(0,2)]).toEqual([16,40]);
    expect(()=>scheduled(70210)).toThrow(/overlapping a visible line scan/);
    expect(()=>scheduled(70221)).toThrow(/overlapping a visible line scan/);   // due before a same-dot scan, which is still queued
    const direct=(dot:number)=>{const d=clock({advance:dot});d.latchOam(oamOf(16,40));};
    expect(()=>direct(70209)).not.toThrow();expect(()=>direct(70210)).toThrow(RangeError);
  });
  it('through the runner: the refused transfer is never traced as latched and the fault is the last event',()=>{
    // rDMA store starting 69,560 has its effect at 69,568; completion 70,210 is inside the 24-dot instruction crossing 70,200
    const d=clock({advance:69560});
    const r=rig(d,function*(){yield* approach();yield nop(6,'crossing');},{shadow:[16,40]});
    expect(()=>r.runner.runToEnd()).toThrow(/overlapping a visible line scan/);
    expect(only(r.runner.events,'oam-latch')).toEqual([]);
    expect(lastOf(r.runner.events).kind).toBe('fault');
  });
  it('keeps the foreground read effect when a later dot in the same instruction faults',()=>{
    // DMA starts at 69,568 and reaches the scan guard at 70,210. The read in 70,200..70,212 already sampled at 70,208.
    const d=clock({advance:69560});
    const r=rig(d,function*(){
      yield st('rDMA',0xc3);
      for(let i=0;i<26;i++)yield nop(6);
      yield nop(1);
      yield {cycles:3,op:'read shadow OAM',read:{field:'shadowOam.1',trailingDots:4}};
    },{shadow:[16,40]});
    expect(()=>r.runner.runToEnd()).toThrow(/overlapping a visible line scan/);
    expect(r.runner.events.slice(-2)).toEqual([
      {kind:'read',owner:'foreground',dot:70208,field:'shadowOam.1',value:40},
      {kind:'fault',dot:70210,message:'Intro display OAM DMA overlapping a visible line scan is unmeasured'},
    ]);
  });
});

describe('copy at start, event order, long steps and LCD off',()=>{
  it('a DMA completed before a later store effect in the same instruction is traced first, and the store may start the next DMA',()=>{
    // rDMA store 65,700..65,712 (effect 65,708, completion 66,350, shadow X 40); a 2-cycle store of X=48 at 66,336..66,344;
    // the second rDMA store starts at 66,344 and its effect (66,352) is after the completion (66,350) inside that step
    const d=clock({advance:65700});
    const r=rig(d,function*(){
      yield st('rDMA',0xc3);
      for(let i=0;i<26;i++)yield nop(6);
      yield st('shadowOam.1',48,2);
      yield st('rDMA',0xc3);
      for(let i=0;i<27;i++)yield nop(6);
    },{shadow:[16,40]});
    r.runner.run(28);                                    // up to and including the shadow store: boundary 66,344
    expect(r.runner.elapsed).toBe(66344);
    expect(r.state.shadowOam[1]).toBe(48);
    expect(d.oamDma!.oam[1]).toBe(40);                   // the snapshot kept the earlier byte
    r.runner.step();                                     // the whole second store instruction is one runner step
    const e=r.runner.events;
    const tail=e.slice(e.findIndex(x=>x.kind==='oam-latch'));
    expect(tail.slice(0,3).map(x=>x.kind)).toEqual(['oam-latch','effect','store']);
    expect(tail[0]).toEqual({kind:'oam-latch',completion:66350,dot:66350});
    expect(tail[2]).toMatchObject({dot:66352,field:'rDMA'});
    expect([...d.oam.slice(0,2)]).toEqual([16,40]);
    expect(d.oamDma).toMatchObject({start:66352,completion:66994});
    expect(d.oamDma!.oam[1]).toBe(48);
    r.runner.runToEnd();
    expect(only(r.runner.events,'oam-latch').map(x=>[x.completion,x.dot])).toEqual([[66350,66350],[66994,66994]]);
    expect(d.oam[1]).toBe(48);
  });
  it('a GDMA stall spanning the completion emits one latch and stays one runner step',()=>{
    const d=clock({advance:65700});
    const r=rig(d,function*(){yield st('rDMA',0xc3);yield {kind:'gdma',dots:2052,which:1};},{shadow:[16,40]});
    expect(r.runner.step()).toBe('foreground');
    expect(r.runner.step()).toBe('aggregate');
    expect(only(r.runner.events,'oam-latch')).toEqual([{kind:'oam-latch',completion:66350,dot:66350}]);
    const e=r.runner.events;
    expect(e.indexOf(only(e,'oam-latch')[0])).toBeLessThan(e.indexOf(only(e,'gdma')[0]));
    expect(r.runner.elapsed).toBe(65712+2052);
  });
  it('with the LCD off the transfer runs on the same clock, IF is unchanged, and the new OAM is used when the LCD comes on',()=>{
    const go=(shadow:[number,number]|undefined)=>{
      const d=clock({lcdc:0x03,advance:1000});
      const r=rig(d,function*(){
        yield st('rDMA',0xc3);
        for(let i=0;i<30;i++)yield nop(6);
        yield st('rLCDC',0x83);
        yield nop(1);
      },{shadow});
      r.runner.run(31);
      return r;
    };
    const a=go([17,40]),b=go(undefined);
    expect(a.d.lcdOn).toBe(false);
    expect(only(a.runner.events,'oam-latch')).toEqual([{kind:'oam-latch',completion:1008+642,dot:1008+642}]);
    expect(a.d.pending).toBe(0);expect([...a.d.oam.slice(0,2)]).toEqual([17,40]);
    a.runner.step();
    expect(a.d.lcdOn).toBe(true);
    b.runner.step();
    // the object on line 1 (Y 17) lengthens line 1 by 11 dots, so its first mode-0 request is 11 dots later than blank's
    for(const x of [a,b]){x.d.advance(x.d.dotsUntilRequest(2)!);x.d.writePending(0);}   // past line 0's request (no object scan there)
    expect(a.d.dotsUntilRequest(2)!-b.d.dotsUntilRequest(2)!).toBe(11);
  });
});
