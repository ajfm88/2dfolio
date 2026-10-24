import { beforeEach, describe, expect, it } from 'vitest';
import { BattleState } from './battle_state';
import { BattleScreen } from './battle_screen';
import { D } from './battle_end_state';
import { loadHudTilePatterns, loadMonFrontSprite, loadTrainerPic, loadMonBackPic,
  slideDownFaintedMonPic, slideTrainerPicOffScreen, scrollTrainerPicAfterBattle } from './battle_slides';
import { finish } from '../test/battle_hp_rig';
import { textBgTransfer } from '../text/bg_transfer';

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
function patterned(): BattleScreen {
  const screen = new BattleScreen();
  for (let i = 0; i < 360; i++) screen.put(i % 20, Math.floor(i / 20), i);
  for (let i = 0; i < 3; i++) screen.vblank();
  return screen;
}
describe('picture and HUD copy ledgers', () => {
  it('HUD-only writes precisely3+6 slots in two frames; extra-font slots and both pictures stay intact', () => {
    const screen = patterned(); const p = loadHudTilePatterns(screen), before = screen.cells;
    expect(p.next().value).toBe('serviced'); expect(textBgTransfer.enabled).toBe(false);
    expect(screen.hudSlot(0x6d)).toBeNull(); screen.vblank();
    expect(screen.hudSlot(0x6d)).toEqual({ sheet: 'hud1', tile: 0 });
    expect(p.next().value).toBe('serviced'); screen.vblank(); expect(p.next().done).toBe(true);
    for (const id of [0x6d,0x6e,0x6f,0x73,0x74,0x75,0x76,0x77,0x78]) expect(screen.hudSlot(id)).not.toBeNull();
    for (const id of [0x62,0x63,0x70,0x71,0x72,0x79,0x7f]) expect(screen.hudSlot(id)).toBeNull();
    expect(screen.cells).toEqual(before); expect(screen.visibleCells).toEqual(before);
    expect(textBgTransfer.enabled).toBe(true); expect(screen.frontSlot(0)).toBeNull(); expect(screen.backSlot(0x31)).toBeNull();
  });
  it.each(['front','trainer','back'] as const)('%s copy costs7/7/14, disables transfer for each copy and keeps exact49 slots', kind => {
    const s = new BattleState(), screen = patterned(), before = s.mem.slice(); s.wBattleMonSpecies2 = 84;
    before[D.wBattleMonSpecies2] = 84;
    const p = kind === 'front' ? loadMonFrontSprite(screen, 'PIC') : kind === 'trainer' ? loadTrainerPic(screen, 'PIC') : loadMonBackPic(s, screen, 'PIC');
    const ledgers: unknown[] = [];
    const result = finish(p, frame => {
      expect(frame).toBe('serviced'); expect(textBgTransfer.enabled).toBe(false);
      expect(screen.vblank()).toBeNull();
      ledgers.push([screen.frontSlot(48), screen.backSlot(0x61)]);
    });
    expect(result.frames).toHaveLength(kind === 'back' ? 14 : 7);
    expect(ledgers[5]).toEqual(kind === 'back' ? [null,null] : [null,null]); //48 tiles copied, last still pending
    if (kind === 'back') {
      expect(screen.backSlot(0x61)).toEqual({ picture: 'PIC', tile: 48 });
      expect(screen.frontSlot(0)).toBeNull(); expect(s.wCurPartySpecies).toBe(84); before[D.wCurPartySpecies] = 84;
      for (let row = 5; row < 12; row++) for (let col = 1; col < 9; col++) expect(screen.at(col,row)).toBe(' ');
    } else { expect(screen.frontSlot(48)).toEqual({ picture: 'PIC', tile: 48 }); expect(screen.backSlot(0x31)).toBeNull(); }
    expect(textBgTransfer.enabled).toBe(true); expect(Buffer.from(s.mem).equals(Buffer.from(before))).toBe(true);
  });
  it('LCD-off copies have no waits and HUD-only still leaves font slots alone', () => {
    const s = new BattleState(), screen = new BattleScreen(); screen.lcdOn = false;
    for (const p of [loadHudTilePatterns(screen), loadMonFrontSprite(screen,'F'),loadTrainerPic(screen,'T'),loadMonBackPic(s,screen,'B')]) {
      expect(finish(p).frames).toEqual([]);
    }
    expect(screen.hudSlot(0x62)).toBeNull(); expect(screen.frontSlot(48)?.picture).toBe('T'); expect(screen.backSlot(0x61)?.picture).toBe('B');
  });
});

describe('real tile slides, both sides and every BG-third phase', () => {
  it.each([0,1,2])('faint slides exactly7 rows over14 frames, retaining transfer phase%i and restoring flags', phase => {
    for (const [x,bottom] of [[12,5],[1,10]]) {
      textBgTransfer.resetPortion();
      const s = new BattleState(), screen = patterned(); s.mem[D.wStatusFlags5] = 0xa1;
      for (let i = 0; i < phase; i++) screen.vblank();
      const model = [...screen.cells], visible = [...screen.visibleCells], p = slideDownFaintedMonPic(s,screen,x,bottom);
      for (let frame = 1; frame <= 14; frame++) {
        const step = p.next(); expect(step.value).toBe('serviced');
        if (frame % 2 === 1) {
          for (let row = bottom + 1; row > bottom - 5; row--) for (let col = 0; col < 7; col++) model[row*20+x+col] = model[(row-1)*20+x+col];
          for (let col = 0; col < 7; col++) model[(bottom-5)*20+x+col] = ' ';
        }
        expect(screen.cells).toEqual(model); expect(s.mem[D.wStatusFlags5]).toBe(0xe1); expect(textBgTransfer.enabled).toBe(true);
        const third = screen.vblank()!; expect(third).toBe((phase + frame - 1) % 3);
        for (let i = third * 120; i < (third+1)*120; i++) visible[i] = model[i];
        expect(screen.visibleCells).toEqual(visible);
      }
      expect(p.next().done).toBe(true); expect(s.mem[D.wStatusFlags5]).toBe(0xa1);
    }
  });
  it.each([8,9])('trainer slide amount%i is2*amount, including linear tilemap writes across row edges', amount => {
    const s = new BattleState(), screen = patterned(), x = amount === 8 ? 19 : 0, y = amount === 8 ? 0 : 5;
    const model = [...screen.cells], p = slideTrainerPicOffScreen(s,screen,x,y,amount);
    for (let frame = 1; frame <= amount * 2; frame++) {
      expect(p.next().value).toBe('serviced');
      if (frame % 2 === 1) for (let row = 0; row < 7; row++) {
        const line = x + (y + row) * 20;
        if (amount === 8) for (let col = 0; col < 8; col++) model[line+1-col] = model[line-col];
        else for (let col = 0; col < 9; col++) model[line-1+col] = model[line+col];
      }
      expect(screen.cells).toEqual(model); expect(s.mem[D.hSlideAmount]).toBe(amount);
      screen.vblank();
    }
    expect(p.next().done).toBe(true);
  });
  it('trainer return is palette2 held+3 serviced, copy7, then six4-frame growing columns from19 to14', () => {
    const s = new BattleState(), screen = new BattleScreen(); s.wEnemyMonSpecies2 = 84;
    const frames: string[] = [], p = scrollTrainerPicAfterBattle(s,screen,'TRAINER', { partySpecies:25, enemySpecies2:25,playerBar:0,enemyBar:2 });
    const result = finish(p, frame => {
      frames.push(frame); expect(s.wEnemyMonSpecies2).toBe(0);
      if (frame === 'serviced') screen.vblank();
      if (frames.length >= 13) {
        const columns = Math.ceil((frames.length - 12) / 4);
        for (let col = 0; col < columns; col++) for (let row = 0; row < 7; row++) expect(screen.at(20-columns+col,row)).toBe(col*7+row);
      }
    });
    expect(result.frames).toEqual(['held','held',...Array(34).fill('serviced')]);
    expect(screen.frontSlot(48)).toEqual({ picture:'TRAINER',tile:48 }); expect(screen.at(13,0)).toBe(' ');
    expect(screen.at(19,6)).toBe(41);
  });
});
