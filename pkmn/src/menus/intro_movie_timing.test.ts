import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import type {YellowIntroData} from '../rom/extractors/yellow_intro';
import type {IntroForegroundStep,IntroHelperInsn,IntroHelperReply,IntroHelperSources} from './intro_helper_timing';
import {
  INTRO_DMG_PALETTE_STORE_TRAILING_DOTS,introMovieDispatchSteps,introMovieEntrySteps,introMovieExitSteps,
  introMovieLoopHeadSteps,introMovieLoopTailSteps,introObjectAnimationSteps,type IntroMovieEntryInput,type IntroMovieTables,
} from './intro_movie_timing';

// Note 138 (2c3a). The reference is the cartridge itself: notes/138-opening-checkpoint-12b2c2-2c3/extract-reference.py
// cut PlayIntroScene's deep transcripts (pinned SameBoy CGB-E, the user's ROM) into windows: entry, one loop iteration
// per scene branch, both exits. Each window is replayed into the streams: every read is answered with the value the
// cartridge read at that instruction, a HALT is 'retry' where the cartridge ran it twice, and each audio callee and
// GDMA stall carries the cartridge's cost. The streams must then reproduce the window character for character.
interface Case {history:string;window:number;seq:string;audio:number[];gdma:number[];retry:number[];
  reads:[number,number,number][];writes:[number,number,number,number][];frames:[string,number][]}
const ref:{cases:Record<string,Case>}=JSON.parse(readFileSync(resolve(__dirname,'__fixtures__/intro_movie_timing_reference.json'),'utf8'));
const data:YellowIntroData=JSON.parse(readFileSync(resolve(__dirname,'../../data/yellow_intro.json'),'utf8'));
const tables:IntroMovieTables={spawnStates:data.spawnStates,speedBars:data.speedBars};
const entryInput:IntroMovieEntryInput={copies:[
  {tiles:255,source:0x6b5a,dest:0x8000,bank:0x3e},{tiles:128,source:0x635a,dest:0x9000,bank:0x3e}]};

// The movie's own routines (2c3a). Their reads and stores are checked one for one; the reviewed helpers' are not.
const OWN=new Set(['PlayIntroScene','InitYellowIntroGFXAndMusic','DoIntroCutscene','GetIntroCutsceneJumptableEntry',
  'YellowIntroScene0','YellowIntroScene1','YellowIntroScene2','YellowIntroScene3','YellowIntroScene4','YellowIntroScene5',
  'YellowIntro_NextScene','YellowIntroScene2_PlaceGraphic','LoadYellowIntroFlyingSpeedBars','SpawnAnimatedObject',
  'YellowIntro_SpawnAnimatedObjectAndSavePointer','YellowIntro_MaskCurrentAnimatedObjectStruct','MaskCurrentAnimatedObjectStruct',
  'MaskAllAnimatedObjectStructs','YellowIntro_SetTimerFor128Frames','YellowIntro_CheckFrameTimerDecrement',
  'YellowIntro_LetterboxRunningPikachu','YellowIntro_BlankPalsDelay2AndDisableLCD','YellowIntro_PrepareNextScenePalette',
  'YellowIntroPaletteAction','LoadYellowIntroObjectAnimationDataPointers','YellowIntro_BlankTileMap','YellowIntro_FillMemory',
  'YellowIntro_BlankOAMBuffer','YellowIntro_BlankPalettes']);
// Addresses from pokeyellow.sym (refs/pokeyellow b452f2ab) and the hardware registers.
const FIXED:Record<string,number>={rIF:0xff0f,rIE:0xffff,rSTAT:0xff41,rLCDC:0xff40,rBGP:0xff47,rOBP0:0xff48,rOBP1:0xff49,
  rVBK:0xff4f,hSCX:0xffae,hSCY:0xffaf,hWY:0xffb0,hJoyPressed:0xffb3,hAutoBGTransferEnabled:0xffba,hAutoBGTransferDest:0xffbc,
  'hAutoBGTransferDest+1':0xffbd,hLCDCPointer:0xfff4,hOnCGB:0xfffe,wNumLoadedAnimatedObjects:0xc5bc,
  wCurrentAnimatedObjectOAMBufferOffset:0xc5bd,wAnimatedObjectSpawnStateDataPointer:0xc5c0,'wAnimatedObjectSpawnStateDataPointer+1':0xc5c1,
  wAnimatedObjectFramesDataPointer:0xc5c2,'wAnimatedObjectFramesDataPointer+1':0xc5c3,wAnimatedObjectJumptablePointer:0xc5c4,
  'wAnimatedObjectJumptablePointer+1':0xc5c5,wAnimatedObjectOAMDataPointer:0xc5c6,'wAnimatedObjectOAMDataPointer+1':0xc5c7,
  wYellowIntroCurrentScene:0xc634,wYellowIntroSceneTimer:0xc635,wYellowIntroAnimatedObjectStructPointer:0xc636,
  'wYellowIntroAnimatedObjectStructPointer+1':0xc637,'wCGBBasePalPointers+2':0xdee3,'wCGBBasePalPointers+3':0xdee4};
const REGION:Record<string,number>={wShadowOAM:0xc300,wTileMap:0xc3a0,wAnimatedObjectDataStructs:0xc51c,vBGMap0:0x9800,'vBGMap0.attr':0x9800};
function address(field:string):number|undefined{
  if(field in FIXED)return FIXED[field];
  const m=/^(.+)\[(\d+)\]$/.exec(field);
  return m&&m[1] in REGION?REGION[m[1]]+Number(m[2]):undefined; // wYellowIntroAnimatedObjectStruct[0] names the saved slot
}

// ROM-table bytes the transcript cannot show (it logs RAM and registers only). The whole-screen attribute packet's
// length is the one that steers a branch (data/cgb/bg_map_attributes.asm; 2c2's own tests seed the same $3f).
const ROM_TABLE:Record<string,number>={'attr-length':0x3f,'attr-pointer.lo':0xb0,'attr-pointer.hi':0x6b,
  'attr-offset.lo':0x0d,'attr-offset.hi':0,'channel-pointer.1.lo':0x5c,'channel-pointer.1.hi':0x76,
  'channel-pointer.2.lo':0xd3,'channel-pointer.2.hi':0x76,'channel-pointer.3.lo':0x49,'channel-pointer.3.hi':0x77};
function romByte(c:Case,field:string):number{
  if(field.startsWith('pal-id.'))return c===ref.cases.scene2?0x25:field==='pal-id.0'?0x10:0;
  return ROM_TABLE[field]??0;
}
interface Run{seq:string;predictors:string[];gdma:number[];insns:IntroHelperInsn[];error?:unknown}
function sourcesFor(c:Case,predictors:string[]):IntroHelperSources{
  const costs=[...c.audio];
  return {audioCycles(p){predictors.push(p);const v=costs.shift();if(v===undefined)throw new Error('audio cost missing');return v;},lcdEnabled:()=>true};
}
/** Replay one window into a composed stream. */
function replay(c:Case,build:(sources:IntroHelperSources)=>Generator<IntroForegroundStep,unknown,IntroHelperReply>):Run{
  const readsAt=new Map<number,[number,number][]>();
  for(const [i,a,v] of c.reads){const l=readsAt.get(i)??[];l.push([a,v]);readsAt.set(i,l);}
  const retry=new Set(c.retry),out:string[]=[],gdma:number[]=[],insns:IntroHelperInsn[]=[],predictors:string[]=[];
  const gen=build(sourcesFor(c,predictors));
  let next:IteratorResult<IntroForegroundStep,unknown>,k=0,error:unknown;
  // A stream that throws after diverging still reports its cycle sequence, so the divergence fails as an assertion.
  try{next=gen.next();}catch(e){return {seq:'',predictors,gdma,insns,error:e};}
  while(!next.done){
    const step=next.value;let reply:IntroHelperReply=0;
    if('kind' in step){out.push(step.kind==='audio'?'a':'g');if(step.kind==='gdma')gdma.push(step.dots);}
    else{
      out.push(String(step.cycles));insns.push(step);
      if(step.halt)reply=retry.has(k)?'retry':'woke';
      else if(step.read){
        const at=readsAt.get(k)??[],want=address(step.read.field);
        const hit=want===undefined?(at.length===1?at[0]:undefined):at.find(([a])=>a===want);
        reply=hit?hit[1]:romByte(c,step.read.field); // ROM reads are not in the transcript
      }
      k++;
    }
    if(out.length>200000){error=new Error('stream did not finish');break;}
    try{next=gen.next(reply);}catch(e){error=e;break;}
  }
  return {seq:out.join(''),predictors,gdma,insns,error};
}
function frameOf(c:Case):string[]{const f:string[]=[];for(const [n,count] of c.frames)for(let i=0;i<count;i++)f.push(n);return f;}
function firstDiff(a:string,b:string):number{let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return i;}
function expectWindow(name:string,run:Run){
  const c=ref.cases[name],frames=frameOf(c);
  const at=firstDiff(run.seq,c.seq);
  const insnAt=c.seq.slice(0,at).replace(/[ag]/g,'').length;
  expect({at,frame:frames[insnAt],got:run.seq.slice(at,at+12),want:c.seq.slice(at,at+12)})
    .toEqual({at:c.seq.length,frame:frames[insnAt],got:'',want:''});
  expect(run.error).toBeUndefined();
  expect(run.gdma).toEqual(c.gdma);
  // the movie's own reads and stores, one for one
  const writesAt=new Map<number,[number,number,number][]>();
  for(const [i,a,v,off] of c.writes){const l=writesAt.get(i)??[];l.push([a,v,off]);writesAt.set(i,l);}
  const readsAt=new Map<number,number[]>();
  for(const [i,a] of c.reads){const l=readsAt.get(i)??[];l.push(a);readsAt.set(i,l);}
  const bad:string[]=[];
  run.insns.forEach((step,k)=>{
    if(!OWN.has(frames[k]))return;
    if(step.routine&&!step.routine.includes('.')&&step.routine!==frames[k])bad.push(`${k} ${step.op}: routine ${step.routine}, native ${frames[k]}`);
    const reads=readsAt.get(k)??[];
    if(!!step.read!==(reads.length>0))bad.push(`${k} ${step.op} (${frames[k]}): read mark ${!!step.read}, native reads ${reads.length}`);
    if(step.read){const want=address(step.read.field);if(want!==undefined&&!reads.includes(want))bad.push(`${k} ${step.op}: reads ${reads}, want ${want}`);}
    const writes=writesAt.get(k)??[];
    if(!!step.store!==(writes.length>0))bad.push(`${k} ${step.op} (${frames[k]}): store mark ${!!step.store}, native writes ${writes.length}`);
    if(step.store&&writes.length){
      const [a,v,off]=writes[0];
      if(writes.some(w=>w[0]!==a||w[1]!==v))bad.push(`${k} ${step.op}: differing native writes ${JSON.stringify(writes)}`);
      const want=address(step.store.field);
      if(want!==undefined&&a!==want)bad.push(`${k} ${step.op}: writes ${a.toString(16)}, want ${want.toString(16)}`);
      const previous=step.store.value==='increment-read'?c.reads.find(([i,addr])=>i===k&&addr===a)?.[2]:undefined;
      const value=previous===undefined?step.store.value:(previous+1)&255;
      if(value!==v)bad.push(`${k} ${step.op}: value ${value}, native ${v}`);
      if(off!==step.cycles*4-step.store.trailingDots)bad.push(`${k} ${step.op}: store at +${step.cycles*4-step.store.trailingDots}, native +${off}`);
    }
  });
  expect(bad.slice(0,8)).toEqual([]);
}
function* loopWindow(sources:IntroHelperSources){
  expect(yield* introMovieLoopHeadSteps(false)).toBe('dispatch');
  yield* introMovieDispatchSteps(tables,sources);
  yield* introMovieLoopTailSteps((function*(){})());
}
const savedIe=ref.cases.entry.reads[0][2];

// The helper groups were already timed. Compare their newly supplied bytes and store offsets to the same native steps.
const groups=[
  {name:'music command pointers', base:0xc006, count:6,
    fields:[1,2,3].flatMap(ch=>[`wChannelCommandPointers.${ch}.lo`,`wChannelCommandPointers.${ch}.hi`])},
  {name:'VDMA source', base:0xff51, count:4, fields:['rVDMA_SRC_HIGH','rVDMA_SRC_LOW']},
  {name:'base palette pointers', base:0xdee1, count:8,
    fields:[0,1,2,3].flatMap(slot=>[`wCGBBasePalPointers.${slot}.lo`,`wCGBBasePalPointers.${slot}.hi`])},
  {name:'predef registers', base:0xcc4f, count:6,
    fields:['wPredefHL','wPredefHL.lo','wPredefDE','wPredefDE.lo','wPredefBC','wPredefBC.lo']},
];
for(const group of groups)it(`matches native ${group.name} bytes and write offsets`,()=>{
  for(const name of ['entry','entry-star-sound']){
    const c=ref.cases[name], run=replay(c,s=>introMovieEntrySteps(entryInput,s));
    expect(run.error).toBeUndefined();
    const expected=c.writes.filter(([,address,value])=>address>=group.base&&address<group.base+group.fields.length &&
      (group.name!=='music command pointers'||value!==0));
    expect(expected).toHaveLength(group.count);
    const stores=run.insns.flatMap((step,i)=>{
      if(!step.store)return [];
      const offset=group.fields.indexOf(step.store.field);
      return offset<0?[]:[[i,group.base+offset,step.store.value,step.cycles*4-step.store.trailingDots]];
    });
    expect(stores).toEqual(expected);
  }
});

it('carries a byte on every helper and movie store in the entry stream',()=>{
  for(const name of ['entry','entry-star-sound']){
    const run=replay(ref.cases[name],s=>introMovieEntrySteps(entryInput,s));
    expect(run.error).toBeUndefined();
    expect(run.insns.filter(step=>step.store&&typeof step.store.value!=='number').map(step=>step.store?.field)).toEqual([]);
  }
});

describe('the movie against the cartridge',()=>{
  it('PlayIntroScene entry: IE/IF/STAT, graphics, palettes, PlayMusic and the first DelayFrame (no input, then star sound)',()=>{
    for(const name of ['entry','entry-star-sound']){
      const run=replay(ref.cases[name],s=>introMovieEntrySteps(entryInput,s));
      expectWindow(name,run);
      expect(run.predictors).toEqual(['setup','setup']);
    }
    expect(savedIe).toBe(0x0d);
    expect(ref.cases['entry-star-sound'].retry.length).toBeGreaterThan(0); // the replay drives HALT retries
  });
  for(const name of ['scene0','scene1-live','scene1-expire','scene1-press','scene2','scene3-scroll','scene3-cap','scene3-expire',
    'scene4','scene5-live','scene5-expire'])
    it(`one loop iteration: ${name}`,()=>{
      const run=replay(ref.cases[name],loopWindow);
      expectWindow(name,run);
      const counted={scene2:8,scene4:5}[name]??0;
      expect(run.predictors).toEqual(Array(counted).fill('movie'));
    });
  it('the scene-6 cutoff goes straight to the exit; a fresh A in scene 1 takes the same exit after the skip test',()=>{
    expectWindow('exit-cutoff',replay(ref.cases['exit-cutoff'],function*(){
      expect(yield* introMovieLoopHeadSteps(true)).toBe('cutoff');
      yield* introMovieExitSteps(savedIe);
    }));
    expectWindow('exit-skip',replay(ref.cases['exit-skip'],function*(){
      expect(yield* introMovieLoopHeadSteps(false)).toBe('exit');
      yield* introMovieExitSteps(savedIe);
    }));
  });
});

describe('stream rules',()=>{
  const quiet:IntroHelperSources={audioCycles:()=>100,lcdEnabled:()=>true};
  function drive(gen:Generator<IntroForegroundStep,unknown,IntroHelperReply>,memory:Record<string,number>){
    // STAT alternates mode 3 and mode 0, so both palette waits finish; a stuck stream fails instead of growing.
    const steps:IntroHelperInsn[]=[];let next=gen.next(),stat=0;
    while(!next.done){const s=next.value;let r:IntroHelperReply=0;
      if(steps.length>200000)throw new Error('stream did not finish');
      if(!('kind' in s)){steps.push(s);if(s.halt){memory.hVBlankOccurred=0;r='woke';}
        else if(s.read?.field==='rSTAT')r=(stat^=3);else if(s.read)r=memory[s.read.field]??0;
        if(s.store?.value==='increment-read')memory[s.store.field]=((r as number)+1)&255;
        else if(typeof s.store?.value==='number')memory[s.store.field]=s.store.value;}
      next=gen.next(r);}
    return {steps,value:next.value};
  }
  it('tests the timer before decrementing: 1 goes to 0 without expiring, only a call at 0 advances',()=>{
    const one=drive(introMovieDispatchSteps(tables,quiet),{wYellowIntroCurrentScene:1,wYellowIntroSceneTimer:1});
    expect(one.steps.filter(s=>s.store?.field==='wYellowIntroSceneTimer').map(s=>s.store?.value)).toEqual([0]);
    expect(one.steps.some(s=>s.store?.field==='wYellowIntroCurrentScene')).toBe(false);
    const zero=drive(introMovieDispatchSteps(tables,quiet),{wYellowIntroCurrentScene:1,wYellowIntroSceneTimer:0});
    expect(zero.steps.filter(s=>s.store?.field==='wYellowIntroCurrentScene').map(s=>s.store?.value)).toEqual([2]);
    expect(zero.steps.filter(s=>s.store?.field==='wYellowIntroAnimatedObjectStruct[0]').map(s=>s.store?.value)).toEqual([0]);
  });
  it('scrolls scene 3 by 4 until exactly $68, then holds',()=>{
    const at=(scx:number)=>drive(introMovieDispatchSteps(tables,quiet),{wYellowIntroCurrentScene:3,wYellowIntroSceneTimer:5,hSCX:scx})
      .steps.filter(s=>s.store?.field==='hSCX').map(s=>s.store?.value);
    expect(at(0x64)).toEqual([0x68]);
    expect(at(0x68)).toEqual([]);
  });
  it('saves the address of the actual free object slot',()=>{
    const memory={wYellowIntroCurrentScene:0,hOnCGB:1,
      'wAnimatedObjectDataStructs[0]':1,'wAnimatedObjectDataStructs[16]':1,'wAnimatedObjectDataStructs[32]':1};
    const {steps}=drive(introMovieDispatchSteps(tables,quiet),memory);
    const pointer=steps.filter(step=>step.store?.field.startsWith('wYellowIntroAnimatedObjectStructPointer'));
    expect(pointer.map(step=>step.store?.value)).toEqual([0x4c,0xc5]);
  });
  it('places speed bars from the table as e, d and speed (first byte e, despite the ASM comment)',()=>{
    const got=drive(introMovieDispatchSteps(tables,quiet),{wYellowIntroCurrentScene:2,hOnCGB:1,rLCDC:0xe3,rLY:145,wNumLoadedAnimatedObjects:0});
    const struct=(slot:number,i:number)=>got.steps.filter(s=>s.store?.field===`wAnimatedObjectDataStructs[${slot*16+i}]`).slice(-1)[0]?.store?.value; // field $b: the spawn zeroes it, then the speed
    expect([struct(0,4),struct(0,5),struct(0,11)]).toEqual(tables.speedBars[0]);
    expect([struct(7,4),struct(7,5),struct(7,11)]).toEqual(tables.speedBars[7]);
  });
  it('a held or released button does not skip; a fresh A, B or START does; SELECT and directions do not',()=>{
    // _Joypad derives hJoyPressed from the latched input and the previous one: only a change to pressed counts.
    const head=(input:number,last:number)=>drive(introMovieLoopHeadSteps(false),{hJoyInput:input,hJoyLast:last}).value;
    expect([1,2,8].map(b=>head(b,0))).toEqual(['exit','exit','exit']);
    expect([1,2,8].map(b=>head(b,b))).toEqual(['dispatch','dispatch','dispatch']);
    expect([4,0x10,0x20,0x40,0x80,0].map(b=>head(b,0))).toEqual(Array(6).fill('dispatch'));
    expect(drive(introMovieLoopHeadSteps(true),{}).steps).toEqual([]);
  });
  it('stores DMG palettes six dots early, and refuses DMG, scenes past 5, a full object table and the scene 7/11 repairs',()=>{
    const s0=drive(introMovieDispatchSteps(tables,quiet),{wYellowIntroCurrentScene:0,hOnCGB:1});
    expect(s0.steps.filter(s=>['rBGP','rOBP0','rOBP1'].includes(s.store?.field??'')).map(s=>s.store?.trailingDots)).toEqual(Array(3).fill(INTRO_DMG_PALETTE_STORE_TRAILING_DOTS));
    expect(()=>drive(introMovieDispatchSteps(tables,quiet),{wYellowIntroCurrentScene:6})).toThrow(RangeError);
    expect(()=>drive(introMovieDispatchSteps(tables,quiet),{wYellowIntroCurrentScene:2,hOnCGB:0,rLCDC:0xe3,rLY:145})).toThrow(RangeError);
    const full:Record<string,number>={wYellowIntroCurrentScene:0,hOnCGB:1};
    for(let slot=0;slot<10;slot++)full[`wAnimatedObjectDataStructs[${slot*16}]`]=1;
    expect(()=>drive(introMovieDispatchSteps(tables,quiet),full)).toThrow(RangeError);
    expect(()=>drive(introMovieLoopTailSteps((function*(){})()),{wYellowIntroCurrentScene:7})).toThrow(RangeError);
  });
  it('adapts 2a object steps one for one, marks each store, and returns the OAM-full carry',()=>{
    function* cpu(){yield {cycles:3,store:false};yield {cycles:2,store:true};return true;}
    const writer={*runWrites(){yield {offset:159,value:0x42};return true;}};
    const got=drive(introObjectAnimationSteps(cpu(),writer,0),{});
    expect(got.steps.map(s=>[s.cycles,!!s.store,s.routine])).toEqual([[3,false,'RunObjectAnimations'],[2,true,undefined]]);
    expect(got.steps[1].store).toEqual({field:'shadowOam.159',value:0x42,trailingDots:4});
    expect(got.value).toBe(true);
    const noBytes={*runWrites(){return true;}};
    expect(()=>drive(introObjectAnimationSteps(cpu(),noBytes,0),{})).toThrow('ended before a timed store');
    const noCarry={*runWrites(){yield {offset:159,value:0x42};return false;}};
    expect(()=>drive(introObjectAnimationSteps(cpu(),noCarry,0),{})).toThrow('did not finish together');
  });
});

it('keeps the movie streams unused by the game',()=>{
  const root=resolve(__dirname,'..'),owners:string[]=[];
  function walk(folder:string):void{for(const entry of readdirSync(folder,{withFileTypes:true})){
    const path=resolve(folder,entry.name);
    if(entry.isDirectory())walk(path);
    else if(entry.name.endsWith('.ts')&&!entry.name.endsWith('.test.ts')&&/intro_movie_timing/.test(readFileSync(path,'utf8')))
      owners.push(relative(root,path).replace(/\\/g,'/'));
  }}
  walk(root);
  expect(owners).toEqual([]);
});
