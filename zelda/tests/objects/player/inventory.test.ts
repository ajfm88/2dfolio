import { describe, it, expect } from 'vitest';
import { Link } from '../../../src/objects/player/link.js';

describe('Link inventory', () => {
  describe('rupees', () => {
    it('starts at 0', () => {
      const link = new Link();
      expect(link.rupees).toBe(0);
    });

    it('addRupees increases count', () => {
      const link = new Link();
      link.addRupees(50);
      expect(link.rupees).toBe(50);
    });

    it('caps at 999', () => {
      const link = new Link();
      link.addRupees(1200);
      expect(link.rupees).toBe(999);
    });

    it('spendRupees deducts correctly', () => {
      const link = new Link();
      link.addRupees(100);
      const result = link.spendRupees(30);
      expect(result).toBe(true);
      expect(link.rupees).toBe(70);
    });

    it('spendRupees fails if insufficient', () => {
      const link = new Link();
      link.addRupees(10);
      const result = link.spendRupees(20);
      expect(result).toBe(false);
      expect(link.rupees).toBe(10);
    });

    it('spendRupees allows exact amount', () => {
      const link = new Link();
      link.addRupees(50);
      const result = link.spendRupees(50);
      expect(result).toBe(true);
      expect(link.rupees).toBe(0);
    });
  });

  describe('keys', () => {
    it('starts at 0', () => {
      const link = new Link();
      expect(link.keys).toBe(0);
    });

    it('addKeys increases count', () => {
      const link = new Link();
      link.addKeys(3);
      expect(link.keys).toBe(3);
    });

    it('caps at 255', () => {
      const link = new Link();
      link.addKeys(300);
      expect(link.keys).toBe(255);
    });
  });

  describe('bombs', () => {
    it('starts at 0', () => {
      const link = new Link();
      expect(link.bombs).toBe(0);
    });

    it('addBombs increases count', () => {
      const link = new Link();
      link.addBombs(4);
      expect(link.bombs).toBe(4);
    });

    it('caps at maxBombs (8)', () => {
      const link = new Link();
      link.addBombs(20);
      expect(link.bombs).toBe(8);
    });
  });

  describe('heart container', () => {
    it('starts with 6 half-hearts (3 containers)', () => {
      const link = new Link();
      expect(link.maxHealth).toBe(6);
    });

    it('addHeartContainer increases max health by 2 and heals', () => {
      const link = new Link();
      link.addHeartContainer();
      expect(link.maxHealth).toBe(8);
      expect(link.health).toBe(8);
    });

    it('caps at 32 half-hearts (16 containers)', () => {
      const link = new Link();
      for (let i = 0; i < 20; i++) link.addHeartContainer();
      expect(link.maxHealth).toBe(32);
    });
  });
});
