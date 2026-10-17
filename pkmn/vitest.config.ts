import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [{
    name: 'main-integration-test-access',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/main.ts')) return;
      // Exercise the real dispatch without booting RAF/audio. These bindings exist
      // only in Vitest; the production entry point exposes no testing controls.
      return code.slice(0, code.lastIndexOf('\ninit().catch')) + `
export const mainTest = {
  gameTick, checkUiEntry, drawUiLayer, openStartMenu, restOfPass, overworldDeps,
  startNewGame, loadSavedGame, startMenu, partyMenu, bagMenu, optionMenu,
  pokedexMenu, trainerCard, saveMenu, textBox, playerParty, player, gameMap, pikachuFollower,
  get state() { return state; }, get fade() { return fadeAlpha; },
  reset() {
    state = 'overworld'; menuClose = null; closingSave = false; textBox.dismiss(); fadeAlpha = 0; fadeDir = null;
    fadeCallback = null; prevTickInPassState = false;
    playerParty.length = 0; playerBag = new Bag();
    npcs = []; currentMapName = 'RedsHouse2F';
    Object.assign(ow, createOverworldState());
    uiEntry.opened(false); lastDisplayRevision = 0;
    setBattleAndStartSavedMenuItem(0);
  },
};`;
    },
  }],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
