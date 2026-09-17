/**
 * Tiny DOM factory helpers. Text is always set via `textContent`, never
 * interpolated into `innerHTML` (code standards). Only `src/ui/` builds DOM.
 */

/**
 * @typedef {{
 *   class?: string,
 *   text?: string,
 *   attrs?: Record<string, string>,
 *   style?: Record<string, string>,
 *   on?: Record<string, EventListener>,
 * }} ElOpts
 */

/**
 * @param {string} tag
 * @param {ElOpts} [opts]
 * @param {Array<Node | string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.attrs) {
    for (const k in opts.attrs) node.setAttribute(k, opts.attrs[k]);
  }
  if (opts.style) {
    for (const k in opts.style) node.style.setProperty(k, opts.style[k]);
  }
  if (opts.on) {
    for (const k in opts.on) node.addEventListener(k, opts.on[k]);
  }
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/**
 * Remove every child of a node.
 * @param {Node} node
 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
