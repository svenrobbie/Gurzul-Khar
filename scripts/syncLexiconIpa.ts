// Regenerates every lexicon entry's `ipa` field from the engine.
//
// The IPA field was hand-written, and hand-written data drifts. An audit found
// three kinds of divergence from what the engine actually produces:
//
//   * 152 entries had no stress mark at all
//   * 135 wrote the r as a plain Latin r, where phonology.json declares the
//     uvular trill ʀ
//   * 5 were simply wrong: ük and ükûn gave a short ʊ for a vowel the
//     orthography and the tokeniser both treat as long, and quz, nami and
//     sarûn carried Latin letters or a malformed length mark where an IPA
//     symbol belonged
//
// The engine derives IPA from phonology.json's declared symbols and stress
// rules, which is the project's single source of truth, so the engine wins.
// After this runs, the field is derived data: tests/lexiconIpa.test.ts asserts
// the two agree exactly, so it can never drift again.
//
// Spellings are NOT touched, so nothing the coiner reserved or issued moves.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ipaOfWord } from "../engine/translator/ipa.js";

const path = fileURLToPath(new URL("../data/lexicon/lexicon.json", import.meta.url));
const lex = JSON.parse(readFileSync(path, "utf8")) as {
  entries: { id: string; gkh: string; ipa: string }[];
};

let changed = 0;
for (const entry of lex.entries) {
  const generated = ipaOfWord(entry.gkh.replace(/-/g, ""));
  if (generated && generated !== entry.ipa) {
    entry.ipa = generated;
    changed++;
  }
}

writeFileSync(path, JSON.stringify(lex, null, 2) + "\n", "utf8");
console.log(`updated ${changed} of ${lex.entries.length} ipa fields`);
