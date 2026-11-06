import { beforeAll,beforeEach,expect,it,vi } from 'vitest';
const output=vi.hoisted(()=>({volume:[] as string[],text:[] as unknown[][],assets:[] as string[],fallback:vi.fn()}));
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
vi.mock('../renderer',async orig=>({...await orig() as object,fillRect:vi.fn(),drawFadeOverlay:vi.fn(),drawTile:vi.fn(),
 getCtx:()=>({drawImage(){},save(){},restore(){},translate(){},scale(){}}),getScale:()=>1,getMonsterPalette:()=>'MEWMON',
 loadFont:async(path:string)=>{output.assets.push('font '+path);return {width:128};},
 loadTileset:async(path:string)=>{output.assets.push('tiles '+path);return {width:128};},
 loadSprite:async(path:string)=>{output.assets.push('sprite '+path);return {width:16};},
 loadBattleSprite:vi.fn(async()=>({width:40,height:40}))}));
vi.mock('../menus/party_icons',()=>({loadPartyIcons:vi.fn(async()=>{output.assets.push('icons');}),drawPartyIcon:vi.fn()}));
vi.mock('../menus/menu_render',()=>({drawText:(...a:unknown[])=>output.text.push(a),drawBox:vi.fn(),drawScreenTile:vi.fn(),drawChar:vi.fn()}));
vi.mock('../text',async orig=>({...await orig() as object,getFontCanvas:()=>({width:128}),drawTileBorder:vi.fn()}));
vi.mock('./battle_ui',async orig=>({...await orig() as object,loadPokemonSprites:async()=>({front:{width:56,height:56}})}));
vi.mock('../audio',async orig=>({...await orig() as object,playSFX:output.fallback,
 setMasterVolume:(l:number,r:number)=>output.volume.push(`vol ${l}${r}`)}));
vi.mock('../audio/audio_flags',async orig=>{
 const real=await orig() as typeof import('../audio/audio_flags');
 return {...real,setNoAudioFadeOut:(v:boolean)=>{output.volume.push(`fade ${v}`);real.setNoAudioFadeOut(v);}};
});
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createPokemon } from './data';
import { loadTextPrograms } from '../text/program_data';
import { rig,musicData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity,musicNameForSound } from '../audio/sound_ids';
import { setKey,updateInput,syncJoypadRead } from '../input';
import { resetListStateForEmptySlot } from '../list_state';
import { loadBattleSessionData,loadBattleStandInData,createBattleSession,createSessionRandom } from './battle_session';
import { applyBattleOutcome, type LiveBattleEncounter } from './battle_live';
import { liveFixture } from '../test/battle_live_fixture';
import { pokemonToBoxed } from '../pokemon_storage';
import type { BattleWorld } from './battle_bridge';
import type { GameButton } from '../core';
import { setTextSpeed } from '../text/textbox';

const keys:GameButton[]=['a','b','up','down','left','right','start','select'];
beforeAll(async()=>{
  await loadTextPrograms();await loadBattleSessionData(async file=>{
    const p=PNG.sync.read(readFileSync('static/'+file));return {width:p.width,height:p.height,data:p.data};
  });await loadBattleStandInData();
});
beforeEach(()=>{keys.forEach(k=>setKey(k,false));updateInput();syncJoypadRead();resetListStateForEmptySlot();});
const mon=(id=25,level=20)=>{const m=createPokemon(id,level,undefined,{atk:9,def:8,spd:8,spc:8})!;m.moves=[{id:'TACKLE',pp:35,maxPp:35}];return m;};
function run(overrides:Partial<BattleWorld>={},encounter:LiveBattleEncounter={kind:'wild',species:19,level:3},catching=false) {
  const f=liveFixture({party:[mon()],options:{textSpeed:'FAST',animation:'OFF',battleStyle:'SET'},...overrides},encounter);
  const speed = { FAST: 'fast', MID: 'medium', SLOW: 'slow' } as const;
  setTextSpeed(speed[f.world.options.textSpeed]);
  const originals=[...f.live.party],oldBox=[...f.live.boxes[f.world.currentPcBox]],r=rig();let time=0;
  const banks=new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank)=>r.music.play(musicData(musicNameForSound(id,bank)!))));
  const session=createBattleSession(f.world,{random:createSessionRandom(()=>time),audio:()=>({sfx:r.sfx,music:r.music,banks})});
  const row=(y:number)=>session.screen.cells.slice(y*20,(y+1)*20).map(c=>typeof c==='string'?c:' ').join('');
  const printed:string[]=[];
  banks.playMusic(musicIdentity(encounter.kind==='trainer'?'trainerbattle':'wildbattle')!);session.start();
  try {
    for(;!session.done&&time<16000;){
      let pressed:GameButton[]=[];
      if(time%4===0){
        if(session.foreground==='pokedex')pressed=['b'];
        else if(row(8).includes('YES'))pressed=['b'];
        else if(catching&&row(14).includes('FIGHT')&&!session.video.textBox.active)pressed=row(16).includes('▶')?['a']:['down'];
        else pressed=session.video.textBox.isWaitingForInput?['b']:['a'];
      }
      time++;keys.forEach(k=>setKey(k,pressed.includes(k)));updateInput();if(session.pendingFrame!=='dark')r.update();session.tick();
      for(let y=13;y<18;y++)printed.push(row(y));
    }
    expect(session.done,JSON.stringify(session.textLog.slice(-6))).toBe(true);
    const result=session.finish();
    const plan=applyBattleOutcome(result.outcome,f.live,f.input(result.blackoutCarry));
    originals.forEach((m,i)=>expect(f.live.party[i]).toBe(m));
    return {...f,session,result,plan,printed,oldBox};
  }catch(error){if(!session.done)session.abort();throw error;}
}
it('Route1 win writes absolute EXP and money and the seen bit, with no evolution',()=>{
  const h=run();expect(h.live.party[0].exp).toBe(8024);expect(h.values.money).toBe(3000);
  expect(h.values.seen).toEqual([19,25]);expect(h.plan.evolutions).toEqual([]);expect(h.values.won).toBe(true);
});
it('Forest trainer labels reach the real end-battle text and defeat plan',()=>{
  const map=JSON.parse(readFileSync('data/maps/ViridianForest.json','utf8'));
  const trainer=map.npcs.find((n:{trainerClass?:string})=>n.trainerClass);
  const h=run({party:[mon(25,45)],mapName:'ViridianForest'}, {
    kind:'trainer',trainerClass:trainer.trainerClass,partyIndex:trainer.trainerParty,endBattleText:trainer.endBattleTextLabels,gymLeaderNo:0,
  });
  expect(h.plan.trainerDefeated).toBe(true);expect(h.values.money).toBe(3070);
  expect(h.session.textLog).toContainEqual({label:'TrainerEndBattleText',complete:true});
  expect(h.printed.some(row=>row.includes('CATERPIE'))).toBe(true);
  expect(h.printed.some(row=>row.includes('cut it!'))).toBe(true);
});
it('Oak lab loss has result1 and script loss but no blackout carry or trainer defeat',()=>{
  const weak=mon(19,2);weak.currentHp=1;
  const h=run({party:[weak],mapName:'OaksLab'}, {kind:'trainer',trainerClass:'RIVAL1',partyIndex:0,gymLeaderNo:0,
    endBattleText:{win:'OaksLabRivalIPickedTheWrongPokemonText',lose:'OaksLabRivalAmIGreatOrWhatText'}});
  expect(h.plan).toMatchObject({lost:true,blackout:false,trainerDefeated:false,battleResult:1});
  expect(h.values.won).toBe(false);expect(h.live.party[0].currentHp).toBe(0);
});
it('a full-party catch inserts at the front before the old box objects and writes owned/bag absolutely',()=>{
  const old=pokemonToBoxed(mon(1,10));
  const h=run({party:Array.from({length:6},()=>mon()),pcBoxes:[[old]],bag:[{id:'MASTER_BALL',count:1}]},undefined,true);
  expect(h.live.boxes[0]).toHaveLength(2);expect(h.live.boxes[0][1]).toBe(old);
  expect(h.live.boxes[0][0].speciesName).toBe('Rattata');expect(h.live.boxes[0][0].nickname).toBe('Rattata');
  expect(h.live.bag.items).toEqual([]);expect(h.values.owned).toContain(19);expect(h.plan.lost).toBe(false);
});
it('wild blackout keeps the byte HP and money; the returned map plan owns the later heal and halving',()=>{
  const weak=mon(19,2);weak.currentHp=1;
  const h=run({party:[weak]},{kind:'wild',species:19,level:20});
  expect(h.plan).toMatchObject({lost:true,blackout:true,trainerDefeated:false,battleResult:1});
  expect(h.live.party[0].currentHp).toBe(0);expect(h.values.money).toBe(3000);
});
