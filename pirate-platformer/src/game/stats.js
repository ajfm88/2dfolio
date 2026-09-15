/**
 * Run health and coin totals.
 * Ported from Super-Pirate-World code_complete/data.py — setters without UI.
 */

import { tuning } from '../data/tuning.js';

export class Stats {
  constructor() {
    this._coins = 0;
    this._health = tuning.startHealth;
    this.invuln = 0;
  }

  get coins() {
    return this._coins;
  }

  set coins(value) {
    this._coins = value;
    while (this._coins >= tuning.coinExtraLife) {
      this._coins -= tuning.coinExtraLife;
      this.health += 1;
    }
  }

  get health() {
    return this._health;
  }

  set health(value) {
    this._health = value < 0 ? 0 : value;
  }

  get dead() {
    return this._health <= 0;
  }

  /**
   * @param {number} amount
   * @returns {boolean} true if damage applied
   */
  hurt(amount) {
    if (this.invuln > 0 || this._health <= 0) return false;
    this.health -= amount;
    if (this._health > 0) this.invuln = tuning.hitInvuln;
    return true;
  }

  /**
   * @param {number} dt always FIXED_DT
   */
  tick(dt) {
    this.invuln -= dt;
    if (this.invuln < 0) this.invuln = 0;
  }
}
