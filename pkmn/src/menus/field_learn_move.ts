// Field-owned adapter for the cartridge LearnMove program. The caller drives exactly one frame.
import { BattleState } from '../battle/battle_state';
import { D } from '../battle/battle_end_state';
import { encodePartyMon, decodePartyMon, partyRecordToPokemon } from '../battle/battle_party_codec';
import { worldPartyRecord } from '../battle/battle_bridge';
import { copyMoveNameToStringBuffer, getMoveName } from '../battle/battle_move_data';
import { learnMove, type LearnMoveHost } from '../battle/learn_move';
import { BattleAudio, type BattleSfx } from '../battle/battle_audio';
import type { BattlePokemon } from '../battle/types';
import type { Program } from '../battle/battle_menu_context';
import { getBattleAudioEngines, loadSfx } from '../audio';
import { SFX_IDS } from '../audio/sound_ids';
import { charToTile } from '../text/charmap';
import { textBgTransfer } from '../text/bg_transfer';
import type { TextBox, TextBoxScreen } from '../text/textbox';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';
import { ScreenTiles, type ScreenTileSnapshot } from './screen_tiles';
import type { TileCell, TileSurface } from './tile_surface';
import { drawScreenTile } from './menu_render';
import { TILE_SIZE } from '../core';

// displayTwoOptionMenu saves tile IDs to WRAM; restore those IDs to field glyphs.
const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789():;[]é\'?!.-/,' + '▷▶▼♂¥×♀';
const decoded = new Map<number, string>([[0x7f, ' '], [0x79, '┌'], [0x7a, '─'], [0x7b, '┐'], [0x7c, '│'], [0x7d, '└'], [0x7e, '┘']]);
for (const glyph of glyphs) { const tile = charToTile(glyph); if (tile >= 0) decoded.set(tile + 0x80, glyph); }

export interface FieldLearnMoveOptions {
  textBox: TextBox;
  audio: Pick<BattleAudio, 'playSwap'>;
  swapSound: BattleSfx;
  readJoypad(): void;
  pressSound(): void;
}

/** Borrow the existing field engines while the adapter is active. */
export async function createFieldLearnMove(mon: BattlePokemon, moveId: number,
  options: Omit<FieldLearnMoveOptions, 'audio' | 'swapSound'>): Promise<FieldLearnMove> {
  const data = await loadSfx('swap');
  if (!data) throw new Error('field LearnMove swap sound missing');
  const owners = getBattleAudioEngines();
  const audio = new BattleAudio(owners.sfx, owners.music, owners.banks);
  try {
    return new FieldLearnMove(mon, moveId, { ...options, audio, swapSound: { id: SFX_IDS.swap, data } }, () => audio.dispose());
  } catch (error) { audio.dispose(); throw error; }
}

/** Does not mutate the live mon until the shared program returns success. */
export class FieldLearnMove {
  readonly tiles = new ScreenTiles();
  readonly state = new BattleState();
  private readonly program: Program<{ b: 0 | 1 }>;
  private snapshot: { tiles: ScreenTileSnapshot; text: TextBoxScreen | null } | null = null;
  private done: { b: 0 | 1 } | null = null;
  private disposed = false;
  private readonly surface: TileSurface;
  private optionTiles = new Map<string, string | null>();
  get result(): { b: 0 | 1 } | null { return this.done; }
  get ownsTextBox(): boolean { return this.options.textBox.active; }

  /** Abort or release borrowed audio hooks; safe after the normal completion path. */
  dispose(): void {
    if (!this.disposed) { this.disposed = true; this.releaseAudio(); }
  }

  constructor(private readonly mon: BattlePokemon, moveId: number, private readonly options: FieldLearnMoveOptions,
    private readonly releaseAudio: () => void = () => {}) {
    const state = this.state;
    encodePartyMon(state, 0, worldPartyRecord(mon));
    state.wWhichPokemon = 0; state.wIsInBattle = 0;
    state.mem[D.wMoveNum] = state.wNamedObjectIndex = moveId;
    getMoveName(state); copyMoveNameToStringBuffer(state);
    this.surface = {
      at: (x, y) => {
        // DisplayTwoOptionMenu saves this exact rectangle before drawing over it.
        if (x === 14 && y === 7) {
          this.optionTiles.clear();
          for (let row = 7; row < 12; row++) for (let col = 14; col < 20; col++)
            this.optionTiles.set(`${col},${row}`, this.tiles.at(col, row));
        }
        return this.tiles.at(x, y);
      },
      put: (x, y, value: TileCell) => {
        const key = `${x},${y}`;
        if (typeof value === 'number' && this.optionTiles.has(key)) {
          this.tiles.put(x, y, this.optionTiles.get(key)!); this.optionTiles.delete(key);
        } else this.tiles.put(x, y, typeof value === 'number' ? decoded.get(value) ?? ' ' : value);
      },
    };
    const host: LearnMoveHost = {
      tiles: this.surface, audio: options.audio, swapSound: options.swapSound,
      readJoypad: options.readJoypad, pressSound: options.pressSound, updateSprites: () => {},
      printText: (label, bindings, opts) => this.printText(label, bindings, opts),
      saveScreenTilesToBuffer1: () => { this.snapshot = { tiles: this.tiles.saveTiles(),
        text: options.textBox.active ? options.textBox.saveScreen() : null }; },
      loadScreenTilesFromBuffer1: () => {
        if (!this.snapshot) throw new Error('field LearnMove screen not saved');
        textBgTransfer.enabled = false; this.tiles.restoreTiles(this.snapshot.tiles);
        if (this.snapshot.text && options.textBox.active) options.textBox.restoreScreen(this.snapshot.text);
        textBgTransfer.enabled = true;
      },
    };
    this.program = learnMove(state, host);
  }

  private *printText(label: string, bindings?: TextBindings, options?: TextRunnerOptions): Program {
    const box = this.options.textBox;
    box.printStandalone({ program: label }, { bindings, ...options });
    while (!box.isComplete) yield 'serviced';
  }

  /** Owns one text/BG tick and at most the one generator joypad read. */
  frame(): { b: 0 | 1 } | null {
    if (this.done) return this.done;
    if (this.disposed) throw new Error('field LearnMove adapter disposed');
    const third = textBgTransfer.nextPortion, enabled = textBgTransfer.enabled;
    if (this.options.textBox.active) {
      if (this.options.textBox.isComplete) this.options.textBox.updateDisplay();
      else this.options.textBox.update();
      if (enabled) this.tiles.copyShownThird(third);
    } else this.tiles.present(textBgTransfer);
    let next: IteratorResult<import('../battle/battle_menu_context').Frame, { b: 0 | 1 }>;
    try { next = this.program.next(); } catch (error) { this.dispose(); throw error; }
    if (next.done) {
      this.done = next.value;
      if (next.value.b === 1) this.mon.moves = partyRecordToPokemon(decodePartyMon(this.state, 0)).moves;
      this.dispose();
    } else if (next.value !== 'serviced') throw new Error(`unsupported field LearnMove frame ${next.value}`);
    return this.done;
  }

  /** Overlay after the party screen; render TextBox separately after this layer. */
  render(): void {
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
      const tile = this.tiles.visibleAt(x, y);
      if (tile !== null) drawScreenTile(tile, x * TILE_SIZE, y * TILE_SIZE);
    }
  }
}
