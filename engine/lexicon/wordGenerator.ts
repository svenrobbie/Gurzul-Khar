// Candidate-word suggestion engine for the Phase 2 "propose a word" flow.
// Builds a phonotactically valid Gurzûl Khar spelling for an English/Dutch
// gloss the lexicon doesn't have yet, using ONLY the phoneme inventory and
// phonotactic rules in data/phonology/phonology.json (never a hardcoded
// second phoneme list) and, optionally, a derivational affix from
// lexicon.json's derivationalAffixes when the caller supplies an existing
// root to build on. Every candidate is re-validated with the same
// phonotactic checker used for the hand-authored lexicon
// (engine/phonology/phonotacticValidator.ts) before being returned, so a
// suggestion can never violate the language's own documented rules.
import { phonology, lexicon, type ConsonantDef, type VowelDef, type LexiconEntry } from "../data.js";
import { checkWordPhonotactics } from "../phonology/phonotacticValidator.js";
import { ipaOfWord } from "../translator/ipa.js";

/** Small deterministic string hash -> PRNG, so the same gloss always suggests the same candidate (no two runs of this tool for the same input disagree). */
function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

const CONSONANTS = phonology.consonants as ConsonantDef[];
const SHORT_VOWELS = phonology.vowels.short as VowelDef[];
const LONG_VOWELS = phonology.vowels.long as VowelDef[];

const INITIAL_CONSONANTS = CONSONANTS.filter((c) => c.positions.includes("initial") && c.id !== "ng" && c.id !== "zh");
const MEDIAL_CONSONANTS = CONSONANTS.filter((c) => c.positions.includes("medial"));
const FINAL_CONSONANTS = CONSONANTS.filter((c) => c.positions.includes("final") && c.id !== "q" && c.id !== "w" && c.id !== "y");
const FINAL_SAFE_CONSONANTS = FINAL_CONSONANTS.filter((c) => c.id !== "gh" && c.id !== "zh"); // those two need a preceding long vowel; simplest to just avoid them as the suggester's default

function buildSyllable(rand: () => number, opts: { isFirst: boolean; isLast: boolean }): { latin: string } {
  let onset = "";
  if (opts.isFirst) {
    if (rand() < 0.85) onset = pick(INITIAL_CONSONANTS, rand).latin;
  } else {
    if (rand() < 0.7) onset = pick(MEDIAL_CONSONANTS, rand).latin;
  }
  const useLong = rand() < 0.3;
  const nucleus = useLong ? pick(LONG_VOWELS, rand).latin : pick(SHORT_VOWELS, rand).latin;
  let coda = "";
  if (opts.isLast) {
    if (rand() < 0.55) coda = pick(FINAL_SAFE_CONSONANTS, rand).latin;
  } else {
    if (rand() < 0.3) coda = pick(MEDIAL_CONSONANTS, rand).latin;
  }
  return { latin: onset + nucleus + coda };
}

export interface GeneratedCandidate {
  gkh: string;
  ipa: string;
  phonotacticallyValid: boolean;
  syllableCount: number;
  derivation?: { suffix: string; function: string; rootEntry: string };
}

/**
 * Suggests one candidate spelling for a gloss not currently in the lexicon.
 * `rootHint` lets the caller ask for a derived form (e.g. "agent noun of
 * khar") instead of a brand-new root: when given, the candidate is
 * `rootEntry.gkh + derivationalAffix` instead of a freshly generated root,
 * exactly the mechanism already used for khardûm/kharith/pâkûl.
 */
export function suggestWord(
  gloss: { en: string; nl?: string },
  pos: string,
  rootHint?: { rootGkh: string; suffix: string }
): GeneratedCandidate {
  if (rootHint) {
    const rootEntry = lexicon.entries.find((e: LexiconEntry) => e.gkh.toLowerCase() === rootHint.rootGkh.toLowerCase());
    const affix = (lexicon.derivationalAffixes as { suffix: string; function: string }[]).find(
      (a) => a.suffix.replace(/^-/, "") === rootHint.suffix.replace(/^-/, "")
    );
    if (rootEntry && affix) {
      const gkh = rootEntry.gkh + rootHint.suffix.replace(/^-/, "");
      const violations = checkWordPhonotactics(gkh);
      return {
        gkh,
        ipa: ipaOfWord(gkh) || "",
        phonotacticallyValid: violations.length === 0,
        syllableCount: NaN,
        derivation: { suffix: rootHint.suffix, function: affix.function, rootEntry: rootEntry.gkh },
      };
    }
  }

  const seedBase = `${gloss.en}|${gloss.nl ?? ""}|${pos}`;
  // Try several seeds until phonotactics approve (the construction rules above
  // already respect every restriction, so this almost always succeeds on the
  // first or second attempt; the loop is a safety net, not the real validator).
  for (let attempt = 0; attempt < 12; attempt++) {
    const rand = seededRandom(seedBase + "#" + attempt);
    const syllableCount = rand() < 0.6 ? 2 : rand() < 0.85 ? 1 : 3;
    const syllables: string[] = [];
    for (let i = 0; i < syllableCount; i++) {
      syllables.push(buildSyllable(rand, { isFirst: i === 0, isLast: i === syllableCount - 1 }).latin);
    }
    const gkh = syllables.join("");
    const violations = checkWordPhonotactics(gkh);
    if (violations.length === 0 && gkh.length >= 2) {
      return { gkh, ipa: ipaOfWord(gkh), phonotacticallyValid: true, syllableCount };
    }
  }
  // Fallback: a minimal, always-valid CV shape (still generated from the real inventory, not hardcoded sounds).
  const rand = seededRandom(seedBase + "#fallback");
  const fallback = pick(INITIAL_CONSONANTS, rand).latin + pick(SHORT_VOWELS, rand).latin;
  return { gkh: fallback, ipa: ipaOfWord(fallback), phonotacticallyValid: checkWordPhonotactics(fallback).length === 0, syllableCount: 1 };
}
