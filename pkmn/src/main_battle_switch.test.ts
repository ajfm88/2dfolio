import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import { pinOverworldRandom } from './test/overworld_random_pin';
import { currentOverworldRandom } from './overworld/overworld_random';
import {host,output,loadMainBattleRig,resetMainBattleRig,tick,until,world,mon,row,openParty,frameNow} from './test/main_battle_rig';
import * as audio from './audio';
import * as input from './input';
import * as renderer from './renderer';
import {BattleHost} from './battle/battle_host';
import {PlaySound} from './audio/play_sound';
import {musicNameForSound} from './audio/sound_ids';
import {getSeenList} from './pokedex_state';
import {readBattleOutputs} from './battle/battle_bridge';
import {disablePikachuFollowing} from './pikachu/pikachu_following';
import * as icons from './menus/party_icons';
import {TextBox} from './text/textbox';
import {wasLastBattleWon} from './script';
import {restoreFlags,restoreMapScripts} from './events';
import {D} from './battle/battle_end_state';
import {pokemonToBoxed} from './pokemon_storage';
import {buildOaksLabRivalBattleScript} from './story/oaks_lab';

beforeAll(()=>loadMainBattleRig());
beforeEach(resetMainBattleRig);
afterEach(()=>{host.reset();vi.restoreAllMocks();});
const pulse=()=>frameNow()%4===0?['a'] as const:[];
function begin(){host.startBattle(mon(19,3));until(()=>host.state==='battle');return host.session!;}

it('grass encounter crosses the checked transition boundary, ticks once after audio, wins and returns through the old fade/music tail',async()=>{
  await world();const map=host.gameMap;
  let point:{x:number;y:number}|undefined;
  for(let y=4;y<map.mapData!.height*4-4&&!point;y+=2)for(let x=4;x<map.mapData!.width*4-4;x+=2)
    if(map.isGrassTile(x,y)&&map.isWalkable(x,y)&&map.isWalkable(x,y-2)){point={x,y};break;}
  expect(point).toBeDefined();host.player.setTilePosition(point!.x,point!.y-2);host.player.direction='down';
  pinOverworldRandom(0);
  until(()=>host.state==='battle_transition',()=>['down']);
  const session=host.session!,created=frameNow();expect(getSeenList()).toEqual([25]);
  expect(session.state.wEnemyMonDVs).toBeDefined();
  const original=session.tick;
  const start=vi.spyOn(session,'start'),step=vi.spyOn(session,'tick'),service:{frame:number;kind:unknown}[]=[];
  step.mockImplementation(()=>{const kind=original();service.push({frame:frameNow(),kind});return kind;});
  const vblank=vi.spyOn(BattleHost.prototype,'step');
  until(()=>host.state==='battle');const boundary=frameNow();
  expect(boundary-created).toBe(121);expect(start).toHaveBeenCalledOnce();expect(step).not.toHaveBeenCalled();
  const sync=vi.spyOn(input,'syncJoypadRead'),audioPages:number[]=[];
  const realAudio=audio.tickAudio;vi.spyOn(audio,'tickAudio').mockImplementation(()=>{audioPages.push(host.pageTicks);realAudio();});
  const page=host.pageTicks;
  tick();tick();tick();
  expect(service).toEqual([{frame:boundary+1,kind:'serviced'},{frame:boundary+2,kind:'serviced'},{frame:boundary+3,kind:'serviced'}]);
  expect(sync).not.toHaveBeenCalled();expect(audioPages).toEqual([page+1,page+2,page+3]);
  expect(vblank).toHaveBeenCalledTimes(3);
  const finish=vi.spyOn(session,'finish'),requests:string[]=[];
  const realMusic=PlaySound.prototype.playMusic;vi.spyOn(PlaySound.prototype,'playMusic').mockImplementation(function(this:PlaySound,sound){
    requests.push(musicNameForSound(sound.id,sound.bank)!);return realMusic.call(this,sound);
  });
  const mapMusic=vi.spyOn(audio,'playDefaultMusicFadeOutCurrent'),six=vi.spyOn(audio,'updateMusic6Times');
  const beforeTicks=step.mock.calls.length,beforeFrame=frameNow();
  until(()=>host.state!=='battle',()=>[...pulse()]);
  expect(step.mock.calls.length-beforeTicks).toBe(frameNow()-beforeFrame);
  expect(requests).toContain('defeatedwildmon');expect(finish).toHaveBeenCalledOnce();
  const result=finish.mock.results[0].value!;
  expect(result.outcome.party[0].exp).toBe(8023);expect(host.playerParty[0].exp).toBe(result.outcome.party[0].exp);
  expect(getSeenList()).toEqual([16,25]);expect(host.state).toBe('overworld');expect(host.fade).toBe(0.875);
  expect(mapMusic).toHaveBeenCalledExactlyOnceWith('routes1',true);
  expect(six.mock.invocationCallOrder[0]).toBeLessThan(mapMusic.mock.invocationCallOrder[0]);
  expect(host.ow.encounterCooldown).toBe(3);
  for(let n=0;n<7;n++)tick();expect(host.fade).toBe(0);
});

it('Forest sight uses generated end text and marks/turns the engaged trainer',async()=>{
  await world('ViridianForest',27,33,[mon(25,45)]);host.player.direction='right';
  const trainers=host.overworldDeps().npcs,turns=trainers.map(n=>vi.spyOn(n,'stayAndFaceAnyDirection'));
  until(()=>host.state==='battle_transition',()=>[...pulse()]);const s=host.session!;
  until(()=>host.state==='battle');const text:string[]=[];
  until(()=>host.state!=='battle',()=>{text.push(row(14),row(16));return [...pulse()];});
  expect(s.textLog).toContainEqual({label:'TrainerEndBattleText',complete:true});expect(text.some(line=>line.includes('cut it!'))).toBe(true);
  const index=turns.findIndex(spy=>spy.mock.calls.length>0);expect(index).toBeGreaterThanOrEqual(0);
  expect(trainers[index].data.defeated).toBe(true);expect(turns[index]).toHaveBeenCalledExactlyOnceWith('ViridianForest');
  expect(host.money).toBe(3070);
});

it('the actual Lab rival script passes both labels and resumes a loss without a warp',async()=>{
  const weak=mon(19,2);weak.currentHp=1;
  await world('OaksLab',4,6,[weak]);restoreFlags(['GOT_STARTER','FOLLOWED_OAK_INTO_LAB']);restoreMapScripts({});
  const commands=buildOaksLabRivalBattleScript(4,5,4,6);
  expect(commands.find(cmd=>cmd.type==='startBattle')).toMatchObject({endBattleLabels:{win:'OaksLabRivalIPickedTheWrongPokemonText',lose:'OaksLabRivalAmIGreatOrWhatText'}});
  host.startScript(commands);
  until(()=>host.state==='battle_transition',()=>[...pulse()]);const s=host.session!;
  until(()=>host.state==='battle');const warp=vi.spyOn(host.gameMap,'load');
  until(()=>host.state!=='battle',()=>[...pulse()]);
  expect(s.state.wBattleResult).toBe(1);expect(wasLastBattleWon()).toBe(false);expect(host.state).toBe('script');
  expect(warp).not.toHaveBeenCalled();expect(host.money).toBe(3000);
});

it('blackout applies byte HP before the existing map heal, halving and warp',async()=>{
  const weak=mon(19,2);weak.currentHp=1;await world('Route1',5,5,[weak]);
  host.startBattle(mon(19,20));until(()=>host.state==='battle');const s=host.session!,finish=vi.spyOn(s,'finish');
  until(()=>host.state!=='battle',()=>[...pulse()]);
  expect(finish.mock.results[0].value!.outcome.party[0].hp).toBe(0);expect(host.playerParty[0].currentHp).toBe(host.playerParty[0].maxHp);
  expect(host.money).toBe(1500);expect(host.state).toBe('transition');
  for(let n=0;n<120&&audio.isAudioFadingOut();n++)tick();
  await vi.waitFor(()=>expect(host.gameMap.mapData!.name).toBe('PalletTown'));
});

it.each([false,true])('full-party catch inserts at the box front; YES=%s presents naming and NO skips it',async yes=>{
  await world('Route1',5,5,Array.from({length:6},()=>mon()));const old=pokemonToBoxed(mon(1,10));host.boxes[0].push(old);
  host.bag.items=[{id:'MASTER_BALL',count:1}];begin();const s=host.session!,foregrounds=new Set<string>();
  until(()=>host.state!=='battle',()=>{
    foregrounds.add(s.foreground);if(s.foreground==='naming'||s.foreground==='pokedex')host.renderLiveBattle();
    if(frameNow()%4)return [];
    if(s.foreground==='pokedex')return ['b'];if(s.foreground==='naming')return ['start'];
    if(row(8).includes('YES'))return yes?['a']:['b'];
    if(row(14).includes('FIGHT')&&!s.video.textBox.active)return row(16).includes('▶')?['a']:['down'];
    return ['a'];
  });
  expect(foregrounds.has('pokedex')).toBe(true);expect(foregrounds.has('naming')).toBe(yes);
  expect(host.boxes[0]).toHaveLength(2);expect(host.boxes[0][1]).toBe(old);expect(host.boxes[0][0].speciesName).toBe('Rattata');
});

it('every foreground presents only, at live scale, including one party frameCounter increment per render',async()=>{
  await world('Route1',5,5,[mon(),mon(19,20)]);const s=begin();
  const tickSpy=vi.spyOn(s,'tick'),read=vi.spyOn(input,'readJoypad');
  vi.spyOn(renderer,'getScale').mockReturnValue(3);output.width=480;output.height=432;
  const before=output.pixel(479,431);host.renderLiveBattle();expect(output.pixel(479,431)).not.toEqual(before);
  const draw=vi.spyOn(renderer.getCtx(),'drawImage');host.renderLiveBattle();
  expect(draw).toHaveBeenCalledWith(expect.objectContaining({width:160,height:144}),0,0,480,432);
  expect(renderer.getCtx().imageSmoothingEnabled).toBe(false);expect(tickSpy).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();
  // Getter overrides only choose the renderer under test; the session/menus remain real.
  const party=vi.spyOn(s.party,'render'),name=vi.spyOn(s.naming,'render'),dex=vi.spyOn(s.pokedex,'render');
  openParty();const count=Reflect.get(s.party,'frameCounter');tickSpy.mockClear();read.mockClear();
  host.renderLiveBattle();host.renderLiveBattle();expect(Reflect.get(s.party,'frameCounter')).toBe(count+2);
  expect(party).toHaveBeenCalledTimes(2);
  for(const fg of ['partyItem','naming','pokedex'] as const){
    const getter=vi.spyOn(s,'foreground','get').mockReturnValue(fg);
    if(fg==='partyItem'){
      s.screen.bgp=0xe4;draw.mockClear();host.renderLiveBattle();
      expect(party).toHaveBeenCalledTimes(3);
      expect(draw.mock.calls.some(call=>call.length===9)).toBe(true);
      const overlay=draw.mock.calls.filter(call=>call.length===9 && (call[0] as HTMLCanvasElement).width===160
        && (call[0] as HTMLCanvasElement).height===144);
      expect(overlay.length).toBeGreaterThan(0);
      for(const call of overlay)expect(call.slice(5)).toEqual([Number(call[1])*3,Number(call[2])*3,24,24]);
    }else host.renderLiveBattle();
    getter.mockRestore();
  }
  expect(name).toHaveBeenCalledOnce();expect(dex).toHaveBeenCalledOnce();
  expect(tickSpy).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();
  tick(['down']);for(let n=0;n<3;n++)tick();tick(['a']);for(let n=0;n<3;n++)tick();tick(['down']);for(let n=0;n<3;n++)tick();tick(['a']);
  expect(s.foreground).toBe('status');
  until(()=>!s.statusView!.paletteWhite,()=>[]);
  const status=vi.spyOn(s.statusView!,'render'),statusStep=vi.spyOn(s.statusView!,'frame');tickSpy.mockClear();read.mockClear();
  host.renderLiveBattle();expect(status).toHaveBeenCalledOnce();expect(statusStep).not.toHaveBeenCalled();
  expect(tickSpy).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();
});

it('battle_choice retains the cartridge sleeping-Pikachu icon and selection gates',async()=>{
  await world('Route1',5,5,[mon(),mon(19,20)]);begin();disablePikachuFollowing();openParty();const s=host.session!;
  const iconsSpy=vi.spyOn(icons,'drawPartyIcon');host.renderLiveBattle();expect(iconsSpy.mock.calls.map(c=>c[0])).toEqual([19]);
  const print=vi.spyOn(TextBox.prototype,'printStandalone');tick(['a']);
  expect(print).toHaveBeenCalledWith({program:'SleepingPikachuText1'},{noDelay:false});
  // Observe the checked continuation without changing the unreachable scenario.
  until(()=>s.foreground==='battle',()=>[...pulse()]);
  until(()=>row(14).includes('FIGHT')&&!s.video.textBox.active,()=>[]);
  expect(s.foreground).toBe('battle');expect(s.state.wPlayerMonNumber).toBe(0);
});

it('after a faint the forced chooser ignores B and sends out a reserve on A, without a submenu',async()=>{
  const weak=mon(19,2);weak.currentHp=1;await world('Route1',5,5,[weak,mon(25,40)]);
  host.startBattle(mon(19,20));until(()=>host.state==='battle');const s=host.session!;
  until(()=>s.foreground==='party',()=>[...pulse()]);for(let n=0;n<24;n++)tick();
  for(let n=0;n<12;n++)tick(n%4===0?['b']:[]);expect(s.foreground).toBe('party');
  expect(s.state.wPlayerMonNumber).toBe(0);expect(s.done).toBe(false);
  const goBefore=s.textLog.filter(t=>t.label==='GoText').length;
  until(()=>Reflect.get(s.party,'cursor')===1,()=>frameNow()%4===0?['down']:[]);
  for(let n=0;n<3;n++)tick();tick(['a']);
  expect(s.party.choiceOverlay.at(13,12)).not.toBe('S');
  until(()=>s.state.wPlayerMonNumber===1,()=>[...pulse()]);expect(s.state.partyMons[0]!.currentHp).toBe(0);
  until(()=>s.textLog.filter(t=>t.label==='GoText').length>goBefore,()=>[...pulse()]);
  expect(s.state.wBattleMonSpecies).toBe(84);
});

it('main uses the retained evolution flags instead of checking the whole party',async()=>{
  await world('Route1',5,5,[mon(16,18)]);const s=begin();
  // The real session's final output, with no flagged level-up, is a legal no-evolution outcome.
  until(()=>host.state!=='battle',()=>[...pulse()]);
  expect(readBattleOutputs(s.state).canEvolveFlags).toBe(0);expect(host.state).toBe('overworld');
  expect(host.playerParty[0].species.id).toBe(16);expect(s.state.mem[D.wCanEvolveFlags]).toBe(0);
});

it('VBlank calls Random first in every frame outside a battle, with carry set while the timer counts, and never during one (DECISIONS #91)',async()=>{
  await world();expect(currentOverworldRandom()).toBe(host.random);
  const call=vi.spyOn(host.random,'random'),firsts:unknown[]=[];
  for(let i=0;i<4;i++){call.mockClear();tick();firsts.push(call.mock.calls[0]);}
  expect(firsts).toEqual([[1],[1],[1],[1]]);
  begin();call.mockClear();
  for(let i=0;i<30;i++)tick();
  expect(call).not.toHaveBeenCalled();
});
