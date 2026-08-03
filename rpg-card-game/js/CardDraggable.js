import CardBase from './CardBase.js';

export default class CardDraggable extends CardBase {
  constructor(data) {
    // Pull the drop callback out; everything else goes to CardBase via super(data)
    let { ondragend } = data;
    super(data);

    // Remember home position so we can snap back
    this.originalX = this.x;
    this.originalY = this.y;

    // Flags used later (dead player, combat highlight, etc.)
    this.draggable = true;
    this.dragging = false;
    this.ondragend = ondragend;

    // Containers need an explicit hit area before Phaser will drag them
    this.setSize(this.spriteCard.width, this.spriteCard.height);
    this.setInteractive();
    this.scene.input.setDraggable(this);

    // Move with the pointer while dragging
    this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      if (!this.draggable) return;
      this.dragging = true;
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    // When released, hand control to the callback (snap-back for now)
    this.scene.input.on('dragend', (pointer, gameObject) => {
      this.dragging = false;
      gameObject.ondragend(pointer, gameObject);
    });
  }
}
