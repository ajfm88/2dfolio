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
  writeSave, startNewGame, loadSavedGame, handleWarpLoad, handleBlackoutWarp, connectToMap,
  init, gameLoop, renderLiveBattle, startBattle, startTrainerBattle, engageTrainer,
  get pageTicks() { return pageTicks; }, get random() { return sessionRandom; },
  get boxes() { return pcBoxes; }, get money() { return playerMoney; }, set money(value: number) { playerMoney=value; },
  renderBattleEntry, get battleEntry() { return battleEntry; }, ow,
  get battleReturnBgp() { return battleReturn ? battleReturn.bgp : undefined; }, renderBattleReturn,
  async finishFade() { const callback = fadeCallback; fadeCallback = null; await callback?.(); },
  startMenu, partyMenu, bagMenu, optionMenu,
  oakSpeech, namingScreen, get introMapReady() { return introMapReady; },
  pokedexMenu, trainerCard, saveMenu, textBox, playerParty, player, gameMap, pikachuFollower,
  set session(value: LiveSession | null) {
    currentSession = value; state = 'battle';
    const encounter: LiveBattleEncounter = {kind:'wild',species:19,level:3};
    battleInput = {world:snapshotBattleWorld(encounter),encounter,blackoutCarry:false};
  },
  get session() { return currentSession; },
  get state() { return state; }, set state(value: GameState) { state = value; }, get fade() { return fadeAlpha; },
  get mapName() { return currentMapName; }, mainMenu,
  get bag() { return playerBag; },
  set mapNpcs(value: Npc[]) { npcs = value; },
  reset() {
    if (currentSession && !currentSession.done) currentSession.abort();
    state = 'overworld'; currentSession = null; battleInput = null; menuClose = null; closingSave = false; textBox.dismiss(); fadeAlpha = 0; fadeDir = null;
    fadeCallback = null; prevTickInPassState = false; pendingWarpMusic = null;
    introFrames = 0; introMapReady = false;
    battleEntry = null; pendingTrainer = null; engagedTrainer = null; battleReturn = null;
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
    testTimeout: 30_000,
  },
});
