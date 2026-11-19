import { tokenizeWord, type PhonemeToken } from "../phonology/phonemes.js";
import { syllabify, type Syllable } from "../phonology/syllabify.js";
import { stressedSyllableIndex } from "../phonology/stress.js";

function syllableIpa(syl: Syllable): string {
  return syl.onset.map((t) => t.ipa).join("") + syl.nucleus.ipa + syl.coda.map((t) => t.ipa).join("");
}

/** Full IPA transcription of a single Latin-transliterated word, with primary stress (ˈ) placed per phonology.json's stress rule. */
export function ipaOfWord(word: string): string {
  let tokens: PhonemeToken[];
  try {
    tokens = tokenizeWord(word);
  } catch {
    return "";
  }
  const syllables = syllabify(tokens);
  if (syllables.length === 0) return tokens.map((t) => t.ipa).join("");
  const stressIdx = stressedSyllableIndex(syllables);
  return syllables.map((s, i) => (i === stressIdx ? "ˈ" : "") + syllableIpa(s)).join("");
}

export function ipaOfSentence(gkhText: string): string {
  return gkhText
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `/${ipaOfWord(w)}/`)
    .join(" ");
}
