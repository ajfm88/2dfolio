import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  CPU_STORE_TRAILING_DOTS,DISPLAY_FIRST_VBLANK_DOT,DISPLAY_FRAME_DOTS,IntroDisplayClock,INTRO_DOTS_PER_CYCLE,
  INTRO_IF_STAT,INTRO_IF_VBLANK,INTRO_OAM_BYTES,introLineExtraDots,introObjectExtraDots,lyAt,selectedObjectXs,
  type IntroDisplayRegisters,
} from './intro_display_clock';

// Independent evidence: notes/129-opening-checkpoint-12b2c2-1/cpu-lcd-research.json, captured by run-cpu-lcd-research.py from
// the pinned SameBoy Core (CGB-E, normal speed) executing real SM83 stores from HRAM. The fixture is a byte copy; no game code
// produced it. Dots are T-cycles; every row is relative to the dot the CPU's LCDC store took effect.
type Pair=[number,number];
interface Timeline{lcdc:number;wy:number;wx:number;scx:number;objects:string[];requests:Pair[];ly:Pair[];mode:Pair[]}
interface ProfileCase{scx:number;lcdc:number;wy:number;wx:number;objects:string[];requests:number[];dispatchBoundaries:number[]}
interface Reference{sections:{
  enable:{instructionEndMinusWrite:number;identicalForKinds:number[]};
  reenable:{after:number;gap:number;before:number[];afterDisable:number[];duringOff:number[];pendingAfterSecondEnable:number;firstVBlank:number;firstStat:number[]}[];
  statscan:{scx:number;objects:string[];ranges:Pair[]}[];
  cpuStatWrite:number[][];
  profile:{cases:ProfileCase[];checkedLines:number;unsupportedWindowObjectLines:number};
  timeline:Timeline[];
  statEdge:{cleared:{dot:number;mode:number;pre:number;immediate:number;nextAfterWrite:number}[];repeated:{dot:number;firstIf:number}[]};
  dynamic:{cpu:{dot:number;scx:number;wy:number;objects:string[];requests:number[]}[];dma:{dot:number;initial:string[];new:string[];started:number;done:number;requests:number[]}[]};
  vblankAccept:{vblankRequests:number[];firstDispatchBoundary:number};
}}
const ref:Reference=JSON.parse(readFileSync(resolve(__dirname,'__fixtures__/intro_display_clock_reference.json'),'utf8'));
const S=ref.sections;
const calibration:{cases:{scx:number;oamX:number[];line8VBlankRelativeDots:number}[]}=JSON.parse(readFileSync(
  resolve(__dirname,'../../../notes/128-opening-checkpoint-12b2c2/dot-calibration.json'),'utf8'));

function oamOf(tokens:readonly string[]):Uint8Array{
  const oam=new Uint8Array(INTRO_OAM_BYTES);
  tokens.forEach((token,i)=>{const [x,y]=token.split(':');oam[i*4]=y===undefined?24:Number(y);oam[i*4+1]=Number(x);});
  return oam;
}
const regs=(over:Partial<IntroDisplayRegisters>={}):IntroDisplayRegisters=>({
  scx:0,wy:144,wx:7,lcdc:0x63,oam:new Uint8Array(INTRO_OAM_BYTES),mode0Enabled:false,pending:0,...over});
/** An LCD that the CPU enables with `lcdcOn` at dot 0 (the probe's origin): the PPU is off until that store. */
function enabled(over:Partial<IntroDisplayRegisters>&{lcdcOn?:number}={}):IntroDisplayClock{
  const {lcdcOn,...rest}=over;
  const clock=new IntroDisplayClock(regs({...rest,lcdc:(lcdcOn??0xe3)&0x7f}));
  clock.writeLcdc(lcdcOn??0xe3);
  return clock;
}
const replayIf=(clock:IntroDisplayClock)=>{const mask=clock.pending&3;if(mask)clock.writePending(0);return mask;};

describe('policy constants',()=>{
  it('one machine cycle is four dots; a CPU store takes effect with one machine cycle left',()=>{
    expect(INTRO_DOTS_PER_CYCLE).toBe(4);expect(CPU_STORE_TRAILING_DOTS).toBe(S.enable.instructionEndMinusWrite);
    expect(S.enable.identicalForKinds).toEqual([0,1,2]);   // ldh [n],a / ld [nn],a / ld [hl],a: same PPU timeline
  });
  it('the first VBlank of an enabled LCD is 144 lines minus two dots, then every 70224',()=>{
    expect(DISPLAY_FIRST_VBLANK_DOT).toBe(144*456-2);expect(DISPLAY_FRAME_DOTS).toBe(154*456);
    expect(S.vblankAccept.vblankRequests).toEqual([DISPLAY_FIRST_VBLANK_DOT,DISPLAY_FIRST_VBLANK_DOT+DISPLAY_FRAME_DOTS]);
  });
});

describe('enabled-LCD timelines match the reference dot by dot',()=>{
  S.timeline.forEach((config,index)=>it(`config ${index}: LCDC ${config.lcdc.toString(16)} WY ${config.wy} WX ${config.wx} SCX ${config.scx} objects [${config.objects}]`,()=>{
    const clock=enabled({scx:config.scx,wy:config.wy,wx:config.wx,lcdcOn:config.lcdc,oam:oamOf(config.objects),mode0Enabled:true});
    const lyAtDot=new Map(config.ly.map(([d,v])=>[d,v])),modeAtDot=new Map(config.mode.map(([d,v])=>[d,v]));
    const wantIf:Pair[]=config.requests;
    const gotIf:Pair[]=[];let ly=-1,mode=-1,mismatches=0;
    clock.advance(CPU_STORE_TRAILING_DOTS);
    const last=CPU_STORE_TRAILING_DOTS+Math.floor(DISPLAY_FRAME_DOTS*2.5);   // the probe's observation horizon
    for(let dot=CPU_STORE_TRAILING_DOTS+1;dot<=last;dot++){
      clock.advance(1);
      const mask=replayIf(clock);if(mask)gotIf.push([dot,mask]);
      if(lyAtDot.has(dot))ly=lyAtDot.get(dot)!;
      if(modeAtDot.has(dot))mode=modeAtDot.get(dot)!;
      if(clock.readLy()!==ly||clock.readMode()!==mode)mismatches++;
    }
    expect(mismatches).toBe(0);
    expect(gotIf).toEqual(wantIf.filter(([d])=>d<=last));
  }));
});

describe('LCD off and on again',()=>{
  S.reenable.forEach((row,index)=>it(`row ${index}: disable after ${row.after} dots, off for ${row.gap}`,()=>{
    const clock=enabled({mode0Enabled:true});
    clock.advance(CPU_STORE_TRAILING_DOTS);clock.advance(row.after);
    expect([clock.readLy(),clock.readMode(),clock.pending&3]).toEqual(row.before);
    clock.advance((4-((CPU_STORE_TRAILING_DOTS+row.after)%4))%4);   // back onto the machine-cycle grid
    clock.advance(16);clock.writeLcdc(0x63);clock.advance(CPU_STORE_TRAILING_DOTS);
    expect([clock.readLy(),clock.readMode(),clock.pending&3]).toEqual(row.afterDisable);
    clock.advance(row.gap);
    expect([clock.readLy(),clock.readMode()]).toEqual(row.duringOff);
    clock.advance((4-(clock.elapsed%4))%4);clock.advance(16);clock.writeLcdc(0xe3);clock.advance(CPU_STORE_TRAILING_DOTS);
    expect(clock.pending&3).toBe(row.pendingAfterSecondEnable);
    clock.writePending(0);
    const written=clock.elapsed-CPU_STORE_TRAILING_DOTS;
    const seen:Pair[]=[];
    for(let i=0;i<70224;i++){
      clock.advance(1);const mask=replayIf(clock);if(mask)seen.push([clock.elapsed-written,mask]);
    }
    expect(seen.find(([,m])=>m&1)![0]).toBe(row.firstVBlank);
    expect(seen.filter(([,m])=>m&2).slice(0,2).map(([d])=>d)).toEqual(row.firstStat);
  }));
});

describe('STAT mode-0 select: request at the write, or at the natural edge',()=>{
  S.statscan.forEach((config,index)=>it(`immediate-request windows ${index}: SCX ${config.scx}, objects [${config.objects}]`,()=>{
    const clock=enabled({scx:config.scx,oam:oamOf(config.objects)});
    clock.advance(CPU_STORE_TRAILING_DOTS);
    const ranges:Pair[]=[];let active=false,start=0;
    for(let dot=CPU_STORE_TRAILING_DOTS+1;dot<=CPU_STORE_TRAILING_DOTS+70224*2;dot++){
      clock.advance(1);
      clock.writeMode0Select(true);const immediate=(clock.pending&INTRO_IF_STAT)!==0;
      clock.writeMode0Select(false);clock.writePending(0);
      if(immediate&&!active){start=dot;active=true;}
      if(!immediate&&active){ranges.push([start,dot-1]);active=false;}
    }
    if(active)ranges.push([start,CPU_STORE_TRAILING_DOTS+70224*2]);
    expect(ranges).toEqual(config.ranges);
  }));
  it('real CPU STAT stores across a frame: the reads at the write, the request on the store and the next natural edge',()=>{
    let raised=0,natural=0;
    for(const [nops,writeDot,ly,mode,ifAfter,next] of S.cpuStatWrite){
      const clock=enabled();
      clock.advance(CPU_STORE_TRAILING_DOTS+4*nops+16);              // the store's last machine cycle begins here
      clock.writeMode0Select(true);clock.advance(1);
      expect([clock.elapsed,clock.readLy(),clock.readMode()]).toEqual([writeDot,ly,mode]);
      clock.advance(CPU_STORE_TRAILING_DOTS-1);
      expect(clock.pending&INTRO_IF_STAT).toBe(ifAfter&INTRO_IF_STAT);
      clock.writePending(0);
      let after=0;
      for(let i=0;i<1200&&!after;i++){clock.advance(1);if(clock.pending&INTRO_IF_STAT)after=i+1;}
      expect(after).toBe(next);
      if(ifAfter&INTRO_IF_STAT)raised++;else natural++;
    }
    expect(raised).toBeGreaterThan(400);expect(natural).toBeGreaterThan(400);
  });
});

describe('STAT stores at exact dots around the mode-0 edge',()=>{
  S.statEdge.cleared.forEach(row=>it(`select written at dot ${row.dot}`,()=>{
    const clock=enabled();clock.advance(row.dot);
    expect([clock.readMode(),clock.pending&3]).toEqual([row.mode,row.pre]);
    clock.writeMode0Select(true);
    expect(clock.pending&3).toBe(row.immediate);
    clock.writePending(0);
    let next=0;for(let i=0;i<1400&&!next;i++){clock.advance(1);if(clock.pending&INTRO_IF_STAT)next=i+1;}
    expect(next).toBe(row.nextAfterWrite);        // a request raised by the write is not raised a second time at the edge
  }));
  S.statEdge.repeated.forEach(row=>it(`$08 rewritten over $08 at dot ${row.dot}`,()=>{
    const clock=enabled({mode0Enabled:true});clock.advance(CPU_STORE_TRAILING_DOTS);
    let first=0;
    for(let dot=CPU_STORE_TRAILING_DOTS+1;dot<=2000&&!first;dot++){
      clock.advance(1);
      if(dot===row.dot)clock.writeMode0Select(true);
      if(clock.pending&INTRO_IF_STAT)first=dot;
    }
    expect(first).toBe(row.firstIf);
  }));
});

describe('instruction-boundary acceptance and the per-line profile',()=>{
  const unsupportedLine=(c:ProfileCase,line:number)=>line>0&&Boolean(c.lcdc&0x20&&c.wy<=143&&line>=c.wy&&c.wx<=166&&
    selectedObjectXs(c.lcdc,oamOf(c.objects),line).length);
  S.profile.cases.forEach((c,index)=>it(`fuzz ${index}: SCX ${c.scx} LCDC ${c.lcdc.toString(16)} WY ${c.wy} WX ${c.wx} objects ${c.objects.length}`,()=>{
    const make=()=>enabled({scx:c.scx,wy:c.wy,wx:c.wx,lcdcOn:c.lcdc,oam:oamOf(c.objects),mode0Enabled:true});
    const refused=[...Array(14).keys()].some(line=>unsupportedLine(c,line));
    if(refused){
      const clock=make();
      expect(()=>{for(let i=0;i<6700;i++)clock.advance(1);}).toThrow(RangeError);
      return;
    }
    const stepper=make();const requests:number[]=[];
    stepper.advance(CPU_STORE_TRAILING_DOTS);
    for(let dot=CPU_STORE_TRAILING_DOTS+1;requests.length<14&&dot<=CPU_STORE_TRAILING_DOTS+456*16;dot++){stepper.advance(1);if(replayIf(stepper))requests.push(dot);}
    expect(requests).toEqual(c.requests);
    const cpu=make();const boundaries:number[]=[];
    cpu.advance(CPU_STORE_TRAILING_DOTS);                              // first boundary: the store instruction's end
    for(let at=CPU_STORE_TRAILING_DOTS;boundaries.length<14&&at<400000;){
      if(cpu.takeInterrupt(INTRO_IF_STAT)===INTRO_IF_STAT){boundaries.push(at);cpu.advance(5*INTRO_DOTS_PER_CYCLE);at+=5*INTRO_DOTS_PER_CYCLE;}
      else{cpu.advance(INTRO_DOTS_PER_CYCLE);at+=INTRO_DOTS_PER_CYCLE;}
    }
    expect(boundaries).toEqual(c.dispatchBoundaries);
  }));
  it('the fuzz exercised both accepted profiles and refused window-with-object states',()=>{
    const refused=S.profile.cases.filter(c=>[...Array(14).keys()].some(line=>unsupportedLine(c,line))).length;
    expect(refused).toBeGreaterThan(5);expect(S.profile.cases.length-refused).toBeGreaterThan(100);
    expect(S.profile.checkedLines).toBeGreaterThan(1500);
  });
  it('VBlank is accepted at the first boundary at or after its request (65664 for a request at 65662)',()=>{
    const clock=enabled();clock.advance(CPU_STORE_TRAILING_DOTS);
    let at=CPU_STORE_TRAILING_DOTS,found=0;
    while(at<70000&&!found){if(clock.takeInterrupt(INTRO_IF_VBLANK)===INTRO_IF_VBLANK)found=at;else{clock.advance(4);at+=4;}}
    expect(found).toBe(S.vblankAccept.firstDispatchBoundary);
  });
  it('a request exactly on a boundary is taken there; one dot earlier it is not yet pending',()=>{
    const clock=enabled({mode0Enabled:true});clock.advance(252);expect(clock.takeInterrupt(INTRO_IF_STAT)).toBe(INTRO_IF_STAT);
    const early=enabled({mode0Enabled:true});early.advance(251);expect(early.takeInterrupt(INTRO_IF_STAT)).toBeNull();
    early.advance(1);expect(early.pending).toBe(INTRO_IF_STAT);
  });
});

describe('object and window arithmetic',()=>{
  it('reproduces the independent 320 static one-dot cases from note 128',()=>{
    expect(calibration.cases).toHaveLength(320);
    for(const c of calibration.cases){
      const oam=oamOf(c.oamX.map(String));
      const extra=(c.scx&7)+introObjectExtraDots(c.scx,0xe3,oam,8);
      expect(252+extra).toBe(c.line8VBlankRelativeDots);
    }
  });
  it('first-ten selection takes OAM order before the off-right cut and 8x16 doubles the Y span',()=>{
    const oam=oamOf([...Array(10).fill('255:24'),'40:24']);
    expect(selectedObjectXs(0xe3,oam,8)).toEqual(Array(10).fill(255));
    expect(introObjectExtraDots(0,0xe3,oam,8)).toBe(0);
    expect(selectedObjectXs(0xe3,oamOf(['40:16']),8)).toEqual([]);
    expect(selectedObjectXs(0xe7,oamOf(['40:16']),8)).toEqual([40]);
  });
  it('a triggered window adds six dots (seven at WX 0 with a fine scroll) and refuses selected objects',()=>{
    const base={scx:0,wy:5,wx:7,lcdc:0xe3,oam:new Uint8Array(INTRO_OAM_BYTES)};
    expect(introLineExtraDots(base,4)).toBe(0);expect(introLineExtraDots(base,5)).toBe(6);
    expect(introLineExtraDots({...base,wx:0,scx:3},9)).toBe(3+7);expect(introLineExtraDots({...base,wx:166},9)).toBe(0);
    expect(introLineExtraDots({...base,wx:167},9)).toBe(0);expect(introLineExtraDots({...base,lcdc:0xc3},9)).toBe(0);
    expect(()=>introLineExtraDots({...base,oam:oamOf(['40:24'])},8)).toThrow(RangeError);
  });
  it('lyAt places LY 144 three dots before VBlank, 153 for six dots and 0 afterwards',()=>{
    expect([lyAt(451),lyAt(452),lyAt(65658),lyAt(65659),lyAt(69763),lyAt(69768),lyAt(69769),lyAt(DISPLAY_FRAME_DOTS+452)])
      .toEqual([0,1,143,144,153,153,0,1]);
  });
});

describe('register writes and OAM DMAs between lines',()=>{
  const horizon=CPU_STORE_TRAILING_DOTS+DISPLAY_FRAME_DOTS*2;
  S.dynamic.cpu.forEach((c,index)=>it(`SCX/WY write ${index}: SCX ${c.scx} WY ${c.wy} at dot ${c.dot}`,()=>{
    const clock=enabled({oam:oamOf(c.objects),mode0Enabled:true});
    const requests:number[]=[];let refused=false;
    clock.advance(CPU_STORE_TRAILING_DOTS);
    for(let dot=CPU_STORE_TRAILING_DOTS+1;dot<=horizon&&!refused;dot++){
      clock.advance(1);
      if(dot===c.dot){try{clock.writeScx(c.scx);clock.writeWy(c.wy);}catch(error){expect(error).toBeInstanceOf(RangeError);refused=true;}}
      if(replayIf(clock)&INTRO_IF_STAT)requests.push(dot);
    }
    // An accepted write reproduces the reference's following frames exactly. A refused one sits inside a visible line's
    // mode 2/3 (the guard is conservative, never permissive: it must never refuse in VBlank or hblank before the scan).
    if(refused)expect([c.dot>=1821&&c.dot<=1900,c.dot>=70221&&c.dot<=70500].some(Boolean)).toBe(true);
    else expect(requests).toEqual(c.requests.filter(d=>d<=horizon));
  }));
  S.dynamic.dma.forEach((c,index)=>it(`OAM DMA ${index}: started at ${c.dot}, done ${c.done}`,()=>{
    const clock=enabled({oam:oamOf(c.initial),mode0Enabled:true});
    const requests:number[]=[];let refused=false;
    clock.advance(CPU_STORE_TRAILING_DOTS);
    for(let dot=CPU_STORE_TRAILING_DOTS+1;dot<=horizon&&!refused;dot++){
      clock.advance(1);
      if(dot===c.done){try{clock.latchOam(oamOf(c.new),c.done-c.started);}catch(error){expect(error).toBeInstanceOf(RangeError);refused=true;}}
      if(replayIf(clock)&INTRO_IF_STAT)requests.push(dot);
    }
    if(refused)expect(c.dot===100||c.dot===3000||(c.dot>=69572&&c.dot<=70100)).toBe(true);   // overlaps or comes within 12 dots of a scan
    else expect(requests).toEqual(c.requests.filter(d=>d<=horizon));
  }));
  it('the DMA guard is conservative: it refuses only near a scan and accepts one that ends 12 dots before the scan',()=>{
    const accepted=S.dynamic.dma.filter(c=>c.dot>=65700&&c.dot<=69556).length;
    expect(accepted).toBe(6);
    const probe=(dot:number)=>{const clock=enabled();clock.advance(dot);try{clock.latchOam(oamOf(['40:24']));return true;}catch{return false;}};
    expect([probe(65700+642),probe(70221-12),probe(70221-11),probe(70221+100)]).toEqual([true,true,false,false]);
  });
  it('refuses exactly the visible-line scan and fetch span for registers, and allows the dot before it',()=>{
    const probe=(dot:number)=>{const clock=enabled();clock.advance(dot);try{clock.writeScx(1);return true;}catch{return false;}};
    expect([probe(1816),probe(1820),probe(1821),probe(1900),probe(1616),probe(1617)]).toEqual([true,true,false,false,false,true]);
  });
  it('copies its input registers and OAM instead of aliasing them',()=>{
    // Line 8 is the only line the object (Y 24) touches: its request is 11 dots later with the object than without.
    const toLine8=(c:IntroDisplayClock,from:number)=>{c.advance(250+456*8-6-from);c.writePending(0);return c.dotsUntilRequest(INTRO_IF_STAT);};
    const oam=oamOf(['40:24']);
    const clock=enabled({oam,mode0Enabled:true});
    oam[1]=200;                                              // the caller's later edit must not reach the clock
    expect(toLine8(clock,0)).toBe(6+11);
    const next=oamOf(['40:24']);
    const latched=enabled({mode0Enabled:true});latched.advance(DISPLAY_FIRST_VBLANK_DOT+800);latched.latchOam(next);next[1]=200;
    expect(toLine8(latched,DISPLAY_FIRST_VBLANK_DOT+800-DISPLAY_FRAME_DOTS)).toBe(6+11);
  });
});

describe('interface behaviour',()=>{
  it('keeps IF across LCD off, drops the STAT level, and raises nothing while off',()=>{
    const clock=enabled({mode0Enabled:true});clock.advance(300);expect(clock.pending).toBe(INTRO_IF_STAT);
    clock.writeLcdc(0x63);clock.advance(5000);expect(clock.pending).toBe(INTRO_IF_STAT);
    expect([clock.lcdOn,clock.readLy(),clock.readMode()]).toEqual([false,0,0]);
    expect(clock.dotsUntilRequest(3)).toBe(0);clock.writePending(0);expect(clock.dotsUntilRequest(3)).toBeNull();
  });
  it('acknowledges the higher-priority VBlank first and leaves a masked request pending',()=>{
    const clock=new IntroDisplayClock(regs({pending:3}));
    expect(clock.takeInterrupt(3,false)).toBeNull();
    expect(clock.takeInterrupt(3)).toBe(INTRO_IF_VBLANK);expect(clock.pending).toBe(INTRO_IF_STAT);   // both pending: VBlank first
    expect(clock.takeInterrupt(1)).toBeNull();expect(clock.takeInterrupt(2)).toBe(INTRO_IF_STAT);expect(clock.pending).toBe(0);
  });
  it('predicts a halted CPU wake-up without moving the clock',()=>{
    const clock=enabled({mode0Enabled:true});clock.advance(CPU_STORE_TRAILING_DOTS);
    expect(clock.dotsUntilRequest(INTRO_IF_STAT)).toBe(252-CPU_STORE_TRAILING_DOTS);
    expect(clock.elapsed).toBe(CPU_STORE_TRAILING_DOTS);
    expect(clock.dotsUntilRequest(INTRO_IF_VBLANK)).toBe(DISPLAY_FIRST_VBLANK_DOT-CPU_STORE_TRAILING_DOTS);
    expect(enabled().dotsUntilRequest(INTRO_IF_STAT)).toBeNull();
  });
  it('turns a profile change inside a visible line into an error and accepts one in VBlank or while off',()=>{
    const clock=enabled();clock.advance(100);
    expect(()=>clock.writeScx(4)).toThrow(RangeError);
    expect(()=>clock.latchOam(new Uint8Array(INTRO_OAM_BYTES))).toThrow(RangeError);
    clock.advance(DISPLAY_FIRST_VBLANK_DOT+800-100);
    clock.writeScx(4);clock.latchOam(oamOf(['40:24']));clock.writeWy(10);clock.writeWx(0);
    clock.writeLcdc(0x63);clock.writeScx(0);
  });
  it('rejects states the reference was not measured in',()=>{
    expect(()=>new IntroDisplayClock(regs({lcdc:0xe1}))).toThrow(RangeError);
    expect(()=>new IntroDisplayClock(regs({lcdc:0xe2}))).toThrow(RangeError);
    expect(()=>new IntroDisplayClock(regs({oam:new Uint8Array(8)}))).toThrow(RangeError);
    expect(()=>new IntroDisplayClock(regs({scx:256}))).toThrow(RangeError);
    expect(()=>new IntroDisplayClock(regs()).advance(-1)).toThrow(RangeError);
    expect(()=>new IntroDisplayClock(regs()).advance(0.5)).toThrow(RangeError);
  });
});
