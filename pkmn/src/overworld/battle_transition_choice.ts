import type { BattleTransitionData } from '../rom/extractors/battle_transitions';
import { charToTile } from '../text/charmap';

let data: BattleTransitionData | undefined;
/** CP4 owns calling this from startup. No extraction code runs in the browser. */
export async function loadBattleTransitionData(): Promise<void> {
  const response = await fetch('battle_transitions.json');
  if (!response.ok) throw new Error(`battle transitions: HTTP ${response.status}`);
  data = await response.json() as BattleTransitionData;
}
export function getBattleTransitionData(): BattleTransitionData {
  if (!data) throw new Error('battle transitions not loaded');
  return data;
}

export type BattleTransitionKind = 'doubleCircle' | 'spiral' | 'circle' | 'horizontalStripes'
  | 'shrink' | 'verticalStripes' | 'split';
const TRANSITIONS: readonly BattleTransitionKind[] = [
  'doubleCircle', 'spiral', 'circle', 'spiral', 'horizontalStripes', 'shrink', 'verticalStripes', 'split',
];
export interface BattleTransitionInput {
  opponentIsTrainer: boolean;
  enemyLevel: number;
  leadLevel: number;
  mapId: number;
}
export function isDungeonMap(mapId: number, file: BattleTransitionData): boolean {
  return file.dungeonMaps.includes(mapId)
    || file.dungeonRanges.some(([start, end]) => mapId >= start && mapId <= end);
}
/** GetBattleTransitionID_*; stronger compares against ADD $03's wrapped byte. */
export function chooseBattleTransition(input: BattleTransitionInput, file = getBattleTransitionData()): {
  id: number; kind: BattleTransitionKind; spiralDirection: 0 | 1;
} {
  const stronger = (input.enemyLevel & 0xff) >= ((input.leadLevel + 3) & 0xff);
  const id = Number(input.opponentIsTrainer) | (Number(stronger) << 1) | (Number(isDungeonMap(input.mapId, file)) << 2);
  return { id, kind: TRANSITIONS[id], spiralDirection: stronger ? 0 : 1 };
}

/** DefaultNamesRivalList: the two bytes read past the name, checked against the ROM. */
export const PRESET_RIVAL_PROBE_BYTES: Readonly<Record<string, readonly [number, number]>> = {
  BLUE: [0x80, 0x91], GARY: [0x8e, 0x87], JOHN: [0x11, 0x46],
};
const PLAYER_PRESETS = new Set(['YELLOW', 'ASH', 'JACK']);

/** Note 65 §10.10: approximate wStringBuffer leftovers from the two saved names.
 * Editing/deleting characters and other buffer writers remain the J2 naming audit. */
export function rivalNameProbeBytes(playerName: string, rivalName: string): readonly [number, number] {
  const preset = PRESET_RIVAL_PROBE_BYTES[rivalName];
  if (preset) return preset;
  const player = PLAYER_PRESETS.has(playerName) ? [] : Array.from(playerName);
  const rival = Array.from(rivalName);
  const byteAt = (index: number): number => {
    const source = index <= rival.length ? rival : player;
    if (index === source.length) return 0x50; // '@' copied with either custom name
    if (index > source.length) return 0;
    const glyph = source[index];
    return glyph === ' ' ? 0x7f : charToTile(glyph) + 0x80;
  };
  // An untouched buffer is zero, not a zero-length custom player's terminator.
  return [byteAt(6), byteAt(7)];
}
export function oakPikachuLeadLevel(playerName: string, rivalName: string): number {
  const [lo, hi] = rivalNameProbeBytes(playerName, rivalName);
  return (lo | hi) !== 0 ? 12 : 0; // wCurMapConnections, else east view pointer high byte
}

/** CompareLevels takes the first live mon; ReadTrainer leaves the LAST enemy's level. */
export function battleTransitionLevels(
  party: readonly { currentHp: number; level: number }[],
  enemy: number | readonly { level: number }[],
  names: { player: string; rival: string },
): { leadLevel: number; enemyLevel: number } {
  const lead = party.find(mon => mon.currentHp !== 0);
  if (typeof enemy !== 'number' && enemy.length === 0) throw new Error('empty trainer party');
  if (!lead && party.length !== 0) throw new Error('CompareLevels requires a living party mon');
  return {
    leadLevel: lead?.level ?? oakPikachuLeadLevel(names.player, names.rival),
    enemyLevel: typeof enemy === 'number' ? enemy : enemy[enemy.length - 1].level,
  };
}

export interface TransitionSpriteSlot {
  slot: number;
  /** False means IMAGEINDEX=$ff; unoccupied slots still have IMAGEINDEX=0. */
  visible: boolean;
  /** PICTUREID!=0: PrepareOAMData draws it, but the transition count ignores this byte. */
  occupied: boolean;
}
/** The ten PrepareOAMData blocks; rank is independent of NPC identity and world position.
 * Missing slots are zero-filled (counted), including after the last NPC. An unavailable
 * target can therefore spare the next visible sprite's block. The walked-wild 256-read
 * case has no survivor beyond the player (note 65 §10.3, C3). */
export function battleTransitionSurvivors(slots: readonly TransitionSpriteSlot[], spriteIndex: number): number[] {
  const index = spriteIndex & 0xff;
  if (index === 0) return [0];
  const table = new Map(slots.map(sprite => [sprite.slot, sprite]));
  let rank = 0;
  for (let slot = 0; slot < index; slot++) {
    if (table.get(slot)?.visible !== false) rank = (rank + 1) & 0xff;
  }
  return rank >= 1 && rank <= 9 ? [0, rank] : [0];
}

/** PrepareOAMData skips empty/hidden slots, orders player/NPCs/Pikachu, caps at 10. */
export function battleTransitionOamSlots(slots: readonly TransitionSpriteSlot[]): number[] {
  return [...slots].sort((a, b) => a.slot - b.slot)
    .filter(sprite => sprite.occupied && sprite.visible).slice(0, 10).map(sprite => sprite.slot);
}
