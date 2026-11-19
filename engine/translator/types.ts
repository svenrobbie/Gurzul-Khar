export type Direction = "en-gkh" | "nl-gkh" | "gkh-en" | "gkh-nl";
export type SourceLang = "en" | "nl" | "gkh";
export type TargetLang = "en" | "nl" | "gkh";

export interface WordAnalysis {
  surface: string;
  gloss: string;
  root: string;
  pos?: string;
  affixes: { suffix: string; gloss: string }[];
  ipa?: string;
}

export interface TranslationExplanation {
  words: WordAnalysis[];
  transformations: string[];
  rootIdentification: string[];
}

export interface TranslationSuccess {
  ok: true;
  input: string;
  direction: Direction;
  output: string;
  nativeScript?: string; // only populated when target is gkh
  pronunciation?: string; // IPA of the output, space separated per word
  explanation: TranslationExplanation;
  /** True when the sentence's full grammatical pattern could not be parsed (usually because of an unrecognized word) and `output` is instead a word-for-word best-effort gloss. Never silently produced without `unknownWords` also being set — see DESIGN_DECISIONS.md D13/D14. */
  partial?: boolean;
  /** Surface forms the translator could not resolve against the lexicon, in the language of `input`. Always non-empty when `partial` is true. */
  unknownWords?: string[];
}

export interface TranslationFailure {
  ok: false;
  input: string;
  direction: Direction;
  error: string;
  reason: "unknown-word" | "unsupported-pattern" | "empty-input";
  explanation: TranslationExplanation;
}

export type TranslationResult = TranslationSuccess | TranslationFailure;
