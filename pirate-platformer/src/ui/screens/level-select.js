import '../styles/level-select.css';

import { clear, el } from '../dom.js';
import { createCampaignTab } from './campaign-tab.js';
import { createMyLevelsTab } from './my-levels-tab.js';

/** @typedef {ReturnType<typeof import('../../storage/levels.js').createLevelStore>} LevelStore */
/** @typedef {import('../../storage/levels.js').SaveResult} SaveResult */
/** @typedef {import('../../storage/progress.js').LevelProgress} LevelProgress */
/** @typedef {import('../../storage/safe-storage.js').StorageMode} StorageMode */

/**
 * @typedef {'campaign' | 'mine'} LevelSelectTab
 *
 * What a tab hands the shell: the buttons it adds to the header while it shows.
 * @typedef {{ actions: HTMLElement[], destroy: () => void }} TabView
 *
 * One dialog at a time for the whole screen, closed when the tab or screen goes.
 * @typedef {(open: () => { close: () => void }) => void} ShowDialog
 */

const MEMORY_NOTICE =
  "Saving isn't available in this browser window. Levels and progress will be lost when it closes.";

/** @type {{ tab: LevelSelectTab, label: string }[]} */
const TABS = [
  { tab: 'campaign', label: 'Campaign' },
  { tab: 'mine', label: 'My Levels' },
];

/**
 * Level select: the Campaign and My Levels tabs under one header. A DOM screen, not
 * a scene; the canvas behind it only paints the sky.
 *
 * @param {HTMLElement} root
 * @param {{
 *   tab: LevelSelectTab,
 *   campaign: { id: string, name: string }[],
 *   getProgress: (id: string) => LevelProgress | null,
 *   levels: LevelStore,
 *   storageMode: () => StorageMode,
 *   onBack: () => void,
 *   onPlayCampaign: (index: number) => void,
 *   onEditCampaignCopy: (index: number) => void,
 *   shareCampaign: (index: number) => Promise<string>,
 *   onNew: () => void,
 *   onPlay: (id: string) => void,
 *   onEdit: (id: string) => void,
 *   openSettings: (root: HTMLElement) => { close: () => void },
 *   report: (result: SaveResult) => void,
 *   toast: (text: string) => void,
 * }} opts
 * @returns {{ destroy: () => void }}
 */
export function createLevelSelectScreen(root, opts) {
  /** @type {{ close: () => void } | null} */
  let dialog = null;
  /** @type {TabView | null} */
  let view = null;
  /** @type {LevelSelectTab} */
  let tab = opts.tab;

  /** @type {ShowDialog} */
  function show(open) {
    if (dialog) dialog.close();
    dialog = open();
  }

  function closeDialog() {
    if (dialog) dialog.close();
    dialog = null;
  }

  const notice = el('p', { class: 'panel panel--paper level-select__notice', text: MEMORY_NOTICE });
  const grid = el('div', { class: 'level-select__grid' });
  const tabActions = el('div', { class: 'level-select__tab-actions' });

  function syncNotice() {
    notice.hidden = opts.storageMode() !== 'memory';
  }

  const tabButtons = TABS.map((t) => el('button', {
    class: 'btn level-select__tab',
    text: t.label,
    attrs: { type: 'button', role: 'tab', 'aria-selected': 'false' },
    on: { click: () => setTab(t.tab) },
  }));

  const header = el('header', { class: 'panel panel--paper level-select__header' }, [
    el('div', { class: 'level-select__nav' }, [
      el('button', {
        class: 'btn',
        text: 'Back',
        attrs: { type: 'button' },
        on: { click: () => opts.onBack() },
      }),
      el('div', {
        class: 'level-select__tabs',
        attrs: { role: 'tablist', 'aria-label': 'Levels' },
      }, tabButtons),
    ]),
    el('div', { class: 'level-select__actions' }, [
      el('button', {
        class: 'btn',
        text: 'Settings',
        attrs: { type: 'button' },
        on: { click: () => show(() => opts.openSettings(root)) },
      }),
      tabActions,
    ]),
  ]);

  const screen = el('section', { class: 'level-select', attrs: { 'aria-label': 'Level select' } }, [
    header,
    notice,
    grid,
  ]);
  root.append(screen);

  /**
   * @param {LevelSelectTab} next
   */
  function setTab(next) {
    if (view && next === tab) return;
    closeDialog();
    if (view) view.destroy();
    tab = next;
    for (let i = 0; i < TABS.length; i++) {
      tabButtons[i].setAttribute('aria-selected', String(TABS[i].tab === tab));
    }
    clear(grid);
    clear(tabActions);
    view = tab === 'campaign'
      ? createCampaignTab(grid, {
        root,
        show,
        campaign: opts.campaign,
        getProgress: opts.getProgress,
        onPlay: opts.onPlayCampaign,
        onEditCopy: opts.onEditCampaignCopy,
        shareCode: opts.shareCampaign,
      })
      : createMyLevelsTab(grid, {
        root,
        levels: opts.levels,
        show,
        syncNotice,
        onNew: opts.onNew,
        onPlay: opts.onPlay,
        onEdit: opts.onEdit,
        report: opts.report,
        toast: opts.toast,
      });
    tabActions.append(...view.actions);
    syncNotice();
    screen.scrollTop = 0;
  }

  setTab(tab);

  return {
    destroy() {
      closeDialog();
      if (view) view.destroy();
      view = null;
      screen.remove();
    },
  };
}
