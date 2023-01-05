const path = require("node:path");

/** @return {import("webpack").Configuration} */
module.exports = (env, { mode = "production" }) => ({
  mode,
  devtool: mode === "development" ? "cheap-module-source-map" : "source-map",
  entry: "./src/main.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: "ts-loader",
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "public"),
  },
  node: false,
  /** @type {import("webpack-dev-server").Configuration} */
  devServer: {
    allowedHosts: "all",
    port: 3333,
    static: {
      directory: path.join(__dirname, "public"),
    },
  },
});
