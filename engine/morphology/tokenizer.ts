// Sentence-level tokenizer shared by the translator and the morphological
// analyzer. Splits on whitespace, detects a trailing "?" (yes/no question
// marker in EN/NL input) and strips basic punctuation from word tokens.
export interface SentenceTokens {
  raw: string;
  isQuestion: boolean;
  words: string[];
}

export function tokenizeSentence(input: string): SentenceTokens {
  const trimmed = input.trim();
  const isQuestion = /\?\s*$/.test(trimmed);
  const stripped = trimmed.replace(/[?.!]+\s*$/, "");
  const words = stripped
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^[,;:"'()[\]]+|[,;:"'()[\]]+$/g, "").toLowerCase());
  return { raw: trimmed, isQuestion, words };
}
