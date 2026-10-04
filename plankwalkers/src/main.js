import './ui/styles/base.css';

import { VIEW_H } from './settings.js';
import { createAudio } from './core/audio.js';
import { loadAtlas } from './core/atlas.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createTransition } from './core/transition.js';
import { createViewport } from './core/viewport.js';

import { campaign } from './data/campaign.js';
import { sounds } from './data/sounds.js';
import { getTheme } from './data/themes.js';
import { deserialise, encodeShare, serialise } from './level/codec.js';
import { createEmptyModel } from './level/model.js';
import { LevelError } from './level/schema.js';
import { createPlayScene } from './game/play-scene.js';
import { createMakerScene } from './maker/maker-scene.js';
import { findProblems } from './maker/validate.js';
import { createLevelStore } from './storage/levels.js';
import { createProgressStore } from './storage/progress.js';
import { createSafeStorage } from './storage/safe-storage.js';
import { createSettingsStore } from './storage/settings-store.js';
import {
  el,
  onPageHidden,
  prefersReducedMotion,
  setVeiled,
  watchReducedMotion,
} from './ui/dom.js';
import { createPlayHud } from './ui/hud.js';
import { createMakerPalette } from './ui/maker-palette.js';
import { createMakerToolbar } from './ui/maker-toolbar.js';
import { createPaintPanToggle } from './ui/maker-toggle.js';
import { createRotatePrompt } from './ui/rotate-prompt.js';
import { createTouchControls } from './ui/touch-controls.js';
import { openDialog } from './ui/components/dialog.js';
import { openResizeDialog } from './ui/components/resize-dialog.js';
import { openShareDialog } from './ui/components/share-dialog.js';
import { openSettingsDialog } from './ui/components/settings-dialog.js';
import { createToaster } from './ui/components/toast.js';
import { createLevelSelectScreen } from './ui/screens/level-select.js';
import { createTitleScreen } from './ui/screens/title.js';
import atlasJson from './data/atlas.json';

/** @typedef {import('./level/model.js').LevelModel} LevelModel */
/** @typedef {import('./maker/maker-scene.js').MakerSession} MakerSession */
/** @typedef {import('./game/play-scene.js').PlaySceneParams} PlaySceneParams */
/** @typedef {import('./storage/levels.js').ResumePoint} ResumePoint */
/** @typedef {import('./storage/levels.js').SaveResult} SaveResult */
/** @typedef {import('./storage/settings-store.js').ControlsMode} ControlsMode */
/** @typedef {import('./types.js').LevelData} LevelData */
/** @typedef {import('./ui/screens/level-select.js').LevelSelectTab} LevelSelectTab */

/** @typedef {'title' | 'select' | 'maker' | 'play'} Mode */
/**
 * What is being played. It decides every play callback: a test-play goes back to
 * the maker, anything else to level select, and only the campaign has a next level
 * and records progress.
 * @typedef {{ kind: 'test' }
 *   | { kind: 'campaign', index: number }
 *   | { kind: 'mine', id: string }} PlaySource
 */
/** @typedef {{ treasure: number, timeMs: number }} Run */

// --sky. The canvas cannot read CSS custom properties.
const SKY = '#ddc6a1';
const MEMORY_NOTICE =
  "Saving isn't available in this browser window. Levels and progress will be lost when it closes.";

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const appRoot = /** @type {HTMLElement} */ (document.getElementById('app'));
const uiRoot = /** @type {HTMLElement} */ (document.getElementById('ui'));

// Portrait is not a supported canvas orientation (2026-09-23): the game is held
// behind a rotate prompt until the display is wider than it is tall.
const rotatePrompt = createRotatePrompt(appRoot);
let portrait = false;

const viewport = createViewport(canvas, ctx, {
  onResize() {
    const dw = window.innerWidth;
    const dh = window.innerHeight;
    const uiScale = Math.max(1, Math.min(3, Math.floor(Math.min(dw / 480, dh / 320))));
    document.documentElement.style.setProperty('--ui-scale', String(uiScale));
    portrait = dw < dh;
    rotatePrompt.setShown(portrait);
  },
});

const storage = createSafeStorage(() => window.localStorage);
const levels = createLevelStore(storage);
const settings = createSettingsStore(storage);
const progress = createProgressStore(storage);

const audio = createAudio();
const saved = settings.load();
if (saved.music !== undefined) audio.musicVolume = saved.music;
if (saved.sfx !== undefined) audio.sfxVolume = saved.sfx;
/** On-screen controls: read by the play scene in render, set in Settings. */
/** @type {ControlsMode} */
let controls = saved.controls ?? 'auto';

const input = createInput(canvas, viewport);
const camera = createCamera();
const transition = createTransition();
const playScene = createPlayScene();
const makerScene = createMakerScene();
const toaster = createToaster(uiRoot);

input.onFirstGesture(() => audio.resume());

// Kept current from the system setting, so the play scene can read it from update
// without touching the DOM. The wipe reads the setting itself when it starts.
let reducedMotion = prefersReducedMotion();
watchReducedMotion((reduced) => { reducedMotion = reduced; });

/** Level select's view of the campaign: play order, progress key and name. */
const campaignCards = campaign.map((entry) => ({ id: entry.id, name: entry.data.name }));

/** @type {Awaited<ReturnType<typeof loadAtlas>> | null} */
let atlas = null;
/** @type {Mode} */
let mode = 'title';
/** @type {ReturnType<typeof createTitleScreen> | null} */
let titleScreen = null;
/** @type {ReturnType<typeof createLevelSelectScreen> | null} */
let selectScreen = null;
/** The tab level select opens on, set by whatever switches to it. */
/** @type {LevelSelectTab} */
let selectTab = 'campaign';
/** The level the next maker enter opens, when it is not a return from test-play. */
/** @type {{ level: LevelModel, resume?: ResumePoint } | null} */
let makerEntry = null;
/** The maker as it was left, held while its level is being test-played. */
/** @type {MakerSession | null} */
let session = null;
/** What is being played; every attempt deserialises it afresh. */
/** @type {LevelData | null} */
let playData = null;
/** @type {PlaySource | null} */
let playSource = null;
// Set from scene callbacks and DOM events, acted on by the App after the scene
// update returns — the same deferral as a restart.
/** @type {Mode | null} */
let request = null;
let pendingRestart = false;
/** A finished campaign run, recorded after the scene update returns. */
/** @type {{ id: string, run: Run } | null} */
let finishedRun = null;
/** A dialog the App opened (leave-confirm, storage full); closed on every switch. */
/** @type {{ close: () => void } | null} */
let appDialog = null;
/** One storage-full dialog per episode; the next successful write ends it. */
let storageFullShown = false;
/** Storage that starts in memory is announced on level select; one that drops there later, here. */
let memoryNoticeShown = storage.mode === 'memory';
/** A level is loading or being copied; a second tap is ignored. */
let opening = false;

/** @param {{ close: () => void } | null} next */
function setAppDialog(next) {
  if (appDialog) appDialog.close();
  appDialog = next;
}

/** Something is already under way: a load, a requested switch, or a wipe. */
function busy() {
  return opening || request !== null || transition.active;
}

/**
 * A request is only taken when nothing else is under way.
 * @param {Mode} target
 */
function requestSwitch(target) {
  if (request || transition.active) return;
  request = target;
}

/**
 * @param {LevelSelectTab} tab
 */
function goToSelect(tab) {
  if (busy()) return;
  selectTab = tab;
  requestSwitch('select');
}

/**
 * The campaign id overrides the file's own, so a re-exported level keeps its
 * progress.
 *
 * @param {number} index
 * @returns {LevelData}
 */
function campaignData(index) {
  const entry = campaign[index];
  return { ...entry.data, id: entry.id };
}

/**
 * Every save and settings write ends here, so storage trouble is reported once, in
 * one voice.
 *
 * @param {SaveResult} result
 * @param {LevelModel} [level]  lets the storage-full dialog offer its share code
 */
function report(result, level) {
  if (storage.mode === 'memory' && !memoryNoticeShown) {
    memoryNoticeShown = true;
    toaster.show(MEMORY_NOTICE);
  }
  if (result.ok) {
    storageFullShown = false;
    return;
  }
  if (result.reason === 'invalid') {
    toaster.show("This level couldn't be saved.");
    return;
  }
  if (storageFullShown) return;
  storageFullShown = true;
  /** @type {import('./ui/components/dialog.js').DialogAction[]} */
  const actions = [];
  if (level) {
    actions.push({
      label: 'Copy share code',
      onClick() { setAppDialog(openShareDialog(uiRoot, { code: encodeShare(level) })); },
    });
  }
  actions.push({ label: 'OK', primary: true, focus: true });
  setAppDialog(openDialog(uiRoot, {
    title: 'Storage is full',
    body: [el('p', {
      class: 'dialog__text',
      text: "Coral Corsairs couldn't save because this browser's storage for it is full. "
        + "Delete levels you don't need in My Levels, or copy this level's share code to "
        + 'keep it safe.',
    })],
    actions,
  }));
}

/** Settings are saved whole: both volumes and the controls mode. */
function saveSettings() {
  const result = settings.save({ music: audio.musicVolume, sfx: audio.sfxVolume, controls });
  if (result === 'quota') report({ ok: false, reason: 'quota' });
}

/**
 * The one Settings dialog, opened from the Title, level select and the pause menu.
 * Whoever opens it holds the handle and closes it when their own UI goes.
 *
 * @param {HTMLElement} root
 * @returns {{ close: () => void }}
 */
function openSettings(root) {
  return openSettingsDialog(root, {
    audio,
    controls: () => controls,
    setControls(mode) {
      controls = mode;
      saveSettings();
    },
    onCommit: saveSettings,
  });
}

/**
 * @param {LevelModel} level
 * @param {{ immediate?: boolean }} [opts]
 */
function saveLevel(level, opts) {
  // An immediate save is uncompressed: it waits on no stream, so it lands in this
  // task, before a hidden page can be frozen. The next autosave compresses it.
  levels.save(level, { compress: !opts?.immediate }).then((r) => report(r, level));
}

/**
 * The resume point only means something for a level that is, or is being, saved.
 * @param {ResumePoint | null} rp
 * @param {boolean} saving
 */
function writeResume(rp, saving) {
  if (!rp || !(saving || levels.has(rp.levelId))) return;
  levels.saveResume(rp);
}

/**
 * @param {{ id: string, run: Run }} finished
 */
function recordRun(finished) {
  const result = progress.record(finished.id, finished.run);
  report(result === 'quota' ? { ok: false, reason: 'quota' } : { ok: true });
}

function enterTitle() {
  titleScreen = createTitleScreen(uiRoot, {
    onPlay() { goToSelect('campaign'); },
    onMake() { goToSelect('mine'); },
    openSettings,
  });
  // Mid-wipe the UI layer is inert and cannot take focus; the wipe's end gives it.
  if (!uiRoot.inert) titleScreen.focus();
}

function enterSelect() {
  selectScreen = createLevelSelectScreen(uiRoot, {
    tab: selectTab,
    campaign: campaignCards,
    getProgress: (id) => progress.get(id),
    levels,
    storageMode: () => storage.mode,
    onBack() {
      if (!busy()) requestSwitch('title');
    },
    onPlayCampaign: playCampaign,
    onEditCampaignCopy(index) { editCampaignCopy(index); },
    // Inside `then`, so a level that fails to load is the dialog's message, not a throw.
    shareCampaign: (index) => Promise.resolve()
      .then(() => encodeShare(deserialise(campaignData(index)))),
    onNew() {
      if (busy()) return;
      makerEntry = { level: createEmptyModel() };
      requestSwitch('maker');
    },
    onPlay(id) { playLevel(id); },
    onEdit(id) { openLevel(id); },
    openSettings,
    report: (r) => report(r),
    toast: (text) => toaster.show(text),
  });
}

/**
 * @param {number} index
 */
function playCampaign(index) {
  if (busy()) return;
  playSource = { kind: 'campaign', index };
  playData = campaignData(index);
  requestSwitch('play');
}

/**
 * A campaign level is never changed: this saves a copy to My Levels, under its own
 * id and the same name, and opens the copy.
 *
 * @param {number} index
 */
async function editCampaignCopy(index) {
  if (busy()) return;
  opening = true;
  try {
    const model = deserialise(campaignData(index));
    const now = Date.now();
    model.created = now;
    model.modified = now;
    const result = await levels.add(model);
    report(result, model);
    if (!result.ok) return;
    // Something else may have been chosen while this saved.
    if (mode !== 'select' || request || transition.active) return;
    makerEntry = { level: model };
    requestSwitch('maker');
  } finally {
    opening = false;
  }
}

/**
 * @param {string} id
 */
async function playLevel(id) {
  if (busy()) return;
  opening = true;
  try {
    const level = await levels.load(id);
    if (mode !== 'select' || request || transition.active) return;
    // A stored level loads, but it may not be playable (Unit 17 lets such levels be
    // saved and imported). The maker would say why; here a toast does.
    const problems = findProblems(level);
    if (problems.length > 0) {
      toaster.show(`Can't play yet: ${problems[0].message}`);
      return;
    }
    playData = serialise(level);
    playSource = { kind: 'mine', id };
    requestSwitch('play');
  } catch (err) {
    if (!(err instanceof LevelError)) throw err;
    toaster.show(`This level couldn't be opened (${err.message}).`);
  } finally {
    opening = false;
  }
}

/**
 * @param {string} id
 */
async function openLevel(id) {
  if (busy()) return;
  opening = true;
  try {
    const level = await levels.load(id);
    // Something else (New Level) may have been chosen while this loaded.
    if (mode !== 'select' || request || transition.active) return;
    const rp = levels.loadResume();
    makerEntry = { level, resume: rp && rp.levelId === id ? rp : undefined };
    requestSwitch('maker');
  } catch (err) {
    if (!(err instanceof LevelError)) throw err;
    toaster.show(`This level couldn't be opened (${err.message}).`);
  } finally {
    opening = false;
  }
}

function onMakerBack() {
  if (request || transition.active) return;
  const result = makerScene.flush();
  const rp = makerScene.resumePoint();
  writeResume(rp, result === 'saved');
  if (result !== 'unsaveable') {
    goToSelect('mine');
    return;
  }
  const reason = makerScene.saveBlocker() ?? 'it cannot be saved';
  const stored = rp !== null && levels.has(rp.levelId);
  const text = stored
    ? `Your latest changes can't be saved: ${reason}. The last saved version will be kept.`
    : `This level can't be saved: ${reason}. If you leave, it will be lost.`;
  setAppDialog(openDialog(uiRoot, {
    title: 'Leave the editor?',
    body: [el('p', { class: 'dialog__text', text })],
    actions: [
      { label: 'Keep editing', primary: true, focus: true },
      { label: 'Leave', onClick() { goToSelect('mine'); } },
    ],
  }));
}

function enterMaker() {
  if (!atlas) return;
  const s = session;
  const entry = makerEntry;
  session = null;
  playData = null;
  makerEntry = null;
  const level = s ? s.level : entry ? entry.level : createEmptyModel();
  makerScene.enter({
    level,
    session: s ?? undefined,
    resume: entry?.resume,
    atlas,
    input,
    camera,
    viewport,
    ui: {
      createPalette: createMakerPalette,
      createToggle: createPaintPanToggle,
      createToolbar: createMakerToolbar,
    },
    onBack: onMakerBack,
    onPlay(data, snap) {
      playData = data;
      session = snap;
      playSource = { kind: 'test' };
      request = 'play';
    },
    onSave: saveLevel,
    openResizeDialog,
    openShareDialog,
  });
  makerScene.mountUI(uiRoot);
}

function enterPlay() {
  if (!atlas || !playData || !playSource) return;
  const src = playSource;
  // Every source proved this data loads: the maker proof-loads it, My Levels loaded
  // it from storage, and the campaign's files are checked by its tests.
  const level = deserialise(playData);
  /** @type {PlaySceneParams} */
  const params = {
    level,
    theme: getTheme(level.theme),
    atlas,
    audio,
    input,
    camera,
    viewport,
    ui: { createHud: createPlayHud, createTouch: createTouchControls },
    onDeath() { pendingRestart = true; },
    onReplay() { pendingRestart = true; },
    reducedMotion: () => reducedMotion,
    controls: () => controls,
    openSettings,
  };
  if (src.kind === 'test') {
    params.onEdit = () => { request = 'maker'; };
  } else {
    // Death, like Level select, goes back to the tab the level came from.
    const tab = src.kind === 'campaign' ? 'campaign' : 'mine';
    params.onDeath = () => goToSelect(tab);
    params.onQuit = () => goToSelect(tab);
  }
  if (src.kind === 'campaign') {
    const id = campaign[src.index].id;
    params.onComplete = (run) => { finishedRun = { id, run }; };
    const next = src.index + 1;
    if (next < campaign.length) params.onNext = () => playCampaign(next);
  }
  playScene.enter(params);
  playScene.mountUI(uiRoot);
}

function restartPlay() {
  playScene.unmountUI();
  playScene.exit();
  enterPlay();
}

/**
 * Tear down whatever is showing. Saving happened before the switch was requested.
 * @param {Mode} from
 */
function leave(from) {
  if (from === 'title') {
    if (titleScreen) titleScreen.destroy();
    titleScreen = null;
  } else if (from === 'select') {
    if (selectScreen) selectScreen.destroy();
    selectScreen = null;
  } else if (from === 'maker') {
    makerScene.unmountUI();
    makerScene.exit();
  } else {
    playScene.unmountUI();
    playScene.exit();
  }
}

/**
 * @param {Mode} target
 */
function enter(target) {
  if (target === 'play') enterPlay();
  else if (target === 'maker') enterMaker();
  else if (target === 'select') enterSelect();
  else enterTitle();
}

/**
 * Wipe to another mode. The old one is torn down and the new one built while the
 * screen is covered.
 *
 * @param {Mode} target
 */
function beginSwitch(target) {
  // Play to play is the campaign's Next level; any other target is a new mode.
  if (target === mode && target !== 'play') return;
  const from = mode;
  const started = transition.start({
    reducedMotion: prefersReducedMotion(),
    onCover() {
      setAppDialog(null);
      leave(from);
      mode = target;
      enter(target);
    },
    onEnd() {
      setVeiled(uiRoot, false);
      if (mode === 'title' && titleScreen) titleScreen.focus();
    },
  });
  if (!started) return;
  setVeiled(uiRoot, true);
  // Fades out under the closing iris. The next level keeps the music going.
  if (from === 'play' && target !== 'play') audio.stopMusic();
}

// A phone may kill a hidden tab without warning: save now, uncompressed so the
// write lands before the page can be frozen.
onPageHidden(() => {
  if (mode === 'maker') {
    const result = makerScene.flush({ immediate: true });
    writeResume(makerScene.resumePoint(), result === 'saved');
  } else if (mode === 'play' && session) {
    writeResume({
      levelId: session.level.id,
      camX: session.camX,
      camY: session.camY,
      zoom: session.zoom,
      tool: session.toolId,
    }, true);
  }
});

/**
 * @param {number} dt
 */
function update(dt) {
  // Held behind the rotate prompt. Input still advances, so a press made behind
  // it is dropped rather than replayed when the device turns back.
  if (portrait) {
    input.advance();
    return;
  }
  // Nothing steps during a wipe: the old mode is frozen under the closing iris,
  // the new one under the opening iris.
  if (transition.active) {
    input.advance();
    transition.update(dt);
    return;
  }
  if (mode === 'maker') {
    makerScene.update(dt);
  } else if (mode === 'play') {
    playScene.update(dt);
    if (finishedRun) {
      recordRun(finishedRun);
      finishedRun = null;
    }
    if (pendingRestart) {
      pendingRestart = false;
      restartPlay();
    }
  } else {
    // Title and level select are DOM only; keep edges from piling up for the next scene.
    input.advance();
  }
  if (request) {
    const target = request;
    request = null;
    beginSwitch(target);
  }
}

function render() {
  viewport.apply(ctx);
  if (atlas && mode === 'maker') {
    makerScene.render(ctx, camera);
  } else if (atlas && mode === 'play') {
    playScene.render(ctx, camera);
  } else {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, viewport.viewW, VIEW_H);
  }
  if (transition.active) {
    // The maker leaves its zoom scale on the context.
    viewport.apply(ctx);
    transition.draw(ctx, viewport.viewW, VIEW_H);
  }
}

const loop = createLoop({ update, render });
loop.start();

Promise.all([
  loadAtlas(atlasJson),
  audio.load(sounds),
]).then(([loaded]) => {
  atlas = loaded;
  mode = 'title';
  enterTitle();
}).catch((err) => {
  console.error('Failed to load:', err);
});
