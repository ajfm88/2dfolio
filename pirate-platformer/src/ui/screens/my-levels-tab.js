import { toJsonString } from '../../level/codec.js';
import { LevelError } from '../../level/schema.js';
import { ImportError, readLevelText } from '../../maker/import-level.js';
import { clear, el, hasFinePointer } from '../dom.js';
import { downloadText, fileNameFor } from '../files.js';
import { openConfirm, openDialog } from '../components/dialog.js';
import { openImportDialog } from '../components/import-dialog.js';
import { openRenameDialog } from '../components/rename-dialog.js';
import { openShareDialog } from '../components/share-dialog.js';

/** @typedef {ReturnType<typeof import('../../storage/levels.js').createLevelStore>} LevelStore */
/** @typedef {import('../../storage/levels.js').LevelSummary} LevelSummary */
/** @typedef {import('../../storage/levels.js').SaveResult} SaveResult */
/** @typedef {import('./level-select.js').TabView} TabView */
/** @typedef {import('./level-select.js').ShowDialog} ShowDialog */

const UNTITLED = 'Untitled level';

/**
 * @param {string} name
 */
function displayName(name) {
  return name.length > 0 ? name : UNTITLED;
}

/**
 * @param {number} ms
 */
function editedOn(ms) {
  const date = new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `Edited ${date}`;
}

/**
 * @param {unknown} err
 */
function reasonOf(err) {
  if (err instanceof LevelError) return err.message;
  throw err;
}

/**
 * The My Levels tab: every saved level, newest first, with the actions that manage
 * them. It renders into level select's grid, and its Import and New Level join the
 * header while it shows.
 *
 * @param {HTMLElement} grid
 * @param {{
 *   root: HTMLElement,
 *   levels: LevelStore,
 *   show: ShowDialog,
 *   syncNotice: () => void,
 *   onNew: () => void,
 *   onPlay: (id: string) => void,
 *   onEdit: (id: string) => void,
 *   report: (result: SaveResult) => void,
 *   toast: (text: string) => void,
 * }} ctx
 * @returns {TabView}
 */
export function createMyLevelsTab(grid, ctx) {
  const { levels, root, show } = ctx;
  let destroyed = false;
  let renderToken = 0;

  const actions = [
    el('button', {
      class: 'btn',
      text: 'Import',
      attrs: { type: 'button' },
      on: { click: () => show(openImport) },
    }),
    el('button', {
      class: 'btn btn--primary',
      text: 'New Level',
      attrs: { type: 'button' },
      on: { click: () => ctx.onNew() },
    }),
  ];

  function openImport() {
    return openImportDialog(root, {
      allowFile: hasFinePointer(),
      async onImport(text) {
        let model;
        try {
          model = await readLevelText(text);
        } catch (err) {
          if (err instanceof ImportError) return err.message;
          throw err;
        }
        const result = await levels.add(model);
        ctx.report(result);
        if (!result.ok) return "The level couldn't be saved.";
        ctx.toast(`Imported "${displayName(model.name)}".`);
        refresh();
        return null;
      },
    });
  }

  /**
   * @param {LevelSummary} entry
   */
  function openOptions(entry) {
    const name = displayName(entry.name);
    /** @type {import('../components/dialog.js').DialogAction[]} */
    const options = [
      { label: 'Rename', onClick: () => show(() => openRename(entry)) },
      { label: 'Duplicate', onClick: () => duplicate(entry) },
    ];
    if (hasFinePointer()) options.push({ label: 'Export file', onClick: () => exportFile(entry) });
    options.push(
      { label: 'Delete', onClick: () => show(() => confirmDelete(entry)) },
      { label: 'Cancel', focus: true },
    );
    return openDialog(root, { title: name, actions: options, stackActions: true });
  }

  /**
   * @param {LevelSummary} entry
   */
  function openRename(entry) {
    return openRenameDialog(root, {
      name: entry.name,
      onRename(name) {
        levels.rename(entry.id, name).then((result) => {
          ctx.report(result);
          refresh();
        }, (err) => ctx.toast(`Couldn't rename (${reasonOf(err)}).`));
      },
    });
  }

  /**
   * @param {LevelSummary} entry
   */
  function duplicate(entry) {
    levels.duplicate(entry.id, `${displayName(entry.name)} (copy)`).then((result) => {
      ctx.report(result);
      refresh();
    }, (err) => ctx.toast(`Couldn't duplicate (${reasonOf(err)}).`));
  }

  /**
   * @param {LevelSummary} entry
   */
  function exportFile(entry) {
    levels.load(entry.id).then((model) => {
      downloadText(fileNameFor(model.name, entry.id), toJsonString(model));
    }, (err) => ctx.toast(`Couldn't export (${reasonOf(err)}).`));
  }

  /**
   * @param {LevelSummary} entry
   */
  function confirmDelete(entry) {
    return openConfirm(root, {
      title: 'Delete level?',
      text: `"${displayName(entry.name)}" will be gone for good.`,
      confirmLabel: 'Delete',
      onConfirm() {
        levels.remove(entry.id);
        refresh();
      },
    });
  }

  /**
   * @param {LevelSummary} entry
   */
  function share(entry) {
    const code = levels.getCode(entry.id);
    show(() => openShareDialog(root, {
      code: code === null
        ? Promise.reject(new Error("This level couldn't be found."))
        : Promise.resolve(code),
    }));
  }

  /**
   * @param {LevelSummary} entry
   */
  function card(entry) {
    const name = displayName(entry.name);
    return el('article', { class: 'panel panel--paper level-card' }, [
      el('h2', { class: 'level-card__name', text: name, attrs: { title: name } }),
      el('p', {
        class: 'level-card__meta',
        text: `${entry.cols} × ${entry.rows} · ${editedOn(entry.modified)}`,
      }),
      el('div', { class: 'level-card__actions' }, [
        el('button', {
          class: 'btn',
          text: 'Play',
          attrs: { type: 'button', 'aria-label': `Play ${name}` },
          on: { click: () => ctx.onPlay(entry.id) },
        }),
        el('button', {
          class: 'btn',
          text: 'Edit',
          attrs: { type: 'button', 'aria-label': `Edit ${name}` },
          on: { click: () => ctx.onEdit(entry.id) },
        }),
        el('button', {
          class: 'btn',
          text: 'Share',
          attrs: { type: 'button', 'aria-label': `Share ${name}` },
          on: { click: () => share(entry) },
        }),
        el('button', {
          class: 'btn level-card__more',
          text: '⋯',
          attrs: { type: 'button', 'aria-label': `More actions for ${name}`, title: 'More' },
          on: { click: () => show(() => openOptions(entry)) },
        }),
      ]),
    ]);
  }

  async function refresh() {
    const token = ++renderToken;
    const entries = await levels.list();
    // A slower, older refresh must not overwrite a newer one, or a tab shown since.
    if (destroyed || token !== renderToken) return;
    // A write that failed on the way here may have moved storage into memory.
    ctx.syncNotice();
    clear(grid);
    if (entries.length === 0) {
      grid.append(el('p', {
        class: 'panel panel--paper level-select__empty',
        text: 'No levels yet. Press New Level to build one.',
      }));
      return;
    }
    for (let i = 0; i < entries.length; i++) grid.append(card(entries[i]));
  }

  refresh();

  return {
    actions,
    destroy() {
      destroyed = true;
    },
  };
}
