// CLI data-validation script (npm run validate), also used by CI. Separate
// from the Vitest suite so it can be run standalone and prints a plain-text
// report. Schema violations (missing required fields) are build-blocking;
// phonotactic cluster/position violations are reported but non-blocking,
// per project instructions (BACKLOG.md / DESIGN_DECISIONS.md).
import { lexicon, phonology } from "../engine/data.js";
import { tryTokenizeWord } from "../engine/phonology/phonemes.js";
import { syllabify } from "../engine/phonology/syllabify.js";

const REQUIRED_FIELDS = ["id", "gkh", "ipa", "pos", "en", "nl", "domain"] as const;
let hardFailures = 0;
const softFindings: string[] = [];

for (const entry of lexicon.entries) {
  for (const field of REQUIRED_FIELDS) {
    const value = (entry as any)[field];
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

const onsetAllowed = new Set(phonology.phonotactics.onsetClusters.allowed);
const codaAllowed = new Set(phonology.phonotactics.codaClusters.allowed);

for (const entry of lexicon.entries) {
  const word = entry.gkh.replace(/-/g, "");
  const tokens = tryTokenizeWord(word);
  if (!tokens) {
    hardFailures++;
    console.error(`[PHONOLOGY] "${entry.gkh}" (${entry.id}) uses a sound outside the declared phoneme inventory.`);
    continue;
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (first.kind === "consonant" && (first.id === "ng" || first.id === "zh")) {
    softFindings.push(`"${entry.gkh}" (${entry.id}): word-initial ng/zh restriction violated`);
  }
  if (last.kind === "consonant" && ["q", "w", "y"].includes(last.id)) {
    softFindings.push(`"${entry.gkh}" (${entry.id}): word-final q/w/y restriction violated`);
  }
  for (const syl of syllabify(tokens)) {
    if (syl.onset.length === 2 && !onsetAllowed.has(syl.onset.map((t) => t.latin).join(""))) {
      softFindings.push(`"${entry.gkh}" (${entry.id}): onset cluster "${syl.onset.map((t) => t.latin).join("")}" not in the documented allowed list`);
    }
    if (syl.coda.length === 2 && !codaAllowed.has(syl.coda.map((t) => t.latin).join(""))) {
      softFindings.push(`"${entry.gkh}" (${entry.id}): coda cluster "${syl.coda.map((t) => t.latin).join("")}" not in the documented allowed list`);
    }
  }
}

console.log(`\nValidated ${lexicon.entries.length} lexicon entries.`);
if (softFindings.length) {
  console.log(`\n${softFindings.length} non-blocking phonotactic findings (reported per project instructions, not build-blocking):`);
  for (const f of softFindings) console.log(`  - ${f}`);
} else {
  console.log("No phonotactic findings.");
}

if (hardFailures > 0) {
  console.error(`\n${hardFailures} schema/tokenization failure(s) — these ARE build-blocking.`);
  process.exit(1);
} else {
  console.log("\nSchema validation: OK.");
  process.exit(0);
}
