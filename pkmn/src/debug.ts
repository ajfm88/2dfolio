import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from './core';
import { getCtx, getScale, resizeCanvas } from './renderer';
import type { GameMap } from './overworld/map';
import type { Player } from './overworld/player';
import type { Npc } from './overworld/npc';
import type { Battle } from './battle/battle';
import type { BattlePokemon, StatusCondition } from './battle/types';
import { type Bag, getAllItemIds, getItemName } from './items';
import { getPikachuHappiness, getPikachuMood, restorePikachuHappiness } from './overworld';
import { createPokemon, getAllSpeciesNames } from './battle/data';
import { getPlayerName } from './core/player_state';
import { totalExpForLevel, expToNextLevel, initExperience } from './battle/experience';
import { markOwned } from './pokedex_state';
import { hasFlag, setFlag, clearFlag } from './events';
import { BADGE_FLAGS } from './menus';

let enabled = false;
let noEncounters = false;
let noClip = false;

export function isNoEncounters(): boolean { return noEncounters; }
export function isNoClip(): boolean { return noClip; }

// ──────── Debug Warp ────────

interface DebugWarpRequest {
  map: string;
  warpId: number;
  stepPos?: { x: number; y: number };
}

let pendingWarp: DebugWarpRequest | null = null;

/** Consume a pending debug warp request. Called by main.ts each frame. */
export function consumeDebugWarp(): DebugWarpRequest | null {
  const warp = pendingWarp;
  pendingWarp = null;
  return warp;
}

// Fly destinations from assembly FlyWarpDataPtr (data/maps/special_warps.asm)
// + key indoor locations. Only maps that exist in pokemon-yellow-typescript/data/maps/.
const WARP_DESTINATIONS: { label: string; map: string; warpId: number; stepPos?: { x: number; y: number } }[] = [
  // Fly destinations (outdoor — use assembly fly coordinates in step units)
  { label: 'Pallet Town',    map: 'PalletTown',    warpId: 0, stepPos: { x: 5, y: 6 } },
  { label: 'Viridian City',  map: 'ViridianCity',  warpId: 0, stepPos: { x: 23, y: 26 } },
  // Routes
  { label: 'Route 1',        map: 'Route1',        warpId: 0, stepPos: { x: 5, y: 17 } },
  { label: 'Route 22',       map: 'Route22',       warpId: 0, stepPos: { x: 17, y: 4 } },
  // Indoor (warp 0 = entrance door, auto-steps in)
  { label: "Lab",                  map: 'OaksLab',              warpId: 0 },
  { label: "House 1",             map: 'RedsHouse1F',          warpId: 0 },
  { label: "House 2",             map: 'BluesHouse',           warpId: 0 },
  { label: 'Viridian Pokecenter', map: 'ViridianPokecenter',   warpId: 0 },
  { label: 'Viridian Mart',       map: 'ViridianMart',         warpId: 0 },
];

// Toggle with backtick
window.addEventListener('keydown', (e) => {
  if (e.key === '`') {
    enabled = !enabled;
    e.preventDefault();
    console.log(`Debug mode: ${enabled ? 'ON' : 'OFF'}`);
    updatePanelVisibility();
  }
});

export function isDebugEnabled(): boolean { return enabled; }

// ──────── Canvas overlay (overworld) ────────

export function renderDebugOverlay(
  cameraX: number, cameraY: number,
  player: Player, npcs: Npc[], gameMap: GameMap,
): void {
  if (!enabled) return;

  const ctx = getCtx();
  const s = getScale();

  const startTX = Math.floor(cameraX / TILE_SIZE);
  const startTY = Math.floor(cameraY / TILE_SIZE);
  const endTX = startTX + Math.ceil(GB_WIDTH / TILE_SIZE) + 1;
  const endTY = startTY + Math.ceil(GB_HEIGHT / TILE_SIZE) + 1;

  ctx.save();

  // Draw tile grid lines
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  for (let ty = startTY; ty <= endTY; ty++) {
    const screenY = (ty * TILE_SIZE - cameraY) * s;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(GB_WIDTH * s, screenY);
    ctx.stroke();
  }
  for (let tx = startTX; tx <= endTX; tx++) {
    const screenX = (tx * TILE_SIZE - cameraX) * s;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, GB_HEIGHT * s);
    ctx.stroke();
  }

  // Draw 16px step grid (2-tile blocks) with coordinates
  ctx.font = `${Math.max(8, s * 5)}px monospace`;
  for (let sy = Math.floor(startTY / 2); sy <= Math.ceil(endTY / 2); sy++) {
    for (let sx = Math.floor(startTX / 2); sx <= Math.ceil(endTX / 2); sx++) {
      const px = sx * 2 * TILE_SIZE;
      const py = sy * 2 * TILE_SIZE;
      const screenX = (px - cameraX) * s;
      const screenY = (py - cameraY) * s;

      ctx.strokeStyle = 'rgba(0, 100, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX, screenY, 16 * s, 16 * s);

      const walkable = gameMap.isWalkable(sx * 2, sy * 2);
      if (!walkable) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(screenX, screenY, 16 * s, 16 * s);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(`${sx},${sy}`, screenX + 1 * s, screenY + 6 * s);
    }
  }

  // Highlight player position
  const pScreenX = (player.x - cameraX) * s;
  const pScreenY = (player.y - cameraY) * s;
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pScreenX, pScreenY, 16 * s, 16 * s);

  // Highlight NPC positions
  for (const npc of npcs) {
    const nScreenX = (npc.x - cameraX) * s;
    const nScreenY = (npc.y - cameraY) * s;
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(nScreenX, nScreenY, 16 * s, 16 * s);

    ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
    ctx.fillText(npc.data.id, nScreenX + 1 * s, nScreenY - 1 * s);
  }

  ctx.restore();
}

// ──────── HTML Debug Panel ────────

let panel: HTMLDivElement | null = null;
let currentBattle: Battle | null = null;
let currentBag: Bag | null = null;
let currentPlayer: Player | null = null;
let currentMap: GameMap | null = null;
let currentParty: BattlePokemon[] | null = null;
let needsRebuild = true;

const STATUS_OPTIONS: (StatusCondition)[] = [null, 'PSN', 'BRN', 'FRZ', 'PAR', 'SLP'];
const STAGE_STATS = ['attack', 'defense', 'speed', 'special', 'accuracy', 'evasion'] as const;

// Stored references for live refresh (avoid full DOM rebuild every frame)
interface LiveRefs {
  header: HTMLElement;
  hpLabel: HTMLElement;
  hpInput: HTMLInputElement;
  expLabel: HTMLElement;
  statsLabel: HTMLElement;
  statusBtns: { status: StatusCondition; btn: HTMLButtonElement }[];
  stageLabels: { stat: typeof STAGE_STATS[number]; el: HTMLElement }[];
}
let playerRefs: LiveRefs | null = null;
let enemyRefs: LiveRefs | null = null;
let partyRefs: LiveRefs | null = null;
let bagListEl: HTMLElement | null = null;
let battleInfoEl: HTMLElement | null = null;
let pikaHappinessInput: HTMLInputElement | null = null;
let pikaMoodInput: HTMLInputElement | null = null;
let pikaHappinessLabel: HTMLElement | null = null;
let pikaMoodLabel: HTMLElement | null = null;
let overworldInfoEl: HTMLElement | null = null;
let skipIntroRow: HTMLElement | null = null;

function createPanel(): HTMLDivElement {
  const div = document.createElement('div');
  div.id = 'debug-panel';
  div.style.cssText = `
    position: fixed; right: 0; top: 0; bottom: 0; width: 280px;
    background: #1a1a2e; color: #eee; font: 12px monospace;
    padding: 10px; overflow-y: auto; z-index: 1000;
    border-left: 2px solid #444; display: none;
    user-select: text;
  `;
  // Prevent keyboard events from reaching the game
  div.addEventListener('keydown', (e) => e.stopPropagation());
  div.addEventListener('keyup', (e) => e.stopPropagation());
  document.body.appendChild(div);
  return div;
}

function updatePanelVisibility(): void {
  if (!panel) panel = createPanel();
  panel.style.display = enabled ? 'block' : 'none';
  if (enabled) needsRebuild = true; // rebuild when toggled on
  // Re-fit the canvas to the available space (minus debug panel if open)
  resizeCanvas();
}

/** Call from main.ts each frame to keep panel in sync with battle state. */
export function updateDebugPanel(battle: Battle | null, bag: Bag | null, player?: Player, map?: GameMap, party?: BattlePokemon[]): void {
  if (!enabled) return;
  if (!panel) panel = createPanel();

  if (battle !== currentBattle) needsRebuild = true;
  currentBattle = battle;
  currentBag = bag;
  currentPlayer = player ?? null;
  currentMap = map ?? null;
  currentParty = party ?? null;

  if (needsRebuild) {
    needsRebuild = false;
    rebuildPanel();
  }

  refreshPanel();
}

function rebuildPanel(): void {
  if (!panel) return;
  panel.innerHTML = '';
  playerRefs = null;
  enemyRefs = null;
  bagListEl = null;

  const title = el('div', `<b>DEBUG PANEL</b> <span style="color:#888">(~ to hide)</span>`);
  title.style.marginBottom = '8px';
  panel.appendChild(title);

  // No encounters toggle
  const encRow = row();
  const encBtn = btn(noEncounters ? 'Encounters: OFF' : 'Encounters: ON', () => {
    noEncounters = !noEncounters;
    encBtn.textContent = noEncounters ? 'Encounters: OFF' : 'Encounters: ON';
    encBtn.style.background = noEncounters ? '#833' : '#383';
  });
  encBtn.style.background = noEncounters ? '#833' : '#383';
  encBtn.style.padding = '4px 8px';
  encRow.appendChild(encBtn);
  panel.appendChild(encRow);

  // No-clip toggle (walk through walls and NPCs)
  const clipRow = row();
  const clipBtn = btn(noClip ? 'No-Clip: ON' : 'No-Clip: OFF', () => {
    noClip = !noClip;
    clipBtn.textContent = noClip ? 'No-Clip: ON' : 'No-Clip: OFF';
    clipBtn.style.background = noClip ? '#383' : '#833';
  });
  clipBtn.style.background = noClip ? '#383' : '#833';
  clipBtn.style.padding = '4px 8px';
  clipRow.appendChild(clipBtn);
  panel.appendChild(clipRow);

  // Warp to location
  const warpRow = row();
  const warpSelect = document.createElement('select');
  warpSelect.style.cssText = 'flex: 1; background: #222; color: #eee; border: 1px solid #555; border-radius: 2px; font: 11px monospace; padding: 2px 3px;';
  for (const dest of WARP_DESTINATIONS) {
    const opt = document.createElement('option');
    opt.value = dest.map;
    opt.textContent = dest.label;
    warpSelect.appendChild(opt);
  }
  warpRow.appendChild(warpSelect);
  const warpBtn = btn('Warp', () => {
    const dest = WARP_DESTINATIONS.find(d => d.map === warpSelect.value);
    if (dest) {
      pendingWarp = { map: dest.map, warpId: dest.warpId, stepPos: dest.stepPos };
    }
  });
  warpBtn.style.background = '#538';
  warpBtn.style.padding = '4px 8px';
  warpRow.appendChild(warpBtn);
  panel.appendChild(warpRow);

  // Skip Intro button (only visible when intro not yet completed)
  const skipRow = row();
  skipIntroRow = skipRow;
  const skipBtn = btn('Skip Intro', () => {
    if (hasFlag('GOT_POKEDEX')) return;
    // Set all intro flags in story order for consistency
    setFlag('OAK_APPEARED_IN_PALLET');
    setFlag('FOLLOWED_OAK_INTO_LAB');
    setFlag('OAK_ASKED_TO_CHOOSE_MON');
    setFlag('GOT_STARTER');
    setFlag('BATTLED_RIVAL_IN_OAKS_LAB');
    setFlag('GOT_POKEDEX');
    if (currentParty && currentParty.length < 6) {
      const pikachu = createPokemon(25, 5);
      if (pikachu) {
        initExperience(pikachu);
        pikachu.otName = getPlayerName();
        currentParty.push(pikachu);
        markOwned(pikachu.species.id);
      }
    }
    needsRebuild = true;
  });
  skipBtn.style.background = '#538';
  skipBtn.style.padding = '4px 8px';
  skipRow.appendChild(skipBtn);
  skipRow.style.display = hasFlag('GOT_POKEDEX') ? 'none' : 'flex';
  panel.appendChild(skipRow);

  // Overworld info (always shown)
  const owInfo = el('div', '') as HTMLDivElement;
  owInfo.style.cssText = 'margin-bottom: 8px; color: #0f0; font-size: 11px; line-height: 1.5;';
  overworldInfoEl = owInfo;
  panel.appendChild(owInfo);

  if (currentBattle) {
    // Battle info header (state, speed, EXP, catch rate)
    const info = el('div', '') as HTMLDivElement;
    info.style.cssText = 'margin-bottom: 8px; color: #ccc; font-size: 11px; line-height: 1.5;';
    battleInfoEl = info;
    panel.appendChild(info);

    const [pSection, pRefs] = buildPokemonSection('PLAYER', currentBattle.playerPokemon, '#4f4');
    const [eSection, eRefs] = buildPokemonSection('ENEMY', currentBattle.enemyPokemon, '#f66');
    playerRefs = pRefs;
    enemyRefs = eRefs;
    partyRefs = null;
    panel.appendChild(pSection);
    panel.appendChild(eSection);
  } else {
    battleInfoEl = null;
    // Party lead Pokemon controls (outside battle)
    if (currentParty && currentParty.length > 0) {
      const [partySection, pRefs] = buildPokemonSection('PARTY LEAD', currentParty[0], '#4cf');
      partyRefs = pRefs;
      panel.appendChild(partySection);
    } else {
      partyRefs = null;
      panel.appendChild(el('div', '<i style="color:#888">No party</i>'));
    }
  }

  // Party management section (outside battle only)
  if (!currentBattle) {
    panel.appendChild(el('hr', ''));
    panel.appendChild(buildPartySection());
  }

  // Badges section (always shown — badges are event flags)
  panel.appendChild(el('hr', ''));
  panel.appendChild(buildBadgesSection());

  // Pikachu Happiness/Mood controls
  panel.appendChild(el('hr', ''));
  panel.appendChild(buildPikachuSection());

  panel.appendChild(el('hr', ''));
  const [bagSection, bagList] = buildItemsSection();
  bagListEl = bagList;
  panel.appendChild(bagSection);
}

/** Live-refresh displayed values without rebuilding DOM. */
function refreshPanel(): void {
  if (currentBattle && playerRefs) {
    refreshMon(currentBattle.playerPokemon, playerRefs);
    // Force-sync display HP so the in-game HUD matches immediately
    currentBattle.playerDisplayHp = currentBattle.playerPokemon.currentHp;
  }
  if (currentBattle && enemyRefs) {
    refreshMon(currentBattle.enemyPokemon, enemyRefs);
    currentBattle.enemyDisplayHp = currentBattle.enemyPokemon.currentHp;
  }
  if (!currentBattle && partyRefs && currentParty && currentParty.length > 0) {
    refreshMon(currentParty[0], partyRefs);
  }
  if (currentBattle && battleInfoEl) {
    const p = currentBattle.playerPokemon;
    const e = currentBattle.enemyPokemon;
    const trainerInfo = currentBattle.isTrainerBattle ? ' [TRAINER]' : '';
    const html =
      `<span style="color:#ff0">State: ${currentBattle.state}${trainerInfo}</span><br>` +
      `<span style="color:#ff0">Spd: ${p.speed} vs ${e.speed}</span> ` +
      `<span style="color:#8f8">EXP:${p.exp}</span><br>` +
      `<span style="color:#f80">CR:${e.species.catchRate} BX:${e.species.baseExp}</span>`;
    if (battleInfoEl.innerHTML !== html) battleInfoEl.innerHTML = html;
  }
  if (overworldInfoEl && currentPlayer) {
    const p = currentPlayer;
    const mapName = currentMap?.mapData?.name ?? '?';
    const html =
      `<span style="color:#0f0">Map: ${mapName}</span><br>` +
      `<span style="color:#0f0">tile:${p.tileX},${p.tileY}  step:${Math.floor(p.tileX/2)},${Math.floor(p.tileY/2)}</span><br>` +
      `<span style="color:#0f0">px:${Math.round(p.x)},${Math.round(p.y)}  dir:${p.direction}</span>`;
    if (overworldInfoEl.innerHTML !== html) overworldInfoEl.innerHTML = html;
  }
  if (bagListEl && currentBag) {
    const text = currentBag.items.length === 0
      ? '(empty)'
      : currentBag.items.map(i => `${getItemName(i.id)} x${i.count}`).join(', ');
    if (bagListEl.textContent !== text) bagListEl.textContent = text;
  }
  // Hide skip intro button once intro is completed
  if (skipIntroRow) {
    skipIntroRow.style.display = hasFlag('GOT_POKEDEX') ? 'none' : 'flex';
  }
  // Sync pikachu sliders if changed externally (walking/battle)
  if (pikaHappinessInput && document.activeElement !== pikaHappinessInput) {
    const h = String(getPikachuHappiness());
    if (pikaHappinessInput.value !== h) {
      pikaHappinessInput.value = h;
      if (pikaHappinessLabel) pikaHappinessLabel.textContent = `Happiness: ${h}`;
    }
  }
  if (pikaMoodInput && document.activeElement !== pikaMoodInput) {
    const m = String(getPikachuMood());
    if (pikaMoodInput.value !== m) {
      pikaMoodInput.value = m;
      if (pikaMoodLabel) pikaMoodLabel.textContent = `Mood: ${m}`;
    }
  }
}

function refreshMon(mon: BattlePokemon, refs: LiveRefs): void {
  // Header (level may change)
  const headerText = `${mon.nickname} Lv${mon.level}`;
  if (!refs.header.textContent?.endsWith(headerText)) {
    refs.header.innerHTML = refs.header.innerHTML.replace(/:.+/, `: ${headerText}</b>`);
  }

  // HP label
  const hpText = ` / ${mon.maxHp} `;
  if (refs.hpLabel.textContent !== hpText) refs.hpLabel.textContent = hpText;
  // Only update input if user isn't focused on it
  if (document.activeElement !== refs.hpInput) {
    const hpVal = String(mon.currentHp);
    if (refs.hpInput.value !== hpVal) refs.hpInput.value = hpVal;
    refs.hpInput.max = String(mon.maxHp);
  }

  // EXP
  const expText = mon.level >= 100
    ? `EXP: ${mon.exp} (MAX)`
    : `EXP: ${mon.exp} / ${totalExpForLevel(mon.species.growthRate, mon.level + 1)}  (${expToNextLevel(mon.species.growthRate, mon.level, mon.exp)} to next)`;
  if (refs.expLabel.textContent !== expText) refs.expLabel.textContent = expText;

  // Stats
  const statsText = `Atk:${mon.attack} Def:${mon.defense} Spd:${mon.speed} Spc:${mon.special}`;
  if (refs.statsLabel.textContent !== statsText) refs.statsLabel.textContent = statsText;

  // Status highlights
  for (const { status, btn: b } of refs.statusBtns) {
    b.style.background = mon.status === status ? '#558' : '#333';
  }

  // Stat stages
  for (const { stat, el: label } of refs.stageLabels) {
    const abbr = statAbbr(stat);
    const stageText = `${abbr}: ${fmtStage(mon.statStages[stat])}`;
    if (label.textContent !== stageText) label.textContent = stageText;
  }
}

function buildPokemonSection(label: string, mon: BattlePokemon, color: string): [HTMLDivElement, LiveRefs] {
  const section = el('div', '') as HTMLDivElement;
  section.style.cssText = `margin-bottom: 12px; border: 1px solid ${color}; border-radius: 4px; padding: 6px;`;

  // Header
  const header = el('div', `<b style="color:${color}">${label}: ${mon.nickname} Lv${mon.level}</b>`);
  section.appendChild(header);

  // HP
  const hpRow = row();
  hpRow.appendChild(el('span', 'HP: '));
  const hpInput = numInput(mon.currentHp, 0, mon.maxHp, 40);
  hpRow.appendChild(hpInput);
  const hpLabel = el('span', ` / ${mon.maxHp} `);
  hpRow.appendChild(hpLabel);
  hpRow.appendChild(btn('Set', () => {
    mon.currentHp = clamp(parseInt(hpInput.value) || 0, 0, mon.maxHp);
  }));
  hpRow.appendChild(btn('1', () => { mon.currentHp = 1; }));
  hpRow.appendChild(btn('Full', () => { mon.currentHp = mon.maxHp; }));
  section.appendChild(hpRow);

  // EXP
  const nextLvlExp = totalExpForLevel(mon.species.growthRate, mon.level + 1);
  const toNext = expToNextLevel(mon.species.growthRate, mon.level, mon.exp);
  const expRow = row();
  const expLabel = el('span', '');
  expLabel.style.cssText = 'color: #8f8; font-size: 11px;';
  expLabel.textContent = mon.level >= 100
    ? `EXP: ${mon.exp} (MAX)`
    : `EXP: ${mon.exp} / ${nextLvlExp}  (${toNext} to next)`;
  expRow.appendChild(expLabel);
  if (mon.level < 100) {
    expRow.appendChild(btn('Near Lvl', () => {
      mon.exp = totalExpForLevel(mon.species.growthRate, mon.level + 1) - 1;
    }));
  }
  section.appendChild(expRow);

  // Stats (Atk/Def/Spd/Spc) — live-updated to show badge boosts
  const statsLabel = el('div', '');
  statsLabel.style.cssText = 'color: #adf; font-size: 11px; margin: 2px 0;';
  statsLabel.textContent = `Atk:${mon.attack} Def:${mon.defense} Spd:${mon.speed} Spc:${mon.special}`;
  section.appendChild(statsLabel);

  // Status
  const statusRow = row();
  statusRow.appendChild(el('span', 'Status: '));
  const statusBtns: LiveRefs['statusBtns'] = [];
  for (const st of STATUS_OPTIONS) {
    const btnLabel = st ?? 'None';
    const b = btn(btnLabel, () => {
      // Restore stats from old status before applying new one
      if (mon.status === 'BRN') {
        mon.attack = Math.floor(((mon.species.attack + mon.atkDV) * 2 * mon.level) / 100) + 5;
      } else if (mon.status === 'PAR') {
        mon.speed = Math.floor(((mon.species.speed + mon.spdDV) * 2 * mon.level) / 100) + 5;
      }
      mon.status = st;
      mon.sleepTurns = 0;
      mon.toxicCounter = 0;
      mon.badlyPoisoned = false;
      // Apply stat modifications for new status
      if (st === 'SLP') {
        mon.sleepTurns = 3; // default debug sleep turns
      } else if (st === 'BRN') {
        mon.attack = Math.max(1, Math.floor(mon.attack / 2));
      } else if (st === 'PAR') {
        mon.speed = Math.max(1, Math.floor(mon.speed / 4));
      }
    });
    b.style.fontSize = '10px';
    b.style.padding = '1px 4px';
    statusBtns.push({ status: st, btn: b });
    statusRow.appendChild(b);
  }
  section.appendChild(statusRow);

  // Stat stages
  section.appendChild(el('div', '<small style="color:#aaa">Stat Stages (-6 to +6):</small>'));
  const stageLabels: LiveRefs['stageLabels'] = [];
  for (const stat of STAGE_STATS) {
    const stageRow = row();
    const abbr = statAbbr(stat);
    const valSpan = el('span', `${abbr}: ${fmtStage(mon.statStages[stat])}`);
    valSpan.style.cssText = 'display:inline-block; width: 60px;';
    stageLabels.push({ stat, el: valSpan });
    stageRow.appendChild(valSpan);
    stageRow.appendChild(btn('-', () => {
      mon.statStages[stat] = clamp(mon.statStages[stat] - 1, -6, 6);
    }));
    stageRow.appendChild(btn('+', () => {
      mon.statStages[stat] = clamp(mon.statStages[stat] + 1, -6, 6);
    }));
    stageRow.appendChild(btn('0', () => {
      mon.statStages[stat] = 0;
    }));
    section.appendChild(stageRow);
  }

  const refs: LiveRefs = { header, hpLabel, hpInput, expLabel, statsLabel, statusBtns, stageLabels };
  return [section, refs];
}

function buildPartySection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin-bottom: 12px;';
  section.appendChild(el('div', '<b style="color:#4cf">PARTY</b>'));

  if (!currentParty) {
    section.appendChild(el('div', '<i style="color:#888">No party</i>'));
    return section;
  }

  const party = currentParty;

  // Species datalist (shared by all inputs)
  const datalistId = 'debug-species-list';
  let datalist = document.getElementById(datalistId) as HTMLDataListElement | null;
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = datalistId;
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = '';
  for (const name of getAllSpeciesNames()) {
    const opt = document.createElement('option');
    opt.value = name;
    datalist.appendChild(opt);
  }

  // Per-slot rows
  for (let i = 0; i < party.length; i++) {
    const mon = party[i];
    const slotRow = row();
    slotRow.style.cssText += 'justify-content: space-between;';

    const label = el('span', `#${i + 1} <b>${mon.nickname}</b> Lv${mon.level}`);
    label.style.cssText = 'color: #ccc; font-size: 11px; min-width: 120px;';
    slotRow.appendChild(label);

    const btnGroup = row();
    btnGroup.style.margin = '0';

    // Replace button & inline edit
    const editContainer = document.createElement('div');
    editContainer.style.cssText = 'display: none; margin: 2px 0;';

    const replaceBtn = btn('Replace', () => {
      editContainer.style.display = editContainer.style.display === 'none' ? 'flex' : 'none';
    });
    replaceBtn.style.fontSize = '10px';
    replaceBtn.style.padding = '1px 4px';

    const speciesInput = document.createElement('input');
    speciesInput.type = 'text';
    speciesInput.placeholder = 'Species';
    speciesInput.setAttribute('list', datalistId);
    speciesInput.style.cssText = 'width: 90px; background: #222; color: #eee; border: 1px solid #555; border-radius: 2px; font: 11px monospace; padding: 1px 3px;';

    const levelInput = numInput(mon.level, 1, 100, 36);

    const applyBtn = btn('OK', () => {
      const name = speciesInput.value.trim();
      const lvl = clamp(parseInt(levelInput.value) || 5, 1, 100);
      const newMon = createPokemon(name, lvl);
      if (newMon) {
        markOwned(newMon.species.id);
        party[i] = newMon;
        needsRebuild = true;
      }
    });
    applyBtn.style.fontSize = '10px';
    applyBtn.style.padding = '1px 4px';

    editContainer.style.cssText += 'align-items: center; gap: 3px; flex-wrap: wrap;';
    editContainer.appendChild(speciesInput);
    editContainer.appendChild(el('span', 'Lv'));
    editContainer.appendChild(levelInput);
    editContainer.appendChild(applyBtn);

    // Remove button
    const removeBtn = btn('Remove', () => {
      party.splice(i, 1);
      needsRebuild = true;
    });
    removeBtn.style.fontSize = '10px';
    removeBtn.style.padding = '1px 4px';
    removeBtn.style.background = '#633';

    btnGroup.appendChild(replaceBtn);
    btnGroup.appendChild(removeBtn);
    slotRow.appendChild(btnGroup);

    section.appendChild(slotRow);
    section.appendChild(editContainer);
  }

  // Add row (if party < 6)
  if (party.length < 6) {
    const addContainer = row();
    addContainer.style.cssText += 'margin-top: 6px; border-top: 1px solid #444; padding-top: 6px;';

    const addSpecies = document.createElement('input');
    addSpecies.type = 'text';
    addSpecies.placeholder = 'Species';
    addSpecies.setAttribute('list', datalistId);
    addSpecies.style.cssText = 'width: 90px; background: #222; color: #eee; border: 1px solid #555; border-radius: 2px; font: 11px monospace; padding: 1px 3px;';

    const addLevel = numInput(5, 1, 100, 36);

    const addBtn = btn('+ Add', () => {
      const name = addSpecies.value.trim();
      const lvl = clamp(parseInt(addLevel.value) || 5, 1, 100);
      const newMon = createPokemon(name, lvl);
      if (newMon) {
        newMon.otName = getPlayerName();
        markOwned(newMon.species.id);
        party.push(newMon);
        needsRebuild = true;
      }
    });
    addBtn.style.background = '#363';
    addBtn.style.fontSize = '10px';
    addBtn.style.padding = '2px 6px';

    addContainer.appendChild(addSpecies);
    addContainer.appendChild(el('span', 'Lv'));
    addContainer.appendChild(addLevel);
    addContainer.appendChild(addBtn);
    section.appendChild(addContainer);
  }

  return section;
}

// Badge display names (strip BADGE_ prefix, title-case)
const BADGE_NAMES: Record<string, string> = {
  BADGE_1: 'Badge 1',
  BADGE_2: 'Badge 2',
  BADGE_3: 'Badge 3',
  BADGE_4: 'Badge 4',
  BADGE_5: 'Badge 5',
  BADGE_6: 'Badge 6',
  BADGE_7: 'Badge 7',
  BADGE_8: 'Badge 8',
};

function buildBadgesSection(): HTMLElement {
  const section = document.createElement('div');
  section.appendChild(el('div', '<b style="color:#f80">BADGES</b>'));

  // Two rows of 4 badges
  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; margin: 6px 0;';

  for (const flag of BADGE_FLAGS) {
    const name = BADGE_NAMES[flag] ?? flag;
    const owned = hasFlag(flag);
    const b = btn(name, () => {
      if (hasFlag(flag)) {
        clearFlag(flag);
      } else {
        setFlag(flag);
      }
      needsRebuild = true;
    });
    b.style.fontSize = '10px';
    b.style.padding = '3px 2px';
    b.style.textAlign = 'center';
    if (owned) {
      b.style.background = '#b87333';
      b.style.color = '#fff';
      b.style.borderColor = '#da8';
    } else {
      b.style.background = '#2a2a2a';
      b.style.color = '#666';
      b.style.borderColor = '#444';
    }
    // Override hover for owned badges
    const ownedNow = owned;
    b.onmouseenter = () => { b.style.background = ownedNow ? '#d08040' : '#444'; };
    b.onmouseleave = () => { b.style.background = ownedNow ? '#b87333' : '#2a2a2a'; };
    grid.appendChild(b);
  }
  section.appendChild(grid);

  // Toggle all buttons
  const allRow = row();
  const allOnBtn = btn('Grant All', () => {
    for (const flag of BADGE_FLAGS) setFlag(flag);
    needsRebuild = true;
  });
  allOnBtn.style.fontSize = '10px';
  allOnBtn.style.padding = '2px 6px';
  allOnBtn.style.background = '#363';
  const allOffBtn = btn('Remove All', () => {
    for (const flag of BADGE_FLAGS) clearFlag(flag);
    needsRebuild = true;
  });
  allOffBtn.style.fontSize = '10px';
  allOffBtn.style.padding = '2px 6px';
  allOffBtn.style.background = '#633';
  allRow.appendChild(allOnBtn);
  allRow.appendChild(allOffBtn);
  section.appendChild(allRow);

  return section;
}

function buildItemsSection(): [HTMLDivElement, HTMLElement] {
  const section = el('div', '') as HTMLDivElement;
  section.appendChild(el('div', '<b style="color:#ff0">BAG</b>'));

  const listDiv = el('div', '') as HTMLDivElement;
  listDiv.style.cssText = 'margin: 4px 0; color: #ccc; font-size: 11px;';
  if (currentBag) {
    listDiv.textContent = currentBag.items.length === 0
      ? '(empty)'
      : currentBag.items.map(i => `${getItemName(i.id)} x${i.count}`).join(', ');
  } else {
    listDiv.textContent = '(no bag)';
  }
  section.appendChild(listDiv);

  if (currentBag) {
    const bag = currentBag;
    const addRow = row();
    addRow.style.cssText += 'align-items: center; gap: 3px; flex-wrap: wrap;';

    const itemSelect = document.createElement('select');
    itemSelect.style.cssText = 'width: 120px; background: #222; color: #eee; border: 1px solid #555; border-radius: 2px; font: 10px monospace; padding: 1px 3px;';
    for (const id of getAllItemIds()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = getItemName(id);
      itemSelect.appendChild(opt);
    }
    addRow.appendChild(itemSelect);

    const qtyLabel = el('span', 'x');
    qtyLabel.style.cssText = 'color: #aaa; font-size: 10px;';
    addRow.appendChild(qtyLabel);

    const qtyInput = numInput(1, 1, 99, 36);
    addRow.appendChild(qtyInput);

    const addBtn = btn('Add', () => {
      const qty = clamp(parseInt(qtyInput.value) || 1, 1, 99);
      bag.add(itemSelect.value, qty);
      needsRebuild = true;
    });
    addBtn.style.fontSize = '10px';
    addBtn.style.padding = '1px 4px';
    addRow.appendChild(addBtn);

    section.appendChild(addRow);
  }

  return [section, listDiv];
}

// ──────── Pikachu Happiness/Mood ────────

const MOOD_PRESETS: [string, number, number][] = [
  ['Very Sad',    20,  30],
  ['Sad',         60,  80],
  ['Neutral',     90,  128],
  ['Happy',       160, 170],
  ['Very Happy',  220, 200],
  ['Max Love',    255, 255],
];

function buildPikachuSection(): HTMLElement {
  const section = document.createElement('div');
  section.appendChild(el('div', '<b style="color:#ff0">FOLLOWER MOOD</b>'));

  // Happiness slider
  const hRow = row();
  const hLabel = el('span', `Happiness: ${getPikachuHappiness()}`);
  hLabel.style.cssText = 'color: #ff0; min-width: 110px; font-size: 11px;';
  pikaHappinessLabel = hLabel;
  const hSlider = document.createElement('input');
  hSlider.type = 'range'; hSlider.min = '0'; hSlider.max = '255';
  hSlider.value = String(getPikachuHappiness());
  hSlider.style.cssText = 'flex: 1; accent-color: #ff0;';
  hSlider.oninput = () => {
    restorePikachuHappiness(Number(hSlider.value), Number(pikaMoodInput?.value ?? 128));
    hLabel.textContent = `Happiness: ${hSlider.value}`;
  };
  pikaHappinessInput = hSlider;
  hRow.appendChild(hLabel);
  hRow.appendChild(hSlider);
  section.appendChild(hRow);

  // Mood slider
  const mRow = row();
  const mLabel = el('span', `Mood: ${getPikachuMood()}`);
  mLabel.style.cssText = 'color: #0ff; min-width: 110px; font-size: 11px;';
  pikaMoodLabel = mLabel;
  const mSlider = document.createElement('input');
  mSlider.type = 'range'; mSlider.min = '0'; mSlider.max = '255';
  mSlider.value = String(getPikachuMood());
  mSlider.style.cssText = 'flex: 1; accent-color: #0ff;';
  mSlider.oninput = () => {
    restorePikachuHappiness(Number(pikaHappinessInput?.value ?? 90), Number(mSlider.value));
    mLabel.textContent = `Mood: ${mSlider.value}`;
  };
  pikaMoodInput = mSlider;
  mRow.appendChild(mLabel);
  mRow.appendChild(mSlider);
  section.appendChild(mRow);

  // Preset buttons
  const presetRow = row();
  for (const [name, h, m] of MOOD_PRESETS) {
    const b = btn(name, () => {
      restorePikachuHappiness(h, m);
      hSlider.value = String(h);
      mSlider.value = String(m);
      hLabel.textContent = `Happiness: ${h}`;
      mLabel.textContent = `Mood: ${m}`;
    });
    b.style.fontSize = '10px';
    b.style.padding = '2px 4px';
    presetRow.appendChild(b);
  }
  section.appendChild(presetRow);

  return section;
}

// ──────── DOM Helpers ────────

function el(tag: string, html: string): HTMLElement {
  const e = document.createElement(tag);
  e.innerHTML = html;
  return e;
}

function row(): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = 'display: flex; align-items: center; gap: 3px; margin: 3px 0; flex-wrap: wrap;';
  return d;
}

function btn(text: string, onclick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.onclick = onclick;
  b.style.cssText = 'background: #333; color: #eee; border: 1px solid #666; border-radius: 3px; padding: 2px 6px; cursor: pointer; font: 11px monospace;';
  b.onmouseenter = () => { b.style.background = '#555'; };
  b.onmouseleave = () => { b.style.background = '#333'; };
  return b;
}

function numInput(value: number, min: number, max: number, width: number): HTMLInputElement {
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.value = String(value);
  inp.min = String(min);
  inp.max = String(max);
  inp.style.cssText = `width: ${width}px; background: #222; color: #eee; border: 1px solid #555; border-radius: 2px; font: 11px monospace; padding: 1px 3px;`;
  return inp;
}

function statAbbr(stat: string): string {
  switch (stat) {
    case 'special': return 'Spc';
    case 'accuracy': return 'Acc';
    case 'evasion': return 'Eva';
    default: return stat.charAt(0).toUpperCase() + stat.slice(1, 3);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function fmtStage(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}
