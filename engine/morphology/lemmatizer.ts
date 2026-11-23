// Tiers 2 and 3 of the word-coverage plan (ROADMAP.md): resolve a source-language
// word to Gurzûl Khar through the lexicon and its own rules BEFORE the coiner is
// ever asked. Only tier 4 — a word with no known lemma and no known parts — gets
// an invented form.
//
// Tier 2, inflection, is delegated to resolveContentWord(), which uses the clause
// parser's own heuristics rather than a second copy of them.
//
// Tier 3, compounding, is where Dutch pays off. "nachtwacht" is not a vocabulary
// gap: it is "nacht" + "wacht", both of which the lexicon has, and Gurzûl Khar
// builds compounds the same way Dutch does — modifier first, head last, roots
// joined directly (grammar.json nouns.compounding: ghûl + dor = ghûldor). So the
// right answer is a real compound of real words, not a coinage that merely looks
// like one.
import type { LexiconEntry } from "../data.js";
import { resolveContentWord, type Lang } from "../translator/naturalLanguage.js";
import { checkWordPhonotactics } from "../phonology/phonotacticValidator.js";

export type LemmaKind = "direct" | "inflected" | "compound";

export interface LemmaResult {
  kind: LemmaKind;
  /** The Gurzûl Khar form: an existing spelling, or a compound built from existing roots. */
  gkh: string;
  /** The entry this resolved to. Absent for compounds, which resolve to several. */
  entry?: LexiconEntry;
  /** For compounds: the parts, modifier first, head last. */
  parts?: { surface: string; entry: LexiconEntry }[];
  /** True when the built compound breaks the documented phonotactics. Reported, never silently hidden. */
  phonotacticallyIrregular?: boolean;
}

/** Linking elements Dutch inserts between compound members: nacht(en)wacht, dorp(s)plein. */
const NL_LINKERS = ["", "s", "en", "e", "er"];
const EN_LINKERS = ["", "s"];

/** Shortest part worth trusting. Below this, almost anything matches something and compounds become nonsense. */
const MIN_PART = 3;
/** A compound of more than three members is far more likely to be a bad split than a real word. */
const MAX_PARTS = 3;

function rootOf(entry: LexiconEntry): string {
  return (entry.root ?? entry.gkh).replace(/-/g, "");
}

/**
 * Splits `word` into lexicon-resolvable parts, left to right.
 * Returns null when no clean split exists. Prefers the FEWEST parts, and among
 * equal counts the one whose first member is longest — "nachtwacht" should be
 * nacht+wacht, never na+cht+wacht.
 */
function splitCompound(word: string, lang: Lang, depth = 1): { surface: string; entry: LexiconEntry }[] | null {
  if (depth > MAX_PARTS) return null;
  const linkers = lang === "nl" ? NL_LINKERS : EN_LINKERS;

  // Longest first: a longer head is nearly always the better analysis.
  for (let cut = word.length - MIN_PART; cut >= MIN_PART; cut--) {
    const head = word.slice(0, cut);
    const headEntry = resolveContentWord(head, lang);
    if (!headEntry) continue;

    for (const linker of linkers) {
      const rest = word.slice(cut);
      if (!rest.startsWith(linker)) continue;
      const tail = rest.slice(linker.length);
      if (tail.length < MIN_PART) continue;

      const tailEntry = resolveContentWord(tail, lang);
      if (tailEntry) return [{ surface: head, entry: headEntry }, { surface: tail, entry: tailEntry }];

      const deeper = splitCompound(tail, lang, depth + 1);
      if (deeper) return [{ surface: head, entry: headEntry }, ...deeper];
    }
  }
  return null;
}

/**
 * Resolves one source-language word without ever inventing anything.
 * Returns null when the lexicon genuinely cannot account for the word — that,
 * and only that, is when the caller should coin.
 */
export function lemmatize(word: string, lang: Lang): LemmaResult | null {
  const clean = word.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "");
  if (!clean) return null;

  const direct = resolveContentWord(clean, lang);
  if (direct) {
    const surfaceMatches = (lang === "en" ? direct.en : direct.nl ?? "").toLowerCase().split(/[/,]/).some((v) => v.trim() === clean);
    return { kind: surfaceMatches ? "direct" : "inflected", gkh: direct.gkh, entry: direct };
  }

  // Hyphenated source compounds are already split for us.
  if (clean.includes("-")) {
    const pieces = clean.split("-").filter(Boolean);
    const resolved = pieces.map((piece) => ({ surface: piece, entry: resolveContentWord(piece, lang) }));
    if (resolved.length > 1 && resolved.every((r) => r.entry)) {
      return buildCompound(resolved as { surface: string; entry: LexiconEntry }[]);
    }
  }

  if (clean.length >= MIN_PART * 2) {
    const parts = splitCompound(clean, lang);
    if (parts) return buildCompound(parts);
  }

  return null;
}

function buildCompound(parts: { surface: string; entry: LexiconEntry }[]): LemmaResult {
  // grammar.json nouns.compounding: modifier + head, head-final, roots joined
  // directly. Dutch and English are head-final too, so source order is kept.
  const gkh = parts.map((p) => rootOf(p.entry)).join("");
  return {
    kind: "compound",
    gkh,
    parts,
    phonotacticallyIrregular: checkWordPhonotactics(gkh).length > 0 || undefined,
  };
}

/**
 * Best-guess dictionary form for a word the lexicon cannot account for at all.
 *
 * This exists for one reason: the coiner seeds on the lemma, so without it
 * "huis" and "huizen" would be given two unrelated Gurzûl Khar words for the
 * same thing. Stripping the obvious inflection first means both coin the same
 * form, which is what "always the same word" has to mean in practice.
 *
 * It is a GUESS, applied only after every lexicon route has failed, and it is
 * deliberately conservative: a wrong strip costs one slightly-off lemma, while
 * an over-eager one would merge words that are genuinely different.
 */
export function guessLemma(word: string, lang: Lang): string {
  const w = word.toLowerCase();
  if (lang === "nl") {
    if (w.endsWith("en") && w.length > 5) return w.slice(0, -2);
    if (w.endsWith("s") && w.length > 4) return w.slice(0, -1);
  } else {
    if (w.endsWith("ies") && w.length > 5) return `${w.slice(0, -3)}y`;
    if (w.endsWith("es") && w.length > 5) return w.slice(0, -2);
    if (w.endsWith("s") && !w.endsWith("ss") && w.length > 4) return w.slice(0, -1);
  }
  return w;
}
