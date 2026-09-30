// Battle state machine controller

import type { BattlePokemon, BattleState } from './types';
import { calculateDamage, getStatEffect, applyStatStage, applyBadgeStatBoosts } from './damage';
import { getMove, createPokemon } from './data';
import { calcExpGain, gainExperience, forceLearnMove } from './experience';
import { attemptCatch } from './catch';
import { tryRunFromBattle } from './run';
import { checkPreTurnStatus, tryInflictStatus, applyEndOfTurnDamage, isStatusEffect, checkFireThaw } from './status';
import {
  checkVolatilePreTurn, applyVolatileEndOfTurn,
  isLockedIntoMove, isMoveDisabled, shouldSkipAccuracy,
  handleSubstitute, handleHaze, handleLeechSeed, handleScreen,
  handleMist, handleFocusEnergy, handleConfusion, handleHeal,
  handleTransform, handleConversion, handleMimic, handleDisable,
  selectMetronomeMove, selectMirrorMove, handleSplash,
  handleSwitchAndTeleport, handleOHKO, handleSuperFang,
  handleBideStart, handleCounter, handleHyperBeam,
  handleRecoil, handleDrain, handleExplode, handlePayDay,
  rollMultiHitCount, handleRageStart, handleRageHit,
  handleThrashStart, handleTrappingStart, handleChargeTurn,
  handleFlinchSideEffect, handleConfusionSideEffect,
  handleJumpKickCrash, checkSubstitute, isBlockedByMist,
  isNonDamagingEffect, isPriorityMove, isCounterMove, isStruggle,
} from './effects';
import { createVolatiles } from './volatiles';
import type { BallType } from './catch';
import type { Bag } from '../items';
import { getItemName, isBall } from '../items';
import { isPressed } from '../input';
import { getCtx } from '../renderer';
import { playSFX } from '../audio';
import {
  renderBattleBg, renderEnemySprite, renderPlayerSprite, renderPlayerSpriteScaled,
  renderEnemyHUD, renderPlayerHUD, renderBattleText,
  renderActionMenu, renderMoveMenu, renderItemMenu, loadPokemonSprites,
  loadTrainerIntroAssets, renderTrainerSpriteAt, renderPokeballs, getTrainerIntroLayout,
  createSilhouette, loadPlayerTrainerSprite, renderPoofEffect, renderPlayerSpriteSliding,
  renderYesNoMenu, renderLearnMoveSelect, renderBlackoutOverlay,
  renderPlayerSpriteFaintSlide, renderEnemySpriteFaintSlide,
} from './battle_ui';
import type { TrainerIntroAssets } from './battle_ui';
import { selectTrainerMove } from './trainer_ai';
import type { TrainerClassData, TrainerPartyMember } from './trainer_ai';
import { PartyMenu } from '../menus/party_menu';
import { modifyPikachuHappiness } from '../pikachu';
import { getText } from '../text/game_text';

// Trainer intro animation constants
const SLIDE_IN_FRAMES = 40;
const COLORIZE_FRAMES = 15;
const SEND_OUT_FRAMES = 30;
const SLIDE_OFFSET_OUT = 80; // how far trainers slide out when sending Pokemon

// Switch animation constants (assembly: AnimateRetreatingPlayerMon / AnimateSendingOutMon)
const SHRINK_STEP1 = 12;  // frames at 5/7 scale
const SHRINK_STEP2 = 10;  // frames at 3/7 scale
const SHRINK_TOTAL = SHRINK_STEP1 + SHRINK_STEP2;
const POOF_FRAMES = 14;   // poof star-burst duration
const GROW_STEP1 = 12;    // frames at 3/7 scale
const GROW_STEP2 = 14;    // frames at 5/7 scale
const GROW_TOTAL = GROW_STEP1 + GROW_STEP2;

// Pikachu slide animation constants (assembly: AnimationSlideMonOff / StarterPikachuBattleEntranceAnimation)
// Pikachu slides left off screen instead of shrinking (doesn't use a pokeball in Yellow)
const PIKA_SLIDE_DISTANCE = 64;  // 8 tiles × 8px = 64px (assembly: e=8 tiles)
const PIKA_SLIDE_FRAMES = 24;    // 8 tiles × 3 frames each (assembly: wSlideMonDelay=3)

/** Check if a Pokemon is (starter) Pikachu — uses slide animation instead of shrink/grow. */
function isPikachu(mon: BattlePokemon): boolean {
  return mon.species.id === 25;
}

/** Get sprite display scale for switch animation. */
function getSwitchAnimScale(phase: 'shrink' | 'grow', frame: number): number {
  if (phase === 'shrink') {
    if (frame < SHRINK_STEP1) return 5 / 7;
    if (frame < SHRINK_TOTAL) return 3 / 7;
    return 0;
  } else {
    if (frame < GROW_STEP1) return 3 / 7;
    if (frame < GROW_TOTAL) return 5 / 7;
    return 1;
  }
}

// Wild battle intro constants (assembly: SlidePlayerAndEnemySilhouettesOnScreen)
const WILD_SLIDE_FRAMES = 40;     // frames for slide-in
const WILD_SLIDE_OFFSET = 160;    // pixels off-screen (full screen width)

type TrainerIntroPhase =
  | 'slide_in' | 'colorize' | 'pokeballs_text'
  | 'send_enemy' | 'send_enemy_text'
  | 'send_player' | 'send_player_text';

type WildIntroPhase = 'slide_in' | 'colorize' | 'appeared_text' | 'send_player' | 'send_pokemon' | 'go_text';

// Colorize phase duration (silhouette → full color)
const WILD_COLORIZE_FRAMES = 15;

interface BattleSprites {
  enemyFront: HTMLCanvasElement;
  playerBack: HTMLCanvasElement;
  enemySilhouette: HTMLCanvasElement;
  playerSilhouette: HTMLCanvasElement;
}

export class Battle {
  state: BattleState = 'intro';
  playerPokemon: BattlePokemon;
  enemyPokemon: BattlePokemon;
  finished = false;

  // Result info for main.ts to read after battle ends
  caughtPokemon: BattlePokemon | null = null;
  expGained = 0;
  moneyWon = 0;
  levelsGained = 0;
  playerPokemonFainted = false;
  carelessTrainerFaint = false;
  isBlackout = false;      // true when all party Pokemon fainted (main.ts checks this)
  onVictory: (() => void) | null = null; // called when last enemy faints (for victory music)
  private playerName = ''; // for blackout text

  // Trainer battle info
  isTrainerBattle = false;
  private trainerClass: TrainerClassData | null = null;
  private trainerParty: BattlePokemon[] = [];
  private trainerPartyIndex = 0;
  private trainerName = '';

  playerParty: BattlePokemon[] = [];
  private badges: ReadonlySet<string> = new Set();
  private bag: Bag | null = null;
  private sprites: BattleSprites | null = null;
  private textLines: string[] = [];
  private textQueue: string[][] = [];
  private waitingForInput = false;
  private actionCursor = 0;
  private moveCursor = 0;
  private itemCursor = 0;
  private introStep = 0;

  // HP animation (public so debug panel can force-sync)
  playerDisplayHp: number;
  enemyDisplayHp: number;
  private animatingHp = false;
  private hpAnimFrame = 0;

  // Trainer intro animation
  private trainerIntroPhase: TrainerIntroPhase | null = null;
  private trainerIntroTimer = 0;
  private trainerAssets: TrainerIntroAssets | null = null;
  private enemySideOffset = 0;   // offset from final X (positive = right of final)
  private playerSideOffset = 0;  // offset from final X (positive = right of final, same pan)
  private trainerColorT = 0;     // 0 = silhouette, 1 = fully colored
  private sendT = 0;             // 0-1 progress for send-out slide animation

  // Wild battle intro animation
  private wildIntroPhase: WildIntroPhase | null = null;
  private wildIntroTimer = 0;
  private wildSlideOffset = 0;  // current offset (decreases to 0)
  private wildColorT = 0;       // 0 = silhouette, 1 = fully colored
  private wildPlayerTrainer: HTMLCanvasElement | null = null;
  private wildPlayerTrainerSil: HTMLCanvasElement | null = null;
  private wildPlayerOffset = 0; // player trainer slide-out offset

  // Delay timer: counts down each frame, then calls the callback
  private delayTimer = 0;
  private delayCallback: (() => void) | null = null;

  // Minimum display time for text (prevents mashing through messages)
  private textMinTimer = 0;

  // Turn execution
  private turnOrder: ('player' | 'enemy')[] = [];
  private turnIndex = 0;
  private playerMoveId = '';
  private enemyMoveId = '';
  private endOfTurnDone = false;
  private numRunAttempts = 0;

  // Pokemon switching
  private partyMenu = new PartyMenu();
  private switchingToIndex = -1;
  private forcedSwitch = false;

  // Learn-move interactive flow (when moveset is full on level-up)
  private learnMoveQueue: { pokemon: BattlePokemon; moveId: string }[] = [];
  private learnMoveCurrent: { pokemon: BattlePokemon; moveId: string } | null = null;
  private yesNoCursor = 0;
  private learnMoveSelectCursor = 0;

  // Faint slide-down animation (assembly: SlideDownFaintedMonPic)
  // 7 rows, 2 frames per row = 14 frames total
  private faintAnimating = false;
  private faintAnimFrame = 0;
  private faintAnimTarget: 'player' | 'enemy' | null = null;
  private playerFaintDone = false;  // player sprite+HUD hidden after faint anim
  private enemyFaintDone = false;   // enemy sprite+HUD hidden after faint anim

  // Switch animation (assembly: AnimateRetreatingPlayerMon / AnimateSendingOutMon)
  // 3-step shrink: full → 5/7 → 3/7 → gone; 3-step grow: 3/7 → 5/7 → full
  private switchAnimating = false;
  private switchAnimFrame = 0;
  private switchAnimPhase: 'shrink' | 'poof' | 'grow' | 'slide_out' | 'slide_in' | null = null;

  constructor(player: BattlePokemon, enemy: BattlePokemon, party?: BattlePokemon[], bag?: Bag, badges?: ReadonlySet<string>, playerName?: string) {
    this.playerPokemon = player;
    this.enemyPokemon = enemy;
    if (party) this.playerParty = party;
    this.bag = bag ?? null;
    this.badges = badges ?? new Set();
    this.playerName = playerName ?? 'RED';
    this.playerDisplayHp = player.currentHp;
    this.enemyDisplayHp = enemy.currentHp;
    // Reset stat stages, status tracking, and volatiles for both Pokemon at battle start
    player.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
    enemy.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
    player.toxicCounter = 0;
    player.badlyPoisoned = false;
    enemy.toxicCounter = 0;
    enemy.badlyPoisoned = false;
    player.volatiles = createVolatiles();
    enemy.volatiles = createVolatiles();
    player.originalStats = { attack: player.attack, defense: player.defense, speed: player.speed, special: player.special };
    enemy.originalStats = { attack: enemy.attack, defense: enemy.defense, speed: enemy.speed, special: enemy.special };
    // Apply badge stat boosts to player's Pokemon on battle entry (assembly: ApplyBadgeStatBoosts)
    applyBadgeStatBoosts(player, this.badges);
  }

  /** Set up a trainer battle. Call before init(). */
  setupTrainerBattle(
    trainerClass: TrainerClassData,
    partyMembers: TrainerPartyMember[],
    trainerName?: string,
  ): void {
    this.isTrainerBattle = true;
    this.trainerClass = trainerClass;
    this.trainerName = trainerName ?? trainerClass.displayName;

    // Build trainer's party from member data
    this.trainerParty = [];
    for (const member of partyMembers) {
      const pokemon = createPokemon(member.species, member.level);
      if (!pokemon) continue;

      // Apply move overrides (Yellow-specific special moves)
      if (member.moveOverrides) {
        for (const [slotStr, moveId] of Object.entries(member.moveOverrides)) {
          const slot = parseInt(slotStr) - 1; // 1-based → 0-based
          if (slot >= 0 && slot < pokemon.moves.length) {
            const moveData = getMove(moveId);
            pokemon.moves[slot] = {
              id: moveId,
              pp: moveData?.pp ?? 10,
              maxPp: moveData?.pp ?? 10,
            };
          } else if (slot >= pokemon.moves.length && slot < 4) {
            // Add move to an empty slot
            const moveData = getMove(moveId);
            pokemon.moves.push({
              id: moveId,
              pp: moveData?.pp ?? 10,
              maxPp: moveData?.pp ?? 10,
            });
          }
        }
      }

      this.trainerParty.push(pokemon);
    }

    // Set the first trainer Pokemon as the enemy
    if (this.trainerParty.length > 0) {
      this.enemyPokemon = this.trainerParty[0];
      this.trainerPartyIndex = 0;
      this.enemyDisplayHp = this.enemyPokemon.currentHp;
      // Reset stat stages
      this.enemyPokemon.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
      this.enemyPokemon.toxicCounter = 0;
      this.enemyPokemon.badlyPoisoned = false;
    }
  }

  async init(): Promise<void> {
    const loadPromises: Promise<unknown>[] = [
      loadPokemonSprites(this.enemyPokemon.species.name.toLowerCase(), this.enemyPokemon.species.id),
      loadPokemonSprites(this.playerPokemon.species.name.toLowerCase(), this.playerPokemon.species.id),
    ];
    // Also load trainer sprites
    if (this.isTrainerBattle && this.trainerClass) {
      loadPromises.push(loadTrainerIntroAssets(this.trainerClass.displayName, this.trainerClass.id));
    } else {
      // Wild battle: load Red's backsprite for intro
      loadPromises.push(loadPlayerTrainerSprite());
    }

    const results = await Promise.all(loadPromises);
    const enemySprites = results[0] as { front: HTMLCanvasElement; back: HTMLCanvasElement };
    const playerSprites = results[1] as { front: HTMLCanvasElement; back: HTMLCanvasElement };
    this.sprites = {
      enemyFront: enemySprites.front,
      playerBack: playerSprites.back,
      enemySilhouette: createSilhouette(enemySprites.front),
      playerSilhouette: createSilhouette(playerSprites.back),
    };

    if (this.isTrainerBattle && results[2]) {
      // Start trainer intro animation
      this.trainerAssets = results[2] as TrainerIntroAssets;
      const layout = getTrainerIntroLayout();
      this.state = 'trainer_intro';
      this.trainerIntroPhase = 'slide_in';
      this.trainerIntroTimer = 0;
      // Enemy starts far LEFT, slides RIGHT to final position
      this.enemySideOffset = -layout.slideOffset;
      // Player starts far RIGHT, slides LEFT to final position
      this.playerSideOffset = layout.slideOffset;
      this.trainerColorT = 0;
    } else {
      // Wild battle — Red + wild Pokemon slide-in intro
      const playerTrainer = results[2] as { sprite: HTMLCanvasElement; silhouette: HTMLCanvasElement };
      this.wildPlayerTrainer = playerTrainer.sprite;
      this.wildPlayerTrainerSil = playerTrainer.silhouette;
      this.state = 'intro';
      this.wildIntroPhase = 'slide_in';
      this.wildIntroTimer = 0;
      this.wildSlideOffset = WILD_SLIDE_OFFSET;
      this.wildPlayerOffset = 0;
    }
  }

  private showText(lines: string[]): void {
    this.textLines = lines;
    this.waitingForInput = true;
    this.textMinTimer = 30; // ~0.5s minimum display before dismissable
  }

  private queueText(lines: string[]): void {
    this.textQueue.push(lines);
  }

  private advanceTextQueue(): boolean {
    if (this.textQueue.length > 0) {
      this.showText(this.textQueue.shift()!);
      return true;
    }
    return false;
  }

  private startDelay(frames: number, callback: () => void): void {
    this.delayTimer = frames;
    this.delayCallback = callback;
  }

  update(): void {
    // Delay timer: block all updates while counting down
    if (this.delayTimer > 0) {
      this.delayTimer--;
      if (this.delayTimer === 0 && this.delayCallback) {
        const cb = this.delayCallback;
        this.delayCallback = null;
        cb();
      }
      return;
    }

    // Animate HP bars (1 HP per 3 frames for visible speed)
    if (this.animatingHp) {
      this.hpAnimFrame++;
      if (this.hpAnimFrame < 3) return;
      this.hpAnimFrame = 0;

      let done = true;
      if (this.playerDisplayHp > this.playerPokemon.currentHp) {
        this.playerDisplayHp = Math.max(this.playerPokemon.currentHp, this.playerDisplayHp - 1);
        done = false;
      } else if (this.playerDisplayHp < this.playerPokemon.currentHp) {
        this.playerDisplayHp = Math.min(this.playerPokemon.currentHp, this.playerDisplayHp + 1);
        done = false;
      }
      if (this.enemyDisplayHp > this.enemyPokemon.currentHp) {
        this.enemyDisplayHp = Math.max(this.enemyPokemon.currentHp, this.enemyDisplayHp - 1);
        done = false;
      } else if (this.enemyDisplayHp < this.enemyPokemon.currentHp) {
        this.enemyDisplayHp = Math.min(this.enemyPokemon.currentHp, this.enemyDisplayHp + 1);
        done = false;
      }
      if (done) {
        this.animatingHp = false;
        // Pause after HP animation before continuing
        this.startDelay(20, () => this.continueAfterAnimation());
      }
      return;
    }

    // Switch animation: shrink/poof/grow (normal) or slide_out/slide_in (Pikachu)
    if (this.switchAnimating) {
      this.switchAnimFrame++;
      if (this.switchAnimPhase === 'shrink' && this.switchAnimFrame > SHRINK_TOTAL) {
        // Shrink done → start poof
        this.switchAnimPhase = 'poof';
        this.switchAnimFrame = 0;
      } else if (this.switchAnimPhase === 'poof' && this.switchAnimFrame >= POOF_FRAMES) {
        // Poof done → load new sprites
        this.switchAnimating = false;
        this.switchAnimPhase = null;
        this.performSwitch(this.switchingToIndex);
      } else if (this.switchAnimPhase === 'slide_out' && this.switchAnimFrame >= PIKA_SLIDE_FRAMES) {
        // Pikachu slide-out done → load new sprites (no poof for Pikachu)
        this.switchAnimating = false;
        this.switchAnimPhase = null;
        this.performSwitch(this.switchingToIndex);
      } else if (this.switchAnimPhase === 'slide_in' && this.switchAnimFrame >= PIKA_SLIDE_FRAMES) {
        // Pikachu slide-in done → same completion as grow
        this.switchAnimating = false;
        this.switchAnimPhase = null;
        this.startDelay(30, () => {
          this.textLines = [];
          if (this.forcedSwitch) {
            this.forcedSwitch = false;
            this.state = 'choose_action';
            this.waitingForInput = false;
          } else {
            this.enemyMoveId = this.selectEnemyMove();
            this.turnOrder = ['enemy'];
            this.turnIndex = 0;
            this.endOfTurnDone = false;
            this.startDelay(30, () => {
              this.state = 'execute_turn';
            });
          }
        });
      } else if (this.switchAnimPhase === 'grow' && this.switchAnimFrame > GROW_TOTAL) {
        // Grow done → auto-advance after short delay
        this.switchAnimating = false;
        this.switchAnimPhase = null;
        this.startDelay(30, () => {
          this.textLines = [];
          if (this.forcedSwitch) {
            this.forcedSwitch = false;
            this.state = 'choose_action';
            this.waitingForInput = false;
          } else {
            // Voluntary switch costs a turn — enemy attacks
            this.enemyMoveId = this.selectEnemyMove();
            this.turnOrder = ['enemy'];
            this.turnIndex = 0;
            this.endOfTurnDone = false;
            this.startDelay(30, () => {
              this.state = 'execute_turn';
            });
          }
        });
      }
      return;
    }

    switch (this.state) {
      case 'trainer_intro':
        this.updateTrainerIntro();
        break;
      case 'intro':
        this.updateIntro();
        break;
      case 'choose_action':
        this.updateActionMenu();
        break;
      case 'choose_move':
        this.updateMoveMenu();
        break;
      case 'choose_item':
        this.updateItemMenu();
        break;
      case 'choose_pokemon':
      case 'forced_switch':
        this.updateChoosePokemon();
        break;
      case 'execute_turn':
        this.executeTurn();
        break;
      case 'player_move':
      case 'enemy_move':
      case 'victory':
      case 'gain_exp':
      case 'defeat':
      case 'run_away':
      case 'run_failed':
      case 'throw_ball':
      case 'blackout':
        this.updateTextWait();
        break;
      case 'check_faint':
        if (this.faintAnimating) {
          this.updateFaintAnimation();
        } else {
          this.checkFaint();
        }
        break;
      case 'learn_move_prompt':
      case 'learn_move_confirm':
        this.updateLearnMoveYesNo();
        break;
      case 'learn_move_select':
        this.updateLearnMoveSelect();
        break;
      case 'end':
        this.finished = true;
        break;
    }
  }

  private updateTrainerIntro(): void {
    const layout = getTrainerIntroLayout();

    switch (this.trainerIntroPhase) {
      case 'slide_in':
        this.trainerIntroTimer++;
        {
          const t = Math.min(this.trainerIntroTimer / SLIDE_IN_FRAMES, 1);
          // Ease-out: decelerate into final position
          const ease = 1 - (1 - t) * (1 - t);
          // Enemy approaches from left, player from right — they meet in the middle
          this.enemySideOffset = -layout.slideOffset * (1 - ease);
          this.playerSideOffset = layout.slideOffset * (1 - ease);
        }
        if (this.trainerIntroTimer >= SLIDE_IN_FRAMES) {
          this.enemySideOffset = 0;
          this.playerSideOffset = 0;
          this.trainerIntroPhase = 'colorize';
          this.trainerIntroTimer = 0;
        }
        break;

      case 'colorize':
        this.trainerIntroTimer++;
        this.trainerColorT = Math.min(this.trainerIntroTimer / COLORIZE_FRAMES, 1);
        if (this.trainerIntroTimer >= COLORIZE_FRAMES) {
          this.trainerColorT = 1;
          this.trainerIntroPhase = 'pokeballs_text';
          this.showText([`${this.trainerName} wants`, `to fight!`]);
        }
        break;

      case 'pokeballs_text':
        // Waiting for player to dismiss "wants to fight!" text
        if (!this.waitingForInput) return;
        if (this.textMinTimer > 0) { this.textMinTimer--; return; }
        if (isPressed('a') || isPressed('b')) {
          this.waitingForInput = false;
          this.trainerIntroPhase = 'send_enemy';
          this.trainerIntroTimer = 0;
          this.sendT = 0;
        }
        break;

      case 'send_enemy':
        // Enemy trainer slides out right, enemy Pokemon slides in from right
        this.trainerIntroTimer++;
        this.sendT = Math.min(this.trainerIntroTimer / SEND_OUT_FRAMES, 1);
        this.enemySideOffset = SLIDE_OFFSET_OUT * this.sendT;
        if (this.trainerIntroTimer >= SEND_OUT_FRAMES) {
          this.enemySideOffset = SLIDE_OFFSET_OUT;
          this.trainerIntroPhase = 'send_enemy_text';
          this.showText([`${this.trainerName} sent`, `out ${this.enemyPokemon.nickname.toUpperCase()}!`]);
        }
        break;

      case 'send_enemy_text':
        if (!this.waitingForInput) return;
        if (this.textMinTimer > 0) { this.textMinTimer--; return; }
        if (isPressed('a') || isPressed('b')) {
          this.waitingForInput = false;
          this.trainerIntroPhase = 'send_player';
          this.trainerIntroTimer = 0;
          this.sendT = 0;
        }
        break;

      case 'send_player':
        // Player trainer slides out left, player Pokemon slides in from left
        this.trainerIntroTimer++;
        this.sendT = Math.min(this.trainerIntroTimer / SEND_OUT_FRAMES, 1);
        this.playerSideOffset = -SLIDE_OFFSET_OUT * this.sendT;
        if (this.trainerIntroTimer >= SEND_OUT_FRAMES) {
          this.playerSideOffset = -SLIDE_OFFSET_OUT;
          this.trainerIntroPhase = 'send_player_text';
          this.showText([`Go! ${this.playerPokemon.nickname.toUpperCase()}!`]);
        }
        break;

      case 'send_player_text':
        if (!this.waitingForInput) return;
        if (this.textMinTimer > 0) { this.textMinTimer--; return; }
        // Auto-dismiss "Go! <pokemon>!" — no button press needed
        this.waitingForInput = false;
        this.trainerIntroPhase = null;
        this.trainerAssets = null;
        this.state = 'choose_action';
        this.textLines = [];
        break;
    }
  }

  private updateIntro(): void {
    // Wild battle intro animation phases
    if (this.wildIntroPhase) {
      this.updateWildIntro();
      return;
    }

    if (!this.waitingForInput) return;
    if (isPressed('a') || isPressed('b')) {
      playSFX('press_ab');
      this.waitingForInput = false;
      this.introStep++;
      if (this.introStep === 1) {
        if (this.isTrainerBattle) {
          this.showText([`${this.trainerName} sent`, `out ${this.enemyPokemon.nickname.toUpperCase()}!`]);
        } else {
          this.showText([`Go! ${this.playerPokemon.nickname.toUpperCase()}!`]);
        }
      } else if (this.introStep === 2 && this.isTrainerBattle) {
        this.showText([`Go! ${this.playerPokemon.nickname.toUpperCase()}!`]);
      } else {
        this.state = 'choose_action';
        this.textLines = [];
        this.waitingForInput = false;
      }
    }
  }

  private updateWildIntro(): void {
    switch (this.wildIntroPhase) {
      case 'slide_in': {
        this.wildIntroTimer++;
        // Ease-out slide: fast start, slow finish
        const t = Math.min(this.wildIntroTimer / WILD_SLIDE_FRAMES, 1);
        const eased = 1 - (1 - t) * (1 - t); // ease-out quadratic
        this.wildSlideOffset = WILD_SLIDE_OFFSET * (1 - eased);
        if (t >= 1) {
          this.wildSlideOffset = 0;
          // Slide done → colorize (silhouette → full color)
          this.wildIntroPhase = 'colorize';
          this.wildIntroTimer = 0;
          this.wildColorT = 0;
        }
        break;
      }

      case 'colorize': {
        this.wildIntroTimer++;
        this.wildColorT = Math.min(this.wildIntroTimer / WILD_COLORIZE_FRAMES, 1);
        if (this.wildColorT >= 1) {
          this.wildIntroPhase = 'appeared_text';
          this.showText([`Wild ${this.enemyPokemon.nickname.toUpperCase()}`, `appeared!`]);
        }
        break;
      }

      case 'appeared_text':
        if (this.textMinTimer > 0) { this.textMinTimer--; return; }
        if (!this.waitingForInput) return;
        if (isPressed('a') || isPressed('b')) {
          this.waitingForInput = false;
          // Red slides out, Pokemon slides in
          this.wildIntroPhase = 'send_player';
          this.wildIntroTimer = 0;
          this.wildPlayerOffset = 0;
          this.showText([`Go! ${this.playerPokemon.nickname.toUpperCase()}!`]);
        }
        break;

      case 'send_player': {
        // Red slides LEFT off-screen first
        this.wildIntroTimer++;
        const sendT = Math.min(this.wildIntroTimer / SEND_OUT_FRAMES, 1);
        this.wildPlayerOffset = -SLIDE_OFFSET_OUT * sendT;
        if (sendT >= 1) {
          // Red is off-screen, now start sliding the Pokemon in
          this.wildIntroPhase = 'send_pokemon';
          this.wildIntroTimer = 0;
        }
        break;
      }

      case 'send_pokemon': {
        // Player's Pokemon slides in from LEFT after Red is gone
        this.wildIntroTimer++;
        if (this.wildIntroTimer >= SEND_OUT_FRAMES) {
          this.wildIntroPhase = 'go_text';
        }
        break;
      }

      case 'go_text':
        if (this.textMinTimer > 0) { this.textMinTimer--; return; }
        if (!this.waitingForInput) return;
        // Auto-dismiss "Go! <pokemon>!" — no button press needed
        this.waitingForInput = false;
        this.wildIntroPhase = null;
        this.state = 'choose_action';
        this.textLines = [];
        break;
    }
  }

  private updateActionMenu(): void {
    if (isPressed('up') && this.actionCursor >= 2) this.actionCursor -= 2;
    if (isPressed('down') && this.actionCursor < 2) this.actionCursor += 2;
    if (isPressed('left') && this.actionCursor % 2 === 1) this.actionCursor--;
    if (isPressed('right') && this.actionCursor % 2 === 0) this.actionCursor++;

    // Dismiss info messages first
    if (this.waitingForInput) {
      if (isPressed('a') || isPressed('b')) {
        this.waitingForInput = false;
        this.textLines = [];
      }
      return;
    }

    if (isPressed('a')) {
      playSFX('press_ab');
      switch (this.actionCursor) {
        case 0: { // FIGHT
          this.numRunAttempts = 0;
          // Check if locked into a move (Rage, Thrash, Bide, etc.)
          const forced = isLockedIntoMove(this.playerPokemon);
          if (forced) {
            this.playerMoveId = forced;
            this.enemyMoveId = this.selectEnemyMove();
            this.state = 'execute_turn';
            this.turnOrder = [];
            this.turnIndex = 0;
          } else {
            this.state = 'choose_move';
            this.moveCursor = 0;
          }
          break;
        }
        case 1: { // PKMN - open party menu for switching
          const activeIdx = this.playerParty.indexOf(this.playerPokemon);
          const hasOtherAlive = this.playerParty.some((p, i) => i !== activeIdx && p.currentHp > 0);
          if (!hasOtherAlive) {
            this.showText(['No other ' + getText('MENU_POKEMON') + '!']);
          } else {
            this.partyMenu.showForBattle(this.playerParty, activeIdx, false);
            this.state = 'choose_pokemon';
          }
          break;
        }
        case 2: // ITEM
          if (this.isTrainerBattle) {
            this.showText(["Can't use items", 'in a trainer battle!']);
          } else if (this.bag) {
            this.state = 'choose_item';
            this.itemCursor = 0;
          } else {
            this.showText(['No items!']);
          }
          break;
        case 3: // RUN
          if (this.isTrainerBattle) {
            this.showText(["Can't run from a", 'trainer battle!']);
          } else {
            this.numRunAttempts++;
            const runResult = tryRunFromBattle(
              this.playerPokemon.speed,
              this.enemyPokemon.speed,
              this.numRunAttempts,
            );
            if (runResult.escaped) {
              this.state = 'run_away';
              this.showText(runResult.message);
            } else {
              this.state = 'run_failed';
              this.showText(runResult.message);
              this.enemyMoveId = this.selectEnemyMove();
            }
          }
          break;
      }
    }
  }

  private updateMoveMenu(): void {
    const moveCount = this.playerPokemon.moves.length;
    if (isPressed('up') && this.moveCursor > 0) this.moveCursor--;
    if (isPressed('down') && this.moveCursor + 1 < moveCount) this.moveCursor++;

    if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'choose_action';
      return;
    }

    if (isPressed('a')) {
      playSFX('press_ab');
      const move = this.playerPokemon.moves[this.moveCursor];

      // Check if move is disabled
      if (isMoveDisabled(this.playerPokemon, this.moveCursor)) {
        // Don't allow selection of disabled move (just ignore the press)
        return;
      }

      if (move.pp <= 0) {
        // Check if ALL moves have 0 PP → force Struggle
        const anyPP = this.playerPokemon.moves.some((m, i) =>
          m.pp > 0 && !isMoveDisabled(this.playerPokemon, i));
        if (!anyPP) {
          this.playerMoveId = 'STRUGGLE';
          this.enemyMoveId = this.selectEnemyMove();
          this.state = 'execute_turn';
          this.turnOrder = [];
          this.turnIndex = 0;
        }
        return;
      }

      this.playerMoveId = move.id;
      this.enemyMoveId = this.selectEnemyMove();
      this.state = 'execute_turn';
      this.turnOrder = [];
      this.turnIndex = 0;
    }
  }

  private updateItemMenu(): void {
    if (!this.bag) return;
    const items = this.bag.items;
    // Total entries = items + CANCEL
    const totalEntries = items.length + 1;

    if (isPressed('up') && this.itemCursor > 0) this.itemCursor--;
    if (isPressed('down') && this.itemCursor < totalEntries - 1) this.itemCursor++;

    if (isPressed('b')) {
      this.state = 'choose_action';
      return;
    }

    if (isPressed('a')) {
      // CANCEL is the last entry
      if (this.itemCursor >= items.length) {
        this.state = 'choose_action';
        return;
      }
      const item = items[this.itemCursor];
      if (isBall(item.id)) {
        // Use a ball
        this.bag.remove(item.id);
        this.throwBall(item.id as BallType);
      } else if (item.id === 'POTION') {
        this.usePotion(item.id, 20);
      } else if (item.id === 'SUPER_POTION') {
        this.usePotion(item.id, 50);
      } else if (item.id === 'HYPER_POTION') {
        this.usePotion(item.id, 200);
      } else if (item.id === 'MAX_POTION' || item.id === 'FULL_RESTORE') {
        this.usePotion(item.id, 999);
      } else if (this.isStatusHealItem(item.id)) {
        this.useStatusHeal(item.id);
      } else {
        this.state = 'choose_action';
        this.showText(["Can't use that here!"]);
      }
    }
  }

  private usePotion(itemId: string, healAmount: number): void {
    if (!this.bag) return;
    const p = this.playerPokemon;
    // Assembly bug: happiness triggers BEFORE checking if the item has any effect
    if (p.species.id === 25) modifyPikachuHappiness('USEDITEM');
    if (p.currentHp >= p.maxHp) {
      this.state = 'choose_action';
      this.showText(["It won't have any effect."]);
      return;
    }

    this.bag.remove(itemId);
    const actualHeal = Math.min(healAmount, p.maxHp - p.currentHp);
    p.currentHp += actualHeal;
    if (itemId === 'FULL_RESTORE') {
      // Restore stats modified by status before clearing
      if (p.status === 'BRN') {
        p.attack = Math.floor(((p.species.attack + p.atkDV) * 2 * p.level) / 100) + 5;
      } else if (p.status === 'PAR') {
        p.speed = Math.floor(((p.species.speed + p.spdDV) * 2 * p.level) / 100) + 5;
      }
      p.status = null;
      p.sleepTurns = 0;
      p.toxicCounter = 0;
      p.badlyPoisoned = false;
    }

    // Enemy gets a free turn after using item
    this.textQueue = [];
    this.textLines = [`Used ${getItemName(itemId)}!`];
    this.waitingForInput = false;
    this.state = 'player_move'; // reuse player_move state for text flow

    this.startDelay(45, () => {
      this.animatingHp = true;
      this.hpAnimFrame = 0;
    });

    // After item use, enemy attacks
    // turnOrder[0]='player' represents the item-use action (already done),
    // turnOrder[1]='enemy' is the enemy's free turn
    this.enemyMoveId = this.selectEnemyMove();
    this.turnOrder = ['player', 'enemy'];
    this.turnIndex = 0;
  }

  private isStatusHealItem(id: string): boolean {
    return ['ANTIDOTE', 'PARALYZE_HEAL', 'BURN_HEAL', 'ICE_HEAL', 'AWAKENING', 'FULL_HEAL'].includes(id);
  }

  private useStatusHeal(itemId: string): void {
    if (!this.bag) return;
    const p = this.playerPokemon;
    // Assembly bug: happiness triggers BEFORE checking if the item has any effect
    if (p.species.id === 25) modifyPikachuHappiness('USEDITEM');

    // Map items to which status they cure
    const cures: Record<string, string | null> = {
      ANTIDOTE: 'PSN', PARALYZE_HEAL: 'PAR', BURN_HEAL: 'BRN',
      ICE_HEAL: 'FRZ', AWAKENING: 'SLP', FULL_HEAL: null, // null = cures any
    };

    const targetStatus = cures[itemId];
    if (targetStatus === undefined) return;

    // Check if the item would work
    if (p.status === null || (targetStatus !== null && p.status !== targetStatus)) {
      this.state = 'choose_action';
      this.showText(["It won't have any effect."]);
      return;
    }

    this.bag.remove(itemId);

    // Restore stats modified by status (burn halved attack, paralysis quartered speed)
    if (p.status === 'BRN') {
      // Recalculate attack from base (undo the halving)
      p.attack = Math.floor(((p.species.attack + p.atkDV) * 2 * p.level) / 100) + 5;
    } else if (p.status === 'PAR') {
      // Recalculate speed from base (undo the quartering)
      p.speed = Math.floor(((p.species.speed + p.spdDV) * 2 * p.level) / 100) + 5;
    }

    p.status = null;
    p.sleepTurns = 0;
    p.toxicCounter = 0;
    p.badlyPoisoned = false;

    // Enemy gets a free turn after using item
    this.textQueue = [];
    this.textLines = [`Used ${getItemName(itemId)}!`];
    this.waitingForInput = false;
    this.state = 'player_move';

    this.startDelay(45, () => {
      this.animatingHp = true;
      this.hpAnimFrame = 0;
    });

    this.enemyMoveId = this.selectEnemyMove();
    this.turnOrder = ['player', 'enemy'];
    this.turnIndex = 0;
  }

  // ──── Pokemon switching ────

  private updateChoosePokemon(): void {
    const result = this.partyMenu.update();
    if (result === 'close') {
      const idx = this.partyMenu.selectedSwitchIndex;
      if (idx >= 0) {
        this.switchingToIndex = idx;
        if (this.forcedSwitch) {
          // Fainted mon — skip "come back" text, go straight to send-out
          this.performSwitch(idx);
        } else {
          // Voluntary — show retreat text, auto-advance after delay
          this.state = 'switching_out';
          this.textLines = [`${this.playerPokemon.nickname.toUpperCase()},`, `come back!`];
          this.waitingForInput = false;
          this.startDelay(45, () => {
            // Pikachu slides left; other Pokemon shrink+poof
            this.switchAnimating = true;
            this.switchAnimFrame = 0;
            this.switchAnimPhase = isPikachu(this.playerPokemon) ? 'slide_out' : 'shrink';
            this.textLines = [];
          });
        }
      } else {
        // Cancelled — return to action menu
        this.state = 'choose_action';
        this.textLines = [];
      }
    }
  }

  private performSwitch(newIndex: number): void {
    const newMon = this.playerParty[newIndex];
    this.playerPokemon = newMon;
    this.playerDisplayHp = newMon.currentHp;
    this.playerFaintDone = false; // new mon is alive, show sprite+HUD

    // Reset stat stages, toxics, volatiles (Gen 1: all reset on switch)
    newMon.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
    newMon.toxicCounter = 0;
    newMon.badlyPoisoned = false;
    newMon.volatiles = createVolatiles();
    newMon.originalStats = { attack: newMon.attack, defense: newMon.defense, speed: newMon.speed, special: newMon.special };
    // Apply badge stat boosts to the newly switched-in Pokemon
    applyBadgeStatBoosts(newMon, this.badges);

    // Load sprites then show "Go! X!" with grow animation
    this.waitingForInput = false;
    this.textLines = [];
    loadPokemonSprites(newMon.species.name.toLowerCase(), newMon.species.id).then(sprites => {
      this.sprites = {
        enemyFront: this.sprites!.enemyFront,
        playerBack: sprites.back,
        enemySilhouette: this.sprites!.enemySilhouette,
        playerSilhouette: createSilhouette(sprites.back),
      };
      // Pikachu slides in from left; other Pokemon grow from pokeball
      this.switchAnimating = true;
      this.switchAnimFrame = 0;
      this.switchAnimPhase = isPikachu(newMon) ? 'slide_in' : 'grow';
      this.state = 'switching_in';
      this.textLines = [`Go! ${newMon.nickname.toUpperCase()}!`];
      this.waitingForInput = false;
    });
  }

  private throwBall(ballType: BallType): void {
    const ballName = getItemName(ballType);
    this.textQueue = [];
    this.state = 'throw_ball';

    const result = attemptCatch(this.enemyPokemon, ballType);

    if (result.caught) {
      this.showText([`${ballName} thrown!`]);
      this.queueText([`Gotcha!`]);
      this.queueText([`${this.enemyPokemon.nickname.toUpperCase()}`, `was caught!`]);
      this.caughtPokemon = this.enemyPokemon;
    } else {
      this.showText([`${ballName} thrown!`]);
      if (result.shakes === 0) {
        this.queueText(getText('BATTLE_MISSED_MON').split('\n'));
      } else if (result.shakes === 1) {
        this.queueText(getText('BATTLE_BROKE_FREE').split('\n'));
      } else if (result.shakes === 2) {
        this.queueText(['Aww! It appeared', 'to be caught!']);
      } else {
        this.queueText(['Shoot! It was so', 'close too!']);
      }
    }
  }

  private selectEnemyMove(): string {
    if (this.isTrainerBattle && this.trainerClass) {
      return selectTrainerMove(
        this.enemyPokemon,
        this.playerPokemon,
        this.trainerClass.aiModifiers,
      );
    }
    // Wild Pokemon: pick a random move that has PP
    const validMoves = this.enemyPokemon.moves.filter(m => m.pp > 0);
    if (validMoves.length === 0) return 'STRUGGLE';
    return validMoves[Math.floor(Math.random() * validMoves.length)].id;
  }

  private executeTurn(): void {
    if (this.turnOrder.length === 0) {
      // Determine turn order by speed and priority

      // Check for forced moves (Rage, Thrash, Bide, charging, binding)
      const playerForced = isLockedIntoMove(this.playerPokemon);
      const enemyForced = isLockedIntoMove(this.enemyPokemon);
      if (playerForced) this.playerMoveId = playerForced;
      if (enemyForced) this.enemyMoveId = enemyForced;

      let playerFirst: boolean;

      // Priority moves (Quick Attack = +1, Counter = -1)
      const playerPriority = isPriorityMove(this.playerMoveId) ? 1
        : isCounterMove(this.playerMoveId) ? -1 : 0;
      const enemyPriority = isPriorityMove(this.enemyMoveId) ? 1
        : isCounterMove(this.enemyMoveId) ? -1 : 0;

      if (playerPriority > enemyPriority) {
        playerFirst = true;
      } else if (enemyPriority > playerPriority) {
        playerFirst = false;
      } else if (this.playerPokemon.speed > this.enemyPokemon.speed) {
        playerFirst = true;
      } else if (this.playerPokemon.speed < this.enemyPokemon.speed) {
        playerFirst = false;
      } else {
        playerFirst = Math.random() < 0.5;
      }

      this.turnOrder = playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];
      this.turnIndex = 0;
    }

    const current = this.turnOrder[this.turnIndex];
    if (current === 'player') {
      this.executePlayerMove();
    } else {
      this.executeEnemyMove();
    }
  }

  /** Execute a move for either side. Handles all effects. */
  private executeMove(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    moveId: string,
    isPlayerAttacker: boolean,
  ): void {
    const move = getMove(moveId);
    const effect = move?.effect ?? 'NO_ADDITIONAL_EFFECT';
    const attackerName = attacker.nickname.toUpperCase();
    const defenderName = defender.nickname.toUpperCase();
    const attackerPrefix = isPlayerAttacker ? '' : (this.isTrainerBattle ? 'Enemy ' : 'Wild ');

    // Track last move used (for Mirror Move)
    attacker.volatiles.lastMoveUsed = moveId;

    // ── Metronome / Mirror Move: resolve to actual move ──
    let actualMoveId = moveId;
    if (effect === 'METRONOME_EFFECT') {
      actualMoveId = selectMetronomeMove();
      this.queueText([`Waggled a finger`, `and used ${actualMoveId.replace(/_/g, ' ')}!`]);
    } else if (effect === 'MIRROR_MOVE_EFFECT') {
      const mirrorMove = selectMirrorMove(defender);
      if (!mirrorMove) {
        this.queueText(['But it failed!']);
        return;
      }
      actualMoveId = mirrorMove;
      this.queueText([`Mirror Move used`, `${actualMoveId.replace(/_/g, ' ')}!`]);
    }

    const actualMove = getMove(actualMoveId);
    if (!actualMove) return;
    const actualEffect = actualMove.effect;

    // ── Non-damaging effects (Residual Effects 1) ──
    if (isNonDamagingEffect(actualEffect)) {
      this.handleNonDamagingEffect(actualEffect, actualMoveId, attacker, defender, isPlayerAttacker);
      return;
    }

    // ── Charge moves: turn 1 (charge phase) ──
    if ((actualEffect === 'CHARGE_EFFECT' || actualEffect === 'FLY_EFFECT') && !attacker.volatiles.charging) {
      const digId = 91;
      const isFlying = actualEffect === 'FLY_EFFECT' || (getMove(actualMoveId)?.id === digId);
      const chargeResult = handleChargeTurn(attacker, actualMoveId, isFlying);
      for (const msg of chargeResult.messages) this.queueText(msg);
      return;
    }

    // ── Bide start ──
    if (actualEffect === 'BIDE_EFFECT' && !attacker.volatiles.bide) {
      const bideResult = handleBideStart(attacker);
      for (const msg of bideResult.messages) this.queueText(msg);
      return;
    }

    // ── Counter ──
    if (isCounterMove(actualMoveId)) {
      const counterResult = handleCounter(attacker, defender);
      for (const msg of counterResult.messages) this.queueText(msg);
      if (!counterResult.failed) {
        attacker.volatiles.lastDamageDealt = counterResult.damage;
      }
      return;
    }

    // ── OHKO moves ──
    if (actualEffect === 'OHKO_EFFECT') {
      const ohkoResult = handleOHKO(attacker, defender);
      for (const msg of ohkoResult.messages) this.queueText(msg);
      return;
    }

    // ── Super Fang ──
    if (actualEffect === 'SUPER_FANG_EFFECT') {
      const sfResult = handleSuperFang(defender);
      // Apply damage (to substitute or real HP)
      const subCheck = checkSubstitute(defender, sfResult.damage);
      if (!subCheck.absorbed) {
        defender.currentHp = Math.max(0, defender.currentHp - sfResult.damage);
      }
      for (const msg of subCheck.messages) this.queueText(msg);
      attacker.volatiles.lastDamageDealt = sfResult.damage;
      return;
    }

    // ── Thrash / Petal Dance start ──
    if (actualEffect === 'THRASH_PETAL_DANCE_EFFECT' && attacker.volatiles.thrashing === 0) {
      handleThrashStart(attacker);
    }

    // ── Trapping moves start ──
    if (actualEffect === 'TRAPPING_EFFECT' && attacker.volatiles.usingBinding === 0) {
      handleTrappingStart(attacker, defender);
    }

    // ── Rage start ──
    if (actualEffect === 'RAGE_EFFECT') {
      handleRageStart(attacker);
    }

    // ── Accuracy check ──
    const skipAcc = shouldSkipAccuracy(actualEffect);
    const damageResult = calculateDamage(attacker, defender, actualMoveId, skipAcc);

    if (damageResult.missed) {
      this.queueText([`${attackerPrefix}${attackerName}'s attack missed!`]);
      // Jump Kick / Hi Jump Kick crash on miss
      if (actualEffect === 'JUMP_KICK_EFFECT') {
        const crashResult = handleJumpKickCrash(attacker);
        for (const msg of crashResult.messages) this.queueText(msg);
      }
      return;
    }

    if (damageResult.effectiveness === 0) {
      this.queueText(["It doesn't affect", `${defenderName}...`]);
      return;
    }

    // ── Apply damage ──
    let damageDealt = damageResult.damage;
    if (damageDealt > 0) {
      // Check substitute
      const subCheck = checkSubstitute(defender, damageDealt);
      if (subCheck.absorbed) {
        for (const msg of subCheck.messages) this.queueText(msg);
      } else {
        defender.currentHp = Math.max(0, defender.currentHp - damageDealt);
      }

      // Track damage for Counter/Bide
      attacker.volatiles.lastDamageDealt = damageDealt;
      defender.volatiles.lastDamageReceived = damageDealt;

      // Accumulate Bide damage
      if (defender.volatiles.bide) {
        defender.volatiles.bide.damage += damageDealt;
      }
    }

    // Critical hit message
    if (damageResult.critical) {
      this.queueText(['Critical hit!']);
    }

    // Type effectiveness messages
    if (damageResult.effectiveness > 1) {
      this.queueText(["It's super effective!"]);
    } else if (damageResult.effectiveness < 1 && damageResult.effectiveness > 0) {
      this.queueText(["It's not very effective..."]);
    }

    // ── Fire thaw check ──
    if (damageDealt > 0 && actualMove.type) {
      const thawMsg = checkFireThaw(actualMoveId, actualMove.type, defender);
      if (thawMsg) this.queueText(thawMsg);
    }

    // ── Rage hit: boost attack if defender is in Rage ──
    if (damageDealt > 0) {
      const rageMsg = handleRageHit(defender);
      if (rageMsg) this.queueText(rageMsg);
    }

    // ── Always-happen effects (even if target faints) ──

    // Recoil (Take Down, Double-Edge, Submission, Struggle)
    if (actualEffect === 'RECOIL_EFFECT' && damageDealt > 0) {
      const recoilResult = handleRecoil(actualMoveId, attacker, damageDealt);
      for (const msg of recoilResult.messages) this.queueText(msg);
    }

    // Drain (Absorb, Mega Drain, Leech Life, Dream Eater)
    if ((actualEffect === 'DRAIN_HP_EFFECT' || actualEffect === 'DREAM_EATER_EFFECT') && damageDealt > 0) {
      const drainResult = handleDrain(attacker, defender, damageDealt, actualEffect === 'DREAM_EATER_EFFECT');
      for (const msg of drainResult.messages) this.queueText(msg);
    }

    // Explosion / Self-Destruct: user faints
    if (actualEffect === 'EXPLODE_EFFECT') {
      handleExplode(attacker);
    }

    // Hyper Beam: set recharging (Gen 1 bug: no recharge if KO)
    if (actualEffect === 'HYPER_BEAM_EFFECT') {
      handleHyperBeam(attacker, defender);
    }

    // Pay Day
    if (actualEffect === 'PAY_DAY_EFFECT') {
      const payResult = handlePayDay(attacker);
      for (const msg of payResult.messages) this.queueText(msg);
    }

    // Multi-hit moves
    if (actualEffect === 'TWO_TO_FIVE_ATTACKS_EFFECT') {
      const hits = rollMultiHitCount();
      this.queueText([`Hit ${hits} time(s)!`]);
    }
    if (actualEffect === 'ATTACK_TWICE_EFFECT') {
      this.queueText(['Hit 2 time(s)!']);
    }

    // ── Conditional effects (only if target survives) ──
    if (defender.currentHp > 0 && !damageResult.missed && damageResult.effectiveness > 0) {
      // Stat effects (pure stat moves and side effects on damaging moves)
      this.handleStatEffect(actualMoveId, attacker, defender);

      // Status-inflicting effects
      this.handleStatusEffect(actualMoveId, attacker, defender);

      // Flinch side effects
      if (actualEffect === 'FLINCH_SIDE_EFFECT1' || actualEffect === 'FLINCH_SIDE_EFFECT2') {
        const isFirst = this.turnOrder[0] === (isPlayerAttacker ? 'player' : 'enemy');
        handleFlinchSideEffect(actualEffect, defender, isFirst);
      }

      // Confusion side effect
      if (actualEffect === 'CONFUSION_SIDE_EFFECT') {
        const confMsg = handleConfusionSideEffect(defender);
        if (confMsg) this.queueText(confMsg);
      }
    }
  }

  /** Handle non-damaging effects (Residual Effects 1). */
  private handleNonDamagingEffect(
    effect: string,
    moveId: string,
    attacker: BattlePokemon,
    defender: BattlePokemon,
    isPlayerAttacker: boolean,
  ): void {
    let resultMsgs: string[][] = [];

    switch (effect) {
      case 'SUBSTITUTE_EFFECT': {
        const r = handleSubstitute(attacker);
        resultMsgs = r.messages;
        break;
      }
      case 'HAZE_EFFECT': {
        const r = handleHaze(attacker, defender);
        resultMsgs = r.messages;
        break;
      }
      case 'LEECH_SEED_EFFECT': {
        const r = handleLeechSeed(attacker, defender);
        resultMsgs = r.messages;
        break;
      }
      case 'REFLECT_EFFECT':
      case 'LIGHT_SCREEN_EFFECT': {
        const r = handleScreen(attacker, effect);
        resultMsgs = r.messages;
        break;
      }
      case 'MIST_EFFECT': {
        const r = handleMist(attacker);
        resultMsgs = r.messages;
        break;
      }
      case 'FOCUS_ENERGY_EFFECT': {
        const r = handleFocusEnergy(attacker);
        resultMsgs = r.messages;
        break;
      }
      case 'CONFUSION_EFFECT': {
        const r = handleConfusion(attacker, defender);
        resultMsgs = r.messages;
        break;
      }
      case 'HEAL_EFFECT': {
        const r = handleHeal(attacker, moveId);
        resultMsgs = r.messages;
        break;
      }
      case 'TRANSFORM_EFFECT': {
        const r = handleTransform(attacker, defender);
        resultMsgs = r.messages;
        break;
      }
      case 'CONVERSION_EFFECT': {
        const r = handleConversion(attacker, defender);
        resultMsgs = r.messages;
        break;
      }
      case 'MIMIC_EFFECT': {
        const r = handleMimic(attacker, defender);
        resultMsgs = r.messages;
        break;
      }
      case 'DISABLE_EFFECT': {
        const r = handleDisable(attacker, defender);
        resultMsgs = r.messages;
        break;
      }
      case 'SPLASH_EFFECT': {
        const r = handleSplash();
        resultMsgs = r.messages;
        break;
      }
      case 'SWITCH_AND_TELEPORT_EFFECT': {
        const r = handleSwitchAndTeleport(attacker, defender, this.isTrainerBattle, isPlayerAttacker);
        resultMsgs = r.messages;
        if (r.endBattle) {
          for (const msg of resultMsgs) this.queueText(msg);
          this.state = 'run_away';
          return;
        }
        break;
      }
      // Status moves (Sleep, Poison, Paralyze)
      case 'SLEEP_EFFECT':
      case 'POISON_EFFECT':
      case 'PARALYZE_EFFECT': {
        // Substitute blocks pure status moves
        if (defender.volatiles.substitute > 0) {
          resultMsgs = [['But it failed!']];
        } else {
          const statusResult = tryInflictStatus(effect, attacker, defender, moveId);
          if (statusResult && statusResult.inflicted) {
            resultMsgs = [statusResult.message];
          } else {
            resultMsgs = [['But it failed!']];
          }
        }
        break;
      }
      default:
        resultMsgs = [['But it failed!']];
    }

    for (const msg of resultMsgs) this.queueText(msg);
  }

  /** Handle stat effects for a move (pure stat moves and side effects). */
  private handleStatEffect(moveId: string, attacker: BattlePokemon, defender: BattlePokemon): void {
    const move = getMove(moveId);
    if (!move) return;

    const effect = getStatEffect(move.effect);
    if (!effect) return;

    // Side effects have ~33% chance (85/256)
    if (effect.isSideEffect) {
      if (Math.floor(Math.random() * 256) >= 85) return;
    }

    const target = effect.who === 'attacker' ? attacker : defender;

    // Mist blocks stat reductions on the target
    if (effect.stages < 0 && isBlockedByMist(target, effect.stages)) {
      this.queueText(['But it failed!']);
      return;
    }

    // Substitute blocks stat reductions from opponent
    if (effect.stages < 0 && effect.who === 'defender' && target.volatiles.substitute > 0) {
      return; // Silently fails
    }

    const success = applyStatStage(target, effect.stat, effect.stages);
    const targetName = target.nickname.toUpperCase();
    const statName = effect.stat.toUpperCase();

    if (success) {
      const magnitude = Math.abs(effect.stages) >= 2 ? 'greatly ' : '';
      const verb = effect.stages > 0 ? 'rose' : 'fell';
      this.queueText([`${targetName}'s ${statName} ${magnitude}${verb}!`]);
      // Gen 1 bug: badge stat boosts are reapplied to ALL stats after ANY stat
      // stage change involving the player's Pokemon (assembly: effects.asm:535,725)
      if (target === this.playerPokemon) {
        applyBadgeStatBoosts(this.playerPokemon, this.badges);
      }
    } else {
      if (!effect.isSideEffect) {
        this.queueText(["But it failed!"]);
      }
    }
  }

  /** Handle status-inflicting move effects (poison, burn, freeze, paralyze, sleep). */
  private handleStatusEffect(moveId: string, attacker: BattlePokemon, defender: BattlePokemon): void {
    const move = getMove(moveId);
    if (!move) return;

    if (!isStatusEffect(move.effect)) return;

    const result = tryInflictStatus(move.effect, attacker, defender, moveId);
    if (result && result.inflicted) {
      this.queueText(result.message);
    }
  }

  private executePlayerMove(): void {
    this.textQueue = [];
    this.state = 'player_move';

    // Pre-turn status check (sleep, freeze, paralysis)
    const statusCheck = checkPreTurnStatus(this.playerPokemon);
    if (!statusCheck.canAct) {
      for (const msg of statusCheck.messages) this.queueText(msg);
      this.showText(statusCheck.messages[0] ?? ['']);
      this.startDelay(45, () => {
        this.animatingHp = true;
        this.hpAnimFrame = 0;
      });
      return;
    }

    // Show woke-up message if applicable
    if (statusCheck.messages.length > 0) {
      for (const msg of statusCheck.messages) this.queueText(msg);
    }

    // Volatile status checks (confusion, flinch, recharging, forced moves)
    const volCheck = checkVolatilePreTurn(this.playerPokemon, this.enemyPokemon);
    for (const msg of volCheck.messages) this.queueText(msg);

    if (!volCheck.canAct) {
      this.showText(this.textQueue[0] ?? ['']);
      this.textQueue.shift();
      this.startDelay(45, () => {
        this.animatingHp = true;
        this.hpAnimFrame = 0;
      });
      return;
    }

    // Use forced move if applicable
    if (volCheck.forcedMoveId) {
      this.playerMoveId = volCheck.forcedMoveId;
    }

    const moveName = this.playerMoveId.replace(/_/g, ' ');

    // Deduct PP (Struggle doesn't deduct PP — it has no move slot)
    if (!isStruggle(this.playerMoveId)) {
      const moveSlot = this.playerPokemon.moves.find(m => m.id === this.playerMoveId);
      if (moveSlot && moveSlot.pp > 0) moveSlot.pp--;
    }

    // Show "used MOVE!" text
    this.textLines = [`${this.playerPokemon.nickname.toUpperCase()} used ${moveName}!`];
    this.waitingForInput = false;

    // Execute the move with full effect handling
    this.executeMove(this.playerPokemon, this.enemyPokemon, this.playerMoveId, true);

    // Show "used MOVE!" for 45 frames (~0.75s) then start HP animation
    this.startDelay(45, () => {
      this.animatingHp = true;
      this.hpAnimFrame = 0;
    });
  }

  private executeEnemyMove(): void {
    this.textQueue = [];
    this.state = 'enemy_move';

    // Pre-turn status check (sleep, freeze, paralysis)
    const statusCheck = checkPreTurnStatus(this.enemyPokemon);
    if (!statusCheck.canAct) {
      this.showText(statusCheck.messages[0] ?? ['']);
      for (let i = 1; i < statusCheck.messages.length; i++) {
        this.queueText(statusCheck.messages[i]);
      }
      this.startDelay(45, () => {
        this.animatingHp = true;
        this.hpAnimFrame = 0;
      });
      return;
    }

    if (statusCheck.messages.length > 0) {
      for (const msg of statusCheck.messages) this.queueText(msg);
    }

    // Volatile status checks (confusion, flinch, recharging, forced moves)
    const volCheck = checkVolatilePreTurn(this.enemyPokemon, this.playerPokemon);
    for (const msg of volCheck.messages) this.queueText(msg);

    if (!volCheck.canAct) {
      this.showText(this.textQueue[0] ?? ['']);
      this.textQueue.shift();
      this.startDelay(45, () => {
        this.animatingHp = true;
        this.hpAnimFrame = 0;
      });
      return;
    }

    // Use forced move if applicable
    if (volCheck.forcedMoveId) {
      this.enemyMoveId = volCheck.forcedMoveId;
    }

    const moveName = this.enemyMoveId.replace(/_/g, ' ');

    // Deduct PP (Struggle doesn't deduct PP — it has no move slot)
    if (!isStruggle(this.enemyMoveId)) {
      const moveSlot = this.enemyPokemon.moves.find(m => m.id === this.enemyMoveId);
      if (moveSlot && moveSlot.pp > 0) moveSlot.pp--;
    }

    // Show "used MOVE!" text
    const enemyPrefix = this.isTrainerBattle ? 'Enemy' : 'Wild';
    this.textLines = [`${enemyPrefix} ${this.enemyPokemon.nickname.toUpperCase()}`, `used ${moveName}!`];
    this.waitingForInput = false;

    // Execute the move with full effect handling
    this.executeMove(this.enemyPokemon, this.playerPokemon, this.enemyMoveId, false);

    // Show "used MOVE!" for 45 frames (~0.75s) then start HP animation
    this.startDelay(45, () => {
      this.animatingHp = true;
      this.hpAnimFrame = 0;
    });
  }

  private continueAfterAnimation(): void {
    // HP animation finished, now show any remaining text
    if (this.textQueue.length > 0) {
      this.advanceTextQueue();
      return;
    }

    // Check fainting
    if (this.enemyPokemon.currentHp <= 0 || this.playerPokemon.currentHp <= 0) {
      this.state = 'check_faint';
      return;
    }

    // End-of-turn poison/burn/leech seed damage (core.asm: HandlePoisonBurnLeechSeed)
    // Applied after each Pokemon's move in the original game
    if (!this.endOfTurnDone) {
      this.endOfTurnDone = true;

      // Determine whose "turn" just ended based on turnOrder
      const lastMover = this.turnOrder[this.turnIndex];
      const mon = lastMover === 'player' ? this.playerPokemon : this.enemyPokemon;
      const opponent = lastMover === 'player' ? this.enemyPokemon : this.playerPokemon;
      let hadEffect = false;

      // Poison/Burn damage
      const eotResult = applyEndOfTurnDamage(mon);
      if (eotResult.damage > 0) {
        for (const msg of eotResult.messages) this.queueText(msg);
        hadEffect = true;
      }

      // Leech Seed drain
      const leechResult = applyVolatileEndOfTurn(mon, opponent);
      if (leechResult.damage > 0) {
        for (const msg of leechResult.messages) this.queueText(msg);
        hadEffect = true;
      }

      if (hadEffect) {
        // Re-animate HP bars
        this.startDelay(30, () => {
          this.animatingHp = true;
          this.hpAnimFrame = 0;
        });
        // Show the end-of-turn text first
        if (this.textQueue.length > 0) this.advanceTextQueue();
        return;
      }
    }

    // Advance to next attacker in turn order
    this.turnIndex++;
    this.endOfTurnDone = false;
    if (this.turnIndex < this.turnOrder.length) {
      // Pause before next attacker's turn
      this.startDelay(30, () => {
        this.state = 'execute_turn';
      });
    } else {
      // Both sides have attacked, back to choose action
      this.turnOrder = [];
      this.turnIndex = 0;
      this.state = 'choose_action';
      this.textLines = [];
      this.waitingForInput = false;
    }
  }

  private updateTextWait(): void {
    if (!this.waitingForInput) return;

    // Enforce minimum display time before text can be dismissed
    if (this.textMinTimer > 0) {
      this.textMinTimer--;
      return;
    }

    if (isPressed('a') || isPressed('b')) {
      playSFX('press_ab');
      this.waitingForInput = false;

      // Try to show next queued text
      if (this.advanceTextQueue()) return;

      // State-specific transitions
      if (this.state === 'run_away') {
        this.state = 'end';
      } else if (this.state === 'victory') {
        // After "enemy fainted!" → show XP gain, then possibly next trainer Pokemon
        this.handleExpGain();
      } else if (this.state === 'gain_exp') {
        // Check for pending learn-move prompts before proceeding
        if (this.learnMoveQueue.length > 0) {
          this.startLearnMoveFlow();
        } else if (this.isTrainerBattle && this.trainerPartyIndex + 1 < this.trainerParty.length) {
          this.sendNextTrainerPokemon();
        } else if (this.isTrainerBattle && !this.trainerDefeated) {
          this.handleTrainerVictory();
        } else {
          this.state = 'end';
        }
      } else if (this.state === 'defeat') {
        // Check if player has other alive Pokemon for forced switch
        const activeIdx = this.playerParty.indexOf(this.playerPokemon);
        const hasOtherAlive = this.playerParty.some((p, i) => i !== activeIdx && p.currentHp > 0);
        if (hasOtherAlive) {
          this.forcedSwitch = true;
          this.partyMenu.showForBattle(this.playerParty, activeIdx, true);
          this.state = 'forced_switch';
        } else {
          // All Pokemon fainted — show blackout messages
          // (assembly: HandlePlayerBlackOut, data/text/text_1.asm _PlayerBlackedOutText)
          this.isBlackout = true;
          this.state = 'blackout';
          this.textQueue = [];
          this.showText([`${this.playerName}${getText('BATTLE_OUT_OF_USEABLE').split('\n')[0]}`, getText('BATTLE_OUT_OF_USEABLE').split('\n')[1]]);
          this.queueText([`${this.playerName} blacked`, `out!`]);
        }
      } else if (this.state === 'throw_ball') {
        if (this.caughtPokemon) {
          // Successfully caught → end battle
          this.state = 'end';
        } else {
          // Failed catch → enemy gets a free turn
          this.enemyMoveId = this.selectEnemyMove();
          this.turnOrder = ['enemy'];
          this.turnIndex = 0;
          this.startDelay(30, () => {
            this.state = 'execute_turn';
          });
        }
      } else if (this.state === 'run_failed') {
        // Failed run → enemy gets a free turn
        this.turnOrder = ['enemy'];
        this.turnIndex = 0;
        this.endOfTurnDone = false;
        this.startDelay(30, () => {
          this.state = 'execute_turn';
        });
      } else if (this.state === 'blackout') {
        // All blackout text dismissed → end battle
        this.state = 'end';
      } else if (this.state === 'player_move' || this.state === 'enemy_move') {
        // Done showing messages, pause before continuing turn
        this.startDelay(20, () => this.continueAfterAnimation());
      }
    }
  }

  /** Send out the next trainer Pokemon after one faints. */
  private sendNextTrainerPokemon(): void {
    this.trainerPartyIndex++;
    const next = this.trainerParty[this.trainerPartyIndex];
    this.enemyPokemon = next;
    this.enemyDisplayHp = next.currentHp;
    this.enemyFaintDone = false; // new enemy mon, show sprite+HUD
    // Reset stat stages and volatiles for the new Pokemon
    next.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
    next.toxicCounter = 0;
    next.badlyPoisoned = false;
    next.volatiles = createVolatiles();
    next.originalStats = { attack: next.attack, defense: next.defense, speed: next.speed, special: next.special };

    // Block updates while loading sprites, then show intro
    this.waitingForInput = false;
    this.textLines = [];
    loadPokemonSprites(next.species.name.toLowerCase(), next.species.id).then(sprites => {
      const playerBack = this.sprites?.playerBack ?? sprites.back;
      this.sprites = {
        enemyFront: sprites.front,
        playerBack,
        enemySilhouette: createSilhouette(sprites.front),
        playerSilhouette: this.sprites?.playerSilhouette ?? createSilhouette(playerBack),
      };
      this.state = 'intro';
      this.introStep = 1; // Skip "wants to fight!", go to "sent out X!"
      this.showText([`${this.trainerName} sent`, `out ${next.nickname.toUpperCase()}!`]);
    });
  }

  /** Handle victory over the entire trainer party (money reward). */
  private handleTrainerVictory(): void {
    if (!this.trainerClass) {
      this.state = 'end';
      return;
    }

    // Money = baseMoney × level of last enemy Pokemon
    const lastPokemon = this.trainerParty[this.trainerParty.length - 1];
    this.moneyWon = this.trainerClass.baseMoney * lastPokemon.level;

    this.trainerDefeated = true;
    this.state = 'gain_exp'; // reuse gain_exp for text display (dismisses → 'end')
    // Assembly: data/text/text_2.asm _TrainerDefeatedText, _MoneyForWinningText
    this.showText([`${this.playerName} defeated`, `${this.trainerName}!`]);
    this.queueText([`${this.playerName} got ¥${this.moneyWon}`, `for winning!`]);
  }

  // Track if we've shown the trainer-defeated message
  private trainerDefeated = false;

  /** Handle XP gain after defeating enemy. */
  private handleExpGain(): void {
    const expAmount = calcExpGain(this.enemyPokemon, this.isTrainerBattle);
    this.expGained = expAmount;

    const pName = this.playerPokemon.nickname.toUpperCase();
    this.state = 'gain_exp';
    this.textQueue = [];
    this.showText([`${pName} gained`, `${expAmount} EXP. Points!`]);

    // Apply XP and check level ups
    const levelUps = gainExperience(this.playerPokemon, expAmount);

    for (const lu of levelUps) {
      this.queueText([`${pName} grew to`, `level ${lu.newLevel}!`]);
      for (const moveId of lu.newMoves) {
        const moveName = moveId.replace(/_/g, ' ');
        this.queueText([`${pName} learned`, `${moveName}!`]);
      }
      // Queue pending moves for interactive "delete a move?" flow
      for (const moveId of lu.pendingMoves) {
        this.learnMoveQueue.push({ pokemon: this.playerPokemon, moveId });
      }
    }

    // Track level-ups for happiness system
    this.levelsGained += levelUps.length;

    // Reapply badge stat boosts after level-up stat recalculation (assembly: experience.asm:240)
    if (levelUps.length > 0) {
      applyBadgeStatBoosts(this.playerPokemon, this.badges);
    }

    // Update display HP to reflect level-up HP gains
    if (levelUps.length > 0) {
      this.playerDisplayHp = this.playerPokemon.currentHp;
    }

  }

  // ──────── Faint slide-down animation ────────
  // Assembly: SlideDownFaintedMonPic — 7 rows, 2 frames per row = 14 frames total.
  // After animation, the sprite and HUD are hidden and the fainted text is shown.

  private static readonly FAINT_FRAMES_PER_ROW = 2;
  private static readonly FAINT_TOTAL_FRAMES = 8 * 2; // 8 rows × 2 frames = 16 frames

  private updateFaintAnimation(): void {
    this.faintAnimFrame++;
    if (this.faintAnimFrame >= Battle.FAINT_TOTAL_FRAMES) {
      // Animation complete — hide sprite+HUD and show fainted text
      this.faintAnimating = false;
      if (this.faintAnimTarget === 'enemy') {
        this.enemyFaintDone = true;
        const enemyPrefix = this.isTrainerBattle ? 'Enemy' : 'Wild';
        this.state = 'victory';
        // Assembly: victory fanfare plays immediately when last enemy faints
        if (this.onVictory) this.onVictory();
        this.showText([`${enemyPrefix} ${this.enemyPokemon.nickname.toUpperCase()} fainted!`]);
      } else {
        this.playerFaintDone = true;
        this.state = 'defeat';
        this.showText([`${this.playerPokemon.nickname.toUpperCase()} fainted!`]);
      }
      this.faintAnimTarget = null;
    }
  }

  /** Get the current faint slide row count (0 = no slide, 8 = fully gone). */
  private getFaintSlideRows(): number {
    if (!this.faintAnimating) return 0;
    return Math.floor(this.faintAnimFrame / Battle.FAINT_FRAMES_PER_ROW);
  }

  // ──────── Learn-move interactive flow ────────
  // Assembly: engine/pokemon/learn_move.asm, data/text/text_7.asm

  /** Show the full TryingToLearnText sequence and end on the yes/no prompt.
   *  Assembly: TryingToLearnText — "X is\ntrying to learn\nY!\f
   *  But, X\ncan't learn more\nthan 4 moves!\f
   *  Delete an older\nmove to make room\nfor Y?" */
  private showTryingToLearnText(): void {
    const pName = this.learnMoveCurrent!.pokemon.nickname.toUpperCase();
    const moveName = this.learnMoveCurrent!.moveId.replace(/_/g, ' ');
    this.state = 'learn_move_prompt';
    this.textQueue = [];
    this.showText([`${pName} is`, `trying to learn`]);
    this.queueText([`${moveName}!`]);
    this.queueText([`But, ${pName}`, `can't learn more`]);
    this.queueText([`than 4 moves!`]);
    this.queueText([`Delete an older`, `move to make room`]);
    this.queueText([`for ${moveName}?`]);
    this.yesNoCursor = 0;
  }

  /** Start the learn-move prompt for the next pending move. */
  private startLearnMoveFlow(): void {
    this.learnMoveCurrent = this.learnMoveQueue.shift()!;
    this.showTryingToLearnText();
  }

  /** Update the yes/no cursor in learn_move_prompt and learn_move_confirm states. */
  private updateLearnMoveYesNo(): void {
    // First, drain any queued text
    if (this.textQueue.length > 0 || !this.waitingForInput) {
      this.updateTextWait();
      return;
    }

    // Yes/No cursor navigation
    if (isPressed('up') || isPressed('down')) {
      this.yesNoCursor = this.yesNoCursor === 0 ? 1 : 0;
    }

    if (isPressed('a')) {
      if (this.state === 'learn_move_prompt') {
        if (this.yesNoCursor === 0) {
          // YES — show "Which move should be forgotten?" then move selection
          // Assembly: WhichMoveToForgetText → then draw move list box
          this.state = 'learn_move_select';
          this.learnMoveSelectCursor = 0;
          this.waitingForInput = true;
          this.textQueue = [];
          this.textLines = [];
        } else {
          // NO — ask "Abandon learning?" (assembly: AbandonLearningText)
          this.state = 'learn_move_confirm';
          const moveName = this.learnMoveCurrent!.moveId.replace(/_/g, ' ');
          this.showText([`Abandon learning`, `${moveName}?`]);
          this.yesNoCursor = 0;
        }
      } else if (this.state === 'learn_move_confirm') {
        if (this.yesNoCursor === 0) {
          // YES — "X did not learn Y!" (assembly: DidNotLearnText)
          const pName = this.learnMoveCurrent!.pokemon.nickname.toUpperCase();
          const moveName = this.learnMoveCurrent!.moveId.replace(/_/g, ' ');
          this.learnMoveCurrent = null;
          this.state = 'gain_exp';
          this.showText([`${pName}`, `did not learn`]);
          this.queueText([`${moveName}!`]);
        } else {
          // NO — loop back to full TryingToLearnText (assembly: jr .loop)
          this.showTryingToLearnText();
        }
      }
    }

    if (isPressed('b')) {
      if (this.state === 'learn_move_prompt') {
        // B on prompt = same as NO → AbandonLearningText
        this.state = 'learn_move_confirm';
        const moveName = this.learnMoveCurrent!.moveId.replace(/_/g, ' ');
        this.showText([`Abandon learning`, `${moveName}?`]);
        this.yesNoCursor = 0;
      } else if (this.state === 'learn_move_confirm') {
        // B on confirm = same as NO → loop back to TryingToLearnText
        this.showTryingToLearnText();
      }
    }
  }

  /** Update the move selection cursor in learn_move_select state. */
  private updateLearnMoveSelect(): void {
    if (isPressed('up') && this.learnMoveSelectCursor > 0) {
      this.learnMoveSelectCursor--;
    }
    if (isPressed('down') && this.learnMoveSelectCursor < 3) {
      this.learnMoveSelectCursor++;
    }

    if (isPressed('a')) {
      const current = this.learnMoveCurrent!;
      const forgotMove = current.pokemon.moves[this.learnMoveSelectCursor];
      const forgotName = forgotMove.id.replace(/_/g, ' ');
      const newName = current.moveId.replace(/_/g, ' ');
      const pName = current.pokemon.nickname.toUpperCase();

      // Replace the selected move
      forceLearnMove(current.pokemon, current.moveId, this.learnMoveSelectCursor);

      // Assembly: OneTwoAndText → PoofText → ForgotAndText → LearnedMove1Text
      this.learnMoveCurrent = null;
      this.state = 'gain_exp';
      this.showText([`1, 2 and...`]);
      this.queueText([` Poof!`]);
      this.queueText([`${pName} forgot`, `${forgotName}!`]);
      this.queueText([`And...`]);
      this.queueText([`${pName} learned`, `${newName}!`]);
    }

    if (isPressed('b')) {
      // B on move select → loop back to full TryingToLearnText
      // Assembly: .cancel → jr .loop (back to TryingToLearnText)
      this.showTryingToLearnText();
    }
  }

  private checkFaint(): void {
    if (this.enemyPokemon.currentHp <= 0) {
      // Start slide-down faint animation for enemy, then show text
      this.faintAnimating = true;
      this.faintAnimFrame = 0;
      this.faintAnimTarget = 'enemy';
    } else if (this.playerPokemon.currentHp <= 0) {
      // Start slide-down faint animation for player, then show text
      this.faintAnimating = true;
      this.faintAnimFrame = 0;
      this.faintAnimTarget = 'player';
      this.playerPokemonFainted = true;
      // Assembly: core.asm — enemyLevel - playerLevel >= 30 triggers CARELESSTRAINER instead of FAINTED
      this.carelessTrainerFaint = (this.enemyPokemon.level - this.playerPokemon.level) >= 30;
    }
  }

  render(): void {
    // Trainer intro: custom rendering for slide-in, pokeballs, send-out
    if (this.state === 'trainer_intro') {
      renderBattleBg();
      this.renderTrainerIntro();
      return;
    }

    // Wild intro: flash + slide-in animation
    if (this.wildIntroPhase) {
      this.renderWildIntro();
      return;
    }

    // Party menu (voluntary or forced switch)
    if (this.state === 'choose_pokemon' || this.state === 'forced_switch') {
      this.partyMenu.render();
      return;
    }

    renderBattleBg();

    if (this.sprites) {
      // Enemy sprite: faint animation, hidden after faint, hidden after catch
      if (this.faintAnimating && this.faintAnimTarget === 'enemy') {
        renderEnemySpriteFaintSlide(this.sprites.enemyFront, this.getFaintSlideRows());
      } else if (!this.enemyFaintDone && (!this.caughtPokemon || this.state !== 'end')) {
        renderEnemySprite(this.sprites.enemyFront);
      }

      // Player sprite: faint animation, switch animation, or normal
      if (this.faintAnimating && this.faintAnimTarget === 'player') {
        renderPlayerSpriteFaintSlide(this.sprites.playerBack, this.getFaintSlideRows());
      } else if (this.playerFaintDone) {
        // Player sprite hidden after faint
      } else if (this.switchAnimating && this.switchAnimPhase === 'shrink') {
        const scale = getSwitchAnimScale('shrink', this.switchAnimFrame);
        if (scale > 0) renderPlayerSpriteScaled(this.sprites.playerBack, scale);
      } else if (this.switchAnimating && this.switchAnimPhase === 'poof') {
        renderPoofEffect(this.switchAnimFrame, POOF_FRAMES);
      } else if (this.switchAnimating && this.switchAnimPhase === 'grow') {
        const scale = getSwitchAnimScale('grow', this.switchAnimFrame);
        renderPlayerSpriteScaled(this.sprites.playerBack, scale);
      } else if (this.switchAnimating && this.switchAnimPhase === 'slide_out') {
        // Pikachu slides left off screen
        const t = this.switchAnimFrame / PIKA_SLIDE_FRAMES;
        const offset = -Math.round(t * PIKA_SLIDE_DISTANCE);
        renderPlayerSpriteSliding(this.sprites.playerBack, offset);
      } else if (this.switchAnimating && this.switchAnimPhase === 'slide_in') {
        // Pikachu slides in from the left
        const t = this.switchAnimFrame / PIKA_SLIDE_FRAMES;
        const offset = Math.round((1 - t) * -PIKA_SLIDE_DISTANCE);
        renderPlayerSpriteSliding(this.sprites.playerBack, offset);
      } else if (this.state !== 'intro' || this.introStep >= 1) {
        renderPlayerSprite(this.sprites.playerBack);
      }
    }

    // HUDs: hidden after faint animation completes (assembly: ClearScreenArea)
    if (!this.enemyFaintDone) {
      renderEnemyHUD(this.enemyPokemon, this.enemyDisplayHp);
    }
    const inSwitchAnim = this.switchAnimating ||
      this.state === 'switching_out';
    if (!this.playerFaintDone && !inSwitchAnim && (this.state !== 'intro' || this.introStep >= 1)) {
      renderPlayerHUD(this.playerPokemon, this.playerDisplayHp);
    }

    // Render text/menu based on state
    // Text messages take priority (e.g. "No other" messages while in choose_action)
    if (this.state === 'learn_move_select' && this.learnMoveCurrent) {
      renderLearnMoveSelect(this.learnMoveCurrent.pokemon, this.learnMoveSelectCursor);
    } else if ((this.state === 'learn_move_prompt' || this.state === 'learn_move_confirm') && this.waitingForInput && this.textQueue.length === 0) {
      renderBattleText(this.textLines);
      renderYesNoMenu(this.yesNoCursor);
    } else if (this.textLines.length > 0 && this.waitingForInput) {
      renderBattleText(this.textLines);
    } else if (this.state === 'choose_action') {
      renderActionMenu(this.actionCursor);
    } else if (this.state === 'choose_move') {
      renderMoveMenu(this.playerPokemon, this.moveCursor);
    } else if (this.state === 'choose_item') {
      renderItemMenu(this.bag?.items ?? [], this.itemCursor);
    } else if (this.textLines.length > 0) {
      renderBattleText(this.textLines);
    }

    // PAL_BLACK: applied AFTER everything (sprites, HUDs, text box) is drawn.
    // Assembly: SET_PAL_BATTLE_BLACK maps colors 1-3 to near-black, color 0 stays white.
    // Result: entire screen becomes high-contrast B&W (white bg, black everything else).
    if (this.state === 'blackout') {
      renderBlackoutOverlay();
    }
  }

  /** Render a sprite with silhouette→color blending at a given colorT (0=black, 1=full color). */
  private renderSpriteWithSilhouette(
    sprite: HTMLCanvasElement, silhouette: HTMLCanvasElement,
    renderFn: (s: HTMLCanvasElement, offset?: number) => void,
    colorT: number, offset = 0,
  ): void {
    if (colorT <= 0) {
      renderFn(silhouette, offset);
    } else if (colorT >= 1) {
      renderFn(sprite, offset);
    } else {
      renderFn(silhouette, offset);
      const ctx = getCtx();
      ctx.globalAlpha = colorT;
      renderFn(sprite, offset);
      ctx.globalAlpha = 1;
    }
  }

  /** Render the wild battle intro phases. */
  private renderWildIntro(): void {
    const layout = getTrainerIntroLayout();

    switch (this.wildIntroPhase) {
      case 'slide_in':
        renderBattleBg();
        if (this.sprites) {
          // Wild Pokemon silhouette starts LEFT, slides RIGHT to final position
          this.renderSpriteWithSilhouette(
            this.sprites.enemyFront, this.sprites.enemySilhouette,
            renderEnemySprite, 0, -this.wildSlideOffset,
          );
        }
        // Red (player trainer) silhouette starts RIGHT, slides LEFT to final position
        if (this.wildPlayerTrainer && this.wildPlayerTrainerSil) {
          renderTrainerSpriteAt(
            this.wildPlayerTrainer, this.wildPlayerTrainerSil,
            layout.playerFinalX + this.wildSlideOffset, layout.playerY, 0, true,
          );
        }
        break;

      case 'colorize':
        renderBattleBg();
        if (this.sprites) {
          this.renderSpriteWithSilhouette(
            this.sprites.enemyFront, this.sprites.enemySilhouette,
            renderEnemySprite, this.wildColorT,
          );
        }
        if (this.wildPlayerTrainer && this.wildPlayerTrainerSil) {
          renderTrainerSpriteAt(
            this.wildPlayerTrainer, this.wildPlayerTrainerSil,
            layout.playerFinalX, layout.playerY, this.wildColorT, true,
          );
        }
        break;

      case 'appeared_text':
        renderBattleBg();
        if (this.sprites) renderEnemySprite(this.sprites.enemyFront);
        renderEnemyHUD(this.enemyPokemon, this.enemyDisplayHp);
        // Show Red (player trainer) standing
        if (this.wildPlayerTrainer && this.wildPlayerTrainerSil) {
          renderTrainerSpriteAt(
            this.wildPlayerTrainer, this.wildPlayerTrainerSil,
            layout.playerFinalX, layout.playerY, 1, true,
          );
        }
        if (this.textLines.length > 0) renderBattleText(this.textLines);
        break;

      case 'send_player':
        renderBattleBg();
        if (this.sprites) renderEnemySprite(this.sprites.enemyFront);
        renderEnemyHUD(this.enemyPokemon, this.enemyDisplayHp);
        // Red slides LEFT off-screen (no Pokemon yet)
        if (this.wildPlayerTrainer && this.wildPlayerTrainerSil) {
          renderTrainerSpriteAt(
            this.wildPlayerTrainer, this.wildPlayerTrainerSil,
            layout.playerFinalX + this.wildPlayerOffset, layout.playerY, 1, true,
          );
        }
        if (this.textLines.length > 0) renderBattleText(this.textLines);
        break;

      case 'send_pokemon':
        renderBattleBg();
        if (this.sprites) renderEnemySprite(this.sprites.enemyFront);
        renderEnemyHUD(this.enemyPokemon, this.enemyDisplayHp);
        // Player Pokemon slides in from LEFT
        if (this.sprites) {
          const pokemonOffset = -SLIDE_OFFSET_OUT * (1 - this.wildIntroTimer / SEND_OUT_FRAMES);
          renderPlayerSprite(this.sprites.playerBack, pokemonOffset);
        }
        if (this.textLines.length > 0) renderBattleText(this.textLines);
        break;

      case 'go_text':
        renderBattleBg();
        if (this.sprites) {
          renderEnemySprite(this.sprites.enemyFront);
          renderPlayerSprite(this.sprites.playerBack);
        }
        renderEnemyHUD(this.enemyPokemon, this.enemyDisplayHp);
        renderPlayerHUD(this.playerPokemon, this.playerDisplayHp);
        if (this.textLines.length > 0) renderBattleText(this.textLines);
        break;
    }
  }

  /** Render the trainer intro animation phases. */
  private renderTrainerIntro(): void {
    const layout = getTrainerIntroLayout();
    const phase = this.trainerIntroPhase;
    if (!this.trainerAssets) return;

    const enemyX = layout.enemyFinalX + this.enemySideOffset;
    const playerX = layout.playerFinalX + this.playerSideOffset;

    // Determine what to draw on each side
    const showEnemyTrainer = phase === 'slide_in' || phase === 'colorize'
      || phase === 'pokeballs_text' || phase === 'send_enemy';
    const showPlayerTrainer = phase !== 'send_player_text';
    const showEnemyPokemon = phase === 'send_enemy' || phase === 'send_enemy_text'
      || phase === 'send_player' || phase === 'send_player_text';
    const showPlayerPokemon = phase === 'send_player' || phase === 'send_player_text';
    const showBalls = phase !== 'slide_in' && phase !== 'colorize';

    // Enemy side
    if (showEnemyTrainer) {
      renderTrainerSpriteAt(
        this.trainerAssets.enemyTrainer, this.trainerAssets.enemySilhouette,
        enemyX, layout.enemyY, this.trainerColorT, false,
      );
    }
    if (showEnemyPokemon && this.sprites) {
      // Enemy Pokemon slides in from right during send_enemy phase
      const pokemonOffset = phase === 'send_enemy'
        ? SLIDE_OFFSET_OUT * (1 - this.sendT) : 0;
      renderEnemySprite(this.sprites.enemyFront, pokemonOffset);
    }

    // Player side
    if (showPlayerTrainer) {
      renderTrainerSpriteAt(
        this.trainerAssets.playerTrainer, this.trainerAssets.playerSilhouette,
        playerX, layout.playerY, this.trainerColorT, true,
      );
    }
    if (showPlayerPokemon && this.sprites) {
      // Player Pokemon slides in from left during send_player phase
      const pokemonOffset = phase === 'send_player'
        ? -SLIDE_OFFSET_OUT * (1 - this.sendT) : 0;
      renderPlayerSprite(this.sprites.playerBack, pokemonOffset);
    }

    // Pokeball indicators
    if (showBalls) {
      const enemyPartySize = this.isTrainerBattle ? this.trainerParty.length : 1;
      renderPokeballs(this.playerParty.length, enemyPartySize);
    }

    // HUDs for Pokemon that are fully in position
    if (showEnemyPokemon && phase !== 'send_enemy') {
      renderEnemyHUD(this.enemyPokemon, this.enemyDisplayHp);
    }
    if (showPlayerPokemon && phase !== 'send_player') {
      renderPlayerHUD(this.playerPokemon, this.playerDisplayHp);
    }

    // Text
    if (this.textLines.length > 0) {
      renderBattleText(this.textLines);
    }
  }
}
