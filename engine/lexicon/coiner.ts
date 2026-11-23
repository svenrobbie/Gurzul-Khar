// coiner_v1 — the deterministic fallback that gives EVERY input word a
// Gurzûl Khar form, identical on every run, every platform and every build.
//
// FROZEN. Once this has shipped, nothing in this file that affects output may
// change: not a weight, not a table order, not the hash. Improvements land as
// a new file (coiner_v2.ts) with its own version tag, and v2 applies only to
// glosses that have no recorded v1 form. tests/fixtures/coiner_v1.golden.json
// is the enforcement — if any listed gloss moves, the build fails.
//
// Design notes (ROADMAP.md, "The determinism contract"):
//   * Integer-only. All arithmetic is u64 via BigInt, mirroring Rust's
//     wrapping u64 exactly. No floating point anywhere in the seeded path,
//     because float rounding is not guaranteed identical across platforms.
//   * Byte-level hashing of UTF-8, so `khar` hashes the same in TS and Rust.
//   * One INDEPENDENT sub-seed per decision, derived from the root hash and a
//     label. Changing the vowel inventory therefore cannot reshuffle which
//     onsets were chosen — each decision is isolated from the others.
//   * Phonotactics are not re-implemented here: every candidate is checked by
//     the same checkWordPhonotactics the hand-authored lexicon is checked by.
import { phonology, coinerWeightsV1, coinerReservedV1, type VowelDef, type WeightedUnit } from "../data.js";
import { checkWordPhonotactics } from "../phonology/phonotacticValidator.js";
import { tryTokenizeWord } from "../phonology/phonemes.js";
import { ipaOfWord } from "../translator/ipa.js";

export const COINER_VERSION = "v1";

const U64 = (1n << 64n) - 1n;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

/** FNV-1a over UTF-8 bytes, 64-bit, wrapping. The one hash this file uses. */
function fnv1a64(bytes: Uint8Array): bigint {
  let h = FNV_OFFSET;
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ BigInt(bytes[i])) & U64;
    h = (h * FNV_PRIME) & U64;
  }
  return h;
}

const encoder = new TextEncoder();

function hashString(s: string): bigint {
  return fnv1a64(encoder.encode(s));
}

/**
 * An independent 64-bit value for one decision. `label` names the decision
 * ("count", "onset0", "vowel1"...), so two decisions never share a stream and
 * tuning one cannot disturb another.
 */
function field(root: bigint, label: string): bigint {
  return hashString(root.toString(16).padStart(16, "0") + ":" + label);
}

/** A draw in [0, n). Integer modulo only. */
function pickIndex(root: bigint, label: string, n: number): number {
  if (n <= 0) throw new Error("coiner: empty inventory");
  return Number(field(root, label) % BigInt(n));
}

/** A percentage roll: true when the derived value falls under `percent` of 100. */
function roll(root: bigint, label: string, percent: number): boolean {
  return Number(field(root, label) % 100n) < percent;
}

// ---------------------------------------------------------------------------
// Inventories and weights.
//
// NOT drawn uniformly from the declared phoneme inventory: that produced legal
// words that sounded nothing like the language (phonology.json declares ê/î/ô,
// which the 292-entry lexicon never uses once). Instead every table here is
// measured from the hand-authored lexicon and frozen into
// data/phonology/coinerWeights_v1.json by scripts/buildCoinerWeights.ts, so a
// coined word has the same sound profile as a word Sven wrote by hand.
// ---------------------------------------------------------------------------
const W = coinerWeightsV1;

/** Cumulative integer weights, built once. No floating point. */
function cumulative(units: WeightedUnit[]): { units: string[]; cum: number[]; total: number } {
  const out = { units: [] as string[], cum: [] as number[], total: 0 };
  for (const u of units) {
    out.total += u.weight;
    out.units.push(u.unit);
    out.cum.push(out.total);
  }
  return out;
}

const TABLES = {
  onsetInitial: cumulative(W.onsetInitial),
  onsetMedial: cumulative(W.onsetMedial),
  nuclei: cumulative(W.nuclei),
  codaFinal: cumulative(W.codaFinal),
  codaMedial: cumulative(W.codaMedial),
};

const LONG_VOWEL_SET = new Set((phonology.vowels.long as VowelDef[]).map((v) => v.latin));
const SHORT_NUCLEI = cumulative(W.nuclei.filter((u) => !LONG_VOWEL_SET.has(u.unit)));
const LONG_NUCLEI = cumulative(W.nuclei.filter((u) => LONG_VOWEL_SET.has(u.unit)));

/** Weighted draw. The derived value is reduced modulo the table total, then located by linear scan over cumulative integer weights. */
function weighted(root: bigint, label: string, table: { units: string[]; cum: number[]; total: number }): string {
  if (table.total === 0) throw new Error("coiner: empty weight table");
  const roll = Number(field(root, label) % BigInt(table.total));
  for (let i = 0; i < table.cum.length; i++) {
    if (roll < table.cum[i]) return table.units[i];
  }
  return table.units[table.units.length - 1];
}

const MAX_ATTEMPTS = 64;

export interface CoinInput {
  /** The dictionary form, already lemmatised. `huizen` must arrive as `huis`. */
  lemma: string;
  /** Part of speech, so `work` (n) and `work` (v) can differ. */
  pos: string;
  /** Source language of the lemma. */
  lang: "en" | "nl";
}

export interface CoinedWord {
  gkh: string;
  ipa: string;
  version: string;
  /** How many candidates were rejected before this one. Part of the contract. */
  attempt: number;
  seed: string;
}

/**
 * Canonical seed text. Everything that is not a letter is dropped, case is
 * folded, and Unicode is NFC-normalised, so "Huis!", "huis" and "HUIS" are one
 * and the same input. Surface inflection is NOT handled here — lemmatise first.
 */
export function normaliseSeed(input: CoinInput): string {
  const clean = (s: string) =>
    s
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  return `${clean(input.lemma)}|${clean(input.pos)}|${clean(input.lang)}`;
}

function buildSyllable(root: bigint, index: number, isFirst: boolean, isLast: boolean): string {
  let onset = "";
  if (isFirst) {
    if (roll(root, `onset${index}`, W.presence.onsetFirstPercent)) onset = weighted(root, `onsetPick${index}`, TABLES.onsetInitial);
  } else if (roll(root, `onset${index}`, W.presence.onsetMedialPercent)) {
    onset = weighted(root, `onsetPick${index}`, TABLES.onsetMedial);
  }

  const long = roll(root, `vowelLength${index}`, W.presence.longVowelPercent);
  const nucleus = weighted(root, `vowelPick${index}`, long ? LONG_NUCLEI : SHORT_NUCLEI);

  let coda = "";
  if (isLast) {
    if (roll(root, `coda${index}`, W.presence.codaFinalPercent)) coda = weighted(root, `codaPick${index}`, TABLES.codaFinal);
  } else if (roll(root, `coda${index}`, W.presence.codaMedialPercent)) {
    coda = weighted(root, `codaPick${index}`, TABLES.codaMedial);
  }

  return onset + nucleus + coda;
}

function candidateFor(seed: string, attempt: number): string {
  const root = hashString(attempt === 0 ? seed : `${seed}#${attempt}`);
  const dice = Number(field(root, "count") % 100n);
  const base = dice < W.syllableCount.onePercent ? 1 : dice < W.syllableCount.twoPercent ? 2 : 3;
  // The 1-and-2-syllable space saturates at roughly the size of a real
  // vocabulary: coining 50,000 words from it needs a retry 62% of the time and
  // worst-case 37 attempts. Raising the floor as attempts mount opens the much
  // larger 3-syllable space for the long tail only, which is also how natural
  // languages behave — the common words stay short.
  const floor = attempt >= 24 ? 3 : attempt >= 8 ? 2 : 1;
  const syllableCount = Math.max(base, floor);

  let word = "";
  for (let i = 0; i < syllableCount; i++) {
    word += buildSyllable(root, i, i === 0, i === syllableCount - 1);
  }
  return word;
}

/**
 * Euphony rule the lexicon obeys without ever stating it: not one of the 292
 * hand-authored entries contains a doubled letter (no "nn", no "aa"), and none
 * has a run of three or more vowels. Syllable concatenation produces both
 * ("nurn" + "noth"), and they are the main thing that makes a coined word read
 * as machine-made, so a candidate that breaks either is rejected and re-seeded.
 */
function breaksEuphony(word: string): boolean {
  if (/(.)\1/u.test(word)) return true;
  if (/[aeiouâûüêîôy]{3}/u.test(word)) return true;
  // No entry has three consonant PHONEMES in a row either (counted after
  // tokenisation, so the "rth" of garth is two phonemes, not three). Joining a
  // medial coda cluster to the next onset is exactly how that happens.
  const tokens = tryTokenizeWord(word);
  if (tokens) {
    let run = 0;
    for (const token of tokens) {
      if (token.kind === "vowel") run = 0;
      else if (++run >= 3) return true;
    }
  }
  return false;
}

/**
 * The hand-authored spellings coiner_v1 avoids — read from the FROZEN snapshot
 * in data/lexicon/coinerReserved_v1.json, deliberately not from the live
 * lexicon.
 *
 * This is the difference between a promise and a wish. If the coiner consulted
 * the live lexicon, adding one word to the dictionary would push some unrelated
 * gloss onto its next candidate, and the word a learner wrote down last week
 * would quietly become a different word. Reading a snapshot means the lexicon
 * can grow freely and no coinage ever moves.
 *
 * The reverse collision — a NEW hand-authored word taking a spelling the coiner
 * already issued — is caught by tests/coinerReserved.test.ts instead, where it
 * is cheap to fix by choosing another spelling.
 */
const RESERVED_FORMS = new Set(coinerReservedV1.forms);

/**
 * Coins the Gurzûl Khar form for a gloss the lexicon does not contain.
 *
 * The result is a pure function of (lemma, pos, lang, `taken`). Pass the same
 * three values on any machine, in any build, and you get the same word.
 *
 * `taken` lets the caller reserve forms already coined for OTHER glosses, so
 * two different meanings never end up sharing a spelling. Callers that keep a
 * coinage index should pass it; callers that do not still get collision-free
 * results against the hand-authored lexicon.
 */
export function coin(input: CoinInput, opts: { taken?: ReadonlySet<string> } = {}): CoinedWord {
  const seed = normaliseSeed(input);
  const taken = opts.taken;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const gkh = candidateFor(seed, attempt);
    if (gkh.length < 2) continue;
    if (checkWordPhonotactics(gkh).length > 0) continue;
    if (breaksEuphony(gkh)) continue;
    if (RESERVED_FORMS.has(gkh)) continue;
    if (taken?.has(gkh)) continue;
    return { gkh, ipa: ipaOfWord(gkh), version: COINER_VERSION, attempt, seed };
  }

  throw new Error(
    `coiner_v1: no valid candidate for "${seed}" within ${MAX_ATTEMPTS} attempts. ` +
      "This should be unreachable; if it fires, the phoneme inventory or the weights have been changed."
  );
}

/** Retained for callers that imported it; the reserved set is a frozen constant now, so there is nothing to invalidate. */
export function resetCoinerCaches(): void {
  /* no cache to clear */
}
