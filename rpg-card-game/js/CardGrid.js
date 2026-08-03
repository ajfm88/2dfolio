import CardBase from "./CardBase.js";

// Grid enemy/item card: CardBase + numeric value + yellow highlight when targeted.
export default class CardGrid extends CardBase {
  constructor(data) {
    // value/type are CardGrid-specific; rest (name, image, …) go to CardBase
    let { value, type } = data;
    super(data);

    // Number at the top of the frame (heal amount, armor, or attack power)
    this.textValue = new Phaser.GameObjects.BitmapText(
      this.scene,
      0,
      -100,
      "pressstart",
      value,
    );
    this.add(this.textValue);

    // Trigger value setter (layout + black tint)
    this.value = value;
    // Stored for Phase 7 combat switch (heal / armor / attack)
    this.cardtype = type;
  }

  // --- value (left-aligned near top of card) ---
  set value(newValue) {
    this._value = newValue;
    this.textValue.text = this._value;
    this.textValue.x = -45 - this.textValue.width / 2;
    this.textValue.tint = 0; // black
  }

  get value() {
    return this._value;
  }

  // Tint frame + art when the player is hovering a drop target
  set highlighted(highlight) {
    if (highlight) {
      let color = 0xcccc88; // pale yellow
      this.spriteCard.tint = color;
      this.spriteImage.tint = color;
    } else {
      // White = no tint (Phaser default)
      this.spriteCard.tint = 0xffffff;
      this.spriteImage.tint = 0xffffff;
    }
  }
}
