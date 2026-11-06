// Live A5e checkpoint-04b. pret e89ead15 core.asm:9–132.
import { W_SPRITE_FLIPPED, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { INIT, loadPlayerBackPic, printBeginningBattleText, type BattleInitHost } from './battle_init';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { BattleUnsupportedState } from './battle_move_data';
import { hudContext } from './battle_hud_state';
import { BattleTiles } from './battle_tiles';
import { textBoxBorder } from '../menus/tile_surface';
import { textBgTransfer } from '../text/bg_transfer';
import { delayFrames, type Program } from './battle_menu_context';
import { prepareSilhouetteBackground } from './battle_intro';
import { BattleIntroTiming, INTRO_SCROLL } from './battle_intro_timing';

/** ≈33,000 M-cycles ≈ 1.88 frames of LCD-off work (note 79 §8.1). From the deferred VBlank to the
 * first VBlank after EnableLCD the hardware takes ≈ 2.82 frames; the port takes 1 + 2 ticks (§8.2.1). */
export const INTRO_LCD_OFF_FRAMES = 2;

export function* battleSilhouetteIntro(state: BattleState, host: BattleInitHost, timing: BattleIntroTiming): Program {
  const screen = host.screen;
  if (timing.state !== state || timing.screen !== screen) throw new BattleUnsupportedState('different intro timing owner');
  bindEntryBattleScreen(state, screen);
  yield* loadPlayerBackPic(state, screen);
  state.mem[D.wTextBoxID] = 1;
  textBoxBorder(new BattleTiles(screen), 0, 12, 4, 18);
  for (let y = 5; y < 8; y++) for (let x = 1; x < 8; x++) screen.put(x, y, ' ');
  yield* timing.disableLCD();
  yield* prepareSilhouetteBackground(screen);
  yield* timing.lcdOff(INTRO_LCD_OFF_FRAMES);
  timing.enableLCD();
  state.mem[INIT.hWY] = screen.wy = 0x90;
  state.mem[INIT.hTileAnimations] = state.mem[INTRO_SCROLL.hSCY] = 0;
  state.mem[INIT.wUpdateSpritesEnabled] = 0xff;
  yield* delayFrames(3);
  textBgTransfer.enabled = false;
  let b = 0x70, c = 0x90;
  state.mem[INTRO_SCROLL.hSCX] = c;
  yield* delayFrames(1);
  screen.bgp = screen.obp0 = screen.obp1 = 0xe4;
  do {
    yield* timing.until(64);
    timing.writeSplitX(b); b = (b + 2) & 255;
    yield* timing.until(96);
    timing.writeSplitX(0);
    for (let slot = 0; slot < 21; slot++) {
      const head = screen.shadowOam(slot);
      screen.setOam(slot, { ...head, x: (head.x - 2) & 255 });
    }
    state.mem[INTRO_SCROLL.hSCX] = c;
    c = (c - 2) & 255;
  } while (c !== 0);
  textBgTransfer.enabled = true;
  state.mem[D.hStartTileID] = 0x31;
  for (let col = 0; col < 7; col++) for (let row = 0; row < 7; row++)
    screen.put(1 + (state.mem[W_SPRITE_FLIPPED] ? 6 - col : col), 5 + row, 0x31 + col * 7 + row);
  state.mem[INIT.hWY] = screen.wy = 0;
  textBgTransfer.enabled = true;
  yield* delayFrames(3);
  const ctx = hudContext(state);
  yield* screen.setPalBattle({ partySpecies: ctx.partySpecies, enemySpecies2: ctx.enemySpecies2,
    playerBar: state.wPlayerHPBarColor as 0 | 1 | 2, enemyBar: state.wEnemyHPBarColor as 0 | 1 | 2 });
  for (let slot = 0; slot < 40; slot++) screen.setOam(slot, { ...screen.shadowOam(slot), y: 0xa0 });
  yield* printBeginningBattleText(state, host);
}
