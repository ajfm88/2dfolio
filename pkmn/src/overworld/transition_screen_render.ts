import { captureNative, captureSpriteDraws, getCtx, getScale, getActivePalette, getPaletteColors } from '../renderer';
import { applyBgShades } from '../renderer/palette_shades';
import type { ShadePalette } from '../renderer/palette_shades';
import { TransitionScreen, TRANSITION_BLACK, TRANSITION_BLANK } from './transition_screen';
import type { TransitionSpriteSlot } from './battle_transition_choice';

export interface TransitionActor {
  render(cameraX: number, cameraY: number): void;
  /** Original grayscale art, preloaded before capture, never an OBP-colourized canvas. */
  rawSheet: ImageData;
  objectPalette?: 'obp0' | 'obp1';
  palette?: ShadePalette;
}
export interface FrozenTransitionSprite {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly indices: Uint8Array;
  readonly objectPalette: 'obp0' | 'obp1';
  readonly palette: ShadePalette;
}
export interface TransitionCapture {
  readonly view: HTMLCanvasElement;
  readonly palette: ShadePalette;
  readonly slots: readonly TransitionSpriteSlot[];
  readonly sprites: readonly FrozenTransitionSprite[];
}

/** Exactly GameMap.render: no copy of the main canvas, objects, grass-over-OBJ, UI or overlays.
 * The 360 origin IDs address 8×8 crops of this 20-column canvas, including origin ID 255. */
export function captureTransitionMap(map: { render(x: number, y: number): void }, cameraX: number, cameraY: number): HTMLCanvasElement {
  return captureNative(() => map.render(cameraX, cameraY));
}

/** Build the cartridge slot table and freeze pre-clear frames at their current screen positions.
 * The caller supplies raw sheets and renders only these actors; this function never updates them.
 * Script aliases may occupy an existing slot: the visible alias wins over its hidden base object. */
export function captureTransitionScene(
  map: { render(x: number, y: number): void }, cameraX: number, cameraY: number,
  actors: { player: TransitionActor; npcs: readonly (TransitionActor & { data: { textId?: number } })[]; pikachu?: TransitionActor },
  objectCount = 0,
): TransitionCapture {
  const palette = getPaletteColors(getActivePalette());
  const view = captureTransitionMap(map, cameraX, cameraY);
  const slots = new Map<number, TransitionSpriteSlot>();
  const sprites = new Map<number, FrozenTransitionSprite>();
  const capture = (slot: number, actor: TransitionActor): void => {
    let draws: ReturnType<typeof captureSpriteDraws> = [];
    captureNative(() => { draws = captureSpriteDraws(() => actor.render(cameraX, cameraY)); });
    if (draws.length > 1) throw new Error(`Transition slot ${slot}: expected one 16×16 frame`);
    if (!draws.length) {
      if (!slots.has(slot)) slots.set(slot, { slot, occupied: true, visible: false });
      return;
    }
    if (sprites.has(slot)) throw new Error(`Transition slot ${slot}: two visible objects`);
    const draw = draws[0], raw = actor.rawSheet, indices = new Uint8Array(256);
    if (draw.frameX < 0 || draw.frameY < 0 || draw.frameX + 16 > raw.width || draw.frameY + 16 > raw.height)
      throw new Error(`Transition slot ${slot}: frame outside raw sheet`);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const sx = draw.frameX + (draw.flipX ? 15 - x : x);
      const offset = ((draw.frameY + y) * raw.width + sx) * 4;
      const gray = raw.data[offset];
      indices[y * 16 + x] = raw.data[offset + 3] === 0 ? 0 : gray >= 192 ? 0 : gray >= 128 ? 1 : gray >= 64 ? 2 : 3;
    }
    slots.set(slot, { slot, occupied: true, visible: true });
    sprites.set(slot, { slot, x: draw.destX, y: draw.destY, indices,
      objectPalette: actor.objectPalette ?? 'obp0', palette: (actor.palette ?? palette).map(colour => [...colour] as [number, number, number]) });
  };
  capture(0, actors.player);
  for (const npc of actors.npcs) {
    const slot = npc.data.textId;
    if (slot === undefined || slot < 1 || slot > 14) throw new Error('Transition NPC needs a cartridge object slot (textId 1–14)');
    capture(slot, npc);
  }
  // Missing ROM objects are hidden ($ff), unlike unused zero-filled slots past
  // the object count. In particular Route22's unimplemented rivals still exist.
  for (let slot = 1; slot <= objectCount; slot++) {
    if (!slots.has(slot)) slots.set(slot, { slot, occupied: true, visible: false });
  }
  if (actors.pikachu) capture(15, actors.pikachu);
  return { view, palette, slots: [...slots.values()].sort((a, b) => a.slot - b.slot), sprites: [...sprites.values()] };
}

const spriteCanvases = new WeakMap<FrozenTransitionSprite, Map<number, HTMLCanvasElement>>();
function objectCanvas(sprite: FrozenTransitionSprite, register: number): HTMLCanvasElement {
  let cache = spriteCanvases.get(sprite);
  if (!cache) { cache = new Map(); spriteCanvases.set(sprite, cache); }
  const cached = cache.get(register);
  if (cached) return cached;
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < 256; i++) {
    const index = sprite.indices[i];
    if (index === 0) continue; // transparency is source colour zero, not mapped shade zero
    pixels.set([...sprite.palette[(register >> (index * 2)) & 3], 255], i * 4);
  }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, 16, 16), 0, 0);
  cache.set(register, canvas);
  return canvas;
}

/** Window cells -> BGP shades -> frozen OBJ through their own registers. No CPU/VBlank work. */
export function renderTransitionScreen(screen: TransitionScreen, capture: TransitionCapture): void {
  const ctx = getCtx(), scale = getScale();
  const fill = (colour: readonly number[], x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = `rgb(${colour.join(',')})`; ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
  };
  if (screen.black) { fill(capture.palette[3], 0, 0, 160, 144); return; }
  if (screen.windowY === 0x90) ctx.drawImage(capture.view, 0, 0, 160 * scale, 144 * scale);
  else screen.visibleCells.forEach((cell, i) => {
    const x = i % 20 * 8, y = Math.floor(i / 20) * 8;
    if (cell === TRANSITION_BLACK || cell === TRANSITION_BLANK) fill(capture.palette[cell === TRANSITION_BLACK ? 3 : 0], x, y, 8, 8);
    else ctx.drawImage(capture.view, cell % 20 * 8, Math.floor(cell / 20) * 8, 8, 8, x * scale, y * scale, 8 * scale, 8 * scale);
  });
  applyBgShades(ctx, screen.bgp, capture.palette);
  // GB OAM priority: lower block wins, so paint higher blocks first.
  for (const slot of [...screen.visibleSprites].reverse()) {
    const sprite = capture.sprites.find(candidate => candidate.slot === slot);
    if (sprite) ctx.drawImage(objectCanvas(sprite, screen[sprite.objectPalette]), sprite.x * scale, sprite.y * scale, 16 * scale, 16 * scale);
  }
}
