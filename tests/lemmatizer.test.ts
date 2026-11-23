// Tiers 2 and 3 of word coverage, pinned. Cases live in
// tests/fixtures/lemmatization.json so the Rust port asserts the same ones.
//
// The point of these is narrow and important: a word the lexicon can account
// for must NEVER reach the coiner. Every case that regresses to `null` here is
// a word the translator starts inventing a synonym for.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lemmatize, guessLemma } from "../engine/morphology/lemmatizer.js";
import { lexicon } from "../engine/data.js";

interface Case {
  word: string;
  lang: "en" | "nl";
  kind: "direct" | "inflected" | "compound" | null;
  gkh?: string;
  parts?: string[];
}

const fixturePath = fileURLToPath(new URL("./fixtures/lemmatization.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: Case[] };

describe("lemmatiser", () => {
  for (const c of fixture.cases) {
    it(`${c.word} (${c.lang}) -> ${c.kind ?? "coined"}`, () => {
      const result = lemmatize(c.word, c.lang);
      if (c.kind === null) {
        expect(result).toBeNull();
        return;
      }
      expect(result).not.toBeNull();
      expect(result!.kind).toBe(c.kind);
      expect(result!.gkh).toBe(c.gkh);
      if (c.parts) expect(result!.parts?.map((p) => p.entry.gkh)).toEqual(c.parts);
    });
  }

  it("a compound never resolves to a form the lexicon already uses for something else", () => {
    const forms = new Map(lexicon.entries.map((e) => [e.gkh.replace(/-/g, "").toLowerCase(), e.en]));
    const clashes = fixture.cases
      .filter((c) => c.kind === "compound" && c.gkh && forms.has(c.gkh))
      .map((c) => `${c.word} -> ${c.gkh}, which already means "${forms.get(c.gkh!)}"`);
    expect(clashes).toEqual([]);
  });
});

describe("guessLemma — only reached when every lexicon route has failed", () => {
  it("collapses Dutch and English plurals onto one lemma so they coin one word", () => {
    expect(guessLemma("ruimteschepen", "nl")).toBe("ruimteschep");
    expect(guessLemma("spaceships", "en")).toBe("spaceship");
    expect(guessLemma("berries", "en")).toBe("berry");
  });

  it("leaves short words and non-plurals alone", () => {
    expect(guessLemma("huis", "nl")).toBe("huis");
    expect(guessLemma("glass", "en")).toBe("glass");
  });
});
