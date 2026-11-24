// Latin -> Khargûl rendering.
//
// The split is deliberate: the engine decides how a word divides into syllable
// blocks (crates/gkh-core, reached through WebAssembly), and this file turns
// those blocks into SVG. Anything the engine could not read — punctuation,
// spaces, a word outside the declared inventory — is passed through as written
// rather than drawn wrongly, so the round trip stays lossless.
import { engine } from "../engine";
import { generateWordGlyph } from "./glyphGenerator";
import type { TransliterationPart } from "./types";

export interface TransliterationResult {
  input: string;
  parts: TransliterationPart[];
  /** Native script as inline SVG, one <svg> per word, with the original text between them. */
  nativeSvg: string;
  /** The input reconstructed from what the engine read back, for verification. */
  roundTripLatin: string;
}

export function latinToNative(text: string): TransliterationResult {
  const parts = engine().transliterate(text);
  const svg: string[] = [];
  const latin: string[] = [];

  for (const part of parts) {
    if (part.kind === "word") {
      svg.push(generateWordGlyph(part.syllables));
      latin.push(part.latin);
    } else {
      svg.push(part.text);
      latin.push(part.text);
    }
  }

  return { input: text, parts, nativeSvg: svg.join(""), roundTripLatin: latin.join("") };
}

/** Reads previously generated blocks back as Latin — the native -> Latin direction. */
export function nativeToLatin(parts: TransliterationPart[]): string {
  return parts
    .map((p) =>
      p.kind === "word"
        ? p.syllables
            .map((s) => [...s.onset, s.nucleus, ...s.coda].map((t) => t.latin).join(""))
            .join("")
        : p.text,
    )
    .join("");
}

/** True when Latin -> blocks -> Latin is lossless for a single word. */
export function roundTripsCleanly(word: string): boolean {
  const tokens = engine().tokenize(word);
  if (!tokens) return false;
  return tokens.map((t) => t.latin).join("") === word.toLowerCase();
}
