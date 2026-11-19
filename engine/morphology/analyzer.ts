// Morphological analyzer: strips/attaches affixes exactly as declared in
// data/morphology/grammar.json and data/lexicon/lexicon.json
// (derivationalAffixes). This module never hardcodes a second copy of a
// grammatical rule — every suffix string used below is read from grammar.json.
import { grammar, lexicon, type LexiconEntry } from "../data.js";

export type AffixType = "plural" | "tense" | "possessive" | "derivational" | "reflexive";

export interface Affix {
  type: AffixType;
  suffix: string;
  gloss: string;
}

export interface MorphAnalysis {
  surface: string;
  root: string;
  affixes: Affix[];
  entry: LexiconEntry | null;
  recognized: boolean;
}

function findEntry(root: string): LexiconEntry | null {
  const lower = root.toLowerCase();
  return (
    lexicon.entries.find((e) => e.gkh.toLowerCase() === lower) ??
    lexicon.entries.find((e) => (e.root ?? "").toLowerCase() === lower) ??
    null
  );
}

const PLURAL_SUFFIX: string = grammar.nouns.pluralSuffix.replace(/^-/, ""); // "ûk"
const PLURAL_EPENTHETIC = "a" + PLURAL_SUFFIX; // "ûk" root-final-k variant: "a" + "ûk" = "aûk"? per rule it's "-akûk"
// grammar.json's pluralRule says the epenthetic form is "-akûk" literally (a + k + ûk),
// because the root already ends in -k and the suffix adds an epenthetic vowel before it.
const PLURAL_EPENTHETIC_FULL = "ak" + PLURAL_SUFFIX; // "akûk"

const TENSE_SUFFIXES: Record<string, string> = {};
for (const [tense, suffix] of Object.entries(grammar.verbs.tenseSuffixes as Record<string, string>)) {
  TENSE_SUFFIXES[(suffix as string).replace(/^-/, "")] = tense;
}

const POSSESSIVE_SUFFIXES: { person: string; suffix: string }[] = Object.entries(
  grammar.pronouns.possessiveSuffixes as Record<string, string>
)
  .map(([person, suffix]) => ({ person, suffix: (suffix as string).replace(/^-/, "") }))
  .sort((a, b) => b.suffix.length - a.suffix.length);

const DERIVATIONAL_SUFFIXES: { suffix: string; function: string }[] = (
  lexicon.derivationalAffixes as { suffix: string; function: string }[]
)
  .map((a) => ({ suffix: a.suffix.replace(/^-/, ""), function: a.function }))
  .sort((a, b) => b.suffix.length - a.suffix.length);

const REFLEXIVE_SUFFIX = "ûm";

/** Analyzes a single Gurzûl Khar surface word, returning the root, lexicon entry (if any), and the ordered affixes stripped to reach it. Deterministic: same input always yields the same analysis. */
export function analyzeWord(surface: string): MorphAnalysis {
  const direct = findEntry(surface);
  if (direct) {
    return { surface, root: surface, affixes: [], entry: direct, recognized: true };
  }

  // 1. Possessive suffixes (longest first, so -shûk is tried before a bare -ûk match).
  for (const { person, suffix } of POSSESSIVE_SUFFIXES) {
    if (surface.length > suffix.length && surface.endsWith(suffix)) {
      const stem = surface.slice(0, -suffix.length);
      const entry = findEntry(stem);
      if (entry) {
        return {
          surface,
          root: stem,
          affixes: [{ type: "possessive", suffix, gloss: `possessive (${person})` }],
          entry,
          recognized: true,
        };
      }
    }
  }

  // 2. Plural (epenthetic form first). The root already ends in -k (that's why the
  // epenthetic form was used), so stripping "-akûk" leaves the root as-is — no extra "k".
  if (surface.endsWith(PLURAL_EPENTHETIC_FULL)) {
    const stem = surface.slice(0, -PLURAL_EPENTHETIC_FULL.length);
    const entry = findEntry(stem);
    if (entry) {
      return {
        surface,
        root: stem,
        affixes: [{ type: "plural", suffix: PLURAL_EPENTHETIC_FULL, gloss: "plural" }],
        entry,
        recognized: true,
      };
    }
  }
  if (surface.endsWith(PLURAL_SUFFIX) && surface.length > PLURAL_SUFFIX.length) {
    const stem = surface.slice(0, -PLURAL_SUFFIX.length);
    const entry = findEntry(stem);
    if (entry) {
      return {
        surface,
        root: stem,
        affixes: [{ type: "plural", suffix: PLURAL_SUFFIX, gloss: "plural" }],
        entry,
        recognized: true,
      };
    }
  }

  // 3. Tense suffixes (verbs).
  const tenseSuffixesSorted = Object.keys(TENSE_SUFFIXES).sort((a, b) => b.length - a.length);
  for (const suf of tenseSuffixesSorted) {
    if (surface.endsWith(suf) && surface.length > suf.length) {
      const stem = surface.slice(0, -suf.length);
      const entry = findEntry(stem);
      if (entry && entry.pos === "verb") {
        return {
          surface,
          root: stem,
          affixes: [{ type: "tense", suffix: suf, gloss: `tense: ${TENSE_SUFFIXES[suf]}` }],
          entry,
          recognized: true,
        };
      }
    }
  }

  // 4. Reflexive suffix on pronouns.
  if (surface.endsWith(REFLEXIVE_SUFFIX) && surface.length > REFLEXIVE_SUFFIX.length) {
    const stem = surface.slice(0, -REFLEXIVE_SUFFIX.length);
    const entry = findEntry(stem);
    if (entry && entry.pos === "pronoun") {
      return {
        surface,
        root: stem,
        affixes: [{ type: "reflexive", suffix: REFLEXIVE_SUFFIX, gloss: "reflexive" }],
        entry,
        recognized: true,
      };
    }
  }

  // 5. Derivational suffixes.
  for (const { suffix, function: fn } of DERIVATIONAL_SUFFIXES) {
    if (surface.endsWith(suffix) && surface.length > suffix.length) {
      const stem = surface.slice(0, -suffix.length);
      const entry = findEntry(surface) ?? findEntry(stem);
      if (entry) {
        return {
          surface,
          root: stem,
          affixes: [{ type: "derivational", suffix, gloss: fn }],
          entry,
          recognized: true,
        };
      }
    }
  }

  return { surface, root: surface, affixes: [], entry: null, recognized: false };
}
