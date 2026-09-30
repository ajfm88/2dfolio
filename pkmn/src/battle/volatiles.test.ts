import { describe, it, expect } from 'vitest';
import { createVolatiles, resetVolatiles } from './volatiles';

describe('createVolatiles', () => {
  it('initializes all numeric fields to 0', () => {
    const v = createVolatiles();
    expect(v.confusion).toBe(0);
    expect(v.substitute).toBe(0);
    expect(v.thrashing).toBe(0);
    expect(v.binding).toBe(0);
    expect(v.usingBinding).toBe(0);
    expect(v.lastDamageDealt).toBe(0);
    expect(v.lastDamageReceived).toBe(0);
    expect(v.payDayMoney).toBe(0);
    expect(v.multiHitCount).toBe(0);
    expect(v.multiHitTotal).toBe(0);
  });

  it('initializes all boolean fields to false', () => {
    const v = createVolatiles();
    expect(v.leechSeed).toBe(false);
    expect(v.mist).toBe(false);
    expect(v.focusEnergy).toBe(false);
    expect(v.reflect).toBe(false);
    expect(v.lightScreen).toBe(false);
    expect(v.rage).toBe(false);
    expect(v.invulnerable).toBe(false);
    expect(v.recharging).toBe(false);
    expect(v.flinch).toBe(false);
    expect(v.transformed).toBe(false);
  });

  it('initializes all nullable fields to null', () => {
    const v = createVolatiles();
    expect(v.bide).toBeNull();
    expect(v.charging).toBeNull();
    expect(v.disabled).toBeNull();
    expect(v.lastMoveUsed).toBeNull();
    expect(v.convertedType1).toBeNull();
    expect(v.convertedType2).toBeNull();
    expect(v.mimicOriginal).toBeNull();
  });

  it('initializes mimicSlot to -1', () => {
    const v = createVolatiles();
    expect(v.mimicSlot).toBe(-1);
  });
});

describe('resetVolatiles', () => {
  it('returns object identical to createVolatiles', () => {
    expect(resetVolatiles()).toEqual(createVolatiles());
  });

  it('returns a new object each call', () => {
    const a = resetVolatiles();
    const b = resetVolatiles();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
