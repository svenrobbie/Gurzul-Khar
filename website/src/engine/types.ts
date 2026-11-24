/**
 * The engine surface the website depends on.
 *
 * Both implementations — the TypeScript engine in `engine/` and the Rust core
 * compiled to WebAssembly — satisfy this. The pages import from
 * `src/engine/index.ts` and never from either implementation directly, so
 * switching between them is a one-line change rather than a refactor.
 */
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

export interface Engine {
  /** Which implementation is actually running, for the Engine docs page. */
  readonly name: string;
  translate(input: string, direction: Direction): TranslationResult;
  ipaOfWord(word: string): string;
  ipaOfSentence(text: string): string;
  /** Word-by-word analysis for the explanation panel. */
  analyze(text: string, direction: Direction): WordAnalysis[];
}
