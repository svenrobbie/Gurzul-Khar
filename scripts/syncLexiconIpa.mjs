// Regenerates every lexicon entry's `ipa` field from the engine.
//
// The IPA field was hand-written, and hand-written data drifts. An audit found
// three kinds of divergence from what the engine actually produces: 152
// entries had no stress mark, 135 wrote the r as a plain Latin r where
// phonology.json declares the uvular trill ʀ, and 5 were simply wrong.
//
// The engine derives IPA from phonology.json's declared symbols and stress
// rules, which is the project's single source of truth, so the engine wins.
// After this runs the field is derived data, and the Rust suite asserts the
// two agree exactly, so it cannot drift again.
//
// Spellings are NOT touched, so nothing the coiner reserved or issued moves.
import { engine, readData, writeData } from "./lib/engine.mjs";

const gkh = await engine();
const lexicon = await readData("data/lexicon/lexicon.json");

let changed = 0;
for (const entry of lexicon.entries) {
  const generated = gkh.word_ipa(entry.gkh.replace(/-/g, ""));
  if (generated && generated !== entry.ipa) {
    entry.ipa = generated;
    changed++;
  }
}

await writeData("data/lexicon/lexicon.json", lexicon);
console.log(`updated ${changed} of ${lexicon.entries.length} ipa fields`);
