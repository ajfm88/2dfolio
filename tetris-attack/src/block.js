export const BLOCK_STATE_NORMAL = Symbol("BLOCK_STATE_NORMAL");
export const BLOCK_STATE_POPPING = Symbol("BLOCK_STATE_POPPING");
export const BLOCK_STATE_FALLING = Symbol("BLOCK_STATE_FALLING");
export const BLOCK_STATE_MOVING = Symbol("BLOCK_STATE_MOVING");
export const BLOCK_STATE_HOVERING = Symbol("BLOCK_STATE_HOVERING");

export const BLOCK_COLORS = ["green", "purple", "red", "yellow", "cyan"] //, "blue", "grey"];
const randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];

export class Block {
  constructor({ state = BLOCK_STATE_NORMAL, color = 'red' } = {}) {
    this._state = state;
    this.color = color;
    this.spriteIndex = BLOCK_COLORS.indexOf(color);
  }

  static randomBlock() {
    return new Block({color: randomChoice(BLOCK_COLORS)});
  }

  // Convenience for basic getter/setter methods
  _accessor(propertyName, newValue) {
    if (newValue !== undefined) {
      this[propertyName] = newValue;
    }
    return this[propertyName];
  }

  state(newState) { return this._accessor('_state', newState); }
  popTime(newTimeValue) { return this._accessor('_popTime', newTimeValue); }
  popAge(newAgeValue) { return this._accessor('_popAge', newAgeValue); }
  disapearAge(newAgeValue) { return this._accessor('_disapearAge', newAgeValue); }
  movePosition(opts) { return this._accessor('_movePosition', opts); }
  hoverTime(newValue) { return this._accessor('_hoverTime', newValue); }

  falling() {
    return this._state == BLOCK_STATE_FALLING;
  }

  previousPosition(opts) {
    if (opts) {
      this.lastPosition = opts;
      this.state(BLOCK_STATE_MOVING);
    }
    return this.lastPosition;
  }

  tick() {
    if (this._movePosition > 0) {
      this._movePosition -= 1 / 4;
      if (this._movePosition <= 0) {
        this.state(BLOCK_STATE_NORMAL);
      }
    }

    if (this._popAge != undefined) {
      this._popAge++;
    }
  }
}