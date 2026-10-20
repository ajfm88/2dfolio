// engine/movie/oak_speech/{oak_speech,oak_speech2}.asm. Resume CPU work after each VBlank.
import { setPlayerName, setRivalName } from '../core/player_state';
import { loadTileset, loadSpriteMapped, obpMapping, drawSprite, setActivePalette } from '../renderer';
import { readJoypad } from '../input';
import { playSFX, playMusic, stopMusic, fadeOutAndStopMusic } from '../audio';
import { TextBox, useBorderTiles } from '../text';
import { textBgTransfer } from '../text/bg_transfer';
import { MenuInput } from './menu_input';
import { IntroScreen, type IntroCell } from './intro_screen';
import { introPictureCanvas, renderIntroScreen } from './intro_screen_render';

const PLAYER_NAMES = ['NEW NAME', 'YELLOW', 'ASH', 'JACK'];
const RIVAL_NAMES = ['NEW NAME', 'BLUE', 'GARY', 'JOHN'];
type Target = 'player' | 'rival';
export type OakSpeechAction = null | { type: 'openNamingScreen'; target: Target } | { type: 'done' };
interface AudioRequest { readonly frame: number; readonly kind: 'stop' | 'music' | 'sfx' | 'fade'; readonly value: string | number }

export class OakSpeech {
  private screen = new IntroScreen();
  private readonly pictures = new Map<string, HTMLCanvasElement>();
  private readonly sprites = new Map<number, HTMLCanvasElement>();
  private border: HTMLCanvasElement | null = null;
  private textBox = this.createTextBox();
  private program: Generator<void> | null = null;
  private frame = 0;
  private printing = false;
  private menuVisible = false;
  private nameMenu = new MenuInput({ watched: ['a'], maxItem: 3, topX: 1, topY: 2 });
  private namingTarget: Target = 'player';
  private naming = false;
  private action: OakSpeechAction = null;
  private stage = 'idle';
  private third: number | null = null;
  private prepareSprites = false;
  private shadowVisible = false;
  private spriteVisible = false;
  private requests: AudioRequest[] = [];

  constructor(private readonly cryCue: (species: string) => void = () => {}) {}
  private createTextBox(): TextBox {
    return new TextBox({ closeFrames: () => 0, updateSprites: () => {}, cry: species => this.cryCue(species) });
  }
  /** CPU writes, transferred tiles, VRAM and DMA-visible OBJ are separate snapshots. No clocks here. */
  get inspection() {
    return { frame: this.frame, stage: this.stage, bgp: this.screen.bgp, obp0: this.screen.obp0,
      wx: this.screen.wx, cells: this.screen.cells, visibleCells: this.screen.visibleCells, slots: this.screen.slots,
      third: this.third, nextPortion: textBgTransfer.nextPortion, transferEnabled: textBgTransfer.enabled,
      spriteVisible: this.spriteVisible, shadowVisible: this.shadowVisible,
      sprite: { x: 64, y: 60, image: 0, direction: 'down' as const },
      text: { active: this.textBox.active, complete: this.textBox.isComplete, waiting: this.textBox.isWaitingForInput },
      menu: this.menuVisible ? { target: this.namingTarget, item: this.nameMenu.item, cursor: this.nameMenu.cursor } : null,
      audioRequests: this.requests.map(request => ({ ...request })) } as const;
  }
  async load(): Promise<void> {
    // Explicit palette: boot's other parallel loaders must not change these assets' colours.
    const names = ['oak', 'pikachu', 'red', 'rival', 'shrink1', 'shrink2'];
    const urls = ['/gfx/trainers/prof.oak.png', '/gfx/sprites/front/25.png', '/gfx/player/red.png',
      '/gfx/trainers/rival1.png', '/gfx/player/shrink1.png', '/gfx/player/shrink2.png'];
    await Promise.all(names.map(async (name, index) => {
      const source = await loadTileset(urls[index], 'MEWMON');
      this.pictures.set(name, introPictureCanvas(source, name === 'pikachu'));
    }));
    this.border = await loadTileset('/gfx/font/font_extra.png', 'MEWMON');
    await Promise.all([0xd0, 0x80, 0x40, 0].map(async reg => {
      this.sprites.set(reg, await loadSpriteMapped('/gfx/sprites/red.png', obpMapping(reg), 'MEWMON'));
    }));
  }
  start(initial?: readonly IntroCell[]): void {
    this.textBox = this.createTextBox(); this.screen = new IntroScreen(initial);
    this.frame = 0; this.printing = false; this.menuVisible = false; this.naming = false;
    this.action = null; this.prepareSprites = false; this.shadowVisible = false; this.spriteVisible = false;
    this.requests = []; this.third = null; this.selectPalette();
    this.program = this.run(); this.program.next();
  }
  private selectPalette(): void {
    setActivePalette('MEWMON'); if (this.border) useBorderTiles(this.border);
  }
  continueAfterNaming(name: string): void {
    if (!this.naming) return;
    this.setName(name); this.naming = false;
    // Naming's opaque exit has already cleared the displayed map and OAM.
    this.screen.adoptBlankWindow(); this.screen.bgp = 0xe4; this.screen.obp0 = 0xd0; this.screen.wx = 7;
    this.shadowVisible = false; this.spriteVisible = false; this.selectPalette();
    this.program?.next();
  }
  /** CPU ClearScreen; its three waits belong to the program. */
  clearScreen(): void { this.textBox.dismiss(); this.screen.clearScreen(); }
  update(): OakSpeechAction {
    if (this.naming) return null;
    if (this.stage === 'done') return { type: 'done' };
    this.frame++; this.third = this.screen.vblank(this.textBox, this.printing);
    // DMA reads the previous shadow; UpdateSprites prepares the following frame.
    this.spriteVisible = this.shadowVisible; if (this.prepareSprites) this.shadowVisible = true;
    this.program?.next(); const action = this.action; this.action = null; return action;
  }
  render(): void {
    renderIntroScreen(this.screen, this.pictures, () => {
      const sprite = this.sprites.get(this.screen.obp0);
      if (this.spriteVisible && sprite) drawSprite(sprite, 0, 0, 64, 60);
    });
  }
  private *delayFrames(frames: number): Generator<void> { for (let i = 0; i < frames; i++) yield; }
  private *clear(): Generator<void> { this.clearScreen(); yield* this.delayFrames(3); }
  private *copyOtherTiles(frames: number): Generator<void> {
    const enabled = textBgTransfer.enabled; textBgTransfer.enabled = false;
    try { yield* this.delayFrames(frames); } finally { textBgTransfer.enabled = enabled; }
  }
  private *picture(name: string, flipped = false): Generator<void> {
    this.stage = `copy:${name}`; yield* this.screen.copyVideoData(name); this.screen.placePicture(flipped);
  }
  private *fadeInIntroPic(): Generator<void> {
    this.stage = 'silhouette';
    for (const bgp of [0x54, 0xa8, 0xfc, 0xf8, 0xf4, 0xe4]) {
      this.screen.bgp = bgp; yield* this.delayFrames(10);
    }
  }
  private *fade(inside: boolean): Generator<void> {
    this.stage = inside ? 'fade:in' : 'fade:out';
    const pairs = inside ? [[0x40, 0x40], [0x90, 0x80], [0xe4, 0xd0]] : [[0x90, 0x80], [0x40, 0x40], [0, 0]];
    for (const [bgp, obp0] of pairs) {
      this.screen.bgp = bgp; this.screen.obp0 = obp0; yield* this.delayFrames(8);
    }
  }
  private *movePicLeft(): Generator<void> {
    this.stage = 'window'; this.screen.wx = 119; yield; this.screen.bgp = 0xe4;
    for (;;) { yield; if (this.screen.wx === 7) return; this.screen.wx -= 8; }
  }
  private *printText(program: string): Generator<void> {
    this.stage = `text:${program}`; this.printing = true;
    this.textBox.printStandalone({ program }); this.screen.captureText(this.textBox);
    while (!this.textBox.isComplete) yield;
    this.printing = false;
  }
  private setName(name: string): void {
    if (this.namingTarget === 'player') setPlayerName(name); else setRivalName(name);
  }
  private drawCursor(): void {
    for (let row = 2; row <= 8; row += 2) this.screen.put(1, row, ' ');
    const cursor = this.nameMenu.cursor; this.screen.put(cursor.x, cursor.y, '▶');
  }
  private *chooseName(target: Target): Generator<void> {
    this.namingTarget = target; this.stage = `${target}:right`; yield* this.screen.slidePicture('right');
    const names = target === 'player' ? PLAYER_NAMES : RIVAL_NAMES;
    this.stage = `${target}:menu`; this.menuVisible = true;
    this.nameMenu = new MenuInput({ watched: ['a'], maxItem: 3, topX: 1, topY: 2 });
    this.screen.textBoxBorder(0, 0, 10, 9); this.screen.placeString(3, 0, 'NAME');
    names.forEach((name, i) => this.screen.placeString(2, 2 + i * 2, name)); this.drawCursor();
    for (;;) {
      yield; const selected = this.nameMenu.update(readJoypad, () => playSFX('press_ab'));
      this.drawCursor(); if (selected) break;
    }
    this.menuVisible = false;
    if (this.nameMenu.item === 0) {
      this.stage = `${target}:naming`; this.naming = true; this.action = { type: 'openNamingScreen', target };
      yield; // continueAfterNaming resumes this CPU, without another VBlank
      this.stage = `${target}:return`; yield* this.clear(); yield* this.delayFrames(3);
      yield* this.picture(target === 'player' ? 'red' : 'rival');
    } else {
      this.stage = `${target}:back`; this.screen.clearArea(0, 0, 12, 11); yield* this.delayFrames(10);
      this.setName(names[this.nameMenu.item]); yield* this.delayFrames(3); yield* this.screen.slidePicture('left');
    }
    yield* this.printText(target === 'player' ? 'YourNameIsText' : 'HisNameIsText');
  }
  private request(kind: AudioRequest['kind'], value: string | number): void {
    this.requests.push({ frame: this.frame, kind, value });
    if (kind === 'stop') stopMusic(); else if (kind === 'music') playMusic(value as string);
    else if (kind === 'sfx') playSFX(value as string); else fadeOutAndStopMusic(value as number);
  }
  private *run(): Generator<void> {
    this.request('stop', 0); this.request('music', 'routes2');
    this.stage = 'entry'; yield* this.clear(); yield* this.copyOtherTiles(5);
    yield* this.picture('oak'); yield* this.fadeInIntroPic(); yield* this.printText('OakSpeechText1');
    yield* this.fade(false); yield* this.clear(); yield* this.picture('pikachu', true); yield* this.movePicLeft();
    yield* this.printText('OakSpeechText2');
    yield* this.fade(false); yield* this.clear(); yield* this.picture('red'); yield* this.movePicLeft();
    yield* this.printText('IntroducePlayerText'); yield* this.chooseName('player');
    yield* this.fade(false); yield* this.clear(); yield* this.picture('rival'); yield* this.fadeInIntroPic();
    yield* this.printText('IntroduceRivalText'); yield* this.chooseName('rival');
    yield* this.fade(false); yield* this.clear(); yield* this.picture('red'); yield* this.fade(true);
    yield* this.printText('OakSpeechText3');
    this.stage = 'shrink'; this.request('sfx', 'shrink'); yield* this.delayFrames(4);
    yield* this.copyOtherTiles(2); yield* this.picture('shrink1'); yield* this.delayFrames(4);
    yield* this.picture('shrink2'); this.stage = 'shrink:hold'; this.request('fade', 10);
    yield* this.delayFrames(20); this.screen.clearArea(6, 5, 7, 7); yield* this.copyOtherTiles(5);
    this.prepareSprites = true; yield* this.delayFrames(50);
    yield* this.fade(false); yield* this.clear(); this.stage = 'done'; this.action = { type: 'done' };
  }
}
