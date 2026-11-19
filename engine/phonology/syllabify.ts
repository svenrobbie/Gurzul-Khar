// Syllabifies a phoneme stream per data/phonology/phonology.json phonotactics:
// syllable template (C)(C)V(V)(C)(C), with onset/coda cluster legality drawn
// from phonology.phonotactics.onsetClusters / codaClusters.
import { phonology } from "../data.js";
import type { PhonemeToken } from "./phonemes.js";

export interface Syllable {
  onset: PhonemeToken[];
  nucleus: PhonemeToken; // a single vowel token (short, long, or diphthong — already atomic)
  coda: PhonemeToken[];
}

function latinOf(tokens: PhonemeToken[]): string {
  return tokens.map((t) => t.latin).join("");
}

function isOnsetClusterAllowed(a: PhonemeToken, b: PhonemeToken): boolean {
  return phonology.phonotactics.onsetClusters.allowed.includes(a.latin + b.latin);
}

function isCodaClusterAllowed(a: PhonemeToken, b: PhonemeToken): boolean {
  return phonology.phonotactics.codaClusters.allowed.includes(a.latin + b.latin);
}

/**
 * Splits a run of consonants that sits between two vowels into
 * (coda of the preceding syllable, onset of the following syllable),
 * applying the maximal-onset principle constrained by the documented
 * cluster tables. Falls back to a single coda / single onset consonant
 * split when no multi-consonant cluster is licensed — this is the
 * "smallest consistent extension" needed because phonology.json documents
 * cluster legality but not a formal medial-split algorithm; recorded in
 * DESIGN_DECISIONS.md.
 */
function splitMedialCluster(run: PhonemeToken[]): { coda: PhonemeToken[]; onset: PhonemeToken[] } {
  if (run.length === 0) return { coda: [], onset: [] };
  if (run.length === 1) return { coda: [], onset: run };
  if (run.length === 2) {
    if (isOnsetClusterAllowed(run[0], run[1])) return { coda: [], onset: run };
    if (isCodaClusterAllowed(run[0], run[1])) return { coda: run, onset: [] };
    return { coda: [run[0]], onset: [run[1]] };
  }
  // run.length >= 3: try a legal 2-consonant onset on the tail first (maximal onset),
  // otherwise a legal 2-consonant coda on the head, otherwise split 1/rest.
  const tail2 = run.slice(-2);
  if (isOnsetClusterAllowed(tail2[0], tail2[1])) {
    return { coda: run.slice(0, -2), onset: tail2 };
  }
  const head2 = run.slice(0, 2);
  if (isCodaClusterAllowed(head2[0], head2[1])) {
    return { coda: head2, onset: run.slice(2) };
  }
  return { coda: run.slice(0, -1), onset: run.slice(-1) };
}

export function syllabify(tokens: PhonemeToken[]): Syllable[] {
  const vowelIdx: number[] = [];
  tokens.forEach((t, i) => {
    if (t.kind === "vowel") vowelIdx.push(i);
  });
  if (vowelIdx.length === 0) return [];

  const onsets: PhonemeToken[][] = new Array(vowelIdx.length).fill(null).map(() => []);
  const codas: PhonemeToken[][] = new Array(vowelIdx.length).fill(null).map(() => []);

  // Word-initial consonants (before the first vowel) are all onset of syllable 0.
  onsets[0] = tokens.slice(0, vowelIdx[0]);

  for (let s = 0; s < vowelIdx.length; s++) {
    if (s < vowelIdx.length - 1) {
      const run = tokens.slice(vowelIdx[s] + 1, vowelIdx[s + 1]);
      const { coda, onset: nextOnset } = splitMedialCluster(run);
      codas[s] = coda;
      onsets[s + 1] = nextOnset;
    } else {
      // Word-final consonants (after the last vowel) are all coda of the last syllable.
      codas[s] = tokens.slice(vowelIdx[s] + 1);
    }
  }

  return vowelIdx.map((idx, s) => ({ onset: onsets[s], nucleus: tokens[idx], coda: codas[s] }));
}

export function syllableToLatin(syl: Syllable): string {
  return latinOf(syl.onset) + syl.nucleus.latin + latinOf(syl.coda);
}
