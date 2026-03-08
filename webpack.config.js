const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";

  return {
    entry: {
      taskpane: "./src/taskpane/index.tsx",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].bundle.js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/taskpane/taskpane.html",
        filename: "taskpane.html",
        chunks: ["taskpane"],
      }),
      new CopyPlugin({
        patterns: [
          // PDF.js worker
          {
            from: "node_modules/pdfjs-dist/build/pdf.worker.mjs",
            to: "pdf.worker.mjs",
          },
          // Tesseract worker (core WASM is loaded from CDN by the worker)
          {
            from: "node_modules/tesseract.js/dist/worker.min.js",
            to: "tesseract-worker.min.js",
          },
          // Assets
          { from: "assets", to: "assets", noErrorOnMissing: true },
          // Manifest (for debugging)
          { from: "manifest.xml", to: "manifest.xml" },
        ],
      }),
    ],
    devServer: {
      port: 3000,
      server: {
        type: "https",
        options: {
          cert: require("fs").readFileSync(
            require("path").join(require("os").homedir(), ".office-addin-dev-certs/localhost.crt")
          ),
          key: require("fs").readFileSync(
            require("path").join(require("os").homedir(), ".office-addin-dev-certs/localhost.key")
          ),
        },
      },
      hot: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    devtool: isDev ? "source-map" : false,
  };
};
