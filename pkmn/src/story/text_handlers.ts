// DisplayTextID's text_asm dispatch. Conditions are evaluated when the player talks.
import type { Direction } from '../core';
import type { Bag } from '../items';
import type { BattlePokemon } from '../battle';
import type { ScriptCommand } from '../script/types';
import type { Npc } from '../overworld/npc';

export interface TextHandlerContext {
  hasFlag: (flag: string) => boolean;
  bag: Bag;
  ownedCount: number;
  facing: Direction;
  step: { x: number; y: number };
  party: BattlePokemon[];
  findNpc?: (id: string) => Npc | undefined;
  /** SetLastBlackoutMap belongs to the Pokécenter nurse only; Mom must not call this. */
  onHeal?: () => void;
  /** The talked-to clerk's inventory. DisplayPokemartDialogue's LoadItemList. */
  shopItems?: string[];
}
export type TextHandler = (ctx: TextHandlerContext) => ScriptCommand[];
const handlers = new Map<string, TextHandler>();
const scripts = new Map<string, TextHandler>();

export function registerTextScript(script: string, builder: TextHandler): void {
  if (scripts.has(script)) throw new Error(`duplicate text script ${script}`);
  scripts.set(script, builder);
}
export function getTextScript(script: string): TextHandler | undefined { return scripts.get(script); }

export function registerTextHandler(map: string, textId: number, handler: TextHandler): void {
  const key = `${map}:${textId}`;
  if (handlers.has(key)) throw new Error(`duplicate text handler ${key}`);
  handlers.set(key, handler);
}
export function getTextHandler(map: string, textId: number | undefined): TextHandler | undefined {
  return textId === undefined ? undefined : handlers.get(`${map}:${textId}`);
}
/** DisplayTextIDInit -> handler -> AfterDisplayingTextID/Hold -> CloseTextDisplay. */
export function displayTextID(body: ScriptCommand[], opts: { autoBox?: boolean; outerWait?: boolean; textId?: number } = {}): ScriptCommand[] {
  return [{ type: 'displayOpen', autoBox: opts.autoBox ?? true,
    ...(opts.textId === undefined ? {} : { spriteIndex: opts.textId }) }, ...body,
    { type: 'displayClose', outerWait: opts.outerWait ?? true }];
}
