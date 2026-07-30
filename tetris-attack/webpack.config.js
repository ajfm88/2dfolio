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
          // The title-screen poster. A new asset *type* needs its own pattern
          // or it silently never reaches dist/ -- png and wav were here first.
          { from: "./src/assets/*.jpg", to: "dist/assets/[name][ext]", toType: "template"},
          // Sound. Kept in their own folders so the character voices stay
          // separable from the general one-shots.
          { from: "./src/assets/char_sfx/*.wav", to: "dist/assets/char_sfx/[name][ext]", toType: "template"},
          { from: "./src/assets/sfx/*.wav", to: "dist/assets/sfx/[name][ext]", toType: "template"},
          // Music. Streamed by <audio> rather than decoded up front like the
          // one-shots, since the stage loop alone is 2.6MB.
          { from: "./src/assets/ost/*.ogg", to: "dist/assets/ost/[name][ext]", toType: "template"},
          // VS pose sprites -- mixed png/webp/gif, all browser-native.
          { from: "./src/assets/char_ind_sprites/*", to: "dist/assets/char_ind_sprites/[name][ext]", toType: "template"},
          { from: "./index.html", to: "dist/index.html", toType: "file"},
          { from: "./favicon.ico", to: "dist/favicon.ico", toType: "file"},
        ]
      })
    ],
    // The art and audio are *copied*, not bundled, so webpack's default size
    // hints flag every one of them on every build -- which buries any warning
    // that actually matters. Only the emitted script is worth a size check.
    performance: {
      assetFilter: (name) => name.endsWith('.js'),
    },
    mode: mode,
    // If we're in development mode, then watch for changes, otherwise just do a single build.
    watch: mode !== "production"
  }
}