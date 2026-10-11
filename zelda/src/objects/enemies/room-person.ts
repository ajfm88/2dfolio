// Shared body of the dungeon people ($4B-$52) and Grumble ($36).
// Z_01.asm:278 SetUpCommonCaveObjects — the person stands at ($78, $80) between two
// bonfires at X $48 and $A8, with HP 0, and Link is halted while the textbox
// types. Z_01.asm:1201 Person_CheckCollisions — striking the person "kills" it,
// which only sets PersonFireballsEnabled (the bonfires start shooting) and then
// revives it. Z_01.asm:3144 CheckPersonBlocking — while one of these is in the
// room, Link cannot walk up past NES Y $8E.

import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { Enemy, EnemyState, type EnemyUpdateContext } from './enemy.js';
import { PersonTextbox } from './person-textbox.js';

// Play-area-local positions. People are compared against Link (blocking, item
// touches), so they share Link's NES ObjY − $3D frame.
const NES_LINK_Y_OFFSET = 0x3d;
export const PERSON_X = 0x78;
export const PERSON_Y = 0x80 - NES_LINK_Y_OFFSET;
export const BONFIRE_XS = [0x48, 0xa8] as const;

/** CheckPersonBlocking: moving up is refused while Link's NES Y < $8E. */
export const PERSON_BLOCK_LINK_Y = 0x8e - NES_LINK_Y_OFFSET;

/** Link NES-space Y from his play-area posY (for the ROM's ±6 / ±9 touch tests). */
export function linkNesY(posY: number): number {
  return posY + NES_LINK_Y_OFFSET;
}

/** Room state a person reads in its Init routine. */
export interface PersonRoomContext {
  /** NES CurLevel (1-9) — picks the text table and behaviour. */
  readonly level: number;
  /** GetRoomFlagUWItemState: this room's secret/item was already taken. */
  readonly itemTaken: boolean;
  /** InvTriforce bitmask (L1-8 pieces). */
  readonly triforce: number;
}

export abstract class RoomPerson extends Enemy {
  protected _textbox: PersonTextbox | null = null;
  private _struck = false;
  private _typedChar = false;
  private _haltLink = false;
  protected _flicker = false;
  private _frame = 0;

  constructor(objectType: number) {
    super(PERSON_X, PERSON_Y, objectType, 0, 0);
    this._direction = Direction.Down;
    this._touchesLink = false;
    // People appear with the room, no spawn cloud.
    this._state = EnemyState.Active;
  }

  /** Apply the Init routine's room checks. Called once after spawning. */
  abstract setup(ctx: PersonRoomContext): void;

  /** Begin typing; Link is halted until the last character. */
  protected startText(lines: readonly string[], startDelay = 0): void {
    this._textbox = new PersonTextbox(lines, startDelay);
    this._haltLink = lines.length > 0;
  }

  get textbox(): PersonTextbox | null { return this._textbox; }
  /** Link stays halted until the textbox finishes (SetUpCommonCaveObjects → UnhaltLink). */
  get haltsLink(): boolean { return this.isActive && this._haltLink; }
  get blocksLink(): boolean { return this.isActive; }

  /** True once per hit — main.ts turns on the bonfire fireballs. */
  consumeStruck(): boolean {
    const s = this._struck;
    this._struck = false;
    return s;
  }

  /** True on frames a character was typed — main.ts plays the text blip. */
  consumeTypedChar(): boolean {
    const t = this._typedChar;
    this._typedChar = false;
    return t;
  }

  /** DestroyMonster: the person vanishes outright, no death puff. */
  remove(): void {
    this._state = EnemyState.Dead;
  }

  override takeDamage(_damage: number, _fromDirection: Direction): boolean {
    if (this.isActive) this._struck = true;
    return false;
  }

  override stun(): void {
    if (this.isActive) this._struck = true;
  }

  override debugKill(): void {
    this.remove();
  }

  protected override updateAI(_ctx: EnemyUpdateContext): void {
    this._frame++;
    if (this._textbox && !this._textbox.done) {
      if (this._textbox.tick()) this._typedChar = true;
      if (this._textbox.done) {
        this._haltLink = false;
        this.onTextDone();
      }
    }
    this.updatePerson();
  }

  protected onTextDone(): void {}
  protected abstract updatePerson(): void;
  protected abstract drawPerson(renderer: Renderer): void;

  /** Things drawn with the person: item offers, prices. Also skipped on flicker frames. */
  protected drawWares(_renderer: Renderer): void {}

  override render(renderer: Renderer, _enemySheet?: SpriteSheet): void {
    if (!this.isActive) return;
    // State 4 / Grumble state 3: drawn only every other frame while leaving.
    if (this._flicker && (this._frame & 1) !== 0) return;
    this.drawPerson(renderer);
    this.drawWares(renderer);
  }
}
