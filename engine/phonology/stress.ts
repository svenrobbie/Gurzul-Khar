// Implements data/phonology/phonology.json's stress.defaultRule and
// stress.exceptions: penultimate stress, shifting to the final syllable
// when that syllable has a long vowel or diphthong; monosyllables stress
// their only syllable.
import type { Syllable } from "./syllabify.js";

export function stressedSyllableIndex(syllables: Syllable[]): number {
  const n = syllables.length;
  if (n === 0) return -1;
  if (n === 1) return 0;
  const last = syllables[n - 1];
  if (last.nucleus.isLong || last.nucleus.isDiphthong) return n - 1;
  return n - 2; // penultimate
}
