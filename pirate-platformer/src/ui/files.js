/**
 * Level files on devices with a fine pointer: download a `.json`, name it.
 */

const FILE_NAME_MAX = 40;

/**
 * A file name from the level's name: lowercase words joined by dashes, falling back
 * to the id when nothing usable is left.
 *
 * @param {string} name
 * @param {string} id
 * @returns {string}
 */
export function fileNameFor(name, id) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, FILE_NAME_MAX)
    .replace(/-+$/, '');
  return `${slug || id}.json`;
}

/**
 * @param {string} filename
 * @param {string} text
 */
export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
