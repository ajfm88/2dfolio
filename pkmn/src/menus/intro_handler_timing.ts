// Opening checkpoint-12b2c2-2b (note 131): the instruction-cost streams of the movie's two interrupt handlers, VBlank
// (home/vblank.asm and every routine it calls) and LCDC (home/lcdc.asm). UNUSED: no Boot, main, movie program or audio
// caller imports this file. Timing arithmetic over the handler's branch inputs, read at its first instruction: no ROM,
// opcode table, address dispatch or recorded cost replay. Each yielded step is one native instruction (machine cycles),
// except the Audio1_UpdateMusic callee, which is one step whose cycles the owner supplies from the reviewed movie-music
// predictor (entry through RET, excluding the CALL, exactly that predictor's definition).
//
// The stream starts at the vector's `jp` (the dispatch itself belongs to checkpoint-2a's CPU model) and ends with the
// RETI, which the owner executes through that model's reti. IME is off throughout both handlers, so no step accepts an
// interrupt; an owner still advances the display clock instruction by instruction, because the handler's stores (rSCX,
// rSCY, rWY, rDMA, rAUDVOL) take effect four dots before their instruction ends (note 129's READ_OLD point; checked here
// against the cartridge) and an OAM DMA must be latched where it really happens.
//
// Branch domain: every branch the real cartridge takes between PlayIntroScene's entry and PrepareTitleScreen (note 131
// §2: seven histories, 2279 VBlank services). Branches it never takes there are refused with a RangeError instead of
// being guessed: an active VBlankCopyBgMap, RedrawRowOrColumn, VBlankCopyDouble or tile animation, a WY update
// disabled, PrepareOAMData's sprite loop or its first-call HideSprites path, the game timer counting or maxed, joypad
// polling disabled, CountDownIgnoreInputBitReset's joypad-enable path, an audio fade or its NR50 skip, the low-health
// alarm, the printer's serial handshake and a non-zero hLCDCPointer.

/** One native instruction. `routine` marks the first instruction of a called routine (pret's label); `store` marks a
 *  CPU store whose effect is four dots before the instruction ends; `reti` is the handler's final instruction. */
export interface IntroHandlerStep {
  readonly cycles: number;
  readonly routine?: IntroHandlerRoutine;
  readonly store?: IntroHandlerStore;
  /** A shared-state write the composed runner performs at the same store point (four dots before the step ends). */
  readonly effect?: IntroHandlerEffect;
  readonly reti?: true;
}
export type IntroHandlerStore = 'scx' | 'scy' | 'wy' | 'dma' | 'nr50';
/** Semantic writes of the handler's own shared fields (checkpoint 134-1): `ldh [hVBlankOccurred],a` after `xor a`,
 *  `ldh [hFrameCounter],a` after `dec a`, `ldh [hVBlankCopySize],a` after `xor a`, `ldh [hJoyInput],a`. */
export type IntroHandlerEffect = 'advance-bg-transfer-portion' | 'clear-vblank-occurred' | 'decrement-frame-counter' | 'consume-copy' | 'sample-joypad';
export type IntroHandlerRoutine =
  | 'VBlank' | 'AutoBgMapTransfer' | 'VBlankCopyBgMap' | 'RedrawRowOrColumn' | 'VBlankCopy' | 'VBlankCopyDouble'
  | 'UpdateMovingBgTiles' | 'hDMARoutine' | 'PrepareOAMData' | 'TrackPlayTime' | 'CountDownIgnoreInputBitReset'
  | 'Random' | 'Bankswitch' | 'JumpToAddress' | 'Random_' | 'ReadJoypad' | 'BankswitchCommon' | 'ReadJoypad_'
  | 'FadeOutAudio' | 'Music_DoLowHealthAlarm' | 'Audio1_UpdateMusic' | 'SerialFunction' | 'LCDC';

/** The VBlank handler's branch inputs, as the bytes are at its first instruction (pret names). */
export interface IntroVBlankInputs {
  wDisableVBlankWYUpdate: number;
  hAutoBGTransferEnabled: number;
  hAutoBGTransferPortion: number;
  hVBlankCopyBGSource: number;
  hRedrawRowOrColumnMode: number;
  hVBlankCopySize: number;
  hVBlankCopyDoubleSize: number;
  hTileAnimations: number;
  wUpdateSpritesEnabled: number;
  wIgnoreInputCounter: number;
  wStatusFlags5: number;
  wReachedMaxInGameTime: number;
  wStatusFlags6: number;
  hDisableJoypadPolling: number;
  hVBlankOccurred: number;
  hFrameCounter: number;
  wAudioFadeOutControl: number;
  wStatusFlags2: number;
  wLowHealthAlarm: number;
  wPrinterConnectionOpen: number;
}

const BIT_DISABLE_JOYPAD = 5;         // constants/ram_constants.asm, wStatusFlags5
const BIT_GAME_TIMER_COUNTING = 0;    // wStatusFlags6
const BIT_NO_AUDIO_FADE_OUT = 1;      // wStatusFlags2
const DMA_WAIT_LOOPS = 0x28;          // hDMARoutine's `ld a, $28`
const TILE_PAIRS = 8;                 // VBlankCopy: TILE_SIZE / 2 pops per tile
const THIRD_ROWS = 6;                 // SCREEN_HEIGHT / 3
const ROW_PAIRS = 10;                 // SCREEN_WIDTH / 2

/** A routine-entry marker inside the private streams: it labels the next real step and is never yielded outward. */
interface Enter { readonly enter: IntroHandlerRoutine }
type Item = IntroHandlerStep | Enter;
function* s(...cycles: number[]): Generator<Item> { for (const c of cycles) yield { cycles: c }; }
/** Like s(), but the last cycle count carries `effect`. */
function* se(effect: IntroHandlerEffect, ...cycles: number[]): Generator<Item> {
  for (const [n, c] of cycles.entries()) yield n === cycles.length - 1 ? { cycles: c, effect } : { cycles: c };
}
function* enter(routine: IntroHandlerRoutine): Generator<Item> { yield { enter: routine }; }
function* call(routine: IntroHandlerRoutine): Generator<Item> { yield { cycles: 6 }; yield { enter: routine }; }
/** Attach each marker to the step that follows it. */
function* labelled(items: Iterable<Item>): Generator<IntroHandlerStep> {
  let routine: IntroHandlerRoutine | null = null;
  for (const item of items) {
    if ('enter' in item) { routine = item.enter; continue; }
    if (routine !== null) { yield { ...item, routine }; routine = null; } else yield item;
  }
}

function byte(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError(`Invalid intro handler input ${name}`);
  return value;
}
function refuse(what: string): never { throw new RangeError(`Intro VBlank ${what} is outside the movie's measured branch domain`); }

const INPUT_KEYS: readonly (keyof IntroVBlankInputs)[] = [
  'wDisableVBlankWYUpdate', 'hAutoBGTransferEnabled', 'hAutoBGTransferPortion', 'hVBlankCopyBGSource',
  'hRedrawRowOrColumnMode', 'hVBlankCopySize', 'hVBlankCopyDoubleSize', 'hTileAnimations', 'wUpdateSpritesEnabled',
  'wIgnoreInputCounter', 'wStatusFlags5', 'wReachedMaxInGameTime', 'wStatusFlags6', 'hDisableJoypadPolling',
  'hVBlankOccurred', 'hFrameCounter', 'wAudioFadeOutControl', 'wStatusFlags2', 'wLowHealthAlarm', 'wPrinterConnectionOpen',
];

function validate(i: IntroVBlankInputs): void {
  for (const name of INPUT_KEYS) byte(i[name], name);
  if (i.wDisableVBlankWYUpdate) refuse('with the WY update disabled');
  if (i.hVBlankCopyBGSource) refuse('VBlankCopyBgMap');
  if (i.hRedrawRowOrColumnMode) refuse('RedrawRowOrColumn');
  if (i.hVBlankCopyDoubleSize) refuse('VBlankCopyDouble');
  if (i.hTileAnimations) refuse('UpdateMovingBgTiles');
  if (i.wUpdateSpritesEnabled === 0 || i.wUpdateSpritesEnabled === 1) refuse('PrepareOAMData sprite work');
  if (i.wReachedMaxInGameTime & 1 || i.wStatusFlags6 & (1 << BIT_GAME_TIMER_COUNTING)) refuse('play-time counting');
  if (i.wIgnoreInputCounter === 1 && i.wStatusFlags5 & (1 << BIT_DISABLE_JOYPAD)) refuse('joypad re-enable');
  if (i.hDisableJoypadPolling) refuse('with joypad polling disabled');
  if (i.wAudioFadeOutControl) refuse('audio fade-out');
  if (i.wStatusFlags2 & (1 << BIT_NO_AUDIO_FADE_OUT)) refuse('without the NR50 reset');
  if (i.wLowHealthAlarm) refuse('low-health alarm');
  if (i.wPrinterConnectionOpen & 1) refuse('printer handshake');
}

/** The VBlank handler from `jp VBlank` at $0040 through its RETI. `audioCycles` is Audio1_UpdateMusic's callee cost
 *  (entry through RET), predicted by the owner before the paired real update. Inputs are copied at the call. */
export function* introVBlankSteps(inputs: IntroVBlankInputs, audioCycles: number): Generator<IntroHandlerStep> {
  if (!Number.isSafeInteger(audioCycles) || audioCycles < 1) throw new RangeError('Invalid intro VBlank audio cycles');
  const i = { ...inputs };
  validate(i);
  yield* labelled(vblank(i, audioCycles));
}

function* vblank(i: IntroVBlankInputs, audioCycles: number): Generator<Item> {
  yield* s(4); // jp VBlank (the vector)
  yield* enter('VBlank');
  yield* s(4, 4, 4, 4);                // push af/bc/de/hl
  yield* s(3, 4, 1, 3);                // ldh a,[rVBK]; push af; xor a; ldh [rVBK],a
  yield* s(3, 4);                      // ldh a,[hLoadedROMBank]; ld [wVBlankSavedROMBank],a
  yield* s(3); yield { cycles: 3, store: 'scx' };
  yield* s(3); yield { cycles: 3, store: 'scy' };
  yield* s(4, 1, 2);                   // ld a,[wDisableVBlankWYUpdate]; and a; jr nz (not taken)
  yield* s(3); yield { cycles: 3, store: 'wy' };
  yield* call('AutoBgMapTransfer'); yield* autoBgMapTransfer(i);
  yield* call('VBlankCopyBgMap'); yield* s(3, 1, 5);         // inactive: ret z taken
  yield* call('RedrawRowOrColumn'); yield* s(3, 1, 5);
  yield* call('VBlankCopy'); yield* vblankCopy(i.hVBlankCopySize);
  yield* call('VBlankCopyDouble'); yield* s(3, 1, 5);
  yield* call('UpdateMovingBgTiles'); yield* s(3, 1, 5);
  yield* call('hDMARoutine');
  yield* s(2); yield { cycles: 3, store: 'dma' };            // ld a,HIGH(wShadowOAM); ldh [rDMA],a
  yield* s(2);                                               // ld a,$28
  for (let n = DMA_WAIT_LOOPS; n > 1; n--) yield* s(1, 3);   // dec a; jr nz (taken)
  yield* s(1, 2, 4);                                         // last dec a; jr nz (not taken); ret
  yield* s(2, 3, 4);                                         // ld a,BANK(PrepareOAMData); ldh [hLoadedROMBank],a; ld [rROMB],a
  yield* call('PrepareOAMData'); yield* s(4, 1, 2, 2, 5);    // ld a,[..]; dec a; jr z (not); cp -1; ret nz (taken)
  yield* call('TrackPlayTime'); yield* trackPlayTime(i);
  yield* call('Random'); yield* random();
  yield* call('ReadJoypad'); yield* readJoypad();
  // hVBlankOccurred: clear it if set
  yield* s(3, 1); if (i.hVBlankOccurred) yield* se('clear-vblank-occurred', 2, 1, 3); else yield* s(3);
  // hFrameCounter: decrement it if non-zero
  yield* s(3, 1); if (i.hFrameCounter) yield* se('decrement-frame-counter', 2, 1, 3); else yield* s(3);
  yield* call('FadeOutAudio');
  yield* s(4, 1, 2, 4, 2, 2, 2); yield { cycles: 3, store: 'nr50' }; yield* s(4); // control 0, NR50 = $77
  yield* s(2); yield* call('BankswitchCommon'); yield* bankswitchCommon();
  yield* call('Music_DoLowHealthAlarm'); yield* s(4, 2, 2, 2, 5);       // not DISABLE; bit 7 clear: ret z
  yield* s(2); yield* call('BankswitchCommon'); yield* bankswitchCommon();
  yield* call('Audio1_UpdateMusic');
  yield* s(audioCycles);
  yield* call('SerialFunction'); yield* s(4, 2, 5);                     // printer closed: ret z
  yield* s(4, 3, 4);                   // ld a,[wVBlankSavedROMBank]; ldh [hLoadedROMBank],a; ld [rROMB],a
  yield* s(3, 3);                      // pop af; ldh [rVBK],a
  yield* s(3, 3, 3, 3);                // pop hl/de/bc/af
  yield { cycles: 4, reti: true };
}

function* autoBgMapTransfer(i: IntroVBlankInputs): Generator<Item> {
  yield* s(3, 1);                                   // ldh a,[hAutoBGTransferEnabled]; and a
  if (!i.hAutoBGTransferEnabled) { yield* s(5); return; } // ret z (taken)
  yield* s(2, 5, 3, 1);                             // ret z (not); ld [hSPTemp],sp; ldh a,[portion]; and a
  const portion = i.hAutoBGTransferPortion;
  if (portion === 0) yield* s(3, 3, 2, 3, 1, 3, 1, 2, 3);   // jr z (taken); top: ld hl; ld sp,hl; dest; ld a,MIDDLE; jr
  else {
    yield* s(2, 1);                                 // jr z (not); dec a
    if (portion === 1) yield* s(3, 3, 2, 3, 1, 3, 1, 3, 2, 2);            // jr z (taken); middle: ...; add hl,de; ld a,BOTTOM
    else yield* s(2, 3, 2, 3, 1, 3, 1, 3, 2, 1, 3);                       // jr z (not); bottom: ...; xor a; jr
  }
  yield* se('advance-bg-transfer-portion', 3);      // ldh [hAutoBGTransferPortion],a
  yield* s(2);                                     // ld b,6
  for (let row = 0; row < THIRD_ROWS; row++) {
    for (let pair = 0; pair < ROW_PAIRS - 1; pair++) yield* s(3, 2, 1, 2, 1);
    yield* s(3, 2, 1, 2);                           // last pair: no inc l
    // ld a,13; add l; ld l,a; jr nc,.ok (taken 3) or (not taken 2 + inc h 1): three cycles either way
    yield* s(2, 1, 1, 3);
    yield* s(1, row < THIRD_ROWS - 1 ? 3 : 2);      // dec b; jr nz
  }
  yield* s(3, 1, 3, 1, 2, 4);                       // restore sp; ret
}

function* vblankCopy(size: number): Generator<Item> {
  yield* s(3, 1);                                   // ldh a,[hVBlankCopySize]; and a
  if (!size) { yield* s(5); return; }
  yield* se('consume-copy', 2, 5, 3, 1, 3, 1, 2, 3, 1, 3, 1, 3, 1, 1, 3);   // ret z (not) .. xor a; ldh [hVBlankCopySize],a
  for (let tile = 0; tile < size; tile++) {
    for (let pair = 0; pair < TILE_PAIRS - 1; pair++) yield* s(3, 2, 1, 2, 1);
    yield* s(3, 2, 1, 2, 2);                        // last pair: inc hl
    yield* s(1, tile < size - 1 ? 3 : 2);           // dec b; jr nz
  }
  yield* s(5, 2, 5, 3, 1, 3, 1, 2, 4);              // save source/dest; restore sp; ret
}

function* trackPlayTime(i: IntroVBlankInputs): Generator<Item> {
  yield* call('CountDownIgnoreInputBitReset');
  yield* s(4, 1);                                   // ld a,[wIgnoreInputCounter]; and a
  if (i.wIgnoreInputCounter === 0) yield* s(2, 2, 3);       // jr nz (not); ld a,$ff; jr .continue
  else yield* s(3, 1);                              // jr nz (taken); dec a
  yield* s(4, 1);                                   // ld [wIgnoreInputCounter],a; and a
  if (i.wIgnoreInputCounter !== 1) yield* s(5);     // ret nz (taken)
  else yield* s(2, 4, 2, 2, 2, 2, 4, 5);            // flags5: res; res; bit; res; ld; ret z (taken: joypad was enabled)
  yield* s(3, 3, 2, 4, 2, 5);                       // ld hl; bit 0,[hl]; jr nz (not); ld a,[wStatusFlags6]; bit; ret z
}

function* random(): Generator<Item> {
  yield* s(4, 4, 4, 2, 3);                          // push hl/de/bc; farcall: ld b; ld hl
  yield* call('Bankswitch');
  yield* s(3, 4, 1, 3, 4);                          // ldh a,[hLoadedROMBank]; push af; ld a,b; ldh; ld [rROMB],a
  yield* call('JumpToAddress'); yield* s(1);        // jp hl
  yield* enter('Random_');
  yield* s(3, 1, 3, 1, 3, 3, 1, 3, 1, 3, 4);        // two rDIV reads, adc/sbc, ret
  yield* s(3, 1, 3, 4, 4);                          // Bankswitch: pop bc; ld a,b; ldh; ld [rROMB],a; ret
  yield* s(3, 3, 3, 3, 4);                          // ldh a,[hRandomAdd]; pop bc/de/hl; ret
}

function* bankswitchCommon(): Generator<Item> { yield* s(3, 4, 4); }

function* readJoypad(): Generator<Item> {
  yield* s(3, 4, 2);                                // homejp: ldh a,[hLoadedROMBank]; push af; ld a,BANK
  yield* call('BankswitchCommon'); yield* bankswitchCommon();
  yield* call('ReadJoypad_');
  yield* s(3, 1, 2);                                // polling enabled
  yield* s(2, 3, 3, 3, 1, 2, 2, 1);                 // directions
  yield* se('sample-joypad', 2, 3, 3, 3, 3, 3, 3, 3, 1, 2, 1, 3);     // buttons, ldh [hJoyInput],a
  yield* s(2, 3, 4);                                // deselect; ret
  yield* s(3, 4);                                   // pop af; jp BankswitchCommon
  yield* enter('BankswitchCommon'); yield* bankswitchCommon();
}

/** The LCDC (STAT) handler from `jp LCDC` at $0048 through its RETI, for hLCDCPointer = 0 (its only movie value). */
export function* introLcdcSteps(hLCDCPointer: number): Generator<IntroHandlerStep> {
  byte(hLCDCPointer, 'hLCDCPointer');
  if (hLCDCPointer) throw new RangeError('Intro LCDC handler with a non-zero hLCDCPointer is outside the movie domain');
  yield { cycles: 4 };                             // jp LCDC
  yield { cycles: 4, routine: 'LCDC' };            // push af
  yield { cycles: 3 }; yield { cycles: 1 }; yield { cycles: 3 }; yield { cycles: 3 }; // ldh; and a; jr z (taken); pop af
  yield { cycles: 4, reti: true };
}
