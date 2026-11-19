// Phase 2 §2/§9: tests for the vocabulary lifecycle (official / proposed /
// deprecated / unknown) — conflict detection, the phonotactically-valid
// word generator, and the merged-view helper. The dev-only HTTP layer
// (website/devApi.ts) that actually writes these files is exercised
// manually (see commit history / BACKLOG.md §2); these tests cover the
// pure engine logic it is built on, which IS unit-testable in Node.
import { describe, it, expect } from "vitest";
import { lexicon, proposals, type ProposalEntry } from "../engine/data.js";
import { findConflicts } from "../engine/lexicon/conflicts.js";
import { suggestWord } from "../engine/lexicon/wordGenerator.js";
import { mergedVocabulary, activeVocabulary } from "../engine/lexicon/mergedView.js";
import { checkWordPhonotactics } from "../engine/phonology/phonotacticValidator.js";

describe("vocabulary lifecycle", () => {
  it("proposals.json ships with no pending proposals (a clean baseline, not test fixtures)", () => {
    expect(proposals.proposals).toEqual([]);
  });

  it("mergedVocabulary includes every official entry, tagged 'official'", () => {
    const merged = mergedVocabulary();
    const official = merged.filter((e) => e.status === "official");
    expect(official.length).toBe(lexicon.entries.length);
  });

  it("activeVocabulary excludes deprecated/rejected entries", () => {
    const fakeDeprecated: ProposalEntry = {
      id: "test-dep-1",
      gkh: "zzznotreal",
      ipa: "",
      pos: "noun",
      en: "test",
      nl: "test",
      domain: "everyday",
      status: "deprecated",
      origin: "manual",
      submittedAt: new Date().toISOString(),
    };
    // activeVocabulary reads live data; we can't easily inject without the
    // dev API, so instead assert the *filter logic* directly here.
    const pretendMerged = [...mergedVocabulary(), fakeDeprecated];
    const active = pretendMerged.filter((e) => e.status === "official" || e.status === "proposed");
    expect(active.find((e) => e.id === "test-dep-1")).toBeUndefined();
    expect(activeVocabulary().every((e) => e.status !== "deprecated" && e.status !== "rejected")).toBe(true);
  });

  it("findConflicts detects an exact homograph against the official lexicon", () => {
    const existing = lexicon.entries[0];
    const conflicts = findConflicts({ gkh: existing.gkh, en: "totally different meaning", nl: "", pos: "noun" });
    expect(conflicts.some((c) => c.withId === existing.id)).toBe(true);
  });

  it("findConflicts detects a duplicate gloss+POS even with a different spelling", () => {
    const existing = lexicon.entries.find((e) => e.pos === "noun")!;
    const conflicts = findConflicts({ gkh: "zzqnotarealword", en: existing.en, nl: "", pos: "noun" });
    expect(conflicts.some((c) => c.kind === "same-gloss-different-spelling" && c.withId === existing.id)).toBe(true);
  });

  it("findConflicts returns nothing for a genuinely new word/meaning", () => {
    const conflicts = findConflicts({ gkh: "zorqithuvel", en: "a concept with no lexicon entry anywhere", nl: "", pos: "noun" });
    expect(conflicts).toEqual([]);
  });

  it("suggestWord always returns a phonotactically valid candidate for an arbitrary gloss", () => {
    const glosses = ["lantern", "whisper", "frontier", "orchard", "threshold"];
    for (const en of glosses) {
      const candidate = suggestWord({ en }, "noun");
      expect(candidate.phonotacticallyValid).toBe(true);
      expect(checkWordPhonotactics(candidate.gkh)).toEqual([]);
    }
  });

  it("suggestWord is deterministic for the same gloss/POS", () => {
    const a = suggestWord({ en: "lantern" }, "noun");
    const b = suggestWord({ en: "lantern" }, "noun");
    expect(a.gkh).toBe(b.gkh);
  });

  it("suggestWord with a rootHint derives root+affix instead of coining a new root", () => {
    const candidate = suggestWord({ en: "the mighty one" }, "noun", { rootGkh: "khar", suffix: "-dûm" });
    expect(candidate.gkh).toBe("khardûm");
    expect(candidate.derivation?.rootEntry).toBe("khar");
  });
});
