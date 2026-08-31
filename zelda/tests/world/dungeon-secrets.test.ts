import { describe, it, expect } from 'vitest';
import { checkSecretTrigger } from '../../src/world/dungeon-secrets.js';

describe('checkSecretTrigger', () => {
  it('trigger 0 returns no effect', () => {
    const r = checkSecretTrigger(0, true, true, true);
    expect(r.shuttersOpen).toBe(false);
    expect(r.stairsRevealed).toBe(false);
    expect(r.itemActivated).toBe(false);
  });

  it('trigger 1 (AllDead) opens shutters when all dead', () => {
    expect(checkSecretTrigger(1, true, false, false).shuttersOpen).toBe(true);
    expect(checkSecretTrigger(1, false, false, false).shuttersOpen).toBe(false);
  });

  it('trigger 7 (FoesForItem) opens shutters and activates item', () => {
    const r = checkSecretTrigger(7, true, false, false);
    expect(r.shuttersOpen).toBe(true);
    expect(r.itemActivated).toBe(true);
  });

  it('trigger 7 does nothing when enemies alive', () => {
    const r = checkSecretTrigger(7, false, false, false);
    expect(r.shuttersOpen).toBe(false);
    expect(r.itemActivated).toBe(false);
  });

  it('trigger 4 (BlockDoor) opens shutters on push complete', () => {
    expect(checkSecretTrigger(4, false, true, false).shuttersOpen).toBe(true);
    expect(checkSecretTrigger(4, false, false, false).shuttersOpen).toBe(false);
  });

  it('trigger 5 (BlockStairs) reveals stairs on push complete', () => {
    const r = checkSecretTrigger(5, false, true, false);
    expect(r.stairsRevealed).toBe(true);
    expect(r.shuttersOpen).toBe(false);
  });

  it('trigger 3 (LastBoss) opens shutters and activates item when boss defeated', () => {
    const r = checkSecretTrigger(3, false, false, true);
    expect(r.shuttersOpen).toBe(true);
    expect(r.itemActivated).toBe(true);
  });

  it('trigger 3 (LastBoss) does nothing when boss alive', () => {
    const r = checkSecretTrigger(3, false, false, false);
    expect(r.shuttersOpen).toBe(false);
    expect(r.itemActivated).toBe(false);
  });

  it('trigger 2 (Ringleader) always returns no effect', () => {
    const r = checkSecretTrigger(2, true, true, true);
    expect(r.shuttersOpen).toBe(false);
  });

  it('trigger 6 (MoneyOrLife) always returns no effect (deferred)', () => {
    const r = checkSecretTrigger(6, true, true, true);
    expect(r.shuttersOpen).toBe(false);
  });
});
