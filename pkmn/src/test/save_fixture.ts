import {createPokemon} from '../battle/data';
import {depositMon,boxStatsMon} from '../pokemon_transfers';
import type {SaveDataV1} from '../save';

export function trainedSaveMon(){
  const p=createPokemon(19,20,'SLEEPY',{atk:9,def:8,spd:7,spc:6})!;
  p.currentHp=7;p.exp=8023;p.status='SLP';p.sleepTurns=5;p.otName='ASH';p.otId=0x1234;
  p.statExp=[65535,2000,256,63002,0];
  p.moves=[{id:'TACKLE',pp:1,maxPp:35},{id:'GROWL',pp:2,maxPp:47},
    {id:'TAIL_WHIP',pp:3,maxPp:42},{id:'QUICK_ATTACK',pp:4,maxPp:48}];
  return boxStatsMon(depositMon(p));
}
export function frontSaveBox(){
  return [16,19,1].map((id,index)=>{
    const p=createPokemon(id,10+index,undefined,{atk:9,def:8,spd:7,spc:6})!;
    p.exp+=3;p.otName='ASH';p.otId=0x1234;return depositMon(p);
  });
}
export function legacySave():SaveDataV1 {
  const p={speciesName:'Rattata',nickname:'SLEEPY',level:10,currentHp:7,
    moves:[{id:'TACKLE',pp:1,maxPp:35}],status:'SLP' as const,atkDV:9,defDV:8,spdDV:7,spcDV:6,
    exp:1735,statExp:[65535,2000,256,63002,0] as [number,number,number,number,number],otName:'ASH',otId:0x1234};
  return {version:1,mapName:'Route1',playerX:80,playerY:80,playerDirection:'down',party:[p,{...p,status:null}],
    bag:[{id:'POTION',count:2}],money:1234,defeatedTrainers:[],
    pcBoxes:[[{...p,maxHp:34},{...p,status:null,maxHp:34}]],currentPcBox:0,
    eventFlags:['GOT_STARTER','GOT_POKEDEX','FOLLOWED_OAK_INTO_LAB','BATTLED_RIVAL_IN_OAKS_LAB'],
    pokedexSeen:[19],pokedexOwned:[19],pikachuHappiness:150,pikachuMood:210};
}
