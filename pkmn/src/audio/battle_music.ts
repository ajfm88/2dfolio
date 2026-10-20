/** audio/play_battle_music.asm. These are opponent IDs (class + 200), not class IDs. */
export interface BattleMusicInput { gymLeaderNo: number; curOpponent: number }
export type BattleMusic = 'wildbattle' | 'trainerbattle' | 'gymleaderbattle' | 'finalbattle';
export function battleMusicFor({ gymLeaderNo, curOpponent }: BattleMusicInput): BattleMusic {
  if (gymLeaderNo !== 0) return 'gymleaderbattle';
  if (curOpponent < 200) return 'wildbattle';
  if (curOpponent === 243) return 'finalbattle'; // OPP_RIVAL3
  if (curOpponent === 247) return 'gymleaderbattle'; // OPP_LANCE
  return 'trainerbattle';
}
