import {expect,it} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {IntroMovieClock,INTRO_FRAME_CYCLES as FRAME,INTRO_VBLANK_CYCLE as VB} from './intro_movie_clock';
import {IntroObjectEngine} from './intro_objects';
import {introObjectCpuSteps} from './intro_object_cpu_timing';
import {OpeningScreen} from './opening_screen';
import {audioJson,rig} from '../test/audio_rig';
import type {MusicData} from '../audio/music_engine';
import {timedIntroMusicUpdate} from '../audio/intro_music_timing';
import type {YellowIntroData} from '../rom/extractors/yellow_intro';
const data:YellowIntroData=JSON.parse(readFileSync(resolve(__dirname,'../../data/yellow_intro.json'),'utf8'));
const song=audioJson<MusicData>('music/yellowintro.json');
interface Slice {
  phase:number;lcdOn:boolean;mode0Enabled:boolean;pending:number;enabled:number;songUpdates:number;
  objects:string;registers:string;initialOam:string;scene:number;work:number;endPhase:number;endPending:number;
  full:boolean;finalOam:string;elapsed:number;interrupts:number;interruptDigest:string;
  vblanks:{at:number;duration:number;audioCost:number;otherCost:number;oam:string}[];
}
const native:{histories:{name:string;calls:string[]}[];cases:Record<string,Slice>}=JSON.parse(readFileSync(
  resolve(__dirname,'__fixtures__/intro_movie_clock_oracle.json'),'utf8'));
const bytes=(hex:string)=>Uint8Array.from(Buffer.from(hex,'hex'));
const hex=(raw:Uint8Array)=>Buffer.from(raw).toString('hex');
// Explicit input from the preserved native probe, NOT a default or general hardware PPU claim.
const MODE0=Array<number>(144).fill(63);
const newClock=(phase=0,mode0Enabled=true,pending=0,lcdOn=true)=>new IntroMovieClock({phase,mode0Enabled,pending,lcdOn,mode0Cycles:MODE0});

for(const history of native.histories) it(`composes native object instructions and real music timing: ${history.name}`,()=>{
  let slices=0, musicUpdates=0, digestMatches=true, finalMatches=true, bodyMatches=true, writerMatches=true;
  const {music}=rig(song);
  for(const id of history.calls){
    const row=native.cases[id];
    while(musicUpdates<row.songUpdates){music.tick();musicUpdates++;}
    if(musicUpdates!==row.songUpdates)throw new Error('Native music history moved backward');
    const clock=new IntroMovieClock({...row,mode0Cycles:MODE0}), screen=new OpeningScreen(), engine=new IntroObjectEngine(data);
    engine.objects.set(bytes(row.objects));engine.registers.set(bytes(row.registers));screen.oam.set(bytes(row.initialOam));
    // Both streams are primed from the same input before the semantic writer first resumes.
    const timing=introObjectCpuSteps(engine.objects,engine.registers[1],data,row.scene);
    let step=timing.next();const writer=engine.runWrites(screen.oam,row.scene);
    const events:[number,number,number][]=[];let vblank=0,work=0;
    const service=():void=>{
      let kind=clock.takeInterrupt(row.enabled);
      while(kind!==null){
        const at=clock.elapsed;clock.advance(5); // dispatch is outside both the object and music routine
        if(kind===1){
          const expected=row.vblanks[vblank++];
          expect(expected, 'unexpected VBlank service').toBeDefined();
          bodyMatches &&= !!expected && expected.at===at && hex(screen.oam)===expected.oam;
          screen.vblank(); // no CPU object writes occur during this handler's DMA/audio work
          const shown=screen.shownOam;
          const cost=timedIntroMusicUpdate(music,song,clock);musicUpdates++;
          bodyMatches &&= cost===expected.audioCost;
          // Explicit test input: the native remainder of THIS handler. No runtime remainder model is claimed.
          clock.advance(expected.otherCost);
          bodyMatches &&= hex(screen.shownOam)===hex(shown);
        }else clock.advance(22); // zero-pointer LCDC body + vector JP, through RETI; excludes dispatch
        events.push([kind,at,clock.elapsed-at]);
        kind=clock.takeInterrupt(row.enabled);
      }
    };
    while(!step.done){
      service();clock.advance(step.value.cycles);work+=step.value.cycles;
      if(step.value.store)writerMatches &&= !writer.next().done;
      step=timing.next();
    }
    service(); // the native observer accepts pending interrupts before observing the caller's return PC
    const result=writer.next();writerMatches &&= !!result.done && result.value===step.value;
    digestMatches &&= createHash('sha256').update(JSON.stringify(events)).digest('hex')===row.interruptDigest;
    finalMatches &&= work===row.work && clock.elapsed===row.elapsed && clock.phase===row.endPhase &&
      clock.pending===row.endPending && step.value===row.full && hex(screen.oam)===row.finalOam &&
      events.length===row.interrupts && vblank===row.vblanks.length;
    slices++;
  }
  expect([slices,digestMatches,finalMatches,bodyMatches,writerMatches]).toEqual([history.calls.length,true,true,true,true]);
});

it('requests VBlank at the edge and not twice when starting exactly on it',()=>{
  const c=newClock(VB-1,false);c.advance(0);expect(c.pending).toBe(0);c.advance(1);expect(c.pending).toBe(1);
  expect(c.takeInterrupt(3)).toBe(1);c.advance(1);expect(c.pending).toBe(0);
  c.advance(FRAME-1);expect(c.pending).toBe(1);
});
it('requests mode 0 only on visible lines, including line 143',()=>{
  const c=newClock(62);c.advance(1);expect(c.pending).toBe(2);c.writePending(0);
  c.advance(114);expect(c.pending).toBe(2);c.writePending(0);
  const last=newClock(143*114+62);last.advance(1);expect(last.pending).toBe(2);last.writePending(0);
  last.advance(FRAME-last.phase+62);expect(last.pending).toBe(1);last.writePending(0);
  last.advance(1);expect(last.pending).toBe(2);
});
it('coalesces requests during masked handler work and prioritizes VBlank',()=>{
  const c=newClock(0);c.advance(FRAME*3+64);expect(c.pending).toBe(3);
  expect(c.takeInterrupt(3,false)).toBeNull();expect(c.pending).toBe(3);
  expect(c.takeInterrupt(2)).toBe(2);expect(c.pending).toBe(1);
  c.writePending(3);expect(c.takeInterrupt(3)).toBe(1);expect(c.takeInterrupt(3)).toBe(2);expect(c.takeInterrupt(3)).toBeNull();
});
it('does not charge implicit dispatch or handler time when acknowledging a request',()=>{
  const c=newClock(123,false,3);expect(c.takeInterrupt(1)).toBe(1);expect([c.elapsed,c.phase,c.pending]).toEqual([0,123,2]);
});
it('LCD off stops PPU requests, preserves pending flags and resets phase only on re-enable',()=>{
  const c=newClock(90,true,2);c.setLcd(false);c.advance(FRAME*2);
  expect([c.phase,c.elapsed,c.pending,c.lcdOn]).toEqual([90,FRAME*2,2,false]);
  c.setLcd(true);expect(c.phase).toBe(0);c.advance(10);c.setLcd(true);expect(c.phase).toBe(10);
});
it('disabling mode 0 changes future requests without discarding pending STAT',()=>{
  const c=newClock(63,true,2);c.setMode0Enabled(false);expect(c.pending).toBe(2);c.writePending(0);
  c.advance(114);expect(c.pending).toBe(0);c.setMode0Enabled(true);c.advance(114);expect(c.pending).toBe(2);
});
it('exposes exact waits for enabled requests without advancing or synthesizing a HALT wake cycle',()=>{
  const c=newClock(60);expect(c.cyclesUntilRequest(0)).toBeNull();expect(c.cyclesUntilRequest(2)).toBe(3);
  expect(c.cyclesUntilRequest(1)).toBe(VB-60);expect(c.elapsed).toBe(0);c.advance(3);
  expect(c.cyclesUntilRequest(2)).toBe(0);c.setLcd(false);expect(c.cyclesUntilRequest(1)).toBeNull();
});
it('supports long safe integer advances without losing the modulo phase',()=>{
  const c=newClock(123);c.advance(Number.MAX_SAFE_INTEGER);expect(c.phase).toBe((123+Number.MAX_SAFE_INTEGER%FRAME)%FRAME);
  expect(c.pending).toBe(3);expect(()=>c.advance(1)).toThrow(RangeError);
});
it('rejects invalid cycle durations and LCD phases',()=>{
  for(const value of [-1,0.5,Infinity,NaN])expect(()=>newClock().advance(value)).toThrow(RangeError);
  for(const phase of [-1,FRAME,0.5,Infinity,NaN])expect(()=>newClock(phase)).toThrow(RangeError);
});
it('uses a snapshotted caller-supplied per-line edge profile, with no implicit mode-0 duration',()=>{
  const edges=Array<number>(144).fill(80);edges[0]=60;edges[1]=70;
  const c=new IntroMovieClock({phase:59,mode0Enabled:true,pending:0,lcdOn:true,mode0Cycles:edges});
  edges[0]=90;c.advance(1);expect(c.pending).toBe(2);c.writePending(0);
  c.advance(114+69-60);expect(c.pending).toBe(0);c.advance(1);expect(c.pending).toBe(2);
  for(const profile of [[],Array<number>(144),Array<number>(143).fill(60),Array<number>(144).fill(114),Array<number>(144).fill(NaN)])
    expect(()=>new IntroMovieClock({phase:0,mode0Enabled:true,pending:0,lcdOn:true,mode0Cycles:profile})).toThrow(RangeError);
});
it('keeps the clock and movie-audio composition unused by the game',()=>{
  const root=resolve(__dirname,'..'),owners:string[]=[];
  function walk(folder:string):void{for(const e of readdirSync(folder,{withFileTypes:true})){
    const p=resolve(folder,e.name);if(e.isDirectory())walk(p);
    else if(e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')&&/intro_movie_clock|IntroMovieClock|intro_music_timing|timedIntroMusicUpdate|intro_entry_audio|IntroEntryAudio/.test(readFileSync(p,'utf8')))
      owners.push(relative(root,p).replace(/\\/g,'/'));
  }}
  walk(root);expect(owners.sort()).toEqual(['audio/intro_entry_audio.ts','audio/intro_music_timing.ts','menus/intro_movie_clock.ts']);
});
