/**
 * Stands in for the compiled WebAssembly module when the site is built without
 * it, so `npm run build` always works whether or not anyone has run the Rust
 * build yet.
 *
 * vite.config.ts aliases `@wasm` to this file unless GKH_ENGINE=rust, in which
 * case it points at crates/gkh-wasm/pkg. Nothing here is ever called in that
 * configuration.
 */
const NOT_BUILT =
  "The Rust engine was not compiled into this build. Build it with `npm run build:wasm` " +
  "(which needs the wasm32 target: `rustup target add wasm32-unknown-unknown`), " +
  "then rebuild the site with GKH_ENGINE=rust.";

export default async function init(): Promise<void> {
  throw new Error(NOT_BUILT);
}

export function translate(): string {
  throw new Error(NOT_BUILT);
}
export function word_ipa(): string {
  throw new Error(NOT_BUILT);
}
export function sentence_ipa(): string {
  throw new Error(NOT_BUILT);
}
export function engine_version(): string {
  return "not built";
}
export function analyze_sentence(): string {
  throw new Error(NOT_BUILT);
}
