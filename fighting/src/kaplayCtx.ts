import kaplay from "kaplay";

const k = kaplay({
  width: 1280,
  height: 720,
  letterbox: true,
  global: false,
  debug: false, // set to false once ready for production
});

export default k;
