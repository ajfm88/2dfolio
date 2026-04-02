import k from "./kaplayCtx";
import { drawTiles, fetchMapData } from "./utils";
import { makeSamurai } from "./entities/samurai";
import { TiledLayer, Directions, Entity } from "./types";
import { makeNinja } from "./entities/ninja";
import { makeHealthbar } from "./ui/healthbar";

k.loadSprite(
  "background-layer-1",
  "./assets/background/background_layer_1.png"
);

k.loadSprite(
  "background-layer-2",
  "./assets/background/background_layer_2.png"
);

k.loadSprite("tileset", "./assets/oak_woods_tileset.png", {
  sliceX: 31,
  sliceY: 22,
});

k.loadSprite("samurai", "./assets/entities/samurai.png", {
  sliceX: 8,
  sliceY: 9,
  anims: {
    idle: {
      from: 32,
      to: 39,
      loop: true,
    },
    run: {
      from: 48,
      to: 55,
      loop: true,
    },
    attack: {
      from: 0,
      to: 5,
      speed: 16,
    },
    death: {
      from: 16,
      to: 21,
    },
    hit: {
      from: 56,
      to: 59,
    },
    jump: {
      from: 40,
      to: 41,
      loop: true,
    },
    fall: {
      from: 24,
      to: 25,
      loop: true,
    },
  },
});

k.loadSprite("ninja", "./assets/entities/ninja.png", {
  sliceX: 8,
  sliceY: 8,
  anims: {
    idle: {
      from: 32,
      to: 35,
      loop: true,
    },
    run: {
      from: 48,
      to: 55,
      loop: true,
    },
    attack: {
      from: 0,
      to: 3,
    },
    death: {
      from: 16,
      to: 22,
    },
    hit: {
      from: 56,
      to: 58,
    },
    jump: {
      from: 40,
      to: 41,
      loop: true,
    },
    fall: {
      from: 24,
      to: 25,
      loop: true,
    },
  },
});

k.loadSprite("shop", "./assets/shop_anim.png", {
  sliceX: 6,
  sliceY: 1,
  anims: {
    default: {
      from: 0,
      to: 5,
      loop: true,
    },
  },
});

k.loadSprite("fence-1", "./assets/fence_1.png");

async function arena(k: typeof import("./kaplayCtx").default) {
  k.setGravity(2000);

  k.add([k.sprite("background-layer-1"), k.pos(0, 0), k.scale(4), k.fixed()]);
  k.add([k.sprite("background-layer-2"), k.pos(0, 0), k.scale(4), k.fixed()]);

  const { layers, tilewidth, tileheight } = await fetchMapData(
    "./maps/arena.json"
  );

  const entities: { [key: string]: Entity | null } = {
    player1: null,
    player2: null,
  };

  const map = k.add([k.pos(0, 0)]);

  let layer: TiledLayer;
  for (layer of layers) {
    if (layer.name === "Boundaries" && layer.type === "objectgroup") {
      for (const object of layer.objects) {
        map.add([
          k.area({
            shape: new k.Rect(k.vec2(0), object.width, object.height),
          }),
          k.pos(object.x, object.y + tileheight),
          k.body({ isStatic: true }),
        ]);
      }
    }

    if (
      layer.name === "DecorationSpawnPoints" &&
      layer.type === "objectgroup"
    ) {
      for (const object of layer.objects) {
        switch (object.name) {
          case "shop":
            map.add([
              k.sprite("shop", { anim: "default" }),
              k.pos(object.x, object.y),
              k.area(),
              k.anchor("center"),
            ]);
            break;
          case "fence-1":
            map.add([
              k.sprite("fence-1"),
              k.pos(object.x, object.y + 6),
              k.area(),
              k.anchor("center"),
            ]);
            break;
          default:
        }
      }

      continue;
    }

    if (layer.name === "SpawnPoints" && layer.type === "objectgroup") {
      for (const object of layer.objects) {
        switch (object.name) {
          case "player-1":
            entities.player1 = makeSamurai(k, map, k.vec2(object.x, object.y));
            break;
          case "player-2":
            entities.player2 = makeNinja(k, map, k.vec2(object.x, object.y));
            break;
          default:
        }
      }

      continue;
    }

    if (layer.type === "tilelayer") {
      drawTiles(k, map, layer, tilewidth, tileheight);
    }
  }

  k.camPos(k.vec2(k.center().x - 450, k.center().y - 160));
  k.camScale(k.vec2(4));

  if (entities.player1?.gameObj)
    makeHealthbar(k, Directions.LEFT, entities.player1.gameObj);

  if (entities.player2?.gameObj)
    makeHealthbar(k, Directions.RIGHT, entities.player2.gameObj);

  // Controls overlay — dismissed on any key press
  const overlayItems: ReturnType<typeof k.add>[] = [];
  const addOverlay = (comps: Parameters<typeof k.add>[0]) => {
    const obj = k.add(comps);
    overlayItems.push(obj);
    return obj;
  };

  // Left panel — Player 1 (Samurai)
  addOverlay([k.rect(280, 210), k.pos(20, 255), k.color(0, 0, 0), k.opacity(0.72), k.fixed(), k.z(100)]);
  addOverlay([k.text("⚔️  PLAYER 1", { size: 18 }), k.pos(160, 273), k.anchor("center"), k.color(255, 200, 50), k.fixed(), k.z(101)]);
  addOverlay([k.text("W  —  Jump\nA  —  Move Left\nD  —  Move Right\nS  —  Attack", { size: 13 }), k.pos(40, 305), k.color(255, 255, 255), k.fixed(), k.z(101)]);

  // Right panel — Player 2 (Ninja)
  addOverlay([k.rect(280, 210), k.pos(980, 255), k.color(0, 0, 0), k.opacity(0.72), k.fixed(), k.z(100)]);
  addOverlay([k.text("🥷  PLAYER 2", { size: 18 }), k.pos(1120, 273), k.anchor("center"), k.color(100, 180, 255), k.fixed(), k.z(101)]);
  addOverlay([k.text("↑  —  Jump\n←  —  Move Left\n→  —  Move Right\n↓  —  Attack", { size: 13 }), k.pos(1000, 305), k.color(255, 255, 255), k.fixed(), k.z(101)]);

  // Centre prompt
  addOverlay([k.text("Press any key to start", { size: 15 }), k.pos(640, 690), k.anchor("center"), k.color(255, 255, 255), k.opacity(0.85), k.fixed(), k.z(101)]);

  const startHandler = k.onKeyPress(() => {
    for (const item of overlayItems) k.destroy(item);
    startHandler.cancel();
    entities.player1?.setControls();
    entities.player2?.setControls();
  });
}

k.scene("arena", () => arena(k));

k.go("arena");
