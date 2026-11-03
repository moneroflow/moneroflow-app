import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { copyFileSync, mkdirSync, existsSync } from "fs";

// Copy monero WASM worker to public/ so it's served statically
try {
  mkdirSync("public", { recursive: true });
  const workerSrc = "node_modules/monero-ts/dist/monero.worker.js";
  if (existsSync(workerSrc)) {
    copyFileSync(workerSrc, "public/monero.worker.js");
  }
} catch {}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    nodePolyfills({ include: ["http", "https", "fs", "stream", "util", "path", "os", "url"] }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true },
    // Relative base so the built index.html can be loaded from Capacitor's file:// webview.
    base: './',
  },
}));
