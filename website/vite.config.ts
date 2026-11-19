import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { lexiconDevApiPlugin } from "./devApi.js";

// GitHub Pages serves this site from https://<user>.github.io/gurzul-khar/ — a non-root path.
// We use react-router's HashRouter (see src/main.tsx) specifically so that deep links and page
// refreshes work correctly on GitHub Pages' static hosting without needing a 404.html SPA-redirect
// trick or any base-path-aware <BrowserRouter basename>. This is documented in README.md and the
// Engine docs page. `base` only needs to point relative asset URLs (JS/CSS/data) at the right
// subpath; it does not affect in-app routing.
export default defineConfig({
  plugins: [react(), lexiconDevApiPlugin()],
  base: process.env.GITHUB_PAGES === "true" ? "/gurzul-khar/" : "/",
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname)],
    },
  },
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "../engine"),
      "@data": path.resolve(__dirname, "../data"),
    },
  },
  build: {
    outDir: "dist",
  },
});
