import {expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {rig,sfxData,type Rig} from '../test/audio_rig';
import {PlaySound} from './play_sound';
import {engineHost} from './request_host';
import {INTRO_SETUP_AUDIO_BANK,INTRO_SETUP_SOUND_ID,introSetupAudioCycles,introSetupAudioSegments,
  type IntroSetupAudioInputs} from './intro_setup_audio_timing';

// The user's cartridge on pinned SameBoy (notes/132-opening-checkpoint-12b2c2-2c1): every Audio1_UpdateMusic from
// PlayIntroScene's entry to PlayMusic, with no input and for every star-skip frame that leaves sound 194 playing.
type Row=[number|null,string,number|null,number|null,number];
const native:{sound:number;audioBank:number;commandBytes:number[];classes:[string,number[]][][];
  histories:Record<string,{rows:Row[]}>}=JSON.parse(readFileSync(
  resolve(__dirname,'__fixtures__/intro_setup_audio_reference.json'),'utf8'));
const star=sfxData('shooting_star');
const offsets=native.commandBytes.reduce<number[]>((all,n)=>[...all,all[all.length-1]+n],[0]);
const total=(segments:readonly (readonly [string,readonly number[]])[])=>segments.reduce((sum,[,c])=>sum+c.reduce((a,b)=>a+b,0),0);

function inputs(r:Rig,id=r.sfx.observeChannel(5)?.active?INTRO_SETUP_SOUND_ID:0):IntroSetupAudioInputs {
  return {sfx:r.sfx,music:r.music,channel5SoundId:id,audioBank:INTRO_SETUP_AUDIO_BANK,lowHealthAlarm:0};
}
/** The star's PlaySound, then `updates` real audio updates. */
function playing(updates:number):Rig {
  const r=rig();r.sfx.installSfx(star);r.run(updates);return r;
}

for(const [name,history] of Object.entries(native.histories))
  it(`reproduces every setup update of ${name}, instruction by instruction`,()=>{
    const first=history.rows.find(row=>row[0]!==null)?.[0]??null;
    const r=first===null?rig():playing(first);let k=first;
    for(const [index,site,offset,delay,cls] of history.rows){
      if(index!==null){
        expect(index).toBe(k);
        const ch=r.sfx.observeChannel(5)!;
        expect([offsets[ch.pc],ch.noteDelayCounter]).toEqual([offset,delay]);
      } else expect(r.sfx.observeChannel(5)?.active??false).toBe(false);
      expect([site,introSetupAudioSegments(inputs(r))]).toEqual([site,native.classes[cls]]);
      r.update();if(k!==null)k++;
    }
  });

it('costs each class as the cartridge does, the same at VBlank and in LoadBGMapAttributes',()=>{
  expect(native.classes.map(total)).toEqual([165,296,1357,1372,1386,730]);
  const sites=new Map<number,Set<string>>();
  for(const h of Object.values(native.histories))for(const [,site,,,cls] of h.rows)
    sites.set(cls,(sites.get(cls)??new Set()).add(site));
  expect([...sites.keys()].sort()).toEqual([0,1,2,3,4,5]);
  for(const cls of [0,1,4,5])expect([...sites.get(cls)!].sort()).toEqual(['UpdateAudioDuringLoadBGMapAttributes','VBlank']);
  expect(introSetupAudioCycles(inputs(rig()))).toBe(165);
  expect(introSetupAudioCycles(inputs(playing(6)))).toBe(296);
});

it('covers every update of the sound that setup can reach, and nothing earlier',()=>{
  const ks=new Set<number>();
  for(const h of Object.values(native.histories))for(const [k] of h.rows)if(k!==null)ks.add(k);
  expect(Math.min(...ks)).toBe(4);expect(Math.max(...ks)).toBe(76);expect(ks.size).toBe(73);
  expect(native.histories['skip-316'].rows.every(row=>row[0]===null)).toBe(true);
  expect(native.histories['skip-392'].rows.every(row=>row[0]===null)).toBe(true);
  // the stream's own predictions over the whole sound: four waits for each short note, the long notes, the end
  const r=playing(1),costs:number[]=[];
  for(let k=1;k<=77;k++){costs.push(introSetupAudioCycles(inputs(r)));r.update();}
  expect(costs.filter(c=>c===1357)).toHaveLength(2);expect(costs.filter(c=>c===1372)).toHaveLength(5);
  expect(costs.filter(c=>c===1386)).toHaveLength(1);expect(costs[75]).toBe(730);expect(costs[76]).toBe(165);
});

it('is a pure lookahead: the SFX channel, the music and the synthesizer are unchanged',()=>{
  const r=playing(15),before=JSON.stringify(r.sfx.observeChannel(5)),log=r.synth.log.length;
  expect(introSetupAudioCycles(inputs(r))).toBe(1372);expect(introSetupAudioCycles(inputs(r))).toBe(1372);
  expect(JSON.stringify(r.sfx.observeChannel(5))).toBe(before);expect(r.synth.log).toHaveLength(log);
  expect(r.music.isPlaying()).toBe(false);
});

it('PlayMusic clears sound 194 mid-note, leaving the silent path for the next update',()=>{
  const r=playing(70),started:number[]=[];expect(r.sfx.observeChannel(5)?.active).toBe(true);
  const requests=new PlaySound(engineHost(r.synth,r.music,r.sfx,id=>started.push(id)));
  expect(requests.playMusic({id:0xdc,bank:0x1f})).toBe('played');expect(started).toEqual([0xdc]);
  expect(r.sfx.observeChannel(5)).toBeUndefined();expect(introSetupAudioCycles(inputs(r,0))).toBe(165);
});

it('refuses states outside the setup domain before predicting anything',()=>{
  // a sound of the same length on CHAN5 whose first command differs, past its first update
  const lookalike={channels:[{id:5,commands:[{cmd:'duty_cycle',value:2},...star.channels[0].commands.slice(1)]}]};
  const cases:[string,()=>IntroSetupAudioInputs,string][]=[
    ['bank',()=>({...inputs(playing(5)),audioBank:2}),'shooting star bank'],
    ['alarm',()=>({...inputs(playing(5)),lowHealthAlarm:0x80}),'low-health alarm off'],
    ['first update',()=>inputs(playing(0)),'not had its first update'],
    ['wrong ID',()=>inputs(playing(5),193),'sound 194 only'],
    ['ID without sound',()=>inputs(rig(),INTRO_SETUP_SOUND_ID),'a sound ID but no sound'],
    ['another sound',()=>{const r=rig();r.sfx.installSfx(lookalike);r.run(1);return inputs(r,INTRO_SETUP_SOUND_ID);},'not playing the shooting star'],
    ['music playing',()=>{const r=rig(JSON.parse(readFileSync(resolve(__dirname,'../../data/audio/music/yellowintro.json'),'utf8')));return inputs(r,0);},'silent music channels'],
    ['other SFX channels',()=>{const r=rig();r.sfx.installSfx(sfxData('get_item1'));return inputs(r,INTRO_SETUP_SOUND_ID);},'software channel 5 only'],
  ];
  for(const [label,make,message] of cases){
    expect(()=>introSetupAudioSegments(make()),label).toThrow(RangeError);
    expect(()=>introSetupAudioSegments(make()),label).toThrow(message);
  }
});

it('observeChannel is a read-only copy of the installed channel',()=>{
  const r=playing(3),seen=r.sfx.observeChannel(5)!;
  expect(seen).toMatchObject({id:5,active:true,enabled:true,pc:3,noteDelayCounter:3,musicMode:false,battle:false});
  expect(seen.commands).toBe(star.channels[0].commands);
  expect(r.sfx.observeChannel(6)).toBeUndefined();
  r.sfx.channelEnabled=()=>false;expect(r.sfx.observeChannel(5)?.enabled).toBe(false);
  // an ID-cleared channel is skipped as Audio1_UpdateMusic skips a zero sound ID
  expect(()=>introSetupAudioCycles(inputs(r,0))).not.toThrow();expect(introSetupAudioCycles(inputs(r,0))).toBe(165);
  const jingle=rig();jingle.sfx.installSfx(sfxData('get_item1'));
  expect(jingle.sfx.observeChannel(5)).toMatchObject({musicMode:true,pc:0});
});

it('keeps the setup audio stream unused by the game',()=>{
  const root=resolve(__dirname,'..'),owners:string[]=[];
  function walkDir(folder:string):void{for(const e of readdirSync(folder,{withFileTypes:true})){
    const p=resolve(folder,e.name);if(e.isDirectory())walkDir(p);
    else if(e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')&&/intro_setup_audio_timing|introSetupAudio/.test(readFileSync(p,'utf8')))
      owners.push(relative(root,p).replace(/\\/g,'/'));
  }}
  walkDir(root);expect(owners).toEqual(['audio/intro_setup_audio_timing.ts']);
});
