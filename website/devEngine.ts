// Loads the WebAssembly engine inside the Vite dev server's own Node process,
// so the local review tool validates a proposed word with exactly the same
// code the browser and the Android app use. A second implementation of
// "is this legal Gurzûl Khar" living in the dev server is precisely the
// duplication this project spent a port avoiding.
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(here, "../crates/gkh-wasm/pkg");

export interface DevEngine {
  check_word(word: string): string;
  word_ipa(word: string): string;
  coin(lemma: string, pos: string, lang: string): string;
}

let loaded: DevEngine | null = null;

export async function devEngine(): Promise<DevEngine> {
  if (loaded) return loaded;

  const entry = path.join(PKG, "gkh_wasm.js");
  if (!existsSync(entry)) {
    throw new Error(
      "The WebAssembly engine has not been built, so proposals cannot be validated. Run `npm run build:wasm`.",
    );
  }

  // The package is built with --target web, which expects to fetch its own
  // .wasm from a URL. Node has no fetch for a file path, so the bytes are
  // handed to the initialiser directly.
  const mod = await import(pathToFileURL(entry).href);
  await mod.default(await fs.readFile(path.join(PKG, "gkh_wasm_bg.wasm")));
  loaded = mod as DevEngine;
  return loaded;
}
