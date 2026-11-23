// Asserts the validator against the language-neutral fixture file that the
// Rust port will also read (ROADMAP.md phase 2). Unlike phonotactics.test.ts,
// which only *reports* on the hand-authored lexicon, this one is a hard gate:
// if a rule's behaviour changes, the build fails.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkWordPhonotactics } from "../engine/phonology/phonotacticValidator.js";

interface Case {
  word: string;
  valid: boolean;
  codes: string[];
}

const fixturePath = fileURLToPath(new URL("./fixtures/phonotactics.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: Case[] };

describe("phonotactic fixtures (shared with the Rust port)", () => {
  it("loads a non-empty fixture file", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const c of fixture.cases) {
    it(`${JSON.stringify(c.word)} -> ${c.valid ? "valid" : c.codes.join(", ")}`, () => {
      const violations = checkWordPhonotactics(c.word);
      expect(violations.map((v) => v.code)).toEqual(c.codes);
      expect(violations.length === 0).toBe(c.valid);
    });
  }
});
