import type { BattleState } from './battle_state';
import type { BattleScreen, BattleHudSlot, BattlePaletteInput } from './battle_screen';
import { delayFrames, type Program } from './battle_menu_context';
import { D } from './battle_end_state';

/** The existing screen owns the only VRAM copy queue and HUD slots. Narrow unused adapter; no extra storage. */
type HudStorage = { copyTiles(total: number, write: (index: number) => void): Generator<void>; hud: (BattleHudSlot | null)[] };

/** pret core.asm:6695-6718. HUD1 three tiles, HUD2+3 six; never the thirty-tile font entry at6692. */
export function* loadHudTilePatterns(screen: BattleScreen): Program {
  const storage = screen as unknown as HudStorage;
  for (const _ of storage.copyTiles(3, index => { storage.hud[0x6d - 0x62 + index] = { sheet: 'hud1', tile: index }; })) {
    void _; yield 'serviced';
  }
  for (const _ of storage.copyTiles(6, index => {
    const id = index < 3 ? 0x73 + index : 0x76 + index - 3;
    storage.hud[id - 0x62] = { sheet: index < 3 ? 'hud2' : 'hud3', tile: index % 3 };
  })) { void _; yield 'serviced'; }
}
/** pret home/pics.asm:44-104,187-193. Predecoded picture cue; real49-tile transfer, seven serviced frames. */
export function* loadMonFrontSprite(screen: BattleScreen, picture: string): Program {
  for (const _ of screen.copyFront(picture)) { void _; yield 'serviced'; }
}
/** pret init_battle.asm:143-158. Caller owns trainer pointer/bank selection; same49-tile transfer. */
export function* loadTrainerPic(screen: BattleScreen, picture: string): Program {
  yield* loadMonFrontSprite(screen, picture);
}
/** pret init_battle.asm:160-178. Interlace's49-tile copy, then CopyVideoData's49-tile copy:14 frames. */
export function* loadMonBackPic(state: BattleState, screen: BattleScreen, picture: string): Program {
  state.wCurPartySpecies = state.wBattleMonSpecies2;
  for (let row = 5; row < 12; row++) for (let col = 1; col < 9; col++) screen.put(col, row, ' ');
  for (let copy = 0; copy < 2; copy++) for (const _ of screen.copyBack(picture)) { void _; yield 'serviced'; }
}
function put(screen: BattleScreen, at: number, value: number | string): void { screen.put(at % 20, Math.floor(at / 20), value); }
function get(screen: BattleScreen, at: number): number | string { return screen.at(at % 20, Math.floor(at / 20)) ?? ' '; }

/** pret core.asm:1218-1266. HL is the bottom source row (enemy5/player10), DE the row below it. */
export function* slideDownFaintedMonPic(state: BattleState, screen: BattleScreen, x: number, sourceBottomY: number): Program {
  const saved = state.mem[D.wStatusFlags5]; state.mem[D.wStatusFlags5] = saved | 0x40;
  for (let step = 0; step < 7; step++) {
    for (let row = sourceBottomY; row > sourceBottomY - 6; row--) {
      for (let col = 0; col < 7; col++) screen.put(x + col, row + 1, screen.at(x + col, row) ?? ' ');
    }
    for (let col = 0; col < 7; col++) screen.put(x + col, sourceBottomY - 5, ' ');
    yield* delayFrames(2);
  }
  state.mem[D.wStatusFlags5] = saved;
}
/** pret core.asm:1273-1312. HL is the first source cell; exactly amount columns per row and amount steps. */
export function* slideTrainerPicOffScreen(state: BattleState, screen: BattleScreen, x: number, y: number, amount: number): Program {
  const count = amount & 255; state.mem[D.hSlideAmount] = count;
  for (let step = 0; step < (count || 256); step++) {
    for (let row = 0; row < 7; row++) for (let col = 0; col < (count || 256); col++) {
      const source = x + (y + row) * 20 + (count === 8 ? -col : col);
      put(screen, source + (count === 8 ? 1 : -1), get(screen, source));
    }
    yield* delayFrames(2);
  }
}
/** pret scroll_draw_trainer_pic.asm:1-48. Palette, copy7, then six column-grow steps each held for4. */
export function* scrollTrainerPicAfterBattle(state: BattleState, screen: BattleScreen, picture: string, palette: BattlePaletteInput): Program {
  state.wEnemyMonSpecies2 = 0;
  yield* screen.setPalBattle({ ...palette, enemySpecies2: 0 });
  yield* loadTrainerPic(screen, picture);
  for (let columns = 1; columns < 7; columns++) {
    for (let col = 0; col < columns; col++) for (let row = 0; row < 7; row++) {
      screen.put(20 - columns + col, row, col * 7 + row);
    }
    yield* delayFrames(4);
  }
}
