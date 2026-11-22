import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {IntroDisplayClock,INTRO_IF_STAT,INTRO_IF_VBLANK,INTRO_OAM_BYTES,type IntroDisplayInterrupt} from './intro_display_clock';
import {
  INTRO_DISPATCH_DOTS,INTRO_HALT_EXIT_DOTS,INTRO_IF_STORE_TRAILING_DOTS,INTRO_VECTOR_SAMPLE_DOTS,IntroCpu,
} from './intro_cpu';

// Independent evidence: notes/130-opening-checkpoint-12b2c2-2a/cpu-control-research.json, captured by
// run-cpu-control-research.py from the pinned SameBoy Core (CGB-E, normal speed) running real SM83 code. The fixture is
// a byte copy; no game code produced it. Dots are relative to the CPU's LCDC store effect (the display clock's 0).
type Step=(string|number)[];
interface FrameRow{start:number;ie:number;scx:number;x:string[];entry:number;steps:Step[];end:number}
interface VectorRow{eiDot:number;ifAtEi:number;steps:Step[];end:number;ifAfter:number}
interface IfRow{scx:number;xorStart:number;ldhStart:number;ldhEnd:number;request:number;ifAfter:number}
interface Reference{sections:{seq:Record<'ei'|'reti'|'di-pending',number[][]>;ifclear:IfRow[];vector:VectorRow[];frame:FrameRow[]}}
const ref:Reference=JSON.parse(readFileSync(resolve(__dirname,'__fixtures__/intro_cpu_reference.json'),'utf8'));
const S=ref.sections;

function oamOf(tokens:readonly string[]):Uint8Array{
  const oam=new Uint8Array(INTRO_OAM_BYTES);
  tokens.forEach((token,i)=>{const [x,y]=token.split(':');oam[i*4]=y===undefined?24:Number(y);oam[i*4+1]=Number(x);});
  return oam;
}
/** The probe's LCD: LCDC $E3 by a CPU store whose effect is dot 0, WY 144 (no window), STAT $08 when asked. */
const lcd=(scx:number,objects:readonly string[],stat:boolean,pending=0)=>new IntroDisplayClock({
  scx,wy:144,wx:7,lcdc:0xe3,oam:oamOf(objects),mode0Enabled:stat,pending});

/** The probe programs, stated instruction by instruction (test-only: the owner of a real movie states its own). */
class Program{
  readonly steps:Step[]=[];
  hvbo=0;
  constructor(readonly cpu:IntroCpu){}
  get t():number{return this.cpu.elapsed;}
  /** A completed boundary at `pc` (the address execution would continue from). */
  boundary(pc:number):void{
    for(;;){
      const start=this.t,vector=this.cpu.interrupt();
      if(vector===null)return;
      this.steps.push(['dispatch',start,this.t-start,vector,this.cpu.display.pending,pc]);
      this.handler(vector,pc);
    }
  }
  handler(vector:IntroDisplayInterrupt,returnPc:number):void{
    const c=this.cpu;
    c.exec(4);                                   // jp handler
    if(vector===INTRO_IF_VBLANK){c.exec(4);c.exec(1);c.exec(3,()=>{this.hvbo=0;});c.exec(3);}  // push af/xor a/ldh [$90],a/pop af
    else{c.exec(4);c.exec(3);c.exec(1);c.exec(3);c.exec(3);}                                // push af/ldh a,[$91]/and a/jr z (taken)/pop af
    const start=this.t;c.reti();this.steps.push(['reti',start,this.t-start,returnPc]);
  }
  /** DelayFrame's loop: ld a,1 / ldh [$90],a / .halt halt / ldh a,[$90] / and a / jr nz,.halt; returns the end dot. */
  delayFrame():number{
    const c=this.cpu;
    c.exec(2);this.boundary(0xff82);
    c.exec(3,()=>{this.hvbo=1;});this.boundary(0xff84);
    for(;;){
      const start=this.t,result=c.halt();
      this.steps.push(['halt',start,4,result==='woke'?1:0]);
      if(result==='retry'){this.boundary(0xff84);continue;}
      this.boundary(0xff85);
      c.exec(3);const a=this.hvbo;this.boundary(0xff87);
      c.exec(1);this.boundary(0xff88);
      if(a){c.exec(3);this.boundary(0xff84);continue;}
      c.exec(2);return this.t;
    }
  }
}

describe('measured constants',()=>{
  it('dispatch 20 dots, HALT exit 4, vector sampled 14 dots in, IF stores 3 dots before the end',()=>{
    expect([INTRO_DISPATCH_DOTS,INTRO_HALT_EXIT_DOTS,INTRO_VECTOR_SAMPLE_DOTS,INTRO_IF_STORE_TRAILING_DOTS]).toEqual([20,4,14,3]);
  });
});

describe('EI, RETI and DI with a request already pending (LCD off)',()=>{
  const off=()=>new IntroCpu(new IntroDisplayClock({scx:0,wy:144,wx:7,lcdc:0x63,oam:new Uint8Array(160),mode0Enabled:false,pending:1}),{ie:1,ime:false});
  it('EI: no dispatch after EI itself, one after the following instruction',()=>{
    const cpu=off(),rows:number[][]=[];
    let t=cpu.elapsed;cpu.ei();rows.push([0xff80,cpu.elapsed-t,0xff81,+cpu.ime,cpu.display.pending&1]);
    expect(cpu.interrupt()).toBeNull();
    t=cpu.elapsed;cpu.exec(1);rows.push([0xff81,cpu.elapsed-t,0xff82,+cpu.ime,cpu.display.pending&1]);
    t=cpu.elapsed;expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);rows.push([0xff82,cpu.elapsed-t,0x40,+cpu.ime,cpu.display.pending&1]);
    expect(rows).toEqual(S.seq.ei);
  });
  it('RETI: IME on at once, dispatch at the very next boundary',()=>{
    const cpu=off(),rows:number[][]=[];
    let t=cpu.elapsed;cpu.reti();rows.push([0xff80,cpu.elapsed-t,0xff81,+cpu.ime,cpu.display.pending&1]);
    t=cpu.elapsed;expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);rows.push([0xff81,cpu.elapsed-t,0x40,+cpu.ime,cpu.display.pending&1]);
    expect(rows).toEqual(S.seq.reti);
  });
  it('DI: never dispatches',()=>{
    const cpu=off(),rows:number[][]=[];
    let t=cpu.elapsed;cpu.di();rows.push([0xff80,cpu.elapsed-t,0xff81,+cpu.ime,cpu.display.pending&1]);
    expect(cpu.interrupt()).toBeNull();
    t=cpu.elapsed;cpu.exec(1);rows.push([0xff81,cpu.elapsed-t,0xff82,+cpu.ime,cpu.display.pending&1]);
    for(let i=0;i<4;i++){expect(cpu.interrupt()).toBeNull();t=cpu.elapsed;cpu.exec(3);rows.push([0xff82,cpu.elapsed-t,0xff82,+cpu.ime,cpu.display.pending&1]);}
    expect(rows).toEqual(S.seq['di-pending']);
  });
});

describe('IF store: effect three dots before the end clears requests at or before it',()=>{
  it.each(S.ifclear.map(r=>[r.scx,r.xorStart,r] as const))('SCX %i, xor at %i',(scx,dot,row)=>{
    const display=lcd(scx,[],true),cpu=new IntroCpu(display,{ie:3,ime:false});
    display.advance(4);display.writePending(0);display.advance(dot-4);display.writePending(0);
    cpu.exec(1);expect(cpu.elapsed).toBe(row.ldhStart);
    cpu.storeIf(0);expect(cpu.elapsed).toBe(row.ldhEnd);
    expect(display.pending).toBe(row.ifAfter);
  });
  it('covers a request exactly at the effect dot (cleared) and one dot after it (kept)',()=>{
    expect(S.ifclear.some(r=>r.request===r.ldhEnd-3&&r.ifAfter===0)).toBe(true);
    expect(S.ifclear.some(r=>r.request===r.ldhEnd-2&&r.ifAfter===INTRO_IF_STAT)).toBe(true);
  });
});

describe('vector re-check: a VBlank arriving during a STAT dispatch',()=>{
  it.each(S.vector.map(r=>[r.eiDot,r] as const))('EI at %i',(dot,row)=>{
    const display=lcd(0,[],true),cpu=new IntroCpu(display,{ie:3,ime:false}),p=new Program(cpu);
    display.advance(4);display.writePending(0);display.advance(dot-4);
    expect(display.pending).toBe(row.ifAtEi);
    cpu.ei();p.boundary(0xff81);cpu.exec(1);
    // after the nop: dispatch; then, until the VBlank handler's first jp ends, a `jr` loop at $FF82
    let end:number|null=null;
    const start=p.t,vector=cpu.interrupt();
    expect(vector).not.toBeNull();
    p.steps.push(['dispatch',start,p.t-start,vector!,display.pending,0xff82]);
    if(vector===INTRO_IF_VBLANK){cpu.exec(4);end=p.t;}
    else{
      p.handler(vector!,0xff82);
      for(let guard=0;guard<100&&end===null;guard++){
        const s=p.t,v=cpu.interrupt();
        if(v===INTRO_IF_VBLANK){p.steps.push(['dispatch',s,p.t-s,v,display.pending,0xff82]);cpu.exec(4);end=p.t;}
        else if(v===null)cpu.exec(3);
        else p.handler(v,0xff82);
      }
    }
    expect(p.steps).toEqual(row.steps);expect(end).toBe(row.end);expect(display.pending).toBe(row.ifAfter);
  });
  it('the sweep contains both outcomes on either side of the sample dot',()=>{
    const first=S.vector.map(r=>({offset:65662-(r.steps[0][1] as number),vector:r.steps[0][3]}));
    expect(first.find(r=>r.offset===INTRO_VECTOR_SAMPLE_DOTS)?.vector).toBe(INTRO_IF_VBLANK);
    expect(first.find(r=>r.offset===INTRO_VECTOR_SAMPLE_DOTS+4)?.vector).toBe(INTRO_IF_STAT);
  });
});

describe('DelayFrame HALT loop with the zero-pointer LCDC handler: every dispatch, return and end dot',()=>{
  it.each(S.frame.map((r,i)=>[i,r.ie,r.scx,r.start,r] as const))('trace %i: IE %i SCX %i entered at %i',(_i,ie,scx,start,row)=>{
    const display=lcd(scx,row.x,(ie&2)!==0);
    display.advance(row.entry);display.writePending(0);
    expect(row.entry).toBe(start);
    const p=new Program(new IntroCpu(display,{ie,ime:true}));
    const end=p.delayFrame();
    expect(p.steps).toEqual(row.steps);expect(end).toBe(row.end);
  });
  it('the traces include HALT retries, wakes at every request phase and whole frames of 144 STAT wakes',()=>{
    const halts=S.frame.flatMap(r=>r.steps.filter(s=>s[0]==='halt'));
    expect(halts.some(s=>s[3]===0)).toBe(true);expect(halts.some(s=>s[3]===1)).toBe(true);
    const retries=S.frame.flatMap(r=>r.steps.filter(s=>s[0]==='dispatch'&&s[5]===0xff84&&s[2]===20));
    const wakes=S.frame.flatMap(r=>r.steps.filter(s=>s[0]==='dispatch'&&s[5]===0xff85&&s[2]===24));
    expect(retries.length).toBeGreaterThan(0);expect(wakes.length).toBeGreaterThan(100);
    expect(new Set(S.frame.filter(r=>r.ie===3).map(r=>r.scx))).toEqual(new Set([0,1,2,3,4]));
  });
});

describe('the model',()=>{
  const at=(dot:number,ie=3,ime=true)=>{const d=lcd(0,[],true);d.advance(dot);d.writePending(0);return new IntroCpu(d,{ie,ime});};
  it('a VBlank-only HALT that misses the request inside the HALT sleeps a whole frame',()=>{
    const cpu=at(65660-0,1);               // HALT at 65660: VBlank at 65662 is inside it
    expect(cpu.halt()).toBe('retry');expect(cpu.elapsed).toBe(65664);
    expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);expect(cpu.elapsed).toBe(65684);
  });
  it('leaving HALT costs four dots more than an ordinary dispatch',()=>{
    const cpu=at(65640,1);
    expect(cpu.halt()).toBe('woke');expect(cpu.elapsed).toBe(65664);
    expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);expect(cpu.elapsed).toBe(65688);
  });
  it('only the dispatch that leaves HALT pays the exit; the next one is 20 dots',()=>{
    const cpu=at(65640,1);expect(cpu.halt()).toBe('woke');
    let t=cpu.elapsed;expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);expect(cpu.elapsed-t).toBe(24);
    cpu.display.writePending(INTRO_IF_VBLANK);cpu.reti();             // a request already waiting at RETI
    t=cpu.elapsed;expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);expect(cpu.elapsed-t).toBe(20);
    const retry=at(65660,1);expect(retry.halt()).toBe('retry');
    t=retry.elapsed;expect(retry.interrupt()).toBe(INTRO_IF_VBLANK);expect(retry.elapsed-t).toBe(20);
  });
  it('acknowledges only the dispatched bit and keeps IME off until RETI',()=>{
    const d=lcd(0,[],true,3),cpu=new IntroCpu(d,{ie:3,ime:true});
    expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);expect(d.pending).toBe(INTRO_IF_STAT);expect(cpu.ime).toBe(false);
    expect(cpu.interrupt()).toBeNull();cpu.reti();expect(cpu.interrupt()).toBe(INTRO_IF_STAT);expect(d.pending).toBe(0);
  });
  it('IE masks a pending request, and IE bits 2-4 never dispatch',()=>{
    const d=lcd(0,[],true,2),cpu=new IntroCpu(d,{ie:0x1d,ime:true});
    expect(cpu.interrupt()).toBeNull();cpu.exec(1);expect(d.pending).toBe(2);
    cpu.storeIe(0x0f);expect(cpu.ie).toBe(0x0f);expect(cpu.interrupt()).toBe(INTRO_IF_STAT);
  });
  it('DI with IME on turns it off at once: a request arriving afterwards waits',()=>{
    const cpu=at(65600,1);cpu.di();expect(cpu.ime).toBe(false);
    cpu.exec(6);for(let i=0;i<10;i++)cpu.exec(4);expect(cpu.display.pending).toBe(INTRO_IF_VBLANK);
    expect(cpu.interrupt()).toBeNull();cpu.exec(1);
  });
  it('EI with IME already on changes nothing; EI then EI still waits one instruction',()=>{
    const d=lcd(0,[],true,1),cpu=new IntroCpu(d,{ie:1,ime:false});
    cpu.ei();expect(cpu.interrupt()).toBeNull();cpu.ei();expect(cpu.ime).toBe(true);
    expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);
  });
  it('a store effect runs at its trailing point; the default is the LCDC/STAT four dots',()=>{
    const cpu=at(1000,0,false),seen:number[]=[];
    cpu.exec(3,()=>seen.push(cpu.elapsed));cpu.exec(2,()=>seen.push(cpu.elapsed),3);
    expect(seen).toEqual([1000+12-4,1012+8-3]);
  });
  it('refuses unmeasured or impossible states before changing anything',()=>{
    const display=()=>lcd(0,[],true);
    expect(()=>new IntroCpu(display(),{ie:0x20,ime:false})).toThrow(RangeError);
    expect(()=>new IntroCpu(display(),{ie:1.5,ime:false})).toThrow(RangeError);
    const halted=new IntroCpu(display(),{ie:3,ime:false});
    expect(()=>halted.halt()).toThrow(RangeError);                         // HALT with IME off
    const ei=new IntroCpu(display(),{ie:3,ime:false});ei.ei();
    expect(()=>ei.di()).toThrow(RangeError);expect(()=>ei.reti()).toThrow(RangeError);
    const ei2=new IntroCpu(display(),{ie:3,ime:false});ei2.ei();expect(()=>ei2.halt()).toThrow(RangeError);
    for(const cycles of [0,7,1.5,NaN])expect(()=>at(1000).exec(cycles)).toThrow(RangeError);
    for(const trailing of [0,5,2.5])expect(()=>at(1000).exec(2,()=>undefined,trailing)).toThrow(RangeError);
    expect(()=>at(1000).storeIf(256)).toThrow(RangeError);expect(()=>at(1000).storeIe(0x20)).toThrow(RangeError);
    const off=new IntroCpu(new IntroDisplayClock({scx:0,wy:144,wx:7,lcdc:0x63,oam:new Uint8Array(160),mode0Enabled:false,pending:0}),{ie:1,ime:true});
    const before=off.elapsed;expect(()=>off.halt()).toThrow(RangeError);expect(off.elapsed).toBe(before); // nothing would wake it
  });
  it('refuses to skip a dispatch the hardware would take, and to run on before an owed dispatch',()=>{
    const pending=new IntroCpu(lcd(0,[],true,2),{ie:3,ime:true});
    expect(()=>pending.exec(1)).toThrow(RangeError);expect(()=>pending.halt()).toThrow(RangeError);
    const woke=at(65640,1);expect(woke.halt()).toBe('woke');
    expect(()=>woke.exec(1)).toThrow(RangeError);expect(()=>woke.halt()).toThrow(RangeError);
    const retry=at(65660,1);expect(retry.halt()).toBe('retry');expect(()=>retry.exec(1)).toThrow(RangeError);
  });
});

it('keeps the CPU model unused by the game; the display clock is imported only by it',()=>{
  const root=resolve(__dirname,'..'),cpu:string[]=[],display:string[]=[];
  function walk(folder:string):void{for(const e of readdirSync(folder,{withFileTypes:true})){
    const p=resolve(folder,e.name);if(e.isDirectory())walk(p);
    else if(e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')){
      const text=readFileSync(p,'utf8'),name=relative(root,p).replace(/\\/g,'/');
      if(/intro_cpu|IntroCpu/.test(text))cpu.push(name);
      if(/intro_display_clock|IntroDisplayClock/.test(text))display.push(name);
    }
  }}
  walk(root);
  expect(cpu.sort()).toEqual(['menus/intro_cpu.ts']);
  expect(display.sort()).toEqual(['menus/intro_cpu.ts','menus/intro_display_clock.ts']);
});
