import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isHeld, isPassPressed, syncJoypadRead } from '../input';
import { initTextSystem, setTextSpeed, TextBox } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { createPokemon, loadBattleData } from '../battle/data';
import { loadBattleMoveData } from '../battle/battle_move_data';
import { worldPartyRecord } from '../battle/battle_bridge';
import { partyRecordToPokemon } from '../battle/battle_party_codec';
import { BattleAudio } from '../battle/battle_audio';
import { getBattleAudioEngines, loadSfx } from '../audio';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import type { GameButton } from '../core';
import { createFieldLearnMove, FieldLearnMove } from './field_learn_move';

vi.mock('../input', () => ({ isHeld: vi.fn(), isPassPressed: vi.fn(), syncJoypadRead: vi.fn(), isPressed: vi.fn(), readJoypad: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true, getBattleAudioEngines: vi.fn(), loadSfx: vi.fn() }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), loadFont: vi.fn(), loadTileset: vi.fn() }));
vi.mock('../renderer/ui_tiles', () => ({ uiTiles: { cover: vi.fn() } }));
vi.mock('../overworld/ui_entry', () => ({ setOpeningSpriteUpdates: vi.fn() }));

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); await loadBattleMoveData(); });
beforeEach(() => { setTextSpeed('fast'); textBgTransfer.enabled=true; textBgTransfer.resetPortion(); });
function rig(ids: string[], keys: GameButton[][]) {
  const mon=createPokemon(25,20,'PIKA',{atk:9,def:8,spd:8,spc:8})!;
  const pp: Record<string,[number,number]>={TACKLE:[7,35],GROWL:[8,47],TAIL_WHIP:[9,30],QUICK_ATTACK:[10,36],CUT:[11,30]};
  mon.moves=ids.map(id=>({id,pp:pp[id][0],maxPp:pp[id][1]}));
  const other=createPokemon(19,10,'OTHER',{atk:8,def:8,spd:8,spc:8})!, otherBefore=worldPartyRecord(other);
  const audio=audioRig(), bridge=new BattleAudio(audio.sfx,audio.music), box=new TextBox();
  const print=vi.spyOn(box,'printStandalone');
  const transferTick=vi.spyOn(textBgTransfer,'tick');
  let frame=0, reads=0; const before=worldPartyRecord(mon);
  vi.mocked(isHeld).mockImplementation(key=>key==='a' && frame%2===0);
  vi.mocked(isPassPressed).mockReturnValue(false);
  const adapter=new FieldLearnMove(mon,85,{textBox:box,audio:bridge,swapSound:{id:0xae,data:sfxData('swap')},
    readJoypad:()=>{reads++; const pressed=keys.shift()??[]; vi.mocked(isPassPressed).mockImplementation(k=>pressed.includes(k));},pressSound:()=>{}});
  const finish=()=>{
    for (frame=0;frame<10000&&!adapter.result;frame++) {
      const priorReads=reads, priorSync=vi.mocked(syncJoypadRead).mock.calls.length, priorTick=transferTick.mock.calls.length;
      adapter.frame(); audio.update();
      expect(transferTick.mock.calls.length-priorTick).toBe(1);
      expect(reads === priorReads || vi.mocked(syncJoypadRead).mock.calls.length === priorSync).toBe(true);
      if (!adapter.result) expect(worldPartyRecord(mon)).toEqual(before);
    }
    expect(adapter.result).not.toBeNull(); expect(worldPartyRecord(other)).toEqual(otherBefore); bridge.dispose(); transferTick.mockRestore();
    return adapter.result;
  };
  return {mon,box,adapter,finish,before,print,reads:()=>reads};
}
describe('field LearnMove adapter',()=>{
  it('cold field rig loads its swap sound and releases borrowed audio hooks',async()=>{
    const audio=audioRig(), previous=audio.sfx.onSfxChannelDone;
    vi.mocked(loadSfx).mockResolvedValue(sfxData('swap'));
    vi.mocked(getBattleAudioEngines).mockReturnValue({sfx:audio.sfx,music:audio.music,banks:audio.fade.requests});
    const mon=createPokemon(25,20,'PIKA',{atk:9,def:8,spd:8,spc:8})!;
    mon.moves=[{id:'TACKLE',pp:35,maxPp:35}];
    const box=new TextBox(); let frame=0;
    vi.mocked(isHeld).mockImplementation(key=>key==='a' && frame%2===0);
    const adapter=await createFieldLearnMove(mon,85,{textBox:box,readJoypad:()=>{},pressSound:()=>{}});
    expect(loadSfx).toHaveBeenCalledWith('swap');
    for (;frame<5000&&!adapter.result;frame++) {adapter.frame();audio.update();}
    expect(adapter.result).toEqual({b:1}); expect(mon.moves[1].id).toBe('THUNDERBOLT');
    expect(audio.sfx.onSfxChannelDone).toBe(previous);
  });
  it('learns into empty slot and survives record round trip',()=>{
    const r=rig(['TACKLE'],[]); expect(r.finish()).toEqual({b:1});
    expect(r.mon.moves[1]).toEqual({id:'THUNDERBOLT',pp:15,maxPp:15});
    expect(partyRecordToPokemon(worldPartyRecord(r.mon)).moves).toEqual(r.mon.moves);
  });
  it('replaces a full slot, resetting PP Ups and preserving the other moves',()=>{
    const r=rig(['TACKLE','GROWL','TAIL_WHIP','QUICK_ATTACK'],[['a'],['down'],['a']]);
    const old=r.mon.moves.map(m=>({...m})); expect(r.finish()).toEqual({b:1});
    expect(r.mon.moves[1]).toEqual({id:'THUNDERBOLT',pp:15,maxPp:15});
    expect([r.mon.moves[0],...r.mon.moves.slice(2)]).toEqual([old[0],...old.slice(2)]);
  });
  it('refuses to delete an HM and retries the forget choice',()=>{
    const r=rig(['CUT','GROWL','TAIL_WHIP','QUICK_ATTACK'],[['a'],['a'],['down'],['a']]);
    expect(r.finish()).toEqual({b:1}); expect(r.mon.moves[0].id).toBe('CUT'); expect(r.mon.moves[1].id).toBe('THUNDERBOLT');
    expect(r.print.mock.calls.map(([source]) => 'program' in source ? source.program : '')).toEqual([
      'TryingToLearnText','WhichMoveToForgetText','HMCantDeleteText','WhichMoveToForgetText','OneTwoAndText','LearnedMove1Text']);
    expect(r.adapter.tiles.at(14,7)).toBeNull();
  });
  it('B then YES abandons without changing the mon',()=>{
    const r=rig(['TACKLE','GROWL','TAIL_WHIP','QUICK_ATTACK'],[['b'],['a']]);
    expect(r.finish()).toEqual({b:0}); expect(worldPartyRecord(r.mon)).toEqual(r.before);
  });
  it('NO to abandonment retries the learn choice',()=>{
    const r=rig(['TACKLE','GROWL','TAIL_WHIP','QUICK_ATTACK'],[['b'],['b'],['a'],['a']]);
    expect(r.finish()).toEqual({b:1}); expect(r.mon.moves[0].id).toBe('THUNDERBOLT');
  });
});
