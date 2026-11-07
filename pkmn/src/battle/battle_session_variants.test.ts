import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
// Observe the real composition boundaries. Every intercepted function still runs its original body.
const boundary = vi.hoisted(() => ({} as {
  host: import('./battle_start').BattleStartHost & import('./battle_party_menu').BattlePartyHost;
  ports: import('./battle_turn').TurnPorts;
  effects: import('./battle_effects_registry').MoveEffectEnvironment;
  trainer: import('./battle_trainer_ai').TrainerAIEnvironment;
  items: import('./battle_item_bodies').ShortItemEnvironment;
}));
vi.mock('./battle_start', async original => {
  const real = await original<typeof import('./battle_start')>();
  return { ...real, initBattleCommon: (...args: Parameters<typeof real.initBattleCommon>) => {
    boundary.host = args[3] as typeof boundary.host; boundary.ports = args[4]; return real.initBattleCommon(...args);
  } };
});
vi.mock('./battle_effects_registry', async original => {
  const real = await original<typeof import('./battle_effects_registry')>();
  return { ...real, composedJumpMoveEffect: (env: typeof boundary.effects) => {
    boundary.effects = env; return real.composedJumpMoveEffect(env);
  } };
});
vi.mock('./battle_trainer_ai', async original => {
  const real = await original<typeof import('./battle_trainer_ai')>();
  return { ...real, trainerAI: (...args: Parameters<typeof real.trainerAI>) => {
    boundary.trainer = args[1]; return real.trainerAI(...args);
  } };
});
vi.mock('./battle_item_bodies', async original => {
  const real = await original<typeof import('./battle_item_bodies')>();
  return { ...real, registerShortBattleItemBodies: (env: typeof boundary.items) => {
    boundary.items = env; return real.registerShortBattleItemBodies(env);
  } };
});
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { loadBattleData, createPokemon, getMove } from './data';
import { loadTextPrograms } from '../text/program_data';
import { createBattleSession, createSessionRandom, loadBattleSessionData } from './battle_session';
import { battleWorld } from '../test/battle_world_fixture';
import { rig, musicData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity, musicNameForSound } from '../audio/sound_ids';
import { setKey, updateInput, syncJoypadRead } from '../input';
import { resetListStateForEmptySlot } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { setLowHealthAlarm, setLowHealthAlarmDisabled, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { A, battleContext } from './battle_state';
import { INIT } from './battle_init';
import { PIC_VARIANT } from './battle_pic_variants';
import { MOVE_ANIM } from './battle_move_anim';
import { chargeEffect } from './battle_effects_turns';
import { statModifierUpEffect } from './battle_effects_stats';
import { attackSubstitute } from './battle_apply';
import { renderBattleScreen } from './battle_screen_render';
import type { GameButton } from '../core';
import type { Program } from './battle_menu_context';
const keys: GameButton[] = ['a','b','up','down','left','right','start','select'];
const sessions: ReturnType<typeof createBattleSession>[] = [];
beforeAll(async () => {
  await loadBattleData(); await loadTextPrograms();
  await loadBattleSessionData(async file => {
    const p = PNG.sync.read(readFileSync('static/' + file)); return { width:p.width,height:p.height,data:p.data };
  });
});
beforeEach(() => {
  keys.forEach(key => setKey(key,false)); updateInput(); syncJoypadRead(); resetListStateForEmptySlot();
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setLowHealthChannel5(0);
});
afterEach(() => { sessions.splice(0).forEach(session => session.abort()); });
function setup(animation: 'ON' | 'OFF' = 'OFF', move = 'SUBSTITUTE') {
  const mon = createPokemon(151,40,'MEW',{atk:9,def:8,spd:8,spc:8})!;
  mon.otName='ASH';mon.otId=0;mon.moves=[{id:move,pp:getMove(move)!.pp,maxPp:getMove(move)!.pp}];
  const r = rig(); let time = 0;
  const banks = new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank) => r.music.play(musicData(musicNameForSound(id,bank)!))));
  const session = createBattleSession(battleWorld({party:[mon],options:{textSpeed:'FAST',animation,battleStyle:'SET'},
    bag:[{id:'X_ATTACK',count:2}]}), {random:createSessionRandom(() => time),audio:() => ({sfx:r.sfx,music:r.music,banks})});
  sessions.push(session); banks.playMusic(musicIdentity('wildbattle')!); session.start();
  const bound = { ...boundary };
  const input = (pressed: GameButton[] = []) => { time++;keys.forEach(key => setKey(key,pressed.includes(key)));updateInput(); };
  const automatic = (): GameButton[] => time % 4 < 2 ? session.video.textBox.isWaitingForInput ? ['b'] : ['a'] : [];
  const menu = () => !session.video.textBox.active && session.screen.at(10,14)==='F';
  const tick = (pressed: GameButton[] = automatic()) => {
    input(pressed); if(session.pendingFrame!=='dark')r.update(); session.tick();
  };
  for(let n=0;!menu()&&n<1500;n++)tick(); expect(menu()).toBe(true);
  const run = (program: Program<unknown>, each?: (frame: number) => void) => {
    let next=program.next(),frames=0;
    while(!next.done&&frames<1500) {
      each?.(frames); input(automatic());if(next.value==='serviced'){r.update();session.video.vblank();}frames++;next=program.next();
    }
    expect(next.done).toBe(true); return frames;
  };
  return { session,s:session.state,screen:session.screen,bound,run,tick,menu };
}
function picture(h: ReturnType<typeof setup>, enemy=false) {
  return (enemy?h.screen.frontSlot(0):h.screen.backSlot(0x31))!.picture;
}
function blob(h: ReturnType<typeof setup>, enemy=false) {
  const key=picture(h,enemy),image=h.session.renderTiles.pictures.get(key)!;
  expect(key).toMatch(/^wTempPic#/);expect(image).toBeDefined();
  // The five MinimizedMonSprite rows at tile(3,4), pixel row2, black on white.
  const black: number[]=[];
  for(let y=0;y<56;y++)for(let x=0;x<56;x++)if(image.data[(y*56+x)*4]===0)black.push(y*56+x);
  expect(black).toEqual([1931,1932,1986,1987,1988,1989,2041,2042,2043,2044,2045,2046,2098,2099,2100,2101,2154,2157]);
}
it.each(['OFF','ON'] as const)('live Substitute turn respects the %s boundary and renders the published doll only OFF', animation => {
  const h=setup(animation);let left=false;
  for(let n=0;n<1500;n++) {
    h.tick();if(!h.menu())left=true;
    if(left&&h.menu())break;
  }
  expect(left&&h.menu()).toBe(true);expect(h.s.wPlayerBattleStatus2&16).toBe(16);
  expect(h.session.textLog.some(row=>row.label==='SubstituteText'&&row.complete)).toBe(true);
  if(animation==='OFF') {
    expect(picture(h)).toMatch(/^wTempPic#/);
    const doll=h.session.renderTiles.pictures.get(picture(h))!;
    const monster=PNG.sync.read(readFileSync('static/gfx/sprites/monster.png'));
    for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
      const dest=((32+y)*56+24+x)*4,src=((16+y)*monster.width+x)*4;
      expect(Array.from({length:4},(_,i)=>doll.data[dest+i])).toEqual([...monster.data.slice(src,src+4)]);
    }
    const area=renderBattleScreen(h.screen,h.session.renderTiles);
    expect(area.length).toBe(160*144*4);
    expect(h.s.mem.subarray(PIC_VARIANT.wTempPic,PIC_VARIANT.wTempPic+784).some(byte=>byte!==0)).toBe(true);
  } else expect(picture(h)).toBe('back/151');
});
it.each(['OFF','ON'] as const)('live Transform turn changes the back picture only with %s direct animation', animation => {
  const h=setup(animation,'TRANSFORM');let left=false;
  for(let n=0;n<1500;n++){h.tick();if(!h.menu())left=true;if(left&&h.menu())break;}
  expect(left&&h.menu()).toBe(true);expect(h.s.wPlayerBattleStatus3&8).toBe(8);
  expect(picture(h)).toBe(animation==='OFF'?'back/19':'back/151');
});
it('all execute/effect/trainer/item hide and reshow owners use the session screen and registry', () => {
  const h=setup(),s=h.s;
  // Make the wild TrainerAI return through its real early-out, capturing its actual environment.
  h.run(h.session.trainerAI(s));
  const ctx=battleContext(s);ctx.curItem='X_ATTACK';ctx.itemIndex=0;ctx.itemName='X ATTACK';
  h.run(h.bound.host.useItem(ctx)); // registrations dispose in finally
  for(const ports of [h.bound.ports,h.bound.effects,boundary.trainer,boundary.items]) {
    s.hWhoseTurn=0;s.wPlayerBattleStatus2|=16;s.wPlayerMonMinimized=0;s.wPlayerMoveNum=33;
    expect(h.run(ports.hideSubstitute(s))).toBe(46);
    expect(picture(h)).toBe('back/151');
    expect(h.run(ports.reshowSubstitute(s))).toBe(37);
    expect(picture(h)).toMatch(/^wTempPic#/);
  }
});
it.each(['substitute','minimize'] as const)('party STATS reload dispatches the enemy %s on the session picture owner', kind => {
  const h=setup();h.s.hWhoseTurn=1;
  expect(h.run(h.bound.host.loadEnemyPicVariant(kind))).toBe(kind==='substitute'?10:13);
  expect(picture(h,true)).toMatch(/^wTempPic#/);expect(picture(h)).toBe('back/151');
  if(kind==='minimize')blob(h,true);
});
it('a broken enemy substitute flips the turn, reloads its real picture and preserves the player picture', () => {
  const h=setup(),s=h.s;s.hWhoseTurn=1;h.run(h.bound.host.loadEnemyPicVariant('substitute'));
  s.hWhoseTurn=0;s.wEnemyBattleStatus2|=16;s.mem[A.wEnemySubstituteHP]=1;s.wDamage=2;
  h.run(attackSubstitute(s,h.screen,h.bound.host,h.bound.ports));
  expect(s.wEnemyBattleStatus2&16).toBe(0);expect(s.hWhoseTurn).toBe(0);
  expect(picture(h,true)).toBe('front/19');expect(picture(h)).toBe('back/151');
});
it('breaking a minimized substitute restores the blob on the targeted side', () => {
  const h=setup();h.s.hWhoseTurn=1;h.s.wEnemyMonMinimized=1;
  expect(h.run(h.bound.ports.substituteBreak(h.s))).toBe(13);blob(h,true);
});
it.each([19,91])('Fly/Dig %s around a doll runs both direct picture ports and leaves the charging bit', move => {
  const h=setup(),s=h.s;s.hWhoseTurn=0;s.wPlayerBattleStatus2|=16;s.wPlayerMoveNum=move;
  s.wPlayerMoveEffect=move===19?0x2b:0x27;
  h.run(chargeEffect(s,h.bound.effects));
  expect(s.wPlayerBattleStatus1&0x50).toBe(0x50);expect(s.wChargeMoveNum).toBe(move);
  expect(picture(h)).toMatch(/^wTempPic#/);
  // Re-entry at the non-invulnerable Fly/Dig branch reloads VRAM without showing the picture.
  s.wPlayerBattleStatus1&=~64;
  expect(h.run(h.bound.effects.hideSubstitute(s))).toBe(38);
  expect(picture(h)).toBe('back/151');expect(h.screen.at(1,5)).toBe(' ');
});
it('Minimize keeps the standalone OFF stand-in, then a doll hides to the blob and reshows', () => {
  const h=setup(),s=h.s;s.hWhoseTurn=0;s.wPlayerMoveNum=107;s.wPlayerMoveEffect=0x0f;
  h.run(statModifierUpEffect(s,h.bound.effects));expect(s.wPlayerMonMinimized).toBe(1);
  expect(picture(h)).toBe('back/151'); // SE_MINIMIZE_MON still belongs to #94.
  s.wPlayerBattleStatus2|=16;
  expect(h.run(h.bound.effects.hideSubstitute(s))).toBe(37);blob(h);
  expect(h.run(h.bound.effects.reshowSubstitute(s))).toBe(37);expect(picture(h)).toMatch(/^wTempPic#/);
});
it('the crash shake port has four 9-frame passes, separate WX7 restoration and the final WRAM byte', () => {
  const h=setup(),wx:number[]=[];h.s.mem[MOVE_ANIM.hMutateWX]=99;
  expect(h.run(h.bound.ports.shake(h.s,4),()=>wx.push(h.screen.wx))).toBe(36);
  expect(wx).toEqual([...Array(5).fill(11),...Array(4).fill(7),...Array(5).fill(7),...Array(4).fill(10),
    ...Array(5).fill(7),...Array(4).fill(9),...Array(5).fill(7),...Array(4).fill(8)]);
  expect(h.screen.wx).toBe(7);expect(h.s.mem[MOVE_ANIM.hMutateWX]).toBe(1);
});
it('battle UpdateSprites is a zero-write zero-frame no-op under the cartridge FF gate', () => {
  const h=setup();expect(h.s.mem[INIT.wUpdateSpritesEnabled]).toBe(255);
  const before=h.s.mem.slice(),cells=[...h.screen.cells];h.bound.host.updateSprites();
  expect(h.s.mem).toEqual(before);expect(h.screen.cells).toEqual(cells);
  const asm=readFileSync('../refs/pokeyellow/home/update_sprites.asm','utf8');
  expect(asm).toMatch(/UpdateSprites::\s+ld a, \[wUpdateSpritesEnabled\]\s+dec a\s+ret nz/);
});
it('composed pictures and sprite atlases stay session-local while published images remain valid', () => {
  const first=setup(),baseline=first.session.renderTiles.pictures;
  first.s.hWhoseTurn=0;first.run(first.bound.effects.animationSubstitute(first.s));
  const key=picture(first),image=first.session.renderTiles.pictures.get(key)!;
  const second=setup();expect(second.session.renderTiles).not.toBe(first.session.renderTiles);
  expect(second.session.renderTiles.pictures).not.toBe(first.session.renderTiles.pictures);
  expect(second.session.renderTiles.pictures.has(key)).toBe(false);expect(baseline.has(key)).toBe(false);
  second.s.hWhoseTurn=1;second.run(second.bound.host.loadEnemyPicVariant('minimize'));
  expect(first.session.renderTiles.pictures.get(key)).toBe(image);
  expect(picture(first)).toBe(key);expect(renderBattleScreen(first.screen,first.session.renderTiles).length).toBe(92160);
});
