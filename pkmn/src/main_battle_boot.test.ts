import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {host,loadMainBattleRig,resetMainBattleRig,documentCalls} from './test/main_battle_rig';
import * as session from './battle/battle_session';
import * as bridge from './battle/battle_bridge';
import * as trainer from './battle/battle_trainer_data';
import * as audio from './audio';
import {musicIdentity} from './audio/sound_ids';
import {readFileSync} from 'node:fs';

beforeAll(()=>loadMainBattleRig(false));
beforeEach(()=>{resetMainBattleRig();documentCalls.click=undefined;});
afterEach(()=>{host.reset();vi.restoreAllMocks();});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}

it.each([0,1,2,3])('boot awaits loader %s independently; unlock caches victory tracks for synchronous numeric playback',async blocked=>{
  const gates=Array.from({length:4},deferred);
  const loaders=[vi.spyOn(session,'loadBattleSessionData').mockReturnValue(gates[0].promise),
    vi.spyOn(session,'loadBattleStandInData').mockReturnValue(gates[1].promise),
    vi.spyOn(bridge,'loadBattleBridgeData').mockReturnValue(gates[2].promise),
    vi.spyOn(trainer,'loadTrainerSpeciesData').mockReturnValue(gates[3].promise)];
  const fetchData=globalThis.fetch;
  const fetched:string[]=[];
  const fetching=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
    const name=String(url);fetched.push(name);
    if(name.endsWith('.tilemap')){
      const bytes=readFileSync('static/'+name.replace(/^\//,''));
      return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)} as Response;
    }
    return fetchData(url,init);
  });
  const preload=vi.spyOn(audio,'preloadMusic');
  const pending=host.init();
  await vi.waitFor(()=>loaders.forEach(loader=>expect(loader).toHaveBeenCalledOnce()));
  expect(host.state).not.toBe('splash');expect(documentCalls.click).toBeUndefined();
  gates.forEach((gate,i)=>{if(i!==blocked)gate.resolve();});
  await new Promise<void>(resolve=>setImmediate(resolve));
  expect(host.state).not.toBe('splash');expect(documentCalls.click).toBeUndefined();
  gates[blocked].resolve();await pending;
  expect(host.state).toBe('splash');expect(documentCalls.click).toBeTypeOf('function');
  expect(preload).not.toHaveBeenCalled();
  if(blocked!==3)return;
  await documentCalls.click!();
  expect(host.state).toBe('title_screen');
  const tracks=['defeatedwildmon','defeatedtrainer','defeatedgymleader'];
  for(const name of tracks){
    expect(preload.mock.calls.map(call=>call[0])).toContain(name);
    expect(fetched.filter(url=>url===`audio/music/${name}.json`)).toHaveLength(1);
  }
  const engines=audio.getBattleAudioEngines(),play=vi.spyOn(engines.music,'play');
  fetching.mockClear();
  for(const name of tracks){
    engines.banks.stopAllMusic();const at=play.mock.calls.length;
    engines.banks.playMusic(musicIdentity(name)!);
    expect(play.mock.calls.length).toBe(at+1);expect(engines.music.isPlaying()).toBe(true);
  }
  expect(fetching).not.toHaveBeenCalled();
});
