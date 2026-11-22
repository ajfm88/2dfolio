import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {introLcdcSteps,introVBlankSteps,type IntroHandlerStep,type IntroVBlankInputs} from './intro_handler_timing';
import {IntroDisplayClock,INTRO_IF_VBLANK,INTRO_OAM_BYTES} from './intro_display_clock';
import {IntroCpu} from './intro_cpu';

// Independent evidence: notes/131-opening-checkpoint-12b2c2-2b/handler-research.json, captured by run-handler-research.py
// from the pinned SameBoy Core running the user's own cartridge (SHA1-checked) with pret's symbols, over seven input
// histories of the whole movie window. The fixture is a byte copy; no game code produced it. Dots count from the end of
// the dispatch (the vector's `jp`); stores are at their write's effect.
type Row=[number,number,number[],number[],[number,number][],[number,number],number];
interface Reference{
  routineSequence:string[];storeOrder:string[];inputOrder:string[];constantInputs:Record<string,number>;
  histories:Record<string,{args:string[];rows:Row[];lcdc:[number,number,number,number][]}>;
}
const ref:Reference=JSON.parse(readFileSync(resolve(__dirname,'__fixtures__/intro_handler_reference.json'),'utf8'));
const KEYS:(keyof IntroVBlankInputs)[]=['wDisableVBlankWYUpdate','hAutoBGTransferEnabled','hAutoBGTransferPortion',
  'hVBlankCopyBGSource','hRedrawRowOrColumnMode','hVBlankCopySize','hVBlankCopyDoubleSize','hTileAnimations',
  'wUpdateSpritesEnabled','wIgnoreInputCounter','wStatusFlags5','wReachedMaxInGameTime','wStatusFlags6',
  'hDisableJoypadPolling','hVBlankOccurred','hFrameCounter','wAudioFadeOutControl','wStatusFlags2','wLowHealthAlarm',
  'wPrinterConnectionOpen'];
function inputsOf(row:Row):IntroVBlankInputs{
  const all:Record<string,number>={...ref.constantInputs};
  ref.inputOrder.forEach((key,i)=>{all[key]=row[2][i];});
  return Object.fromEntries(KEYS.map(k=>[k,all[k]])) as unknown as IntroVBlankInputs;
}
const audioOf=(row:Row)=>(row[5][1]-row[5][0])/4;
/** Walk a stream: routine entry dots, store effect dots (four before the step's end), RETI start and end. */
function walk(steps:Iterable<IntroHandlerStep>){
  let t=0;const routines:[string,number][]=[],stores:[string,number][]=[];let reti=-1;
  for(const step of steps){
    if(step.routine)routines.push([step.routine,t]);
    if(step.store)stores.push([step.store,t+step.cycles*4-4]);
    if(step.reti)reti=t;
    t+=step.cycles*4;
  }
  return {routines,stores,reti,end:t};
}
const base=():IntroVBlankInputs=>inputsOf(ref.histories.normal.rows[0]);

describe('the VBlank stream matches every cartridge service in the movie window',()=>{
  it.each(Object.entries(ref.histories).map(([name,h])=>[name,h.rows.length,h] as const))('%s: %i services',(_name,_count,history)=>{
    for(const [index,row] of history.rows.entries()){
      const got=walk(introVBlankSteps(inputsOf(row),audioOf(row)));
      const want={routines:ref.routineSequence.map((name,i)=>[name,row[3][i]]),stores:ref.storeOrder.map((name,i)=>[name,row[4][i][1]]),
        audio:row[5],reti:row[6]};
      const audio=got.routines.find(r=>r[0]==='Audio1_UpdateMusic')![1];
      expect({routines:got.routines,stores:got.stores,audio:[audio,audio+audioOf(row)*4],reti:got.reti},`service ${index}`).toEqual(want);
      expect(got.end).toBe(row[6]+16);
    }
  });
  it('the fixture spans every branch the stream ports',()=>{
    const rows=Object.values(ref.histories).flatMap(h=>h.rows),inputs=rows.map(inputsOf);
    for(const portion of [0,1,2])expect(inputs.some(i=>i.hAutoBGTransferEnabled&&i.hAutoBGTransferPortion===portion)).toBe(true);
    expect(inputs.some(i=>!i.hAutoBGTransferEnabled)).toBe(true);
    for(const size of [0,7,8])expect(inputs.some(i=>i.hVBlankCopySize===size)).toBe(true);
    for(const counter of [0,1,2,255])expect(inputs.some(i=>i.wIgnoreInputCounter===counter)).toBe(true);
    for(const flag of [0,1])expect(inputs.some(i=>i.hVBlankOccurred===flag)).toBe(true);
    expect(inputs.some(i=>i.hFrameCounter===0)).toBe(true);expect(inputs.some(i=>i.hFrameCounter>0)).toBe(true);
    expect(new Set(rows.map(audioOf)).size).toBeGreaterThan(20);
    expect(Math.min(...rows.map(audioOf))).toBe(165);
  });
});

describe('the LCDC stream',()=>{
  it('jp LCDC, then 18 cycles from the label through RETI, for every cartridge service',()=>{
    const got=walk(introLcdcSteps(0));
    expect(got.routines).toEqual([['LCDC',16]]);expect(got.stores).toEqual([]);expect(got.end-16).toBe(72);expect(got.reti).toBe(got.end-16);
    for(const h of Object.values(ref.histories))for(const [dispatch,handler,pointer] of h.lcdc){
      expect([20,24]).toContain(dispatch);expect(handler).toBe(got.end-16);expect(pointer).toBe(0);
    }
    expect(5*4+got.end).toBe(27*4);                           // dispatch + jp + handler: 27 machine cycles
  });
  it('refuses a non-zero pointer or a non-byte',()=>{
    for(const v of [1,0xff,256,-1,0.5])expect(()=>[...introLcdcSteps(v)]).toThrow(RangeError);
  });
});

describe('the model',()=>{
  it('refuses every branch the cartridge never takes in the movie, before yielding anything',()=>{
    const cases:[keyof IntroVBlankInputs,number][]=[
      ['wDisableVBlankWYUpdate',1],['hVBlankCopyBGSource',1],['hRedrawRowOrColumnMode',1],['hRedrawRowOrColumnMode',2],
      ['hVBlankCopyDoubleSize',1],['hTileAnimations',1],['wUpdateSpritesEnabled',0],['wUpdateSpritesEnabled',1],
      ['wReachedMaxInGameTime',1],['wStatusFlags6',1],['hDisableJoypadPolling',1],['wAudioFadeOutControl',1],
      ['wStatusFlags2',2],['wLowHealthAlarm',0x80],['wLowHealthAlarm',0xff],['wPrinterConnectionOpen',1]];
    for(const [key,value] of cases){
      const g=introVBlankSteps({...base(),[key]:value},165);
      expect(()=>g.next(),`${key}=${value}`).toThrow(RangeError);
    }
    const joypad=introVBlankSteps({...base(),wIgnoreInputCounter:1,wStatusFlags5:1<<5},165);
    expect(()=>joypad.next()).toThrow(RangeError);
    // the bits the stream does not test are accepted: flags5 without the joypad bit, flags6/flags2 other bits
    expect(()=>[...introVBlankSteps({...base(),wIgnoreInputCounter:1,wStatusFlags5:0x06,wStatusFlags6:2,wStatusFlags2:1},165)]).not.toThrow();
  });
  it('validates bytes and the audio cost',()=>{
    for(const v of [256,-1,1.5,NaN])expect(()=>introVBlankSteps({...base(),hFrameCounter:v},165).next()).toThrow(RangeError);
    for(const a of [0,-4,1.5,NaN,Infinity])expect(()=>introVBlankSteps(base(),a).next()).toThrow(RangeError);
    for(const key of KEYS){const partial:Partial<IntroVBlankInputs>={...base()};delete partial[key];
      expect(()=>introVBlankSteps(partial as IntroVBlankInputs,165).next(),key).toThrow(RangeError);}
  });
  it('copies its inputs at the first step and never mutates them; interleaved streams are independent',()=>{
    const rows=ref.histories.normal.rows,a=inputsOf(rows[0]),b=inputsOf(rows[5]),frozen={...a};
    const ga=introVBlankSteps(a,audioOf(rows[0]))[Symbol.iterator](),gb=introVBlankSteps(b,audioOf(rows[5]))[Symbol.iterator]();
    const sa:IntroHandlerStep[]=[],sb:IntroHandlerStep[]=[];
    let ra=ga.next(),rb=gb.next();a.hVBlankCopySize=99;
    while(!ra.done||!rb.done){if(!ra.done){sa.push(ra.value);ra=ga.next();}if(!rb.done){sb.push(rb.value);rb=gb.next();}}
    expect(a.hVBlankCopySize).toBe(99);a.hVBlankCopySize=frozen.hVBlankCopySize;expect(a).toEqual(frozen);
    expect(walk(sa)).toEqual(walk(introVBlankSteps(inputsOf(rows[0]),audioOf(rows[0]))));
    expect(walk(sb)).toEqual(walk(introVBlankSteps(inputsOf(rows[5]),audioOf(rows[5]))));
  });
  it('each step is one instruction (1-6 cycles) except the audio callee; one RETI, last',()=>{
    const row=ref.histories.normal.rows[0],steps=[...introVBlankSteps(inputsOf(row),audioOf(row))];
    for(const step of steps)if(step.routine!=='Audio1_UpdateMusic'){expect(step.cycles).toBeGreaterThanOrEqual(1);expect(step.cycles).toBeLessThanOrEqual(6);}
    expect(steps.filter(s=>s.reti)).toEqual([steps[steps.length-1]]);expect(steps[steps.length-1].cycles).toBe(4);
  });
});

describe('composition with the reviewed CPU and display clock',()=>{
  it('the sample covers both dispatch lengths and a service that runs past line 153',()=>{
    const rows=[0,1,7,100,300].map(i=>ref.histories.normal.rows[i]),all=Object.values(ref.histories).flatMap(h=>h.rows);
    expect(new Set(all.map(r=>r[0]))).toEqual(new Set([20,24]));expect(rows.some(r=>r[0]===24)).toBe(true);
    expect(rows.some(r=>65664+r[6]>70224-3)).toBe(true);
  });
  it.each([0,1,7,100,300,...[ref.histories.normal.rows.findIndex(r=>r[0]===20)]].map(i=>[i] as const))('normal service %i run through IntroCpu ends where the cartridge ends',(index)=>{
    const row=ref.histories.normal.rows[index];
    const display=new IntroDisplayClock({scx:0,wy:144,wx:7,lcdc:0xe3,oam:new Uint8Array(INTRO_OAM_BYTES),mode0Enabled:false,pending:0});
    const cpu=new IntroCpu(display,{ie:INTRO_IF_VBLANK,ime:true});
    display.advance(65640);                                   // halted: the 24-dot wake dispatch; running NOPs: 20
    if(row[0]===24)expect(cpu.halt()).toBe('woke');else while(display.pending===0)cpu.exec(1);
    const start=cpu.elapsed;expect(cpu.interrupt()).toBe(INTRO_IF_VBLANK);expect(cpu.elapsed-start).toBe(row[0]);
    const from=cpu.elapsed,storeDots:number[]=[];
    for(const step of introVBlankSteps(inputsOf(row),audioOf(row))){
      if(step.reti){expect(cpu.elapsed-from).toBe(row[6]);cpu.reti();break;}
      // the display stores land in VBlank (mode 1); NR50 may not: a long service runs into the next frame's line 0
      const effect=step.store?()=>{storeDots.push(cpu.elapsed-from);if(step.store!=='nr50')expect(display.readMode()).toBe(1);}:undefined;
      // the audio callee is one owner-supplied block, not an instruction: IntroCpu takes one cycle, the clock the rest
      cpu.exec(step.cycles>6?1:step.cycles,effect);
      if(step.cycles>6)display.advance((step.cycles-1)*4);
    }
    expect(storeDots).toEqual(row[4].map(s=>s[1]));
    expect(cpu.elapsed-from).toBe(row[6]+16);expect(cpu.ime).toBe(true);
  });
});

it('keeps the handler streams unused by the game',()=>{
  const root=resolve(__dirname,'..'),owners:string[]=[];
  function walkDir(folder:string):void{for(const e of readdirSync(folder,{withFileTypes:true})){
    const p=resolve(folder,e.name);if(e.isDirectory())walkDir(p);
    else if(e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')&&/intro_handler_timing|introVBlankSteps|introLcdcSteps/.test(readFileSync(p,'utf8')))
      owners.push(relative(root,p).replace(/\\/g,'/'));
  }}
  walkDir(root);expect(owners).toEqual(['menus/intro_handler_timing.ts']);
});
