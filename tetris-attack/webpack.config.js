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
          { from: "./src/*.png", to: "dist/[name][ext]", toType: "template"},
          { from: "./tetrisattack.htm", to: "dist/tetrisattack.html", toType: "file"},
        ]
      })
    ],
    mode: mode,
    // If we're in development mode, then watch for changes, otherwise just do a single build.
    watch: mode !== "production"
  }
}