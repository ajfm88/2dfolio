// BillsPC_ (engine/pokemon/bills_pc.asm), on the parent's retained display.
import type { TextBox } from '../text/textbox';
import type { BgTransfer } from '../text/bg_transfer';
import { setNoTextDelay } from '../text/text_flags';
import {
  getListScrollOffset, setListScrollOffset, getPartyAndBillsSavedMenuItem,
  setPartyAndBillsSavedMenuItem, setCurrentMenuItem,
} from '../list_state';
import { MONS_PER_BOX, pokemonToBoxed, isStarterPikachuBoxed } from '../pokemon_storage';
import { isStarterPikachu } from '../pikachu/pikachu_follower';
import { modifyPikachuHappiness } from '../pikachu/pikachu_happiness';
import { monDisplayName } from '../pokemon_names';
import type { PcStorage } from './pc';
import { PcDisplay } from './pc_display';
import { MenuInput } from './menu_input';
import { ListMenu, type MonListChoice } from './list_menu';
import { YesNoMenu } from './yes_no_menu';
import type { ScreenSnapshot, ScreenTiles } from './screen_tiles';
import { StatusScreenSession } from './status_screen';
import { drawFadeOverlay } from '../renderer';
import { POKEBALL_GLYPH } from './menu_glyphs';
import { NUM_BOXES } from '../pokemon_storage';

const SILENT = () => {};
/** Playback and its cry-length wait remain J2, including the starter's PCM clips. */
function playCry(_species: string): void {}

export class BillsPc extends PcDisplay {
  private parentItem = 0;
  private readonly savedOffset: number;
  private list: ListMenu<'mons'> | null = null;
  private yesNo: YesNoMenu | null = null;
  private selected: Extract<MonListChoice, { type: 'chosen' }> | null = null;
  private submenu = false;
  private finished = false;
  private stats: StatusScreenSession | null = null;
  private returnWhite = false;
  private buffer1: ScreenSnapshot | null = null;
  private changingBox = false;
  private boxChooser = false;

  constructor(
    tiles: ScreenTiles, textBox: TextBox, transfer: BgTransfer, onSprites: () => void,
    private readonly storage: PcStorage, private readonly buffer2: ScreenSnapshot,
  ) {
    super(tiles, textBox, transfer, onSprites);
    this.savedOffset = getListScrollOffset();
  }

  get ownsBgTransfer(): boolean { return this.stats !== null; }
  get paletteWhite(): boolean { return this.stats?.paletteWhite ?? this.returnWhite; }
  get fullScreen(): boolean { return this.stats !== null || this.returnWhite; }
  renderOverlay(): void {
    if (this.stats) this.stats.render();
    else if (this.returnWhite) drawFadeOverlay(1);
    else this.yesNo?.render();
  }

  enter(): void {
    setNoTextDelay(true);
    // 30 HP/status tiles, CopyVideoData's 8 tiles per frame; then one ball tile.
    const enabled = this.transfer.enabled; this.transfer.enabled = false;
    this.delayed = { remaining: 4, then: () => { this.transfer.enabled = enabled; this.mainMenu(); } };
  }

  frame(readJoypad: () => void): boolean {
    if (this.finished) return true;
    if (this.stats) {
      if (this.stats.frame(readJoypad) === 'done') {
        this.stats = null;
        this.returnWhite = true;
        this.tiles.restore(this.buffer1!, this.textBox, this.transfer);
        // RunDefaultPaletteCommand (CGB) Delay3, then HandleMenuInput Delay3.
        this.delayed = { remaining: 3, then: () => { this.returnWhite = false; this.submenuInput(1); } };
      }
      return false;
    }
    if (this.advancePending()) return this.finished;
    if (this.yesNo) {
      const answer = this.yesNo.update(readJoypad);
      if (answer) {
        this.yesNo = null;
        if (this.changingBox) {
          this.changingBox = false;
          if (answer === 'no') this.mainMenu(); else this.chooseBox();
        } else if (answer === 'no') this.openList();
        else this.release();
      }
    } else if (this.list) {
      const answer = this.list.update(readJoypad, SILENT);
      setListScrollOffset(this.list.offset); setCurrentMenuItem(this.list.item);
      if (answer) {
        setPartyAndBillsSavedMenuItem(this.list.item); this.list = null;
        if (answer.type === 'cancelled') this.mainMenu();
        else {
          this.selected = answer;
          if (this.parentItem === 2) this.confirmRelease();
          else if (this.parentItem === 1 && isStarterPikachu(this.storage.party[answer.index]) && this.storage.isPikachuFollowingDisabled())
            this.print('SleepingPikachuText2', () => this.mainMenu());
          else this.depositWithdrawMenu();
        }
      }
    } else if (this.menu) {
      const hit = this.menu.update(readJoypad, SILENT);
      this.drawCursor(hit && !this.submenu && !this.boxChooser && !hit.includes('b') ? '▷' : '▶');
      if (hit) {
        const item = this.menu.item; this.menu = null;
        if (this.boxChooser) {
          this.boxChooser = false;
          if (hit.includes('b')) this.mainMenu();
          else this.waitSound('save', () => {
            this.storage.setCurrentBox(item);
            this.storage.saveGame();
            this.mainMenu();
          }, true);
        } else if (this.submenu) {
          if (hit.includes('b') || item === 2) this.mainMenu();
          else if (item === 0) this.moveMon();
          else this.viewStats();
        } else if (hit.includes('b') || item === 5) this.exit();
        else { this.parentItem = item; this.chooseMain(); }
      }
    }
    return this.finished;
  }

  private mainMenu(): void {
    // Each pass copies the ball tile (one frame) before restoring Buffer2.
    this.transfer.enabled = false;
    this.delayed = { remaining: 1, then: () => {
      this.tiles.restore(this.buffer2, this.textBox, this.transfer);
      this.transfer.enabled = false; this.cursor = null; this.submenu = false;
      this.tiles.textBoxBorder(0, 12, 4, 18);
      this.tiles.textBoxBorder(0, 0, 12, 12);
      this.onSprites();
      this.tiles.placeString(2, 2, 'WITHDRAW \uE001\uE002<NEXT>DEPOSIT \uE001\uE002<NEXT>RELEASE \uE001\uE002<NEXT>CHANGE BOX<NEXT>PRINT BOX<NEXT>SEE YA!');
      setPartyAndBillsSavedMenuItem(0); setListScrollOffset(0); setCurrentMenuItem(this.parentItem);
      this.tiles.textBoxBorder(9, 14, 2, 9);
      this.tiles.placeString(10, 16, 'BOX No.');
      const number = String(this.storage.getCurrentBox() + 1);
      this.tiles.placeString(19 - number.length, 16, number);
      this.transfer.enabled = true;
      this.delayed = { remaining: 3, then: () => {
        this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: 5, topX: 1, topY: 2, item: this.parentItem });
        this.drawCursor('▶');
      } };
    } };
  }

  private chooseMain(): void {
    const box = this.box();
    if (this.parentItem === 0) {
      if (box.length === 0) this.print('NoMonText', () => this.mainMenu());
      else if (this.storage.party.length === 6) this.print('CantTakeMonText', () => this.mainMenu());
      else this.openList();
    } else if (this.parentItem === 1) {
      if (this.storage.party.length === 1) this.print('CantDepositLastMonText', () => this.mainMenu());
      else if (box.length === MONS_PER_BOX) this.print('BoxFullText', () => this.mainMenu());
      else this.openList();
    } else if (this.parentItem === 2) {
      if (box.length === 0) this.print('NoMonText', () => this.mainMenu());
      else this.openList();
    } else if (this.parentItem === 3) this.print('WhenYouChangeBoxText', () => {
      this.changingBox = true;
      this.yesNo = new YesNoMenu(); this.yesNo.show({ actualRead: true, silent: true });
    });
    else if (box.length === 0) this.print('NoPokemonText', () => this.mainMenu());
    else this.mainMenu(); // Nonempty printer screen remains J2.
  }

  private box() { return this.storage.boxes[this.storage.getCurrentBox()]; }

  private openList(): void {
    const mons = this.parentItem === 1 ? this.storage.party : this.box();
    this.list = new ListMenu(this.tiles, { kind: 'mons', entries: mons.map(mon => ({ name: monDisplayName(mon), level: mon.level })),
      offset: getListScrollOffset(), item: getPartyAndBillsSavedMenuItem() }, this.transfer);
    // DisplayListMenuID's extra PCPOKEMONLISTMENU UpdateSprites, before its 10 frames.
    this.onSprites(); this.onSprites();
  }

  private depositWithdrawMenu(): void {
    this.submenu = true;
    this.tiles.textBoxBorder(9, 10, 6, 9);
    this.tiles.placeString(11, 12, this.parentItem === 0 ? 'WITHDRAW' : 'DEPOSIT');
    this.tiles.placeString(11, 14, 'STATS<NEXT>CANCEL');
    setListScrollOffset(0); setPartyAndBillsSavedMenuItem(0);
    this.cursor = null; this.submenuInput(0);
  }

  private submenuInput(item: number): void {
    this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: 2, topX: 10, topY: 12, item });
    this.drawCursor('▶');
  }

  private viewStats(): void {
    this.buffer1 = this.tiles.save(this.textBox);
    const mon = this.parentItem === 1 ? this.storage.party[this.selected!.index]
      : this.storage.deserialize(this.box()[this.selected!.index]);
    if (!mon) throw new Error('Cannot display stored Pokemon stats');
    this.stats = new StatusScreenSession(mon, { syncRead: false });
  }

  private chooseBox(): void {
    this.transfer.enabled = false;
    this.tiles.textBoxBorder(0, 0, 2, 9);
    this.print('ChooseABoxText', () => {
      this.tiles.textBoxBorder(11, 0, 12, 7);
      for (let i = 0; i < NUM_BOXES; i++) {
        this.tiles.placeString(13, i + 1, i < 9 ? `BOX ${i + 1}` : `BOX${i + 1}`);
        if (this.storage.boxes[i].length > 0) this.tiles.put(18, i + 1, POKEBALL_GLYPH);
      }
      this.tiles.placeString(1, 2, 'BOX No.');
      const number = String(this.storage.getCurrentBox() + 1);
      this.tiles.placeString(10 - number.length, 2, number);
      this.transfer.enabled = true;
      this.onSprites(); this.cursor = null; this.boxChooser = true;
      this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: 11, topX: 12, topY: 1,
        item: this.storage.getCurrentBox(), rowStep: 1 });
      this.drawCursor('▶');
    });
  }

  private moveMon(): void {
    const index = this.selected!.index;
    const box = this.box();
    if (this.parentItem === 1) {
      const mon = this.storage.party[index];
      playCry(mon.species.name);
      if (isStarterPikachu(mon)) modifyPikachuHappiness('DEPOSITED');
      box.push(pokemonToBoxed(mon));
      this.storage.party.splice(index, 1);
    } else {
      const mon = this.storage.deserialize(box[index]);
      if (!mon) throw new Error('Cannot deserialize stored Pokemon');
      playCry(box[index].speciesName);
      this.storage.party.push(mon);
      box.splice(index, 1);
    }
    this.waitCurrentSound(() => this.print(this.parentItem === 1 ? 'MonWasStoredText' : 'MonIsTakenOutText',
      () => this.mainMenu(), { stringBuffer: this.selected!.name, boxNumString: String(this.storage.getCurrentBox() + 1) }));
  }

  private confirmRelease(): void {
    if (isStarterPikachuBoxed(this.box()[this.selected!.index])) {
      playCry(this.box()[this.selected!.index].speciesName);
      this.print('PikachuUnhappyText', () => this.mainMenu(), { nameBuffer: this.selected!.name });
    } else this.print('OnceReleasedText', () => {
      this.yesNo = new YesNoMenu(); this.yesNo.show({ actualRead: true, silent: true });
    }, { stringBuffer: this.selected!.name });
  }

  private release(): void {
    const [mon] = this.box().splice(this.selected!.index, 1);
    this.waitCurrentSound(() => {
      playCry(mon.speciesName);
      this.print('MonWasReleasedText', () => this.mainMenu(), { stringBuffer: this.selected!.name });
    });
  }

  private exit(): void {
    this.tiles.restore(this.buffer2, this.textBox, this.transfer);
    setListScrollOffset(this.savedOffset); setNoTextDelay(false);
    this.finished = true;
  }
}
