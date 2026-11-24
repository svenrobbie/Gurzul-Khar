import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { lexiconDevApiPlugin } from "./devApi.js";

// GitHub Pages serves this site from https://svenrobbie.github.io/Gurzul-Khar/ — a non-root path.
// We use react-router's HashRouter (see src/main.tsx) specifically so that deep links and page
// refreshes work correctly on GitHub Pages' static hosting without needing a 404.html SPA-redirect
// trick or any base-path-aware <BrowserRouter basename>. This is documented in README.md and the
// Engine docs page. `base` only needs to point relative asset URLs (JS/CSS/data) at the right
// subpath; it does not affect in-app routing.

// The site has one engine: the Rust core compiled to WebAssembly. There is no
// TypeScript implementation to fall back to, so a missing artifact is a build
// failure — and it says what to do about it, rather than failing later with an
// unresolved import.
function wasmEntry(): string {
  const entry = path.resolve(__dirname, "../crates/gkh-wasm/pkg/gkh_wasm.js");
  if (!fs.existsSync(entry)) {
    throw new Error(
      "The WebAssembly engine has not been built, so there is nothing for this site to run.\n" +
        "  npm run build:wasm\n" +
        "which needs the wasm32 target and wasm-pack:\n" +
        "  rustup target add wasm32-unknown-unknown\n" +
        "  cargo install wasm-pack",
    );
  }
  return entry;
}

export default defineConfig({
  plugins: [react(), lexiconDevApiPlugin()],
  // The repository is github.com/svenrobbie/Gurzul-Khar, so Pages serves it from
  // /Gurzul-Khar/ — and that path is CASE-SENSITIVE. A lowercase base here 404s
  // every asset on the deployed site while working perfectly in local dev.
  base: process.env.GITHUB_PAGES === "true" ? "/Gurzul-Khar/" : "/",
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname)],
    },
  },
  resolve: {
    alias: {
      "@data": path.resolve(__dirname, "../data"),
      "@wasm": wasmEntry(),
    },
  },
  build: {
    outDir: "dist",
  },
});
