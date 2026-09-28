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

/**
 * Fade the UI layer out and make it unclickable and unfocusable, for the length
 * of a mode-switch wipe — a second Play tap or a stray Undo must not land mid-wipe.
 *
 * @param {HTMLElement} root
 * @param {boolean} on
 */
export function setVeiled(root, on) {
  root.inert = on;
  root.classList.toggle('ui--veiled', on);
}

/**
 * Read at the moment it is needed, so a change to the system setting applies to
 * the next transition without a reload.
 *
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A mouse or trackpad is the primary pointer: file export and import are offered
 * there. Phones and tablets share levels as codes.
 *
 * @returns {boolean}
 */
export function hasFinePointer() {
  return window.matchMedia('(pointer: fine)').matches;
}

/**
 * Call `cb` when the page is hidden, which is the last reliable moment to save on a
 * phone that may kill the tab in the background. Both events can fire for one
 * hide, so `cb` must not mind running twice.
 *
 * @param {() => void} cb
 * @returns {() => void} unsubscribe
 */
export function onPageHidden(cb) {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') cb();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', cb);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', cb);
  };
}
