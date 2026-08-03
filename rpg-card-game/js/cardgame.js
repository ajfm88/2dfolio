// Entry point — loaded from index.html as type="module".
// Boots Phaser with our config and hands control to MainScene.
import MainScene from './MainScene.js';

// Game config: canvas size, clear color, renderer, DOM parent, scene list
const config = {
  width: 640, // design width (portrait mobile-ish)
  height: 1024,
  backgroundColor: '#333333', // dark grey clear color
  type: Phaser.AUTO, // WebGL if available, else Canvas
  parent: 'phaser-game', // <div id="phaser-game"> in index.html
  scene: [MainScene], // scenes to register; first one starts automatically
};

// Creating the Game instance starts the boot → preload → create loop
new Phaser.Game(config);
