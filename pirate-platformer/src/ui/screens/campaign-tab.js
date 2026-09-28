import { el } from '../dom.js';
import { formatTime } from '../format.js';
import { openShareDialog } from '../components/share-dialog.js';

/** @typedef {import('../../storage/progress.js').LevelProgress} LevelProgress */
/** @typedef {import('./level-select.js').TabView} TabView */
/** @typedef {import('./level-select.js').ShowDialog} ShowDialog */

/**
 * The Campaign tab: the bundled levels in play order, each with the player's best
 * run. A campaign level is never changed; Edit a copy puts one in My Levels.
 *
 * @param {HTMLElement} grid
 * @param {{
 *   root: HTMLElement,
 *   show: ShowDialog,
 *   campaign: { id: string, name: string }[],
 *   getProgress: (id: string) => LevelProgress | null,
 *   onPlay: (index: number) => void,
 *   onEditCopy: (index: number) => void,
 *   shareCode: (index: number) => Promise<string>,
 * }} ctx
 * @returns {TabView}
 */
export function createCampaignTab(grid, ctx) {
  /**
   * @param {{ id: string, name: string }} entry
   * @param {number} index
   */
  function card(entry, index) {
    const progress = ctx.getProgress(entry.id);
    const done = progress !== null && progress.done;
    /** @type {HTMLElement[]} */
    const meta = [el('p', {
      class: 'level-card__meta',
      text: `Level ${index + 1} · ${done ? 'Done' : 'Not finished yet'}`,
    })];
    if (progress !== null && done) {
      meta.push(el('p', {
        class: 'level-card__meta',
        text: `Best ${formatTime(progress.bestTimeMs)} · ${progress.bestTreasure} treasure`,
      }));
    }
    return el('article', { class: 'panel panel--paper level-card' }, [
      el('h2', { class: 'level-card__name', text: entry.name, attrs: { title: entry.name } }),
      ...meta,
      el('div', { class: 'level-card__actions' }, [
        el('button', {
          class: 'btn',
          text: 'Play',
          attrs: { type: 'button', 'aria-label': `Play ${entry.name}` },
          on: { click: () => ctx.onPlay(index) },
        }),
        el('button', {
          class: 'btn',
          text: 'Share',
          attrs: { type: 'button', 'aria-label': `Share ${entry.name}` },
          on: {
            click: () => ctx.show(() => openShareDialog(ctx.root, { code: ctx.shareCode(index) })),
          },
        }),
        el('button', {
          class: 'btn',
          text: 'Edit a copy',
          attrs: { type: 'button', 'aria-label': `Edit a copy of ${entry.name}` },
          on: { click: () => ctx.onEditCopy(index) },
        }),
      ]),
    ]);
  }

  for (let i = 0; i < ctx.campaign.length; i++) grid.append(card(ctx.campaign[i], i));

  return {
    actions: [],
    destroy() {},
  };
}
