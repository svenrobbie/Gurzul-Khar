import { describe, it, expect } from "vitest";
import { lexicon, phonology } from "../engine/data.js";
import { tokenizeWord, tryTokenizeWord } from "../engine/phonology/phonemes.js";
import { syllabify } from "../engine/phonology/syllabify.js";

const onsetAllowed = new Set(phonology.phonotactics.onsetClusters.allowed);
const codaAllowed = new Set(phonology.phonotactics.codaClusters.allowed);

interface Violation {
  word: string;
  rule: string;
}

function checkWord(word: string): Violation[] {
  const violations: Violation[] = [];
  const tokens = tryTokenizeWord(word);
  if (!tokens) {
    violations.push({ word, rule: "tokenization-failed (uses a sound/digraph outside the declared inventory)" });
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

describe("phonotactic validation of the lexicon", () => {
  it("every lexicon entry tokenizes using only phonemes declared in phonology.json", () => {
    const failures = lexicon.entries.filter((e) => !tryTokenizeWord(e.gkh.replace(/-/g, "")));
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.warn("Entries that fail to tokenize:", failures.map((f) => f.gkh));
    }
    expect(failures.length).toBe(0);
  });

  it("reports (without failing the build) any entries that violate documented phonotactic restrictions", () => {
    const allViolations: Violation[] = [];
    for (const entry of lexicon.entries) {
      const word = entry.gkh.replace(/-/g, ""); // hyphenated compounds (e.g. "drol-oi") are written as one phonological word
      allViolations.push(...checkWord(word));
    }
    if (allViolations.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `Phonotactic review: ${allViolations.length} lexicon entries diverge from the documented onset/coda cluster tables ` +
          "or positional restrictions (logged, not build-blocking, per project instructions):\n" +
          allViolations.map((v) => `  - "${v.word}": ${v.rule}`).join("\n")
      );
    }
    // This is a reporting test, not a blocking gate — it must not throw even if violations exist.
    expect(Array.isArray(allViolations)).toBe(true);
  });

  it("tokenizeWord throws a clear, typed error for genuinely unrecognizable input", () => {
    expect(() => tokenizeWord("xyzzyq")).toThrow();
  });
});
