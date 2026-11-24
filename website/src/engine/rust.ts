/**
 * The Rust core, compiled to WebAssembly, wrapped to the same surface.
 *
 * The boundary passes JSON strings rather than structured values: the binding
 * crate builds them by hand so it needs no serialisation dependency, which
 * keeps the artifact every visitor downloads small.
 */
import init, {
  translate as wasmTranslate,
  word_ipa,
  sentence_ipa,
  engine_version,
  analyze_sentence,
} from "@wasm";
import type { Direction, Engine, TranslationResult, WordAnalysis } from "./types";

let ready = false;

/** Loads the WebAssembly module. Call once, before rendering. */
export async function initRustEngine(): Promise<void> {
  await init();
  ready = true;
}

/** True once the module has loaded. */
export function rustEngineReady(): boolean {
  return ready;
}

export const rustEngine: Engine = {
  get name() {
    return engine_version();
  },

  translate(input: string, direction: Direction): TranslationResult {
    return JSON.parse(wasmTranslate(input, direction)) as TranslationResult;
  },

  ipaOfWord: word_ipa,
  ipaOfSentence: sentence_ipa,

  analyze(text: string, direction: Direction): WordAnalysis[] {
    return JSON.parse(analyze_sentence(text, direction)) as WordAnalysis[];
  },
};
