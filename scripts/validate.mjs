// Validates the linguistic data and prints a plain-text report (npm run
// validate, also used by CI).
//
// Two kinds of finding, deliberately treated differently:
//   * Schema problems — a missing field, a duplicate id, a word using a sound
//     the inventory never declared — are build-blocking.
//   * Phonotactic findings are reported and NOT blocking: a handful of
//     hand-authored entries knowingly break the documented cluster rules, and
//     fixing them would mean inventing new spellings for existing,
//     cross-referenced words. See BACKLOG.md.
//
// Whether a word is legal is the engine's question, asked through the same
// WebAssembly build the site runs.
import { engine, readData } from "./lib/engine.mjs";

const REQUIRED_FIELDS = ["id", "gkh", "ipa", "pos", "en", "nl", "domain"];

const gkh = await engine();
const lexicon = await readData("data/lexicon/lexicon.json");

let hardFailures = 0;
const softFindings = [];

for (const entry of lexicon.entries) {
  for (const field of REQUIRED_FIELDS) {
    const value = entry[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      hardFailures++;
      console.error(`[SCHEMA] ${entry.id ?? "(no id)"}: missing/empty required field "${field}"`);
    }
  }
}

const ids = lexicon.entries.map((e) => e.id);
for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
  hardFailures++;
  console.error(`[SCHEMA] duplicate entry id "${id}"`);
}

for (const entry of lexicon.entries) {
  const word = entry.gkh.replace(/-/g, "");
  const violations = JSON.parse(gkh.check_word(word));
  for (const v of violations) {
    if (v.code === "tokenization-failed") {
      hardFailures++;
      console.error(`[PHONOLOGY] "${entry.gkh}" (${entry.id}) uses a sound outside the declared phoneme inventory.`);
    } else {
      softFindings.push(`"${entry.gkh}" (${entry.id}): ${v.rule}`);
    }
  }
}

console.log(`\nValidated ${lexicon.entries.length} lexicon entries against ${gkh.engine_version()}.`);
if (softFindings.length) {
  console.log(`\n${softFindings.length} non-blocking phonotactic findings (reported, not build-blocking):`);
  for (const f of softFindings) console.log(`  - ${f}`);
} else {
  console.log("No phonotactic findings.");
}

if (hardFailures > 0) {
  console.error(`\n${hardFailures} schema/tokenization failure(s) — these ARE build-blocking.`);
  process.exit(1);
}
console.log("\nSchema validation: OK.");
