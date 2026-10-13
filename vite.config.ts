import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// https://vite.dev/config/
const backendBaseUrl = "http://127.0.0.1:48767";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
      $features: fileURLToPath(new URL("./src/features", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/control": {
        target: backendBaseUrl,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
