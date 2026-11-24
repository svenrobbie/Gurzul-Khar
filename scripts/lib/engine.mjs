// Loads the WebAssembly engine in Node, so the project's tooling runs the same
// code as the website and the Android app.
//
// Everything these scripts need to know about Gurzûl Khar comes from here.
// Nothing reimplements a rule: a script that wanted its own idea of what a
// legal word is would be exactly the duplication the Rust port removed.
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../..");
const PKG = path.join(ROOT, "crates/gkh-wasm/pkg");

let loaded = null;

export async function engine() {
  if (loaded) return loaded;

  const entry = path.join(PKG, "gkh_wasm.js");
  if (!existsSync(entry)) {
    throw new Error(
      "The WebAssembly engine has not been built. Run `npm run build:wasm` first " +
        "(it needs `rustup target add wasm32-unknown-unknown` and wasm-pack).",
    );
  }

  // Built with --target web, which expects to fetch its own .wasm from a URL.
  // Node has no fetch for a file path, so the bytes go in directly.
  const mod = await import(pathToFileURL(entry).href);
  await mod.default(await fs.readFile(path.join(PKG, "gkh_wasm_bg.wasm")));
  loaded = mod;
  return mod;
}

export async function readData(relative) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relative), "utf8"));
}

export async function writeData(relative, value, { compact = false } = {}) {
  const text = compact ? JSON.stringify(value) : JSON.stringify(value, null, 2);
  await fs.writeFile(path.join(ROOT, relative), text + "\n", "utf8");
}
