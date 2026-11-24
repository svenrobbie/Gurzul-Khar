// Builds fixtures/coiner_v1.golden.json — the file that makes
// "always the same word" enforceable rather than aspirational.
//
// Every gloss here is pinned to the exact form coiner_v1 produces, and the
// Rust test suite asserts it on every run, so any change to the hash, the
// weight tables, the syllable builder or the euphony rules fails the build
// instead of silently rewriting the language.
//
// Regenerating this file is a deliberate act that redefines coiner_v1. Don't.
// Ship a coiner_v2 instead (ROADMAP.md, "The determinism contract").
import { engine, readData, writeData } from "./lib/engine.mjs";

/** Deterministic pseudo-lemmas, so the golden set covers far more of the hash space than the lexicon's own glosses do. */
function syntheticLemmas(count) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const out = [];
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

const POS = ["noun", "verb", "adjective", "adverb"];
const gkh = await engine();
const lexicon = await readData("data/lexicon/lexicon.json");

const seen = new Set();
const inputs = [];
const push = (lemma, pos, lang) => {
  if (!lemma) return;
  // Deduplicate by exactly what the coiner keys on, not by a near-enough string.
  const key = gkh.normalise_seed_for(lemma, pos, lang);
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

// One call, so the whole list shares a reserved set: `attempt` is part of the
// contract and depends on what was issued before it.
const tsv = inputs.map((i) => `${i.lemma}\t${i.pos}\t${i.lang}`).join("\n");
const cases = gkh
  .coin_batch(tsv)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [lemma, pos, lang, form, attempt] = line.split("\t");
    return { lemma, pos, lang, gkh: form, attempt: Number(attempt) };
  });

if (cases.length !== inputs.length) {
  throw new Error(`coiner returned ${cases.length} results for ${inputs.length} inputs`);
}
const failed = cases.filter((c) => c.attempt < 0);
if (failed.length) {
  throw new Error(`the coiner could not satisfy ${failed.length} case(s), e.g. ${failed[0].lemma}`);
}

const retried = cases.filter((c) => c.attempt > 0).length;
const out = {
  version: "v1",
  note:
    "FROZEN. Each case pins the exact output of coiner_v1 for one (lemma, pos, lang), coined in file order with each result reserved against the next — so `attempt` is part of the contract, not an incidental. A failing case means the coiner changed and every word it ever produced has changed with it. Do not regenerate to make a test pass; ship coiner_v2.",
  generatedBy: "scripts/buildCoinerGolden.mjs",
  stats: { cases: cases.length, retriedForCollision: retried, distinctForms: new Set(cases.map((c) => c.gkh)).size },
  cases,
};

await writeData("fixtures/coiner_v1.golden.json", out, { compact: true });
console.log(JSON.stringify(out.stats, null, 2));
