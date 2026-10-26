// Unused A5c3e dispatcher. pret e89ead15 engine/items/item_effects.asm; source lines at each routine.
import { I } from './battle_item_state';
import { battleGlyphTile } from './battle_screen';
import { type BattleState, encodeText, NAME_BUFFER_LENGTH } from './battle_state';
import { BattleUnsupportedState } from './battle_move_data';
import { decodeTextByte } from '../rom/extractors/text';
import { waitForTextScrollButtonPress } from './battle_experience';
import type { BattleActionContext, BattleActionHost, Program } from './battle_menu_context';
import type { ExperienceHost } from './battle_experience';
import type { BattleAudio, BattleSfx } from './battle_audio';
import type { SfxData } from '../audio/sfx_engine';
import type { ListEntry } from '../menus/list_menu';
import { setBagSavedMenuItem, setCurrentMenuItem, setListScrollOffset, setSavedListScrollOffset } from '../list_state';

// ItemUsePtrTable (item_effects.asm:18-103), one frozen row per cartridge item id.
const rows = [
  { id: 0x01, item: 'MASTER_BALL', label: 'ItemUseBall', address: 0x53ad, kind: 'body' },
  { id: 0x02, item: 'ULTRA_BALL', label: 'ItemUseBall', address: 0x53ad, kind: 'body' },
  { id: 0x03, item: 'GREAT_BALL', label: 'ItemUseBall', address: 0x53ad, kind: 'body' },
  { id: 0x04, item: 'POKE_BALL', label: 'ItemUseBall', address: 0x53ad, kind: 'body' },
  { id: 0x05, item: 'TOWN_MAP', label: 'ItemUseTownMap', address: 0x56c8, kind: 'notTime' },
  { id: 0x06, item: 'BICYCLE', label: 'ItemUseBicycle', address: 0x56d7, kind: 'notTime' },
  { id: 0x07, item: 'SURFBOARD', label: 'ItemUseSurfboard', address: 0x5725, kind: 'unsupported' },
  { id: 0x08, item: 'SAFARI_BALL', label: 'ItemUseBall', address: 0x53ad, kind: 'body' },
  { id: 0x09, item: 'POKEDEX', label: 'ItemUsePokedex', address: 0x57cb, kind: 'unsupported' },
  { id: 0x0a, item: 'MOON_STONE', label: 'ItemUseEvoStone', address: 0x57d0, kind: 'notTime' },
  { id: 0x0b, item: 'ANTIDOTE', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x0c, item: 'BURN_HEAL', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x0d, item: 'ICE_HEAL', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x0e, item: 'AWAKENING', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x0f, item: 'PARLYZ_HEAL', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x10, item: 'FULL_RESTORE', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x11, item: 'MAX_POTION', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x12, item: 'HYPER_POTION', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x13, item: 'SUPER_POTION', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x14, item: 'POTION', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x15, item: 'BOULDERBADGE', label: 'ItemUseBait', address: 0x5d72, kind: 'body' },
  { id: 0x16, item: 'CASCADEBADGE', label: 'ItemUseRock', address: 0x5d87, kind: 'body' },
  { id: 0x17, item: 'THUNDERBADGE', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x18, item: 'RAINBOWBADGE', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x19, item: 'SOULBADGE', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x1a, item: 'MARSHBADGE', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x1b, item: 'VOLCANOBADGE', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x1c, item: 'EARTHBADGE', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x1d, item: 'ESCAPE_ROPE', label: 'ItemUseEscapeRope', address: 0x5dcf, kind: 'notTime' },
  { id: 0x1e, item: 'REPEL', label: 'ItemUseRepel', address: 0x5e2e, kind: 'notTime', registerB: 100 },
  { id: 0x1f, item: 'OLD_AMBER', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x20, item: 'FIRE_STONE', label: 'ItemUseEvoStone', address: 0x57d0, kind: 'notTime' },
  { id: 0x21, item: 'THUNDER_STONE', label: 'ItemUseEvoStone', address: 0x57d0, kind: 'notTime' },
  { id: 0x22, item: 'WATER_STONE', label: 'ItemUseEvoStone', address: 0x57d0, kind: 'notTime' },
  { id: 0x23, item: 'HP_UP', label: 'ItemUseVitamin', address: 0x58a7, kind: 'notTime' },
  { id: 0x24, item: 'PROTEIN', label: 'ItemUseVitamin', address: 0x58a7, kind: 'notTime' },
  { id: 0x25, item: 'IRON', label: 'ItemUseVitamin', address: 0x58a7, kind: 'notTime' },
  { id: 0x26, item: 'CARBOS', label: 'ItemUseVitamin', address: 0x58a7, kind: 'notTime' },
  { id: 0x27, item: 'CALCIUM', label: 'ItemUseVitamin', address: 0x58a7, kind: 'notTime' },
  { id: 0x28, item: 'RARE_CANDY', label: 'ItemUseVitamin', address: 0x58a7, kind: 'notTime' },
  { id: 0x29, item: 'DOME_FOSSIL', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x2a, item: 'HELIX_FOSSIL', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x2b, item: 'SECRET_KEY', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x2c, item: 'ITEM_2C', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x2d, item: 'BIKE_VOUCHER', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x2e, item: 'X_ACCURACY', label: 'ItemUseXAccuracy', address: 0x5e3e, kind: 'body' },
  { id: 0x2f, item: 'LEAF_STONE', label: 'ItemUseEvoStone', address: 0x57d0, kind: 'notTime' },
  { id: 0x30, item: 'CARD_KEY', label: 'ItemUseCardKey', address: 0x5e57, kind: 'cardKey' },
  { id: 0x31, item: 'NUGGET', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x32, item: 'ITEM_32', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x33, item: 'POKE_DOLL', label: 'ItemUsePokeDoll', address: 0x5f02, kind: 'body' },
  { id: 0x34, item: 'FULL_HEAL', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x35, item: 'REVIVE', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x36, item: 'MAX_REVIVE', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x37, item: 'GUARD_SPEC', label: 'ItemUseGuardSpec', address: 0x5f11, kind: 'body' },
  { id: 0x38, item: 'SUPER_REPEL', label: 'ItemUseSuperRepel', address: 0x5f38, kind: 'notTime', registerB: 200 },
  { id: 0x39, item: 'MAX_REPEL', label: 'ItemUseMaxRepel', address: 0x5f3d, kind: 'notTime', registerB: 250 },
  { id: 0x3a, item: 'DIRE_HIT', label: 'ItemUseDireHit', address: 0x5f42, kind: 'body' },
  { id: 0x3b, item: 'COIN', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x3c, item: 'FRESH_WATER', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x3d, item: 'SODA_POP', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x3e, item: 'LEMONADE', label: 'ItemUseMedicine', address: 0x58ae, kind: 'body' },
  { id: 0x3f, item: 'S_S_TICKET', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x40, item: 'GOLD_TEETH', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x41, item: 'X_ATTACK', label: 'ItemUseXStat', address: 0x5f69, kind: 'body' },
  { id: 0x42, item: 'X_DEFEND', label: 'ItemUseXStat', address: 0x5f69, kind: 'body' },
  { id: 0x43, item: 'X_SPEED', label: 'ItemUseXStat', address: 0x5f69, kind: 'body' },
  { id: 0x44, item: 'X_SPECIAL', label: 'ItemUseXStat', address: 0x5f69, kind: 'body' },
  { id: 0x45, item: 'COIN_CASE', label: 'ItemUseCoinCase', address: 0x60e7, kind: 'notTime' },
  { id: 0x46, item: 'OAKS_PARCEL', label: 'ItemUseOaksParcel', address: 0x61b7, kind: 'notYours' },
  { id: 0x47, item: 'ITEMFINDER', label: 'ItemUseItemfinder', address: 0x61ba, kind: 'notTime' },
  { id: 0x48, item: 'SILPH_SCOPE', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x49, item: 'POKE_FLUTE', label: 'ItemUsePokeFlute', address: 0x5fbd, kind: 'body' },
  { id: 0x4a, item: 'LIFT_KEY', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x4b, item: 'EXP_ALL', label: 'UnusableItem', address: 0x6371, kind: 'notTime' },
  { id: 0x4c, item: 'OLD_ROD', label: 'ItemUseOldRod', address: 0x60f9, kind: 'notTime' },
  { id: 0x4d, item: 'GOOD_ROD', label: 'ItemUseGoodRod', address: 0x6106, kind: 'notTime' },
  { id: 0x4e, item: 'SUPER_ROD', label: 'ItemUseSuperRod', address: 0x6130, kind: 'notTime' },
  { id: 0x4f, item: 'PP_UP', label: 'ItemUsePPUp', address: 0x61f0, kind: 'notTime' },
  { id: 0x50, item: 'ETHER', label: 'ItemUsePPRestore', address: 0x61f7, kind: 'body' },
  { id: 0x51, item: 'MAX_ETHER', label: 'ItemUsePPRestore', address: 0x61f7, kind: 'body' },
  { id: 0x52, item: 'ELIXER', label: 'ItemUsePPRestore', address: 0x61f7, kind: 'body' },
  { id: 0x53, item: 'MAX_ELIXER', label: 'ItemUsePPRestore', address: 0x61f7, kind: 'body' },
] as const;
export const BATTLE_ITEM_POINTERS = Object.freeze(rows.map(row => Object.freeze(row)));
export const CARD_KEY_COMPARED_BYTE = 0xcd; // ROM 03:42D1, NOT wTileInFrontOfPlayer.
export type BattleItemLabel = (typeof rows)[number]['label'];
export interface BattleItemHost extends Pick<ExperienceHost,
  'tiles' | 'printText' | 'readScrollJoypad' | 'townMapSpriteBlinking' | 'cableClubRun'> {
  audio: BattleAudio;
  sounds: ReadonlyMap<number, BattleSfx>;
  waitForSound(): Program;
  /** Optional menu mirror; the cartridge bytes remain authoritative. */
  bag?: ListEntry[];
}
export type BattleItemBody = (state: BattleState, host: BattleItemHost) => Program;
const bodies = new Map<BattleItemLabel, BattleItemBody>();
/** No bodies are installed by this checkpoint. The disposer supports isolated hosts/tests. */
export function registerBattleItemBody(label: BattleItemLabel, program: BattleItemBody): () => void {
  if (bodies.has(label)) throw new Error(`duplicate battle item body: ${label}`);
  bodies.set(label, program);
  return () => { if (bodies.get(label) === program) bodies.delete(label); };
}

/** Audio 2 IDs; assets are loaded before entering a CPU-paced battle program. */
export async function loadBattleItemSounds(): Promise<ReadonlyMap<number, BattleSfx>> {
  const assets = [[0x9a, 'caught_mon'], [0x98, 'dex_page_added'],
    [0x8d, 'heal_hp'], [0x8e, 'heal_ailment']] as const;
  return new Map(await Promise.all(assets.map(async ([id, name]) => {
    const response = await fetch(`audio/sfx/${name}.json`);
    if (!response.ok) throw new Error(`battle item sound: ${name}`);
    return [id, { id, data: await response.json() as SfxData }] as const;
  })));
}
export function playBattleItemSound(host: Pick<BattleItemHost, 'audio' | 'sounds'>, id: number): boolean {
  const sound = host.sounds.get(id);
  if (host.audio.audioBank !== 8 || !sound) throw new BattleUnsupportedState(`battle item sound ${host.audio.audioBank}:${id}`);
  return host.audio.play(sound);
}
/** home/delay.asm:8-12: wait for the old sound, start the new one, return immediately. */
export function* playSoundWaitForCurrent(host: BattleItemHost, id: number): Program {
  yield* host.waitForSound();
  playBattleItemSound(host, id);
}

/** item_effects.asm:2593-2596. The write precedes even the printer's CPU entry. */
export function* itemUseFailed(state: BattleState, host: BattleItemHost, text: string): Program {
  state.wActionResultOrTookBattleTurn = 0;
  yield* host.printText(text);
}
/** item_effects.asm:2551-2553. */
export function* itemUseNoEffect(state: BattleState, host: BattleItemHost): Program {
  yield* itemUseFailed(state, host, 'ItemUseNoEffectText');
}
/** item_effects.asm:2555-2557; UnusableItem at2396 also jumps here. */
export function* itemUseNotTime(state: BattleState, host: BattleItemHost): Program {
  yield* itemUseFailed(state, host, 'ItemUseNotTimeText');
}
/** item_effects.asm:2559-2561. */
export function* itemUseNotYoursToUse(state: BattleState, host: BattleItemHost): Program {
  yield* itemUseFailed(state, host, 'ItemUseNotYoursToUseText');
}
/** item_effects.asm:2563-2567. */
export function* func_e4bf(state: BattleState, host: BattleItemHost): Program {
  state.wActionResultOrTookBattleTurn = 2;
  yield* host.printText('DontHavePokemonText');
}

/** inventory.asm:101-159. Copy through $FF; don't clear the stale bytes after it. */
export function removeItemFromInventory(state: BattleState, bag?: ListEntry[]): void {
  const m = state.mem, slot = state.wWhichPokemon;
  const at = I.wNumBagItems + 1 + ((slot * 2) & 255);
  const remaining = (m[at + 1] - m[I.wItemQuantity]) & 255;
  m[at + 1] = remaining;
  m[I.wMaxItemQuantity] = remaining;
  if (remaining) {
    if (bag?.[slot]) bag[slot].count = remaining;
    return;
  }
  let src = at + 2, dst = at;
  do { m[dst++] = m[src++]; } while (m[dst - 1] !== 255);
  m[I.wListScrollOffset] = 0; m[I.wCurrentMenuItem] = 0;
  m[I.wBagSavedMenuItem] = 0; m[I.wSavedListScrollOffset] = 0;
  setListScrollOffset(0); setCurrentMenuItem(0); setBagSavedMenuItem(0); setSavedListScrollOffset(0);
  const count = m[I.wNumBagItems] = (m[I.wNumBagItems] - 1) & 255;
  m[I.wListCount] = count;
  if (count >= 2) m[I.wMaxMenuItem] = count;
  bag?.splice(slot, 1);
}
/** item_effects.asm:2545-2549. */
export function removeUsedItem(state: BattleState, host: Pick<BattleItemHost, 'bag'>): void {
  state.mem[I.wItemQuantity] = 1;
  removeItemFromInventory(state, host.bag);
}
/** item_effects.asm:2538-2549; shared home/window.asm scroll-button owner. */
export function* printItemUseTextAndRemoveItem(state: BattleState, host: BattleItemHost): Program {
  // ItemNames also contains punctuation and é absent from the MoveNames alphabet.
  let name = '';
  for (let i = 0; i < NAME_BUFFER_LENGTH; i++) {
    const byte = state.mem[I.wStringBuffer + i];
    if (byte === 0x50) break;
    name += decodeTextByte(byte, I.wStringBuffer + i);
  }
  yield* host.printText('ItemUseText00', { stringBuffer: name });
  playBattleItemSound(host, 0x8e);
  yield* waitForTextScrollButtonPress(state, host);
  removeUsedItem(state, host);
}

/** item_effects.asm:1-16,1699-1750. Battle-only; no field fallbacks or body implementations. */
export function* useItem(state: BattleState, host: BattleItemHost): Program {
  state.wActionResultOrTookBattleTurn = 1;
  const id = state.mem[I.wCurItem];
  if (id >= 0xc4) { yield* itemUseNotTime(state, host); return; }
  const row = BATTLE_ITEM_POINTERS[id - 1];
  if (!row) throw new BattleUnsupportedState(`battle item ${id}`);
  if (!state.wIsInBattle) throw new BattleUnsupportedState('field item dispatcher');
  if (row.kind === 'unsupported') throw new BattleUnsupportedState(id === 7 ? 'surfboard' : 'pokedex');
  if (row.kind === 'cardKey') {
    state.mem[I.wUnusedCardKeyGateID] = 0;
    // player_state.asm:258-309: coords change CPU registers, not wXCoord/wYCoord.
    const facing = state.mem[I.wSpritePlayerStateData1FacingDirection];
    const coords: Record<number, [number, number]> = { 0: [8, 11], 4: [8, 7], 8: [6, 9], 12: [10, 9] };
    const xy = coords[facing];
    const tile = xy ? host.tiles.at(...xy) : facing;
    if (tile === null) throw new BattleUnsupportedState('Card Key tile outside battle screen');
    state.mem[I.wTileInFrontOfPlayer] = typeof tile === 'string' ? battleGlyphTile(tile) : tile;
    // The source compares the instruction opcode at GetTileAndCoordsInFrontOfPlayer.
    // $CD matches none of $18/$24/$5E, so no map/gate lookup is reachable.
    if ([0x18, 0x24, 0x5e].includes(CARD_KEY_COMPARED_BYTE)) {
      throw new BattleUnsupportedState('Card Key field gate table');
    }
    yield* itemUseNotTime(state, host); return;
  }
  if (row.kind === 'notYours') { yield* itemUseNotYoursToUse(state, host); return; }
  if (row.kind === 'notTime' || (id === 0x33 && state.wIsInBattle !== 1)) {
    // Repel's B=100/200/250 is CPU-only (row.registerB); the battle check returns
    // before remaining-steps writes. FishingInit likewise returns before any RNG.
    yield* itemUseNotTime(state, host); return;
  }
  const body = bodies.get(row.label);
  if (!body) throw new BattleUnsupportedState(`unregistered battle item body: ${row.label}`);
  yield* body(state, host);
}

/** core.asm:2344-2354: bridge the existing A5c2 selected item/name to raw item operands.
 * Intentionally never called by the live game or ledger rig. GetItemName stays with its caller. */
export function bindBattleItems(state: BattleState, host: BattleItemHost): BattleActionHost['useItem'] {
  return function* (ctx: BattleActionContext): Program {
    const key = ctx.curItem === 'PARALYZE_HEAL' ? 'PARLYZ_HEAL' : ctx.curItem;
    let id: number | undefined = BATTLE_ITEM_POINTERS.find(row => row.item === key)?.id;
    const machine = /^(HM|TM)(\d{2})$/.exec(key);
    if (machine) {
      const number = Number(machine[2]), hm = machine[1] === 'HM';
      if (number >= 1 && number <= (hm ? 5 : 50)) id = (hm ? 0xc3 : 0xc8) + number;
    }
    if (id === undefined) throw new BattleUnsupportedState(`battle item name ${key}`);
    state.mem[I.wCurItem] = id; state.wWhichPokemon = ctx.itemIndex;
    state.mem.set(encodeText(`${ctx.itemName}@`), I.wStringBuffer);
    yield* useItem(state, { ...host, bag: ctx.bag });
  };
}
