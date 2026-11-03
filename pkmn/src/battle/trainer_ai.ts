// Trainer class data shared by the live session and overworld.
export interface TrainerClassData {
  id: number;
  displayName: string;
  baseMoney: number;
  aiModifiers: number[];
  parties: TrainerPartyMember[][];
}

export interface TrainerPartyMember {
  species: string;
  level: number;
  moveOverrides?: Record<string, string>;
}

let trainerData: Record<string, TrainerClassData> | null = null;

export async function loadTrainerData(): Promise<void> {
  if (trainerData) return;
  const resp = await fetch('trainers.json');
  if (!resp.ok) throw new Error(`Failed to load trainers.json: ${resp.status}`);
  trainerData = await resp.json();
}

export function getTrainerClass(className: string): TrainerClassData | null {
  return trainerData?.[className] ?? null;
}
