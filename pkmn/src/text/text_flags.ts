// wStatusFlags5 BIT_NO_TEXT_DELAY. Lists/YES-NO and PCs share this one bit.
// Other callers retain their explicit noDelay contract until their source migration.
let noTextDelay = false;

export function getNoTextDelay(): boolean { return noTextDelay; }
export function setNoTextDelay(value: boolean): void { noTextDelay = value; }
