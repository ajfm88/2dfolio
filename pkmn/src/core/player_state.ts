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

export function restoreNames(pName?: string, rName?: string): void {
  playerName = pName ?? 'YELLOW';
  rivalName = rName ?? 'BLUE';
}

export function substituteNames(text: string): string {
  return text.replace(/<PLAYER>/g, playerName).replace(/<RIVAL>/g, rivalName);
}
