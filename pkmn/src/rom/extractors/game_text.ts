// Extract game text strings from ROM for runtime getText() usage.
// ALL copyrightable text is read from ROM at known offsets — zero hardcoded
// copyrighted strings in the production bundle.
//
// The text extractor reads strings from known ROM offsets using the charmap
// decoder. ROM bytes 0x52/0x53 naturally decode to <PLAYER>/<RIVAL> tokens.
// The 0x54 byte decodes to "POKé" per the charmap.

import { BinaryReader } from '../binary_reader';

// Charmap for decoding ROM text bytes into Unicode strings.
// Matches the Game Boy charmap from constants/charmap.asm.
const CHARMAP: Record<number, string> = {
  // Control characters
  0x4E: '\n', 0x4F: '\n', 0x50: '', 0x51: '\f',
  0x52: '<PLAYER>', 0x53: '<RIVAL>', 0x54: 'POK\u00e9',
  0x55: '\n', 0x57: '', 0x58: '', 0x7F: ' ',
  // Uppercase A-Z: $80-$99
  ...Object.fromEntries(Array.from({ length: 26 }, (_, i) => [0x80 + i, String.fromCharCode(65 + i)])),
  // Symbols after Z: ( ) : ; [ ]
  0x9A: '(', 0x9B: ')', 0x9C: ':', 0x9D: ';', 0x9E: '[', 0x9F: ']',
  // Lowercase a-z: $A0-$B9
  ...Object.fromEntries(Array.from({ length: 26 }, (_, i) => [0xA0 + i, String.fromCharCode(97 + i)])),
  // Accented / contractions
  0xBA: '\u00e9',  // é
  0xBB: "'d", 0xBC: "'l", 0xBD: "'s", 0xBE: "'t", 0xBF: "'v",
  // Special characters
  0xE0: "'", 0xE1: 'PK', 0xE2: 'MN',
  0xE3: '-', 0xE4: "'r", 0xE5: "'m",
  0xE6: '?', 0xE7: '!', 0xE8: '.',
  0xEF: '\u2642', // ♂
  0xF0: '\u00a5', // ¥
  0xF1: '\u00d7', // ×
  0xF2: '.', // decimal point
  0xF3: '/', 0xF4: ',',
  0xF5: '\u2640', // ♀
  // Digits 0-9: $F6-$FF
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [0xF6 + i, String(i)])),
};

/** Read a text string from ROM at the given offset, decoding via charmap. */
function readText(rom: BinaryReader, offset: number, maxLen = 500): string {
  let result = '';
  for (let i = 0; i < maxLen; i++) {
    const b = rom.readByte(offset + i);
    if (b === 0x50 || b === 0x57 || b === 0x58) break;
    const ch = CHARMAP[b];
    if (ch !== undefined) result += ch;
  }
  return result;
}

/** Convert sym-file bank:addr to file offset. */
function symToOffset(bank: number, addr: number): number {
  return bank * 0x4000 + (addr & 0x3FFF);
}

// ──────── ROM text offset table ────────
// Each entry maps a getText() key to one or more ROM offsets.
// Multi-part strings (joined with \f page breaks) list multiple offsets.

interface TextEntry {
  offsets: number[];
  join?: string; // separator between parts, default '\f'
}

const TEXT_ENTRIES: Record<string, TextEntry> = {
  // Pallet Town (bank 0x2D)
  PALLET_OAK_HEY_WAIT:     { offsets: [symToOffset(0x2D, 0x42B0)] },
  PALLET_OAK_CLOSE_CALL:    { offsets: [symToOffset(0x2D, 0x42CF)] },
  PALLET_OAK_WHEW:          { offsets: [symToOffset(0x2D, 0x4303)] },
  PALLET_OAK_COME_WITH_ME:  { offsets: [symToOffset(0x2D, 0x4311)] },

  // Oak's Lab (bank 0x2A)
  LAB_RIVAL_FED_UP:          { offsets: [symToOffset(0x2A, 0x4B9A)] },
  LAB_OAK_CHOOSE_MON_1:     { offsets: [symToOffset(0x2A, 0x4BBE)] },
  // LAB_OAK_CHOOSE_MON_2 is derived from this same text block (post-processed below)
  LAB_RIVAL_WHAT_ABOUT_ME:  { offsets: [symToOffset(0x2A, 0x4CA2)] },
  LAB_OAK_BE_PATIENT:       { offsets: [symToOffset(0x2A, 0x4CC2)] },
  LAB_RIVAL_ILL_GET_BETTER: { offsets: [symToOffset(0x2A, 0x46DB)] },
  LAB_OAK_GO_AHEAD:         { offsets: [symToOffset(0x2A, 0x4754)] },
  LAB_OAK_DONT_GO:          { offsets: [symToOffset(0x2A, 0x4E53)] },
  LAB_RIVAL_NO_WAY:         { offsets: [symToOffset(0x2A, 0x4CEF)] },
  LAB_RIVAL_SNATCHED:       { offsets: [symToOffset(0x2A, 0x4D10)] },
  LAB_OAK_WHAT_DOING:       { offsets: [symToOffset(0x2A, 0x4D27)] },
  LAB_RIVAL_WANTS_THIS:     { offsets: [symToOffset(0x2A, 0x4D44)] },
  LAB_OAK_ALL_RIGHT:        { offsets: [symToOffset(0x2A, 0x4D61)] },
  LAB_OAK_GIVES_PIKACHU:    { offsets: [symToOffset(0x2A, 0x4DD2)] },
  LAB_RECEIVED_PIKACHU:     { offsets: [symToOffset(0x2A, 0x4E3D)] },
  LAB_OAK_ADVICE:           { offsets: [symToOffset(0x2A, 0x476F)] },
  LAB_RIVAL_ILL_TAKE_YOU_ON:{ offsets: [symToOffset(0x2A, 0x4E70)] },
  LAB_OAK_WHAT:             { offsets: [symToOffset(0x2A, 0x4F4A)] },
  LAB_OAK_PIKACHU_DISLIKES: { offsets: [symToOffset(0x2A, 0x4F56)] },
  LAB_RIVAL_SMELL_YOU_LATER:{ offsets: [symToOffset(0x2A, 0x4EFB)] },
  LAB_RIVAL_MON_STRONGER:   { offsets: [symToOffset(0x2A, 0x4706)] },
  LAB_OAK_DELIVER_PARCEL:   { offsets: [symToOffset(0x2A, 0x4802)] },
  LAB_OAK_PARCEL_THANKS:    { offsets: [symToOffset(0x2A, 0x48A8)] },
  LAB_RIVAL_GRAMPS:         { offsets: [symToOffset(0x2A, 0x5020)] },
  LAB_RIVAL_MON_GROWN:      { offsets: [symToOffset(0x2A, 0x502C)] },
  LAB_OAK_HAVE_A_REQUEST:   { offsets: [symToOffset(0x2A, 0x5062)] },
  LAB_OAK_POKEDEX_SPEECH:   { offsets: [symToOffset(0x2A, 0x50B0)] },
  LAB_OAK_GOT_POKEDEX:      { offsets: [symToOffset(0x2A, 0x5132)] },
  LAB_OAK_DREAM_SPEECH:     { offsets: [symToOffset(0x2A, 0x516C)] },
  LAB_RIVAL_LEAVE_IT_TO_ME: { offsets: [symToOffset(0x2A, 0x5249)] },
  LAB_OAK_POKEMON_AROUND_WORLD: { offsets: [symToOffset(0x2A, 0x4911)] },
  LAB_OAK_TALK_TO_IT:       { offsets: [symToOffset(0x2A, 0x47D0)] },

  // Viridian Mart (bank 0x2A)
  MART_CLERK_PALLET_TOWN:   { offsets: [symToOffset(0x2A, 0x5760)] },
  MART_CLERK_PARCEL_QUEST:  { offsets: [symToOffset(0x2A, 0x5781)] },
  MART_CLERK_SAY_HI:        { offsets: [symToOffset(0x2A, 0x573E)] },

  // School notebook (bank 0x27)
  SCHOOL_NOTEBOOK_PAGE1:     { offsets: [symToOffset(0x27, 0x6B54)] },
  SCHOOL_NOTEBOOK_PAGE2:     { offsets: [symToOffset(0x27, 0x6BF7)] },
  SCHOOL_NOTEBOOK_PAGE3:     { offsets: [symToOffset(0x27, 0x6C6E)] },
  SCHOOL_NOTEBOOK_PAGE4:     { offsets: [symToOffset(0x27, 0x6CDD)] },
  SCHOOL_NOTEBOOK_TURN_PAGE: { offsets: [symToOffset(0x27, 0x6B20)] },
  SCHOOL_GIRL_REACTION:      { offsets: [symToOffset(0x27, 0x6B30)] },

  // Oak Speech (bank 0x28)
  OAK_SPEECH_1:              { offsets: [symToOffset(0x28, 0x47BA)] },
  OAK_SPEECH_PIKACHU:        { offsets: [symToOffset(0x28, 0x4814)] },
  OAK_SPEECH_PLAYER_ASK:     { offsets: [symToOffset(0x28, 0x48AE)] },
  OAK_SPEECH_RIVAL_ASK:      { offsets: [symToOffset(0x28, 0x48C9)] },
  OAK_SPEECH_PLAYER_CONFIRM: { offsets: [symToOffset(0x28, 0x49C4)] },
  OAK_SPEECH_RIVAL_CONFIRM:  { offsets: [symToOffset(0x28, 0x49DF)] },
  OAK_SPEECH_FINAL:          { offsets: [symToOffset(0x28, 0x492C)] },

  // Route 1 (bank 0x28)
  ROUTE1_POTION_FOLLOWUP:    { offsets: [symToOffset(0x28, 0x6C64)] },
  ROUTE1_MART_SAMPLE:        { offsets: [symToOffset(0x28, 0x6BD1)] },

  // Viridian City (bank 0x2D)
  VIRIDIAN_GIRL_PEWTER:      { offsets: [symToOffset(0x2D, 0x4752)] },
  VIRIDIAN_CATERPILLAR_ASK:  { offsets: [symToOffset(0x2D, 0x4686)] },

  // Blue's House (bank 0x2A)
  BLUES_HOUSE_USE_MAP:       { offsets: [symToOffset(0x2A, 0x4603)] },

  // Battle UI text
  BATTLE_MISSED_MON:         { offsets: [symToOffset(0x2D, 0x6A0F)] },
  BATTLE_BROKE_FREE:         { offsets: [symToOffset(0x2D, 0x6A25)] },

  // Bookshelf text (bank 0x27)
  BOOKSHELF_BOOKS:           { offsets: [symToOffset(0x27, 0x6492)] },
  BOOKSHELF_POKEMON_STUFF:   { offsets: [symToOffset(0x27, 0x74F7)] },
  BOOKSHELF_STATUES:         { offsets: [symToOffset(0x27, 0x6DB9)] },

  // Menu labels (bank 0x01)
  MENU_POKEDEX:              { offsets: [symToOffset(0x01, 0x7002)] },
  MENU_POKEMON:              { offsets: [symToOffset(0x01, 0x700A)] },
  SAVE_POKEDEX_LABEL:        { offsets: [symToOffset(0x01, 0x7002)] },

  // Party menu (bank 0x28)
  PARTY_CHOOSE:              { offsets: [symToOffset(0x28, 0x4137)] },

  // PC text (bank 0x28)
  PC_NO_MON_HERE:            { offsets: [symToOffset(0x28, 0x4561)] },
  PC_CANT_DEPOSIT_LAST:      { offsets: [symToOffset(0x28, 0x4501)] },
  PC_BOX_FULL:               { offsets: [symToOffset(0x28, 0x4522)] },
  PC_WHICH_MON_STORE:        { offsets: [symToOffset(0x28, 0x44CE)] },
  PC_WHICH_MON_RELEASE:      { offsets: [symToOffset(0x28, 0x45CF)] },

  // Pokecenter (bank 0x2C)
  POKECENTER_WELCOME:        { offsets: [symToOffset(0x2C, 0x7772)] },
  POKECENTER_HEAL_ASK:       { offsets: [symToOffset(0x2C, 0x77B9)] },
  POKECENTER_NEED_MON:       { offsets: [symToOffset(0x2C, 0x77D3)] },
  POKECENTER_FIGHTING_FIT:   { offsets: [symToOffset(0x2C, 0x77ED)] },

  // Mom (bank 0x2A)
  MOM_REST:                  { offsets: [symToOffset(0x2A, 0x4471)] },
  MOM_LOOKING_GREAT:         { offsets: [symToOffset(0x2A, 0x44C7)] },

  // Blackboard (bank 0x27)
  BLACKBOARD_INTRO:          { offsets: [symToOffset(0x27, 0x6FE8)] },
  BLACKBOARD_SLEEP:          { offsets: [symToOffset(0x27, 0x704A)] },
  BLACKBOARD_POISON:         { offsets: [symToOffset(0x27, 0x70B6)] },
  BLACKBOARD_PARALYSIS:      { offsets: [symToOffset(0x27, 0x7123)] },
  BLACKBOARD_FREEZE:         { offsets: [symToOffset(0x27, 0x7207)] },
};

// Offsets for text blocks that need post-processing (extract substring from longer block)
const POSTPROCESS_OFFSETS = {
  // _PlayerBlackedOutText2 — full text includes "blacked out!" which we don't need
  BLACKOUT_FULL:      symToOffset(0x27, 0x7620),
  // _AccessedBillsPCText — "Accessed BILL's PC.\fAccessed #MON Storage System."
  BILLS_PC_FULL:      symToOffset(0x28, 0x4281),
  // _CantTakeMonText — includes "Deposit #MON first." continuation
  CANT_TAKE_FULL:     symToOffset(0x28, 0x4580),
  // _PartyMenuItemUseText — "Use item on which\n#MON?"
  ITEM_USE_FULL:      symToOffset(0x28, 0x4147),
  // _ViridianCityOldManHadMyCoffeeNowText — first paragraph only
  OLDMAN_COFFEE:      symToOffset(0x2D, 0x44A4),
};

/**
 * Build game_text.json content by reading text from known ROM offsets.
 * This produces the same keys and values as data/game_text.json.
 *
 * ALL strings are read from ROM — zero hardcoded copyrighted text.
 */
export function extractGameText(rom: BinaryReader): Record<string, string> {
  const result: Record<string, string> = {};

  // Read strings with known ROM offsets
  for (const [key, entry] of Object.entries(TEXT_ENTRIES)) {
    const parts: string[] = [];
    for (const offset of entry.offsets) {
      parts.push(readText(rom, offset));
    }
    result[key] = parts.join(entry.join ?? '\f');
  }

  // ── Post-processed strings (extracted from longer ROM text blocks) ──

  // LAB_OAK_CHOOSE_MON_2: second half of the full choose-mon text block
  // Full block = "OAK: Hmm? <RIVAL>?...\f...\fAh, whatever!..."
  // Split at 2nd \f to get the "Ah, whatever!" part onward
  const chooseMonFull = result['LAB_OAK_CHOOSE_MON_1'];
  if (chooseMonFull) {
    const pages = chooseMonFull.split('\f');
    // First 2 pages are MON_1, rest are MON_2
    result['LAB_OAK_CHOOSE_MON_1'] = pages.slice(0, 2).join('\f');
    result['LAB_OAK_CHOOSE_MON_2'] = pages.slice(2).join('\f');
  }

  // LAB_DELIVERED_PARCEL: last paragraph of the deliver-parcel text block
  const deliverFull = result['LAB_OAK_DELIVER_PARCEL'];
  if (deliverFull) {
    const pages = deliverFull.split('\f');
    // Last paragraph is the delivery confirmation
    result['LAB_DELIVERED_PARCEL'] = pages[pages.length - 1];
  }

  // MART_GOT_PARCEL: last paragraph of the parcel-quest text block
  const parcelFull = result['MART_CLERK_PARCEL_QUEST'];
  if (parcelFull) {
    const pages = parcelFull.split('\f');
    result['MART_GOT_PARCEL'] = pages[pages.length - 1];
    // Keep MART_CLERK_PARCEL_QUEST as just the first pages (without the "got parcel" part)
    result['MART_CLERK_PARCEL_QUEST'] = pages.slice(0, -1).join('\f');
  }

  // SCHOOL_NOTEBOOK_LOOKED: first line of notebook page 1 (before the page content)
  const notebookFull = result['SCHOOL_NOTEBOOK_PAGE1'];
  if (notebookFull) {
    const pages = notebookFull.split('\f');
    // First part is "Looked at the\nnotebook!", rest is the actual page
    result['SCHOOL_NOTEBOOK_LOOKED'] = pages[0];
    result['SCHOOL_NOTEBOOK_PAGE1'] = pages.slice(1).join('\f');
  }

  // BATTLE_OUT_OF_USEABLE: first 2 lines of _PlayerBlackedOutText2
  // Full: "<PLAYER> is out of\nuseable POKéMON!\f<PLAYER> blacked\nout!"
  const blackoutFull = readText(rom, POSTPROCESS_OFFSETS.BLACKOUT_FULL);
  if (blackoutFull) {
    const pages = blackoutFull.split('\f');
    // Extract " is out of\nuseable POKéMON!" — strip the leading <PLAYER>
    const firstPage = pages[0];
    const playerIdx = firstPage.indexOf('>');
    result['BATTLE_OUT_OF_USEABLE'] = playerIdx >= 0 ? firstPage.substring(playerIdx + 1) : firstPage;
  }

  // PC_ACCESSED_STORAGE: 2nd paragraph of _AccessedBillsPCText
  // Full: "Accessed BILL's\nPC.\fAccessed POKéMON\nStorage System."
  const billsPcFull = readText(rom, POSTPROCESS_OFFSETS.BILLS_PC_FULL);
  if (billsPcFull) {
    const pages = billsPcFull.split('\f');
    if (pages.length >= 2) {
      result['PC_ACCESSED_STORAGE'] = pages[1];
    }
  }

  // PC_CANT_TAKE_MORE: 1st paragraph only of _CantTakeMonText
  // Full: "You can't take\nany more POKéMON.\fDeposit POKéMON\nfirst."
  const cantTakeFull = readText(rom, POSTPROCESS_OFFSETS.CANT_TAKE_FULL);
  if (cantTakeFull) {
    const pages = cantTakeFull.split('\f');
    result['PC_CANT_TAKE_MORE'] = pages[0];
  }

  // ITEM_USE_ON_WHICH_MON: 2nd line of _PartyMenuItemUseText
  // Full: "Use item on which\nPOKéMON?"
  const itemUseFull = readText(rom, POSTPROCESS_OFFSETS.ITEM_USE_FULL);
  if (itemUseFull) {
    const lines = itemUseFull.split('\n');
    if (lines.length >= 2) {
      result['ITEM_USE_ON_WHICH_MON'] = lines[lines.length - 1];
    }
  }

  // VIRIDIAN_OLDMAN_DEMO: ROM 1st paragraph + custom non-copyrighted demo ending
  // ROM: "Ahh, I've had my coffee now and I feel great!\f..."
  const coffeeText = readText(rom, POSTPROCESS_OFFSETS.OLDMAN_COFFEE);
  if (coffeeText) {
    const firstParagraph = coffeeText.split('\f')[0];
    // Append our custom demo-specific ending (NOT copyrighted — we wrote this)
    result['VIRIDIAN_OLDMAN_DEMO'] = firstParagraph +
      '\fBut this is as far\nas the demo goes!\fThanks for playing!';
  }

  return result;
}
