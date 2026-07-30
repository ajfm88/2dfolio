// The title art, and the two ways the front-end paints it.
//
// `title.jpg` is the Tetris Attack box art (original art (c) Nintendo /
// Intelligent Systems; supplied by the user). It is the intro screen, and then
// it stays on as the backdrop behind every screen before a match starts -- so
// the intro does not so much end as recede.
//
// That only reads as one movement if the poster is painted *identically* in
// both places. It is: `TITLE_ART_CSS` is the whole of it, and the menu's
// version differs by exactly one extra declaration (an inset shadow that dims
// it). Nothing moves or resizes across the transition, so there is nothing to
// line up -- change one of these and you have to change both.
//
// `contain` rather than `cover`: the art is 1000x1500 portrait and the viewport
// is usually landscape, so covering would crop the logo straight off the top.
// The letterbox either side is filled with the deep blue the poster carries at
// its own edges, plus a vignette, so the bars read as part of the art.

const TITLE_ART_URL = 'assets/title.jpg';

// Sampled from the poster's edges, so the letterbox is continuous with it.
const FIELD = '#0a4f96';
const FIELD_EDGE = '#04162e';

const TITLE_ART_CSS = `
  background-color: ${FIELD};
  background-image:
    radial-gradient(circle at 50% 42%, rgba(10, 79, 150, 0) 38%, ${FIELD_EDGE} 100%),
    url('${TITLE_ART_URL}');
  background-size: cover, contain;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;
`;

// The same poster, pushed back so a menu card reads cleanly over it. An inset
// box-shadow paints above the background but below the element's children, so
// this dims the art without touching the card -- no extra element, no z-index
// to keep straight. 100vmax guarantees it covers however large the viewport is.
const MENU_BACKDROP_CSS = `
  ${TITLE_ART_CSS}
  box-shadow: inset 0 0 0 100vmax rgba(7, 5, 15, 0.74);
`;

// --------------------------------------------------------------- pixel logo
//
// `logo.png` used to head the main menu. The bare menu dropped it -- the poster
// carries its own logo and two would fight -- so it now heads the setup screens
// instead, which are card-based and have nothing else at the top.
//
// 326px is exactly 2x its native 163x107, so every source pixel stays a clean
// 2x2 block. A fractional width leaves some columns 1px and some 2px, which is
// plainly visible on pixel art -- keep any change to it an integer multiple.

const LOGO_URL = 'assets/logo.png';
const LOGO_STYLE_ID = 'ta-logo-style';
const LOGO_STYLE = `
  .ta-logo {
    display: block; margin: 2px auto 14px;
    width: 326px; max-width: 100%; height: auto;
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6));
  }
`;

// Returns the logo element, injecting its (shared, one-off) stylesheet the
// first time. Each screen appends the result to its own card.
function createLogo() {
  if (!document.getElementById(LOGO_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = LOGO_STYLE_ID;
    style.textContent = LOGO_STYLE;
    document.head.appendChild(style);
  }
  const logo = document.createElement('img');
  logo.className = 'ta-logo';
  logo.src = LOGO_URL;
  logo.alt = 'TETRIS ATTACK';
  return logo;
}

export { TITLE_ART_URL, TITLE_ART_CSS, MENU_BACKDROP_CSS, LOGO_URL, createLogo };
