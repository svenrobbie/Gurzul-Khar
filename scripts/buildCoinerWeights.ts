// Builds data/phonology/coinerWeights_v1.json by MEASURING the hand-authored
// lexicon: which onsets, nuclei and codas Sven actually chose, and how often.
//
// Why measure instead of guess: a coiner that draws uniformly from the full
// declared inventory produces legal words that sound nothing like the real
// ones (phonology.json declares ê/î/ô, which the 292-entry lexicon never uses
// even once). Weighting by observed frequency is what makes a coined word sit
// next to khar, dor and ghûldor without standing out.
//
// The OUTPUT is frozen with coiner_v1. Re-running this after the lexicon grows
// would change every coined word, so it must only be re-run deliberately,
// before v1 ships, or as the basis of a new coiner_v2.
import { writeFileSync } from "node:fs";
import { phonology, lexicon, type ConsonantDef } from "../engine/data.js";
import { tryTokenizeWord } from "../engine/phonology/phonemes.js";
import { syllabify } from "../engine/phonology/syllabify.js";

const CONSONANTS = phonology.consonants as ConsonantDef[];
const byLatin = new Map(CONSONANTS.map((c) => [c.latin, c]));
const onsetAllowed = new Set(phonology.phonotactics.onsetClusters.allowed as string[]);
const codaAllowed = new Set(phonology.phonotactics.codaClusters.allowed as string[]);

function unitConsonants(unit: string): ConsonantDef[] | null {
  // Greedy longest-match over declared latin spellings (digraphs first).
  const spellings = [...byLatin.keys()].sort((a, b) => b.length - a.length);
  const out: ConsonantDef[] = [];
  let i = 0;
  while (i < unit.length) {
    const hit = spellings.find((s) => unit.startsWith(s, i));
    if (!hit) return null;
    out.push(byLatin.get(hit)!);
    i += hit.length;
  }
  return out;
}

function onsetOk(unit: string, position: "initial" | "medial"): boolean {
  const parts = unitConsonants(unit);
  if (!parts || parts.length === 0 || parts.length > 2) return false;
  if (parts.length === 2 && !onsetAllowed.has(unit)) return false;
  if (!parts[0].positions.includes(position)) return false;
  if (position === "initial" && (parts[0].id === "ng" || parts[0].id === "zh")) return false;
  return true;
}

function codaOk(unit: string, position: "final" | "medial"): boolean {
  const parts = unitConsonants(unit);
  if (!parts || parts.length === 0 || parts.length > 2) return false;
  if (parts.length === 2 && !codaAllowed.has(unit)) return false;
  const last = parts[parts.length - 1];
  if (!last.positions.includes(position === "final" ? "final" : "medial")) return false;
  // q/w/y never close a word; gh/zh only after a long vowel, which the builder
  // does not arrange, so they are excluded from word-final codas outright.
  if (position === "final" && ["q", "w", "y", "gh", "zh"].includes(last.id)) return false;
  return true;
}

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

const onsetInitial = new Map<string, number>();
const onsetMedial = new Map<string, number>();
const nuclei = new Map<string, number>();
const codaFinal = new Map<string, number>();
const codaMedial = new Map<string, number>();
const syllableCounts = new Map<number, number>();
let onsetFirstPresent = 0, firstTotal = 0, onsetMedialPresent = 0, medialTotal = 0;
let codaFinalPresent = 0, finalTotal = 0, codaMedialPresent = 0, medialCodaTotal = 0;

for (const entry of lexicon.entries) {
  const tokens = tryTokenizeWord(entry.gkh.replace(/-/g, ""));
  if (!tokens) continue;
  const syllables = syllabify(tokens);
  bump(syllableCounts as unknown as Map<string, number>, String(syllables.length));
  syllables.forEach((syl, i) => {
    const isFirst = i === 0;
    const isLast = i === syllables.length - 1;
    const onset = syl.onset.map((t) => t.latin).join("");
    const coda = syl.coda.map((t) => t.latin).join("");

    if (isFirst) { firstTotal++; if (onset) { onsetFirstPresent++; if (onsetOk(onset, "initial")) bump(onsetInitial, onset); } }
    else { medialTotal++; if (onset) { onsetMedialPresent++; if (onsetOk(onset, "medial")) bump(onsetMedial, onset); } }

    bump(nuclei, syl.nucleus.latin);

    if (isLast) { finalTotal++; if (coda) { codaFinalPresent++; if (codaOk(coda, "final")) bump(codaFinal, coda); } }
    else { medialCodaTotal++; if (coda) { codaMedialPresent++; if (codaOk(coda, "medial")) bump(codaMedial, coda); } }
  });
}

/** Sorted by latin spelling, NOT by count: the order is part of the frozen contract and must not shift when counts change. */
const table = (m: Map<string, number>) =>
  [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([unit, weight]) => ({ unit, weight }));

const pct = (n: number, d: number) => Math.round((n * 100) / d);

const counts = syllableCounts as unknown as Map<string, number>;
const total = [...counts.values()].reduce((a, b) => a + b, 0);
const one = pct(counts.get("1") ?? 0, total);
const two = pct(counts.get("2") ?? 0, total);

const longCount = [...nuclei.entries()].filter(([u]) => (phonology.vowels.long as { latin: string }[]).some((v) => v.latin === u)).reduce((a, [, n]) => a + n, 0);
const nucleusTotal = [...nuclei.values()].reduce((a, b) => a + b, 0);

const out = {
  version: "v1",
  note:
    "FROZEN with coiner_v1. Measured from the hand-authored lexicon by scripts/buildCoinerWeights.ts so that coined words match the observed sound of the language rather than the full declared inventory. Weights are raw observed counts; selection is cumulative-integer, never floating point. Unit order is alphabetical and is part of the contract — do not re-sort. Regenerating this file changes every coined word, so it belongs to a new coiner version, not to an edit of v1.",
  measuredFrom: { entries: lexicon.entries.length, lexiconVersion: lexicon.version },
  syllableCount: { onePercent: one, twoPercent: one + two },
  presence: {
    onsetFirstPercent: pct(onsetFirstPresent, firstTotal),
    onsetMedialPercent: pct(onsetMedialPresent, medialTotal),
    codaFinalPercent: pct(codaFinalPresent, finalTotal),
    codaMedialPercent: pct(codaMedialPresent, medialCodaTotal),
    longVowelPercent: pct(longCount, nucleusTotal),
  },
  onsetInitial: table(onsetInitial),
  onsetMedial: table(onsetMedial),
  nuclei: table(nuclei),
  codaFinal: table(codaFinal),
  codaMedial: table(codaMedial),
};

writeFileSync(new URL("../data/phonology/coinerWeights_v1.json", import.meta.url), JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ syllableCount: out.syllableCount, presence: out.presence }, null, 2));
console.log("onsetInitial", out.onsetInitial.length, "onsetMedial", out.onsetMedial.length, "nuclei", out.nuclei.length, "codaFinal", out.codaFinal.length, "codaMedial", out.codaMedial.length);
