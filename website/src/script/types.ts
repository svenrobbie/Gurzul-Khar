// The shape of a phoneme as the engine hands it over. This mirrors
// gkh-core's PhonemeToken exactly; it is written out here because the
// WebAssembly boundary carries JSON, so TypeScript needs to be told what
// arrives. If these drift, the crate's own boundary tests are what catch it
// (crates/gkh-wasm/tests/json.rs), not this file.
export type PhonemeKind = "consonant" | "vowel";

export interface PhonemeToken {
  kind: PhonemeKind;
  /** Phonology id, e.g. "kh", "â", "ai". */
  id: string;
  /** The literal substring consumed, lowercase. */
  latin: string;
  ipa: string;
  isLong: boolean;
  isDiphthong: boolean;
  /** Empty for a vowel. */
  place: string;
  manner: string;
  voicing: string;
}

export interface Syllable {
  onset: PhonemeToken[];
  nucleus: PhonemeToken;
  coda: PhonemeToken[];
}

/** One run of text: either a word the engine could read, or anything else — punctuation, spaces, and any word outside the declared inventory, passed through untouched rather than mangled. */
export type TransliterationPart =
  | { kind: "word"; original: string; syllables: Syllable[]; latin: string }
  | { kind: "text"; text: string };
