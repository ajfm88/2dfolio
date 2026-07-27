const path = require("path")
const CopyPlugin = require("copy-webpack-plugin");

// Used to determine whether to watch the files or build.
const env = "development" // process.env.WEBPACK_ENV || "production"

module.exports = (env) => {
  // The main file for the bundle.
  const mode = env.mode === 'development' ? 'development' : 'production';

  return {
    entry: "./src/app.js",
    output: {
      // Name of the bundle file.
      filename: "dist/js/ta.js",
      path: path.resolve(__dirname, ""),
      libraryTarget: "var",
      library: "TA"
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: "./src/assets/*.png", to: "dist/assets/[name][ext]", toType: "template"},
          // Sound. Kept in their own folders so the character voices stay
          // separable from the general one-shots.
          { from: "./src/assets/char_sfx/*.wav", to: "dist/assets/char_sfx/[name][ext]", toType: "template"},
          { from: "./src/assets/sfx/*.wav", to: "dist/assets/sfx/[name][ext]", toType: "template"},
          // VS pose sprites -- mixed png/webp/gif, all browser-native.
          { from: "./src/assets/char_ind_sprites/*", to: "dist/assets/char_ind_sprites/[name][ext]", toType: "template"},
          { from: "./tetrisattack.html", to: "dist/tetrisattack.html", toType: "file"},
        ]
      })
    ],
    mode: mode,
    // If we're in development mode, then watch for changes, otherwise just do a single build.
    watch: mode !== "production"
  }
}