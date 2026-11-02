import { beforeAll,beforeEach,expect,it,vi } from 'vitest';
const output=vi.hoisted(()=>({volume:[] as string[],text:[] as unknown[][],assets:[] as string[],fallback:vi.fn()}));
vi.hoisted(()=>Object.assign(globalThis,{window:{addEventListener(){}}}));
vi.mock('../renderer',async orig=>({...await orig() as object,fillRect:vi.fn(),drawFadeOverlay:vi.fn(),drawTile:vi.fn(),
 getCtx:()=>({drawImage(){},save(){},restore(){},translate(){},scale(){}}),getScale:()=>1,getMonsterPalette:()=>'MEWMON',
 loadFont:async(path:string)=>{output.assets.push('font '+path);return {width:128};},
 loadTileset:async(path:string)=>{output.assets.push('tiles '+path);return {width:128};},
 loadSprite:async(path:string)=>{output.assets.push('sprite '+path);return {width:16};},
 loadBattleSprite:vi.fn(async()=>({width:40,height:40}))}));
vi.mock('../menus/party_icons',()=>({loadPartyIcons:vi.fn(async()=>{output.assets.push('icons');}),drawPartyIcon:vi.fn()}));
vi.mock('../menus/menu_render',()=>({drawText:(...a:unknown[])=>output.text.push(a),drawBox:vi.fn(),drawScreenTile:vi.fn(),drawChar:vi.fn()}));
vi.mock('../text',async orig=>({...await orig() as object,getFontCanvas:()=>({width:128}),drawTileBorder:vi.fn()}));
vi.mock('./battle_ui',async orig=>({...await orig() as object,loadPokemonSprites:async()=>({front:{width:56,height:56}})}));
vi.mock('../audio',async orig=>({...await orig() as object,playSFX:output.fallback,
 setMasterVolume:(l:number,r:number)=>output.volume.push(`vol ${l}${r}`)}));
vi.mock('../audio/audio_flags',async orig=>{
 const real=await orig() as typeof import('../audio/audio_flags');
 return {...real,setNoAudioFadeOut:(v:boolean)=>{output.volume.push(`fade ${v}`);real.setNoAudioFadeOut(v);}};
});
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createPokemon } from './data';
import { loadTextPrograms } from '../text/program_data';
import { battleWorld } from '../test/battle_world_fixture';
import { rig,musicData } from '../test/audio_rig';
import { PlaySound } from '../audio/play_sound';
import { engineHost } from '../audio/request_host';
import { musicIdentity,musicNameForSound } from '../audio/sound_ids';
import * as input from '../input';
import { resetListStateForEmptySlot } from '../list_state';
import { loadBattleSessionData,loadBattleStandInData,createBattleSession,createSessionRandom } from './battle_session';
import type { GameButton } from '../core';

const keys: GameButton[] = ['a','b','up','down','left','right','start','select'];
beforeAll(async () => {
  await loadTextPrograms();
  await loadBattleSessionData(async file => {
    const p = PNG.sync.read(readFileSync('static/'+file)); return {width:p.width,height:p.height,data:p.data};
  });
  await loadBattleStandInData();
});
beforeEach(() => {
  keys.forEach(k => input.setKey(k,false)); input.updateInput(); input.syncJoypadRead(); resetListStateForEmptySlot();
});

it.each(['pokedex','naming'] as const)('held exit key from %s is consumed before the next battle read', page => {
  const r = rig(); let time = 0, exited = false;
  const reads: boolean[] = [];
  const realRead = input.readJoypad, key = page === 'pokedex' ? 'b' : 'start';
  const spy = vi.spyOn(input,'readJoypad').mockImplementation(() => {
    realRead(); if (exited) reads.push(input.isPassPressed(key));
  });
  const banks = new PlaySound(engineHost(r.synth,r.music,r.sfx,(id,bank) => r.music.play(musicData(musicNameForSound(id,bank)!))));
  const mon = createPokemon(25,20,'PIKACHU',{atk:9,def:8,spd:8,spc:8})!;
  const session = createBattleSession(battleWorld({party:[mon],bag:[{id:'MASTER_BALL',count:1}]}), {
    random:createSessionRandom(() => time), audio:() => ({sfx:r.sfx,music:r.music,banks}),
  });
  const row = (y:number) => session.screen.cells.slice(y*20,(y+1)*20).map(c => typeof c === 'string' ? c : ' ').join('');
  const tick = (pressed:GameButton[]) => {
    time++; keys.forEach(k => input.setKey(k,pressed.includes(k))); input.updateInput(); r.update(); session.tick();
  };
  banks.playMusic(musicIdentity('wildbattle')!); session.start();
  try {
    for (; time < 6000 && session.foreground !== page; ) {
      let press: GameButton[] = [];
      if (time%4 === 0) {
        if (session.foreground === 'pokedex') press = ['b'];
        else if (row(8).includes('YES')) press = ['a'];
        else if (row(14).includes('FIGHT') && !session.video.textBox.active) press = row(16).includes('▶') ? ['a'] : ['down'];
        else press = ['a']; // B must first go down on the dex page's closing frame.
      }
      tick(press);
    }
    expect(session.foreground).toBe(page);
    tick([]); // Release before pressing the page's exit key.
    tick([key]);
    expect(session.foreground).toBe('battle');
    exited = true;
    // Inspect the public next-read edge at the foreground boundary, before the
    // following text printer's own syncJoypadRead can hide a stale hJoyLast.
    input.readJoypad(); expect(input.isPassPressed(key)).toBe(false);
    if (page === 'pokedex') {
      // Keep B down while the nickname text prints and its YES/NO menu opens.
      for (let n = 0; n < 700 && !row(8).includes('YES'); n++)
        tick(session.video.textBox.isWaitingForInput && n%4 === 0 ? ['a','b'] : ['b']);
      expect(row(8)).toContain('YES');
      for (let n = 0; n < 20; n++) tick(['b']);
      expect(row(8)).toContain('YES');
      expect(session.done).toBe(false);
      expect(session.foreground).toBe('battle');
    } else {
      // START is not watched by the remaining catch text. Hold it through the
      // next public Joypad read (the resumed owner's read), without a key release.
      tick(['start']); input.readJoypad();
    }
    expect(reads.length).toBeGreaterThan(0);
    expect(reads[0]).toBe(false);
  } finally { session.abort(); spy.mockRestore(); }
});
