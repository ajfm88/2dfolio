import gameManager from "./gameManager";

// Registry of available languages. To add another language, add an entry here
// and a matching block in `translations` below.
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

const translations = {
  en: {
    "help.langLabel": "Change language",
    "help.title": "How To Play",
    "help.p1":
      "Combine tiles of the same number in an attempt to create a tile with the value 2048.",
    "help.p2":
      "Pressing the arrow keys or swiping across the game board will move all tiles in the direction of the key pressed/swipe. After all the tiles are done moving a new tile with the value of 2 or 4 will be created in a random empty cell.",
    "help.p3":
      "Two tiles with the same number will merge when they collide to create a single tile with double the value.",
    "help.p4":
      "The game is over when there are no valid ways for you to move the tiles.",
    "help.importantLabel": "IMPORTANT:",
    "help.important":
      "Each day a new game is generated which is exactly the same for everyone in the world. Come back each day and share your results with your friends so you can claim your title as the best 2048 player.",
  },
  zh: {
    "help.langLabel": "切换语言",
    "help.title": "游戏玩法",
    "help.p1": "合并数字相同的方块，努力拼出数值为 2048 的方块。",
    "help.p2":
      "按方向键或在棋盘上滑动，会让所有方块朝按键/滑动的方向移动。所有方块移动完成后，会在随机的空格中生成一个数值为 2 或 4 的新方块。",
    "help.p3": "两个数字相同的方块相撞时会合并成一个数值翻倍的方块。",
    "help.p4": "当没有任何有效的移动方式时，游戏结束。",
    "help.importantLabel": "重要提示：",
    "help.important":
      "每天都会生成一局全新的游戏，全世界所有人玩到的都完全相同。每天回来挑战，并把成绩分享给朋友，争夺最强 2048 玩家的称号。",
  },
};

export function getLanguage() {
  return gameManager.userSettings.language || "en";
}

export function setLanguage(code) {
  gameManager.userSettings.language = code;
}

export function cycleLanguage() {
  const codes = LANGUAGES.map((l) => l.code);
  const nextIndex = (codes.indexOf(getLanguage()) + 1) % codes.length;
  const next = codes[nextIndex];
  setLanguage(next);
  return next;
}

export function t(key, lang = getLanguage()) {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

// Fill in every element inside `root` tagged with `data-i18n="<key>"`, plus the
// language button's accessible label. Safe to call repeatedly. Pass `lang` to
// render a specific language without changing the saved setting.
export function applyTranslations(root, lang = getLanguage()) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n, lang);
  });
  const langBtn = root.querySelector("[data-lang-btn]");
  if (langBtn != null) {
    langBtn.setAttribute("aria-label", t("help.langLabel", lang));
  }
}
