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
 * `initial` restores the palette after a test-play. It does not call `onSelect` —
 * the scene has already restored its own tool state from the same session.
 *
 * @param {HTMLElement} root
 * @param {{
 *   atlas: Atlas,
 *   onSelect: (entry: PaletteEntry | null, erasing: boolean) => void,
 *   initial?: { group: string, toolId: string | null, erasing: boolean },
 * }} opts
 */
export function createMakerPalette(root, opts) {
  /** @type {PaletteEntry | null} */
  let selected = null;
  let erasing = false;
  let activeGroup = '';

  /** @type {Map<string, HTMLButtonElement[]>} */
  const groupButtons = new Map();
  /** @type {Map<string, HTMLButtonElement>} */
  const tabButtons = new Map();
  /** @type {string[]} */
  const visibleGroups = [];

  const tabs = el('div', { class: 'maker-palette__tabs' });
  const strip = el('div', { class: 'maker-palette__strip' });

  for (let g = 0; g < PALETTE_ORDER.length; g++) {
    const groupId = PALETTE_ORDER[g];
    const entries = paletteEntries.filter((e) => e.group === groupId);
    if (entries.length === 0) continue;

    visibleGroups.push(groupId);

    const btns = [];
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
      btns.push(btn);
    }
    groupButtons.set(groupId, btns);

    const tab = /** @type {HTMLButtonElement} */ (el('button', {
      class: 'maker-palette__tab',
      text: GROUP_LABELS[groupId] ?? groupId,
      attrs: { type: 'button', 'data-group': groupId },
    }));
    tabButtons.set(groupId, tab);
    tabs.append(tab);
  }

  const eraser = /** @type {HTMLButtonElement} */ (el(
    'button',
    {
      class: 'maker-palette__item maker-palette__item--eraser',
      attrs: { type: 'button', 'aria-label': 'Eraser', title: 'Eraser' },
    },
    [el('span', { class: 'maker-palette__eraser-mark', attrs: { 'aria-hidden': 'true' } })],
  ));

  const bar = el('div', { class: 'maker-palette' }, [tabs, strip]);
  root.append(bar);

  /**
   * @param {string} groupId
   */
  function switchTab(groupId) {
    if (groupId === activeGroup) return;
    activeGroup = groupId;

    tabButtons.forEach((tab, id) => {
      tab.classList.toggle('maker-palette__tab--active', id === groupId);
    });

    while (strip.firstChild) strip.removeChild(strip.firstChild);
    const btns = groupButtons.get(groupId);
    if (btns) {
      for (let i = 0; i < btns.length; i++) strip.append(btns[i]);
    }
    strip.append(eraser);
    strip.scrollLeft = 0;

    paintSelected();
  }

  function paintSelected() {
    groupButtons.forEach((btns) => {
      for (let i = 0; i < btns.length; i++) {
        const btn = btns[i];
        const on = !erasing && selected !== null && btn.dataset.id === selected.id;
        btn.classList.toggle('maker-palette__item--selected', on);
      }
    });
    eraser.classList.toggle('maker-palette__item--selected', erasing);
  }

  /**
   * @param {Event} e
   */
  function onTabClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest('.maker-palette__tab');
    if (!(tab instanceof HTMLButtonElement)) return;
    const groupId = tab.dataset.group;
    if (groupId) switchTab(groupId);
  }

  /**
   * @param {Event} e
   */
  function onStripClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('.maker-palette__item');
    if (!(btn instanceof HTMLButtonElement) || !strip.contains(btn)) return;

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

  tabs.addEventListener('click', onTabClick);
  strip.addEventListener('click', onStripClick);

  const initial = opts.initial;
  if (initial) {
    selected = initial.toolId ? byId(initial.toolId) ?? null : null;
    erasing = initial.erasing;
  }
  const firstGroup = initial && visibleGroups.includes(initial.group)
    ? initial.group
    : visibleGroups[0];
  if (firstGroup) switchTab(firstGroup);

  return {
    getSelectedEntry() {
      return selected;
    },
    isErasing() {
      return erasing;
    },
    getGroup() {
      return activeGroup;
    },
    /**
     * @param {string} id
     */
    selectById(id) {
      const entry = byId(id);
      if (!entry) return;
      selected = entry;
      erasing = false;
      opts.onSelect(entry, false);

      if (entry.group !== activeGroup) {
        switchTab(entry.group);
      } else {
        paintSelected();
      }
    },
    destroy() {
      tabs.removeEventListener('click', onTabClick);
      strip.removeEventListener('click', onStripClick);
      bar.remove();
    },
  };
}
