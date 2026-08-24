import k from "../kaplayCtx";

export default function disclaimer() {
  k.add([
    k.text(
      `
        Sonic is owned by SEGA.
      `,
      { font: "mania", size: 32 },
    ),
  ]);

  k.add([
    k.text("Press Space/Click/Touch to Start The Game", {
      font: "mania",
      size: 64,
    }),
    k.anchor("center"),
    k.pos(k.center()),
  ]);

  k.onButtonPress("jump", () => k.go("main-menu"));
}
