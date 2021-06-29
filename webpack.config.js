const path = require("path");

/** @return {import("webpack").Configuration} */
module.exports = (env, { mode = "production" }) => ({
  mode,
  devtool: mode === "development" ? "eval-cheap-module-source-map" : "source-map",
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
  devServer: {
    contentBase: path.join(__dirname, "public"),
    disableHostCheck: true,
    port: 3333,
  },
});
