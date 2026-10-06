// Global player and rival name state
// Assembly ref: wPlayerName, wRivalName (WRAM)

let playerName = 'YELLOW';
let rivalName = 'BLUE';

export function getPlayerName(): string {
  return playerName;
}

export function setPlayerName(name: string): void {
  playerName = name;
}

export function getRivalName(): string {
  return rivalName;
}

export function setRivalName(name: string): void {
  rivalName = name;
}

// wRivalStarter: which Eevee evolution the rival's later teams use
// (RIVAL_STARTER_* in battle/trainer_flow.ts). Unset until the Oak's Lab battle.
let rivalStarter: number | undefined;

export function getRivalStarter(): number | undefined {
  return rivalStarter;
}

export function setRivalStarter(value: number | undefined): void {
  rivalStarter = value;
}

export function restoreNames(pName?: string, rName?: string): void {
  playerName = pName ?? 'YELLOW';
  rivalName = rName ?? 'BLUE';
}

export function substituteNames(text: string): string {
  return text.replace(/<PLAYER>/g, playerName).replace(/<RIVAL>/g, rivalName);
}
