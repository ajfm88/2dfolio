import { vi } from 'vitest';
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}},localStorage:{getItem:()=>null}}));
vi.mock('../debug',()=>({isNoClip:()=>false,isNoEncounters:()=>false,consumeDebugWarp:()=>null}));
import * as main from '../main';
import * as renderer from '../renderer';
import * as audio from '../audio';
import * as input from '../input';
import { GBSynthesizer } from '../audio/synthesizer';
import { RasterCanvas } from './raster_canvas';
import { installNodeImageData } from '../rom/node_image_data';
import { injectRawImage } from '../renderer/renderer';
import { PNG } from 'pngjs';
import { readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { initTextSystem,loadGameText } from '../text';
import { loadTextPrograms } from '../text/program_data';
import { setTextSpeed } from '../text/textbox';
import { loadMapSpriteSets } from '../overworld/sprite_sets';
import { stageTogglesFromEvents } from './toggle_state';
import { loadBattleTransitionData } from '../overworld/battle_transition_choice';
import { createPokemon,loadBattleData } from '../battle/data';
import { loadTrainerData } from '../battle/trainer_ai';
import { loadBattleSessionData,loadBattleStandInData,createBattleSession } from '../battle/battle_session';
import type { BattleRandomState } from '../battle/battle_random_state';
import type { BattlePokemon } from '../battle/types';
import type { GameMap,Player } from '../overworld';
import type { OverworldDeps,OverworldState } from '../overworld';
import { loadPikachuMovementData, type PikachuFollower } from '../pikachu';
import { enablePikachuFollowing } from '../pikachu/pikachu_following';
import { restoreFlags,restoreMapScripts } from '../events';
import { restorePokedex } from '../pokedex_state';
import { setPlayerName,setRivalName } from '../core/player_state';
import { setJoyIgnore } from '../input/joy_ignore';
import { setSpriteIndex } from '../overworld/sprite_index';
import { updateSprites } from '../overworld/sprites';
import { textBgTransfer } from '../text/bg_transfer';
import { resetListStateForEmptySlot,setPartyAndBillsSavedMenuItem } from '../list_state';
import type { GameButton } from '../core';
import type { ScriptCommand } from '../script';
import type { OptionMenu } from '../menus/option_menu';
import type { Bag } from '../items';
import type { BoxedPokemon } from '../pokemon_storage';

export type Session=ReturnType<typeof createBattleSession>;
export const host=(main as unknown as {mainTest:{
  reset():void;gameTick():void;checkUiEntry():void;renderLiveBattle():void;init():Promise<void>;
  startBattle(mon:BattlePokemon):void;startTrainerBattle(name:string,index:number,opts?:{endBattleLabels?:{win:string;lose:string}}):void;
  startScript(commands:ScriptCommand[]):void;finishFade():Promise<void>;
  handleWarpLoad(name:string,warp:number,pos?:{x:number;y:number}):Promise<void>;
  overworldDeps():OverworldDeps;ow:OverworldState;state:string;session:Session|null;
  player:Player;gameMap:GameMap;pikachuFollower:PikachuFollower;playerParty:BattlePokemon[];
  readonly pageTicks:number;readonly random:BattleRandomState;readonly fade:number;money:number;
  readonly boxes:BoxedPokemon[][];readonly bag:Bag;readonly optionMenu:OptionMenu;
  readonly battleEntry:{screen:{vblank():void}|null}|null;
}}).mainTest;
export {audio,input,renderer};
export let output:RasterCanvas;
let now=1000,frame=0;
export const keys:GameButton[]=['a','b','start','select','up','down','left','right'];
export const documentCalls={click:undefined as undefined|(()=>Promise<void>),add:vi.fn()};
export async function loadMainBattleRig(preloadVictories=true){
  installNodeImageData();output=new RasterCanvas();
  vi.stubGlobal('document',{createElement:()=>new RasterCanvas(),getElementById:(id:string)=>id==='screen'?output:null,
    addEventListener:(name:string,fn:()=>Promise<void>)=>{documentCalls.add(name);if(name==='click')documentCalls.click=fn;},removeEventListener(){}});
  vi.stubGlobal('window',{innerWidth:480,innerHeight:432,addEventListener(){}});
  vi.stubGlobal('navigator',{maxTouchPoints:0});
  vi.stubGlobal('requestAnimationFrame',vi.fn());vi.stubGlobal('Worker',class{onmessage:unknown});
  renderer.initRenderer();
  const gfx=resolve(__dirname,'../../static/gfx');
  for(const file of readdirSync(gfx,{recursive:true}) as string[]){
    if(!file.endsWith('.png'))continue;const p=PNG.sync.read(readFileSync(resolve(gfx,file)));
    injectRawImage('/gfx/'+file.replace(/\\/g,'/'),new ImageData(new Uint8ClampedArray(p.data),p.width,p.height));
  }
  await Promise.all([initTextSystem(),loadGameText(),loadTextPrograms(),loadMapSpriteSets(),loadBattleTransitionData(),
    loadBattleData(),loadTrainerData(),loadPikachuMovementData(),host.player.loadSprite(),host.pikachuFollower.loadSprite()]);
  await loadBattleSessionData(async file=>{const p=PNG.sync.read(readFileSync('static/'+file));return {width:p.width,height:p.height,data:p.data};});
  await loadBattleStandInData();vi.spyOn(GBSynthesizer.prototype,'resume').mockResolvedValue();
  audio.initAudio();await audio.resumeAudio();
  await Promise.all(['wildbattle','trainerbattle','gymleaderbattle','finalbattle','defeatedwildmon','defeatedtrainer','defeatedgymleader',
    'meetrival','meetprofoak','meetmaletrainer','pallettown','routes1','cities1'].filter(name=>preloadVictories||!name.startsWith('defeated')).map(audio.preloadMusic));
}
export function resetMainBattleRig(){
  vi.spyOn(GBSynthesizer.prototype,'resume').mockResolvedValue();
  host.reset();restoreFlags(['GOT_STARTER','GOT_POKEDEX','FOLLOWED_OAK_INTO_LAB','BATTLED_RIVAL_IN_OAKS_LAB']);restoreMapScripts({});
  stageTogglesFromEvents(); // the toggle flags those four events stand for (V5c checkpoint-03b)
  restorePokedex([25],[25]);enablePikachuFollowing();setJoyIgnore('none');setPlayerName('ASH');setRivalName('GARY');setSpriteIndex(0);
  host.money=3000;host.boxes.forEach(box=>box.splice(0));resetListStateForEmptySlot();
  setPartyAndBillsSavedMenuItem(0);output.width=160;output.height=144;
  Object.assign(host.optionMenu.getOptions(),{textSpeed:'FAST',animation:'OFF',battleStyle:'SET'});setTextSpeed('fast');
  keys.forEach(k=>input.setKey(k,false));input.updateInput();input.syncJoypadRead();
  textBgTransfer.enabled=true;textBgTransfer.resetPortion();frame=0;
  vi.spyOn(performance,'now').mockImplementation(()=>now);
}
export function tick(pressed:GameButton[]=[]){
  now+=1000/59.7275+0.001;frame++;
  keys.forEach(k=>input.setKey(k,pressed.includes(k)));input.updateInput();host.gameTick();host.checkUiEntry();
}
export function frameNow(){return frame;}
export const mon=(id=25,level=20)=>{const m=createPokemon(id,level,undefined,{atk:9,def:8,spd:8,spc:8})!;m.moves=[{id:'TACKLE',pp:35,maxPp:35}];return m;};
export async function world(map='Route1',x=5,y=5,party=[mon()]){
  host.playerParty.push(...party);await host.handleWarpLoad(map,0,{x,y});await host.finishFade();host.state='overworld';
  host.ow.doorExitStep=false;host.ow.justWarped=false;host.ow.encounterCooldown=0;
  updateSprites(host.overworldDeps().npcs,host.gameMap,host.player,host.pikachuFollower);
}
export function until(predicate:()=>boolean,press:()=>GameButton[]=()=>frameNow()%4===0?['a']:[],limit=15000){
  for(let i=0;i<limit&&!predicate();i++)tick(press());
  if(!predicate())throw new Error(`main drive bound: ${host.state}, ${host.session?.foreground}, ${JSON.stringify(host.session?.textLog.slice(-5))}`);
}
export function row(y:number){return host.session?.screen.cells.slice(y*20,(y+1)*20).map(c=>typeof c==='string'?c:' ').join('')??'';}
export function openParty(){
  until(()=>host.session?.foreground==='party',()=>{
    if(frameNow()%4)return [];
    if(row(14).includes('FIGHT')&&!host.session!.video.textBox.active)return host.session!.screen.at(15,14)==='▶'?['a']:['right'];
    return ['a'];
  });
  for(let n=0;n<24;n++)tick();
}
