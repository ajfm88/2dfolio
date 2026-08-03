// Data-driven card catalog: pure objects, no Phaser.
// Grid cards pick from this list; combat later switches on `type`.
export let cardtypes = [
  {
    name: "Minor Healing Potion",
    value: 3,
    image: "healingpotion",
    type: "heal",
  },
  {
    name: "Major Healing Potion",
    value: 6,
    image: "healingpotion",
    type: "heal",
  },
  {
    name: "Shield",
    value: 5,
    image: "shield",
    type: "armor",
  },
  {
    name: "Kobold",
    value: 6,
    image: "kobold",
    type: "attack",
  },
  {
    name: "Troll",
    value: 8,
    image: "troll",
    type: "attack",
  },
  {
    name: "Ogre",
    value: 10,
    image: "ogre",
    type: "attack",
  },
  {
    name: "Death Knight",
    value: 12,
    image: "deathknight",
    type: "attack",
  },
  {
    name: "Fire Drake",
    value: 16,
    image: "firedrake",
    type: "attack",
  },
  {
    name: "Golden Dragon",
    value: 20,
    image: "goldendragon",
    type: "attack",
  },
];

// Default export so either `import cardtypes` or `import { cardtypes }` works
export default cardtypes;
