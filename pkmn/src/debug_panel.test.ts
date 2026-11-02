import {beforeAll,expect,it,vi} from 'vitest';
const events=vi.hoisted(()=>({key:undefined as undefined|((e:{key:string;preventDefault():void})=>void)}));
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener:(name:string,fn:typeof events.key)=>{if(name==='keydown')events.key=fn;}}}));
vi.mock('./renderer',()=>({getCtx:vi.fn(),getScale:()=>1,resizeCanvas:vi.fn()}));
import {updateDebugPanel,isDebugEnabled} from './debug';
import {A,BattleState,PARTYMON_STRUCT_LENGTH} from './battle/battle_state';
import {loadBattleData,createPokemon} from './battle/data';
import {totalExpForLevel} from './battle/experience';
import {restoreFlags} from './events';

// DOM output double only: callbacks and the byte/object models are production code.
class Element {
  children:Element[]=[];parentElement:Element|null=null;style:Record<string,string>={};
  id='';value='';type='';min='';max='';placeholder='';onclick?:()=>void;
  onmouseenter?:()=>void;onmouseleave?:()=>void;textContent='';private html='';
  constructor(readonly tag:string){}
  get innerHTML(){return this.html;}
  set innerHTML(s:string){this.html=s;if(s==='')this.children=[];}
  appendChild(e:Element){e.parentElement=this;this.children.push(e);return e;}
  addEventListener(){} setAttribute(){}
  all():Element[]{return [this,...this.children.flatMap(c=>c.all())];}
}
const body=new Element('body');
const doc={body,activeElement:null,createElement:(tag:string)=>new Element(tag),
  getElementById:(id:string)=>body.all().find(e=>e.id===id)??null};
beforeAll(async()=>{
  vi.stubGlobal('document',doc);await loadBattleData();restoreFlags(['GOT_POKEDEX']);
  if(!isDebugEnabled())events.key!({key:'`',preventDefault(){}});
});
const section=(label:string)=>body.all().find(e=>e.style.cssText?.includes('border: 1px solid '+({PLAYER:'#4f4',ENEMY:'#f66','PARTY LEAD':'#4cf'}[label])))!;
const button=(e:Element,text:string)=>e.all().find(c=>c.tag==='button'&&c.textContent===text)!;
function state(){
  const s=new BattleState();s.mem[A.wBattleMonSpecies]=84;s.mem[A.wEnemyMonSpecies]=165;
  s.mem.set([0x8f,0x88,0x8a,0x80,0x50],A.wBattleMonNick);s.mem.set([0x91,0x80,0x93,0x50],A.wEnemyMonNick);
  s.mem[A.wBattleMonLevel]=20;s.mem[A.wEnemyMonLevel]=3;
  s.writeBE(A.wBattleMonMaxHP,500);s.writeBE(A.wEnemyMonMaxHP,300);
  s.mem.fill(7,A.wPlayerMonStatMods,A.wPlayerMonStatMods+6);s.mem.fill(7,A.wEnemyMonStatMods,A.wEnemyMonStatMods+6);
  return s;
}
function writes(s:BattleState,fn:()=>void,changes:Record<number,number>){
  const expected=s.mem.slice();Object.entries(changes).forEach(([a,v])=>expected[+a]=v);fn();
  expect(Buffer.from(s.mem).equals(Buffer.from(expected))).toBe(true);
}
it('the panel waits for initialized battle-mon bytes and adds controls on the same state after send-out',()=>{
  const s=state();s.wBattleMonSpecies=0;s.mem.fill(0,A.wBattleMonNick,A.wBattleMonNick+11);
  writes(s,()=>updateDebugPanel(s,null,undefined,undefined,[],'battle'),{});
  expect(section('PLAYER')).toBeUndefined();expect(section('ENEMY')).toBeDefined();
  s.wBattleMonSpecies=84;s.mem.set([0x8f,0x88,0x8a,0x80,0x50],A.wBattleMonNick);
  writes(s,()=>updateDebugPanel(s,null,undefined,undefined,[],'party'),{});
  expect(section('PLAYER')).toBeDefined();
});
it('battle panel callbacks poke HP, status, stage and switched EXP cells without refresh writes',()=>{
  const s=state();updateDebugPanel(s,null,undefined,undefined,[],'partyItem');
  const p=section('PLAYER'),e=section('ENEMY');expect(p).toBeDefined();expect(e).toBeDefined();
  const hp=p.all().find(c=>c.tag==='input')!;hp.value='300';
  writes(s,()=>button(p,'Set').onclick!(),{[A.wBattleMonHP]:1,[A.wBattleMonHP+1]:44});
  writes(s,()=>button(e,'Full').onclick!(),{[A.wEnemyMonHP]:1,[A.wEnemyMonHP+1]:44});
  writes(s,()=>button(p,'1').onclick!(),{[A.wBattleMonHP]:0,[A.wBattleMonHP+1]:1});
  writes(s,()=>button(p,'SLP').onclick!(),{[A.wBattleMonStatus]:3});
  writes(s,()=>button(p,'BRN').onclick!(),{[A.wBattleMonStatus]:16});
  const attackRow=p.children.find(c=>c.children.some(b=>b.textContent==='+'))!;
  writes(s,()=>button(attackRow,'+').onclick!(),{[A.wPlayerMonStatMods]:8});
  writes(s,()=>button(attackRow,'0').onclick!(),{[A.wPlayerMonStatMods]:7});
  s.mem[A.wPlayerMonNumber]=2;const a=A.wPartyMons+2*PARTYMON_STRUCT_LENGTH+14;
  const exp=totalExpForLevel(createPokemon(25,20)!.species.growthRate,21)-1;
  writes(s,()=>button(p,'Near Lvl').onclick!(),{[a]:exp>>>16,[a+1]:(exp>>>8)&255,[a+2]:exp&255});
  writes(s,()=>updateDebugPanel(s,null,undefined,undefined,[],'partyItem'),{});
  expect(body.all().some(c=>c.innerHTML.includes('State: partyItem'))).toBe(true);
  expect(button(e,'Near Lvl')).toBeUndefined();
});
it('outside battle the party lead retains object HP, status-stat effects, stages and Near Lvl controls',()=>{
  const m=createPokemon(25,20)!;updateDebugPanel(null,null,undefined,undefined,[m]);
  const p=section('PARTY LEAD');expect(p).toBeDefined();
  button(p,'1').onclick!();expect(m.currentHp).toBe(1);
  const attack=m.attack;button(p,'BRN').onclick!();expect(m.status).toBe('BRN');expect(m.attack).toBe(Math.max(1,Math.floor(attack/2)));
  button(p,'SLP').onclick!();expect(m.status).toBe('SLP');expect(m.sleepTurns).toBe(3);
  button(p,'Near Lvl').onclick!();expect(m.exp).toBe(totalExpForLevel(m.species.growthRate,21)-1);
  const stage=p.children.find(c=>c.children.some(b=>b.textContent==='+'))!;
  button(stage,'+').onclick!();expect(m.statStages.attack).toBe(1);
  expect(body.all().some(c=>c.innerHTML.includes('PARTY</b>'))).toBe(true);
});
