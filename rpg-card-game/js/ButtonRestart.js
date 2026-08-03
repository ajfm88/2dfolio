// Named export (not default): import with { AddButtonRestart }.
// Small helper — no class needed; one job when the hero dies.
export function AddButtonRestart(scene) {
  // Center of the game canvas
  const restartbutton = scene.add.image(
    scene.game.config.width / 2,
    scene.game.config.height / 2,
    "restartbutton",
  );

  // Above cards (player depth is 1; grid is 0)
  restartbutton.depth = 2;
  // Images are not clickable until you opt in
  restartbutton.setInteractive();

  // Hover feedback: slightly grey, then back to white (no tint)
  restartbutton.on("pointerover", () => (restartbutton.tint = 0xcccccc));
  restartbutton.on("pointerout", () => (restartbutton.tint = 0xffffff));

  // Click → full scene rebuild (new grid, fresh Paladin, clean state)
  restartbutton.on("pointerdown", () => {
    restartbutton.tint = 0xffffff;
    // scene.scene = ScenePlugin; restart() re-runs preload/create for this scene
    scene.scene.restart();
  });
}
