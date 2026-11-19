// Shared phonotactic checker. Extracted (Phase 2) from what used to be a
// test-only `checkWord` helper inlined in tests/phonotactics.test.ts, so that
// the lexicon-proposal validation flow (engine/lexicon/*) and the regression
// test both call exactly one implementation — never two copies of the same
// linguistic rule (spec §14 / DESIGN_DECISIONS.md D5).
import { phonology } from "../data.js";
import { tryTokenizeWord } from "./phonemes.js";
import { syllabify } from "./syllabify.js";

export interface PhonotacticViolation {
  word: string;
  rule: string;
}

const onsetAllowed = new Set(phonology.phonotactics.onsetClusters.allowed);
const codaAllowed = new Set(phonology.phonotactics.codaClusters.allowed);

/** Checks one bare (no hyphens) Latin-transliterated word against every documented phonotactic rule. Returns an empty array when the word is fully valid. */
export function checkWordPhonotactics(word: string): PhonotacticViolation[] {
  const violations: PhonotacticViolation[] = [];
  const tokens = tryTokenizeWord(word);
  if (!tokens) {
    violations.push({ word, rule: "tokenization-failed (uses a sound/digraph outside the declared inventory)" });
    return violations;
  }
  if (tokens.length === 0) {
    violations.push({ word, rule: "empty word" });
    return violations;
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (first.kind === "consonant" && (first.id === "ng" || first.id === "zh")) {
    violations.push({ word, rule: "word-initial restriction: ng/zh never occur word-initially" });
  }
  if (last.kind === "consonant" && ["q", "w", "y"].includes(last.id)) {
    violations.push({ word, rule: "word-final restriction: q/w/y never occur word-finally" });
  }
  if (last.kind === "consonant" && (last.id === "gh" || last.id === "zh")) {
    const prev = tokens[tokens.length - 2];
    if (!prev || prev.kind !== "vowel" || !prev.isLong) {
      violations.push({ word, rule: "word-final restriction: voiced fricatives gh/zh may close a word only after a long vowel" });
    }
  }
  const syllables = syllabify(tokens);
  for (const syl of syllables) {
    if (syl.onset.length > 2) violations.push({ word, rule: `onset cluster too long (${syl.onset.map((t) => t.latin).join("")})` });
    if (syl.onset.length === 2 && !onsetAllowed.has(syl.onset.map((t) => t.latin).join(""))) {
      violations.push({ word, rule: `onset cluster not in allowed list (${syl.onset.map((t) => t.latin).join("")})` });
    }
    if (syl.coda.length > 2) violations.push({ word, rule: `coda cluster too long (${syl.coda.map((t) => t.latin).join("")})` });
    if (syl.coda.length === 2 && !codaAllowed.has(syl.coda.map((t) => t.latin).join(""))) {
      violations.push({ word, rule: `coda cluster not in allowed list (${syl.coda.map((t) => t.latin).join("")})` });
    }
  }
  return violations;
}

/** Convenience boolean: true when the word has zero documented violations. */
export function isPhonotacticallyValid(word: string): boolean {
  return checkWordPhonotactics(word).length === 0;
}
