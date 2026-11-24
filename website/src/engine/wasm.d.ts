/**
 * Types for the `@wasm` alias, which vite.config.ts points at either the
 * compiled WebAssembly package or src/engine/wasmStub.ts. TypeScript cannot
 * follow a conditional alias, so the shape is declared here once.
 */
declare module "@wasm" {
  export default function init(): Promise<unknown>;
  export function translate(input: string, direction: string): string;
  export function word_ipa(word: string): string;
  export function sentence_ipa(text: string): string;
  export function engine_version(): string;
  export function analyze_sentence(text: string, direction: string): string;
  export function lemmatize(word: string, lang: string): string;
  export function coin(lemma: string, pos: string, lang: string): string;
  export function lemma_guess(word: string, lang: string): string;
}
