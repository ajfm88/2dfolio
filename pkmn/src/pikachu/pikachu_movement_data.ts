// pikachu_movement.json (A6e), loaded with the other game data before play starts.

import type { PikachuMovementData, PikachuMovementProgramId } from '../rom/extractors/pikachu_movement';
import { validatePikachuMovementData } from './pikachu_movement';

let movementData: PikachuMovementData | null = null;

export async function loadPikachuMovementData(): Promise<void> {
  const resp = await fetch('pikachu_movement.json');
  if (!resp.ok) throw new Error(`pikachu_movement.json: HTTP ${resp.status}`);
  const data = await resp.json() as PikachuMovementData;
  validatePikachuMovementData(data);
  movementData = data;
}

export function getPikachuMovementData(): PikachuMovementData {
  if (!movementData) throw new Error('pikachu_movement.json is not loaded');
  return movementData;
}

export function pikachuMovementProgram(id: PikachuMovementProgramId): readonly number[] {
  return getPikachuMovementData().programs[id];
}
