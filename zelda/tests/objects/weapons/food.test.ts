import { describe, it, expect } from 'vitest';
import { Food, FoodState } from '../../../src/objects/weapons/food.js';
import { FOOD_PHASE_TIMER } from '../../../src/core/constants.js';

describe('Food', () => {
  it('starts in Phase1 state', () => {
    const food = new Food(100, 80);
    expect(food.state).toBe(FoodState.Phase1);
    expect(food.isActive).toBe(true);
  });

  it('stays at its placed position (stationary)', () => {
    const food = new Food(100, 80);
    for (let i = 0; i < 100; i++) food.update();
    expect(food.x).toBe(100);
    expect(food.y).toBe(80);
  });

  it('transitions through 3 phases of 255 frames each', () => {
    const food = new Food(100, 80);

    // Phase 1: 255 frames
    for (let i = 0; i < FOOD_PHASE_TIMER; i++) {
      expect(food.state).toBe(FoodState.Phase1);
      food.update();
    }

    // Phase 2: 255 frames
    for (let i = 0; i < FOOD_PHASE_TIMER; i++) {
      expect(food.state).toBe(FoodState.Phase2);
      food.update();
    }

    // Phase 3: 255 frames
    for (let i = 0; i < FOOD_PHASE_TIMER; i++) {
      expect(food.state).toBe(FoodState.Phase3);
      food.update();
    }

    expect(food.state).toBe(FoodState.Dead);
    expect(food.isActive).toBe(false);
  });

  it('total lifetime is exactly 765 frames', () => {
    const food = new Food(100, 80);
    for (let i = 0; i < 765; i++) {
      expect(food.isActive).toBe(true);
      food.update();
    }
    expect(food.isActive).toBe(false);
  });

  it('getPosition returns placed coordinates', () => {
    const food = new Food(42, 99);
    const pos = food.getPosition();
    expect(pos.x).toBe(42);
    expect(pos.y).toBe(99);
  });

  it('does not update after death', () => {
    const food = new Food(100, 80);
    for (let i = 0; i < 765; i++) food.update();
    expect(food.isActive).toBe(false);
    food.update();
    expect(food.state).toBe(FoodState.Dead);
  });
});
