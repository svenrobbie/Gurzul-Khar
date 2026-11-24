/**
 * Types for the `@wasm` alias, which vite.config.ts points at the compiled
 * WebAssembly package. TypeScript cannot follow an alias into a build
 * artifact that may not exist yet, so the shape is declared here once. It
 * must match crates/gkh-wasm/src/lib.rs; the crate's own boundary tests are
 * what keep the JSON on the other side well-formed.
 */
declare module "@wasm" {
  export default function init(): Promise<unknown>;
  export function translate(input: string, direction: string): string;
  export function word_ipa(word: string): string;
  export function sentence_ipa(text: string): string;
  export function engine_version(): string;
  export function analyze_sentence(text: string, direction: string): string;
  export function check_word(word: string): string;
  export function tokenize(word: string): string;
  export function transliterate(text: string): string;
  export function lemmatize(word: string, lang: string): string;
  export function coin(lemma: string, pos: string, lang: string): string;
  export function lemma_guess(word: string, lang: string): string;
}
