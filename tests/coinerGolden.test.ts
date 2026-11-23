// The hard guarantee behind "always the same word".
//
// coiner_v1 is frozen: if any of these cases moves, every word the coiner has
// ever produced has moved with it, and text written in Gurzûl Khar last month
// no longer reads the same. Do NOT regenerate the fixture to make this pass —
// ship a coiner_v2 instead (ROADMAP.md, "The determinism contract").
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { coin, COINER_VERSION, normaliseSeed } from "../engine/lexicon/coiner.js";
import { coinerReservedV1 } from "../engine/data.js";

interface Case {
  lemma: string;
  pos: string;
  lang: "en" | "nl";
  gkh: string;
  attempt: number;
}

const fixturePath = fileURLToPath(new URL("./fixtures/coiner_v1.golden.json", import.meta.url));
const golden = JSON.parse(readFileSync(fixturePath, "utf8")) as { version: string; cases: Case[] };

describe("coiner_v1 golden file", () => {
  it("is the version this build implements", () => {
    expect(golden.version).toBe(COINER_VERSION);
    expect(golden.cases.length).toBeGreaterThan(5000);
  });

  it("reproduces every pinned coinage exactly, in order", () => {
    const taken = new Set<string>();
    const drifted: string[] = [];
    for (const c of golden.cases) {
      const result = coin({ lemma: c.lemma, pos: c.pos, lang: c.lang }, { taken });
      taken.add(result.gkh);
      if (result.gkh !== c.gkh || result.attempt !== c.attempt) {
        drifted.push(`${c.lemma} (${c.pos}, ${c.lang}): expected ${c.gkh}#${c.attempt}, got ${result.gkh}#${result.attempt}`);
      }
      if (drifted.length >= 10) break;
    }
    expect(drifted).toEqual([]);
  });

  it("gives every pinned gloss a distinct form", () => {
    expect(new Set(golden.cases.map((c) => c.gkh)).size).toBe(golden.cases.length);
  });
});

describe("coiner_v1 determinism properties", () => {
  it("is a pure function of (lemma, pos, lang)", () => {
    const input = { lemma: "huis", pos: "noun", lang: "nl" } as const;
    expect(coin(input).gkh).toBe(coin(input).gkh);
  });

  it("ignores case, surrounding punctuation and Unicode form", () => {
    const base = coin({ lemma: "huis", pos: "noun", lang: "nl" }).gkh;
    expect(coin({ lemma: "  HUIS! ", pos: "noun", lang: "nl" }).gkh).toBe(base);
    expect(normaliseSeed({ lemma: "Huis.", pos: "Noun", lang: "nl" })).toBe("huis|noun|nl");
  });

  it("distinguishes part of speech and source language", () => {
    const noun = coin({ lemma: "work", pos: "noun", lang: "en" }).gkh;
    const verb = coin({ lemma: "work", pos: "verb", lang: "en" }).gkh;
    expect(noun).not.toBe(verb);
  });

  it("never returns a spelling that was hand-authored when v1 was frozen", () => {
    // Deliberately checked against the FROZEN snapshot, not the live lexicon:
    // words added after the freeze are allowed to exist alongside coinages, and
    // tests/coinerReserved.test.ts is what stops them taking an issued spelling.
    const reserved = new Set(coinerReservedV1.forms);
    for (const c of golden.cases.slice(0, 2000)) expect(reserved.has(c.gkh)).toBe(false);
  });
});
