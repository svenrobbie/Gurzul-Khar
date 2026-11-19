// Phoneme tokenizer: turns a Latin-transliterated Gurzûl Khar word into an
// ordered list of atomic phoneme tokens (consonants, including digraphs; and
// vowels, including long vowels and diphthongs), using ONLY the inventory
// declared in data/phonology/phonology.json. No phoneme is invented here.
import { phonology, type ConsonantDef, type VowelDef } from "../data.js";

export type PhonemeKind = "consonant" | "vowel";

export interface PhonemeToken {
  kind: PhonemeKind;
  id: string; // phonology id, e.g. "kh", "â", "ai"
  latin: string; // the literal substring consumed, lowercase
  ipa: string;
  isLong?: boolean;
  isDiphthong?: boolean;
  place?: string;
  manner?: string;
  voicing?: "voiced" | "voiceless";
}

interface LatinEntry {
  latin: string;
  token: Omit<PhonemeToken, "latin">;
}

function buildLatinTable(): LatinEntry[] {
  const table: LatinEntry[] = [];
  for (const c of phonology.consonants as ConsonantDef[]) {
    table.push({
      latin: c.latin.toLowerCase(),
      token: { kind: "consonant", id: c.id, ipa: c.ipa, place: c.place, manner: c.manner, voicing: c.voicing },
    });
  }
  for (const v of phonology.vowels.diphthongs as VowelDef[]) {
    table.push({ latin: v.latin.toLowerCase(), token: { kind: "vowel", id: v.id, ipa: v.ipa, isDiphthong: true } });
  }
  for (const v of phonology.vowels.long as VowelDef[]) {
    table.push({ latin: v.latin.toLowerCase(), token: { kind: "vowel", id: v.id, ipa: v.ipa, isLong: true } });
    for (const variant of (v as any).writtenVariants ?? []) {
      table.push({ latin: String(variant).toLowerCase(), token: { kind: "vowel", id: v.id, ipa: v.ipa, isLong: true } });
    }
  }
  for (const v of phonology.vowels.short as VowelDef[]) {
    table.push({ latin: v.latin.toLowerCase(), token: { kind: "vowel", id: v.id, ipa: v.ipa } });
  }
  // Longest-match-first so digraphs (kh, gh, sh, zh, ng) and diphthongs
  // (ai, au, oi) are preferred over their single-character components.
  table.sort((a, b) => b.latin.length - a.latin.length);
  return table;
}

const LATIN_TABLE = buildLatinTable();

export class UnrecognizedPhonemeError extends Error {
  constructor(public readonly remainder: string, public readonly word: string) {
    super(`Cannot tokenize "${word}": unrecognized sequence starting at "${remainder}"`);
  }
}

/** Tokenize a single Latin-transliterated word into phoneme tokens. Deterministic: greedy longest-match left to right. */
export function tokenizeWord(word: string): PhonemeToken[] {
  const w = word.toLowerCase();
  const tokens: PhonemeToken[] = [];
  let i = 0;
  outer: while (i < w.length) {
    for (const entry of LATIN_TABLE) {
      if (w.startsWith(entry.latin, i)) {
        tokens.push({ ...entry.token, latin: entry.latin });
        i += entry.latin.length;
        continue outer;
      }
    }
    throw new UnrecognizedPhonemeError(w.slice(i), w);
  }
  return tokens;
}

/** Safe variant: returns null instead of throwing, for user-facing code paths. */
export function tryTokenizeWord(word: string): PhonemeToken[] | null {
  try {
    return tokenizeWord(word);
  } catch {
    return null;
  }
}

export function phonemesToLatin(tokens: PhonemeToken[]): string {
  return tokens.map((t) => t.latin).join("");
}
