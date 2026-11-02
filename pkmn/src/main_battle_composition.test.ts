import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {host,output,loadMainBattleRig,resetMainBattleRig,until,world,mon,row,frameNow} from './test/main_battle_rig';
import {renderBattleScreen} from './battle/battle_screen_render';
import {BattleUnsupportedState} from './battle/battle_move_data';
import {A} from './battle/battle_state';
import {getSeenList,getOwnedList} from './pokedex_state';
import {getPikachuHappiness,getPikachuMood} from './pikachu';
import {createHash} from 'node:crypto';
import * as sessions from './battle/battle_session';
import {pokemonToBoxed} from './pokemon_storage';

beforeAll(()=>loadMainBattleRig());
beforeEach(resetMainBattleRig);
afterEach(()=>{host.reset();vi.restoreAllMocks();});
const pulse=()=>frameNow()%4===0?['a'] as const:[];
function begin(){host.startBattle(mon(19,3));until(()=>host.state==='battle');return host.session!;}
function live(){return JSON.stringify({party:host.playerParty,boxes:host.boxes,bag:host.bag.items,money:host.money,
  seen:getSeenList(),owned:getOwnedList(),happiness:getPikachuHappiness(),mood:getPikachuMood()});}

it('item0: entry snapshots copy party and current-box arrays while retaining mon objects',async()=>{
  await world();host.boxes[0].push(pokemonToBoxed(mon(19,10)));
  const create=vi.spyOn(sessions,'createBattleSession');host.startBattle(mon(19,3));
  const entry=create.mock.calls[0][0];
  expect(entry.party).not.toBe(host.playerParty);expect(entry.party[0]).toBe(host.playerParty[0]);
  expect(entry.pcBoxes).not.toBe(host.boxes);
  expect(entry.pcBoxes[entry.currentPcBox]).not.toBe(host.boxes[entry.currentPcBox]);
  expect(entry.pcBoxes[entry.currentPcBox][0]).toBe(host.boxes[entry.currentPcBox][0]);
});

it('item0: changing the live party mid-session rejects finish with no live write',async()=>{
  await world();const s=begin();host.playerParty.push(mon(19,10));
  const before=live();let caught:unknown;
  try { until(()=>host.state!=='battle',()=>[...pulse()]); } catch(error) { caught=error; }
  expect(caught).toBeInstanceOf(BattleUnsupportedState);
  expect((caught as Error).message).toContain('live owners changed during battle');
  expect(s.done).toBe(true);expect(live()).toBe(before);
});

function region(pixels:Uint8ClampedArray,x:number,y:number,w:number,h:number){
  const result=new Uint8ClampedArray(w*h*4);
  for(let r=0;r<h;r++)result.set(pixels.subarray(((y+r)*160+x)*4,((y+r)*160+x+w)*4),r*w*4);
  return createHash('sha256').update(result).digest('hex');
}
function itemInput(){
  if(frameNow()%4)return [];
  const s=host.session!;
  if(s.foreground==='partyItem')return [];
  if(s.state.mem[A.hJoy7]===1)return ['a'] as const;
  if(row(14).includes('FIGHT')&&!s.video.textBox.active)return row(16).includes('\u25b6')?['a'] as const:['down'] as const;
  return ['a'] as const;
}
function showItemRegion(x:number,y:number,w:number,h:number){
  const s=host.session!;s.party.render();const list=output.pixels.slice();
  const battle=renderBattleScreen(s.screen,s.renderTiles);host.renderLiveBattle();
  expect(region(output.pixels,x,y,w,h)).toBe(region(battle,x,y,w,h));
  return {list,battle,hash:region(output.pixels,x,y,w,h)};
}
it('partyItem Potion presents white, list, shown prompt and animated HP number pixels',async()=>{
  const p=mon();p.currentHp=10;await world('Route1',5,5,[p,mon(19,20)]);host.bag.items=[{id:'POTION',count:1}];
  const s=begin();until(()=>s.foreground==='partyItem',()=>[...itemInput()]);
  expect(s.screen.bgp).toBe(0);const party=vi.spyOn(s.party,'render');host.renderLiveBattle();
  expect(party).not.toHaveBeenCalled();
  expect(output.pixels).toEqual(renderBattleScreen(s.screen,s.renderTiles));
  expect(new Set(Array.from(output.pixels).filter((_v,i)=>i%4!==3)).size).toBe(1);
  until(()=>s.foreground==='partyItem'&&s.screen.bgp!==0&&s.screen.visibleCells.some(c=>c==='?'),()=>[]);
  const prompt=showItemRegion(0,96,160,48);
  expect(region(output.pixels,0,0,160,96)).toBe(region(prompt.list,0,0,160,96));
  const old=region(output.pixels,0,96,160,48);
  // Logical writes have not transferred yet. The mask must use shown cells.
  expect(s.screen.visibleAt(19,12)).not.toBe(' ');s.screen.put(19,12,' ');
  host.renderLiveBattle();expect(region(output.pixels,0,96,160,48)).toBe(old);
  expect(s.screen.visibleAt(3,0)).toBe(' ');
  s.party.render();const name=region(output.pixels,24,0,8,8);
  expect(name).not.toBe(region(prompt.battle,24,0,8,8));
  s.screen.put(3,0,'Q');host.renderLiveBattle();
  expect(region(output.pixels,24,0,8,8)).toBe(name);s.screen.put(3,0,' ');
  until(()=>s.foreground==='partyItem'&&s.screen.visibleAt(15,1)!==' ',()=>[...pulse()]);
  const hp=showItemRegion(13*8,8,3*8,8);
  expect(hp.hash).not.toBe(region(hp.list,13*8,8,3*8,8));
  expect({prompt:prompt.hash,hp:hp.hash}).toMatchSnapshot();
});
it('partyItem Ether presents its move box over the list and retains outside pixels',async()=>{
  const p=mon();p.moves[0].pp=3;await world('Route1',5,5,[p,mon(19,20)]);host.bag.items=[{id:'ETHER',count:1}];
  const s=begin();until(()=>s.foreground==='partyItem',()=>[...itemInput()]);
  until(()=>s.screen.visibleAt(4,7)!==' '&&s.screen.bgp!==0,()=>[...pulse()]);
  const moves=showItemRegion(4*8,7*8,16*8,5*8);
  expect(region(output.pixels,0,0,160,56)).toBe(region(moves.list,0,0,160,56));
  expect(region(output.pixels,0,56,32,40)).toBe(region(moves.list,0,56,32,40));
  expect(moves.hash).toMatchSnapshot();
});
