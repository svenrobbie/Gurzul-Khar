/**
 * The Rust core, compiled to WebAssembly, wrapped to the Engine surface.
 *
 * The boundary passes JSON strings rather than structured values: the binding
 * crate builds them by hand so it needs no serialisation dependency, which
 * keeps the artifact every visitor downloads small. Parsing happens here and
 * nowhere else.
 */
import init, {
  translate as wasmTranslate,
  word_ipa,
  sentence_ipa,
  engine_version,
  analyze_sentence,
  check_word,
  tokenize as wasmTokenize,
  transliterate as wasmTransliterate,
} from "@wasm";
import type { PhonemeToken, TransliterationPart } from "../script/types";
import type {
  Direction,
  Engine,
  PhonotacticViolation,
  TranslationResult,
  WordAnalysis,
} from "./types";

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

  checkWord(word: string): PhonotacticViolation[] {
    return JSON.parse(check_word(word)) as PhonotacticViolation[];
  },

  tokenize(word: string): PhonemeToken[] | null {
    return JSON.parse(wasmTokenize(word)) as PhonemeToken[] | null;
  },

  transliterate(text: string): TransliterationPart[] {
    return JSON.parse(wasmTransliterate(text)) as TransliterationPart[];
  },
};
