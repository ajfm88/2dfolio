import CardPlayer from "./CardPlayer.js";
import Grid from "./Grid.js";
import { AddButtonRestart } from "./ButtonRestart.js";

// One Phaser scene = one "screen" of the game (we only need this one).
// Lifecycle: constructor → preload → create → update (every frame).
export default class MainScene extends Phaser.Scene {
  constructor() {
    // Scene key used by Phaser when starting / restarting
    super("MainScene");
  }

  // Runs once before create. Register every asset key we'll use later.
  preload() {
    this.load.image("armor", "assets/armor.png");
    this.load.image("card", "assets/card.png");
    this.load.image("dead", "assets/dead.png");
    this.load.image("deathknight", "assets/deathknight.png");
    this.load.image("firedrake", "assets/firedrake.png");
    this.load.image("goldendragon", "assets/goldendragon.png");
    this.load.image("healingpotion", "assets/healingpotion.png");
    this.load.image("kobold", "assets/kobold.png");
    this.load.image("ogre", "assets/ogre.png");
    this.load.image("paladin", "assets/paladin.png");
    this.load.image("playercard", "assets/playercard.png");
    this.load.image("restartbutton", "assets/restartbutton.png");
    this.load.image("shield", "assets/shield.png");
    this.load.image("troll", "assets/troll.png");
    // Bitmap font: image atlas + .fnt metrics (used for card names / numbers)
    this.load.bitmapFont(
      "pressstart",
      "assets/pressstart.png",
      "assets/pressstart.fnt",
    );
  }

  // Runs once after assets are ready — spawn game objects here
  create() {
    // 3×3 grid of random enemy/item cards above the player
    this.grid = new Grid({ scene: this, columns: 3, rows: 3 });

    // Paladin at bottom center with health/armor UI
    this.player = new CardPlayer({
      scene: this,
      x: this.game.config.width / 2,
      y: this.game.config.height - 200,
      name: "Paladin",
      card: "playercard",
      image: "paladin",
      health: 16,
      depth: 1,
      // Phase 7b: resolve drop — snap home, then combat if a front card is highlighted
      ondragend: (pointer, gameObject) => {
        // Always return the hero to its seat first
        this.player.x = this.player.originalX;
        this.player.y = this.player.originalY;

        // update() may have set this.highlighted to a front-row CardGrid
        if (this.highlighted) {
          // Slide hero briefly over the target (visual cue); originalX stays for next drag
          this.player.originalX = this.player.x = this.highlighted.x;
          // Mark so fadeFrontRow keeps this card visible while others fade
          this.highlighted.selected = true;

          // Branch on data from cardtypes.js (heal / armor / attack)
          switch (this.highlighted.cardtype) {
            case "attack":
              // Enemy hits the player; armor absorbs first (CardPlayer.attack)
              this.player.attack(this.highlighted.value);
              this.highlighted.dead = true;
              this.highlighted.deadAnimation(); // CardBase flash → "dead" art
              break;
            case "heal":
              // Clamp so HP never exceeds maxHealth
              this.player.health = Math.min(
                this.player.health + this.highlighted.value,
                this.player.maxHealth,
              );
              break;
            case "armor":
              // Replace current armor with the shield's value
              this.player.armor = this.highlighted.value;
              break;
          }

          // Dead hero can't drag (CardPlayer.dead setter); show restart instead of advancing
          if (this.player.dead) {
            AddButtonRestart(this);
          } else {
            // Fade front row, slide mid/back down, spawn new back row
            this.grid.fadeFrontRow();
          }
        }
      },
    });
  }

  // Phase 7a: every frame — clear then re-highlight the front-row column under the hero
  update(time, delta) {
    // Reset all front seats (indices 0, 1, 2)
    this.grid.cards[0].highlighted = false;
    this.grid.cards[1].highlighted = false;
    this.grid.cards[2].highlighted = false;
    this.highlighted = null;

    // One third of the screen width ≈ one column
    let columnWidth = this.game.config.width / this.grid.columns;
    // How far sideways the player has been dragged from home
    let xDiff = Math.abs(this.player.x - this.player.originalX);

    // Only target when dragged high enough (y small) and not wildly off to the side
    if (this.player.y < 700 && xDiff < columnWidth * 1.4) {
      if (this.player.x < columnWidth) {
        // Left third
        this.grid.cards[0].highlighted = true;
        this.highlighted = this.grid.cards[0];
      } else if (this.player.x > columnWidth * 2) {
        // Right third
        this.grid.cards[2].highlighted = true;
        this.highlighted = this.grid.cards[2];
      } else {
        // Middle third
        this.grid.cards[1].highlighted = true;
        this.highlighted = this.grid.cards[1];
      }
    }
  }
}
