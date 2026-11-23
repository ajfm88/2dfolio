import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {
  INTRO_GDMA_STALL_DOTS,INTRO_YELLOW_MUSIC_ID,introClearObjectAnimationBuffersSteps,introCopyVideoDataSteps,
  introDelayFrameSteps,introDelayFramesSteps,introDisableLcdSteps,introJoypadLowSensitivitySteps,
  introLoadBgMapAttributesSteps,introPlayMusicSteps,introRunPaletteCommandSteps,introUpdateCgbPalBgpSteps,
  introUpdateCgbPalObp0Steps,introUpdateMusicCTimesSteps,
  type IntroForegroundStep,type IntroHelperInsn,type IntroHelperReply,type IntroHelperSources,
} from './intro_helper_timing';

// Native witnesses: notes/133, SameBoy CGB-E, the user's cartridge, no-input movie window unless a case says otherwise.
// DelayFrame's no-wait exit is 2,3,1,3,1,2,4. ClearObjectAnimationBuffers is 614 instructions and 4944 dots.
// PlayMusic is 641 instructions and 1571 cycles (6284 dots) in every captured history. JoypadLowSensitivity is
// 49 / 52 / 55 instructions for a new press, a running delay and an expired delay, all with hJoy7 = 0.

type Mem = Record<string,number>;
function drive(gen:Generator<IntroForegroundStep,void,IntroHelperReply>,opts:{memory?:Mem;halt?:(memory:Mem)=>'retry'|'woke';queue?:Record<string,number[]> }={}){
  const memory:Mem={hLoadedROMBank:1,wStatusFlags2:0,wLowHealthAlarm:0,wAudioFadeOutControl:0,...opts.memory};
  const steps:IntroForegroundStep[]=[];
  let next=gen.next();
  let guard=0;
  while(!next.done){
    if(++guard>200000)throw new Error('intro helper stream did not finish');
    const step=next.value;
    steps.push(step);
    let reply:IntroHelperReply=0;
    if(!('kind' in step)&&step.halt)reply=opts.halt?opts.halt(memory):'woke';
    else if(!('kind' in step)&&step.read){
      const queued=opts.queue?.[step.read.field];
      reply=queued&&queued.length?queued.shift()!:memory[step.read.field]??0;
    }
    if(!('kind' in step)&&typeof step.store?.value==='number')memory[step.store.field]=step.store.value;
    next=gen.next(reply);
  }
  return {steps,memory};
}
const insns=(steps:IntroForegroundStep[])=>steps.filter((step):step is IntroHelperInsn=>!('kind' in step));
const cyclesOf=(steps:readonly {cycles?:number;kind?:string}[])=>steps.reduce((sum,step)=>sum+('kind' in step&&step.kind==='gdma'?0:step.cycles??0),0);
const sources=(costs:number[]):IntroHelperSources=>({
  audioCycles(){const cost=costs.shift();if(cost===undefined)throw new Error('audio cost missing');return cost;},
  lcdEnabled:()=>true,
});

describe('DelayFrame',()=>{
  it('exits in seven instructions when the woke sample is clear',()=>{
    const got=drive(introDelayFrameSteps(),{halt(memory){memory.hVBlankOccurred=0;return 'woke';}});
    expect(insns(got.steps).map(step=>step.cycles)).toEqual([2,3,1,3,1,2,4]);
    expect(got.steps.filter(step=>'halt' in step&&step.halt)).toHaveLength(1);
  });
  it('treats a STAT wake as another HALT, then a VBlank clear as the exit',()=>{
    let wakes=0;
    const got=drive(introDelayFrameSteps(),{halt(memory){wakes++;if(wakes===2)memory.hVBlankOccurred=0;return 'woke';}});
    const ops=insns(got.steps).map(step=>step.op);
    expect(ops.filter(op=>op==='halt')).toHaveLength(2);
    expect(ops).toContain('jr nz,.halt');
    expect(insns(got.steps).filter(step=>step.op==='jr nz,.halt').map(step=>step.cycles)).toEqual([3,2]);
  });
  it('revisits the same HALT when the CPU reports retry, and a VBlank during that retry can clear the flag first',()=>{
    const replies:Array<'retry'|'woke'>=['retry','woke'];
    const got=drive(introDelayFrameSteps(),{halt(memory){const reply=replies.shift()!;if(reply==='woke')memory.hVBlankOccurred=0;return reply;}});
    expect(insns(got.steps).map(step=>step.op).slice(0,5)).toEqual(['ld a,1','ldh [hVBlankOccurred],a','halt','halt','ldh a,[hVBlankOccurred]']);
  });
  it('DelayFrames re-enters itself and Delay3 asks for three frames',()=>{
    let frames=0;
    const got=drive(introDelayFramesSteps(3),{halt(memory){frames++;memory.hVBlankOccurred=0;return 'woke';}});
    expect(frames).toBe(3);
    expect(insns(got.steps).filter(step=>step.routine==='DelayFrames')).toHaveLength(3);
    expect(insns(got.steps).filter(step=>step.op==='jr nz,DelayFrames').map(step=>step.cycles)).toEqual([3,3,2]);
  });
});

describe('DisableLCD',()=>{
  it('clears IF, masks VBlank, waits for LY 145, clears LCDC and restores IE',()=>{
    const got=drive(introDisableLcdSteps({audioCycles:()=>1,lcdEnabled:()=>true}),{
      memory:{rIE:0x0f,rLCDC:0xe3},queue:{rLY:[2,145]},
    });
    const list=insns(got.steps);
    expect(list.map(step=>step.store?.field).filter(Boolean)).toEqual(['rIF','rIE','rLCDC','rIE']);
    expect(list.filter(step=>step.store?.field==='rIF').map(step=>step.store?.value)).toEqual([0]);
    expect(list.filter(step=>step.store?.field==='rIE').map(step=>[step.store?.value,step.store?.trailingDots])).toEqual([[0x0e,4],[0x0f,4]]);
    expect(list.find(step=>step.store?.field==='rLCDC')?.store).toMatchObject({value:0x63,trailingDots:4});
    expect(list.filter(step=>step.op==='jr nz,.wait').map(step=>step.cycles)).toEqual([3,2]);
    expect(list.find(step=>step.read?.field==='rLY')?.read?.trailingDots).toBe(4);
    expect(list[list.length-1]).toMatchObject({op:'ret',cycles:4});
    expect(list.some(step=>step.di||step.ei)).toBe(false);
  });
  it('refuses an already-disabled LCD before the first instruction',()=>{
    const gen=introDisableLcdSteps({audioCycles:()=>1,lcdEnabled:()=>false});
    expect(()=>gen.next()).toThrow('DisableLCD on an already-disabled LCD is unsupported');
  });
});

describe('the fixed-shape helpers',()=>{
  it('clears the animation buffers in 614 instructions and 1236 cycles',()=>{
    const got=drive(introClearObjectAnimationBuffersSteps());
    expect(insns(got.steps)).toHaveLength(614);
    expect(cyclesOf(insns(got.steps))).toBe(1236);
    expect(insns(got.steps).filter(step=>step.op==='ld [hli],a')).toHaveLength(0xc8);
  });
  it('plays the intro song in 641 instructions and 1571 cycles, clearing setup SFX before publishing music',()=>{
    const got=drive(introPlayMusicSteps(),{memory:{'channel-pointer.1.lo':0x34,'channel-pointer.1.hi':0x12}});
    expect(insns(got.steps)).toHaveLength(641);
    expect(cyclesOf(insns(got.steps))).toBe(1571);
    const published=insns(got.steps).flatMap(step=>step.publishes?[`${step.publishes}:${step.store?.field}=${step.store?.value}`]:[]);
    expect(published.slice(0,4)).toEqual([5,6,7,8].map(n=>`setup-sfx-cleared:wChannelSoundIDs.${n}=0`));
    expect(published.slice(4)).toEqual([1,2,3].map(n=>`music-channel:wChannelSoundIDs.${n}=${INTRO_YELLOW_MUSIC_ID}`));
    expect(published.findIndex(item=>item.startsWith('music'))).toBeGreaterThan(3);
    expect([got.memory['wChannelCommandPointers.1.lo'],got.memory['wChannelCommandPointers.1.hi']]).toEqual([0x34,0x12]);
  });
});

describe('JoypadLowSensitivity',()=>{
  function press(input:number,extra:Mem={}){
    return drive(introJoypadLowSensitivitySteps(),{memory:{hJoyInput:input,hJoyLast:0,hJoy7:0,hJoyHeld:input,hFrameCounter:0,hJoy6:0,wStatusFlags5:0,wJoyIgnore:0,...extra}});
  }
  it('reports a new press on hJoy5 and arms a 30-frame delay, which is not hJoyPressed',()=>{
    const got=press(1);
    expect(insns(got.steps)).toHaveLength(49);
    expect(got.memory.hJoy5).toBe(1);
    expect(got.memory.hJoyPressed).toBe(1);
    expect(got.memory.hFrameCounter).toBe(30);
  });
  it('clears hJoy5 while the delay is still running',()=>{
    const got=press(0,{hFrameCounter:10,hJoyLast:1});
    expect(insns(got.steps)).toHaveLength(52);
    expect(got.memory.hJoy5).toBe(0);
    expect(got.memory.hFrameCounter).toBe(10);
  });
  it('arms the short delay when the counter has expired',()=>{
    const got=press(0);
    expect(insns(got.steps)).toHaveLength(55);
    expect(got.memory.hFrameCounter).toBe(5);
  });
  it('uses hJoyHeld when hJoy7 is set, and clears hJoy5 on an expired A or B hold only when hJoy6 is clear',()=>{
    const held=press(0x10,{hJoy7:1,hJoyLast:0x10,hJoyHeld:0x10,hFrameCounter:0});
    expect(held.memory.hJoy5).toBe(0x10);
    const masked=press(1,{hJoy7:1,hJoyHeld:1,hFrameCounter:0,hJoy6:0,hJoyLast:1});
    expect(masked.memory.hJoy5).toBe(0);
    expect(masked.memory.hFrameCounter).toBe(5);
    const kept=press(1,{hJoy7:1,hJoyHeld:1,hFrameCounter:0,hJoy6:1,hJoyLast:1});
    expect(kept.memory.hJoy5).toBe(1);
  });
  it('refuses soft reset, the joypad-disable bit and a joy ignore mask',()=>{
    expect(()=>press(0x0f).steps).toThrow('Intro helper soft reset is unsupported');
    expect(()=>press(0,{wStatusFlags5:1<<5}).steps).toThrow('Intro helper joypad disable is unsupported');
    expect(()=>press(0,{wJoyIgnore:1}).steps).toThrow('Intro helper joypad mask is unsupported');
  });
});

describe('CopyVideoData, attributes, counted music and palette compares',()=>{
  function copy(tiles:255|128){
    return drive(introCopyVideoDataSteps({tiles,source:0x4000,dest:0x8000,bank:0x1c}),{
      memory:{hAutoBGTransferEnabled:1,hLoadedROMBank:1},halt(memory){memory.hVBlankOccurred=0;return 'woke';},
    });
  }
  it('requests 31 chunks of 8 and one of 7, or 16 chunks of 8 and a final zero',()=>{
    const big=insns(copy(255).steps).filter(step=>step.store?.field==='hVBlankCopySize').map(step=>step.store?.value);
    const small=insns(copy(128).steps).filter(step=>step.store?.field==='hVBlankCopySize').map(step=>step.store?.value);
    expect(big).toEqual([...Array(31).fill(8),7]);
    expect(small).toEqual([...Array(16).fill(8),0]);
    expect(small).toHaveLength(17);
  });
  it('places two 2052-dot GDMA stalls after the length writes and keeps the two audio costs distinct',()=>{
    const got=drive(introLoadBgMapAttributesSteps(sources([165,296])),{
      memory:{rLCDC:0xe3,rIF:0x03,wAudioFadeOutControl:0,wStatusFlags2:0,wLowHealthAlarm:0},
      queue:{rLY:[0x90,0x90],'attr-length':[0x3f,0x3f],rSTAT:[0,0]},
    });
    const gdma=got.steps.filter(step=>'kind' in step&&step.kind==='gdma');
    expect(gdma).toEqual([{kind:'gdma',dots:INTRO_GDMA_STALL_DOTS,which:1},{kind:'gdma',dots:INTRO_GDMA_STALL_DOTS,which:2}]);
    const lenAt=got.steps.findIndex(step=>!('kind' in step)&&step.store?.field==='rVDMA_LEN');
    expect(got.steps[lenAt+1]).toMatchObject({kind:'gdma',which:1});
    const audio=got.steps.filter(step=>'kind' in step&&step.kind==='audio');
    expect(audio.map(step=>'cycles' in step?step.cycles:0)).toEqual([165,296]);
    const ifStores=insns(got.steps).filter(step=>step.store?.field==='rIF');
    const ifStore=ifStores[ifStores.length-1];
    expect(ifStore?.store).toMatchObject({value:0x02,trailingDots:3});
    expect(insns(got.steps).some(step=>step.ei)).toBe(true);
    const list=insns(got.steps);
    expect(list.filter(step=>step.op==='cp $90').map(step=>step.cycles)).toEqual([2,2]);
    expect(list[list.length-1]?.op).toBe('ret');
  });
  it('charges 66*n+3 wrapper cycles around distinct movie-music costs',()=>{
    const got=drive(introUpdateMusicCTimesSteps(8,sources([10,20,30,40,50,60,70,80])));
    const audio=got.steps.filter(step=>'kind' in step&&step.kind==='audio').map(step=>'cycles' in step?step.cycles:0);
    expect(audio).toEqual([10,20,30,40,50,60,70,80]);
    expect(cyclesOf(insns(got.steps))).toBe(66*8+3);
    const five=drive(introUpdateMusicCTimesSteps(5,sources([1,2,3,4,5])));
    expect(cyclesOf(insns(five.steps))).toBe(66*5+3);
  });
  it('follows a changed BGP into the far transfer and waits out LY before EI RET',()=>{
    const got=drive(introUpdateCgbPalBgpSteps(),{memory:{hOnCGB:1,rBGP:0xe4,wLastBGP:0,rLCDC:0xe3,rLY:144}});
    expect(got.steps.some(step=>'routine' in step&&step.routine==='_UpdateCGBPal_BGP')).toBe(true);
    const list=insns(got.steps);
    const ei=list.findIndex(step=>step.ei);
    expect(list[ei+1]).toMatchObject({op:'ret'});
    expect(list[ei-1]?.op).not.toBe('di');
  });
  it('waits for STAT bit 1 to become set before waiting for it to clear',()=>{
    const stat=[0,2,0];
    for(let n=0;n<15;n++)stat.push(2,0);
    const got=drive(introUpdateCgbPalObp0Steps(),{memory:{hOnCGB:1,rOBP0:0xe0,wLastOBP0:0,rLCDC:0xe3},queue:{rSTAT:stat}});
    const waits=insns(got.steps).filter(step=>step.op==='jr z,TransferPalColorLCDEnabled').map(step=>step.cycles);
    expect(waits.slice(0,2)).toEqual([3,2]);
  });
  it('runs SET_PAL_GENERIC through one attribute helper, two stalls and Delay3',()=>{
    const stat:number[]=[];
    for(let n=0;n<80;n++)stat.push(2,0);
    const got=drive(introRunPaletteCommandSteps(sources([730,1386]),0x7254),{
      memory:{wOnSGB:1,hOnCGB:1,rLCDC:0xe3,rLY:0x90,'attr-length':0x3f,hLoadedROMBank:1,rIF:1},
      queue:{rSTAT:stat},halt(memory){memory.hVBlankOccurred=0;return 'woke';},
    });
    expect(got.steps.filter(step=>'kind' in step&&step.kind==='gdma')).toHaveLength(2);
    expect(got.steps.filter(step=>'routine' in step&&step.routine==='LoadBGMapAttributes')).toHaveLength(1);
    expect(got.steps.filter(step=>'routine' in step&&step.routine==='DelayFrames')).toHaveLength(3);
    expect([got.memory.wPredefDE,got.memory['wPredefDE.lo']]).toEqual([0x72,0x54]);
    const audio=got.steps.filter(step=>'kind' in step&&step.kind==='audio').map(step=>'cycles' in step?step.cycles:0);
    expect(audio).toEqual([730,1386]);
  });
  it('keeps an unchanged BGP on the short exit and refuses a DMG caller',()=>{
    const same=drive(introUpdateCgbPalBgpSteps(),{memory:{hOnCGB:1,rBGP:0xe4,wLastBGP:0xe4}});
    expect(insns(same.steps)).toHaveLength(17);
    expect(same.steps.some(step=>'routine' in step&&step.routine==='_UpdateCGBPal_BGP')).toBe(false);
    expect(()=>drive(introUpdateCgbPalBgpSteps(),{memory:{hOnCGB:0}}).steps).toThrow('UpdateCGBPal on DMG is unsupported');
  });
  it('refuses the counts and packets outside the measured movie paths',()=>{
    expect(()=>introCopyVideoDataSteps({tiles:16 as 128,source:0,dest:0,bank:1}).next()).toThrow('CopyVideoData tile count is outside the movie setup');
    expect(()=>introUpdateMusicCTimesSteps(6,sources([1])).next()).toThrow('UpdateMusicCTimes count is outside scenes 2 and 4');
    expect(()=>drive(introLoadBgMapAttributesSteps(sources([1,1])),{memory:{rLCDC:0xe3},queue:{'attr-length':[1]}}).steps)
      .toThrow('LoadBGMapAttributes length is outside the whole-screen packet');
  });
});

// Note 138 found four instruction costs here that disagreed with the cartridge (2c3a's native replays): `add n` in
// _UpdateCGBPal_OBP's palette index, `inc hl` in InitCGBPalettes and TranslatePalPacketToBGMapAttributes, and `and %10`
// in LoadBGMapAttributes' STAT wait. Immediate ALU operands and 16-bit INC are two machine cycles.
it('charges two cycles for immediate ALU operands and 16-bit INC (note 138)',()=>{
  const stat=Array.from({length:2000},(_,i)=>i%2?0:2); // STAT mode 3 then mode 0, so each colour write proceeds
  const obp=drive(introUpdateCgbPalObp0Steps(),{memory:{hOnCGB:1,rOBP0:0xe0,wLastOBP0:0,rLCDC:0xe3},queue:{rSTAT:[...stat]}});
  expect(insns(obp.steps).filter(step=>/^add \d$/.test(step.op)).map(step=>[step.op,step.cycles])).toEqual([['add 2',2],['add 3',2]]);
  const run=drive(introRunPaletteCommandSteps(sources([7,11]),0x635a),{
    memory:{wOnSGB:1,hOnCGB:1,rLCDC:0xe3,rLY:0x90,'attr-length':0x3f,hLoadedROMBank:1,rIF:1},
    queue:{rSTAT:Array.from({length:2000},(_,i)=>i%2?0:2)},halt(memory){memory.hVBlankOccurred=0;return 'woke';},
  });
  const list=insns(run.steps);
  expect(new Set(list.filter(step=>step.op==='inc hl').map(step=>step.cycles))).toEqual(new Set([2]));
  expect(list.filter(step=>step.op==='inc hl').length).toBeGreaterThan(4);
  expect(new Set(list.filter(step=>step.op==='and %10').map(step=>step.cycles))).toEqual(new Set([2]));
});

it('keeps every EI delay slot an ordinary RET and never yields a GDMA stall as an instruction',()=>{
  const streams=[
    drive(introPlayMusicSteps()).steps,
    drive(introClearObjectAnimationBuffersSteps()).steps,
    drive(introDelayFrameSteps(),{halt(memory){memory.hVBlankOccurred=0;return 'woke';}}).steps,
  ];
  for(const steps of streams){
    steps.forEach((step,index)=>{
      if('kind' in step&&step.kind==='gdma')expect(step).not.toHaveProperty('op');
      if(!('kind' in step)&&step.ei)expect(steps[index+1]).toMatchObject({op:'ret'});
    });
  }
});

it('keeps the helper streams unused by the game',()=>{
  const root=resolve(__dirname,'..'),owners:string[]=[];
  function walk(folder:string):void{for(const entry of readdirSync(folder,{withFileTypes:true})){
    const path=resolve(folder,entry.name);
    if(entry.isDirectory())walk(path);
    else if(entry.name.endsWith('.ts')&&!entry.name.endsWith('.test.ts')&&/intro_helper_timing|introDelayFrameSteps|introPlayMusicSteps/.test(readFileSync(path,'utf8')))
      owners.push(relative(root,path).replace(/\\/g,'/'));
  }}
  walk(root);
  expect(owners).toEqual(['audio/intro_entry_audio.ts','menus/intro_foreground_program.ts','menus/intro_foreground_runner.ts','menus/intro_helper_timing.ts','menus/intro_movie_timing.ts']);
});
