// A5e checkpoint-02: LCD-off silhouette BG staging. pret e89ead15 core.asm:18-48.
import type { BattleScreen } from './battle_screen';
import type { Program } from './battle_menu_context';

/** Caller owns the head-area clear and DisableLCD/EnableLCD boundaries. Font pixels
 * already belong to BattleRenderTiles. This LCD-off HUD reload and direct BG0 copy
 * consumes no frames, transfers, DMA or input reads. It does not touch the window. */
export function* prepareSilhouetteBackground(screen: BattleScreen): Program {
  if (screen.lcdOn) throw new Error('silhouette background requires LCD off');
  for (const _ of screen.loadHudAndHpBarAndStatusTilePatterns()) { void _; yield 'serviced'; }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) screen.putBg(x, y, ' ');
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.putBg(x, y, screen.at(x, y)!);
}
