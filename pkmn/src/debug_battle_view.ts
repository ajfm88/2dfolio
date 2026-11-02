import { A, NAME_LENGTH, PARTYMON_STRUCT_LENGTH, POKEDEX_ORDER, type BattleState } from './battle/battle_state';
import { decodeBattleText } from './battle/battle_text_codec';
import { getSpeciesById } from './battle/data';
import type { StatusCondition } from './battle/types';

const STAGES = ['attack', 'defense', 'speed', 'special', 'accuracy', 'evasion'] as const;
type Stage = typeof STAGES[number];
const STATUS = { PSN: 8, BRN: 16, FRZ: 32, PAR: 64, SLP: 3 };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.trunc(n)));

/** A memory poke, between ticks: no party mirror write, stat effect or forced HUD redraw. */
export function debugBattleMon(state: BattleState, enemy = false) {
  // Every battle cell below is named in battle_state.ts's A table.
  const cells = enemy ? {
    hp:A.wEnemyMonHP,max:A.wEnemyMonMaxHP,status:A.wEnemyMonStatus,level:A.wEnemyMonLevel,
    species:A.wEnemyMonSpecies,nick:A.wEnemyMonNick,attack:A.wEnemyMonAttack,
    defense:A.wEnemyMonDefense,speed:A.wEnemyMonSpeed,special:A.wEnemyMonSpecial,stages:A.wEnemyMonStatMods,
  } : {
    hp:A.wBattleMonHP,max:A.wBattleMonMaxHP,status:A.wBattleMonStatus,level:A.wBattleMonLevel,
    species:A.wBattleMonSpecies,nick:A.wBattleMonNick,attack:A.wBattleMonAttack,
    defense:A.wBattleMonDefense,speed:A.wBattleMonSpeed,special:A.wBattleMonSpecial,stages:A.wPlayerMonStatMods,
  };
  // A.wPartyMons + current slot * PARTYMON_STRUCT_LENGTH; MON_EXP=$0e, rb3
  // (constants/pokemon_data_constants.asm and macros/ram.asm). Re-read slot after switching.
  const expAddress = () => A.wPartyMons + state.mem[A.wPlayerMonNumber] * PARTYMON_STRUCT_LENGTH + 14;
  const statStages = {} as Record<Stage, number>;
  STAGES.forEach((key,index) => Object.defineProperty(statStages,key,{
    get:() => state.mem[cells.stages+index]-7,
    set:(value:number) => { state.mem[cells.stages+index]=clamp(value,-6,6)+7; },
  }));
  return {
    memoryPoke:true as const, enemy, statStages,
    get nickname() { return decodeBattleText(state.mem,cells.nick,NAME_LENGTH); },
    get level() { return state.mem[cells.level]; },
    get species() { return getSpeciesById(POKEDEX_ORDER[state.mem[cells.species]-1])!; },
    get currentHp() { return state.readBE(cells.hp); },
    set currentHp(value:number) { state.writeBE(cells.hp,clamp(value,0,state.readBE(cells.max))); },
    get maxHp() { return state.readBE(cells.max); },
    get attack() { return state.readBE(cells.attack); },
    get defense() { return state.readBE(cells.defense); },
    get speed() { return state.readBE(cells.speed); },
    get special() { return state.readBE(cells.special); },
    get status():StatusCondition {
      const byte=state.mem[cells.status];
      return byte&7?'SLP':byte&8?'PSN':byte&16?'BRN':byte&32?'FRZ':byte&64?'PAR':null;
    },
    set status(value:StatusCondition) { state.mem[cells.status]=value===null?0:STATUS[value]; },
    get exp() { const a=expAddress();return state.mem[a]*65536+state.mem[a+1]*256+state.mem[a+2]; },
    set exp(value:number) {
      if(enemy) return;
      const a=expAddress(),v=clamp(value,0,0xffffff);
      state.mem[a]=v>>>16;state.mem[a+1]=(v>>>8)&255;state.mem[a+2]=v&255;
    },
  };
}
export type DebugBattleMon = ReturnType<typeof debugBattleMon>;

export function debugBattleInfo(state:BattleState,foreground:string) {
  return {foreground,playerSpeed:state.readBE(A.wBattleMonSpeed),enemySpeed:state.readBE(A.wEnemyMonSpeed),
    exp:debugBattleMon(state).exp,catchRate:state.mem[A.wEnemyMonActualCatchRate],baseExp:state.mem[A.wEnemyMonBaseExp]};
}
