/**
 * The engine the site runs.
 *
 * One implementation: `crates/gkh-core`, compiled to WebAssembly. The same
 * crate backs the Android app and the command-line tools, so a change to the
 * language lands everywhere at once instead of having to be made twice and
 * then kept in step.
 *
 * `initEngine()` must be awaited before anything renders, because WebAssembly
 * instantiation is asynchronous while every call site is not. There is
 * deliberately no fallback: a site that silently runs a second, different
 * engine when the first fails to load is worse than one that says so.
 */
import type { Engine } from "./types";
import { initRustEngine, rustEngine } from "./rust";

export * from "./types";

let active: Engine | null = null;
let failure: Error | null = null;

/** Loads the engine. Awaited once at startup, before the app renders. */
export async function initEngine(): Promise<void> {
  try {
    await initRustEngine();
    active = rustEngine;
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    // eslint-disable-next-line no-console
    console.error("The engine failed to load.", error);
  }
}

/** Null until the engine has loaded, and after a load failure. Pages that can render without it check this rather than throwing. */
export function engineOrNull(): Engine | null {
  return active;
}

/** Why the engine is unavailable, or null when it loaded. */
export function engineFailure(): Error | null {
  return failure;
}

/**
 * The engine. Throws if it failed to load — call sites that run inside an
 * event handler or a render path where there is nothing sensible to show
 * should use {@link engineOrNull} instead.
 */
export function engine(): Engine {
  if (!active) {
    throw failure ?? new Error("The engine has not finished loading yet.");
  }
  return active;
}
