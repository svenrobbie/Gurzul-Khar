// Builds data/lexicon/coinages.json — the index that makes coined words
// translatable BACK into English and Dutch.
//
// The coiner is a hash, so it cannot be inverted: given "gidu" there is no way
// to compute that it came from "spaceship". The only way back is to have
// written it down. This pre-computes the index for the vocabulary most likely
// to be typed (the ear-test list, plus every gloss already in the lexicon),
// and the translator records anything else it coins during a session.
//
// Seeding MUST match what the translator does, or the index will map spellings
// the translator never produces: it coins on the guessed lemma with pos
// "unknown", because a word outside the lexicon has no known part of speech.
import { engine, readData, writeData } from "./lib/engine.mjs";
import { GROUPS } from "./commonWords.mjs";

const gkh = await engine();
const lexicon = await readData("data/lexicon/lexicon.json");

const seen = new Set();
const wanted = [];
let skippedBecauseKnown = 0;

function add(word, lang) {
  if (!word) return;
  const key = `${word}|${lang}`;
  if (seen.has(key)) return;
  seen.add(key);
  // A word the lexicon can already account for is never coined, so it does not
  // belong in this index.
  if (JSON.parse(gkh.lemmatize(word, lang))) {
    skippedBecauseKnown++;
    return;
  }
  wanted.push({ lemma: gkh.lemma_guess(word, lang), lang });
}

for (const words of Object.values(GROUPS)) for (const word of words) add(word, "nl");
for (const entry of lexicon.entries) {
  for (const gloss of (entry.en ?? "").split("/")) add(gloss.trim().replace(/^to\s+/, ""), "en");
  for (const gloss of (entry.nl ?? "").split("/")) add(gloss.trim(), "nl");
}

const entries = gkh
  .coin_batch(wanted.map((w) => `${w.lemma}\tunknown\t${w.lang}`).join("\n"))
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [lemma, , lang, form] = line.split("\t");
    return { gkh: form, lemma, lang };
  })
  .filter((e) => e.gkh);

entries.sort((a, b) => (a.gkh < b.gkh ? -1 : a.gkh > b.gkh ? 1 : a.lang < b.lang ? -1 : 1));

await writeData("data/lexicon/coinages.json", {
  version: "v1",
  note:
    "Reverse index for coined words: the coiner's hash cannot be inverted, so a coined form is only translatable back if it was written down here. Pre-seeded with the common vocabulary; the translator adds anything else it coins at runtime, for that session only. A coined word nobody has ever coined before still cannot be read back — that is a real limit, not a bug. Rebuild with `npm run coiner:index`, then `npm run rust:data`.",
  generatedBy: "scripts/buildCoinageIndex.mjs",
  entryCount: entries.length,
  entries,
});
console.log(`indexed ${entries.length} coinages; skipped ${skippedBecauseKnown} words the lexicon already covers`);
