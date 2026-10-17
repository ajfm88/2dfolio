import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPokemon, loadBattleData } from '../battle/data';
import { restoreFlags } from '../events';
import { PikachuFollower } from './pikachu_follower';
import { getPikachuSpawnState, setPikachuSpawnState } from './pikachu_spawn';
import type { PikachuFontLoadedContext } from './pikachu_follower';

vi.mock('../input', () => ({ isHeld: () => false, isPressed: () => false }));
vi.mock('../renderer', () => ({ loadSprite: async () => ({}), drawSprite: vi.fn() }));
beforeAll(loadBattleData);
beforeEach(() => { restoreFlags(['BATTLED_RIVAL_IN_OAKS_LAB']); setPikachuSpawnState(0); });

function context(tileAt: (x: number, y: number) => number): PikachuFontLoadedContext {
  return { playerWalking: false, playerMapStep: { x: 8, y: 8 }, playerFacing: 'up',
    ui: { playerX: 128, playerY: 128, tileAt }, random: () => 0 };
}

describe('PC follower status-0 lifecycle (TrySpawnPikachu before the screen test)', () => {
  it('deposit removes eligibility and image immediately; later UI/map updates keep it absent', () => {
    const p = new PikachuFollower(); p.visible = true; p.spawn(128, 128, 'up');
    p.showStandingImage('up'); expect(p.collisionSprite(128, 128).available).toBe(true);
    p.reconcileStorageParty([createPokemon('RATTATA', 5)!]);
    expect(p.visible).toBe(false); expect(p.collisionSprite(128, 128).available).toBe(false);
    for (let i = 0; i < 4; i++) p.reconcileStorageParty([]);
    expect(p.visible).toBe(false);
  });

  it('healthy withdrawal retains old pixels through covered updates, then initializes on the player, hidden', () => {
    const p = new PikachuFollower(); p.spawn(128, 128, 'up');
    p.reconcileStorageParty([]);
    const pikachu = createPokemon('PIKACHU', 5)!;
    p.reconcileStorageParty([pikachu]);
    expect(p.visible).toBe(true);
    const oldPixels = [p.x, p.y];
    const covered = context(() => 0x60);
    p.fontLoadedUpdate(covered);
    expect([p.mapStepX, p.mapStepY]).toEqual([8, 8]);
    expect([p.x, p.y]).toEqual(oldPixels);
    expect(getPikachuSpawnState()).toBe(0); expect(p.collisionSprite(128, 128).available).toBe(false);
    p.reconcileStorageParty([pikachu]); p.fontLoadedUpdate(covered);
    expect([p.x, p.y]).toEqual(oldPixels); // eligibility is not initialization
    p.fontLoadedUpdate(context(() => 0));
    expect([p.x, p.y, p.direction]).toEqual([128, 128, 'up']);
    expect(Reflect.get(p, 'storageSpawnPending')).toBe(false);
    expect(p.collisionSprite(128, 128).available).toBe(false); // Func_fcae2 overlap
    // Follow commands start to execute as the player steps away.
    p.playerStepStarted('down', false); p.playerStepStarted('down', false);
    p.updateSprite({ ...context(() => 0), playerMapStep: { x: 8, y: 10 }, playerWalking: true });
    expect(p.isMoving).toBe(true); expect(p.collisionSprite(128, 160).available).toBe(true);
  });

  it('uses retained pre-initialization pixels for coverage, rather than eagerly moving to an uncovered player tile', () => {
    const p = new PikachuFollower(); p.spawn(128, 128, 'up'); p.reconcileStorageParty([]);
    p.reconcileStorageParty([createPokemon('PIKACHU', 5)!]);
    // Old sprite below the player is covered by the bottom text; player tile is clear.
    p.fontLoadedUpdate(context((_x, y) => y >= 10 ? 0x60 : 0));
    expect(p.y).toBe(144); expect(Reflect.get(p, 'storageSpawnPending')).toBe(true);
    p.updateSprite({ ...context(() => 0), ui: undefined }); // close's first ordinary UpdateSprites
    expect(p.y).toBe(128); expect(Reflect.get(p, 'storageSpawnPending')).toBe(false);
    expect(p.collisionSprite(128, 128).available).toBe(false);
  });

  it('deposit and covered withdrawal preserve an antic offset until initialization is permitted', () => {
    const p = new PikachuFollower(); p.visible = true; p.spawn(128, 128, 'up');
    Reflect.get(p, 'idle').offsetY = -2;
    p.reconcileStorageParty([]); expect(p.screenOffset).toEqual({ x: 0, y: -2 });
    p.reconcileStorageParty([createPokemon('PIKACHU', 5)!]); p.fontLoadedUpdate(context(() => 0x60));
    expect(p.screenOffset).toEqual({ x: 0, y: -2 }); expect(p.y).toBe(144);
    p.fontLoadedUpdate(context(() => 0)); expect(p.screenOffset).toEqual({ x: 0, y: 0 });
    expect(p.y).toBe(128);
  });

  it('a fainted withdrawal remains absent and keeps its HP/status', () => {
    const p = new PikachuFollower();
    const pikachu = createPokemon('PIKACHU', 5)!; pikachu.currentHp = 0; pikachu.status = 'PSN';
    p.reconcileStorageParty([pikachu]);
    expect(p.visible).toBe(false); expect(pikachu.currentHp).toBe(0); expect(pikachu.status).toBe('PSN');
  });

  it('normal spawns consume their state, so a later PC withdrawal uses settled state 0', () => {
    const p = new PikachuFollower(); setPikachuSpawnState(5); p.spawnAtState(128, 128, 'left', 5);
    expect(getPikachuSpawnState()).toBe(0);
    p.reconcileStorageParty([]); p.reconcileStorageParty([createPokemon('PIKACHU', 5)!]);
    p.fontLoadedUpdate(context(() => 0)); expect([p.mapStepX, p.mapStepY, p.direction]).toEqual([8, 8, 'up']);
  });
});
