import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {audioJson,rig} from '../test/audio_rig';
import type {MusicData,MusicEngine} from './music_engine';
import {introMusicUpdateCycles,timedIntroMusicUpdate} from './intro_music_timing';
const song = audioJson<MusicData>('music/yellowintro.json');
interface NativeChannel {
  pointer:number;active:number;delay:number;fraction:number;speed:number;octave:number;vibratoDelay:number;
  vibratoReload:number;extents:number;rates:number;flags:number;freqLow:number;
}
interface NativeState {tempo:number;channels:NativeChannel[]}
interface Branch {input:{delay:number;vibratoDelay:number;extents:number;rates:number;freqLow:number;direction:boolean};cost:number}
const native: {rows:{cost:number;before:NativeState;after:NativeState}[];branches:Branch[]} = JSON.parse(readFileSync(
  resolve(__dirname,'__fixtures__/intro_music_timing_oracle.json'),'utf8'));
const width:Record<string,number>={tempo:3,volume:2,duty_cycle:2,vibrato:3,note_type:2,octave:1,note:1,rest:1,sound_ret:1};
const offsets=song.channels.map(c=>{let n=0;return [0,...c.commands.map(x=>n+=width[x.cmd])];});
function snapshot(music:MusicEngine) {
  return {tempo:music.musicTempo,channels:song.channels.map((row,i)=>{
    const c=music.getChannel(row.id)!;
    return {pointer:offsets[i][c.pc],active:c.active?220:0,delay:c.noteDelayCounter,fraction:c.noteDelayFractional,
      speed:c.noteSpeed,octave:8-c.octave,vibratoDelay:c.vibratoDelayCounter,vibratoReload:c.vibratoDelayReload,
      extents:c.vibratoExtents,rates:c.vibratoRates,flags:c.vibratoDirection?8:0,freqLow:c.freqLow};
  })};
}
it('matches native cost on all 1309 updates through the complete movie song and idle tail',()=>{
  const {music,sfx}=rig(song),costs:number[]=[];
  for(const row of native.rows){costs.push(introMusicUpdateCycles(music,song));music.tick(sfx);sfx.tick();expect(row.cost).toBeGreaterThan(0);}
  expect(native.rows).toHaveLength(1309);expect(costs).toEqual(native.rows.map(r=>r.cost));
});
it('the paired real engine matches native channel state after every update, without a second timing state owner',()=>{
  const {music,sfx}=rig(song),differences:number[]=[];
  for(let i=0;i<native.rows.length;i++){
    music.tick(sfx);sfx.tick();
    if(JSON.stringify(snapshot(music))!==JSON.stringify(native.rows[i].after))differences.push(i);
  }
  expect(differences.slice(0,10)).toEqual([]);expect(differences).toHaveLength(0);
});
it('lookahead is pure, repeatable and does not change the song or live channel state',()=>{
  const {music,sfx}=rig(song);music.tick(sfx);sfx.tick();
  const before=snapshot(music),literal=JSON.stringify(song);
  expect(introMusicUpdateCycles(music,song)).toBe(509);expect(introMusicUpdateCycles(music,song)).toBe(509);
  expect(snapshot(music)).toEqual(before);expect(JSON.stringify(song)).toBe(literal);
});
it('composes prediction, one real update and clock charging in that order',()=>{
  const {music}=rig(song),observed:{cost:number;state:ReturnType<typeof snapshot>}[]=[];
  const clock={advance(cost:number){observed.push({cost,state:snapshot(music)});}};
  expect(timedIntroMusicUpdate(music,song,clock)).toBe(6627);
  expect(observed).toEqual([{cost:6627,state:native.rows[0].after}]);
  expect(timedIntroMusicUpdate(music,song,clock)).toBe(509);
  expect(observed[1]).toEqual({cost:509,state:native.rows[1].after});
});
for(const property of ['pitchSlideActive','hasDutyPattern','perfectPitch','inCall','isDrumChannel','suppressed'] as const)
  it(`rejects unsupported ${property} before any real update or clock charge`,()=>{
    const {music}=rig(song);music.getChannel(1)![property]=true;
    const before=snapshot(music);let charged=0;
    expect(()=>timedIntroMusicUpdate(music,song,{advance(n){charged+=n;}})).toThrow('Unsupported');
    expect(snapshot(music)).toEqual(before);expect(charged).toBe(0);
  });
it('rejects muted music and an active fourth channel',()=>{
  const {music}=rig(song);music.audioControl={getMute:()=>1,setMute(){}};
  expect(()=>introMusicUpdateCycles(music,song)).toThrow('unmuted');music.audioControl=null;
  const four=structuredClone(song);four.channels.push({id:4,commands:[{cmd:'rest',length:1}]});music.play(four);
  expect(()=>introMusicUpdateCycles(music,four)).toThrow('three-channel');
});
it('rejects unsupported commands or software channels instead of approximating costs',()=>{
  const {music}=rig(song),bad=structuredClone(song);bad.channels[0].commands[0]={cmd:'sound_call',target:0};
  expect(()=>introMusicUpdateCycles(music,bad)).toThrow('Unsupported movie music timing command');
  bad.channels[0].id=8;expect(()=>introMusicUpdateCycles(music,bad)).toThrow('pulse/pulse/wave');
});
for(const branch of native.branches)it(`native vibrato path: direction=${branch.input.direction}, low=${branch.input.freqLow}, extents=${branch.input.extents}`,()=>{
  const {music}=rig(song);music.getChannel(2)!.active=false;music.getChannel(3)!.active=false;
  const c=music.getChannel(1)!;
  Object.assign(c,{noteDelayCounter:branch.input.delay,vibratoDelayCounter:branch.input.vibratoDelay,
    vibratoExtents:branch.input.extents,vibratoRates:branch.input.rates,freqLow:branch.input.freqLow,
    vibratoDirection:branch.input.direction});
  expect(introMusicUpdateCycles(music,song)).toBe(165+18+branch.cost);
});
