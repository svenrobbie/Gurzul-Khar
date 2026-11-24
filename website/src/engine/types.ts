/**
 * The engine surface the website depends on.
 *
 * There is one implementation: the Rust core in `crates/gkh-core`, compiled to
 * WebAssembly. The pages import from `src/engine/index.ts` and never from the
 * binding module directly, so the boundary stays in one place and the JSON the
 * crate emits is parsed once, here, rather than in eight components.
 */
import type { PhonemeToken, TransliterationPart } from "../script/types";

export type Direction = "en-gkh" | "nl-gkh" | "gkh-en" | "gkh-nl";

export interface CoinedWord {
  source: string;
  gkh: string;
  version: string;
}

export interface TranslationSuccess {
  ok: true;
  output: string;
  pronunciation?: string;
  partial?: boolean;
  unknownWords?: string[];
  coinedWords?: CoinedWord[];
  transformations: string[];
}

export interface TranslationFailure {
  ok: false;
  reason: string;
  error: string;
}

export type TranslationResult = TranslationSuccess | TranslationFailure;

export interface WordAnalysis {
  surface: string;
  root: string;
  gloss: string;
  pos?: string | null;
  affixes: string[];
  ipa?: string;
}

/** One documented phonotactic rule a word breaks. `code` is the stable identifier shared with the crate's fixtures; `rule` is prose for a human and may be reworded. */
export interface PhonotacticViolation {
  word: string;
  code: string;
  rule: string;
}

export interface Engine {
  /** Which implementation is running, for the Engine docs page. */
  readonly name: string;
  translate(input: string, direction: Direction): TranslationResult;
  ipaOfWord(word: string): string;
  ipaOfSentence(text: string): string;
  /** Word-by-word analysis for the explanation panel. */
  analyze(text: string, direction: Direction): WordAnalysis[];
  /** Every documented rule the word breaks. Empty means it is legal Gurzûl Khar. */
  checkWord(word: string): PhonotacticViolation[];
  /** Phonemes of one word, or null when it uses a sound outside the declared inventory. */
  tokenize(word: string): PhonemeToken[] | null;
  /** Text split into words the engine could read (as syllable blocks) and everything else, passed through untouched. */
  transliterate(text: string): TransliterationPart[];
}
