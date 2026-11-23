// Fixed regression suite across all 4 translation directions, covering the
// documented supported grammar subset (declaratives, negatives, questions,
// possession, plurals, comparative/superlative, coordination, complex
// sentences).
//
// The cases themselves live in tests/fixtures/translation.json, NOT here:
// that file is language-neutral so the Rust port (ROADMAP.md phase 2) can
// assert against exactly the same expectations. If the two engines ever
// disagree on a fixture, CI fails rather than letting the drift reach the app.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { translate } from "../engine/translator/index.js";

interface Case {
  name: string;
  direction: "en-gkh" | "nl-gkh" | "gkh-en" | "gkh-nl";
  input: string;
  expect: "output" | "partial" | "fail";
  output?: string;
  unknownWord?: string;
  neverUnknown?: string[];
  coined?: { source: string; gkh: string }[];
}

const fixturePath = fileURLToPath(new URL("./fixtures/translation.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: Case[] };

describe("translation regression suite (all 4 directions)", () => {
  it("loads a non-empty fixture file", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const c of fixture.cases) {
    it(c.name, () => {
      const result = translate(c.input, c.direction);

      if (c.expect === "fail") {
        expect(result.ok).toBe(false);
        return;
      }

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      if (c.expect === "partial") {
        expect(result.partial).toBe(true);
        expect(result.unknownWords).toContain(c.unknownWord);
        // Articles are not vocabulary gaps (Gurzûl Khar has none at all) — never flagged.
        for (const word of c.neverUnknown ?? []) {
          expect(result.unknownWords).not.toContain(word);
        }
        // Coined output is pinned too: "always the same word" has to hold
        // through the translator, not only inside the coiner.
        if (c.output !== undefined) expect(result.output).toBe(c.output);
        if (c.coined !== undefined) {
          expect((result.coinedWords ?? []).map((w) => ({ source: w.source, gkh: w.gkh }))).toEqual(c.coined);
        }
        return;
      }

      expect(result.output).toBe(c.output);
    });
  }
});
