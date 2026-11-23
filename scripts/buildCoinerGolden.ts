// Builds tests/fixtures/coiner_v1.golden.json — the file that makes
// "always the same word" enforceable rather than aspirational.
//
// Every gloss here is pinned to the exact form coiner_v1 produces. The test
// suite asserts it on every run, in TypeScript today and in Rust from phase 2,
// so any change to the hash, the weight tables, the syllable builder or the
// euphony rules fails the build instead of silently rewriting the language.
//
// Regenerating this file is a deliberate act that redefines coiner_v1. Don't.
// Ship a coiner_v2 instead (ROADMAP.md, "The determinism contract").
import { writeFileSync } from "node:fs";
import { coin, COINER_VERSION, normaliseSeed } from "../engine/lexicon/coiner.js";
import { lexicon } from "../engine/data.js";

/** Deterministic pseudo-lemmas, so the golden set covers far more of the hash space than the lexicon's own glosses do. */
function syntheticLemmas(count: number): string[] {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const out: string[] = [];
  let state = 0x2545f4914f6cdd1dn;
  const next = () => {
    state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return Number((state >> 33n) & 0xffffffffn);
  };
  for (let i = 0; i < count; i++) {
    const length = 3 + (next() % 8);
    let word = "";
    for (let j = 0; j < length; j++) word += alphabet[next() % 26];
    out.push(word);
  }
  return out;
}

const POS = ["noun", "verb", "adjective", "adverb"] as const;
const seen = new Set<string>();
const inputs: { lemma: string; pos: string; lang: "en" | "nl" }[] = [];

const push = (lemma: string, pos: string, lang: "en" | "nl") => {
  if (!lemma) return;
  const key = normaliseSeed({ lemma, pos, lang });
  if (seen.has(key)) return;
  seen.add(key);
  inputs.push({ lemma, pos, lang });
};

// Real glosses first: these are the ones a user is most likely to type.
for (const entry of lexicon.entries) {
  push(entry.en, entry.pos, "en");
  if (entry.nl) push(entry.nl, entry.pos, "nl");
}
// Then synthetic coverage, cycling parts of speech and both languages.
syntheticLemmas(10000).forEach((lemma, i) => push(lemma, POS[i % POS.length], i % 2 === 0 ? "nl" : "en"));

const taken = new Set<string>();
const cases = inputs.map(({ lemma, pos, lang }) => {
  const result = coin({ lemma, pos, lang }, { taken });
  taken.add(result.gkh);
  return { lemma, pos, lang, gkh: result.gkh, attempt: result.attempt };
});

const retried = cases.filter((c) => c.attempt > 0).length;
const out = {
  version: COINER_VERSION,
  note:
    "FROZEN. Each case pins the exact output of coiner_v1 for one (lemma, pos, lang), coined in file order with each result reserved against the next — so `attempt` is part of the contract, not an incidental. A failing case means the coiner changed and every word it ever produced has changed with it. Do not regenerate to make a test pass; ship coiner_v2.",
  generatedBy: "scripts/buildCoinerGolden.ts",
  stats: { cases: cases.length, retriedForCollision: retried, distinctForms: new Set(cases.map((c) => c.gkh)).size },
  cases,
};

writeFileSync(new URL("../tests/fixtures/coiner_v1.golden.json", import.meta.url), JSON.stringify(out) + "\n", "utf8");
console.log(JSON.stringify(out.stats, null, 2));
