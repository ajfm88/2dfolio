// Foundation for every card: frame + character/item art + name label.
// Extends Container so children move/draw as one object at (x, y).
export default class CardBase extends Phaser.GameObjects.Container {
  constructor(data) {
    // Destructure the config object so callers pass one data bag
    let { scene, x, y, name, card, image, depth } = data;

    // Local coords (0,0) are the container's center; scene x/y set below in super()
    let spriteCard = new Phaser.GameObjects.Sprite(scene, 0, 0, card);
    let spriteImage = new Phaser.GameObjects.Sprite(scene, 0, 20, image);
    let textName = new Phaser.GameObjects.BitmapText(
      scene,
      0,
      0,
      "pressstart",
      name,
      16,
      Phaser.GameObjects.BitmapText.ALIGN_CENTER,
    );

    // Container parent: world position (x, y) + list of child game objects
    super(scene, x, y, [spriteCard, spriteImage, textName]);

    // Keep refs so subclasses (and setters) can tint, swap textures, etc.
    this.spriteCard = spriteCard;
    this.spriteImage = spriteImage;
    this.textName = textName;

    // Triggers the cardname setter (layout + black tint)
    this.cardname = name;
    this.depth = depth;
    this.scene = scene;

    // Put this container on the display list (required for Containers you new up)
    this.scene.add.existing(this);
  }

  // Setter: whenever name changes, reflow the label under the card
  set cardname(newName) {
    this._cardname = newName;
    this.textName.text = this._cardname;
    this.textName.maxWidth = this.spriteCard.width;
    this.textName.tint = 0; // black
    // Center horizontally; sit near the bottom of the frame
    this.textName.x = -this.textName.width / 2;
    this.textName.y = 120 - this.textName.height;
  }

  // Flash the art, then swap to the "dead" texture (used when HP hits 0)
  deadAnimation() {
    this.scene.tweens.add({
      targets: this.spriteImage,
      alpha: 0,
      duration: 100,
      repeat: 1,
      yoyo: true,
      onComplete: () => {
        this.spriteImage.setTexture("dead");
      },
    });
  }
}
