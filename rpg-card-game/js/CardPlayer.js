import CardDraggable from './CardDraggable.js';

// Hero card: health / max health / armor UI + combat math on top of drag behavior.
export default class CardPlayer extends CardDraggable {
  constructor(data) {
    // Only pull what CardBase/CardDraggable don't already take from data
    let { health } = data;
    super(data);

    // BitmapText coords are relative to the container center
    this.textHealth = new Phaser.GameObjects.BitmapText(
      this.scene, 0, -102, 'pressstart', health
    );
    this.textMaxHealth = new Phaser.GameObjects.BitmapText(
      this.scene, -20, -90, 'pressstart', health, 12
    );
    this.textArmor = new Phaser.GameObjects.BitmapText(
      this.scene, 0, -102, 'pressstart'
    );
    this.spriteArmor = new Phaser.GameObjects.Sprite(
      this.scene, 50, -80, 'armor'
    );

    // Black tint so numbers read on the light card frame
    this.textHealth.tint = 0;
    this.textMaxHealth.tint = 0;

    // Add UI as container children (move with the card when dragging)
    this.add([this.textHealth, this.textMaxHealth, this.spriteArmor, this.textArmor]);

    // Trigger setters (layout + hide armor when 0)
    this.health = health;
    this.maxHealth = health;
    this.armor = 0;
  }

  // --- health ---
  set health(newHealth) {
    this._health = newHealth;
    this.textHealth.text = this._health;
    // Left side of the card; re-center as digit count changes
    this.textHealth.x = -44 - this.textHealth.width / 2;
  }

  get health() {
    return this._health;
  }

  // --- max health (small number under current HP) ---
  set maxHealth(newMaxHealth) {
    this._maxHealth = newMaxHealth;
  }

  get maxHealth() {
    return this._maxHealth;
  }

  // --- armor (icon + value; hidden when 0) ---
  set armor(newArmor) {
    this._armor = newArmor;
    this.textArmor.text = this._armor;
    this.textArmor.x = 47 - this.textArmor.width / 2;
    // Ternary: hide both number and shield when armor is empty
    this.textArmor.alpha = this._armor == 0 ? 0 : 1;
    this.spriteArmor.alpha = this._armor == 0 ? 0 : 1;
  }

  get armor() {
    return this._armor;
  }

  // Armor absorbs first; leftover damage hits health; ≤0 → dead
  attack(attackValue) {
    if (attackValue <= this.armor) {
      this.armor = this.armor - attackValue;
    } else {
      this.health = this.health - (attackValue - this.armor);
      this.armor = 0;
    }
    if (this.health <= 0) this.dead = true;
  }

  set dead(dead) {
    this.health = '0';
    this.cardname = 'DEAD';
    this.draggable = false; // CardDraggable's drag handler checks this
    this.deadAnimation();   // from CardBase
  }

  get dead() {
    // Name string is the source of truth (matches final)
    return this._cardname == 'DEAD';
  }
}
