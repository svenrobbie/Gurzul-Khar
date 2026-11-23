// Builds data/lexicon/coinages.json — the index that makes coined words
// translatable BACK into English and Dutch.
//
// The coiner is a hash, so it cannot be inverted: given "gidu" there is no way
// to compute that it came from "spaceship". The only way back is to have
// written it down. This script pre-computes the index for the vocabulary most
// likely to be typed (the same list the ear-test sample uses, plus every gloss
// already in the lexicon), and the translator records anything else it coins
// during a session.
//
// Seeding MUST match what the translator does, or the index will map spellings
// the translator never produces: it coins on guessLemma(word) with pos
// "unknown", because a word outside the lexicon has no known part of speech.
import { writeFileSync } from "node:fs";
import { coin, COINER_VERSION } from "../engine/lexicon/coiner.js";
import { guessLemma, lemmatize } from "../engine/morphology/lemmatizer.js";
import { lexicon } from "../engine/data.js";
import { GROUPS } from "./commonWords.js";

interface IndexEntry {
  gkh: string;
  lemma: string;
  lang: "en" | "nl";
}

const seen = new Set<string>();
const entries: IndexEntry[] = [];
const taken = new Set<string>();
let skippedBecauseKnown = 0;

function add(word: string, lang: "en" | "nl") {
  const key = `${word}|${lang}`;
  if (seen.has(key)) return;
  seen.add(key);
  // A word the lexicon can already account for is never coined, so it does not
  // belong in this index.
  if (lemmatize(word, lang)) {
    skippedBecauseKnown++;
    return;
  }
  const lemma = guessLemma(word, lang);
  const result = coin({ lemma, pos: "unknown", lang }, { taken });
  taken.add(result.gkh);
  entries.push({ gkh: result.gkh, lemma, lang });
}

for (const words of Object.values(GROUPS)) for (const word of words) add(word, "nl");
for (const entry of lexicon.entries) {
  for (const gloss of (entry.en ?? "").split("/")) add(gloss.trim().replace(/^to\s+/, ""), "en");
  for (const gloss of (entry.nl ?? "").split("/")) add(gloss.trim(), "nl");
}

entries.sort((a, b) => (a.gkh < b.gkh ? -1 : a.gkh > b.gkh ? 1 : a.lang < b.lang ? -1 : 1));

const out = {
  version: COINER_VERSION,
  note:
    "Reverse index for coined words: the coiner's hash cannot be inverted, so a coined form is only translatable back if it was written down here. Pre-seeded with the common vocabulary; the translator adds anything else it coins at runtime, for that session only. A coined word nobody has ever coined before still cannot be read back — that is a real limit, not a bug. Rebuild with `npm run coiner:index`.",
  generatedBy: "scripts/buildCoinageIndex.ts",
  entryCount: entries.length,
  entries,
};

writeFileSync(new URL("../data/lexicon/coinages.json", import.meta.url), JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`indexed ${entries.length} coinages; skipped ${skippedBecauseKnown} words the lexicon already covers`);
