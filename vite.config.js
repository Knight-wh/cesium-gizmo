import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cesiumSource = "node_modules/cesium/Build/Cesium";
// This is the base url for static files that CesiumJS needs to load.
// Set to an empty string to place the files at the site's root path
const cesiumBaseUrl = "cesiumStatic";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig((context) => {
  const mode = context.mode;
  const isProd = mode === "production";

  const plugins = [];
  if (!isProd) {
    plugins.push(
      // Copy Cesium Assets, Widgets, and Workers to a static directory.
      viteStaticCopy({
        targets: [
          { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
          { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
          { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
          { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
          { src: "assets", dest: "" },
        ],
      }),
    );
  }

  return {
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.js"),
        name: "CesiumGizmo",
        fileName: (format) => `cesium-gizmo.${format}.js`,
      },
      rollupOptions: {
        external: ["cesium"],
        output: {
          globals: {
            cesium: "Cesium",
          },
        },
      },
    },
    define: {
      CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
    },
    plugins,
  };
});
