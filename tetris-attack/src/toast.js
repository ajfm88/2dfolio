// A brief message in the corner, for state changes that have no other visible
// sign.
//
// This exists because muting had none. `M` toggles it, the setting persists
// across sessions, and nothing on screen says so -- so a game muted once is a
// game that is silently broken forever afterwards, with no way to tell that
// from the sound being genuinely absent. (Exactly that happened during
// development, and it took a look at localStorage to work out why.)

const STYLE_ID = 'ta-toast-style';
const STYLE = `
  #ta-toast {
    position: fixed; top: 18px; right: 18px; z-index: 1200;
    padding: 10px 16px;
    background: rgba(10, 8, 24, 0.88);
    border: 2px solid #4de0ff;
    border-radius: 6px;
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.35);
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: 11px; letter-spacing: 1px; color: #f4f4ff;
    user-select: none; pointer-events: none;
    opacity: 0;
    transition: opacity 220ms ease-out;
  }
  #ta-toast.ta-visible { opacity: 1; }
  @media (prefers-reduced-motion: reduce) {
    #ta-toast { transition-duration: 1ms; }
  }
`;

const VISIBLE_MS = 1300;
const FADE_MS = 220;

let el = null;
let hideTimer = null;
let removeTimer = null;

function ensure() {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }
  if (!el || !el.isConnected) {
    el = document.createElement('div');
    el.id = 'ta-toast';
    document.body.appendChild(el);
  }
  return el;
}

// Show `text` briefly. Calling again replaces whatever is up rather than
// queueing, so mashing M reads as one indicator keeping up.
function showToast(text) {
  if (typeof document === 'undefined') return;
  const node = ensure();
  clearTimeout(hideTimer);
  clearTimeout(removeTimer);
  node.textContent = text;
  // Force a reflow so a re-show after a fade-out actually transitions again.
  void node.offsetWidth;
  node.classList.add('ta-visible');
  hideTimer = setTimeout(() => {
    node.classList.remove('ta-visible');
    removeTimer = setTimeout(() => {
      if (node.isConnected) node.remove();
      if (el === node) el = null;
    }, FADE_MS);
  }, VISIBLE_MS);
}

export { showToast };
