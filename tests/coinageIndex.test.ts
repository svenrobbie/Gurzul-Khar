// Reverse coining. The coiner's hash cannot be inverted, so the only way a
// coined word reads back is if it was written down — this checks that the
// shipped index is consistent with the coiner that produced it, and that a
// word coined in one direction is readable in the other.
import { describe, it, expect } from "vitest";
import { coin } from "../engine/lexicon/coiner.js";
import { glossCoinage, lookupCoinage, recordCoinage, seededCoinageCount } from "../engine/lexicon/coinageIndex.js";
import { translate } from "../engine/translator/index.js";
import { lemmatize } from "../engine/morphology/lemmatizer.js";
import coinages from "../data/lexicon/coinages.json";

const file = coinages as { entries: { gkh: string; lemma: string; lang: "en" | "nl" }[] };

describe("coinage index", () => {
  it("ships a non-trivial pre-computed index", () => {
    expect(seededCoinageCount()).toBeGreaterThan(100);
  });

  it("every indexed spelling is what coiner_v1 actually produces for that lemma", () => {
    // Rebuilt in file order with the same reservation the builder used, so the
    // attempt counters line up exactly as they did at build time.
    const taken = new Set<string>();
    const drifted: string[] = [];
    for (const entry of [...file.entries].sort((a, b) => file.entries.indexOf(a) - file.entries.indexOf(b))) {
      const result = coin({ lemma: entry.lemma, pos: "unknown", lang: entry.lang }, { taken });
      taken.add(result.gkh);
      if (!lookupCoinage(entry.gkh).some((r) => r.lemma === entry.lemma)) drifted.push(entry.gkh);
    }
    expect(drifted).toEqual([]);
  });

  it("never indexes a word the lexicon can already account for", () => {
    const wrong = file.entries.filter((e) => lemmatize(e.lemma, e.lang)).map((e) => `${e.lemma} (${e.lang}) is not a vocabulary gap`);
    expect(wrong).toEqual([]);
  });

  it("reads a coined word back out in a translation", () => {
    const forward = translate("Ik zie de draak", "nl-gkh");
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const coinedForm = forward.coinedWords?.find((c) => c.source === "draak")?.gkh ?? forward.output.split(" ").at(-1)!;

    const back = translate(`ük sel ${coinedForm}`, "gkh-nl");
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.unknownWords ?? []).not.toContain(coinedForm);
    expect(back.output).toContain("draak");
  });

  it("remembers a coinage made at runtime, and still admits what it does not know", () => {
    recordCoinage({ gkh: "zzqx", lemma: "testword", lang: "en" });
    expect(glossCoinage("zzqx", "en")).toBe("testword");
    expect(glossCoinage("neverseen", "en")).toBeNull();
  });

  it("a never-before-coined word still comes back bracketed rather than guessed", () => {
    const result = translate("ük sel blorzak", "gkh-en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unknownWords).toContain("blorzak");
    expect(result.output).toContain("⟦blorzak⟧");
  });
});
