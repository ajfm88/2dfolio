// DoClearSaveDialogue (engine/movie/oak_speech/clear_save.asm), reached from the title's Up+Select+B exit. Opening
// checkpoint-07b (note 117; the trace is note 116 §2). A frame program on Oak's speech's screen model: a yield is one
// DelayFrame; VBlank's half runs first in each update (none while a palette command holds the frame). It ends where the
// code jumps to Init: 'no' at once after the menu closes, 'yes' after ClearAllSRAMBanks' frames.
import { readJoypad, setJoyIgnore } from '../input';
import { loadTileset, setActivePalette } from '../renderer';
import { playSFX } from '../audio';
import { TextBox, useBorderTiles } from '../text';
import { textBgTransfer } from '../text/bg_transfer';
import { setNoTextDelay } from '../text/text_flags';
import { holdVBlank, takeHeldFrame } from '../core/vblank_hold';
import { copyFrames } from '../overworld/sprite_sets';
import { clearSave } from '../save';
import { MenuInput } from './menu_input';
import { IntroScreen } from './intro_screen';
import { renderIntroScreen } from './intro_screen_render';

/** NO_YES_MENU (data/yes_no_menu_strings.asm): TextBoxBorder at (14, 7), inner 4 × 3, "NO" / next "YES" from (16, 8). */
export const NO_YES_BOX = { x: 14, y: 7, innerHeight: 3, innerWidth: 4 } as const;
/** `lb bc, 8, 15`: wTopMenuItemY, wTopMenuItemX. */
export const NO_YES_CURSOR = { x: 15, y: 8 } as const;
/** DisplayTwoOptionMenu's `ld c, 15` / `call DelayFrames` after the choice. */
export const TWO_OPTION_TAIL = 15;
/** ClearAllSRAMBanks with the title song playing: `jp Init` comes 12 or 13 VBlanks after the menu closes, depending on
 *  the song's position (note 116 §2.7: 13 at 55 % of positions); the port waits 13. */
export const CLEAR_SRAM_FRAMES = 13;
/** LoadFontTilePatterns and LoadTextBoxTilePatterns with the LCD on: CopyVideoDataDouble of 128 tiles, CopyVideoData of 32. */
export const FONT_TILES = 128;
export const TEXT_BOX_TILES = 32;

export type ClearSaveAnswer = 'no' | 'yes';
type DialogueRequest = { readonly frame: number; readonly kind: 'palette' | 'text' | 'menu' | 'sfx' | 'clear'; readonly value: string | number };

export class ClearSaveDialogue {
  private screen = new IntroScreen();
  private border: HTMLCanvasElement | null = null;
  private textBox = ClearSaveDialogue.createTextBox();
  private menu: MenuInput | null = null;
  private program: Generator<void, ClearSaveAnswer> | null = null;
  private printing = false;
  private frame = 0;
  private stage = 'idle';
  private requests: DialogueRequest[] = [];

  private static createTextBox(): TextBox {
    return new TextBox({ closeFrames: () => 0, updateSprites: () => {} });
  }

  async load(): Promise<void> {
    this.border = await loadTileset('/gfx/font/font_extra.png', 'MEWMON');
  }

  /** Inspection for tests: the cells written, the cells shown, the stage, the frame count and the requests. */
  get inspection() {
    return { frame: this.frame, stage: this.stage, cells: this.screen.cells, visibleCells: this.screen.visibleCells,
      menu: this.menu ? { item: this.menu.item, cursor: this.menu.cursor } : null,
      text: { active: this.textBox.active, complete: this.textBox.isComplete },
      requests: this.requests.map(request => ({ ...request })) } as const;
  }

  /** DoClearSaveDialogue up to its first DelayFrame, in the title's last step. The screen it starts on is blank. */
  start(): void {
    this.screen = new IntroScreen(); this.textBox = ClearSaveDialogue.createTextBox(); this.menu = null;
    this.printing = false; this.frame = 0; this.requests = [];
    this.program = this.run(); this.program.next();
  }

  /** One frame: VBlank's half (none in a palette command's held frames), then the CPU to its next DelayFrame. The
   *  answer in the step that jumps to Init; null while the dialogue runs. */
  update(): ClearSaveAnswer | null {
    if (!this.program) return null;
    if (!takeHeldFrame()) this.screen.vblank(this.textBox, this.printing);
    this.frame++;
    const step = this.program.next();
    if (!step.done) return null;
    this.program = null;
    return step.value;
  }

  render(): void { renderIntroScreen(this.screen, new Map()); }

  private request(kind: DialogueRequest['kind'], value: string | number): void {
    this.requests.push({ frame: this.frame, kind, value });
  }

  private *frames(count: number): Generator<void> { for (let i = 0; i < count; i++) yield; }

  /** CopyVideoData / CopyVideoDataDouble with the LCD on: no BG transfer while the batches copy. */
  private *copyTiles(tiles: number): Generator<void> {
    const enabled = textBgTransfer.enabled; textBgTransfer.enabled = false;
    try { yield* this.frames(copyFrames(tiles)); } finally { textBgTransfer.enabled = enabled; }
  }

  private drawCursor(): void {
    const menu = this.menu!;
    for (let item = 0; item <= 1; item++) this.screen.put(NO_YES_CURSOR.x, NO_YES_CURSOR.y + 2 * item, ' ');
    this.screen.put(menu.cursor.x, menu.cursor.y, '▶');
  }

  private *run(): Generator<void, ClearSaveAnswer> {
    // ClearScreen.
    this.stage = 'clear';
    this.screen.clearScreen();
    yield* this.frames(3);
    // RunDefaultPaletteCommand: wDefaultPaletteCommand is SET_PAL_GENERIC (the intro's SetPal_GameFreakIntro leaves it),
    // PalPacket_Generic (PAL_MEWMON) on the whole screen. On the CGB: two held frames, then SendSGBPackets' Delay3.
    this.stage = 'palette';
    setActivePalette('MEWMON'); if (this.border) useBorderTiles(this.border);
    this.request('palette', 'MEWMON');
    holdVBlank();
    yield* this.frames(2);
    yield* this.frames(3);
    // LoadFontTilePatterns, LoadTextBoxTilePatterns: the LCD is on.
    this.stage = 'tiles';
    yield* this.copyTiles(FONT_TILES);
    yield* this.copyTiles(TEXT_BOX_TILES);
    // PrintText ClearSaveDataText: the box, Delay3, then the text at the letter delay text_flags.ts chooses.
    this.stage = 'text';
    this.request('text', 'ClearSaveDataText');
    this.printing = true;
    this.textBox.printStandalone({ program: 'ClearSaveDataText' }); this.screen.captureText(this.textBox);
    while (!this.textBox.isComplete) yield;
    this.printing = false;
    // wJoyIgnore = PAD_B, then DisplayTextBoxID(TWO_OPTION_MENU, NO_YES_MENU).
    setJoyIgnore('b');
    this.stage = 'menu';
    this.request('menu', 'NO_YES_MENU');
    setNoTextDelay(true);
    this.screen.textBoxBorder(NO_YES_BOX.x, NO_YES_BOX.y, NO_YES_BOX.innerHeight, NO_YES_BOX.innerWidth);
    this.screen.placeString(16, 8, 'NO');
    this.screen.placeString(16, 10, 'YES');
    setNoTextDelay(false);
    this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: 1, topX: NO_YES_CURSOR.x, topY: NO_YES_CURSOR.y });
    this.drawCursor();
    for (;;) {
      yield;
      const pressed = this.menu.update(readJoypad, () => { playSFX('press_ab'); this.request('sfx', 'press_ab'); });
      this.drawCursor();
      if (pressed) break;
    }
    // B is masked, so only A chooses: wCurrentMenuItem. DelayFrames 15, then the menu's 5 × 6 tiles come back.
    const answer: ClearSaveAnswer = this.menu.item === 0 ? 'no' : 'yes';
    this.stage = `chose:${answer}`;
    yield* this.frames(TWO_OPTION_TAIL);
    this.screen.clearArea(NO_YES_BOX.x, NO_YES_BOX.y, 5, 6);
    setJoyIgnore('none');
    if (answer === 'no') return 'no';
    // ClearAllSRAMBanks, interrupts on: the save is gone, and VBlanks run on until it returns.
    this.stage = 'clear-sram';
    clearSave(); this.request('clear', 'p151-s');
    yield* this.frames(CLEAR_SRAM_FRAMES);
    return 'yes';
  }
}
