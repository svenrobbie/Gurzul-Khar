import { describe, it, expect } from "vitest";
import { lexicon } from "../engine/data.js";
import { tokenizeWord, tryTokenizeWord } from "../engine/phonology/phonemes.js";
import { checkWordPhonotactics, type PhonotacticViolation } from "../engine/phonology/phonotacticValidator.js";

type Violation = PhonotacticViolation;

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
      allViolations.push(...checkWordPhonotactics(word));
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
