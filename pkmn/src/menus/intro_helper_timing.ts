// Opening checkpoint-12b2c2-2c2 (note 133): instruction streams for the shared foreground helpers the intro movie
// calls. UNUSED: no Boot, main, movie program or audio caller imports this file. Each yielded instruction is one
// native instruction (1-6 machine cycles) with the pret routine on its entry. The owner supplies read results and
// HALT's retry/woke reply between instructions, so an interrupt can run at any boundary. Two aggregates are not
// instructions: an audio callee (entry through RET, excluding its CALL) and a GDMA stall (2,052 dots, no opcode).
// Do not pass either to the CPU instruction executor: a stall is not one SM83 opcode, and a callee is not one long instruction.
//
// Measured on the user's cartridge, CGB normal speed, PlayIntroScene through the note-128 scene-6 redirect
// (notes/133-opening-checkpoint-12b2c2-2c2): every LY/STAT poll reads four dots before the end of its three-cycle
// LDH; both whole-screen rVDMA_LEN=$3f writes stall 2,052 dots with no IRQ inside the helper; every EI in these
// helpers is followed by RET. ROM addresses are not consulted at runtime.

export const INTRO_GDMA_STALL_DOTS = 2052;
export const INTRO_HELPER_READ_TRAILING_DOTS = 4;
/** rIF writes take effect three dots before the instruction ends (note 130). */
export const INTRO_IF_STORE_TRAILING_DOTS = 3;
/** Ordinary CPU stores, including rLCDC and rIE, four dots before the end. */
export const INTRO_CPU_STORE_TRAILING_DOTS = 4;

/** Yellow's intro song. (Music_YellowIntro - SFX_Headers_1) / 3. */
export const INTRO_YELLOW_MUSIC_ID = 220;
/** BANK(Music_YellowIntro) and BANK(Audio3_PlaySound). */
export const INTRO_YELLOW_MUSIC_BANK = 0x1f;
export const INTRO_WHOLE_SCREEN_ATTR_LEN = 0x3f;
const PAD_BUTTONS = 0x0f;
const PAD_UP = 0x40;
const PAD_A_B = 0x03;
const LCDC_ON = 0x80;
const LY_VBLANK = 144;

export type IntroHelperReply = number | 'retry' | 'woke';

export interface IntroHelperRead {
  readonly field: string;
  readonly trailingDots: number;
}
export interface IntroHelperStore {
  readonly field: string;
  readonly trailingDots: number;
  readonly value?: number | 'increment-read';
}
export interface IntroHelperInsn {
  readonly cycles: number;
  readonly op: string;
  readonly routine?: string;
  readonly read?: IntroHelperRead;
  readonly store?: IntroHelperStore;
  readonly halt?: true;
  readonly di?: true;
  readonly ei?: true;
  readonly control?: 'call' | 'ret' | 'jp' | 'jr';
  /** A store a later VBlank can observe: setup SFX ids cleared, or a music channel id published. */
  readonly publishes?: 'setup-sfx-cleared' | 'music-channel';
}
export interface IntroHelperAudio {
  readonly kind: 'audio';
  readonly cycles: number;
  readonly predictor: 'setup' | 'movie';
  readonly slot: string;
  readonly routine: 'Audio1_UpdateMusic';
}
export interface IntroHelperGdma {
  readonly kind: 'gdma';
  readonly dots: number;
  readonly which: 1 | 2;
}
export type IntroForegroundStep = IntroHelperInsn | IntroHelperAudio | IntroHelperGdma;

export interface IntroHelperSources {
  /** Fresh callee cost. Call the setup predictor until PlayMusic publishes music-channel, then the movie predictor. */
  audioCycles(predictor: 'setup' | 'movie'): number;
  /** DisableLCD spins forever if the LCD is already off. Checked before the first instruction. */
  lcdEnabled(): boolean;
}

export interface IntroCopyVideoInput {
  readonly tiles: 255 | 128;
  readonly source: number;
  readonly dest: number;
  readonly bank: number;
}

type Gen = Generator<IntroForegroundStep, void, IntroHelperReply>;
type ByteGen = Generator<IntroForegroundStep, number, IntroHelperReply>;

function byteReply(value: IntroHelperReply, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255)
    throw new RangeError(`Intro helper ${field} read needs a byte`);
  return value;
}
function* ldh(field: string, op: string, routine?: string): ByteGen {
  const step: IntroHelperInsn = { cycles: 3, op, read: { field, trailingDots: INTRO_HELPER_READ_TRAILING_DOTS } };
  const value = yield routine ? { ...step, routine } : step;
  return byteReply(value, field);
}
function* mem(field: string, op: string, routine?: string): ByteGen {
  const step: IntroHelperInsn = { cycles: 4, op, read: { field, trailingDots: INTRO_CPU_STORE_TRAILING_DOTS } };
  const value = yield routine ? { ...step, routine } : step;
  return byteReply(value, field);
}
function* mem2(field: string, op: string): ByteGen {
  const value = yield { cycles: 2, op, read: { field, trailingDots: INTRO_CPU_STORE_TRAILING_DOTS } };
  return byteReply(value, field);
}
function* haltAt(routine?: string): Generator<IntroForegroundStep, 'retry' | 'woke', IntroHelperReply> {
  const value = yield { cycles: 1, op: 'halt', routine, halt: true };
  if (value !== 'retry' && value !== 'woke') throw new RangeError('Intro helper HALT needs retry or woke');
  return value;
}
function store(cycles: number, field: string, value: number, trailing: number, op: string, extra: Partial<IntroHelperInsn> = {}): IntroHelperInsn {
  return { cycles, op, store: { field, trailingDots: trailing, value: value & 255 }, ...extra };
}
function audioCost(sources: IntroHelperSources, predictor: 'setup' | 'movie', slot: string): IntroHelperAudio {
  const cycles = sources.audioCycles(predictor);
  if (!Number.isSafeInteger(cycles) || cycles < 1) throw new RangeError('Invalid intro helper audio cycles');
  return { kind: 'audio', cycles, predictor, slot, routine: 'Audio1_UpdateMusic' };
}
function word(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new RangeError(`Invalid intro helper ${name}`);
  return value;
}

function* bankswitchCommon(bank: number, routine = false): Gen {
  yield store(3, 'hLoadedROMBank', bank, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hLoadedROMBank],a', routine ? { routine: 'BankswitchCommon' } : {});
  yield store(4, 'rROMB', bank, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [rROMB],a');
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** DelayFrame from its first instruction through RET. HALT is yielded again when the CPU reports retry. A woke
 *  resume samples hVBlankOccurred; a STAT service leaves it set, so the back edge (3 cycles) returns to HALT. */
export function* introDelayFrameSteps(): Gen {
  yield { cycles: 2, op: 'ld a,1', routine: 'DelayFrame' };
  yield store(3, 'hVBlankOccurred', 1, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hVBlankOccurred],a');
  for (;;) {
    let how: 'retry' | 'woke';
    do how = yield* haltAt();
    while (how === 'retry');
    const occurred = yield* ldh('hVBlankOccurred', 'ldh a,[hVBlankOccurred]');
    yield { cycles: 1, op: 'and a' };
    if (occurred) {
      yield { cycles: 3, op: 'jr nz,.halt', control: 'jr' };
      continue;
    }
    yield { cycles: 2, op: 'jr nz,.halt', control: 'jr' };
    yield { cycles: 4, op: 'ret', control: 'ret' };
    return;
  }
}

/** DelayFrames for a caller that has already loaded C. Each taken back edge re-enters this routine. */
export function* introDelayFramesSteps(frames: number): Gen {
  if (!Number.isInteger(frames) || frames < 1 || frames > 255) throw new RangeError('Invalid intro DelayFrames count');
  for (let left = frames; left >= 1; left--) {
    yield { cycles: 6, op: 'call DelayFrame', routine: 'DelayFrames', control: 'call' };
    yield* introDelayFrameSteps();
    yield { cycles: 1, op: 'dec c' };
    yield { cycles: left > 1 ? 3 : 2, op: 'jr nz,DelayFrames', control: 'jr' };
  }
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* delay3(): Gen {
  yield { cycles: 2, op: 'ld c,3', routine: 'Delay3' };
  yield { cycles: 4, op: 'jp DelayFrames', control: 'jp' };
  yield* introDelayFramesSteps(3);
}

function* requireCgb(routine: string): Gen {
  yield { cycles: 4, op: 'push af', routine };
  const on = yield* ldh('hOnCGB', 'ldh a,[hOnCGB]');
  yield { cycles: 1, op: 'and a' };
  if (!on) throw new RangeError('UpdateCGBPal on DMG is unsupported');
  yield { cycles: 2, op: 'jr z,.notCGB', control: 'jr' };
}

function* dmgPal(selector: 0 | 1 | 2): Gen {
  yield { cycles: 1, op: 'and a', routine: 'DMGPalToCGBPal' };
  if (selector === 0) {
    yield { cycles: 2, op: 'jr nz,.notBGP', control: 'jr' };
    const bgp = yield* ldh('rBGP', 'ldh a,[rBGP]');
    yield store(4, 'wLastBGP', bgp, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wLastBGP],a');
    yield { cycles: 3, op: 'jr .convert', control: 'jr' };
  } else if (selector === 1) {
    yield { cycles: 3, op: 'jr nz,.notBGP', control: 'jr' };
    yield { cycles: 1, op: 'dec a' };
    yield { cycles: 2, op: 'jr nz,.notOBP0', control: 'jr' };
    const obp = yield* ldh('rOBP0', 'ldh a,[rOBP0]');
    yield store(4, 'wLastOBP0', obp, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wLastOBP0],a');
    yield { cycles: 3, op: 'jr .convert', control: 'jr' };
  } else {
    yield { cycles: 3, op: 'jr nz,.notBGP', control: 'jr' };
    yield { cycles: 1, op: 'dec a' };
    yield { cycles: 3, op: 'jr nz,.notOBP0', control: 'jr' };
    const obp = yield* ldh('rOBP1', 'ldh a,[rOBP1]');
    yield store(4, 'wLastOBP1', obp, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wLastOBP1],a');
  }
  for (let color = 0; color < 4; color++) {
    yield { cycles: 1, op: 'ld b,a' };
    yield { cycles: 2, op: 'and %11' };
    yield { cycles: 6, op: 'call .GetColorAddress', control: 'call' };
    yield { cycles: 1, op: 'add a', routine: 'DMGPalToCGBPal.GetColorAddress' };
    yield { cycles: 1, op: 'ld l,a' };
    yield { cycles: 1, op: 'xor a' };
    yield { cycles: 1, op: 'ld h,a' };
    yield { cycles: 2, op: 'add hl,de' };
    yield { cycles: 4, op: 'ret', control: 'ret' };
    const lo = yield* mem2(`wCGBPal.${color}.lo`, 'ld a,[hli]');
    yield store(4, `wCGBPal.${color}.lo`, lo, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wCGBPal],a');
    const hi = yield* mem2(`wCGBPal.${color}.hi`, 'ld a,[hl]');
    yield store(4, `wCGBPal.${color}.hi`, hi, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wCGBPal+1],a');
    if (color < 3) {
      yield { cycles: 1, op: 'ld a,b' };
      yield { cycles: 1, op: 'rrca' };
      yield { cycles: 1, op: 'rrca' };
    }
  }
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* bufferBgpPal(): Gen {
  yield { cycles: 4, op: 'push de', routine: 'BufferBGPPal' };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 1, op: 'ld l,a' };
  yield { cycles: 1, op: 'xor a' };
  yield { cycles: 1, op: 'ld h,a' };
  yield { cycles: 3, op: 'ld de,wBGPPalsBuffer' };
  yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 3, op: 'ld de,wCGBPal' };
  yield { cycles: 2, op: 'ld c,PAL_SIZE' };
  for (let i = 0; i < 8; i++) {
    const byte = yield* mem2('wCGBPal', 'ld a,[de]');
    yield store(2, 'wBGPPalsBuffer', byte, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a');
    yield { cycles: 2, op: 'inc de' };
    yield { cycles: 1, op: 'dec c' };
    yield { cycles: i < 7 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
  }
  yield { cycles: 3, op: 'pop de' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* waitLyAtLeast144(): Gen {
  for (;;) {
    const ly = yield* ldh('rLY', 'ldh a,[rLY]');
    yield { cycles: 2, op: 'cp 144' };
    if (ly < LY_VBLANK) yield { cycles: 3, op: 'jr c,.waitLoop', control: 'jr' };
    else { yield { cycles: 2, op: 'jr c,.waitLoop', control: 'jr' }; return; }
  }
}

function* transferBgpBurst(): Gen {
  yield { cycles: 1, op: 'xor a', routine: 'TransferBGPPals.DoTransfer' };
  yield { cycles: 2, op: 'or $80' };
  yield store(3, 'rBGPI', 0x80, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rBGPI],a');
  yield { cycles: 3, op: 'ld de,rBGPD' };
  yield { cycles: 3, op: 'ld hl,wBGPPalsBuffer' };
  yield { cycles: 2, op: 'ld c,32' };
  for (let i = 0; i < 32; i++) {
    const byte = yield* mem2('wBGPPalsBuffer', 'ld a,[hli]');
    yield store(2, 'rBGPD', byte, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [de],a');
    yield { cycles: 1, op: 'dec c' };
    yield { cycles: i < 31 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
  }
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* transferBgpPals(): Gen {
  const lcdc = yield* ldh('rLCDC', 'ldh a,[rLCDC]', 'TransferBGPPals');
  yield { cycles: 2, op: 'and LCDC_ON' };
  const on = (lcdc & LCDC_ON) !== 0;
  yield { cycles: on ? 2 : 3, op: 'jr z,.lcdDisabled', control: 'jr' };
  if (on) {
    yield { cycles: 1, op: 'di', di: true };
    yield* waitLyAtLeast144();
  }
  yield { cycles: 6, op: 'call .DoTransfer', control: 'call' };
  yield* transferBgpBurst();
  yield { cycles: 1, op: 'ei', ei: true };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* palColorBytes(routine?: string): Gen {
  const loValue = yield { cycles: 2, op: 'ld a,[hli]', routine, read: { field: 'wCGBPal', trailingDots: INTRO_CPU_STORE_TRAILING_DOTS } };
  const lo = byteReply(loValue, 'wCGBPal');
  yield store(2, 'palette-data', lo, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [de],a');
  const hi = yield* mem2('wCGBPal', 'ld a,[hli]');
  yield store(2, 'palette-data', hi, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [de],a');
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** LCD-on color writer: STAT bit 1 sets (mode 2 or 3), then clears (mode 0 or 1), then two data bytes. */
function* palColorEnabled(): Gen {
  let entry = true;
  for (;;) {
    const stat = yield* ldh('rSTAT', 'ldh a,[rSTAT]', entry ? 'TransferPalColorLCDEnabled' : undefined);
    entry = false;
    yield { cycles: 1, op: 'and b' };
    if ((stat & 2) === 0) yield { cycles: 3, op: 'jr z,TransferPalColorLCDEnabled', control: 'jr' };
    else { yield { cycles: 2, op: 'jr z,TransferPalColorLCDEnabled', control: 'jr' }; break; }
  }
  for (;;) {
    const stat = yield* ldh('rSTAT', 'ldh a,[rSTAT]');
    yield { cycles: 1, op: 'and b' };
    if ((stat & 2) !== 0) yield { cycles: 3, op: 'jr nz,.notInBlankingPeriod', control: 'jr' };
    else { yield { cycles: 2, op: 'jr nz,.notInBlankingPeriod', control: 'jr' }; break; }
  }
  yield* palColorBytes('TransferPalColorLCDDisabled');
}

function* transferCur(kind: 'bg' | 'ob', index: number): Gen {
  const routine = kind === 'bg' ? 'TransferCurBGPData' : 'TransferCurOBPData';
  const indexReg = kind === 'bg' ? 'rBGPI' : 'rOBPI';
  yield { cycles: 4, op: 'push de', routine };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 2, op: 'or $80' };
  yield store(3, indexReg, (index << 3) | 0x80, INTRO_CPU_STORE_TRAILING_DOTS, `ldh [${indexReg}],a`);
  yield { cycles: 3, op: kind === 'bg' ? 'ld de,rBGPD' : 'ld de,rOBPD' };
  yield { cycles: 3, op: 'ld hl,wCGBPal' };
  yield { cycles: 2, op: 'ld b,%10' };
  const lcdc = yield* ldh('rLCDC', 'ldh a,[rLCDC]');
  yield { cycles: 2, op: 'and LCDC_ON' };
  const on = (lcdc & LCDC_ON) !== 0;
  yield { cycles: on ? 3 : 2, op: 'jr nz,.lcdEnabled', control: 'jr' };
  for (let color = 0; color < 4; color++) {
    yield { cycles: 6, op: on ? 'call TransferPalColorLCDEnabled' : 'call TransferPalColorLCDDisabled', control: 'call' };
    if (on) yield* palColorEnabled();
    else yield* palColorBytes('TransferPalColorLCDDisabled');
  }
  if (!on) yield { cycles: 3, op: 'jr .done', control: 'jr' };
  yield { cycles: 3, op: 'pop de' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* getCgbBasePalAddress(palette: number): ByteGen {
  yield { cycles: 4, op: 'push hl', routine: 'GetCGBBasePalAddress' };
  yield { cycles: 1, op: 'ld l,a' };
  yield { cycles: 1, op: 'xor a' };
  yield { cycles: 1, op: 'ld h,a' };
  yield { cycles: 2, op: 'add hl,hl' };
  yield { cycles: 2, op: 'add hl,hl' };
  yield { cycles: 2, op: 'add hl,hl' };
  yield { cycles: 3, op: 'ld de,CGBBasePalettes' };
  yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 1, op: 'ld a,l' };
  yield { cycles: 1, op: 'ld e,a' };
  yield { cycles: 1, op: 'ld a,h' };
  yield { cycles: 1, op: 'ld d,a' };
  yield { cycles: 3, op: 'pop hl' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
  return 0x6af9 + 8 * palette; // CGBBasePalettes, pret b452f2ab
}

/** One index of _UpdateCGBPal_BGP: convert as BGP and buffer. index is the palette slot 0-3. */
function* updateFarBgpIndex(index: number): Gen {
  yield* mem(`wCGBBasePalPointers.${index}.lo`, 'ld a,[wCGBBasePalPointers]', index === 0 ? '_UpdateCGBPal_BGP' : undefined);
  yield { cycles: 1, op: 'ld e,a' };
  yield* mem(`wCGBBasePalPointers.${index}.hi`, 'ld a,[wCGBBasePalPointers+1]');
  yield { cycles: 1, op: 'ld d,a' };
  yield { cycles: 1, op: 'xor a' };
  yield { cycles: 6, op: 'call DMGPalToCGBPal', control: 'call' };
  yield* dmgPal(0);
  yield { cycles: 2, op: `ld a,${index}` };
  yield { cycles: 6, op: 'call BufferBGPPal', control: 'call' };
  yield* bufferBgpPal();
}

function* updateFarBgp(): Gen {
  for (let index = 0; index < 4; index++) yield* updateFarBgpIndex(index);
  yield { cycles: 6, op: 'call TransferBGPPals', control: 'call' };
  yield* transferBgpPals();
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* obpIndexAdjust(selector: 1 | 2, index: number): Gen {
  // dec a / rlca / rlca turns CONVERT_OBP0 into 0 and CONVERT_OBP1 into 4, then the index add.
  yield { cycles: 1, op: 'dec a' };
  yield { cycles: 1, op: 'rlca' };
  yield { cycles: 1, op: 'rlca' };
  if (index === 1) yield { cycles: 1, op: 'inc a' };
  else if (index > 1) yield { cycles: 2, op: `add ${index}` };
  const base = selector === 1 ? 0 : 4;
  const adjusted = index === 0 ? base : index === 1 ? base + 1 : base + index;
  yield { cycles: 6, op: 'call TransferCurOBPData', control: 'call' };
  yield* transferCur('ob', adjusted);
}

function* updateFarObp(selector: 1 | 2): Gen {
  for (let index = 0; index < 4; index++) {
    const routine = index === 0 ? '_UpdateCGBPal_OBP' : undefined;
    yield* mem(`wCGBBasePalPointers.${index}.lo`, 'ld a,[wCGBBasePalPointers]', routine);
    yield { cycles: 1, op: 'ld e,a' };
    yield* mem(`wCGBBasePalPointers.${index}.hi`, 'ld a,[wCGBBasePalPointers+1]');
    yield { cycles: 1, op: 'ld d,a' };
    yield { cycles: 1, op: 'ld a,c' };
    yield { cycles: 6, op: 'call DMGPalToCGBPal', control: 'call' };
    yield* dmgPal(selector);
    yield { cycles: 1, op: 'ld a,c' };
    yield* obpIndexAdjust(selector, index);
  }
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** Bankswitch inlines the bank write. Its RET is this routine's, not BankswitchCommon's. */
function* bankswitch(bank: number, body: () => Gen): Gen {
  const saved = yield* ldh('hLoadedROMBank', 'ldh a,[hLoadedROMBank]', 'Bankswitch');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 1, op: 'ld a,b' };
  yield store(3, 'hLoadedROMBank', bank, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hLoadedROMBank],a');
  yield store(4, 'rROMB', bank, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [rROMB],a');
  yield { cycles: 6, op: 'call JumpToAddress', control: 'call' };
  yield { cycles: 1, op: 'jp hl', routine: 'JumpToAddress', control: 'jp' };
  yield* body();
  yield { cycles: 3, op: 'pop bc' };
  yield { cycles: 1, op: 'ld a,b' };
  yield store(3, 'hLoadedROMBank', saved, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hLoadedROMBank],a');
  yield store(4, 'rROMB', saved, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [rROMB],a');
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* farCallBgp(): Gen {
  yield { cycles: 2, op: 'ld b,BANK(_UpdateCGBPal_BGP)' };
  yield { cycles: 3, op: 'ld hl,_UpdateCGBPal_BGP' };
  yield { cycles: 6, op: 'call Bankswitch', control: 'call' };
  yield* bankswitch(0x1c, updateFarBgp);
}

function* bankswitchToObp(selector: 1 | 2): Gen {
  yield { cycles: 2, op: 'ld b,BANK(_UpdateCGBPal_OBP)' };
  yield { cycles: 3, op: 'ld hl,_UpdateCGBPal_OBP' };
  yield { cycles: 2, op: selector === 1 ? 'ld c,CONVERT_OBP0' : 'ld c,CONVERT_OBP1' };
  yield { cycles: 6, op: 'call Bankswitch', control: 'call' };
  yield* bankswitch(0x1c, () => updateFarObp(selector));
}

function* sameValueExit(): Gen {
  yield { cycles: 3, op: 'pop hl' };
  yield { cycles: 3, op: 'pop de' };
  yield { cycles: 3, op: 'pop bc' };
  yield { cycles: 3, op: 'pop af' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** Changed BGP takes the far convert-and-TransferBGPPals path. An equal wLastBGP returns after the compare. */
export function* introUpdateCgbPalBgpSteps(): Gen {
  yield* requireCgb('UpdateCGBPal_BGP');
  yield { cycles: 4, op: 'push bc' };
  yield { cycles: 4, op: 'push de' };
  yield { cycles: 4, op: 'push hl' };
  const bgp = yield* ldh('rBGP', 'ldh a,[rBGP]');
  yield { cycles: 1, op: 'ld b,a' };
  const last = yield* mem('wLastBGP', 'ld a,[wLastBGP]');
  yield { cycles: 1, op: 'cp b' };
  if (bgp === last) {
    yield { cycles: 3, op: 'jr z,.noChangeInBGP', control: 'jr' };
    yield* sameValueExit();
    return;
  }
  yield { cycles: 2, op: 'jr z,.noChangeInBGP', control: 'jr' };
  yield* farCallBgp();
  yield* sameValueExit();
}

export function* introUpdateCgbPalObp0Steps(): Gen {
  yield* updateObp('UpdateCGBPal_OBP0', 'rOBP0', 'wLastOBP0', 1);
}
export function* introUpdateCgbPalObp1Steps(): Gen {
  yield* updateObp('UpdateCGBPal_OBP1', 'rOBP1', 'wLastOBP1', 2);
}

function* updateObp(routine: string, reg: string, lastField: string, selector: 1 | 2): Gen {
  yield* requireCgb(routine);
  yield { cycles: 4, op: 'push bc' };
  yield { cycles: 4, op: 'push de' };
  yield { cycles: 4, op: 'push hl' };
  const current = yield* ldh(reg, `ldh a,[${reg}]`);
  yield { cycles: 1, op: 'ld b,a' };
  const last = yield* mem(lastField, `ld a,[${lastField}]`);
  yield { cycles: 1, op: 'cp b' };
  if (current === last) {
    yield { cycles: 3, op: 'jr z,.noChange', control: 'jr' };
    yield* sameValueExit();
    return;
  }
  yield { cycles: 2, op: 'jr z,.noChange', control: 'jr' };
  yield* bankswitchToObp(selector);
  yield* sameValueExit();
}

/** DisableLCD. Refuses an already-disabled LCD before the first instruction: the poll would not finish. STAT may
 *  interrupt the LY poll. A VBlank masked by the IE store becomes visible at the boundary after IE is restored. */
export function* introDisableLcdSteps(sources: IntroHelperSources): Gen {
  if (!sources.lcdEnabled()) throw new RangeError('DisableLCD on an already-disabled LCD is unsupported');
  yield { cycles: 1, op: 'xor a', routine: 'DisableLCD' };
  yield store(3, 'rIF', 0, INTRO_IF_STORE_TRAILING_DOTS, 'ldh [rIF],a');
  const ie = yield* ldh('rIE', 'ldh a,[rIE]');
  yield { cycles: 1, op: 'ld b,a' };
  yield { cycles: 2, op: 'res B_IE_VBLANK,a' };
  yield store(3, 'rIE', ie & ~1, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rIE],a');
  for (;;) {
    const ly = yield* ldh('rLY', 'ldh a,[rLY]');
    yield { cycles: 2, op: 'cp LY_VBLANK+1' };
    if (ly !== LY_VBLANK + 1) yield { cycles: 3, op: 'jr nz,.wait', control: 'jr' };
    else { yield { cycles: 2, op: 'jr nz,.wait', control: 'jr' }; break; }
  }
  const lcdc = yield* ldh('rLCDC', 'ldh a,[rLCDC]');
  yield { cycles: 2, op: 'and ~LCDC_ON' };
  yield store(3, 'rLCDC', lcdc & ~LCDC_ON, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rLCDC],a');
  yield { cycles: 1, op: 'ld a,b' };
  yield store(3, 'rIE', ie, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rIE],a');
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* audio2Fill(count: number, value: number, fields?: readonly string[]): Gen {
  yield { cycles: 1, op: 'ld b,d', routine: 'Audio2_FillMem' };
  for (let i = 0; i < count; i++) {
    const field = fields ? fields[i] : 'memory';
    yield store(2, field, value, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a');
    yield { cycles: 1, op: 'dec b' };
    yield { cycles: i < count - 1 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
  }
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* initMusicVariables(): Gen {
  yield { cycles: 4, op: 'push hl', routine: 'InitMusicVariables' };
  yield { cycles: 4, op: 'push de' };
  yield { cycles: 4, op: 'push bc' };
  const saved = yield* ldh('hLoadedROMBank', 'ldh a,[hLoadedROMBank]');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 2, op: 'ld a,BANK(Audio2_InitMusicVariables)' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(0x08, true);
  yield { cycles: 6, op: 'call Audio2_InitMusicVariables', control: 'call' };
  yield* audio2Init();
  yield { cycles: 3, op: 'pop af' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(saved, true);
  yield { cycles: 3, op: 'pop bc' };
  yield { cycles: 3, op: 'pop de' };
  yield { cycles: 3, op: 'pop hl' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* audio2Init(): Gen {
  yield { cycles: 1, op: 'xor a', routine: 'Audio2_InitMusicVariables' };
  for (const field of ['wUnusedMusicByte', 'wDisableChannelOutputWhenSfxEnds', 'wMusicTempo.hi', 'wMusicWaveInstrument', 'wSfxWaveInstrument'])
    yield store(4, field, 0, INTRO_CPU_STORE_TRAILING_DOTS, `ld [${field}],a`);
  yield { cycles: 2, op: 'ld d,NUM_CHANNELS' };
  yield { cycles: 3, op: 'ld hl,wChannelReturnAddresses' };
  yield { cycles: 6, op: 'call Audio2_FillMem', control: 'call' };
  yield* audio2Fill(8, 0);
  yield { cycles: 3, op: 'ld hl,wChannelCommandPointers' };
  yield { cycles: 6, op: 'call Audio2_FillMem', control: 'call' };
  yield* audio2Fill(8, 0);
  yield { cycles: 2, op: 'ld d,NUM_MUSIC_CHANS' };
  const regions = ['wChannelSoundIDs', 'wChannelFlags1', 'wChannelDutyCycles', 'wChannelDutyCyclePatterns',
    'wChannelVibratoDelayCounters', 'wChannelVibratoExtents', 'wChannelVibratoRates', 'wChannelFrequencyLowBytes',
    'wChannelVibratoDelayCounterReloadValues', 'wChannelFlags2', 'wChannelPitchSlideLengthModifiers',
    'wChannelPitchSlideFrequencySteps', 'wChannelPitchSlideFrequencyStepsFractionalPart',
    'wChannelPitchSlideCurrentFrequencyFractionalPart', 'wChannelPitchSlideCurrentFrequencyHighBytes',
    'wChannelPitchSlideCurrentFrequencyLowBytes', 'wChannelPitchSlideTargetFrequencyHighBytes',
    'wChannelPitchSlideTargetFrequencyLowBytes'];
  for (const region of regions) {
    yield { cycles: 3, op: `ld hl,${region}` };
    yield { cycles: 6, op: 'call Audio2_FillMem', control: 'call' };
    const fields = region === 'wChannelSoundIDs' ? [1, 2, 3, 4].map(n => `wChannelSoundIDs.${n}`) : undefined;
    yield* audio2Fill(4, 0, fields);
  }
  yield { cycles: 2, op: 'ld a,1' };
  for (const region of ['wChannelLoopCounters', 'wChannelNoteDelayCounters', 'wChannelNoteSpeeds']) {
    yield { cycles: 3, op: `ld hl,${region}` };
    yield { cycles: 6, op: 'call Audio2_FillMem', control: 'call' };
    yield* audio2Fill(4, 1);
  }
  yield store(4, 'wMusicTempo', 1, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wMusicTempo],a');
  yield { cycles: 2, op: 'ld a,$ff' };
  yield store(4, 'wStereoPanning', 0xff, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wStereoPanning],a');
  yield { cycles: 1, op: 'xor a' };
  yield store(3, 'rAUDVOL', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rAUDVOL],a');
  yield { cycles: 2, op: 'ld a,AUD1SWEEP_DOWN' };
  yield store(3, 'rAUD1SWEEP', 0x08, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rAUD1SWEEP],a');
  yield { cycles: 2, op: 'ld a,0' };
  yield store(3, 'rAUDTERM', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rAUDTERM],a');
  yield { cycles: 1, op: 'xor a' };
  yield store(3, 'rAUD3ENA', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rAUD3ENA],a');
  yield { cycles: 2, op: 'ld a,AUD3ENA_ON' };
  yield store(3, 'rAUD3ENA', 0x80, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rAUD3ENA],a');
  yield { cycles: 2, op: 'ld a,$77' };
  yield store(3, 'rAUDVOL', 0x77, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rAUDVOL],a');
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** Opening PlayMusic. The four CHAN5-8 clears publish before any music-channel id, so a VBlank in between sees the
 *  setup sound gone and the new song not yet started. Active and idle setup sounds take this same stream: the clear
 *  does not read the old ids. The song id is above CRY_SFX_END, so the cry tail is the not-cry exit. */
export function* introPlayMusicSteps(): Gen {
  yield { cycles: 1, op: 'ld b,a', routine: 'PlayMusic' };
  yield store(4, 'wNewSoundID', INTRO_YELLOW_MUSIC_ID, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wNewSoundID],a');
  yield { cycles: 1, op: 'xor a' };
  yield store(4, 'wAudioFadeOutControl', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wAudioFadeOutControl],a');
  yield { cycles: 1, op: 'ld a,c' };
  yield store(4, 'wAudioROMBank', INTRO_YELLOW_MUSIC_BANK, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wAudioROMBank],a');
  yield store(4, 'wAudioSavedROMBank', INTRO_YELLOW_MUSIC_BANK, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wAudioSavedROMBank],a');
  yield { cycles: 1, op: 'ld a,b' };
  yield { cycles: 3, op: 'jr PlaySound', control: 'jr' };
  yield { cycles: 4, op: 'push hl', routine: 'PlaySound' };
  yield { cycles: 4, op: 'push de' };
  yield { cycles: 4, op: 'push bc' };
  yield { cycles: 1, op: 'ld b,a' };
  const sound = yield* mem('wNewSoundID', 'ld a,[wNewSoundID]');
  yield { cycles: 1, op: 'and a' };
  if (!sound) throw new RangeError('PlayMusic without a new sound id is unsupported');
  yield { cycles: 2, op: 'jr z,.next', control: 'jr' };
  yield { cycles: 1, op: 'xor a' };
  for (const channel of [5, 6, 7, 8])
    yield store(4, `wChannelSoundIDs.${channel}`, 0, INTRO_CPU_STORE_TRAILING_DOTS, `ld [wChannelSoundIDs+CHAN${channel}],a`, { publishes: 'setup-sfx-cleared' });
  const fade = yield* mem('wAudioFadeOutControl', 'ld a,[wAudioFadeOutControl]');
  yield { cycles: 1, op: 'and a' };
  if (fade) throw new RangeError('PlayMusic fade-out is unsupported');
  yield { cycles: 3, op: 'jr z,.noFadeOut', control: 'jr' };
  yield { cycles: 1, op: 'xor a' };
  yield store(4, 'wNewSoundID', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wNewSoundID],a');
  yield { cycles: 6, op: 'call DetermineAudioFunction', control: 'call' };
  yield* determineAudio();
  yield { cycles: 3, op: 'jr .done', control: 'jr' };
  yield { cycles: 3, op: 'pop bc' };
  yield { cycles: 3, op: 'pop de' };
  yield { cycles: 3, op: 'pop hl' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* determineAudio(): Gen {
  const saved = yield* ldh('hLoadedROMBank', 'ldh a,[hLoadedROMBank]', 'DetermineAudioFunction');
  yield { cycles: 4, op: 'push af' };
  const bank = yield* mem('wAudioROMBank', 'ld a,[wAudioROMBank]');
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(bank, true);
  yield { cycles: 2, op: 'cp BANK(Audio1_PlaySound)' };
  yield { cycles: 3, op: 'jr nz,.checkForAudio2', control: 'jr' };
  yield { cycles: 2, op: 'cp BANK(Audio2_PlaySound)' };
  yield { cycles: 3, op: 'jr nz,.checkForAudio3', control: 'jr' };
  yield { cycles: 2, op: 'cp BANK(Audio3_PlaySound)' };
  if (bank !== INTRO_YELLOW_MUSIC_BANK) throw new RangeError('PlayMusic audio bank is outside the intro');
  yield { cycles: 2, op: 'jr nz,.audio4', control: 'jr' };
  yield { cycles: 1, op: 'ld a,b' };
  yield { cycles: 6, op: 'call Audio3_PlaySound', control: 'call' };
  yield* audio3Play();
  yield { cycles: 3, op: 'jr .done', control: 'jr' };
  yield { cycles: 3, op: 'pop af' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(saved, true);
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* audio3Play(): Gen {
  yield store(4, 'wSoundID', INTRO_YELLOW_MUSIC_ID, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wSoundID],a', { routine: 'Audio3_PlaySound' });
  yield* mem('wSoundID', 'ld a,[wSoundID]');
  yield { cycles: 2, op: 'cp SFX_STOP_ALL_MUSIC' };
  yield { cycles: 3, op: 'jp z,.stopAllAudio', control: 'jp' };
  yield { cycles: 2, op: 'cp MAX_SFX_ID_3' };
  yield { cycles: 3, op: 'jp z,.playSfx', control: 'jp' };
  yield { cycles: 3, op: 'jp c,.playSfx', control: 'jp' };
  yield { cycles: 2, op: 'cp $fd' };
  yield { cycles: 2, op: 'jr z,.playMusic', control: 'jr' };
  yield { cycles: 3, op: 'jp nc,.playSfx', control: 'jp' };
  yield { cycles: 6, op: 'call InitMusicVariables', routine: 'Audio3_PlaySound.playMusic', control: 'call' };
  yield* initMusicVariables();
  yield { cycles: 4, op: 'jp .playSoundCommon', control: 'jp' };
  yield* mem('wSoundID', 'ld a,[wSoundID]', 'Audio3_PlaySound.playSoundCommon');
  yield { cycles: 1, op: 'ld l,a' };
  yield { cycles: 1, op: 'ld e,a' };
  yield { cycles: 2, op: 'ld h,0' };
  yield { cycles: 1, op: 'ld d,h' };
  yield { cycles: 2, op: 'add hl,hl' };
  yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 3, op: 'ld de,SFX_Headers_3' };
  yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 1, op: 'ld e,l' };
  yield { cycles: 1, op: 'ld d,h' };
  yield { cycles: 3, op: 'ld hl,wChannelCommandPointers' };
  // Yellow intro header: channel bytes $80, $01, $02. Three channels, ids 0, 1, 2. No pointer-walk skips.
  yield* mem2('music-header', 'ld a,[de]');
  yield { cycles: 1, op: 'ld b,a' };
  yield { cycles: 1, op: 'rlca' };
  yield { cycles: 1, op: 'rlca' };
  yield { cycles: 2, op: 'and $3' };
  yield { cycles: 1, op: 'ld c,a' };
  yield { cycles: 1, op: 'ld a,b' };
  yield { cycles: 2, op: 'and $f' };
  yield { cycles: 1, op: 'ld b,c' };
  yield { cycles: 1, op: 'inc b' };
  yield { cycles: 2, op: 'inc de' };
  yield { cycles: 2, op: 'ld c,0' };
  for (let channel = 0; channel < 3; channel++) {
    yield { cycles: 1, op: 'cp c', routine: 'Audio3_PlaySound.commandPointerLoop' };
    yield { cycles: 3, op: 'jr z,.next', control: 'jr' };
    yield { cycles: 4, op: 'push af', routine: 'Audio3_PlaySound.next' };
    yield { cycles: 4, op: 'push hl' };
    yield { cycles: 4, op: 'push bc' };
    yield { cycles: 2, op: 'ld b,0' };
    yield { cycles: 1, op: 'ld c,a' };
    yield { cycles: 2, op: 'cp CHAN4' };
    yield { cycles: 3, op: 'jr c,.skipSettingFlag', control: 'jr' };
    yield { cycles: 3, op: 'pop bc' };
    yield { cycles: 3, op: 'pop hl' };
    const low = yield* mem2(`channel-pointer.${channel + 1}.lo`, 'ld a,[de]');
    yield store(2, `wChannelCommandPointers.${channel + 1}.lo`, low, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a');
    yield { cycles: 2, op: 'inc de' };
    const high = yield* mem2(`channel-pointer.${channel + 1}.hi`, 'ld a,[de]');
    yield store(2, `wChannelCommandPointers.${channel + 1}.hi`, high, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a');
    yield { cycles: 2, op: 'inc de' };
    yield { cycles: 3, op: 'pop af' };
    yield { cycles: 4, op: 'push hl' };
    yield { cycles: 4, op: 'push bc' };
    yield { cycles: 2, op: 'ld b,0' };
    yield { cycles: 1, op: 'ld c,a' };
    yield { cycles: 3, op: 'ld hl,wChannelSoundIDs' };
    yield { cycles: 2, op: 'add hl,bc' };
    yield* mem('wSoundID', 'ld a,[wSoundID]');
    yield store(2, `wChannelSoundIDs.${channel + 1}`, INTRO_YELLOW_MUSIC_ID, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hl],a', { publishes: 'music-channel' });
    yield { cycles: 3, op: 'pop bc' };
    yield { cycles: 3, op: 'pop hl' };
    yield { cycles: 1, op: 'inc c' };
    yield { cycles: 1, op: 'dec b' };
    yield { cycles: 1, op: 'ld a,b' };
    yield { cycles: 1, op: 'and a' };
    yield* mem2('music-header', 'ld a,[de]');
    yield { cycles: 2, op: 'inc de' };
    yield { cycles: channel < 2 ? 3 : 2, op: 'jr nz,.commandPointerLoop', control: 'jr' };
  }
  yield* mem('wSoundID', 'ld a,[wSoundID]');
  yield { cycles: 2, op: 'cp CRY_SFX_START' };
  yield { cycles: 3, op: 'jr nc,.maybeCry', control: 'jr' };
  yield* mem('wSoundID', 'ld a,[wSoundID]', 'Audio3_PlaySound.maybeCry');
  yield { cycles: 2, op: 'cp CRY_SFX_END' };
  yield { cycles: 2, op: 'jr z,.done', control: 'jr' };
  yield { cycles: 2, op: 'jr c,.cry', control: 'jr' };
  yield { cycles: 3, op: 'jr .done', control: 'jr' };
  yield { cycles: 4, op: 'ret', routine: 'Audio3_PlaySound.done', control: 'ret' };
}

function* fillMemory(): Gen {
  yield { cycles: 4, op: 'push af', routine: 'FillMemory' };
  yield { cycles: 1, op: 'ld a,b' };
  yield { cycles: 1, op: 'and a' };
  yield { cycles: 3, op: 'jr z,.eightbitcopyamount', control: 'jr' };
  yield { cycles: 1, op: 'inc b' };
  yield { cycles: 3, op: 'pop af' };
  for (let i = 0; i < 0xc8; i++) {
    yield store(2, 'wAnimatedObjectsData', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a');
    yield { cycles: 1, op: 'dec c' };
    yield { cycles: i < 0xc7 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
  }
  yield { cycles: 1, op: 'dec b' };
  yield { cycles: 2, op: 'jr nz,.loop', control: 'jr' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** ClearObjectAnimationBuffers: FillMemory of $c8 zero bytes. 614 instructions, 4,944 dots, excluding IRQ time. */
export function* introClearObjectAnimationBuffersSteps(): Gen {
  yield { cycles: 3, op: 'ld hl,wAnimatedObjectsData', routine: 'ClearObjectAnimationBuffers' };
  yield { cycles: 3, op: 'ld bc,$00c8' };
  yield { cycles: 1, op: 'xor a' };
  yield { cycles: 6, op: 'call FillMemory', control: 'call' };
  yield* fillMemory();
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** Movie setup copies. 255 tiles is 31 chunks of 8 and one of 7. 128 tiles is 16 chunks of 8 and a final zero-size
 *  request that still calls DelayFrame. VBlank owns the copy and the pointer advance. */
export function* introCopyVideoDataSteps(input: IntroCopyVideoInput): Gen {
  if (input.tiles !== 255 && input.tiles !== 128) throw new RangeError('CopyVideoData tile count is outside the movie setup');
  const source = word(input.source, 'source');
  const dest = word(input.dest, 'dest');
  if (!Number.isInteger(input.bank) || input.bank < 0 || input.bank > 255) throw new RangeError('Invalid intro helper bank');
  const auto = yield* ldh('hAutoBGTransferEnabled', 'ldh a,[hAutoBGTransferEnabled]', 'CopyVideoData');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 1, op: 'xor a' };
  yield store(3, 'hAutoBGTransferEnabled', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hAutoBGTransferEnabled],a');
  const rom = yield* ldh('hLoadedROMBank', 'ldh a,[hLoadedROMBank]');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 1, op: 'ld a,b' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(input.bank, true);
  yield { cycles: 1, op: 'ld a,e' };
  yield store(3, 'hVBlankCopySource', source & 255, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hVBlankCopySource],a');
  yield { cycles: 1, op: 'ld a,d' };
  yield store(3, 'hVBlankCopySource.hi', source >> 8, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hVBlankCopySource+1],a');
  yield { cycles: 1, op: 'ld a,l' };
  yield store(3, 'hVBlankCopyDest', dest & 255, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hVBlankCopyDest],a');
  yield { cycles: 1, op: 'ld a,h' };
  yield store(3, 'hVBlankCopyDest.hi', dest >> 8, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hVBlankCopyDest+1],a');
  let left = input.tiles;
  for (;;) {
    yield { cycles: 1, op: 'ld a,c' };
    yield { cycles: 2, op: 'cp 8' };
    if (left >= 8) {
      yield { cycles: 3, op: 'jr nc,.keepgoing', control: 'jr' };
      yield { cycles: 2, op: 'ld a,8' };
      yield store(3, 'hVBlankCopySize', 8, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hVBlankCopySize],a');
      yield { cycles: 6, op: 'call DelayFrame', control: 'call' };
      yield* introDelayFrameSteps();
      yield { cycles: 1, op: 'ld a,c' };
      yield { cycles: 2, op: 'sub 8' };
      yield { cycles: 1, op: 'ld c,a' };
      yield { cycles: 3, op: 'jr .loop', control: 'jr' };
      left -= 8;
      continue;
    }
    yield { cycles: 2, op: 'jr nc,.keepgoing', control: 'jr' };
    yield store(3, 'hVBlankCopySize', left, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hVBlankCopySize],a');
    yield { cycles: 6, op: 'call DelayFrame', control: 'call' };
    yield* introDelayFrameSteps();
    yield { cycles: 3, op: 'pop af' };
    yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
    yield* bankswitchCommon(rom, true);
    yield { cycles: 3, op: 'pop af' };
    yield store(3, 'hAutoBGTransferEnabled', auto, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hAutoBGTransferEnabled],a');
    yield { cycles: 4, op: 'ret', control: 'ret' };
    return;
  }
}

function* fadeOutAudio(): Gen {
  const control = yield* mem('wAudioFadeOutControl', 'ld a,[wAudioFadeOutControl]', 'FadeOutAudio');
  yield { cycles: 1, op: 'and a' };
  if (control) throw new RangeError('Intro helper audio fade-out is unsupported');
  yield { cycles: 2, op: 'jr nz,.fadingOut', control: 'jr' };
  const flags = yield* mem('wStatusFlags2', 'ld a,[wStatusFlags2]');
  yield { cycles: 2, op: 'bit BIT_NO_AUDIO_FADE_OUT,a' };
  if (flags & 2) throw new RangeError('Intro helper audio fade skip is unsupported');
  yield { cycles: 2, op: 'ret nz', control: 'ret' };
  yield { cycles: 2, op: 'ld a,$77' };
  yield store(3, 'rAUDVOL', 0x77, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rAUDVOL],a');
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* lowHealthAlarm(): Gen {
  const alarm = yield* mem('wLowHealthAlarm', 'ld a,[wLowHealthAlarm]', 'Music_DoLowHealthAlarm');
  yield { cycles: 2, op: 'cp DISABLE_LOW_HEALTH_ALARM' };
  if (alarm === 0xff || alarm & 0x80) throw new RangeError('Intro helper low-health alarm is unsupported');
  yield { cycles: 2, op: 'jr z,.disableAlarm', control: 'jr' };
  yield { cycles: 2, op: 'bit BIT_LOW_HEALTH_ALARM,a' };
  yield { cycles: 5, op: 'ret z', control: 'ret' };
}

/** UpdateAudioDuringLoadBGMapAttributes. The callee aggregate is the setup predictor, observed at this call. */
function* manualAudio(sources: IntroHelperSources, slot: string): Gen {
  const saved = yield* ldh('hLoadedROMBank', 'ldh a,[hLoadedROMBank]', 'UpdateAudioDuringLoadBGMapAttributes');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 6, op: 'call FadeOutAudio', control: 'call' };
  yield* fadeOutAudio();
  yield { cycles: 2, op: 'ld a,BANK(Music_DoLowHealthAlarm)' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(0x08, true);
  yield { cycles: 6, op: 'call Music_DoLowHealthAlarm', control: 'call' };
  yield* lowHealthAlarm();
  yield { cycles: 2, op: 'ld a,BANK(Audio1_UpdateMusic)' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(0x02, true);
  yield { cycles: 6, op: 'call Audio1_UpdateMusic', control: 'call' };
  yield audioCost(sources, 'setup', slot);
  yield { cycles: 3, op: 'pop af' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(saved, true);
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* waitLyEquals(value: number): Gen {
  for (;;) {
    const ly = yield* ldh('rLY', 'ldh a,[rLY]');
    yield { cycles: 2, op: 'cp $90' };
    if (ly !== value) yield { cycles: 3, op: 'jr nz,.waitForVBlank', control: 'jr' };
    else { yield { cycles: 2, op: 'jr nz,.waitForVBlank', control: 'jr' }; return; }
  }
}

function* waitStatBitClear(): Gen {
  for (;;) {
    const stat = yield* ldh('rSTAT', 'ldh a,[rSTAT]');
    yield { cycles: 2, op: 'and %10' };
    if (stat & 2) yield { cycles: 3, op: 'jr nz,.waitForAccessibleVRAM', control: 'jr' };
    else { yield { cycles: 2, op: 'jr nz,.waitForAccessibleVRAM', control: 'jr' }; return; }
  }
}

function* vdmaSetup(source: number, destHigh: number, destLow: number): Gen {
  yield { cycles: 1, op: 'ld a,h' };
  yield store(3, 'rVDMA_SRC_HIGH', source >> 8, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVDMA_SRC_HIGH],a');
  yield { cycles: 1, op: 'ld a,l' };
  yield store(3, 'rVDMA_SRC_LOW', source & 255, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVDMA_SRC_LOW],a');
  yield { cycles: 3, op: 'ld de,vBGMap' };
  yield { cycles: 1, op: 'ld a,d' };
  yield store(3, 'rVDMA_DEST_HIGH', destHigh, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVDMA_DEST_HIGH],a');
  yield { cycles: 1, op: 'ld a,e' };
  yield store(3, 'rVDMA_DEST_LOW', destLow, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVDMA_DEST_LOW],a');
}

function* lcdOnWaits(): Gen {
  const lcdc = yield* ldh('rLCDC', 'ldh a,[rLCDC]');
  yield { cycles: 2, op: 'and LCDC_ON' };
  if ((lcdc & LCDC_ON) === 0) throw new RangeError('LoadBGMapAttributes with the LCD off is unsupported');
  yield { cycles: 2, op: 'jr z,.lcdOff', control: 'jr' };
  yield* waitLyEquals(0x90);
  yield* waitStatBitClear();
}

/** Whole-screen attribute packet only: two $3f GDMA writes, two setup-audio calls, then IF with STAT preserved. */
export function* introLoadBgMapAttributesSteps(sources: IntroHelperSources): Gen {
  yield { cycles: 3, op: 'ld hl,BGMapAttributesPointers', routine: 'LoadBGMapAttributes' };
  yield { cycles: 1, op: 'ld a,c' };
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 1, op: 'dec a' };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 1, op: 'ld e,a' };
  yield { cycles: 1, op: 'xor a' };
  yield { cycles: 1, op: 'ld d,a' };
  yield { cycles: 2, op: 'add hl,de' };
  const packetLow = yield* mem2('attr-pointer.lo', 'ld a,[hli]');
  yield { cycles: 1, op: 'ld e,a' };
  const packetHigh = yield* mem2('attr-pointer.hi', 'ld a,[hl]');
  const packet = packetLow | packetHigh << 8;
  yield { cycles: 1, op: 'ld h,a' };
  yield { cycles: 1, op: 'ld a,e' };
  yield { cycles: 1, op: 'ld l,a' };
  yield { cycles: 1, op: 'di', di: true };
  yield { cycles: 2, op: 'ld a,1' };
  yield store(3, 'rVBK', 1, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVBK],a');
  yield { cycles: 4, op: 'push hl' };
  const first = yield* mem2('attr-length', 'ld a,[hl]');
  if (first !== INTRO_WHOLE_SCREEN_ATTR_LEN) throw new RangeError('LoadBGMapAttributes length is outside the whole-screen packet');
  yield { cycles: 1, op: 'ld c,a' };
  yield { cycles: 3, op: 'ld de,$10' };
  yield { cycles: 2, op: 'add hl,de' };
  yield* vdmaSetup((packet + 0x10) & 0xffff, 0x98, 0x00);
  yield* lcdOnWaits();
  yield { cycles: 1, op: 'ld a,c' };
  yield store(3, 'rVDMA_LEN', INTRO_WHOLE_SCREEN_ATTR_LEN, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVDMA_LEN],a');
  yield { kind: 'gdma', dots: INTRO_GDMA_STALL_DOTS, which: 1 };
  yield { cycles: 6, op: 'call UpdateAudioDuringLoadBGMapAttributes', control: 'call' };
  yield* manualAudio(sources, 'attributes-1');
  yield { cycles: 3, op: 'pop hl' };
  const second = yield* mem2('attr-length', 'ld a,[hli]');
  if (second !== INTRO_WHOLE_SCREEN_ATTR_LEN) throw new RangeError('LoadBGMapAttributes length is outside the whole-screen packet');
  yield { cycles: 1, op: 'ld c,a' };
  const offsetLow = yield* mem2('attr-offset.lo', 'ld a,[hli]');
  yield { cycles: 1, op: 'ld e,a' };
  const offsetHigh = yield* mem2('attr-offset.hi', 'ld a,[hli]');
  yield { cycles: 1, op: 'ld d,a' };
  yield { cycles: 2, op: 'add hl,de' };
  yield* vdmaSetup((packet + 3 + (offsetLow | offsetHigh << 8)) & 0xffff, 0x9c, 0x00);
  yield* lcdOnWaits();
  yield { cycles: 1, op: 'ld a,c' };
  yield store(3, 'rVDMA_LEN', INTRO_WHOLE_SCREEN_ATTR_LEN, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVDMA_LEN],a');
  yield { kind: 'gdma', dots: INTRO_GDMA_STALL_DOTS, which: 2 };
  yield { cycles: 3, op: 'pop af' };
  yield { cycles: 1, op: 'dec a' };
  yield { cycles: 1, op: 'dec a' };
  yield { cycles: 1, op: 'dec a' };
  yield { cycles: 1, op: 'dec a' };
  yield { cycles: 3, op: 'jr nz,.checkIfHandlingPartyMenu', control: 'jr' };
  yield { cycles: 1, op: 'dec a' };
  yield { cycles: 3, op: 'call z,HandlePartyHPBarAttributes', control: 'call' };
  yield { cycles: 6, op: 'call UpdateAudioDuringLoadBGMapAttributes', control: 'call' };
  yield* manualAudio(sources, 'attributes-2');
  const pending = yield* ldh('rIF', 'ldh a,[rIF]');
  yield { cycles: 2, op: 'res B_IF_VBLANK,a' };
  yield store(3, 'rIF', pending & ~1, INTRO_IF_STORE_TRAILING_DOTS, 'ldh [rIF],a');
  yield { cycles: 1, op: 'xor a' };
  yield store(3, 'rVBK', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [rVBK],a');
  yield { cycles: 1, op: 'ei', ei: true };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* colorPacketIndex(index: number): Gen {
  if (index > 0) yield { cycles: 3, op: 'pop hl' };
  const palette = yield* mem2(`pal-id.${index}`, 'ld a,[hli]');
  yield { cycles: 2, op: 'inc hl' };
  if (index < 3) yield { cycles: 4, op: 'push hl' };
  yield { cycles: 6, op: 'call GetCGBBasePalAddress', control: 'call' };
  const address = yield* getCgbBasePalAddress(palette);
  yield { cycles: 1, op: 'ld a,e' };
  yield store(4, `wCGBBasePalPointers.${index}.lo`, address & 255, INTRO_CPU_STORE_TRAILING_DOTS, `ld [wCGBBasePalPointers+${index}*2],a`);
  yield { cycles: 1, op: 'ld a,d' };
  yield store(4, `wCGBBasePalPointers.${index}.hi`, address >> 8, INTRO_CPU_STORE_TRAILING_DOTS, `ld [wCGBBasePalPointers+${index}*2+1],a`);
  yield { cycles: 1, op: 'xor a' };
  yield { cycles: 6, op: 'call DMGPalToCGBPal', control: 'call' };
  yield* dmgPal(0);
  yield { cycles: 2, op: `ld a,${index}` };
  yield { cycles: 6, op: 'call TransferCurBGPData', control: 'call' };
  yield* transferCur('bg', index);
  yield { cycles: 2, op: 'ld a,CONVERT_OBP0' };
  yield { cycles: 6, op: 'call DMGPalToCGBPal', control: 'call' };
  yield* dmgPal(1);
  yield { cycles: 2, op: `ld a,${index}` };
  yield { cycles: 6, op: 'call TransferCurOBPData', control: 'call' };
  yield* transferCur('ob', index);
  yield { cycles: 2, op: 'ld a,CONVERT_OBP1' };
  yield { cycles: 6, op: 'call DMGPalToCGBPal', control: 'call' };
  yield* dmgPal(2);
  yield { cycles: 2, op: `ld a,${index + 4}` };
  yield { cycles: 6, op: 'call TransferCurOBPData', control: 'call' };
  yield* transferCur('ob', index + 4);
}

function* initColorPalettes(): Gen {
  const packet = yield { cycles: 2, op: 'ld a,[hl]', routine: 'InitCGBPalettes', read: { field: 'packet', trailingDots: INTRO_CPU_STORE_TRAILING_DOTS } };
  byteReply(packet, 'packet');
  yield { cycles: 2, op: 'and $f8' };
  yield { cycles: 2, op: 'cp $20' };
  yield { cycles: 3, op: 'jp z,TranslatePalPacketToBGMapAttributes', control: 'jp' };
  yield { cycles: 2, op: 'inc hl' };
  for (let index = 0; index < 4; index++) yield* colorPacketIndex(index);
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* translateWholeScreen(sources: IntroHelperSources): Gen {
  yield { cycles: 4, op: 'push hl', routine: 'TranslatePalPacketToBGMapAttributes' };
  yield { cycles: 3, op: 'pop de' };
  yield { cycles: 3, op: 'ld hl,PalPacketPointers' };
  yield* mem2('packet-count', 'ld a,[hli]');
  yield { cycles: 1, op: 'ld c,a' };
  yield { cycles: 1, op: 'ld a,e' };
  yield* mem2('packet-pointer', 'cp [hl]');
  yield { cycles: 3, op: 'jr z,.checkHighByte', control: 'jr' };
  yield { cycles: 2, op: 'inc hl' };
  yield { cycles: 1, op: 'ld a,d' };
  yield* mem2('packet-pointer', 'cp [hl]');
  yield { cycles: 3, op: 'jr z,.foundMatchingPointer', control: 'jr' };
  yield { cycles: 2, op: 'ld b,BANK(LoadBGMapAttributes)' };
  yield { cycles: 3, op: 'ld hl,LoadBGMapAttributes' };
  yield { cycles: 6, op: 'call Bankswitch', control: 'call' };
  yield* bankswitch(0x2f, () => introLoadBgMapAttributesSteps(sources));
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* sendSgbPackets(sources: IntroHelperSources): Gen {
  const on = yield* ldh('hOnCGB', 'ldh a,[hOnCGB]', 'SendSGBPackets');
  yield { cycles: 1, op: 'and a' };
  if (!on) throw new RangeError('RunPaletteCommand on DMG is unsupported');
  yield { cycles: 2, op: 'jr z,.notCGB', control: 'jr' };
  yield { cycles: 4, op: 'push de' };
  yield { cycles: 6, op: 'call InitCGBPalettes', control: 'call' };
  yield* initColorPalettes();
  yield { cycles: 3, op: 'pop hl' };
  yield { cycles: 6, op: 'call InitCGBPalettes', control: 'call' };
  const attribute = yield { cycles: 2, op: 'ld a,[hl]', routine: 'InitCGBPalettes', read: { field: 'packet', trailingDots: INTRO_CPU_STORE_TRAILING_DOTS } };
  byteReply(attribute, 'packet');
  yield { cycles: 2, op: 'and $f8' };
  yield { cycles: 2, op: 'cp $20' };
  yield { cycles: 4, op: 'jp z,TranslatePalPacketToBGMapAttributes', control: 'jp' };
  yield* translateWholeScreen(sources);
  const lcdc = yield* ldh('rLCDC', 'ldh a,[rLCDC]');
  yield { cycles: 2, op: 'and LCDC_ON' };
  if ((lcdc & LCDC_ON) === 0) {
    yield { cycles: 5, op: 'ret z', control: 'ret' };
    return;
  }
  yield { cycles: 2, op: 'ret z', control: 'ret' };
  yield { cycles: 6, op: 'call Delay3', control: 'call' };
  yield* delay3();
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* getPredefPointer(graphicsSource: number): Gen {
  // Movie entry only: FillMemory ends at wAnimatedObjectsDataEnd with BC exhausted, then B is set to SET_PAL_GENERIC.
  // The last CopyVideoData source is still in DE (pret b452f2ab).
  const animatedObjectsEnd = 0xc5d0;
  yield { cycles: 1, op: 'ld a,h', routine: 'GetPredefPointer' };
  yield store(4, 'wPredefHL', animatedObjectsEnd >> 8, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wPredefHL],a');
  yield { cycles: 1, op: 'ld a,l' };
  yield store(4, 'wPredefHL.lo', animatedObjectsEnd & 255, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wPredefHL+1],a');
  yield { cycles: 3, op: 'ld hl,wPredefDE' };
  yield { cycles: 1, op: 'ld a,d' };
  yield store(2, 'wPredefDE', graphicsSource >> 8, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a');
  yield { cycles: 1, op: 'ld a,e' };
  yield store(2, 'wPredefDE.lo', graphicsSource & 255, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a');
  yield { cycles: 1, op: 'ld a,b' };
  yield store(2, 'wPredefBC', 8, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hli],a'); // SET_PAL_GENERIC
  yield store(2, 'wPredefBC.lo', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [hl],c'); // FillMemory exhausted BC before B was set
  yield { cycles: 3, op: 'ld hl,PredefPointers' };
  yield { cycles: 3, op: 'ld de,0' };
  yield* mem('wPredefID', 'ld a,[wPredefID]');
  yield { cycles: 1, op: 'ld e,a' };
  yield { cycles: 1, op: 'add a' };
  yield { cycles: 1, op: 'add e' };
  yield { cycles: 1, op: 'ld e,a' };
  yield { cycles: 3, op: 'jr nc,.nocarry', control: 'jr' };
  yield { cycles: 2, op: 'add hl,de' };
  yield { cycles: 1, op: 'ld d,h' };
  yield { cycles: 1, op: 'ld e,l' };
  yield* mem2('predef-bank', 'ld a,[de]');
  yield store(4, 'wPredefBank', 0x1c, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wPredefBank],a');
  yield { cycles: 2, op: 'inc de' };
  yield* mem2('predef-pointer', 'ld a,[de]');
  yield { cycles: 1, op: 'ld l,a' };
  yield { cycles: 2, op: 'inc de' };
  yield* mem2('predef-pointer', 'ld a,[de]');
  yield { cycles: 1, op: 'ld h,a' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* getPredefRegisters(): Gen {
  yield* mem('wPredefHL', 'ld a,[wPredefHL]', 'GetPredefRegisters');
  yield { cycles: 1, op: 'ld h,a' };
  yield* mem('wPredefHL.lo', 'ld a,[wPredefHL+1]');
  yield { cycles: 1, op: 'ld l,a' };
  yield* mem('wPredefDE', 'ld a,[wPredefDE]');
  yield { cycles: 1, op: 'ld d,a' };
  yield* mem('wPredefDE.lo', 'ld a,[wPredefDE+1]');
  yield { cycles: 1, op: 'ld e,a' };
  yield* mem('wPredefBC', 'ld a,[wPredefBC]');
  yield { cycles: 1, op: 'ld b,a' };
  yield* mem('wPredefBC.lo', 'ld a,[wPredefBC+1]');
  yield { cycles: 1, op: 'ld c,a' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

function* setPalGeneric(sources: IntroHelperSources): Gen {
  yield { cycles: 3, op: 'ld hl,PalPacket_Generic', routine: 'SetPal_Generic' };
  yield { cycles: 3, op: 'ld de,BlkPacket_WholeScreen' };
  yield { cycles: 4, op: 'ret', control: 'ret' };
  yield* sendSgbPackets(sources);
}

/** CGB SET_PAL_GENERIC: predef dispatch, whole-screen attributes, then LCD-on Delay3. */
export function* introRunPaletteCommandSteps(sources: IntroHelperSources, graphicsSource: number): Gen {
  const sgb = yield* mem('wOnSGB', 'ld a,[wOnSGB]', 'RunPaletteCommand');
  yield { cycles: 1, op: 'and a' };
  if (!sgb) throw new RangeError('RunPaletteCommand without the CGB SGB flag is unsupported');
  yield { cycles: 2, op: 'ret z', control: 'ret' };
  yield { cycles: 2, op: 'ld a,_RunPaletteCommandPredef' };
  yield { cycles: 4, op: 'jp Predef', control: 'jp' };
  yield store(4, 'wPredefID', 69, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wPredefID],a', { routine: 'Predef' });
  const parent = yield* ldh('hLoadedROMBank', 'ldh a,[hLoadedROMBank]');
  yield store(4, 'wPredefParentBank', parent, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [wPredefParentBank],a');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 2, op: 'ld a,BANK(GetPredefPointer)' };
  yield store(3, 'hLoadedROMBank', 0x3d, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hLoadedROMBank],a');
  yield store(4, 'rROMB', 0x3d, INTRO_CPU_STORE_TRAILING_DOTS, 'ld [rROMB],a');
  yield { cycles: 6, op: 'call GetPredefPointer', control: 'call' };
  yield* getPredefPointer(graphicsSource);
  yield* mem('wPredefBank', 'ld a,[wPredefBank]');
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(0x1c, true);
  yield { cycles: 3, op: 'ld de,.done' };
  yield { cycles: 4, op: 'push de' };
  yield { cycles: 1, op: 'jp hl', control: 'jp' };
  yield { cycles: 6, op: 'call GetPredefRegisters', routine: '_RunPaletteCommand', control: 'call' };
  yield* getPredefRegisters();
  yield { cycles: 1, op: 'ld a,b' };
  yield { cycles: 2, op: 'cp SET_PAL_DEFAULT' };
  yield { cycles: 3, op: 'jr nz,.not_default', control: 'jr' };
  yield { cycles: 2, op: 'cp SET_PAL_PARTY_MENU_HP_BARS' };
  yield { cycles: 3, op: 'jp z,UpdatePartyMenuBlkPacket', control: 'jp' };
  yield { cycles: 1, op: 'ld l,a' };
  yield { cycles: 2, op: 'ld h,0' };
  yield { cycles: 2, op: 'add hl,hl' };
  yield { cycles: 3, op: 'ld de,SetPalFunctions' };
  yield { cycles: 2, op: 'add hl,de' };
  yield* mem2('pal-function', 'ld a,[hli]');
  yield* mem2('pal-function', 'ld h,[hl]');
  yield { cycles: 1, op: 'ld l,a' };
  yield { cycles: 3, op: 'ld de,SendSGBPackets' };
  yield { cycles: 4, op: 'push de' };
  yield { cycles: 1, op: 'jp hl', control: 'jp' };
  yield* setPalGeneric(sources);
  yield { cycles: 3, op: 'pop af', routine: 'Predef.done' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(parent, true);
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

const JOYPAD_BANK = 0x03;

function* joypadBody(): Gen {
  const input = yield* ldh('hJoyInput', 'ldh a,[hJoyInput]', '_Joypad');
  yield { cycles: 1, op: 'ld b,a' };
  yield { cycles: 2, op: 'and PAD_BUTTONS|PAD_UP' };
  yield { cycles: 2, op: 'cp PAD_BUTTONS' };
  if ((input & (PAD_BUTTONS | PAD_UP)) === PAD_BUTTONS) throw new RangeError('Intro helper soft reset is unsupported');
  yield { cycles: 3, op: 'jp z,TrySoftReset', control: 'jp' };
  const last = yield* ldh('hJoyLast', 'ldh a,[hJoyLast]');
  yield { cycles: 1, op: 'ld e,a' };
  yield { cycles: 1, op: 'xor b' };
  yield { cycles: 1, op: 'ld d,a' };
  yield { cycles: 1, op: 'and e' };
  yield store(3, 'hJoyReleased', (last ^ input) & last, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hJoyReleased],a');
  yield { cycles: 1, op: 'ld a,d' };
  yield { cycles: 1, op: 'and b' };
  yield store(3, 'hJoyPressed', (last ^ input) & input, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hJoyPressed],a');
  yield { cycles: 1, op: 'ld a,b' };
  yield store(3, 'hJoyLast', input, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hJoyLast],a');
  const flags = yield* mem('wStatusFlags5', 'ld a,[wStatusFlags5]');
  yield { cycles: 2, op: 'bit BIT_DISABLE_JOYPAD,a' };
  if (flags & 0x20) throw new RangeError('Intro helper joypad disable is unsupported');
  yield { cycles: 2, op: 'jr nz,DiscardButtonPresses', control: 'jr' };
  yield* ldh('hJoyLast', 'ldh a,[hJoyLast]');
  yield store(3, 'hJoyHeld', input, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hJoyHeld],a');
  const ignore = yield* mem('wJoyIgnore', 'ld a,[wJoyIgnore]');
  yield { cycles: 1, op: 'and a' };
  if (ignore) throw new RangeError('Intro helper joypad mask is unsupported');
  yield { cycles: 5, op: 'ret z', control: 'ret' };
}

function* joypadTrampoline(): Gen {
  const saved = yield* ldh('hLoadedROMBank', 'ldh a,[hLoadedROMBank]', 'Joypad');
  yield { cycles: 4, op: 'push af' };
  yield { cycles: 2, op: 'ld a,BANK(_Joypad)' };
  yield { cycles: 6, op: 'call BankswitchCommon', control: 'call' };
  yield* bankswitchCommon(JOYPAD_BANK, true);
  yield { cycles: 6, op: 'call _Joypad', control: 'call' };
  yield* joypadBody();
  yield { cycles: 3, op: 'pop af' };
  yield { cycles: 4, op: 'jp BankswitchCommon', control: 'jp' };
  yield* bankswitchCommon(saved, true);
}

/** JoypadLowSensitivity plus its home trampoline and _Joypad. hJoy5 is this helper's report; hJoyPressed is what the
 *  movie tests for a skip. Soft reset, the joypad-disable bit and a nonzero wJoyIgnore are refused. hJoy7 nonzero is
 *  the held-button mode; the movie's observed frames use hJoy7 = 0. */
export function* introJoypadLowSensitivitySteps(): Gen {
  yield { cycles: 6, op: 'call Joypad', routine: 'JoypadLowSensitivity', control: 'call' };
  yield* joypadTrampoline();
  const joy7 = yield* ldh('hJoy7', 'ldh a,[hJoy7]');
  yield { cycles: 1, op: 'and a' };
  const pressedLatch = yield* ldh('hJoyPressed', 'ldh a,[hJoyPressed]');
  yield { cycles: joy7 ? 2 : 3, op: 'jr z,.storeButtonState', control: 'jr' };
  const reported = joy7 ? yield* ldh('hJoyHeld', 'ldh a,[hJoyHeld]') : pressedLatch;
  yield store(3, 'hJoy5', reported, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hJoy5],a');
  const pressed = yield* ldh('hJoyPressed', 'ldh a,[hJoyPressed]');
  yield { cycles: 1, op: 'and a' };
  if (pressed) {
    yield { cycles: 2, op: 'jr z,.noNewlyPressedButtons', control: 'jr' };
    yield { cycles: 2, op: 'ld a,30' };
    yield store(3, 'hFrameCounter', 30, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hFrameCounter],a');
    yield { cycles: 4, op: 'ret', control: 'ret' };
    return;
  }
  yield { cycles: 3, op: 'jr z,.noNewlyPressedButtons', control: 'jr' };
  const counter = yield* ldh('hFrameCounter', 'ldh a,[hFrameCounter]');
  yield { cycles: 1, op: 'and a' };
  if (counter) {
    yield { cycles: 2, op: 'jr z,.delayOver', control: 'jr' };
    yield { cycles: 1, op: 'xor a' };
    yield store(3, 'hJoy5', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hJoy5],a');
    yield { cycles: 4, op: 'ret', control: 'ret' };
    return;
  }
  yield { cycles: 3, op: 'jr z,.delayOver', control: 'jr' };
  const held = yield* ldh('hJoyHeld', 'ldh a,[hJoyHeld]');
  yield { cycles: 2, op: 'and PAD_A|PAD_B' };
  if ((held & PAD_A_B) === 0) yield { cycles: 3, op: 'jr z,.setShortDelay', control: 'jr' };
  else {
    yield { cycles: 2, op: 'jr z,.setShortDelay', control: 'jr' };
    const joy6 = yield* ldh('hJoy6', 'ldh a,[hJoy6]');
    yield { cycles: 1, op: 'and a' };
    if (joy6) yield { cycles: 3, op: 'jr nz,.setShortDelay', control: 'jr' };
    else {
      yield { cycles: 2, op: 'jr nz,.setShortDelay', control: 'jr' };
      yield { cycles: 1, op: 'xor a' };
      yield store(3, 'hJoy5', 0, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hJoy5],a');
    }
  }
  yield { cycles: 2, op: 'ld a,5' };
  yield store(3, 'hFrameCounter', 5, INTRO_CPU_STORE_TRAILING_DOTS, 'ldh [hFrameCounter],a');
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

/** LCD-off counted passes at scene states 2 and 4. Overhead is 66*n+3 cycles apart from the movie-music callee. */
export function* introUpdateMusicCTimesSteps(count: number, sources: IntroHelperSources): Gen {
  if (count !== 8 && count !== 5) throw new RangeError('UpdateMusicCTimes count is outside scenes 2 and 4');
  for (let index = 0; index < count; index++) {
    yield { cycles: 4, op: 'push bc', routine: 'UpdateMusicCTimes' };
    yield { cycles: 4, op: 'push hl' };
    yield { cycles: 2, op: 'ld b,BANK(Audio1_UpdateMusic)' };
    yield { cycles: 3, op: 'ld hl,Audio1_UpdateMusic' };
    yield { cycles: 6, op: 'call Bankswitch', control: 'call' };
    const slot = index;
    yield* bankswitch(0x02, function* movieCallee() {
      yield audioCost(sources, 'movie', `counted-${slot + 1}`);
    });
    yield { cycles: 3, op: 'pop hl' };
    yield { cycles: 3, op: 'pop bc' };
    yield { cycles: 1, op: 'dec c' };
    yield { cycles: index < count - 1 ? 3 : 2, op: 'jr nz,.loop', control: 'jr' };
  }
  yield { cycles: 4, op: 'ret', control: 'ret' };
}

// Note 138 (2c3a): the movie's palette action (YellowIntroPaletteAction through callfar) reaches these streams.
// Exported as they are, with no behavior change.
export {
  bankswitch as introBankswitchSteps, initColorPalettes as introInitCgbPalettesSteps,
  getCgbBasePalAddress as introGetCgbBasePalAddressSteps, dmgPal as introDmgPalToCgbPalSteps,
  transferCur as introTransferCurPalDataSteps,
};
