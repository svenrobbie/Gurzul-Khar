/**
 * Which engine the site runs.
 *
 * Chosen at BUILD time, not at runtime: `GKH_ENGINE=rust npm run build` points
 * the `@wasm` alias at the compiled WebAssembly and selects the Rust core;
 * anything else keeps the TypeScript engine and compiles the WebAssembly path
 * out entirely. That means the site always builds, whether or not the Rust
 * artifact has been produced.
 *
 * The two implementations are held to the same behaviour by the shared
 * fixtures in `tests/fixtures/` — the same words, the same expected results,
 * asserted by both test suites. Swapping between them should change nothing a
 * user can see except the name on the Engine page.
 */
import type { Engine } from "./types";
import { typescriptEngine } from "./typescript";

export * from "./types";

/** True when this build was compiled against the Rust core. */
export const USING_RUST_ENGINE = import.meta.env.VITE_GKH_ENGINE === "rust";

let active: Engine = typescriptEngine;

/**
 * Loads the engine. Awaited once at startup, before the app renders, because
 * WebAssembly instantiation is asynchronous while every call site is not.
 *
 * If the Rust engine was selected but fails to load, this falls back to the
 * TypeScript engine and says so in the console rather than leaving the site
 * blank — a translator that works is better than a correct one that never
 * appears.
 */
export async function initEngine(): Promise<void> {
  if (!USING_RUST_ENGINE) return;
  try {
    const { initRustEngine, rustEngine } = await import("./rust");
    await initRustEngine();
    active = rustEngine;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("The Rust engine failed to load; falling back to TypeScript.", error);
  }
}

/** The engine in use. */
export function engine(): Engine {
  return active;
}
