// Builds tests/fixtures/phonotactics.json from the current validator.
// Run deliberately (npm run fixtures:phonotactics) and review the diff —
// this is a snapshot generator, never run automatically in CI.
import { writeFileSync } from "node:fs";
import { checkWordPhonotactics } from "../engine/phonology/phonotacticValidator.js";

const WORDS = [
  // valid, hand-authored
  "khar", "shak", "dor", "ük", "tû", "pâk", "pâkûl", "khardûm", "kharith",
  "ghûldor", "nâzgam", "rûkakûk", "magu", "selu", "zan", "dorûk",
  // violating, hand-authored (the lexicon knowingly contains these)
  "zhâ", "zhâkûn", "izh", "dorizh", "hask", "shelgh", "zherk", "plâsh",
  "golm", "zherkith", "nairgh", "shelm", "gurz",
  // constructed edge cases
  "xyzzyq", "", "ngor", "katq", "shugh", "shûgh",
];

const cases = WORDS.map((word) => {
  const violations = checkWordPhonotactics(word);
  return { word, valid: violations.length === 0, codes: violations.map((v) => v.code) };
});

const out = {
  note: "Language-neutral phonotactic fixtures. Each word is checked against the documented rules in data/phonology/phonology.json; `codes` are the stable PhonotacticCode identifiers, in the order the validator emits them. The Rust port must reproduce this file exactly. Regenerate with `npm run fixtures:phonotactics` and review the diff.",
  cases,
};

writeFileSync(new URL("../tests/fixtures/phonotactics.json", import.meta.url), JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`wrote ${cases.length} cases, ${cases.filter((c) => c.valid).length} valid`);
