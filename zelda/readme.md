# The Legend of Zelda (NES)

A port of the original 1986 NES _Legend of Zelda_ as a pure browser game in TypeScript.

**Status:** Playable and winnable end to end — title → 9 dungeons → Ganon →
ending → Second Quest, with save/load and audio. 51 of 54 slices done; the
Second Quest playthrough audit (L2b) and the mobile phase (M1–M2) remain.

**Scope:** 54 atomic slices across 13 phases. One slice per session.

## Quick start

```bash
npm install
npm run dev
# → http://127.0.0.1:5173/
```

## Live Demo

Play the game in your browser:

<a href="https://zelda-ajfm88.netlify.app"><img src="https://img.shields.io/badge/Live_Demo-Open-blue?style=for-the-badge&logo=rocket&logoColor=white" alt="Play the live version"/></a>

## Credits

https://github.com/aldonunez ([Loz](https://github.com/aldonunez/Loz), [zelda1-disasm-labels](https://github.com/aldonunez/zelda1-disasm-labels)) ← THE spec: full NES ROM disassembly + RAM variable dictionary
https://github.com/bobbylight ([ZeldaJS](https://github.com/bobbylight/ZeldaJS)) ← best browser reference (TypeScript)
https://github.com/hfiggs ([zelda-clone](https://github.com/hfiggs/zelda-clone)) ← best combat/boss reference (C#)
https://github.com/humbertodias ([game-zelda-js](https://github.com/humbertodias/game-zelda-js)) ← weapon variety + HUD reference
https://github.com/Matthew-SA ([zelda-js](https://github.com/Matthew-SA/zelda-js)) ← overworld map reference
https://github.com/jdr81394 ([Legend-Of-Zelda-Javascript](https://github.com/jdr81394/Legend-Of-Zelda-Javascript)) ← ECS pattern reference
