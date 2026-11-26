// ItemUseTMHM field sequence. Bag delegates its single input/BG owner while active.
import { isSoundFinished, playSFX } from '../audio';
import type { BattlePokemon } from '../battle/types';
import { getMove } from '../battle/data';
import { moveDisplayName } from '../battle/battle_move_data';
import { isPassPressed } from '../input';
import { machineMove, parseMachineId, type Bag } from '../items';
import { canLearnTM } from '../machine_compatibility';
import { isFieldStatusStarter } from '../pokemon_storage';
import { getPikachuHappiness, modifyPikachuHappiness, restorePikachuHappiness, setPikachuEmotionModifier } from '../pikachu/pikachu_happiness';
import { takeHeldFrame } from '../core/vblank_hold';
import type { BgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import { PartyMenu } from './party_menu';
import { PartyMenuOpening } from './party_menu_opening';
import { YesNoMenu } from './yes_no_menu';
import { createFieldLearnMove, type FieldLearnMove } from './field_learn_move';
import type { ScreenTiles } from './screen_tiles';

type Phase = 'boot' | 'teach' | 'yesno' | 'opening' | 'choice' | 'input-delay' | 'denied-wait' | 'retry' | 'loading' | 'learn' | 'done';
export class FieldMachine {
  readonly partyMenu = new PartyMenu();
  private phase: Phase = 'boot';
  private readonly move: number;
  private readonly name: string;
  private opening: PartyMenuOpening | null = null;
  private yesNo: YesNoMenu | null = null;
  private learner: FieldLearnMove | null = null;
  private loadError: unknown = null;
  private slot = 0;
  private wait = 0;
  paletteWhite = false;
  showsParty = false;

  constructor(private readonly box: TextBox, private readonly transfer: BgTransfer, private readonly tiles: ScreenTiles,
    private readonly bag: Bag, private readonly party: BattlePokemon[], private readonly index: number) {
    const id = bag.items[index]?.id, machine = id && parseMachineId(id), move = id && machineMove(id);
    if (!id || !machine || !move) throw new Error('invalid machine');
    this.move = move; this.name = moveDisplayName(move);
    this.print(machine.kind === 'TM' ? 'BootedUpTMText' : 'BootedUpHMText');
  }
  private print(program: string, nickname = ''): void {
    this.tiles.release(0,12,6,20);
    this.box.printStandalone({program}, {bindings:{stringBuffer:this.name,nameBuffer:nickname}});
  }
  private openParty(): void {
    this.partyMenu.showForMachine(this.party,this.box,mon=>canLearnTM(mon.species.id,this.move));
    this.partyMenu.promptVisible=false; this.showsParty=true; this.paletteWhite=true;
    this.opening=new PartyMenuOpening(this.box,this.transfer,'PartyMenuUseTMText'); this.phase='opening';
  }
  private present(): void {
    const third=this.transfer.nextPortion, enabled=this.transfer.enabled;
    if (this.box.active) {
      if (this.box.isComplete) this.box.updateDisplay(); else this.box.update();
      if(enabled) this.tiles.copyShownThird(third);
    } else this.tiles.present(this.transfer);
  }
  /** Returns true only once it is safe for the bag to rebuild its list. */
  frame(read: () => void, pressSound: () => void): boolean {
    if (takeHeldFrame()) return false;
    if (this.phase === 'learn') {
      const result=this.learner!.frame();
      if (!result) return false;
      if (result.b) {
        const mon=this.party[this.slot], id=this.bag.items[this.index]?.id;
        if (isFieldStatusStarter(mon)) {
          modifyPikachuHappiness('USEDTMHM');
          if (this.move===85 || this.move===87) { setPikachuEmotionModifier(5); restorePikachuHappiness(getPikachuHappiness(),0x85); }
        }
        if (id && parseMachineId(id)?.kind === 'TM') this.bag.removeAt(this.index,1);
      }
      this.phase='done';
      return this.finish();
    }
    this.present();
    switch(this.phase) {
      case 'boot':
        if (this.box.isComplete) { this.print('TeachMachineMoveText'); this.phase='teach'; }
        break;
      case 'teach':
        if (this.box.isComplete) { this.yesNo=new YesNoMenu(); this.yesNo.show({actualRead:true}); this.phase='yesno'; }
        break;
      case 'yesno': {
        const answer=this.yesNo!.update(read);
        if (answer==='no') { this.phase='done'; return this.finish(); }
        if (answer==='yes') { this.yesNo=null; this.openParty(); }
        break;
      }
      case 'opening':
        if (this.opening!.frame()) { this.paletteWhite=false; this.partyMenu.promptVisible=true; this.phase='choice'; return this.choose(read,pressSound); }
        else { this.paletteWhite=this.opening!.paletteWhite; this.partyMenu.promptVisible=!this.paletteWhite; }
        break;
      case 'choice': return this.choose(read,pressSound);
      case 'input-delay': if (--this.wait<=0) this.phase='choice'; break;
      case 'denied-wait':
        if (isSoundFinished()) { playSFX('denied'); this.print('MonCannotLearnMachineMoveText',this.party[this.slot].nickname); this.phase='retry'; }
        break;
      case 'retry': if (this.box.isComplete) this.openParty(); break;
      case 'loading':
        if (this.loadError) throw this.loadError;
        if (this.learner) this.phase='learn';
        break;
      case 'done': return this.finish();
    }
    return false;
  }
  private choose(read: () => void, pressSound: () => void): boolean {
    if (!this.partyMenu.ownsInput) read();
    if (!this.partyMenu.update(isPassPressed)) {
      if ((['up','down','left','right','start','select'] as const).some(isPassPressed)) { this.wait=2; this.phase='input-delay'; }
      return false;
    }
    const slot=this.partyMenu.chosenIndex;
    if (slot<0) {this.phase='done';return this.finish();}
    this.slot=slot; const mon=this.party[slot]; this.partyMenu.promptVisible=false;
    if (!canLearnTM(mon.species.id,this.move)) { this.phase='denied-wait'; return false; }
    if (mon.moves.some(move=>getMove(move.id)?.id===this.move)) {
      this.print('AlreadyKnowsText',mon.nickname); this.phase='retry'; return false;
    }
    this.phase='loading';
    void createFieldLearnMove(mon,this.move,{textBox:this.box,readJoypad:read,pressSound}).then(learner=>{this.learner=learner;},error=>{this.loadError=error;});
    return false;
  }
  private finish(): boolean {
    this.learner?.dispose(); this.yesNo=null; this.showsParty=false; this.paletteWhite=false;
    if (this.box.active) this.box.dismiss();
    return true;
  }
  renderParty(): void { this.partyMenu.render(); this.learner?.render(); }
  renderChoice(): void { this.yesNo?.render(); }
}
