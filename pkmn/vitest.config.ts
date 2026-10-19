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
  gameTick, checkUiEntry, drawUiLayer, renderPikachuEmotionScene, openStartMenu, restOfPass, overworldDeps, startScript,
  startNewGame, loadSavedGame, handleWarpLoad, handleBlackoutWarp, connectToMap,
  async finishFade() { const callback = fadeCallback; fadeCallback = null; await callback?.(); },
  startMenu, partyMenu, bagMenu, optionMenu,
  pokedexMenu, trainerCard, saveMenu, textBox, playerParty, player, gameMap, pikachuFollower,
  set battle(value: Battle | null) { currentBattle = value; state = 'battle'; },
  get state() { return state; }, set state(value: GameState) { state = value; }, get fade() { return fadeAlpha; },
  get mapName() { return currentMapName; }, mainMenu,
  get bag() { return playerBag; },
  set mapNpcs(value: Npc[]) { npcs = value; },
  reset() {
    state = 'overworld'; currentBattle = null; menuClose = null; closingSave = false; textBox.dismiss(); fadeAlpha = 0; fadeDir = null;
    fadeCallback = null; prevTickInPassState = false; pendingWarpMusic = null;
    playerParty.length = 0; playerBag = new Bag();
    npcs = []; currentMapName = 'RedsHouse2F';
    gameMap.mapData = null; player.cancelMovement();
    lastBlackoutWarp = { destMap: 'PalletTown', destWarpId: 0 };
    clearPikachuEmotion();
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
