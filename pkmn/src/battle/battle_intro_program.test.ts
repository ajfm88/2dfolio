import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
vi.mock('../renderer', () => ({ getCtx: vi.fn(), getScale: () => 1 }));
vi.mock('../input', () => ({ isHeld:()=>false,isPressed:()=>false,isPassPressed:()=>false,syncJoypadRead:vi.fn(),readJoypad:vi.fn() }));
vi.mock('../audio', () => ({ playSFX:vi.fn(),isSoundFinished:()=>true }));
import { BattleState, encodeText, W_SPRITE_FLIPPED } from './battle_state';
import { D } from './battle_end_state';
import { INIT, type BattleInitHost } from './battle_init';
import { BattleScreen } from './battle_screen';
import { battleSilhouetteIntro } from './battle_intro_program';
import { BattleIntroTiming, INTRO_SCROLL, type IntroScanout } from './battle_intro_timing';
import { renderBattleScreen, type RawImage, type BattleRenderTiles } from './battle_screen_render';
import { frontPictureBox, backPictureBox } from './battle_pictures';
import type { Program } from './battle_menu_context';
import { textBgTransfer } from '../text/bg_transfer';
import { BattleAudio } from './battle_audio';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';

const bridges: BattleAudio[] = [];
beforeEach(() => { textBgTransfer.enabled = false; textBgTransfer.resetPortion(); textBgTransfer.enabled = true;
  textBgTransfer.tick(); textBgTransfer.enabled = false; setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); });
afterEach(() => { bridges.splice(0).forEach(bridge => bridge.dispose()); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

const noScan: IntroScanout = { to() {}, endFrame() {}, restart() {} };
function clock(line: number) { return new BattleIntroTiming(new BattleState(), new BattleScreen(), line, noScan); }
function driveClock(timing: BattleIntroTiming, program: Program): string[] {
  const frames: string[] = [];
  for (let next = program.next(); !next.done; next = program.next()) {
    expect(next.value).not.toBe('session'); frames.push(next.value);
    if (next.value !== 'session') timing.boundary(next.value);
  }
  return frames;
}

describe('A5e checkpoint-03b raster barriers', () => {
  it.each([[144,64,[]], [64,96,[]], [96,64,['serviced']], [64,64,[]]] as const)
  ('waits from LY%i to LY%i without inventing a whole frame', (from, to, frames) => {
    const timing = clock(from); expect(driveClock(timing, timing.until(to))).toEqual(frames); expect(timing.line).toBe(to);
  });
  it.each([[144,0], [145,0], [146,1], [0,1]] as const)
  ('services DisableLCD\'s deferred VBlank from LY%i (%i frames)', (from, count) => {
    const timing = clock(from), run = timing.disableLCD();
    const frames: string[] = [];
    for (let next = run.next(); !next.done; next = run.next()) {
      expect(next.value).toBe('serviced');
      timing.boundary('serviced');
      frames.push(next.value);
    }
    expect(frames).toHaveLength(count); expect(timing.line).toBe(145);
    expect(timing.screen.lcdOn).toBe(false);
    timing.enableLCD(); expect(timing.line).toBe(0); expect(timing.screen.lcdOn).toBe(true);
  });
  it('does not capture future visible rows while waiting144→145 inside VBlank', () => {
    const scan = { to: vi.fn(), endFrame: vi.fn(), restart: vi.fn() };
    const timing = new BattleIntroTiming(new BattleState(), new BattleScreen(), 144, scan);
    expect(timing.disableLCD().next().done).toBe(true); expect(scan.to).not.toHaveBeenCalled();
    timing.enableLCD(); expect(scan.restart).toHaveBeenCalledOnce(); expect(scan.endFrame).not.toHaveBeenCalled();
  });
  it('a closed DisableLCD wait leaves the LCD on', () => {
    const timing = clock(146), run = timing.disableLCD(); expect(run.next().value).toBe('serviced');
    run.return(undefined); expect(timing.screen.lcdOn).toBe(true);
  });
  it('rejects invalid entry phase and raster writes; waits require the LCD', () => {
    for (const line of [-1,154,1.5,NaN]) expect(() => clock(line)).toThrow('intro entry LY out of range');
    const timing = clock(144); expect(() => timing.writeSplitX(3)).toThrow('intro SCX write outside raster barrier');
    timing.screen.lcdOn = false; expect(() => timing.until(64).next()).toThrow('intro raster wait requires LCD on');
    expect(() => timing.boundary('held')).toThrow('intro boundary requires LCD on');
    timing.enableLCD(); expect(() => timing.enableLCD()).toThrow('intro LCD already enabled');
  });
  it('lcdOff refuses an LCD that is on, and a dark boundary leaves the line', () => {
    const timing = clock(100);
    expect(() => { for (const frame of timing.lcdOff(1)) void frame; }).toThrow('intro LCD-off span requires LCD off');
    expect(() => timing.boundary('dark')).toThrow('dark frame with LCD on');
    expect(timing.line).toBe(100);
  });
  it('latches HRAM only on serviced boundaries and seals the prior raster before the latch', () => {
    const state = new BattleState(), screen = new BattleScreen(), seen: number[] = [];
    screen.put(0,0,'A'); screen.setOam(0,{y:16,x:8,tile:0,attributes:2});
    textBgTransfer.enabled=true;
    const phase=textBgTransfer.nextPortion;
    screen.scx = 9; state.mem[INTRO_SCROLL.hSCX] = 22; state.mem[INTRO_SCROLL.hSCY] = 3;
    const timing = new BattleIntroTiming(state, screen, 96, { to: () => seen.push(screen.scx), endFrame() {}, restart() {} });
    timing.boundary('held'); expect(screen.scx).toBe(9); expect(screen.scy).toBe(0);
    timing.boundary('serviced'); expect(seen).toEqual([9,9]);
    expect([screen.scx, screen.scy, timing.physicalSCX]).toEqual([22,3,22]);
    expect(textBgTransfer.nextPortion).toBe(phase); expect(screen.visibleAt(0,0)).toBe(' ');
    expect(screen.oam(0).y).toBe(0); expect(screen.shadowOam(0).y).toBe(16);
    expect([INTRO_SCROLL.hSCX, INTRO_SCROLL.hSCY]).toEqual([INIT.hWY-2,INIT.hWY-1]);
  });
});

function png(file: string): RawImage { return PNG.sync.read(readFileSync(resolve(__dirname, '../../static/gfx', file))); }
function pictures(): BattleRenderTiles {
  const map = new Map<string,RawImage>([['front/19',frontPictureBox(png('sprites/front/19.png'),0x55)]]);
  for (const [key,file] of [['redb','player/redb.png'],['oldmanb','battle/oldmanb.png'],['prof.oakb','battle/prof.oakb.png']])
    map.set(key,backPictureBox(png(file)));
  return { font:png('font/font.png'),extra:png('font/font_battle_extra.png'),hud1:png('battle/battle_hud_1.png'),
    hud2:png('battle/battle_hud_2.png'),hud3:png('battle/battle_hud_3.png'),pictures:map,
    sprites:{width:128,height:128,data:new Uint8ClampedArray(128*128*4).fill(255)} };
}
function harness(type = 0, capture = false, flipped = false, trainer = false) {
  const state = new BattleState(), screen = new BattleScreen(), audio = audioRig();
  const bridge = new BattleAudio(audio.sfx,audio.music); bridges.push(bridge);
  state.wBattleType = type; state.wIsInBattle = trainer ? 2 : 1; state.wCurMap = 0x0c;
  state.wEnemyMonSpecies2 = trainer ? 0 : 0xa5; state.wCurPartySpecies = 0xa5;
  state.mem[D.wPartyCount] = state.mem[D.wEnemyPartyCount] = 1;
  state.setBytes(D.wPartySpecies,[0x54,255],2); state.writeBE(D.wPartyMons+1,20); state.writeBE(D.wEnemyMons+1,20);
  state.setBytes(D.wEnemyMonNick,encodeText('RATTATA@'),11); state.setBytes(D.wTrainerName,encodeText('BUG CATCHER@'),13);
  state.mem[W_SPRITE_FLIPPED] = flipped ? 1 : 0;
  state.mem[INTRO_SCROLL.hSCX] = 13; state.mem[INTRO_SCROLL.hSCY] = 7; state.mem[INIT.hTileAnimations] = 1;
  screen.lcdOn = false; screen.copyFront('front/19').next(); screen.setPalBattleBlack().next(); screen.lcdOn = true;
  for (let col=0;col<7;col++) for (let row=0;row<7;row++) screen.put(12+col,row,col*7+row);
  for (let x=0;x<11;x++) screen.put(x,0,'A');
  textBgTransfer.enabled = true; screen.vblank(); screen.vblank(); screen.vblank();
  textBgTransfer.resetPortion(); textBgTransfer.tick(); textBgTransfer.enabled = false;
  screen.setOam(21,{y:77,x:211,tile:0x34,attributes:7});
  const tiles = pictures(), frames: string[] = [], opening: {label:string;at:number;head:number[];palette:string}[] = [];
  const slides: {top:number;body:number|null;lower:number|null;shown:number;shadow:number;hram:number;wy:number;physical:number;pixels?:Uint8ClampedArray}[] = [];
  const iterations: {body:number|null;head:number;hram:number;bg:boolean;phase:number}[] = [];
  let cursor = 0, buffer = new Uint8ClampedArray(160*144*4), lastBeforeTail: Uint8ClampedArray | undefined;
  let lastAfterTail: Uint8ClampedArray | undefined;
  const timing = new BattleIntroTiming(state,screen,144,{
    to(end) {
      expect(end).toBeGreaterThanOrEqual(cursor);
      if (end === 96 && screen.scxSplit !== null) {
        iterations.push({body:screen.scxSplit,head:screen.oam(0).x,hram:state.mem[INTRO_SCROLL.hSCX],
          bg:textBgTransfer.enabled,phase:textBgTransfer.nextPortion});
        if (capture && iterations.length===72) lastBeforeTail=renderBattleScreen(screen,tiles);
      }
      if (capture && end>cursor) {
        const pixels = renderBattleScreen(screen,tiles); buffer.set(pixels.subarray(cursor*160*4,end*160*4),cursor*160*4);
        if (iterations.length===72 && screen.wy===0 && screen.scxSplit!==null) lastAfterTail=pixels;
      }
      cursor=end;
    },
    endFrame() {
      if (screen.scxSplit!==null) slides.push({top:screen.scx,body:screen.scxSplit,lower:screen.scxAfterSplit,
        shown:screen.oam(0).x,shadow:screen.shadowOam(0).x,hram:state.mem[INTRO_SCROLL.hSCX],wy:screen.wy,
        physical:timing.physicalSCX,pixels:capture?buffer.slice():undefined});
      cursor=0; buffer=new Uint8ClampedArray(160*144*4);
    },
    restart() { cursor=0; buffer=new Uint8ClampedArray(160*144*4); },
  });
  const host: BattleInitHost = {screen,audio:bridge,trainerAppeared:{id:0xe9,data:sfxData('trainer_appeared')},
    renderTiles:tiles,pokeballTiles:png('battle/balls.png'),frontPicture:()=> 'front/19',
    saveScreenTilesToBuffer1(){},loadScreenTilesFromBuffer1(){},marowakAnimation:function*(){throw new Error('unexpected tower');},
    printText:function*(label){opening.push({label,at:frames.length,head:Array.from({length:40},(_,i)=>screen.shadowOam(i).y),palette:screen.paletteName(3)});},
    introScanout: noScan, bindRaster() {},
    waitForSound:function*(){while(!soundFinished(audio.sfx,audio.music,0))yield 'serviced';},
    voice:{getAlarm:()=>0,setAlarm(){},cry(){},clip(){}},
  };
  const run = battleSilhouetteIntro(state,host,timing);
  function drive() {
    let next=run.next();
    while(!next.done && frames.length<500) {
      expect(next.value).not.toBe('session');
      if(next.value!=='session') {
        timing.boundary(next.value);
        if(next.value==='serviced') {screen.vblank(); audio.update();}
        else if(next.value==='held') audio.update(); // Palette-held frames have the manual update. Dark ticks have no VBlank (note 79 §8.2).
      }
      frames.push(next.value); next=run.next();
    }
    expect(next.done).toBe(true);
  }
  return {state,screen,timing,host,run,drive,frames,opening,iterations,slides,
    get beforeTail(){return lastBeforeTail!;},get afterTail(){return lastAfterTail!;}};
}

describe('unused complete silhouette intro',()=>{
  it('executes72 source iterations with the VBlank-latched top and delayed head OAM',()=>{
    const h=harness(); h.drive();
    expect(h.iterations).toHaveLength(72); expect(h.slides).toHaveLength(72);
    h.slides.forEach((s,k)=>{
      expect([s.top,s.body,s.lower,s.shown,s.shadow,s.hram,s.physical]).toEqual([
        k<2?144:146-2*k,112+2*k,0,160-2*k,158-2*k,144-2*k,0]);
      expect(s.wy).toBe(k===71?0:144);
      expect(h.iterations[k]).toEqual({body:112+2*k,head:160-2*k,hram:k<2?144:146-2*k,bg:false,phase:1});
    });
    expect(h.frames.filter(f=>f==='held')).toHaveLength(2);
    expect(h.frames.filter(f=>f==='serviced')).toHaveLength(97);
    expect(h.opening[0].label).toBe('WildMonAppearedText');
    expect(h.state.mem[INTRO_SCROLL.hSCX]).toBe(2); expect(h.screen.scx).toBe(2);
    expect([h.screen.bgp,h.screen.obp0,h.screen.obp1]).toEqual([0xe4,0xe4,0xe4]);
  });
  it('freezes the upper96 rows before the last iteration opens the window at LY96',()=>{
    const h=harness(0,true); h.drive(); const last=h.slides[71].pixels!;
    expect(last.subarray(0,96*160*4)).toEqual(h.beforeTail.subarray(0,96*160*4));
    expect(last.subarray(96*160*4)).toEqual(h.afterTail.subarray(96*160*4));
    expect(h.beforeTail.subarray(0,96*160*4)).not.toEqual(h.afterTail.subarray(0,96*160*4));
  });
  it.each([[1,'oldmanb'],[4,'prof.oakb'],[3,'redb']] as const)('keeps battle-type%i picture selection (%s) and opening ports', (type,picture)=>{
    const h=harness(type); h.drive(); expect(h.screen.backSlot(0x31)?.picture).toBe(picture);
    expect(h.screen.spriteSlot(0)?.picture).toBe(picture); expect(h.opening[0].label).toBe('WildMonAppearedText');
    expect(h.opening[0].head).toEqual(Array(40).fill(160));
    expect(h.frames.filter(f=>f==='serviced')).toHaveLength(type===4?99:96);
  });
  it('reuses trainer opening sound/text and both party-ball writers after the slide',()=>{
    const h=harness(0,false,false,true); h.drive(); expect(h.opening[0].label).toBe('TrainerWantsToFightText');
    expect(h.screen.shadowOam(0).attributes).toBe(0); expect(h.screen.shadowOam(6).attributes).toBe(1);
    expect(h.opening[0].palette).toBe('MEWMON'); expect(h.slides).toHaveLength(72);
  });
  it('restores the flipped column map, keeps non-head X/tile/attributes and does not reset BG phase',()=>{
    const h=harness(3,false,true); h.drive();
    for(let col=0;col<7;col++) for(let row=0;row<7;row++) expect(h.screen.at(7-col,5+row)).toBe(0x31+col*7+row);
    expect(h.screen.shadowOam(21)).toEqual({y:160,x:211,tile:0x34,attributes:7});
    expect(textBgTransfer.nextPortion).toBe(1); expect(textBgTransfer.enabled).toBe(true);
    expect([h.screen.wy,h.screen.scy,h.state.mem[INIT.hTileAnimations],h.state.mem[INIT.wUpdateSpritesEnabled]]).toEqual([0,0,0,255]);
    expect([h.screen.scxSplit,h.screen.scxAfterSplit]).toEqual([null,null]);
  });
  it('copies the cleared head only into BG0; restores all49 body cells for the tail',()=>{
    const h=harness(3); h.drive();
    for(let y=5;y<8;y++)for(let x=1;x<8;x++)expect(h.screen.bgAt(x,y)).toBe(' ');
    for(let y=8;y<12;y++)for(let x=1;x<8;x++)expect(h.screen.bgAt(x,y)).toBe(0x31+(x-1)*7+y-5);
    expect(h.screen.bgAt(31,31)).toBe(' '); expect(h.state.mem[D.hStartTileID]).toBe(0x31);
    expect(h.opening[0].head).toEqual(Array(40).fill(160));
  });
  it('refuses a timing owner for another screen before any video work',()=>{
    const h=harness(); const bad=new BattleIntroTiming(h.state,new BattleScreen(),144,noScan);
    expect(()=>battleSilhouetteIntro(h.state,h.host,bad).next()).toThrow('different intro timing owner');
    expect(h.screen.backSlot(0x31)).toBeNull();
  });
});
