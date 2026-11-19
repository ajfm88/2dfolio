// wStatusFlags5 BIT_NO_TEXT_DELAY. Lists/YES-NO and PCs share this one bit.
// Other callers retain their explicit noDelay contract until their source migration.
let noTextDelay = false;

export function getNoTextDelay(): boolean { return noTextDelay; }
export function setNoTextDelay(value: boolean): void { noTextDelay = value; }

// wLetterPrintingDelayFlags BIT_FAST_TEXT_DELAY (opening checkpoint-07b, note 116 §2.5). TextCommandProcessor always
// sets BIT_TEXT_DELAY, so this bit alone chooses PrintLetterDelay's wait: wOptions & $F frames when set, one frame when
// clear. The main menu's InitOptions sets it and nothing in play clears it; PrepareTitleScreen zeroes the byte, so only
// text printed between the title's start and the next main menu (the clear-save dialogue) waits one frame a letter.
let fastTextDelay = true;

export function getFastTextDelay(): boolean { return fastTextDelay; }
export function setFastTextDelay(value: boolean): void { fastTextDelay = value; }
