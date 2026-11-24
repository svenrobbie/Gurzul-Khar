// Builds fixtures/phonotactics.json from the current validator.
// Run deliberately (npm run fixtures:phonotactics) and review the diff —
// this is a snapshot generator, never run automatically in CI.
import { engine, writeData } from "./lib/engine.mjs";

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

const gkh = await engine();
const cases = WORDS.map((word) => {
  const violations = JSON.parse(gkh.check_word(word));
  return { word, valid: violations.length === 0, codes: violations.map((v) => v.code) };
});

await writeData("fixtures/phonotactics.json", {
  note:
    "Language-neutral phonotactic fixtures. Each word is checked against the documented rules in data/phonology/phonology.json; `codes` are the stable PhonotacticCode identifiers, in the order the validator emits them. Compiled into the Rust test suite by scripts/buildRustData.mjs. Regenerate with `npm run fixtures:phonotactics` and review the diff.",
  cases,
});
console.log(`wrote ${cases.length} cases, ${cases.filter((c) => c.valid).length} valid`);
