import { Bag } from '../items';
import { liveBattleWorld, type LiveBattleEncounter } from '../battle/battle_live';
import { BattleState } from '../battle/battle_state';
import { writeBattleInputs, readBattleOutputs, type BattleWorld } from '../battle/battle_bridge';
import { battleWorld } from './battle_world_fixture';
import { restorePokedex, getSeenList, getOwnedList } from '../pokedex_state';
import { restorePikachuHappiness, getPikachuEmotionModifier, setPikachuEmotionModifier } from '../pikachu/pikachu_happiness';
import { setLastBattleWon } from '../script/script_controller';

export function liveFixture(overrides: Partial<BattleWorld> = {}, encounter: LiveBattleEncounter = {kind:'wild',species:19,level:3}) {
  const source = battleWorld({pikachuEmotionModifier:getPikachuEmotionModifier(),...overrides});
  const values = {money:source.money,seen:[...source.seen],owned:[...source.owned],happiness:source.pikachuHappiness,mood:source.pikachuMood,won:false};
  const party = [...source.party], boxes = source.pcBoxes.map(box => [...box]), bag = new Bag();
  bag.items = source.bag.map(item => ({...item}));
  const world = liveBattleWorld({...source,party,pcBoxes:boxes,bag:bag.items},encounter);
  const live = {party,boxes,bag,setPikachuEmotionModifier,
    setMoney(value:number) { values.money=value; },
    restorePokedex(seen:number[],owned:number[]) { restorePokedex(seen,owned); values.seen=getSeenList();values.owned=getOwnedList(); },
    restorePikachuHappiness(h:number,m:number) { restorePikachuHappiness(h,m);values.happiness=h;values.mood=m; },
    setLastBattleWon(won:boolean) { setLastBattleWon(won);values.won=won; },
  };
  const state = new BattleState(); writeBattleInputs(state,world);
  return {world,live,values,state,encounter,outcome:() => readBattleOutputs(state),
    snapshot:() => structuredClone({party,boxes,bag:bag.items,values,modifier:getPikachuEmotionModifier()}),
    input:(blackoutCarry=false) => ({world,encounter,blackoutCarry})};
}
