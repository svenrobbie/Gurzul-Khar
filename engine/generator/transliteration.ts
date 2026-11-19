// Latin ⇄ native-script (Khargûl) conversion, per alphabet.json's
// latinTransliteration section: one letter/digraph per phoneme, reversible
// without lookahead because every digraph is phonotactically unambiguous.
// "Native script" is represented here as structured syllable-block data
// (WordBlocks); engine/phonology/glyphGenerator.ts renders that data to SVG.
// This split keeps the round trip testable independently of rendering.
import { tokenizeWord, phonemesToLatin, type PhonemeToken } from "../phonology/phonemes.js";
import { syllabify, syllableToLatin, type Syllable } from "../phonology/syllabify.js";
import { generateWordGlyph } from "../phonology/glyphGenerator.js";

export interface WordBlocks {
  original: string;
  tokens: PhonemeToken[];
  syllables: Syllable[];
}

export interface TransliterationResult {
  input: string;
  words: WordBlocks[];
  /** Native script rendered as inline SVG markup, one <svg> per word, in input order, joined by the script's word-boundary mark. */
  nativeSvg: string;
  /** Round-trip Latin reconstruction, for verification/testing. */
  roundTripLatin: string;
}

const WORD_SPLIT_RE = /([A-Za-zâêîôûÂÊÎÔÛ]+)/;

/** Converts Latin-transliterated Gurzûl Khar text to native-script block data + rendered SVG. Non-letter characters (spaces, punctuation) are preserved as separators and do not affect round-tripping. */
export function latinToNative(text: string): TransliterationResult {
  const parts = text.split(WORD_SPLIT_RE);
  const words: WordBlocks[] = [];
  const svgPieces: string[] = [];
  const latinPieces: string[] = [];

  for (const part of parts) {
    if (part === "") continue;
    if (WORD_SPLIT_RE.test(part) && /[A-Za-zâêîôûÂÊÎÔÛ]/.test(part)) {
      const tokens = tokenizeWord(part);
      const syllables = syllabify(tokens);
      words.push({ original: part, tokens, syllables });
      svgPieces.push(generateWordGlyph(syllables));
      latinPieces.push(phonemesToLatin(tokens));
    } else {
      // punctuation / whitespace passthrough
      svgPieces.push(part);
      latinPieces.push(part);
    }
  }

  return {
    input: text,
    words,
    nativeSvg: svgPieces.join(""),
    roundTripLatin: latinPieces.join(""),
  };
}

/** Reconstructs Latin text from previously generated WordBlocks (native → Latin direction). */
export function nativeToLatin(words: WordBlocks[]): string {
  return words.map((w) => w.syllables.map(syllableToLatin).join("")).join(" ");
}

/** Convenience: full round trip of a single word, returns true if Latin -> native -> Latin is lossless. */
export function roundTripsCleanly(word: string): boolean {
  const tokens = tokenizeWord(word);
  return phonemesToLatin(tokens).toLowerCase() === word.toLowerCase();
}
