import { lexicon, type LexiconEntry } from "../data.js";

/** Lexicon "en"/"nl" fields sometimes hold compound glosses like "he/she/it", "you (pl.)", "dit/deze". This normalizes a gloss field into its individual matchable surface forms. */
function variants(field: string): string[] {
  return field
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // drop parentheticals like "(sg.)"
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function findByEnglish(word: string): LexiconEntry | null {
  const w = word.toLowerCase().replace(/^to\s+/, "");
  return (
    lexicon.entries.find((e) => variants(e.en).includes(w)) ??
    lexicon.entries.find((e) => variants(e.en.replace(/^to\s+/, "")).includes(w)) ??
    null
  );
}

export function findByDutch(word: string): LexiconEntry | null {
  const w = word.toLowerCase();
  return lexicon.entries.find((e) => variants(e.nl).includes(w)) ?? null;
}

export function findByGkh(word: string): LexiconEntry | null {
  const w = word.toLowerCase();
  return lexicon.entries.find((e) => e.gkh.toLowerCase() === w) ?? null;
}
