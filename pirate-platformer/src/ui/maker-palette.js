import './styles/maker-palette.css';

import { TILE } from '../settings.js';
import { el } from './dom.js';
import { palette as paletteEntries, PALETTE_ORDER, byId } from '../data/palette.js';

/** @typedef {import('../data/palette.js').PaletteEntry} PaletteEntry */
/** @typedef {Awaited<ReturnType<import('../core/atlas.js').loadAtlas>>} Atlas */

/** @type {Record<string, string>} */
const GROUP_LABELS = {
  terrain: 'Terrain',
  platforms: 'Platforms',
  water: 'Water',
  treasure: 'Treasure',
  enemies: 'Enemies',
  hazards: 'Hazards',
  decor: 'Decor',
  markers: 'Markers',
};

const ICON_BOX = 64;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Atlas} atlas
 * @param {PaletteEntry} entry
 */
function drawPaletteIcon(canvas, atlas, entry) {
  const clip = atlas.get(entry.icon);
  let sx = 0;
  let sy = 0;
  let sw = clip.fw;
  let sh = clip.fh;
  if (entry.placement === 'tile' && clip.fw >= 17 * TILE && clip.fh >= 5 * TILE) {
    // Isolated "single" cell of the 4-neighbour blob sheet (mask 0 at col 4, row 4).
    // The fill cell (1,1) is dark interior rock and reads as a black square at icon size.
    sx = 4 * TILE;
    sy = 4 * TILE;
    sw = TILE;
    sh = TILE;
  } else if (entry.placement === 'tile') {
    sx = 0;
    sy = 0;
    sw = Math.min(clip.fw, TILE);
    sh = Math.min(clip.fh, TILE);
  }
  canvas.width = ICON_BOX;
  canvas.height = ICON_BOX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(2, ICON_BOX / sw, ICON_BOX / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = Math.round((ICON_BOX - dw) / 2);
  const dy = Math.round((ICON_BOX - dh) / 2);
  ctx.drawImage(clip.image, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   atlas: Atlas,
 *   onSelect: (entry: PaletteEntry | null, erasing: boolean) => void,
 * }} opts
 */
export function createMakerPalette(root, opts) {
  /** @type {PaletteEntry | null} */
  let selected = null;
  let erasing = false;

  /** @type {HTMLButtonElement[]} */
  const buttons = [];

  const groups = el('div', { class: 'maker-palette__groups' });

  for (let g = 0; g < PALETTE_ORDER.length; g++) {
    const groupId = PALETTE_ORDER[g];
    const entries = paletteEntries.filter((e) => e.group === groupId);
    if (entries.length === 0) continue;

    const row = el('div', { class: 'maker-palette__row' });
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const icon = /** @type {HTMLCanvasElement} */ (el('canvas', {
        class: 'maker-palette__icon',
        attrs: { 'aria-hidden': 'true' },
      }));
      drawPaletteIcon(icon, opts.atlas, entry);
      const btn = /** @type {HTMLButtonElement} */ (el(
        'button',
        {
          class: 'maker-palette__item',
          attrs: {
            type: 'button',
            'data-id': entry.id,
            'aria-label': entry.label,
            title: entry.label,
          },
        },
        [icon],
      ));
      buttons.push(btn);
      row.append(btn);
    }

    groups.append(el('div', { class: 'maker-palette__group' }, [
      el('span', {
        class: 'maker-palette__group-label',
        text: GROUP_LABELS[groupId] ?? groupId,
      }),
      row,
    ]));
  }

  const eraser = /** @type {HTMLButtonElement} */ (el(
    'button',
    {
      class: 'maker-palette__item maker-palette__item--eraser',
      attrs: { type: 'button', 'aria-label': 'Eraser', title: 'Eraser' },
    },
    [el('span', { class: 'maker-palette__eraser-mark', attrs: { 'aria-hidden': 'true' } })],
  ));
  buttons.push(eraser);
  groups.append(
    el('div', { class: 'maker-palette__group' }, [
      el('span', { class: 'maker-palette__group-label', text: 'Erase' }),
      el('div', { class: 'maker-palette__row' }, [eraser]),
    ]),
  );

  const bar = el('div', { class: 'maker-palette' }, [groups]);
  root.append(bar);

  function paintSelected() {
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const isEraser = btn.classList.contains('maker-palette__item--eraser');
      const on = isEraser ? erasing : (!erasing && selected !== null && btn.dataset.id === selected.id);
      btn.classList.toggle('maker-palette__item--selected', on);
    }
  }

  /**
   * @param {Event} e
   */
  function onClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('.maker-palette__item');
    if (!(btn instanceof HTMLButtonElement) || !bar.contains(btn)) return;

    if (btn.classList.contains('maker-palette__item--eraser')) {
      if (erasing) {
        erasing = false;
        selected = null;
        opts.onSelect(null, false);
      } else {
        erasing = true;
        selected = null;
        opts.onSelect(null, true);
      }
      paintSelected();
      return;
    }

    const id = btn.dataset.id;
    if (!id) return;
    const entry = byId(id);
    if (!entry) return;

    if (!erasing && selected && selected.id === entry.id) {
      selected = null;
      erasing = false;
      opts.onSelect(null, false);
    } else {
      selected = entry;
      erasing = false;
      opts.onSelect(entry, false);
    }
    paintSelected();
  }

  bar.addEventListener('click', onClick);

  return {
    getSelectedEntry() {
      return selected;
    },
    isErasing() {
      return erasing;
    },
    destroy() {
      bar.removeEventListener('click', onClick);
      bar.remove();
    },
  };
}
