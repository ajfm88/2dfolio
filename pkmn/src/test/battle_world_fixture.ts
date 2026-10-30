import { createPokemon } from '../battle/data';
import type { BattleWorld } from '../battle/battle_bridge';
export function battleWorld(overrides: Partial<BattleWorld> = {}): BattleWorld {
  const mon = createPokemon(25,20,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;
  mon.otName='ASH'; mon.otId=0;
  mon.moves=[{id:'THUNDERSHOCK',pp:30,maxPp:30}];
  return { options:{textSpeed:'FAST',animation:'OFF',battleStyle:'SHIFT'}, badges:[],mapName:'Route1',
    eventFlags:[],pikachuHappiness:90,pikachuMood:128,pikachuEmotionModifier:0,
    playerName:'ASH',rivalName:'GARY',gymLeaderNo:0,partyIndex:0,opponent:0xa5,enemyLevel:3,
    party:[mon],money:3000,seen:[25],owned:[25],bag:[{id:'POKE_BALL',count:3}],pcBoxes:[[]],currentPcBox:0,...overrides };
}
