import CardGrid from "./CardGrid.js";
import cardtypes from "./cardtypes.js";

// Plain class (not a Phaser GameObject): owns layout math + the cards array.
// Composition: Grid *has* CardGrid instances; it doesn't extend them.
export default class Grid {
  constructor(data) {
    let { scene, columns, rows } = data;

    // Horizontal padding from left; vertical gap between rows
    this.xOffset = 120;
    this.yOffset = 280;
    // Front row sits near mid-screen; higher rows use smaller y
    this.yStart = scene.game.config.height / 2;

    this.columns = columns; // 3
    this.rows = rows; // 3
    this.scene = scene;
    this.cards = []; // index 0,1,2 = front row (left → right)

    // Fill the whole grid starting at index 0
    this.addCards(0);
  }

  // Spawn CardGrid from startIndex up to columns*rows (exclusive end = full grid)
  addCards(startIndex) {
    for (let index = startIndex; index < this.columns * this.rows; index++) {
      // Same random pick pattern as Phase 5
      const cardtype =
        cardtypes[Math.floor(Math.random() * cardtypes.length)];

      // Column: index % 3 → 0,1,2,0,1,2…
      // Row:    floor(index / 3) → 0 (front), 1, 2 (back)
      // x spreads across width; y stacks upward from yStart
      let card = new CardGrid({
        scene: this.scene,
        x:
          this.xOffset +
          (this.scene.game.config.width / 2 - this.xOffset) *
            (index % this.columns),
        y: this.yStart - this.yOffset * Math.floor(index / this.columns),
        card: "card",
        image: cardtype.image,
        value: cardtype.value,
        name: cardtype.name,
        type: cardtype.type,
      });
      card.depth = 0;
      this.cards.push(card);
    }
  }

  // After front row is removed, refill only the missing back row (indices 6–8)
  addBackRow() {
    // Guard: don't overfill if cards are still sliding
    if (this.cards.length >= this.columns * this.rows) return;
    this.addCards(6);
  }

  // Phase 7 combat end: fade unused front cards → destroy → slide rest down → new back row
  fadeFrontRow() {
    // Delay destroy/slide so the player sees the selected card resolve first
    setTimeout(() => {
      // splice removes first 3 from the array and returns them; then destroy each
      this.cards.splice(0, 3).forEach((card) => card.destroy());
      // Remaining cards tween down one row height
      this.cards.forEach((card) => {
        this.scene.tweens.add({
          targets: card,
          duration: 400,
          y: card.y + this.yOffset,
          onComplete: () => this.addBackRow(),
        });
      });
    }, 1000);

    // Immediately fade unselected front-row cards (selected stays visible briefly)
    this.cards.slice(0, 3).forEach((card) => {
      if (!card.selected) {
        this.scene.tweens.add({
          targets: card,
          alpha: 0,
          duration: 200,
        });
      }
    });
  }
}
